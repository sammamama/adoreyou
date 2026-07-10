// S3 media storage + CloudFront delivery.
//
// Why this exists: Suno's CDN purges tracks after ~a week, so paid songs are
// copied ("archived") into our own private S3 bucket at payment time. Gift
// media (sender photo / voice note) uploads here too instead of bytea rows.
//
// Bucket is private. Clients get media two ways:
//   - playbackUrl(key): short-lived signed URL — CloudFront-signed when the
//     CLOUDFRONT_* vars are set (cheaper egress), else an S3 presigned URL.
//   - openObject(key): server-side stream for the proxy/download routes.
//
// All AWS config comes from env (see .env): AWS_REGION, AWS_ACCESS_KEY_ID,
// AWS_SECRET_ACCESS_KEY (standard SDK names, picked up automatically),
// S3_BUCKET, and optionally CLOUDFRONT_DOMAIN + CLOUDFRONT_KEY_PAIR_ID +
// CLOUDFRONT_PRIVATE_KEY for signed CloudFront delivery.

import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl as presignS3Url } from '@aws-sdk/s3-request-presigner';
import { getSignedUrl as signCloudFrontUrl } from '@aws-sdk/cloudfront-signer';
import type { Track } from '@/types';

const PLAYBACK_TTL_MS = 12 * 60 * 60 * 1000; // signed URL lifetime

let client: S3Client | null = null;

export function storageConfigured(): boolean {
  return !!(
    process.env.S3_BUCKET &&
    process.env.AWS_REGION &&
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY
  );
}

function s3(): S3Client {
  if (!client) client = new S3Client({ region: process.env.AWS_REGION });
  return client;
}

function bucket(): string {
  const name = process.env.S3_BUCKET;
  if (!name) throw new Error('S3_BUCKET is not set.');
  return name;
}

export async function putObject(
  key: string,
  body: Uint8Array,
  contentType: string
): Promise<void> {
  await s3().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
}

export interface StoredObject {
  stream: ReadableStream;
  contentType?: string;
  contentLength?: number;
}

// Server-side read for proxy routes (gift media, MP3 downloads, previews).
// `range` is an HTTP Range header value, e.g. "bytes=0-239999".
export async function openObject(
  key: string,
  range?: string
): Promise<StoredObject> {
  const res = await s3().send(
    new GetObjectCommand({ Bucket: bucket(), Key: key, Range: range })
  );
  if (!res.Body) throw new Error(`S3 object ${key} has no body.`);
  return {
    stream: res.Body.transformToWebStream(),
    contentType: res.ContentType,
    contentLength: res.ContentLength,
  };
}

// Short-lived signed URL for client playback. CloudFront-signed when
// configured (bucket stays private behind OAC), else S3 presigned.
export async function playbackUrl(key: string): Promise<string> {
  const domain = process.env.CLOUDFRONT_DOMAIN;
  const keyPairId = process.env.CLOUDFRONT_KEY_PAIR_ID;
  // Vercel env vars store the PEM with literal \n — restore real newlines.
  const privateKey = process.env.CLOUDFRONT_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (domain && keyPairId && privateKey) {
    return signCloudFrontUrl({
      url: `https://${domain.replace(/^https?:\/\//, '').replace(/\/$/, '')}/${key}`,
      keyPairId,
      privateKey,
      dateLessThan: new Date(Date.now() + PLAYBACK_TTL_MS),
    });
  }

  return presignS3Url(
    s3(),
    new GetObjectCommand({ Bucket: bucket(), Key: key }),
    { expiresIn: PLAYBACK_TTL_MS / 1000 }
  );
}

// Copy a paid song's tracks from Suno's expiring CDN into our bucket.
// Best-effort per track: a failed copy logs and leaves storageKey unset so
// the next ensure-archived pass retries while the Suno URL is still alive.
// Returns the tracks array with storageKeys filled in; safe to re-run
// (already-archived tracks are skipped, re-uploads overwrite the same key).
export async function archiveTracks(
  songId: string,
  tracks: Track[]
): Promise<Track[]> {
  if (!storageConfigured()) return tracks;

  return Promise.all(
    tracks.map(async (track) => {
      if (track.storageKey) return track;
      try {
        const res = await fetch(track.audioUrl);
        if (!res.ok) throw new Error(`Suno fetch failed (${res.status})`);
        const bytes = new Uint8Array(await res.arrayBuffer());
        const key = `songs/${songId}/${track.sunoTrackId}.mp3`;
        await putObject(key, bytes, 'audio/mpeg');
        return { ...track, storageKey: key };
      } catch (err) {
        console.error(
          `archive failed for song ${songId} track ${track.sunoTrackId}:`,
          err
        );
        return track;
      }
    })
  );
}

// Client-facing audio URL for a track: signed storage URL once archived,
// otherwise the (expiring) Suno URL as fallback.
export async function trackPlaybackUrl(track: Track): Promise<string> {
  if (track.storageKey && storageConfigured()) {
    try {
      return await playbackUrl(track.storageKey);
    } catch (err) {
      console.error(`playback url failed for ${track.storageKey}:`, err);
    }
  }
  return track.audioUrl;
}

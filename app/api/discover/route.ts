// Step 6 wait-state widget — "Discover a rising [city] artist". City comes
// from Vercel's IP-geolocation header; no header (local dev, unknown IP) →
// generic rising-artists fallback. Never errors to the client: no Spotify
// creds or no results just means { data: null } and the widget stays hidden.

import { NextRequest, NextResponse } from 'next/server';
import { discoverTracks } from '@/lib/spotify';

export async function GET(req: NextRequest) {
  const rawCity = req.headers.get('x-vercel-ip-city');
  let city: string | null = null;
  if (rawCity) {
    try {
      city = decodeURIComponent(rawCity);
    } catch {
      city = rawCity;
    }
  }

  const tracks = await discoverTracks(city);
  if (tracks.length === 0) {
    return NextResponse.json({ data: null, error: null });
  }

  return NextResponse.json({ data: { city, tracks }, error: null });
}

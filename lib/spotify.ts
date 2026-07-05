// Spotify discovery for the Step 6 wait state — "Discover a rising [city]
// artist" while Suno renders. Client-credentials flow (no user auth), results
// cached in-memory per city so a wait-state widget can't burn API quota.
// SPOTIFY_CLIENT_ID/SECRET unset → null, and the widget never renders.

export interface DiscoverTrack {
  artist: string;
  track: string;
  albumArt: string | null;
  spotifyUrl: string;
}

interface TokenCache {
  token: string;
  expiresAt: number;
}

interface ResultCache {
  at: number;
  tracks: DiscoverTrack[];
}

const RESULT_TTL_MS = 60 * 60 * 1000; // 1 hour per city
const MAX_TRACKS = 12;

let tokenCache: TokenCache | null = null;
const resultCache = new Map<string, ResultCache>();

function credentials(): { id: string; secret: string } | null {
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  return id && secret ? { id, secret } : null;
}

async function getToken(): Promise<string | null> {
  const creds = credentials();
  if (!creds) return null;
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.token;
  }

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${creds.id}:${creds.secret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    cache: 'no-store',
  });
  if (!res.ok) return null;

  const json = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };
  tokenCache = {
    token: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
  return tokenCache.token;
}

async function spotifyGet(path: string, token: string): Promise<unknown> {
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Spotify ${res.status} on ${path}`);
  return res.json();
}

type PlaylistSearchResponse = {
  playlists?: { items?: ({ id: string; tracks?: { total: number } } | null)[] };
};

type PlaylistTracksResponse = {
  items?: ({
    track?: {
      name?: string;
      artists?: { name: string }[];
      album?: { images?: { url: string }[] };
      external_urls?: { spotify?: string };
    } | null;
  } | null)[];
};

// Search a city-flavored indie playlist and pull its tracks. City missing or
// no local playlist found → generic rising-artists playlist instead.
async function fetchTracks(city: string | null): Promise<DiscoverTrack[]> {
  const token = await getToken();
  if (!token) return [];

  const queries = [
    ...(city ? [`${city} indie`, `${city} local artists`] : []),
    'rising indie artists',
  ];

  for (const query of queries) {
    const search = (await spotifyGet(
      `/search?q=${encodeURIComponent(query)}&type=playlist&limit=5`,
      token
    )) as PlaylistSearchResponse;
    const playlist = search.playlists?.items?.find(
      (p) => p && (p.tracks?.total ?? 0) > 0
    );
    if (!playlist) continue;

    const tracksRes = (await spotifyGet(
      `/playlists/${playlist.id}/tracks?limit=50&fields=items(track(name,artists(name),album(images),external_urls))`,
      token
    )) as PlaylistTracksResponse;

    const tracks = (tracksRes.items ?? [])
      .map((item) => item?.track)
      .filter(
        (t): t is NonNullable<typeof t> =>
          Boolean(t?.name && t.artists?.length && t.external_urls?.spotify)
      )
      .map((t) => ({
        artist: t.artists!.map((a) => a.name).join(', '),
        track: t.name!,
        albumArt: t.album?.images?.[0]?.url ?? null,
        spotifyUrl: t.external_urls!.spotify!,
      }));

    if (tracks.length > 0) {
      // Shuffle so every waiter sees a different slice of the playlist.
      for (let i = tracks.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
      }
      return tracks.slice(0, MAX_TRACKS);
    }
  }

  return [];
}

export async function discoverTracks(
  city: string | null
): Promise<DiscoverTrack[]> {
  if (!credentials()) return [];

  const key = city?.toLowerCase() ?? '__generic__';
  const cached = resultCache.get(key);
  if (cached && Date.now() - cached.at < RESULT_TTL_MS) return cached.tracks;

  try {
    const tracks = await fetchTracks(city);
    resultCache.set(key, { at: Date.now(), tracks });
    return tracks;
  } catch {
    // Spotify hiccup — the widget just doesn't show this time.
    return [];
  }
}

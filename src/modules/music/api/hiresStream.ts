/**
 * Client for /api/hires-stream — multi-source lossless FLAC resolver
 * (Monochrome / Netease / Internet Archive, Deezer catalogue matching).
 * Used when audio quality is set to "lossless"; every call fails soft so
 * the normal YouTube/Audius chain still runs when nothing resolves.
 */

export interface HiresTrack {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration?: number;
  artworkURL?: string;
  format?: string;
  audioQuality?: string;
  source?: string;
}

export interface HiresStream {
  url: string;
  codec?: string;
  container?: string;
  format?: string;
  sampleRate?: number;
  bitDepth?: number;
  bitrate?: number;
  channels?: number;
  quality?: string;
  provider?: string;
  encrypted?: boolean;
}

const BASE = '/api/hires-stream';

const q = (quality?: 'lossless' | 'high' | 'low') =>
  quality ? `&quality=${quality.toUpperCase()}` : '';

export async function searchHires(
  query: string,
  quality?: 'lossless' | 'high' | 'low'
): Promise<HiresTrack[]> {
  try {
    const res = await fetch(`${BASE}?q=${encodeURIComponent(query)}${q(quality)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.tracks) ? data.tracks : [];
  } catch {
    return [];
  }
}

export async function resolveHiresStream(
  id: string,
  quality?: 'lossless' | 'high' | 'low'
): Promise<HiresStream | null> {
  try {
    const res = await fetch(`${BASE}?id=${encodeURIComponent(id)}${q(quality)}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.url || data.encrypted === true) return null;
    return data as HiresStream;
  } catch {
    return null;
  }
}

/**
 * Try to find + resolve a lossless stream for a track.
 * Returns a playable URL plus real codec metadata, or null.
 */
export async function tryHiresStream(
  title: string,
  artist: string,
  duration?: number
): Promise<{ url: string; meta: HiresStream } | null> {
  if (!title || !artist) return null;

  // Strip featured-artist noise for a cleaner catalog query
  const cleanTitle = title.replace(/\s*[([](?:feat|ft|with|prod)[^)\]]*[)\]]/gi, '').trim();
  const tracks = await searchHires(`${artist} ${cleanTitle || title}`, 'lossless');
  if (!tracks.length) return null;

  const target = norm(`${title} ${artist}`);
  const targetSecs = duration || 0;

  const scored = tracks
    .map((t) => {
      const name = norm(`${t.title} ${t.artist}`);
      let score = 0;
      if (name === target) score += 100;
      else if (name.includes(norm(cleanTitle || title)) && name.includes(norm(artist.split(',')[0]))) score += 50;
      if (targetSecs && t.duration) {
        const drift = Math.abs(t.duration - targetSecs);
        if (drift <= 3) score += 40;
        else if (drift <= 10) score += 20;
        else if (drift <= 45) score += 8;
        else return { t, score: -1 };
      }
      return { t, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  // Try top candidates until one resolves to a real stream
  for (const { t } of scored.slice(0, 4)) {
    const stream = await resolveHiresStream(t.id, 'lossless');
    if (stream?.url) {
      // Monochrome/qqdl upstreams don't send CORS headers, and the player's
      // Web Audio graph requires CORS-clean media or it silently fails.
      // Netease and Archive send ACAO:* so they can play direct.
      const needsProxy = /monochrome\.st|qqdl\.site/i.test(stream.url) || stream.provider === 'Monochrome';
      // loadStream requires an absolute http(s) URL — relative /api paths throw
      const url = needsProxy
        ? `${window.location.origin}${BASE}?proxy=${encodeURIComponent(stream.url)}`
        : stream.url;
      return { url, meta: stream };
    }
  }
  return null;
}

function norm(value: string): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

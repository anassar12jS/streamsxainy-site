interface AudiusMatch {
  streamUrl: string;
  duration: number;
  title: string;
}

const audiusCache = new Map<string, AudiusMatch | null>();

/**
 * Searches Audius open network for a matching full-length audio stream.
 * Direct 320kbps MP3 stream, completely unblocked, CORS-compliant, no API keys needed.
 */
export async function getAudiusAudioStream(title: string, artist: string): Promise<string | null> {
  if (!title) return null;
  const cleanTitle = title.replace(/\(.*?remix.*?\)/gi, '').replace(/\[.*?\]/g, '').trim();
  const cleanArtist = (artist || '').trim();
  const cacheKey = `${cleanTitle}|${cleanArtist}`.toLowerCase();

  if (audiusCache.has(cacheKey)) {
    const cached = audiusCache.get(cacheKey);
    return cached ? cached.streamUrl : null;
  }

  try {
    const query = encodeURIComponent(`${cleanTitle} ${cleanArtist}`.trim());
    const res = await fetch(`https://api.audius.co/v1/tracks/search?query=${query}&app_name=streamhub`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(4000),
    });

    if (!res.ok) {
      audiusCache.set(cacheKey, null);
      return null;
    }

    const data = await res.json();
    const tracks = data?.data || [];
    if (tracks.length === 0) {
      audiusCache.set(cacheKey, null);
      return null;
    }

    // Pick top track with valid duration > 30s
    const match = tracks.find((t: any) => t.id && t.duration && t.duration > 30) || tracks[0];
    if (match?.id) {
      const streamUrl = `https://api.audius.co/v1/tracks/${match.id}/stream?app_name=streamhub`;
      audiusCache.set(cacheKey, { streamUrl, duration: match.duration, title: match.title });
      return streamUrl;
    }
  } catch (err) {
    console.debug('Audius stream search failed:', err);
  }

  audiusCache.set(cacheKey, null);
  return null;
}

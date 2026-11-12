export interface JioSaavnSong {
  id: string;
  name: string;
  type?: string;
  year?: string;
  duration?: number;
  label?: string;
  primaryArtists?: string;
  artists?: {
    primary?: Array<{ id: string; name: string }>;
    all?: Array<{ id: string; name: string }>;
  };
  image?: Array<{ quality: string; url: string }>;
  downloadUrl?: Array<{ quality: string; url: string }>;
  hasLyrics?: boolean;
}

export interface JioSaavnSearchResponse {
  success: boolean;
  data?: {
    total?: number;
    results?: JioSaavnSong[];
  };
}

const jioCache = new Map<string, string | null>();

/**
 * Searches a self-hosted or public JioSaavn API instance (e.g. from sumitkolhe/jiosaavn-api)
 * for a matching track and extracts the highest-quality 320kbps stream URL.
 */
export async function getJioSaavnStream(
  title: string,
  artist: string,
  customBaseUrl?: string
): Promise<{ streamUrl: string; duration?: number; artwork?: string } | null> {
  const baseUrl = (
    customBaseUrl ||
    (typeof window !== 'undefined' ? localStorage.getItem('bitchord_jiosaavn_url') : null) ||
    (typeof process !== 'undefined' && process.env?.VITE_JIOSAAVN_API_URL) ||
    'https://saavn.sumit.co'
  ).replace(/\/+$/, '');

  if (!baseUrl) return null;

  const cleanTitle = (title || '').replace(/\(.*?remix.*?\)/gi, '').replace(/\[.*?\]/g, '').trim();
  const cleanArtist = (artist || '').trim();
  const cacheKey = `${baseUrl}|${cleanTitle}|${cleanArtist}`.toLowerCase();

  if (jioCache.has(cacheKey)) {
    const cachedUrl = jioCache.get(cacheKey);
    return cachedUrl ? { streamUrl: cachedUrl } : null;
  }

  try {
    const query = encodeURIComponent(`${cleanTitle} ${cleanArtist}`.trim());
    const res = await fetch(`${baseUrl}/api/search/songs?query=${query}&limit=5`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(4500),
    });

    if (!res.ok) {
      jioCache.set(cacheKey, null);
      return null;
    }

    const json: JioSaavnSearchResponse = await res.json();
    const results = json?.data?.results || [];
    if (results.length === 0) {
      jioCache.set(cacheKey, null);
      return null;
    }

    // Filter out karaoke/tribute covers when original audio is requested
    const cleanLowerTitle = cleanTitle.toLowerCase();
    const song = results.find(s => {
      const name = (s.name || '').toLowerCase();
      const isCover = name.includes('karaoke') || name.includes('tribute') || name.includes('ringtone');
      if (cleanLowerTitle.includes('karaoke')) return true;
      return !isCover;
    }) || results[0];

    const downloads = song.downloadUrl || [];
    // Prefer 320kbps -> 160kbps -> highest available
    const bestAudio = 
      downloads.find(d => d.quality === '320kbps') ||
      downloads.find(d => d.quality === '160kbps') ||
      downloads[downloads.length - 1];

    if (bestAudio?.url) {
      jioCache.set(cacheKey, bestAudio.url);
      const artwork = song.image?.find(img => img.quality === '500x500')?.url || song.image?.[0]?.url;
      return {
        streamUrl: bestAudio.url,
        duration: song.duration,
        artwork,
      };
    }
  } catch (err) {
    console.debug('JioSaavn API search error:', err);
  }

  jioCache.set(cacheKey, null);
  return null;
}

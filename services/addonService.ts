
import { MediaType, StreamResponse, StreamProvider } from '../types';
import { getStreamProviders } from './storage';

const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes in milliseconds
const MAX_MEM_CACHE = 40;
const streamMemoryCache = new Map<string, { timestamp: number; data: StreamResponse }>();

const readStreamCache = (cacheKey: string): StreamResponse | null => {
  const mem = streamMemoryCache.get(cacheKey);
  if (mem) {
    if (Date.now() - mem.timestamp < CACHE_DURATION) return mem.data;
    streamMemoryCache.delete(cacheKey);
  }
  try {
    localStorage.removeItem(cacheKey); // clean up legacy bloated entries
  } catch {}
  try {
    const raw = sessionStorage.getItem(cacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.timestamp === 'number' && Date.now() - parsed.timestamp < CACHE_DURATION && parsed.data) {
      streamMemoryCache.set(cacheKey, parsed);
      return parsed.data as StreamResponse;
    }
    sessionStorage.removeItem(cacheKey);
  } catch {}
  return null;
};

const compactStreamsForSession = (streams: StreamResponse['streams'], limit: number): StreamResponse => ({
  streams: streams.slice(0, limit).map((s) => ({
    ...(s.name ? { name: s.name } : {}),
    ...(s.title ? { title: s.title.slice(0, 300) } : {}),
    ...(s.url ? { url: s.url } : {}),
    ...(s.infoHash ? { infoHash: s.infoHash } : {}),
    ...(s.fileIdx !== undefined ? { fileIdx: s.fileIdx } : {}),
  })),
});

const writeStreamCache = (cacheKey: string, data: StreamResponse) => {
  const entry = { timestamp: Date.now(), data };
  if (streamMemoryCache.size >= MAX_MEM_CACHE) {
    const oldestKey = streamMemoryCache.keys().next().value;
    if (oldestKey) streamMemoryCache.delete(oldestKey);
  }
  streamMemoryCache.set(cacheKey, entry);
  try {
    const trimmed = compactStreamsForSession(data.streams, 25);
    const payload = JSON.stringify({ timestamp: entry.timestamp, data: trimmed });
    if (payload.length > 512_000) return;
    sessionStorage.setItem(cacheKey, payload);
  } catch {
    // Evict older stream caches in sessionStorage and retry once cleanly
    try {
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const k = sessionStorage.key(i);
        if (k && (k.startsWith('streams_') || k.startsWith('episode_streams_'))) {
          sessionStorage.removeItem(k);
        }
      }
      const trimmed = compactStreamsForSession(data.streams, 15);
      sessionStorage.setItem(cacheKey, JSON.stringify({ timestamp: entry.timestamp, data: trimmed }));
    } catch {}
  }
};

const fetchFromProvider = async (provider: StreamProvider, type: string, id: string, timeoutMs = 8000): Promise<StreamResponse> => {
    try {
        let cleanUrl = provider.url.trim().replace(/\/$/, '');
        // Handle if user pasted a full manifest url like .../manifest.json
        if (cleanUrl.endsWith('manifest.json')) {
            cleanUrl = cleanUrl.replace('/manifest.json', '');
        }

        const url = `${cleanUrl}/stream/${type}/${id}.json`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!res.ok) return { streams: [] };
        
        const data = await res.json();
        // Tag streams with the provider name for debugging or display if needed
        const streams = (data.streams || []).map((s: any) => ({
            ...s,
            name: s.name ? `${provider.name} ${s.name.replace(provider.name, '')}` : provider.name
        }));
        
        return { streams };
    } catch (e) {
        return { streams: [] };
    }
};

export const getStreams = async (type: MediaType, id: string, options?: { timeoutMs?: number }): Promise<StreamResponse> => {
  const stremioType = type === MediaType.MOVIE ? 'movie' : 'series';
  const cacheKey = `streams_${stremioType}_${id}`;

  if (!id.startsWith('tt')) {
    console.warn("Invalid IMDb ID for streams:", id);
    return { streams: [] };
  }

  const cached = readStreamCache(cacheKey);
  if (cached) return cached;

  const providers = getStreamProviders();
  if (providers.length === 0) return { streams: [] };

  try {
      const results = await Promise.allSettled(
          providers.map(p => fetchFromProvider(p, stremioType, id, options?.timeoutMs))
      );

      const allStreams = results
          .filter(r => r.status === 'fulfilled')
          .flatMap(r => (r as PromiseFulfilledResult<StreamResponse>).value.streams);

      const uniqueStreams = allStreams.filter((stream, index, self) =>
          index === self.findIndex((s) => (
              s.infoHash && stream.infoHash ? s.infoHash === stream.infoHash : 
              s.url && stream.url ? s.url === stream.url : false
          )) || (!stream.infoHash && !stream.url)
      );

      const response = { streams: uniqueStreams };
      
      if (uniqueStreams.length > 0) {
          writeStreamCache(cacheKey, response);
      }
      
      return response;

  } catch (e) {
    console.error("Critical error in stream aggregator", e);
    return { streams: [] };
  }
};

export const getEpisodeStreams = async (imdbId: string, season: number, episode: number, options?: { timeoutMs?: number }): Promise<StreamResponse> => {
  const streamId = `${imdbId}:${season}:${episode}`;
  const cacheKey = `episode_streams_${streamId}`;

  const cached = readStreamCache(cacheKey);
  if (cached) return cached;
  
  const providers = getStreamProviders();
  if (providers.length === 0) return { streams: [] };

  try {
    const results = await Promise.allSettled(
        providers.map(p => fetchFromProvider(p, 'series', streamId, options?.timeoutMs))
    );

    const allStreams = results
        .filter(r => r.status === 'fulfilled')
        .flatMap(r => (r as PromiseFulfilledResult<StreamResponse>).value.streams);

    const uniqueStreams = allStreams.filter((stream, index, self) =>
          index === self.findIndex((s) => (
              s.infoHash && stream.infoHash ? s.infoHash === stream.infoHash : 
              s.url && stream.url ? s.url === stream.url : false
          ))
    );

    const response = { streams: uniqueStreams };
    
    if (uniqueStreams.length > 0) {
        writeStreamCache(cacheKey, response);
    }
    
    return response;
  } catch (e) {
    console.error("Critical error in episode stream aggregator", e);
    return { streams: [] };
  }
};

import { MediaType, StreamResponse, StreamProvider } from '../types';
import { getStreamProviders } from './storage';

const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes in milliseconds

const fetchFromProvider = async (provider: StreamProvider, type: string, id: string): Promise<StreamResponse> => {
    try {
        let cleanUrl = provider.url.trim().replace(/\/$/, '');
        // Handle if user pasted a full manifest url like .../manifest.json
        if (cleanUrl.endsWith('manifest.json')) {
            cleanUrl = cleanUrl.replace('/manifest.json', '');
        }

        const url = `${cleanUrl}/stream/${type}/${id}.json`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout per provider

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
        // console.error(`Failed to fetch from ${provider.name}`, e);
        return { streams: [] };
    }
};

export const getStreams = async (type: MediaType, id: string): Promise<StreamResponse> => {
  const stremioType = type === MediaType.MOVIE ? 'movie' : 'series';
  const cacheKey = `streams_${stremioType}_${id}`;

  if (!id.startsWith('tt')) {
    console.warn("Invalid IMDb ID for streams:", id);
    return { streams: [] };
  }

  // Check cache first
  const cachedData = localStorage.getItem(cacheKey);
  if (cachedData) {
    const { timestamp, data } = JSON.parse(cachedData);
    if (Date.now() - timestamp < CACHE_DURATION) {
      console.log("Returning cached streams for", id);
      return data;
    }
  }

  const providers = getStreamProviders();
  if (providers.length === 0) return { streams: [] };

  try {
      // Fetch from all providers in parallel
      const results = await Promise.allSettled(
          providers.map(p => fetchFromProvider(p, stremioType, id))
      );

      // Combine all successful results
      const allStreams = results
          .filter(r => r.status === 'fulfilled')
          .flatMap(r => (r as PromiseFulfilledResult<StreamResponse>).value.streams);

      // Simple deduplication based on infoHash if available, otherwise keep all
      const uniqueStreams = allStreams.filter((stream, index, self) =>
          index === self.findIndex((s) => (
              s.infoHash && stream.infoHash ? s.infoHash === stream.infoHash : 
              s.url && stream.url ? s.url === stream.url : false // Fallback to URL check
          )) || (!stream.infoHash && !stream.url) // Keep if no identifiers (rare)
      );

      const response = { streams: uniqueStreams };
      
      if (uniqueStreams.length > 0) {
          localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data: response }));
      }
      
      return response;

  } catch (e) {
    console.error("Critical error in stream aggregator", e);
    return { streams: [] };
  }
};

export const getEpisodeStreams = async (imdbId: string, season: number, episode: number): Promise<StreamResponse> => {
  const streamId = `${imdbId}:${season}:${episode}`;
  const cacheKey = `episode_streams_${streamId}`;

  // Check cache first
  const cachedData = localStorage.getItem(cacheKey);
  if (cachedData) {
    const { timestamp, data } = JSON.parse(cachedData);
    if (Date.now() - timestamp < CACHE_DURATION) {
      console.log("Returning cached episode streams for", streamId);
      return data;
    }
  }
  
  const providers = getStreamProviders();
  if (providers.length === 0) return { streams: [] };

  try {
    const results = await Promise.allSettled(
        providers.map(p => fetchFromProvider(p, 'series', streamId))
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
        localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data: response }));
    }
    
    return response;
  } catch (e) {
    console.error("Critical error in episode stream aggregator", e);
    return { streams: [] };
  }
};
// IPTV-org API integration for enhanced channel metadata
import { IPTVChannel } from '../types';

export interface IPTVOrgChannel {
  id: string;
  name: string;
  alt_names?: string[];
  network?: string | null;
  owners?: string[];
  country: string;
  categories: string[];
  is_nsfw: boolean;
  launched?: string | null;
  closed?: string | null;
  replaced_by?: string | null;
  website?: string | null;
}

export interface IPTVOrgStream {
  channel: string | null;
  feed?: string | null;
  title: string;
  url: string;
  referrer?: string | null;
  user_agent?: string | null;
  quality?: string | null;
}

export interface IPTVOrgCountry {
  name: string;
  code: string;
  languages: string[];
  flag: string;
}

// Cache for API data
let channelMetadataCache: Map<string, IPTVOrgChannel> = new Map();
let countriesCache: Map<string, IPTVOrgCountry> = new Map();
let streamsCache: Map<string, IPTVOrgStream[]> = new Map();
let logosCache: Map<string, any[]> = new Map();

export const fetchIPTVOrgChannels = async (): Promise<IPTVOrgChannel[]> => {
  try {
    const res = await fetch('https://iptv-org.github.io/api/channels.json');
    if (!res.ok) throw new Error('Failed to fetch IPTV-org channels');
    const channels = await res.json();
    
    // Build cache
    channels.forEach((ch: IPTVOrgChannel) => {
      channelMetadataCache.set(ch.id, ch);
    });
    
    return channels;
  } catch (e) {
    console.error('Error fetching IPTV-org channels:', e);
    return [];
  }
};

export const fetchIPTVOrgCountries = async (): Promise<IPTVOrgCountry[]> => {
  try {
    const res = await fetch('https://iptv-org.github.io/api/countries.json');
    if (!res.ok) throw new Error('Failed to fetch IPTV-org countries');
    const countries = await res.json();
    
    // Build cache
    countries.forEach((c: IPTVOrgCountry) => {
      countriesCache.set(c.code, c);
    });
    
    return countries;
  } catch (e) {
    console.error('Error fetching IPTV-org countries:', e);
    return [];
  }
};

export const fetchIPTVOrgStreams = async (): Promise<IPTVOrgStream[]> => {
  try {
    const res = await fetch('https://iptv-org.github.io/api/streams.json');
    if (!res.ok) throw new Error('Failed to fetch IPTV-org streams');
    const streams = await res.json();
    
    // Build cache by channel
    streams.forEach((s: IPTVOrgStream) => {
      if (s.channel) {
        if (!streamsCache.has(s.channel)) {
          streamsCache.set(s.channel, []);
        }
        streamsCache.get(s.channel)!.push(s);
      }
    });
    
    return streams;
  } catch (e) {
    console.error('Error fetching IPTV-org streams:', e);
    return [];
  }
};

export const fetchIPTVOrgLogos = async (): Promise<any[]> => {
  try {
    const res = await fetch('https://iptv-org.github.io/api/logos.json');
    if (!res.ok) throw new Error('Failed to fetch IPTV-org logos');
    const logos = await res.json();

    // Build cache by channel
    logos.forEach((l: any) => {
      if (!l.channel) return;
      if (!logosCache.has(l.channel)) logosCache.set(l.channel, []);
      logosCache.get(l.channel)!.push(l);
    });

    return logos;
  } catch (e) {
    console.error('Error fetching IPTV-org logos:', e);
    return [];
  }
};

export const getLogosForChannel = (channelId: string): any[] => {
  return logosCache.get(channelId) || [];
};

// Improve matching by sanitizing names and checking several strategies
export const matchOrgChannelByName = (name: string, orgChannels: IPTVOrgChannel[]): IPTVOrgChannel | undefined => {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '').trim();
  const target = normalize(name || '');
  if (!target) return undefined;

  // Exact normalized name
  let found = orgChannels.find(ch => normalize(ch.name) === target);
  if (found) return found;

  // alt_names exact
  found = orgChannels.find(ch => ch.alt_names && ch.alt_names.some(alt => normalize(alt) === target));
  if (found) return found;

  // Partial contains
  found = orgChannels.find(ch => normalize(ch.name).includes(target) || target.includes(normalize(ch.name)));
  if (found) return found;

  // Fallback to first that includes words
  const words = target.split(/\s+/).filter(Boolean);
  found = orgChannels.find(ch => words.every(w => normalize(ch.name).includes(w) || (ch.alt_names || []).some(alt => normalize(alt).includes(w))));
  return found;
};

// Choose the best stream for a channel (prefer highest numeric quality, fallback to first)
export const chooseBestStreamForChannel = (channelId: string): IPTVOrgStream | undefined => {
  const streams = streamsCache.get(channelId) || [];
  if (streams.length === 0) return undefined;

  // Parse quality like '720p' or '1080p' or 'HD' / 'SD'
  const qualityScore = (q?: string | null) => {
    if (!q) return 0;
    const m = q.match(/(\d{3,4})p/);
    if (m) return parseInt(m[1], 10);
    if (/1080|hd/i.test(q)) return 1080;
    if (/720/i.test(q)) return 720;
    if (/480|sd/i.test(q)) return 480;
    return 0;
  };

  let best = streams[0];
  let bestScore = qualityScore(best.quality);
  for (const s of streams) {
    const sc = qualityScore(s.quality);
    if (sc > bestScore) {
      best = s;
      bestScore = sc;
    }
  }

  return best;
};

// Get country info by code
export const getCountryInfo = (code: string): IPTVOrgCountry | undefined => {
  return countriesCache.get(code);
};

// Get channel metadata by ID
export const getChannelMetadata = (channelId: string): IPTVOrgChannel | undefined => {
  return channelMetadataCache.get(channelId);
};

// Get streams for a channel
export const getStreamsForChannel = (channelId: string): IPTVOrgStream[] => {
  return streamsCache.get(channelId) || [];
};

// Extract TVG ID from channel name or ID pattern (tvg-id format)
export const extractTVGId = (line: string): string | undefined => {
  const match = line.match(/tvg-id="([^"]*)"/);
  return match?.[1];
};

// Generate channel ID from name for matching
export const generateChannelId = (name: string, country?: string): string => {
  const sanitized = name.toLowerCase().replace(/[^a-z0-9]+/g, '');
  return country ? `${sanitized}.${country.toLowerCase()}` : sanitized;
};

// Enrich IPTV channel with IPTV-org metadata
export const enrichChannelMetadata = (
  channel: IPTVChannel,
  orgChannels: IPTVOrgChannel[]
): IPTVChannel => {
  // Try to find matching metadata by various strategies
  
  // Strategy 1: Direct ID match
  if (channel.id) {
    const meta = getChannelMetadata(channel.id);
    if (meta) {
      return {
        ...channel,
        country: meta.country,
        categories: meta.categories,
        isNsfw: meta.is_nsfw,
        network: meta.network || undefined,
        owners: meta.owners,
        website: meta.website || undefined,
        launched: meta.launched || undefined,
      };
    }
  }
  
  // Strategy 2: Name + Country fuzzy match
  const nameLower = channel.name.toLowerCase();
  const matching = orgChannels.find(
    ch => 
      ch.name.toLowerCase() === nameLower ||
      ch.alt_names?.some(alt => alt.toLowerCase() === nameLower)
  );
  
  if (matching) {
    return {
      ...channel,
      id: matching.id,
      country: matching.country,
      categories: matching.categories,
      isNsfw: matching.is_nsfw,
      network: matching.network || undefined,
      owners: matching.owners,
      website: matching.website || undefined,
      launched: matching.launched || undefined,
    };
  }
  
  return channel;
};

// Initialize IPTV-org data on app startup
export const initializeIPTVOrgData = async () => {
  await Promise.all([
    fetchIPTVOrgChannels(),
    fetchIPTVOrgCountries(),
    fetchIPTVOrgStreams(),
  ]);
};

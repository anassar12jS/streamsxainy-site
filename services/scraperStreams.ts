// Scraper providers resolve through the Cloudflare Worker (worker/egy-proxy.js)
// because egydead.ca's CF challenge and 71stream.one's IP filter block Vercel,
// and s1.egybestvid.com rejects cross-site browser HLS requests.
export const SCRAPER_WORKER = 'https://egy-proxy.anasltccnt.workers.dev';

export interface ScraperStream {
  url?: string;
  embedUrl?: string;
  name?: string;
  title?: string;
  isHls?: boolean;
  host?: string;
}

export interface ScraperResult {
  streams?: ScraperStream[];
  embeds?: { embedUrl: string; name?: string; host?: string }[];
  matched?: unknown;
  error?: string;
}

export async function fetchScraperStreams(
  provider: 'egydead' | '5tv',
  params: { type: string; title: string; year?: number | null; tmdb?: number; season?: number; episode?: number }
): Promise<ScraperResult> {
  const q = new URLSearchParams({ action: 'streams', type: params.type, title: params.title });
  if (params.year) q.set('year', String(params.year));
  if (params.tmdb) q.set('tmdb', String(params.tmdb));
  if (params.season) q.set('season', String(params.season));
  if (params.episode) q.set('episode', String(params.episode));
  const r = await fetch(`${SCRAPER_WORKER}/api/${provider}?${q.toString()}`);
  if (!r.ok) return { streams: [] };
  return r.json();
}

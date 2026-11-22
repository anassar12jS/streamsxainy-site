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
  embeds?: { embedUrl: string; name?: string; title?: string; host?: string }[];
  matched?: unknown;
  error?: string;
}

const decodeEntities = (s: string) =>
  s.replace(/&amp;/g, '&').replace(/&#038;/g, '&').replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

// Fetch an embed page through the worker proxy and extract direct media URLs.
// The signed HLS token is bound to the worker egress IP that fetched the embed,
// so this MUST go through the same proxy path the player uses for playback.
async function resolveEmbedViaProxy(embedUrl: string): Promise<{ url: string; isHls: boolean }[]> {
  try {
    const u = new URL(embedUrl);
    const viaProxy = `${SCRAPER_WORKER}/${u.hostname}${u.pathname}${u.search}`;
    const r = await fetch(viaProxy, { signal: AbortSignal.timeout(30000) });
    if (!r.ok) return [];
    const html = await r.text();

    const out: { url: string; isHls: boolean }[] = [];
    const seen = new Set<string>();
    const push = (raw: string) => {
      const url = decodeEntities(raw).trim();
      if (!/^https?:\/\//i.test(url)) return;
      // Route egybestvid media through the worker (cross-site block + IP-bound tokens)
      const final = url.replace('https://s1.egybestvid.com', `${SCRAPER_WORKER}/s1.egybestvid.com`);
      if (seen.has(final)) return;
      seen.add(final);
      out.push({ url: final, isHls: /\.m3u8(\?|$)/i.test(url) });
    };

    // 71stream.one: Inertia data-page JSON -> props.url
    const dp = html.match(/data-page="([^"]+)"/);
    if (dp) {
      try {
        const page = JSON.parse(decodeEntities(dp[1]));
        if (page?.props?.url) push(page.props.url);
      } catch { /* fall through */ }
    }
    // ult4vid/ultra4vid: <video data-link="...">
    const vl = html.match(/<video[^>]+data-link="([^"]+)"/i);
    if (vl) push(vl[1]);
    // egybestvid: jwplayer sources file:"..."
    const fe = /file\s*:\s*"([^"]+)"/g;
    let m;
    while ((m = fe.exec(html))) {
      const u2 = m[1].trim();
      if (/\.(m3u8|mp4|mpd)(\?|#|$)/i.test(u2)) push(u2);
    }
    if (!out.length) {
      const bare = /(https?:\/\/[^"'\s\\]+\.(?:m3u8|mp4|mpd)[^"'\s\\]*)/gi;
      let b;
      while ((b = bare.exec(html))) push(b[1].replace(/\\u0026/g, '&'));
    }
    return out.slice(0, 2);
  } catch {
    return [];
  }
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
  // 90s ceiling — 5TV resolution chains several upstream fetches server-side.
  const r = await fetch(`${SCRAPER_WORKER}/api/${provider}?${q.toString()}`, {
    signal: AbortSignal.timeout(90000),
  });
  if (!r.ok) return { streams: [] };
  const data: ScraperResult = await r.json();

  const streams = [...(data.streams || [])];
  const embeds = data.embeds || [];

  // Resolve embed pages through the proxy path (IP-bound tokens require it).
  // Skip embeds whose host already produced a direct stream.
  const directHosts = new Set(
    streams.map(s => {
      try { return new URL(s.url || '').hostname; } catch { return ''; }
    })
  );
  const pending = embeds.filter(e => {
    try { return !directHosts.has(new URL(e.embedUrl).hostname); } catch { return true; }
  }).slice(0, 3);

  const resolved = await Promise.all(
    pending.map(async e => {
      const media = await resolveEmbedViaProxy(e.embedUrl);
      return media.map(m => ({
        url: m.url,
        name: e.name || 'Embed',
        title: e.title || e.name || 'stream',
        isHls: m.isHls,
      }));
    })
  );
  for (const list of resolved) streams.push(...list);

  const seen = new Set<string>();
  return { ...data, streams: streams.filter(s => s.url && !seen.has(s.url) && seen.add(s.url)) };
}

// Scraper providers resolve through /api/5tv (same-origin on Vercel / Vite dev)
// or the Cloudflare Worker (worker/egy-proxy.js) for egydead.ca CF bypass +
// s1.egybestvid.com HLS proxying.
export const SCRAPER_WORKER = 'https://egy-proxy.anasltccnt.workers.dev';

export interface ScraperStream {
  url?: string;
  embedUrl?: string;
  name?: string;
  title?: string;
  isHls?: boolean;
  host?: string;
}

export interface ScraperEmbed {
  embedUrl: string;
  name?: string;
  title?: string;
  host?: string;
}

export interface ScraperResult {
  streams?: ScraperStream[];
  embeds?: ScraperEmbed[];
  matched?: unknown;
  error?: string;
}

const decodeEntities = (s: string) =>
  s.replace(/&amp;/g, '&').replace(/&#038;/g, '&').replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

const PROXY_EXTRACTABLE_HOSTS = /(?:^|\.)(?:egybestvid\.com|71stream\.one|ult4vid\.one|ultra4vid\.cam)$/i;
const BLOCKED_IFRAME_HOSTS = /(?:^|\.)(?:drive\.google\.com|docs\.google\.com)$/i;

// Fetch an embed page through the worker proxy and extract direct media URLs.
// The signed HLS token is bound to the worker egress IP that fetched the embed,
// so this MUST go through the same proxy path the player uses for playback.
async function resolveEmbedViaProxy(embedUrl: string): Promise<{ url: string; isHls: boolean }[]> {
  try {
    const u = new URL(embedUrl);
    if (!PROXY_EXTRACTABLE_HOSTS.test(u.hostname)) return [];
    const viaProxy = `${SCRAPER_WORKER}/${u.hostname}${u.pathname}${u.search}`;
    const r = await fetch(viaProxy, { signal: AbortSignal.timeout(25000) });
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

async function fetchJsonWithTimeout(url: string, timeoutMs: number): Promise<ScraperResult | null> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!r.ok) return null;
    const ct = r.headers.get('content-type') || '';
    if (!ct.includes('application/json')) return null;
    return await r.json();
  } catch {
    return null;
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

  let data: ScraperResult | null = null;
  if (provider === '5tv') {
    data = await fetchJsonWithTimeout(`/api/5tv?${q.toString()}`, 35000);
    if (!data || (!data.streams?.length && !data.embeds?.length)) {
      const workerData = await fetchJsonWithTimeout(`${SCRAPER_WORKER}/api/5tv?${q.toString()}`, 45000);
      if (workerData && (workerData.streams?.length || workerData.embeds?.length || !data)) {
        data = workerData;
      }
    }
  } else {
    data = await fetchJsonWithTimeout(`${SCRAPER_WORKER}/api/egydead?${q.toString()}`, 45000);
  }

  if (!data) return { streams: [], embeds: [] };

  const streams = [...(data.streams || [])];
  const rawEmbeds = data.embeds || [];

  const cleanEmbeds: ScraperEmbed[] = [];
  const seenEmbeds = new Set<string>();
  for (const e of rawEmbeds) {
    if (!e?.embedUrl || !/^https?:\/\//i.test(e.embedUrl)) continue;
    let host = e.host || '';
    try {
      const u = new URL(e.embedUrl);
      if (BLOCKED_IFRAME_HOSTS.test(u.hostname)) continue;
      host = host || u.hostname.replace(/^www\./, '');
    } catch {
      continue;
    }
    if (seenEmbeds.has(e.embedUrl)) continue;
    seenEmbeds.add(e.embedUrl);
    cleanEmbeds.push({ ...e, host });
  }

  // Only attempt proxy-based media extraction for hosts whose embed pages
  // return direct MP4/HLS manifests via the worker proxy.
  const directHosts = new Set(
    streams.map(s => {
      try { return new URL(s.url || '').hostname; } catch { return ''; }
    })
  );
  const pending = cleanEmbeds.filter(e => {
    try {
      const u = new URL(e.embedUrl);
      return PROXY_EXTRACTABLE_HOSTS.test(u.hostname) && !directHosts.has(u.hostname);
    } catch {
      return false;
    }
  }).slice(0, 3);

  if (pending.length > 0) {
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
  }

  const seenStreams = new Set<string>();
  return {
    ...data,
    streams: streams.filter(s => s.url && !seenStreams.has(s.url) && seenStreams.add(s.url)),
    embeds: cleanEmbeds,
  };
}

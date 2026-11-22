/**
 * Xainy scraper worker — two jobs:
 *
 * 1) RESOLVER endpoints (called by the site directly):
 *    /api/egydead?action=streams&type=movie|tv&title=..&year=..&season=..&episode=..
 *    /api/5tv?action=streams&type=movie|tv&title=..&year=..&season=..&episode=..
 *    These run the full scrape inside the worker because egydead.ca's
 *    Cloudflare challenge and 71stream.one's IP filter both block Vercel.
 *
 * 2) PROXY paths (used for HLS playback):
 *    /<host>/<path>  e.g. /s1.egybestvid.com/hls2/.../master.m3u8
 *    s1.egybestvid.com rejects cross-site browser requests (sec-fetch-site),
 *    so HLS playlists+segments are proxied here; m3u8 bodies get rewritten.
 *
 * NOT an open proxy: GET only, whitelisted hosts + path prefixes.
 */

const UPSTREAMS = {
  'egydead.ca': 'https://egydead.ca',
  'egybestvid.com': 'https://egybestvid.com',
  's1.egybestvid.com': 'https://s1.egybestvid.com',
  '71stream.one': 'https://71stream.one',
  'ult4vid.one': 'https://ult4vid.one',
  'ultra4vid.cam': 'https://ultra4vid.cam',
};

const ALLOWED = {
  'egydead.ca': [/^\/api\/v1\//, /^\/titles\//, /^\/watch\//, /^\/$/],
  'egybestvid.com': [/^\/embed-[a-z0-9]+\.html$/, /^\/$/],
  's1.egybestvid.com': [/^\/hls2\//],
  '71stream.one': [/^\/embed\//],
  'ult4vid.one': [/^\/embed\//],
  'ultra4vid.cam': [/^\/embed\//],
};

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Max-Age': '86400',
};

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });

const proxiedMediaUrl = (u, origin) => {
  try {
    const p = new URL(u);
    if (['egybestvid.com', 's1.egybestvid.com'].includes(p.hostname)) {
      return `${origin}/${p.hostname}${p.pathname}${p.search}`;
    }
  } catch {}
  return u;
};

// ===========================================================================
//  EGYDEAD RESOLVER
// ===========================================================================

const EGY = 'https://egydead.ca';
const egyCache = new Map();
// embed TTL is intentionally tiny: the signed m3u8 inside is bound to the
// worker egress IP that fetched the embed page, so stale entries 403.
const egyTTL = { search: 30 * 60e3, title: 30 * 60e3, episode: 30 * 60e3, watch: 30 * 60e3, embed: 60e3 };

function egyCached(key, ttl, fn) {
  const hit = egyCache.get(key);
  if (hit && Date.now() - hit.at < ttl) return Promise.resolve(hit.data);
  return fn().then(data => {
    if (data != null) egyCache.set(key, { at: Date.now(), data });
    return data;
  }).catch(() => (hit ? hit.data : null));
}

const BROWSER_HEADERS = {
  'User-Agent': UA,
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
};
const JSON_HEADERS = { ...BROWSER_HEADERS, 'X-Requested-With': 'XMLHttpRequest', 'Referer': `${EGY}/` };
const PAGE_HEADERS = { ...BROWSER_HEADERS, 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', 'Referer': `${EGY}/` };

async function egyFetchText(url, headers = PAGE_HEADERS, timeoutMs = 15000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { headers, signal: ctrl.signal, redirect: 'follow' });
    if (!r.ok) return null;
    return await r.text();
  } catch { return null; } finally { clearTimeout(t); }
}
const egyFetchJson = (url, headers, timeoutMs) =>
  egyFetchText(url, headers, timeoutMs).then(t => { try { return t ? JSON.parse(t) : null; } catch { return null; } });

function parseBootstrap(html) {
  const i = html.indexOf('window.bootstrapData = ');
  if (i === -1) return null;
  const start = i + 'window.bootstrapData = '.length;
  const end = html.indexOf('</script>', start);
  if (end === -1) return null;
  let body = html.slice(start, end).trim();
  if (body.endsWith(';')) body = body.slice(0, -1);
  try { return JSON.parse(body); } catch { return null; }
}

const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

async function egySearchTitle(title, year, tmdbId, wantSeries) {
  const q = norm(title).replace(/\s+/g, ' ');
  if (!q) return null;
  const data = await egyCached(`egy:search:${q}`, egyTTL.search, () =>
    egyFetchJson(`${EGY}/api/v1/search/${encodeURIComponent(q)}?loader=searchAutocomplete`, JSON_HEADERS));
  const results = Array.isArray(data?.results) ? data.results : [];
  if (!results.length) return null;

  const wantTitle = norm(title);
  let best = null, bestScore = -1;
  for (const r of results.slice(0, 20)) {
    const rTitle = norm(r.original_title || r.name || '');
    const rName = norm(r.name || '');
    let score = 0;
    if (tmdbId && r.tmdb_id === tmdbId) score += 200;
    if (rTitle === wantTitle || rName === wantTitle) score += 80;
    else if (rTitle.includes(wantTitle) || wantTitle.includes(rTitle)) score += 40;
    const ry = r.year || (r.release_date ? parseInt(r.release_date, 10) : null);
    if (year && ry) {
      const dy = Math.abs(ry - year);
      if (dy === 0) score += 20; else if (dy === 1) score += 8;
    }
    const isSeries = Boolean(r.is_series) || r.type === 'series' || r.type === 'tv';
    if (wantSeries === isSeries) score += 10;
    if (score > bestScore) { bestScore = score; best = r; }
  }
  if (!best) return null;
  if (bestScore < 30 && !(tmdbId && best.tmdb_id === tmdbId)) return null;
  return best;
}

function pickVideos(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  return list
    .filter(v => v && v.approved !== false && v.src && /^https?:\/\//i.test(v.src))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .filter(v => { if (seen.has(v.src)) return false; seen.add(v.src); return true; })
    .slice(0, 4);
}

async function egyResolveEmbed(embedUrl) {
  return egyCached(`egy:embed:${embedUrl}`, egyTTL.embed, async () => {
    const html = await egyFetchText(embedUrl, { 'User-Agent': UA, 'Accept': 'text/html,*/*', 'Referer': `${EGY}/` });
    if (!html) return null;
    const urls = [];
    const re = /file\s*:\s*"([^"]+)"/g;
    let m;
    while ((m = re.exec(html))) {
      const u = m[1].trim();
      if (/^https?:\/\//i.test(u) && /\.(m3u8|mp4|mpd)(\?|#|$)/i.test(u) && !urls.includes(u)) urls.push(u);
    }
    if (!urls.length) {
      const re2 = /(https?:\/\/[^"'\s\\]+\.(?:m3u8|mp4|mpd)[^"'\s\\]*)/gi;
      let m2;
      while ((m2 = re2.exec(html))) {
        const u = m2[1].replace(/\\u0026/g, '&');
        if (!urls.includes(u)) urls.push(u);
      }
    }
    return urls.length ? urls : null;
  });
}

async function egyStreamsFromVideos(videos, origin) {
  const chosen = pickVideos(videos);
  const out = [];
  await Promise.all(chosen.map(async v => {
    const src = v.src;
    let urls = null;
    if (/\.html?(\?|$)/i.test(src) || /embed-/i.test(src)) {
      urls = await egyResolveEmbed(src);
    } else if (/\.(m3u8|mp4|mpd)(\?|#|$)/i.test(src)) {
      urls = [src];
    }
    if (!urls) return;
    for (const url of urls.slice(0, 2)) {
      out.push({
        url: proxiedMediaUrl(url, origin),
        name: `EgyDead · ${v.name || v.quality || 'Server'}${v.quality ? ` · ${String(v.quality).toUpperCase()}` : ''}`,
        title: `${v.name || 'EgyDead'} — ${url.split('/').pop()?.split('?')[0] || 'stream'}`,
        isHls: /\.m3u8(\?|$)/i.test(url),
      });
    }
  }));
  const seen = new Set();
  return out.filter(s => !seen.has(s.url) && seen.add(s.url));
}

async function egyMovieStreams(egyId) {
  return egyCached(`egy:title:${egyId}`, egyTTL.title, async () => {
    const html = await egyFetchText(`${EGY}/titles/${egyId}/x`, PAGE_HEADERS);
    if (!html) return null;
    const boot = parseBootstrap(html);
    const tp = boot?.loaders?.titlePage;
    const title = tp?.title;
    if (!title) return null;
    const videos = Array.isArray(title.videos) && title.videos.length ? title.videos : null;
    if (videos) return { title, videos };
    const pv = title.primary_video;
    if (pv?.id) {
      const wp = await egyCached(`egy:watch:${pv.id}`, egyTTL.watch, () => egyFetchJson(`${EGY}/api/v1/watch/${pv.id}`, JSON_HEADERS));
      const list = [];
      if (wp?.video) list.push(wp.video);
      if (Array.isArray(wp?.alternative_videos)) list.push(...wp.alternative_videos);
      return { title, videos: list };
    }
    return { title, videos: [] };
  });
}

async function egyEpisodeStreams(egyId, season, episode) {
  return egyCached(`egy:ep:${egyId}:${season}x${episode}`, egyTTL.episode, async () => {
    const html = await egyFetchText(`${EGY}/titles/${egyId}/x/season/${season}/episode/${episode}`, PAGE_HEADERS);
    if (!html) return null;
    const boot = parseBootstrap(html);
    const ep = boot?.loaders?.episodePage?.episode;
    if (!ep) return { videos: [] };
    const videos = Array.isArray(ep.videos) && ep.videos.length ? ep.videos : [];
    if (videos.length) return { videos };
    const pv = ep.primary_video;
    if (pv?.id) {
      const wp = await egyCached(`egy:watch:${pv.id}`, egyTTL.watch, () => egyFetchJson(`${EGY}/api/v1/watch/${pv.id}`, JSON_HEADERS));
      const list = [];
      if (wp?.video) list.push(wp.video);
      if (Array.isArray(wp?.alternative_videos)) list.push(...wp.alternative_videos);
      return { videos: list };
    }
    return { videos: [] };
  });
}

async function handleEgyDead(params, origin) {
  const title = String(params.get('title') || '').trim();
  const year = parseInt(params.get('year'), 10) || null;
  const tmdbId = parseInt(params.get('tmdb'), 10) || null;
  const wantSeries = String(params.get('type') || '') === 'tv';
  const season = parseInt(params.get('season'), 10) || null;
  const episode = parseInt(params.get('episode'), 10) || null;
  if (!title) return json({ streams: [], error: 'title required' }, 400);

  const match = await egySearchTitle(title, year, tmdbId, wantSeries);
  if (!match) return json({ streams: [], error: 'not found' });

  let videos = [];
  if (wantSeries && season && episode) {
    const r = await egyEpisodeStreams(match.id, season, episode);
    videos = r?.videos || [];
  } else {
    const r = await egyMovieStreams(match.id);
    videos = r?.videos || [];
  }

  const streams = await egyStreamsFromVideos(videos, origin);
  return json({
    streams,
    matched: {
      id: match.id,
      name: match.name,
      original_title: match.original_title,
      year: match.year || (match.release_date ? match.release_date.slice(0, 4) : null),
      is_series: Boolean(match.is_series),
    },
  });
}

// ===========================================================================
//  5TV RESOLVER
// ===========================================================================

const SITE = 'https://5tv.rest';
const ftvCache = new Map();
const ftvTTL = { search: 20 * 60e3, page: 15 * 60e3, resolve: 8 * 60e3 };

function ftvCached(key, ttl, fn) {
  const hit = ftvCache.get(key);
  if (hit && Date.now() - hit.at < ttl) return Promise.resolve(hit.data);
  return fn().then(data => {
    if (data != null) ftvCache.set(key, { at: Date.now(), data });
    return data;
  }).catch(() => (hit ? hit.data : null));
}

const slugify = s => norm(s).replace(/\s+/g, '-');

async function ftvFetchText(url, { method = 'GET', body, referer = SITE + '/', timeoutMs = 15000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      method,
      signal: ctrl.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': referer,
        ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest' } : {}),
      },
      body,
    });
    if (!r.ok) return null;
    return await r.text();
  } catch { return null; } finally { clearTimeout(t); }
}

const decodeEntities = s => String(s || '')
  .replace(/&amp;/g, '&').replace(/&#038;/g, '&').replace(/&quot;/g, '"')
  .replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));

async function ftvSearchLinks(q) {
  return ftvCached(`ftv:search:${q}`, ftvTTL.search, async () => {
    const xml = await ftvFetchText(`${SITE}/search/${encodeURIComponent(q).replace(/%20/g, '+')}/feed/rss2/`, { timeoutMs: 12000 });
    if (!xml) return [];
    const links = [];
    const re = /<link>(https:\/\/5tv\.rest\/[^<]+)<\/link>/g;
    let m;
    while ((m = re.exec(xml))) {
      const u = decodeEntities(m[1]);
      if (!links.includes(u)) links.push(u);
    }
    return links;
  });
}

function slugScore(linkSlug, titleSlug) {
  if (!linkSlug || !titleSlug) return 0;
  if (linkSlug === titleSlug) return 100;
  const a = new Set(linkSlug.split('-').filter(w => w.length > 2));
  const b = titleSlug.split('-').filter(w => w.length > 2);
  if (!b.length) return 0;
  const hit = b.filter(w => a.has(w)).length;
  return Math.round((hit / b.length) * 60);
}

async function ftvFindMovieUrl(title, year) {
  const q = norm(title);
  const titleSlug = slugify(title);
  const links = await ftvSearchLinks(q);
  let best = null, bestScore = -1;
  for (const u of links) {
    const m = u.match(/\/movie\/([^/]+)\/?$/);
    if (!m) continue;
    const sc = slugScore(m[1].replace(/-\d{4}.*$/, ''), titleSlug);
    if (sc > bestScore) { bestScore = sc; best = u; }
  }
  if (bestScore < 30) {
    for (const cand of [`${SITE}/movie/${titleSlug}-${year}/`, `${SITE}/movie/${titleSlug}/`]) {
      const html = await ftvFetchText(cand, { timeoutMs: 10000 });
      if (html && html.includes('ftv-watch')) return cand;
    }
    return null;
  }
  return best;
}

async function ftvFindEpisodeUrl(title, season, episode) {
  const titleSlug = slugify(title);
  const epRe = /\/(\d+)x(\d+)\/?$/;
  const links = await ftvSearchLinks(norm(title));
  let best = null, bestScore = -1;
  for (const u of links) {
    const m = u.match(/\/episode\/([^/]+?)\/?$/);
    if (!m) continue;
    const em = m[1].match(epRe);
    if (!em) continue;
    if (+em[1] !== season || +em[2] !== episode) continue;
    const showSlug = m[1].replace(epRe, '');
    const sc = slugScore(showSlug, titleSlug);
    if (sc > bestScore) { bestScore = sc; best = u; }
  }
  if (bestScore >= 30) return best;
  const cand = `${SITE}/episode/${titleSlug}-${season}x${episode}/`;
  const html = await ftvFetchText(cand, { timeoutMs: 10000 });
  if (html && html.includes('ftv-watch')) return cand;
  return null;
}

function ftvParseWatchBox(html) {
  const cfgM = html.match(/window\.FTV_SERVER_FRONTEND = (\{[^;]+\})/);
  const objectId = cfgM ? (JSON.parse(cfgM[1]).objectId || null) : null;
  const servers = [];
  const re = /data-server-url="([^"]+)"[^>]*?data-server-id="(\d+)"[^>]*?data-server-vip="(\d)"/g;
  let m;
  while ((m = re.exec(html))) {
    if (m[3] === '1') continue;
    servers.push({ url: decodeEntities(m[1]), id: m[2] });
  }
  const seen = new Set();
  return { objectId, servers: servers.filter(s => !seen.has(s.id) && seen.add(s.id)) };
}

async function ftvAccessUrl(objectId, serverId) {
  const body = new URLSearchParams({
    action: 'ftv_71_access_url',
    object_id: String(objectId),
    server_id: String(serverId),
    server_type: 'watch',
  }).toString();
  const text = await ftvFetchText(`${SITE}/wp-admin/admin-ajax.php`, { method: 'POST', body, referer: SITE + '/' });
  if (!text) return null;
  try {
    const j = JSON.parse(text);
    return j?.success && j?.data?.url ? j.data.url : null;
  } catch { return null; }
}

async function ftvResolveEmbedMedia(embedUrl) {
  return ftvCached(`ftv:embed:${embedUrl}`, ftvTTL.resolve, async () => {
    const html = await ftvFetchText(embedUrl, { referer: SITE + '/' });
    if (!html) return null;
    // 71stream.one: Inertia data-page JSON -> props.url
    const m = html.match(/data-page="([^"]+)"/);
    if (m) {
      try {
        const page = JSON.parse(decodeEntities(m[1]));
        const url = page?.props?.url;
        if (url && /^https?:\/\//i.test(url)) {
          return { url, title: page.props.title || null, mime: page.props.mime || null };
        }
      } catch { /* fall through */ }
    }
    // ult4vid.one / ultra4vid: plain <video data-link="...">
    const v = html.match(/<video[^>]+data-link="([^"]+)"/i);
    if (v) {
      const url = decodeEntities(v[1]);
      if (/^https?:\/\//i.test(url)) return { url, title: null, mime: 'video/mp4' };
    }
    return null;
  });
}

async function ftvStreamsForPage(pageUrl) {
  return ftvCached(`ftv:page:${pageUrl}`, ftvTTL.page, async () => {
    const html = await ftvFetchText(pageUrl);
    if (!html || !html.includes('ftv-watch')) return null;
    const { objectId, servers } = ftvParseWatchBox(html);
    if (!objectId || !servers.length) return { streams: [] };

    const out = [];
    const embeds = [];
    await Promise.all(servers.slice(0, 3).map(async (sv, i) => {
      const signed = await ftvAccessUrl(objectId, sv.id);
      if (!signed) return;
      const host = new URL(sv.url).hostname.replace(/^www\./, '');
      embeds.push({ embedUrl: signed, name: `5TV · ${host}`, host });
      const media = await ftvResolveEmbedMedia(signed);
      if (!media) return;
      out.push({
        url: media.url,
        name: `5TV · ${host}${i === 0 ? '' : ` ${i + 1}`}`,
        title: media.title || `${host} — ${pageUrl.split('/').filter(Boolean).pop()}`,
        isHls: /\.m3u8(\?|$)/i.test(media.url),
      });
    }));
    return { streams: out, embeds };
  });
}

async function handle5tv(params) {
  const title = String(params.get('title') || '').trim();
  const type = String(params.get('type') || 'movie');
  const season = parseInt(params.get('season'), 10) || null;
  const episode = parseInt(params.get('episode'), 10) || null;
  if (!title) return json({ streams: [], embeds: [], error: 'title required' }, 400);

  let pageUrl = null;
  if (type === 'tv' && season && episode) {
    pageUrl = await ftvFindEpisodeUrl(title, season, episode);
  } else {
    pageUrl = await ftvFindMovieUrl(title, parseInt(params.get('year'), 10) || null);
  }
  if (!pageUrl) return json({ streams: [], embeds: [], error: 'not found' });

  const r = await ftvStreamsForPage(pageUrl);
  return json({
    streams: r?.streams || [],
    embeds: r?.embeds || [],
    matched: { page: pageUrl },
  });
}

// ===========================================================================
//  PROXY + ROUTER
// ===========================================================================

function rewritePlaylist(body, workerOrigin) {
  return body.replace(/https:\/\/s1\.egybestvid\.com/g, `${workerOrigin}/s1.egybestvid.com`);
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const origin = url.origin;

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }
    if (request.method !== 'GET') {
      return new Response('method not allowed', { status: 405, headers: CORS });
    }

    // Resolver endpoints
    if (url.pathname === '/api/egydead') {
      try { return await handleEgyDead(url.searchParams, origin); }
      catch (e) { return json({ streams: [], error: String(e?.message || e) }); }
    }
    if (url.pathname === '/api/5tv') {
      try { return await handle5tv(url.searchParams); }
      catch (e) { return json({ streams: [], embeds: [], error: String(e?.message || e) }); }
    }

    // Proxy paths: /<host>/<path>
    const [hostSeg, ...rest] = url.pathname.split('/').filter(Boolean);
    const upstreamBase = UPSTREAMS[hostSeg];
    const upstreamPath = '/' + rest.join('/');

    if (!upstreamBase || !(ALLOWED[hostSeg] || []).some(re => re.test(upstreamPath))) {
      return new Response('forbidden', { status: 403, headers: CORS });
    }

    const target = upstreamBase + upstreamPath + url.search;

    try {
      const upstream = await fetch(target, {
        method: 'GET',
        redirect: 'follow',
        headers: {
          'User-Agent': UA,
          'Accept': '*/*',
          'Accept-Language': 'en-US,en;q=0.9',
          'X-Requested-With': 'XMLHttpRequest',
          'Referer': hostSeg === 's1.egybestvid.com' ? 'https://egybestvid.com/'
            : /stream\.one|4vid\.(one|cam)$/.test(hostSeg) ? 'https://5tv.rest/' : upstreamBase + '/',
        },
      });

      const ct = upstream.headers.get('content-type') || '';
      const isPlaylist = /mpegurl|m3u8/i.test(ct) || /\.m3u8(\?|$)/i.test(upstreamPath);

      const headers = new Headers();
      headers.set('Content-Type', isPlaylist ? 'application/vnd.apple.mpegurl' : (ct || 'application/octet-stream'));
      headers.set('Cache-Control', isPlaylist ? 'public, max-age=60' : 'public, max-age=3600');
      Object.entries(CORS).forEach(([k, v]) => headers.set(k, v));

      if (isPlaylist) {
        const text = await upstream.text();
        return new Response(rewritePlaylist(text, origin), { status: upstream.status, headers });
      }
      return new Response(upstream.body, { status: upstream.status, headers });
    } catch (e) {
      return new Response(JSON.stringify({ error: String(e?.message || e) }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }
  },
};

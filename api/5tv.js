// 5TV Asia resolver for Vercel / Node dev middleware.
// GET /api/5tv?action=streams&type=movie|tv&title=...&year=...&season=...&episode=...

const SITE = 'https://5tv.rest';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const cache = new Map();
const TTL = { search: 20 * 60e3, page: 15 * 60e3 };

function cached(key, ttl, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttl) return Promise.resolve(hit.data);
  return fn()
    .then((data) => {
      if (data != null) cache.set(key, { at: Date.now(), data });
      return data;
    })
    .catch(() => (hit ? hit.data : null));
}

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const slugify = (s) => norm(s).replace(/\s+/g, '-');

const decodeEntities = (s) =>
  String(s || '')
    .replace(/&amp;/g, '&')
    .replace(/&#038;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));

async function fetchText(url, { method = 'GET', body, referer = `${SITE}/`, timeoutMs = 15000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      method,
      signal: ctrl.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        Referer: referer,
        ...(body
          ? {
              'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
              'X-Requested-With': 'XMLHttpRequest',
            }
          : {}),
      },
      body,
    });
    if (!r.ok) return null;
    return await r.text();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function searchItems(q) {
  return cached(`ftv:search:${q}`, TTL.search, async () => {
    const xml = await fetchText(
      `${SITE}/?s=${encodeURIComponent(q).replace(/%20/g, '+')}&feed=rss2`,
      { timeoutMs: 12000 }
    );
    if (!xml) return [];
    const items = [];
    const seen = new Set();
    const itemRe = /<item>([\s\S]*?)<\/item>/g;
    let m;
    while ((m = itemRe.exec(xml))) {
      const block = m[1];
      const linkM = block.match(/<link>(https:\/\/5tv\.rest\/[^<]+)<\/link>/);
      if (!linkM) continue;
      const link = decodeEntities(linkM[1]).trim();
      if (seen.has(link)) continue;
      seen.add(link);
      const titleM = block.match(/<title>([\s\S]*?)<\/title>/);
      const itemTitle = titleM ? decodeEntities(titleM[1]).trim() : '';
      items.push({ link, title: itemTitle });
    }
    return items;
  });
}

function tokenScore(candidateSlug, targetSlug) {
  if (!candidateSlug || !targetSlug) return 0;
  if (candidateSlug === targetSlug) return 100;
  const a = new Set(candidateSlug.split('-').filter((w) => w.length > 2));
  const b = targetSlug.split('-').filter((w) => w.length > 2);
  if (!b.length) return 0;
  const hit = b.filter((w) => a.has(w)).length;
  return Math.round((hit / b.length) * 60);
}

function matchItemScore(item, titleSlug) {
  let slug = '';
  try {
    slug = decodeURIComponent(new URL(item.link).pathname.split('/').filter(Boolean).pop() || '');
  } catch {}
  const cleanedSlug = slug.replace(/-\d{4}.*$/, '').replace(/-\d+(?:x\d+)?$/, '');
  const s1 = tokenScore(slugify(cleanedSlug), titleSlug);
  const s2 = tokenScore(slugify(item.title), titleSlug);
  return Math.max(s1, s2);
}

async function findMovieUrl(title, year) {
  const q = norm(title);
  if (!q) return null;
  const titleSlug = slugify(title);
  const items = await searchItems(q);

  let best = null;
  let bestScore = -1;
  for (const item of items) {
    if (!/\/movie\/[^/]+\/?$/.test(item.link)) continue;
    let sc = matchItemScore(item, titleSlug);
    if (year && (item.link.includes(String(year)) || item.title.includes(String(year)))) sc += 15;
    if (sc > bestScore) {
      bestScore = sc;
      best = item.link;
    }
  }
  if (best && bestScore >= 40) return best;

  const candidates = year
    ? [`${SITE}/movie/${titleSlug}-${year}/`, `${SITE}/movie/${titleSlug}/`]
    : [`${SITE}/movie/${titleSlug}/`];
  for (const cand of candidates) {
    const html = await fetchText(cand, { timeoutMs: 10000 });
    if (html && html.includes('ftv-watch')) return cand;
  }
  return null;
}

function parseEpisodeSlug(rawSlug) {
  const slug = (() => {
    try { return decodeURIComponent(rawSlug); } catch { return rawSlug; }
  })();
  let m = slug.match(/^(.*)-(\d+)x(\d+)$/);
  if (m) return { show: m[1], season: +m[2], episode: +m[3] };
  m = slug.match(/^(.*)-(\d+)$/);
  if (m) return { show: m[1], season: 1, episode: +m[2] };
  return null;
}

async function seriesEpisodeUrl(seriesSlug, season, episode) {
  const links = await cached(`ftv:series:${seriesSlug}`, TTL.page, async () => {
    const html = await fetchText(`${SITE}/series/${seriesSlug}/`, { timeoutMs: 12000 });
    if (!html) return null;
    const out = [];
    const re = /href="(https:\/\/5tv\.rest\/episode\/[^"]+\/)"/g;
    let m;
    while ((m = re.exec(html))) {
      const u = decodeEntities(m[1]);
      if (!out.includes(u)) out.push(u);
    }
    return out.length ? out : null;
  });
  if (!links) return null;
  for (const u of links) {
    const slug = u.match(/\/episode\/([^/]+)\/?$/)?.[1];
    if (!slug) continue;
    const ep = parseEpisodeSlug(slug);
    if (ep && ep.season === season && ep.episode === episode) return u;
  }
  return null;
}

async function findEpisodeUrl(title, season, episode) {
  const q = norm(title);
  if (!q) return null;
  const titleSlug = slugify(title);
  const items = await searchItems(q);

  let best = null;
  let bestScore = -1;
  for (const item of items) {
    const m = item.link.match(/\/episode\/([^/]+?)\/?$/);
    if (!m) continue;
    const ep = parseEpisodeSlug(m[1]);
    if (!ep) continue;
    const sc = Math.max(tokenScore(slugify(ep.show), titleSlug), tokenScore(slugify(item.title), titleSlug));
    if (ep.season === season && ep.episode === episode && sc > bestScore) {
      bestScore = sc;
      best = item.link;
    }
  }
  if (best && bestScore >= 35) return best;

  const showCandidates = [];
  for (const item of items) {
    const epM = item.link.match(/\/episode\/([^/]+?)\/?$/);
    const serM = item.link.match(/\/series\/([^/]+?)\/?$/);
    if (epM) {
      const ep = parseEpisodeSlug(epM[1]);
      if (!ep) continue;
      const sc = Math.max(tokenScore(slugify(ep.show), titleSlug), tokenScore(slugify(item.title), titleSlug));
      if (sc >= 35 && !showCandidates.some((c) => c.slug === ep.show)) {
        showCandidates.push({ slug: ep.show, score: sc });
      }
    } else if (serM) {
      const sc = matchItemScore(item, titleSlug);
      if (sc >= 35 && !showCandidates.some((c) => c.slug === serM[1])) {
        showCandidates.push({ slug: serM[1], score: sc });
      }
    }
  }
  showCandidates.sort((a, b) => b.score - a.score);
  for (const c of showCandidates.slice(0, 3)) {
    const u = await seriesEpisodeUrl(c.slug, season, episode);
    if (u) return u;
  }

  for (const cand of [
    `${SITE}/episode/${titleSlug}-${season}x${episode}/`,
    ...(season === 1 ? [`${SITE}/episode/${titleSlug}-${episode}/`] : []),
  ]) {
    const html = await fetchText(cand, { timeoutMs: 10000 });
    if (html && html.includes('ftv-watch')) return cand;
  }
  const directSeriesEp = await seriesEpisodeUrl(titleSlug, season, episode);
  if (directSeriesEp) return directSeriesEp;
  return null;
}

function parseWatchBox(html) {
  const cfgM = html.match(/window\.FTV_SERVER_FRONTEND = (\{[^;]+\})/);
  const objectId = cfgM ? JSON.parse(cfgM[1]).objectId || null : null;
  const servers = [];
  const re = /data-server-url="([^"]+)"[^>]*?data-server-id="(\d+)"[^>]*?data-server-vip="(\d)"/g;
  let m;
  while ((m = re.exec(html))) {
    if (m[3] === '1') continue;
    servers.push({ url: decodeEntities(m[1]), id: m[2] });
  }
  const seen = new Set();
  return { objectId, servers: servers.filter((s) => !seen.has(s.id) && seen.add(s.id)) };
}

async function accessSignedUrl(objectId, serverId) {
  const body = new URLSearchParams({
    action: 'ftv_71_access_url',
    object_id: String(objectId),
    server_id: String(serverId),
    server_type: 'watch',
  }).toString();
  const text = await fetchText(`${SITE}/wp-admin/admin-ajax.php`, {
    method: 'POST',
    body,
    referer: `${SITE}/`,
  });
  if (!text) return null;
  try {
    const j = JSON.parse(text);
    return j?.success && j?.data?.url ? j.data.url : null;
  } catch {
    return null;
  }
}

const SIGNED_ACCESS_HOSTS = /^(?:www\.)?(?:71stream\.one|ult4vid\.one|ultra4vid\.cam)$/i;
const BLOCKED_IFRAME_HOSTS = /^(?:drive\.google\.com|docs\.google\.com)$/i;

const EMBED_PRIORITY = [
  'smoothpre',
  'vk.com',
  'vidhide',
  'asnwish',
  'jodwish',
  'd0000d',
  'dood',
  'upstream',
  'do7go',
  'vidmoly',
  '71stream',
  'ult4vid',
  'ultra4vid',
];

function hostRank(host) {
  const h = host.toLowerCase();
  const idx = EMBED_PRIORITY.findIndex((p) => h.includes(p));
  return idx >= 0 ? idx : EMBED_PRIORITY.length;
}

async function streamsForPage(pageUrl) {
  return cached(`ftv:page:${pageUrl}`, TTL.page, async () => {
    const html = await fetchText(pageUrl);
    if (!html || !html.includes('ftv-watch')) return null;
    const { objectId, servers } = parseWatchBox(html);
    if (!servers.length) return { streams: [], embeds: [] };

    const embeds = [];
    await Promise.all(
      servers.slice(0, 10).map(async (sv) => {
        let parsed;
        try {
          parsed = new URL(sv.url);
        } catch {
          return;
        }
        const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
        if (BLOCKED_IFRAME_HOSTS.test(host)) return;

        let finalUrl = `${parsed.protocol}//${host}${parsed.pathname}${parsed.search}${parsed.hash}`;
        if (SIGNED_ACCESS_HOSTS.test(host) && objectId) {
          const signed = await accessSignedUrl(objectId, sv.id);
          if (!signed) return;
          finalUrl = signed;
        }

        embeds.push({
          embedUrl: finalUrl,
          name: `5TV · ${host}`,
          title: `${host} — ${decodeURIComponent(pageUrl.split('/').filter(Boolean).pop() || 'stream')}`,
          host,
        });
      })
    );

    embeds.sort((a, b) => hostRank(a.host) - hostRank(b.host));
    return { streams: [], embeds };
  });
}

export async function resolve5tvStreams(params) {
  const title = String(params.title || '').trim();
  const type = String(params.type || 'movie');
  const year = parseInt(params.year, 10) || null;
  const season = parseInt(params.season, 10) || null;
  const episode = parseInt(params.episode, 10) || null;
  if (!title) return { status: 400, body: { streams: [], embeds: [], error: 'title required' } };

  let pageUrl = null;
  if (type === 'tv' && season && episode) {
    pageUrl = await findEpisodeUrl(title, season, episode);
  } else {
    pageUrl = await findMovieUrl(title, year);
  }
  if (!pageUrl) return { status: 200, body: { streams: [], embeds: [], error: 'not found' } };

  const r = await streamsForPage(pageUrl);
  return {
    status: 200,
    body: {
      streams: r?.streams || [],
      embeds: r?.embeds || [],
      matched: { page: pageUrl },
    },
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  try {
    const reqUrl = new URL(req.url || '/', 'http://localhost');
    const result = await resolve5tvStreams({
      type: reqUrl.searchParams.get('type') || 'movie',
      title: reqUrl.searchParams.get('title') || '',
      year: reqUrl.searchParams.get('year') || '',
      season: reqUrl.searchParams.get('season') || '',
      episode: reqUrl.searchParams.get('episode') || '',
    });
    res.statusCode = result.status;
    res.end(JSON.stringify(result.body));
  } catch (e) {
    res.statusCode = 200;
    res.end(JSON.stringify({ streams: [], embeds: [], error: String(e?.message || e) }));
  }
}

// 5TV stream resolver: searches 5tv.rest (Asian dramas/movies), finds the
// episode/movie page, exchanges the free server's embed token via the site's
// own admin-ajax endpoint, then extracts the direct MP4 URL from the signed
// embed page (Cloudflare R2, range-request capable, ~3h expiry).
// GET /api/5tv?action=streams&type=movie|tv&title=..&year=..&tmdb=..&season=..&episode=..

const SITE = 'https://5tv.rest';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const cache = new Map();
const TTL = { search: 20 * 60e3, page: 15 * 60e3, resolve: 8 * 60e3 };

function cached(key, ttl, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttl) return Promise.resolve(hit.data);
  return fn().then(data => {
    if (data != null) cache.set(key, { at: Date.now(), data });
    return data;
  }).catch(() => (hit ? hit.data : null));
}

const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const slugify = s => norm(s).replace(/\s+/g, '-');

async function fetchText(url, { method = 'GET', body, referer = SITE + '/', timeoutMs = 15000 } = {}) {
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

// RSS search: /search/{q}/feed/rss2/ lists episode/movie permalinks.
async function searchLinks(q) {
  return cached(`ftv:search:${q}`, TTL.search, async () => {
    const xml = await fetchText(`${SITE}/search/${encodeURIComponent(q).replace(/%20/g, '+')}/feed/rss2/`, { timeoutMs: 12000 });
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

async function findMovieUrl(title, year) {
  const q = norm(title);
  const titleSlug = slugify(title);
  const links = await searchLinks(q);
  let best = null, bestScore = -1;
  for (const u of links) {
    const m = u.match(/\/movie\/([^/]+)\/?$/);
    if (!m) continue;
    const sc = slugScore(m[1].replace(/-\d{4}.*$/, ''), titleSlug);
    if (sc > bestScore) { bestScore = sc; best = u; }
  }
  if (bestScore < 30) {
    // direct guess: /movie/{slug}/ or /movie/{slug}-{year}/
    for (const cand of [`${SITE}/movie/${titleSlug}-${year}/`, `${SITE}/movie/${titleSlug}/`]) {
      const html = await fetchText(cand, { timeoutMs: 10000 });
      if (html && html.includes('ftv-watch')) return cand;
    }
    return null;
  }
  return best;
}

async function findEpisodeUrl(title, season, episode) {
  const titleSlug = slugify(title);
  const epRe = /\/(\d+)x(\d+)\/?$/;
  const links = await searchLinks(norm(title));
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
  // direct guess
  const cand = `${SITE}/episode/${titleSlug}-${season}x${episode}/`;
  const html = await fetchText(cand, { timeoutMs: 10000 });
  if (html && html.includes('ftv-watch')) return cand;
  return null;
}

function parseWatchBox(html) {
  const cfgM = html.match(/window\.FTV_SERVER_FRONTEND = (\{[^;]+\})/);
  const objectId = cfgM ? (JSON.parse(cfgM[1]).objectId || null) : null;
  const servers = [];
  const re = /data-server-url="([^"]+)"[^>]*?data-server-id="(\d+)"[^>]*?data-server-vip="(\d)"/g;
  let m;
  while ((m = re.exec(html))) {
    if (m[3] === '1') continue; // VIP only
    servers.push({ url: decodeEntities(m[1]), id: m[2] });
  }
  // dedupe by id
  const seen = new Set();
  return { objectId, servers: servers.filter(s => !seen.has(s.id) && seen.add(s.id)) };
}

async function accessUrl(objectId, serverId) {
  const body = new URLSearchParams({
    action: 'ftv_71_access_url',
    object_id: String(objectId),
    server_id: String(serverId),
    server_type: 'watch',
  }).toString();
  const text = await fetchText(`${SITE}/wp-admin/admin-ajax.php`, { method: 'POST', body, referer: SITE + '/' });
  if (!text) return null;
  try {
    const j = JSON.parse(text);
    return j?.success && j?.data?.url ? j.data.url : null;
  } catch { return null; }
}

// Signed embed page embeds the final media URL in a data-page JSON blob.
async function resolveEmbedMedia(embedUrl) {
  const html = await fetchText(embedUrl, { referer: SITE + '/' });
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
}

async function streamsForPage(pageUrl) {
  return cached(`ftv:page:${pageUrl}`, TTL.page, async () => {
    const html = await fetchText(pageUrl);
    if (!html || !html.includes('ftv-watch')) return null;
    const { objectId, servers } = parseWatchBox(html);
    if (!objectId || !servers.length) return { streams: [] };

    const out = [];
    await Promise.all(servers.slice(0, 3).map(async (sv, i) => {
      const signed = await accessUrl(objectId, sv.id);
      if (!signed) return;
      const media = await resolveEmbedMedia(signed);
      if (!media) return;
      const host = new URL(sv.url).hostname.replace(/^www\./, '');
      out.push({
        url: media.url,
        name: `5TV · ${host}${i === 0 ? '' : ` ${i + 1}`}`,
        title: media.title || `${host} — ${pageUrl.split('/').filter(Boolean).pop()}`,
        isHls: /\.m3u8(\?|$)/i.test(media.url),
      });
    }));
    return { streams: out };
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const action = String(req.query.action || 'streams');
  if (action === 'ping') return res.status(200).json({ ok: true });
  if (action === 'debug') {
    const page = String(req.query.page || 'https://5tv.rest/episode/breaking-bad-5x2/');
    const stages = {};
    const html = await fetchText(page);
    stages.page = html ? { ok: true, len: html.length, hasWatch: html.includes('ftv-watch') } : { ok: false };
    if (html) {
      const { objectId, servers } = parseWatchBox(html);
      stages.parsed = { objectId, servers: servers.length };
      if (objectId && servers[0]) {
        const signed = await accessUrl(objectId, servers[0].id);
        stages.signed = signed ? signed.slice(0, 120) : null;
        if (signed) {
          const media = await resolveEmbedMedia(signed);
          stages.media = media ? media.url.slice(0, 120) : null;
        }
      }
    }
    return res.status(200).json(stages);
  }

  const title = String(req.query.title || '').trim();
  const type = String(req.query.type || 'movie');
  const season = parseInt(req.query.season, 10) || null;
  const episode = parseInt(req.query.episode, 10) || null;
  if (!title) return res.status(400).json({ error: 'title required' });

  try {
    let pageUrl = null;
    if (type === 'tv' && season && episode) {
      pageUrl = await findEpisodeUrl(title, season, episode);
    } else {
      pageUrl = await findMovieUrl(title, parseInt(req.query.year, 10) || null);
    }
    if (!pageUrl) return res.status(200).json({ streams: [], error: 'not found' });

    const r = await streamsForPage(pageUrl);
    const streams = r?.streams || [];
    return res.status(200).json({
      streams,
      matched: { page: pageUrl },
    });
  } catch (e) {
    return res.status(200).json({ streams: [], error: String(e?.message || e) });
  }
}

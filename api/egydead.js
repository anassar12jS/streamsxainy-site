// EgyDead stream resolver: searches egydead.ca for a title, resolves its
// video entries (embed players), and extracts the underlying HLS/mp4 URLs.
// GET /api/egydead?action=streams&tmdb=603&type=movie&title=The%20Matrix&year=1999
// GET /api/egydead?action=streams&type=tv&title=Breaking%20Bad&year=2008&season=1&episode=1

const EGY = 'https://egydead.ca';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const JSON_HEADERS = {
  'User-Agent': UA,
  'Accept': 'application/json',
  'X-Requested-With': 'XMLHttpRequest',
  'Referer': `${EGY}/`,
};
const PAGE_HEADERS = { 'User-Agent': UA, 'Accept': 'text/html', 'Referer': `${EGY}/` };

const cache = new Map(); // key -> { at, data }
const TTL = {
  search: 30 * 60e3,
  title: 30 * 60e3,
  episode: 30 * 60e3,
  watch: 30 * 60e3,
  embed: 20 * 60e3,
};

function cached(key, ttl, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttl) return Promise.resolve(hit.data);
  return fn().then(data => {
    if (data != null) cache.set(key, { at: Date.now(), data });
    return data;
  }).catch(() => (hit ? hit.data : null));
}

async function fetchText(url, headers = PAGE_HEADERS, timeoutMs = 12000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { headers, signal: ctrl.signal, redirect: 'follow' });
    if (!r.ok) return null;
    return await r.text();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function fetchJson(url, headers = JSON_HEADERS, timeoutMs = 12000) {
  const text = await fetchText(url, headers, timeoutMs);
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}

// window.bootstrapData = {...}; inside SSR HTML
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

async function searchTitle(title, year, tmdbId, wantSeries) {
  const q = norm(title).replace(/\s+/g, ' ');
  if (!q) return null;
  const data = await cached(`egy:search:${q}`, TTL.search, () =>
    fetchJson(`${EGY}/api/v1/search/${encodeURIComponent(q)}?loader=searchAutocomplete`)
  );
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
  // Require at least a title-ish match unless tmdb_id nailed it
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

async function resolveEmbed(embedUrl) {
  return cached(`egy:embed:${embedUrl}`, TTL.embed, async () => {
    const html = await fetchText(embedUrl, {
      'User-Agent': UA,
      'Accept': 'text/html,*/*',
      'Referer': `${EGY}/`,
    });
    if (!html) return null;
    const urls = [];
    const re = /file\s*:\s*"([^"]+)"/g;
    let m;
    while ((m = re.exec(html))) {
      const u = m[1].trim();
      if (/^https?:\/\//i.test(u) && /\.(m3u8|mp4|mpd)(\?|#|$)/i.test(u) && !urls.includes(u)) urls.push(u);
    }
    // fallback: bare m3u8/mp4 URLs in page
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

async function streamsFromVideos(videos) {
  const chosen = pickVideos(videos);
  const out = [];
  await Promise.all(chosen.map(async v => {
    const src = v.src;
    let urls = null;
    if (/\.html?(\?|$)/i.test(src) || /embed-/i.test(src)) {
      urls = await resolveEmbed(src);
    } else if (/\.(m3u8|mp4|mpd)(\?|#|$)/i.test(src)) {
      urls = [src];
    }
    if (!urls) return;
    for (const url of urls.slice(0, 2)) {
      out.push({
        url,
        name: `EgyDead · ${v.name || v.quality || 'Server'}${v.quality ? ` · ${String(v.quality).toUpperCase()}` : ''}`,
        title: `${v.name || 'EgyDead'} — ${url.split('/').pop()?.split('?')[0] || 'stream'}`,
        isHls: /\.m3u8(\?|$)/i.test(url),
      });
    }
  }));
  // dedupe by url, keep order
  const seen = new Set();
  return out.filter(s => !seen.has(s.url) && seen.add(s.url));
}

async function movieStreams(egyId) {
  return cached(`egy:title:${egyId}`, TTL.title, async () => {
    const html = await fetchText(`${EGY}/titles/${egyId}/x`, PAGE_HEADERS);
    if (!html) return null;
    const boot = parseBootstrap(html);
    const tp = boot?.loaders?.titlePage;
    const title = tp?.title;
    if (!title) return null;
    const videos = Array.isArray(title.videos) && title.videos.length
      ? title.videos
      : null;
    if (videos) return { title, videos };
    // fallback: primary_video -> watch api
    const pv = title.primary_video;
    if (pv?.id) {
      const wp = await cached(`egy:watch:${pv.id}`, TTL.watch, () => fetchJson(`${EGY}/api/v1/watch/${pv.id}`));
      const list = [];
      if (wp?.video) list.push(wp.video);
      if (Array.isArray(wp?.alternative_videos)) list.push(...wp.alternative_videos);
      return { title, videos: list };
    }
    return { title, videos: [] };
  });
}

async function episodeStreams(egyId, season, episode) {
  return cached(`egy:ep:${egyId}:${season}x${episode}`, TTL.episode, async () => {
    const html = await fetchText(`${EGY}/titles/${egyId}/x/season/${season}/episode/${episode}`, PAGE_HEADERS);
    if (!html) return null;
    const boot = parseBootstrap(html);
    const ep = boot?.loaders?.episodePage?.episode;
    if (!ep) return { videos: [] };
    const videos = Array.isArray(ep.videos) && ep.videos.length ? ep.videos : [];
    if (videos.length) return { videos };
    const pv = ep.primary_video;
    if (pv?.id) {
      const wp = await cached(`egy:watch:${pv.id}`, TTL.watch, () => fetchJson(`${EGY}/api/v1/watch/${pv.id}`));
      const list = [];
      if (wp?.video) list.push(wp.video);
      if (Array.isArray(wp?.alternative_videos)) list.push(...wp.alternative_videos);
      return { videos: list };
    }
    return { videos: [] };
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=300');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const action = String(req.query.action || 'streams');
  const title = String(req.query.title || '').trim();
  const year = parseInt(req.query.year, 10) || null;
  const tmdbId = parseInt(req.query.tmdb, 10) || null;
  const wantSeries = String(req.query.type || '') === 'tv';
  const season = parseInt(req.query.season, 10) || null;
  const episode = parseInt(req.query.episode, 10) || null;

  if (action === 'ping') return res.status(200).json({ ok: true });
  if (!title) return res.status(400).json({ error: 'title required' });

  try {
    const match = await searchTitle(title, year, tmdbId, wantSeries);
    if (!match) return res.status(200).json({ streams: [], error: 'not found' });

    let videos = [];
    if (wantSeries && season && episode) {
      const r = await episodeStreams(match.id, season, episode);
      videos = r?.videos || [];
    } else {
      const r = await movieStreams(match.id);
      videos = r?.videos || [];
    }

    const streams = await streamsFromVideos(videos);
    return res.status(200).json({
      streams,
      matched: {
        id: match.id,
        name: match.name,
        original_title: match.original_title,
        year: match.year || (match.release_date ? match.release_date.slice(0, 4) : null),
        is_series: Boolean(match.is_series),
      },
    });
  } catch (e) {
    return res.status(200).json({ streams: [], error: String(e?.message || e) });
  }
}

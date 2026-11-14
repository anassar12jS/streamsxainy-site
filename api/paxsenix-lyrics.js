// PaxSenix lyrics proxy — keeps the API key server-side.
// GET /api/paxsenix-lyrics?artist=..&title=..&album=..&duration=..
// Tries, in order: Apple Music (word-timed) -> Spotify -> lrcget -> musixmatch.
// Returns { provider, plain, synced: [{time,text,words?}], ttml }.
const PAX = 'https://api.paxsenix.org';
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', Accept: 'application/json, text/plain, */*' };
const cache = new Map();
const CACHE_TTL = 15 * 60 * 1000;

function json(res, code, body) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.end(JSON.stringify(body));
}

const cleanTitle = (s = '') => s
  .replace(/\s*[\(\[](?:official\s*(?:video|audio|music\s*video|visualizer|lyric\s*video|hd|4k|hq)?|audio|lyrics?|visualizer|remastered|explicit|clean\s*version)[\)\]]/gi, '')
  .replace(/\s*-\s*official\s*(?:video|audio|music\s*video).*/gi, '')
  .replace(/\s*[\(\[](?:feat|ft)\.?\s+[^\)\]]+[\)\]]/gi, '')
  .replace(/\s+(?:feat|ft)\.?\s+.*/gi, '')
  .trim();

const cleanArtist = (s = '') => s.split(/,|&|feat\.|ft\.|vs\./i)[0].trim();

async function paxGet(path, params) {
  const key = process.env.PAXSENIX_API_KEY;
  if (!key) return null;
  const url = `${PAX}${path}?${new URLSearchParams(params)}`;
  try {
    const res = await fetch(url, {
      headers: { ...UA, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(9000),
    });
    if (!res.ok) return null;
    const text = await res.text();
    try { return JSON.parse(text); } catch { return text; }
  } catch { return null; }
}

function scoreCandidate(c, title, artist, durationSec) {
  const t = String(c.title || c.name || '').toLowerCase();
  const a = String(c.artist || c.artistName || (Array.isArray(c.artists) ? c.artists.map(x => x.name || x).join(' ') : '') || '').toLowerCase();
  let score = 0;
  if (t === title.toLowerCase()) score += 30;
  else if (t.includes(title.toLowerCase()) || title.toLowerCase().includes(t)) score += 15;
  if (a && (a.includes(artist.toLowerCase()) || artist.toLowerCase().includes(a))) score += 20;
  const durMs = Number(c.duration_ms ?? c.durationInMillis ?? 0);
  const durSecRaw = Number(c.duration ?? c.durationSec ?? c.length ?? 0);
  const durSec = durMs > 0 ? durMs / 1000 : durSecRaw;
  if (durationSec > 0 && durSec > 0) {
    const diff = Math.abs(durSec - durationSec);
    if (diff < 3) score += 10; else if (diff < 10) score += 5;
  }
  return score;
}

function pickCandidate(payload, title, artist, durationSec) {
  const list = [];
  const walk = (node) => {
    if (Array.isArray(node)) node.forEach(walk);
    else if (node && typeof node === 'object') {
      const id = node.id ?? node.trackId ?? node.songId;
      if (id && (node.title || node.name || node.attributes?.name)) list.push(node);
      Object.values(node).forEach(walk);
    }
  };
  walk(payload);
  if (!list.length) return null;
  list.sort((x, y) => scoreCandidate(y, title, artist, durationSec) - scoreCandidate(x, title, artist, durationSec));
  const best = list[0];
  return String(best.id ?? best.trackId ?? best.songId);
}

const parseLrc = (lrc) => {
  const lines = [];
  for (const line of String(lrc || '').split('\n')) {
    const m = line.match(/^\[(\d+):(\d{2})(?:[.:](\d+))?\](.*)$/);
    if (!m) continue;
    const frac = m[3] ? (m[3].length === 2 ? parseInt(m[3], 10) / 100 : parseInt(m[3], 10) / 1000) : 0;
    const time = parseInt(m[1], 10) * 60 + parseInt(m[2], 10) + frac;
    const text = m[4].trim();
    if (text) lines.push({ time, text });
  }
  return lines.sort((a, b) => a.time - b.time);
};

const ttmlTime = (ms) => `${Math.round(ms)}ms`;

function buildTtml(lines) {
  const body = lines.map(l => {
    const end = l.end ?? l.time + 5;
    const inner = l.words && l.words.length
      ? l.words.map(w => `<span begin="${ttmlTime(w.start * 1000)}" end="${ttmlTime(w.end * 1000)}">${escapeXml(w.text)}</span>`).join(' ')
      : escapeXml(l.text);
    return `<p begin="${ttmlTime(l.time * 1000)}" end="${ttmlTime(end * 1000)}">${inner}</p>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><tt xmlns="http://www.w3.org/ns/ttml"><body><div>${body}</div></body></tt>`;
}

const escapeXml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Apple Music word-timed lyrics -> normalized lines with per-word timing
function parseAppleLyrics(json) {
  const content = json?.content;
  if (!Array.isArray(content) || !content.length) return null;
  const lines = [];
  for (const line of content) {
    const words = Array.isArray(line.text) ? line.text : [];
    const lineTime = (Number(line.timestamp) || 0) / 1000;
    const parsed = words.map((w, i) => ({
      text: String(w.text || '').trim(),
      start: (Number(w.timestamp) || Number(line.timestamp) || 0) / 1000,
      end: 0,
    })).filter(w => w.text);
    if (!parsed.length) continue;
    for (let i = 0; i < parsed.length; i++) {
      const next = parsed[i + 1];
      parsed[i].end = next ? next.start : lineTime + 4;
      if (parsed[i].end <= parsed[i].start) parsed[i].end = parsed[i].start + 0.3;
    }
    lines.push({ time: lineTime, text: parsed.map(w => w.text).join(' '), words: parsed });
  }
  return lines.length ? lines : null;
}

// Extract LRC/plain text out of arbitrary provider payloads
function extractText(payload) {
  if (typeof payload === 'string') return payload;
  if (!payload || typeof payload !== 'object') return null;
  for (const k of ['lyrics', 'lrc', 'syncedLyrics', 'plainLyrics', 'text', 'content', 'line']) {
    if (typeof payload[k] === 'string' && payload[k].trim()) return payload[k];
  }
  if (Array.isArray(payload)) {
    const joined = payload.map(extractText).filter(Boolean).join('\n');
    return joined || null;
  }
  for (const v of Object.values(payload)) {
    const t = extractText(v);
    if (t) return t;
  }
  return null;
}

async function tryApple(title, artist, durationSec) {
  const search = await paxGet('/apple-music/search', { q: `${title} ${artist}`.trim() });
  const id = pickCandidate(search, title, artist, durationSec);
  if (!id) return null;
  const data = await paxGet('/lyrics/applemusic', { id });
  const lines = parseAppleLyrics(data);
  if (!lines) return null;
  return { provider: 'paxsenix:apple', lines };
}

async function trySearchLyrics(path, searchPath, title, artist, durationSec, provider, extraParams = {}) {
  const search = await paxGet(`/${searchPath}`, { q: `${title} ${artist}`.trim() });
  const id = pickCandidate(search, title, artist, durationSec);
  if (!id) return null;
  const data = await paxGet(path, { id, ...extraParams });
  const raw = extractText(data);
  if (!raw) return null;
  const synced = parseLrc(raw);
  if (synced.length) return { provider, lines: synced };
  // plain text fallback
  const plain = raw.replace(/<[^>]+>/g, '').trim();
  return plain ? { provider, lines: [], plain } : null;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'GET only' });
  const { artist = '', title = '', album = '', duration = '' } = req.query;
  const t = cleanTitle(title);
  const a = cleanArtist(artist);
  if (!t || !a) return json(res, 400, { error: 'artist and title required' });

  const durationSec = Math.max(0, Math.round(Number(duration) || 0));
  const cacheKey = `${a}|${t}|${album}|${durationSec}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_TTL) return json(res, 200, hit.body);

  if (!process.env.PAXSENIX_API_KEY) return json(res, 503, { error: 'paxsenix not configured' });

  // 1. Apple Music — word/syllable timed (best quality)
  let result = await tryApple(t, a, durationSec).catch(() => null);

  // 2. Spotify — line synced
  if (!result) result = await trySearchLyrics('/lyrics/spotify', 'spotify/search', t, a, durationSec, 'paxsenix:spotify').catch(() => null);

  // 3. lrcget — generic LRC
  if (!result) {
    const raw = await paxGet('/lyrics/lrcget', { q: `${t} ${a}`.trim() });
    const text = extractText(raw);
    if (text) {
      const synced = parseLrc(text);
      if (synced.length) result = { provider: 'paxsenix:lrcget', lines: synced };
      else {
        const plain = text.replace(/<[^>]+>/g, '').trim();
        if (plain) result = { provider: 'paxsenix:lrcget', lines: [], plain };
      }
    }
  }

  // 4. Musixmatch via PaxSenix (needs paid tier — fails soft)
  if (!result) {
    const raw = await paxGet('/lyrics/musixmatch', { t, a, d: String(durationSec) });
    const text = extractText(raw);
    if (text) {
      const synced = parseLrc(text);
      if (synced.length) result = { provider: 'paxsenix:musixmatch', lines: synced };
      else {
        const plain = text.replace(/<[^>]+>/g, '').trim();
        if (plain) result = { provider: 'paxsenix:musixmatch', lines: [], plain };
      }
    }
  }

  if (!result) return json(res, 200, { provider: null });

  const synced = result.lines || [];
  const plain = result.plain || synced.map(l => l.text).join('\n');
  const ttml = synced.length ? buildTtml(synced) : '';
  const body = { provider: result.provider, plain, synced, ttml };
  cache.set(cacheKey, { at: Date.now(), body });
  return json(res, 200, body);
};

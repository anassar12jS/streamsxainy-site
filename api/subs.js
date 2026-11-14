// Subtitle resolver: SubKong API (aggregates OpenSubtitles + SubDL) -> SRT cues JSON.
// GET /api/subs?imdb=tt0133093&season=1&episode=2&lang=English&title=The%20Matrix
const { unzipSync, strFromU8 } = require('fflate');

const SUBKONG = 'https://www.subkong.com';
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' };
const cache = new Map(); // per-instance, short-lived
const CACHE_TTL = 10 * 60 * 1000;

const LANG_ALIASES = {
  en: 'English', es: 'Spanish', fr: 'French', pt: 'Portuguese', de: 'German',
  it: 'Italian', ar: 'Arabic', hi: 'Hindi', tr: 'Turkish', ru: 'Russian',
  ja: 'Japanese', ko: 'Korean', zh: 'Chinese', pl: 'Polish', nl: 'Dutch',
  sv: 'Swedish', no: 'Norwegian', da: 'Danish', fi: 'Finnish', cs: 'Czech',
  ro: 'Romanian', hu: 'Hungarian', el: 'Greek', he: 'Hebrew', th: 'Thai',
  id: 'Indonesian', vi: 'Vietnamese', uk: 'Ukrainian', fa: 'Persian',
};

function json(res, code, body) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.end(JSON.stringify(body));
}

const tsToSec = (t) => {
  // HH:MM:SS,mmm or HH:MM:SS.mmm or MM:SS,mmm
  const m = String(t).trim().match(/(?:(\d+):)?(\d{1,2}):(\d{2})[,.](\d{1,3})/);
  if (!m) return null;
  const h = m[1] ? parseInt(m[1], 10) : 0;
  return h * 3600 + parseInt(m[2], 10) * 60 + parseInt(m[3], 10) + parseInt((m[4] || '0').padEnd(3, '0'), 10) / 1000;
};

function parseSrt(text) {
  const cues = [];
  const blocks = String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n').split(/\n{2,}/);
  for (const block of blocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) continue;
    const ti = lines.findIndex(l => l.includes('-->'));
    if (ti === -1) continue;
    const [a, b] = lines[ti].split('-->');
    const start = tsToSec(a), end = tsToSec(b);
    if (start == null || end == null || end <= start) continue;
    const body = lines.slice(ti + 1).join('\n')
      .replace(/<[^>]+>/g, '')
      .replace(/\{\\[^}]*\}/g, '')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .trim();
    if (body) cues.push({ start: Math.round(start * 100) / 100, end: Math.round(end * 100) / 100, text: body });
  }
  cues.sort((x, y) => x.start - y.start);
  return cues;
}

// Score subtitle candidates: prefer real release names over junk uploads.
function scoreSub(s, title, isSeries) {
  const name = `${s.name || ''} ${s.MovieReleaseName || ''}`.toLowerCase();
  let score = 0;
  if (s.source === 'the_maid') score += 3; // OpenSubtitles-sourced
  if (/bluray|brrip|bdrip|web-?dl|webrip|hdrip|dvdrip|hdtv|remux|x264|x265|h\.?26[45]|hevc/.test(name)) score += 4;
  const year = title ? (title.match(/\b(19|20)\d{2}\b/) || [])[0] : null;
  if (year && name.includes(year)) score += 1;
  const twords = (title || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 3);
  const hits = twords.filter(w => name.includes(w)).length;
  score += Math.min(hits, 3);
  if (isSeries && /s\d{1,2}e\d{1,2}|season|episode/.test(name)) score += 2;
  if (/subtitle|karaoke|song|lyrics|\.mp3|official video/.test(name)) score -= 6;
  return score;
}

module.exports = async (req, res) => {
  const q = req.query || {};
  const imdb = String(q.imdb || '').trim();
  const langIn = String(q.lang || 'en').trim().toLowerCase();
  const lang = LANG_ALIASES[langIn] || langIn.charAt(0).toUpperCase() + langIn.slice(1);
  const season = q.season ? parseInt(q.season, 10) : undefined;
  const episode = q.episode ? parseInt(q.episode, 10) : undefined;
  const title = String(q.title || '');
  const isSeries = Boolean(season && episode);

  if (!/^tt\d+$/.test(imdb)) return json(res, 400, { ok: false, error: 'bad imdb id' });

  const cacheKey = `${imdb}|${season || 0}|${episode || 0}|${lang}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.t < CACHE_TTL) return json(res, 200, hit.body);

  try {
    let url = `${SUBKONG}/api/v1/subtitles?imdb_id=${imdb}&language=${encodeURIComponent(lang)}`;
    if (isSeries) url += `&season=${season}&episode=${episode}`;
    const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return json(res, 502, { ok: false, error: `subkong ${r.status}` });
    const data = await r.json();
    const subs = Array.isArray(data?.subtitles) ? data.subtitles : [];
    if (!subs.length) return json(res, 200, { ok: false, error: 'no subs', count: data?.count || 0 });

    const ranked = subs
      .filter(s => s && s.download && /srt|vtt|sub/i.test(s.format || s.SubFormat || ''))
      .map(s => ({ s, score: scoreSub(s, title, isSeries) }))
      .sort((a, b) => b.score - a.score);
    if (!ranked.length) return json(res, 200, { ok: false, error: 'no usable subs' });

    // Try top candidates until one yields a parseable SRT
    for (const { s } of ranked.slice(0, 4)) {
      try {
        const dl = s.download.startsWith('http') ? s.download : `${SUBKONG}${s.download}`;
        const zr = await fetch(dl, { headers: UA, signal: AbortSignal.timeout(10000) });
        if (!zr.ok) continue;
        const buf = Buffer.from(await zr.arrayBuffer());
        const files = unzipSync(new Uint8Array(buf));
        let srtText = '';
        for (const [name, bytes] of Object.entries(files)) {
          if (/\.srt$/i.test(name)) { srtText = strFromU8(bytes); break; }
        }
        if (!srtText) {
          // Some zips may contain a single non-.srt text file
          for (const [name, bytes] of Object.entries(files)) {
            if (!/\.(jpg|png|nfo|txt)$/i.test(name) && bytes.length > 500) { srtText = strFromU8(bytes); break; }
          }
        }
        const cues = parseSrt(srtText);
        if (cues.length > 3) {
          const body = {
            ok: true, imdb, lang, season: season || null, episode: episode || null,
            cues, count: cues.length, total: data.count,
            name: s.name || s.MovieReleaseName || null,
          };
          cache.set(cacheKey, { t: Date.now(), body });
          return json(res, 200, body);
        }
      } catch { /* try next candidate */ }
    }
    return json(res, 200, { ok: false, error: 'download failed' });
  } catch (e) {
    return json(res, 200, { ok: false, error: String(e?.message || e) });
  }
};

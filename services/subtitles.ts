// Overlay subtitle support: fetches SRT cues via /api/subs (SubKong -> OpenSubtitles/SubDL)
// and syncs them to the embed player's postMessage timeupdate stream.

export interface SubtitleCue {
  start: number; // seconds
  end: number;
  text: string;
}

export interface SubtitleTrack {
  cues: SubtitleCue[];
  lang: string;
  name?: string | null;
  total?: number;
}

export interface SubtitleQuery {
  imdbId?: string | null;
  season?: number;
  episode?: number;
  lang?: string; // ISO code, e.g. 'en'
  title?: string;
}

const cueCache = new Map<string, SubtitleTrack | null>();

export async function fetchSubtitles(q: SubtitleQuery): Promise<SubtitleTrack | null> {
  if (!q.imdbId || !/^tt\d+$/.test(q.imdbId)) return null;
  const isSeries = Boolean(q.season && q.episode);
  const lang = q.lang || 'en';
  const key = `${q.imdbId}|${isSeries ? `${q.season}x${q.episode}` : 'movie'}|${lang}`;
  if (cueCache.has(key)) return cueCache.get(key) || null;

  try {
    const params = new URLSearchParams({ imdb: q.imdbId, lang });
    if (isSeries) { params.set('season', String(q.season)); params.set('episode', String(q.episode)); }
    if (q.title) params.set('title', q.title.slice(0, 120));
    const r = await fetch(`/api/subs?${params.toString()}`, { signal: AbortSignal.timeout(15000) });
    const data = await r.json().catch(() => null);
    const track: SubtitleTrack | null = data?.ok && Array.isArray(data.cues) && data.cues.length
      ? { cues: data.cues, lang, name: data.name, total: data.total }
      : null;
    cueCache.set(key, track);
    return track;
  } catch {
    cueCache.set(key, null);
    return null;
  }
}

/** Binary search: index of the cue active at time t (or -1). */
export function cueIndexAt(cues: SubtitleCue[], t: number): number {
  let lo = 0, hi = cues.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (cues[mid].start <= t) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  if (ans >= 0 && t <= cues[ans].end) return ans;
  return -1;
}

export const SUBTITLE_LANGUAGES: { code: string; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'de', label: 'German' },
  { code: 'it', label: 'Italian' },
  { code: 'ar', label: 'Arabic' },
  { code: 'hi', label: 'Hindi' },
  { code: 'tr', label: 'Turkish' },
  { code: 'ru', label: 'Russian' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'zh', label: 'Chinese' },
  { code: 'pl', label: 'Polish' },
  { code: 'nl', label: 'Dutch' },
  { code: 'sv', label: 'Swedish' },
];

function parseTimestamp(raw: string): number | null {
  const clean = raw.trim().replace(',', '.');
  const parts = clean.split(':');
  if (parts.length < 2 || parts.length > 3) return null;
  const nums = parts.map(Number);
  if (nums.some((n) => !Number.isFinite(n))) return null;
  if (nums.length === 3) return nums[0] * 3600 + nums[1] * 60 + nums[2];
  return nums[0] * 60 + nums[1];
}

export function parseSubtitleText(rawText: string, name = 'Custom Subtitles'): SubtitleTrack | null {
  const normalized = rawText.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const blocks = normalized.split(/\n{2,}/);
  const cues: SubtitleCue[] = [];

  for (const block of blocks) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lines.length) continue;
    const timingIdx = lines.findIndex((l) => l.includes('-->'));
    if (timingIdx < 0) continue;

    const timingLine = lines[timingIdx];
    const [startRaw, endRawWithMeta] = timingLine.split('-->');
    if (!startRaw || !endRawWithMeta) continue;
    const endRaw = endRawWithMeta.trim().split(/\s+/)[0];
    const start = parseTimestamp(startRaw);
    const end = parseTimestamp(endRaw);
    if (start === null || end === null || end <= start) continue;

    const text = lines
      .slice(timingIdx + 1)
      .join('\n')
      .replace(/<[^>]+>/g, '')
      .trim();
    if (!text) continue;
    cues.push({ start, end, text });
  }

  if (!cues.length) return null;
  cues.sort((a, b) => a.start - b.start);
  return { cues, lang: 'custom', name, total: cues.length };
}


import { LyricsData, SyncedLyricLine } from '../types';
import { extensionBridge } from '../extension/bridge';

function cleanTrackTitle(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/\s*[\(\[](?:official\s*(?:video|audio|music\s*video|visualizer|lyric\s*video|hd|4k|hq)?|audio|lyrics?|visualizer|remastered|explicit|clean\s*version)[\)\]]/gi, '')
    .replace(/\s*-\s*official\s*(?:video|audio|music\s*video).*/gi, '')
    .replace(/\s*[\(\[](?:feat|ft)\.?\s+[^\)\]]+[\)\]]/gi, '')
    .replace(/\s+(?:feat|ft)\.?\s+.*/gi, '')
    .trim();
}

function cleanArtistName(raw: string): string {
  if (!raw) return '';
  return raw
    .split(/,|&|feat\.|ft\.|vs\./i)[0]
    .trim();
}

function parseLrc(lrcText: string): SyncedLyricLine[] {
  const synced: SyncedLyricLine[] = [];
  if (!lrcText) return synced;

  const lines = lrcText.split('\n');
  for (const line of lines) {
    // Matches [mm:ss.xx], [mm:ss.xxx], or [mm:ss]
    const match = line.match(/^\[(\d+):(\d{2})(?:\.(\d+))?\](.*)$/);
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      let ms = 0;
      if (match[3]) {
        const msStr = match[3];
        if (msStr.length === 2) ms = parseInt(msStr, 10) / 100;
        else if (msStr.length === 3) ms = parseInt(msStr, 10) / 1000;
        else ms = parseInt(msStr.slice(0, 3), 10) / 1000;
      }
      const time = minutes * 60 + seconds + ms;
      const text = match[4].trim();
      if (text) {
        synced.push({ time, text });
      }
    }
  }

  // Sort by time ascending
  return synced.sort((a, b) => a.time - b.time);
}

export async function fetchLyrics(artist: string, title: string, duration?: number): Promise<LyricsData | null> {
  if (!artist || !title) return null;

  const cleanedTitle = cleanTrackTitle(title);
  const cleanedArtist = cleanArtistName(artist);

  // Helper to fetch JSON safely
  const fetchJson = async (url: string) => {
    try {
      const res = await extensionBridge.proxyFetch(url);
      if (res.ok) {
        return await res.json();
      }
    } catch {}
    return null;
  };

  // 1. LRCLIB: Try exact get without duration constraint (avoids 404 from 2-3s difference)
  try {
    const getUrl = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(cleanedArtist || artist)}&track_name=${encodeURIComponent(cleanedTitle || title)}`;
    const data = await fetchJson(getUrl);
    if (data && (data.syncedLyrics || data.plainLyrics)) {
      const synced = parseLrc(data.syncedLyrics || '');
      const plain = data.plainLyrics || (synced.map(s => s.text).join('\n'));
      const ttml = generateTTMLFromLRC(synced, cleanedTitle || title, cleanedArtist || artist);
      return { plain, synced, ttml };
    }
  } catch {}

  // 2. LRCLIB: Try search by artist and track name
  try {
    const searchUrl = `https://lrclib.net/api/search?track_name=${encodeURIComponent(cleanedTitle || title)}&artist_name=${encodeURIComponent(cleanedArtist || artist)}`;
    const results = await fetchJson(searchUrl);
    if (Array.isArray(results) && results.length > 0) {
      // Prefer an entry with syncedLyrics
      const best = results.find(r => r.syncedLyrics) || results[0];
      if (best && (best.syncedLyrics || best.plainLyrics)) {
        const synced = parseLrc(best.syncedLyrics || '');
        const plain = best.plainLyrics || (synced.map(s => s.text).join('\n'));
        const ttml = generateTTMLFromLRC(synced, best.trackName || cleanedTitle, best.artistName || cleanedArtist);
        return { plain, synced, ttml };
      }
    }
  } catch {}

  // 3. LRCLIB: Broad query search
  try {
    const qUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(`${cleanedArtist} ${cleanedTitle}`.trim())}`;
    const results = await fetchJson(qUrl);
    if (Array.isArray(results) && results.length > 0) {
      const best = results.find(r => r.syncedLyrics) || results[0];
      if (best && (best.syncedLyrics || best.plainLyrics)) {
        const synced = parseLrc(best.syncedLyrics || '');
        const plain = best.plainLyrics || (synced.map(s => s.text).join('\n'));
        const ttml = generateTTMLFromLRC(synced, best.trackName || title, best.artistName || artist);
        return { plain, synced, ttml };
      }
    }
  } catch {}

  // 4. Lyrics.ovh fallback for plain lyrics
  try {
    const ovhUrl = `https://api.lyrics.ovh/v1/${encodeURIComponent(cleanedArtist || artist)}/${encodeURIComponent(cleanedTitle || title)}`;
    const data = await fetchJson(ovhUrl);
    if (data && data.lyrics) {
      return {
        plain: data.lyrics,
        synced: [],
        ttml: '',
      };
    }
  } catch {}

  return null;
}

function generateTTMLFromLRC(lines: SyncedLyricLine[], title: string, artist: string): string {
  if (lines.length === 0) return '';

  const formatTTMLTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
  };

  const pTags = lines.map((line, idx) => {
    const nextLineTime = lines[idx + 1]?.time ?? (line.time + 5);
    const begin = formatTTMLTime(line.time);
    const end = formatTTMLTime(nextLineTime);
    const escaped = line.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `      <p begin="${begin}" end="${end}">${escaped}</p>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="utf-8"?>
<tt xmlns="http://www.w3.org/ns/ttml" xmlns:itunes="http://music.apple.com/lyric-ttml">
  <head>
    <metadata>
      <title>${title}</title>
      <itunes:artist>${artist}</itunes:artist>
    </metadata>
  </head>
  <body>
    <div>
${pTags}
    </div>
  </body>
</tt>`;
}


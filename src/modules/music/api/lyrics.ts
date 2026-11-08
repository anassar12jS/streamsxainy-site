import { LyricsData, SyncedLyricLine } from '../types';
import { extensionBridge } from '../extension/bridge';

export async function fetchLyrics(artist: string, title: string, duration?: number): Promise<LyricsData | null> {
  if (!artist || !title) return null;

  const cleanArtist = artist.split('&')[0].split('feat')[0].split('ft.')[0].trim();
  const cleanTitle = title.split('(')[0].split('-')[0].trim();

  // 1. Try LRCLIB API
  try {
    let url = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(cleanArtist)}&track_name=${encodeURIComponent(cleanTitle)}`;
    if (duration && duration > 0) {
      url += `&duration=${Math.round(duration)}`;
    }

    const res = await extensionBridge.proxyFetch(url);
    if (res.ok) {
      const data = await res.json();
      const plain = data.plainLyrics || '';
      const syncedRaw = data.syncedLyrics || '';

      const synced: SyncedLyricLine[] = [];
      if (syncedRaw) {
        const lines = syncedRaw.split('\n');
        for (const line of lines) {
          const match = line.match(/^\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)$/);
          if (match) {
            const minutes = parseInt(match[1], 10);
            const seconds = parseInt(match[2], 10);
            const ms = parseInt(match[3], 10) / (match[3].length === 3 ? 1000 : 100);
            const time = minutes * 60 + seconds + ms;
            const text = match[4].trim();
            if (text) synced.push({ time, text });
          }
        }
      }

      // Convert synced array to standard TTML for @uimaxbai/am-lyrics web component
      const ttml = generateTTMLFromLRC(synced, cleanTitle, cleanArtist);

      return { plain, ttml, synced };
    }
  } catch (err) {
    console.debug('LRCLIB fetch error:', err);
  }

  // 2. Try lrc.red fallback
  try {
    const lrcRedUrl = `https://lrc.red/api/v1/lyrics?artist=${encodeURIComponent(cleanArtist)}&title=${encodeURIComponent(cleanTitle)}`;
    const res = await extensionBridge.proxyFetch(lrcRedUrl);
    if (res.ok) {
      const data = await res.json();
      if (data && data.lyrics) {
        const synced: SyncedLyricLine[] = [];
        const lines = String(data.lyrics).split('\n');
        for (const line of lines) {
          const match = line.match(/^\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)$/);
          if (match) {
            const minutes = parseInt(match[1], 10);
            const seconds = parseInt(match[2], 10);
            const ms = parseInt(match[3], 10) / 1000;
            const time = minutes * 60 + seconds + ms;
            const text = match[4].trim();
            if (text) synced.push({ time, text });
          }
        }
        const ttml = generateTTMLFromLRC(synced, cleanTitle, cleanArtist);
        return { plain: data.lyrics, ttml, synced };
      }
    }
  } catch {}

  // 3. Try lyrics-api.binimum.org fallback
  try {
    const binimumUrl = `https://lyrics-api.binimum.org/lyrics?title=${encodeURIComponent(cleanTitle)}&artist=${encodeURIComponent(cleanArtist)}`;
    const res = await extensionBridge.proxyFetch(binimumUrl);
    if (res.ok) {
      const data = await res.json();
      if (data && (data.syncedLyrics || data.lines || data.plainLyrics)) {
        const synced: SyncedLyricLine[] = [];
        if (Array.isArray(data.lines)) {
          for (const l of data.lines) {
            if (typeof l.startTimeMs === 'number' && l.words) {
              synced.push({ time: l.startTimeMs / 1000, text: l.words });
            }
          }
        }
        const plain = data.plainLyrics || data.lyrics || '';
        const ttml = generateTTMLFromLRC(synced, cleanTitle, cleanArtist);
        return { plain, ttml, synced };
      }
    }
  } catch {}

  // 4. Try lyrics.paxsenix.org fallback
  try {
    const paxUrl = `https://lyrics.paxsenix.org/search?title=${encodeURIComponent(cleanTitle)}&artist=${encodeURIComponent(cleanArtist)}`;
    const res = await extensionBridge.proxyFetch(paxUrl);
    if (res.ok) {
      const data = await res.json();
      if (data && (data.synced || data.plain)) {
        const ttml = generateTTMLFromLRC(data.synced || [], cleanTitle, cleanArtist);
        return { plain: data.plain || '', ttml, synced: data.synced || [] };
      }
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

import { describeAudioUrl, qualityLabel } from '../flac.js';
import { searchCache, streamCache } from '../cache.js';

// Generic Meting (api.qijieya.cn) provider — one instance per music service.
// Free, no auth. Supports: kugou, joox, migu, teway, etc.

const METING = process.env.METING_BASE_URL || 'https://api.qijieya.cn/meting/';
const UA = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: '*/*',
};

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function makeProvider({ id, server, name }) {
  const PREFIX = id;

  function metingId(value) {
    const match = /[?&]id=([^&]+)/.exec(String(value || ''));
    return match ? decodeURIComponent(match[1]) : '';
  }

  async function search(query, quality, timeoutMs = 8000, attempts = 2) {
    const q = String(query || '').trim();
    if (!q) return { tracks: [], error: null };
    const key = `${PREFIX}:${q.toLowerCase()}`;
    const cached = searchCache.get(key);
    if (cached) return cached;

    let tracks = [];
    for (let attempt = 1; attempt <= attempts && !tracks.length; attempt++) {
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), timeoutMs);
      try {
        const res = await fetch(
          `${METING}?server=${server}&type=search&id=${encodeURIComponent(q)}&limit=15`,
          { headers: UA, signal: ac.signal },
        );
        if (res.ok) {
          const rows = await res.json();
          if (Array.isArray(rows)) {
            const seen = new Set();
            for (const item of rows) {
              const rawId = metingId(item?.url);
              if (!rawId || !item?.name || seen.has(rawId)) continue;
              seen.add(rawId);
              const artist = Array.isArray(item.artist) ? item.artist.join(', ') : String(item.artist || '');
              tracks.push({
                id: `${PREFIX}:${rawId}`,
                title: item.name,
                artist,
                album: String(item.album || ''),
                artworkURL: item.pic || undefined,
                format: 'flac',
                audioQuality: 'LOSSLESS',
                source: name,
              });
              if (tracks.length >= 15) break;
            }
          }
        }
      } catch {
      } finally {
        clearTimeout(timer);
      }
      if (!tracks.length && attempt < attempts) await wait(350 * attempt);
    }

    const result = { tracks, error: tracks.length ? null : `${name} unreachable` };
    if (tracks.length) searchCache.set(key, result);
    return result;
  }

  async function resolve(id, quality) {
    const rawId = String(id).replace(new RegExp(`^${PREFIX}:`), '');
    if (!rawId) return null;
    const tier = String(quality || 'LOSSLESS').toUpperCase();
    const key = `${PREFIX}:${rawId}:${tier}`;
    const cached = streamCache.get(key);
    if (cached) return cached;

    // br=999000 asks for the best quality the service offers
    let stream = null;
    for (let attempt = 1; attempt <= 2 && !stream; attempt++) {
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 9000);
      try {
        const res = await fetch(`${METING}?server=${server}&type=url&id=${encodeURIComponent(rawId)}&br=999000`, {
          headers: UA,
          signal: ac.signal,
          redirect: 'manual',
        });
        const url = res.headers.get('location');
        if (url && /^https?:\/\//i.test(url)) {
          const described = await describeAudioUrl(url, { timeoutMs: 6000 });
          if (described && !described.error) {
            stream = {
              url,
              codec: described.codec || 'mp3',
              container: described.container || described.codec || 'mp3',
              manifest: 'none',
              encrypted: false,
              ...(described.sampleRate ? { sampleRate: described.sampleRate } : {}),
              ...(described.bitDepth ? { bitDepth: described.bitDepth } : {}),
              ...(described.bitrate ? { bitrate: described.bitrate } : {}),
              ...(described.channels ? { channels: described.channels } : {}),
              format: described.codec || 'mp3',
              quality: qualityLabel(described),
              provider: name,
            };
          }
        }
      } catch {
      } finally {
        clearTimeout(timer);
      }
      if (!stream && attempt < 2) await wait(350 * attempt);
    }

    if (stream) streamCache.set(key, stream);
    return stream;
  }

  return { id: PREFIX, key: server, name, search, resolve };
}

export const kugou = makeProvider({ id: 'kg', server: 'kugou', name: 'Kugou' });
export const joox = makeProvider({ id: 'jx', server: 'joox', name: 'Joox' });
export const migu = makeProvider({ id: 'mg', server: 'migu', name: 'Migu' });

import { AddonManifest, MusicTrack } from '../types';
import { extensionBridge } from '../extension/bridge';

const STORAGE_KEY_ADDONS = 'bitchord_music_addons';

export interface BitChordAddonStream {
  url: string;
  isDash?: boolean;
  quality?: string;
  bitrate?: number;
  format?: string;
}

export function getInstalledAddons(): { name: string; url: string; manifest?: AddonManifest }[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ADDONS);
    return raw ? JSON.parse(raw) : [
      {
        name: 'BitChord Community Stream Mirror',
        url: 'https://bitchord.org/addon',
        manifest: {
          id: 'org.bitchord.default',
          name: 'BitChord Default Resolver',
          version: '1.2.0',
          description: 'High-speed FLAC & AAC DASH / HTTP music audio resolver',
          types: ['stream', 'search', 'lyrics'],
        },
      },
    ];
  } catch {
    return [];
  }
}

export function saveInstalledAddons(addons: { name: string; url: string; manifest?: AddonManifest }[]) {
  try {
    localStorage.setItem(STORAGE_KEY_ADDONS, JSON.stringify(addons));
  } catch {}
}

export async function fetchAddonManifest(addonBaseUrl: string): Promise<AddonManifest | null> {
  const cleanUrl = addonBaseUrl.replace(/\/$/, '');
  try {
    const res = await extensionBridge.proxyFetch(`${cleanUrl}/manifest.json`);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.debug('Failed to fetch addon manifest:', err);
  }
  return null;
}

export async function searchAddon(addonBaseUrl: string, query: string): Promise<MusicTrack[]> {
  const cleanUrl = addonBaseUrl.replace(/\/$/, '');
  try {
    const res = await extensionBridge.proxyFetch(`${cleanUrl}/search?q=${encodeURIComponent(query)}`);
    if (res.ok) {
      const data = await res.json();
      return Array.isArray(data) ? data : data.results || [];
    }
  } catch (err) {
    console.debug('Addon search error:', err);
  }
  return [];
}

export async function resolveAddonStream(addonBaseUrl: string, trackId: string): Promise<BitChordAddonStream | null> {
  const cleanUrl = addonBaseUrl.replace(/\/$/, '');
  try {
    const res = await extensionBridge.proxyFetch(`${cleanUrl}/stream/${encodeURIComponent(trackId)}`);
    if (res.ok) {
      const data = await res.json();
      return {
        url: data.url || data.streamUrl,
        isDash: Boolean(data.isDash || (data.url && data.url.includes('.mpd'))),
        quality: data.quality || '320kbps',
        bitrate: data.bitrate || 320,
        format: data.format || 'opus',
      };
    }
  } catch (err) {
    console.debug('Addon resolveStream error:', err);
  }
  return null;
}

import { MusicTrack, Playlist } from '../types';

const STORAGE_KEY_SC_TRACKS = 'bitchord_sc_imported_tracks_v1';
const STORAGE_KEY_SC_PLAYLISTS = 'bitchord_sc_imported_playlists_v1';
const SC_LIBRARY_UPDATED_EVENT = 'bitchord:library-updated';

function notifyLibraryUpdated() {
  try { window.dispatchEvent(new CustomEvent(SC_LIBRARY_UPDATED_EVENT)); } catch {}
}

interface ScTrackJson {
  id: string;
  title: string;
  artist: string;
  artwork: string;
  duration: number;
  url: string;
}

interface ScPlaylistJson {
  kind: 'playlist';
  id: string;
  title: string;
  artwork: string;
  curator: string;
  tracks: ScTrackJson[];
}

interface ScStreamJson extends ScTrackJson {
  kind: 'track';
  streamUrl: string;
  isHls: boolean;
}

const toTrack = (t: ScTrackJson, album = 'SoundCloud'): MusicTrack => ({
  id: `sc-${t.id}`,
  title: t.title,
  artist: t.artist,
  album,
  artwork: t.artwork,
  duration: t.duration || 0,
  soundcloudUrl: t.url,
  source: 'soundcloud',
});

async function scApi<T>(action: 'resolve' | 'stream', url?: string, id?: string): Promise<T> {
  const params = new URLSearchParams({ action });
  if (url) params.set('url', url);
  if (id) params.set('id', id);
  const res = await fetch(`/api/soundcloud?${params.toString()}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `SoundCloud ${action} failed (${res.status})`);
  return data as T;
}

export function getImportedSoundCloudTracks(): MusicTrack[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SC_TRACKS);
    return raw ? (JSON.parse(raw) as MusicTrack[]) : [];
  } catch { return []; }
}

export function getImportedSoundCloudPlaylists(): Playlist[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SC_PLAYLISTS);
    return raw ? (JSON.parse(raw) as Playlist[]) : [];
  } catch { return []; }
}

export function getImportedSoundCloudPlaylist(id: string): Playlist | null {
  return getImportedSoundCloudPlaylists().find(p => p.id === id) || null;
}

function saveTracks(tracks: MusicTrack[]) {
  try { localStorage.setItem(STORAGE_KEY_SC_TRACKS, JSON.stringify(tracks)); } catch {}
}

function savePlaylists(playlists: Playlist[]) {
  try { localStorage.setItem(STORAGE_KEY_SC_PLAYLISTS, JSON.stringify(playlists)); } catch {}
  notifyLibraryUpdated();
}

function mergeTracks(existing: MusicTrack[], incoming: MusicTrack[]): MusicTrack[] {
  const map = new Map<string, MusicTrack>();
  [...existing, ...incoming].forEach(t => map.set(t.id, t));
  return Array.from(map.values());
}

/** Import a SoundCloud playlist (or single track) into local library storage. */
export async function importSoundCloud(urlOrId: string): Promise<{ title: string; tracks: MusicTrack[]; isPlaylist: boolean }> {
  const input = urlOrId.trim();
  if (!input) throw new Error('Paste a SoundCloud track or playlist URL.');

  const resolved = await scApi<ScPlaylistJson | { kind: 'track' } & ScTrackJson>('resolve', input);

  if (resolved.kind === 'playlist') {
    const pl = resolved as ScPlaylistJson;
    const tracks = pl.tracks.map(t => toTrack(t, pl.title));
    const playlist: Playlist = {
      id: `sc-pl-${pl.id}`,
      title: pl.title,
      subtitle: `${tracks.length} Songs · SoundCloud`,
      curator: pl.curator || 'SoundCloud',
      artwork: pl.artwork,
      trackCount: tracks.length,
      tracks,
    };
    savePlaylists([playlist, ...getImportedSoundCloudPlaylists().filter(p => p.id !== playlist.id)]);
    saveTracks(mergeTracks(getImportedSoundCloudTracks(), tracks));
    notifyLibraryUpdated();
    return { title: pl.title, tracks, isPlaylist: true };
  }

  const trackJson = resolved as { kind: 'track' } & ScTrackJson;
  const track = toTrack(trackJson);
  saveTracks(mergeTracks(getImportedSoundCloudTracks(), [track]));
  notifyLibraryUpdated();
  return { title: track.title, tracks: [track], isPlaylist: false };
}

// --- Playback stream resolution (cached; signed URLs expire) ---
const streamCache = new Map<string, { url: string; isHls: boolean; at: number }>();
const STREAM_TTL = 20 * 60 * 1000;

export async function resolveSoundCloudStream(track: MusicTrack): Promise<{ streamUrl: string; isHls: boolean }> {
  const key = track.id;
  const cached = streamCache.get(key);
  if (cached && Date.now() - cached.at < STREAM_TTL) {
    return { streamUrl: cached.url, isHls: cached.isHls };
  }
  // Prefer the permalink; fall back to the numeric SC id for tracks imported
  // before playlist hydration existed (stored as `sc-<id>` with no URL).
  const scId = track.id.startsWith('sc-') ? track.id.slice(3) : '';
  const data = track.soundcloudUrl
    ? await scApi<ScStreamJson>('stream', track.soundcloudUrl)
    : /^\d+$/.test(scId)
      ? await scApi<ScStreamJson>('stream', undefined, scId)
      : (() => { throw new Error('Missing SoundCloud URL for this track.'); })();
  streamCache.set(key, { url: data.streamUrl, isHls: !!data.isHls, at: Date.now() });
  return { streamUrl: data.streamUrl, isHls: !!data.isHls };
}

export function prefetchSoundCloudStream(track: MusicTrack) {
  if (!track.soundcloudUrl) return;
  void resolveSoundCloudStream(track).catch(() => {});
}

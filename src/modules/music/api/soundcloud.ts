import { MusicTrack, Playlist } from '../types';

// SoundCloud library data lives in IndexedDB — localStorage's ~5MB quota was
// too small once playlists started embedding full track metadata (and every
// setItem failure used to be swallowed silently). On first load we migrate
// any existing localStorage keys into IDB and remove them, which also frees
// the quota they were consuming.
const IDB_NAME = 'xainy-music';
const IDB_STORE = 'kv';
const IDB_KEY_TRACKS = 'sc_tracks';
const IDB_KEY_PLAYLISTS = 'sc_playlists';
const LEGACY_LS_TRACKS = 'bitchord_sc_imported_tracks_v1';
const LEGACY_LS_PLAYLISTS = 'bitchord_sc_imported_playlists_v1';
const SC_LIBRARY_UPDATED_EVENT = 'bitchord:library-updated';

let memTracks: MusicTrack[] | null = null;
let memPlaylists: Playlist[] | null = null;
let idbPromise: Promise<IDBDatabase | null> | null = null;
let resolvedIdb: IDBDatabase | null | undefined;
let storageError: string | null = null;

function openIdb(): Promise<IDBDatabase | null> {
  if (!idbPromise) {
    idbPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open(IDB_NAME, 1);
        req.onupgradeneeded = () => {
          if (!req.result.objectStoreNames.contains(IDB_STORE)) {
            req.result.createObjectStore(IDB_STORE);
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
        req.onblocked = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }
  return idbPromise;
}

function idbGet<T>(db: IDBDatabase, key: string): Promise<T | undefined> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(key);
      req.onsuccess = () => resolve(req.result as T | undefined);
      req.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
}

function idbPut(db: IDBDatabase, key: string, value: unknown): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

function readLegacyLs(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}

function legacyTracksSync(): MusicTrack[] {
  const v = readLegacyLs(LEGACY_LS_TRACKS);
  return Array.isArray(v) ? (v as MusicTrack[]) : [];
}

function legacyPlaylistsSync(): Playlist[] {
  const v = readLegacyLs(LEGACY_LS_PLAYLISTS);
  return Array.isArray(v) ? (v as Playlist[]) : [];
}

/** Last persistence failure, if any (surfaced in UI errors). */
export function getSoundCloudStorageError(): string | null {
  return storageError;
}

function describeStorageError(e: unknown): string {
  const err = e as DOMException;
  return err?.name ? `${err.name}: ${err.message || 'write failed'}` : String(e);
}

function lsSet(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    storageError = null;
    return true;
  } catch (e) {
    storageError = describeStorageError(e);
    return false;
  }
}

/** Persist current in-memory arrays — IDB when available, localStorage fallback. */
function persist(): void {
  void ensureSoundCloudStorageLoaded().then(() => {
    const db = resolvedIdb;
    if (db) {
      void Promise.all([
        idbPut(db, IDB_KEY_TRACKS, memTracks ?? []),
        idbPut(db, IDB_KEY_PLAYLISTS, memPlaylists ?? []),
      ]).then(([tOk, pOk]) => {
        if (!tOk || !pOk) storageError = 'IndexedDB write failed.';
      });
      return;
    }
    // No IndexedDB — legacy localStorage fallback (still quota-limited).
    if (memTracks !== null) lsSet(LEGACY_LS_TRACKS, memTracks);
    if (memPlaylists !== null) lsSet(LEGACY_LS_PLAYLISTS, memPlaylists);
  });
}

/** Load SC library data into memory (IDB first, localStorage migration fallback). */
export async function ensureSoundCloudStorageLoaded(): Promise<void> {
  if (memTracks !== null && memPlaylists !== null) return;
  const db = await openIdb();
  resolvedIdb = db;
  if (db) {
    const [t, p] = await Promise.all([
      idbGet<MusicTrack[]>(db, IDB_KEY_TRACKS),
      idbGet<Playlist[]>(db, IDB_KEY_PLAYLISTS),
    ]);
    if (t !== undefined || p !== undefined) {
      if (memTracks === null) memTracks = Array.isArray(t) ? t : [];
      if (memPlaylists === null) memPlaylists = Array.isArray(p) ? p : [];
      notifyLibraryUpdated();
      return;
    }
    // First run on IDB — migrate legacy localStorage keys, then free them.
    const lt = readLegacyLs(LEGACY_LS_TRACKS);
    const lp = readLegacyLs(LEGACY_LS_PLAYLISTS);
    if (memTracks === null) memTracks = Array.isArray(lt) ? lt : [];
    if (memPlaylists === null) memPlaylists = Array.isArray(lp) ? lp : [];
    await Promise.all([
      idbPut(db, IDB_KEY_TRACKS, memTracks),
      idbPut(db, IDB_KEY_PLAYLISTS, memPlaylists),
    ]);
    try {
      localStorage.removeItem(LEGACY_LS_TRACKS);
      localStorage.removeItem(LEGACY_LS_PLAYLISTS);
    } catch {}
    notifyLibraryUpdated();
    return;
  }
  // No IndexedDB — fall back to legacy localStorage keys.
  if (memTracks === null) memTracks = legacyTracksSync();
  if (memPlaylists === null) memPlaylists = legacyPlaylistsSync();
  notifyLibraryUpdated();
}

// Kick off the load as soon as the module is imported so sync getters are warm.
void ensureSoundCloudStorageLoaded();

function notifyLibraryUpdated() {
  try { window.dispatchEvent(new CustomEvent(SC_LIBRARY_UPDATED_EVENT)); } catch {}
}

interface ScTrackJson {
  id: string;
  title: string;
  artist: string;
  artistId?: string;
  artistUrl?: string;
  artwork: string;
  duration: number;
  url: string;
}

interface ScArtistJson {
  kind: 'artist';
  id: string;
  name: string;
  handle: string;
  avatar: string;
  tracks: ScTrackJson[];
  nextOffset: number | null;
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
  soundcloudArtistId: t.artistId || undefined,
  soundcloudArtistUrl: t.artistUrl || undefined,
  source: 'soundcloud',
});

export const toSoundCloudTrack = toTrack;

async function scApi<T>(action: 'resolve' | 'stream' | 'artist', url?: string, id?: string, offset?: number): Promise<T> {
  const params = new URLSearchParams({ action });
  if (url) params.set('url', url);
  if (id) params.set('id', id);
  if (offset) params.set('offset', String(offset));
  const res = await fetch(`/api/soundcloud?${params.toString()}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `SoundCloud ${action} failed (${res.status})`);
  return data as T;
}

export function getImportedSoundCloudTracks(): MusicTrack[] {
  return memTracks !== null ? memTracks : legacyTracksSync();
}

export function getImportedSoundCloudPlaylists(): Playlist[] {
  return memPlaylists !== null ? memPlaylists : legacyPlaylistsSync();
}

export function getImportedSoundCloudPlaylist(id: string): Playlist | null {
  return getImportedSoundCloudPlaylists().find(p => p.id === id) || null;
}

function saveTracks(tracks: MusicTrack[]): boolean {
  memTracks = tracks;
  persist();
  notifyLibraryUpdated();
  return true;
}

function savePlaylists(playlists: Playlist[]): boolean {
  memPlaylists = playlists;
  persist();
  notifyLibraryUpdated();
  return true;
}

function mergeTracks(existing: MusicTrack[], incoming: MusicTrack[]): MusicTrack[] {
  const map = new Map<string, MusicTrack>();
  [...existing, ...incoming].forEach(t => map.set(t.id, t));
  return Array.from(map.values());
}

/** Import a SoundCloud playlist, artist, or single track into local library storage. */
export async function importSoundCloud(urlOrId: string): Promise<{ title: string; tracks: MusicTrack[]; isPlaylist: boolean; playlistId?: string }> {
  const input = urlOrId.trim();
  if (!input) throw new Error('Paste a SoundCloud track, playlist, or artist URL.');

  const resolved = await scApi<ScPlaylistJson | ScArtistJson | ({ kind: 'track' } & ScTrackJson)>('resolve', input);

  if (resolved.kind === 'artist') {
    const artist = resolved as ScArtistJson;
    const playlistId = `sc-pl-artist-${artist.id}`;
    const tracks = artist.tracks.map(t => ({ ...toTrack(t, artist.name), soundcloudPlaylistId: playlistId }));
    const playlist: Playlist = {
      id: playlistId,
      title: artist.name,
      subtitle: `${tracks.length} Songs · SoundCloud`,
      curator: 'SoundCloud Artist',
      artwork: artist.avatar || tracks[0]?.artwork || '',
      trackCount: tracks.length,
      tracks,
      addedAt: Date.now(),
    };
    savePlaylists([playlist, ...getImportedSoundCloudPlaylists().filter(p => p.id !== playlist.id)]);
    saveTracks(mergeTracks(getImportedSoundCloudTracks(), tracks));
    return { title: playlist.title, tracks, isPlaylist: true, playlistId: playlist.id };
  }

  if (resolved.kind === 'playlist') {
    const pl = resolved as ScPlaylistJson;
    const playlistId = `sc-pl-${pl.id}`;
    const tracks = pl.tracks.map(t => ({ ...toTrack(t, pl.title), soundcloudPlaylistId: playlistId }));
    const playlist: Playlist = {
      id: playlistId,
      title: pl.title,
      subtitle: `${tracks.length} Songs · SoundCloud`,
      curator: pl.curator || 'SoundCloud',
      artwork: pl.artwork || tracks[0]?.artwork || '',
      trackCount: tracks.length,
      tracks,
      addedAt: Date.now(),
    };
    savePlaylists([playlist, ...getImportedSoundCloudPlaylists().filter(p => p.id !== playlist.id)]);
    saveTracks(mergeTracks(getImportedSoundCloudTracks(), tracks));
    return { title: playlist.title, tracks, isPlaylist: true, playlistId: playlist.id };
  }

  const trackJson = resolved as { kind: 'track' } & ScTrackJson;
  const track = toTrack(trackJson);
  saveTracks(mergeTracks(getImportedSoundCloudTracks(), [track]));
  return { title: track.title, tracks: [track], isPlaylist: false };
}

/** Fetch a SoundCloud artist profile + a page of their tracks (by user id or permalink). */
export async function getSoundCloudArtist(idOrUrl: string, offset = 0): Promise<ScArtistJson> {
  const input = idOrUrl.trim();
  if (!input) throw new Error('Missing artist id or URL.');
  return /^\d+$/.test(input)
    ? scApi<ScArtistJson>('artist', undefined, input, offset)
    : scApi<ScArtistJson>('artist', input, undefined, offset);
}

/** Create a local SoundCloud playlist from tracks (artist imports, manual adds). */
export function createSoundCloudPlaylist(title: string, tracks: MusicTrack[], artwork = ''): Playlist {
  const playlistId = `sc-pl-${Date.now()}`;
  const playlist: Playlist = {
    id: playlistId,
    title,
    subtitle: `${tracks.length} Songs · SoundCloud`,
    curator: 'SoundCloud',
    artwork,
    trackCount: tracks.length,
    tracks: tracks.map(t => ({ ...t, soundcloudPlaylistId: playlistId })),
    addedAt: Date.now(),
  };
  savePlaylists([playlist, ...getImportedSoundCloudPlaylists()]);
  saveTracks(mergeTracks(getImportedSoundCloudTracks(), tracks));
  return playlist;
}

/** Append a track to an existing imported SoundCloud playlist. */
export function addTrackToSoundCloudPlaylist(playlistId: string, track: MusicTrack): boolean {
  const playlists = getImportedSoundCloudPlaylists();
  const pl = playlists.find(p => p.id === playlistId);
  if (!pl) return false;
  if (!pl.tracks.some(t => t.id === track.id)) {
    pl.tracks = [...pl.tracks, { ...track, soundcloudPlaylistId: playlistId }];
    pl.trackCount = pl.tracks.length;
    pl.subtitle = `${pl.tracks.length} Songs · SoundCloud`;
  }
  savePlaylists(playlists.map(p => p.id === playlistId ? pl : p));
  saveTracks(mergeTracks(getImportedSoundCloudTracks(), [track]));
  return true;
}

/** Delete an imported SoundCloud playlist (tracks stay in the library). */
export function deleteSoundCloudPlaylist(playlistId: string): void {
  savePlaylists(getImportedSoundCloudPlaylists().filter(p => p.id !== playlistId));
}

/** Remove a track from an imported SoundCloud playlist. */
export function removeTrackFromSoundCloudPlaylist(playlistId: string, trackId: string): void {
  const playlists = getImportedSoundCloudPlaylists();
  const pl = playlists.find(p => p.id === playlistId);
  if (!pl) return;
  pl.tracks = pl.tracks.filter(t => t.id !== trackId);
  pl.trackCount = pl.tracks.length;
  pl.subtitle = `${pl.tracks.length} Songs · SoundCloud`;
  savePlaylists(playlists.map(p => p.id === playlistId ? pl : p));
}

/** Resolve the numeric SoundCloud artist id for a track (artist page route param). */
export async function resolveSoundCloudArtistId(track: MusicTrack): Promise<string | null> {
  if (track.soundcloudArtistId) return track.soundcloudArtistId;
  try {
    if (track.soundcloudArtistUrl) {
      const artist = await scApi<ScArtistJson>('artist', track.soundcloudArtistUrl);
      return artist?.id || null;
    }
    if (track.soundcloudUrl) {
      const t = await scApi<{ artistId?: string }>('resolve', track.soundcloudUrl);
      return t?.artistId || null;
    }
  } catch {}
  return null;
}

/** Find an imported SoundCloud playlist that contains this track. */
export function findSoundCloudPlaylistForTrack(trackId: string): Playlist | null {
  return getImportedSoundCloudPlaylists().find(p => p.tracks?.some(t => t.id === trackId)) || null;
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

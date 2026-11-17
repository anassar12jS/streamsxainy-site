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

function saveTracks(tracks: MusicTrack[]): boolean {
  try { localStorage.setItem(STORAGE_KEY_SC_TRACKS, JSON.stringify(tracks)); return true; } catch { return false; }
}

function savePlaylists(playlists: Playlist[]): boolean {
  let ok = true;
  try { localStorage.setItem(STORAGE_KEY_SC_PLAYLISTS, JSON.stringify(playlists)); } catch { ok = false; }
  notifyLibraryUpdated();
  return ok;
}

function mergeTracks(existing: MusicTrack[], incoming: MusicTrack[]): MusicTrack[] {
  const map = new Map<string, MusicTrack>();
  [...existing, ...incoming].forEach(t => map.set(t.id, t));
  return Array.from(map.values());
}

/** Import a SoundCloud playlist, artist, or single track into local library storage. */
export async function importSoundCloud(urlOrId: string): Promise<{ title: string; tracks: MusicTrack[]; isPlaylist: boolean }> {
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
    };
    if (!savePlaylists([playlist, ...getImportedSoundCloudPlaylists().filter(p => p.id !== playlist.id)])
      || !saveTracks(mergeTracks(getImportedSoundCloudTracks(), tracks))) {
      throw new Error('Could not save to library — browser storage may be full.');
    }
    notifyLibraryUpdated();
    return { title: playlist.title, tracks, isPlaylist: true };
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
    };
    if (!savePlaylists([playlist, ...getImportedSoundCloudPlaylists().filter(p => p.id !== playlist.id)])
      || !saveTracks(mergeTracks(getImportedSoundCloudTracks(), tracks))) {
      throw new Error('Could not save to library — browser storage may be full.');
    }
    notifyLibraryUpdated();
    return { title: playlist.title, tracks, isPlaylist: true };
  }

  const trackJson = resolved as { kind: 'track' } & ScTrackJson;
  const track = toTrack(trackJson);
  if (!saveTracks(mergeTracks(getImportedSoundCloudTracks(), [track]))) {
    throw new Error('Could not save to library — browser storage may be full.');
  }
  notifyLibraryUpdated();
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
  };
  if (!savePlaylists([playlist, ...getImportedSoundCloudPlaylists()])
    || !saveTracks(mergeTracks(getImportedSoundCloudTracks(), tracks))) {
    throw new Error('Could not save playlist — browser storage may be full.');
  }
  notifyLibraryUpdated();
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
  return savePlaylists(playlists.map(p => p.id === playlistId ? pl : p))
    && saveTracks(mergeTracks(getImportedSoundCloudTracks(), [track]));
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

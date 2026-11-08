import { MusicTrack, Playlist } from '../types';
import { getInnertube, resetInnertube, getPlaylistDetails, getLibraryPlaylists } from './innertube';
import { extensionBridge } from '../extension/bridge';

const STORAGE_KEY_YT_ACCOUNT = 'bitchord_yt_account_v1';
const STORAGE_KEY_YT_TRACKS = 'bitchord_yt_imported_tracks_v1';
const STORAGE_KEY_YT_PLAYLISTS = 'bitchord_yt_imported_playlists_v1';
const STORAGE_KEY_YT_HOME = 'bitchord_yt_home_shelves_v1';

/** Fired on window whenever imported YouTube data (tracks/playlists/account) changes. */
export const YT_LIBRARY_UPDATED_EVENT = 'bitchord:library-updated';
function notifyLibraryUpdated() {
  try { window.dispatchEvent(new CustomEvent(YT_LIBRARY_UPDATED_EVENT)); } catch {}
}

export interface LinkedYouTubeAccount {
  id: string;
  name: string;
  email?: string;
  avatar: string;
  channelTitle?: string;
  isLinked: boolean;
  lastSynced?: number;
  importedTracksCount: number;
  importedPlaylistsCount: number;
}

export function getLinkedYouTubeAccount(): LinkedYouTubeAccount {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_YT_ACCOUNT);
    if (raw) return JSON.parse(raw);
  } catch {}

  // Nothing linked yet. No placeholder identity: the real one comes from the extension.
  return {
    id: '',
    name: '',
    email: undefined,
    avatar: '',
    channelTitle: undefined,
    isLinked: false,
    importedTracksCount: 0,
    importedPlaylistsCount: 0,
  };
}

export function saveLinkedYouTubeAccount(account: LinkedYouTubeAccount) {
  try {
    localStorage.setItem(STORAGE_KEY_YT_ACCOUNT, JSON.stringify(account));
  } catch {}
  notifyLibraryUpdated();
}

export function getImportedYouTubeTracks(): MusicTrack[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_YT_TRACKS);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

export function saveImportedYouTubeTracks(tracks: MusicTrack[]) {
  try {
    localStorage.setItem(STORAGE_KEY_YT_TRACKS, JSON.stringify(tracks));
  } catch {}
}

export function getImportedYouTubePlaylists(): Playlist[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_YT_PLAYLISTS);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

export function saveImportedYouTubePlaylists(playlists: Playlist[]) {
  try {
    localStorage.setItem(STORAGE_KEY_YT_PLAYLISTS, JSON.stringify(playlists));
  } catch {}
  notifyLibraryUpdated();
}

/**
 * Extracts a playlist ID from a YouTube or YouTube Music URL or bare ID
 */
export function extractPlaylistId(urlOrId: string): string | null {
  const trimmed = urlOrId.trim();
  if (/^[a-zA-Z0-9_-]{18,}$/.test(trimmed)) {
    return trimmed;
  }
  const match = trimmed.match(/[?&]list=([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

/**
 * Imports tracks from a YouTube Music playlist ID or URL
 */
export async function importPlaylistFromYouTube(urlOrId: string): Promise<{ title: string; tracks: MusicTrack[] }> {
  const playlistId = extractPlaylistId(urlOrId);
  if (!playlistId) {
    throw new Error('Invalid playlist URL or ID. Please paste a valid YouTube Music playlist link.');
  }

  let playlistTitle = 'Imported YouTube Music Playlist';
  let tracks: MusicTrack[] = [];

  try {
    const pl = await getPlaylistDetails(playlistId);
    if (pl) {
      playlistTitle = pl.title || playlistTitle;
      tracks = pl.tracks;
    }
  } catch (err) {
    console.debug('getPlaylistDetails failed, falling back to public mirror:', err);
  }

  // Fallback if direct InnerTube playlist fetch was blocked
  if (tracks.length === 0) {
    const mirrors = [
      `https://pipedapi.kavin.rocks/playlists/${playlistId}`,
      `https://api.piped.privacy.com.de/playlists/${playlistId}`,
    ];

    for (const mirror of mirrors) {
      try {
        const res = await extensionBridge.proxyFetch(mirror);
        if (res.ok) {
          const data = await res.json();
          playlistTitle = data.name || playlistTitle;
          const relatedStreams = data.relatedStreams || [];
          if (relatedStreams.length > 0) {
            tracks = relatedStreams.map((s: any, idx: number): MusicTrack => ({
              id: `mirror-pl-${s.id || idx}`,
              title: s.title || 'Unknown Track',
              artist: s.uploaderName || 'Unknown Artist',
              album: playlistTitle,
              artwork: s.thumbnailUrl || '',
              duration: s.duration || 0,
              youtubeId: s.url ? s.url.replace('/watch?v=', '') : undefined,
              source: 'innertube',
            }));
            break;
          }
        }
      } catch {}
    }
  }

  if (tracks.length === 0) {
    throw new Error('Could not find tracks for this playlist ID. Make sure the playlist is public or unlisted.');
  }

  // Store in user's imported playlists
  const existingPlaylists = getImportedYouTubePlaylists();
  const newPl: Playlist = {
    id: `yt-pl-${playlistId}`,
    title: playlistTitle,
    subtitle: `${tracks.length} Songs · YouTube Music`,
    artwork: tracks[0]?.artwork || '',
    trackCount: tracks.length,
    tracks,
  };

  const updatedPlaylists = [newPl, ...existingPlaylists.filter(p => p.id !== newPl.id)];
  saveImportedYouTubePlaylists(updatedPlaylists);

  // Also add tracks to imported tracks library
  const existingTracks = getImportedYouTubeTracks();
  const trackMap = new Map<string, MusicTrack>();
  tracks.forEach(t => trackMap.set(t.title.toLowerCase() + t.artist.toLowerCase(), t));
  existingTracks.forEach(t => trackMap.set(t.title.toLowerCase() + t.artist.toLowerCase(), t));
  const updatedTracks = Array.from(trackMap.values());
  saveImportedYouTubeTracks(updatedTracks);

  return { title: playlistTitle, tracks };
}

// ---------------------------------------------------------------------------
// Real library sync
// ---------------------------------------------------------------------------

const PLAYLIST_CONCURRENCY = 3;
const MAX_PLAYLISTS = 40;

export class YouTubeSyncError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/**
 * Syncs the signed-in YouTube Music account into local storage (used for the Library tabs
 * and offline-ish lists): Liked Music (LM) and all library playlists, with real artist/album
 * ids on every track. Throws a YouTubeSyncError when the session isn't usable and NEVER
 * substitutes demo data.
 *
 * (Home, New, Album, Artist and Playlists pages fetch live and don't depend on this.)
 */
export async function syncUserYouTubeMusicLibrary(_account?: LinkedYouTubeAccount): Promise<{
  likedTracks: MusicTrack[];
  playlists: Playlist[];
}> {
  const auth = await extensionBridge.getAuthState(true);
  if (auth.error) {
    const hint = auth.error.code === 'forbidden'
      ? `The BitChord extension refused this site's origin (${window.location.origin}). Update the extension's allowed origins and reload it.`
      : auth.error.message;
    throw new YouTubeSyncError(auth.error.code, hint);
  }
  if (!auth.browserSignedIn) {
    throw new YouTubeSyncError('not-signed-in', 'This browser is not signed in to YouTube Music. Sign in at music.youtube.com, then try again.');
  }
  if (!auth.connected) {
    throw new YouTubeSyncError('disabled', 'YouTube is switched off in the BitChord extension popup.');
  }
  if (!auth.signedIn || !auth.active) {
    throw new YouTubeSyncError('session-rejected', auth.problem || 'YouTube did not accept the signed-in session.');
  }

  resetInnertube(); // fresh client so nothing from a previous channel leaks in

  // Liked Music
  let liked: Playlist | null = null;
  let likedError: any = null;
  try {
    liked = await getPlaylistDetails('LM');
  } catch (e) {
    likedError = e;
    console.warn('[yt sync] Liked Music failed:', e);
  }

  // Library playlists (cards), then each one's tracks
  const playlists: Playlist[] = [];
  let listError: any = null;
  try {
    const cards = (await getLibraryPlaylists()).filter(p => p.id !== 'LM').slice(0, MAX_PLAYLISTS);
    const byIndex: Array<Playlist | undefined> = [];
    let cursor = 0;
    const worker = async () => {
      while (cursor < cards.length) {
        const idx = cursor++;
        const card = cards[idx];
        try {
          const full = await getPlaylistDetails(card.id);
          if (full && full.tracks.length) {
            byIndex[idx] = { ...full, id: `yt-pl-${card.id}`, title: card.title || full.title, artwork: card.artwork || full.artwork };
          }
        } catch (e) {
          console.warn(`[yt sync] playlist ${card.id} failed:`, e);
        }
      }
    };
    await Promise.all(Array.from({ length: PLAYLIST_CONCURRENCY }, worker));
    byIndex.forEach(p => p && playlists.push(p));
  } catch (e) {
    listError = e;
    console.warn('[yt sync] library playlists failed:', e);
  }

  const likedTracks = liked?.tracks ?? [];
  if (likedTracks.length) {
    playlists.unshift({
      id: 'yt-pl-liked-music',
      title: 'Liked Music',
      subtitle: `${likedTracks.length} songs`,
      artwork: likedTracks[0].artwork,
      trackCount: likedTracks.length,
      tracks: likedTracks,
    });
  }

  if (!likedTracks.length && !playlists.length) {
    const cause = (likedError || listError) as any;
    throw new YouTubeSyncError(
      'empty',
      `Signed in as ${auth.active.name}, but no library data came back` +
        (cause?.message ? ` (${cause.message})` : '') +
        `. Check the browser console for "[yt sync]" messages.`
    );
  }

  const merged = new Map<string, MusicTrack>();
  playlists.forEach(p => p.tracks.forEach(t => merged.set(t.youtubeId || t.id, t)));
  const allTracks = Array.from(merged.values());
  saveImportedYouTubeTracks(allTracks);
  saveImportedYouTubePlaylists(playlists);

  saveLinkedYouTubeAccount({
    id: auth.active.id,
    name: auth.active.name,
    email: auth.active.email,
    avatar: auth.active.photoUrl || '',
    channelTitle: auth.active.handle || undefined,
    isLinked: true,
    lastSynced: Date.now(),
    importedTracksCount: allTracks.length,
    importedPlaylistsCount: playlists.length,
  });

  return { likedTracks, playlists };
}

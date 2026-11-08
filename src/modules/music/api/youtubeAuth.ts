import { MusicTrack, Playlist } from '../types';
import { getInnertube, resetInnertube } from './innertube';
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

  const yt = await getInnertube();
  let playlistTitle = 'Imported YouTube Music Playlist';
  let tracks: MusicTrack[] = [];

  try {
    const res: any = await yt.getPlaylist(playlistId);
    if (res?.info?.title) {
      playlistTitle = res.info.title;
    }

    const items = res?.videos || res?.items || [];
    if (Array.isArray(items) && items.length > 0) {
      tracks = items.map((v: any, idx: number): MusicTrack => {
        const thumb = v.thumbnails?.[0]?.url || v.thumbnail?.contents?.[0]?.url || '';
        return {
          id: `yt-pl-${v.id || idx}`,
          title: v.title?.text || v.title || 'Unknown Title',
          artist: v.author?.name || v.artists?.[0]?.name || 'Unknown Artist',
          album: playlistTitle,
          artwork: thumb ? thumb.replace(/=w\d+-h\d+/, '=w600-h600') : '',
          duration: v.duration?.seconds || 210,
          youtubeId: v.id,
          source: 'innertube',
        };
      });
    }
  } catch (err) {
    console.debug('yt.getPlaylist direct query failed, falling back to public mirror:', err);
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
              duration: s.duration || 200,
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

const MAX_PLAYLISTS = 30;
const MAX_PAGES_PER_PLAYLIST = 6;
const PLAYLIST_CONCURRENCY = 3;

function upscale(url: string): string {
  return url ? url.replace(/=w\d+-h\d+[^&]*$/, '=w600-h600') : '';
}

function listItemToTrack(item: any, fallbackAlbum: string, idPrefix: string): MusicTrack | null {
  const videoId: string | undefined = item?.id;
  const title: string | undefined = typeof item?.title === 'string' ? item.title : item?.title?.text;
  if (!videoId || !title) return null;
  const type = item?.item_type;
  if (type && !['song', 'video', 'non_music_track', 'unknown'].includes(type)) return null;
  const artists: string = (item.artists ?? item.authors ?? (item.author ? [item.author] : []))
    .map((a: any) => a?.name)
    .filter(Boolean)
    .join(', ');
  const thumbs = item.thumbnails ?? item.thumbnail?.contents ?? [];
  const thumb = thumbs.length ? thumbs[thumbs.length - 1]?.url : '';
  return {
    id: `${idPrefix}-${videoId}`,
    title,
    artist: artists || 'Unknown Artist',
    album: item.album?.name || fallbackAlbum,
    albumId: item.album?.id,
    artwork: upscale(thumb || ''),
    duration: item.duration?.seconds || 0,
    youtubeId: videoId,
    source: 'innertube',
  };
}

/** Loads a playlist's tracks, following continuations (bounded). */
async function loadPlaylistTracks(yt: any, playlistId: string, idPrefix: string) {
  let page: any = await yt.music.getPlaylist(playlistId);
  const title: string = page?.header?.title?.text || page?.header?.title || '';
  const tracks: MusicTrack[] = [];
  for (let i = 0; i < MAX_PAGES_PER_PLAYLIST; i++) {
    for (const item of page?.items ?? []) {
      const t = listItemToTrack(item, title || 'YouTube Music', idPrefix);
      if (t) tracks.push(t);
    }
    if (!page?.has_continuation) break;
    page = await page.getContinuation();
  }
  return { title, tracks };
}

/** Collects playlist entries (id/title/artwork) from the library landing page. */
async function listLibraryPlaylists(yt: any): Promise<Array<{ id: string; title: string; artwork: string }>> {
  let library: any = await yt.music.getLibrary();
  try {
    // The landing page has filter chips; the Playlists chip lists them all.
    if (Array.isArray(library?.filters) && library.filters.some((f: string) => /playlist/i.test(f))) {
      library = await library.applyFilter(library.filters.find((f: string) => /playlist/i.test(f)));
    }
  } catch (e) {
    console.debug('[yt sync] playlist filter not applied, using landing page:', e);
  }

  const found = new Map<string, { id: string; title: string; artwork: string }>();
  const collect = (item: any) => {
    if (item?.item_type !== 'playlist') return;
    const raw: string | undefined = item.id || item.endpoint?.payload?.browseId;
    if (!raw) return;
    const id = raw.replace(/^VL/, '');
    if (id === 'LM' || id === 'SE' || id.startsWith('RDPN')) return; // liked songs handled separately
    const title = typeof item.title === 'string' ? item.title : item.title?.text;
    if (!title) return;
    const thumbs = item.thumbnail?.contents ?? item.thumbnail ?? [];
    const thumb = Array.isArray(thumbs) && thumbs.length ? thumbs[thumbs.length - 1]?.url : '';
    if (!found.has(id)) found.set(id, { id, title, artwork: upscale(thumb || '') });
  };

  let guard = 0;
  let current: any = library;
  while (current && guard++ < 8) {
    for (const block of current.contents ?? []) {
      for (const item of block?.items ?? block?.contents ?? []) collect(item);
    }
    if (!current.has_continuation) break;
    const next = await current.getContinuation();
    // Continuation pages expose items directly on `contents`
    for (const item of next?.contents?.items ?? next?.contents?.contents ?? []) collect(item);
    if (!next?.has_continuation) break;
    current = next;
    if (!current.contents?.[Symbol.iterator]) break;
  }
  return Array.from(found.values()).slice(0, MAX_PLAYLISTS);
}

/** Personalised shelves from the signed-in home feed ("Quick picks", "Mixed for you" ...). */
async function loadHomeShelves(yt: any): Promise<Playlist[]> {
  const feed: any = await yt.music.getHomeFeed();
  const out: Playlist[] = [];
  for (const sec of feed?.sections ?? []) {
    const title: string | undefined = sec?.header?.title?.text;
    const tracks = (sec?.contents ?? [])
      .map((i: any) => listItemToTrack(i, title || 'YouTube Music', 'yt-home'))
      .filter(Boolean) as MusicTrack[];
    if (title && tracks.length >= 3) {
      out.push({
        id: `yt-home-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        title,
        subtitle: `${tracks.length} Songs · From your YouTube Music home`,
        artwork: tracks[0].artwork,
        trackCount: tracks.length,
        tracks,
      });
    }
  }
  return out;
}

export function getYouTubeHomeShelves(): Playlist[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_YT_HOME);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

export class YouTubeSyncError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/**
 * Syncs the signed-in YouTube Music account: Liked Music (LM), all library playlists and
 * the personalised home shelves. Throws a YouTubeSyncError when the session isn't usable
 * and NEVER substitutes demo/curated data: if nothing real comes back, it says so.
 */
export async function syncUserYouTubeMusicLibrary(_account?: LinkedYouTubeAccount): Promise<{
  likedTracks: MusicTrack[];
  playlists: Playlist[];
}> {
  // 1. Is there a real, accepted session?
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

  // Fresh client so nothing cached from a previous channel leaks in.
  resetInnertube();
  const yt: any = await getInnertube();

  // 2. Liked Music
  let likedTracks: MusicTrack[] = [];
  let likedError: unknown = null;
  try {
    likedTracks = (await loadPlaylistTracks(yt, 'LM', 'yt-liked')).tracks;
  } catch (e) {
    likedError = e;
    console.warn('[yt sync] Liked Music failed:', e);
  }

  // 3. Library playlists
  const playlists: Playlist[] = [];
  const byIndex: Array<Playlist | undefined> = [];
  let playlistsError: unknown = null;
  try {
    const entries = await listLibraryPlaylists(yt);
    let cursor = 0;
    const worker = async () => {
      while (cursor < entries.length) {
        const idx = cursor++;
        const entry = entries[idx];
        try {
          const { title, tracks } = await loadPlaylistTracks(yt, entry.id, `yt-pl-${entry.id}`);
          if (!tracks.length) continue;
          byIndex[idx] = {
            id: `yt-pl-${entry.id}`,
            title: entry.title || title,
            subtitle: `${tracks.length} Songs · YouTube Music`,
            artwork: entry.artwork || tracks[0].artwork,
            trackCount: tracks.length,
            tracks,
          };
        } catch (e) {
          console.warn(`[yt sync] playlist ${entry.id} failed:`, e);
        }
      }
    };
    await Promise.all(Array.from({ length: PLAYLIST_CONCURRENCY }, worker));
  } catch (e) {
    playlistsError = e;
    console.warn('[yt sync] library playlists failed:', e);
  }
  byIndex.forEach(p => p && playlists.push(p)); // keep the library's own order

  if (likedTracks.length) {
    playlists.unshift({
      id: 'yt-pl-liked-music',
      title: 'Liked Music',
      subtitle: `${likedTracks.length} Songs · YouTube Music`,
      artwork: likedTracks[0].artwork,
      trackCount: likedTracks.length,
      tracks: likedTracks,
    });
  }

  // 4. Personalised home shelves (listening preferences)
  let homeShelves: Playlist[] = [];
  try {
    homeShelves = await loadHomeShelves(yt);
  } catch (e) {
    console.debug('[yt sync] home feed failed:', e);
  }

  // 5. Nothing real came back -> report, do not fake.
  if (!likedTracks.length && !playlists.length) {
    const cause = (likedError || playlistsError) as any;
    throw new YouTubeSyncError(
      'empty',
      `Signed in as ${auth.active.name}, but no library data came back` +
        (cause?.message ? ` (${cause.message})` : '') +
        `. If this account really has playlists, check the browser console for "[yt sync]" messages.`
    );
  }

  // 6. Persist
  const merged = new Map<string, MusicTrack>();
  playlists.forEach(p => p.tracks.forEach(t => merged.set(t.youtubeId || t.id, t)));
  const allTracks = Array.from(merged.values());
  saveImportedYouTubeTracks(allTracks);
  saveImportedYouTubePlaylists(playlists);
  try { localStorage.setItem(STORAGE_KEY_YT_HOME, JSON.stringify(homeShelves)); } catch {}

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

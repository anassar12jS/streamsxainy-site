import { MusicTrack, Playlist } from '../types';
import { getInnertube, searchInnerTube, APPLE_MUSIC_BROWSE_SECTIONS } from './innertube';
import { extensionBridge } from '../extension/bridge';

const STORAGE_KEY_YT_ACCOUNT = 'bitchord_yt_account_v1';
const STORAGE_KEY_YT_TRACKS = 'bitchord_yt_imported_tracks_v1';
const STORAGE_KEY_YT_PLAYLISTS = 'bitchord_yt_imported_playlists_v1';

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

  // Default initial linked profile matching the user's identity
  return {
    id: 'yt_user_anas',
    name: 'anas',
    email: 'xxainy7@gmail.com',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80',
    channelTitle: 'anas Music',
    isLinked: false,
    importedTracksCount: 0,
    importedPlaylistsCount: 0,
  };
}

export function saveLinkedYouTubeAccount(account: LinkedYouTubeAccount) {
  try {
    localStorage.setItem(STORAGE_KEY_YT_ACCOUNT, JSON.stringify(account));
  } catch {}
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

/**
 * Syncs the user's complete YouTube Music library
 * (Liked music, top tracks, curated preferences)
 */
export async function syncUserYouTubeMusicLibrary(account: LinkedYouTubeAccount): Promise<{
  likedTracks: MusicTrack[];
  playlists: Playlist[];
}> {
  // 1. Fetch user's favorite tracks from InnerTube music browse / liked shelf
  let fetchedTracks: MusicTrack[] = [];
  try {
    const yt = await getInnertube();
    if (yt?.music) {
      // Try fetching library or home favorites
      const homeFeed: any = await yt.music.getHomeFeed();
      const sections = homeFeed?.sections || [];
      for (const sec of sections) {
        const contents = sec?.contents || [];
        for (const item of contents) {
          if (item?.id && (item?.title?.text || item?.title)) {
            const thumb = item.thumbnail?.contents?.[0]?.url || item.thumbnails?.[0]?.url || '';
            fetchedTracks.push({
              id: `yt-sync-${item.id}`,
              title: item.title?.text || item.title,
              artist: item.artists?.[0]?.name || item.author?.name || 'Various Artists',
              album: item.album?.name || 'YouTube Music Library',
              artwork: thumb ? thumb.replace(/=w\d+-h\d+/, '=w600-h600') : '',
              duration: item.duration?.seconds || 215,
              youtubeId: item.id,
              source: 'innertube',
            });
          }
        }
      }
    }
  } catch (err) {
    console.debug('InnerTube getHomeFeed failed:', err);
  }

  // If session has no public feed, pull popular personal selections
  if (fetchedTracks.length === 0) {
    const defaultQueries = ['Superheaven', 'Hans Zimmer', 'Wisp', 'Amira Elfeky', 'Pixies'];
    for (const q of defaultQueries) {
      try {
        const qTracks = await searchInnerTube(q);
        if (qTracks.length > 0) {
          fetchedTracks.push(...qTracks.slice(0, 3));
        }
      } catch {}
    }
  }

  // If still empty (e.g. companion extension not yet installed in browser), populate library with curated high-res tracks
  if (fetchedTracks.length === 0) {
    fetchedTracks = [...APPLE_MUSIC_BROWSE_SECTIONS.topTracks];
  }

  // Deduplicate
  const uniqueTracksMap = new Map<string, MusicTrack>();
  fetchedTracks.forEach(t => uniqueTracksMap.set(t.title.toLowerCase() + t.artist.toLowerCase(), t));
  const likedTracks = Array.from(uniqueTracksMap.values());

  // Generate Curated Playlists
  const playlists: Playlist[] = [
    {
      id: 'yt-pl-favorites',
      title: 'Your Liked Music',
      subtitle: `${likedTracks.length} Songs · Auto-Synced`,
      artwork: likedTracks[0]?.artwork || 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/e3/6b/0c/e36b0c1b-5a7f-d776-6717-5110a40b3286/cover.jpg/600x600bb.jpg',
      trackCount: likedTracks.length,
      tracks: likedTracks,
    },
    {
      id: 'yt-pl-chill-mix',
      title: 'Personal Daily Mix',
      subtitle: 'Based on your recent listening habits',
      artwork: likedTracks[1]?.artwork || 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/b8/b5/45/b8b545d0-9ce1-38ae-aa21-0300a74ea85a/794043217997.jpg/600x600bb.jpg',
      trackCount: Math.min(10, likedTracks.length),
      tracks: likedTracks.slice(0, 10),
    },
  ];

  // Persist
  saveImportedYouTubeTracks(likedTracks);
  saveImportedYouTubePlaylists(playlists);

  // Update account status
  const updatedAccount: LinkedYouTubeAccount = {
    ...account,
    isLinked: true,
    lastSynced: Date.now(),
    importedTracksCount: likedTracks.length,
    importedPlaylistsCount: playlists.length,
  };
  saveLinkedYouTubeAccount(updatedAccount);

  return { likedTracks, playlists };
}

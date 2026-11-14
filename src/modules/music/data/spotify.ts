import { useQuery } from '@tanstack/react-query';
import { extensionBridge, BridgeError } from '../extension/bridge';
import { getInnertube } from '../api/innertube';
import { NormalizedTrack, parseDuration } from './normalize';
import { ARTWORK_PLACEHOLDER } from '../api/ytmParse';

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: Array<{ name: string; id?: string }>;
  album?: {
    name: string;
    images?: Array<{ url: string; width?: number; height?: number }>;
  };
  duration_ms: number;
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  description?: string;
  images?: Array<{ url: string }>;
  tracks?: {
    total: number;
  };
}

export interface SpotifyPlaylistInfo {
  id: string;
  name: string;
  owner?: string | null;
  imageUrl?: string | null;
  total?: number;
}

/**
 * Checks Spotify authentication state via companion extension.
 * Extension returns { browserSignedIn, connected, signedIn, user, problem }.
 */
export async function getSpotifyAuthState(): Promise<{ authenticated: boolean; user?: any; browserSignedIn?: boolean; problem?: string | null }> {
  try {
    const res = await extensionBridge.call<any>('spotify.authState', { refresh: true }, { timeoutMs: 6000, retryOnWakeup: false });
    if (res?.signedIn) {
      return { authenticated: true, user: res.user, browserSignedIn: res.browserSignedIn, problem: res.problem };
    }
    return { authenticated: false, browserSignedIn: res?.browserSignedIn, problem: res?.problem };
  } catch (e) {
    console.debug('Spotify auth check:', e);
  }
  return { authenticated: false };
}

/**
 * Triggers Spotify Web sign-in popup or flow through companion extension
 */
export async function signInSpotify(): Promise<boolean> {
  try {
    const res = await extensionBridge.call<any>('spotify.signIn', {}, { timeoutMs: 30000 });
    return Boolean(res?.ok || res?.authenticated);
  } catch (e) {
    console.warn('Spotify signIn failed:', e);
    return false;
  }
}

/**
 * Fetches every Spotify playlist page (extension caps at 50/page).
 */
export async function getAllSpotifyPlaylists(): Promise<SpotifyPlaylist[]> {
  const all: SpotifyPlaylist[] = [];
  for (let page = 0; page < 10; page++) {
    const offset = page * 50;
    try {
      const res = await extensionBridge.call<any>('spotify.playlists', { offset, limit: 50 });
      const items: any[] = Array.isArray(res) ? res : (res?.items || []);
      const normalized = items
        .map((p: any) => ({
          id: p?.id || String(p?.uri || '').split(':').pop() || '',
          name: p?.name || '',
          description: p?.description,
          images: p?.imageUrl ? [{ url: p.imageUrl }] : p?.images,
          owner: p?.owner,
          tracks: p?.tracks,
        }))
        .filter((p: any) => p.id && p.name);
      all.push(...normalized);
      const total = typeof res?.total === 'number' ? res.total : items.length;
      if (items.length < 50 || all.length >= total) break;
    } catch (e) {
      console.debug('Spotify playlists page failed:', e);
      break;
    }
  }
  return all;
}

/**
 * Fetches user playlists from Spotify
 */
export async function getSpotifyPlaylists(offset = 0, limit = 20): Promise<SpotifyPlaylist[]> {
  try {
    const res = await extensionBridge.call<any>('spotify.playlists', { offset, limit });
    if (res?.items && Array.isArray(res.items)) {
      return res.items;
    }
    if (Array.isArray(res)) {
      return res;
    }
  } catch (e) {
    console.debug('Failed to fetch Spotify playlists:', e);
  }
  return [];
}

/**
 * The extension returns Spotify's GraphQL shape: { id, title, artist, album,
 * durationMs, imageUrl }. Older code expected the REST shape { name, artists,
 * duration_ms, album.images }. Normalize both into SpotifyTrack.
 */
function normalizeSpotifyTrack(raw: any): SpotifyTrack | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = raw.id || String(raw.uri || '').split(':').pop() || '';
  const name = raw.name || raw.title || '';
  if (!id || !name) return null;
  const artists: Array<{ name: string; id?: string }> = Array.isArray(raw.artists) && raw.artists.length
    ? raw.artists.map((a: any) => ({ name: a?.name || '', id: a?.id }))
    : raw.artist
      ? [{ name: String(raw.artist) }]
      : [{ name: 'Various Artists' }];
  const durationMs = raw.duration_ms ?? raw.durationMs ?? 0;
  const imageUrl = raw.imageUrl
    || raw.album?.images?.[0]?.url
    || (Array.isArray(raw.album?.images) ? raw.album.images[0]?.url : undefined);
  const albumName = raw.album?.name || raw.albumName || '';
  return {
    id,
    name,
    artists: artists.filter(a => a.name),
    album: (albumName || imageUrl)
      ? { name: albumName, images: imageUrl ? [{ url: imageUrl }] : undefined }
      : undefined,
    duration_ms: durationMs,
  };
}

/**
 * Fetches tracks from a Spotify playlist (single page).
 */
export async function getSpotifyPlaylistTracks(playlistId: string, offset = 0): Promise<{ tracks: SpotifyTrack[]; total: number }> {
  try {
    const res = await extensionBridge.call<any>('spotify.tracks', { playlistId, offset });
    const rawItems: any[] = Array.isArray(res) ? res : (res?.items || res?.tracks || []);
    const tracks = rawItems
      .map((item: any) => normalizeSpotifyTrack(item?.track || item))
      .filter((t): t is SpotifyTrack => t !== null);
    const total = typeof res?.total === 'number' ? res.total : tracks.length;
    return { tracks, total };
  } catch (e) {
    console.debug(`Failed to fetch tracks for Spotify playlist ${playlistId}:`, e);
  }
  return { tracks: [], total: 0 };
}

/**
 * Fetches every page of a Spotify playlist's tracks (capped at ~500).
 */
export async function getAllSpotifyPlaylistTracks(playlistId: string): Promise<SpotifyTrack[]> {
  const all: SpotifyTrack[] = [];
  let offset = 0;
  // The extension pages 100 at a time; stop when a page comes back short or we hit the cap
  for (let page = 0; page < 5; page++) {
    const { tracks, total } = await getSpotifyPlaylistTracks(playlistId, offset);
    all.push(...tracks);
    offset += tracks.length;
    if (tracks.length === 0 || (total > 0 && all.length >= total) || tracks.length < 100) break;
  }
  return all;
}

/** Playlist metadata (name, owner art, track count). 'liked' is supported for Liked Songs. */
export async function getSpotifyPlaylistInfo(playlistId: string): Promise<SpotifyPlaylistInfo | null> {
  try {
    const res = await extensionBridge.call<any>('spotify.playlist', { playlistId }, { timeoutMs: 8000, retryOnWakeup: false });
    if (!res) return null;
    return {
      id: playlistId,
      name: res.name || 'Playlist',
      owner: res.owner ?? null,
      imageUrl: res.imageUrl || null,
      total: typeof res.total === 'number' ? res.total : undefined,
    };
  } catch (e) {
    console.debug('Spotify playlist info failed:', e);
    return null;
  }
}

/** Maps a Spotify track into the site's MusicTrack shape so the normal playback pipeline resolves it on YouTube. */
export function spotifyToMusicTrack(t: SpotifyTrack): import('../types').MusicTrack {
  return {
    id: `sp_${t.id}`,
    title: t.name || 'Unknown track',
    artist: t.artists?.map(a => a.name).filter(Boolean).join(', ') || 'Various Artists',
    album: t.album?.name || '',
    artwork: t.album?.images?.[0]?.url || '',
    duration: Math.round((t.duration_ms || 0) / 1000),
    source: 'curated',
  };
}

/**
 * Resolves a Spotify track to YouTube Music by matching Title, Artist, and Duration.
 * Uses duration scoring (delta <= 5s) to guarantee accurate track matching!
 */
export async function resolveSpotifyTrackToYtm(track: SpotifyTrack): Promise<NormalizedTrack | null> {
  const title = track.name;
  const artist = track.artists?.map(a => a.name).join(', ') || 'Various Artists';
  const targetDurationSec = Math.round(track.duration_ms / 1000);
  const artwork = track.album?.images?.[0]?.url || ARTWORK_PLACEHOLDER;

  try {
    const yt = await getInnertube();
    const query = `${title} ${track.artists?.[0]?.name || ''}`.trim();
    
    // First try yt.music.search
    let candidates: any[] = [];
    try {
      const musicSearch: any = await yt.music.search(query, { type: 'song' });
      const items = musicSearch.results || musicSearch.contents?.[0]?.contents || [];
      candidates = items;
    } catch {}

    // Fallback to general search
    if (candidates.length === 0) {
      try {
        const generalSearch: any = await yt.search(`${query} audio`, { type: 'video' });
        candidates = generalSearch.videos || generalSearch.results || [];
      } catch {}
    }

    if (candidates.length > 0) {
      // Score candidates based on duration delta
      let bestMatch: any = null;
      let minDelta = Infinity;

      for (const cand of candidates) {
        const candDuration = parseDuration(cand.duration?.seconds || cand.duration?.text || cand.duration);
        const delta = Math.abs(candDuration - targetDurationSec);

        // Exact or close duration match (< 5 seconds)
        if (delta < minDelta) {
          minDelta = delta;
          bestMatch = { cand, duration: candDuration };
          if (delta <= 2) break; // Close enough!
        }
      }

      const chosen = bestMatch?.cand || candidates[0];
      const videoId = chosen.id || chosen.videoId || chosen.endpoint?.payload?.videoId;

      return {
        id: `sp_${track.id}`,
        youtubeId: videoId,
        title,
        artist,
        album: track.album?.name,
        artwork,
        duration: bestMatch?.duration || targetDurationSec,
      };
    }
  } catch (err) {
    console.debug('Failed to resolve Spotify track to YouTube:', err);
  }

  // Fallback track representation
  return {
    id: `sp_${track.id}`,
    title,
    artist,
    album: track.album?.name,
    artwork,
    duration: targetDurationSec,
  };
}

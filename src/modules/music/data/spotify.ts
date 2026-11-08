import { useQuery } from '@tanstack/react-query';
import { extensionBridge, BridgeError } from '../extension/bridge';
import { getInnertube } from '../api/innertube';
import { NormalizedTrack, parseDuration } from './normalize';

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

/**
 * Checks Spotify authentication state via companion extension
 */
export async function getSpotifyAuthState(): Promise<{ authenticated: boolean; user?: any }> {
  try {
    const res = await extensionBridge.call<any>('spotify.authState', {}, { timeoutMs: 4000, retryOnWakeup: false });
    if (res && (res.authenticated || res.user || res.accessToken)) {
      return { authenticated: true, user: res.user };
    }
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
 * Fetches tracks from a Spotify playlist
 */
export async function getSpotifyPlaylistTracks(playlistId: string): Promise<SpotifyTrack[]> {
  try {
    const res = await extensionBridge.call<any>('spotify.tracks', { playlistId });
    if (res?.items && Array.isArray(res.items)) {
      return res.items.map((item: any) => item.track || item).filter(Boolean);
    }
    if (Array.isArray(res)) {
      return res.map((item: any) => item.track || item).filter(Boolean);
    }
  } catch (e) {
    console.debug(`Failed to fetch tracks for Spotify playlist ${playlistId}:`, e);
  }
  return [];
}

/**
 * Resolves a Spotify track to YouTube Music by matching Title, Artist, and Duration.
 * Uses duration scoring (delta <= 5s) to guarantee accurate track matching!
 */
export async function resolveSpotifyTrackToYtm(track: SpotifyTrack): Promise<NormalizedTrack | null> {
  const title = track.name;
  const artist = track.artists?.map(a => a.name).join(', ') || 'Various Artists';
  const targetDurationSec = Math.round(track.duration_ms / 1000);
  const artwork = track.album?.images?.[0]?.url || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=500&q=80';

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

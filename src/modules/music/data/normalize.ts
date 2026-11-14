import { ARTWORK_PLACEHOLDER } from '../api/ytmParse';
/**
 * Xainy Music Domain Normalization Layer
 * Converts raw Innertube / YouTube Music / Spotify responses into clean, typed models.
 * Includes defensive extractors and high-res thumbnail upscaling.
 */

export interface NormalizedTrack {
  id: string;
  title: string;
  artist: string;
  artistId?: string;
  album?: string;
  albumId?: string;
  artwork: string;
  duration: number; // in seconds
  durationFormatted?: string;
  isExplicit?: boolean;
  youtubeId?: string;
  views?: string;
}

export interface NormalizedAlbum {
  id: string;
  title: string;
  artist: string;
  artistId?: string;
  artwork: string;
  year?: string;
  trackCount?: number;
  tracks?: NormalizedTrack[];
}

export interface NormalizedArtist {
  id: string;
  name: string;
  avatar: string;
  subscribers?: string;
  bio?: string;
  topTracks?: NormalizedTrack[];
  albums?: NormalizedAlbum[];
  singles?: NormalizedAlbum[];
}

export interface NormalizedPlaylist {
  id: string;
  title: string;
  description?: string;
  author?: string;
  artwork: string;
  trackCount?: number;
  tracks?: NormalizedTrack[];
}

export interface NormalizedShelf {
  id: string;
  title: string;
  subtitle?: string;
  items: (NormalizedTrack | NormalizedAlbum | NormalizedPlaylist | NormalizedArtist)[];
}

/**
 * Transforms standard low-res YouTube thumbnails into high-res (w540 / s800)
 */
export function upscaleThumbnail(url?: string): string {
  if (!url || typeof url !== 'string') {
    return ARTWORK_PLACEHOLDER;
  }

  // Handle googleusercontent / ggpht urls
  if (url.includes('googleusercontent.com') || url.includes('ggpht.com')) {
    // Replace =w...-h... or =s... with =w540-h540-l90-rj
    return url.replace(/=w\d+-h\d+[^=]*$/, '=w540-h540-l90-rj')
              .replace(/=s\d+[^=]*$/, '=s600-c-k-c0x00ffffff-no-rj');
  }

  // Handle i.ytimg.com/vi/ID/default.jpg -> maxresdefault.jpg or hqdefault.jpg
  if (url.includes('i.ytimg.com/vi/')) {
    return url.replace(/\/default\.jpg$/, '/hqdefault.jpg')
              .replace(/\/mqdefault\.jpg$/, '/hqdefault.jpg');
  }

  return url;
}

export function parseDuration(durationStr?: string | number): number {
  if (typeof durationStr === 'number') return durationStr;
  if (!durationStr || typeof durationStr !== 'string') return 180;

  const parts = durationStr.split(':').map(p => parseInt(p, 10));
  if (parts.some(isNaN)) return 180;

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return parts[0] || 180;
}

export function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Defensive extractor for a single track item from Innertube Music responsive list item
 */
export function extractTrack(item: any): NormalizedTrack | null {
  if (!item) return null;

  try {
    const id = item.id || item.videoId || item.endpoint?.payload?.videoId || item.navigationEndpoint?.watchEndpoint?.videoId;
    if (!id && !item.title) return null;

    const title = 
      typeof item.title === 'string' ? item.title : 
      item.title?.text || 
      item.title?.runs?.[0]?.text || 
      item.headline?.text || 
      'Unknown Title';

    let artist = 'Various Artists';
    let artistId: string | undefined = undefined;

    if (item.artists && Array.isArray(item.artists) && item.artists.length > 0) {
      artist = item.artists.map((a: any) => a.name || a.text).join(', ');
      artistId = item.artists[0]?.id || item.artists[0]?.channel_id;
    } else if (item.author?.name || item.author?.text) {
      artist = item.author.name || item.author.text;
      artistId = item.author?.id || item.author?.channel_id;
    } else if (item.subtitle?.runs && Array.isArray(item.subtitle.runs)) {
      // YouTube Music subtitle runs usually contain [Artist, " • ", Album, " • ", Duration]
      const textRuns = item.subtitle.runs.map((r: any) => r.text).filter((t: string) => t && t !== ' • ');
      if (textRuns.length > 0) {
        artist = textRuns[0];
      }
    }

    let album: string | undefined = undefined;
    let albumId: string | undefined = undefined;

    if (item.album?.name || item.album?.text) {
      album = item.album.name || item.album.text;
      albumId = item.album?.id;
    }

    // Thumbnail extractor
    let rawThumb: string | undefined = undefined;
    if (item.thumbnail?.contents?.[0]?.url) {
      rawThumb = item.thumbnail.contents[0].url;
    } else if (item.thumbnail?.thumbnails?.[0]?.url) {
      const thumbs = item.thumbnail.thumbnails;
      rawThumb = thumbs[thumbs.length - 1]?.url || thumbs[0]?.url;
    } else if (item.thumbnails?.[0]?.url) {
      const thumbs = item.thumbnails;
      rawThumb = thumbs[thumbs.length - 1]?.url || thumbs[0]?.url;
    }

    const artwork = upscaleThumbnail(rawThumb || (id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : undefined));
    const duration = parseDuration(item.duration?.seconds || item.duration?.text || item.duration);

    return {
      id: id || `track_${Math.random().toString(36).slice(2, 9)}`,
      youtubeId: id,
      title,
      artist,
      artistId,
      album,
      albumId,
      artwork,
      duration,
      durationFormatted: formatDuration(duration),
      isExplicit: Boolean(item.is_explicit || item.badges?.some((b: any) => b.label === 'Explicit')),
      views: item.views?.text || item.short_view_count?.text,
    };
  } catch (e) {
    return null;
  }
}

/**
 * Defensive extractor for Album items
 */
export function extractAlbum(item: any): NormalizedAlbum | null {
  if (!item) return null;

  try {
    const id = item.id || item.browseId || item.endpoint?.payload?.browseId;
    if (!id && !item.title) return null;

    const title = 
      typeof item.title === 'string' ? item.title :
      item.title?.text || item.title?.runs?.[0]?.text || 'Untitled Album';

    let artist = 'Various Artists';
    let artistId: string | undefined = undefined;

    if (item.author?.name || item.author?.text) {
      artist = item.author.name || item.author.text;
      artistId = item.author?.id;
    } else if (item.artists && Array.isArray(item.artists)) {
      artist = item.artists.map((a: any) => a.name || a.text).join(', ');
      artistId = item.artists[0]?.id;
    } else if (item.subtitle?.runs) {
      artist = item.subtitle.runs[0]?.text || 'Various Artists';
    }

    let rawThumb: string | undefined = undefined;
    if (item.thumbnail?.contents?.[0]?.url) {
      rawThumb = item.thumbnail.contents[0].url;
    } else if (item.thumbnail?.thumbnails?.[0]?.url) {
      const thumbs = item.thumbnail.thumbnails;
      rawThumb = thumbs[thumbs.length - 1]?.url;
    }

    return {
      id: id || `album_${Math.random().toString(36).slice(2, 9)}`,
      title,
      artist,
      artistId,
      artwork: upscaleThumbnail(rawThumb),
      year: item.year?.text || item.subtitle?.runs?.find((r: any) => /^\d{4}$/.test(r.text))?.text,
    };
  } catch {
    return null;
  }
}

/**
 * Defensive extractor for Shelves / Sections
 */
export function extractShelf(shelf: any): NormalizedShelf | null {
  if (!shelf) return null;

  try {
    const title = 
      typeof shelf.title === 'string' ? shelf.title :
      shelf.title?.text || shelf.title?.runs?.[0]?.text || 'Featured';

    const items: any[] = [];
    const rawItems = shelf.contents || shelf.items || [];

    for (const raw of rawItems) {
      // Determine if item is Track, Album, Playlist, or Artist
      const itemType = raw.type || raw.endpoint?.payload?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType;

      if (raw.videoId || itemType === 'MUSIC_PAGE_TYPE_TRACK' || raw.endpoint?.payload?.videoId) {
        const track = extractTrack(raw);
        if (track) items.push(track);
      } else if (itemType === 'MUSIC_PAGE_TYPE_ALBUM' || raw.year || /album/i.test(raw.subtitle?.text || '')) {
        const album = extractAlbum(raw);
        if (album) items.push(album);
      } else {
        // Fallback: try track, then album
        const track = extractTrack(raw);
        if (track && track.youtubeId) {
          items.push(track);
        } else {
          const album = extractAlbum(raw);
          if (album) items.push(album);
        }
      }
    }

    if (items.length === 0) return null;

    return {
      id: shelf.id || `shelf_${Math.random().toString(36).slice(2, 9)}`,
      title,
      subtitle: shelf.subtitle?.text,
      items,
    };
  } catch {
    return null;
  }
}

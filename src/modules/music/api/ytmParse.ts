/**
 * Parsers that turn youtubei.js YouTube Music nodes into Xainy Music's own types.
 *
 * Field names here come from the youtubei.js 18.x type definitions, NOT from guesswork:
 *  - MusicResponsiveListItem: id (videoId), title (string), artists[{name, channel_id}],
 *    album{id,name}, duration{seconds}, thumbnail (MusicThumbnail -> .contents[])
 *  - MusicTwoRowItem: id, title (Text), subtitle (Text), artists, year, thumbnail (Thumbnail[])
 *  - Artists are identified by `channel_id` (UC...), never `id`.
 *  - Album pages use MusicResponsiveHeader (strapline_text_one = artist) or
 *    MusicDetailHeader (author / year / thumbnails).
 *
 * Nothing here invents data: missing values stay empty / 0 so the UI can show them honestly.
 */
import type { MusicTrack, Album, Playlist } from '../types';

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/** youtubei.js `Text` | string | undefined -> plain string */
export function txt(t: any): string {
  if (t == null) return '';
  if (typeof t === 'string') return t;
  return typeof t.text === 'string' ? t.text : '';
}

/** Upscale Google-hosted artwork URLs (googleusercontent / ggpht). Other hosts are untouched. */
export function hiRes(url: string | undefined, size = 600): string {
  if (!url) return '';
  if (!/googleusercontent\.com|ggpht\.com/.test(url)) return url;
  return url
    .replace(/=w\d+-h\d+/, `=w${size}-h${size}`)
    .replace(/=s\d+(?=-|$)/, `=s${size}`);
}

function widest(arr: any[]): string {
  let best: any = arr[0];
  for (const t of arr) if ((t?.width || 0) > (best?.width || 0)) best = t;
  return best?.url || '';
}

export const ARTWORK_PLACEHOLDER =
  'data:image/svg+xml;charset=UTF-8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><rect width="600" height="600" fill="#1c1c1e"/><circle cx="300" cy="265" r="72" fill="#3a3a3c"/><path d="M300 385c-62 0-114-42-127-98h254c-13 56-65 98-127 98z" fill="#3a3a3c"/></svg>'
  );

/** Never return an empty/broken artwork URL: prefer the source thumb, then the video's own thumbnail, then a placeholder. */
export function artworkOr(url: string | undefined, videoId?: string): string {
  if (url) return url;
  if (videoId) return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  return ARTWORK_PLACEHOLDER;
}

/** Accepts Thumbnail[], MusicThumbnail ({contents}), or an object with `thumbnails`. */
export function thumbOf(x: any, size = 600): string {
  if (!x) return '';
  if (typeof x === 'string') return hiRes(x, size);
  let arr: any[] | undefined;
  if (Array.isArray(x)) arr = x;
  else if (Array.isArray(x.contents)) arr = x.contents;
  else if (Array.isArray(x.thumbnails)) arr = x.thumbnails;
  return arr?.length ? hiRes(widest(arr), size) : '';
}

/** duration{seconds} | {text:'m:ss'} | 'm:ss' | plain seconds -> seconds (0 when unknown) */
export function durationSeconds(d: any): number {
  if (d == null) return 0;
  if (typeof d === 'number') return d;
  if (typeof d.seconds === 'number' && d.seconds > 0) return d.seconds;
  const t = txt(d?.text ?? d);
  const parts = t.split(':').map(Number);
  if (!parts.length || parts.some(isNaN)) return 0;
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

export function browseIdOf(endpoint: any): string | undefined {
  return endpoint?.payload?.browseId || endpoint?.browse?.id || undefined;
}

/** First run in a Text that links to an artist channel (browseId UC...) */
function artistFromText(t: any): { name: string; id: string } | undefined {
  const own = browseIdOf(t?.endpoint);
  if (own?.startsWith('UC')) return { name: txt(t), id: own };
  for (const r of t?.runs ?? []) {
    const id = browseIdOf(r?.endpoint);
    if (id?.startsWith('UC')) return { name: r.text, id };
  }
  return undefined;
}

const YEAR_RE = /\b(19|20)\d{2}\b/;

// ---------------------------------------------------------------------------
// Songs / videos
// ---------------------------------------------------------------------------

export interface SongCtx {
  album?: string;
  albumId?: string;
  artist?: string;
  artistId?: string;
  artwork?: string;
}

/**
 * MusicResponsiveListItem | MusicTwoRowItem(video) -> MusicTrack.
 * `ctx` supplies values the row doesn't carry (album pages omit the artist/album columns).
 * The track id is the YouTube videoId so likes/queue identity stays consistent everywhere.
 */
export function parseSong(item: any, ctx: SongCtx = {}): MusicTrack | null {
  if (!item) return null;
  const type = item.item_type;
  if (type && !['song', 'video', 'non_music_track', 'unknown'].includes(type)) return null;

  const videoId: string | undefined = item.id || item.video_id;
  const title = txt(item.title);
  if (!videoId || !title) return null;

  const people: any[] = item.artists?.length
    ? item.artists
    : item.authors?.length
      ? item.authors
      : item.author
        ? [item.author]
        : [];
  const artist = people.map(p => p?.name).filter(Boolean).join(', ') || ctx.artist || '';
  const artistId: string | undefined = people.find(p => p?.channel_id)?.channel_id || ctx.artistId;

  const artwork = artworkOr(thumbOf(item.thumbnail ?? item.thumbnails) || ctx.artwork || undefined, videoId);

  return {
    id: videoId,
    title,
    artist: artist || 'Unknown Artist',
    artistId,
    album: item.album?.name || ctx.album || '',
    albumId: item.album?.id || ctx.albumId,
    artwork,
    duration: durationSeconds(item.duration),
    youtubeId: videoId,
    source: 'innertube',
  };
}

// ---------------------------------------------------------------------------
// Albums / artists / playlists (cards)
// ---------------------------------------------------------------------------

export function parseAlbumCard(item: any): Album | null {
  const id: string | undefined = item?.id || browseIdOf(item?.endpoint);
  const title = txt(item?.title);
  if (!id || !title) return null;

  const people: any[] = item.artists?.length ? item.artists : item.author ? [item.author] : [];
  const fromSub = artistFromText(item.subtitle);
  const artist = people.map(p => p?.name).filter(Boolean).join(', ') || fromSub?.name || '';
  const artistId = people.find(p => p?.channel_id)?.channel_id || fromSub?.id;

  const subText = txt(item.subtitle);
  const kind = /^(single|ep|album)/i.exec(subText)?.[0];

  return {
    id,
    title,
    artist,
    artistId,
    artwork: artworkOr(thumbOf(item.thumbnail ?? item.thumbnails)),
    year: item.year || YEAR_RE.exec(subText)?.[0] || '',
    genre: kind ? kind[0].toUpperCase() + kind.slice(1).toLowerCase() : 'Album',
    trackCount: 0, // unknown until the album page is opened
    tracks: [],
  };
}

export interface ArtistCard {
  id: string;
  name: string;
  artwork: string;
  subtitle: string;
}

export function parseArtistCard(item: any): ArtistCard | null {
  const id: string | undefined = item?.id || browseIdOf(item?.endpoint);
  const name = txt(item?.title) || item?.name || '';
  if (!id || !name) return null;
  return {
    id,
    name,
    artwork: artworkOr(thumbOf(item.thumbnail ?? item.thumbnails)),
    subtitle: txt(item.subtitle) || item.subscribers || '',
  };
}

function parseCount(...candidates: Array<string | null | undefined>): number {
  for (const c of candidates) {
    if (!c) continue;
    const m = /([\d][\d,.]*)\s*(songs?|tracks?|videos?|episodes?)/i.exec(c);
    if (m) return parseInt(m[1].replace(/[,.]/g, ''), 10) || 0;
  }
  return 0;
}

/** Playlist card (grid/carousel). Tracks are NOT loaded; use getPlaylistDetails for those. */
export function parsePlaylistCard(item: any): Playlist | null {
  const raw: string | undefined = item?.id || browseIdOf(item?.endpoint);
  const title = txt(item?.title);
  if (!raw || !title) return null;
  const id = raw.replace(/^VL/, '');
  const sub = txt(item.subtitle)
    .replace(/^Playlist\s*•\s*/i, '')
    .trim();
  const artwork = artworkOr(thumbOf(item.thumbnail ?? item.thumbnails));
  return {
    id,
    title,
    subtitle: sub,
    artwork,
    trackCount: parseCount(sub, item.item_count),
    tracks: [],
  };
}

// ---------------------------------------------------------------------------
// Generic shelf (home feed, explore, ...)
// ---------------------------------------------------------------------------

export type HomeItem =
  | { kind: 'track'; track: MusicTrack }
  | { kind: 'album'; album: Album }
  | { kind: 'artist'; artist: ArtistCard }
  | { kind: 'playlist'; playlist: Playlist };

export interface HomeShelf {
  id: string;
  title: string;
  subtitle?: string;
  items: HomeItem[];
}

/** Any card/row node -> a typed HomeItem, or null for things we can't open (nav buttons etc.) */
export function parseCard(item: any): HomeItem | null {
  if (!item) return null;
  switch (item.item_type) {
    case 'song':
    case 'video':
    case 'non_music_track': {
      const track = parseSong(item);
      return track ? { kind: 'track', track } : null;
    }
    case 'album': {
      const album = parseAlbumCard(item);
      return album ? { kind: 'album', album } : null;
    }
    case 'artist':
    case 'library_artist': {
      const artist = parseArtistCard(item);
      return artist ? { kind: 'artist', artist } : null;
    }
    case 'playlist': {
      const playlist = parsePlaylistCard(item);
      return playlist ? { kind: 'playlist', playlist } : null;
    }
    default:
      return null;
  }
}

/** MusicCarouselShelf | MusicShelf -> HomeShelf */
export function parseShelf(section: any, fallbackId: string): HomeShelf | null {
  if (!section) return null;
  const title = txt(section.header?.title) || txt(section.title);
  const raw: any[] = section.contents ?? section.items ?? [];
  const items = raw.map(parseCard).filter(Boolean) as HomeItem[];
  if (!title || items.length === 0) return null;
  return {
    id: `${fallbackId}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    title,
    subtitle: txt(section.header?.strapline) || undefined,
    items,
  };
}

// ---------------------------------------------------------------------------
// Album page header (handles both header classes YouTube serves)
// ---------------------------------------------------------------------------

export interface ParsedAlbumHeader {
  title: string;
  artist: string;
  artistId?: string;
  year: string;
  artwork: string;
  kind: string;
}

export function parseAlbumHeader(header: any, background?: any): ParsedAlbumHeader {
  const title = txt(header?.title);

  // MusicDetailHeader has author/year; MusicResponsiveHeader has strapline_text_one.
  const strap = artistFromText(header?.strapline_text_one);
  const subFallback = artistFromText(header?.subtitle);
  const artist = header?.author?.name || txt(header?.strapline_text_one) || strap?.name || subFallback?.name || '';
  const artistId: string | undefined =
    header?.author?.channel_id || strap?.id || subFallback?.id || undefined;

  const subtitle = txt(header?.subtitle);
  const year = header?.year || YEAR_RE.exec(subtitle)?.[0] || YEAR_RE.exec(txt(header?.second_subtitle))?.[0] || '';
  const kind = /^(album|single|ep)/i.exec(subtitle)?.[0] || 'Album';

  const artwork = artworkOr(thumbOf(header?.thumbnail ?? header?.thumbnails ?? background, 1200));
  return { title, artist, artistId, year, artwork, kind: kind[0].toUpperCase() + kind.slice(1).toLowerCase() };
}

// ---------------------------------------------------------------------------
// "Up next" / radio rows (PlaylistPanelVideo)
// ---------------------------------------------------------------------------

/**
 * PlaylistPanelVideo (or its wrapper's `primary`) -> MusicTrack.
 * Fields per youtubei.js: video_id, title (Text), artists[{name, channel_id}],
 * album{id,name}, duration{seconds}, thumbnail (Thumbnail[]).
 */
export function parsePanelVideo(row: any): MusicTrack | null {
  const item = row?.video_id ? row : row?.primary?.video_id ? row.primary : null;
  if (!item) return null;
  const title = txt(item.title);
  if (!title) return null;
  const people: any[] = item.artists ?? [];
  return {
    id: item.video_id,
    title,
    artist: people.map(p => p?.name).filter(Boolean).join(', ') || item.author || 'Unknown Artist',
    artistId: people.find(p => p?.channel_id)?.channel_id,
    album: item.album?.name || '',
    albumId: item.album?.id,
    artwork: artworkOr(thumbOf(item.thumbnail), item.video_id),
    duration: durationSeconds(item.duration),
    youtubeId: item.video_id,
    source: 'innertube',
  };
}

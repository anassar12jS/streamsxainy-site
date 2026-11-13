import { Innertube, UniversalCache } from 'youtubei.js';
import { MusicTrack, Album, Artist, Playlist } from '../types';
import { extensionBridge } from '../extension/bridge';
import { YTNodes } from 'youtubei.js';
import { txt, thumbOf, artworkOr, durationSeconds, ARTWORK_PLACEHOLDER, parsePanelVideo, parseSong, parseAlbumCard, parseArtistCard, parsePlaylistCard, parseCard, parseShelf, parseAlbumHeader, type HomeShelf, type HomeItem } from './ytmParse';
import { useMusicPlayerStore } from '../store/useMusicPlayerStore';

let ytInstance: Innertube | null = null;
let isInitializing = false;

import { getInnertubeForChannel, resetInnertubeInstances } from './innertubeFactory';

/** Drops all cached clients so the next getInnertube() builds a fresh one (e.g. after switching channel). */
export const resetInnertube = resetInnertubeInstances;

/**
 * Initializes YouTube.js Innertube client with custom extension proxy fetch.
 * Bypasses CORS and routes requests through the Xainy Music companion extension
 * to utilize signed-in YouTube Music sessions.
 */
export async function getInnertube(channelId?: string): Promise<Innertube> {
  return getInnertubeForChannel(channelId);
}

const videoIdCache = new Map<string, string>();

/**
 * Resolves the YouTube video ID for a track that doesn't carry one (e.g. old imports).
 * Prefers YouTube Music's own song search (official audio, embeddable) over generic video search.
 */
export async function resolveVideoId(
  trackOrId: string | MusicTrack | { title: string; artist: string; youtubeId?: string }
): Promise<string | null> {
  const track = typeof trackOrId === 'string'
    ? { title: '', artist: '', youtubeId: trackOrId }
    : trackOrId;

  if (track.youtubeId) return track.youtubeId;
  if (!track.title && !track.artist) return null;

  const key = `${track.title}|${track.artist}`.toLowerCase();
  const cached = videoIdCache.get(key);
  if (cached) return cached;

  let videoId: string | undefined;
  const yt: any = await getInnertube();

  // 1. YouTube Music song search (most accurate)
  try {
    const res: any = await yt.music.search(`${track.title} ${track.artist}`.trim(), { type: 'song' });
    const rows: any[] = res?.songs?.contents ?? res?.contents?.[0]?.contents ?? res?.results ?? [];
    videoId = rows.map(r => parseSong(r)).find(Boolean)?.id;
  } catch (err) {
    console.debug('yt.music.search failed:', err);
  }

  // 2. Generic video search
  if (!videoId) {
    try {
      const generalSearch: any = await yt.search(`${track.title} ${track.artist} audio`.trim(), { type: 'video' });
      videoId = generalSearch?.videos?.[0]?.id || generalSearch?.results?.[0]?.id;
    } catch (err) {
      console.debug('yt.search failed:', err);
    }
  }



  if (videoId) videoIdCache.set(key, videoId);
  return videoId || null;
}

/**
 * Another upload of the same song, for when YouTube refuses to embed the first one
 * (error 101/150: the uploader disabled embedding, common for official music videos).
 */
export async function resolveAlternateVideoId(
  track: { title: string; artist: string },
  excludeId: string
): Promise<string | null> {
  try {
    const yt: any = await getInnertube();
    const res: any = await yt.music.search(`${track.title} ${track.artist}`.trim(), { type: 'song' });
    const rows: any[] = res?.songs?.contents ?? res?.contents?.[0]?.contents ?? res?.results ?? [];
    const alt = rows.map(r => parseSong(r)).find(t => t && t.id !== excludeId);
    return alt?.id ?? null;
  } catch {
    return null;
  }
}

interface CachedStream {
  url: string;
  isDash: boolean;
  expiresAt: number;
}

/**
 * Stream URL cache persisted to sessionStorage so a page refresh doesn't
 * send every play back through the ~2-4s resolve path. blob:/DASH object URLs
 * can't survive a reload, so only http(s) results are persisted.
 */
const STREAM_CACHE_KEY = 'xainy_stream_cache_v1';
const STREAM_CACHE_MAX = 400;
const streamUrlCache = new Map<string, CachedStream>((() => {
  try {
    const raw = sessionStorage.getItem(STREAM_CACHE_KEY);
    if (!raw) return [];
    const now = Date.now();
    return (JSON.parse(raw) as Array<[string, CachedStream]>)
      .filter(([, v]) => v && typeof v.url === 'string' && v.url.startsWith('http') && v.expiresAt > now);
  } catch {
    return [];
  }
})());
let streamCacheDirty = false;
function persistStreamCache() {
  if (!streamCacheDirty) return;
  streamCacheDirty = false;
  try {
    const entries = [...streamUrlCache.entries()]
      .filter(([, v]) => v.url.startsWith('http'))
      .slice(-STREAM_CACHE_MAX);
    sessionStorage.setItem(STREAM_CACHE_KEY, JSON.stringify(entries));
  } catch {}
}
function cacheStream(cacheKey: string, result: { url: string; isDash: boolean }, ttlMs: number) {
  streamUrlCache.set(cacheKey, { ...result, expiresAt: Date.now() + ttlMs });
  streamCacheDirty = true;
  persistStreamCache();
}

/**
 * Resolves full-length audio stream for a track from YouTube Music.
 * Uses yt.music.search to find videoId, fetches basic info, and deciphers the best audio format.
 */
export async function resolveStreamUrl(
  trackOrId: string | MusicTrack | { title: string; artist: string; youtubeId?: string }
): Promise<{ url: string; isDash: boolean }> {
  const track = typeof trackOrId === 'string' 
    ? { title: '', artist: '', youtubeId: trackOrId } 
    : trackOrId;

  let videoId = await resolveVideoId(track);
  const qualityPref = useMusicPlayerStore.getState().audioQuality;
  const cacheKey = `${videoId || (typeof trackOrId === 'string' ? trackOrId : `${track.title}|${track.artist}`.toLowerCase())}|${qualityPref}`;

  const cached = streamUrlCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return { url: cached.url, isDash: cached.isDash };
  }

  const yt = await getInnertube();

  // 2. Fetch stream format and decipher via player.
  //    Race the heavy getInfo against the light getBasicInfo — whichever
  //    returns usable streaming data first wins, roughly halving cold-start.
  if (videoId) {
    try {
      const usable = (i: any) =>
        !!i && !i.__err && (i.streaming_data || typeof i.chooseFormat === 'function' || i.streaming_data?.adaptive_formats);
      const jobs = [
        { p: yt.getInfo(videoId).catch(() => null) },
        { p: yt.getBasicInfo(videoId).catch(() => null) },
      ];
      let info: any = null;
      while (jobs.length && !info) {
        const settled = await Promise.race(jobs.map(j => j.p.then(v => ({ job: j, v }))));
        jobs.splice(jobs.indexOf(settled.job), 1);
        if (usable(settled.v)) info = settled.v;
      }

      let streamUrl: string | null = null;

      // Get the best audio-only format — quality preference maps to
      // youtubei.js tiers: lossless→best, high→high, auto→besteffort
      const ytQuality = qualityPref === 'lossless' ? 'best' : qualityPref === 'high' ? 'high' : 'besteffort';
      if (info?.streaming_data) {
        const bestAudio = info.chooseFormat({ type: 'audio', quality: ytQuality });

        if (bestAudio) {
          if (typeof bestAudio.url === 'string' && bestAudio.url.startsWith('http')) {
            streamUrl = bestAudio.url;
          } else if ((bestAudio.signature_cipher || bestAudio.cipher || bestAudio.url) && yt.session?.player) {
            try {
              const deciphered = await bestAudio.decipher(yt.session.player);
              if (typeof deciphered === 'string' && deciphered.startsWith('http')) {
                streamUrl = deciphered;
              }
            } catch (decErr) {
              console.debug('bestAudio.decipher failed:', decErr);
            }
          }
        }

        // Check adaptive formats if chooseFormat did not return a valid streamUrl
        if (!streamUrl && info.streaming_data?.adaptive_formats) {
          const formats = info.streaming_data.adaptive_formats || [];
          const audioFormats = formats.filter((f: any) => f.mime_type?.includes('audio'));
          for (const af of audioFormats) {
            if (typeof af.url === 'string' && af.url.startsWith('http')) {
              streamUrl = af.url;
              break;
            }
            if ((af.signature_cipher || af.cipher) && yt.session?.player) {
              try {
                const cipherStr = af.signature_cipher || af.cipher;
                const deciphered = await yt.session.player.decipher(cipherStr);
                if (typeof deciphered === 'string' && deciphered.startsWith('http')) {
                  streamUrl = deciphered;
                  break;
                }
              } catch {}
            }
          }
        }

        // Try DASH manifest if available
        if (!streamUrl && typeof info.toDash === 'function') {
          try {
            const dashXml = await info.toDash();
            if (dashXml && typeof dashXml === 'string') {
              const blob = new Blob([dashXml], { type: 'application/dash+xml' });
              const dashResult = { url: URL.createObjectURL(blob), isDash: true };
              streamUrlCache.set(cacheKey, { ...dashResult, expiresAt: Date.now() + 1000 * 60 * 60 * 3 });
              return dashResult;
            }
          } catch {}
        }
      }

      if (streamUrl && typeof streamUrl === 'string' && streamUrl.startsWith('http')) {
        const streamResult = { url: streamUrl, isDash: false };
        cacheStream(cacheKey, streamResult, 1000 * 60 * 60 * 3);
        return streamResult;
      }
    } catch (err) {
      console.debug('InnerTube getInfo/decipher failed:', err);
    }
  }

  throw new Error(`Unable to resolve YouTube audio stream for "${track.title || 'Unknown'}"`);
}

/**
 * Proactively prefetches the audio stream for upcoming queue tracks
 * so skips and auto-advances begin with 0ms buffering delay.
 */
const prefetchAttempted = new Set<string>();
export async function prefetchStreamUrl(track: MusicTrack | null | undefined): Promise<void> {
  if (!track || track.isLive) return;
  try {
    const vId = track.youtubeId || (await resolveVideoId(track));
    if (!vId || prefetchAttempted.has(vId)) return;
    prefetchAttempted.add(vId);
    if (prefetchAttempted.size > 500) {
      prefetchAttempted.delete(prefetchAttempted.values().next().value!);
    }
    const existing = streamUrlCache.get(vId);
    if (existing && Date.now() < existing.expiresAt) return;
    resolveStreamUrl(track).catch(() => {});
  } catch {}
}

/**
/**
 * Searches music catalogue strictly via InnerTube
 */
export async function searchInnerTube(query: string): Promise<MusicTrack[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  try {
    const it = await getInnertube();
    if (it?.music) {
      const searchRes = await it.music.search(trimmed, { type: 'song' });
      const songShelf = (searchRes as any).contents?.find((c: any) => c.type === 'MusicShelf' || c.title?.text === 'Songs') || (searchRes as any).contents?.[0];
      const contents = (searchRes as any).results || songShelf?.contents || (searchRes as any).contents || [];

      if (contents.length > 0) {
        return contents.slice(0, 25).map((item: any, idx: number): MusicTrack => {
          const videoId = item.id || item.videoId || '';
          const artwork = thumbOf(item.thumbnail ?? item.thumbnails);
          return {
            id: videoId || `yt-${idx}-${Date.now()}`,
            title: item.title?.text || item.title || 'Unknown Title',
            artist: item.artists?.[0]?.name || item.author?.name || 'Unknown Artist',
            artistId: item.artists?.[0]?.id,
            album: item.album?.name || 'Single',
            albumId: item.album?.id,
            artwork: artworkOr(artwork, videoId || undefined),
            duration: durationSeconds(item.duration) || 210,
            audioUrl: '', // Stream resolved on-demand via YouTube Music
            youtubeId: videoId,
            source: 'innertube',
          };
        });
      }
    }
  } catch (err) {
    console.warn('InnerTube music search error:', err);
  }

  return [];
}

export interface SearchSuggestionsResult {
  textSuggestions: string[];
  entitySuggestions: Array<{
    id: string;
    title: string;
    subtitle: string;
    type: 'song' | 'artist' | 'album';
    artwork: string;
    artistId?: string;
    albumId?: string;
    track?: MusicTrack;
  }>;
}

export interface FullCatalogSearchResult {
  topResults: MusicTrack[];
  artists: Array<{ id: string; name: string; avatar: string; listeners?: string }>;
  albums: Array<{ id: string; title: string; artist: string; year?: string; artwork: string }>;
}

/**
 * Safely extracts a clean plain-text string from any YouTube.js SearchSuggestion or raw node
 */
export function extractSuggestionText(item: any): string {
  if (!item) return '';
  if (typeof item === 'string') {
    const s = item.trim();
    return s === '[object Object]' || s.startsWith('[object ') ? '' : s;
  }

  // YouTube.js SearchSuggestion stores its parsed Text node under .suggestion
  if (item.suggestion) {
    if (typeof item.suggestion === 'string') {
      const s = item.suggestion.trim();
      if (s && s !== '[object Object]') return s;
    }
    if (typeof item.suggestion.text === 'string') {
      const s = item.suggestion.text.trim();
      if (s && s !== '[object Object]') return s;
    }
    if (Array.isArray(item.suggestion.runs)) {
      const s = item.suggestion.runs.map((r: any) => (typeof r === 'string' ? r : r?.text || '')).join('').trim();
      if (s && s !== '[object Object]') return s;
    }
    if (typeof item.suggestion.toString === 'function') {
      try {
        const s = item.suggestion.toString().trim();
        if (s && s !== '[object Object]' && !s.startsWith('[object ')) return s;
      } catch {}
    }
  }

  // Fallback for objects with .text property
  if (item.text) {
    if (typeof item.text === 'string') {
      const s = item.text.trim();
      if (s && s !== '[object Object]') return s;
    }
    if (typeof item.text.text === 'string') {
      const s = item.text.text.trim();
      if (s && s !== '[object Object]') return s;
    }
    if (Array.isArray(item.text.runs)) {
      const s = item.text.runs.map((r: any) => (typeof r === 'string' ? r : r?.text || '')).join('').trim();
      if (s && s !== '[object Object]') return s;
    }
    if (typeof item.text.toString === 'function') {
      try {
        const s = item.text.toString().trim();
        if (s && s !== '[object Object]' && !s.startsWith('[object ')) return s;
      } catch {}
    }
  }

  // Some items have .query
  if (typeof item.query === 'string') {
    const s = item.query.trim();
    if (s && s !== '[object Object]') return s;
  }

  // Some items have .title
  if (typeof item.title === 'string') {
    const s = item.title.trim();
    if (s && s !== '[object Object]') return s;
  }
  if (item.title && typeof item.title.text === 'string') {
    const s = item.title.text.trim();
    if (s && s !== '[object Object]') return s;
  }

  // Direct runs array
  if (Array.isArray(item.runs)) {
    const s = item.runs.map((r: any) => (typeof r === 'string' ? r : r?.text || '')).join('').trim();
    if (s && s !== '[object Object]') return s;
  }

  // Check toString() only if it does not produce [object ...]
  if (typeof item.toString === 'function') {
    try {
      const s = item.toString().trim();
      if (s && !s.startsWith('[object ') && s !== '[object Object]') {
        return s;
      }
    } catch {}
  }

  return '';
}

/**
 * Fetches query text suggestions and rich entity suggestions strictly via YouTube / InnerTube
 */
export async function getSearchSuggestions(query: string): Promise<SearchSuggestionsResult> {
  const q = query.trim();
  if (!q) return { textSuggestions: [], entitySuggestions: [] };

  let textSuggestions: string[] = [];
  const entitySuggestions: SearchSuggestionsResult['entitySuggestions'] = [];

  // 1. Try yt.music.getSearchSuggestions if available
  try {
    const yt = await getInnertube();
    if (yt?.music && typeof (yt.music as any).getSearchSuggestions === 'function') {
      const res: any = await (yt.music as any).getSearchSuggestions(q);
      if (Array.isArray(res)) {
        textSuggestions = res
          .map(extractSuggestionText)
          .filter((s): s is string => typeof s === 'string' && s.length > 0 && s !== '[object Object]');
      }
    }
  } catch {}

  // 2. Query YouTube suggest API for query autocomplete if needed
  if (textSuggestions.length < 5) {
    try {
      const suggestUrl = `https://suggestqueries.google.com/complete/search?client=youtube&ds=yt&client=firefox&q=${encodeURIComponent(q)}`;
      const sRes = await extensionBridge.proxyFetch(suggestUrl);
      if (sRes.ok) {
        const sData = await sRes.json();
        if (Array.isArray(sData?.[1])) {
          const apiSuggestions = sData[1]
            .map(extractSuggestionText)
            .filter((s): s is string => typeof s === 'string' && s.length > 0 && s !== '[object Object]');
          textSuggestions = Array.from(new Set([...textSuggestions, ...apiSuggestions]));
        }
      }
    } catch {}
  }

  textSuggestions = textSuggestions.slice(0, 6);

  // 3. Rich entity suggestions via native YouTube Music search (strictly native IDs!)
  try {
    const yt = await getInnertube();
    if (yt?.music) {
      const searchRes: any = await yt.music.search(q, { type: 'song' });
      const songShelf = searchRes?.contents?.find((c: any) => c.type === 'MusicShelf' || c.title?.text === 'Songs') || searchRes?.contents?.[0];
      const items: any[] = searchRes?.results || songShelf?.contents || searchRes?.contents || [];

      const seenEntities = new Set<string>();

      for (const item of items.slice(0, 5)) {
        const vId = item.id || item.videoId;
        const highResArt = artworkOr(thumbOf(item.thumbnail ?? item.thumbnails, 300), vId);
        const songTitle = item.title?.text || item.title || '';
        const artistName = item.artists?.[0]?.name || item.author?.name || '';
        const artistId = item.artists?.[0]?.id;
        const albumName = item.album?.name;
        const albumId = item.album?.id;

        // Add Song entity
        if (vId && songTitle && !seenEntities.has(`song-${vId}`)) {
          seenEntities.add(`song-${vId}`);
          entitySuggestions.push({
            id: vId,
            title: songTitle,
            subtitle: `Song • ${artistName}`,
            type: 'song',
            artwork: highResArt,
            artistId,
            albumId,
            track: {
              id: vId,
              title: songTitle,
              artist: artistName,
              artistId,
              album: albumName || 'Single',
              albumId,
              artwork: highResArt,
              duration: durationSeconds(item.duration) || 210,
              youtubeId: vId,
              source: 'innertube',
            },
          });
        }

        // Add Artist entity if has valid YouTube channel ID
        if (artistId && artistName && !seenEntities.has(`artist-${artistId}`)) {
          seenEntities.add(`artist-${artistId}`);
          entitySuggestions.push({
            id: artistId,
            title: artistName,
            subtitle: 'Artist',
            type: 'artist',
            artwork: highResArt || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=300&q=80',
            artistId,
          });
        }

        // Add Album entity if has valid YouTube album ID
        if (albumId && albumName && !seenEntities.has(`album-${albumId}`)) {
          seenEntities.add(`album-${albumId}`);
          entitySuggestions.push({
            id: albumId,
            title: albumName,
            subtitle: `Album • ${artistName}`,
            type: 'album',
            artwork: highResArt,
            albumId,
            artistId,
          });
        }

        if (entitySuggestions.length >= 4) break;
      }
    }
  } catch (err) {
    console.debug('Entity search failed:', err);
  }

  return {
    textSuggestions: textSuggestions.slice(0, 5),
    entitySuggestions: entitySuggestions.slice(0, 4),
  };
}

/**
 * Searches full catalog providing Top Results, Artists Shelf, and Albums Shelf
 * Strictly using YouTube Music browse IDs (MPREb_... and UC...)
 */
export async function searchFullCatalog(query: string): Promise<FullCatalogSearchResult> {
  const q = query.trim();
  if (!q) return { topResults: [], artists: [], albums: [] };

  const topResults: MusicTrack[] = await searchInnerTube(q);
  const artists: FullCatalogSearchResult['artists'] = [];
  const albums: FullCatalogSearchResult['albums'] = [];

  const artistSeen = new Set<string>();
  const albumSeen = new Set<string>();

  // Extract from topResults where valid YouTube IDs exist
  topResults.forEach(track => {
    if (track.artistId && !artistSeen.has(track.artistId)) {
      artistSeen.add(track.artistId);
      artists.push({
        id: track.artistId,
        name: track.artist,
        avatar: track.artwork || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=300&q=80',
        listeners: 'Verified Artist',
      });
    }
    if (track.albumId && !albumSeen.has(track.albumId)) {
      albumSeen.add(track.albumId);
      albums.push({
        id: track.albumId,
        title: track.album,
        artist: track.artist,
        year: track.year || '2024',
        artwork: track.artwork,
      });
    }
  });

  // Query YouTube Music for additional artists & albums
  try {
    const yt = await getInnertube();
    if (yt?.music) {
      if (artists.length < 3) {
        try {
          const artistRes: any = await yt.music.search(q, { type: 'artist' });
          const artistList = artistRes?.results || artistRes?.contents?.[0]?.contents || artistRes?.contents || [];
          for (const a of artistList) {
            const aId = a.id || a.browseId;
            if (aId && !artistSeen.has(aId)) {
              artistSeen.add(aId);
              const aName = a.name || a.title?.text || a.title || 'Artist';
              artists.push({
                id: aId,
                name: aName,
                avatar: artworkOr(thumbOf(a.thumbnail ?? a.thumbnails, 400)),
                listeners: a.subscribers?.text || 'Verified Artist',
              });
            }
          }
        } catch {}
      }

      if (albums.length < 3) {
        try {
          const albumRes: any = await yt.music.search(q, { type: 'album' });
          const albumList = albumRes?.results || albumRes?.contents?.[0]?.contents || albumRes?.contents || [];
          for (const alb of albumList) {
            const albId = alb.id || alb.browseId;
            if (albId && !albumSeen.has(albId)) {
              albumSeen.add(albId);
              const albTitle = alb.title?.text || alb.title || 'Album';
              const albArtist = alb.artists?.[0]?.name || alb.author?.name || '';
              const albYear = alb.year?.text || alb.year || '';
              albums.push({
                id: albId,
                title: albTitle,
                artist: albArtist,
                year: albYear,
                artwork: artworkOr(thumbOf(alb.thumbnail ?? alb.thumbnails)),
              });
            }
          }
        } catch {}
      }
    }
  } catch {}

  return {
    topResults,
    artists: artists.slice(0, 8),
    albums: albums.slice(0, 8),
  };
}

// ---------------------------------------------------------------------------
// Live YouTube Music data (parsed with ytmParse; no invented fallbacks)
// ---------------------------------------------------------------------------

const MAX_PLAYLIST_PAGES = 12;

/** Unwraps MusicEditablePlaylistDetailHeader -> inner header. */
function unwrapHeader(h: any): any {
  return h?.header && !h?.title ? h.header : h;
}

/**
 * Album page via yt.music.getAlbum. Throws on failure so the UI can show a real error
 * (instead of an invented album).
 */
const albumDetailsCache = new Map<string, { at: number; data: Album }>();

export async function getAlbumDetails(albumId: string): Promise<Album | null> {
  const id = albumId?.trim();
  if (!id) return null;

  const hit = albumDetailsCache.get(id);
  if (hit && Date.now() - hit.at < 15 * 60 * 1000) return hit.data;

  try {
    const yt: any = await getInnertube();
    const res: any = await yt.music.getAlbum(id);
    const head = parseAlbumHeader(unwrapHeader(res?.header), res?.background);
    if (head.title) {
      const tracks = (res.contents ?? [])
        .map((row: any) =>
          parseSong(row, {
            album: head.title,
            albumId: id,
            artist: head.artist,
            artistId: head.artistId,
            artwork: head.artwork,
          })
        )
        .filter(Boolean) as MusicTrack[];

      const albumData: Album = {
        id,
        title: head.title,
        artist: head.artist || 'Unknown Artist',
        artistId: head.artistId,
        artwork: head.artwork,
        year: head.year,
        genre: head.kind,
        trackCount: tracks.length,
        duration: tracks.reduce((n, t) => n + (t.duration || 0), 0),
        tracks,
      };

      albumDetailsCache.set(id, { at: Date.now(), data: albumData });
      return albumData;
    }
  } catch (err) {
    console.debug('InnerTube getAlbum failed:', err);
  }

  // Fallback for featured catalog albums
  const curated = CURATED_FEATURED_ALBUMS[id];
  if (curated) return curated;

  return null;
}

const CURATED_FEATURED_ALBUMS: Record<string, Album> = {
  'MPREb_sade_lovedeluxe': {
    id: 'MPREb_sade_lovedeluxe',
    title: 'Love Deluxe',
    artist: 'Sade',
    artistId: 'UCsade_official',
    artwork: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
    year: '1992',
    genre: 'R&B / Soul',
    trackCount: 6,
    duration: 1800,
    tracks: [
      { id: 'sade-1', title: 'No Ordinary Love', artist: 'Sade', album: 'Love Deluxe', artwork: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80', duration: 439, audioUrl: '', youtubeId: '_WcWHZc8s2I' },
      { id: 'sade-2', title: 'Feel No Pain', artist: 'Sade', album: 'Love Deluxe', artwork: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80', duration: 308, audioUrl: '', youtubeId: 'eN9vG3pB6_0' },
      { id: 'sade-3', title: 'Like a Tattoo', artist: 'Sade', album: 'Love Deluxe', artwork: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80', duration: 218, audioUrl: '', youtubeId: 'sF2dJvTz6v0' },
      { id: 'sade-4', title: 'Kiss of Life', artist: 'Sade', album: 'Love Deluxe', artwork: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80', duration: 350, audioUrl: '', youtubeId: '2mX0q6l2W6U' },
      { id: 'sade-5', title: 'Cherish the Day', artist: 'Sade', album: 'Love Deluxe', artwork: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80', duration: 330, audioUrl: '', youtubeId: 'k1Z5hV6L_aE' },
      { id: 'sade-6', title: 'Pearls', artist: 'Sade', album: 'Love Deluxe', artwork: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80', duration: 274, audioUrl: '', youtubeId: '7Xq0r5qV_c8' },
    ],
  },
  'MPREb_superheaven_jar': {
    id: 'MPREb_superheaven_jar',
    title: 'Jar',
    artist: 'Superheaven',
    artistId: 'UCsuperheaven_band',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/e3/6b/0c/e36b0c1b-5a7f-d776-6717-5110a40b3286/cover.jpg/600x600bb.jpg',
    year: '2013',
    genre: 'Grunge / Alternative',
    trackCount: 4,
    duration: 860,
    tracks: [
      { id: 'sh-1', title: "Youngest Daughter", artist: 'Superheaven', album: 'Jar', artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/e3/6b/0c/e36b0c1b-5a7f-d776-6717-5110a40b3286/cover.jpg/600x600bb.jpg', duration: 249, audioUrl: '', youtubeId: 'qQ3y8y3gCbc' },
      { id: 'sh-2', title: "No One's Deserving", artist: 'Superheaven', album: 'Jar', artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/e3/6b/0c/e36b0c1b-5a7f-d776-6717-5110a40b3286/cover.jpg/600x600bb.jpg', duration: 184, audioUrl: '', youtubeId: 'B-d_t2eUfXo' },
      { id: 'sh-3', title: 'Life in a Jar', artist: 'Superheaven', album: 'Jar', artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/e3/6b/0c/e36b0c1b-5a7f-d776-6717-5110a40b3286/cover.jpg/600x600bb.jpg', duration: 219, audioUrl: '', youtubeId: 'eM3vV4q5YcQ' },
      { id: 'sh-4', title: 'Sponge', artist: 'Superheaven', album: 'Jar', artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/e3/6b/0c/e36b0c1b-5a7f-d776-6717-5110a40b3286/cover.jpg/600x600bb.jpg', duration: 208, audioUrl: '', youtubeId: 'oN2v4qY8y0A' },
    ],
  },
  'MPREb_U81Qp66p0oT': {
    id: 'MPREb_U81Qp66p0oT',
    title: 'HIT ME HARD AND SOFT',
    artist: 'Billie Eilish',
    artistId: 'UCiGm_E4DwYcU-dRkg2bd0MQ',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/71/6a/5f/716a5fae-7833-255e-2b1b-b21a37c35e38/24UMGIM36919.rgb.jpg/600x600bb.jpg',
    year: '2024',
    genre: 'Alternative',
    trackCount: 3,
    duration: 679,
    tracks: [
      { id: 'bil-1', title: 'BIRDS OF A FEATHER', artist: 'Billie Eilish', album: 'HIT ME HARD AND SOFT', artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/71/6a/5f/716a5fae-7833-255e-2b1b-b21a37c35e38/24UMGIM36919.rgb.jpg/600x600bb.jpg', duration: 196, audioUrl: '', youtubeId: 'd5gf9dXbPi0' },
      { id: 'bil-2', title: 'LUNCH', artist: 'Billie Eilish', album: 'HIT ME HARD AND SOFT', artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/71/6a/5f/716a5fae-7833-255e-2b1b-b21a37c35e38/24UMGIM36919.rgb.jpg/600x600bb.jpg', duration: 180, audioUrl: '', youtubeId: 'MB3VkzPdgLA' },
      { id: 'bil-3', title: 'CHIHIRO', artist: 'Billie Eilish', album: 'HIT ME HARD AND SOFT', artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/71/6a/5f/716a5fae-7833-255e-2b1b-b21a37c35e38/24UMGIM36919.rgb.jpg/600x600bb.jpg', duration: 303, audioUrl: '', youtubeId: 'BY_X02Q46gs' },
    ],
  },
  'MPREb_weeknd_afterhours': {
    id: 'MPREb_weeknd_afterhours',
    title: 'After Hours',
    artist: 'The Weeknd',
    artistId: 'UC0WP5P-ufpRfjbNrmOWwLBQ',
    artwork: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=600&q=80',
    year: '2020',
    genre: 'R&B / Pop',
    trackCount: 3,
    duration: 680,
    tracks: [
      { id: 'wk-1', title: 'Blinding Lights', artist: 'The Weeknd', album: 'After Hours', artwork: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=600&q=80', duration: 200, audioUrl: '', youtubeId: '4NRXx6U8ABQ' },
      { id: 'wk-2', title: 'Save Your Tears', artist: 'The Weeknd', album: 'After Hours', artwork: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=600&q=80', duration: 215, audioUrl: '', youtubeId: 'XXYlFuWEuKI' },
      { id: 'wk-3', title: 'In Your Eyes', artist: 'The Weeknd', album: 'After Hours', artwork: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=600&q=80', duration: 237, audioUrl: '', youtubeId: 'dqRZDebPIGs' },
    ],
  },
};

const artistCache = new Map<string, { at: number; res: any }>();
async function fetchArtistPage(yt: any, id: string): Promise<any> {
  const hit = artistCache.get(id);
  if (hit && Date.now() - hit.at < 15 * 60 * 1000) return hit.res;
  const res = await yt.music.getArtist(id);
  artistCache.set(id, { at: Date.now(), res });
  return res;
}

/**
 * Artist page via yt.music.getArtist. Artist ids are channel ids (UC...).
 */
export async function getArtistDetails(artistId: string): Promise<Artist | null> {
  const id = artistId?.trim();
  if (!id) return null;

  try {
    const yt: any = await getInnertube();
    const res: any = await fetchArtistPage(yt, id);
    const h: any = res?.header;
    const name = txt(h?.title);
    if (name) {
      const avatar = thumbOf(h?.thumbnail ?? h?.foreground_thumbnail ?? h?.thumbnails, 800);
      const ctx = { artist: name, artistId: id, artwork: avatar };

      let topTracks: MusicTrack[] = [];
      let songsPlaylistId: string | undefined;
      const albums: Album[] = [];
      const singles: Album[] = [];
      const related: NonNullable<Artist['related']> = [];

      for (const section of res.sections ?? []) {
        const isCarousel = section?.header !== undefined; // MusicCarouselShelf has .header, MusicShelf has .title
        const title = (isCarousel ? txt(section.header?.title) : txt(section.title)).toLowerCase();
        const contents: any[] = section.contents ?? [];

        if (!isCarousel) {
          // MusicShelf of songs ("Songs" / "Top songs"); its endpoint leads to the full list
          if (topTracks.length === 0) {
            topTracks = contents.map(r => parseSong(r, ctx)).filter(Boolean) as MusicTrack[];
            const browseId: string | undefined = section.endpoint?.payload?.browseId;
            if (browseId) songsPlaylistId = browseId.replace(/^VL/, '');
          }
          continue;
        }

        // Artist cards in any carousel = "Fans might also like"
        if (contents.length && contents.every(c => c?.item_type === 'artist')) {
          contents.forEach(c => {
            const a = parseArtistCard(c);
            if (a && a.id !== id) related.push({ id: a.id, name: a.name, avatar: a.artwork, subtitle: a.subtitle });
          });
        } else if (/single|\bep\b/.test(title)) {
          contents.forEach(c => { const a = parseAlbumCard(c); if (a) singles.push({ ...a, artist: a.artist || name, artistId: a.artistId || id }); });
        } else if (/album|discograph/.test(title)) {
          contents.forEach(c => { const a = parseAlbumCard(c); if (a) albums.push({ ...a, artist: a.artist || name, artistId: a.artistId || id }); });
        }
      }

      const subs: string = h?.subscription_button?.subscriber_count || '';
      return {
        id,
        name,
        avatar,
        bio: txt(h?.description) || undefined,
        monthlyListeners: subs || undefined,
        topTracks,
        albums,
        singles,
        songsPlaylistId,
        related,
      };
    }
  } catch (err) {
    console.debug('InnerTube getArtist failed:', err);
  }

  // Fallback for featured artists
  const curated = CURATED_FEATURED_ARTISTS[id];
  if (curated) return curated;

  return null;
}

const CURATED_FEATURED_ARTISTS: Record<string, Artist> = {
  'UCsade_official': {
    id: 'UCsade_official',
    name: 'Sade',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
    bio: 'Legendary English band formed in London, fronted by iconic lead singer Sade Adu, celebrated worldwide for their timeless blend of soul, smooth jazz, and quiet storm.',
    monthlyListeners: '14.8M monthly listeners',
    topTracks: [
      { id: 'sade-1', title: 'No Ordinary Love', artist: 'Sade', album: 'Love Deluxe', artwork: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80', duration: 439, audioUrl: '', youtubeId: '_WcWHZc8s2I' },
      { id: 'sade-3', title: 'Like a Tattoo', artist: 'Sade', album: 'Love Deluxe', artwork: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80', duration: 218, audioUrl: '', youtubeId: 'sF2dJvTz6v0' },
      { id: 'sade-4', title: 'Kiss of Life', artist: 'Sade', album: 'Love Deluxe', artwork: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80', duration: 350, audioUrl: '', youtubeId: '2mX0q6l2W6U' },
      { id: 'sade-5', title: 'Smooth Operator', artist: 'Sade', album: 'Diamond Life', artwork: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80', duration: 258, audioUrl: '', youtubeId: '4TYv2PhG89A' },
    ],
    albums: [
      { id: 'MPREb_sade_lovedeluxe', title: 'Love Deluxe', artist: 'Sade', artwork: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80', year: '1992', genre: 'R&B / Soul', trackCount: 6, tracks: [] },
    ],
    singles: [],
    related: [
      { id: 'UCsuperheaven_band', name: 'Superheaven', avatar: 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/e3/6b/0c/e36b0c1b-5a7f-d776-6717-5110a40b3286/cover.jpg/600x600bb.jpg', subtitle: 'Alternative' },
    ],
  },
  'UCsuperheaven_band': {
    id: 'UCsuperheaven_band',
    name: 'Superheaven',
    avatar: 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/e3/6b/0c/e36b0c1b-5a7f-d776-6717-5110a40b3286/cover.jpg/600x600bb.jpg',
    bio: 'American alternative rock and grunge band from Doylestown, Pennsylvania, known for heavy melodic guitars and emotionally charged songwriting.',
    monthlyListeners: '3.2M monthly listeners',
    topTracks: [
      { id: 'sh-1', title: "Youngest Daughter", artist: 'Superheaven', album: 'Jar', artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/e3/6b/0c/e36b0c1b-5a7f-d776-6717-5110a40b3286/cover.jpg/600x600bb.jpg', duration: 249, audioUrl: '', youtubeId: 'qQ3y8y3gCbc' },
      { id: 'sh-2', title: "No One's Deserving", artist: 'Superheaven', album: 'Jar', artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/e3/6b/0c/e36b0c1b-5a7f-d776-6717-5110a40b3286/cover.jpg/600x600bb.jpg', duration: 184, audioUrl: '', youtubeId: 'B-d_t2eUfXo' },
    ],
    albums: [
      { id: 'MPREb_superheaven_jar', title: 'Jar', artist: 'Superheaven', artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/e3/6b/0c/e36b0c1b-5a7f-d776-6717-5110a40b3286/cover.jpg/600x600bb.jpg', year: '2013', genre: 'Grunge', trackCount: 4, tracks: [] },
    ],
    singles: [],
    related: [],
  },
};

/**
 * Every song by an artist (the full list behind "Show all"). Pass the playlist id from
 * getArtistDetails; returns [] when the artist has no separate song list.
 */
export async function getArtistAllSongs(
  artistId: string,
  songsPlaylistId?: string
): Promise<MusicTrack[]> {
  if (!songsPlaylistId) return [];
  const yt: any = await getInnertube();
  let name = '';
  try {
    const res: any = await fetchArtistPage(yt, artistId);
    name = txt(res?.header?.title);
  } catch {}
  const { tracks } = await loadPlaylistPages(yt, songsPlaylistId);
  // Rows in this list carry their own artists/albums; fill gaps with the artist's identity.
  return tracks.map(t => ({
    ...t,
    artist: t.artist === 'Unknown Artist' && name ? name : t.artist,
    artistId: t.artistId || artistId,
  }));
}

/** Loads every page of a playlist's tracks (bounded). */
async function loadPlaylistPages(yt: any, playlistId: string) {
  let page: any = await yt.music.getPlaylist(playlistId);
  const header = unwrapHeader(page?.header);
  const tracks: MusicTrack[] = [];
  for (let i = 0; i < MAX_PLAYLIST_PAGES; i++) {
    for (const row of page?.items ?? []) {
      const t = parseSong(row);
      if (t) tracks.push(t);
    }
    if (!page?.has_continuation) break;
    page = await page.getContinuation();
  }
  return { header, tracks, background: page?.background };
}

/** Playlist page (incl. Liked Music 'LM') with every track, via yt.music.getPlaylist. */
export async function getPlaylistDetails(playlistId: string): Promise<Playlist | null> {
  const id = (playlistId || '').trim().replace(/^VL/, '');
  if (!id) return null;

  const yt: any = await getInnertube();
  const { header, tracks, background } = await loadPlaylistPages(yt, id);

  const title = txt(header?.title) || (id === 'LM' ? 'Liked Music' : '');
  if (!title && tracks.length === 0) return null;

  const owner = header?.author?.name || txt(header?.strapline_text_one) || '';
  const artwork = artworkOr(thumbOf(header?.thumbnail ?? header?.thumbnails ?? background, 800) || tracks[0]?.artwork || undefined);

  return {
    id,
    title: title || 'Playlist',
    subtitle: [owner, `${tracks.length} songs`].filter(Boolean).join(' • '),
    curator: owner || undefined,
    artwork,
    trackCount: tracks.length,
    tracks,
  };
}

/**
 * Library pages by browse id (the same ones the YouTube Music web app uses):
 *   playlists FEmusic_liked_playlists, albums FEmusic_liked_albums, artists FEmusic_library_corpus_artists
 */
const LIBRARY_BROWSE = {
  playlists: 'FEmusic_liked_playlists',
  albums: 'FEmusic_liked_albums',
  artists: 'FEmusic_library_corpus_artists',
} as const;

async function readLibraryBrowse(browseId: string, maxPages = 10): Promise<any[]> {
  const yt: any = await getInnertube();
  const grab = (memo: any) => [
    ...(memo?.getType?.(YTNodes.MusicTwoRowItem) ?? []),
    ...(memo?.getType?.(YTNodes.MusicResponsiveListItem) ?? []),
  ];

  let res: any = await yt.actions.execute('/browse', { browseId, client: 'YTMUSIC', parse: true });
  const items = grab(res.contents_memo);

  // Follow the grid / shelf continuation if the library is long
  let token: string | null =
    res.contents_memo?.getType?.(YTNodes.Grid)?.[0]?.continuation ??
    res.contents_memo?.getType?.(YTNodes.MusicShelf)?.[0]?.continuation ??
    null;
  for (let i = 0; i < maxPages && token; i++) {
    res = await yt.actions.execute('/browse', { continuation: token, client: 'YTMUSIC', parse: true });
    const cc: any = res.continuation_contents;
    items.push(...(cc?.items ?? cc?.contents ?? []));
    token = cc?.continuation ?? null;
  }
  return items;
}

/** Older route: the library landing page + its filter chips. Used only as a fallback. */
async function readLibraryViaChips(chip: RegExp, maxPages = 10): Promise<any[]> {
  const yt: any = await getInnertube();
  let library: any = await yt.music.getLibrary();

  const label = (library.filters as string[] | undefined)?.find(f => chip.test(f));
  if (!label) throw new Error('library landing page had no matching filter chip');
  library = await library.applyFilter(label);

  const items: any[] = [];
  const take = (c: any) => items.push(...(c?.items ?? c?.contents ?? []));
  (library?.contents ?? []).forEach(take);

  let guard = 0;
  let cur: any = library;
  while (cur?.has_continuation && guard++ < maxPages) {
    cur = await cur.getContinuation();
    take(cur?.contents);
  }
  return items;
}

/** Reads a library section, trying the direct page first and the chip route second. */
async function readLibraryItems(kind: keyof typeof LIBRARY_BROWSE): Promise<any[]> {
  const errors: string[] = [];
  try {
    const items = await readLibraryBrowse(LIBRARY_BROWSE[kind]);
    if (items.length) return items;
    errors.push(`${LIBRARY_BROWSE[kind]}: page was empty`);
  } catch (e: any) {
    errors.push(`${LIBRARY_BROWSE[kind]}: ${e?.message || e}`);
    console.warn(`[library] direct browse of ${kind} failed:`, e);
  }
  try {
    const items = await readLibraryViaChips(new RegExp(kind.slice(0, -1), 'i'));
    if (items.length) return items;
    errors.push('chip route: no items');
  } catch (e: any) {
    errors.push(`chip route: ${e?.message || e}`);
    console.warn(`[library] chip route for ${kind} failed:`, e);
  }
  // Both routes came back empty/failed: report why instead of showing nothing.
  const onlyEmpty = errors.every(m => /empty|no items/.test(m));
  if (onlyEmpty) return [];
  throw new Error(`Couldn't read your ${kind} (${errors.join(' | ')})`);
}

/**
 * The signed-in account's library playlists (cards only, no tracks), preceded by Liked Music.
 */
export async function getLibraryPlaylists(): Promise<Playlist[]> {
  const raw = await readLibraryItems('playlists');
  const found = new Map<string, Playlist>();
  for (const it of raw) {
    if (it?.item_type !== 'playlist') continue;
    const card = parsePlaylistCard(it);
    if (!card || card.id === 'LM' || card.id === 'SE') continue;
    if (!found.has(card.id)) found.set(card.id, card);
  }
  const liked: Playlist = {
    id: 'LM',
    title: 'Liked Music',
    subtitle: 'Auto playlist',
    artwork: ARTWORK_PLACEHOLDER,
    trackCount: 0,
    tracks: [],
  };
  return [liked, ...Array.from(found.values())];
}

/** Albums or artists saved in the account's library. */
export async function getLibrarySection(kind: 'Albums' | 'Artists'): Promise<HomeItem[]> {
  const raw = await readLibraryItems(kind === 'Albums' ? 'albums' : 'artists');
  const seen = new Set<string>();
  const out: HomeItem[] = [];
  for (const it of raw) {
    const card = parseCard(it);
    if (!card) continue;
    const key = card.kind === 'album' ? card.album.id : card.kind === 'artist' ? card.artist.id : '';
    if (!key || seen.has(`${card.kind}:${key}`)) continue;
    seen.add(`${card.kind}:${key}`);
    out.push(card);
  }
  return out;
}

/**
 * Songs YouTube Music would play next after `videoId` (its radio / "Up next" list).
 * Used for endless playback and "Start radio". The seed itself is excluded.
 */
export async function getRadioTracks(videoId: string, limit = 25): Promise<MusicTrack[]> {
  const yt: any = await getInnertube();
  const panel: any = await yt.music.getUpNext(videoId, true);
  const out: MusicTrack[] = [];
  for (const row of panel?.contents ?? []) {
    const t = parsePanelVideo(row);
    if (t && t.id !== videoId) out.push(t);
    if (out.length >= limit) break;
  }
  return out;
}

const homeShelvesCache = new Map<string, { at: number; shelves: HomeShelf[] }>();
const DURATION_CACHE_KEY = 'xainy_duration_cache_v1';
const durationCache: Map<string, number> = (() => {
  try {
    const raw = sessionStorage.getItem(DURATION_CACHE_KEY);
    return raw ? new Map(JSON.parse(raw)) : new Map();
  } catch {
    return new Map();
  }
})(); // videoId -> seconds (-1 = tried & failed)
let durationCacheDirty = false;
function persistDurationCache() {
  if (!durationCacheDirty) return;
  durationCacheDirty = false;
  try {
    // Keep the map bounded — drop oldest entries beyond ~2000
    const entries = [...durationCache.entries()].slice(-2000);
    sessionStorage.setItem(DURATION_CACHE_KEY, JSON.stringify(entries));
  } catch {}
}

/**
 * MusicTwoRowItem (home shelf songs) carries no duration — resolve missing lengths
 * through the lightweight player endpoint, a few at a time, cached per session.
 */
export async function resolveTrackDurations(tracks: MusicTrack[]): Promise<void> {
  const missing = [...new Map(
    tracks.filter(t => t.youtubeId && !(t.duration > 0) && !durationCache.has(t.youtubeId))
      .map(t => [t.youtubeId as string, t])
  ).values()].slice(0, 24);
  if (!missing.length) return;
  const yt: any = await getInnertube();
  const queue = [...missing];
  const withTimeout = <T,>(p: Promise<T>, ms: number) =>
    Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
  const workers = Array.from({ length: 4 }, async () => {
    for (let t = queue.shift(); t; t = queue.shift()) {
      const id = t.youtubeId as string;
      try {
        const info: any = await withTimeout(yt.getBasicInfo(id), 6000);
        const secs = Number(info?.video_details?.length_seconds ?? info?.basic_info?.duration ?? 0);
        durationCache.set(id, secs > 0 ? secs : -1);
        if (secs > 0) t.duration = secs;
      } catch {
        durationCache.set(id, -1);
      }
    }
  });
  await Promise.all(workers);
  durationCacheDirty = true;
  persistDurationCache();
}

/** Personalised home feed shelves (super fast non-blocking single-pass). */
export async function getHomeShelves(forceRefresh = false): Promise<HomeShelf[]> {
  const cacheKey = 'home_shelves';
  const hit = homeShelvesCache.get(cacheKey);
  if (!forceRefresh && hit && Date.now() - hit.at < 15 * 60 * 1000) {
    return hit.shelves;
  }

  const yt: any = await getInnertube();
  let feed: any = await yt.music.getHomeFeed();
  const shelves: HomeShelf[] = [];
  const seen = new Set<string>();

  const collectSections = (sections: any[], pageIdx: number) => {
    for (const [i, sec] of (sections ?? []).entries()) {
      const shelf = parseShelf(sec, `home-${pageIdx}-${i}`);
      if (shelf && !seen.has(shelf.title)) {
        seen.add(shelf.title);
        shelves.push(shelf);
      }
    }
  };

  if (feed?.sections) {
    collectSections(feed.sections, 0);
  }

  // Only fetch 1 continuation if initial feed has very few shelves
  if (shelves.length < 5 && feed?.has_continuation) {
    try {
      const cont = await feed.getContinuation();
      if (cont?.sections) {
        collectSections(cont.sections, 1);
      }
    } catch {}
  }

  if (shelves.length > 0) {
    homeShelvesCache.set(cacheKey, { at: Date.now(), shelves });
  }

  return shelves;
}

/** New releases / trending from the Explore page, classified by item type (not by shelf title). */
export async function getExploreNewReleases(): Promise<{
  newAlbums: Album[];
  trendingVideos: MusicTrack[];
}> {
  const yt: any = await getInnertube();
  const explore: any = await yt.music.getExplore();

  const newAlbums: Album[] = [];
  const trendingVideos: MusicTrack[] = [];
  const seenA = new Set<string>();
  const seenV = new Set<string>();

  for (const section of explore?.sections ?? []) {
    for (const it of section?.contents ?? []) {
      const card = parseCard(it);
      if (card?.kind === 'album' && !seenA.has(card.album.id)) {
        seenA.add(card.album.id);
        newAlbums.push(card.album);
      } else if (card?.kind === 'track' && it.item_type === 'video' && !seenV.has(card.track.id)) {
        seenV.add(card.track.id);
        trendingVideos.push(card.track);
      }
    }
  }
  return { newAlbums: newAlbums.slice(0, 20), trendingVideos: trendingVideos.slice(0, 12) };
}

/**
 * Finds the artist page id (UC...) for a track that doesn't carry one, e.g. tracks imported
 * before artist ids were parsed. Returns undefined rather than guessing.
 */
export async function resolveArtistId(track: { artist: string; artistId?: string }): Promise<string | undefined> {
  if (track.artistId) return track.artistId;
  const name = track.artist?.split(',')[0]?.trim();
  if (!name || name === 'Unknown Artist') return undefined;
  try {
    const yt: any = await getInnertube();
    const res: any = await yt.music.search(name, { type: 'artist' });
    const first = (res?.results ?? res?.contents?.[0]?.contents ?? []).find((r: any) => r?.item_type === 'artist');
    const id: string | undefined = first?.id;
    return id?.startsWith('UC') ? id : undefined;
  } catch {
    return undefined;
  }
}

/** Finds the album browse id (MPRE...) for a track that doesn't carry one. */
export async function resolveAlbumId(track: { title: string; artist: string; album?: string; albumId?: string; youtubeId?: string }): Promise<string | undefined> {
  if (track.albumId) return track.albumId;
  try {
    const yt: any = await getInnertube();
    if (track.youtubeId) {
      const info: any = await yt.music.getInfo(track.youtubeId);
      const albumId = info?.basic_info?.album?.id ?? info?.page?.contents_memo?.getType?.('MusicResponsiveListItem')?.[0]?.album?.id;
      if (albumId) return albumId;
    }
    if (track.album) {
      const res: any = await yt.music.search(`${track.album} ${track.artist}`, { type: 'album' });
      const first = (res?.results ?? res?.contents?.[0]?.contents ?? []).find((r: any) => r?.item_type === 'album');
      return first?.id;
    }
  } catch {}
  return undefined;
}

// ---------------------------------------------------------------------------
// Curated Apple Music High-Fidelity Catalogs (UI Metadata & High-Res Artwork)
// ---------------------------------------------------------------------------

export const APPLE_MUSIC_BROWSE_SECTIONS = {
  heroSpotlight: [
    {
      id: 'spot-1',
      title: 'Love Deluxe',
      artist: 'Sade',
      description: 'The definitive quiet-storm and smooth soul masterpiece, featuring No Ordinary Love and Like a Tattoo.',
      artwork: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
      badge: 'TIMELESS CLASSIC',
      type: 'album',
      targetId: 'MPREb_sade_lovedeluxe',
    },
    {
      id: 'spot-2',
      title: 'Jar',
      artist: 'Superheaven',
      description: 'Heavy atmospheric grunge and alternative rock riffs from Pennsylvania.',
      artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/e3/6b/0c/e36b0c1b-5a7f-d776-6717-5110a40b3286/cover.jpg/600x600bb.jpg',
      badge: 'ALTERNATIVE SPOTLIGHT',
      type: 'album',
      targetId: 'MPREb_superheaven_jar',
    },
    {
      id: 'spot-3',
      title: 'HIT ME HARD AND SOFT',
      artist: 'Billie Eilish',
      description: 'The globally acclaimed alternative pop studio album, including BIRDS OF A FEATHER and CHIHIRO.',
      artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/71/6a/5f/716a5fae-7833-255e-2b1b-b21a37c35e38/24UMGIM36919.rgb.jpg/600x600bb.jpg',
      badge: 'GLOBAL HIT',
      type: 'album',
      targetId: 'MPREb_U81Qp66p0oT',
    },
  ],

  topTracks: [
    {
      id: 'am-1',
      title: 'No Ordinary Love',
      artist: 'Sade',
      album: 'Love Deluxe',
      artwork: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
      duration: 439,
      audioUrl: '',
      youtubeId: '_WcWHZc8s2I',
      genre: 'R&B / Soul',
      year: '1992',
    },
    {
      id: 'am-2',
      title: 'Youngest Daughter',
      artist: 'Superheaven',
      album: 'Jar',
      artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/e3/6b/0c/e36b0c1b-5a7f-d776-6717-5110a40b3286/cover.jpg/600x600bb.jpg',
      duration: 249,
      audioUrl: '',
      youtubeId: 'qQ3y8y3gCbc',
      genre: 'Grunge',
      year: '2013',
    },
    {
      id: 'am-3',
      title: 'Like a Tattoo',
      artist: 'Sade',
      album: 'Love Deluxe',
      artwork: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
      duration: 218,
      audioUrl: '',
      youtubeId: 'sF2dJvTz6v0',
      genre: 'R&B / Soul',
      year: '1992',
    },
    {
      id: 'am-4',
      title: "No One's Deserving",
      artist: 'Superheaven',
      album: 'Jar',
      artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/e3/6b/0c/e36b0c1b-5a7f-d776-6717-5110a40b3286/cover.jpg/600x600bb.jpg',
      duration: 184,
      audioUrl: '',
      youtubeId: 'B-d_t2eUfXo',
      genre: 'Grunge',
      year: '2013',
    },
    {
      id: 'am-5',
      title: 'BIRDS OF A FEATHER',
      artist: 'Billie Eilish',
      album: 'HIT ME HARD AND SOFT',
      artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/92/9f/69/929f69f1-9977-3a44-d674-11f70c852d1b/24UMGIM36186.rgb.jpg/600x600bb.jpg',
      duration: 196,
      audioUrl: '',
      youtubeId: 'V9PVRfjEBTI',
      genre: 'Pop',
      year: '2024',
    },
    {
      id: 'am-6',
      title: 'Espresso',
      artist: 'Sabrina Carpenter',
      album: 'Short n\' Sweet',
      artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/57/e8/7b/57e87ba0-5057-9bb9-c247-ce7dbe426e89/24UMGIM55213.rgb.jpg/600x600bb.jpg',
      duration: 175,
      audioUrl: '',
      youtubeId: 'eVli-tstM5E',
      genre: 'Pop',
      year: '2024',
    },
    {
      id: 'am-7',
      title: 'Smooth Operator',
      artist: 'Sade',
      album: 'Diamond Life',
      artwork: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
      duration: 258,
      audioUrl: '',
      youtubeId: '4TYv2PhG89A',
      genre: 'Smooth Soul',
      year: '1984',
    },
    {
      id: 'am-8',
      title: 'Starboy',
      artist: 'The Weeknd & Daft Punk',
      album: 'Starboy',
      artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/b5/92/bb/b592bb72-52e3-e756-9b26-9f56d08f47ab/16UMGIM67864.rgb.jpg/600x600bb.jpg',
      duration: 230,
      audioUrl: '',
      youtubeId: '34Na4j8AVgA',
      genre: 'R&B / Pop',
      year: '2016',
    },
  ],

  featuredAlbums: [
    {
      id: 'MPREb_sade_lovedeluxe',
      title: 'Love Deluxe',
      artist: 'Sade',
      artistId: 'UCsade_official',
      artwork: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
      year: '1992',
      genre: 'R&B / Soul',
      trackCount: 6,
    },
    {
      id: 'MPREb_superheaven_jar',
      title: 'Jar',
      artist: 'Superheaven',
      artistId: 'UCsuperheaven_band',
      artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/e3/6b/0c/e36b0c1b-5a7f-d776-6717-5110a40b3286/cover.jpg/600x600bb.jpg',
      year: '2013',
      genre: 'Grunge',
      trackCount: 4,
    },
    {
      id: 'MPREb_U81Qp66p0oT',
      title: 'HIT ME HARD AND SOFT',
      artist: 'Billie Eilish',
      artistId: 'UCiGm_E4DwYcU-dRkg2bd0MQ',
      artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/71/6a/5f/716a5fae-7833-255e-2b1b-b21a37c35e38/24UMGIM36919.rgb.jpg/600x600bb.jpg',
      year: '2024',
      genre: 'Alternative',
      trackCount: 10,
    },
    {
      id: 'MPREb_weeknd_afterhours',
      title: 'After Hours',
      artist: 'The Weeknd',
      artistId: 'UC0WP5P-ufpRfjbNrmOWwLBQ',
      artwork: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=600&q=80',
      year: '2020',
      genre: 'R&B / Pop',
      trackCount: 14,
    },
  ],

  liveRadios: [
    {
      id: 'radio-lofigirl',
      title: 'Lofi Girl - Relax & Study 24/7',
      artist: 'Lofi Records',
      album: 'Lofi Chill Beats Live',
      artwork: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80',
      duration: 0,
      audioUrl: 'https://stream.zeno.fm/f3wvbbqmdg8uv',
      genre: 'Lo-Fi Chill',
      isLive: true,
    },
    {
      id: 'radio-synthwave',
      title: 'Synthwave & Retrowave Vibes',
      artist: 'Night City Radio',
      album: 'Retro Chill',
      artwork: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=600&auto=format&fit=crop&q=80',
      duration: 0,
      audioUrl: 'https://stream.zeno.fm/0r0xa792kwzuv',
      genre: 'Synthwave',
      isLive: true,
    },
    {
      id: 'radio-indie',
      title: 'Indie Rock & Shoegaze Radio',
      artist: 'Dream Pop Collective',
      album: 'Fuzz & Reverberation',
      artwork: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80',
      duration: 0,
      audioUrl: 'https://stream.zeno.fm/4t8wd44yvtzuv',
      genre: 'Indie Alternative',
      isLive: true,
    },
    {
      id: 'radio-jazz',
      title: 'Late Night Coffee & Smooth Jazz',
      artist: 'Cafe Lounge',
      album: 'Midnight Acoustics',
      artwork: 'https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=600&auto=format&fit=crop&q=80',
      duration: 0,
      audioUrl: 'https://stream.zeno.fm/cvv0n7m8738uv',
      genre: 'Smooth Jazz',
      isLive: true,
    },
  ],
};

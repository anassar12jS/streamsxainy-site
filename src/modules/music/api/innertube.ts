import { Innertube, UniversalCache } from 'youtubei.js';
import { MusicTrack, Album, Artist, Playlist } from '../types';
import { extensionBridge } from '../extension/bridge';
import { YTNodes } from 'youtubei.js';
import { txt, thumbOf, parsePanelVideo, parseSong, parseAlbumCard, parseArtistCard, parsePlaylistCard, parseCard, parseShelf, parseAlbumHeader, type HomeShelf, type HomeItem } from './ytmParse';

let ytInstance: Innertube | null = null;
let isInitializing = false;

import { getInnertubeForChannel, resetInnertubeInstances } from './innertubeFactory';

/** Drops all cached clients so the next getInnertube() builds a fresh one (e.g. after switching channel). */
export const resetInnertube = resetInnertubeInstances;

/**
 * Initializes YouTube.js Innertube client with custom extension proxy fetch.
 * Bypasses CORS and routes requests through the BitChord companion extension
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

  // 3. Public mirrors
  if (!videoId) {
    try {
      const query = `${track.title} ${track.artist}`.trim();
      const fallbackSearchUrls = [
        `https://pipedapi.kavin.rocks/search?q=${encodeURIComponent(query)}&filter=music_songs`,
        `https://api.piped.privacy.com.de/search?q=${encodeURIComponent(query)}&filter=music_songs`,
        `https://invidious.nerdvpn.de/api/v1/search?q=${encodeURIComponent(query)}&type=video`,
      ];
      for (const sUrl of fallbackSearchUrls) {
        try {
          const res = await extensionBridge.proxyFetch(sUrl);
          if (res.ok) {
            const data = await res.json();
            const items = Array.isArray(data) ? data : data.items || [];
            const first = items?.[0];
            const match = first?.url?.match(/v=([a-zA-Z0-9_-]{11})/);
            if (match?.[1]) { videoId = match[1]; break; }
            if (first?.videoId) { videoId = first.videoId; break; }
          }
        } catch {}
      }
    } catch {}
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

  const yt = await getInnertube();
  let videoId = await resolveVideoId(track);

  // 2. Fetch stream format and decipher via player
  if (videoId) {
    try {
      let info: any = null;
      try {
        info = await yt.getInfo(videoId);
      } catch {
        info = await yt.getBasicInfo(videoId);
      }

      let streamUrl: string | null = null;

      // Get the best audio-only format (Opus 251 or AAC 140)
      if (info?.streaming_data) {
        const bestAudio = info.chooseFormat({ type: 'audio', quality: 'best' });

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
              return { url: URL.createObjectURL(blob), isDash: true };
            }
          } catch {}
        }
      }

      if (streamUrl && typeof streamUrl === 'string' && streamUrl.startsWith('http')) {
        return { url: streamUrl, isDash: false };
      }
    } catch (err) {
      console.debug('InnerTube getInfo/decipher failed:', err);
    }
  }

  // 3. Fallback streaming mirrors (reliable with CORS headers)
  if (videoId) {
    const proxyEndpoints = [
      `https://pipedapi.kavin.rocks/streams/${videoId}`,
      `https://api.piped.privacy.com.de/streams/${videoId}`,
      `https://invidious.nerdvpn.de/api/v1/videos/${videoId}`,
    ];

    for (const ep of proxyEndpoints) {
      try {
        const res = await extensionBridge.proxyFetch(ep);
        if (res.ok) {
          const data = await res.json();
          const audioStreams = data.audioStreams || data.adaptiveFormats?.filter((f: any) => f.type?.includes('audio')) || [];
          if (audioStreams.length > 0) {
            const best = audioStreams.find((s: any) => s.itag === 251) || audioStreams[0];
            if (best?.url && typeof best.url === 'string' && best.url.startsWith('http')) {
              return { url: best.url, isDash: Boolean(best.url.includes('.mpd')) };
            }
          }
        }
      } catch {}
    }
  }

  throw new Error(`Unable to resolve YouTube audio stream for "${track.title || 'Unknown'}"`);
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
          const artwork = item.thumbnail?.contents?.[0]?.url || item.thumbnails?.[0]?.url || '';
          const videoId = item.id || item.videoId || '';
          return {
            id: videoId || `yt-${idx}-${Date.now()}`,
            title: item.title?.text || item.title || 'Unknown Title',
            artist: item.artists?.[0]?.name || item.author?.name || 'Unknown Artist',
            artistId: item.artists?.[0]?.id,
            album: item.album?.name || 'Single',
            albumId: item.album?.id,
            artwork: artwork ? artwork.replace(/=w\d+-h\d+/, '=w600-h600') : '',
            duration: item.duration?.seconds || 210,
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
        textSuggestions = res.map((item: any) => typeof item === 'string' ? item : item?.text || String(item)).slice(0, 5);
      }
    }
  } catch {}

  // 2. Query YouTube suggest API for query autocomplete
  if (textSuggestions.length === 0) {
    try {
      const suggestUrl = `https://suggestqueries.google.com/complete/search?client=youtube&ds=yt&client=firefox&q=${encodeURIComponent(q)}`;
      const sRes = await extensionBridge.proxyFetch(suggestUrl);
      if (sRes.ok) {
        const sData = await sRes.json();
        if (Array.isArray(sData?.[1])) {
          textSuggestions = sData[1].slice(0, 5);
        }
      }
    } catch {}
  }

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
        const art = item.thumbnail?.contents?.[0]?.url || item.thumbnails?.[0]?.url || '';
        const highResArt = art ? art.replace(/=w\d+-h\d+/, '=w300-h300') : '';
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
              duration: item.duration?.seconds || 210,
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
              const aThumb = a.thumbnail?.contents?.[0]?.url || a.thumbnails?.[0]?.url || '';
              artists.push({
                id: aId,
                name: aName,
                avatar: aThumb ? aThumb.replace(/=w\d+-h\d+/, '=w400-h400') : 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=300&q=80',
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
              const albThumb = alb.thumbnail?.contents?.[0]?.url || alb.thumbnails?.[0]?.url || '';
              albums.push({
                id: albId,
                title: albTitle,
                artist: albArtist,
                year: albYear,
                artwork: albThumb ? albThumb.replace(/=w\d+-h\d+/, '=w600-h600') : '',
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
export async function getAlbumDetails(albumId: string): Promise<Album | null> {
  const id = albumId?.trim();
  if (!id) return null;

  const yt: any = await getInnertube();
  const res: any = await yt.music.getAlbum(id);
  const head = parseAlbumHeader(unwrapHeader(res?.header), res?.background);
  if (!head.title) return null;

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

  return {
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
}

const artistCache = new Map<string, { at: number; res: any }>();
async function fetchArtistPage(yt: any, id: string): Promise<any> {
  const hit = artistCache.get(id);
  if (hit && Date.now() - hit.at < 2 * 60 * 1000) return hit.res;
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

  const yt: any = await getInnertube();
  const res: any = await fetchArtistPage(yt, id);
  const h: any = res?.header;
  const name = txt(h?.title);
  if (!name) return null;

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
  const artwork = thumbOf(header?.thumbnail ?? header?.thumbnails ?? background, 800) || tracks[0]?.artwork || '';

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
    artwork: '',
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

/** Personalised home feed shelves (live, follows a couple of continuations). */
export async function getHomeShelves(): Promise<HomeShelf[]> {
  const yt: any = await getInnertube();
  let feed: any = await yt.music.getHomeFeed();
  const shelves: HomeShelf[] = [];
  const seen = new Set<string>();
  for (let page = 0; page < 3 && feed; page++) {
    for (const [i, sec] of (feed.sections ?? []).entries()) {
      const shelf = parseShelf(sec, `home-${page}-${i}`);
      if (shelf && !seen.has(shelf.title)) {
        seen.add(shelf.title);
        shelves.push(shelf);
      }
    }
    if (!feed.has_continuation) break;
    feed = await feed.getContinuation();
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
      title: 'Dune: Part Two (Original Soundtrack)',
      artist: 'Hans Zimmer',
      description: 'Experience the sweeping desert soundscape in high-fidelity Apple Music spatial audio.',
      artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/fd/b2/76/fdb276e7-ac61-856a-3eeb-36007e9fba7c/794043220425.jpg/600x600bb.jpg',
      badge: 'SPATIAL AUDIO',
      type: 'album',
      targetId: 'album-dune2',
    },
    {
      id: 'spot-2',
      title: 'Today’s Hits 2025',
      artist: 'Apple Music Pop',
      description: 'The biggest songs across the globe, updated in real time.',
      artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/92/9f/69/929f69f1-9977-3a44-d674-11f70c852d1b/24UMGIM36186.rgb.jpg/600x600bb.jpg',
      badge: 'FEATURED PLAYLIST',
      type: 'playlist',
      targetId: 'pl-todays-hits',
    },
    {
      id: 'spot-3',
      title: 'Anime Soundtracks: Epic Battles',
      artist: 'Attack on Titan, Jujutsu Kaisen, Demon Slayer',
      description: 'Shonen battle themes and orchestrations by Hiroyuki Sawano & RADWIMPS.',
      artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music128/v4/ca/b0/7f/cab07fff-c8aa-e3ed-5051-7a91e9739b5c/192650630147_cover.jpg/600x600bb.jpg',
      badge: 'ANIME SPOTLIGHT',
      type: 'playlist',
      targetId: 'pl-anime-epic',
    },
  ],

  topTracks: [
    {
      id: 'am-1',
      title: 'Cornfield Chase',
      artist: 'Hans Zimmer',
      album: 'Interstellar (Original Motion Picture Soundtrack)',
      artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/f4/5b/73/f45b735a-8d7a-9713-b217-0f8e1593c28b/794043201943.jpg/600x600bb.jpg',
      duration: 236,
      audioUrl: '',
      youtubeId: 'UDVtMYqUAyw',
      genre: 'Soundtrack',
      year: '2014',
    },
    {
      id: 'am-2',
      title: 'Can You Hear the Music',
      artist: 'Ludwig Göransson',
      album: 'Oppenheimer (Original Motion Picture Soundtrack)',
      artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/27/fa/ca/27faca2e-7f7a-cf17-ae3e-647294d52713/697.jpg/600x600bb.jpg',
      duration: 110,
      audioUrl: '',
      youtubeId: '4JZ-o3iAJv4',
      genre: 'Soundtrack',
      year: '2023',
    },
    {
      id: 'am-3',
      title: 'A Time of Quiet Between the Storms',
      artist: 'Hans Zimmer',
      album: 'Dune: Part Two (Original Soundtrack)',
      artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/fd/b2/76/fdb276e7-ac61-856a-3eeb-36007e9fba7c/794043220425.jpg/600x600bb.jpg',
      duration: 261,
      audioUrl: '',
      youtubeId: 'tZkWc2Z866o',
      genre: 'Soundtrack',
      year: '2024',
    },
    {
      id: 'am-4',
      title: 'Sparkle (Movie ver.)',
      artist: 'RADWIMPS',
      album: 'Your Name. (Original Soundtrack)',
      artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/56/b3/8c/56b38c05-1728-402c-016c-c1e4b0635be8/4988031167618_cover.jpg/600x600bb.jpg',
      duration: 537,
      audioUrl: '',
      youtubeId: 'a2GujJZfXpg',
      genre: 'Anime / J-Rock',
      year: '2016',
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
      title: 'YouSeeBIGGIRL/T:T',
      artist: 'Hiroyuki Sawano & Gemie',
      album: 'Attack on Titan Season 2 (Original Soundtrack)',
      artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music128/v4/ca/b0/7f/cab07fff-c8aa-e3ed-5051-7a91e9739b5c/192650630147_cover.jpg/600x600bb.jpg',
      duration: 358,
      audioUrl: '',
      youtubeId: '1Tf6yZ8H_gY',
      genre: 'Anime / Epic',
      year: '2017',
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
      id: 'MPREb_kZ32L3x7eJ8',
      title: 'Interstellar (Original Soundtrack)',
      artist: 'Hans Zimmer',
      artistId: 'UC3u1g-8w_a9_Y1XpQcM715Q',
      artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/f4/5b/73/f45b735a-8d7a-9713-b217-0f8e1593c28b/794043201943.jpg/600x600bb.jpg',
      year: '2014',
      genre: 'Soundtrack',
      trackCount: 16,
    },
    {
      id: 'MPREb_8kL4w9Z2x1a',
      title: 'Oppenheimer (Original Soundtrack)',
      artist: 'Ludwig Göransson',
      artistId: 'UCY4s2D_iR2gM7l8xUj0t8wA',
      artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/4a/15/48/4a1548b2-b5ca-fae5-4f3d-ca290bf494ec/23UMGIM74921.rgb.jpg/600x600bb.jpg',
      year: '2023',
      genre: 'Soundtrack',
      trackCount: 24,
    },
    {
      id: 'MPREb_7mN0kL1z7x9',
      title: 'Dune: Part Two (Original Soundtrack)',
      artist: 'Hans Zimmer',
      artistId: 'UC3u1g-8w_a9_Y1XpQcM715Q',
      artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/b8/b5/45/b8b545d0-9ce1-38ae-aa21-0300a74ea85a/794043217997.jpg/600x600bb.jpg',
      year: '2024',
      genre: 'Soundtrack',
      trackCount: 25,
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
      id: 'MPREb_3fD5kL1z7x9',
      title: 'Your Name. (Original Soundtrack)',
      artist: 'RADWIMPS',
      artistId: 'UC2wRz2B6e21E2Z_rFmQ269A',
      artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/8e/31/31/8e31317a-85d7-b362-e935-d22798fbb0d8/16UMGIM41846.rgb.jpg/600x600bb.jpg',
      year: '2016',
      genre: 'Anime',
      trackCount: 27,
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
      title: 'Synthwave & Retrowave Cyberpunk',
      artist: 'Night City Radio',
      album: 'Retro 80s Chill',
      artwork: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=600&auto=format&fit=crop&q=80',
      duration: 0,
      audioUrl: 'https://stream.zeno.fm/0r0xa792kwzuv',
      genre: 'Synthwave',
      isLive: true,
    },
    {
      id: 'radio-anime',
      title: 'Anime Piano & Orchestral Radio',
      artist: 'Studio Ghibli & Shonen Beats',
      album: 'Anime OST Radio',
      artwork: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80',
      duration: 0,
      audioUrl: 'https://stream.zeno.fm/4t8wd44yvtzuv',
      genre: 'Anime Chill',
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

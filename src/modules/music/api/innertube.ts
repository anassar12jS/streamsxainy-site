import { Innertube, UniversalCache } from 'youtubei.js';
import { MusicTrack, Album, Artist, Playlist } from '../types';
import { extensionBridge } from '../extension/bridge';

let ytInstance: Innertube | null = null;
let isInitializing = false;

/**
 * Initializes YouTube.js Innertube client with custom extension proxy fetch.
 * Bypasses CORS and routes requests through the BitChord companion extension
 * to utilize signed-in YouTube Music sessions.
 */
export async function getInnertube(): Promise<Innertube> {
  if (ytInstance) return ytInstance;
  if (isInitializing) {
    while (isInitializing) {
      await new Promise(r => setTimeout(r, 100));
    }
    if (ytInstance) return ytInstance;
  }

  isInitializing = true;
  try {
    ytInstance = await Innertube.create({
      cache: new UniversalCache(false),
      fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        
        // Clone the options so we can safely mutate them
        const options: RequestInit = { ...init };
        
        // Standardize method casing - check options.method first, then input.method if input is a Request
        const method = (
          options.method ||
          (typeof input === 'object' && input && 'method' in input ? (input as Request).method : undefined) ||
          'GET'
        ).toUpperCase();
        options.method = method;
        
        // Chrome strictly forbids the 'body' property on GET/HEAD requests, even if undefined
        if (method === 'GET' || method === 'HEAD') {
          delete options.body;
        }

        // Route through the extension bridge
        return await extensionBridge.proxyFetch(url, options);
      }
    });
  } catch (err) {
    console.warn('InnerTube initialization with UniversalCache failed, retrying direct:', err);
    try {
      ytInstance = await Innertube.create({
        fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
          const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
          
          // Clone the options so we can safely mutate them
          const options: RequestInit = { ...init };
          
          // Standardize method casing - check options.method first, then input.method if input is a Request
          const method = (
            options.method ||
            (typeof input === 'object' && input && 'method' in input ? (input as Request).method : undefined) ||
            'GET'
          ).toUpperCase();
          options.method = method;
          
          // Chrome strictly forbids the 'body' property on GET/HEAD requests, even if undefined
          if (method === 'GET' || method === 'HEAD') {
            delete options.body;
          }

          // Route through the extension bridge
          return await extensionBridge.proxyFetch(url, options);
        }
      });
    } catch (e2) {
      console.error('Fatal InnerTube creation error:', e2);
      throw e2;
    }
  } finally {
    isInitializing = false;
  }
  return ytInstance;
}

/**
 * Resolves the YouTube video ID for a track.
 */
export async function resolveVideoId(
  trackOrId: string | MusicTrack | { title: string; artist: string; youtubeId?: string }
): Promise<string | null> {
  const track = typeof trackOrId === 'string' 
    ? { title: '', artist: '', youtubeId: trackOrId } 
    : trackOrId;

  if (track.youtubeId) return track.youtubeId;
  if (!track.title && !track.artist) return null;

  let videoId: string | undefined;

  // 1. General search with audio keyword (fastest and most accurate)
  try {
    const yt = await getInnertube();
    const query = `${track.title} ${track.artist} audio`.trim();
    const generalSearch = await yt.search(query, { type: 'video' });
    videoId = (generalSearch as any).videos?.[0]?.id || (generalSearch as any).results?.[0]?.id;
  } catch (err) {
    console.debug('yt.search failed:', err);
  }

  // 2. yt.music.search
  if (!videoId) {
    try {
      const yt = await getInnertube();
      const query = `${track.title} ${track.artist}`.trim();
      const searchResults = await yt.music.search(query, { type: 'song' });
      const firstResult = 
        (searchResults as any).results?.[0] ||
        (searchResults as any).contents?.[0]?.contents?.[0] ||
        (searchResults as any).contents?.[0] ||
        (searchResults as any).songs?.contents?.[0];
      videoId = firstResult?.id;
    } catch (err) {
      console.debug('yt.music.search failed:', err);
    }
  }

  // 3. Fallback search via public Piped/Invidious mirrors
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
            if (first?.url) {
              const match = first.url.match(/v=([a-zA-Z0-9_-]{11})/);
              if (match?.[1]) {
                videoId = match[1];
                break;
              }
            }
            if (first?.videoId) {
              videoId = first.videoId;
              break;
            }
          }
        } catch {}
      }
    } catch {}
  }

  return videoId || null;
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
 * Searches music catalogue via InnerTube or metadata provider
 */
export async function searchInnerTube(query: string): Promise<MusicTrack[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  // 1. Try InnerTube music search
  try {
    const it = await getInnertube();
    if (it?.music) {
      const searchRes = await it.music.search(trimmed, { type: 'song' });
      const songShelf = (searchRes as any).contents?.find((c: any) => c.type === 'MusicShelf' || c.title?.text === 'Songs') || (searchRes as any).contents?.[0];
      const contents = (searchRes as any).results || songShelf?.contents || (searchRes as any).contents || [];

      if (contents.length > 0) {
        return contents.slice(0, 25).map((item: any, idx: number): MusicTrack => {
          const artwork = item.thumbnail?.contents?.[0]?.url || item.thumbnails?.[0]?.url || '';
          return {
            id: item.id || `yt-${idx}-${Date.now()}`,
            title: item.title?.text || item.title || 'Unknown Title',
            artist: item.artists?.[0]?.name || item.author?.name || 'Unknown Artist',
            artistId: item.artists?.[0]?.id,
            album: item.album?.name || 'Single',
            artwork: artwork ? artwork.replace(/=w\d+-h\d+/, '=w600-h600') : '',
            duration: item.duration?.seconds || 210,
            audioUrl: '', // SCRUBBED: Resolved on-demand via YouTube deciphered stream
            youtubeId: item.id,
            source: 'innertube',
          };
        });
      }
    }
  } catch (err) {
    console.debug('InnerTube music search error, using metadata search:', err);
  }

  // 2. Fallback Apple Music metadata search (UI metadata & high-res artwork only, NO audioUrl)
  try {
    const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(trimmed)}&media=music&entity=song&limit=25`;
    const res = await extensionBridge.proxyFetch(itunesUrl);
    if (res.ok) {
      const data = await res.json();
      return (data.results || []).map((r: any): MusicTrack => {
        let artwork = r.artworkUrl100 || '';
        if (artwork) {
          artwork = artwork.replace('100x100bb', '600x600bb').replace('60x60bb', '600x600bb');
        }
        return {
          id: `apple-${r.trackId}`,
          title: r.trackName,
          artist: r.artistName,
          album: r.collectionName || 'Single',
          artwork,
          duration: Math.round((r.trackTimeMillis || 200000) / 1000),
          audioUrl: r.previewUrl || '', // Fallback preview audio if YouTube direct resolution fails
          genre: r.primaryGenreName,
          year: r.releaseDate ? r.releaseDate.split('-')[0] : '',
          isExplicit: r.trackExplicitness === 'explicit',
          source: 'curated',
        };
      });
    }
  } catch {}

  return [];
}

/**
 * Fetches album details and tracklist via InnerTube (yt.music.getAlbum) with graceful fallback
 */
export async function getAlbumDetails(albumId: string): Promise<Album | null> {
  const cleanId = albumId?.trim();
  if (!cleanId) return null;

  // 1. Try InnerTube
  try {
    const yt = await getInnertube();
    if (yt?.music) {
      const res: any = await yt.music.getAlbum(cleanId);
      if (res) {
        const title = res.header?.title?.text || res.title || 'Unknown Album';
        const artist = res.header?.author?.name || res.header?.artists?.[0]?.name || res.artists?.[0]?.name || 'Unknown Artist';
        const artistId = res.header?.author?.id || res.header?.artists?.[0]?.id || res.artists?.[0]?.id;
        const year = res.header?.year?.text || res.year || '';
        const artwork = res.header?.thumbnails?.[0]?.url || res.thumbnails?.[0]?.url || '';
        const highResArt = artwork ? artwork.replace(/=w\d+-h\d+/, '=w600-h600') : '';
        
        const contents = res.contents || [];
        const tracks: MusicTrack[] = contents.map((item: any, idx: number) => ({
          id: item.id || `${cleanId}-t${idx}`,
          title: item.title?.text || item.title || `Track ${idx + 1}`,
          artist: item.artists?.[0]?.name || item.author?.name || artist,
          artistId: item.artists?.[0]?.id || artistId,
          album: title,
          albumId: cleanId,
          artwork: highResArt,
          duration: item.duration?.seconds || 210,
          youtubeId: item.id,
          source: 'innertube',
        }));

        return {
          id: cleanId,
          title,
          artist,
          artistId,
          artwork: highResArt,
          year: String(year),
          genre: 'Music',
          trackCount: tracks.length,
          tracks,
        };
      }
    }
  } catch (err) {
    console.debug('yt.music.getAlbum failed, using fallback:', err);
  }

  // 2. Check local curated albums (e.g. lib-jar, lib-sade, album-interstellar)
  const curated = APPLE_MUSIC_BROWSE_SECTIONS.featuredAlbums.find(a => a.id === cleanId);
  if (curated) {
    const tracks: MusicTrack[] = APPLE_MUSIC_BROWSE_SECTIONS.topTracks.map((t, idx) => ({
      ...t,
      id: `${cleanId}-${idx}`,
      album: curated.title,
      albumId: cleanId,
      artist: curated.artist,
      artwork: curated.artwork,
    }));

    return {
      id: curated.id,
      title: curated.title,
      artist: curated.artist,
      artwork: curated.artwork,
      year: curated.year,
      genre: curated.genre,
      trackCount: curated.trackCount,
      tracks,
    };
  }

  // 3. iTunes album search / lookup fallback
  try {
    const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(cleanId.replace(/^album-|^lib-/, ''))}&entity=album&limit=1`;
    const res = await extensionBridge.proxyFetch(itunesUrl);
    if (res.ok) {
      const data = await res.json();
      const first = data.results?.[0];
      if (first) {
        let artwork = first.artworkUrl100 || '';
        if (artwork) artwork = artwork.replace('100x100bb', '600x600bb');
        
        const lookupUrl = `https://itunes.apple.com/lookup?id=${first.collectionId}&entity=song`;
        const lRes = await extensionBridge.proxyFetch(lookupUrl);
        let tracks: MusicTrack[] = [];
        if (lRes.ok) {
          const lData = await lRes.json();
          tracks = (lData.results || []).slice(1).map((r: any): MusicTrack => ({
            id: `apple-${r.trackId}`,
            title: r.trackName,
            artist: r.artistName,
            artistId: String(r.artistId || ''),
            album: r.collectionName,
            albumId: String(first.collectionId),
            artwork,
            duration: Math.round((r.trackTimeMillis || 200000) / 1000),
            audioUrl: r.previewUrl || '',
            year: r.releaseDate ? r.releaseDate.split('-')[0] : '',
            genre: r.primaryGenreName,
            source: 'curated',
          }));
        }

        return {
          id: cleanId,
          title: first.collectionName,
          artist: first.artistName,
          artistId: String(first.artistId || ''),
          artwork,
          year: first.releaseDate ? first.releaseDate.split('-')[0] : '2024',
          genre: first.primaryGenreName || 'Music',
          trackCount: first.trackCount || tracks.length,
          tracks,
        };
      }
    }
  } catch {}

  return null;
}

/**
 * Fetches artist details, top tracks, and albums via InnerTube (yt.music.getArtist) with graceful fallback
 */
export async function getArtistDetails(artistId: string): Promise<Artist | null> {
  const cleanId = artistId?.trim();
  if (!cleanId) return null;
  const decodedName = decodeURIComponent(cleanId);

  // 1. Try InnerTube
  try {
    const yt = await getInnertube();
    if (yt?.music) {
      const res: any = await yt.music.getArtist(cleanId);
      if (res) {
        const name = res.header?.title?.text || res.name || decodedName;
        const avatar = res.header?.thumbnails?.[0]?.url || res.thumbnails?.[0]?.url || '';
        const highResAvatar = avatar ? avatar.replace(/=w\d+-h\d+/, '=w600-h600') : '';
        const monthlyListeners = res.header?.monthly_listeners?.text || res.header?.subscribers?.text || 'Over 12M monthly listeners';

        // Extract top tracks
        const songSection = res.sections?.find((s: any) => s.type === 'MusicShelf' || s.title?.text === 'Songs' || s.title?.text === 'Top songs') || res.sections?.[0];
        const topTracks: MusicTrack[] = (songSection?.contents || []).slice(0, 10).map((item: any, idx: number) => {
          const art = item.thumbnail?.contents?.[0]?.url || item.thumbnails?.[0]?.url || highResAvatar;
          return {
            id: item.id || `artist-song-${idx}`,
            title: item.title?.text || item.title || 'Untitled',
            artist: name,
            artistId: cleanId,
            album: item.album?.name || 'Single',
            artwork: art ? art.replace(/=w\d+-h\d+/, '=w600-h600') : highResAvatar,
            duration: item.duration?.seconds || 210,
            youtubeId: item.id,
            source: 'innertube',
          };
        });

        // Extract albums
        const albumSection = res.sections?.find((s: any) => s.title?.text === 'Albums' || s.title?.text === 'Discography');
        const albums: Album[] = (albumSection?.contents || []).slice(0, 8).map((a: any, idx: number) => {
          const aArt = a.thumbnail?.contents?.[0]?.url || a.thumbnails?.[0]?.url || highResAvatar;
          return {
            id: a.id || `alb-${idx}`,
            title: a.title?.text || a.title || 'Album',
            artist: name,
            artistId: cleanId,
            artwork: aArt ? aArt.replace(/=w\d+-h\d+/, '=w600-h600') : highResAvatar,
            year: a.year?.text || a.year || '2024',
            genre: 'Music',
            trackCount: 10,
            tracks: [],
          };
        });

        return {
          id: cleanId,
          name,
          avatar: highResAvatar,
          monthlyListeners,
          topTracks: topTracks.length > 0 ? topTracks : APPLE_MUSIC_BROWSE_SECTIONS.topTracks.slice(0, 6),
          albums: albums.length > 0 ? albums : APPLE_MUSIC_BROWSE_SECTIONS.featuredAlbums.map(fa => ({ ...fa, tracks: [] })),
          singles: [],
        };
      }
    }
  } catch (err) {
    console.debug('yt.music.getArtist failed, using fallback:', err);
  }

  // 2. iTunes Artist search fallback
  try {
    const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(decodedName)}&entity=song&limit=12`;
    const res = await extensionBridge.proxyFetch(itunesUrl);
    if (res.ok) {
      const data = await res.json();
      const results = data.results || [];
      if (results.length > 0) {
        const first = results[0];
        let avatar = first.artworkUrl100 || '';
        if (avatar) avatar = avatar.replace('100x100bb', '600x600bb');

        const topTracks: MusicTrack[] = results.map((r: any): MusicTrack => ({
          id: `apple-${r.trackId}`,
          title: r.trackName,
          artist: r.artistName,
          artistId: cleanId,
          album: r.collectionName || 'Single',
          albumId: String(r.collectionId || ''),
          artwork: r.artworkUrl100 ? r.artworkUrl100.replace('100x100bb', '600x600bb') : avatar,
          duration: Math.round((r.trackTimeMillis || 200000) / 1000),
          audioUrl: r.previewUrl || '',
          year: r.releaseDate ? r.releaseDate.split('-')[0] : '',
          genre: r.primaryGenreName,
          source: 'curated',
        }));

        const albumMap = new Map<string, Album>();
        results.forEach((r: any) => {
          if (r.collectionId && !albumMap.has(String(r.collectionId))) {
            let aArt = r.artworkUrl100 || avatar;
            if (aArt) aArt = aArt.replace('100x100bb', '600x600bb');
            albumMap.set(String(r.collectionId), {
              id: String(r.collectionId),
              title: r.collectionName,
              artist: r.artistName,
              artistId: cleanId,
              artwork: aArt,
              year: r.releaseDate ? r.releaseDate.split('-')[0] : '2024',
              genre: r.primaryGenreName || 'Music',
              trackCount: r.trackCount || 10,
              tracks: [],
            });
          }
        });

        return {
          id: cleanId,
          name: first.artistName,
          avatar,
          monthlyListeners: 'Over 22.4M monthly listeners',
          topTracks,
          albums: Array.from(albumMap.values()),
          singles: [],
        };
      }
    }
  } catch {}

  // 3. Fallback generic artist representation
  return {
    id: cleanId,
    name: decodedName,
    avatar: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80',
    monthlyListeners: 'Over 10M monthly listeners',
    topTracks: APPLE_MUSIC_BROWSE_SECTIONS.topTracks.slice(0, 6),
    albums: APPLE_MUSIC_BROWSE_SECTIONS.featuredAlbums.map(fa => ({ ...fa, tracks: [] })),
    singles: [],
  };
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
      artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/b8/b5/45/b8b545d0-9ce1-38ae-aa21-0300a74ea85a/794043217997.jpg/1200x630bf.jpg',
      badge: 'SPATIAL AUDIO',
      type: 'album',
      targetId: 'album-dune2',
    },
    {
      id: 'spot-2',
      title: 'Today’s Hits 2025',
      artist: 'Apple Music Pop',
      description: 'The biggest songs across the globe, updated in real time.',
      artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/71/6a/5f/716a5fae-7833-255e-2b1b-b21a37c35e38/24UMGIM36919.rgb.jpg/1200x630bf.jpg',
      badge: 'FEATURED PLAYLIST',
      type: 'playlist',
      targetId: 'pl-todays-hits',
    },
    {
      id: 'spot-3',
      title: 'Anime Soundtracks: Epic Battles',
      artist: 'Attack on Titan, Jujutsu Kaisen, Demon Slayer',
      description: 'Shonen battle themes and orchestrations by Hiroyuki Sawano & RADWIMPS.',
      artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/eb/fa/cb/ebfacbe7-fcb6-4557-0131-f56191a0c868/PCXG_50602.jpg/1200x630bf.jpg',
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
      artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/7e/c5/5e/7ec55ee2-ebf8-d988-8f9a-431af1047747/artwork.jpg/600x600bb.jpg',
      duration: 236,
      audioUrl: '', // SCRUBBED: Full stream resolved on-demand via YouTube Music
      youtubeId: 'UDVtMYqUAyw',
      genre: 'Soundtrack',
      year: '2014',
    },
    {
      id: 'am-2',
      title: 'Can You Hear the Music',
      artist: 'Ludwig Göransson',
      album: 'Oppenheimer (Original Motion Picture Soundtrack)',
      artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/4a/15/48/4a1548b2-b5ca-fae5-4f3d-ca290bf494ec/23UMGIM74921.rgb.jpg/600x600bb.jpg',
      duration: 110,
      audioUrl: '', // SCRUBBED: Full stream resolved on-demand via YouTube Music
      youtubeId: '4JZ-o3iAJv4',
      genre: 'Soundtrack',
      year: '2023',
    },
    {
      id: 'am-3',
      title: 'A Time of Quiet Between the Storms',
      artist: 'Hans Zimmer',
      album: 'Dune: Part Two (Original Soundtrack)',
      artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/b8/b5/45/b8b545d0-9ce1-38ae-aa21-0300a74ea85a/794043217997.jpg/600x600bb.jpg',
      duration: 261,
      audioUrl: '', // SCRUBBED: Full stream resolved on-demand via YouTube Music
      youtubeId: 'tZkWc2Z866o',
      genre: 'Soundtrack',
      year: '2024',
    },
    {
      id: 'am-4',
      title: 'Sparkle (Movie ver.)',
      artist: 'RADWIMPS',
      album: 'Your Name. (Original Soundtrack)',
      artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/8e/31/31/8e31317a-85d7-b362-e935-d22798fbb0d8/16UMGIM41846.rgb.jpg/600x600bb.jpg',
      duration: 537,
      audioUrl: '', // SCRUBBED: Full stream resolved on-demand via YouTube Music
      youtubeId: 'a2GujJZfXpg',
      genre: 'Anime / J-Rock',
      year: '2016',
    },
    {
      id: 'am-5',
      title: 'BIRDS OF A FEATHER',
      artist: 'Billie Eilish',
      album: 'HIT ME HARD AND SOFT',
      artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/71/6a/5f/716a5fae-7833-255e-2b1b-b21a37c35e38/24UMGIM36919.rgb.jpg/600x600bb.jpg',
      duration: 196,
      audioUrl: '', // SCRUBBED: Full stream resolved on-demand via YouTube Music
      youtubeId: 'V9PVRfjEBTI',
      genre: 'Pop',
      year: '2024',
    },
    {
      id: 'am-6',
      title: 'Espresso',
      artist: 'Sabrina Carpenter',
      album: 'Short n\' Sweet',
      artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/bb/e4/c7/bbe4c7e0-2f9c-7037-4d76-e17f541334c9/24UMGIM53709.rgb.jpg/600x600bb.jpg',
      duration: 175,
      audioUrl: '', // SCRUBBED: Full stream resolved on-demand via YouTube Music
      youtubeId: 'eVli-tstM5E',
      genre: 'Pop',
      year: '2024',
    },
    {
      id: 'am-7',
      title: 'YouSeeBIGGIRL/T:T',
      artist: 'Hiroyuki Sawano & Gemie',
      album: 'Attack on Titan Season 2 (Original Soundtrack)',
      artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/eb/fa/cb/ebfacbe7-fcb6-4557-0131-f56191a0c868/PCXG_50602.jpg/600x600bb.jpg',
      duration: 358,
      audioUrl: '', // SCRUBBED: Full stream resolved on-demand via YouTube Music
      youtubeId: '1Tf6yZ8H_gY',
      genre: 'Anime / Epic',
      year: '2017',
    },
    {
      id: 'am-8',
      title: 'Starboy',
      artist: 'The Weeknd & Daft Punk',
      album: 'Starboy',
      artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/b0/be/a4/b0bea469-873b-75e1-848e-28f32230113c/16UMGIM61786.rgb.jpg/600x600bb.jpg',
      duration: 230,
      audioUrl: '', // SCRUBBED: Full stream resolved on-demand via YouTube Music
      youtubeId: '34Na4j8AVgA',
      genre: 'R&B / Pop',
      year: '2016',
    },
  ],

  featuredAlbums: [
    {
      id: 'album-interstellar',
      title: 'Interstellar (Original Soundtrack)',
      artist: 'Hans Zimmer',
      artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/7e/c5/5e/7ec55ee2-ebf8-d988-8f9a-431af1047747/artwork.jpg/600x600bb.jpg',
      year: '2014',
      genre: 'Soundtrack',
      trackCount: 16,
    },
    {
      id: 'album-oppenheimer',
      title: 'Oppenheimer (Original Soundtrack)',
      artist: 'Ludwig Göransson',
      artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/4a/15/48/4a1548b2-b5ca-fae5-4f3d-ca290bf494ec/23UMGIM74921.rgb.jpg/600x600bb.jpg',
      year: '2023',
      genre: 'Soundtrack',
      trackCount: 24,
    },
    {
      id: 'album-dune2',
      title: 'Dune: Part Two (Original Soundtrack)',
      artist: 'Hans Zimmer',
      artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/b8/b5/45/b8b545d0-9ce1-38ae-aa21-0300a74ea85a/794043217997.jpg/600x600bb.jpg',
      year: '2024',
      genre: 'Soundtrack',
      trackCount: 25,
    },
    {
      id: 'album-hitmehard',
      title: 'HIT ME HARD AND SOFT',
      artist: 'Billie Eilish',
      artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/71/6a/5f/716a5fae-7833-255e-2b1b-b21a37c35e38/24UMGIM36919.rgb.jpg/600x600bb.jpg',
      year: '2024',
      genre: 'Alternative',
      trackCount: 10,
    },
    {
      id: 'album-yourname',
      title: 'Your Name. (Original Soundtrack)',
      artist: 'RADWIMPS',
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

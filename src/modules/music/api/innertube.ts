import { MusicTrack, Album, Artist, Playlist } from '../types';
import { extensionBridge } from '../extension/bridge';

let innertubeInstance: any = null;
let isInitializing = false;

/**
 * Initializes the InnerTube client (youtubei.js) with client context rotation
 */
export async function getInnertube() {
  if (innertubeInstance) return innertubeInstance;
  if (isInitializing) {
    while (isInitializing) {
      await new Promise(r => setTimeout(r, 100));
    }
    return innertubeInstance;
  }

  isInitializing = true;
  try {
    const { Innertube } = await import('youtubei.js/web');
    innertubeInstance = await Innertube.create({
      fetch: (input: any, init: any) => extensionBridge.proxyFetch(input, init),
      generate_session_locally: true,
    });
  } catch (err) {
    console.warn('InnerTube web client initialization deferred, using proxy fallback:', err);
  } finally {
    isInitializing = false;
  }
  return innertubeInstance;
}

/**
 * Resolves full-length playable audio stream URL for a YouTube/Music track.
 * Prefers Opus (itag 251), falling back to AAC (itag 140) or public proxy.
 */
export async function resolveStreamUrl(youtubeId: string): Promise<{ url: string; isDash: boolean }> {
  if (!youtubeId) throw new Error('Missing youtubeId');

  // 1. Try InnerTube client
  try {
    const it = await getInnertube();
    if (it) {
      const info = await it.getInfo(youtubeId);
      const formats = info.streaming_data?.adaptive_formats || [];
      
      // Filter audio formats
      const audioFormats = formats.filter((f: any) => f.mime_type?.includes('audio'));
      
      // Prefer Opus 251, then AAC 140, then highest bitrate
      const opus = audioFormats.find((f: any) => f.itag === 251);
      const aac = audioFormats.find((f: any) => f.itag === 140);
      const chosen = opus || aac || audioFormats[0];

      if (chosen?.url) {
        return { url: chosen.url, isDash: false };
      }
    }
  } catch (err) {
    console.debug('InnerTube direct stream resolution failed, attempting proxy mirror:', err);
  }

  // 2. Fallback to public audio streaming proxies (reliable with CORS headers)
  const proxyEndpoints = [
    `https://pipedapi.kavin.rocks/streams/${youtubeId}`,
    `https://api.piped.privacy.com.de/streams/${youtubeId}`,
    `https://invidious.nerdvpn.de/api/v1/videos/${youtubeId}`,
  ];

  for (const ep of proxyEndpoints) {
    try {
      const res = await extensionBridge.proxyFetch(ep);
      if (res.ok) {
        const data = await res.json();
        const audioStreams = data.audioStreams || data.adaptiveFormats?.filter((f: any) => f.type?.includes('audio')) || [];
        if (audioStreams.length > 0) {
          const best = audioStreams.find((s: any) => s.itag === 251) || audioStreams[0];
          if (best?.url) {
            return { url: best.url, isDash: Boolean(best.url.includes('.mpd')) };
          }
        }
      }
    } catch {}
  }

  // 3. Fallback direct stream endpoint
  return {
    url: `https://yt-stream.bitchord.workers.dev/stream?id=${youtubeId}`,
    isDash: false,
  };
}

/**
 * Searches music catalogue via InnerTube or open API
 */
export async function searchInnerTube(query: string): Promise<MusicTrack[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  // Try InnerTube music search
  try {
    const it = await getInnertube();
    if (it?.music) {
      const searchRes = await it.music.search(trimmed, { type: 'song' });
      const contents = searchRes.contents || [];
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
            audioUrl: '', // resolved on demand
            youtubeId: item.id,
            source: 'innertube',
          };
        });
      }
    }
  } catch (err) {
    console.debug('InnerTube music search error, using fast fallback search:', err);
  }

  // Fallback fast iTunes/Open search
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
          audioUrl: r.previewUrl || '',
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

// ---------------------------------------------------------------------------
// Curated Apple Music High-Fidelity Catalogs
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
      audioUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/37/65/ac/3765ac6b-efce-a438-4482-287ea711ee01/mzaf_17061069329183693603.plus.aac.p.m4a',
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
      audioUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview116/v4/91/9f/fa/919ffa8f-a65c-619f-52b2-65a9956d77e4/mzaf_10526786431908477726.plus.aac.p.m4a',
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
      audioUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview116/v4/5a/2a/39/5a2a3922-26f6-bc18-20d0-cb8cf59604df/mzaf_10915392004273397931.plus.aac.p.m4a',
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
      audioUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/7c/4f/7b/7c4f7b60-ef4b-a25e-3bbd-a5119dfaeaa1/mzaf_17205210940608552390.plus.aac.p.m4a',
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
      audioUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/1c/70/4e/1c704ed2-c67b-1cb8-b9a5-7171e21e05d0/mzaf_16035072224098254245.plus.aac.p.m4a',
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
      audioUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/80/7e/b4/807eb44d-5872-ae44-e2ee-21aa5c6ca86e/mzaf_16373111082729910323.plus.aac.p.m4a',
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
      audioUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview122/v4/89/3e/df/893edf0c-6625-f71e-0899-fe6184a8ddb1/mzaf_8462709295191837077.plus.aac.p.m4a',
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
      audioUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/21/df/b8/21dfb858-a400-0e19-9430-8022a865bfa7/mzaf_15783300585627252277.plus.aac.p.m4a',
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

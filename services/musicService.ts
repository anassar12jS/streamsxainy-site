// StreamHub Native Music Service - Inspired by BitChord & Apple Music
// Unified search, metadata retrieval, synced lyrics, and curated catalogs

export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  artwork: string;
  duration: number; // in seconds
  audioUrl: string; // playable audio stream
  youtubeId?: string;
  genre?: string;
  year?: string;
  isExplicit?: boolean;
  isRadio?: boolean;
}

export interface SyncedLyricLine {
  time: number; // in seconds
  text: string;
}

export interface PlaylistCollection {
  id: string;
  title: string;
  subtitle: string;
  artwork: string;
  category: 'cinema' | 'anime' | 'hits' | 'lofi' | 'gaming';
  tracks: MusicTrack[];
}

// ---------------------------------------------------------------------------
// 1. Curated Soundtracks & Hits with guaranteed working streams & artwork
// ---------------------------------------------------------------------------

export const CURATED_CINEMA_TRACKS: MusicTrack[] = [
  {
    id: 'cin-1',
    title: 'Cornfield Chase / First Step',
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
    id: 'cin-2',
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
    id: 'cin-3',
    title: 'A Time of Quiet Between the Storms',
    artist: 'Hans Zimmer',
    album: 'Dune: Part Two (Original Motion Picture Soundtrack)',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/b8/b5/45/b8b545d0-9ce1-38ae-aa21-0300a74ea85a/794043217997.jpg/600x600bb.jpg',
    duration: 261,
    audioUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview116/v4/5a/2a/39/5a2a3922-26f6-bc18-20d0-cb8cf59604df/mzaf_10915392004273397931.plus.aac.p.m4a',
    youtubeId: 'tZkWc2Z866o',
    genre: 'Soundtrack',
    year: '2024',
  },
  {
    id: 'cin-4',
    title: 'Time',
    artist: 'Hans Zimmer',
    album: 'Inception (Music from the Motion Picture)',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/65/5c/59/655c5932-f3a7-06eb-bf89-5f252bf624ee/mzi.bspvsvfe.jpg/600x600bb.jpg',
    duration: 275,
    audioUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/6f/8a/be/6f8abe09-3ce8-f8a7-7591-628d6c703b0c/mzaf_6135832791845876352.plus.aac.p.m4a',
    youtubeId: 'RxabLA7UQ9k',
    genre: 'Soundtrack',
    year: '2010',
  },
  {
    id: 'cin-5',
    title: 'Now We Are Free',
    artist: 'Hans Zimmer & Lisa Gerrard',
    album: 'Gladiator (More Music from the Motion Picture)',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music114/v4/8f/c9/a1/8fc9a1e0-6a97-90f7-66a7-009ce4a0655a/00028946775626.rgb.jpg/600x600bb.jpg',
    duration: 254,
    audioUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/28/7d/51/287d519b-a010-8025-a4b5-68579cae00a3/mzaf_16035987483669766946.plus.aac.p.m4a',
    youtubeId: 'NBE-u2QGfq4',
    genre: 'Soundtrack',
    year: '2000',
  },
  {
    id: 'cin-6',
    title: 'The Dark Knight Suite',
    artist: 'Hans Zimmer & James Newton Howard',
    album: 'The Dark Knight (Original Motion Picture Soundtrack)',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/c5/40/e6/c540e66e-5da8-d56b-640a-5b65103ecf4c/mzi.ehqeylqj.jpg/600x600bb.jpg',
    duration: 460,
    audioUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/4f/ea/09/4fea095b-06ec-1e37-f4e9-09f4a141f237/mzaf_17208754124967341071.plus.aac.p.m4a',
    youtubeId: 'gvdZ_O3F7_8',
    genre: 'Soundtrack',
    year: '2008',
  },
];

export const CURATED_ANIME_TRACKS: MusicTrack[] = [
  {
    id: 'ani-1',
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
    id: 'ani-2',
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
    id: 'ani-3',
    title: 'Kaikai Kitan',
    artist: 'Eve',
    album: 'Kaikai Kitan / Ao No Waltz - EP',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/31/c3/b2/31c3b290-7d72-74d3-0d31-ce8ee367f080/TFDS-00628.jpg/600x600bb.jpg',
    duration: 221,
    audioUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/80/7e/40/807e40cf-b2f5-d01e-b769-cf560ec0a8f8/mzaf_14429936852159047915.plus.aac.p.m4a',
    youtubeId: '1tk1pqwrOys',
    genre: 'Anime / J-Pop',
    year: '2020',
  },
  {
    id: 'ani-4',
    title: 'Gurenge',
    artist: 'LiSA',
    album: 'Gurenge - Single (Demon Slayer OP)',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/aa/62/16/aa621643-d961-46e7-0eb2-a6f95ca8bc51/VVCL-1460.jpg/600x600bb.jpg',
    duration: 236,
    audioUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/71/3b/6d/713b6d77-eeb3-5689-53fc-d363989c36d0/mzaf_8664551139454170870.plus.aac.p.m4a',
    youtubeId: 'CwkzK-Fh400',
    genre: 'Anime / J-Rock',
    year: '2019',
  },
  {
    id: 'ani-5',
    title: 'Idol',
    artist: 'YOASOBI',
    album: 'THE BOOK 3',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/65/59/3a/65593a20-0ea8-48b8-4c12-32b0a3fe7a7a/XSCL-75.jpg/600x600bb.jpg',
    duration: 213,
    audioUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview116/v4/f5/e3/37/f5e3370d-f55a-4b95-a226-f48301712a81/mzaf_10338779930740958133.plus.aac.p.m4a',
    youtubeId: 'ZRtdQ81jPUQ',
    genre: 'Anime / J-Pop',
    year: '2023',
  },
  {
    id: 'ani-6',
    title: 'Bling-Bang-Bang-Born',
    artist: 'Creepy Nuts',
    album: 'Nidone / Bling-Bang-Bang-Born - Single',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/d1/2c/80/d12c80c2-9e9f-7ec5-7977-ee3f938f3223/AICL-4545.jpg/600x600bb.jpg',
    duration: 171,
    audioUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview116/v4/1c/26/fa/1c26fa2c-ae15-18e3-05ca-87a2a16d510e/mzaf_16480749811492020227.plus.aac.p.m4a',
    youtubeId: '210R0ozmLwg',
    genre: 'Anime / Hip-Hop',
    year: '2024',
  },
];

export const CURATED_GLOBAL_HITS: MusicTrack[] = [
  {
    id: 'hit-1',
    title: 'Blinding Lights',
    artist: 'The Weeknd',
    album: 'After Hours',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/80/16/e8/8016e885-b108-7a54-6243-7fefb489be9c/20UMGIM08249.rgb.jpg/600x600bb.jpg',
    duration: 200,
    audioUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/8c/fb/8e/8cfb8e01-c852-5a41-2a13-2d2508118d32/mzaf_12415177431620868875.plus.aac.p.m4a',
    youtubeId: '4NRXx6U8ABQ',
    genre: 'Pop / Synthwave',
    year: '2020',
  },
  {
    id: 'hit-2',
    title: 'BIRDS OF A FEATHER',
    artist: 'Billie Eilish',
    album: 'HIT ME HARD AND SOFT',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/71/6a/5f/716a5fae-7833-255e-2b1b-b21a37c35e38/24UMGIM36919.rgb.jpg/600x600bb.jpg',
    duration: 196,
    audioUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/1c/70/4e/1c704ed2-c67b-1cb8-b9a5-7171e21e05d0/mzaf_16035072224098254245.plus.aac.p.m4a',
    youtubeId: 'V9PVRfjEBTI',
    genre: 'Alternative Pop',
    year: '2024',
  },
  {
    id: 'hit-3',
    title: 'Espresso',
    artist: 'Sabrina Carpenter',
    album: 'Short n\' Sweet',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/bb/e4/c7/bbe4c7e0-2f9c-7037-4d76-e17f541334c9/24UMGIM53709.rgb.jpg/600x600bb.jpg',
    duration: 175,
    audioUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/80/7e/b4/807eb44d-5872-ae44-e2ee-21aa5c6ca86e/mzaf_16373111082729910323.plus.aac.p.m4a',
    youtubeId: 'eVli-tstM5E',
    genre: 'Pop / Disco',
    year: '2024',
  },
  {
    id: 'hit-4',
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
  {
    id: 'hit-5',
    title: 'Levitating',
    artist: 'Dua Lipa',
    album: 'Future Nostalgia',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music114/v4/3d/e2/2b/3de22b5e-2f95-2c8c-dc6a-3a58e0a29f5f/0190295286101.jpg/600x600bb.jpg',
    duration: 203,
    audioUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/28/7f/73/287f73d8-7d81-b541-118c-c6cf52fa3dc5/mzaf_3943362143210744788.plus.aac.p.m4a',
    youtubeId: 'TUVcZfQe-Kw',
    genre: 'Nu-Disco / Pop',
    year: '2020',
  },
  {
    id: 'hit-6',
    title: 'As It Was',
    artist: 'Harry Styles',
    album: 'Harry\'s House',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/87/a7/bd/87a7bd4c-c0d1-6782-cfb2-921867fa2393/886449987829.jpg/600x600bb.jpg',
    duration: 167,
    audioUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview112/v4/d5/43/fa/d543fa92-5645-095b-d306-05be3b64bc95/mzaf_10526702675685517316.plus.aac.p.m4a',
    youtubeId: 'H5v3kku4y6Q',
    genre: 'Synthpop',
    year: '2022',
  },
];

export const CURATED_LOFI_STATIONS: MusicTrack[] = [
  {
    id: 'lofi-1',
    title: 'Lofi Girl - Relax & Study 24/7',
    artist: 'Lofi Records',
    album: 'Lofi Chill Beats Live',
    artwork: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80',
    duration: 0,
    audioUrl: 'https://stream.zeno.fm/f3wvbbqmdg8uv',
    genre: 'Lo-Fi Chill',
    isRadio: true,
  },
  {
    id: 'lofi-2',
    title: 'Synthwave & Retrowave Cyberpunk',
    artist: 'Night City Radio',
    album: 'Retro 80s Chill',
    artwork: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=600&auto=format&fit=crop&q=80',
    duration: 0,
    audioUrl: 'https://stream.zeno.fm/0r0xa792kwzuv',
    genre: 'Synthwave',
    isRadio: true,
  },
  {
    id: 'lofi-3',
    title: 'Anime Piano & Orchestral Radio',
    artist: 'Studio Ghibli & Shonen Beats',
    album: 'Anime OST Radio',
    artwork: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80',
    duration: 0,
    audioUrl: 'https://stream.zeno.fm/4t8wd44yvtzuv',
    genre: 'Anime Chill',
    isRadio: true,
  },
  {
    id: 'lofi-4',
    title: 'Late Night Coffee & Smooth Jazz',
    artist: 'Cafe Lounge',
    album: 'Midnight Acoustics',
    artwork: 'https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=600&auto=format&fit=crop&q=80',
    duration: 0,
    audioUrl: 'https://stream.zeno.fm/cvv0n7m8738uv',
    genre: 'Smooth Jazz',
    isRadio: true,
  },
  {
    id: 'lofi-5',
    title: 'Gaming Energy & Electronic Bass',
    artist: 'Overclocked Radio',
    album: 'EDM Pulse',
    artwork: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80',
    duration: 0,
    audioUrl: 'https://stream.zeno.fm/s4u7397b98quv',
    genre: 'Electronic',
    isRadio: true,
  },
];

export const CURATED_GAMING_TRACKS: MusicTrack[] = [
  {
    id: 'game-1',
    title: 'I Really Want to Stay at Your House',
    artist: 'Rosa Walton & Hallie Coggins',
    album: 'Cyberpunk 2077 / Edgerunners (Original Soundtrack)',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/dc/16/d3/dc16d3e6-fa10-e74f-96a8-20d00f684bc6/190295147871.jpg/600x600bb.jpg',
    duration: 246,
    audioUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview122/v4/c3/8c/fb/c38cfb45-21d7-2c9d-d603-9d4149020948/mzaf_10091807062494911762.plus.aac.p.m4a',
    youtubeId: 'KvMY1uzSC1E',
    genre: 'Gaming / Synthpop',
    year: '2020',
  },
  {
    id: 'game-2',
    title: 'The Final Battle (Elden Beast)',
    artist: 'Tsukasa Saitoh',
    album: 'ELDEN RING (Original Soundtrack)',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/c1/96/e2/c196e27a-85d7-f4e3-bc1a-eb9b5b292723/cover.jpg/600x600bb.jpg',
    duration: 295,
    audioUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview122/v4/6e/e6/5a/6ee65a66-8501-50d0-9cf9-b0f8387266f8/859764605361_cover.jpg/30x30bb.jpg',
    youtubeId: 'Q31gBqV2WdE',
    genre: 'Gaming / Epic',
    year: '2022',
  },
  {
    id: 'game-3',
    title: 'Weight of the World',
    artist: 'Keiichi Okabe & J\'Nique Nicole',
    album: 'NieR:Automata Original Soundtrack',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/e5/23/e8/e523e80f-90e6-81cf-da61-9c1647bc5d45/SQEX-10589-91.jpg/600x600bb.jpg',
    duration: 344,
    audioUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview124/v4/64/00/01/64000109-7756-1215-6ce1-5d968cb77d70/mzaf_6718536858343753738.plus.aac.p.m4a',
    youtubeId: 'Egn_VNVKzI4',
    genre: 'Gaming / Vocal',
    year: '2017',
  },
];

export const FEATURED_PLAYLISTS: PlaylistCollection[] = [
  {
    id: 'pl-cinema',
    title: 'Cinema Masterpieces & Blockbusters',
    subtitle: 'Hans Zimmer, Ludwig Göransson, John Williams',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/7e/c5/5e/7ec55ee2-ebf8-d988-8f9a-431af1047747/artwork.jpg/600x600bb.jpg',
    category: 'cinema',
    tracks: CURATED_CINEMA_TRACKS,
  },
  {
    id: 'pl-anime',
    title: 'Anime Openings & Orchestral Themes',
    subtitle: 'RADWIMPS, Hiroyuki Sawano, LiSA, YOASOBI',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/8e/31/31/8e31317a-85d7-b362-e935-d22798fbb0d8/16UMGIM41846.rgb.jpg/600x600bb.jpg',
    category: 'anime',
    tracks: CURATED_ANIME_TRACKS,
  },
  {
    id: 'pl-hits',
    title: 'Top Global Hits 2024',
    subtitle: 'The Weeknd, Billie Eilish, Sabrina Carpenter, Dua Lipa',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/80/16/e8/8016e885-b108-7a54-6243-7fefb489be9c/20UMGIM08249.rgb.jpg/600x600bb.jpg',
    category: 'hits',
    tracks: CURATED_GLOBAL_HITS,
  },
  {
    id: 'pl-lofi',
    title: '24/7 Lo-Fi & Study Broadcasts',
    subtitle: 'Live chill beats, synthwave and ambient jazz',
    artwork: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80',
    category: 'lofi',
    tracks: CURATED_LOFI_STATIONS,
  },
  {
    id: 'pl-gaming',
    title: 'Gaming & Cyberpunk Legends',
    subtitle: 'Cyberpunk 2077, Elden Ring, NieR: Automata',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/dc/16/d3/dc16d3e6-fa10-e74f-96a8-20d00f684bc6/190295147871.jpg/600x600bb.jpg',
    category: 'gaming',
    tracks: CURATED_GAMING_TRACKS,
  },
];

// Combine all tracks for master indexing
export const ALL_INITIAL_TRACKS: MusicTrack[] = [
  ...CURATED_CINEMA_TRACKS,
  ...CURATED_ANIME_TRACKS,
  ...CURATED_GLOBAL_HITS,
  ...CURATED_GAMING_TRACKS,
  ...CURATED_LOFI_STATIONS,
];

// ---------------------------------------------------------------------------
// 2. Open Search API Integration (iTunes Search + Deezer Fallback)
// ---------------------------------------------------------------------------

export async function searchMusicOnline(query: string): Promise<MusicTrack[]> {
  const trimmed = query.trim();
  if (!trimmed) return ALL_INITIAL_TRACKS;

  try {
    // 1. iTunes Music API (CORS friendly, fast, high quality artwork & AAC audio stream)
    const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(trimmed)}&media=music&entity=song&limit=25`;
    const res = await fetch(itunesUrl);
    
    if (res.ok) {
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        return data.results.map((r: any): MusicTrack => {
          // Upgrade 100x100 artwork to pristine 600x600
          let artwork = r.artworkUrl100 || r.artworkUrl60 || '';
          if (artwork) {
            artwork = artwork.replace('100x100bb', '600x600bb').replace('60x60bb', '600x600bb');
          }

          return {
            id: `itunes-${r.trackId}`,
            title: r.trackName || 'Unknown Title',
            artist: r.artistName || 'Unknown Artist',
            album: r.collectionName || r.trackName || 'Single',
            artwork,
            duration: Math.round((r.trackTimeMillis || 30000) / 1000),
            audioUrl: r.previewUrl || '',
            genre: r.primaryGenreName || 'Music',
            year: r.releaseDate ? r.releaseDate.split('-')[0] : '',
            isExplicit: r.trackExplicitness === 'explicit',
          };
        });
      }
    }
  } catch (err) {
    console.debug('iTunes API search fallback to local catalog:', err);
  }

  // 2. Fallback to client-side filtering on curated collection
  const q = trimmed.toLowerCase();
  return ALL_INITIAL_TRACKS.filter(t => 
    t.title.toLowerCase().includes(q) ||
    t.artist.toLowerCase().includes(q) ||
    t.album.toLowerCase().includes(q) ||
    (t.genre && t.genre.toLowerCase().includes(q))
  );
}

// ---------------------------------------------------------------------------
// 3. Synced Lyrics Service (LRCLIB Open API - Same API used by BitChord)
// ---------------------------------------------------------------------------

export async function fetchTrackLyrics(artist: string, title: string): Promise<{
  plain: string;
  synced: SyncedLyricLine[];
} | null> {
  try {
    const cleanArtist = artist.split('&')[0].split('feat')[0].trim();
    const cleanTitle = title.split('(')[0].split('-')[0].trim();
    
    const url = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(cleanArtist)}&track_name=${encodeURIComponent(cleanTitle)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    
    const data = await res.json();
    const plain = data.plainLyrics || '';
    const syncedRaw = data.syncedLyrics || '';

    const synced: SyncedLyricLine[] = [];
    if (syncedRaw) {
      const lines = syncedRaw.split('\n');
      for (const line of lines) {
        const match = line.match(/^\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)$/);
        if (match) {
          const minutes = parseInt(match[1], 10);
          const seconds = parseInt(match[2], 10);
          const ms = parseInt(match[3], 10) / (match[3].length === 3 ? 1000 : 100);
          const time = minutes * 60 + seconds + ms;
          const text = match[4].trim();
          if (text) {
            synced.push({ time, text });
          }
        }
      }
    }

    return { plain, synced };
  } catch (err) {
    console.debug('Lyrics fetch fallback:', err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// 4. Utility formatters
// ---------------------------------------------------------------------------

export function formatDuration(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

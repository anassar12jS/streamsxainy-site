import React, { useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Play, Pause, ChevronRight, ChevronLeft, MoreHorizontal, 
  Plus, Disc, Heart, Sparkles, ExternalLink, Music2, Radio
} from 'lucide-react';
import { useMusicPlayerStore } from '../store/useMusicPlayerStore';
import { APPLE_MUSIC_BROWSE_SECTIONS } from '../api/innertube';
import { MusicTrack } from '../types';

export const BITCHORD_HOME_TRACKS: MusicTrack[] = [
  // Left Column
  {
    id: 'bitchord-1',
    title: "No One's Deserving",
    artist: 'Superheaven',
    artistId: 'UC3u1g-8w_a9_Y1XpQcM715Q',
    album: 'Jar',
    albumId: 'MPREb_kZ32L3x7eJ8',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/e3/6b/0c/e36b0c1b-5a7f-d776-6717-5110a40b3286/cover.jpg/600x600bb.jpg',
    duration: 184,
    youtubeId: 'ScTODhHAqFc',
  },
  {
    id: 'bitchord-2',
    title: 'Youngest Daughter',
    artist: 'Superheaven',
    artistId: 'UC3u1g-8w_a9_Y1XpQcM715Q',
    album: 'Jar',
    albumId: 'MPREb_kZ32L3x7eJ8',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/e3/6b/0c/e36b0c1b-5a7f-d776-6717-5110a40b3286/cover.jpg/600x600bb.jpg',
    duration: 250,
    youtubeId: 'VMk6i7Q0k54',
  },
  {
    id: 'bitchord-3',
    title: 'Tonight (demo)',
    artist: 'Amira Elfeky',
    artistId: 'UCy8x1qMv2p3l7qD_XJ9Z0WA',
    album: 'Tonight (demo) - Single',
    albumId: 'MPREb_7mN0kL1z7x9',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/04/dd/24/04dd2474-11ef-c30f-abc2-7fb80e1ef095/075679660244.jpg/600x600bb.jpg',
    duration: 156,
    youtubeId: 'ErDRcmM7PaY',
  },
  {
    id: 'bitchord-4',
    title: 'smoky',
    artist: 'Nextime, Richmnkey',
    artistId: 'UC9wRz2B6e21E2Z_rFmQ269A',
    album: 'smoky - Single',
    albumId: 'MPREb_2pL5w9Z2x1a',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/24/79/09/24790923-4a1f-08df-0653-d132a65a4273/artwork.jpg/600x600bb.jpg',
    duration: 138,
    youtubeId: 'Wq9dXy615jE',
  },
  // Right Column
  {
    id: 'bitchord-5',
    title: 'Enough for you',
    artist: 'Wisp',
    artistId: 'UC2wRz2B6e21E2Z_rFmQ269A',
    album: 'Pandora',
    albumId: 'MPREb_3fD5kL1z7x9',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/33/fd/32/33fd32b1-0e43-9b4a-8ed6-19643f23544e/21UMGIM26092.rgb.jpg/600x600bb.jpg',
    duration: 228,
    youtubeId: 'IL4YmAxxQzM',
  },
  {
    id: 'bitchord-6',
    title: 'Where Is My Mind?',
    artist: 'Pixies',
    artistId: 'UCY4s2D_iR2gM7l8xUj0t8wA',
    album: 'Surfer Rosa',
    albumId: 'MPREb_8kL4w9Z2x1a',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/68/b7/c0/68b7c018-dc15-f44a-2611-be10237fc9a5/652637080308.png/600x600bb.jpg',
    duration: 233,
    youtubeId: '49FB9hhoO6c',
  },
  {
    id: 'bitchord-7',
    title: 'darkest days',
    artist: 'CHANGETHEWXRLD',
    artistId: 'UCh1kL4w9Z2x1aM7l8xUj0t8',
    album: 'darkest days - Single',
    albumId: 'MPREb_4kL4w9Z2x1a',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/bd/a3/31/bda33193-ad5f-9425-3b2a-239bd397b791/artwork.jpg/600x600bb.jpg',
    duration: 161,
    youtubeId: 'EdIWrRcxH8o',
  },
  {
    id: 'bitchord-8',
    title: 'resonance (midwest emo version)',
    artist: 'jacal',
    artistId: 'UCj7kL4w9Z2x1aM7l8xUj0t8',
    album: 'resonance - Single',
    albumId: 'MPREb_5kL4w9Z2x1a',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/bc/f6/85/bcf685cd-573a-f9df-72f9-7c0a0cae0377/663918143896.jpg/600x600bb.jpg',
    duration: 195,
    youtubeId: 'LdVtUo-xngw',
  },
];

export const BITCHORD_LIBRARY_ALBUMS = [
  {
    id: 'MPREb_kZ32L3x7eJ8',
    title: 'Jar',
    artist: 'Superheaven',
    artistId: 'UC3u1g-8w_a9_Y1XpQcM715Q',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/e3/6b/0c/e36b0c1b-5a7f-d776-6717-5110a40b3286/cover.jpg/600x600bb.jpg',
    tracks: BITCHORD_HOME_TRACKS.slice(0, 2),
  },
  {
    id: 'MPREb_3fD5kL1z7x9',
    title: 'Pandora',
    artist: 'Wisp',
    artistId: 'UC2wRz2B6e21E2Z_rFmQ269A',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/33/fd/32/33fd32b1-0e43-9b4a-8ed6-19643f23544e/21UMGIM26092.rgb.jpg/600x600bb.jpg',
    tracks: [BITCHORD_HOME_TRACKS[4]],
  },
  {
    id: 'MPREb_8kL4w9Z2x1a',
    title: 'Surfer Rosa',
    artist: 'Pixies',
    artistId: 'UCY4s2D_iR2gM7l8xUj0t8wA',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/68/b7/c0/68b7c018-dc15-f44a-2611-be10237fc9a5/652637080308.png/600x600bb.jpg',
    tracks: [BITCHORD_HOME_TRACKS[5]],
  },
  {
    id: 'MPREb_U81Qp66p0oT',
    title: 'HIT ME HARD AND SOFT',
    artist: 'Billie Eilish',
    artistId: 'UCiGm_E4DwYcU-dRkg2bd0MQ',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/71/6a/5f/716a5fae-7833-255e-2b1b-b21a37c35e38/24UMGIM36919.rgb.jpg/600x600bb.jpg',
    tracks: [],
  },
];

export const BrowseRoute: React.FC = () => {
  const navigate = useNavigate();
  const playTrack = useMusicPlayerStore(state => state.playTrack);
  const currentTrack = useMusicPlayerStore(state => state.currentTrack);
  const playbackStatus = useMusicPlayerStore(state => state.playbackStatus);
  const togglePlayPause = useMusicPlayerStore(state => state.togglePlayPause);
  const toggleLike = useMusicPlayerStore(state => state.toggleLike);
  const isLiked = useMusicPlayerStore(state => state.isLiked);
  const addToQueue = useMusicPlayerStore(state => state.addToQueue);

  const [activeMenuTrackId, setActiveMenuTrackId] = useState<string | null>(null);
  const carouselRef = useRef<HTMLDivElement | null>(null);

  const isPlayingTrack = (trackId: string) => {
    return currentTrack?.id === trackId && playbackStatus === 'playing';
  };

  // Instant 1-click playback handler
  const handleTrackClick = (track: MusicTrack) => {
    if (currentTrack?.id === track.id) {
      if (playbackStatus === 'playing') {
        togglePlayPause();
      } else {
        playTrack(track, BITCHORD_HOME_TRACKS);
      }
    } else {
      playTrack(track, BITCHORD_HOME_TRACKS);
    }
  };

  const scrollCarousel = (direction: 'left' | 'right') => {
    if (!carouselRef.current) return;
    const distance = 420;
    carouselRef.current.scrollBy({
      left: direction === 'right' ? distance : -distance,
      behavior: 'smooth',
    });
  };

  const leftColumnTracks = BITCHORD_HOME_TRACKS.slice(0, 4);
  const rightColumnTracks = BITCHORD_HOME_TRACKS.slice(4, 8);

  const renderTrackItem = (track: MusicTrack) => {
    const isCurrent = currentTrack?.id === track.id;
    const isPlaying = isPlayingTrack(track.id);
    const isTrackLiked = isLiked(track.id);
    const isMenuOpen = activeMenuTrackId === track.id;

    return (
      <div
        key={track.id}
        onClick={() => handleTrackClick(track)}
        className={`group relative flex items-center justify-between p-2 rounded-xl transition-colors cursor-pointer select-none ${
          isCurrent ? 'bg-[rgba(255,255,255,0.08)]' : 'hover:bg-[#1a1a1a]'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          {/* Artwork Thumbnail with Hover Play Button */}
          <div className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-[#242426]">
            <img 
              src={track.artwork} 
              alt={track.title}
              className="w-full h-full object-cover transition-transform group-hover:scale-105" 
            />
            
            {/* Play Overlay */}
            <div className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${
              isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            }`}>
              {isPlaying ? (
                <Pause className="w-5 h-5 text-white fill-current" />
              ) : (
                <Play className="w-5 h-5 text-white fill-current ml-0.5" />
              )}
            </div>
          </div>

          {/* Title & Artist */}
          <div className="min-w-0 flex flex-col justify-center">
            <span className={`text-sm font-semibold truncate ${
              isCurrent ? 'text-rose-400 font-bold' : 'text-white group-hover:text-white'
            }`}>
              {track.title}
            </span>
            <span className="text-xs text-[#b3b3b3] truncate mt-0.5">
              {track.artistId ? (
                <Link
                  to={`/music/artist/${track.artistId}`}
                  onClick={(e) => e.stopPropagation()}
                  className="hover:text-white hover:underline transition-colors"
                >
                  {track.artist}
                </Link>
              ) : (
                <span>{track.artist}</span>
              )}
            </span>
          </div>
        </div>

        {/* Three dots contextual menu */}
        <div className="relative flex items-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setActiveMenuTrackId(isMenuOpen ? null : track.id);
            }}
            className="opacity-0 group-hover:opacity-100 p-2 text-white/40 hover:text-white rounded-lg hover:bg-white/5 transition-all"
            title="Options"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {/* Popover Action Menu */}
          {isMenuOpen && (
            <div 
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 top-full mt-1 w-48 bg-[#1e1e20] border border-white/10 rounded-2xl shadow-2xl z-40 p-1.5 text-xs animate-in fade-in zoom-in-95"
            >
              <button
                type="button"
                onClick={() => {
                  addToQueue(track, true);
                  setActiveMenuTrackId(null);
                }}
                className="w-full text-left px-3 py-2 rounded-xl hover:bg-white/10 flex items-center gap-2 text-white/80 hover:text-white"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Play Next</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  addToQueue(track, false);
                  setActiveMenuTrackId(null);
                }}
                className="w-full text-left px-3 py-2 rounded-xl hover:bg-white/10 flex items-center gap-2 text-white/80 hover:text-white"
              >
                <Disc className="w-3.5 h-3.5" />
                <span>Add to Queue</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  toggleLike(track.id);
                  setActiveMenuTrackId(null);
                }}
                className="w-full text-left px-3 py-2 rounded-xl hover:bg-white/10 flex items-center gap-2 text-white/80 hover:text-white"
              >
                <Heart className={`w-3.5 h-3.5 ${isTrackLiked ? 'fill-rose-500 text-rose-500' : ''}`} />
                <span>{isTrackLiked ? 'Favorited' : 'Add to Favorites'}</span>
              </button>

              {track.artistId && (
                <button
                  type="button"
                  onClick={() => {
                    navigate(`/music/artist/${track.artistId}`);
                    setActiveMenuTrackId(null);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-white/10 flex items-center gap-2 text-white/80 hover:text-white border-t border-white/5 mt-1 pt-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Go to Artist</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-10 animate-fade-in pb-40 pt-2 px-1 sm:px-4 max-w-7xl mx-auto">
      
      {/* 1. Header: Home */}
      <div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Home
        </h1>
      </div>

      {/* 2. Recently Played Section */}
      <div className="space-y-3">
        <div 
          onClick={() => navigate('/music/library/recent')}
          className="inline-flex items-center gap-1.5 cursor-pointer group"
        >
          <h2 className="text-lg sm:text-xl font-bold text-white group-hover:text-rose-400 transition-colors">
            Recently Played
          </h2>
          <ChevronRight className="w-5 h-5 text-white/50 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
        </div>

        {/* 2-Column Grid (4 rows per column) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
          <div className="space-y-1">
            {leftColumnTracks.map(renderTrackItem)}
          </div>
          <div className="space-y-1">
            {rightColumnTracks.map(renderTrackItem)}
          </div>
        </div>
      </div>

      {/* 3. From your library Section */}
      <div className="space-y-4 pt-2 relative group/carousel">
        <div 
          onClick={() => navigate('/music/library/albums')}
          className="inline-flex items-center gap-1.5 cursor-pointer group"
        >
          <h2 className="text-lg sm:text-xl font-bold text-white group-hover:text-rose-400 transition-colors">
            From your library
          </h2>
          <ChevronRight className="w-5 h-5 text-white/50 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
        </div>

        {/* Left Carousel Arrow */}
        <button
          type="button"
          onClick={() => scrollCarousel('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-[#28282b]/90 hover:bg-[#343438] border border-white/10 text-white flex items-center justify-center shadow-2xl transition-all cursor-pointer z-10 hover:scale-105"
          title="Previous"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Horizontal Card Row */}
        <div 
          ref={carouselRef}
          className="flex items-center gap-5 overflow-x-auto pb-4 pt-1 no-scrollbar scroll-smooth px-2"
        >
          {BITCHORD_LIBRARY_ALBUMS.map(album => (
            <div
              key={album.id}
              onClick={() => {
                if (album.tracks && album.tracks.length > 0) {
                  playTrack(album.tracks[0], album.tracks);
                }
              }}
              className="group/card flex-shrink-0 w-[240px] sm:w-[280px] bg-[#141414] hover:bg-[#1a1a1a] border border-white/5 rounded-2xl overflow-hidden p-3 transition-colors duration-150 cursor-pointer shadow-lg"
            >
              {/* Artwork */}
              <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-[#242426]">
                <img 
                  src={album.artwork} 
                  alt={album.title}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover/card:scale-105" 
                />

                {/* Floating Play Button on Card */}
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/card:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center shadow-xl hover:scale-110 active:scale-95 transition-transform">
                    <Play className="w-6 h-6 fill-current ml-0.5" />
                  </div>
                </div>
              </div>

              {/* Title & Artist */}
              <div className="mt-3 px-1">
                <h3 
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/music/album/${album.id}`);
                  }}
                  className="font-semibold text-sm text-white truncate hover:underline cursor-pointer"
                >
                  {album.title}
                </h3>
                <p className="text-xs text-[#b3b3b3] truncate mt-0.5">
                  {(album as any).artistId ? (
                    <Link
                      to={`/music/artist/${(album as any).artistId}`}
                      onClick={(e) => e.stopPropagation()}
                      className="hover:text-white hover:underline transition-colors"
                    >
                      {album.artist}
                    </Link>
                  ) : (
                    <span>{album.artist}</span>
                  )}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Right Carousel Arrow Button */}
        <button
          type="button"
          onClick={() => scrollCarousel('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-[#28282b]/90 hover:bg-[#343438] border border-white/10 text-white flex items-center justify-center shadow-2xl transition-all cursor-pointer z-10 hover:scale-105"
          title="Next"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* 4. Featured Playlists & Soundtracks Shelf */}
      <div className="space-y-4 pt-4">
        <div 
          onClick={() => navigate('/music/browse')}
          className="inline-flex items-center gap-1.5 cursor-pointer group"
        >
          <h2 className="text-lg sm:text-xl font-bold text-white group-hover:text-rose-400 transition-colors">
            Featured Soundtracks & Playlists
          </h2>
          <ChevronRight className="w-5 h-5 text-white/50 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {APPLE_MUSIC_BROWSE_SECTIONS.heroSpotlight.map(spot => (
            <div
              key={spot.id}
              onClick={() => navigate(`/music/playlist/${spot.targetId}`)}
              className="group p-4 rounded-3xl bg-[#1a1a1c] hover:bg-[#222226] border border-white/5 cursor-pointer transition-all shadow-xl hover:scale-[1.01]"
            >
              <div className="relative aspect-[16/9] rounded-2xl overflow-hidden mb-3 bg-[#242426]">
                <img 
                  src={spot.artwork} 
                  alt={spot.title} 
                  onError={(e) => {
                    const fallbackMap: Record<string, string> = {
                      'spot-1': 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=1200&q=80',
                      'spot-2': 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80',
                      'spot-3': 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=1200&q=80',
                    };
                    (e.target as HTMLImageElement).src = fallbackMap[spot.id] || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1200&q=80';
                  }}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                />
                <div className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full bg-black/70 backdrop-blur-md text-[10px] font-mono font-bold text-[#fa243c]">
                  {spot.badge}
                </div>
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center shadow-xl">
                    <Play className="w-6 h-6 fill-current ml-0.5" />
                  </div>
                </div>
              </div>

              <h4 className="font-bold text-sm text-white truncate">
                {spot.title}
              </h4>
              <p className="text-xs text-white/50 truncate mt-0.5">
                {spot.artist}
              </p>
              <p className="text-[11px] text-white/40 mt-1 line-clamp-1">
                {spot.description}
              </p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};

export const BrowseView = BrowseRoute;
export default BrowseRoute;

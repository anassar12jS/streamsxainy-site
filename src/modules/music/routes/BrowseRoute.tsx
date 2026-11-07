import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Pause, ChevronRight, MoreHorizontal, ChevronLeft } from 'lucide-react';
import { useMusicPlayerStore } from '../store/useMusicPlayerStore';
import { MusicTrack } from '../types';

export const BITCHORD_HOME_TRACKS: MusicTrack[] = [
  // Left Column
  {
    id: 'bitchord-1',
    title: "No One's Deserving",
    artist: 'Superheaven',
    album: 'Jar',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/e3/6b/0c/e36b0c1b-5a7f-d776-6717-5110a40b3286/cover.jpg/600x600bb.jpg',
    duration: 184,
    youtubeId: 'ScTODhHAqFc',
  },
  {
    id: 'bitchord-2',
    title: 'Youngest Daughter',
    artist: 'Superheaven',
    album: 'Jar',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/e3/6b/0c/e36b0c1b-5a7f-d776-6717-5110a40b3286/cover.jpg/600x600bb.jpg',
    duration: 250,
    youtubeId: 'VMk6i7Q0k54',
  },
  {
    id: 'bitchord-3',
    title: 'Tonight (demo)',
    artist: 'Amira Elfeky',
    album: 'Tonight (demo) - Single',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/04/dd/24/04dd2474-11ef-c30f-abc2-7fb80e1ef095/075679660244.jpg/600x600bb.jpg',
    duration: 156,
    youtubeId: 'ErDRcmM7PaY',
  },
  {
    id: 'bitchord-4',
    title: 'smoky',
    artist: 'Nextime, Richmnkey',
    album: 'smoky - Single',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/24/79/09/24790923-4a1f-08df-0653-d132a65a4273/artwork.jpg/600x600bb.jpg',
    duration: 138,
    youtubeId: 'Wq9dXy615jE',
  },
  // Right Column
  {
    id: 'bitchord-5',
    title: 'Enough for you',
    artist: 'Wisp',
    album: 'Pandora',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/33/fd/32/33fd32b1-0e43-9b4a-8ed6-19643f23544e/21UMGIM26092.rgb.jpg/600x600bb.jpg',
    duration: 228,
    youtubeId: 'IL4YmAxxQzM',
  },
  {
    id: 'bitchord-6',
    title: 'Where Is My Mind?',
    artist: 'Pixies',
    album: 'Surfer Rosa',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/68/b7/c0/68b7c018-dc15-f44a-2611-be10237fc9a5/652637080308.png/600x600bb.jpg',
    duration: 233,
    youtubeId: '49FB9hhoO6c',
  },
  {
    id: 'bitchord-7',
    title: 'darkest days',
    artist: 'CHANGETHEWXRLD',
    album: 'darkest days - Single',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/bd/a3/31/bda33193-ad5f-9425-3b2a-239bd397b791/artwork.jpg/600x600bb.jpg',
    duration: 161,
    youtubeId: 'EdIWrRcxH8o',
  },
  {
    id: 'bitchord-8',
    title: 'resonance (midwest emo version)',
    artist: 'jacal',
    album: 'resonance - Single',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/bc/f6/85/bcf685cd-573a-f9df-72f9-7c0a0cae0377/663918143896.jpg/600x600bb.jpg',
    duration: 195,
    youtubeId: 'LdVtUo-xngw',
  },
];

export const BITCHORD_LIBRARY_ALBUMS = [
  {
    id: 'lib-jar',
    title: 'Jar',
    artist: 'Superheaven',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/e3/6b/0c/e36b0c1b-5a7f-d776-6717-5110a40b3286/cover.jpg/600x600bb.jpg',
    tracks: BITCHORD_HOME_TRACKS.slice(0, 2),
  },
  {
    id: 'lib-sade',
    title: 'The Best of Sade',
    artist: 'Sade',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/ec/3b/6e/ec3b6e82-e64e-fa68-19e0-f1c7d2c3e1e2/886444983050.jpg/600x600bb.jpg',
    tracks: [
      {
        id: 'sade-kiss-life',
        title: 'Kiss of Life',
        artist: 'Sade',
        album: 'The Best of Sade',
        artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/ec/3b/6e/ec3b6e82-e64e-fa68-19e0-f1c7d2c3e1e2/886444983050.jpg/600x600bb.jpg',
        duration: 300,
        youtubeId: 'ScTODhHAqFc',
      }
    ],
  },
  {
    id: 'lib-shoegaze',
    title: 'Shoegaze & Midwest Emo',
    artist: 'Curated Collection',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/33/fd/32/33fd32b1-0e43-9b4a-8ed6-19643f23544e/21UMGIM26092.rgb.jpg/600x600bb.jpg',
    tracks: BITCHORD_HOME_TRACKS.slice(4, 8),
  },
  {
    id: 'lib-alt',
    title: 'Surfer Rosa & Classics',
    artist: 'Pixies & Alt Icons',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/68/b7/c0/68b7c018-dc15-f44a-2611-be10237fc9a5/652637080308.png/600x600bb.jpg',
    tracks: [BITCHORD_HOME_TRACKS[5]],
  },
];

export const BrowseRoute: React.FC = () => {
  const navigate = useNavigate();
  const setTrack = useMusicPlayerStore(state => state.setTrack);
  const currentTrack = useMusicPlayerStore(state => state.currentTrack);
  const playbackStatus = useMusicPlayerStore(state => state.playbackStatus);
  const togglePlayPause = useMusicPlayerStore(state => state.togglePlayPause);

  const carouselRef = useRef<HTMLDivElement | null>(null);

  const isPlayingTrack = (trackId: string) => {
    return currentTrack?.id === trackId && playbackStatus === 'playing';
  };

  const handleTrackClick = (track: MusicTrack) => {
    if (currentTrack?.id === track.id) {
      togglePlayPause();
    } else {
      setTrack(track, BITCHORD_HOME_TRACKS);
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

    return (
      <div
        key={track.id}
        onClick={() => handleTrackClick(track)}
        className="group relative flex items-center justify-between p-2 rounded-xl hover:bg-[#202022]/80 transition-colors cursor-pointer select-none"
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
              isCurrent ? 'text-rose-400' : 'text-white group-hover:text-white'
            }`}>
              {track.title}
            </span>
            <span className="text-xs text-white/50 truncate mt-0.5">
              {track.artist}
            </span>
          </div>
        </div>

        {/* Three dots menu */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            useMusicPlayerStore.getState().addToQueue(track);
          }}
          className="opacity-0 group-hover:opacity-100 p-2 text-white/40 hover:text-white transition-opacity"
          title="Add to queue"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-8 animate-fade-in pb-32 pt-2 px-1 sm:px-4 max-w-7xl mx-auto">
      
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
      <div className="space-y-4 pt-4 relative group/carousel">
        <div 
          onClick={() => navigate('/music/library/albums')}
          className="inline-flex items-center gap-1.5 cursor-pointer group"
        >
          <h2 className="text-lg sm:text-xl font-bold text-white group-hover:text-rose-400 transition-colors">
            From your library
          </h2>
          <ChevronRight className="w-5 h-5 text-white/50 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
        </div>

        {/* Horizontal Card Row */}
        <div 
          ref={carouselRef}
          className="flex items-center gap-5 overflow-x-auto pb-4 pt-1 no-scrollbar scroll-smooth"
        >
          {BITCHORD_LIBRARY_ALBUMS.map(album => (
            <div
              key={album.id}
              onClick={() => {
                if (album.tracks && album.tracks.length > 0) {
                  setTrack(album.tracks[0], album.tracks);
                }
              }}
              className="group/card flex-shrink-0 w-[240px] sm:w-[280px] bg-[#1e1e20] hover:bg-[#262629] border border-white/5 rounded-2xl overflow-hidden p-3 transition-all cursor-pointer shadow-lg"
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
                <h3 className="font-bold text-sm text-white truncate">
                  {album.title}
                </h3>
                <p className="text-xs text-white/50 truncate mt-0.5">
                  {album.artist}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Carousel Navigation Arrow Button (as visible in screenshot) */}
        <button
          type="button"
          onClick={() => scrollCarousel('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-[#28282b]/90 hover:bg-[#343438] border border-white/10 text-white flex items-center justify-center shadow-2xl transition-all cursor-pointer z-10 hover:scale-105"
          title="Next"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

    </div>
  );
};

export const BrowseView = BrowseRoute;
export default BrowseRoute;

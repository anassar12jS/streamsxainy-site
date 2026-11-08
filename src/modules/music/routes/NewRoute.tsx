import React, { useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Play, ChevronLeft, ChevronRight, Sparkles, Video, Disc } from 'lucide-react';
import { useMusicPlayerStore } from '../store/useMusicPlayerStore';
import { APPLE_MUSIC_BROWSE_SECTIONS } from '../api/innertube';
import { MusicTrack } from '../types';

interface MusicVideoItem {
  id: string;
  title: string;
  artist: string;
  artistId?: string;
  thumbnail: string;
  duration: string;
  youtubeId: string;
  views?: string;
}

const NEW_MUSIC_VIDEOS: MusicVideoItem[] = [
  {
    id: 'mv-1',
    title: 'Houdini (Official Music Video)',
    artist: 'Dua Lipa',
    artistId: 'dua-lipa',
    thumbnail: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&q=80',
    duration: '3:05',
    youtubeId: 'suAR1PYFNYA',
    views: '115M views',
  },
  {
    id: 'mv-2',
    title: 'vampire (Live & Studio Cut)',
    artist: 'Olivia Rodrigo',
    artistId: 'olivia-rodrigo',
    thumbnail: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=800&q=80',
    duration: '3:40',
    youtubeId: 'Zl3wG_m_tXo',
    views: '92M views',
  },
  {
    id: 'mv-3',
    title: 'Fortnight (feat. Post Malone)',
    artist: 'Taylor Swift',
    artistId: 'taylor-swift',
    thumbnail: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=800&q=80',
    duration: '3:48',
    youtubeId: 'q3zXXCF385g',
    views: '84M views',
  },
  {
    id: 'mv-4',
    title: 'Espresso (Official Visualizer)',
    artist: 'Sabrina Carpenter',
    artistId: 'sabrina-carpenter',
    thumbnail: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=800&q=80',
    duration: '2:55',
    youtubeId: 'eVli-tstM5E',
    views: '140M views',
  },
  {
    id: 'mv-5',
    title: 'Dune: Part Two Main Theme (Live Concert)',
    artist: 'Hans Zimmer',
    artistId: 'hans-zimmer',
    thumbnail: 'https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=800&q=80',
    duration: '4:20',
    youtubeId: 'N9qYF9DZPdw',
    views: '35M views',
  },
];

export const NewRoute: React.FC = () => {
  const navigate = useNavigate();
  const playTrack = useMusicPlayerStore(state => state.playTrack);
  const albumsScrollRef = useRef<HTMLDivElement | null>(null);
  const videosScrollRef = useRef<HTMLDivElement | null>(null);

  const scrollShelf = (ref: React.RefObject<HTMLDivElement | null>, direction: 'left' | 'right') => {
    if (!ref.current) return;
    const distance = 460;
    ref.current.scrollBy({
      left: direction === 'right' ? distance : -distance,
      behavior: 'smooth',
    });
  };

  const handlePlayAlbum = (album: any) => {
    navigate(`/music/album/${album.id}`);
  };

  const handlePlayVideoAsTrack = (video: MusicVideoItem) => {
    const track: MusicTrack = {
      id: `vid-${video.id}`,
      title: video.title,
      artist: video.artist,
      artistId: video.artistId,
      album: 'Music Video',
      artwork: video.thumbnail,
      duration: 210,
      youtubeId: video.youtubeId,
      source: 'innertube',
    };
    playTrack(track);
  };

  return (
    <div 
      className="space-y-10 animate-fade-in pb-32 pt-2 px-1 sm:px-4 max-w-7xl mx-auto"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      
      {/* 1. Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            New
          </h1>
          <p className="text-sm text-[#b3b3b3] mt-1 font-normal">
            Discover the latest releases, trending singles, and music videos.
          </p>
        </div>
      </div>

      {/* 2. Hero Release Spotlight */}
      <div className="relative rounded-2xl overflow-hidden p-6 sm:p-10 border border-white/10 bg-[#121212] shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div 
          className="absolute inset-0 bg-cover bg-center filter blur-3xl opacity-25 scale-125 pointer-events-none"
          style={{ backgroundImage: `url('https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/71/6a/5f/716a5fae-7833-255e-2b1b-b21a37c35e38/24UMGIM36919.rgb.jpg/600x600bb.jpg')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#121212] via-[#121212]/90 to-transparent pointer-events-none" />

        <div className="relative z-10 space-y-3 max-w-xl text-center md:text-left">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-white/50 bg-white/5 px-2.5 py-0.5 rounded-full border border-white/10">
            Featured Premiere
          </span>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
            HIT ME HARD AND SOFT
          </h2>
          <p className="text-sm text-[#b3b3b3] font-normal">
            Billie Eilish's critically acclaimed third studio album, featuring "LUNCH" and "BIRDS OF A FEATHER".
          </p>
          <div className="flex items-center justify-center md:justify-start gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate('/music/album/lib-billie')}
              className="px-6 py-2.5 rounded-full bg-white hover:bg-white/90 text-black font-semibold text-xs shadow-lg flex items-center gap-2 hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current ml-0.5" />
              <span>Listen Now</span>
            </button>
            <Link
              to="/music/artist/Billie%20Eilish"
              className="px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/15 text-white font-semibold text-xs flex items-center gap-2 border border-white/10 hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
              <span>Artist Profile</span>
            </Link>
          </div>
        </div>

        <div className="relative z-10 w-44 h-44 sm:w-56 sm:h-56 rounded-xl overflow-hidden shadow-2xl border border-white/10 shrink-0 bg-[#161616]">
          <img 
            src="https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/71/6a/5f/716a5fae-7833-255e-2b1b-b21a37c35e38/24UMGIM36919.rgb.jpg/600x600bb.jpg" 
            alt="Hit Me Hard and Soft" 
            className="w-full h-full object-cover"
          />
        </div>
      </div>

      {/* 3. SHELF: New albums & singles (Square Art) */}
      <div className="space-y-4 relative group/shelf">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              New albums & singles
            </h2>
            <p className="text-xs text-[#b3b3b3] mt-0.5 font-normal">
              Fresh long-plays, EPs, and worldwide debuts.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => scrollShelf(albumsScrollRef, 'left')}
              className="w-8 h-8 rounded-full bg-[#161616] hover:bg-[#222222] border border-white/10 text-white flex items-center justify-center transition-all cursor-pointer hover:scale-105"
              title="Previous"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => scrollShelf(albumsScrollRef, 'right')}
              className="w-8 h-8 rounded-full bg-[#161616] hover:bg-[#222222] border border-white/10 text-white flex items-center justify-center transition-all cursor-pointer hover:scale-105"
              title="Next"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Horizontal scroll container */}
        <div 
          ref={albumsScrollRef}
          className="flex items-center gap-4 overflow-x-auto pb-4 pt-1 am-scrollbar scroll-smooth"
        >
          {APPLE_MUSIC_BROWSE_SECTIONS.featuredAlbums.map(alb => (
            <div
              key={alb.id}
              onClick={() => handlePlayAlbum(alb)}
              className="group flex-shrink-0 w-[180px] sm:w-[210px] bg-[#141414] hover:bg-[#1a1a1a] border border-white/5 rounded-2xl p-3 transition-colors duration-150 cursor-pointer shadow-lg"
            >
              {/* Square Artwork */}
              <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-[#242426] mb-3">
                <img 
                  src={alb.artwork} 
                  alt={alb.title} 
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" 
                />
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shadow-xl">
                    <Play className="w-5 h-5 fill-current ml-0.5" />
                  </div>
                </div>
              </div>

              {/* Title & Artist */}
              <h3 
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/music/album/${alb.id}`);
                }}
                className="font-semibold text-sm text-white truncate hover:underline cursor-pointer"
              >
                {alb.title}
              </h3>
              <p className="text-xs text-[#b3b3b3] truncate mt-0.5">
                {(alb as any).artistId ? (
                  <Link
                    to={`/music/artist/${(alb as any).artistId}`}
                    onClick={(e) => e.stopPropagation()}
                    className="hover:text-white hover:underline transition-colors"
                  >
                    {alb.artist}
                  </Link>
                ) : (
                  <span>{alb.artist}</span>
                )}
              </p>
              <p className="text-[11px] text-[#777777] mt-0.5 font-normal">
                {alb.year || '2024'} • {alb.genre || 'Album'}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* 4. SHELF: New music videos (16:9 Thumbnails) */}
      <div className="space-y-4 relative group/shelf">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                <Video className="w-5 h-5 text-purple-400" />
                <span>New music videos</span>
              </h2>
              <p className="text-xs text-[#b3b3b3] mt-0.5 font-normal">
                High-definition music videos, live sessions, and official visuals.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => scrollShelf(videosScrollRef, 'left')}
              className="w-8 h-8 rounded-full bg-[#161616] hover:bg-[#222222] border border-white/10 text-white flex items-center justify-center transition-all cursor-pointer hover:scale-105"
              title="Previous"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => scrollShelf(videosScrollRef, 'right')}
              className="w-8 h-8 rounded-full bg-[#161616] hover:bg-[#222222] border border-white/10 text-white flex items-center justify-center transition-all cursor-pointer hover:scale-105"
              title="Next"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 16:9 Horizontal scroll container */}
        <div 
          ref={videosScrollRef}
          className="flex items-center gap-4 overflow-x-auto pb-4 pt-1 am-scrollbar scroll-smooth"
        >
          {NEW_MUSIC_VIDEOS.map(video => (
            <div
              key={video.id}
              onClick={() => handlePlayVideoAsTrack(video)}
              className="group flex-shrink-0 w-[280px] sm:w-[320px] bg-[#141414] hover:bg-[#1a1a1a] border border-white/5 rounded-2xl p-3 transition-colors duration-150 cursor-pointer shadow-lg"
            >
              {/* 16:9 Aspect Ratio Thumbnail */}
              <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-[#242426] mb-3">
                <img 
                  src={video.thumbnail} 
                  alt={video.title} 
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" 
                />
                <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="w-11 h-11 rounded-full bg-white text-black flex items-center justify-center shadow-xl">
                    <Play className="w-5 h-5 fill-current ml-0.5" />
                  </div>
                </div>
                <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/80 text-white text-[10px] font-mono rounded">
                  {video.duration}
                </div>
              </div>

              {/* Title & Artist */}
              <h3 className="font-semibold text-sm text-white truncate group-hover:underline">
                {video.title}
              </h3>
              <p className="text-xs text-[#b3b3b3] truncate mt-0.5">
                <Link
                  to={`/music/artist/${encodeURIComponent(video.artistId || video.artist)}`}
                  onClick={(e) => e.stopPropagation()}
                  className="hover:text-white hover:underline transition-colors"
                >
                  {video.artist}
                </Link>
                {video.views && (
                  <span className="text-[#777777] ml-2 font-normal">• {video.views}</span>
                )}
              </p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
export default NewRoute;

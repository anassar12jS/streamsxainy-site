import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Play, Shuffle, Disc, Heart, MoreHorizontal, Sparkles } from 'lucide-react';
import { useMusicPlayerStore } from '../store/useMusicPlayerStore';
import { TrackRow } from '../components/TrackRow';
import { BITCHORD_HOME_TRACKS, BITCHORD_LIBRARY_ALBUMS } from './BrowseRoute';
import { APPLE_MUSIC_BROWSE_SECTIONS } from '../api/innertube';
import { MusicTrack } from '../types';

export const ArtistRoute: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const setTrack = useMusicPlayerStore(state => state.setTrack);

  // Match or resolve artist details
  const artistName = id ? decodeURIComponent(id) : 'Hans Zimmer';

  const allTracks = [...BITCHORD_HOME_TRACKS, ...APPLE_MUSIC_BROWSE_SECTIONS.topTracks];
  const artistTracks = allTracks.filter(t => 
    t.artist.toLowerCase().includes(artistName.toLowerCase())
  );

  const displayTracks = artistTracks.length > 0 ? artistTracks : allTracks.slice(0, 6);

  const artistAvatar = displayTracks[0]?.artwork || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80';

  const handlePlayAll = (shuffle = false) => {
    if (displayTracks.length === 0) return;
    let list = [...displayTracks];
    if (shuffle) list.sort(() => Math.random() - 0.5);
    setTrack(list[0], list);
  };

  return (
    <div className="space-y-10 animate-fade-in pb-20 max-w-7xl mx-auto px-1 sm:px-4">
      
      {/* 1. Artist Hero Lockup */}
      <div className="relative rounded-3xl overflow-hidden p-6 sm:p-12 border border-white/10 bg-[#141416] shadow-2xl flex flex-col sm:flex-row items-center sm:items-end justify-between gap-6">
        <div 
          className="absolute inset-0 bg-cover bg-center filter blur-3xl opacity-25 scale-125"
          style={{ backgroundImage: `url(${artistAvatar})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#141416] via-black/60 to-transparent" />

        <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-center gap-6 text-center sm:text-left">
          <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full overflow-hidden shadow-2xl ring-4 ring-white/10 shrink-0">
            <img 
              src={artistAvatar} 
              alt={artistName} 
              className="w-full h-full object-cover" 
            />
          </div>

          <div className="space-y-2">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#fa243c] bg-[#fa243c]/15 px-3 py-1 rounded-full border border-[#fa243c]/30">
              Artist Spotlight
            </span>
            <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
              {artistName}
            </h1>
            <p className="text-xs sm:text-sm text-white/60 font-medium">
              Over 18.5M Monthly Listeners on Apple Music
            </p>
          </div>
        </div>

        {/* Play & Shuffle Buttons */}
        <div className="relative z-10 flex items-center gap-3">
          <button
            onClick={() => handlePlayAll(false)}
            className="px-6 py-2.5 rounded-2xl bg-[#fa243c] hover:bg-[#ff3b50] text-white font-bold text-xs shadow-xl flex items-center gap-2 hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current ml-0.5" />
            <span>Play</span>
          </button>
          <button
            onClick={() => handlePlayAll(true)}
            className="px-5 py-2.5 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs border border-white/10 flex items-center gap-2 hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            <Shuffle className="w-4 h-4" />
            <span>Shuffle</span>
          </button>
        </div>
      </div>

      {/* 2. Top Songs Shelf */}
      <div className="space-y-3">
        <h2 className="text-xl font-bold text-white tracking-tight">
          Top Songs
        </h2>

        <div className="bg-[#141416] p-3 rounded-3xl border border-white/5 space-y-0.5 shadow-xl">
          {displayTracks.map((track, idx) => (
            <TrackRow
              key={track.id}
              track={track}
              index={idx}
              playlistContext={displayTracks}
            />
          ))}
        </div>
      </div>

      {/* 3. Discography / Albums Shelf */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-white tracking-tight">
          Albums & Discography
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {BITCHORD_LIBRARY_ALBUMS.map((alb) => (
            <div
              key={alb.id}
              onClick={() => navigate(`/music/album/${alb.id}`)}
              className="group p-3 rounded-2xl bg-[#1a1a1c] hover:bg-[#242426] border border-white/5 cursor-pointer transition-all shadow-lg"
            >
              <div className="relative aspect-square rounded-xl overflow-hidden mb-3 bg-[#242426]">
                <img 
                  src={alb.artwork} 
                  alt={alb.title} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                />
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shadow-xl">
                    <Play className="w-5 h-5 fill-current ml-0.5" />
                  </div>
                </div>
              </div>

              <h4 className="font-bold text-xs sm:text-sm text-white truncate">
                {alb.title}
              </h4>
              <p className="text-[11px] text-white/50 truncate mt-0.5">
                {alb.artist}
              </p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};

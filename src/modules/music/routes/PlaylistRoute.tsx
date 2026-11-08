import React from 'react';
import { useParams } from 'react-router-dom';
import { Play, Shuffle, Heart, Music2, Share2, Sparkles } from 'lucide-react';
import { useMusicPlayerStore } from '../store/useMusicPlayerStore';
import { TrackRow } from '../components/TrackRow';
import { APPLE_MUSIC_BROWSE_SECTIONS } from '../api/innertube';
import { BITCHORD_HOME_TRACKS } from './BrowseRoute';
import { MusicTrack } from '../types';

export const PlaylistRoute: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const playTrack = useMusicPlayerStore(state => state.playTrack);

  // Match playlist or provide default curated playlist
  const spotlight = APPLE_MUSIC_BROWSE_SECTIONS.heroSpotlight.find(s => s.targetId === id) || {
    id: id || 'pl-curated',
    title: "Today's Hits 2025",
    artist: 'Apple Music Pop',
    description: 'The biggest songs and most streamed tracks across the globe in lossless audio.',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/71/6a/5f/716a5fae-7833-255e-2b1b-b21a37c35e38/24UMGIM36919.rgb.jpg/600x600bb.jpg',
    badge: 'FEATURED PLAYLIST',
  };

  const tracks: MusicTrack[] = [
    ...APPLE_MUSIC_BROWSE_SECTIONS.topTracks,
    ...BITCHORD_HOME_TRACKS,
  ];

  const handlePlayAll = (shuffle = false) => {
    let list = [...tracks];
    if (shuffle) list.sort(() => Math.random() - 0.5);
    if (list.length > 0) {
      playTrack(list[0], list);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-20 max-w-7xl mx-auto px-1 sm:px-4">
      
      {/* 1. Playlist Header */}
      <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6 sm:gap-8 pt-4 pb-6 border-b border-white/10">
        
        {/* Large 1:1 Artwork */}
        <div className="relative w-48 h-48 sm:w-56 sm:h-56 lg:w-64 lg:h-64 rounded-3xl overflow-hidden shadow-2xl border border-white/10 shrink-0 bg-[#161618]">
          <img 
            src={spotlight.artwork} 
            alt={spotlight.title} 
            className="w-full h-full object-cover" 
          />
        </div>

        {/* Metadata & Actions */}
        <div className="flex flex-col items-center sm:items-start text-center sm:text-left min-w-0 space-y-3">
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#fa243c] bg-[#fa243c]/15 px-3 py-1 rounded-full border border-[#fa243c]/30">
            {spotlight.badge || 'Playlist'}
          </span>

          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
            {spotlight.title}
          </h1>

          <p className="text-sm text-white/70 max-w-xl">
            {spotlight.description}
          </p>

          <p className="text-xs text-white/40 font-mono">
            Curated by {spotlight.artist} · {tracks.length} Songs · 1 hr 45 min
          </p>

          {/* Action Buttons: Play & Shuffle */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => handlePlayAll(false)}
              className="px-6 py-2.5 rounded-2xl bg-[#fa243c] hover:bg-[#ff3b50] text-white font-bold text-xs shadow-xl flex items-center gap-2 hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current ml-0.5" />
              <span>Play</span>
            </button>

            <button
              onClick={() => handlePlayAll(true)}
              className="px-5 py-2.5 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs flex items-center gap-2 border border-white/10 hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
              <Shuffle className="w-4 h-4" />
              <span>Shuffle</span>
            </button>
          </div>
        </div>

      </div>

      {/* 2. Tracklist Table */}
      <div className="space-y-1 bg-[#141416] p-3 rounded-3xl border border-white/5 shadow-xl">
        <div className="flex items-center justify-between px-3.5 py-2 text-[11px] font-mono font-bold text-white/40 uppercase tracking-wider border-b border-white/5 mb-1">
          <span># Title</span>
          <span className="hidden md:inline">Album</span>
          <span>Time</span>
        </div>

        {tracks.map((track, idx) => (
          <TrackRow
            key={`${track.id}-${idx}`}
            track={track}
            index={idx}
            showArtwork={true}
            playlistContext={tracks}
          />
        ))}
      </div>

    </div>
  );
};

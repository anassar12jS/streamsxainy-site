import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { Play, Shuffle, Heart, Music2, Share2, Sparkles, ArrowLeft } from 'lucide-react';
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
    title: "Today's Hits",
    artist: 'BitChord Editorial',
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
    <div 
      className="space-y-8 animate-fade-in pb-32 max-w-7xl mx-auto px-1 sm:px-4"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      
      {/* Back button */}
      <Link 
        to="/music" 
        className="inline-flex items-center gap-1.5 text-xs text-[#b3b3b3] hover:text-white transition-colors pt-1 cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Music Home</span>
      </Link>

      {/* 1. Playlist Header */}
      <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6 sm:gap-8 pt-2 pb-8 border-b border-white/10">
        
        {/* Large 1:1 Artwork */}
        <div className="relative w-48 h-48 sm:w-56 sm:h-56 lg:w-60 lg:h-60 rounded-xl overflow-hidden shadow-[0_16px_36px_rgba(0,0,0,0.8)] border border-white/10 shrink-0 bg-[#121212]">
          <img 
            src={spotlight.artwork} 
            alt={spotlight.title} 
            className="w-full h-full object-cover" 
          />
        </div>

        {/* Metadata & Actions */}
        <div className="flex flex-col items-center sm:items-start text-center sm:text-left min-w-0 space-y-3 flex-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-white/50 bg-white/5 px-2.5 py-0.5 rounded-full border border-white/10">
            {spotlight.badge || 'Playlist'}
          </span>

          <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
            {spotlight.title}
          </h1>

          <p className="text-sm text-[#b3b3b3] max-w-xl font-normal">
            {spotlight.description}
          </p>

          <p className="text-xs text-[#b3b3b3]">
            Curated by <span className="font-semibold text-white/90">{spotlight.artist}</span> • {tracks.length} Songs
          </p>

          {/* Action Buttons: Play & Shuffle */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => handlePlayAll(false)}
              className="px-6 py-2.5 rounded-full bg-white hover:bg-white/90 text-black font-semibold text-xs shadow-lg flex items-center gap-2 hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current ml-0.5" />
              <span>Play</span>
            </button>

            <button
              type="button"
              onClick={() => handlePlayAll(true)}
              className="px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/15 text-white font-semibold text-xs flex items-center gap-2 border border-white/10 hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
              <Shuffle className="w-4 h-4" />
              <span>Shuffle</span>
            </button>
          </div>
        </div>

      </div>

      {/* 2. Tracklist Table */}
      <div className="space-y-1">
        <div className="flex items-center justify-between px-3.5 py-2 text-[11px] font-semibold text-[#b3b3b3] uppercase tracking-wider border-b border-white/10 mb-2">
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


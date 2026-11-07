import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { Play, Shuffle, Heart, Disc, Sparkles, Clock, Share2 } from 'lucide-react';
import { APPLE_MUSIC_BROWSE_SECTIONS } from '../api/innertube';
import { TrackRow } from '../components/TrackRow';
import { useMusicPlayerStore } from '../store/useMusicPlayerStore';
import { MusicTrack } from '../types';

export const AlbumRoute: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const setTrack = useMusicPlayerStore(state => state.setTrack);

  // Look up album in curated collections or mock
  const albumMeta = APPLE_MUSIC_BROWSE_SECTIONS.featuredAlbums.find(a => a.id === id) || {
    id: id || 'album-default',
    title: 'Interstellar (Original Motion Picture Soundtrack)',
    artist: 'Hans Zimmer',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/7e/c5/5e/7ec55ee2-ebf8-d988-8f9a-431af1047747/artwork.jpg/600x600bb.jpg',
    year: '2014',
    genre: 'Soundtrack',
    trackCount: 16,
  };

  const albumTracks: MusicTrack[] = APPLE_MUSIC_BROWSE_SECTIONS.topTracks;

  const handlePlayAll = (shuffle = false) => {
    let list = [...albumTracks];
    if (shuffle) {
      list.sort(() => Math.random() - 0.5);
    }
    if (list.length > 0) {
      setTrack(list[0], list);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      
      {/* ========================================================================= */}
      {/* 1. ALBUM HEADER LOCKUP                                                    */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6 sm:gap-8 pt-4 pb-6 border-b border-white/10">
        
        {/* Large 1:1 Album Artwork */}
        <div className="relative w-48 h-48 sm:w-56 sm:h-56 lg:w-64 lg:h-64 rounded-3xl overflow-hidden shadow-2xl border border-white/10 shrink-0 bg-[#161618]">
          <img 
            src={albumMeta.artwork} 
            alt={albumMeta.title} 
            className="w-full h-full object-cover" 
          />
        </div>

        {/* Metadata & Actions */}
        <div className="flex flex-col items-center sm:items-start text-center sm:text-left min-w-0 space-y-3">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#fa243c] bg-[#fa243c]/15 px-3 py-1 rounded-full border border-[#fa243c]/30">
            Album · Apple Music Lossless
          </span>

          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
            {albumMeta.title}
          </h1>

          <p className="text-base sm:text-lg text-white/70 font-semibold">
            {albumMeta.artist}
          </p>

          <p className="text-xs text-white/40 font-mono">
            {albumMeta.genre} · {albumMeta.year} · {albumTracks.length} Songs
          </p>

          {/* Action Buttons: Play & Shuffle */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => handlePlayAll(false)}
              className="px-6 py-2.5 rounded-2xl bg-[#fa243c] hover:bg-[#ff3b50] text-white font-bold text-xs shadow-xl shadow-[#fa243c]/30 flex items-center gap-2 transition-all hover:scale-105 active:scale-95 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current ml-0.5" />
              <span>Play</span>
            </button>

            <button
              onClick={() => handlePlayAll(true)}
              className="px-5 py-2.5 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs flex items-center gap-2 border border-white/10 transition-all hover:scale-105 active:scale-95 cursor-pointer"
            >
              <Shuffle className="w-4 h-4" />
              <span>Shuffle</span>
            </button>
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* 2. TRACKLIST TABLE                                                        */}
      {/* ========================================================================= */}
      <div className="space-y-1 bg-[#141416] p-3 rounded-3xl border border-white/5 shadow-xl">
        <div className="flex items-center justify-between px-3.5 py-2 text-[11px] font-mono font-bold text-white/40 uppercase tracking-wider border-b border-white/5 mb-1">
          <span># Title</span>
          <span className="hidden md:inline">Album</span>
          <span>Time</span>
        </div>

        {albumTracks.map((track, idx) => (
          <TrackRow
            key={track.id}
            track={track}
            index={idx}
            showArtwork={false}
            playlistContext={albumTracks}
          />
        ))}
      </div>

      {/* Album Copyright & Release Info */}
      <div className="pt-6 text-xs text-white/40 space-y-1 font-mono">
        <p>© {albumMeta.year} WaterTower Music / Apple Music Lossless Publishing</p>
        <p>Mastered for Apple Music in 24-bit / 192kHz Spatial Audio</p>
      </div>

    </div>
  );
};

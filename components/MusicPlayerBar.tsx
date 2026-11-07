import React from 'react';
import { 
  Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1,
  Volume2, VolumeX, Heart, Maximize2, Mic2, ListMusic, Music2, Radio
} from 'lucide-react';
import { useMusic } from '../services/MusicContext';
import { formatDuration } from '../services/musicService';

export const MusicPlayerBar: React.FC = () => {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    isShuffle,
    repeatMode,
    isExpanded,
    showLyrics,
    showQueue,
    togglePlayPause,
    nextTrack,
    prevTrack,
    seek,
    setVolume,
    toggleMute,
    toggleShuffle,
    cycleRepeat,
    toggleLike,
    isLiked,
    setIsExpanded,
    setShowLyrics,
    setShowQueue,
    queue,
  } = useMusic();

  if (!currentTrack) return null;

  const liked = isLiked(currentTrack.id);
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div 
      className={`fixed bottom-0 left-0 right-0 z-40 transition-all duration-300 ${
        isExpanded ? 'translate-y-full opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'
      }`}
    >
      {/* Top thin scrubber bar for edge-to-edge feel */}
      <div 
        className="w-full h-1 bg-white/10 hover:h-2 cursor-pointer transition-all relative group"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          const ratio = Math.max(0, Math.min(1, clickX / rect.width));
          seek(ratio * duration);
        }}
      >
        <div 
          className="h-full bg-gradient-to-r from-rose-500 to-pink-500 relative transition-all"
          style={{ width: `${progressPercent}%` }}
        >
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>

      <div className="bg-[#0b0c10]/95 backdrop-blur-2xl border-t border-white/10 px-3 sm:px-6 py-2.5 shadow-2xl flex items-center justify-between gap-3 sm:gap-6">
        
        {/* ========================================================================= */}
        {/* 1. LEFT: TRACK INFO                                                      */}
        {/* ========================================================================= */}
        <div className="flex items-center gap-3 min-w-0 max-w-[200px] sm:max-w-[280px] lg:max-w-[340px]">
          <div 
            onClick={() => setIsExpanded(true)}
            className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 shadow-lg cursor-pointer group border border-white/10 bg-black/40"
          >
            <img 
              src={currentTrack.artwork} 
              alt={currentTrack.title} 
              className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <Maximize2 className="w-4 h-4 text-white" />
            </div>
            {currentTrack.isRadio && (
              <span className="absolute bottom-1 right-1 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-black animate-pulse" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h4 
                onClick={() => setIsExpanded(true)}
                className="text-xs sm:text-sm font-bold text-white truncate cursor-pointer hover:underline hover:text-rose-400 transition-colors"
                title={currentTrack.title}
              >
                {currentTrack.title}
              </h4>
              {currentTrack.isRadio && (
                <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-rose-400 bg-rose-500/15 px-1.5 py-0.2 rounded border border-rose-500/30 shrink-0">
                  LIVE
                </span>
              )}
            </div>
            <p className="text-[11px] text-white/50 truncate hover:text-white/80 transition-colors cursor-pointer">
              {currentTrack.artist}
            </p>
          </div>

          {/* Like Heart Button */}
          <button
            onClick={() => toggleLike(currentTrack)}
            className={`p-2 rounded-xl transition-all cursor-pointer ${
              liked 
                ? 'text-rose-500 hover:text-rose-400' 
                : 'text-white/40 hover:text-white hover:bg-white/5'
            }`}
            title={liked ? 'Remove from Liked' : 'Save to Liked'}
          >
            <Heart className={`w-4 h-4 ${liked ? 'fill-current scale-110' : ''}`} />
          </button>
        </div>

        {/* ========================================================================= */}
        {/* 2. CENTER: PLAYBACK CONTROLS & TIMELINE                                  */}
        {/* ========================================================================= */}
        <div className="flex flex-col items-center flex-1 max-w-[560px]">
          
          {/* Button Row */}
          <div className="flex items-center gap-1 sm:gap-4">
            
            {/* Shuffle */}
            <button
              onClick={toggleShuffle}
              className={`p-2 rounded-xl transition-all cursor-pointer hidden sm:block ${
                isShuffle ? 'text-rose-400 bg-rose-500/10' : 'text-white/40 hover:text-white hover:bg-white/5'
              }`}
              title={isShuffle ? 'Shuffle enabled' : 'Shuffle disabled'}
            >
              <Shuffle className="w-3.5 h-3.5" />
            </button>

            {/* Prev */}
            <button
              onClick={prevTrack}
              className="p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
              title="Previous Track"
            >
              <SkipBack className="w-4 h-4 fill-current" />
            </button>

            {/* Play/Pause */}
            <button
              onClick={togglePlayPause}
              className="w-10 h-10 rounded-full bg-white text-black hover:scale-105 active:scale-95 transition-all shadow-xl shadow-white/10 flex items-center justify-center cursor-pointer"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current ml-0.5" />
              )}
            </button>

            {/* Next */}
            <button
              onClick={nextTrack}
              className="p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
              title="Next Track"
            >
              <SkipForward className="w-4 h-4 fill-current" />
            </button>

            {/* Repeat */}
            <button
              onClick={cycleRepeat}
              className={`p-2 rounded-xl transition-all cursor-pointer hidden sm:block ${
                repeatMode !== 'off' ? 'text-rose-400 bg-rose-500/10' : 'text-white/40 hover:text-white hover:bg-white/5'
              }`}
              title={`Repeat: ${repeatMode}`}
            >
              {repeatMode === 'one' ? (
                <Repeat1 className="w-3.5 h-3.5" />
              ) : (
                <Repeat className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          {/* Time scrubber (Desktop) */}
          <div className="w-full hidden md:flex items-center gap-2 text-[10px] font-mono text-white/40 mt-1">
            <span className="w-9 text-right">{formatDuration(currentTime)}</span>
            
            <input 
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={(e) => seek(Number(e.target.value))}
              disabled={currentTrack.isRadio}
              className="flex-1 h-1 bg-white/15 rounded-lg appearance-none cursor-pointer accent-rose-500 hover:h-1.5 transition-all"
            />

            <span className="w-9 text-left">
              {currentTrack.isRadio ? 'LIVE' : formatDuration(duration)}
            </span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 3. RIGHT: UTILITIES, VOLUME & FULLSCREEN EXPAND                          */}
        {/* ========================================================================= */}
        <div className="flex items-center gap-1 sm:gap-2 justify-end">
          
          {/* Lyrics Button */}
          <button
            onClick={() => {
              setShowLyrics(!showLyrics);
              setIsExpanded(true);
            }}
            className={`p-2 rounded-xl transition-all cursor-pointer hidden lg:flex items-center gap-1.5 text-xs font-semibold ${
              showLyrics ? 'text-rose-400 bg-rose-500/15 border border-rose-500/30' : 'text-white/40 hover:text-white hover:bg-white/5'
            }`}
            title="Lyrics & Visualizer"
          >
            <Mic2 className="w-3.5 h-3.5" />
            <span>Lyrics</span>
          </button>

          {/* Queue Button */}
          <button
            onClick={() => {
              setShowQueue(!showQueue);
              setIsExpanded(true);
            }}
            className={`p-2 rounded-xl transition-all cursor-pointer relative hidden sm:flex items-center gap-1 text-xs ${
              showQueue ? 'text-rose-400 bg-rose-500/15 border border-rose-500/30' : 'text-white/40 hover:text-white hover:bg-white/5'
            }`}
            title="Queue"
          >
            <ListMusic className="w-4 h-4" />
            <span className="text-[10px] font-mono font-bold text-white/60">
              {queue.length}
            </span>
          </button>

          {/* Volume Control */}
          <div className="hidden md:flex items-center gap-1.5 group">
            <button
              onClick={toggleMute}
              className="p-2 text-white/50 hover:text-white transition-colors cursor-pointer"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4 text-red-400" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <input 
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={isMuted ? 0 : volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="w-16 lg:w-20 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-rose-500"
            />
          </div>

          {/* Fullscreen Expand Button */}
          <button
            onClick={() => setIsExpanded(true)}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all cursor-pointer ml-1"
            title="Expand Fullscreen Player (BitChord Mode)"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );
};
export default MusicPlayerBar;

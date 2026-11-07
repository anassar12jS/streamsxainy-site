import React from 'react';
import { 
  Shuffle, SkipBack, Play, Pause, SkipForward, Repeat, Repeat1,
  Volume2, VolumeX, Mic2, ListMusic, Menu, Disc3, Sparkles
} from 'lucide-react';
import { useMusicPlayerStore } from '../store/useMusicPlayerStore';

interface PlayerChromeProps {
  onToggleMobileSidebar: () => void;
  onSeek: (seconds: number) => void;
}

export const PlayerChrome: React.FC<PlayerChromeProps> = ({
  onToggleMobileSidebar,
  onSeek,
}) => {
  const currentTrack = useMusicPlayerStore(state => state.currentTrack);
  const playbackStatus = useMusicPlayerStore(state => state.playbackStatus);
  const currentTime = useMusicPlayerStore(state => state.currentTime);
  const duration = useMusicPlayerStore(state => state.duration);
  const volume = useMusicPlayerStore(state => state.volume);
  const isMuted = useMusicPlayerStore(state => state.isMuted);
  const shuffle = useMusicPlayerStore(state => state.shuffle);
  const repeatMode = useMusicPlayerStore(state => state.repeatMode);
  const showLyrics = useMusicPlayerStore(state => state.showLyrics);
  const showQueue = useMusicPlayerStore(state => state.showQueue);
  const queue = useMusicPlayerStore(state => state.queue);

  const togglePlayPause = useMusicPlayerStore(state => state.togglePlayPause);
  const nextTrack = useMusicPlayerStore(state => state.nextTrack);
  const prevTrack = useMusicPlayerStore(state => state.prevTrack);
  const setVolume = useMusicPlayerStore(state => state.setVolume);
  const toggleMute = useMusicPlayerStore(state => state.toggleMute);
  const toggleShuffle = useMusicPlayerStore(state => state.toggleShuffle);
  const cycleRepeat = useMusicPlayerStore(state => state.cycleRepeat);
  const toggleLyrics = useMusicPlayerStore(state => state.toggleLyrics);
  const toggleQueue = useMusicPlayerStore(state => state.toggleQueue);

  const isPlaying = playbackStatus === 'playing';

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const formatRemaining = (cur: number, dur: number) => {
    if (isNaN(dur) || dur <= 0) return '-0:00';
    const rem = Math.max(0, dur - cur);
    return `-${formatTime(rem)}`;
  };

  return (
    <header className="sticky top-0 z-40 h-[56px] w-full am-chrome flex items-center justify-between px-3 sm:px-6 select-none">
      
      {/* ========================================================================= */}
      {/* 1. LEFT: TRANSPORT CONTROLS                                               */}
      {/* ========================================================================= */}
      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        
        {/* Mobile Sidebar Hamburger */}
        <button
          type="button"
          onClick={onToggleMobileSidebar}
          className="lg:hidden p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          title="Open Navigation"
        >
          <Menu className="w-4 h-4" />
        </button>

        {/* Shuffle */}
        <button
          type="button"
          onClick={toggleShuffle}
          className={`p-2 rounded-xl transition-colors cursor-pointer hidden sm:block ${
            shuffle ? 'text-[#fa243c] bg-[#fa243c]/15' : 'text-white/40 hover:text-white hover:bg-white/5'
          }`}
          title={shuffle ? 'Shuffle On' : 'Shuffle Off'}
        >
          <Shuffle className="w-3.5 h-3.5" />
        </button>

        {/* Previous */}
        <button
          type="button"
          onClick={prevTrack}
          className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          title="Previous Track"
        >
          <SkipBack className="w-4 h-4 fill-current" />
        </button>

        {/* Play / Pause Circular Button */}
        <button
          type="button"
          onClick={togglePlayPause}
          className="w-8 h-8 rounded-full bg-white text-black hover:scale-105 active:scale-95 transition-all shadow-md flex items-center justify-center cursor-pointer"
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
          type="button"
          onClick={nextTrack}
          className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          title="Next Track"
        >
          <SkipForward className="w-4 h-4 fill-current" />
        </button>

        {/* Repeat */}
        <button
          type="button"
          onClick={cycleRepeat}
          className={`p-2 rounded-xl transition-colors cursor-pointer hidden sm:block ${
            repeatMode !== 'off' ? 'text-[#fa243c] bg-[#fa243c]/15' : 'text-white/40 hover:text-white hover:bg-white/5'
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

      {/* ========================================================================= */}
      {/* 2. CENTER: APPLE MUSIC NOW PLAYING TILE WITH SCRUBBER                     */}
      {/* ========================================================================= */}
      <div className="flex-1 max-w-sm sm:max-w-md md:max-w-xl mx-2 sm:mx-4">
        {currentTrack ? (
          <div className="bg-white/6 hover:bg-white/8 border border-white/10 rounded-2xl px-3 py-1.5 transition-all flex flex-col justify-center shadow-inner">
            
            {/* Top row: Artwork thumbnail + Title + Artist */}
            <div className="flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <img 
                  src={currentTrack.artwork} 
                  alt="" 
                  className="w-7 h-7 rounded-md object-cover shrink-0 shadow-sm border border-white/10" 
                />
                <div className="min-w-0 flex items-center gap-1.5">
                  <span className="text-xs font-bold text-white truncate">
                    {currentTrack.title}
                  </span>
                  <span className="text-white/40 text-xs hidden sm:inline">•</span>
                  <span className="text-xs text-white/60 truncate hidden sm:inline">
                    {currentTrack.artist}
                  </span>
                </div>
              </div>

              {/* Lossless Indicator */}
              <div className="shrink-0 flex items-center gap-1">
                {currentTrack.isLive ? (
                  <span className="text-[9px] font-mono font-bold text-rose-400 bg-rose-500/20 px-1.5 py-0.2 rounded border border-rose-500/30">
                    LIVE
                  </span>
                ) : (
                  <span className="text-[9px] font-mono font-bold text-white/40 px-1.5 py-0.2 rounded bg-white/5 border border-white/10">
                    LOSSLESS
                  </span>
                )}
              </div>
            </div>

            {/* Bottom row: Interactive Scrubber Slider with times */}
            <div className="flex items-center gap-2 text-[10px] font-mono text-white/45 mt-0.5">
              <span className="w-7 text-right">
                {formatTime(currentTime)}
              </span>

              <input
                type="range"
                min={0}
                max={duration || 100}
                value={currentTime}
                disabled={currentTrack.isLive}
                onChange={(e) => onSeek(Number(e.target.value))}
                className="flex-1 am-slider h-1"
                aria-label="Track progress scrubber"
              />

              <span className="w-8 text-left">
                {currentTrack.isLive ? '24/7' : formatRemaining(currentTime, duration)}
              </span>
            </div>

          </div>
        ) : (
          /* Empty / Idle State */
          <div className="bg-white/4 border border-white/5 rounded-2xl px-4 py-2 flex items-center justify-center text-xs text-white/40 gap-2 font-medium">
            <Disc3 className="w-4 h-4 text-white/30" />
            <span>Select a track, album, or station to begin listening</span>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 3. RIGHT: VOLUME, LYRICS (💬) & UP-NEXT QUEUE (📜)                        */}
      {/* ========================================================================= */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        
        {/* Volume Slider */}
        <div className="hidden md:flex items-center gap-1.5">
          <button
            type="button"
            onClick={toggleMute}
            className="p-1.5 text-white/50 hover:text-white transition-colors cursor-pointer"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-3.5 h-3.5 text-red-400" />
            ) : (
              <Volume2 className="w-3.5 h-3.5" />
            )}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={isMuted ? 0 : volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="w-16 h-1 am-slider"
            aria-label="Volume slider"
          />
        </div>

        {/* Synced Lyrics Toggle Button (💬) */}
        <button
          type="button"
          onClick={toggleLyrics}
          className={`p-2 rounded-xl transition-all cursor-pointer ${
            showLyrics
              ? 'bg-[#fa243c] text-white shadow-md shadow-[#fa243c]/30'
              : 'text-white/60 hover:text-white hover:bg-white/5'
          }`}
          title="Synced Lyrics (Apple Music Mode)"
        >
          <Mic2 className="w-4 h-4" />
        </button>

        {/* Up Next Queue Toggle Button (📜) */}
        <button
          type="button"
          onClick={toggleQueue}
          className={`p-2 rounded-xl transition-all cursor-pointer relative ${
            showQueue
              ? 'bg-[#fa243c] text-white shadow-md shadow-[#fa243c]/30'
              : 'text-white/60 hover:text-white hover:bg-white/5'
          }`}
          title="Playing Next Queue"
        >
          <ListMusic className="w-4 h-4" />
          {queue.length > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-white text-black text-[9px] font-mono font-bold flex items-center justify-center shadow">
              {queue.length > 99 ? '99+' : queue.length}
            </span>
          )}
        </button>

        {/* Profile Avatar indicator */}
        <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-rose-500 to-indigo-600 flex items-center justify-center text-[10px] font-bold text-white shadow-md ml-1 hidden sm:flex">
          AM
        </div>

      </div>

    </header>
  );
};

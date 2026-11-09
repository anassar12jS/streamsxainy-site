import React, { useEffect, useRef, useState } from 'react';
import { 
  ChevronDown, Maximize2, Minimize2, Play, Pause, SkipBack, SkipForward, 
  Shuffle, Repeat, Volume2, VolumeX, Mic2, ListMusic, Heart, 
  Disc, Trash2
} from 'lucide-react';
import { useMusicPlayerStore } from '../store/useMusicPlayerStore';
import { fetchLyrics } from '../api/lyrics';
import { SteeredClock } from '../player/SteeredClock';

interface ImmersivePlayerOverlayProps {
  steeredClock?: SteeredClock;
  onSeek: (seconds: number) => void;
}

export const ImmersivePlayerOverlay: React.FC<ImmersivePlayerOverlayProps> = ({
  steeredClock,
  onSeek,
}) => {
  const showLyrics = useMusicPlayerStore(state => state.showLyrics);
  const setShowLyrics = useMusicPlayerStore(state => state.setShowLyrics);
  const immersiveTab = useMusicPlayerStore(state => state.immersiveTab);
  const setImmersiveTab = useMusicPlayerStore(state => state.setImmersiveTab);

  const currentTrack = useMusicPlayerStore(state => state.currentTrack);
  const playbackStatus = useMusicPlayerStore(state => state.playbackStatus);
  const currentTime = useMusicPlayerStore(state => state.currentTime);
  const duration = useMusicPlayerStore(state => state.duration);
  const volume = useMusicPlayerStore(state => state.volume);
  const isMuted = useMusicPlayerStore(state => state.isMuted);
  const shuffle = useMusicPlayerStore(state => state.shuffle);
  const repeatMode = useMusicPlayerStore(state => state.repeatMode);
  const queue = useMusicPlayerStore(state => state.queue);
  const queueIndex = useMusicPlayerStore(state => state.queueIndex);
  const likedTrackIds = useMusicPlayerStore(state => state.likedTrackIds);

  const playTrack = useMusicPlayerStore(state => state.playTrack);
  const togglePlayPause = useMusicPlayerStore(state => state.togglePlayPause);
  const nextTrack = useMusicPlayerStore(state => state.nextTrack);
  const prevTrack = useMusicPlayerStore(state => state.prevTrack);
  const toggleShuffle = useMusicPlayerStore(state => state.toggleShuffle);
  const cycleRepeat = useMusicPlayerStore(state => state.cycleRepeat);
  const setVolume = useMusicPlayerStore(state => state.setVolume);
  const toggleMute = useMusicPlayerStore(state => state.toggleMute);
  const toggleLike = useMusicPlayerStore(state => state.toggleLike);
  const removeFromQueue = useMusicPlayerStore(state => state.removeFromQueue);
  const clearQueue = useMusicPlayerStore(state => state.clearQueue);

  const activeLyrics = useMusicPlayerStore(state => state.activeLyrics);
  const setLyrics = useMusicPlayerStore(state => state.setLyrics);
  const isLoadingLyrics = useMusicPlayerStore(state => state.isLoadingLyrics);
  const setIsLoadingLyrics = useMusicPlayerStore(state => state.setIsLoadingLyrics);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [steeredTime, setSteeredTime] = useState(0);

  const activeLineRef = useRef<HTMLDivElement | null>(null);
  const lyricsContainerRef = useRef<HTMLDivElement | null>(null);

  // Steered audio clock for sub-frame lyric sync
  useEffect(() => {
    if (!steeredClock) return;
    const unsub = steeredClock.subscribe((time) => {
      setSteeredTime(time);
    });
    return unsub;
  }, [steeredClock]);

  // Fetch lyrics whenever currentTrack changes
  useEffect(() => {
    if (!currentTrack || currentTrack.isLive) {
      setLyrics(null);
      setIsLoadingLyrics(false);
      return;
    }

    let isCurrent = true;
    setIsLoadingLyrics(true);

    fetchLyrics(currentTrack.artist, currentTrack.title, currentTrack.duration).then(data => {
      if (isCurrent) {
        setLyrics(data);
        setIsLoadingLyrics(false);
      }
    });

    return () => {
      isCurrent = false;
    };
  }, [currentTrack?.id]);

  // Fallback to store currentTime if steeredTime is not updating
  const effectiveTime = steeredTime > 0 ? steeredTime : currentTime;

  // Smooth auto-scroll active lyric line into center
  useEffect(() => {
    if (immersiveTab === 'lyrics' && activeLineRef.current && lyricsContainerRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [Math.floor(effectiveTime), immersiveTab]);

  const isOpen = showLyrics;
  if (!isOpen || !currentTrack) return null;

  const handleClose = () => {
    setShowLyrics(false);
  };

  const toggleNativeFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs <= 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleScrubberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    onSeek(val);
  };

  const isLiked = likedTrackIds.includes(currentTrack.id);
  const isPlaying = playbackStatus === 'playing';

  // Active line calculation using effectiveTime
  const activeLineIdx = activeLyrics?.synced && activeLyrics.synced.length > 0
    ? activeLyrics.synced.findIndex((line, i) => {
        const nextTime = activeLyrics.synced![i + 1]?.time ?? Infinity;
        return effectiveTime >= line.time && effectiveTime < nextTime;
      })
    : -1;

  // Up next tracks from current queue
  const upNextTracks = queue.slice(queueIndex + 1);

  return (
    <div 
      className="fixed inset-0 z-50 flex flex-col bg-[#050505] text-white select-none overflow-hidden animate-fade-in"
      style={{ fontFamily: 'var(--bitchord-font)' }}
    >
      
      {/* ========================================================================= */}
      {/* AMBIENT BACKGROUND: Heavily blurred dynamically mimicking album colors    */}
      {/* ========================================================================= */}
      <div 
        className="absolute inset-0 bg-cover bg-center filter blur-[100px] opacity-45 scale-125 pointer-events-none transition-all duration-1000"
        style={{ backgroundImage: `url(${currentTrack.artwork})` }}
      />
      <div 
        className="absolute inset-0 opacity-40 filter blur-[90px] pointer-events-none mix-blend-screen"
        style={{
          background: 'radial-gradient(circle at 25% 30%, rgba(250, 36, 60, 0.45) 0%, transparent 55%), radial-gradient(circle at 75% 70%, rgba(147, 51, 234, 0.35) 0%, transparent 55%), radial-gradient(circle at 50% 50%, rgba(59, 130, 246, 0.25) 0%, transparent 60%)'
        }}
      />
      <div className="absolute inset-0 bg-black/55 pointer-events-none" />

      {/* ========================================================================= */}
      {/* 1. TOP HEADER: Minimize (Chevron), Mode Switcher, Fullscreen Toggle       */}
      {/* ========================================================================= */}
      <header className="relative z-20 px-6 sm:px-10 py-4 flex items-center justify-between border-b border-white/10 backdrop-blur-md bg-black/20 shrink-0">
        
        {/* Minimize Button */}
        <button
          type="button"
          onClick={handleClose}
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer hover:scale-105 active:scale-95 shadow-lg"
          title="Minimize player"
        >
          <ChevronDown className="w-5 h-5" />
        </button>

        {/* Center Mode Switcher: Lyrics vs Queue */}
        <div className="flex items-center gap-1 bg-[#161618]/90 p-1 rounded-full border border-white/15 shadow-xl backdrop-blur-xl">
          <button
            type="button"
            onClick={() => setImmersiveTab('lyrics')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              immersiveTab === 'lyrics' 
                ? 'bg-white text-black shadow-md' 
                : 'text-[#98989d] hover:text-white'
            }`}
          >
            <Mic2 className="w-3.5 h-3.5" />
            <span>Lyrics</span>
          </button>
          <button
            type="button"
            onClick={() => setImmersiveTab('queue')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              immersiveTab === 'queue' 
                ? 'bg-white text-black shadow-md' 
                : 'text-[#98989d] hover:text-white'
            }`}
          >
            <ListMusic className="w-3.5 h-3.5" />
            <span>Up Next ({upNextTracks.length})</span>
          </button>
        </div>

        {/* Fullscreen Expand Icon */}
        <button
          type="button"
          onClick={toggleNativeFullscreen}
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer hover:scale-105 active:scale-95 shadow-lg"
          title={isFullscreen ? 'Exit Fullscreen' : 'Enter Native Fullscreen'}
        >
          {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
        </button>
      </header>

      {/* ========================================================================= */}
      {/* 2. MAIN 2-PANEL BODY                                                      */}
      {/* Left Column: Vertical Stack (Art -> Title/Artist -> Scrubber -> Transport -> Volume) */}
      {/* Right Column: Synced Blurred Lyrics OR Up Next Queue List                 */}
      {/* ========================================================================= */}
      <div className="relative z-10 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12 px-6 sm:px-10 lg:px-16 py-3 sm:py-6 min-h-0 overflow-y-auto lg:overflow-hidden max-w-7xl mx-auto w-full">
        
        {/* ======================================================================= */}
        {/* LEFT COLUMN: NOW PLAYING                                                */}
        {/* Vertical Stack: Large Square Art -> Title/Artist -> Scrubber -> Transport -> Volume */}
        {/* ======================================================================= */}
        <div className="lg:col-span-5 flex flex-col justify-between items-center lg:items-start max-w-md mx-auto w-full h-full min-h-0 py-1 sm:py-2 gap-3 sm:gap-4 overflow-hidden">
          
          {/* 1. Large square album art with dynamic vertical responsive scaling */}
          <div className="relative aspect-square w-auto max-h-[36vh] sm:max-h-[40vh] lg:max-h-[min(360px,42vh)] min-h-[140px] max-w-full rounded-[14px] sm:rounded-[18px] overflow-hidden shadow-[0_24px_60px_rgba(0,0,0,0.85)] border border-white/10 shrink min-w-0 bg-[#161616] mx-auto lg:mx-0">
            <img 
              src={currentTrack.artwork} 
              alt={currentTrack.title} 
              className="w-full h-full object-cover" 
            />
          </div>

          {/* Permanently anchored controls block: Title/Artist -> Scrubber -> Transport -> Volume */}
          <div className="w-full shrink-0 space-y-3 sm:space-y-4">
            
            {/* 2. Track Title & Artist */}
            <div className="w-full text-center lg:text-left space-y-1">
              <div className="flex items-center justify-center lg:justify-start gap-2">
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-white tracking-tight truncate">
                  {currentTrack.title}
                </h2>
                {currentTrack.isExplicit && (
                  <span className="px-1.5 py-0.5 rounded bg-white/20 text-[10px] font-mono font-bold text-white shrink-0">
                    E
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => toggleLike(currentTrack.id)}
                  className={`p-1 transition-colors cursor-pointer ml-1 shrink-0 ${
                    isLiked ? 'text-amber-400' : 'text-white/40 hover:text-white'
                  }`}
                  title={isLiked ? 'Unlike' : 'Like'}
                >
                  <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
                </button>
              </div>

              <p className="text-sm sm:text-base text-[#98989d] font-medium truncate">
                {currentTrack.artist} {currentTrack.album ? `— ${currentTrack.album}` : ''}
              </p>
            </div>

            {/* 3. Scrubber / Progress Bar */}
            <div className="w-full space-y-1">
              <div className="relative group w-full py-1">
                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  step={0.5}
                  value={currentTime}
                  onChange={handleScrubberChange}
                  className="w-full h-1.5 sm:h-2 bg-white/20 rounded-full appearance-none cursor-pointer outline-none transition-all accent-white hover:h-2.5"
                />
              </div>
              <div className="flex items-center justify-between text-xs text-[#98989d] font-mono">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* 4. Playback Controls */}
            <div className="w-full flex items-center justify-between sm:justify-around py-0.5">
              {/* Shuffle */}
              <button
                type="button"
                onClick={toggleShuffle}
                className={`p-2 transition-colors cursor-pointer ${
                  shuffle ? 'text-white' : 'text-white/40 hover:text-white'
                }`}
                title="Shuffle"
              >
                <Shuffle className="w-4 sm:w-5 h-4 sm:h-5" />
              </button>

              {/* Previous Track */}
              <button
                type="button"
                onClick={prevTrack}
                className="p-2 text-white/80 hover:text-white hover:scale-110 active:scale-95 transition-all cursor-pointer"
                title="Previous Track"
              >
                <SkipBack className="w-6 sm:w-7 h-6 sm:h-7 fill-current" />
              </button>

              {/* Play / Pause (Large Circle Button) */}
              <button
                type="button"
                onClick={togglePlayPause}
                className="w-13 h-13 sm:w-16 sm:h-16 rounded-full bg-white text-black flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-transform cursor-pointer"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? (
                  <Pause className="w-6 sm:w-8 h-6 sm:h-8 fill-current" />
                ) : (
                  <Play className="w-6 sm:w-8 h-6 sm:h-8 fill-current ml-0.5 sm:ml-1" />
                )}
              </button>

              {/* Next Track */}
              <button
                type="button"
                onClick={nextTrack}
                className="p-2 text-white/80 hover:text-white hover:scale-110 active:scale-95 transition-all cursor-pointer"
                title="Next Track"
              >
                <SkipForward className="w-6 sm:w-7 h-6 sm:h-7 fill-current" />
              </button>

              {/* Repeat Mode */}
              <button
                type="button"
                onClick={cycleRepeat}
                className={`p-2 transition-colors cursor-pointer relative ${
                  repeatMode !== 'off' ? 'text-white' : 'text-white/40 hover:text-white'
                }`}
                title={`Repeat: ${repeatMode}`}
              >
                <Repeat className="w-4 sm:w-5 h-4 sm:h-5" />
                {repeatMode === 'one' && (
                  <span className="absolute top-1 right-1 text-[9px] font-bold">1</span>
                )}
              </button>
            </div>

            {/* 5. Volume Slider */}
            <div className="w-full flex items-center gap-3 max-w-xs mx-auto lg:mx-0 pt-0.5">
              <button
                type="button"
                onClick={toggleMute}
                className="p-1 text-white/60 hover:text-white transition-colors cursor-pointer"
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4 text-rose-400" />
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
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-full h-1 bg-white/20 rounded-full appearance-none cursor-pointer outline-none accent-white"
              />
            </div>

          </div>

        </div>

        {/* ======================================================================= */}
        {/* RIGHT COLUMN: SYNCHRONIZED BLURRED LYRICS OR QUEUE                      */}
        {/* ======================================================================= */}
        <div className="lg:col-span-7 flex flex-col h-full min-h-0 overflow-hidden border-t lg:border-t-0 lg:border-l border-white/10 pl-0 lg:pl-10 pt-4 lg:pt-0">
          
          {/* TAB 1: SYNCHRONIZED LYRICS (Apple Music Karaoke Style: Active White, Surrounding Blurred) */}
          {immersiveTab === 'lyrics' && (
            <div 
              ref={lyricsContainerRef}
              className="flex-1 overflow-y-auto pr-2 am-scrollbar space-y-8 py-10"
            >
              {isLoadingLyrics ? (
                <div className="flex flex-col items-center justify-center h-full text-white/40 gap-3 py-20">
                  <Disc className="w-8 h-8 animate-spin text-white/60" />
                  <p className="text-sm font-semibold">Loading synchronized lyrics...</p>
                </div>
              ) : activeLyrics?.synced && activeLyrics.synced.length > 0 ? (
                <div className="space-y-8 py-10">
                  {activeLyrics.synced.map((line, idx) => {
                    const isActive = idx === activeLineIdx;

                    return (
                      <div
                        key={`${line.time}-${idx}`}
                        ref={isActive ? activeLineRef : null}
                        onClick={() => onSeek(line.time)}
                        className={`cursor-pointer transition-all duration-300 rounded-2xl px-3 py-2 leading-tight tracking-tight ${
                          isActive
                            ? 'text-white text-3xl sm:text-4xl lg:text-5xl font-black scale-[1.02] filter drop-shadow-[0_4px_24px_rgba(255,255,255,0.4)]'
                            : 'text-white/30 text-2xl sm:text-3xl lg:text-4xl font-bold filter blur-[1.2px] hover:blur-none hover:text-white/60'
                        }`}
                      >
                        {line.text}
                      </div>
                    );
                  })}
                </div>
              ) : activeLyrics?.plain ? (
                <div className="whitespace-pre-line text-xl sm:text-2xl font-bold leading-relaxed text-white/80 py-8 px-2">
                  {activeLyrics.plain}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center text-white/40 gap-3 py-20">
                  <Disc className="w-10 h-10 text-white/20" />
                  <p className="text-base font-semibold text-white">No Synchronized Lyrics</p>
                  <p className="text-xs text-[#98989d] max-w-xs">
                    This track may be instrumental or lyrics have not yet been indexed in the BitChord repository.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: UP NEXT QUEUE */}
          {immersiveTab === 'queue' && (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
                <span className="text-xs font-semibold text-[#98989d] uppercase tracking-wider">
                  Up Next ({upNextTracks.length})
                </span>
                {upNextTracks.length > 0 && (
                  <button
                    type="button"
                    onClick={clearQueue}
                    className="flex items-center gap-1.5 text-xs text-[#98989d] hover:text-rose-400 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear Queue</span>
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto am-scrollbar py-3 space-y-1">
                {upNextTracks.length > 0 ? (
                  upNextTracks.map((track, idx) => {
                    const actualQueueIndex = queueIndex + 1 + idx;

                    return (
                      <div
                        key={`${track.id}-${idx}`}
                        onClick={() => playTrack(track, queue)}
                        className="group flex items-center justify-between p-2.5 rounded-xl hover:bg-[#1a1a1a] transition-colors cursor-pointer select-none"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <span className="w-5 text-center text-xs text-[#777777] font-medium group-hover:hidden">
                            {idx + 1}
                          </span>
                          <button
                            type="button"
                            className="w-5 h-5 items-center justify-center hidden group-hover:flex text-white"
                          >
                            <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                          </button>

                          <img 
                            src={track.artwork} 
                            alt="" 
                            className="w-10 h-10 rounded-[6px] object-cover bg-[#1a1a1a] shrink-0" 
                          />

                          <div className="min-w-0 flex-1 text-left">
                            <h4 className="text-sm font-semibold text-white truncate text-left">
                              {track.title}
                            </h4>
                            <p className="text-xs text-[#98989d] truncate mt-0.5 text-left">
                              {track.artist}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 shrink-0 pl-2">
                          <span className="text-xs font-mono text-[#98989d]">
                            {formatTime(track.duration)}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFromQueue(actualQueueIndex);
                            }}
                            className="p-1 text-white/30 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                            title="Remove from queue"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-24 text-center text-white/40 space-y-2">
                    <ListMusic className="w-10 h-10 mx-auto text-white/20" />
                    <p className="text-sm font-semibold text-white">Queue is Empty</p>
                    <p className="text-xs text-[#98989d]">
                      Add tracks to "Play Next" from any album, artist, or search results.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  );
};
export default ImmersivePlayerOverlay;


import React, { useEffect, useRef, useState } from 'react';
import { 
  X, Play, Pause, SkipBack, SkipForward, 
  Shuffle, Repeat, Volume2, VolumeX, MessageSquareQuote, ListMusic, 
  Star, MoreHorizontal, Maximize2, Minimize2, Trash2, Disc
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

  // Effective playback time
  const effectiveTime = steeredTime > 0 ? steeredTime : currentTime;

  // Auto-scroll active lyric into center smoothly without jitter
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

  const formatRemainingTime = (secs: number) => {
    if (isNaN(secs) || secs <= 0) return '-0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `-${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleScrubberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    onSeek(val);
  };

  const isLiked = likedTrackIds.includes(currentTrack.id);
  const isPlaying = playbackStatus === 'playing';
  const remainingTime = Math.max(0, (duration || 0) - currentTime);

  // Active line calculation
  const activeLineIdx = activeLyrics?.synced && activeLyrics.synced.length > 0
    ? activeLyrics.synced.findIndex((line, i) => {
        const nextTime = activeLyrics.synced![i + 1]?.time ?? Infinity;
        return effectiveTime >= line.time && effectiveTime < nextTime;
      })
    : -1;

  // Up next tracks
  const upNextTracks = queue.slice(queueIndex + 1);

  return (
    <div 
      className="fixed inset-0 z-50 flex flex-col bg-[#07080b] text-white select-none overflow-hidden animate-fade-in font-sans"
      style={{ fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}
    >
      {/* ========================================================================= */}
      {/* 1. ATMOSPHERIC AMBIENT BACKGROUND: Deep, soft, monochromatic with artwork */}
      {/* Zero neon, zero red or harsh gradients. Pure Apple Music dark aesthetic   */}
      {/* ========================================================================= */}
      <div 
        className="absolute inset-0 bg-cover bg-center filter blur-[140px] opacity-20 scale-125 pointer-events-none transition-all duration-1000"
        style={{ backgroundImage: `url(${currentTrack.artwork})` }}
      />
      <div className="absolute inset-0 bg-[#07080b]/85 pointer-events-none" />

      {/* ========================================================================= */}
      {/* 2. TOP-LEFT CLOSE BUTTON: Minimalist ✕ like in image_64b5cefb.png        */}
      {/* ========================================================================= */}
      <button
        type="button"
        onClick={handleClose}
        className="absolute top-6 left-6 z-40 p-2 text-white/50 hover:text-white transition-colors cursor-pointer group"
        title="Close fullscreen player"
      >
        <X className="w-5 h-5 group-hover:scale-110 transition-transform" />
      </button>

      {/* ========================================================================= */}
      {/* 3. MAIN SPLIT VIEWPORT                                                    */}
      {/* Left: Artwork + Title + Scrubber + Deck + Volume                         */}
      {/* Right: Crisp, sharp Lyrics (no glow!) or Apple Up-Next panel             */}
      {/* ========================================================================= */}
      <main className="relative z-20 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 px-8 sm:px-12 lg:px-20 py-8 lg:py-12 min-h-0 overflow-hidden max-w-[1600px] mx-auto w-full">
        
        {/* ======================================================================= */}
        {/* LEFT COLUMN: PLAYER HERO & CONTROLS STACK                              */}
        {/* ======================================================================= */}
        <div className="lg:col-span-5 flex flex-col justify-center items-center lg:items-start max-w-[440px] mx-auto w-full h-full min-h-0">
          
          {/* Album Artwork with smooth rounded corners & subtle shadow */}
          <div className="relative aspect-square w-full max-w-[420px] rounded-2xl sm:rounded-3xl overflow-hidden shadow-[0_24px_60px_rgba(0,0,0,0.85)] border border-white/5 bg-[#121316] shrink-0">
            <img 
              src={currentTrack.artwork} 
              alt={currentTrack.title} 
              className="w-full h-full object-cover" 
            />
          </div>

          {/* Player controls & metadata stack */}
          <div className="w-full mt-6 space-y-4">
            
            {/* Title Row with Explicit Badge + Star + More */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <h1 className="text-white font-bold text-base sm:text-lg lg:text-[19px] tracking-tight truncate">
                  {currentTrack.title}
                </h1>
                {currentTrack.isExplicit && (
                  <span className="px-1.5 py-0.5 rounded-[4px] bg-white/20 text-[9px] font-mono font-bold text-white shrink-0 tracking-wider">
                    E
                  </span>
                )}
              </div>

              {/* Action Buttons: Star + More */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => toggleLike(currentTrack.id)}
                  className={`p-1.5 transition-colors cursor-pointer rounded-full hover:bg-white/10 ${
                    isLiked ? 'text-white' : 'text-white/50 hover:text-white'
                  }`}
                  title={isLiked ? 'Favorite' : 'Add to Favorites'}
                >
                  <Star className={`w-4 h-4 ${isLiked ? 'fill-white text-white' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={() => setImmersiveTab(immersiveTab === 'lyrics' ? 'queue' : 'lyrics')}
                  className="p-1.5 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
                  title="More Options"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Subtitle: Artist — Album */}
            <p className="text-[13px] sm:text-sm text-[#8e8e93] font-normal truncate -mt-2">
              {currentTrack.artist} {currentTrack.album ? `— ${currentTrack.album}` : ''}
            </p>

            {/* Scrubber Timeline */}
            <div className="w-full pt-1">
              <div className="relative group w-full flex items-center">
                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  step={0.5}
                  value={currentTime}
                  onChange={handleScrubberChange}
                  className="w-full h-1 bg-white/20 rounded-full appearance-none cursor-pointer outline-none accent-white transition-all hover:h-1.5"
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-[#8e8e93] font-mono mt-1.5 select-none">
                <span>{formatTime(currentTime)}</span>
                <span>{formatRemainingTime(remainingTime)}</span>
              </div>
            </div>

            {/* Apple Music Minimalist Transport Controls (Direct solid white glyphs, matching image_64b5cefb.png) */}
            <div className="w-full flex items-center justify-between px-2 pt-1 select-none">
              {/* Shuffle */}
              <button
                type="button"
                onClick={toggleShuffle}
                className={`p-2 transition-colors cursor-pointer ${
                  shuffle ? 'text-white' : 'text-white/40 hover:text-white'
                }`}
                title="Shuffle"
              >
                <Shuffle className="w-4 h-4" />
              </button>

              {/* Previous Track: Solid white double triangle */}
              <button
                type="button"
                onClick={prevTrack}
                className="p-2 text-white hover:opacity-80 active:scale-95 transition-all cursor-pointer"
                title="Previous Track"
              >
                <SkipBack className="w-6 h-6 fill-white text-white" />
              </button>

              {/* Play / Pause: Solid white glyph, no heavy circular pill */}
              <button
                type="button"
                onClick={togglePlayPause}
                className="p-2 text-white hover:scale-105 active:scale-95 transition-transform cursor-pointer"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? (
                  <Pause className="w-7 h-7 sm:w-8 sm:h-8 fill-white text-white" />
                ) : (
                  <Play className="w-7 h-7 sm:w-8 sm:h-8 fill-white text-white ml-0.5" />
                )}
              </button>

              {/* Next Track: Solid white double triangle */}
              <button
                type="button"
                onClick={nextTrack}
                className="p-2 text-white hover:opacity-80 active:scale-95 transition-all cursor-pointer"
                title="Next Track"
              >
                <SkipForward className="w-6 h-6 fill-white text-white" />
              </button>

              {/* Repeat */}
              <button
                type="button"
                onClick={cycleRepeat}
                className={`p-2 transition-colors cursor-pointer relative ${
                  repeatMode !== 'off' ? 'text-white' : 'text-white/40 hover:text-white'
                }`}
                title={`Repeat: ${repeatMode}`}
              >
                <Repeat className="w-4 h-4" />
                {repeatMode === 'one' && (
                  <span className="absolute top-1 right-1 text-[9px] font-bold">1</span>
                )}
              </button>
            </div>

            {/* Volume Slider Bar */}
            <div className="w-full flex items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={toggleMute}
                className="p-1 text-white/50 hover:text-white transition-colors cursor-pointer"
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-3.5 h-3.5 text-white/50" />
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
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-full h-1 bg-white/20 rounded-full appearance-none cursor-pointer outline-none accent-white"
              />
            </div>

          </div>

        </div>

        {/* ======================================================================= */}
        {/* RIGHT COLUMN: CRISP SYNCHRONIZED LYRICS (ZERO GLOW) OR UP-NEXT QUEUE   */}
        {/* ======================================================================= */}
        <div className="lg:col-span-7 flex flex-col h-full min-h-0 overflow-hidden pl-0 lg:pl-12 pt-6 lg:pt-0">
          
          {/* VIEW A: LYRICS */}
          {immersiveTab === 'lyrics' && (
            <div 
              ref={lyricsContainerRef}
              className="flex-1 overflow-y-auto pr-4 am-scrollbar py-24 select-none"
            >
              {isLoadingLyrics ? (
                <div className="flex flex-col items-center justify-center h-full text-white/40 gap-3 py-24">
                  <Disc className="w-7 h-7 animate-spin text-white/50" />
                  <p className="text-sm font-medium">Loading synchronized lyrics...</p>
                </div>
              ) : activeLyrics?.synced && activeLyrics.synced.length > 0 ? (
                <div className="space-y-10 py-20">
                  {activeLyrics.synced.map((line, idx) => {
                    const isActive = idx === activeLineIdx;

                    return (
                      <div
                        key={`${line.time}-${idx}`}
                        ref={isActive ? activeLineRef : null}
                        onClick={() => onSeek(line.time)}
                        className={`cursor-pointer transition-all duration-300 rounded-xl px-2 py-1.5 leading-snug tracking-tight select-none ${
                          isActive
                            ? 'text-white font-extrabold text-3xl sm:text-4xl lg:text-[44px] scale-[1.01] origin-left blur-none'
                            : 'text-white/20 hover:text-white/60 font-bold text-2xl sm:text-3xl lg:text-[34px] blur-[0.4px]'
                        }`}
                      >
                        {line.text}
                      </div>
                    );
                  })}
                </div>
              ) : activeLyrics?.plain ? (
                <div className="whitespace-pre-line text-2xl sm:text-3xl font-bold leading-relaxed text-white/80 py-12 px-2">
                  {activeLyrics.plain}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center text-white/40 gap-3 py-24">
                  <Disc className="w-10 h-10 text-white/20" />
                  <p className="text-base font-semibold text-white">No Synchronized Lyrics</p>
                  <p className="text-xs text-[#8e8e93] max-w-xs">
                    Lyrics are not currently available for this track.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* VIEW B: UP NEXT QUEUE (Authentic Apple Music style from image_c594806c.png) */}
          {immersiveTab === 'queue' && (
            <div className="flex-1 flex flex-col h-full overflow-hidden max-w-xl mx-auto w-full py-6">
              <div className="flex items-center justify-between pb-4 border-b border-white/10 shrink-0">
                <h3 className="text-2xl font-bold text-white tracking-tight">
                  Up next
                </h3>
                {upNextTracks.length > 0 && (
                  <button
                    type="button"
                    onClick={clearQueue}
                    className="text-sm font-semibold text-[#ff453a] hover:text-[#ff6961] transition-colors cursor-pointer"
                  >
                    Clear
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
                        className="group flex items-center justify-between p-2.5 rounded-xl hover:bg-white/5 transition-colors cursor-pointer select-none"
                      >
                        <div className="flex items-center gap-3.5 min-w-0 flex-1">
                          <img 
                            src={track.artwork} 
                            alt="" 
                            className="w-11 h-11 rounded-[8px] object-cover bg-[#1a1a1a] shrink-0" 
                          />

                          <div className="min-w-0 flex-1 text-left">
                            <h4 className="text-sm font-semibold text-white truncate">
                              {track.title}
                            </h4>
                            <p className="text-xs text-[#8e8e93] truncate mt-0.5">
                              {track.artist}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 shrink-0 pl-3">
                          <span className="text-xs font-mono text-[#8e8e93]">
                            {formatTime(track.duration)}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFromQueue(actualQueueIndex);
                            }}
                            className="p-1 text-white/30 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
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
                    <p className="text-base font-semibold text-white">Queue is Empty</p>
                    <p className="text-xs text-[#8e8e93]">
                      Add songs to play next from any album or playlist.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

      </main>

      {/* ========================================================================= */}
      {/* 4. BOTTOM-RIGHT CONTROLS: Lyrics bubble icon & Queue toggle               */}
      {/* ========================================================================= */}
      <footer className="absolute bottom-6 right-6 z-40 flex items-center gap-2">
        {/* Lyrics toggle button (Apple Music speech bubble with quote mark) */}
        <button
          type="button"
          onClick={() => setImmersiveTab('lyrics')}
          className={`p-2.5 rounded-xl transition-all cursor-pointer ${
            immersiveTab === 'lyrics'
              ? 'text-white bg-white/15'
              : 'text-white/40 hover:text-white hover:bg-white/5'
          }`}
          title="Lyrics"
        >
          <MessageSquareQuote className="w-5 h-5" />
        </button>

        {/* Queue toggle button */}
        <button
          type="button"
          onClick={() => setImmersiveTab('queue')}
          className={`p-2.5 rounded-xl transition-all cursor-pointer ${
            immersiveTab === 'queue'
              ? 'text-white bg-white/15'
              : 'text-white/40 hover:text-white hover:bg-white/5'
          }`}
          title="Up Next"
        >
          <ListMusic className="w-5 h-5" />
        </button>

        {/* Native Fullscreen */}
        <button
          type="button"
          onClick={toggleNativeFullscreen}
          className="p-2.5 rounded-xl text-white/40 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
        >
          {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
        </button>
      </footer>
    </div>
  );
};

export default ImmersivePlayerOverlay;

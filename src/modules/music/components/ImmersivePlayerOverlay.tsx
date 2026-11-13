import React, { useEffect, useRef, useState } from 'react';
import { 
  X, Play, Pause, SkipBack, SkipForward, 
  Shuffle, Repeat, Volume2, VolumeX, MessageSquareQuote, ListMusic, 
  Star, MoreHorizontal, Maximize2, Minimize2, Trash2, Disc, Moon, Check
} from 'lucide-react';
import { useMusicPlayerStore } from '../store/useMusicPlayerStore';
import { fetchLyrics } from '../api/lyrics';
import { SteeredClock } from '../player/SteeredClock';
import { getArtworkColors, AmbientColors } from '../utils/artworkColors';

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
  const sleepTimerMode = useMusicPlayerStore(state => state.sleepTimerMode);
  const sleepTimerEndsAt = useMusicPlayerStore(state => state.sleepTimerEndsAt);
  const sleepTimerMinutes = useMusicPlayerStore(state => state.sleepTimerMinutes);
  const setSleepTimer = useMusicPlayerStore(state => state.setSleepTimer);

  const activeLyrics = useMusicPlayerStore(state => state.activeLyrics);
  const setLyrics = useMusicPlayerStore(state => state.setLyrics);
  const isLoadingLyrics = useMusicPlayerStore(state => state.isLoadingLyrics);
  const setIsLoadingLyrics = useMusicPlayerStore(state => state.setIsLoadingLyrics);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSleepMenu, setShowSleepMenu] = useState(false);
  const [ambient, setAmbient] = useState<AmbientColors | null>(null);

  // Extract dominant artwork colors for the ambient background (Spotify-style)
  useEffect(() => {
    let cancelled = false;
    setAmbient(null);
    if (currentTrack?.artwork) {
      getArtworkColors(currentTrack.artwork).then(c => {
        if (!cancelled) setAmbient(c);
      });
    }
    return () => { cancelled = true; };
  }, [currentTrack?.id, currentTrack?.artwork]);

  const [now, setNow] = useState(() => Date.now());
  const [steeredTime, setSteeredTime] = useState(0);

  useEffect(() => {
    if (!showSleepMenu) return;
    const id = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(id);
  }, [showSleepMenu]);

  const sleepTimerLabel = (() => {
    if (sleepTimerMode === 'trackEnd') return 'End of Song';
    if (sleepTimerMode === 'time' && sleepTimerEndsAt) {
      const minsLeft = Math.max(1, Math.ceil((sleepTimerEndsAt - now) / 60000));
      return `${minsLeft}m left`;
    }
    return 'Off';
  })();

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

  // Keyboard shortcuts: Space/K play-pause, ←/→ seek ±5s, ↑/↓ volume, Esc close, F fullscreen
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      switch (e.key) {
        case ' ':
        case 'k':
        case 'K':
          e.preventDefault();
          togglePlayPause();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          onSeek(Math.max(0, effectiveTime - 5));
          break;
        case 'ArrowRight':
          e.preventDefault();
          onSeek(Math.min(duration || Infinity, effectiveTime + 5));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setVolume(Math.min(1, volume + 0.05));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setVolume(Math.max(0, volume - 0.05));
          break;
        case 'Escape':
          handleClose();
          break;
        case 'f':
        case 'F':
          toggleNativeFullscreen();
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, effectiveTime, duration, volume]);

  return (
    <div 
      className="fixed inset-0 z-50 flex flex-col bg-[#07080b] text-white select-none overflow-hidden animate-fade-in font-sans pb-[env(safe-area-inset-bottom)]"
      style={{ fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}
    >
      {/* ========================================================================= */}
      {/* 1. ATMOSPHERIC AMBIENT BACKGROUND: artwork blur + dominant-color blobs    */}
      {/* ========================================================================= */}
      {/* Blurred artwork texture */}
      <div 
        className="absolute inset-0 bg-cover bg-center filter blur-[120px] opacity-25 scale-110 pointer-events-none transition-all duration-1000"
        style={{ backgroundImage: `url(${currentTrack.artwork})` }}
      />
      {/* Dominant-color gradient blobs, drifting slowly (Spotify-style ambiance) */}
      <div
        className="absolute -top-[20%] -left-[10%] w-[70vmax] h-[70vmax] rounded-full pointer-events-none transition-colors duration-1000"
        style={{
          background: `radial-gradient(circle at center, ${ambient?.[0] ?? '#1a1a2e'} 0%, transparent 65%)`,
          opacity: 0.32,
          filter: 'blur(60px)',
          animation: 'ambDrift1 26s ease-in-out infinite alternate',
        }}
      />
      <div
        className="absolute -bottom-[25%] -right-[10%] w-[65vmax] h-[65vmax] rounded-full pointer-events-none transition-colors duration-1000"
        style={{
          background: `radial-gradient(circle at center, ${ambient?.[1] ?? '#16213e'} 0%, transparent 65%)`,
          opacity: 0.28,
          filter: 'blur(70px)',
          animation: 'ambDrift2 32s ease-in-out infinite alternate',
        }}
      />
      {/* Depth vignette so content stays readable */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 40%, transparent 30%, rgba(7,8,11,0.55) 100%)' }} />
      <div className="absolute inset-0 bg-[#07080b]/60 pointer-events-none" />

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
      <main className="relative z-20 flex-1 flex flex-col lg:grid lg:grid-cols-12 gap-4 lg:gap-14 px-4 sm:px-8 lg:px-20 pt-4 lg:pt-12 pb-1 lg:pb-12 min-h-0 overflow-hidden max-w-[1600px] mx-auto w-full">
        
        {/* ======================================================================= */}
        {/* LEFT COLUMN: PLAYER HERO & CONTROLS STACK                              */}
        {/* ======================================================================= */}
        <div className="lg:col-span-5 flex flex-col justify-start lg:justify-center items-center lg:items-start w-full shrink-0 lg:h-full lg:max-w-[400px] mx-auto min-h-0">
          
          {/* Album Artwork with smooth rounded corners & subtle shadow */}
          <div 
            className="relative aspect-square w-full max-w-[170px] sm:max-w-[240px] lg:max-w-[320px] rounded-2xl sm:rounded-3xl overflow-hidden shrink-0 transition-shadow duration-700"
            style={{
              boxShadow: ambient
                ? `0 24px 80px rgba(0,0,0,0.85), 0 0 90px ${ambient[0]}33`
                : '0 24px 60px rgba(0,0,0,0.85)',
              border: '1px solid rgba(255,255,255,0.06)',
              background: '#121316',
            }}
          >
            <img 
              key={currentTrack.id}
              src={currentTrack.artwork} 
              alt={currentTrack.title} 
              className="w-full h-full object-cover animate-fade-in"
              style={{ animation: isPlaying ? 'artBreathe 7s ease-in-out infinite' : undefined }}
            />
          </div>

          {/* Player controls & metadata stack */}
          <div className="w-full mt-4 lg:mt-6 space-y-3 lg:space-y-4">
            
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
                {/* Sleep Timer */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowSleepMenu(prev => !prev)}
                    className={`p-1.5 transition-colors cursor-pointer rounded-full hover:bg-white/10 ${
                      sleepTimerMode !== 'off' ? 'text-white' : 'text-white/50 hover:text-white'
                    }`}
                    title={`Sleep Timer: ${sleepTimerLabel}`}
                  >
                    <Moon className="w-4 h-4" />
                  </button>

                  {showSleepMenu && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowSleepMenu(false)} />
                      <div className="absolute right-0 top-full mt-2 w-48 bg-[#1e1e20]/95 backdrop-blur-2xl border border-white/15 rounded-2xl shadow-2xl p-1.5 z-50 text-xs animate-in fade-in slide-in-from-top-1 duration-150">
                        <div className="px-2.5 py-1.5 flex items-center justify-between text-white/50">
                          <span className="font-semibold uppercase tracking-wider text-[10px]">Sleep Timer</span>
                          <span>{sleepTimerLabel}</span>
                        </div>
                        <div className="my-1 border-t border-white/10" />
                        {([
                          { mode: 'off' as const, label: 'Off' },
                          { mode: 'time' as const, minutes: 15, label: '15 minutes' },
                          { mode: 'time' as const, minutes: 30, label: '30 minutes' },
                          { mode: 'time' as const, minutes: 60, label: '1 hour' },
                          { mode: 'trackEnd' as const, label: 'End of song' },
                        ]).map(opt => {
                          const isActive = opt.mode === 'off'
                            ? sleepTimerMode === 'off'
                            : opt.mode === 'trackEnd'
                              ? sleepTimerMode === 'trackEnd'
                              : sleepTimerMode === 'time' && sleepTimerMinutes === opt.minutes;
                          return (
                            <button
                              key={opt.label}
                              type="button"
                              onClick={() => {
                                setSleepTimer(opt.mode, opt.mode === 'time' ? opt.minutes : undefined);
                                setShowSleepMenu(false);
                              }}
                              className={`w-full text-left px-2.5 py-2 rounded-xl flex items-center justify-between cursor-pointer transition-colors ${
                                isActive ? 'text-white bg-white/10' : 'text-white/60 hover:text-white hover:bg-white/5'
                              }`}
                            >
                              <span>{opt.label}</span>
                              {isActive && <Check className="w-3 h-3 text-emerald-400" />}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>

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
                <Shuffle className="w-3.5 h-3.5" />
              </button>

              {/* Previous Track: Solid white double triangle */}
              <button
                type="button"
                onClick={prevTrack}
                className="p-2 text-white hover:opacity-80 active:scale-95 transition-all cursor-pointer"
                title="Previous Track"
              >
                <SkipBack className="w-5 h-5 fill-white text-white" />
              </button>

              {/* Play / Pause: Solid white glyph, no heavy circular pill */}
              <button
                type="button"
                onClick={togglePlayPause}
                className="p-2 text-white hover:scale-105 active:scale-95 transition-transform cursor-pointer"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? (
                  <Pause className="w-6 h-6 sm:w-7 sm:h-7 fill-white text-white" />
                ) : (
                  <Play className="w-6 h-6 sm:w-7 sm:h-7 fill-white text-white ml-0.5" />
                )}
              </button>

              {/* Next Track: Solid white double triangle */}
              <button
                type="button"
                onClick={nextTrack}
                className="p-2 text-white hover:opacity-80 active:scale-95 transition-all cursor-pointer"
                title="Next Track"
              >
                <SkipForward className="w-5 h-5 fill-white text-white" />
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
                <Repeat className="w-3.5 h-3.5" />
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
        <div className="lg:col-span-7 flex flex-col flex-1 lg:h-full min-h-0 overflow-hidden pl-0 lg:pl-12 pt-2 lg:pt-0">
          
          {/* VIEW A: LYRICS */}
          {immersiveTab === 'lyrics' && (
            <div 
              ref={lyricsContainerRef}
              className="flex-1 overflow-y-auto pr-4 am-scrollbar py-24 select-none"
              style={{ maskImage: 'linear-gradient(to bottom, transparent 0%, black 12%, black 82%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 12%, black 82%, transparent 100%)' }}
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
      <footer className="relative lg:absolute lg:bottom-6 lg:right-6 z-40 flex items-center justify-center gap-2 pb-3 lg:pb-0 pt-1 lg:pt-0 shrink-0">
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

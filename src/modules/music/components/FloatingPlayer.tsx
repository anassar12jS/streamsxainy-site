import React, { useState, useEffect, useRef } from 'react';
import { 
  Shuffle, SkipBack, Play, Pause, SkipForward, Repeat, Repeat1,
  Star, MoreHorizontal, MessageSquareQuote, List, Volume2, VolumeX,
  Loader2, Menu, Plus, Disc, User, Compass, Share2, Check, Moon, ChevronRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useMusicPlayerStore } from '../store/useMusicPlayerStore';
import { resolveArtistId, resolveAlbumId } from '../api/innertube';

interface FloatingPlayerProps {
  onToggleMobileSidebar?: () => void;
  onSeek: (seconds: number) => void;
}

export const FloatingPlayer: React.FC<FloatingPlayerProps> = ({
  onToggleMobileSidebar,
  onSeek,
}) => {
  const navigate = useNavigate();
  const [resolving, setResolving] = useState<'artist' | 'album' | null>(null);
  const currentTrack = useMusicPlayerStore(state => state.currentTrack);
  const playbackStatus = useMusicPlayerStore(state => state.playbackStatus);
  const currentTime = useMusicPlayerStore(state => state.currentTime);
  const duration = useMusicPlayerStore(state => state.duration);
  const volume = useMusicPlayerStore(state => state.volume);
  const isMuted = useMusicPlayerStore(state => state.isMuted);
  const shuffle = useMusicPlayerStore(state => state.shuffle);
  const repeatMode = useMusicPlayerStore(state => state.repeatMode);
  const showLyrics = useMusicPlayerStore(state => state.showLyrics);
  const setShowLyrics = useMusicPlayerStore(state => state.setShowLyrics);
  const showQueue = useMusicPlayerStore(state => state.showQueue);
  const likedTrackIds = useMusicPlayerStore(state => state.likedTrackIds);

  const togglePlayPause = useMusicPlayerStore(state => state.togglePlayPause);
  const nextTrack = useMusicPlayerStore(state => state.nextTrack);
  const prevTrack = useMusicPlayerStore(state => state.prevTrack);
  const setVolume = useMusicPlayerStore(state => state.setVolume);
  const toggleMute = useMusicPlayerStore(state => state.toggleMute);
  const toggleShuffle = useMusicPlayerStore(state => state.toggleShuffle);
  const cycleRepeat = useMusicPlayerStore(state => state.cycleRepeat);
  const toggleLyrics = useMusicPlayerStore(state => state.toggleLyrics);
  const toggleQueue = useMusicPlayerStore(state => state.toggleQueue);
  const toggleLike = useMusicPlayerStore(state => state.toggleLike);
  const addToQueue = useMusicPlayerStore(state => state.addToQueue);
  const sleepTimerMode = useMusicPlayerStore(state => state.sleepTimerMode);
  const sleepTimerEndsAt = useMusicPlayerStore(state => state.sleepTimerEndsAt);
  const sleepTimerMinutes = useMusicPlayerStore(state => state.sleepTimerMinutes);
  const setSleepTimer = useMusicPlayerStore(state => state.setSleepTimer);
  const queue = useMusicPlayerStore(state => state.queue);
  const queueIndex = useMusicPlayerStore(state => state.queueIndex);
  const playTrack = useMusicPlayerStore(state => state.playTrack);

  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showSleepOptions, setShowSleepOptions] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [copied, setCopied] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const volumeRef = useRef<HTMLDivElement>(null);

  // Tick the clock while the menu is open so the countdown label stays fresh
  useEffect(() => {
    if (!showMoreMenu) return;
    const id = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(id);
  }, [showMoreMenu]);

  useEffect(() => {
    if (!showMoreMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMoreMenu]);

  // Scroll-wheel volume (native non-passive listener so preventDefault works)
  useEffect(() => {
    const el = volumeRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const st = useMusicPlayerStore.getState();
      const base = st.isMuted ? 0 : st.volume;
      st.setVolume(Math.max(0, Math.min(1, base + (e.deltaY > 0 ? -0.05 : 0.05))));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const isPlaying = playbackStatus === 'playing';
  const isLoading = playbackStatus === 'loading';
  const isLiked = currentTrack ? likedTrackIds.includes(currentTrack.id) : false;

  const sleepTimerLabel = (() => {
    if (sleepTimerMode === 'trackEnd') return 'End of Song';
    if (sleepTimerMode === 'time' && sleepTimerEndsAt) {
      const minsLeft = Math.max(1, Math.ceil((sleepTimerEndsAt - now) / 60000));
      return `${minsLeft}m left`;
    }
    return 'Off';
  })();

  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  // Next track in the queue (skips nothing — respects shuffle order already baked into queueIndex)
  const upNextTrack = queue.length > 0 ? queue[(queueIndex + 1) % queue.length] : undefined;
  const upNextIsCurrent = upNextTrack && currentTrack && upNextTrack.id === currentTrack.id && queue.length <= 1;

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs <= 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const seekFromClientX = (clientX: number, el: HTMLElement) => {
    if (!duration || duration <= 0) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onSeek(ratio * duration);
  };

  const handleScrubberPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!duration || duration <= 0) return;
    e.preventDefault();
    seekFromClientX(e.clientX, e.currentTarget);
    const el = e.currentTarget;
    const onMove = (ev: PointerEvent) => seekFromClientX(ev.clientX, el);
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const openArtist = async () => {
    if (!currentTrack || resolving) return;
    setResolving('artist');
    try {
      const id = await resolveArtistId(currentTrack);
      if (id) navigate(`/music/artist/${id}`);
    } finally {
      setResolving(null);
    }
  };

  const openAlbum = async () => {
    if (!currentTrack || resolving) return;
    setResolving('album');
    try {
      const id = await resolveAlbumId(currentTrack);
      if (id) navigate(`/music/album/${id}`);
    } finally {
      setResolving(null);
    }
  };

  return (
    <>
      {/* Xainy Music Apple Music Authentic Floating Player Pill */}
      <div 
        className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] sm:bottom-5 left-1/2 -translate-x-1/2 z-50 max-w-[860px] w-[96vw] sm:w-auto"
        style={{ fontFamily: 'var(--bitchord-font)' }}
      >
        <div 
          className="bitchord-floating-pill rounded-full px-4 sm:px-5 py-2.5 flex items-center justify-between gap-3 sm:gap-5 select-none transition-all shadow-[0_20px_50px_rgba(0,0,0,0.85)] border border-white/15 relative"
        >
          {/* ========================================================================= */}
          {/* 1. LEFT: Transport Controls                                               */}
          {/* ========================================================================= */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0 text-[#98989d]">
            {/* Shuffle */}
            <button
              type="button"
              onClick={toggleShuffle}
              className={`p-1.5 rounded-full transition-colors cursor-pointer hidden sm:block ${
                shuffle ? 'text-white' : 'hover:text-white'
              }`}
              title={shuffle ? 'Shuffle On' : 'Shuffle Off'}
            >
              <Shuffle className="w-3.5 h-3.5" />
            </button>

            {/* Previous */}
            <button
              type="button"
              onClick={prevTrack}
              className="p-1.5 rounded-full hover:text-white transition-colors cursor-pointer"
              title="Previous Track"
            >
              <SkipBack className="w-4 h-4 fill-current" />
            </button>

            {/* Play / Pause / Loading Button */}
            <button
              type="button"
              onClick={togglePlayPause}
              disabled={isLoading}
              className="p-1 text-white hover:scale-105 active:scale-95 transition-transform cursor-pointer relative"
              title={isLoading ? 'Loading song...' : isPlaying ? 'Pause' : 'Play'}
            >
              {isLoading ? (
                <div className="w-7 h-7 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                </div>
              ) : isPlaying ? (
                <div className="w-7 h-7 flex items-center justify-center">
                  <Pause className="w-5 h-5 fill-current" />
                </div>
              ) : (
                <div className="w-7 h-7 flex items-center justify-center">
                  <Play className="w-5 h-5 fill-current ml-0.5" />
                </div>
              )}
            </button>

            {/* Next */}
            <button
              type="button"
              onClick={nextTrack}
              className="p-1.5 rounded-full hover:text-white transition-colors cursor-pointer"
              title="Next Track"
            >
              <SkipForward className="w-4 h-4 fill-current" />
            </button>

            {/* Repeat */}
            <button
              type="button"
              onClick={cycleRepeat}
              className={`p-1.5 rounded-full transition-colors cursor-pointer hidden sm:block ${
                repeatMode !== 'off' ? 'text-white' : 'hover:text-white'
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
          {/* 2. CENTER: Artwork (~8px radius) + Title/Artist + Micro Scrubber          */}
          {/* ========================================================================= */}
          <div className="flex items-center gap-3 min-w-0 flex-1 sm:flex-initial">
            {currentTrack ? (
              <div className="flex items-center gap-3 min-w-0">
                <img 
                  src={currentTrack.artwork} 
                  alt="" 
                  onClick={() => setShowLyrics(true)}
                  className="w-10 h-10 rounded-lg object-cover shrink-0 shadow-md border border-white/10 cursor-pointer hover:opacity-85 transition-opacity" 
                  title="Expand Fullscreen Player"
                />
                
                <div className="min-w-0 flex flex-col justify-center items-start pr-1 w-[160px] sm:w-[220px]">
                  <div className="flex items-center gap-1.5 w-full">
                    <button
                      type="button"
                      onClick={() => setShowLyrics(true)}
                      title={playbackStatus === 'error' ? 'This song failed to play — use → to skip' : 'Open Fullscreen Player'}
                      className={`text-[13px] font-semibold truncate hover:underline text-left cursor-pointer leading-snug ${
                        playbackStatus === 'error' ? 'text-red-400' : 'text-white'
                      }`}
                    >
                      {currentTrack.title}
                    </button>
                    {currentTrack.isExplicit && (
                      <span className="px-1 py-0.2 rounded-[3px] bg-white/20 text-[9px] font-mono font-bold text-white shrink-0">
                        E
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={openArtist}
                    title="Go to artist"
                    className="text-[11px] text-[#98989d] hover:text-white hover:underline truncate w-full text-left cursor-pointer leading-snug"
                  >
                    {playbackStatus === 'error'
                      ? 'Playback failed — press → or tap next to skip'
                      : `${resolving ? 'Opening…' : currentTrack.artist} ${currentTrack.album ? `— ${currentTrack.album}` : ''}`}
                  </button>

                  {/* Sleek integrated micro-scrubber (click or drag to seek) */}
                  <div 
                    onPointerDown={handleScrubberPointerDown}
                    className="w-full h-[3px] hover:h-[5px] bg-white/15 rounded-full cursor-pointer transition-all overflow-hidden mt-1.5 relative group touch-none"
                    title={`Seek playback (${formatTime(currentTime)} / ${formatTime(duration)})`}
                  >
                    <div 
                      className="h-full bg-white rounded-full transition-all group-hover:bg-white"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-[#98989d] px-2">
                <span>Select a song to play</span>
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* 3. RIGHT: Star, More Options Popover, Lyrics, Queue, Volume Control       */}
          {/* ========================================================================= */}
          <div className="relative flex items-center gap-1 sm:gap-2 shrink-0 text-[#98989d]">
            {/* Star Favorite */}
            <button
              type="button"
              onClick={() => currentTrack && toggleLike(currentTrack.id)}
              className={`p-1.5 rounded-full transition-colors cursor-pointer hidden sm:block ${
                isLiked ? 'text-amber-400' : 'hover:text-white'
              }`}
              title={isLiked ? 'Starred' : 'Add to favorites'}
            >
              <Star className={`w-3.5 h-3.5 ${isLiked ? 'fill-current' : ''}`} />
            </button>

            {/* Three Dots More (with Apple Music popover anchored above) */}
            <div className="relative inline-flex items-center" ref={moreMenuRef}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (currentTrack) {
                    setShowMoreMenu(prev => !prev);
                  }
                }}
                disabled={!currentTrack}
                className={`p-1.5 rounded-full transition-colors cursor-pointer hidden sm:block ${
                  showMoreMenu ? 'text-white bg-white/20' : 'hover:text-white'
                } ${!currentTrack ? 'opacity-40 cursor-not-allowed' : ''}`}
                title="More options"
                aria-label="More options"
                aria-expanded={showMoreMenu}
              >
                <MoreHorizontal className="w-3.5 h-3.5" />
              </button>

              {/* Apple Music Context Menu Popover */}
              {showMoreMenu && currentTrack && (
                <div 
                  onClick={(e) => e.stopPropagation()}
                  className="absolute bottom-full right-0 mb-3 w-56 bg-[#1e1e20]/95 backdrop-blur-2xl border border-white/15 rounded-2xl shadow-[0_16px_40px_rgba(0,0,0,0.85)] p-1.5 z-50 text-xs animate-in fade-in slide-in-from-bottom-2 duration-150 select-none"
                >
                  {/* Mini track header */}
                  <div className="px-2.5 py-2 border-b border-white/10 mb-1 flex items-center gap-2.5">
                    <img
                      src={currentTrack.artwork || '/default_cover.png'}
                      alt={currentTrack.title}
                      className="w-8 h-8 rounded-lg object-cover shrink-0 shadow-md border border-white/10"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-white text-xs font-semibold truncate leading-tight">{currentTrack.title}</p>
                      <p className="text-white/60 text-[11px] truncate leading-tight mt-0.5">{currentTrack.artist}</p>
                    </div>
                  </div>

                  {/* Up Next preview — click to jump straight to it */}
                  {upNextTrack && !upNextIsCurrent && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowMoreMenu(false);
                        playTrack(upNextTrack, queue);
                      }}
                      className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-white/10 flex items-center gap-2.5 cursor-pointer transition-colors mb-0.5"
                      title={`Play next: ${upNextTrack.title}`}
                    >
                      <img
                        src={upNextTrack.artwork}
                        alt=""
                        className="w-8 h-8 rounded-lg object-cover shrink-0 border border-white/10"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">Up Next</p>
                        <p className="text-white/90 text-xs font-medium truncate leading-tight mt-0.5">{upNextTrack.title}</p>
                        <p className="text-white/50 text-[11px] truncate leading-tight">{upNextTrack.artist}</p>
                      </div>
                      <Play className="w-3.5 h-3.5 text-white/50 shrink-0" />
                    </button>
                  )}

                  {/* Queue Controls */}
                  <button
                    type="button"
                    onClick={() => {
                      addToQueue(currentTrack, true);
                      setShowMoreMenu(false);
                    }}
                    className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-white/10 flex items-center gap-2.5 text-white/90 hover:text-white cursor-pointer transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5 text-white/70" />
                    <span>Play Next</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      addToQueue(currentTrack, false);
                      setShowMoreMenu(false);
                    }}
                    className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-white/10 flex items-center gap-2.5 text-white/90 hover:text-white cursor-pointer transition-colors"
                  >
                    <Disc className="w-3.5 h-3.5 text-white/70" />
                    <span>Add to Queue</span>
                  </button>

                  <div className="my-1 border-t border-white/10" />

                  {/* Actions */}
                  <button
                    type="button"
                    onClick={() => {
                      toggleLike(currentTrack.id);
                      setShowMoreMenu(false);
                    }}
                    className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-white/10 flex items-center gap-2.5 text-white/90 hover:text-white cursor-pointer transition-colors"
                  >
                    <Star className={`w-3.5 h-3.5 ${isLiked ? 'text-amber-400 fill-amber-400' : 'text-white/70'}`} />
                    <span>{isLiked ? 'Remove from Favorites' : 'Favorite'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowMoreMenu(false);
                      openArtist();
                    }}
                    className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-white/10 flex items-center gap-2.5 text-white/90 hover:text-white cursor-pointer transition-colors"
                  >
                    <User className="w-3.5 h-3.5 text-white/70" />
                    <span className="truncate">Go to Artist</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowMoreMenu(false);
                      openAlbum();
                    }}
                    className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-white/10 flex items-center gap-2.5 text-white/90 hover:text-white cursor-pointer transition-colors"
                  >
                    <Compass className="w-3.5 h-3.5 text-white/70" />
                    <span className="truncate">Go to Album</span>
                  </button>

                  <div className="my-1 border-t border-white/10" />

                  {/* Sleep Timer */}
                  <button
                    type="button"
                    onClick={() => setShowSleepOptions(prev => !prev)}
                    className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-white/10 flex items-center justify-between text-white/90 hover:text-white cursor-pointer transition-colors"
                  >
                    <span className="flex items-center gap-2.5">
                      <Moon className="w-3.5 h-3.5 text-white/70" />
                      <span>Sleep Timer</span>
                    </span>
                    <span className="flex items-center gap-1 text-white/50">
                      {sleepTimerLabel}
                      <ChevronRight className={`w-3 h-3 transition-transform ${showSleepOptions ? 'rotate-90' : ''}`} />
                    </span>
                  </button>

                  {showSleepOptions && (
                    <div className="pl-8 pr-1.5 pb-1.5 space-y-0.5">
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
                              setShowSleepOptions(false);
                              setShowMoreMenu(false);
                            }}
                            className={`w-full text-left px-2.5 py-1.5 rounded-xl flex items-center justify-between cursor-pointer transition-colors ${
                              isActive ? 'text-white bg-white/10' : 'text-white/60 hover:text-white hover:bg-white/5'
                            }`}
                          >
                            <span>{opt.label}</span>
                            {isActive && <Check className="w-3 h-3 text-emerald-400" />}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="my-1 border-t border-white/10" />

                  <button
                    type="button"
                    onClick={() => {
                      try {
                        navigator.clipboard.writeText(
                          window.location.origin + `/music?track=${encodeURIComponent(currentTrack.id)}`
                        );
                        setCopied(true);
                        setTimeout(() => {
                          setCopied(false);
                          setShowMoreMenu(false);
                        }, 1000);
                      } catch {
                        setShowMoreMenu(false);
                      }
                    }}
                    className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-white/10 flex items-center gap-2.5 text-white/90 hover:text-white cursor-pointer transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5 text-white/70" />}
                    <span>{copied ? 'Link Copied!' : 'Share Track'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Synced Lyrics Toggle (Quote / Message) */}
            <button
              type="button"
              onClick={toggleLyrics}
              className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                showLyrics ? 'text-white bg-white/15' : 'hover:text-white'
              }`}
              title="Lyrics"
            >
              <MessageSquareQuote className="w-4 h-4" />
            </button>

            {/* Up Next Queue Toggle (List) */}
            <button
              type="button"
              onClick={toggleQueue}
              className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                showQueue ? 'text-white bg-white/15' : 'hover:text-white'
              }`}
              title="Queue"
            >
              <List className="w-4 h-4" />
            </button>

            {/* Sleep Timer Active Indicator */}
            {sleepTimerMode !== 'off' && (
              <button
                type="button"
                onClick={() => setShowMoreMenu(true)}
                className="p-1.5 rounded-full text-white hover:text-white transition-colors cursor-pointer hidden sm:block"
                title={`Sleep timer: ${sleepTimerLabel}`}
              >
                <Moon className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Inline Volume Control (Apple Music Desktop Style) */}
            <div
              ref={volumeRef}
              className="flex items-center gap-1.5 pl-1"
              title="Scroll to adjust volume"
            >
              <button
                type="button"
                onClick={toggleMute}
                className="p-1 rounded-full hover:text-white transition-colors cursor-pointer"
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-3.5 h-3.5 text-white/40" />
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
                className="w-16 sm:w-20 h-1 bg-white/20 accent-white rounded-full appearance-none cursor-pointer hidden sm:block"
                aria-label="Volume"
              />
            </div>

          </div>

        </div>
      </div>
    </>
  );
};

export default FloatingPlayer;


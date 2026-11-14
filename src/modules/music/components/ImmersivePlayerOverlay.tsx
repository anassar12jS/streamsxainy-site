import React, { useEffect, useRef, useState } from 'react';
import {
  X, Play, Pause, SkipBack, SkipForward,
  Shuffle, Repeat, Volume1, Volume2, VolumeX, MessageSquareQuote, ListMusic,
  Star, MoreHorizontal, Maximize2, Minimize2, Trash2, Disc, Moon, Check,
  ChevronDown, ChevronRight, Headphones, Plus, User, Compass, Share2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useMusicPlayerStore } from '../store/useMusicPlayerStore';
import { fetchLyrics } from '../api/lyrics';
import { resolveArtistId, resolveAlbumId } from '../api/innertube';
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
  const navigate = useNavigate();
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
  const audioQuality = useMusicPlayerStore(state => state.audioQuality);
  const setAudioQuality = useMusicPlayerStore(state => state.setAudioQuality);
  const activeStreamInfo = useMusicPlayerStore(state => state.activeStreamInfo);

  const playTrack = useMusicPlayerStore(state => state.playTrack);
  const togglePlayPause = useMusicPlayerStore(state => state.togglePlayPause);
  const nextTrack = useMusicPlayerStore(state => state.nextTrack);
  const prevTrack = useMusicPlayerStore(state => state.prevTrack);
  const toggleShuffle = useMusicPlayerStore(state => state.toggleShuffle);
  const cycleRepeat = useMusicPlayerStore(state => state.cycleRepeat);
  const setVolume = useMusicPlayerStore(state => state.setVolume);
  const toggleMute = useMusicPlayerStore(state => state.toggleMute);
  const toggleLike = useMusicPlayerStore(state => state.toggleLike);
  const addToQueue = useMusicPlayerStore(state => state.addToQueue);
  const removeFromQueue = useMusicPlayerStore(state => state.removeFromQueue);
  const clearQueue = useMusicPlayerStore(state => state.clearQueue);
  const sleepTimerMode = useMusicPlayerStore(state => state.sleepTimerMode);
  const sleepTimerEndsAt = useMusicPlayerStore(state => state.sleepTimerEndsAt);
  const sleepTimerMinutes = useMusicPlayerStore(state => state.sleepTimerMinutes);
  const setSleepTimer = useMusicPlayerStore(state => state.setSleepTimer);

  const [resolvingNav, setResolvingNav] = useState<'artist' | 'album' | null>(null);

  const openArtist = async () => {
    if (!currentTrack || resolvingNav) return;
    setResolvingNav('artist');
    try {
      const cached = currentTrack.artistId;
      const id = cached || await resolveArtistId(currentTrack);
      if (id) navigate(`/music/artist/${id}`);
    } finally {
      setResolvingNav(null);
    }
  };

  const openAlbum = async () => {
    if (!currentTrack || resolvingNav) return;
    setResolvingNav('album');
    try {
      const cached = currentTrack.albumId;
      const id = cached || await resolveAlbumId(currentTrack);
      if (id) navigate(`/music/album/${id}`);
    } finally {
      setResolvingNav(null);
    }
  };

  const activeLyrics = useMusicPlayerStore(state => state.activeLyrics);
  const setLyrics = useMusicPlayerStore(state => state.setLyrics);
  const isLoadingLyrics = useMusicPlayerStore(state => state.isLoadingLyrics);
  const setIsLoadingLyrics = useMusicPlayerStore(state => state.setIsLoadingLyrics);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSleepMenu, setShowSleepMenu] = useState(false);
  const [ambient, setAmbient] = useState<AmbientColors | null>(null);
  const [mobileView, setMobileView] = useState<'player' | 'lyrics' | 'queue'>('player');
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [mobileAudioSheetOpen, setMobileAudioSheetOpen] = useState(false);
  const [mobileCopied, setMobileCopied] = useState(false);

  // Always land on the full artwork Now Playing view when opened on mobile
  useEffect(() => {
    if (showLyrics) {
      setMobileView('player');
      setMobileMoreOpen(false);
      setMobileAudioSheetOpen(false);
    }
  }, [showLyrics]);

  // Extract dominant artwork colors for the ambient background
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
    if (!showSleepMenu && !mobileAudioSheetOpen) return;
    const id = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(id);
  }, [showSleepMenu, mobileAudioSheetOpen]);

  const activeLineRef = useRef<HTMLDivElement | null>(null);
  const lyricsContainerRef = useRef<HTMLDivElement | null>(null);
  const mobileLyricsRef = useRef<HTMLDivElement | null>(null);
  const mobileActiveLineRef = useRef<HTMLDivElement | null>(null);

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

    fetchLyrics(currentTrack.artist, currentTrack.title, currentTrack.duration, currentTrack.youtubeId).then(data => {
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

  // Auto-scroll active lyric into center smoothly without jitter (desktop & mobile)
  useEffect(() => {
    if (immersiveTab === 'lyrics' && activeLineRef.current && lyricsContainerRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
    if (mobileView === 'lyrics' && mobileActiveLineRef.current && mobileLyricsRef.current) {
      mobileActiveLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [Math.floor(effectiveTime), immersiveTab, mobileView]);

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

  const isOpen = showLyrics;

  // Keyboard shortcuts: Space/K play-pause, ←/→ seek ±5s, ↑/↓ volume, Esc close, F fullscreen
  useEffect(() => {
    if (!isOpen || !currentTrack) return;
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
  }, [isOpen, currentTrack?.id, effectiveTime, duration, volume]);

  if (!isOpen || !currentTrack) return null;

  const sleepTimerLabel = (() => {
    if (sleepTimerMode === 'trackEnd') return 'End of Song';
    if (sleepTimerMode === 'time' && sleepTimerEndsAt) {
      const minsLeft = Math.max(1, Math.ceil((sleepTimerEndsAt - now) / 60000));
      return `${minsLeft}m left`;
    }
    return 'Off';
  })();

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
  const effectiveDuration = duration > 0 ? duration : (currentTrack.duration || 0);
  const remainingTime = Math.max(0, effectiveDuration - currentTime);
  const progressPercent = effectiveDuration > 0 ? Math.min(100, Math.max(0, (currentTime / effectiveDuration) * 100)) : 0;

  // Active line calculation
  const activeLineIdx = activeLyrics?.synced && activeLyrics.synced.length > 0
    ? activeLyrics.synced.findIndex((line, i) => {
        const nextTime = activeLyrics.synced![i + 1]?.time ?? Infinity;
        return effectiveTime >= line.time && effectiveTime < nextTime;
      })
    : -1;

  const currentLyricPreview = (() => {
    if (activeLineIdx >= 0 && activeLyrics?.synced?.[activeLineIdx]?.text) {
      return activeLyrics.synced[activeLineIdx].text;
    }
    if (activeLyrics?.synced?.[0]?.text) {
      return activeLyrics.synced[0].text;
    }
    if (activeLyrics?.plain) {
      const firstLine = activeLyrics.plain.split('\n').map(s => s.trim()).find(Boolean);
      if (firstLine) return firstLine;
    }
    return 'Lyrics';
  })();

  const upNextTracks = queue.slice(queueIndex + 1);

  const codecLineText = activeStreamInfo?.label
    || (audioQuality === 'lossless' ? 'FLAC · Lossless' : audioQuality === 'high' ? 'High Quality' : 'Standard Audio');

  const centerQualityText = activeStreamInfo?.isLossless
    ? 'Hi-Res Lossless'
    : audioQuality === 'lossless'
      ? 'Lossless'
      : audioQuality === 'high'
        ? 'High Quality'
        : 'Audio';

  const seekFromPointer = (clientX: number, el: HTMLElement) => {
    if (!effectiveDuration || effectiveDuration <= 0) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onSeek(ratio * effectiveDuration);
  };

  const handleMobileScrubberPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!effectiveDuration || effectiveDuration <= 0) return;
    e.preventDefault();
    seekFromPointer(e.clientX, e.currentTarget);
    const el = e.currentTarget;
    const onMove = (ev: PointerEvent) => seekFromPointer(ev.clientX, el);
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const volumeFromPointer = (clientX: number, el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    setVolume(ratio);
  };

  const handleMobileVolumePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    volumeFromPointer(e.clientX, e.currentTarget);
    const el = e.currentTarget;
    const onMove = (ev: PointerEvent) => volumeFromPointer(ev.clientX, el);
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const handleMobileShare = () => {
    try {
      navigator.clipboard.writeText(
        window.location.origin + `/music?track=${encodeURIComponent(currentTrack.id)}`
      );
      setMobileCopied(true);
      window.setTimeout(() => {
        setMobileCopied(false);
        setMobileMoreOpen(false);
      }, 900);
    } catch {
      setMobileMoreOpen(false);
    }
  };

  const handleGoToArtist = async () => {
    setMobileMoreOpen(false);
    const id = await resolveArtistId(currentTrack);
    if (id) {
      setShowLyrics(false);
      navigate(`/music/artist/${id}`);
    }
  };

  const handleGoToAlbum = async () => {
    setMobileMoreOpen(false);
    const id = await resolveAlbumId(currentTrack);
    if (id) {
      setShowLyrics(false);
      navigate(`/music/album/${id}`);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex flex-col bg-[#07080b] text-white select-none overflow-hidden animate-fade-in font-sans pb-[env(safe-area-inset-bottom)]"
      style={{ fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}
    >
      {/* ========================================================================= */}
      {/* 1. ATMOSPHERIC AMBIENT BACKGROUND: artwork blur + dominant-color blobs    */}
      {/* ========================================================================= */}
      <div 
        className="absolute inset-0 bg-cover bg-center filter blur-[120px] opacity-25 scale-110 pointer-events-none transition-all duration-1000"
        style={{ backgroundImage: `url(${currentTrack.artwork})` }}
      />
      <div
        className="absolute -top-[20%] -left-[10%] w-[70vmax] h-[70vmax] rounded-full pointer-events-none transition-colors duration-1000"
        style={{
          background: `radial-gradient(circle at center, ${ambient?.[0] ?? '#1a1a2e'} 0%, transparent 65%)`,
          opacity: 0.34,
          filter: 'blur(60px)',
          animation: 'ambDrift1 26s ease-in-out infinite alternate',
        }}
      />
      <div
        className="absolute -bottom-[25%] -right-[10%] w-[65vmax] h-[65vmax] rounded-full pointer-events-none transition-colors duration-1000"
        style={{
          background: `radial-gradient(circle at center, ${ambient?.[1] ?? '#16213e'} 0%, transparent 65%)`,
          opacity: 0.3,
          filter: 'blur(70px)',
          animation: 'ambDrift2 32s ease-in-out infinite alternate',
        }}
      />
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 40%, transparent 30%, rgba(7,8,11,0.55) 100%)' }} />
      <div className="absolute inset-0 bg-[#07080b]/60 pointer-events-none" />

      {/* ========================================================================= */}
      {/* MOBILE (< lg): Fullscreen Now Playing Screen matching Reference 2         */}
      {/* ========================================================================= */}
      <div className="lg:hidden relative z-20 flex-1 flex flex-col min-h-0 px-6 pt-2 pb-3 max-w-md mx-auto w-full justify-between">
        {/* Top dismiss bar */}
        <div className="flex items-center justify-between shrink-0 h-10">
          <button
            type="button"
            onClick={handleClose}
            className="min-w-[44px] min-h-[44px] -ml-2 flex items-center justify-center rounded-full text-white/55 hover:text-white transition-colors cursor-pointer"
            aria-label="Close full-screen player"
            title="Close"
          >
            <ChevronDown className="w-6 h-6" />
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="w-10 h-1 rounded-full bg-white/25 cursor-pointer"
            aria-label="Minimize player"
          />
          <div className="w-10" aria-hidden="true" />
        </div>

        {/* SUBVIEW A: MAIN NOW PLAYING HERO (Reference 2) */}
        {mobileView === 'player' && (
          <div className="flex-1 flex flex-col justify-evenly min-h-0 py-1">
            {/* Artwork + centered unboxed quality metadata */}
            <div className="flex flex-col items-center">
              <div
                className="relative aspect-square w-full max-w-[min(86vw,340px)] rounded-2xl overflow-hidden shadow-[0_24px_70px_rgba(0,0,0,0.85)] border border-white/[0.08] bg-[#121316]"
                style={{
                  boxShadow: ambient
                    ? `0 24px 70px rgba(0,0,0,0.85), 0 0 80px ${ambient[0]}2e`
                    : '0 24px 60px rgba(0,0,0,0.85)',
                }}
              >
                <img
                  key={currentTrack.id}
                  src={currentTrack.artwork}
                  alt={currentTrack.title}
                  className="w-full h-full object-cover"
                  style={{ animation: isPlaying ? 'artBreathe 7s ease-in-out infinite' : undefined }}
                />
              </div>

              <p className="text-[11px] text-white/55 text-center mt-2.5 truncate max-w-full px-2">
                {codecLineText}
              </p>
            </div>

            {/* Title / Artist + circular Star & More buttons */}
            <div className="space-y-3.5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h1 className="text-[22px] font-bold text-white tracking-tight truncate leading-tight">
                      {currentTrack.title}
                    </h1>
                    {currentTrack.isExplicit && (
                      <span className="px-1.5 py-0.5 rounded-[4px] bg-white/20 text-[9px] font-mono font-bold text-white shrink-0">
                        E
                      </span>
                    )}
                  </div>
                  <p className="text-[16px] text-white/65 truncate leading-snug mt-0.5">
                    {currentTrack.artist}
                  </p>
                </div>

                <div className="relative flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => toggleLike(currentTrack.id)}
                    className="w-10 h-10 min-w-[44px] min-h-[44px] rounded-full bg-white/[0.1] hover:bg-white/[0.18] flex items-center justify-center transition-colors cursor-pointer"
                    aria-label={isLiked ? 'Remove from favorites' : 'Add to favorites'}
                    title={isLiked ? 'Remove from Favorites' : 'Favorite'}
                  >
                    <Star className={`w-5 h-5 ${isLiked ? 'fill-white text-white' : 'text-white/85'}`} />
                  </button>

                  <button
                    type="button"
                    onClick={() => setMobileMoreOpen(prev => !prev)}
                    className="w-10 h-10 min-w-[44px] min-h-[44px] rounded-full bg-white/[0.1] hover:bg-white/[0.18] flex items-center justify-center transition-colors cursor-pointer"
                    aria-label="More playback options"
                    aria-expanded={mobileMoreOpen}
                    title="More options"
                  >
                    <MoreHorizontal className="w-5 h-5 text-white/85" />
                  </button>

                  {mobileMoreOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setMobileMoreOpen(false)} />
                      <div className="absolute right-0 bottom-full mb-2 w-56 bg-[#1e1e20]/95 backdrop-blur-2xl border border-white/15 rounded-2xl shadow-2xl p-1.5 z-50 text-xs">
                        <button
                          type="button"
                          onClick={() => {
                            toggleShuffle();
                            setMobileMoreOpen(false);
                          }}
                          className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-white/10 flex items-center justify-between text-white/90 cursor-pointer"
                        >
                          <span className="flex items-center gap-2.5">
                            <Shuffle className="w-4 h-4 text-white/70" />
                            <span>Shuffle</span>
                          </span>
                          <span className="text-white/50">{shuffle ? 'On' : 'Off'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            cycleRepeat();
                            setMobileMoreOpen(false);
                          }}
                          className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-white/10 flex items-center justify-between text-white/90 cursor-pointer"
                        >
                          <span className="flex items-center gap-2.5">
                            <Repeat className="w-4 h-4 text-white/70" />
                            <span>Repeat</span>
                          </span>
                          <span className="text-white/50 capitalize">{repeatMode}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            addToQueue(currentTrack, true);
                            setMobileMoreOpen(false);
                          }}
                          className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-white/10 flex items-center gap-2.5 text-white/90 cursor-pointer"
                        >
                          <Plus className="w-4 h-4 text-white/70" />
                          <span>Play Next</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleGoToArtist}
                          className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-white/10 flex items-center gap-2.5 text-white/90 cursor-pointer"
                        >
                          <User className="w-4 h-4 text-white/70" />
                          <span>Go to Artist</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleGoToAlbum}
                          className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-white/10 flex items-center gap-2.5 text-white/90 cursor-pointer"
                        >
                          <Compass className="w-4 h-4 text-white/70" />
                          <span>Go to Album</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleMobileShare}
                          className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-white/10 flex items-center gap-2.5 text-white/90 cursor-pointer"
                        >
                          {mobileCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4 text-white/70" />}
                          <span>{mobileCopied ? 'Link Copied' : 'Share Track'}</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Single-line clickable synced lyric preview */}
              <button
                type="button"
                onClick={() => setMobileView('lyrics')}
                className="flex items-center gap-1.5 text-left max-w-full text-[15px] font-medium text-white/75 hover:text-white transition-colors min-h-[32px] cursor-pointer"
              >
                <span className="truncate">{currentLyricPreview}</span>
                <ChevronRight className="w-4 h-4 text-white/55 shrink-0" />
              </button>

              {/* Progress scrubber + 3-slot elapsed / Lossless / remaining */}
              <div>
                <div
                  onPointerDown={handleMobileScrubberPointerDown}
                  role="slider"
                  aria-label="Seek playback"
                  aria-valuemin={0}
                  aria-valuemax={effectiveDuration || 100}
                  aria-valuenow={Math.round(currentTime)}
                  tabIndex={0}
                  className="w-full py-2 -my-2 cursor-pointer touch-none group"
                >
                  <div className="w-full h-[5px] bg-white/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white/90 rounded-full transition-[width] duration-75"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-white/45 mt-1.5">
                  <span>{formatTime(currentTime)}</span>
                  <span className="inline-flex items-center gap-1.5 text-white/55 font-sans">
                    <svg viewBox="0 0 22 14" className="w-4 h-3" fill="none" aria-hidden="true">
                      <path
                        d="M2 8.5C4.5 3.5 6.5 3.5 9 8.5C11.5 13.5 13.5 13.5 16 8.5C17.5 5.5 19 4.5 20.5 6"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                      />
                    </svg>
                    {centerQualityText}
                  </span>
                  <span>{formatRemainingTime(remainingTime)}</span>
                </div>
              </div>
            </div>

            {/* Large centered transport controls */}
            <div className="flex items-center justify-around px-2">
              <button
                type="button"
                onClick={prevTrack}
                className="min-w-[52px] min-h-[52px] flex items-center justify-center text-white active:scale-95 transition-transform cursor-pointer"
                aria-label="Previous track"
                title="Previous Track"
              >
                <svg viewBox="0 0 28 18" className="w-10 h-7 fill-white" aria-hidden="true">
                  <path d="M26.2 2.6c0-1-.98-1.6-1.82-1.1l-9.2 5.6c-.8.49-.8 1.71 0 2.2l9.2 5.6c.84.5 1.82-.1 1.82-1.1V2.6zM13.2 2.6c0-1-.98-1.6-1.82-1.1l-9.2 5.6c-.8.49-.8 1.71 0 2.2l9.2 5.6c.84.5 1.82-.1 1.82-1.1V2.6z" />
                </svg>
              </button>

              <button
                type="button"
                onClick={togglePlayPause}
                className="min-w-[60px] min-h-[60px] flex items-center justify-center text-white active:scale-95 transition-transform cursor-pointer"
                aria-label={isPlaying ? 'Pause' : 'Play'}
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? (
                  <Pause className="w-11 h-11 fill-white text-white" />
                ) : (
                  <Play className="w-11 h-11 fill-white text-white ml-1" />
                )}
              </button>

              <button
                type="button"
                onClick={nextTrack}
                className="min-w-[52px] min-h-[52px] flex items-center justify-center text-white active:scale-95 transition-transform cursor-pointer"
                aria-label="Next track"
                title="Next Track"
              >
                <svg viewBox="0 0 28 18" className="w-10 h-7 fill-white" aria-hidden="true">
                  <path d="M1.8 2.6c0-1 .98-1.6 1.82-1.1l9.2 5.6c.8.49.8 1.71 0 2.2l-9.2 5.6c-.84.5-1.82-.1-1.82-1.1V2.6zM14.8 2.6c0-1 .98-1.6 1.82-1.1l9.2 5.6c.8.49.8 1.71 0 2.2l-9.2 5.6c-.84.5-1.82-.1-1.82-1.1V2.6z" />
                </svg>
              </button>
            </div>

            {/* Full-width mobile volume slider with left/right speakers */}
            <div className="flex items-center gap-3 w-full">
              <button
                type="button"
                onClick={toggleMute}
                className="min-w-[36px] min-h-[36px] flex items-center justify-center text-white/45 hover:text-white transition-colors cursor-pointer"
                aria-label={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4" />
                ) : (
                  <Volume1 className="w-4 h-4" />
                )}
              </button>

              <div
                onPointerDown={handleMobileVolumePointerDown}
                role="slider"
                aria-label="Volume"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round((isMuted ? 0 : volume) * 100)}
                tabIndex={0}
                className="flex-1 py-2 -my-2 cursor-pointer touch-none"
              >
                <div className="w-full h-[5px] bg-white/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white/90 rounded-full"
                    style={{ width: `${(isMuted ? 0 : volume) * 100}%` }}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => setVolume(1)}
                className="min-w-[36px] min-h-[36px] flex items-center justify-center text-white/45 hover:text-white transition-colors cursor-pointer"
                aria-label="Max volume"
              >
                <Volume2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* SUBVIEW B: MOBILE FULL-HEIGHT LYRICS */}
        {mobileView === 'lyrics' && (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between gap-3 py-2 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <img src={currentTrack.artwork} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0 border border-white/10" />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white truncate">{currentTrack.title}</p>
                  <p className="text-xs text-white/60 truncate">{currentTrack.artist}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={togglePlayPause}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-white/10 text-white cursor-pointer shrink-0"
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white ml-0.5" />}
              </button>
            </div>

            <div
              ref={mobileLyricsRef}
              className="flex-1 overflow-y-auto overscroll-contain py-10 space-y-6 select-none"
              style={{
                maskImage: 'linear-gradient(to bottom, transparent 0%, black 10%, black 88%, transparent 100%)',
                WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 10%, black 88%, transparent 100%)',
              }}
            >
              {isLoadingLyrics ? (
                <div className="flex flex-col items-center justify-center h-full text-white/45 gap-3 py-20">
                  <Disc className="w-7 h-7 animate-spin text-white/50" />
                  <p className="text-sm font-medium">Loading synchronized lyrics...</p>
                </div>
              ) : activeLyrics?.synced && activeLyrics.synced.length > 0 ? (
                activeLyrics.synced.map((line, idx) => {
                  const isActive = idx === activeLineIdx;
                  return (
                    <div
                      key={`ml-${line.time}-${idx}`}
                      ref={isActive ? mobileActiveLineRef : null}
                      onClick={() => onSeek(line.time)}
                      className={`cursor-pointer transition-all duration-300 leading-snug tracking-tight ${
                        isActive ? 'text-white font-extrabold text-2xl' : 'text-white/30 font-bold text-xl'
                      }`}
                    >
                      {line.text}
                    </div>
                  );
                })
              ) : activeLyrics?.plain ? (
                <div className="whitespace-pre-line text-xl font-bold leading-relaxed text-white/85">
                  {activeLyrics.plain}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center text-white/45 gap-2 py-20">
                  <Disc className="w-9 h-9 text-white/25" />
                  <p className="text-base font-semibold text-white">No Lyrics Available</p>
                  <p className="text-xs text-[#8e8e93] max-w-xs">
                    Lyrics could not be found for this track.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SUBVIEW C: MOBILE UP NEXT QUEUE */}
        {mobileView === 'queue' && (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between py-2.5 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <img src={currentTrack.artwork} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0 border border-white/10" />
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-wider text-white/45 font-semibold">Up next</p>
                  <p className="text-sm font-bold text-white truncate">{currentTrack.title}</p>
                </div>
              </div>
              {upNextTracks.length > 0 && (
                <button
                  type="button"
                  onClick={clearQueue}
                  className="text-sm font-semibold text-[#ff453a] min-h-[44px] px-2 cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain py-3 space-y-1">
              {upNextTracks.length > 0 ? (
                upNextTracks.map((track, idx) => {
                  const actualQueueIndex = queueIndex + 1 + idx;
                  return (
                    <div
                      key={`mq-${track.id}-${idx}`}
                      onClick={() => playTrack(track, queue)}
                      className="flex items-center justify-between p-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <img src={track.artwork} alt="" className="w-11 h-11 rounded-[8px] object-cover bg-[#1a1a1a] shrink-0" />
                        <div className="min-w-0 flex-1 text-left">
                          <h4 className="text-sm font-semibold text-white truncate">{track.title}</h4>
                          <p className="text-xs text-[#8e8e93] truncate mt-0.5">{track.artist}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFromQueue(actualQueueIndex);
                        }}
                        className="min-w-[44px] min-h-[44px] flex items-center justify-center text-white/50 hover:text-white cursor-pointer"
                        aria-label={`Remove ${track.title} from queue`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })
              ) : (
                <div className="py-20 text-center text-white/45 space-y-2">
                  <ListMusic className="w-10 h-10 mx-auto text-white/25" />
                  <p className="text-base font-semibold text-white">Queue is Empty</p>
                  <p className="text-xs text-[#8e8e93]">Add songs to play next from any album or playlist.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Audio Quality & Sleep Timer Bottom Sheet on Mobile */}
        {mobileAudioSheetOpen && (
          <>
            <div className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm" onClick={() => setMobileAudioSheetOpen(false)} />
            <div className="fixed inset-x-4 bottom-20 z-50 bg-[#1a1a1d]/95 backdrop-blur-2xl border border-white/15 rounded-3xl p-4 shadow-2xl space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-white/45 px-1 mb-2">Audio Quality</p>
                <div className="grid grid-cols-3 gap-1.5 bg-white/[0.06] p-1 rounded-2xl">
                  {(['auto', 'high', 'lossless'] as const).map(q => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setAudioQuality(q)}
                      className={`py-2 rounded-xl text-xs font-semibold capitalize transition-colors cursor-pointer ${
                        audioQuality === q ? 'bg-white text-black' : 'text-white/70 hover:text-white'
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between px-1 mb-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-white/45">Sleep Timer</p>
                  <span className="text-xs text-white/60">{sleepTimerLabel}</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { mode: 'off' as const, label: 'Off' },
                    { mode: 'time' as const, minutes: 15, label: '15 min' },
                    { mode: 'time' as const, minutes: 30, label: '30 min' },
                    { mode: 'time' as const, minutes: 60, label: '1 hour' },
                    { mode: 'trackEnd' as const, label: 'End song' },
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
                          setMobileAudioSheetOpen(false);
                        }}
                        className={`py-2 px-2 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                          isActive ? 'bg-white/15 border-white/30 text-white' : 'bg-white/[0.04] border-white/10 text-white/65'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Bottom 3-icon toolbar matching Reference 2 */}
        <div className="flex items-center justify-around pt-1 pb-1 shrink-0">
          <button
            type="button"
            onClick={() => setMobileView(prev => prev === 'lyrics' ? 'player' : 'lyrics')}
            className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl transition-colors cursor-pointer ${
              mobileView === 'lyrics' ? 'text-white bg-white/15' : 'text-white/45 hover:text-white'
            }`}
            aria-label="Lyrics"
            title="Lyrics"
          >
            <MessageSquareQuote className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => setMobileAudioSheetOpen(prev => !prev)}
            className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl transition-colors cursor-pointer ${
              mobileAudioSheetOpen || sleepTimerMode !== 'off' ? 'text-white bg-white/15' : 'text-white/45 hover:text-white'
            }`}
            aria-label="Audio quality and sleep timer"
            title="Audio & Sleep Timer"
          >
            <Headphones className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => setMobileView(prev => prev === 'queue' ? 'player' : 'queue')}
            className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl transition-colors cursor-pointer ${
              mobileView === 'queue' ? 'text-white bg-white/15' : 'text-white/45 hover:text-white'
            }`}
            aria-label="Up Next queue"
            title="Up Next"
          >
            <ListMusic className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* DESKTOP (>= lg): TOP-LEFT CLOSE BUTTON + 2-COLUMN SPLIT VIEW              */}
      {/* ========================================================================= */}
      <button
        type="button"
        onClick={handleClose}
        className="hidden lg:flex absolute top-6 left-6 z-40 p-2 text-white/50 hover:text-white transition-colors cursor-pointer group"
        title="Close fullscreen player"
      >
        <X className="w-5 h-5 group-hover:scale-110 transition-transform" />
      </button>

      <main className="hidden lg:grid relative z-20 flex-1 grid-cols-12 gap-14 px-20 pt-12 pb-12 min-h-0 overflow-hidden max-w-[1600px] mx-auto w-full">
        
        {/* LEFT COLUMN: PLAYER HERO & CONTROLS STACK */}
        <div className={`${immersiveTab === 'none' ? 'col-span-12' : 'col-span-5'} flex flex-col justify-center items-start w-full h-full max-w-[400px] mx-auto min-h-0`}>
          
          {/* Album Artwork with smooth rounded corners & subtle shadow */}
          <div 
            className="relative aspect-square w-full max-w-[320px] rounded-3xl overflow-hidden shrink-0 transition-shadow duration-700"
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
          <div className="w-full mt-6 space-y-4">
            
            {/* Title Row with Explicit Badge + Star + More */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <h1 className="text-white font-bold text-[19px] tracking-tight truncate">
                  {currentTrack.title}
                </h1>
                {currentTrack.isExplicit && (
                  <span className="px-1.5 py-0.5 rounded-[4px] bg-white/20 text-[9px] font-mono font-bold text-white shrink-0 tracking-wider">
                    E
                  </span>
                )}
              </div>

              {/* Action Buttons: Star + Sleep Timer + More */}
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

            {/* Subtitle: Artist · Album — each navigates to its own page */}
            <div className="flex items-center justify-center gap-1.5 text-[13px] sm:text-sm text-[#8e8e93] font-normal truncate -mt-2">
              <button
                type="button"
                onClick={openArtist}
                title="Go to artist"
                className="hover:text-white hover:underline transition-colors cursor-pointer truncate"
              >
                {resolvingNav === 'artist' ? 'Opening…' : currentTrack.artist}
              </button>
              {currentTrack.album && (
                <>
                  <span className="text-[#55555f]">·</span>
                  <button
                    type="button"
                    onClick={openAlbum}
                    title="Go to album"
                    className="hover:text-white hover:underline transition-colors cursor-pointer truncate"
                  >
                    {resolvingNav === 'album' ? 'Opening…' : currentTrack.album}
                  </button>
                </>
              )}
            </div>

            {/* Quality metadata — clean unboxed typography */}
            {(() => {
              const info = activeStreamInfo;
              const label = info?.label
                || (audioQuality === 'lossless' ? 'Lossless' : audioQuality === 'high' ? 'High quality' : null);
              if (!label) return null;
              return (
                <p className="text-[11px] font-medium text-white/55 tracking-wide -mt-1 truncate">
                  {label}
                </p>
              );
            })()}

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

            {/* Apple Music Minimalist Transport Controls */}
            <div className="w-full flex items-center justify-between px-2 pt-1 select-none">
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

              <button
                type="button"
                onClick={prevTrack}
                className="p-2 text-white hover:opacity-80 active:scale-95 transition-all cursor-pointer"
                title="Previous Track"
              >
                <SkipBack className="w-5 h-5 fill-white text-white" />
              </button>

              <button
                type="button"
                onClick={togglePlayPause}
                className="p-2 text-white hover:scale-105 active:scale-95 transition-transform cursor-pointer"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? (
                  <Pause className="w-7 h-7 fill-white text-white" />
                ) : (
                  <Play className="w-7 h-7 fill-white text-white ml-0.5" />
                )}
              </button>

              <button
                type="button"
                onClick={nextTrack}
                className="p-2 text-white hover:opacity-80 active:scale-95 transition-all cursor-pointer"
                title="Next Track"
              >
                <SkipForward className="w-5 h-5 fill-white text-white" />
              </button>

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
            <div className="flex w-full items-center gap-2.5 pt-1">
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

        {/* RIGHT COLUMN: CRISP SYNCHRONIZED LYRICS OR UP-NEXT QUEUE */}
        <div className={immersiveTab === 'none'
          ? 'hidden'
          : 'col-span-7 flex flex-col h-full min-h-0 overflow-hidden pl-12 pt-0'
        }>
          
          {/* VIEW A: LYRICS */}
          {immersiveTab === 'lyrics' && (
            <div 
              ref={lyricsContainerRef}
              className="flex-1 overflow-y-auto overscroll-contain pr-4 am-scrollbar py-24 select-none"
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
                            ? 'text-white font-extrabold text-[44px] scale-[1.01] origin-left blur-none'
                            : 'text-white/20 hover:text-white/60 font-bold text-[34px] blur-[0.4px]'
                        }`}
                      >
                        {line.text}
                      </div>
                    );
                  })}
                </div>
              ) : activeLyrics?.plain ? (
                <div className="whitespace-pre-line text-3xl font-bold leading-relaxed text-white/80 py-12 px-2">
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

          {/* VIEW B: UP NEXT QUEUE */}
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

              <div className="flex-1 overflow-y-auto overscroll-contain am-scrollbar py-3 space-y-1">
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
                            className="p-1.5 -m-1 text-white/50 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
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

      {/* DESKTOP BOTTOM-RIGHT CONTROLS: Lyrics bubble icon, Queue toggle, Fullscreen */}
      <footer className="hidden lg:flex absolute bottom-6 right-6 z-40 items-center justify-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => setImmersiveTab(immersiveTab === 'lyrics' ? 'none' : 'lyrics')}
          className={`p-2.5 rounded-xl transition-all cursor-pointer ${
            immersiveTab === 'lyrics'
              ? 'text-white bg-white/15'
              : 'text-white/40 hover:text-white hover:bg-white/5'
          }`}
          title="Lyrics — tap again to focus player"
        >
          <MessageSquareQuote className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={() => setImmersiveTab(immersiveTab === 'queue' ? 'none' : 'queue')}
          className={`p-2.5 rounded-xl transition-all cursor-pointer ${
            immersiveTab === 'queue'
              ? 'text-white bg-white/15'
              : 'text-white/40 hover:text-white hover:bg-white/5'
          }`}
          title="Up Next — tap again to focus player"
        >
          <ListMusic className="w-5 h-5" />
        </button>

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

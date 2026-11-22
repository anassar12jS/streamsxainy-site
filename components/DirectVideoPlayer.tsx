import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Hls from 'hls.js';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  Check,
  ChevronRight,
  ExternalLink,
  FastForward,
  Gauge,
  Layers,
  Loader2,
  Maximize,
  Maximize2,
  Minimize2,
  Pause,
  PictureInPicture2,
  Play,
  RectangleHorizontal,
  Rewind,
  RotateCw,
  SlidersHorizontal,
  Subtitles,
  Upload,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import { Stream } from '../types';
import {
  SUBTITLE_LANGUAGES,
  SubtitleTrack,
  cueIndexAt,
  fetchSubtitles,
  parseSubtitleText,
} from '../services/subtitles';

const NON_BROWSER_VIDEO_RE = /\.(mkv|avi|ts|flv|wmv)(\?|$)/i;
const HLS_URL_RE = /\.m3u8(\?|$)/i;

export const isDirectPlayableStream = (stream: Stream): boolean => {
  if (!stream.url || !/^https?:\/\//i.test(stream.url)) return false;
  if (stream.behaviorHints?.notWebReady) return false;
  return !NON_BROWSER_VIDEO_RE.test(stream.url);
};

export interface ParsedDirectStreamMeta {
  quality: string;
  size: string;
  isCached: boolean;
  isHls: boolean;
  source: string;
  filename: string;
}

export const parseDirectStreamMeta = (stream: Stream): ParsedDirectStreamMeta => {
  const fullText = `${stream.name || ''} ${stream.title || ''}`;
  const qualMatch = fullText.match(/(2160p|4k|uhd|1080p|720p|480p|hd)/i);
  const quality = qualMatch ? qualMatch[0].toUpperCase() : 'DIRECT';
  const sizeMatch = fullText.match(/(\d+(?:\.\d+)?\s?(?:GB|MB))/i);
  const size = sizeMatch ? sizeMatch[0] : '';
  const isCached = fullText.includes('+');
  const isHls = HLS_URL_RE.test(stream.url || '');
  const source = (stream.name || '').split('\n')[0]?.trim() || 'Direct Stream';
  const filename = (stream.title || '').split('\n')[0]?.trim() || stream.url || 'Stream';
  return { quality, size, isCached, isHls, source, filename };
};

const safeGet = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const safeSet = (key: string, val: string) => {
  try {
    localStorage.setItem(key, val);
  } catch {}
};

const formatClock = (secs: number): string => {
  const s = Math.max(0, Math.floor(secs));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
    : `${m}:${String(r).padStart(2, '0')}`;
};

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
type VideoFitMode = 'contain' | 'cover' | 'fill';
type SubtitleSize = 'sm' | 'md' | 'lg';

export interface DirectVideoPlayerProps {
  streams: Stream[];
  activeStreamIndex: number;
  onSelectStreamIndex: (index: number) => void;
  onStreamHealthy?: () => void;
  onStreamFailure?: (reason: 'error' | 'timeout') => void;
  onSwitchToEmbedFallback?: () => void;
  fallbackButtonLabel?: string;
  onProgressSave?: (currentTime: number, duration: number) => void;
  onLoaded?: () => void;
  onClose?: () => void;
  resumeTime?: number;
  title: string;
  subtitleLabel?: string;
  poster?: string;
  imdbId?: string;
  season?: number;
  episode?: number;
  isAnime?: boolean;
  hasNextEpisode?: boolean;
  autoplayNext?: boolean;
  onNextEpisode?: () => void;
  stageClassName?: string;
  retryNonce?: number;
  disableGlobalFullscreenKey?: boolean;
  fullscreenTriggerRef?: React.MutableRefObject<(() => void) | null>;
}

export const DirectVideoPlayer: React.FC<DirectVideoPlayerProps> = ({
  streams,
  activeStreamIndex,
  onSelectStreamIndex,
  onStreamHealthy,
  onStreamFailure,
  onSwitchToEmbedFallback,
  fallbackButtonLabel = 'Switch to Mirror Server',
  onProgressSave,
  onLoaded,
  onClose,
  resumeTime,
  title,
  subtitleLabel,
  poster,
  imdbId,
  season,
  episode,
  isAnime = false,
  hasNextEpisode = false,
  autoplayNext = true,
  onNextEpisode,
  stageClassName = 'aspect-video',
  retryNonce = 0,
  disableGlobalFullscreenKey = false,
  fullscreenTriggerRef,
}) => {
  const stageRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const seekBarRef = useRef<HTMLDivElement>(null);
  const controlsBarRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const isSeekingRef = useRef(false);
  const controlsTimerRef = useRef<number | undefined>(undefined);
  const hudTimerRef = useRef<number | undefined>(undefined);
  const seekFlashTimerRef = useRef<number | undefined>(undefined);
  const playingRef = useRef(false);
  const lastTimeUiUpdateRef = useRef(0);
  const lastProgressSaveRef = useRef(0);
  const hasAppliedResumeRef = useRef(false);

  const safeIndex = streams.length > 0 ? Math.min(Math.max(0, activeStreamIndex), streams.length - 1) : 0;
  const activeStream = streams[safeIndex];
  const streamMeta = useMemo(
    () => (activeStream ? parseDirectStreamMeta(activeStream) : null),
    [activeStream]
  );

  const [playing, setPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorDetail, setErrorDetail] = useState<string>('');
  const [localReloadKey, setLocalReloadKey] = useState(0);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedPct, setBufferedPct] = useState(0);
  const [hoverSeek, setHoverSeek] = useState<{ pct: number; time: number } | null>(null);

  const [volume, setVolume] = useState(() => {
    const v = parseFloat(safeGet('vidy:volume') || '1');
    return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1;
  });
  const [muted, setMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(() => {
    const v = parseFloat(safeGet('vidy:rate') || '1');
    return Number.isFinite(v) ? Math.min(2, Math.max(0.25, v)) : 1;
  });
  const [fitMode, setFitMode] = useState<VideoFitMode>(() => {
    const f = safeGet('vidy:fit');
    return f === 'cover' || f === 'fill' ? f : 'contain';
  });

  const [isPip, setIsPip] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [activeMenu, setActiveMenu] = useState<'none' | 'subs' | 'streams' | 'speed'>('none');

  const [hudText, setHudText] = useState<string | null>(null);
  const [seekFlash, setSeekFlash] = useState<{ side: 'left' | 'right'; delta: number; key: number } | null>(null);

  // HLS Quality levels
  const [hlsLevels, setHlsLevels] = useState<{ index: number; label: string; height: number }[]>([]);
  const [selectedHlsLevel, setSelectedHlsLevel] = useState<number>(-1);

  // Subtitles state
  const [subsOn, setSubsOn] = useState<boolean>(() => safeGet('vidy:subs-on') !== '0');
  const [subLang, setSubLang] = useState<string>(() => safeGet('vidy:sub-lang') || 'en');
  const [subSize, setSubSize] = useState<SubtitleSize>(() => {
    const s = safeGet('vidy:sub-size');
    return s === 'sm' || s === 'lg' ? s : 'md';
  });
  const subOffsetKey = `vidy:sub-off:${imdbId || title}:${season ? `${season}x${episode || 1}` : 'movie'}`;
  const [subOffset, setSubOffset] = useState<number>(() => {
    const v = parseFloat(safeGet(subOffsetKey) || '0');
    return Number.isFinite(v) ? v : 0;
  });
  const [customSubTrack, setCustomSubTrack] = useState<SubtitleTrack | null>(null);

  // Up Next countdown state
  const [upNextDismissed, setUpNextDismissed] = useState(false);
  const [endedCountdown, setEndedCountdown] = useState<number | null>(null);

  const showHud = useCallback((msg: string) => {
    window.clearTimeout(hudTimerRef.current);
    setHudText(msg);
    hudTimerRef.current = window.setTimeout(() => setHudText(null), 1600);
  }, []);

  const flashSeekIndicator = useCallback((delta: number) => {
    window.clearTimeout(seekFlashTimerRef.current);
    setSeekFlash({ side: delta < 0 ? 'left' : 'right', delta, key: Date.now() });
    seekFlashTimerRef.current = window.setTimeout(() => setSeekFlash(null), 650);
  }, []);

  const pokeControls = useCallback(() => {
    setControlsVisible(true);
    window.clearTimeout(controlsTimerRef.current);
    if (playingRef.current && activeMenu === 'none') {
      controlsTimerRef.current = window.setTimeout(() => setControlsVisible(false), 2800);
    }
  }, [activeMenu]);

  useEffect(() => {
    if (activeMenu !== 'none') {
      window.clearTimeout(controlsTimerRef.current);
      setControlsVisible(true);
      const onPointerDown = (e: PointerEvent) => {
        if (controlsBarRef.current && !controlsBarRef.current.contains(e.target as Node)) {
          setActiveMenu('none');
        }
      };
      document.addEventListener('pointerdown', onPointerDown);
      return () => document.removeEventListener('pointerdown', onPointerDown);
    } else if (playingRef.current) {
      pokeControls();
    }
  }, [activeMenu, pokeControls]);

  useEffect(() => {
    return () => {
      window.clearTimeout(controlsTimerRef.current);
      window.clearTimeout(hudTimerRef.current);
      window.clearTimeout(seekFlashTimerRef.current);
    };
  }, []);

  // Reload offset if episode changes
  useEffect(() => {
    const v = parseFloat(safeGet(subOffsetKey) || '0');
    setSubOffset(Number.isFinite(v) ? v : 0);
    setUpNextDismissed(false);
    setEndedCountdown(null);
  }, [subOffsetKey]);

  // Subtitles query
  const subsQuery = useQuery<SubtitleTrack | null>({
    queryKey: ['direct-subs', imdbId, season || 0, episode || 0, subLang],
    queryFn: () =>
      fetchSubtitles({
        imdbId,
        season,
        episode,
        lang: subLang,
        title,
      }),
    enabled: Boolean(imdbId) && !isAnime && subsOn && !customSubTrack,
    staleTime: 1000 * 60 * 30,
    retry: 0,
  });

  const activeSubTrack = customSubTrack || subsQuery.data || null;
  const activeCue = useMemo(() => {
    if (!subsOn || !activeSubTrack?.cues?.length) return null;
    const idx = cueIndexAt(activeSubTrack.cues, currentTime + subOffset);
    return idx >= 0 ? activeSubTrack.cues[idx] : null;
  }, [subsOn, activeSubTrack, currentTime, subOffset]);

  // Initialize media source (HLS via hls.js or native HTML5 MP4/WebM)
  useEffect(() => {
    const video = videoRef.current;
    const url = activeStream?.url;
    if (!video || !url) return;

    hasAppliedResumeRef.current = false;
    setHasError(false);
    setErrorDetail('');
    setIsBuffering(true);
    setCurrentTime(0);
    setDuration(0);
    setBufferedPct(0);
    setHlsLevels([]);
    setSelectedHlsLevel(-1);
    setEndedCountdown(null);
    setUpNextDismissed(false);

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const isHls = HLS_URL_RE.test(url);
    let recoveredOnce = false;

    if (isHls && Hls.isSupported()) {
      video.removeAttribute('src');
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        maxBufferLength: 60,
      });
      hlsRef.current = hls;
      hls.loadSource(url);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (_evt, data) => {
        const levels = (data.levels || [])
          .map((lvl, index) => ({
            index,
            height: lvl.height || 0,
            label: lvl.height ? `${lvl.height}p` : `Track ${index + 1}`,
          }))
          .sort((a, b) => b.height - a.height);
        setHlsLevels(levels);
        video.volume = volume;
        video.muted = muted;
        video.playbackRate = playbackRate;
        void video.play().catch(() => {});
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, () => {
        if (hls.autoLevelEnabled) setSelectedHlsLevel(-1);
      });

      hls.on(Hls.Events.ERROR, (_evt, data) => {
        if (!data.fatal) return;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR && !recoveredOnce) {
          recoveredOnce = true;
          hls.startLoad();
          return;
        }
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR && !recoveredOnce) {
          recoveredOnce = true;
          hls.recoverMediaError();
          return;
        }
        setHasError(true);
        setIsBuffering(false);
        setErrorDetail('HLS stream failed to load or was blocked by CORS.');
        onStreamFailure?.('error');
      });

      return () => {
        hls.destroy();
        if (hlsRef.current === hls) hlsRef.current = null;
      };
    }

    // Native playback (MP4, WebM, Safari HLS, Debrid CDN)
    video.src = url;
    video.load();
    video.volume = volume;
    video.muted = muted;
    video.playbackRate = playbackRate;
    void video.play().catch(() => {});

    return () => {
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStream?.url, safeIndex, retryNonce, localReloadKey]);

  // Fullscreen + PiP sync listeners
  useEffect(() => {
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    const onPip = () => setIsPip(Boolean(document.pictureInPictureElement));
    document.addEventListener('fullscreenchange', onFs);
    document.addEventListener('enterpictureinpicture', onPip);
    document.addEventListener('leavepictureinpicture', onPip);
    return () => {
      document.removeEventListener('fullscreenchange', onFs);
      document.removeEventListener('enterpictureinpicture', onPip);
      document.removeEventListener('leavepictureinpicture', onPip);
    };
  }, []);

  // Up Next auto-advance countdown once ended
  useEffect(() => {
    if (endedCountdown === null) return;
    if (endedCountdown <= 0) {
      setEndedCountdown(null);
      onNextEpisode?.();
      return;
    }
    const t = window.setTimeout(() => setEndedCountdown((c) => (c !== null ? c - 1 : null)), 1000);
    return () => window.clearTimeout(t);
  }, [endedCountdown, onNextEpisode]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      void v.play().catch(() => {});
    } else {
      v.pause();
    }
    pokeControls();
  }, [pokeControls]);

  const seekTo = useCallback(
    (target: number) => {
      const v = videoRef.current;
      if (!v) return;
      const dur = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : duration;
      const next = dur > 0 ? Math.min(Math.max(0, target), dur) : Math.max(0, target);
      try {
        v.currentTime = next;
      } catch {}
      setCurrentTime(next);
      pokeControls();
    },
    [duration, pokeControls]
  );

  const seekBy = useCallback(
    (delta: number, showFlash = true) => {
      const v = videoRef.current;
      if (!v) return;
      const base = Number.isFinite(v.currentTime) ? v.currentTime : currentTime;
      seekTo(base + delta);
      if (showFlash) flashSeekIndicator(delta);
    },
    [currentTime, seekTo, flashSeekIndicator]
  );

  const applyVolume = useCallback(
    (val: number, forceMuted = false) => {
      const clamped = Math.min(1, Math.max(0, val));
      const v = videoRef.current;
      if (v) {
        v.volume = clamped;
        v.muted = forceMuted || clamped === 0;
      }
      setVolume(clamped);
      setMuted(forceMuted || clamped === 0);
      safeSet('vidy:volume', String(clamped));
      showHud(forceMuted || clamped === 0 ? 'Muted' : `Volume ${Math.round(clamped * 100)}%`);
      pokeControls();
    },
    [pokeControls, showHud]
  );

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    const nextMuted = !v.muted;
    v.muted = nextMuted;
    setMuted(nextMuted);
    showHud(nextMuted ? 'Muted' : `Volume ${Math.round((v.volume || volume) * 100)}%`);
    pokeControls();
  }, [pokeControls, showHud, volume]);

  const applyPlaybackRate = useCallback(
    (next: number) => {
      const v = videoRef.current;
      if (v) v.playbackRate = next;
      setPlaybackRate(next);
      safeSet('vidy:rate', String(next));
      showHud(`Speed ${next}x`);
      pokeControls();
    },
    [pokeControls, showHud]
  );

  const stepPlaybackRate = useCallback(
    (dir: number) => {
      const idx = PLAYBACK_RATES.findIndex((r) => Math.abs(r - playbackRate) < 0.01);
      const base = idx < 0 ? PLAYBACK_RATES.indexOf(1) : idx;
      const next = PLAYBACK_RATES[(base + dir + PLAYBACK_RATES.length) % PLAYBACK_RATES.length];
      applyPlaybackRate(next);
    },
    [playbackRate, applyPlaybackRate]
  );

  const cycleFitMode = useCallback(() => {
    const order: VideoFitMode[] = ['contain', 'cover', 'fill'];
    const next = order[(order.indexOf(fitMode) + 1) % order.length];
    setFitMode(next);
    safeSet('vidy:fit', next);
    const label = next === 'contain' ? 'Fit: Original' : next === 'cover' ? 'Fit: Zoom Crop' : 'Fit: Stretch Fill';
    showHud(label);
    pokeControls();
  }, [fitMode, pokeControls, showHud]);

  const togglePip = useCallback(async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await v.requestPictureInPicture();
      }
    } catch {}
    pokeControls();
  }, [pokeControls]);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (stageRef.current?.requestFullscreen) {
        await stageRef.current.requestFullscreen();
      } else {
        const v = videoRef.current as any;
        v?.webkitEnterFullscreen?.();
      }
    } catch {}
    pokeControls();
  }, [pokeControls]);

  useEffect(() => {
    if (!fullscreenTriggerRef) return;
    fullscreenTriggerRef.current = () => {
      void toggleFullscreen();
    };
    return () => {
      fullscreenTriggerRef.current = null;
    };
  }, [fullscreenTriggerRef, toggleFullscreen]);

  // Keyboard shortcuts scoped smoothly
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName || '';
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;

      if (e.key === ' ' || e.key.toLowerCase() === 'k') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        seekBy(e.shiftKey ? -30 : -5);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        seekBy(e.shiftKey ? 30 : 5);
      } else if (e.key.toLowerCase() === 'j') {
        e.preventDefault();
        seekBy(-10);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        applyVolume((muted ? 0 : volume) + 0.05);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        applyVolume((muted ? 0 : volume) - 0.05);
      } else if (e.key.toLowerCase() === 'm') {
        e.preventDefault();
        toggleMute();
      } else if (e.key === ',' || e.key === '<') {
        e.preventDefault();
        stepPlaybackRate(-1);
      } else if (e.key === '.' || e.key === '>') {
        e.preventDefault();
        stepPlaybackRate(1);
      } else if (e.key.toLowerCase() === 'i') {
        e.preventDefault();
        void togglePip();
      } else if (e.key.toLowerCase() === 'c') {
        e.preventDefault();
        setSubsOn((prev) => {
          const next = !prev;
          safeSet('vidy:subs-on', next ? '1' : '0');
          showHud(next ? 'Subtitles ON' : 'Subtitles OFF');
          return next;
        });
      } else if (e.key.toLowerCase() === 'z') {
        e.preventDefault();
        cycleFitMode();
      } else if (e.key.toLowerCase() === 'f' && !disableGlobalFullscreenKey) {
        e.preventDefault();
        void toggleFullscreen();
      } else if (e.key === 'Escape' && activeMenu !== 'none') {
        e.preventDefault();
        setActiveMenu('none');
      } else if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        const dur = videoRef.current?.duration || duration;
        if (dur > 0) seekTo((parseInt(e.key, 10) / 10) * dur);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    togglePlay,
    seekBy,
    applyVolume,
    muted,
    volume,
    toggleMute,
    stepPlaybackRate,
    togglePip,
    cycleFitMode,
    toggleFullscreen,
    disableGlobalFullscreenKey,
    activeMenu,
    duration,
    seekTo,
    showHud,
  ]);

  // Scrubber helpers
  const seekFractionFromClientX = (clientX: number): number => {
    const bar = seekBarRef.current;
    if (!bar) return 0;
    const rect = bar.getBoundingClientRect();
    if (rect.width <= 0) return 0;
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  };

  const seekFromPointer = (clientX: number) => {
    const v = videoRef.current;
    const dur = v && Number.isFinite(v.duration) && v.duration > 0 ? v.duration : duration;
    if (dur <= 0) return;
    seekTo(seekFractionFromClientX(clientX) * dur);
  };

  const handleSeekHover = (e: React.MouseEvent<HTMLDivElement>) => {
    const v = videoRef.current;
    const dur = v && Number.isFinite(v.duration) && v.duration > 0 ? v.duration : duration;
    if (dur <= 0) {
      setHoverSeek(null);
      return;
    }
    const pct = seekFractionFromClientX(e.clientX);
    setHoverSeek({ pct: pct * 100, time: pct * dur });
  };

  const handleCustomSubUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseSubtitleText(String(reader.result || ''), file.name);
      if (parsed) {
        setCustomSubTrack(parsed);
        setSubsOn(true);
        safeSet('vidy:subs-on', '1');
        showHud(`Loaded ${parsed.cues.length} subtitle cues`);
      } else {
        showHud('Could not parse SRT/VTT file');
      }
    };
    reader.readAsText(file);
  };

  const handleSelectHlsLevel = (levelIdx: number) => {
    if (!hlsRef.current) return;
    hlsRef.current.currentLevel = levelIdx;
    setSelectedHlsLevel(levelIdx);
    const label = levelIdx === -1 ? 'Auto' : hlsLevels.find((l) => l.index === levelIdx)?.label || 'Custom';
    showHud(`Quality: ${label}`);
  };

  const handleRetryCurrent = () => {
    setHasError(false);
    setErrorDetail('');
    setIsBuffering(true);
    setLocalReloadKey((k) => k + 1);
  };

  const progressPct = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;
  const remainingSec = duration > 0 ? duration - currentTime : Infinity;
  const showUpNextCard =
    hasNextEpisode &&
    !upNextDismissed &&
    !hasError &&
    ((duration > 60 && remainingSec <= 20 && remainingSec > 0) || endedCountdown !== null);

  const objectFitClass =
    fitMode === 'cover' ? 'object-cover' : fitMode === 'fill' ? 'object-fill' : 'object-contain';

  const subSizeClass =
    subSize === 'sm'
      ? 'text-xs sm:text-sm'
      : subSize === 'lg'
        ? 'text-base sm:text-2xl'
        : 'text-sm sm:text-lg';

  const hlsBadgeLabel =
    selectedHlsLevel >= 0
      ? hlsLevels.find((l) => l.index === selectedHlsLevel)?.label
      : undefined;

  return (
    <div
      ref={stageRef}
      className={`relative w-full ${isFullscreen ? 'h-screen w-screen rounded-none' : `${stageClassName} rounded-2xl`} bg-black overflow-hidden select-none group/direct ${
        playing && !controlsVisible && activeMenu === 'none' ? 'cursor-none' : ''
      }`}
      onMouseMove={pokeControls}
      onTouchStart={pokeControls}
      onMouseLeave={() => {
        if (playingRef.current && activeMenu === 'none') {
          setControlsVisible(false);
        }
      }}
    >
      <video
        ref={videoRef}
        poster={poster}
        playsInline
        preload="auto"
        className={`absolute inset-0 w-full h-full bg-black ${objectFitClass} cursor-pointer`}
        onLoadedData={(e) => {
          const v = e.currentTarget;
          v.volume = volume;
          v.muted = muted;
          v.playbackRate = playbackRate;
          if (Number.isFinite(v.duration) && v.duration > 0) setDuration(v.duration);
          if (!hasAppliedResumeRef.current && resumeTime && resumeTime > 5) {
            hasAppliedResumeRef.current = true;
            try {
              v.currentTime = resumeTime;
              showHud(`Resumed at ${formatClock(resumeTime)}`);
            } catch {}
          }
          playingRef.current = !v.paused;
          setPlaying(!v.paused);
          setIsBuffering(false);
          setHasError(false);
          onStreamHealthy?.();
          onLoaded?.();
          pokeControls();
        }}
        onLoadedMetadata={(e) => {
          const v = e.currentTarget;
          if (Number.isFinite(v.duration) && v.duration > 0) setDuration(v.duration);
        }}
        onCanPlay={() => setIsBuffering(false)}
        onWaiting={() => setIsBuffering(true)}
        onSeeking={() => setIsBuffering(true)}
        onSeeked={() => setIsBuffering(false)}
        onPlaying={() => {
          playingRef.current = true;
          setPlaying(true);
          setIsBuffering(false);
          setHasError(false);
          onStreamHealthy?.();
          pokeControls();
        }}
        onPlay={() => {
          playingRef.current = true;
          setPlaying(true);
          pokeControls();
        }}
        onPause={() => {
          playingRef.current = false;
          setPlaying(false);
          setControlsVisible(true);
          window.clearTimeout(controlsTimerRef.current);
        }}
        onVolumeChange={(e) => {
          const v = e.currentTarget;
          setVolume(v.volume);
          setMuted(v.muted);
        }}
        onProgress={(e) => {
          const v = e.currentTarget;
          try {
            if (v.buffered.length > 0 && v.duration > 0) {
              setBufferedPct(Math.min(100, (v.buffered.end(v.buffered.length - 1) / v.duration) * 100));
            }
          } catch {}
        }}
        onTimeUpdate={(e) => {
          const v = e.currentTarget;
          const now = Date.now();
          if (now - lastTimeUiUpdateRef.current > 200) {
            lastTimeUiUpdateRef.current = now;
            setCurrentTime(v.currentTime);
          }
          if (Number.isFinite(v.duration) && v.duration > 0 && v.duration !== duration) {
            setDuration(v.duration);
          }
          if (v.duration > 0 && onProgressSave && now - lastProgressSaveRef.current > 5000) {
            lastProgressSaveRef.current = now;
            onProgressSave(v.currentTime, v.duration);
          }
        }}
        onEnded={() => {
          playingRef.current = false;
          setPlaying(false);
          setControlsVisible(true);
          if (hasNextEpisode && autoplayNext && !upNextDismissed) {
            setEndedCountdown(6);
          }
        }}
        onError={() => {
          // Ignore spurious errors when stream isn't wired yet
          if (!activeStream?.url) return;
          setHasError(true);
          setIsBuffering(false);
          setErrorDetail('Stream codec unsupported or source link expired.');
          onStreamFailure?.('error');
        }}
        onClick={(e) => {
          if (activeMenu !== 'none') {
            setActiveMenu('none');
            return;
          }
          if (e.detail === 1) togglePlay();
        }}
        onDoubleClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          if (rect.width <= 0) return;
          const rel = (e.clientX - rect.left) / rect.width;
          seekBy(rel < 0.5 ? -10 : 10, true);
        }}
      />

      {/* Top Gradient Chrome (Title, Active Stream Meta, New Tab, Close) */}
      <div
        className={`absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-4 bg-gradient-to-b from-black/80 via-black/35 to-transparent px-4 sm:px-5 pt-3.5 pb-10 transition-opacity duration-200 ${
          controlsVisible || !playing || activeMenu !== 'none'
            ? 'opacity-100'
            : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="text-sm sm:text-base font-bold text-white truncate drop-shadow">{title}</h3>
            {subtitleLabel && (
              <span className="text-xs text-white/70 font-medium whitespace-nowrap shrink-0">
                · {subtitleLabel}
              </span>
            )}
          </div>
          {streamMeta && (
            <p className="text-[11px] text-white/65 truncate mt-0.5 font-mono">
              {hlsBadgeLabel || streamMeta.quality}
              {streamMeta.size ? ` · ${streamMeta.size}` : ''}
              {streamMeta.isCached ? ' · Cached' : ''}
              {streams.length > 1 ? ` · Stream ${safeIndex + 1} of ${streams.length}` : ''}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {activeStream?.url && (
            <a
              href={activeStream.url}
              target="_blank"
              rel="noreferrer"
              className="p-2 rounded-lg bg-black/50 hover:bg-black/75 text-white/80 hover:text-white transition-colors"
              aria-label="Open stream URL in new tab"
              title="Open in new tab"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg bg-black/50 hover:bg-red-600/90 text-white transition-colors cursor-pointer"
              aria-label="Close direct player"
              title="Close player"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Double-Click Seek Feedback Flash (-10s / +10s) */}
      {seekFlash && (
        <div
          key={seekFlash.key}
          className={`pointer-events-none absolute top-1/2 -translate-y-1/2 z-30 flex flex-col items-center gap-1 px-5 py-3.5 rounded-2xl bg-black/70 backdrop-blur-md text-white shadow-2xl animate-fade-in ${
            seekFlash.side === 'left' ? 'left-8 sm:left-16' : 'right-8 sm:right-16'
          }`}
        >
          {seekFlash.delta < 0 ? <Rewind className="w-6 h-6" /> : <FastForward className="w-6 h-6" />}
          <span className="text-xs font-mono font-bold tabular-nums">
            {seekFlash.delta > 0 ? `+${seekFlash.delta}s` : `${seekFlash.delta}s`}
          </span>
        </div>
      )}

      {/* Action HUD Feedback Pill (Volume / Speed / Fit / Subtitles) */}
      {hudText && (
        <div className="pointer-events-none absolute top-16 left-1/2 -translate-x-1/2 z-40 px-3.5 py-1.5 rounded-lg bg-black/80 border border-white/15 text-xs font-semibold text-white backdrop-blur-md shadow-xl">
          {hudText}
        </div>
      )}

      {/* Center Buffering Spinner */}
      {isBuffering && !hasError && (
        <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-black/30">
          <Loader2 className="w-10 h-10 text-[rgb(var(--primary-color))] animate-spin" />
          <span className="text-xs font-medium text-white/75">Buffering stream…</span>
        </div>
      )}

      {/* Center Play Overlay when paused */}
      {!playing && !isBuffering && !hasError && (
        <button
          type="button"
          onClick={togglePlay}
          className="absolute inset-0 z-20 flex items-center justify-center bg-black/20 cursor-pointer focus-visible:outline-none"
          aria-label="Play video"
        >
          <span className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-black/65 hover:bg-black/80 border border-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-2xl transition-transform hover:scale-105">
            <Play className="w-8 h-8 sm:w-9 sm:h-9 fill-current ml-1" />
          </span>
        </button>
      )}

      {/* Stream Error Recovery Overlay */}
      {hasError && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/92 backdrop-blur-sm p-6 text-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400">
            <AlertCircle className="w-7 h-7" />
          </div>
          <div className="space-y-1 max-w-md">
            <h4 className="text-base font-bold text-white">Direct stream failed to play</h4>
            <p className="text-xs text-white/65">
              {errorDetail || 'Your browser cannot decode this container/audio codec directly, or the source link expired.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={handleRetryCurrent}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
            {streams.length > 1 && (
              <button
                type="button"
                onClick={() => onSelectStreamIndex((safeIndex + 1) % streams.length)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[rgb(var(--primary-color))] hover:brightness-110 text-white text-xs font-bold transition-all cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Next Stream ({((safeIndex + 1) % streams.length) + 1}/{streams.length})</span>
              </button>
            )}
            {onSwitchToEmbedFallback && (
              <button
                type="button"
                onClick={onSwitchToEmbedFallback}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/30 text-xs font-semibold transition-colors cursor-pointer"
              >
                <span>{fallbackButtonLabel}</span>
              </button>
            )}
            {activeStream?.url && (
              <a
                href={activeStream.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 border border-white/10 text-xs font-semibold transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open Externally</span>
              </a>
            )}
          </div>
        </div>
      )}

      {/* Up Next Episode Countdown Card */}
      {showUpNextCard && onNextEpisode && (
        <div className="absolute right-4 bottom-20 sm:bottom-24 z-[35] w-72 rounded-xl bg-[#141418]/95 border border-white/15 backdrop-blur-xl p-3.5 shadow-2xl">
          <p className="text-[11px] font-semibold text-white/60">
            {endedCountdown !== null ? `Up next in ${endedCountdown}s` : 'Finishing episode'}
          </p>
          <p className="text-sm font-bold text-white truncate mt-0.5">
            {season ? `Season ${season} · Episode ${(episode || 1) + 1}` : 'Next Episode'}
          </p>
          <div className="flex items-center gap-2 mt-3">
            <button
              type="button"
              onClick={() => {
                setEndedCountdown(null);
                onNextEpisode();
              }}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[rgb(var(--primary-color))] hover:brightness-110 text-white text-xs font-bold transition-all cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Play Next</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setEndedCountdown(null);
                setUpNextDismissed(true);
              }}
              className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white/80 text-xs font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Synced Subtitles Overlay (Rendered inside fullscreen-capable stage) */}
      {activeCue && !hasError && (
        <div
          className={`pointer-events-none absolute inset-x-0 z-[25] flex justify-center px-6 sm:px-16 transition-all duration-200 ${
            controlsVisible || !playing ? 'bottom-20 sm:bottom-24' : 'bottom-6 sm:bottom-10'
          }`}
        >
          <p
            className={`max-w-3xl text-center text-white font-semibold leading-snug whitespace-pre-line px-3 py-1 rounded-lg bg-black/55 backdrop-blur-[2px] ${subSizeClass}`}
            style={{ textShadow: '0 1px 2px rgba(0,0,0,0.95)' }}
          >
            {activeCue.text}
          </p>
        </div>
      )}

      {/* Hidden local subtitle file picker */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".srt,.vtt,text/vtt,application/x-subrip"
        onChange={handleCustomSubUpload}
        className="hidden"
      />

      {/* Bottom Controls Bar */}
      <div
        ref={controlsBarRef}
        className={`absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/90 via-black/55 to-transparent px-3 sm:px-4 pb-2.5 pt-12 transition-opacity duration-200 ${
          controlsVisible || !playing || activeMenu !== 'none'
            ? 'opacity-100'
            : 'opacity-0 pointer-events-none'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Scrubbable Progress Timeline */}
        <div
          ref={seekBarRef}
          className="group/seek relative py-2 -my-1 w-full cursor-pointer touch-none"
          onPointerDown={(e) => {
            e.preventDefault();
            isSeekingRef.current = true;
            try {
              seekBarRef.current?.setPointerCapture?.(e.pointerId);
            } catch {}
            seekFromPointer(e.clientX);
          }}
          onPointerMove={(e) => {
            handleSeekHover(e);
            if (isSeekingRef.current) seekFromPointer(e.clientX);
          }}
          onPointerUp={() => {
            isSeekingRef.current = false;
          }}
          onPointerCancel={() => {
            isSeekingRef.current = false;
          }}
          onMouseMove={handleSeekHover}
          onMouseLeave={() => setHoverSeek(null)}
          role="slider"
          aria-label="Seek timeline"
          aria-valuemin={0}
          aria-valuemax={Math.floor(duration || 0)}
          aria-valuenow={Math.floor(currentTime)}
        >
          {hoverSeek && (
            <div
              className="absolute -top-7 z-50 -translate-x-1/2 px-2 py-0.5 rounded-md bg-black/90 border border-white/20 text-[11px] font-mono text-white tabular-nums pointer-events-none shadow-lg"
              style={{ left: `${Math.min(96, Math.max(4, hoverSeek.pct))}%` }}
            >
              {formatClock(hoverSeek.time)}
            </div>
          )}
          <div className="relative h-1.5 group-hover/seek:h-2 transition-all rounded-full bg-white/20 overflow-hidden">
            <div className="h-full bg-white/30" style={{ width: `${Math.min(100, bufferedPct)}%` }} />
            <div
              className="absolute inset-y-0 left-0 h-full bg-[rgb(var(--primary-color))]"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white shadow opacity-0 group-hover/seek:opacity-100 transition-opacity pointer-events-none"
            style={{ left: `calc(${progressPct}% - 7px)` }}
          />
        </div>

        {/* Control Buttons Row */}
        <div className="flex items-center gap-1 sm:gap-1.5 mt-1.5">
          <button
            type="button"
            onClick={togglePlay}
            className="p-2 rounded-lg text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label={playing ? 'Pause' : 'Play'}
            title={playing ? 'Pause (Space)' : 'Play (Space)'}
          >
            {playing ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
          </button>

          <button
            type="button"
            onClick={() => seekBy(-10)}
            className="p-2 rounded-lg text-white/85 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Rewind 10 seconds"
            title="Back 10s (J / Double-click left)"
          >
            <Rewind className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          <button
            type="button"
            onClick={() => seekBy(10)}
            className="p-2 rounded-lg text-white/85 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Forward 10 seconds"
            title="Forward 10s (Double-click right)"
          >
            <FastForward className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          <button
            type="button"
            onClick={toggleMute}
            className="p-2 rounded-lg text-white/85 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label={muted ? 'Unmute' : 'Mute'}
            title={muted ? 'Unmute (M)' : 'Mute (M)'}
          >
            {muted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>

          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={muted ? 0 : volume}
            onChange={(e) => applyVolume(parseFloat(e.target.value), false)}
            className="w-14 sm:w-20 h-1 accent-[rgb(var(--primary-color))] cursor-pointer hidden md:block"
            aria-label="Volume"
          />

          <span className="text-[11px] sm:text-xs font-mono text-white/85 tabular-nums px-1.5 whitespace-nowrap">
            {formatClock(currentTime)} <span className="text-white/40">/</span> {duration > 0 ? formatClock(duration) : '--:--'}
          </span>

          <div className="flex-1" />

          {/* Subtitles Popover */}
          <div className="relative">
              <button
                type="button"
                onClick={() => setActiveMenu((m) => (m === 'subs' ? 'none' : 'subs'))}
                className={`relative p-2 rounded-lg transition-colors cursor-pointer ${
                  activeMenu === 'subs' || subsOn
                    ? 'text-[rgb(var(--primary-color))] bg-white/10'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
                aria-label="Subtitles settings"
                title="Subtitles (C)"
              >
                <Subtitles className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              {activeMenu === 'subs' && (
                  <div className="absolute bottom-full right-0 mb-2 z-50 w-64 rounded-2xl bg-[#141418]/95 backdrop-blur-xl border border-white/15 shadow-2xl p-3.5 text-xs select-none space-y-2.5">
                    <div className="flex items-center justify-between pb-2 border-b border-white/10">
                      <span className="font-bold text-white flex items-center gap-1.5">
                        <Subtitles className="w-3.5 h-3.5" /> Subtitles
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setSubsOn((v) => {
                            safeSet('vidy:subs-on', v ? '0' : '1');
                            return !v;
                          })
                        }
                        className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                          subsOn ? 'bg-[rgb(var(--primary-color))] text-white' : 'bg-white/10 text-white/60 hover:text-white'
                        }`}
                      >
                        {subsOn ? 'ON' : 'OFF'}
                      </button>
                    </div>

                    {subsOn && (
                      <>
                        {imdbId && !isAnime && (
                          <div className="flex items-center justify-between">
                            <span className="text-white/65">Language</span>
                            <select
                              value={subLang}
                              onChange={(e) => {
                                setCustomSubTrack(null);
                                setSubLang(e.target.value);
                                safeSet('vidy:sub-lang', e.target.value);
                              }}
                              className="bg-black/60 border border-white/15 rounded-lg px-2 py-1 text-[11px] font-semibold text-white outline-none cursor-pointer"
                              aria-label="Subtitle language"
                            >
                              {SUBTITLE_LANGUAGES.map((l) => (
                                <option key={l.code} value={l.code}>
                                  {l.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        <div className="flex items-center justify-between">
                          <span className="text-white/65">Text size</span>
                          <div className="flex items-center gap-1 bg-black/50 p-0.5 rounded-lg border border-white/10">
                            {(['sm', 'md', 'lg'] as SubtitleSize[]).map((sz) => (
                              <button
                                key={sz}
                                type="button"
                                onClick={() => {
                                  setSubSize(sz);
                                  safeSet('vidy:sub-size', sz);
                                }}
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase cursor-pointer ${
                                  subSize === sz ? 'bg-[rgb(var(--primary-color))] text-white' : 'text-white/60 hover:text-white'
                                }`}
                              >
                                {sz}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-white/65">Sync offset</span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                setSubOffset((v) => {
                                  const n = Math.max(-60, Math.round((v - 0.5) * 2) / 2);
                                  safeSet(subOffsetKey, String(n));
                                  return n;
                                })
                              }
                              className="w-6 h-6 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold cursor-pointer"
                            >
                              −
                            </button>
                            <span className="w-12 text-center font-mono text-[11px] text-white/85 tabular-nums">
                              {subOffset > 0 ? `+${subOffset}` : subOffset}s
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setSubOffset((v) => {
                                  const n = Math.min(60, Math.round((v + 0.5) * 2) / 2);
                                  safeSet(subOffsetKey, String(n));
                                  return n;
                                })
                              }
                              className="w-6 h-6 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold cursor-pointer"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        {subOffset !== 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setSubOffset(0);
                              safeSet(subOffsetKey, '0');
                            }}
                            className="w-full py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/65 hover:text-white text-[10px] font-semibold transition-colors cursor-pointer"
                          >
                            Reset sync offset
                          </button>
                        )}
                      </>
                    )}

                    <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-[11px] font-semibold transition-colors cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Load .SRT / .VTT</span>
                      </button>
                      {customSubTrack && (
                        <button
                          type="button"
                          onClick={() => setCustomSubTrack(null)}
                          className="text-[10px] text-white/50 hover:text-white underline cursor-pointer"
                        >
                          Clear file
                        </button>
                      )}
                    </div>

                    <p className="text-[10px] text-white/45 truncate">
                      {subsQuery.isLoading && !customSubTrack
                        ? 'Searching subtitles…'
                        : activeSubTrack
                          ? `${activeSubTrack.cues.length} cues · ${activeSubTrack.name || subLang}`
                          : 'No remote subtitle track found'}
                    </p>
                  </div>
              )}
            </div>

          {/* Streams & HLS Quality Switcher Popover */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setActiveMenu((m) => (m === 'streams' ? 'none' : 'streams'))}
              disabled={streams.length < 2 && hlsLevels.length < 2}
              className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer max-w-[9rem] sm:max-w-[12rem] disabled:opacity-50 disabled:pointer-events-none ${
                activeMenu === 'streams' ? 'bg-white/15 text-white' : 'text-white/85 hover:text-white hover:bg-white/10'
              }`}
              title="Switch direct stream or quality"
            >
              <SlidersHorizontal className="w-4 h-4 shrink-0" />
              <span className="truncate">{hlsBadgeLabel || streamMeta?.quality || 'DIRECT'}</span>
            </button>

            {activeMenu === 'streams' && (
                <div className="absolute bottom-full right-0 mb-2 z-50 w-72 sm:w-80 rounded-2xl bg-[#141418]/95 backdrop-blur-xl border border-white/15 shadow-2xl p-3 text-xs select-none">
                  {hlsLevels.length > 1 && (
                    <div className="pb-2.5 mb-2.5 border-b border-white/10">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-white/80 mb-2">
                        <Layers className="w-3.5 h-3.5" />
                        <span>HLS Adaptive Quality</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          onClick={() => handleSelectHlsLevel(-1)}
                          className={`px-2 py-1 rounded-lg text-[11px] font-semibold cursor-pointer ${
                            selectedHlsLevel === -1
                              ? 'bg-[rgb(var(--primary-color))] text-white'
                              : 'bg-white/10 text-white/70 hover:text-white'
                          }`}
                        >
                          Auto
                        </button>
                        {hlsLevels.map((lvl) => (
                          <button
                            key={lvl.index}
                            type="button"
                            onClick={() => handleSelectHlsLevel(lvl.index)}
                            className={`px-2 py-1 rounded-lg text-[11px] font-semibold cursor-pointer ${
                              selectedHlsLevel === lvl.index
                                ? 'bg-[rgb(var(--primary-color))] text-white'
                                : 'bg-white/10 text-white/70 hover:text-white'
                            }`}
                          >
                            {lvl.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between pb-2 mb-1.5 border-b border-white/10">
                    <span className="font-bold text-white">Direct Sources ({streams.length})</span>
                    <span className="text-[10px] font-mono text-white/50">Active #{safeIndex + 1}</span>
                  </div>

                  <div className="max-h-60 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                    {streams.map((s, idx) => {
                      const meta = parseDirectStreamMeta(s);
                      const isActive = idx === safeIndex;
                      return (
                        <button
                          key={`${s.url}_${idx}`}
                          type="button"
                          onClick={() => {
                            onSelectStreamIndex(idx);
                            setActiveMenu('none');
                            showHud(`Stream ${idx + 1}: ${meta.quality}`);
                          }}
                          className={`w-full text-left px-2.5 py-2 rounded-xl flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                            isActive
                              ? 'bg-[rgb(var(--primary-color))]/25 text-white border border-[rgb(var(--primary-color))]/50'
                              : 'bg-white/5 hover:bg-white/10 text-white/80 border border-transparent'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 font-semibold text-xs text-white">
                              <span>{meta.quality}</span>
                              {meta.size && <span className="text-white/55 font-normal">· {meta.size}</span>}
                              {meta.isCached && <span className="text-sky-400">· Cached</span>}
                              {meta.isHls && <span className="text-emerald-400">· HLS</span>}
                            </div>
                            <p className="text-[10px] text-white/50 truncate mt-0.5 font-mono">
                              {meta.source} · {meta.filename}
                            </p>
                          </div>
                          {isActive && <Check className="w-4 h-4 text-[rgb(var(--primary-color))] shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
            )}
          </div>

          {/* Aspect Fit Mode Toggle */}
          <button
            type="button"
            onClick={cycleFitMode}
            className={`hidden sm:inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
              fitMode !== 'contain' ? 'text-[rgb(var(--primary-color))] bg-white/10' : 'text-white/80 hover:text-white hover:bg-white/10'
            }`}
            aria-label="Aspect fit mode"
            title={`Video fit: ${fitMode} (Z)`}
          >
            <RectangleHorizontal className="w-4 h-4" />
            <span className="uppercase">{fitMode === 'contain' ? 'Fit' : fitMode === 'cover' ? 'Zoom' : 'Fill'}</span>
          </button>

          {/* Playback Speed Popover */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setActiveMenu((m) => (m === 'speed' ? 'none' : 'speed'))}
              className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                playbackRate !== 1 || activeMenu === 'speed'
                  ? 'text-[rgb(var(--primary-color))] bg-white/10'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
              aria-label="Playback speed"
              title="Playback speed (, / .)"
            >
              <Gauge className="w-4 h-4" />
              <span className="tabular-nums">{playbackRate}x</span>
            </button>

            {activeMenu === 'speed' && (
                <div className="absolute bottom-full right-0 mb-2 z-50 w-36 rounded-xl bg-[#141418]/95 backdrop-blur-xl border border-white/15 shadow-2xl p-1.5 text-xs select-none">
                  {PLAYBACK_RATES.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => {
                        applyPlaybackRate(r);
                        setActiveMenu('none');
                      }}
                      className={`w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between font-mono cursor-pointer transition-colors ${
                        Math.abs(playbackRate - r) < 0.01
                          ? 'bg-[rgb(var(--primary-color))] text-white font-bold'
                          : 'text-white/80 hover:bg-white/10'
                      }`}
                    >
                      <span>{r === 1 ? '1x Normal' : `${r}x`}</span>
                      {Math.abs(playbackRate - r) < 0.01 && <Check className="w-3.5 h-3.5" />}
                    </button>
                  ))}
                </div>
            )}
          </div>

          {hasNextEpisode && onNextEpisode && (
            <button
              type="button"
              onClick={onNextEpisode}
              className="p-2 rounded-lg text-white/85 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="Next episode"
              title="Next episode (N)"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          )}

          <button
            type="button"
            onClick={() => void togglePip()}
            className={`hidden sm:inline-flex p-2 rounded-lg transition-colors cursor-pointer ${
              isPip ? 'text-[rgb(var(--primary-color))] bg-white/10' : 'text-white/80 hover:text-white hover:bg-white/10'
            }`}
            aria-label="Picture in picture"
            title="Picture-in-Picture (I)"
          >
            <PictureInPicture2 className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          <button
            type="button"
            onClick={() => void toggleFullscreen()}
            className="p-2 rounded-lg text-white/85 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            title={isFullscreen ? 'Exit Fullscreen (F)' : 'Fullscreen (F)'}
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  );
};

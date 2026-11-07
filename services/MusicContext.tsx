import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { MusicTrack, ALL_INITIAL_TRACKS } from './musicService';

interface MusicContextType {
  currentTrack: MusicTrack | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  queue: MusicTrack[];
  queueIndex: number;
  isShuffle: boolean;
  repeatMode: 'off' | 'all' | 'one';
  isExpanded: boolean;
  showLyrics: boolean;
  showQueue: boolean;
  likedTracks: MusicTrack[];
  recentlyPlayed: MusicTrack[];
  playTrack: (track: MusicTrack, customQueue?: MusicTrack[]) => void;
  togglePlayPause: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  seek: (seconds: number) => void;
  setVolume: (val: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  toggleLike: (track: MusicTrack) => void;
  isLiked: (trackId: string) => boolean;
  addToQueue: (track: MusicTrack) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  setIsExpanded: (val: boolean) => void;
  setShowLyrics: (val: boolean) => void;
  setShowQueue: (val: boolean) => void;
}

const MusicContext = createContext<MusicContextType | undefined>(undefined);

const LIKED_STORAGE_KEY = 'streamhub_music_liked';
const RECENT_STORAGE_KEY = 'streamhub_music_recent';

export const MusicProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentTrack, setCurrentTrack] = useState<MusicTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolumeState] = useState<number>(0.85);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  
  const [queue, setQueue] = useState<MusicTrack[]>(ALL_INITIAL_TRACKS);
  const [queueIndex, setQueueIndex] = useState<number>(0);
  const [isShuffle, setIsShuffle] = useState<boolean>(false);
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off');
  
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [showLyrics, setShowLyrics] = useState<boolean>(false);
  const [showQueue, setShowQueue] = useState<boolean>(false);

  const [likedTracks, setLikedTracks] = useState<MusicTrack[]>(() => {
    try {
      const saved = localStorage.getItem(LIKED_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [recentlyPlayed, setRecentlyPlayed] = useState<MusicTrack[]>(() => {
    try {
      const saved = localStorage.getItem(RECENT_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio element
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'auto';
    audioRef.current = audio;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if (!isNaN(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
    };

    const handleLoadedMetadata = () => {
      if (!isNaN(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    const handleEnded = () => {
      if (repeatMode === 'one') {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      } else {
        handleNextTrackRef.current();
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audioRef.current = null;
    };
  }, [repeatMode]);

  // Keep a ref for nextTrack to use in handleEnded
  const handleNextTrackRef = useRef<() => void>(() => {});

  // Play track implementation
  const playTrack = useCallback((track: MusicTrack, customQueue?: MusicTrack[]) => {
    if (!audioRef.current) return;

    setCurrentTrack(track);
    setCurrentTime(0);
    setDuration(track.duration || 0);

    // Update queue if provided
    if (customQueue && customQueue.length > 0) {
      setQueue(customQueue);
      const foundIdx = customQueue.findIndex(t => t.id === track.id);
      setQueueIndex(foundIdx >= 0 ? foundIdx : 0);
    } else {
      // Find or append in current queue
      const existingIdx = queue.findIndex(t => t.id === track.id);
      if (existingIdx >= 0) {
        setQueueIndex(existingIdx);
      } else {
        setQueue(prev => [track, ...prev]);
        setQueueIndex(0);
      }
    }

    // Save to recently played
    setRecentlyPlayed(prev => {
      const filtered = prev.filter(t => t.id !== track.id);
      const updated = [track, ...filtered].slice(0, 30);
      try {
        localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });

    if (track.audioUrl) {
      audioRef.current.src = track.audioUrl;
      audioRef.current.load();
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(err => {
        console.debug('Audio play failed or was blocked by browser policy:', err);
        setIsPlaying(false);
      });
    }
  }, [queue]);

  const togglePlayPause = useCallback(() => {
    if (!audioRef.current) return;
    if (!currentTrack) {
      if (queue.length > 0) {
        playTrack(queue[0]);
      }
      return;
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }
  }, [currentTrack, isPlaying, queue, playTrack]);

  const nextTrack = useCallback(() => {
    if (queue.length === 0) return;

    let nextIdx = queueIndex + 1;
    if (isShuffle) {
      nextIdx = Math.floor(Math.random() * queue.length);
    } else if (nextIdx >= queue.length) {
      if (repeatMode === 'all') {
        nextIdx = 0;
      } else {
        // reached end of queue
        setIsPlaying(false);
        return;
      }
    }

    setQueueIndex(nextIdx);
    const nextItem = queue[nextIdx];
    if (nextItem) {
      playTrack(nextItem);
    }
  }, [queue, queueIndex, isShuffle, repeatMode, playTrack]);

  handleNextTrackRef.current = nextTrack;

  const prevTrack = useCallback(() => {
    if (!audioRef.current || queue.length === 0) return;

    // If more than 3 seconds in, restart track
    if (audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
      return;
    }

    let prevIdx = queueIndex - 1;
    if (prevIdx < 0) {
      prevIdx = queue.length - 1;
    }

    setQueueIndex(prevIdx);
    const prevItem = queue[prevIdx];
    if (prevItem) {
      playTrack(prevItem);
    }
  }, [queue, queueIndex, playTrack]);

  const seek = useCallback((seconds: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = seconds;
    setCurrentTime(seconds);
  }, []);

  const setVolume = useCallback((val: number) => {
    const clamped = Math.max(0, Math.min(1, val));
    setVolumeState(clamped);
    if (audioRef.current) {
      audioRef.current.volume = clamped;
    }
    if (clamped > 0 && isMuted) {
      setIsMuted(false);
      if (audioRef.current) audioRef.current.muted = false;
    }
  }, [isMuted]);

  const toggleMute = useCallback(() => {
    if (!audioRef.current) return;
    const nextMuted = !isMuted;
    audioRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
  }, [isMuted]);

  const toggleShuffle = useCallback(() => {
    setIsShuffle(prev => !prev);
  }, []);

  const cycleRepeat = useCallback(() => {
    setRepeatMode(prev => {
      if (prev === 'off') return 'all';
      if (prev === 'all') return 'one';
      return 'off';
    });
  }, []);

  const toggleLike = useCallback((track: MusicTrack) => {
    setLikedTracks(prev => {
      const exists = prev.some(t => t.id === track.id);
      let updated: MusicTrack[];
      if (exists) {
        updated = prev.filter(t => t.id !== track.id);
      } else {
        updated = [track, ...prev];
      }
      try {
        localStorage.setItem(LIKED_STORAGE_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, []);

  const isLiked = useCallback((trackId: string) => {
    return likedTracks.some(t => t.id === trackId);
  }, [likedTracks]);

  const addToQueue = useCallback((track: MusicTrack) => {
    setQueue(prev => [...prev, track]);
  }, []);

  const removeFromQueue = useCallback((index: number) => {
    setQueue(prev => prev.filter((_, idx) => idx !== index));
    if (index < queueIndex) {
      setQueueIndex(prev => Math.max(0, prev - 1));
    }
  }, [queueIndex]);

  const clearQueue = useCallback(() => {
    if (currentTrack) {
      setQueue([currentTrack]);
      setQueueIndex(0);
    } else {
      setQueue([]);
      setQueueIndex(0);
    }
  }, [currentTrack]);

  return (
    <MusicContext.Provider
      value={{
        currentTrack,
        isPlaying,
        currentTime,
        duration,
        volume,
        isMuted,
        queue,
        queueIndex,
        isShuffle,
        repeatMode,
        isExpanded,
        showLyrics,
        showQueue,
        likedTracks,
        recentlyPlayed,
        playTrack,
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
        addToQueue,
        removeFromQueue,
        clearQueue,
        setIsExpanded,
        setShowLyrics,
        setShowQueue,
      }}
    >
      {children}
    </MusicContext.Provider>
  );
};

export const useMusic = () => {
  const context = useContext(MusicContext);
  if (!context) {
    throw new Error('useMusic must be used within a MusicProvider');
  }
  return context;
};

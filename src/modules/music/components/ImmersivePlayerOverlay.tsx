import React, { useEffect, useRef, useState } from 'react';
import { 
  X, Maximize2, Minimize2, Play, Pause, SkipBack, SkipForward, 
  Shuffle, Repeat, Volume2, VolumeX, Mic2, ListMusic, Heart, 
  Disc, Sparkles, Trash2, ArrowRight
} from 'lucide-react';
import { useMusicPlayerStore } from '../store/useMusicPlayerStore';
import { fetchLyrics } from '../api/lyrics';
import { SteeredClock } from '../player/SteeredClock';
import { MusicTrack } from '../types';

interface ImmersivePlayerOverlayProps {
  steeredClock?: SteeredClock;
  onSeek: (seconds: number) => void;
}

export const ImmersivePlayerOverlay: React.FC<ImmersivePlayerOverlayProps> = ({
  steeredClock,
  onSeek,
}) => {
  const showLyrics = useMusicPlayerStore(state => state.showLyrics);
  const showQueue = useMusicPlayerStore(state => state.showQueue);
  const setShowLyrics = useMusicPlayerStore(state => state.setShowLyrics);
  const setShowQueue = useMusicPlayerStore(state => state.setShowQueue);

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

  const [activeTab, setActiveTab] = useState<'lyrics' | 'queue'>('lyrics');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [steeredTime, setSteeredTime] = useState(0);

  const activeLineRef = useRef<HTMLDivElement | null>(null);
  const lyricsContainerRef = useRef<HTMLDivElement | null>(null);

  // Synchronize active tab based on which button opened the overlay
  useEffect(() => {
    if (showQueue && !showLyrics) {
      setActiveTab('queue');
    } else if (showLyrics && !showQueue) {
      setActiveTab('lyrics');
    }
  }, [showLyrics, showQueue]);

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

  // Smooth auto-scroll active lyric line into center
  useEffect(() => {
    if (activeTab === 'lyrics' && activeLineRef.current && lyricsContainerRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [Math.floor(steeredTime), activeTab]);

  const isOpen = showLyrics || showQueue;
  if (!isOpen || !currentTrack) return null;

  const handleClose = () => {
    setShowLyrics(false);
    setShowQueue(false);
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
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Active line calculation
  const activeLineIdx = activeLyrics?.synced
    ? activeLyrics.synced.findIndex((line, i) => {
        const nextTime = activeLyrics.synced![i + 1]?.time ?? Infinity;
        return steeredTime >= line.time && steeredTime < nextTime;
      })
    : -1;

  // Up next tracks from current queue
  const upNextTracks = queue.slice(queueIndex + 1);

  return (
    <div 
      className="fixed inset-0 z-50 flex flex-col bg-[#07080a] text-white select-none overflow-hidden animate-fade-in"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      
      {/* Ambient Muted Backdrop derived from Album Artwork */}
      <div 
        className="absolute inset-0 bg-cover bg-center filter blur-3xl opacity-30 scale-125 pointer-events-none transition-all duration-1000"
        style={{ backgroundImage: `url(${currentTrack.artwork})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0a]/90 via-[#0a0a0a]/80 to-[#050505]/95 pointer-events-none" />

      {/* ========================================================================= */}
      {/* 1. TOP HEADER: Close (X) Top-Left, Tab Switcher, Fullscreen Top-Right     */}
      {/* ========================================================================= */}
      <header className="relative z-20 px-6 sm:px-10 py-5 flex items-center justify-between border-b border-white/10 backdrop-blur-md bg-black/20">
        
        {/* Close Button top-left */}
        <button
          type="button"
          onClick={handleClose}
          className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer hover:scale-105 active:scale-95 shadow-lg"
          title="Close Fullscreen View"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Center Mode Switcher: Lyrics vs Queue */}
        <div className="flex items-center gap-1 bg-[#121212] p-1 rounded-full border border-white/10 shadow-lg">
          <button
            type="button"
            onClick={() => setActiveTab('lyrics')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'lyrics' 
                ? 'bg-white text-black shadow' 
                : 'text-[#b3b3b3] hover:text-white'
            }`}
          >
            <Mic2 className="w-3.5 h-3.5" />
            <span>Lyrics</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('queue')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'queue' 
                ? 'bg-white text-black shadow' 
                : 'text-[#b3b3b3] hover:text-white'
            }`}
          >
            <ListMusic className="w-3.5 h-3.5" />
            <span>Up Next ({upNextTracks.length})</span>
          </button>
        </div>

        {/* Fullscreen Expand Icon top-right */}
        <button
          type="button"
          onClick={toggleNativeFullscreen}
          className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer hover:scale-105 active:scale-95 shadow-lg"
          title={isFullscreen ? 'Exit Fullscreen' : 'Enter Native Fullscreen'}
        >
          {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
        </button>
      </header>

      {/* ========================================================================= */}
      {/* 2. MAIN 2-PANEL BODY                                                      */}
      {/* Left Panel: Now Playing (Artwork, Meta, Scrubber, Transport Controls)     */}
      {/* Right Panel: Synchronized Lyrics OR Up Next Queue List                    */}
      {/* ========================================================================= */}
      <div className="relative z-10 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 px-6 sm:px-12 py-8 overflow-hidden max-w-7xl mx-auto w-full">
        
        {/* ======================================================================= */}
        {/* LEFT PANEL: NOW PLAYING                                                 */}
        {/* ======================================================================= */}
        <div className="lg:col-span-5 flex flex-col justify-center items-center lg:items-start space-y-6 max-w-md mx-auto w-full">
          
          {/* Large crisp album artwork with shadow */}
          <div className="relative aspect-square w-64 sm:w-80 lg:w-96 rounded-2xl overflow-hidden shadow-[0_24px_60px_rgba(0,0,0,0.85)] border border-white/10 shrink-0 bg-[#161616]">
            <img 
              src={currentTrack.artwork} 
              alt={currentTrack.title} 
              className="w-full h-full object-cover" 
            />
          </div>

          {/* Title, explicit badge, artist, album */}
          <div className="w-full text-center lg:text-left space-y-1.5">
            <div className="flex items-center justify-center lg:justify-start gap-2">
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white tracking-tight truncate">
                {currentTrack.title}
              </h2>
              {currentTrack.isExplicit && (
                <span className="px-1.5 py-0.5 rounded bg-white/20 text-[10px] font-mono font-bold text-white">
                  E
                </span>
              )}
              <button
                type="button"
                onClick={() => toggleLike(currentTrack.id)}
                className={`p-1 transition-colors cursor-pointer ml-1 ${
                  isLiked ? 'text-amber-400' : 'text-white/40 hover:text-white'
                }`}
              >
                <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
              </button>
            </div>

            <p className="text-base sm:text-lg text-white/90 font-medium">
              {currentTrack.artist}
            </p>
            <p className="text-xs text-[#b3b3b3] font-normal">
              {currentTrack.album || 'Single'}
            </p>
          </div>

          {/* Thick Scrubber Timeline (Current Time / Duration) */}
          <div className="w-full space-y-2">
            <div className="relative group w-full py-1">
              <input
                type="range"
                min={0}
                max={duration || 100}
                step={0.5}
                value={currentTime}
                onChange={handleScrubberChange}
                className="w-full h-2 bg-white/20 rounded-full appearance-none cursor-pointer outline-none transition-all accent-white hover:h-2.5"
              />
            </div>
            <div className="flex items-center justify-between text-xs text-[#b3b3b3] font-mono">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Large Transport Controls */}
          <div className="w-full flex items-center justify-between sm:justify-around pt-2">
            
            {/* Shuffle */}
            <button
              type="button"
              onClick={toggleShuffle}
              className={`p-2 transition-colors cursor-pointer ${
                shuffle ? 'text-white' : 'text-white/40 hover:text-white'
              }`}
              title="Shuffle"
            >
              <Shuffle className="w-5 h-5" />
            </button>

            {/* Previous Track */}
            <button
              type="button"
              onClick={prevTrack}
              className="p-2 text-white/80 hover:text-white hover:scale-110 active:scale-95 transition-all cursor-pointer"
              title="Previous Track"
            >
              <SkipBack className="w-7 h-7 fill-current" />
            </button>

            {/* Play / Pause (Large Circle Button) */}
            <button
              type="button"
              onClick={togglePlayPause}
              className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-transform cursor-pointer"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause className="w-8 h-8 fill-current" />
              ) : (
                <Play className="w-8 h-8 fill-current ml-1" />
              )}
            </button>

            {/* Next Track */}
            <button
              type="button"
              onClick={nextTrack}
              className="p-2 text-white/80 hover:text-white hover:scale-110 active:scale-95 transition-all cursor-pointer"
              title="Next Track"
            >
              <SkipForward className="w-7 h-7 fill-current" />
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
              <Repeat className="w-5 h-5" />
              {repeatMode === 'one' && (
                <span className="absolute top-1 right-1 text-[9px] font-bold">1</span>
              )}
            </button>

          </div>

          {/* Volume Control */}
          <div className="w-full flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={toggleMute}
              className="p-1.5 text-white/60 hover:text-white transition-colors cursor-pointer"
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
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-full h-1 bg-white/20 rounded-full appearance-none cursor-pointer outline-none accent-white"
            />
          </div>

        </div>

        {/* ======================================================================= */}
        {/* RIGHT PANEL: LYRICS OR QUEUE                                            */}
        {/* ======================================================================= */}
        <div className="lg:col-span-7 flex flex-col h-full overflow-hidden border-t lg:border-t-0 lg:border-l border-white/10 pl-0 lg:pl-10 pt-6 lg:pt-0">
          
          {/* TAB 1: SYNCHRONIZED LYRICS */}
          {activeTab === 'lyrics' && (
            <div 
              ref={lyricsContainerRef}
              className="flex-1 overflow-y-auto pr-2 am-scrollbar space-y-8 py-8"
            >
              {isLoadingLyrics ? (
                <div className="flex flex-col items-center justify-center h-full text-white/40 gap-3 py-20">
                  <Disc className="w-8 h-8 animate-spin text-white/60" />
                  <p className="text-sm font-semibold">Synchronizing lyrics with audio clock...</p>
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
                        className={`cursor-pointer transition-all duration-300 rounded-2xl px-3 py-2 leading-tight ${
                          isActive
                            ? 'text-white text-2xl sm:text-3xl lg:text-4xl font-extrabold scale-[1.02] filter drop-shadow-[0_4px_16px_rgba(255,255,255,0.25)]'
                            : 'text-[rgba(255,255,255,0.4)] text-xl sm:text-2xl font-bold hover:text-white/70 filter blur-[0.4px]'
                        }`}
                      >
                        {line.text}
                      </div>
                    );
                  })}
                </div>
              ) : activeLyrics?.plain ? (
                <div className="whitespace-pre-line text-lg sm:text-xl font-bold leading-relaxed text-white/80 py-6">
                  {activeLyrics.plain}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center text-white/40 gap-3 py-20">
                  <Disc className="w-10 h-10 text-white/20" />
                  <p className="text-base font-semibold text-white">No Synchronized Lyrics</p>
                  <p className="text-xs text-[#b3b3b3] max-w-xs">
                    This track may be instrumental or lyrics have not yet been indexed in the BitChord repository.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: UP NEXT QUEUE */}
          {activeTab === 'queue' && (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
                <span className="text-xs font-semibold text-[#b3b3b3] uppercase tracking-wider">
                  Up Next ({upNextTracks.length})
                </span>
                {upNextTracks.length > 0 && (
                  <button
                    type="button"
                    onClick={clearQueue}
                    className="flex items-center gap-1.5 text-xs text-[#b3b3b3] hover:text-red-400 transition-colors cursor-pointer"
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
                            className="w-10 h-10 rounded-lg object-cover bg-[#1a1a1a] shrink-0" 
                          />

                          <div className="min-w-0 flex-1">
                            <h4 className="text-sm font-semibold text-white truncate">
                              {track.title}
                            </h4>
                            <p className="text-xs text-[#b3b3b3] truncate mt-0.5">
                              {track.artist}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 shrink-0 pl-2">
                          <span className="text-xs font-mono text-[#b3b3b3]">
                            {formatTime(track.duration)}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFromQueue(actualQueueIndex);
                            }}
                            className="p-1 text-white/30 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                            title="Remove from queue"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-24 text-center text-white/40 space-y-2">
                    <ListMusic className="w-10 h-10 mx-auto text-white/20" />
                    <p className="text-sm font-semibold text-white">Queue is Empty</p>
                    <p className="text-xs text-[#b3b3b3]">
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

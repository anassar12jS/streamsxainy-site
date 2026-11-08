import React, { useState, useEffect, useRef } from 'react';
import { 
  ChevronDown, Heart, Shuffle, SkipBack, Play, Pause, SkipForward, 
  Repeat, Repeat1, Volume2, VolumeX, Mic2, ListMusic, Sparkles, 
  Trash2, Music2, Share2, Disc3, Radio, ExternalLink
} from 'lucide-react';
import { useMusic } from '../services/MusicContext';
import { formatDuration, fetchTrackLyrics, SyncedLyricLine } from '../services/musicService';

export const MusicNowPlayingModal: React.FC = () => {
  const {
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
    playTrack,
    removeFromQueue,
  } = useMusic();

  const [activeTab, setActiveTab] = useState<'cover' | 'lyrics' | 'queue'>('cover');
  const [lyricsData, setLyricsData] = useState<{ plain: string; synced: SyncedLyricLine[] } | null>(null);
  const [isLoadingLyrics, setIsLoadingLyrics] = useState(false);
  
  const activeLyricRef = useRef<HTMLDivElement | null>(null);
  const lyricsContainerRef = useRef<HTMLDivElement | null>(null);

  // Sync tab with external showLyrics / showQueue triggers
  useEffect(() => {
    if (showLyrics) setActiveTab('lyrics');
    else if (showQueue) setActiveTab('queue');
  }, [showLyrics, showQueue]);

  // Load lyrics when currentTrack changes
  useEffect(() => {
    if (!currentTrack || currentTrack.isRadio) {
      setLyricsData(null);
      return;
    }

    let isMounted = true;
    setIsLoadingLyrics(true);

    fetchTrackLyrics(currentTrack.artist, currentTrack.title).then(res => {
      if (isMounted) {
        setLyricsData(res);
        setIsLoadingLyrics(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [currentTrack]);

  // Auto-scroll lyrics to active line
  useEffect(() => {
    if (activeTab === 'lyrics' && activeLyricRef.current && lyricsContainerRef.current) {
      activeLyricRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [currentTime, activeTab]);

  if (!isExpanded || !currentTrack) return null;

  const liked = isLiked(currentTrack.id);
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Find active synced lyric line
  const activeLyricIndex = lyricsData?.synced
    ? lyricsData.synced.findIndex((line, i) => {
        const nextTime = lyricsData.synced[i + 1]?.time ?? Infinity;
        return currentTime >= line.time && currentTime < nextTime;
      })
    : -1;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex flex-col bg-[#07080a] text-white animate-fade-in">
      
      {/* Dynamic blurred backdrop image */}
      <div 
        className="absolute inset-0 bg-cover bg-center filter blur-3xl opacity-25 scale-125 pointer-events-none transition-all duration-1000"
        style={{ backgroundImage: `url(${currentTrack.artwork})` }}
      />
      <div className="absolute inset-0 bg-black/60 pointer-events-none" />

      {/* ========================================================================= */}
      {/* 1. HEADER: DISMISS & TABS                                                 */}
      {/* ========================================================================= */}
      <div className="relative z-10 px-4 sm:px-8 pt-4 pb-3 flex items-center justify-between border-b border-white/10 backdrop-blur-md">
        
        {/* Minimize Button */}
        <button
          onClick={() => {
            setIsExpanded(false);
            setShowLyrics(false);
            setShowQueue(false);
          }}
          className="p-2.5 rounded-2xl bg-white/5 hover:bg-white/15 text-white/80 hover:text-white transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold"
          title="Minimize player"
        >
          <ChevronDown className="w-5 h-5" />
          <span className="hidden sm:inline">Minimize</span>
        </button>

        {/* Center Mode Tabs */}
        <div className="flex items-center gap-1 bg-white/5 p-1 rounded-2xl border border-white/10 shadow-lg">
          <button
            onClick={() => {
              setActiveTab('cover');
              setShowLyrics(false);
              setShowQueue(false);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'cover' 
                ? 'bg-rose-500 text-white shadow-md shadow-rose-500/25' 
                : 'text-white/60 hover:text-white'
            }`}
          >
            Artwork
          </button>
          <button
            onClick={() => {
              setActiveTab('lyrics');
              setShowLyrics(true);
              setShowQueue(false);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'lyrics' 
                ? 'bg-rose-500 text-white shadow-md shadow-rose-500/25' 
                : 'text-white/60 hover:text-white'
            }`}
          >
            <Mic2 className="w-3.5 h-3.5" />
            <span>Lyrics</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('queue');
              setShowQueue(true);
              setShowLyrics(false);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'queue' 
                ? 'bg-rose-500 text-white shadow-md shadow-rose-500/25' 
                : 'text-white/60 hover:text-white'
            }`}
          >
            <ListMusic className="w-3.5 h-3.5" />
            <span>Queue ({queue.length})</span>
          </button>
        </div>

        {/* BitChord Branding Badge */}
        <div className="flex items-center gap-2 text-xs font-mono text-white/40">
          <span className="hidden md:inline">BitChord Engine</span>
          <span className="px-2 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 font-bold text-[10px]">
            LOSSLESS
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. BODY CONTENT (COVER / LYRICS / QUEUE)                                 */}
      {/* ========================================================================= */}
      <div className="relative z-10 flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-8 flex items-center justify-center">
        
        {/* VIEW 1: ALBUM COVER & ARTWORK FOCUS */}
        {activeTab === 'cover' && (
          <div className="max-w-md w-full flex flex-col items-center text-center space-y-6 animate-fade-in my-auto">
            
            {/* Big 3D Vinyl Album Cover */}
            <div className="relative w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 rounded-3xl overflow-hidden shadow-2xl border border-white/15 bg-black/60 group">
              <img 
                src={currentTrack.artwork} 
                alt={currentTrack.title} 
                className={`w-full h-full object-cover transition-transform duration-700 ${
                  isPlaying ? 'scale-100' : 'scale-95 opacity-90'
                }`}
              />
              {currentTrack.isRadio && (
                <div className="absolute top-4 left-4 flex items-center gap-1.5 bg-black/70 backdrop-blur-md px-3 py-1 rounded-full border border-rose-500/40 text-xs font-bold text-rose-400">
                  <Radio className="w-3.5 h-3.5 animate-pulse" />
                  <span>24/7 LIVE BROADCAST</span>
                </div>
              )}
            </div>

            {/* Track Info & Like */}
            <div className="w-full space-y-2">
              <div className="flex items-center justify-between gap-4">
                <div className="text-left min-w-0 flex-1">
                  <h2 className="text-2xl sm:text-3xl font-black text-white truncate tracking-tight">
                    {currentTrack.title}
                  </h2>
                  <p className="text-base sm:text-lg text-white/60 truncate mt-0.5 font-semibold">
                    {currentTrack.artist}
                  </p>
                  <p className="text-xs text-white/40 truncate mt-0.5">
                    {currentTrack.album} {currentTrack.year ? `· ${currentTrack.year}` : ''}
                  </p>
                </div>

                <button
                  onClick={() => toggleLike(currentTrack)}
                  className={`p-3 rounded-2xl transition-all cursor-pointer border ${
                    liked 
                      ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 shadow-lg shadow-rose-500/20' 
                      : 'bg-white/5 text-white/60 border-white/10 hover:text-white hover:bg-white/10'
                  }`}
                  title={liked ? 'Liked' : 'Like'}
                >
                  <Heart className={`w-6 h-6 ${liked ? 'fill-current scale-110' : ''}`} />
                </button>
              </div>

              {/* Animated Waveform Bars when playing */}
              <div className="h-8 flex items-end justify-center gap-1 pt-2 opacity-80">
                {[...Array(24)].map((_, idx) => (
                  <span
                    key={idx}
                    className="w-1 bg-rose-400/80 rounded-full transition-all duration-300"
                    style={{
                      height: isPlaying 
                        ? `${Math.max(15, Math.sin(idx * 0.5 + currentTime * 4) * 85 + 15)}%` 
                        : '15%',
                    }}
                  />
                ))}
              </div>
            </div>

          </div>
        )}

        {/* VIEW 2: SYNCED LYRICS (BITCHORD / LRCLIB POWERED) */}
        {activeTab === 'lyrics' && (
          <div 
            ref={lyricsContainerRef}
            className="max-w-2xl w-full h-[60vh] overflow-y-auto custom-scrollbar text-center py-8 space-y-6 animate-fade-in"
          >
            {isLoadingLyrics ? (
              <div className="flex flex-col items-center justify-center h-full text-white/40 gap-3">
                <Disc3 className="w-8 h-8 animate-spin text-rose-400" />
                <p className="text-sm">Fetching synchronized lyrics from BitChord LRCLIB...</p>
              </div>
            ) : lyricsData?.synced && lyricsData.synced.length > 0 ? (
              lyricsData.synced.map((line, idx) => {
                const isActive = idx === activeLyricIndex;
                return (
                  <div
                    key={idx}
                    ref={isActive ? activeLyricRef : null}
                    onClick={() => seek(line.time)}
                    className={`cursor-pointer transition-all duration-300 px-4 py-2 rounded-2xl select-none ${
                      isActive 
                        ? 'text-white text-2xl sm:text-3xl font-black scale-105 bg-white/10 shadow-xl text-rose-300' 
                        : 'text-white/30 text-lg sm:text-xl font-bold hover:text-white/70'
                    }`}
                  >
                    {line.text}
                  </div>
                );
              })
            ) : lyricsData?.plain ? (
              <div className="text-white/80 whitespace-pre-line text-base sm:text-lg font-medium leading-relaxed">
                {lyricsData.plain}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-white/40 gap-2">
                <Mic2 className="w-8 h-8 opacity-40" />
                <p className="text-sm font-semibold">Instrumental or no synced lyrics found for this track.</p>
                <p className="text-xs text-white/30">Sing along and enjoy the music!</p>
              </div>
            )}
          </div>
        )}

        {/* VIEW 3: UP-NEXT QUEUE */}
        {activeTab === 'queue' && (
          <div className="max-w-2xl w-full h-[60vh] overflow-y-auto custom-scrollbar space-y-2 animate-fade-in pr-2">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 text-xs font-bold text-white/40 uppercase tracking-wider">
              <span>Up Next ({queue.length} Tracks)</span>
              <span>Playing #{queueIndex + 1}</span>
            </div>

            {queue.map((track, idx) => {
              const isCurrent = idx === queueIndex;
              return (
                <div
                  key={`${track.id}-${idx}`}
                  onClick={() => playTrack(track)}
                  className={`flex items-center justify-between gap-3 p-3 rounded-2xl cursor-pointer border transition-all ${
                    isCurrent 
                      ? 'bg-rose-500/15 border-rose-500/40 text-white ring-1 ring-rose-500/30' 
                      : 'bg-white/5 border-white/5 hover:bg-white/10 text-white/70 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img 
                      src={track.artwork} 
                      alt="" 
                      className="w-11 h-11 rounded-xl object-cover shrink-0 shadow" 
                    />
                    <div className="min-w-0">
                      <h4 className={`text-sm font-bold truncate ${isCurrent ? 'text-rose-400' : 'text-white'}`}>
                        {track.title}
                      </h4>
                      <p className="text-xs text-white/50 truncate">{track.artist}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs font-mono text-white/40">
                      {formatDuration(track.duration)}
                    </span>
                    {!isCurrent && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFromQueue(idx);
                        }}
                        className="p-1.5 text-white/30 hover:text-red-400 rounded-lg hover:bg-white/5 transition-colors"
                        title="Remove from queue"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* ========================================================================= */}
      {/* 3. FOOTER: FULL INTERACTIVE SCRUBBER & CONTROLS                          */}
      {/* ========================================================================= */}
      <div className="relative z-10 p-6 sm:p-8 border-t border-white/10 backdrop-blur-2xl bg-black/40 space-y-4">
        
        {/* Scrubber Bar */}
        <div className="max-w-3xl mx-auto w-full space-y-1.5">
          <input 
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={(e) => seek(Number(e.target.value))}
            disabled={currentTrack.isRadio}
            className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-rose-500 hover:h-2 transition-all"
          />
          <div className="flex justify-between text-xs font-mono text-white/50">
            <span>{formatDuration(currentTime)}</span>
            <span>{currentTrack.isRadio ? '24/7 LIVE' : formatDuration(duration)}</span>
          </div>
        </div>

        {/* Buttons Row */}
        <div className="max-w-xl mx-auto flex items-center justify-between gap-4">
          
          {/* Shuffle */}
          <button
            onClick={toggleShuffle}
            className={`p-3 rounded-2xl transition-all cursor-pointer ${
              isShuffle ? 'text-rose-400 bg-rose-500/20' : 'text-white/40 hover:text-white'
            }`}
            title="Shuffle"
          >
            <Shuffle className="w-5 h-5" />
          </button>

          {/* Previous Track */}
          <button
            onClick={prevTrack}
            className="p-3 rounded-2xl text-white/70 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
            title="Previous"
          >
            <SkipBack className="w-7 h-7 fill-current" />
          </button>

          {/* Big Play/Pause Button */}
          <button
            onClick={togglePlayPause}
            className="w-16 h-16 rounded-full bg-white text-black hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-rose-500/20 flex items-center justify-center cursor-pointer"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="w-7 h-7 fill-current" />
            ) : (
              <Play className="w-7 h-7 fill-current ml-1" />
            )}
          </button>

          {/* Next Track */}
          <button
            onClick={nextTrack}
            className="p-3 rounded-2xl text-white/70 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
            title="Next"
          >
            <SkipForward className="w-7 h-7 fill-current" />
          </button>

          {/* Repeat */}
          <button
            onClick={cycleRepeat}
            className={`p-3 rounded-2xl transition-all cursor-pointer ${
              repeatMode !== 'off' ? 'text-rose-400 bg-rose-500/20' : 'text-white/40 hover:text-white'
            }`}
            title={`Repeat: ${repeatMode}`}
          >
            {repeatMode === 'one' ? <Repeat1 className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}
          </button>

        </div>

        {/* Bottom Volume Bar */}
        <div className="max-w-xs mx-auto flex items-center justify-center gap-3 pt-1">
          <button onClick={toggleMute} className="text-white/50 hover:text-white cursor-pointer">
            {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <input 
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={isMuted ? 0 : volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="w-36 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-rose-500"
          />
        </div>

      </div>

    </div>
  );
};
export default MusicNowPlayingModal;

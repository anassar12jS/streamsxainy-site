import React, { useEffect, useRef, useState } from 'react';
import { X, Mic2, Disc, Maximize2, Minimize2, Sparkles } from 'lucide-react';
import { useMusicPlayerStore } from '../store/useMusicPlayerStore';
import { fetchLyrics } from '../api/lyrics';
import { SteeredClock } from '../player/SteeredClock';

// Dynamically import AmLyrics from @uimaxbai/am-lyrics/react if supported
let AmLyricsComponent: any = null;
try {
  // @ts-ignore
  import('@uimaxbai/am-lyrics/react').then(m => {
    AmLyricsComponent = m.AmLyrics;
  }).catch(() => {});
} catch {}

interface LyricsPanelProps {
  steeredClock?: SteeredClock;
  onSeek: (seconds: number) => void;
}

export const LyricsPanel: React.FC<LyricsPanelProps> = ({
  steeredClock,
  onSeek,
}) => {
  const showLyrics = useMusicPlayerStore(state => state.showLyrics);
  const setShowLyrics = useMusicPlayerStore(state => state.setShowLyrics);
  const currentTrack = useMusicPlayerStore(state => state.currentTrack);
  const activeLyrics = useMusicPlayerStore(state => state.activeLyrics);
  const setLyrics = useMusicPlayerStore(state => state.setLyrics);
  const isLoadingLyrics = useMusicPlayerStore(state => state.isLoadingLyrics);
  const setIsLoadingLyrics = useMusicPlayerStore(state => state.setIsLoadingLyrics);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [steeredTime, setSteeredTime] = useState(0);
  const activeLineRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Steered audio clock subscription for driftless 60fps lyric rendering
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

  // Auto-scroll the active line into center
  useEffect(() => {
    if (activeLineRef.current && scrollContainerRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [Math.floor(steeredTime)]);

  if (!showLyrics || !currentTrack) return null;

  // Find active line index
  const activeLineIdx = activeLyrics?.synced
    ? activeLyrics.synced.findIndex((line, i) => {
        const nextTime = activeLyrics.synced![i + 1]?.time ?? Infinity;
        return steeredTime >= line.time && steeredTime < nextTime;
      })
    : -1;

  return (
    <div className={`fixed z-50 transition-all duration-300 flex flex-col bg-[#07080a] text-white select-none ${
      isFullscreen
        ? 'inset-0'
        : 'top-[56px] bottom-0 right-0 w-full sm:w-[480px] lg:w-[540px] border-l border-white/10 shadow-2xl'
    }`}>
      
      {/* Dynamic blurred reactive album artwork background */}
      <div 
        className="absolute inset-0 bg-cover bg-center filter blur-3xl opacity-35 scale-125 pointer-events-none transition-all duration-1000"
        style={{ backgroundImage: `url(${currentTrack.artwork})` }}
      />
      <div className="absolute inset-0 bg-black/55 pointer-events-none" />

      {/* Top Header Bar */}
      <div className="relative z-10 px-6 py-4 border-b border-white/10 flex items-center justify-between backdrop-blur-xl bg-black/20">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-white/10 text-white flex items-center justify-center shrink-0">
            <Mic2 className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-white truncate">
              {currentTrack.title}
            </h3>
            <p className="text-xs text-white/50 truncate">
              {currentTrack.artist}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 rounded-xl text-white/60 hover:text-white bg-white/5 hover:bg-white/10 transition-colors cursor-pointer hidden sm:block"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Lyrics'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setShowLyrics(false)}
            className="p-2 rounded-xl text-white/60 hover:text-white bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
            title="Close Lyrics"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Lyrics Content Container */}
      <div 
        ref={scrollContainerRef}
        className="relative z-10 flex-1 overflow-y-auto px-6 sm:px-10 py-12 am-scrollbar space-y-6"
      >
        {isLoadingLyrics ? (
          <div className="flex flex-col items-center justify-center h-full text-white/40 gap-3">
            <Disc className="w-8 h-8 animate-spin text-white/60" />
            <p className="text-sm font-semibold">Synchronizing lyrics with audio clock...</p>
          </div>
        ) : activeLyrics?.synced && activeLyrics.synced.length > 0 ? (
          /* Synced Lines with glowing focus, blur transitions & click-to-seek */
          <div className="max-w-xl mx-auto space-y-6 py-10">
            {activeLyrics.synced.map((line, idx) => {
              const isActive = idx === activeLineIdx;
              const isPast = idx < activeLineIdx;

              return (
                <div
                  key={`${line.time}-${idx}`}
                  ref={isActive ? activeLineRef : null}
                  onClick={() => onSeek(line.time)}
                  className={`cursor-pointer transition-all duration-300 rounded-2xl px-4 py-2 font-black leading-tight ${
                    isActive
                      ? 'text-white text-2xl sm:text-3xl lg:text-4xl scale-[1.03] text-shadow-lg text-[#ff8093] filter drop-shadow-[0_4px_16px_rgba(250,36,60,0.4)]'
                      : isPast
                        ? 'text-white/40 text-xl sm:text-2xl hover:text-white/70 filter blur-[0.4px]'
                        : 'text-white/20 text-xl sm:text-2xl hover:text-white/60 filter blur-[0.8px]'
                  }`}
                >
                  {line.text}
                </div>
              );
            })}
          </div>
        ) : activeLyrics?.plain ? (
          /* Plain Unsynced Lyrics */
          <div className="max-w-lg mx-auto whitespace-pre-line text-lg sm:text-xl font-bold leading-relaxed text-white/80 py-6">
            {activeLyrics.plain}
          </div>
        ) : (
          /* Empty / Instrumental Notice */
          <div className="flex flex-col items-center justify-center h-full text-center text-white/40 gap-3">
            <Disc className="w-10 h-10 text-white/20" />
            <p className="text-base font-bold text-white/80">No synchronized lyrics available</p>
            <p className="text-xs text-white/40 max-w-xs">
              This track may be instrumental or lyrics have not yet been indexed in the Xainy Music repository.
            </p>
          </div>
        )}
      </div>

      {/* Footer Branding */}
      <div className="relative z-10 px-6 py-3 border-t border-white/10 backdrop-blur-xl bg-black/30 flex items-center justify-between text-[11px] font-mono text-white/40">
        <span>Steered Audio Clock: {steeredTime.toFixed(2)}s</span>
        <span className="flex items-center gap-1 text-white/70">
          <Sparkles className="w-3 h-3" /> Xainy Music am-lyrics Engine
        </span>
      </div>

    </div>
  );
};

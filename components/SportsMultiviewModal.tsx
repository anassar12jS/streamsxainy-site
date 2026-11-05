import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  X, Maximize2, Minimize2, Volume2, VolumeX, RotateCw, 
  Plus, Grid, Columns, Radio, ExternalLink, Search, Trophy, Check
} from 'lucide-react';
import { SportsMatch, SportsStream } from '../types';
import { getMatchStreams, isMatchFinished } from '../services/sports';

interface SportsMultiviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  allMatches: SportsMatch[];
  initialMatch?: SportsMatch | null;
}

interface StreamSlot {
  slotId: number;
  match: SportsMatch | null;
  activeStream: SportsStream | null;
  availableStreams: SportsStream[];
  isLoading: boolean;
  isError: boolean;
  retryKey: number;
}

export const SportsMultiviewModal: React.FC<SportsMultiviewModalProps> = ({
  isOpen,
  onClose,
  allMatches,
  initialMatch,
}) => {
  const [layoutMode, setLayoutMode] = useState<'dual' | 'quad'>('dual');
  const [activeAudioSlot, setActiveAudioSlot] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Match picker modal state for a specific slot
  const [pickingSlotId, setPickingSlotId] = useState<number | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');

  // Slots state
  const [slots, setSlots] = useState<StreamSlot[]>([
    { slotId: 0, match: null, activeStream: null, availableStreams: [], isLoading: false, isError: false, retryKey: 0 },
    { slotId: 1, match: null, activeStream: null, availableStreams: [], isLoading: false, isError: false, retryKey: 0 },
    { slotId: 2, match: null, activeStream: null, availableStreams: [], isLoading: false, isError: false, retryKey: 0 },
    { slotId: 3, match: null, activeStream: null, availableStreams: [], isLoading: false, isError: false, retryKey: 0 },
  ]);

  // Load stream for a slot
  const loadStreamsForSlot = async (slotId: number, match: SportsMatch) => {
    setSlots(prev => prev.map(s => s.slotId === slotId ? { ...s, match, isLoading: true, isError: false } : s));
    
    if (!match.sources || match.sources.length === 0) {
      setSlots(prev => prev.map(s => s.slotId === slotId ? { ...s, isLoading: false, isError: true } : s));
      return;
    }

    try {
      // Pick first source
      const firstSource = match.sources[0];
      const streams = await getMatchStreams(firstSource.source, firstSource.id);
      
      const bestStream = streams.find(st => st.hd && st.language.toLowerCase().includes('english'))
        || streams.find(st => st.hd)
        || streams[0] || null;

      setSlots(prev => prev.map(s => {
        if (s.slotId === slotId) {
          return {
            ...s,
            availableStreams: streams,
            activeStream: bestStream,
            isLoading: false,
            isError: !bestStream,
          };
        }
        return s;
      }));
    } catch {
      setSlots(prev => prev.map(s => s.slotId === slotId ? { ...s, isLoading: false, isError: true } : s));
    }
  };

  // Initialize with initialMatch if provided, and auto-populate slot 1 with another live match if available
  useEffect(() => {
    if (!isOpen) return;

    if (initialMatch) {
      loadStreamsForSlot(0, initialMatch);
      
      // Auto find a second live/active match for slot 1 if empty
      const candidateMatches = allMatches.filter(m => m.id !== initialMatch.id && !isMatchFinished(m) && m.sources?.length > 0);
      if (candidateMatches.length > 0) {
        loadStreamsForSlot(1, candidateMatches[0]);
      }
    } else {
      // Pick top 2 live matches
      const liveOnes = allMatches.filter(m => !isMatchFinished(m) && m.sources?.length > 0);
      if (liveOnes[0]) loadStreamsForSlot(0, liveOnes[0]);
      if (liveOnes[1]) loadStreamsForSlot(1, liveOnes[1]);
    }
  }, [isOpen, initialMatch]);

  // Handle Fullscreen
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Close slot / reset
  const handleRemoveSlot = (slotId: number) => {
    setSlots(prev => prev.map(s => s.slotId === slotId ? {
      ...s,
      match: null,
      activeStream: null,
      availableStreams: [],
      isLoading: false,
      isError: false,
    } : s));
  };

  // Reload slot
  const handleReloadSlot = (slotId: number) => {
    setSlots(prev => prev.map(s => s.slotId === slotId ? { ...s, retryKey: s.retryKey + 1 } : s));
  };

  // Switch stream for a slot
  const handleSelectStream = (slotId: number, stream: SportsStream) => {
    setSlots(prev => prev.map(s => s.slotId === slotId ? { ...s, activeStream: stream } : s));
  };

  // Filtered matches for picker drawer
  const filteredPickerMatches = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    return allMatches.filter(m => {
      if (isMatchFinished(m)) return false;
      if (!m.sources || m.sources.length === 0) return false;
      if (!q) return true;
      return m.title.toLowerCase().includes(q) || (m.competition || '').toLowerCase().includes(q);
    });
  }, [allMatches, pickerSearch]);

  if (!isOpen) return null;

  const visibleSlotsCount = layoutMode === 'dual' ? 2 : 4;
  const activeSlots = slots.slice(0, visibleSlotsCount);

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 z-50 bg-[#08080b] flex flex-col text-white select-none animate-fade-in"
    >
      {/* Top Header Controls Bar */}
      <header className="h-14 px-4 bg-[#12131a] border-b border-white/10 flex items-center justify-between shrink-0 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            <h2 className="text-sm font-black tracking-wide uppercase text-white flex items-center gap-2">
              <Radio className="w-4 h-4 text-red-500" />
              <span>Sports Multiview Split-Screen</span>
            </h2>
          </div>

          <span className="hidden sm:inline-block text-xs text-white/40 font-mono">
            Watch concurrent feeds side-by-side
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Layout Mode Switcher */}
          <div className="flex items-center bg-black/60 p-1 rounded-xl border border-white/10">
            <button
              type="button"
              onClick={() => setLayoutMode('dual')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                layoutMode === 'dual'
                  ? 'bg-[rgb(var(--primary-color))] text-white shadow-md'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
              <span>Dual (2)</span>
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode('quad')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                layoutMode === 'quad'
                  ? 'bg-[rgb(var(--primary-color))] text-white shadow-md'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              <span>Quad (4)</span>
            </button>
          </div>

          {/* Fullscreen Button */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white transition-colors"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Close Multiview */}
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 transition-colors"
            title="Exit Multiview"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Grid Container */}
      <div className={`flex-1 p-2 sm:p-3 gap-2 sm:gap-3 grid ${
        layoutMode === 'dual'
          ? 'grid-cols-1 md:grid-cols-2'
          : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-2 auto-rows-fr'
      } overflow-hidden bg-black/40`}>
        {activeSlots.map((slot) => {
          const hasStream = Boolean(slot.activeStream?.embedUrl);
          const isAudioActive = activeAudioSlot === slot.slotId;

          return (
            <div
              key={slot.slotId}
              className={`relative rounded-xl border flex flex-col overflow-hidden bg-[#0a0a0e] shadow-xl transition-all ${
                isAudioActive
                  ? 'border-[rgb(var(--primary-color))] ring-1 ring-[rgb(var(--primary-color))]/50'
                  : 'border-white/10'
              }`}
            >
              {/* Tile Header */}
              <div className="h-10 px-3 bg-[#14141d] border-b border-white/10 flex items-center justify-between shrink-0 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-5 h-5 rounded-md bg-white/5 border border-white/10 flex items-center justify-center font-bold text-[10px] text-white/70">
                    {slot.slotId + 1}
                  </span>

                  {slot.match ? (
                    <button
                      type="button"
                      onClick={() => setPickingSlotId(slot.slotId)}
                      className="text-left font-bold text-white hover:text-cyan-400 truncate max-w-[150px] sm:max-w-[220px] transition-colors"
                      title="Click to switch match"
                    >
                      {slot.match.title}
                    </button>
                  ) : (
                    <span className="text-white/40 italic">Empty Slot</span>
                  )}
                </div>

                {/* Slot Actions */}
                <div className="flex items-center gap-1.5">
                  {slot.match && slot.availableStreams.length > 1 && (
                    <select
                      value={slot.activeStream?.embedUrl || ''}
                      onChange={(e) => {
                        const target = slot.availableStreams.find(s => s.embedUrl === e.target.value);
                        if (target) handleSelectStream(slot.slotId, target);
                      }}
                      className="bg-black/60 border border-white/15 rounded px-1.5 py-0.5 text-[10px] text-white/90 focus:outline-none"
                    >
                      {slot.availableStreams.map((st, i) => (
                        <option key={i} value={st.embedUrl} className="bg-zinc-900 text-white">
                          {st.source || `Server ${i + 1}`} {st.hd ? '· HD' : ''}
                        </option>
                      ))}
                    </select>
                  )}

                  {/* Sound routing indicator */}
                  {slot.match && hasStream && (
                    <button
                      type="button"
                      onClick={() => setActiveAudioSlot(slot.slotId)}
                      className={`p-1 rounded-md transition-colors ${
                        isAudioActive
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'text-white/40 hover:text-white/80'
                      }`}
                      title={isAudioActive ? 'Sound is focused on this feed' : 'Click to route sound focus here'}
                    >
                      {isAudioActive ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                    </button>
                  )}

                  {/* Reload Tile */}
                  {slot.match && (
                    <button
                      type="button"
                      onClick={() => handleReloadSlot(slot.slotId)}
                      className="p-1 text-white/50 hover:text-white transition-colors"
                      title="Reload this stream"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Popout tab */}
                  {hasStream && (
                    <a
                      href={slot.activeStream?.embedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1 text-white/50 hover:text-white transition-colors"
                      title="Open in new window"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}

                  {/* Close / Clear slot */}
                  {slot.match && (
                    <button
                      type="button"
                      onClick={() => handleRemoveSlot(slot.slotId)}
                      className="p-1 text-white/40 hover:text-rose-400 transition-colors"
                      title="Remove match"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Tile Stream Body */}
              <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
                {slot.isLoading ? (
                  <div className="flex flex-col items-center gap-2 p-4 text-center">
                    <span className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs text-white/60 font-mono">Connecting to satellite feed...</span>
                  </div>
                ) : hasStream ? (
                  <iframe
                    key={`${slot.activeStream?.embedUrl}-${slot.retryKey}`}
                    src={slot.activeStream?.embedUrl}
                    className="w-full h-full border-0 absolute inset-0 bg-black"
                    allowFullScreen
                    allow="autoplay; encrypted-media; fullscreen; picture-in-picture *"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-3 p-6 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/40">
                      <Trophy className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">No Stream Loaded</p>
                      <p className="text-xs text-white/50 mt-1 max-w-xs">
                        Pick a live football or sports match to stream simultaneously in this slot.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPickingSlotId(slot.slotId)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[rgb(var(--primary-color))] hover:brightness-110 text-white text-xs font-bold shadow-lg transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Select Match</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Match Picker Dialog */}
      {pickingSlotId !== null && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#12131c] border border-white/15 rounded-2xl w-full max-w-lg p-5 shadow-2xl flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Radio className="w-4 h-4 text-cyan-400" />
                <span>Select Match for Slot #{pickingSlotId + 1}</span>
              </h3>
              <button
                type="button"
                onClick={() => setPickingSlotId(null)}
                className="p-1 rounded-lg text-white/60 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search Input */}
            <div className="relative my-3">
              <Search className="w-4 h-4 absolute left-3 top-3 text-white/40" />
              <input
                type="text"
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                placeholder="Search teams or league..."
                className="w-full bg-black/50 border border-white/15 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-white/40 focus:outline-none focus:border-cyan-400 transition-colors"
                autoFocus
              />
            </div>

            {/* Match List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {filteredPickerMatches.length === 0 ? (
                <div className="py-8 text-center text-xs text-white/40">
                  No active or scheduled matches found matching "{pickerSearch}".
                </div>
              ) : (
                filteredPickerMatches.map(match => (
                  <button
                    key={match.id}
                    type="button"
                    onClick={() => {
                      loadStreamsForSlot(pickingSlotId, match);
                      setPickingSlotId(null);
                      setPickerSearch('');
                    }}
                    className="w-full text-left p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-cyan-500/40 transition-all flex items-center justify-between group"
                  >
                    <div className="min-w-0 pr-3">
                      <div className="text-xs font-bold text-white group-hover:text-cyan-300 truncate">
                        {match.title}
                      </div>
                      <div className="text-[11px] text-white/50 mt-0.5 truncate">
                        {match.competition || match.category} · {match.sources?.length || 0} feeds listed
                      </div>
                    </div>
                    <span className="shrink-0 px-2 py-1 rounded bg-cyan-500/10 text-cyan-400 text-[10px] font-bold border border-cyan-500/20">
                      Select
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

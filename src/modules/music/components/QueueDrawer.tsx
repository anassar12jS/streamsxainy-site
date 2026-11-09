import React from 'react';
import { X, Trash2, Play, Music2, Sparkles, Disc } from 'lucide-react';
import { useMusicPlayerStore } from '../store/useMusicPlayerStore';

export const QueueDrawer: React.FC = () => {
  const showQueue = useMusicPlayerStore(state => state.showQueue);
  const showLyrics = useMusicPlayerStore(state => state.showLyrics);
  const setShowQueue = useMusicPlayerStore(state => state.setShowQueue);
  const currentTrack = useMusicPlayerStore(state => state.currentTrack);
  const queue = useMusicPlayerStore(state => state.queue);
  const queueIndex = useMusicPlayerStore(state => state.queueIndex);
  const setTrack = useMusicPlayerStore(state => state.setTrack);
  const removeFromQueue = useMusicPlayerStore(state => state.removeFromQueue);
  const clearQueue = useMusicPlayerStore(state => state.clearQueue);
  const autoplayRadio = useMusicPlayerStore(state => state.autoplayRadio);
  const setAutoplayRadio = useMusicPlayerStore(state => state.setAutoplayRadio);

  // Guard: Never render duplicate slide-out drawer when full-screen immersive overlay is active
  if (!showQueue || showLyrics) return null;

  const upNextTracks = queue.slice(queueIndex + 1);

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[380px] bg-[#161618] border-l border-white/10 shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-250 select-none">
      
      {/* Top Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between bg-[#1a1a1c]">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-white tracking-tight">
            Playing Next
          </h3>
          <span className="text-[10px] font-mono font-bold text-white/50 bg-white/10 px-2 py-0.5 rounded-full">
            {queue.length} Tracks
          </span>
        </div>

        <div className="flex items-center gap-1">
          {queue.length > 1 && (
            <button
              onClick={clearQueue}
              className="px-2.5 py-1 text-xs text-white/50 hover:text-red-400 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
              title="Clear up next"
            >
              Clear
            </button>
          )}
          <button
            onClick={() => setShowQueue(false)}
            className="p-1.5 text-white/50 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            title="Close queue"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Autoplay similar songs (YouTube Music radio) */}
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between gap-3 bg-[#151517]">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-white">Autoplay similar songs</p>
          <p className="text-[11px] text-white/50">Keeps music going when your queue ends.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={autoplayRadio}
          onClick={() => setAutoplayRadio(!autoplayRadio)}
          className={`relative w-10 h-6 rounded-full transition-colors shrink-0 cursor-pointer ${autoplayRadio ? 'bg-emerald-500' : 'bg-white/15'}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${autoplayRadio ? 'translate-x-4' : ''}`} />
        </button>
      </div>

      {/* Queue Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 am-scrollbar">
        
        {/* Currently Playing Card */}
        {currentTrack && (
          <div className="space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#fa243c] font-mono">
              Now Playing
            </span>
            <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-[#fa243c]/10 border border-[#fa243c]/30">
              <img 
                src={currentTrack.artwork} 
                alt="" 
                className="w-12 h-12 rounded-xl object-cover shrink-0 shadow border border-white/10" 
              />
              <div className="min-w-0 flex-1">
                <h4 className="text-xs font-bold text-white truncate">
                  {currentTrack.title}
                </h4>
                <p className="text-[11px] text-white/60 truncate mt-0.5">
                  {currentTrack.artist}
                </p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#fa243c] animate-ping" />
                  <span className="text-[10px] font-mono font-semibold text-[#fa243c]">
                    Playing #{queueIndex + 1}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Up Next List */}
        <div className="space-y-2 pt-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-white/40 font-mono">
            Up Next ({upNextTracks.length})
          </span>

          {upNextTracks.length === 0 ? (
            <div className="py-12 text-center text-white/40 border border-dashed border-white/10 rounded-2xl p-6">
              <Disc className="w-8 h-8 text-white/20 mx-auto mb-2 animate-spin" />
              <p className="text-xs font-semibold text-white/70">End of queue</p>
              <p className="text-[11px] text-white/40 mt-0.5">
                Add songs or play an album to populate your queue.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {upNextTracks.map((track, i) => {
                const actualQueueIdx = queueIndex + 1 + i;
                return (
                  <div
                    key={`${track.id}-${actualQueueIdx}`}
                    onClick={() => setTrack(track)}
                    className="group flex items-center justify-between gap-3 p-2 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/5 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <img 
                        src={track.artwork} 
                        alt="" 
                        className="w-9 h-9 rounded-lg object-cover shrink-0 shadow-sm border border-white/5" 
                      />
                      <div className="min-w-0 flex-1">
                        <h5 className="text-xs font-semibold text-white/90 group-hover:text-white truncate">
                          {track.title}
                        </h5>
                        <p className="text-[11px] text-white/50 truncate">
                          {track.artist}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFromQueue(actualQueueIdx);
                      }}
                      className="p-1.5 text-white/30 hover:text-red-400 rounded-lg hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      title="Remove from queue"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-white/10 text-[10px] text-white/40 text-center bg-[#121214]">
        BitChord Seamless Queue Timeline
      </div>

    </div>
  );
};

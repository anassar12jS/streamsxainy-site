import React, { useState } from 'react';
import { Infinity as InfinityIcon, MoreHorizontal, Play, X, Trash2, ListMusic } from 'lucide-react';
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

  const [showMenu, setShowMenu] = useState(false);

  // Guard: Never render duplicate slide-out drawer when full-screen immersive overlay is active
  if (!showQueue || showLyrics) return null;

  const upNextTracks = queue.slice(queueIndex + 1);

  const formatDuration = (secs: number) => {
    if (!secs || isNaN(secs) || secs <= 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const playingFrom = currentTrack?.album 
    ? currentTrack.album 
    : 'Library';

  return (
    <aside 
      className="fixed lg:relative inset-y-0 right-0 z-40 w-[300px] sm:w-[320px] shrink-0 h-full bg-[#141416]/98 lg:bg-[#141416] border-l border-white/[0.08] flex flex-col justify-between animate-in slide-in-from-right duration-200 select-none shadow-2xl lg:shadow-none"
      style={{ fontFamily: 'var(--bitchord-font)' }}
    >
      {/* ======================================================================= */}
      {/* 1. TOP HEADER: Up Next | Infinity (Autoplay) | ... Menu                */}
      {/* ======================================================================= */}
      <div className="px-5 pt-5 pb-3 shrink-0">
        <div className="flex items-center justify-between">
          <h3 className="text-[17px] font-bold text-white tracking-tight">
            Up Next
          </h3>

          <div className="flex items-center gap-1.5 relative">
            {/* Autoplay Infinity Toggle */}
            <button
              type="button"
              onClick={() => setAutoplayRadio(!autoplayRadio)}
              className={`p-1 rounded-md transition-colors cursor-pointer ${
                autoplayRadio 
                  ? 'text-white bg-white/10' 
                  : 'text-[#666666] hover:text-white'
              }`}
              title={autoplayRadio ? 'Autoplay is on' : 'Turn on autoplay'}
            >
              <InfinityIcon className="w-4 h-4 stroke-[2.5]" />
            </button>

            {/* Three Dots More Options */}
            <button
              type="button"
              onClick={() => setShowMenu(!showMenu)}
              className="p-1 text-[#98989d] hover:text-white rounded-md transition-colors cursor-pointer"
              title="More options"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {/* Options Dropdown Menu */}
            {showMenu && (
              <div 
                className="absolute right-0 top-full mt-1 w-44 bg-[#202024] border border-white/10 rounded-xl shadow-2xl p-1 z-50 text-xs animate-in fade-in zoom-in-95"
                onMouseLeave={() => setShowMenu(false)}
              >
                {upNextTracks.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      clearQueue();
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 text-white/90 hover:text-white flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear Up Next</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setShowQueue(false);
                    setShowMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Close Panel</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Subtitle: Playing from [context] */}
        <p className="text-[12px] text-[#98989d] truncate mt-0.5 font-normal">
          Playing from {playingFrom}
        </p>
      </div>

      {/* ======================================================================= */}
      {/* 2. TRACK LIST: Clean, Compact Borderless Rows with Square Art           */}
      {/* ======================================================================= */}
      <div 
        className="flex-1 overflow-y-auto px-3 py-1 space-y-0.5 am-scrollbar"
        style={{ paddingBottom: '90px' }}
      >
        {upNextTracks.length === 0 ? (
          <div className="py-16 text-center text-[#777777] px-4 space-y-2">
            <ListMusic className="w-8 h-8 text-[#555555] mx-auto mb-1" />
            <p className="text-xs font-semibold text-white/80">Queue is empty</p>
            <p className="text-[11px] text-[#888888]">
              {autoplayRadio 
                ? 'Similar tracks will load automatically as this song finishes.' 
                : 'Turn on autoplay or click a playlist to add tracks.'}
            </p>
          </div>
        ) : (
          upNextTracks.map((track, i) => {
            const actualQueueIdx = queueIndex + 1 + i;
            return (
              <div
                key={`${track.id}-${actualQueueIdx}`}
                onClick={() => setTrack(track)}
                className="group flex items-center justify-between px-2 py-1.5 rounded-[6px] hover:bg-white/[0.07] transition-colors cursor-pointer select-none"
              >
                {/* Artwork + Title/Artist */}
                <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                  <div className="relative w-[38px] h-[38px] rounded-[6px] overflow-hidden bg-[#242426] shrink-0 border border-white/5">
                    <img 
                      src={track.artwork} 
                      alt="" 
                      className="w-full h-full object-cover" 
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Play className="w-3.5 h-3.5 fill-white text-white ml-0.5" />
                    </div>
                  </div>

                  <div className="min-w-0 flex-1 text-left">
                    <h5 className="text-[13px] font-semibold text-white truncate text-left leading-tight group-hover:text-white">
                      {track.title}
                    </h5>
                    <p className="text-[11px] text-[#98989d] truncate text-left leading-tight mt-0.5 font-normal">
                      {track.artist}
                    </p>
                  </div>
                </div>

                {/* Duration & Hover Delete */}
                <div className="shrink-0 flex items-center justify-end min-w-[36px]">
                  <span className="text-[11px] text-[#98989d] font-normal group-hover:hidden">
                    {formatDuration(track.duration)}
                  </span>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFromQueue(actualQueueIdx);
                    }}
                    className="hidden group-hover:flex p-1 text-[#98989d] hover:text-white transition-colors cursor-pointer"
                    title="Remove from Up Next"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

    </aside>
  );
};

export default QueueDrawer;


import React, { useState } from 'react';
import { Infinity as InfinityIcon, MoreHorizontal, Play, X, Trash2, ListMusic } from 'lucide-react';
import { useMusicPlayerStore } from '../store/useMusicPlayerStore';

export const QueueDrawer: React.FC = () => {
  const showQueue = useMusicPlayerStore(state => state.showQueue);
  const showLyrics = useMusicPlayerStore(state => state.showLyrics);
  const setShowLyrics = useMusicPlayerStore(state => state.setShowLyrics);
  const setShowQueue = useMusicPlayerStore(state => state.setShowQueue);
  const currentTrack = useMusicPlayerStore(state => state.currentTrack);
  const queue = useMusicPlayerStore(state => state.queue);
  const queueIndex = useMusicPlayerStore(state => state.queueIndex);
  const setTrack = useMusicPlayerStore(state => state.setTrack);
  const removeFromQueue = useMusicPlayerStore(state => state.removeFromQueue);
  const clearQueue = useMusicPlayerStore(state => state.clearQueue);
  const autoplayRadio = useMusicPlayerStore(state => state.autoplayRadio);
  const setAutoplayRadio = useMusicPlayerStore(state => state.setAutoplayRadio);
  const playbackStatus = useMusicPlayerStore(state => state.playbackStatus);
  const currentTime = useMusicPlayerStore(state => state.currentTime);
  const duration = useMusicPlayerStore(state => state.duration);

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

  const formatTotal = (tracks: typeof queue) => {
    const total = tracks.reduce((sum, t) => sum + (t.duration || 0), 0);
    if (!total) return '';
    const h = Math.floor(total / 3600);
    const m = Math.round((total % 3600) / 60);
    return h > 0 ? `${h} hr ${m} min` : `${m} min`;
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
      {/* 1. TOP HEADER: "Up next" on left + "Clear" in Apple red on right         */}
      {/* ======================================================================= */}
      <div className="px-5 pt-5 pb-3 shrink-0 border-b border-white/[0.06]">
        <div className="flex items-center justify-between">
          <h3 className="text-[20px] font-bold text-white tracking-tight">
            Up next
          </h3>

          <div className="flex items-center gap-3">
            {upNextTracks.length > 0 && (
              <button
                type="button"
                onClick={clearQueue}
                className="text-[14px] font-semibold text-[#ff453a] hover:text-[#ff6961] cursor-pointer transition-colors"
              >
                Clear
              </button>
            )}

            {/* Autoplay Infinity Toggle */}
            <button
              type="button"
              onClick={() => setAutoplayRadio(!autoplayRadio)}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                autoplayRadio 
                  ? 'text-white bg-white/15' 
                  : 'text-[#666666] hover:text-white'
              }`}
              title={autoplayRadio ? 'Autoplay is on' : 'Turn on autoplay'}
            >
              <InfinityIcon className="w-4 h-4 stroke-[2.2]" />
            </button>

            {/* Close Drawer Button */}
            <button
              type="button"
              onClick={() => setShowQueue(false)}
              className="p-1.5 text-[#98989d] hover:text-white rounded-lg transition-colors cursor-pointer"
              title="Close Queue"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Subtitle: Playing from [context] · N songs · total time */}
        <p className="text-[12px] text-[#98989d] truncate mt-1 font-normal">
          Playing from {playingFrom}
          {upNextTracks.length > 0 && (
            <span className="text-[#666666]">
              {' '}· {upNextTracks.length} song{upNextTracks.length === 1 ? '' : 's'} · {formatTotal(upNextTracks)}
            </span>
          )}
        </p>
      </div>

      {/* Now Playing card */}
      {currentTrack && (
        <button
          type="button"
          onClick={() => setShowLyrics(true)}
          className="mx-3 mt-3 shrink-0 w-[calc(100%-1.5rem)] text-left rounded-2xl bg-white/[0.06] hover:bg-white/[0.09] border border-white/[0.08] p-3 flex items-center gap-3 transition-colors cursor-pointer group"
          title="Open fullscreen player"
        >
          <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-[#242426] shrink-0 border border-white/10">
            <img src={currentTrack.artwork} alt="" className="w-full h-full object-cover" />
            {playbackStatus === 'playing' && (
              <div className="absolute inset-0 bg-black/45 flex items-center justify-center">
                <span className="eq-bars text-white" style={{ height: 14 }}><i /><i /><i /></span>
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#ff8093] mb-0.5">Now Playing</p>
            <p className="text-[14px] font-semibold text-white truncate leading-tight">{currentTrack.title}</p>
            <p className="text-[12px] text-[#98989d] truncate leading-tight mt-0.5">{currentTrack.artist}</p>
            {/* Mini progress */}
            <div className="mt-1.5 h-[3px] bg-white/15 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-[width] duration-300"
                style={{ width: `${duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0}%` }}
              />
            </div>
          </div>
          <Play className="w-4 h-4 text-white/40 group-hover:text-white shrink-0 transition-colors" />
        </button>
      )}

      {/* ======================================================================= */}
      {/* 2. TRACK LIST: Clean Apple Music Rows Matching Image 2                  */}
      {/* ======================================================================= */}
      <div 
        className="flex-1 overflow-y-auto px-3 py-2 space-y-1 am-scrollbar"
        style={{ paddingBottom: '110px' }}
      >
        {upNextTracks.length === 0 ? (
          <div className="py-20 text-center text-[#777777] px-4 space-y-2">
            <ListMusic className="w-9 h-9 text-[#555555] mx-auto mb-1" />
            <p className="text-sm font-semibold text-white/90">Queue is empty</p>
            <p className="text-xs text-[#888888] max-w-[220px] mx-auto">
              {autoplayRadio 
                ? 'Similar tracks will load automatically as this song finishes.' 
                : 'Turn on autoplay or click a playlist to queue tracks.'}
            </p>
          </div>
        ) : (
          upNextTracks.map((track, i) => {
            const actualQueueIdx = queueIndex + 1 + i;
            return (
              <div
                key={`${track.id}-${actualQueueIdx}`}
                onClick={() => setTrack(track)}
                className="group flex items-center justify-between p-2 rounded-xl hover:bg-white/[0.08] transition-colors cursor-pointer select-none"
              >
                {/* Artwork + Title/Artist */}
                <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                  <div className="relative w-11 h-11 rounded-[8px] overflow-hidden bg-[#242426] shrink-0 border border-white/5">
                    <img 
                      src={track.artwork} 
                      alt="" 
                      className="w-full h-full object-cover" 
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Play className="w-4 h-4 fill-white text-white ml-0.5" />
                    </div>
                  </div>

                  <div className="min-w-0 flex-1 text-left">
                    <h5 className="text-[14px] font-semibold text-white truncate text-left leading-tight">
                      {track.title}
                    </h5>
                    <p className="text-[12px] text-[#98989d] truncate text-left leading-tight mt-0.5 font-normal">
                      {track.artist}
                    </p>
                  </div>
                </div>

                {/* Duration & Remove Button (Matching Image 2) */}
                <div className="shrink-0 flex items-center justify-end gap-2 min-w-[44px]">
                  <span className="text-[12px] text-[#8e8e93] font-mono group-hover:hidden">
                    {formatDuration(track.duration)}
                  </span>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFromQueue(actualQueueIdx);
                    }}
                    className="hidden group-hover:flex p-1.5 text-[#ff453a] hover:text-[#ff6961] transition-colors cursor-pointer"
                    title="Remove from Up Next"
                  >
                    <Trash2 className="w-4 h-4" />
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


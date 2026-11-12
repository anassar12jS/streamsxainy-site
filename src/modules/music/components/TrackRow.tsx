import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Play, Pause, Heart, MoreHorizontal, Plus, Disc, Loader2 } from 'lucide-react';
import { MusicTrack } from '../types';
import { useMusicPlayerStore } from '../store/useMusicPlayerStore';

interface TrackRowProps {
  track: MusicTrack;
  index?: number;
  showArtwork?: boolean;
  showAlbum?: boolean;
  playlistContext?: MusicTrack[];
}

export const TrackRow: React.FC<TrackRowProps> = ({
  track,
  index,
  showArtwork = true,
  showAlbum = true,
  playlistContext,
}) => {
  const currentTrack = useMusicPlayerStore(state => state.currentTrack);
  const playbackStatus = useMusicPlayerStore(state => state.playbackStatus);
  const playTrack = useMusicPlayerStore(state => state.playTrack);
  const togglePlayPause = useMusicPlayerStore(state => state.togglePlayPause);
  const toggleLike = useMusicPlayerStore(state => state.toggleLike);
  const isLiked = useMusicPlayerStore(state => state.isLiked(track.id));
  const addToQueue = useMusicPlayerStore(state => state.addToQueue);

  const [showMenu, setShowMenu] = useState(false);

  const isCurrent = currentTrack?.id === track.id;
  const isPlaying = isCurrent && playbackStatus === 'playing';
  const isLoading = isCurrent && playbackStatus === 'loading';

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isCurrent) {
      if (playbackStatus === 'playing') {
        togglePlayPause();
      } else {
        playTrack(track, playlistContext);
      }
    } else {
      playTrack(track, playlistContext);
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs <= 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div
      onClick={handlePlayClick}
      className={`group grid grid-cols-12 items-center px-3 sm:px-4 py-2 rounded-[6px] transition-colors duration-150 cursor-pointer select-none relative ${
        isCurrent
          ? 'bg-white/[0.08] text-white'
          : 'hover:bg-white/[0.04] text-white/90'
      }`}
      style={{ fontFamily: 'var(--bitchord-font)' }}
    >
      {/* 1. Song Column (Cover + Title) */}
      <div className="col-span-12 sm:col-span-6 md:col-span-5 flex items-center gap-3 min-w-0 pr-2">
        {/* Play indicator / Index */}
        <div className="w-5 text-center flex items-center justify-center shrink-0">
          {isLoading ? (
            <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
          ) : isPlaying ? (
            <div className="flex items-end justify-center gap-0.5 h-3.5 w-3.5">
              <span className="w-0.5 bg-white h-2.5 animate-pulse rounded-full" />
              <span className="w-0.5 bg-white h-3.5 animate-bounce rounded-full" />
              <span className="w-0.5 bg-white h-2 animate-pulse rounded-full" />
            </div>
          ) : (
            <>
              <span className={`text-xs font-normal group-hover:hidden ${isCurrent ? 'text-white font-semibold' : 'text-[#777777]'}`}>
                {index !== undefined ? index + 1 : ''}
              </span>
              <button
                type="button"
                onClick={handlePlayClick}
                className="hidden group-hover:flex items-center justify-center text-white cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current text-white ml-0.5" />
              </button>
            </>
          )}
        </div>

        {/* Artwork Thumbnail */}
        {showArtwork && (
          <div className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-[6px] overflow-hidden shrink-0 shadow bg-black/40 border border-white/5">
            <img 
              src={track.artwork} 
              alt="" 
              loading="lazy" 
              decoding="async" 
              className="w-full h-full object-cover" 
            />
            {track.isLive && (
              <span className="absolute bottom-0.5 right-0.5 w-2 h-2 rounded-full bg-emerald-400 ring-1 ring-black" />
            )}
          </div>
        )}

        {/* Track Title */}
        <div className="min-w-0 flex-1 text-left flex items-center gap-1.5">
          <h4 className="text-[13px] sm:text-[14px] font-medium text-white truncate text-left">
            {track.title}
          </h4>
          {track.isExplicit && (
            <span className="px-1 py-0.2 rounded bg-white/20 text-[9px] font-mono font-bold text-white/90 shrink-0">
              E
            </span>
          )}
          {track.isLive && (
            <span className="px-1.5 py-0.2 rounded bg-white/15 text-white/90 text-[9px] font-mono font-bold border border-white/20 shrink-0">
              LIVE
            </span>
          )}
        </div>
      </div>

      {/* 2. Artist Column */}
      <div className="hidden sm:block sm:col-span-3 md:col-span-3 text-left truncate pr-2">
        <p className="text-[13px] text-[#98989d] hover:text-white truncate font-normal">
          {track.artistId ? (
            <Link
              to={`/music/artist/${track.artistId}`}
              onClick={(e) => e.stopPropagation()}
              className="hover:underline transition-colors"
            >
              {track.artist}
            </Link>
          ) : (
            <span>{track.artist}</span>
          )}
        </p>
      </div>

      {/* 3. Album Column */}
      <div className="hidden md:block md:col-span-3 text-left truncate pr-2">
        <p className="text-[13px] text-[#98989d] hover:text-white truncate font-normal">
          {track.album && (
            track.albumId ? (
              <Link
                to={`/music/album/${track.albumId}`}
                onClick={(e) => e.stopPropagation()}
                className="hover:underline transition-colors"
              >
                {track.album}
              </Link>
            ) : (
              <span>{track.album}</span>
            )
          )}
        </p>
      </div>

      {/* 4. Duration & Actions Column */}
      <div className="hidden sm:flex sm:col-span-3 md:col-span-1 items-center justify-end gap-2 text-right">
        <span className="text-[12px] text-[#98989d] font-normal font-mono">
          {track.isLive ? 'LIVE' : formatTime(track.duration)}
        </span>

        {/* More Actions Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="p-1.5 text-white/30 hover:text-white rounded-lg hover:bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            title="More Options"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {showMenu && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 top-full mt-1 w-44 bg-[#1e1e20] border border-white/10 rounded-2xl shadow-2xl z-30 p-1.5 text-xs animate-in fade-in"
            >
              <button
                type="button"
                onClick={() => {
                  addToQueue(track, true);
                  setShowMenu(false);
                }}
                className="w-full text-left px-3 py-2 rounded-xl hover:bg-white/10 flex items-center gap-2 text-white/80 hover:text-white cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Play Next</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  addToQueue(track, false);
                  setShowMenu(false);
                }}
                className="w-full text-left px-3 py-2 rounded-xl hover:bg-white/10 flex items-center gap-2 text-white/80 hover:text-white cursor-pointer"
              >
                <Disc className="w-3.5 h-3.5" />
                <span>Add to Queue</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

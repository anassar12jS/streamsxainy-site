import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Play, Pause, Heart, MoreHorizontal, Plus, Disc } from 'lucide-react';
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
      className={`group flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-colors duration-150 cursor-pointer select-none relative ${
        isCurrent
          ? 'bg-[rgba(255,255,255,0.08)] text-white'
          : 'hover:bg-[#1a1a1a] text-white/90'
      }`}
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      {/* Left: Index / Play Button & Title */}
      <div className="flex items-center gap-3.5 min-w-0 flex-1">
        
        {/* Track Number / Play Indicator */}
        <div className="w-6 text-center flex items-center justify-center shrink-0">
          {isPlaying ? (
            <div className="flex items-end justify-center gap-0.5 h-4 w-4">
              <span className="w-1 bg-white h-3 animate-pulse rounded-full" />
              <span className="w-1 bg-white h-4 animate-bounce rounded-full" />
              <span className="w-1 bg-white h-2 animate-pulse rounded-full" />
            </div>
          ) : (
            <>
              <span className={`text-xs font-medium group-hover:hidden ${isCurrent ? 'text-rose-400 font-bold' : 'text-[#b3b3b3]'}`}>
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
          <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0 shadow bg-black/40 border border-white/5">
            <img src={track.artwork} alt="" className="w-full h-full object-cover" />
            {track.isLive && (
              <span className="absolute bottom-0.5 right-0.5 w-2 h-2 rounded-full bg-emerald-400 ring-1 ring-black" />
            )}
          </div>
        )}

        {/* Track Title + Artist Link */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className={`text-sm font-semibold truncate ${isCurrent ? 'text-rose-400' : 'text-white'}`}>
              {track.title}
            </h4>
            {track.isExplicit && (
              <span className="px-1 py-0.2 rounded bg-white/20 text-[9px] font-mono font-bold text-white/90">
                E
              </span>
            )}
            {track.isLive && (
              <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 text-[9px] font-mono font-bold border border-rose-500/30">
                LIVE
              </span>
            )}
          </div>
          <p className="text-xs text-[#b3b3b3] truncate mt-0.5">
            <Link
              to={`/music/artist/${encodeURIComponent(track.artistId || track.artist)}`}
              onClick={(e) => e.stopPropagation()}
              className="hover:text-white hover:underline transition-colors"
            >
              {track.artist}
            </Link>
          </p>
        </div>
      </div>

      {/* Center: Album Link */}
      {showAlbum && (
        <div className="hidden md:block w-1/4 px-4 truncate text-xs text-[#b3b3b3]">
          {track.album && (
            <Link
              to={`/music/album/${encodeURIComponent(track.albumId || track.album)}`}
              onClick={(e) => e.stopPropagation()}
              className="hover:text-white hover:underline transition-colors"
            >
              {track.album}
            </Link>
          )}
        </div>
      )}

      {/* Right: Heart + Duration + Actions */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleLike(track.id);
          }}
          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
            isLiked ? 'text-amber-400' : 'text-white/30 hover:text-white opacity-0 group-hover:opacity-100'
          }`}
          title={isLiked ? 'Unlike' : 'Like'}
        >
          <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
        </button>

        <span className="text-xs font-mono text-[#b3b3b3] w-11 text-right">
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

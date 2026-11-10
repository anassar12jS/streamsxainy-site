import React, { useState, useEffect, useRef } from 'react';
import { 
  Shuffle, SkipBack, Play, Pause, SkipForward, Repeat, Repeat1,
  Star, MoreHorizontal, MessageSquareQuote, List, Volume2, VolumeX,
  Loader2, Menu, Plus, Disc, User, Compass, Share2, Check
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useMusicPlayerStore } from '../store/useMusicPlayerStore';
import { resolveArtistId, resolveAlbumId } from '../api/innertube';

interface FloatingPlayerProps {
  onToggleMobileSidebar?: () => void;
  onSeek: (seconds: number) => void;
}

export const FloatingPlayer: React.FC<FloatingPlayerProps> = ({
  onToggleMobileSidebar,
  onSeek,
}) => {
  const navigate = useNavigate();
  const [resolving, setResolving] = useState<'artist' | 'album' | null>(null);
  const currentTrack = useMusicPlayerStore(state => state.currentTrack);
  const playbackStatus = useMusicPlayerStore(state => state.playbackStatus);
  const currentTime = useMusicPlayerStore(state => state.currentTime);
  const duration = useMusicPlayerStore(state => state.duration);
  const volume = useMusicPlayerStore(state => state.volume);
  const isMuted = useMusicPlayerStore(state => state.isMuted);
  const shuffle = useMusicPlayerStore(state => state.shuffle);
  const repeatMode = useMusicPlayerStore(state => state.repeatMode);
  const showLyrics = useMusicPlayerStore(state => state.showLyrics);
  const showQueue = useMusicPlayerStore(state => state.showQueue);
  const likedTrackIds = useMusicPlayerStore(state => state.likedTrackIds);

  const togglePlayPause = useMusicPlayerStore(state => state.togglePlayPause);
  const nextTrack = useMusicPlayerStore(state => state.nextTrack);
  const prevTrack = useMusicPlayerStore(state => state.prevTrack);
  const setVolume = useMusicPlayerStore(state => state.setVolume);
  const toggleMute = useMusicPlayerStore(state => state.toggleMute);
  const toggleShuffle = useMusicPlayerStore(state => state.toggleShuffle);
  const cycleRepeat = useMusicPlayerStore(state => state.cycleRepeat);
  const toggleLyrics = useMusicPlayerStore(state => state.toggleLyrics);
  const toggleQueue = useMusicPlayerStore(state => state.toggleQueue);
  const toggleLike = useMusicPlayerStore(state => state.toggleLike);
  const addToQueue = useMusicPlayerStore(state => state.addToQueue);

  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showMoreMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMoreMenu]);

  const isPlaying = playbackStatus === 'playing';
  const isLoading = playbackStatus === 'loading';
  const isLiked = currentTrack ? likedTrackIds.includes(currentTrack.id) : false;

  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs <= 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleScrubberClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration || duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    onSeek(ratio * duration);
  };

  const openArtist = async () => {
    if (!currentTrack || resolving) return;
    setResolving('artist');
    try {
      const id = await resolveArtistId(currentTrack);
      if (id) navigate(`/music/artist/${id}`);
    } finally {
      setResolving(null);
    }
  };

  const openAlbum = async () => {
    if (!currentTrack || resolving) return;
    setResolving('album');
    try {
      const id = await resolveAlbumId(currentTrack);
      if (id) navigate(`/music/album/${id}`);
    } finally {
      setResolving(null);
    }
  };

  return (
    <>
      {/* BitChord Apple Music Authentic Floating Player Pill */}
      <div 
        className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 max-w-[860px] w-[96vw] sm:w-auto"
        style={{ fontFamily: 'var(--bitchord-font)' }}
      >
        <div 
          className="bitchord-floating-pill rounded-full px-4 sm:px-5 py-2 flex items-center justify-between gap-3 sm:gap-5 select-none transition-all shadow-[0_20px_50px_rgba(0,0,0,0.85)] border border-white/15"
        >
          {/* ========================================================================= */}
          {/* 1. LEFT: Transport Controls                                               */}
          {/* ========================================================================= */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0 text-[#98989d]">
            {/* Shuffle */}
            <button
              type="button"
              onClick={toggleShuffle}
              className={`p-1.5 rounded-full transition-colors cursor-pointer hidden sm:block ${
                shuffle ? 'text-white' : 'hover:text-white'
              }`}
              title={shuffle ? 'Shuffle On' : 'Shuffle Off'}
            >
              <Shuffle className="w-3.5 h-3.5" />
            </button>

            {/* Previous */}
            <button
              type="button"
              onClick={prevTrack}
              className="p-1.5 rounded-full hover:text-white transition-colors cursor-pointer"
              title="Previous Track"
            >
              <SkipBack className="w-4 h-4 fill-current" />
            </button>

            {/* Play / Pause / Loading Button */}
            <button
              type="button"
              onClick={togglePlayPause}
              disabled={isLoading}
              className="p-1 text-white hover:scale-105 active:scale-95 transition-transform cursor-pointer relative"
              title={isLoading ? 'Loading song...' : isPlaying ? 'Pause' : 'Play'}
            >
              {isLoading ? (
                <div className="w-7 h-7 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                </div>
              ) : isPlaying ? (
                <div className="w-7 h-7 flex items-center justify-center">
                  <Pause className="w-5 h-5 fill-current" />
                </div>
              ) : (
                <div className="w-7 h-7 flex items-center justify-center">
                  <Play className="w-5 h-5 fill-current ml-0.5" />
                </div>
              )}
            </button>

            {/* Next */}
            <button
              type="button"
              onClick={nextTrack}
              className="p-1.5 rounded-full hover:text-white transition-colors cursor-pointer"
              title="Next Track"
            >
              <SkipForward className="w-4 h-4 fill-current" />
            </button>

            {/* Repeat */}
            <button
              type="button"
              onClick={cycleRepeat}
              className={`p-1.5 rounded-full transition-colors cursor-pointer hidden sm:block ${
                repeatMode !== 'off' ? 'text-white' : 'hover:text-white'
              }`}
              title={`Repeat: ${repeatMode}`}
            >
              {repeatMode === 'one' ? (
                <Repeat1 className="w-3.5 h-3.5" />
              ) : (
                <Repeat className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          {/* ========================================================================= */}
          {/* 2. CENTER: Artwork (~6px radius) + Title/Artist + Scrubber               */}
          {/* ========================================================================= */}
          <div className="flex items-center gap-3 min-w-0 flex-1 sm:flex-initial">
            {currentTrack ? (
              <div className="relative flex items-center gap-3 min-w-0 pb-1">
                <img 
                  src={currentTrack.artwork} 
                  alt="" 
                  onClick={openAlbum}
                  className="w-10 h-10 rounded-[6px] object-cover shrink-0 shadow-md border border-white/10 cursor-pointer hover:opacity-85 transition-opacity" 
                />
                
                <div className="min-w-0 flex flex-col justify-center items-start pr-1">
                  <button
                    type="button"
                    onClick={openAlbum}
                    title="Go to album"
                    className="text-[13px] font-semibold text-white truncate max-w-[130px] sm:max-w-[190px] hover:underline text-left cursor-pointer"
                  >
                    {currentTrack.title}
                  </button>
                  <button
                    type="button"
                    onClick={openArtist}
                    title="Go to artist"
                    className="text-[11px] text-[#98989d] hover:text-white hover:underline truncate max-w-[130px] sm:max-w-[190px] text-left cursor-pointer"
                  >
                    {resolving ? 'Opening…' : currentTrack.artist}
                  </button>
                </div>

                {/* Micro Scrubber */}
                <div 
                  onClick={handleScrubberClick}
                  className="absolute bottom-0 left-0 right-0 h-[2.5px] hover:h-[4.5px] bg-white/15 rounded-full cursor-pointer transition-all overflow-hidden"
                  title="Seek"
                >
                  <div 
                    className="h-full bg-white rounded-full transition-all"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-[#98989d] px-2">
                <span>Select a song to play</span>
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* 3. RIGHT: Star, More, Lyrics, Queue, Inline Volume Slider                 */}
          {/* ========================================================================= */}
          <div className="relative flex items-center gap-1 sm:gap-2 shrink-0 text-[#98989d]">
            {/* Star Favorite */}
            <button
              type="button"
              onClick={() => currentTrack && toggleLike(currentTrack.id)}
              className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                isLiked ? 'text-amber-400' : 'hover:text-white'
              }`}
              title={isLiked ? 'Starred' : 'Add to favorites'}
            >
              <Star className={`w-3.5 h-3.5 ${isLiked ? 'fill-current' : ''}`} />
            </button>

            {/* Three Dots More */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (currentTrack) {
                  setShowMoreMenu(prev => !prev);
                }
              }}
              disabled={!currentTrack}
              className={`p-1.5 rounded-full transition-colors cursor-pointer hidden sm:block ${
                showMoreMenu ? 'text-white bg-white/20' : 'hover:text-white'
              } ${!currentTrack ? 'opacity-40 cursor-not-allowed' : ''}`}
              title="More options"
              aria-label="More options"
              aria-expanded={showMoreMenu}
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>

            {/* Apple Music Context Menu Popover */}
            {showMoreMenu && currentTrack && (
              <div 
                ref={moreMenuRef}
                onClick={(e) => e.stopPropagation()}
                className="absolute bottom-full left-0 sm:left-4 mb-3 w-56 bg-[#1e1e20]/95 backdrop-blur-2xl border border-white/15 rounded-2xl shadow-[0_16px_40px_rgba(0,0,0,0.85)] p-1.5 z-50 text-xs animate-in fade-in slide-in-from-bottom-2 duration-150 select-none"
              >
                {/* Mini track header */}
                <div className="px-2.5 py-2 border-b border-white/10 mb-1 flex items-center gap-2.5">
                  <img
                    src={currentTrack.artwork || '/default_cover.png'}
                    alt={currentTrack.title}
                    className="w-8 h-8 rounded-lg object-cover shrink-0 shadow-md border border-white/10"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-white text-xs font-semibold truncate leading-tight">{currentTrack.title}</p>
                    <p className="text-white/60 text-[11px] truncate leading-tight mt-0.5">{currentTrack.artist}</p>
                  </div>
                </div>

                {/* Queue Controls */}
                <button
                  type="button"
                  onClick={() => {
                    addToQueue(currentTrack, true);
                    setShowMoreMenu(false);
                  }}
                  className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-white/10 flex items-center gap-2.5 text-white/90 hover:text-white cursor-pointer transition-colors"
                >
                  <Plus className="w-3.5 h-3.5 text-white/70" />
                  <span>Play Next</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    addToQueue(currentTrack, false);
                    setShowMoreMenu(false);
                  }}
                  className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-white/10 flex items-center gap-2.5 text-white/90 hover:text-white cursor-pointer transition-colors"
                >
                  <Disc className="w-3.5 h-3.5 text-white/70" />
                  <span>Add to Queue</span>
                </button>

                <div className="my-1 border-t border-white/10" />

                {/* Actions */}
                <button
                  type="button"
                  onClick={() => {
                    toggleLike(currentTrack.id);
                    setShowMoreMenu(false);
                  }}
                  className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-white/10 flex items-center gap-2.5 text-white/90 hover:text-white cursor-pointer transition-colors"
                >
                  <Star className={`w-3.5 h-3.5 ${isLiked ? 'text-amber-400 fill-amber-400' : 'text-white/70'}`} />
                  <span>{isLiked ? 'Remove from Favorites' : 'Favorite'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowMoreMenu(false);
                    openArtist();
                  }}
                  className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-white/10 flex items-center gap-2.5 text-white/90 hover:text-white cursor-pointer transition-colors"
                >
                  <User className="w-3.5 h-3.5 text-white/70" />
                  <span className="truncate">Go to Artist</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowMoreMenu(false);
                    openAlbum();
                  }}
                  className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-white/10 flex items-center gap-2.5 text-white/90 hover:text-white cursor-pointer transition-colors"
                >
                  <Compass className="w-3.5 h-3.5 text-white/70" />
                  <span className="truncate">Go to Album</span>
                </button>

                <div className="my-1 border-t border-white/10" />

                <button
                  type="button"
                  onClick={() => {
                    try {
                      navigator.clipboard.writeText(
                        window.location.origin + `/music?track=${encodeURIComponent(currentTrack.id)}`
                      );
                      setCopied(true);
                      setTimeout(() => {
                        setCopied(false);
                        setShowMoreMenu(false);
                      }, 1000);
                    } catch {
                      setShowMoreMenu(false);
                    }
                  }}
                  className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-white/10 flex items-center gap-2.5 text-white/90 hover:text-white cursor-pointer transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5 text-white/70" />}
                  <span>{copied ? 'Link Copied!' : 'Share Track'}</span>
                </button>
              </div>
            )}

            {/* Synced Lyrics Toggle (Quote / Message) */}
            <button
              type="button"
              onClick={toggleLyrics}
              className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                showLyrics ? 'text-white bg-white/15' : 'hover:text-white'
              }`}
              title="Lyrics"
            >
              <MessageSquareQuote className="w-4 h-4" />
            </button>

            {/* Up Next Queue Toggle (List) */}
            <button
              type="button"
              onClick={toggleQueue}
              className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                showQueue ? 'text-white bg-white/15' : 'hover:text-white'
              }`}
              title="Queue"
            >
              <List className="w-4 h-4" />
            </button>

            {/* Inline Volume Control (Apple Music Desktop Style) */}
            <div className="flex items-center gap-1.5 pl-1">
              <button
                type="button"
                onClick={toggleMute}
                className="p-1 rounded-full hover:text-white transition-colors cursor-pointer"
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-3.5 h-3.5 text-white/40" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={isMuted ? 0 : volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="w-16 sm:w-20 h-1 bg-white/20 accent-white rounded-full appearance-none cursor-pointer hidden sm:block"
                aria-label="Volume"
              />
            </div>

          </div>

        </div>
      </div>
    </>
  );
};

export default FloatingPlayer;


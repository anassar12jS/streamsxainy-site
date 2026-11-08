import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Shuffle, SkipBack, Play, Pause, SkipForward, Repeat, Repeat1,
  Star, MoreHorizontal, MessageSquareQuote, ListMusic, Volume2, VolumeX,
  Menu, Disc3, Plus, ExternalLink, Disc, Share2, Check
} from 'lucide-react';
import { useMusicPlayerStore } from '../store/useMusicPlayerStore';

interface PlayerChromeProps {
  onToggleMobileSidebar?: () => void;
  onSeek: (seconds: number) => void;
}

export const PlayerChrome: React.FC<PlayerChromeProps> = ({
  onToggleMobileSidebar,
  onSeek,
}) => {
  const navigate = useNavigate();
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

  const [isVolumeHovered, setIsVolumeHovered] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const isPlaying = playbackStatus === 'playing';
  const isLiked = currentTrack ? likedTrackIds.includes(currentTrack.id) : false;

  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  const handleScrubberClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration || duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    onSeek(ratio * duration);
  };

  return (
    <>
      {/* Mobile Top Header (only for opening sidebar on small screens) */}
      <div className="lg:hidden fixed top-3 left-3 z-40">
        <button
          type="button"
          onClick={onToggleMobileSidebar}
          className="p-2.5 rounded-full bg-[#1e1e20]/90 backdrop-blur-md border border-white/10 text-white/80 hover:text-white shadow-lg cursor-pointer"
          title="Open Menu"
        >
          <Menu className="w-4 h-4" />
        </button>
      </div>

      {/* Floating Bottom Glassmorphic Player Capsule Dock */}
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 max-w-[840px] w-[95vw] sm:w-auto">
        <div className="bg-[#202022]/90 backdrop-blur-2xl border border-white/10 rounded-full px-4 sm:px-6 py-2.5 shadow-[0_20px_50px_rgba(0,0,0,0.85)] flex items-center justify-between gap-3 sm:gap-5 select-none transition-all">
          
          {/* 1. LEFT: Transport Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0 text-white/70">
            {/* Shuffle */}
            <button
              type="button"
              onClick={toggleShuffle}
              className={`p-1.5 rounded-full transition-colors cursor-pointer hidden sm:block ${
                shuffle ? 'text-white' : 'text-white/40 hover:text-white'
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

            {/* Play / Pause Circular Icon */}
            <button
              type="button"
              onClick={togglePlayPause}
              className="p-1 text-white hover:scale-105 active:scale-95 transition-transform cursor-pointer"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 fill-current" />
              ) : (
                <Play className="w-5 h-5 fill-current ml-0.5" />
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
                repeatMode !== 'off' ? 'text-white' : 'text-white/40 hover:text-white'
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

          {/* 2. CENTER: Now Playing Info & Micro Scrubber */}
          <div className="flex items-center gap-3 min-w-0 flex-1 sm:flex-initial">
            {currentTrack ? (
              <div className="flex items-center gap-3 min-w-0">
                <img 
                  src={currentTrack.artwork} 
                  alt="" 
                  onClick={() => navigate(`/music/album/${currentTrack.albumId || 'album-default'}`)}
                  className="w-9 h-9 rounded-md object-cover shrink-0 shadow-md border border-white/10 cursor-pointer hover:scale-105 transition-transform" 
                  title="View Album"
                />
                
                <div className="min-w-0 flex flex-col justify-center">
                  <span 
                    onClick={() => navigate(`/music/album/${currentTrack.albumId || 'album-default'}`)}
                    className="text-xs font-semibold text-white truncate max-w-[120px] sm:max-w-[190px] cursor-pointer hover:underline"
                    title={currentTrack.title}
                  >
                    {currentTrack.title}
                  </span>
                  <span 
                    onClick={() => navigate(`/music/artist/${encodeURIComponent(currentTrack.artist)}`)}
                    className="text-[11px] text-white/50 truncate max-w-[120px] sm:max-w-[190px] cursor-pointer hover:text-white transition-colors"
                    title={currentTrack.artist}
                  >
                    {currentTrack.artist}
                  </span>

                  {/* Micro Scrubber Bar */}
                  <div 
                    onClick={handleScrubberClick}
                    className="w-full sm:w-36 h-1 bg-white/15 rounded-full mt-1 cursor-pointer overflow-hidden relative group"
                    title="Seek"
                  >
                    <div 
                      className="h-full bg-white rounded-full transition-all group-hover:bg-rose-400"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-white/40 px-2">
                <Disc3 className="w-4 h-4 text-white/30 animate-spin" />
                <span>Select a song to play</span>
              </div>
            )}
          </div>

          {/* 3. RIGHT: Favorite, More, Lyrics, Queue, Volume */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0 text-white/60 relative">
            
            {/* Star Favorite */}
            <button
              type="button"
              onClick={() => currentTrack && toggleLike(currentTrack.id)}
              className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                isLiked ? 'text-amber-400' : 'hover:text-white'
              }`}
              title={isLiked ? 'Starred' : 'Add to favorites'}
            >
              <Star className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
            </button>

            {/* Three Dots More */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsMoreMenuOpen(prev => !prev)}
                className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                  isMoreMenuOpen ? 'text-white bg-white/10' : 'hover:text-white'
                }`}
                title="More options"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>

              {/* Popover Action Menu */}
              {isMoreMenuOpen && currentTrack && (
                <div 
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-0 bottom-full mb-3 w-52 bg-[#1e1e20] border border-white/10 rounded-2xl shadow-2xl z-50 p-1.5 text-xs animate-in fade-in zoom-in-95 text-white/90"
                >
                  <button
                    type="button"
                    onClick={() => {
                      toggleLike(currentTrack.id);
                      setIsMoreMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-white/10 flex items-center gap-2 text-white/80 hover:text-white"
                  >
                    <Star className={`w-3.5 h-3.5 ${isLiked ? 'fill-amber-400 text-amber-400' : ''}`} />
                    <span>{isLiked ? 'Remove from Favorites' : 'Add to Favorites'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      addToQueue(currentTrack, true);
                      setIsMoreMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-white/10 flex items-center gap-2 text-white/80 hover:text-white"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Play Next</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      addToQueue(currentTrack, false);
                      setIsMoreMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-white/10 flex items-center gap-2 text-white/80 hover:text-white"
                  >
                    <Disc className="w-3.5 h-3.5" />
                    <span>Add to Queue</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      navigate(`/music/artist/${encodeURIComponent(currentTrack.artist)}`);
                      setIsMoreMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-white/10 flex items-center gap-2 text-white/80 hover:text-white border-t border-white/5 mt-1 pt-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Go to Artist</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      navigate(`/music/album/${currentTrack.albumId || 'album-default'}`);
                      setIsMoreMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-white/10 flex items-center gap-2 text-white/80 hover:text-white"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Go to Album</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(`${currentTrack.title} - ${currentTrack.artist}`);
                      setCopiedLink(true);
                      setTimeout(() => {
                        setCopiedLink(false);
                        setIsMoreMenuOpen(false);
                      }, 1200);
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-white/10 flex items-center gap-2 text-white/80 hover:text-white"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
                    <span>{copiedLink ? 'Copied to Clipboard' : 'Share Track Info'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Lyrics Toggle */}
            <button
              type="button"
              onClick={toggleLyrics}
              className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                showLyrics ? 'text-white bg-white/10' : 'hover:text-white'
              }`}
              title="Lyrics"
            >
              <MessageSquareQuote className="w-4 h-4" />
            </button>

            {/* Queue Toggle */}
            <button
              type="button"
              onClick={toggleQueue}
              className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                showQueue ? 'text-white bg-white/10' : 'hover:text-white'
              }`}
              title="Queue"
            >
              <ListMusic className="w-4 h-4" />
            </button>

            {/* Volume Control with Hover Slider */}
            <div 
              className="relative flex items-center"
              onMouseEnter={() => setIsVolumeHovered(true)}
              onMouseLeave={() => setIsVolumeHovered(false)}
            >
              <button
                type="button"
                onClick={toggleMute}
                className="p-1.5 rounded-full hover:text-white transition-colors cursor-pointer"
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4 text-red-400" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>

              {/* Volume Slider flyout on hover / focus */}
              {isVolumeHovered && (
                <div className="absolute right-0 bottom-full mb-3 p-2 bg-[#202022] border border-white/10 rounded-2xl shadow-xl flex items-center animate-in fade-in zoom-in-95 duration-150">
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={isMuted ? 0 : volume}
                    onChange={(e) => setVolume(Number(e.target.value))}
                    className="w-20 h-1 am-slider accent-white cursor-pointer"
                    aria-label="Volume"
                  />
                </div>
              )}
            </div>

          </div>

        </div>
      </div>
    </>
  );
};

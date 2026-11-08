import React, { useState } from 'react';
import { 
  Shuffle, SkipBack, Play, Pause, SkipForward, Repeat, Repeat1,
  Star, MoreHorizontal, MessageSquareQuote, List, Volume2, VolumeX,
  Loader2, Menu
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

  const [isVolumeHovered, setIsVolumeHovered] = useState(false);

  const isPlaying = playbackStatus === 'playing';
  const isLoading = playbackStatus === 'loading';
  const isLiked = currentTrack ? likedTrackIds.includes(currentTrack.id) : false;

  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  const handleScrubberClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration || duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    onSeek(ratio * duration);
  };

  // Open the current song's artist / album page. Uses the ids on the track; if a track
  // predates id parsing, looks them up first (never guesses).
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
      {/* Mobile Drawer Trigger (Mobile Only) */}
      <div className="lg:hidden fixed top-3 left-3 z-40">
        <button
          type="button"
          onClick={onToggleMobileSidebar}
          className="p-2.5 rounded-full bg-[#121212]/90 backdrop-blur-md border border-white/10 text-white/80 hover:text-white shadow-lg cursor-pointer"
          title="Open Menu"
        >
          <Menu className="w-4 h-4" />
        </button>
      </div>

      {/* BitChord Floating Player Pill */}
      <div 
        className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 max-w-[840px] w-[95vw] sm:w-auto"
        style={{ fontFamily: "'DM Sans', sans-serif" }}
      >
        <div 
          className="bitchord-floating-pill rounded-full px-4 sm:px-6 py-2.5 shadow-[0_20px_50px_rgba(0,0,0,0.85)] flex items-center justify-between gap-3 sm:gap-6 select-none transition-all"
          style={{
            background: 'rgba(40, 40, 40, 0.6)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          
          {/* ========================================================================= */}
          {/* 1. LEFT: Transport Controls                                               */}
          {/* ========================================================================= */}
          <div className="flex items-center gap-1 sm:gap-2.5 shrink-0 text-[#a3a3a3]">
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
                <div className="w-6 h-6 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                </div>
              ) : isPlaying ? (
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
          {/* 2. CENTER: Artwork + Track Info + Subtle Edge Progress Line               */}
          {/* ========================================================================= */}
          <div className="flex items-center gap-3 min-w-0 flex-1 sm:flex-initial">
            {currentTrack ? (
              <div className="relative flex items-center gap-3 min-w-0 pb-1.5">
                <img 
                  src={currentTrack.artwork} 
                  alt="" 
                  onClick={openAlbum}
                  className="w-10 h-10 rounded-md object-cover shrink-0 shadow-md border border-white/10 cursor-pointer hover:opacity-80 transition-opacity" 
                />
                
                <div className="min-w-0 flex flex-col justify-center items-start">
                  <button
                    type="button"
                    onClick={openAlbum}
                    title="Go to album"
                    className="text-xs font-semibold text-white truncate max-w-[130px] sm:max-w-[180px] hover:underline text-left cursor-pointer"
                  >
                    {currentTrack.title}
                  </button>
                  <button
                    type="button"
                    onClick={openArtist}
                    title="Go to artist"
                    className="text-[11px] text-[#a3a3a3] hover:text-white hover:underline truncate max-w-[130px] sm:max-w-[180px] text-left cursor-pointer"
                  >
                    {resolving ? 'Opening…' : currentTrack.artist}
                  </button>
                </div>

                {/* Subtle thin progress line pinned to absolute bottom edge of track container */}
                <div 
                  onClick={handleScrubberClick}
                  className="absolute bottom-0 left-0 right-0 h-[2px] hover:h-[4px] bg-white/15 rounded-full cursor-pointer transition-all overflow-hidden"
                  title="Seek"
                >
                  <div 
                    className="h-full bg-white rounded-full transition-all"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-[#a3a3a3] px-2">
                <span>Select a song to play</span>
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* 3. RIGHT: Star, More, Lyrics, Queue, Volume                               */}
          {/* ========================================================================= */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0 text-[#a3a3a3]">
            
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
            <button
              type="button"
              className="p-1.5 rounded-full hover:text-white transition-colors cursor-pointer"
              title="More options"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {/* Synced Lyrics Toggle (Quote / Message) */}
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

            {/* Up Next Queue Toggle (List) */}
            <button
              type="button"
              onClick={toggleQueue}
              className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                showQueue ? 'text-white bg-white/10' : 'hover:text-white'
              }`}
              title="Queue"
            >
              <List className="w-4 h-4" />
            </button>

            {/* Volume Control */}
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

              {/* Volume Slider flyout */}
              {isVolumeHovered && (
                <div className="absolute right-0 bottom-full mb-3 p-2 bg-[#1c1c1e] border border-white/10 rounded-2xl shadow-xl flex items-center animate-in fade-in zoom-in-95 duration-150">
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={isMuted ? 0 : volume}
                    onChange={(e) => setVolume(Number(e.target.value))}
                    className="w-20 h-1 accent-white cursor-pointer"
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

export default FloatingPlayer;

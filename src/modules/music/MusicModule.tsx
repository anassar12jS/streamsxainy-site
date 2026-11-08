import React, { useEffect, useRef, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import './styles/tokens.css';
import { useMusicPlayerStore } from './store/useMusicPlayerStore';
import { MusicAudioEngine } from './player/AudioEngine';
import { resolveStreamUrl, resolveVideoId } from './api/innertube';
import { extensionBridge } from './extension/bridge';
import { Sidebar } from './components/Sidebar';
import { PlayerChrome } from './components/PlayerChrome';
import { QueueDrawer } from './components/QueueDrawer';
import { ExtensionBanner } from './components/ExtensionBanner';
import { ListenTogetherModal } from './components/ListenTogetherModal';
import { MusicSettingsModal } from './components/MusicSettingsModal';
import { YouTubeMusicLinkModal } from './components/YouTubeMusicLinkModal';
import { YouTubeAccountModal } from './components/YouTubeAccountModal';
import { ImmersivePlayerOverlay } from './components/ImmersivePlayerOverlay';
import { replayRecorder } from './api/replay';

import { BrowseRoute, BITCHORD_HOME_TRACKS } from './routes/BrowseRoute';
import { NewRoute } from './routes/NewRoute';
import { SearchRoute } from './routes/SearchRoute';
import { AlbumRoute } from './routes/AlbumRoute';
import { ArtistRoute } from './routes/ArtistRoute';
import { PlaylistRoute } from './routes/PlaylistRoute';
import { RadioRoute } from './routes/RadioRoute';
import { LibraryRoute } from './routes/LibraryRoute';
import { ReplayRoute } from './routes/ReplayRoute';

export const MusicModule: React.FC = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const engineRef = useRef<MusicAudioEngine | null>(null);

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isListenTogetherOpen, setIsListenTogetherOpen] = useState(false);
  const [isYtLinkOpen, setIsYtLinkOpen] = useState(false);

  // Store bindings
  const currentTrack = useMusicPlayerStore(state => state.currentTrack);
  const playbackStatus = useMusicPlayerStore(state => state.playbackStatus);
  const volume = useMusicPlayerStore(state => state.volume);
  const isMuted = useMusicPlayerStore(state => state.isMuted);
  const repeatMode = useMusicPlayerStore(state => state.repeatMode);
  const trackPlayNonce = useMusicPlayerStore(state => state.trackPlayNonce);
  
  const setTrack = useMusicPlayerStore(state => state.setTrack);
  const playTrack = useMusicPlayerStore(state => state.playTrack);
  const setTime = useMusicPlayerStore(state => state.setTime);
  const setPlaybackStatus = useMusicPlayerStore(state => state.setPlaybackStatus);
  const nextTrack = useMusicPlayerStore(state => state.nextTrack);
  const prevTrack = useMusicPlayerStore(state => state.prevTrack);
  const togglePlayPause = useMusicPlayerStore(state => state.togglePlayPause);
  const setExtensionConnected = useMusicPlayerStore(state => state.setExtensionConnected);

  // Initialize default track if none is selected yet (matching BitChord screenshot)
  useEffect(() => {
    if (!currentTrack && BITCHORD_HOME_TRACKS.length > 0) {
      useMusicPlayerStore.setState({
        currentTrack: BITCHORD_HOME_TRACKS[0],
        duration: BITCHORD_HOME_TRACKS[0].duration || 184,
        queue: BITCHORD_HOME_TRACKS,
        queueIndex: 0,
        playbackStatus: 'idle',
      });
    }
  }, []);

  // 1. Initialize Audio Engine with HTMLAudioElement and callbacks
  useEffect(() => {
    if (!audioRef.current) return;

    const engine = new MusicAudioEngine(audioRef.current, {
      onTimeUpdate: (currentTime, duration) => {
        setTime(currentTime, duration);
        replayRecorder.onPlayTick();
      },
      onStatusChange: (status) => {
        setPlaybackStatus(status);
      },
      onEnded: () => {
        replayRecorder.onTrackEnd(true);
        if (useMusicPlayerStore.getState().repeatMode === 'one') {
          engineRef.current?.seek(0);
          engineRef.current?.play().catch(() => {});
        } else {
          useMusicPlayerStore.getState().nextTrack();
        }
      },
    });
    engineRef.current = engine;

    // Apply stored volume & mute
    engine.setVolume(volume);
    engine.setMuted(isMuted);

    // Audio event listeners for HTML5 mode
    const audio = audioRef.current;

    const handleTimeUpdate = () => {
      if (engine.activeMode === 'html5') {
        setTime(audio.currentTime, !isNaN(audio.duration) ? audio.duration : undefined);
      }
    };

    const handleLoadedMetadata = () => {
      if (engine.activeMode === 'html5' && !isNaN(audio.duration) && audio.duration > 0) {
        setTime(audio.currentTime, audio.duration);
      }
    };

    const handlePlaying = () => {
      if (engine.activeMode === 'html5') {
        setPlaybackStatus('playing');
      }
    };

    const handlePause = () => {
      if (engine.activeMode === 'html5') {
        setPlaybackStatus('paused');
      }
    };

    const handleEnded = () => {
      if (engine.activeMode === 'html5') {
        if (useMusicPlayerStore.getState().repeatMode === 'one') {
          audio.currentTime = 0;
          audio.play().catch(() => {});
        } else {
          useMusicPlayerStore.getState().nextTrack();
        }
      }
    };

    const handleError = () => {
      if (engine.activeMode === 'html5') {
        console.warn('Audio playback error on HTML5 element');
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('playing', handlePlaying);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    // Extension bridge detection listener
    const unsubExt = extensionBridge.subscribe(status => {
      setExtensionConnected(status.available);
    });

    // Cleanup: Ensure navigating away from /music destroys Web Audio graph & pauses audio!
    return () => {
      unsubExt();
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('playing', handlePlaying);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  // 2. Respond to track changes & stream resolution
  useEffect(() => {
    if (!currentTrack || !engineRef.current) return;
    if (playbackStatus === 'idle' && trackPlayNonce === 0) return;

    let isCancelled = false;

    const loadAndPlay = async () => {
      try {
        setPlaybackStatus('loading');
        replayRecorder.onTrackStart(currentTrack);

        // 1. Live radio station with direct stream URL
        if (currentTrack.isLive && currentTrack.audioUrl) {
          if (engineRef.current) {
            await engineRef.current.loadStream(currentTrack.audioUrl);
            if (!isCancelled) {
              setPlaybackStatus('playing');
              engineRef.current.syncMediaSession(
                currentTrack,
                togglePlayPause,
                togglePlayPause,
                nextTrack,
                prevTrack
              );
            }
          }
          return;
        }

        // 2. Resolve YouTube video ID for full song playback
        let videoId = currentTrack.youtubeId;
        if (!videoId && (currentTrack.title || currentTrack.artist)) {
          try {
            videoId = (await resolveVideoId(currentTrack)) || undefined;
          } catch (e) {
            console.debug('Failed to resolve videoId:', e);
          }
        }

        // 3. Play the full song via YouTube audio engine (never cuts off at 30 seconds!)
        if (videoId && engineRef.current) {
          await engineRef.current.playYouTube(videoId);
          if (!isCancelled) {
            setPlaybackStatus('playing');

            // Sync MediaSession
            engineRef.current.syncMediaSession(
              currentTrack,
              togglePlayPause,
              togglePlayPause,
              nextTrack,
              prevTrack
            );

            // Update Discord RPC if extension is present
            extensionBridge.updateDiscordRpc({
              title: currentTrack.title,
              artist: currentTrack.artist,
              duration: currentTrack.duration,
              artwork: currentTrack.artwork,
            });
          }
          return;
        }

        // 4. Fallback to direct stream URL if available
        let streamUrl = '';
        let isDash = false;
        try {
          const resolved = await resolveStreamUrl(currentTrack);
          if (resolved?.url && typeof resolved.url === 'string' && (resolved.url.startsWith('http') || resolved.url.startsWith('blob:'))) {
            streamUrl = resolved.url;
            isDash = resolved.isDash || false;
          }
        } catch {}

        if (streamUrl && engineRef.current) {
          await engineRef.current.loadStream(streamUrl, isDash);
          if (!isCancelled) {
            setPlaybackStatus('playing');
            engineRef.current.syncMediaSession(
              currentTrack,
              togglePlayPause,
              togglePlayPause,
              nextTrack,
              prevTrack
            );
          }
          return;
        }

        // 5. Fallback only if audioUrl is NOT an iTunes 30-sec preview
        const isItunesPreview = Boolean(
          currentTrack.audioUrl && 
          (currentTrack.audioUrl.includes('itunes.apple.com') || currentTrack.audioUrl.includes('apple.com/itunes-assets'))
        );
        if (currentTrack.audioUrl && !isItunesPreview && engineRef.current) {
          await engineRef.current.loadStream(currentTrack.audioUrl);
          if (!isCancelled) {
            setPlaybackStatus('playing');
          }
          return;
        }

        throw new Error(`No full-length audio stream available for "${currentTrack.title}"`);
      } catch (err) {
        if (!isCancelled) {
          console.error('Failed to stream audio:', err);
          setPlaybackStatus('error');
        }
      }
    };

    loadAndPlay();

    return () => {
      isCancelled = true;
    };
  }, [currentTrack?.id, trackPlayNonce]);

  // 3. Play / Pause state sync
  useEffect(() => {
    if (!engineRef.current || !currentTrack) return;

    if (playbackStatus === 'playing') {
      engineRef.current.play().catch(() => {});
    } else if (playbackStatus === 'paused') {
      engineRef.current.pause();
    }
  }, [playbackStatus]);

  // 4. Volume & Mute sync
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setVolume(volume);
      engineRef.current.setMuted(isMuted);
    }
  }, [volume, isMuted]);

  const handleSeek = (seconds: number) => {
    if (engineRef.current) {
      engineRef.current.seek(seconds);
      useMusicPlayerStore.getState().seek(seconds);
    }
  };

  // 5. Global Keyboard shortcuts listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlayPause();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          handleSeek(Math.max(0, useMusicPlayerStore.getState().currentTime - 5));
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleSeek(useMusicPlayerStore.getState().currentTime + 5);
          break;
        case 'KeyM':
          e.preventDefault();
          useMusicPlayerStore.getState().toggleMute();
          break;
        case 'KeyL':
          e.preventDefault();
          useMusicPlayerStore.getState().toggleLyrics();
          break;
        case 'KeyQ':
          e.preventDefault();
          useMusicPlayerStore.getState().toggleQueue();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlayPause, volume]);

  return (
    <div 
      className="h-full w-full flex bg-[#0a0a0a] text-[#ffffff] relative overflow-hidden"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      
      {/* Hidden Web Audio Media Element */}
      <audio 
        ref={audioRef} 
        crossOrigin="anonymous" 
        preload="auto" 
        className="hidden" 
      />

      {/* Full-Height Left Sidebar */}
      <Sidebar
        isOpenOnMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenListenTogether={() => setIsListenTogetherOpen(true)}
        onOpenYouTubeLink={() => setIsYtLinkOpen(true)}
      />

      {/* Main Content Scroll View: Exactly #0a0a0a */}
      <main className="flex-1 min-w-0 h-full overflow-y-auto px-4 sm:px-8 pt-6 pb-40 am-scrollbar bg-[#0a0a0a]">
        
        {/* Extension Detection Banner */}
        <ExtensionBanner />

        {/* Subroutes */}
        <Routes>
          <Route path="/" element={<BrowseRoute />} />
          <Route path="/browse" element={<NewRoute />} />
          <Route path="/new" element={<NewRoute />} />
          <Route path="/search" element={<SearchRoute />} />
          <Route path="/album/:id" element={<AlbumRoute />} />
          <Route path="/artist/:id" element={<ArtistRoute />} />
          <Route path="/playlist/:id" element={<PlaylistRoute />} />
          <Route path="/radio" element={<RadioRoute />} />
          <Route path="/replay" element={<ReplayRoute />} />
          <Route path="/library/recent" element={<LibraryRoute defaultTab="recent" />} />
          <Route path="/library/songs" element={<LibraryRoute defaultTab="songs" />} />
          <Route path="/library/artists" element={<LibraryRoute defaultTab="artists" />} />
          <Route path="/library/albums" element={<LibraryRoute defaultTab="albums" />} />
          <Route path="/library/for-you" element={<LibraryRoute defaultTab="for-you" />} />
          <Route path="/library/liked" element={<LibraryRoute defaultTab="liked" />} />
          <Route path="/library/replay" element={<ReplayRoute />} />
          <Route path="/library/*" element={<LibraryRoute />} />
          <Route path="*" element={<Navigate to="/music" replace />} />
        </Routes>
      </main>

      {/* Floating Glassmorphic Player Capsule Dock */}
      <PlayerChrome
        onToggleMobileSidebar={() => setIsMobileSidebarOpen(prev => !prev)}
        onSeek={handleSeek}
      />

      {/* Full-Screen Lyrics & Queue Immersive View */}
      <ImmersivePlayerOverlay
        steeredClock={engineRef.current?.steeredClock}
        onSeek={handleSeek}
      />

      {/* Up Next Slide-over Queue Drawer */}
      <QueueDrawer />

      {/* Listen Together Live Room Modal */}
      <ListenTogetherModal
        isOpen={isListenTogetherOpen}
        onClose={() => setIsListenTogetherOpen(false)}
      />

      {/* Preferences & Addons Settings Modal */}
      <MusicSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* YouTube Music Sync & Account Switcher Modal */}
      <YouTubeAccountModal
        isOpen={isYtLinkOpen}
        onClose={() => setIsYtLinkOpen(false)}
      />

    </div>
  );
};

export const MusicTab = MusicModule;
export default MusicModule;

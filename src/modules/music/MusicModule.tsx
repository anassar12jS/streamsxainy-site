import React, { useEffect, useRef, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import './styles/tokens.css';
import { useMusicPlayerStore } from './store/useMusicPlayerStore';
import { MusicAudioEngine } from './player/AudioEngine';
import { resolveStreamUrl, resolveVideoId } from './api/innertube';
import { extensionBridge } from './extension/bridge';
import { Sidebar } from './components/Sidebar';
import { PlayerChrome } from './components/PlayerChrome';
import { LyricsPanel } from './components/LyricsPanel';
import { QueueDrawer } from './components/QueueDrawer';
import { ExtensionBanner } from './components/ExtensionBanner';

import { BrowseRoute, BITCHORD_HOME_TRACKS } from './routes/BrowseRoute';
import { SearchRoute } from './routes/SearchRoute';
import { AlbumRoute } from './routes/AlbumRoute';
import { RadioRoute } from './routes/RadioRoute';
import { LibraryRoute } from './routes/LibraryRoute';

export const MusicModule: React.FC = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const engineRef = useRef<MusicAudioEngine | null>(null);

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Store bindings
  const currentTrack = useMusicPlayerStore(state => state.currentTrack);
  const playbackStatus = useMusicPlayerStore(state => state.playbackStatus);
  const volume = useMusicPlayerStore(state => state.volume);
  const isMuted = useMusicPlayerStore(state => state.isMuted);
  const repeatMode = useMusicPlayerStore(state => state.repeatMode);
  
  const setTrack = useMusicPlayerStore(state => state.setTrack);
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
      },
      onStatusChange: (status) => {
        setPlaybackStatus(status);
      },
      onEnded: () => {
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

    let isCancelled = false;

    const loadAndPlay = async () => {
      try {
        setPlaybackStatus('loading');

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
  }, [currentTrack?.id]);

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

  return (
    <div className="am-shell min-h-screen flex bg-[var(--am-bg-main)] text-[var(--am-text-primary)] relative overflow-hidden">
      
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
      />

      {/* Main Content Scroll View */}
      <main className="flex-1 min-w-0 h-screen overflow-y-auto px-4 sm:px-8 py-6 am-scrollbar">
        
        {/* Extension Detection Banner */}
        <ExtensionBanner />

        {/* Subroutes */}
        <Routes>
          <Route path="/" element={<BrowseRoute />} />
          <Route path="/browse" element={<BrowseRoute />} />
          <Route path="/search" element={<SearchRoute />} />
          <Route path="/album/:id" element={<AlbumRoute />} />
          <Route path="/radio" element={<RadioRoute />} />
          <Route path="/library/*" element={<LibraryRoute />} />
          <Route path="*" element={<Navigate to="/music" replace />} />
        </Routes>
      </main>

      {/* Floating Glassmorphic Player Capsule Dock */}
      <PlayerChrome
        onToggleMobileSidebar={() => setIsMobileSidebarOpen(prev => !prev)}
        onSeek={handleSeek}
      />

      {/* Synced Lyrics Fullscreen / Side Panel */}
      <LyricsPanel
        steeredClock={engineRef.current?.steeredClock}
        onSeek={handleSeek}
      />

      {/* Up Next Slide-over Queue Drawer */}
      <QueueDrawer />

    </div>
  );
};

export const MusicTab = MusicModule;
export default MusicModule;

import React, { useEffect, useRef, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import './styles/tokens.css';
import { useMusicPlayerStore } from './store/useMusicPlayerStore';
import { MusicAudioEngine } from './player/AudioEngine';
import { resolveStreamUrl } from './api/innertube';
import { extensionBridge } from './extension/bridge';
import { Sidebar } from './components/Sidebar';
import { PlayerChrome } from './components/PlayerChrome';
import { LyricsPanel } from './components/LyricsPanel';
import { QueueDrawer } from './components/QueueDrawer';
import { ExtensionBanner } from './components/ExtensionBanner';

import { BrowseRoute } from './routes/BrowseRoute';
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
  
  const setTime = useMusicPlayerStore(state => state.setTime);
  const setPlaybackStatus = useMusicPlayerStore(state => state.setPlaybackStatus);
  const nextTrack = useMusicPlayerStore(state => state.nextTrack);
  const prevTrack = useMusicPlayerStore(state => state.prevTrack);
  const togglePlayPause = useMusicPlayerStore(state => state.togglePlayPause);
  const setExtensionConnected = useMusicPlayerStore(state => state.setExtensionConnected);

  // 1. Initialize Audio Engine with HTMLAudioElement
  useEffect(() => {
    if (!audioRef.current) return;

    const engine = new MusicAudioEngine(audioRef.current);
    engineRef.current = engine;

    // Apply stored volume & mute
    engine.setVolume(volume);
    engine.setMuted(isMuted);

    // Audio event listeners
    const audio = audioRef.current;

    const handleTimeUpdate = () => {
      setTime(audio.currentTime, !isNaN(audio.duration) ? audio.duration : undefined);
    };

    const handleLoadedMetadata = () => {
      if (!isNaN(audio.duration) && audio.duration > 0) {
        setTime(audio.currentTime, audio.duration);
      }
    };

    const handlePlaying = () => {
      setPlaybackStatus('playing');
    };

    const handlePause = () => {
      setPlaybackStatus('paused');
    };

    const handleEnded = () => {
      if (useMusicPlayerStore.getState().repeatMode === 'one') {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      } else {
        useMusicPlayerStore.getState().nextTrack();
      }
    };

    const handleError = () => {
      console.warn('Audio playback error, attempting recovery stream...');
      setPlaybackStatus('error');
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
        let streamUrl = currentTrack.audioUrl;
        let isDash = currentTrack.isDash || false;

        // If audioUrl is empty or requires resolution via YouTube InnerTube
        if (!streamUrl && currentTrack.youtubeId) {
          const resolved = await resolveStreamUrl(currentTrack.youtubeId);
          if (isCancelled) return;
          streamUrl = resolved.url;
          isDash = resolved.isDash;
        }

        if (streamUrl && engineRef.current) {
          await engineRef.current.loadStream(streamUrl, isDash);
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
        }
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
    <div className="am-shell min-h-screen flex flex-col bg-[#000000] text-white">
      
      {/* Hidden Web Audio Media Element */}
      <audio 
        ref={audioRef} 
        crossOrigin="anonymous" 
        preload="auto" 
        className="hidden" 
      />

      {/* Top 56px Apple Music Glassmorphic Player Chrome */}
      <PlayerChrome
        onToggleMobileSidebar={() => setIsMobileSidebarOpen(prev => !prev)}
        onSeek={handleSeek}
      />

      {/* Main Container: 240px Fixed Sidebar + Main Scroll Outlet */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Fixed Left Sidebar */}
        <Sidebar
          isOpenOnMobile={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
        />

        {/* Main Scroll Container */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 am-scrollbar">
          
          {/* Extension Detection Banner */}
          <ExtensionBanner />

          {/* Subroutes within /music */}
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
      </div>

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

export default MusicModule;

import React, { useEffect, useRef, useState, Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Menu } from 'lucide-react';
import './styles/tokens.css';
import { useMusicPlayerStore } from './store/useMusicPlayerStore';
import { MusicAudioEngine } from './player/AudioEngine';
import { resolveStreamUrl, resolveVideoId, resolveAlternateVideoId, getRadioTracks, prefetchStreamUrl } from './api/innertube';
import type { MusicTrack } from './types';
import { extensionBridge } from './extension/bridge';
import { Sidebar } from './components/Sidebar';
import { PlayerChrome } from './components/PlayerChrome';
import { QueueDrawer } from './components/QueueDrawer';
import { ExtensionBanner } from './components/ExtensionBanner';
import { ImmersivePlayerOverlay } from './components/ImmersivePlayerOverlay';
import { replayRecorder } from './api/replay';
import { fetchLyrics } from './api/lyrics';
import { getResilientAudioFallback } from './api/fallbackAudio';
import { getAudiusAudioStream } from './api/audiusStream';
import { getJioSaavnStream } from './api/jiosaavnApi';

// Keep home feed static for 0ms initial render
import { BrowseRoute } from './routes/BrowseRoute';

// Code-split secondary routes for lightweight initial bundle
const PlaylistsRoute = lazy(() => import('./routes/PlaylistsRoute').then(m => ({ default: m.PlaylistsRoute })));
const NewRoute = lazy(() => import('./routes/NewRoute').then(m => ({ default: m.NewRoute })));
const SearchRoute = lazy(() => import('./routes/SearchRoute').then(m => ({ default: m.SearchRoute })));
const AlbumRoute = lazy(() => import('./routes/AlbumRoute').then(m => ({ default: m.AlbumRoute })));
const ArtistRoute = lazy(() => import('./routes/ArtistRoute').then(m => ({ default: m.ArtistRoute })));
const PlaylistRoute = lazy(() => import('./routes/PlaylistRoute').then(m => ({ default: m.PlaylistRoute })));
const RadioRoute = lazy(() => import('./routes/RadioRoute').then(m => ({ default: m.RadioRoute })));
const LibraryRoute = lazy(() => import('./routes/LibraryRoute').then(m => ({ default: m.LibraryRoute })));
const ReplayRoute = lazy(() => import('./routes/ReplayRoute').then(m => ({ default: m.ReplayRoute })));
const SettingsRoute = lazy(() => import('./routes/SettingsRoute').then(m => ({ default: m.SettingsRoute })));
const DebugInspectorRoute = lazy(() => import('./routes/DebugInspectorRoute').then(m => ({ default: m.DebugInspectorRoute })));

// Lazy-load secondary overlay modals
const ListenTogetherModal = lazy(() => import('./components/ListenTogetherModal').then(m => ({ default: m.ListenTogetherModal })));
const MusicSettingsModal = lazy(() => import('./components/MusicSettingsModal').then(m => ({ default: m.MusicSettingsModal })));
const YouTubeAccountModal = lazy(() => import('./components/YouTubeAccountModal').then(m => ({ default: m.YouTubeAccountModal })));

const RouteLoadingSkeleton = () => (
  <div className="space-y-6 animate-pulse max-w-7xl mx-auto py-4">
    <div className="h-8 w-44 bg-white/10 rounded-lg" />
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="aspect-square bg-white/5 rounded-xl" />
      ))}
    </div>
  </div>
);

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
  const trackPlayNonce = useMusicPlayerStore(state => state.trackPlayNonce);
  const showLyrics = useMusicPlayerStore(state => state.showLyrics);
  
  const setTime = useMusicPlayerStore(state => state.setTime);
  const setPlaybackStatus = useMusicPlayerStore(state => state.setPlaybackStatus);
  const nextTrack = useMusicPlayerStore(state => state.nextTrack);
  const prevTrack = useMusicPlayerStore(state => state.prevTrack);
  const togglePlayPause = useMusicPlayerStore(state => state.togglePlayPause);
  const setExtensionConnected = useMusicPlayerStore(state => state.setExtensionConnected);

  // --- Endless playback: when the queue runs low, queue songs YouTube Music thinks fit next ---
  const radioSeeds = useRef<Set<string>>(new Set());

  const extendQueueWithRadio = async (track: MusicTrack | null): Promise<number> => {
    const seed = track?.youtubeId;
    if (!seed || track?.isLive || !useMusicPlayerStore.getState().autoplayRadio) return 0;
    if (radioSeeds.current.has(seed)) return 0; // already asked for this song's radio
    radioSeeds.current.add(seed);
    try {
      const more = await getRadioTracks(seed);
      return useMusicPlayerStore.getState().appendToQueue(more);
    } catch (e) {
      console.debug('[radio] could not load similar songs:', e);
      return 0;
    }
  };

  /** Next song; if the queue is exhausted, first pull in similar songs so music keeps going. */
  const advance = async () => {
    const st = useMusicPlayerStore.getState();
    if (st.queueIndex >= st.queue.length - 1 && st.repeatMode !== 'all' && !st.shuffle) {
      await extendQueueWithRadio(st.currentTrack);
    }
    useMusicPlayerStore.getState().nextTrack();
  };

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
          void advance();
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
          void advance();
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

        // Pre-fetch lyrics in background so full-screen lyrics are instant
        if (!currentTrack.isLive && currentTrack.artist && currentTrack.title) {
          fetchLyrics(currentTrack.artist, currentTrack.title, currentTrack.duration).then(lyrics => {
            if (!isCancelled && lyrics) {
              useMusicPlayerStore.getState().setLyrics(lyrics);
              useMusicPlayerStore.getState().setIsLoadingLyrics(false);
            }
          }).catch(() => {});
        }

        // Common post-playback setup helper
        const afterStart = () => {
          engineRef.current?.syncMediaSession(currentTrack, togglePlayPause, togglePlayPause, nextTrack, prevTrack);
          extensionBridge.updateDiscordRpc({
            title: currentTrack.title,
            artist: currentTrack.artist,
            duration: currentTrack.duration,
            artwork: currentTrack.artwork,
          });

          // Proactively prefetch next track stream for 0ms transition
          const st = useMusicPlayerStore.getState();
          const nextTrackInQueue = st.queue[st.queueIndex + 1];
          if (nextTrackInQueue) {
            prefetchStreamUrl(nextTrackInQueue);
          }
        };

        // 1. Live radio station with direct stream URL
        if (currentTrack.isLive && currentTrack.audioUrl) {
          if (engineRef.current) {
            await engineRef.current.loadStream(currentTrack.audioUrl);
            if (!isCancelled) {
              setPlaybackStatus('playing');
              afterStart();
            }
          }
          return;
        }

        // 2. PRIMARY DEFAULT ENGINE: JioSaavn 320kbps High-Fidelity Studio Audio
        // Pure unblocked CDN AAC/MP4 stream with full CORS & byte-range support.
        // Starts instantly on 1st click with zero extension needed; supports mobile lock-screen & background playback.
        if (currentTrack.title && currentTrack.artist) {
          try {
            const jioResult = await getJioSaavnStream(currentTrack.title, currentTrack.artist);
            if (jioResult?.streamUrl && engineRef.current) {
              await engineRef.current.loadStream(jioResult.streamUrl);
              if (!isCancelled) {
                setPlaybackStatus('playing');
                afterStart();
                return;
              }
            }
          } catch (jioErr) {
            console.debug('JioSaavn primary stream skipped, cascading:', jioErr);
          }
        }
        if (isCancelled) return;

        // 3. SECONDARY ENGINE: Direct stream URL if available
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
            afterStart();
            return;
          }
        }
        if (isCancelled) return;

        // 4. TERTIARY ENGINE: YouTube player fallback
        const tryYouTube = async (id: string): Promise<boolean> => {
          if (!engineRef.current) return false;
          const result = await engineRef.current.playYouTube(id);
          if (isCancelled || result === 'superseded') return true;
          if (result === 'playing') {
            afterStart();
            return true;
          }
          if (result === 'blocked') {
            setPlaybackStatus('paused');
            afterStart();
            return true;
          }
          console.warn(`YouTube would not play ${id}; trying another source`);
          return false;
        };

        let videoId = currentTrack.youtubeId;
        if (!videoId && (currentTrack.title || currentTrack.artist)) {
          try {
            videoId = (await resolveVideoId(currentTrack)) || undefined;
          } catch (e) {
            console.debug('Failed to resolve videoId:', e);
          }
        }
        if (isCancelled) return;

        if (videoId && (await tryYouTube(videoId))) return;
        if (isCancelled) return;

        // YouTube refused that upload (e.g. embedding disabled): try alternate upload
        if (videoId) {
          const altId = await resolveAlternateVideoId(currentTrack, videoId);
          if (isCancelled) return;
          if (altId && (await tryYouTube(altId))) return;
        }
        if (isCancelled) return;

        // 5. QUATERNARY ENGINE: Audius Open Network 320kbps MP3 stream (unblocked)
        if (currentTrack.title && currentTrack.artist) {
          try {
            const audiusStream = await getAudiusAudioStream(currentTrack.title, currentTrack.artist);
            if (audiusStream && engineRef.current) {
              await engineRef.current.loadStream(audiusStream);
              if (!isCancelled) {
                setPlaybackStatus('playing');
                afterStart();
                return;
              }
            }
          } catch (audErr) {
            console.debug('Audius streaming fallback skipped:', audErr);
          }
        }
        if (isCancelled) return;

        // 6. FINAL RESILIENT FALLBACK: Stream high-quality audio
        let fallbackStream = currentTrack.audioUrl;
        if (!fallbackStream && currentTrack.title && currentTrack.artist) {
          try {
            fallbackStream = (await getResilientAudioFallback(currentTrack.title, currentTrack.artist)) || undefined;
          } catch {}
        }

        if (fallbackStream && engineRef.current) {
          await engineRef.current.loadStream(fallbackStream);
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

        throw new Error(`No audio stream available for "${currentTrack.title}"`);
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
      engineRef.current.setMediaSessionState('playing');
    } else if (playbackStatus === 'paused') {
      engineRef.current.pause();
      engineRef.current.setMediaSessionState('paused');
    }
  }, [playbackStatus]);

  // Keep similar songs queued ahead of time so the next song starts without a gap
  useEffect(() => {
    if (!currentTrack || currentTrack.isLive) return;
    const { queue, queueIndex } = useMusicPlayerStore.getState();
    if (queue.length - queueIndex <= 3) void extendQueueWithRadio(currentTrack);
  }, [currentTrack?.id]);

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
          if (e.shiftKey) useMusicPlayerStore.getState().prevTrack();
          else handleSeek(Math.max(0, useMusicPlayerStore.getState().currentTime - 5));
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (e.shiftKey) void advance();
          else handleSeek(useMusicPlayerStore.getState().currentTime + 5);
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
      className="h-full w-full flex bg-[#0f0f0f] text-[#ffffff] relative overflow-hidden"
      style={{ fontFamily: 'var(--bitchord-font)' }}
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

      {/* Main Content Scroll View: BitChord #0f0f0f with 140px bottom padding */}
      <main 
        className="flex-1 min-w-0 h-full overflow-y-auto px-4 sm:px-8 pt-4 sm:pt-6 am-scrollbar bg-[#0f0f0f]"
        style={{ paddingBottom: '140px' }}
      >
        {/* Mobile top navigation header */}
        <div className="lg:hidden flex items-center justify-between pb-3 mb-4 border-b border-white/10 shrink-0">
          <button
            type="button"
            onClick={() => setIsMobileSidebarOpen(true)}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/15 text-white transition-colors cursor-pointer"
            title="Open navigation menu"
          >
            <Menu className="w-4 h-4" />
          </button>
          <span className="font-bold text-sm text-white tracking-tight">Xainy Music</span>
          <div className="w-8" />
        </div>
        
        {/* Extension Detection Banner */}
        <ExtensionBanner />

        {/* Subroutes with Suspense */}
        <Suspense fallback={<RouteLoadingSkeleton />}>
          <Routes>
            <Route path="/" element={<BrowseRoute />} />
            <Route path="/browse" element={<BrowseRoute />} />
            <Route path="/new" element={<NewRoute />} />
            <Route path="/search" element={<SearchRoute />} />
            <Route path="/album/:id" element={<AlbumRoute />} />
            <Route path="/artist/:id" element={<ArtistRoute />} />
            <Route path="/playlist/:id" element={<PlaylistRoute />} />
            <Route path="/radio" element={<RadioRoute />} />
            <Route path="/replay" element={<ReplayRoute />} />
            <Route path="/settings" element={<SettingsRoute />} />
            <Route path="/debug" element={<DebugInspectorRoute />} />
            <Route path="/inspector" element={<DebugInspectorRoute />} />
            <Route path="/library/playlists" element={<PlaylistsRoute />} />
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
        </Suspense>
      </main>

      {/* Floating Glassmorphic Player Capsule Dock */}
      <PlayerChrome
        onToggleMobileSidebar={() => setIsMobileSidebarOpen(prev => !prev)}
        onSeek={handleSeek}
      />

      {/* Full-Screen Lyrics & Queue Immersive View */}
      {showLyrics && currentTrack && (
        <ImmersivePlayerOverlay
          steeredClock={engineRef.current?.steeredClock}
          onSeek={handleSeek}
        />
      )}

      {/* Up Next Slide-over Queue Drawer */}
      <QueueDrawer />

      {/* Listen Together Live Room Modal (Lazy) */}
      {isListenTogetherOpen && (
        <Suspense fallback={null}>
          <ListenTogetherModal
            isOpen={isListenTogetherOpen}
            onClose={() => setIsListenTogetherOpen(false)}
          />
        </Suspense>
      )}

      {/* Preferences & Addons Settings Modal (Lazy) */}
      {isSettingsOpen && (
        <Suspense fallback={null}>
          <MusicSettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
          />
        </Suspense>
      )}

      {/* YouTube Music Sync & Account Switcher Modal (Lazy) */}
      {isYtLinkOpen && (
        <Suspense fallback={null}>
          <YouTubeAccountModal
            isOpen={isYtLinkOpen}
            onClose={() => setIsYtLinkOpen(false)}
          />
        </Suspense>
      )}

    </div>
  );
};

export const MusicTab = MusicModule;
export default MusicModule;

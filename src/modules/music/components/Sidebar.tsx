import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Search, Home, LayoutGrid, Clock, Mic2, Disc, Music2, Heart,
  UserCheck, Sparkles, Settings, ExternalLink, ChevronsUpDown,
  Film, Users, Youtube, Radio, LogOut, Check, Music, Terminal, ListMusic, LayoutList
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMusicPlayerStore } from '../store/useMusicPlayerStore';
import { extensionBridge, XainyMusicBridge } from '../extension/bridge';

import { useSessionStore } from '../store/useSessionStore';
import { resetInnertube } from '../api/innertube';
import { syncUserYouTubeMusicLibrary } from '../api/youtubeAuth';
import { getLibraryPlaylists } from '../api/innertube';

interface SidebarProps {
  isOpenOnMobile?: boolean;
  onCloseMobile?: () => void;
  onOpenSettings?: () => void;
  onOpenListenTogether?: () => void;
  onOpenYouTubeLink?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpenOnMobile = false,
  onCloseMobile,
  onOpenSettings,
  onOpenListenTogether,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const extensionConnected = useMusicPlayerStore(state => state.extensionConnected);
  
  // Connect to unified session store for alt channels & YouTube identity
  const channels = useSessionStore(state => state.channels);
  const activeChannel = useSessionStore(state => state.activeChannel);
  const refreshSession = useSessionStore(state => state.refreshSession);
  const authStatus = useSessionStore(state => state.authStatus);
  const selectChannel = useSessionStore(state => state.selectChannel);
  const disconnectSession = useSessionStore(state => state.disconnect);

  // Live library playlists for the sidebar list (shared cache with the All Playlists page)
  const { data: libraryPlaylists } = useQuery({
    queryKey: ['ytm-library-playlists', activeChannel?.id || 'default'],
    queryFn: getLibraryPlaylists,
    enabled: authStatus === 'authenticated',
    staleTime: 1000 * 60 * 15,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  // Popover state
  const [showAccountPopover, setShowAccountPopover] = useState(false);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  // Active user representation
  const activeUser = {
    id: activeChannel?.id || 'channel_primary',
    name: activeChannel?.name || 'Not signed in',
    avatar: activeChannel?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=80&q=80',
    handle: activeChannel?.handle || 'YouTube Music',
  };

  // =========================================================================
  // Phase 3: Spotify Playlists Race Condition Fix
  // =========================================================================
  const [isBridgeReady, setIsBridgeReady] = useState(false);

  useEffect(() => {
    const unsubscribe = extensionBridge.subscribe((status) => {
      setIsBridgeReady(status.available);
    });
    return unsubscribe;
  }, []);

  const { data: spotifyPlaylists } = useQuery({
    queryKey: ['spotifyPlaylists'],
    queryFn: () => new Promise<any[]>((resolve, reject) => {
      try {
        const chromeRuntime = (window as any).chrome?.runtime;
        if (chromeRuntime && typeof chromeRuntime.sendMessage === 'function') {
          chromeRuntime.sendMessage(
            XainyMusicBridge.EXTENSION_ID,
            { channel: 'bitchord-bridge', direction: 'to-extension', protocol: 1, method: 'spotify.playlists', params: { offset: 0 } },
            (response: any) => {
              if (chromeRuntime.lastError) {
                // If extension communication error, return empty array gracefully
                resolve([]);
                return;
              }
              if (response?.ok && response.result) {
                resolve(response.result.items || []); // Must resolve the 'items' array
              } else {
                resolve([]);
              }
            }
          );
        } else {
          resolve([]);
        }
      } catch {
        resolve([]);
      }
    }),
    enabled: isBridgeReady, // CRITICAL: Prevent fetching until extension is ready
    staleTime: 1000 * 60 * 5, 
  });

  // Click outside to dismiss popover
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowAccountPopover(false);
      }
    };
    if (showAccountPopover) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showAccountPopover]);

  // Handle open popover: refresh session channels from extension
  const handleOpenAccountPopover = async () => {
    const nextState = !showAccountPopover;
    setShowAccountPopover(nextState);

    if (nextState) {
      setIsLoadingAccounts(true);
      try {
        await refreshSession(true);
      } catch (e) {
        console.debug('Failed to refresh session:', e);
      } finally {
        setIsLoadingAccounts(false);
      }
    }
  };

  // Account Selection Handler
  const handleAccountSelect = async (channelId: string) => {
    try {
      await selectChannel(channelId); // throws if the extension refuses; state unchanged then
      resetInnertube();
      queryClient.invalidateQueries();
      setShowAccountPopover(false);
      // Pull the new account's real library; Library page refreshes on the update event.
      syncUserYouTubeMusicLibrary().catch(err => console.warn('[YT sync]', err?.message || err));
    } catch (err: any) {
      console.warn('[YT select channel] failed:', err?.message || err);
    }
  };

  // Verify the session on load instead of trusting whatever was cached in localStorage.
  useEffect(() => {
    refreshSession(false).catch(() => {});
  }, []);

  const handleDisconnect = () => {
    disconnectSession();
    queryClient.invalidateQueries();
    setShowAccountPopover(false);
  };

  const navLinks = [
    { path: '/music/search', label: 'Search', icon: Search },
    { path: '/music', label: 'Home', icon: Home },
    { path: '/music/new', label: 'New', icon: LayoutGrid },
    { path: '/music/radio', label: 'Radio', icon: Radio },
  ];

  const libraryLinks = [
    { path: '/music/library/liked', label: 'Liked Songs', icon: Heart },
    { path: '/music/library/recent', label: 'Recently Played', icon: Clock },
    { path: '/music/library/artists', label: 'Artists', icon: Mic2 },
    { path: '/music/library/albums', label: 'Albums', icon: Disc },
    { path: '/music/library/songs', label: 'Songs', icon: Music2 },
    { path: '/music/replay', label: "Replay '25", icon: Sparkles },
    { path: '/music/library/for-you', label: 'Made for You', icon: UserCheck },
  ];

  const isCurrentPath = (path: string) => {
    if (path === '/music') {
      return location.pathname === '/music' || location.pathname === '/music/';
    }
    return location.pathname.startsWith(path);
  };

  const sidebarContent = (
    <div 
      className="w-[230px] h-full bg-[#121212] text-[#a3a3a3] flex flex-col justify-between select-none border-r border-[#1a1a1a]"
      style={{ fontFamily: 'var(--bitchord-font)' }}
    >
      
      {/* Top Section */}
      <div className="p-4 space-y-4 overflow-y-auto no-scrollbar">
        
        {/* Xainy Music Brand Header with 3-curve wavy equalizer icon */}
        <div className="flex items-center justify-between px-1 pt-1 pb-1">
          <Link 
            to="/music" 
            className="flex items-center gap-2.5 group cursor-pointer"
            onClick={onCloseMobile}
          >
            <div className="flex items-center justify-center w-7 h-7 rounded-xl bg-gradient-to-br from-violet-600 via-fuchsia-500 to-pink-500 shadow-lg shadow-fuchsia-500/30 ring-1 ring-white/20">
              <Music2 className="w-4 h-4 text-white" strokeWidth={2.4} />
            </div>
            <span className="font-bold text-lg text-white tracking-tight">
              Xainy Music
            </span>
          </Link>
        </div>

        {/* Main Nav (Search, Home, New, Radio) */}
        <div className="space-y-0.5">
          {navLinks.map(link => {
            const isCurrent = isCurrentPath(link.path);
            const Icon = link.icon;

            return (
              <Link
                key={link.path}
                to={link.path}
                onClick={onCloseMobile}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-colors duration-150 cursor-pointer ${
                  isCurrent
                    ? 'bg-[#282828] text-[#ffffff]'
                    : 'text-[#a3a3a3] hover:text-[#ffffff] hover:bg-[#1a1a1a]'
                }`}
              >
                <Icon 
                  className={`w-4 h-4 shrink-0 ${
                    isCurrent ? 'text-white' : 'text-[#a3a3a3]'
                  }`} 
                />
                <span className="truncate">{link.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Listen Together Action Button */}
        <div className="pt-1">
          <button
            type="button"
            onClick={() => {
              if (onOpenListenTogether) onOpenListenTogether();
              if (onCloseMobile) onCloseMobile();
            }}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold bg-[#1a1a1a] hover:bg-[#222222] border border-white/5 text-white/90 hover:text-white transition-all cursor-pointer shadow-sm group"
          >
            <div className="flex items-center gap-2.5">
              <Users className="w-4 h-4 text-purple-400 group-hover:scale-110 transition-transform" />
              <span>Listen Together</span>
            </div>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300">
              Live
            </span>
          </button>
        </div>

        {/* Library Section */}
        <div className="space-y-1 pt-1">
          <p className="px-3 text-[11px] font-medium text-[#777777] uppercase tracking-wider">
            Library
          </p>
          <div className="space-y-0.5 pt-1">
            {libraryLinks.map(link => {
              const isCurrent = isCurrentPath(link.path);
              const Icon = link.icon;

              return (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={onCloseMobile}
                  className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-colors duration-150 cursor-pointer ${
                    isCurrent
                      ? 'bg-[#282828] text-[#ffffff]'
                      : 'text-[#a3a3a3] hover:text-[#ffffff] hover:bg-[#1a1a1a]'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isCurrent ? 'text-white' : 'text-[#a3a3a3]'}`} />
                  <span className="truncate">{link.label}</span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* YouTube Music playlists (live from the signed-in library) */}
        {authStatus === 'authenticated' && (
          <div className="space-y-1 pt-2 border-t border-white/5">
            <p className="px-3 text-[11px] font-medium text-[#777777] uppercase tracking-wider">
              Playlists
            </p>
            <div className="space-y-0.5 pt-1">
              <Link
                to="/music/library/playlists"
                onClick={onCloseMobile}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-colors duration-150 cursor-pointer ${
                  location.pathname === '/music/library/playlists'
                    ? 'bg-[#282828] text-white'
                    : 'text-[#a3a3a3] hover:text-white hover:bg-[#1a1a1a]'
                }`}
              >
                <LayoutList className="w-4 h-4 shrink-0" />
                <span className="truncate">All Playlists</span>
              </Link>
              {(libraryPlaylists ?? []).slice(0, 8).map(pl => {
                const path = `/music/playlist/${pl.id}`;
                const isCurrent = location.pathname === path;
                return (
                  <Link
                    key={pl.id}
                    to={path}
                    onClick={onCloseMobile}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-colors duration-150 cursor-pointer ${
                      isCurrent ? 'bg-[#282828] text-white' : 'text-[#a3a3a3] hover:text-white hover:bg-[#1a1a1a]'
                    }`}
                  >
                    <ListMusic className="w-4 h-4 shrink-0" />
                    <span className="truncate">{pl.title}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Spotify Playlists entry */}
        <div className="space-y-1 pt-2 border-t border-white/5">
          <Link
            to="/music/spotify"
            onClick={onCloseMobile}
            className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-colors duration-150 cursor-pointer ${
              location.pathname.startsWith('/music/spotify')
                ? 'bg-[#282828] text-white'
                : 'text-[#a3a3a3] hover:text-white hover:bg-[#1a1a1a]'
            }`}
          >
            <Music2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span className="truncate">Spotify Playlists</span>
          </Link>
        </div>

        {/* Phase 3: Spotify Playlists in Sidebar */}
        {spotifyPlaylists && spotifyPlaylists.length > 0 && (
          <div className="space-y-1 pt-2 border-t border-white/5">
            <p className="px-3 text-[11px] font-medium text-[#777777] uppercase tracking-wider flex items-center gap-1.5">
              <Music className="w-3 h-3 text-emerald-400" />
              <span>Spotify Playlists</span>
            </p>
            <div className="flex flex-col gap-1 mt-1">
              {spotifyPlaylists.map((playlist: any) => (
                <Link 
                  className="text-[#a3a3a3] hover:text-white hover:bg-[#1a1a1a] px-3 py-2 rounded-md truncate text-xs transition-colors" 
                  key={playlist.id} 
                  to={`/music/spotify/${playlist.id}`}
                  onClick={onCloseMobile}
                >
                  {playlist.name}
                </Link>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Bottom Section */}
      <div className="p-3 space-y-2 border-t border-[#1a1a1a] bg-[#121212] relative">
        
        {/* ========================================================================= */}
        {/* Phase 2: User Profile Popover (Account Switcher & Alt Accounts)           */}
        {/* ========================================================================= */}
        <div className="relative" ref={popoverRef}>
          
          {/* Profile Trigger Button */}
          <div 
            onClick={handleOpenAccountPopover}
            className="flex items-center justify-between px-3 py-2 rounded-xl bg-[#1a1a1a] hover:bg-[#242424] text-xs font-medium text-white cursor-pointer transition-colors shadow-sm"
            title="Switch YouTube Music Account"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <img 
                src={activeUser.avatar} 
                alt={activeUser.name} 
                className="w-7 h-7 rounded-full object-cover ring-1 ring-white/20 shrink-0"
              />
              <div className="flex flex-col min-w-0">
                <span className="truncate font-semibold text-white text-xs">{activeUser.name}</span>
                <span className="truncate text-[10px] text-[#a3a3a3]">{activeUser.handle || 'YouTube Music'}</span>
              </div>
            </div>
            <ChevronsUpDown className="w-3.5 h-3.5 text-[#a3a3a3] shrink-0 ml-1" />
          </div>

          {/* Popover Card */}
          {showAccountPopover && (
            <div className="absolute left-0 bottom-full mb-2 w-64 bg-[#181818] border border-white/10 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-3 py-2 border-b border-white/10 mb-1">
                <p className="text-xs font-bold text-white">Switch YouTube Account</p>
                <p className="text-[11px] text-[#a3a3a3]">Select an active channel or alt account</p>
              </div>

              {/* Account list with nested channel mapping */}
              <div className="account-list max-h-56 overflow-y-auto space-y-1 py-1">
                {isLoadingAccounts ? (
                  <div className="p-4 text-center text-xs text-[#a3a3a3]">
                    Loading channels...
                  </div>
                ) : channels.length > 0 ? (
                  channels.map((channel: any) => {
                    const isSelected = activeUser.id === channel.id;

                    return (
                      <div 
                        key={channel.id} 
                        onClick={() => handleAccountSelect(channel.id)}
                        className={`flex items-center justify-between gap-3 p-2.5 hover:bg-[#282828] cursor-pointer rounded-xl transition-colors ${
                          isSelected ? 'bg-white/10' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img 
                            src={channel.avatarUrl || channel.photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=80&q=80'} 
                            alt={channel.name} 
                            className="w-8 h-8 rounded-full object-cover shrink-0" 
                          />
                          <div className="flex flex-col min-w-0">
                            <span className="text-white font-semibold text-xs truncate">{channel.name}</span>
                            <span className="text-[#a3a3a3] text-[10px] truncate">{channel.handle || 'YouTube Music'}</span>
                          </div>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-white shrink-0" />}
                      </div>
                    );
                  })
                ) : (
                  <div className="p-3 text-center text-xs text-[#a3a3a3]">
                    No accounts found in extension session.
                  </div>
                )}
              </div>

              {/* Disconnect Button */}
              <div className="pt-2 border-t border-white/10 mt-1">
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-[#a3a3a3] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Disconnect from Xainy Music</span>
                </button>
              </div>

            </div>
          )}

        </div>

        {/* Xainy Music Extension Status */}
        <div 
          onClick={() => {
            if (!extensionConnected) {
              window.open('https://chromewebstore.google.com/detail/bitchord-companion/pkddffeebcmhhanjcigilehaeonkkfih', '_blank');
            }
          }}
          className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium bg-[#161616] hover:bg-[#1a1a1a] text-[#a3a3a3] hover:text-white transition-colors cursor-pointer"
          title={extensionConnected ? 'Xainy Music Extension Active (Full YouTube Engine)' : 'Click to install Xainy Music Companion Extension'}
        >
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="text-xs">Xainy Music Extension</span>
          </div>
          <span 
            className={`w-2 h-2 rounded-full ${
              extensionConnected ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-emerald-400/80 ring-2 ring-emerald-400/20'
            }`} 
            title={extensionConnected ? 'Connected' : 'Companion Active'}
          />
        </div>

        {/* Settings & Debug */}
        <div className="flex items-center justify-end px-2 pt-1">
          <div className="flex items-center gap-1">
            <Link 
              to="/music/debug"
              onClick={onCloseMobile}
              className="p-1 rounded-lg text-[#777777] hover:text-white transition-colors cursor-pointer"
              title="Extension Debug Inspector"
            >
              <Terminal className="w-3.5 h-3.5" />
            </Link>
            <Link 
              to="/music/settings"
              onClick={onCloseMobile}
              className="p-1 rounded-lg text-[#777777] hover:text-white transition-colors cursor-pointer"
              title="Settings"
            >
              <Settings className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Cinema Switcher — prominent card so it's easy to spot */}
        <Link
          to="/"
          className="flex items-center justify-between gap-2 w-full px-3.5 py-3 rounded-2xl bg-gradient-to-r from-violet-600/20 via-fuchsia-600/10 to-transparent hover:from-violet-600/30 border border-violet-500/25 hover:border-violet-400/50 text-white transition-all group cursor-pointer"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/30 shrink-0 group-hover:scale-105 transition-transform">
              <Film className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-white truncate">StreamHub Cinema</p>
              <p className="text-[10px] text-white/50">Movies, shows & sports</p>
            </div>
          </div>
          <ExternalLink className="w-3.5 h-3.5 text-white/40 group-hover:text-white/80 transition-colors shrink-0" />
        </Link>

      </div>

    </div>
  );

  return (
    <>
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden lg:block w-[230px] shrink-0 h-full z-30">
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar Overlay Drawer */}
      {isOpenOnMobile && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div 
            onClick={onCloseMobile}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm animate-fade-in" 
          />
          <div className="relative z-10 animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;

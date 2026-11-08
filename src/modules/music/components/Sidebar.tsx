import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Search, Home, LayoutGrid, Clock, Mic2, Disc, Music2, 
  UserCheck, Sparkles, Settings, ExternalLink, ChevronsUpDown,
  Film, Users, Youtube, Radio, LogOut, Check, Music
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMusicPlayerStore } from '../store/useMusicPlayerStore';
import { extensionBridge, BitChordExtensionBridge } from '../extension/bridge';

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
  const activeAccount = useMusicPlayerStore(state => state.activeAccount);
  const setActiveAccount = useMusicPlayerStore(state => state.setActiveAccount);

  // Popover state
  const [showAccountPopover, setShowAccountPopover] = useState(false);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
  const [accountsList, setAccountsList] = useState<any[]>([]);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  // Active channel presentation
  const [activeUser, setActiveUser] = useState<{ id: string; name: string; avatar: string; handle?: string }>({
    id: 'channel_primary',
    name: 'anas',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=80&q=80',
    handle: 'YouTube Music',
  });

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
            BitChordExtensionBridge.EXTENSION_ID,
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

  // Load saved active account
  useEffect(() => {
    try {
      const saved = localStorage.getItem('bitchord_active_account');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.name) {
          setActiveUser({
            id: parsed.id || 'channel_primary',
            name: parsed.name,
            avatar: parsed.avatarUrl || parsed.photoUrl || parsed.avatar || activeUser.avatar,
            handle: parsed.handle || 'YouTube Music',
          });
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (activeAccount?.name) {
      setActiveUser({
        id: activeAccount.id || 'channel_primary',
        name: activeAccount.name,
        avatar: activeAccount.avatarUrl || activeAccount.photoUrl || activeAccount.avatar || activeUser.avatar,
        handle: activeAccount.handle || 'YouTube Music',
      });
    }
  }, [activeAccount]);

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

  // =========================================================================
  // Phase 2: Fetch Accounts with Nested Channel Mapping on Popover Open
  // =========================================================================
  const handleOpenAccountPopover = async () => {
    const nextState = !showAccountPopover;
    setShowAccountPopover(nextState);

    if (nextState) {
      setIsLoadingAccounts(true);
      try {
        const res = await extensionBridge.sendExtensionMessage('yt.authState', { refresh: true });
        if (res && (res.accounts || res.result?.accounts)) {
          const rawAccounts = res.accounts || res.result?.accounts || [];
          setAccountsList(rawAccounts);
        } else {
          // Fallback to bridge getAuthState
          const auth = await extensionBridge.getAuthState(true);
          setAccountsList(auth.accounts || []);
        }
      } catch (e) {
        console.debug('Failed to fetch auth accounts:', e);
      } finally {
        setIsLoadingAccounts(false);
      }
    }
  };

  // Nested Channel Mapping: flatten accounts -> channels
  const allChannels: any[] = accountsList.flatMap((account: any) => {
    if (account.channels && Array.isArray(account.channels) && account.channels.length > 0) {
      return account.channels.map((ch: any) => ({
        ...ch,
        avatarUrl: ch.avatarUrl || ch.photoUrl || account.photoUrl || account.avatarUrl,
      }));
    }
    return [account];
  });

  // Account Selection Handler
  const handleAccountSelect = async (channelId: string, channelObj?: any) => {
    try {
      await extensionBridge.sendExtensionMessage('yt.selectChannel', { channelId });
    } catch {}

    const selected = channelObj || allChannels.find(c => c.id === channelId);
    if (selected) {
      const newActive = {
        id: selected.id,
        name: selected.name,
        avatar: selected.avatarUrl || selected.photoUrl || activeUser.avatar,
        handle: selected.handle || 'YouTube Music',
      };
      setActiveUser(newActive);
      setActiveAccount(newActive);
      try {
        localStorage.setItem('bitchord_active_account', JSON.stringify(newActive));
        localStorage.setItem('bitchord_selected_channel_id', channelId);
      } catch {}
    }

    // Instantly invalidate queries to auto-sync the new user's library
    queryClient.invalidateQueries();
    setShowAccountPopover(false);
  };

  const handleDisconnect = () => {
    try {
      localStorage.removeItem('bitchord_active_account');
      localStorage.removeItem('bitchord_selected_channel_id');
    } catch {}
    setActiveUser({
      id: 'disconnected',
      name: 'Guest User',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=80&q=80',
      handle: 'Not Connected',
    });
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
      className="w-[230px] h-screen bg-[#121212] text-[#a3a3a3] flex flex-col justify-between select-none border-r border-[#1a1a1a]"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      
      {/* Top Section */}
      <div className="p-4 space-y-4 overflow-y-auto no-scrollbar">
        
        {/* BitChord Brand Header with 3-curve wavy equalizer icon */}
        <div className="flex items-center justify-between px-1 pt-1 pb-1">
          <Link 
            to="/music" 
            className="flex items-center gap-2.5 group cursor-pointer"
            onClick={onCloseMobile}
          >
            <div className="flex items-center justify-center">
              <svg 
                className="w-6 h-6 text-white group-hover:text-white/80 transition-colors" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2.3" 
                strokeLinecap="round"
              >
                <path d="M4 7c3-2 6 2 9 0s5-1 7-1" />
                <path d="M4 12c3-2 6 2 9 0s5-1 7-1" />
                <path d="M4 17c3-2 6 2 9 0s5-1 7-1" />
              </svg>
            </div>
            <span className="font-bold text-lg text-white tracking-tight">
              BitChord
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
                  to={`/music/playlist/${playlist.id}`}
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
                ) : allChannels.length > 0 ? (
                  allChannels.map((channel: any) => {
                    const isSelected = activeUser.id === channel.id || activeUser.name === channel.name;

                    return (
                      <div 
                        key={channel.id} 
                        onClick={() => handleAccountSelect(channel.id, channel)}
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
                        {isSelected && <Check className="w-3.5 h-3.5 text-rose-400 shrink-0" />}
                      </div>
                    );
                  })
                ) : (
                  <div className="p-3 text-center text-xs text-[#a3a3a3]">
                    No accounts found in extension session.
                  </div>
                )}
              </div>

              {/* Red Disconnect Button */}
              <div className="pt-2 border-t border-white/10 mt-1">
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Disconnect from BitChord</span>
                </button>
              </div>

            </div>
          )}

        </div>

        {/* BitChord Extension Status */}
        <div 
          onClick={() => {
            if (!extensionConnected) {
              window.open('https://chromewebstore.google.com/detail/bitchord-companion/pkddffeebcmhhanjcigilehaeonkkfih', '_blank');
            }
          }}
          className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium bg-[#161616] hover:bg-[#1a1a1a] text-[#a3a3a3] hover:text-white transition-colors cursor-pointer"
          title={extensionConnected ? 'BitChord Extension Active (Full YouTube Engine)' : 'Click to install BitChord Companion Extension'}
        >
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="text-xs">BitChord Extension</span>
          </div>
          <span 
            className={`w-2 h-2 rounded-full ${
              extensionConnected ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-emerald-400/80 ring-2 ring-emerald-400/20'
            }`} 
            title={extensionConnected ? 'Connected' : 'Companion Active'}
          />
        </div>

        {/* Get Android App & Settings */}
        <div className="flex items-center justify-between px-2 pt-1">
          <a
            href="https://github.com/anassar12jS/bitchord"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-medium text-[#777777] hover:text-white flex items-center gap-1 transition-colors"
          >
            <span>Get the Android app</span>
            <span className="text-xs">↗</span>
          </a>

          <Link 
            to="/music/settings"
            onClick={onCloseMobile}
            className="p-1 rounded-lg text-[#777777] hover:text-white transition-colors cursor-pointer"
            title="Settings"
          >
            <Settings className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Cinema Switcher */}
        <Link
          to="/"
          className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[#777777] hover:text-white text-[10px] font-bold uppercase tracking-wider transition-colors"
        >
          <Film className="w-3 h-3 text-purple-400" />
          <span>StreamHub Cinema</span>
        </Link>

      </div>

    </div>
  );

  return (
    <>
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden lg:block w-[230px] shrink-0 h-screen sticky top-0 z-30">
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

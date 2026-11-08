import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Search, Home, LayoutGrid, Clock, Mic2, Disc, Music2, 
  UserCheck, Sparkles, Settings, ExternalLink, ChevronsUpDown,
  Film, CheckCircle2, AlertCircle, Users, Youtube
} from 'lucide-react';
import { useMusicPlayerStore } from '../store/useMusicPlayerStore';

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
  onOpenYouTubeLink,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState('');
  const extensionConnected = useMusicPlayerStore(state => state.extensionConnected);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchInput.trim();
    if (q) {
      navigate(`/music/search?q=${encodeURIComponent(q)}`);
    } else {
      navigate('/music/search');
    }
    if (onCloseMobile) onCloseMobile();
  };

  const navLinks = [
    { path: '/music/search', label: 'Search', icon: Search },
    { path: '/music', label: 'Home', icon: Home, highlight: true },
    { path: '/music/browse', label: 'New', icon: LayoutGrid },
    { path: '/music/radio', label: 'Radio', icon: Disc },
  ];

  const libraryLinks = [
    { path: '/music/library/recent', label: 'Recently Played', icon: Clock },
    { path: '/music/library/artists', label: 'Artists', icon: Mic2 },
    { path: '/music/library/albums', label: 'Albums', icon: Disc },
    { path: '/music/library/songs', label: 'Songs', icon: Music2 },
    { path: '/music/replay', label: "Replay '25", icon: Sparkles, highlight: true },
    { path: '/music/library/for-you', label: 'Made for You', icon: UserCheck },
  ];

  const isCurrentPath = (path: string) => {
    if (path === '/music') {
      return location.pathname === '/music' || location.pathname === '/music/';
    }
    return location.pathname.startsWith(path);
  };

  const sidebarContent = (
    <div className="w-[230px] h-screen bg-[#161616] text-[#e1e1e3] flex flex-col justify-between select-none border-r border-[#242426]">
      
      {/* Top Section */}
      <div className="p-4 space-y-5">
        
        {/* BitChord Brand Header with 3-curve wavy equalizer icon */}
        <div className="flex items-center justify-between px-1 pt-1">
          <Link 
            to="/music" 
            className="flex items-center gap-2.5 group cursor-pointer"
            onClick={onCloseMobile}
          >
            <div className="flex items-center justify-center">
              <svg 
                className="w-6 h-6 text-white group-hover:text-rose-400 transition-colors" 
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

        {/* Search Input */}
        <form onSubmit={handleSearchSubmit}>
          <div className="relative flex items-center bg-[#202022] focus-within:bg-[#28282b] border border-transparent focus-within:border-white/20 rounded-xl px-2.5 py-1.5 transition-all">
            <Search className="w-4 h-4 text-white/50 mr-2 shrink-0 pointer-events-none" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search..."
              className="w-full bg-transparent border-0 outline-none text-xs text-white placeholder-white/40 font-medium"
            />
          </div>
        </form>

        {/* Main Nav (Search, Home, New) */}
        <div className="space-y-0.5">
          {navLinks.map(link => {
            const isCurrent = isCurrentPath(link.path);
            const Icon = link.icon;

            return (
              <Link
                key={link.path}
                to={link.path}
                onClick={onCloseMobile}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                  isCurrent
                    ? 'bg-[#242426] text-white font-semibold'
                    : 'text-white/60 hover:text-white hover:bg-[#202022]/60'
                }`}
              >
                <Icon 
                  className={`w-4 h-4 shrink-0 ${
                    isCurrent ? (link.highlight ? 'text-[#fa243c]' : 'text-white') : 'text-white/60'
                  }`} 
                />
                <span className="truncate">{link.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Listen Together Action Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => {
              if (onOpenListenTogether) onOpenListenTogether();
              if (onCloseMobile) onCloseMobile();
            }}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-purple-900/40 to-indigo-900/40 hover:from-purple-800/50 hover:to-indigo-800/50 border border-purple-500/20 text-purple-200 transition-all cursor-pointer shadow-sm group"
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
        <div className="space-y-1 pt-2">
          <p className="px-3 text-[11px] font-semibold text-white/40">
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
                  className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                    isCurrent
                      ? 'bg-[#242426] text-white font-semibold'
                      : 'text-white/60 hover:text-white hover:bg-[#202022]/60'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${link.highlight ? 'text-[#fa243c]' : 'text-white/60'}`} />
                  <span className="truncate">{link.label}</span>
                </Link>
              );
            })}
          </div>
        </div>

      </div>

      {/* Bottom Section */}
      <div className="p-3 space-y-2 border-t border-[#242426]/70 bg-[#161616]">
        
        {/* Link YouTube Music Button */}
        <div 
          onClick={onOpenYouTubeLink}
          className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold bg-red-950/30 hover:bg-red-900/40 border border-red-500/20 text-red-200 transition-colors cursor-pointer group shadow-sm"
          title="Connect YouTube Music to sync library"
        >
          <div className="flex items-center gap-2.5">
            <Youtube className="w-4 h-4 text-red-500 fill-current group-hover:scale-110 transition-transform" />
            <span>YouTube Music</span>
          </div>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-red-500/20 text-red-300">
            Sync
          </span>
        </div>

        {/* BitChord Extension Status */}
        <div 
          onClick={() => {
            if (!extensionConnected) {
              window.open('https://chromewebstore.google.com/detail/bitchord-companion/pkddffeebcmhhanjcigilehaeonkkfih', '_blank');
            }
          }}
          className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium bg-[#1e1e20] hover:bg-[#262629] text-white/80 hover:text-white transition-colors cursor-pointer"
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

        {/* User Account Row */}
        <div 
          onClick={onOpenSettings}
          className="flex items-center justify-between px-3 py-2 rounded-xl bg-[#1e1e20] text-xs font-medium text-white/90 cursor-pointer hover:bg-[#262629] transition-colors"
          title="Account & Settings"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <img 
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=80&q=80" 
              alt="anas" 
              className="w-6 h-6 rounded-full object-cover ring-1 ring-white/20"
            />
            <span className="truncate font-semibold text-white">anas</span>
          </div>
          <ChevronsUpDown className="w-3.5 h-3.5 text-white/40" />
        </div>

        {/* Get Android App & Settings */}
        <div className="flex items-center justify-between px-2 pt-1">
          <a
            href="https://github.com/anassar12jS/bitchord"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-medium text-white/50 hover:text-white flex items-center gap-1 transition-colors"
          >
            <span>Get the Android app</span>
            <span className="text-xs">↗</span>
          </a>

          <button 
            type="button"
            onClick={onOpenSettings}
            className="p-1 rounded-lg text-white/50 hover:text-white transition-colors cursor-pointer"
            title="Settings"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Cinema Switcher */}
        <Link
          to="/"
          className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white text-[10px] font-bold uppercase tracking-wider transition-colors"
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

      {/* Mobile Drawer */}
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

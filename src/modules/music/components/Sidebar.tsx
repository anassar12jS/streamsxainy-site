import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Search, Compass, Radio, Clock, Heart, Users, Disc, Music2, 
  ListMusic, Film, ArrowLeft, Plus, ExternalLink, Sparkles
} from 'lucide-react';
import { useMusicPlayerStore } from '../store/useMusicPlayerStore';

interface SidebarProps {
  isOpenOnMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpenOnMobile = false,
  onCloseMobile,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState('');
  const likedTrackIds = useMusicPlayerStore(state => state.likedTrackIds);

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

  const navSections = [
    {
      title: 'Apple Music',
      links: [
        { path: '/music', label: 'Listen Now / Browse', icon: Compass },
        { path: '/music/radio', label: 'Radio & Live Stations', icon: Radio },
      ],
    },
    {
      title: 'Library',
      links: [
        { path: '/music/library', label: 'Recently Added', icon: Clock },
        { path: '/music/library/liked', label: `Liked Songs (${likedTrackIds.length})`, icon: Heart },
        { path: '/music/library/artists', label: 'Artists', icon: Users },
        { path: '/music/library/albums', label: 'Albums', icon: Disc },
        { path: '/music/library/songs', label: 'Songs', icon: Music2 },
      ],
    },
  ];

  const sidebarContent = (
    <div className="w-[240px] h-full bg-[#161618] border-r border-white/10 flex flex-col justify-between select-none">
      
      {/* Top Brand & Search */}
      <div className="p-4 space-y-4">
        
        {/* Brand Header */}
        <div className="flex items-center justify-between">
          <Link 
            to="/music" 
            className="flex items-center gap-2.5 group cursor-pointer"
            onClick={onCloseMobile}
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#fa243c] to-[#d60067] flex items-center justify-center shadow-md shadow-[#fa243c]/20 group-hover:scale-105 transition-transform">
              <Music2 className="w-4 h-4 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="font-black text-sm text-white tracking-tight leading-none flex items-center gap-1">
                <span>Apple</span>
                <span className="text-[#fa243c]">Music</span>
              </span>
              <span className="text-[9px] font-mono text-white/40 tracking-wider uppercase mt-0.5">
                BitChord Web
              </span>
            </div>
          </Link>
        </div>

        {/* Search Field */}
        <form onSubmit={handleSearchSubmit}>
          <div className="relative flex items-center bg-[#242426] focus-within:bg-[#2c2c2e] border border-white/10 focus-within:border-[#fa243c]/70 rounded-xl px-2.5 py-1.5 transition-all shadow-inner">
            <Search className="w-3.5 h-3.5 text-white/40 mr-2 shrink-0 pointer-events-none" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search..."
              className="w-full bg-transparent border-0 outline-none text-xs text-white placeholder-white/40 font-medium"
            />
          </div>
        </form>

        {/* Navigation Categories */}
        <div className="space-y-4 pt-1">
          {navSections.map(sec => (
            <div key={sec.title} className="space-y-1">
              <p className="px-2.5 text-[10px] font-bold uppercase tracking-wider text-white/40 font-mono">
                {sec.title}
              </p>
              {sec.links.map(link => {
                const isCurrent = location.pathname === link.path || (link.path === '/music' && location.pathname === '/music/');
                const Icon = link.icon;

                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    onClick={onCloseMobile}
                    className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      isCurrent
                        ? 'bg-[#fa243c] text-white shadow-md shadow-[#fa243c]/25'
                        : 'text-white/70 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isCurrent ? 'text-white' : 'text-[#fa243c]'}`} />
                    <span className="truncate">{link.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </div>

      </div>

      {/* Bottom: Return to Cinema Hub */}
      <div className="p-4 border-t border-white/10 space-y-2 bg-[#121214]/60">
        <Link
          to="/"
          className="flex items-center justify-between w-full px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-xs font-bold transition-all border border-white/5 cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Film className="w-3.5 h-3.5 text-purple-400" />
            <span>Return to Cinema</span>
          </div>
          <ArrowLeft className="w-3.5 h-3.5 rotate-180 text-white/40" />
        </Link>
      </div>

    </div>
  );

  return (
    <>
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden lg:block w-[240px] shrink-0 h-[calc(100vh-56px)] sticky top-[56px] z-20">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {isOpenOnMobile && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div 
            onClick={onCloseMobile}
            className="fixed inset-0 bg-black/75 backdrop-blur-sm animate-fade-in" 
          />
          <div className="relative z-10 animate-in slide-in-from-left duration-250">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};

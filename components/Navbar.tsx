import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  Search, Film, Menu, X, Settings, Bookmark, Trophy, 
  Compass, Sun, Moon, Ghost, Tv2, Command, Home,
  Github, Instagram, Sparkles, ExternalLink, Flame, Shield,
  Layers, ChevronRight, Play, Radio
} from 'lucide-react';
import { CommandSearchModal } from './CommandSearchModal';
import { TMDBResult, MediaType } from '../types';
import { preloadRoute } from '../services/routePreloader';
import { getWatchlist } from '../services/storage';

interface NavbarProps {
  onOpenSettings: () => void;
  currentMode: 'light' | 'dark';
  onToggleMode: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenSettings, currentMode, onToggleMode }) => {
  const [query, setQuery] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [watchlistCount, setWatchlistCount] = useState(0);

  const navigate = useNavigate();
  const location = useLocation();
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Scroll listener for glassmorphism elevation
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 15);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Update watchlist count
  useEffect(() => {
    const updateCount = () => {
      try {
        const list = getWatchlist();
        setWatchlistCount(Array.isArray(list) ? list.length : 0);
      } catch {
        setWatchlistCount(0);
      }
    };
    updateCount();
    window.addEventListener('storage', updateCount);
    return () => window.removeEventListener('storage', updateCount);
  }, [location.pathname]);

  // Listen for Cmd+K / Ctrl+K / '/' keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandOpen(prev => !prev);
      } else if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        setIsCommandOpen(true);
      } else if (e.key === 'Escape' && isSidebarOpen) {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSidebarOpen]);

  // Lock body scroll when sidebar is open on mobile
  useEffect(() => {
    if (isSidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isSidebarOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (trimmed) {
      navigate(`/search?q=${encodeURIComponent(trimmed)}`);
    } else {
      navigate('/search');
    }
    setIsSidebarOpen(false);
  };

  const handleCommandSelect = (item: TMDBResult) => {
    const state = { item };
    if (item.media_type === MediaType.MOVIE) {
      navigate(`/movie/${item.id}`, { state });
    } else if (item.media_type === MediaType.TV) {
      navigate(`/tv/${item.id}`, { state });
    } else {
      if (item.title) navigate(`/movie/${item.id}`, { state });
      else if (item.name) navigate(`/tv/${item.id}`, { state });
      else navigate(`/movie/${item.id}`, { state });
    }
  };

  const navLinks = [
    { 
      path: '/', 
      label: 'Home', 
      icon: Home, 
      color: 'text-purple-400',
      description: 'Spotlights, trending releases & continue watching'
    },
    { 
      path: '/discover', 
      label: 'Discover', 
      icon: Compass,
      color: 'text-cyan-400',
      description: 'Filter films and series by provider, genre & year'
    },
    { 
      path: '/anime', 
      label: 'Anime', 
      icon: Ghost, 
      color: 'text-pink-400',
      badge: 'HOT',
      badgeColor: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
      description: 'Subbed & dubbed anime series, OVAs and rankings'
    },
    { 
      path: '/sports', 
      label: 'Sports', 
      icon: Trophy, 
      color: 'text-amber-400',
      badge: 'LIVE',
      badgeColor: 'bg-red-500/20 text-red-400 border-red-500/30',
      pulse: true,
      description: 'Live match streams, scores, fixtures & standings'
    },
    { 
      path: '/livetv', 
      label: 'Live TV', 
      icon: Tv2, 
      color: 'text-emerald-400',
      badge: '24/7',
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      description: 'Global live broadcast channels and streams'
    },
    { 
      path: '/library', 
      label: 'Library', 
      icon: Bookmark,
      color: 'text-blue-400',
      badge: watchlistCount > 0 ? `${watchlistCount}` : undefined,
      badgeColor: 'bg-[rgb(var(--primary-color))]/20 text-[rgb(var(--primary-color))] border-[rgb(var(--primary-color))]/30',
      description: 'Your saved favorites, watchlist and watch history'
    },
  ];

  const quickGenres = [
    { id: 28, name: 'Action', color: 'hover:border-red-500/40 hover:text-red-400' },
    { id: 878, name: 'Sci-Fi', color: 'hover:border-cyan-500/40 hover:text-cyan-400' },
    { id: 18, name: 'Drama', color: 'hover:border-purple-500/40 hover:text-purple-400' },
    { id: 35, name: 'Comedy', color: 'hover:border-amber-500/40 hover:text-amber-400' },
    { id: 27, name: 'Horror', color: 'hover:border-rose-500/40 hover:text-rose-400' },
    { id: 16, name: 'Animation', color: 'hover:border-pink-500/40 hover:text-pink-400' },
  ];

  return (
    <>
      {/* ========================================================================= */}
      {/* 1. TOP NAVBAR                                                             */}
      {/* ========================================================================= */}
      <nav 
        aria-label="Main navigation" 
        className={`sticky top-0 z-40 transition-all duration-300 ${
          isScrolled 
            ? 'bg-[var(--bg-main)]/95 backdrop-blur-2xl border-b border-[var(--border-subtle)] shadow-xl shadow-black/20 py-2.5' 
            : 'bg-[var(--bg-main)]/85 backdrop-blur-md border-b border-[var(--border-subtle)]/60 py-3'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-3 sm:gap-4">
            
            {/* Logo */}
            <Link 
              to="/" 
              className="flex items-center cursor-pointer group shrink-0 select-none"
              title="StreamHub Home"
            >
              <div className="h-9 w-9 bg-gradient-to-tr from-[rgb(var(--primary-color))] via-indigo-600 to-pink-500 rounded-xl flex items-center justify-center mr-2.5 shadow-lg shadow-[rgb(var(--primary-color))]/30 group-hover:scale-105 group-hover:shadow-[rgb(var(--primary-color))]/50 transition-all">
                <Film className="h-5 w-5 text-white transform group-hover:rotate-6 transition-transform" />
              </div>
              <div className="flex flex-col">
                <span className="font-black text-xl text-[var(--text-main)] tracking-tight leading-none">
                  Stream<span className="text-[rgb(var(--primary-color))]">Hub</span>
                </span>
                <span className="text-[9px] font-mono font-bold tracking-wider uppercase text-[var(--text-muted)] group-hover:text-[rgb(var(--primary-color))] transition-colors">
                  Pro Cinema
                </span>
              </div>
            </Link>

            {/* Desktop Navigation Links */}
            <div className="hidden lg:flex items-center gap-1">
              {navLinks.map(link => {
                const isCurrent = location.pathname === link.path;
                const Icon = link.icon;
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    onPointerEnter={() => preloadRoute(link.path)}
                    onFocus={() => preloadRoute(link.path)}
                    aria-current={isCurrent ? 'page' : undefined}
                    className={`px-3 py-2 rounded-xl text-xs sm:text-[13px] font-bold transition-all relative flex items-center gap-1.5 cursor-pointer ${
                      isCurrent
                        ? 'text-white bg-[rgb(var(--primary-color))] shadow-md shadow-[rgb(var(--primary-color))]/25'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
                    }`}
                  >
                    {Icon && <Icon className={`w-4 h-4 ${isCurrent ? 'text-white' : link.color || ''}`} />}
                    <span>{link.label}</span>

                    {/* Live / Hot Badges */}
                    {link.badge && (
                      <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded-full border font-bold flex items-center gap-1 ${
                        isCurrent 
                          ? 'bg-white/20 text-white border-white/30' 
                          : link.badgeColor
                      }`}>
                        {link.pulse && <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping" />}
                        <span>{link.badge}</span>
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>

            {/* Quick Search Bar with Spotlight Command Trigger */}
            <div className="hidden md:block w-full max-w-[240px] lg:max-w-[310px]">
              <form onSubmit={handleSubmit} className="w-full">
                <div 
                  onClick={() => setIsCommandOpen(true)}
                  className="relative w-full flex items-center bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] hover:border-[rgb(var(--primary-color))]/50 rounded-xl px-3 py-1.5 transition-all shadow-xs cursor-pointer group"
                >
                  <Search className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[rgb(var(--primary-color))] shrink-0 mr-2 transition-colors pointer-events-none" />
                  <span className="w-full text-[var(--text-muted)] text-xs font-medium select-none truncate">
                    Search movies, shows, anime...
                  </span>
                  <div className="ml-1.5 shrink-0 flex items-center justify-center gap-0.5 text-[10px] font-mono text-[var(--text-muted)] bg-[var(--bg-main)] h-5 px-1.5 rounded-md border border-[var(--border-subtle)] group-hover:border-[rgb(var(--primary-color))]/40 transition-colors">
                    <Command className="w-2.5 h-2.5" />
                    <span>K</span>
                  </div>
                </div>
              </form>
            </div>

            {/* Right Quick Controls */}
            <div className="flex items-center gap-1 sm:gap-1.5">
              
              {/* Mobile Search Icon Trigger */}
              <button
                type="button"
                onClick={() => setIsCommandOpen(true)}
                className="md:hidden p-2 rounded-xl hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
                title="Search (⌘K)"
                aria-label="Open search"
              >
                <Search className="w-5 h-5" />
              </button>

              {/* GitHub Profile */}
              <a
                href="https://github.com/anassar12jS"
                target="_blank"
                rel="noopener noreferrer"
                title="GitHub Profile (@anassar12jS)"
                aria-label="GitHub Profile"
                className="hidden sm:flex p-2 rounded-xl hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
              >
                <Github className="w-4 h-4 sm:w-5 sm:h-5" />
              </a>

              {/* Instagram Profile */}
              <a
                href="https://instagram.com/xainyx_"
                target="_blank"
                rel="noopener noreferrer"
                title="Instagram Profile (@xainyx_)"
                aria-label="Instagram Profile"
                className="hidden sm:flex p-2 rounded-xl hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-pink-400 transition-colors"
              >
                <Instagram className="w-4 h-4 sm:w-5 sm:h-5" />
              </a>

              {/* Theme Toggle Button */}
              <button 
                onClick={onToggleMode}
                aria-label={currentMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                title={currentMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                className="p-2 rounded-xl hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors relative cursor-pointer"
              >
                <div className={`transform transition-transform duration-500 ${currentMode === 'dark' ? 'rotate-0' : 'rotate-180'}`}>
                  {currentMode === 'dark' ? (
                    <Sun className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
                  ) : (
                    <Moon className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-400" />
                  )}
                </div>
              </button>

              {/* Settings Modal Button */}
              <button 
                onClick={onOpenSettings}
                aria-label="Open settings"
                title="Theme Colors & Server Settings"
                className="p-2 rounded-xl hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors cursor-pointer group"
              >
                <Settings className="w-4 h-4 sm:w-5 sm:h-5 group-hover:rotate-45 transition-transform duration-300" />
              </button>

              {/* Sidebar Menu Trigger (Accessible for all screen sizes) */}
              <button
                type="button"
                onClick={() => setIsSidebarOpen(true)}
                aria-label="Open navigation sidebar"
                aria-expanded={isSidebarOpen}
                className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer border border-[var(--border-subtle)] sm:border-transparent flex items-center gap-1.5"
                title="Open Sidebar"
              >
                <Menu className="h-5 w-5 sm:h-5 sm:w-5" />
                <span className="hidden xl:inline text-xs font-bold text-[var(--text-muted)] hover:text-[var(--text-main)]">Menu</span>
              </button>

            </div>
          </div>
        </div>
      </nav>

      {/* ========================================================================= */}
      {/* 2. SLIDE-OUT SIDEBAR DRAWER & BACKDROP                                    */}
      {/* ========================================================================= */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop Blur Overlay */}
          <div 
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 animate-fade-in"
            aria-hidden="true"
          />

          {/* Slide-over Sidebar Container */}
          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div 
              ref={sidebarRef}
              className="w-screen max-w-md bg-[var(--bg-card)]/98 backdrop-blur-2xl border-l border-[var(--border-subtle)] shadow-2xl flex flex-col justify-between overflow-y-auto fancy-scrollbar animate-in slide-in-from-right duration-300"
            >
              
              {/* Top Header */}
              <div>
                <div className="p-5 border-b border-[var(--border-subtle)] flex items-center justify-between gap-3 bg-[var(--bg-main)]/50">
                  <Link 
                    to="/" 
                    onClick={() => setIsSidebarOpen(false)}
                    className="flex items-center gap-3 cursor-pointer group"
                  >
                    <div className="h-10 w-10 bg-gradient-to-tr from-[rgb(var(--primary-color))] via-indigo-600 to-pink-500 rounded-xl flex items-center justify-center shadow-lg shadow-[rgb(var(--primary-color))]/30 group-hover:scale-105 transition-transform">
                      <Film className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h2 className="font-black text-lg text-[var(--text-main)] tracking-tight leading-tight">
                        Stream<span className="text-[rgb(var(--primary-color))]">Hub</span>
                      </h2>
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wider font-semibold">
                          Online Cinema Hub
                        </span>
                      </div>
                    </div>
                  </Link>

                  {/* Close Button */}
                  <button
                    type="button"
                    onClick={() => setIsSidebarOpen(false)}
                    aria-label="Close sidebar"
                    className="p-2 rounded-xl bg-[var(--bg-main)] hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-white border border-[var(--border-subtle)] transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Quick Search in Sidebar */}
                <div className="p-5 pb-3">
                  <form onSubmit={handleSubmit} className="relative">
                    <input
                      type="text"
                      className="w-full bg-[var(--bg-main)] rounded-xl pl-10 pr-9 py-2.5 text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--primary-color))] border border-[var(--border-subtle)] font-medium"
                      placeholder="Search films, anime, live TV..."
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                    <Search className="absolute left-3.5 top-3 h-4 w-4 text-[var(--text-muted)]" />
                    {query && (
                      <button
                        type="button"
                        onClick={() => setQuery('')}
                        className="absolute right-3 top-3 text-[var(--text-muted)] hover:text-white cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </form>
                </div>

                {/* Primary Hub Navigation Links */}
                <div className="px-3 py-2 space-y-1">
                  <div className="px-3 py-1 text-[10px] font-bold tracking-wider uppercase text-[var(--text-muted)]">
                    Main Channels & Stages
                  </div>
                  {navLinks.map(link => {
                    const Icon = link.icon;
                    const isCurrent = location.pathname === link.path;
                    return (
                      <Link
                        key={link.path}
                        to={link.path}
                        onTouchStart={() => preloadRoute(link.path)}
                        onPointerEnter={() => preloadRoute(link.path)}
                        onClick={() => setIsSidebarOpen(false)}
                        className={`group flex items-center justify-between p-3 rounded-2xl transition-all cursor-pointer ${
                          isCurrent
                            ? 'bg-[rgb(var(--primary-color))]/15 border border-[rgb(var(--primary-color))]/30 text-[var(--text-main)] shadow-sm'
                            : 'hover:bg-[var(--bg-hover)] border border-transparent text-[var(--text-main)]'
                        }`}
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className={`p-2 rounded-xl transition-colors ${
                            isCurrent
                              ? 'bg-[rgb(var(--primary-color))] text-white shadow-md'
                              : 'bg-[var(--bg-main)] text-[var(--text-muted)] group-hover:text-white'
                          }`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-bold tracking-tight truncate ${isCurrent ? 'text-[rgb(var(--primary-color))]' : ''}`}>
                                {link.label}
                              </span>
                              {link.badge && (
                                <span className={`text-[9px] font-mono px-2 py-0.2 rounded-full border font-bold flex items-center gap-1 ${link.badgeColor}`}>
                                  {link.pulse && <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping" />}
                                  <span>{link.badge}</span>
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-[var(--text-muted)] truncate max-w-[240px]">
                              {link.description}
                            </p>
                          </div>
                        </div>

                        <ChevronRight className={`w-4 h-4 text-[var(--text-muted)] group-hover:translate-x-1 group-hover:text-white transition-all shrink-0 ${
                          isCurrent ? 'text-[rgb(var(--primary-color))]' : ''
                        }`} />
                      </Link>
                    );
                  })}
                </div>

                {/* Quick Genre Discovery Section */}
                <div className="p-4 mx-3 my-2 rounded-2xl bg-[var(--bg-main)]/50 border border-[var(--border-subtle)]">
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Explore by Genre</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigate('/discover');
                        setIsSidebarOpen(false);
                      }}
                      className="text-[11px] font-bold text-[rgb(var(--primary-color))] hover:underline cursor-pointer"
                    >
                      View all
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {quickGenres.map(genre => (
                      <button
                        key={genre.id}
                        type="button"
                        onClick={() => {
                          navigate(`/discover?type=movie&genre=${genre.id}&genreName=${encodeURIComponent(genre.name)}`);
                          setIsSidebarOpen(false);
                        }}
                        className={`px-2.5 py-1.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[11px] font-semibold text-[var(--text-main)] transition-all cursor-pointer text-center truncate ${genre.color}`}
                      >
                        {genre.name}
                      </button>
                    ))}
                  </div>
                </div>

              </div>

              {/* Sidebar Bottom / Preferences & Socials */}
              <div className="p-5 border-t border-[var(--border-subtle)] bg-[var(--bg-main)]/40 space-y-4">
                
                {/* Mode & Theme Quick Switcher */}
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={onToggleMode}
                    className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-main)] transition-colors cursor-pointer"
                  >
                    {currentMode === 'dark' ? (
                      <>
                        <Sun className="w-4 h-4 text-amber-400" />
                        <span>Light Mode</span>
                      </>
                    ) : (
                      <>
                        <Moon className="w-4 h-4 text-indigo-400" />
                        <span>Dark Mode</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsSidebarOpen(false);
                      onOpenSettings();
                    }}
                    className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-main)] transition-colors cursor-pointer"
                  >
                    <Settings className="w-4 h-4 text-[rgb(var(--primary-color))]" />
                    <span>Settings</span>
                  </button>
                </div>

                {/* Creator Socials */}
                <div className="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)]/60 text-xs">
                  <span className="text-[11px] font-semibold text-[var(--text-muted)]">Connect:</span>
                  <div className="flex items-center gap-2">
                    <a
                      href="https://github.com/anassar12jS"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-main)] hover:border-[rgb(var(--primary-color))]/50 transition-colors"
                    >
                      <Github className="w-3.5 h-3.5" />
                      <span>GitHub</span>
                    </a>
                    <a
                      href="https://instagram.com/xainyx_"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)] text-xs font-semibold text-pink-400 hover:border-pink-500/50 transition-colors"
                    >
                      <Instagram className="w-3.5 h-3.5" />
                      <span>Instagram</span>
                    </a>
                  </div>
                </div>

                {/* Legal & Version Footnote */}
                <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] pt-1">
                  <span>StreamHub v2.6 Pro</span>
                  <div className="flex items-center gap-2">
                    <Link to="/dmca" onClick={() => setIsSidebarOpen(false)} className="hover:underline">DMCA</Link>
                    <span>•</span>
                    <Link to="/privacy" onClick={() => setIsSidebarOpen(false)} className="hover:underline">Privacy</Link>
                    <span>•</span>
                    <Link to="/terms" onClick={() => setIsSidebarOpen(false)} className="hover:underline">Terms</Link>
                  </div>
                </div>

              </div>

            </div>
          </div>
        </div>
      )}

      {/* Global Spotlight / Command Search Modal (⌘K) */}
      <CommandSearchModal
        isOpen={isCommandOpen}
        onClose={() => setIsCommandOpen(false)}
        onSelect={handleCommandSelect}
      />
    </>
  );
};

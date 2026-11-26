import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Search, Menu, X, Settings, Sun, Moon, Command,
  Github, Instagram, ChevronRight, Play
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

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 12);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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
    window.addEventListener('streamhub_storage_update', updateCount);
    return () => {
      window.removeEventListener('storage', updateCount);
      window.removeEventListener('streamhub_storage_update', updateCount);
    };
  }, [location.pathname]);

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

  useEffect(() => {
    document.body.style.overflow = isSidebarOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isSidebarOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    navigate(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : '/search');
    setIsSidebarOpen(false);
  };

  const handleCommandSelect = (item: TMDBResult) => {
    const state = { item };
    if (item.media_type === MediaType.MOVIE) {
      navigate(`/movie/${item.id}`, { state });
    } else if (item.media_type === MediaType.TV) {
      navigate(`/tv/${item.id}`, { state });
    } else if (item.title) {
      navigate(`/movie/${item.id}`, { state });
    } else {
      navigate(`/tv/${item.id}`, { state });
    }
  };

  const navLinks = [
    { path: '/', label: 'Home', description: 'Featured films, series and resume queue' },
    { path: '/discover', label: 'Discover', description: 'Filter by genre, year, platform and rating' },
    { path: '/anime', label: 'Anime', description: 'Seasonal simulcasts, top series and studios' },
    { path: '/sports', label: 'Sports', description: 'Live match fixtures, scores and standings' },
    { path: '/livetv', label: 'Live TV', description: 'Global broadcast channels and EPG guide' },
    { path: '/music', label: 'Music', description: 'Tracks, soundtracks and live radio' },
    {
      path: '/library',
      label: 'Library',
      count: watchlistCount > 0 ? watchlistCount : undefined,
      description: 'Saved watchlist and playback progress',
    },
  ];

  const quickGenres = [
    { id: 28, name: 'Action' },
    { id: 878, name: 'Sci-Fi' },
    { id: 18, name: 'Drama' },
    { id: 35, name: 'Comedy' },
    { id: 27, name: 'Horror' },
    { id: 16, name: 'Animation' },
  ];

  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent || '');

  return (
    <>
      <nav
        aria-label="Main navigation"
        className={`sticky top-0 z-40 transition-colors duration-200 overflow-x-clip ${
          isScrolled
            ? 'bg-[var(--bg-main)]/90 backdrop-blur-xl border-b border-[var(--border-subtle)] py-3'
            : 'bg-gradient-to-b from-[var(--bg-main)]/80 to-transparent py-3.5'
        }`}
      >
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-6 min-w-0">

            {/* Brand Wordmark */}
            <Link
              to="/"
              className="flex items-center gap-2.5 shrink-0 select-none group"
              title="StreamHub Home"
            >
              <span className="w-7 h-7 rounded-lg bg-[rgb(var(--primary-color))] flex items-center justify-center text-white transition-transform duration-150 group-hover:scale-105">
                <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
              </span>
              <span className="font-display font-bold text-lg tracking-tight text-[var(--text-main)] whitespace-nowrap">
                StreamHub
              </span>
            </Link>

            {/* Primary Navigation Links */}
            <div className="hidden lg:flex items-center gap-6 shrink-0">
              {navLinks.map(link => {
                const isCurrent = location.pathname === link.path;
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    onPointerEnter={() => preloadRoute(link.path)}
                    onFocus={() => preloadRoute(link.path)}
                    aria-current={isCurrent ? 'page' : undefined}
                    className={`relative py-1 text-[13px] font-medium transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                      isCurrent
                        ? 'text-[var(--text-main)] font-semibold'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                    }`}
                  >
                    <span>{link.label}</span>
                    {link.count !== undefined && (
                      <span className="text-[11px] font-mono tabular-nums text-[var(--text-muted)]">
                        ({link.count})
                      </span>
                    )}
                    {isCurrent && (
                      <span className="absolute inset-x-0 -bottom-1 h-[2px] rounded-full bg-[rgb(var(--primary-color))]" />
                    )}
                  </Link>
                );
              })}
            </div>

            {/* Right Controls */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-auto">
              <button
                type="button"
                onClick={() => setIsCommandOpen(true)}
                className="hidden md:flex items-center gap-2 bg-[var(--bg-card)]/90 hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
                aria-label="Search titles"
              >
                <Search className="w-3.5 h-3.5 shrink-0" />
                <span className="pr-2 whitespace-nowrap">Search</span>
                <kbd className="hidden xl:inline-flex items-center gap-0.5 text-[10px] font-mono text-[var(--text-muted)] bg-[var(--bg-main)] px-1.5 py-0.5 rounded border border-[var(--border-subtle)]">
                  {isMac ? <Command className="w-2.5 h-2.5" /> : <span>Ctrl</span>}
                  <span>K</span>
                </kbd>
              </button>

              <button
                type="button"
                onClick={() => setIsCommandOpen(true)}
                className="md:hidden p-2 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
                aria-label="Open search"
              >
                <Search className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={onToggleMode}
                aria-label={currentMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                title={currentMode === 'dark' ? 'Light mode' : 'Dark mode'}
                className="p-2 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
              >
                {currentMode === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={onOpenSettings}
                aria-label="Open settings"
                title="Preferences"
                className="p-2 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
              >
                <Settings className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setIsSidebarOpen(true)}
                aria-label="Open navigation menu"
                aria-expanded={isSidebarOpen}
                className="lg:hidden p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
                title="Menu"
              >
                <Menu className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile / Drawer Navigation */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
            aria-hidden="true"
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div
              ref={sidebarRef}
              className="w-screen max-w-sm bg-[var(--bg-card)] border-l border-[var(--border-subtle)] shadow-2xl flex flex-col justify-between overflow-y-auto custom-scrollbar"
            >
              <div>
                <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
                  <Link
                    to="/"
                    onClick={() => setIsSidebarOpen(false)}
                    className="flex items-center gap-2.5"
                  >
                    <span className="w-7 h-7 rounded-lg bg-[rgb(var(--primary-color))] flex items-center justify-center text-white">
                      <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                    </span>
                    <span className="font-display font-bold text-lg tracking-tight text-[var(--text-main)]">
                      StreamHub
                    </span>
                  </Link>

                  <button
                    type="button"
                    onClick={() => setIsSidebarOpen(false)}
                    aria-label="Close menu"
                    className="p-2 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-4 pb-2">
                  <form onSubmit={handleSubmit} className="relative">
                    <input
                      type="text"
                      className="w-full bg-[var(--bg-input)] rounded-lg pl-9 pr-8 py-2 text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--primary-color))] border border-[var(--border-subtle)]"
                      placeholder="Search films, series, anime..."
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[var(--text-muted)]" />
                    {query && (
                      <button
                        type="button"
                        onClick={() => setQuery('')}
                        className="absolute right-2.5 top-2.5 text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </form>
                </div>

                <div className="px-3 py-2 space-y-0.5">
                  {navLinks.map(link => {
                    const isCurrent = location.pathname === link.path;
                    return (
                      <Link
                        key={link.path}
                        to={link.path}
                        onTouchStart={() => preloadRoute(link.path)}
                        onPointerEnter={() => preloadRoute(link.path)}
                        onClick={() => setIsSidebarOpen(false)}
                        className={`flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors ${
                          isCurrent
                            ? 'bg-[var(--bg-hover)] text-[var(--text-main)]'
                            : 'hover:bg-[var(--bg-hover)]/60 text-[var(--text-main)]'
                        }`}
                      >
                        <div className="min-w-0 pr-3">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-semibold ${isCurrent ? 'text-[rgb(var(--primary-color))]' : ''}`}>
                              {link.label}
                            </span>
                            {link.count !== undefined && (
                              <span className="text-xs font-mono tabular-nums text-[var(--text-muted)]">
                                ({link.count})
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[var(--text-muted)] truncate mt-0.5">
                            {link.description}
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
                      </Link>
                    );
                  })}
                </div>

                <div className="px-5 py-4 mt-2 border-t border-[var(--border-subtle)]">
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-xs font-semibold text-[var(--text-muted)]">Genres</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigate('/discover');
                        setIsSidebarOpen(false);
                      }}
                      className="text-xs font-medium text-[rgb(var(--primary-color))] hover:underline cursor-pointer"
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
                        className="px-2.5 py-1.5 rounded-lg bg-[var(--bg-input)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-xs font-medium text-[var(--text-main)] transition-colors cursor-pointer text-center truncate"
                      >
                        {genre.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-5 border-t border-[var(--border-subtle)] space-y-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onToggleMode}
                    className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-[var(--bg-input)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-xs font-medium text-[var(--text-main)] transition-colors cursor-pointer"
                  >
                    {currentMode === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                    <span>{currentMode === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsSidebarOpen(false);
                      onOpenSettings();
                    }}
                    className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-[var(--bg-input)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-xs font-medium text-[var(--text-main)] transition-colors cursor-pointer"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>Settings</span>
                  </button>
                </div>

                <div className="flex items-center justify-between text-xs text-[var(--text-muted)] pt-1">
                  <div className="flex items-center gap-3">
                    <a
                      href="https://github.com/anassar12jS"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-[var(--text-main)] transition-colors inline-flex items-center gap-1"
                    >
                      <Github className="w-3.5 h-3.5" />
                      <span>GitHub</span>
                    </a>
                    <a
                      href="https://instagram.com/xainyx_"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-[var(--text-main)] transition-colors inline-flex items-center gap-1"
                    >
                      <Instagram className="w-3.5 h-3.5" />
                      <span>Instagram</span>
                    </a>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link to="/dmca" onClick={() => setIsSidebarOpen(false)} className="hover:text-[var(--text-main)]">DMCA</Link>
                    <span>·</span>
                    <Link to="/privacy" onClick={() => setIsSidebarOpen(false)} className="hover:text-[var(--text-main)]">Privacy</Link>
                    <span>·</span>
                    <Link to="/terms" onClick={() => setIsSidebarOpen(false)} className="hover:text-[var(--text-main)]">Terms</Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <CommandSearchModal
        isOpen={isCommandOpen}
        onClose={() => setIsCommandOpen(false)}
        onSelect={handleCommandSelect}
      />
    </>
  );
};

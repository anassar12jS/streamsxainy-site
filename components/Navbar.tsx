import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  Search, Film, Menu, X, Settings, Bookmark, Trophy, 
  Compass, Sun, Moon, Ghost, Tv2, Command, Home,
  Github, Instagram
} from 'lucide-react';
import { CommandSearchModal } from './CommandSearchModal';
import { TMDBResult, MediaType } from '../types';
import { preloadRoute } from '../services/routePreloader';

interface NavbarProps {
  onOpenSettings: () => void;
  currentMode: 'light' | 'dark';
  onToggleMode: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenSettings, currentMode, onToggleMode }) => {
  const [query, setQuery] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Listen for Cmd+K / Ctrl+K / '/' keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandOpen(prev => !prev);
      } else if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        setIsCommandOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (trimmed) {
      navigate(`/search?q=${encodeURIComponent(trimmed)}`);
    } else {
      navigate('/search');
    }
    setIsMobileMenuOpen(false);
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
    { path: '/', label: 'Home', icon: Home, color: 'text-purple-400' },
    { path: '/discover', label: 'Discover', icon: Compass },
    { path: '/anime', label: 'Anime', icon: Ghost, color: 'text-pink-500' },
    { path: '/livetv', label: 'Live TV', icon: Tv2, color: 'text-emerald-500' },
    { path: '/library', label: 'Library', icon: Bookmark },
    { path: '/sports', label: 'Sports', icon: Trophy, color: 'text-amber-500' },
  ];

  return (
    <>
      <nav aria-label="Main navigation" className="sticky top-0 z-40 bg-[var(--bg-main)]/90 backdrop-blur-xl border-b border-[var(--border-subtle)] transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-[68px] gap-4">
            
            {/* Logo */}
            <Link to="/" className="flex items-center cursor-pointer group shrink-0">
              <div className="h-9 w-9 bg-gradient-to-tr from-[rgb(var(--primary-color))] to-pink-500 rounded-xl flex items-center justify-center mr-2.5 shadow-lg shadow-[rgb(var(--primary-color))]/25 group-hover:scale-105 transition-transform">
                <Film className="h-5 w-5 text-white" />
              </div>
              <span className="font-black text-xl text-[var(--text-main)] tracking-tight">
                Stream<span className="text-[rgb(var(--primary-color))]">Hub</span>
              </span>
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
                    className={`px-3 py-2 rounded-xl text-[13px] font-bold transition-all relative flex items-center gap-1.5 ${
                      isCurrent
                        ? 'text-[var(--text-main)] bg-[rgb(var(--primary-color))]/10'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
                    }`}
                  >
                    {Icon && <Icon className={`w-4 h-4 ${link.color || ''}`} />}
                    <span>{link.label}</span>
                    {isCurrent && (
                      <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-[rgb(var(--primary-color))] rounded-full" />
                    )}
                  </Link>
                );
              })}
            </div>

            {/* Quick Search Bar with Cmd+K Trigger */}
            <div className="hidden md:block w-full max-w-[280px] lg:max-w-[340px]">
              <form onSubmit={handleSubmit} className="w-full">
                <div className="relative w-full flex items-center bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] focus-within:bg-[var(--bg-input)] border border-[var(--border-subtle)] focus-within:border-[rgb(var(--primary-color))] rounded-xl px-3 py-1.5 transition-all shadow-sm">
                  <Search className="w-4 h-4 text-[var(--text-muted)] shrink-0 mr-2 pointer-events-none" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search movies, anime..."
                    aria-label="Search movies, anime, and shows"
                    className="w-full bg-transparent text-[var(--text-main)] placeholder-[var(--text-muted)] text-xs font-medium focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setIsCommandOpen(true)}
                    aria-label="Open spotlight search shortcut (Command K)"
                    className="ml-1.5 shrink-0 flex items-center justify-center gap-1 text-[10px] font-mono text-[var(--text-muted)] hover:text-[var(--text-main)] bg-[var(--bg-main)] h-6 px-2 rounded-md border border-[var(--border-subtle)] hover:border-[rgb(var(--primary-color))]/40 transition-colors cursor-pointer"
                    title="Open Spotlight Search (⌘K)"
                  >
                    <Command className="w-2.5 h-2.5" />
                    <span>K</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Right Quick Controls */}
            <div className="flex items-center gap-1.5">
              
              {/* Mobile Search Icon Trigger */}
              <button
                type="button"
                onClick={() => setIsCommandOpen(true)}
                className="md:hidden p-2 rounded-xl hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
                title="Search"
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
                <Github className="w-5 h-5" />
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
                <Instagram className="w-5 h-5" />
              </a>

              {/* Theme Toggle */}
              <button 
                onClick={onToggleMode}
                aria-label={currentMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                title={currentMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                className="p-2 rounded-xl hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors relative"
              >
                <div className={`transform transition-transform duration-500 ${currentMode === 'dark' ? 'rotate-0' : 'rotate-180'}`}>
                  {currentMode === 'dark' ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-indigo-400" />}
                </div>
              </button>

              {/* Settings Modal Button */}
              <button 
                onClick={onOpenSettings}
                aria-label="Open settings"
                title="Settings"
                className="p-2 rounded-xl hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
              >
                <Settings className="w-5 h-5" />
              </button>

              {/* Mobile menu hamburger button */}
              <div className="lg:hidden">
                <button
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
                  aria-expanded={isMobileMenuOpen}
                  className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)] transition-colors"
                >
                  {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                </button>
              </div>

            </div>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {isMobileMenuOpen && (
          <div className="lg:hidden bg-[var(--bg-card)] pb-4 px-4 border-t border-[var(--border-subtle)] animate-in slide-in-from-top-2">
            <form onSubmit={handleSubmit} className="mt-3 relative">
              <input
                type="text"
                className="w-full bg-[var(--bg-input)] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--primary-color))] border border-[var(--border-subtle)]"
                placeholder="Search anything..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <Search className="absolute left-3 top-3 h-4 w-4 text-[var(--text-muted)]" />
            </form>
            
            <div className="mt-3 space-y-1">
              {navLinks.map(link => {
                const Icon = link.icon;
                const isCurrent = location.pathname === link.path;
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    onTouchStart={() => preloadRoute(link.path)}
                    onPointerEnter={() => preloadRoute(link.path)}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-bold transition-colors ${
                      isCurrent
                        ? 'bg-[rgb(var(--primary-color))]/15 text-[rgb(var(--primary-color))]'
                        : 'text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
                    }`}
                  >
                    {Icon && <Icon className={`w-4 h-4 ${link.color || ''}`} />}
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </div>

            {/* Mobile Socials */}
            <div className="pt-3 mt-2 border-t border-[var(--border-subtle)] flex items-center justify-between px-2 text-xs text-[var(--text-muted)]">
              <span className="font-semibold">My Socials</span>
              <div className="flex items-center gap-3">
                <a
                  href="https://github.com/anassar12jS"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 p-2 rounded-lg bg-[var(--bg-main)] text-[var(--text-main)] hover:text-[rgb(var(--primary-color))]"
                >
                  <Github className="w-4 h-4" />
                  <span>GitHub</span>
                </a>
                <a
                  href="https://instagram.com/xainyx_"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 p-2 rounded-lg bg-[var(--bg-main)] text-pink-400 hover:text-pink-300"
                >
                  <Instagram className="w-4 h-4" />
                  <span>Instagram</span>
                </a>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Global Spotlight / Command Search Modal */}
      <CommandSearchModal
        isOpen={isCommandOpen}
        onClose={() => setIsCommandOpen(false)}
        onSelect={handleCommandSelect}
      />
    </>
  );
};

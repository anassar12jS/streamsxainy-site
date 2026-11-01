import React from 'react';
import { Film, Github, Instagram, Heart, Compass, Ghost, Tv2, Trophy, Bookmark, Home, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-[var(--bg-card)] border-t border-[var(--border-subtle)] pt-12 pb-8 mt-auto transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          
          {/* Brand */}
          <div className="space-y-3 md:col-span-1">
            <Link to="/" className="flex items-center gap-2.5 cursor-pointer group">
              <div className="h-9 w-9 bg-gradient-to-tr from-[rgb(var(--primary-color))] to-pink-500 rounded-xl flex items-center justify-center shadow-md shadow-[rgb(var(--primary-color))]/20 group-hover:scale-105 transition-transform">
                <Film className="h-5 w-5 text-white" />
              </div>
              <span className="font-black text-xl tracking-tight text-[var(--text-main)]">
                Stream<span className="text-[rgb(var(--primary-color))]">Hub</span>
              </span>
            </Link>
            <p className="text-[var(--text-muted)] text-xs leading-relaxed max-w-xs">
              A cinema-grade streaming aggregator with real-time scrapers, multi-server playback, live television, and sports schedules.
            </p>
          </div>

          {/* Navigation */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-main)] mb-3">
              Explore Content
            </h3>
            <ul className="space-y-2 text-xs text-[var(--text-muted)]">
              <li>
                <Link to="/" className="hover:text-[var(--text-main)] transition-colors flex items-center gap-1.5">
                  <Home className="w-3.5 h-3.5 text-purple-400" /> Home Featured
                </Link>
              </li>
              <li>
                <Link to="/discover" className="hover:text-[var(--text-main)] transition-colors flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-blue-400" /> Discover Library
                </Link>
              </li>
              <li>
                <Link to="/anime" className="hover:text-pink-400 transition-colors flex items-center gap-1.5">
                  <Ghost className="w-3.5 h-3.5 text-pink-400" /> Anime Hub
                </Link>
              </li>
              <li>
                <Link to="/livetv" className="hover:text-emerald-400 transition-colors flex items-center gap-1.5">
                  <Tv2 className="w-3.5 h-3.5 text-emerald-400" /> Live TV Guide
                </Link>
              </li>
              <li>
                <Link to="/sports" className="hover:text-amber-400 transition-colors flex items-center gap-1.5">
                  <Trophy className="w-3.5 h-3.5 text-amber-400" /> Sports Schedules
                </Link>
              </li>
              <li>
                <Link to="/library" className="hover:text-[var(--text-main)] transition-colors flex items-center gap-1.5">
                  <Bookmark className="w-3.5 h-3.5 text-purple-400" /> Personal Watchlist
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal / Policy */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-main)] mb-3">
              Information
            </h3>
            <ul className="space-y-2 text-xs text-[var(--text-muted)]">
              <li><Link to="/dmca" className="hover:text-[var(--text-main)] transition-colors">DMCA Disclaimer</Link></li>
              <li><Link to="/privacy" className="hover:text-[var(--text-main)] transition-colors">Privacy Notice</Link></li>
              <li><Link to="/terms" className="hover:text-[var(--text-main)] transition-colors">Terms of Service</Link></li>
            </ul>
          </div>

          {/* Socials & Connect */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-main)] mb-3">
              Connect & Socials
            </h3>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed mb-3">
              Follow development updates, open-source repositories, and previews.
            </p>
            <div className="flex flex-col space-y-2.5 text-xs text-[var(--text-muted)]">
              <a 
                href="https://github.com/anassar12jS" 
                target="_blank" 
                rel="noopener noreferrer"
                className="hover:text-[var(--text-main)] transition-colors flex items-center gap-2 group p-2 rounded-xl bg-[var(--bg-main)]/60 border border-[var(--border-subtle)] hover:border-[var(--text-muted)]/40"
              >
                <div className="p-1 rounded-md bg-[var(--bg-card)] text-[var(--text-muted)] group-hover:text-[var(--text-main)] transition-colors">
                  <Github className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-[var(--text-main)] leading-none">GitHub</span>
                  <span className="text-[10px] text-[var(--text-muted)] mt-0.5">@anassar12jS</span>
                </div>
                <ExternalLink className="w-3 h-3 ml-auto opacity-40 group-hover:opacity-100 transition-opacity" />
              </a>

              <a 
                href="https://instagram.com/xainyx_" 
                target="_blank" 
                rel="noopener noreferrer"
                className="hover:text-pink-400 transition-colors flex items-center gap-2 group p-2 rounded-xl bg-[var(--bg-main)]/60 border border-[var(--border-subtle)] hover:border-pink-500/40"
              >
                <div className="p-1 rounded-md bg-[var(--bg-card)] text-pink-400 group-hover:scale-105 transition-transform">
                  <Instagram className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-[var(--text-main)] group-hover:text-pink-400 transition-colors leading-none">Instagram</span>
                  <span className="text-[10px] text-[var(--text-muted)] mt-0.5">@xainyx_</span>
                </div>
                <ExternalLink className="w-3 h-3 ml-auto opacity-40 group-hover:opacity-100 transition-opacity text-pink-400" />
              </a>
            </div>
          </div>

        </div>

        <div className="border-t border-[var(--border-subtle)] pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[var(--text-muted)]">
          <p>© {new Date().getFullYear()} StreamHub. Built for cinema enthusiasts worldwide.</p>
          <div className="flex items-center gap-4">
            <a 
              href="https://github.com/anassar12jS" 
              target="_blank" 
              rel="noopener noreferrer"
              className="hover:text-[var(--text-main)] transition-colors flex items-center gap-1.5"
              title="GitHub Profile (@anassar12jS)"
            >
              <Github className="w-3.5 h-3.5" />
              <span>GitHub</span>
            </a>
            <span>·</span>
            <a 
              href="https://instagram.com/xainyx_" 
              target="_blank" 
              rel="noopener noreferrer"
              className="hover:text-pink-400 transition-colors flex items-center gap-1.5"
              title="Instagram Profile (@xainyx_)"
            >
              <Instagram className="w-3.5 h-3.5" />
              <span>Instagram</span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

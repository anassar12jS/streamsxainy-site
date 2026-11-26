import React from 'react';
import { Github, Instagram, Play } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-[var(--bg-main)] border-t border-[var(--border-subtle)] pt-12 pb-8 mt-auto transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">

          {/* Brand */}
          <div className="col-span-2 md:col-span-1 space-y-3">
            <Link to="/" className="inline-flex items-center gap-2.5 group">
              <span className="w-7 h-7 rounded-lg bg-[rgb(var(--primary-color))] flex items-center justify-center text-white">
                <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
              </span>
              <span className="font-display font-bold text-lg tracking-tight text-[var(--text-main)]">
                StreamHub
              </span>
            </Link>
            <p className="text-[var(--text-muted)] text-xs leading-relaxed max-w-xs">
              Movies, television series, anime, live broadcasts, sports fixtures, and music in one catalog.
            </p>
          </div>

          {/* Browse */}
          <div>
            <h3 className="text-xs font-semibold text-[var(--text-main)] mb-3">
              Browse
            </h3>
            <ul className="space-y-2 text-xs text-[var(--text-muted)]">
              <li><Link to="/" className="hover:text-[var(--text-main)] transition-colors">Home</Link></li>
              <li><Link to="/discover" className="hover:text-[var(--text-main)] transition-colors">Discover</Link></li>
              <li><Link to="/anime" className="hover:text-[var(--text-main)] transition-colors">Anime</Link></li>
              <li><Link to="/livetv" className="hover:text-[var(--text-main)] transition-colors">Live TV</Link></li>
              <li><Link to="/music" className="hover:text-[var(--text-main)] transition-colors">Music</Link></li>
              <li><Link to="/sports" className="hover:text-[var(--text-main)] transition-colors">Sports</Link></li>
              <li><Link to="/library" className="hover:text-[var(--text-main)] transition-colors">Library</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-xs font-semibold text-[var(--text-main)] mb-3">
              Information
            </h3>
            <ul className="space-y-2 text-xs text-[var(--text-muted)]">
              <li><Link to="/dmca" className="hover:text-[var(--text-main)] transition-colors">DMCA Notice</Link></li>
              <li><Link to="/privacy" className="hover:text-[var(--text-main)] transition-colors">Privacy Policy</Link></li>
              <li><Link to="/terms" className="hover:text-[var(--text-main)] transition-colors">Terms of Service</Link></li>
            </ul>
          </div>

          {/* Connect */}
          <div>
            <h3 className="text-xs font-semibold text-[var(--text-main)] mb-3">
              Connect
            </h3>
            <ul className="space-y-2 text-xs text-[var(--text-muted)]">
              <li>
                <a
                  href="https://github.com/anassar12jS"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[var(--text-main)] transition-colors inline-flex items-center gap-2"
                >
                  <Github className="w-3.5 h-3.5" />
                  <span>GitHub (@anassar12jS)</span>
                </a>
              </li>
              <li>
                <a
                  href="https://instagram.com/xainyx_"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[var(--text-main)] transition-colors inline-flex items-center gap-2"
                >
                  <Instagram className="w-3.5 h-3.5" />
                  <span>Instagram (@xainyx_)</span>
                </a>
              </li>
            </ul>
          </div>

        </div>

        <div className="border-t border-[var(--border-subtle)] pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[var(--text-muted)]">
          <p>© {new Date().getFullYear()} StreamHub</p>
          <div className="flex items-center gap-4">
            <Link to="/dmca" className="hover:text-[var(--text-main)] transition-colors">DMCA</Link>
            <Link to="/privacy" className="hover:text-[var(--text-main)] transition-colors">Privacy</Link>
            <Link to="/terms" className="hover:text-[var(--text-main)] transition-colors">Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Clapperboard, Home, Compass, Search, Popcorn, RotateCcw } from 'lucide-react';

/**
 * Cinematic 404 — styled like a film leader countdown frame.
 */
export const NotFound: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-[85vh] flex flex-col items-center justify-center overflow-hidden bg-[var(--bg-main)] px-4">
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[rgb(var(--primary-color))]/10 blur-[140px]" />
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/80 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/80 to-transparent" />
      </div>

      {/* Film-strip sprocket holes */}
      <div className="absolute top-6 inset-x-0 flex justify-center gap-3 opacity-40 pointer-events-none">
        {[...Array(18)].map((_, i) => (
          <div key={i} className="w-3 h-5 rounded-sm bg-white/15" />
        ))}
      </div>
      <div className="absolute bottom-6 inset-x-0 flex justify-center gap-3 opacity-40 pointer-events-none">
        {[...Array(18)].map((_, i) => (
          <div key={i} className="w-3 h-5 rounded-sm bg-white/15" />
        ))}
      </div>

      <div className="relative z-10 flex flex-col items-center text-center max-w-2xl">
        {/* Countdown-style badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[rgb(var(--primary-color))]/30 bg-[rgb(var(--primary-color))]/10 text-[rgb(var(--primary-color))] text-[11px] font-black uppercase tracking-[0.25em] mb-8">
          <Clapperboard className="w-3.5 h-3.5" />
          <span>Scene Missing · Reel Lost</span>
        </div>

        {/* Giant glitchy 404 */}
        <h1 className="nf-404 select-none font-black leading-none text-[clamp(6rem,22vw,11rem)] tracking-tighter text-white">
          4<span className="text-[rgb(var(--primary-color))]">0</span>4
        </h1>

        <p className="mt-2 text-lg sm:text-xl font-bold text-[var(--text-main)]">
          This scene got cut from the final reel.
        </p>
        <p className="mt-3 text-sm text-[var(--text-muted)] max-w-md leading-relaxed">
          The page you're looking for doesn't exist — it may have been moved, renamed, or never made it to
          release. Let's get you back to the show.
        </p>

        {/* Actions */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[rgb(var(--primary-color))] hover:brightness-110 text-white text-sm font-bold shadow-lg shadow-[rgb(var(--primary-color))]/25 transition-all active:scale-95"
          >
            <Home className="w-4 h-4" /> Back to Home
          </Link>
          <Link
            to="/discover"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-sm font-bold text-[var(--text-main)] transition-colors"
          >
            <Compass className="w-4 h-4 text-[rgb(var(--primary-color))]" /> Discover
          </Link>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-sm font-bold text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
          >
            <RotateCcw className="w-4 h-4" /> Go Back
          </button>
        </div>

        {/* Fun extras */}
        <div className="mt-14 flex items-center gap-6 text-[var(--text-muted)]/60">
          <Popcorn className="w-5 h-5" />
          <Search className="w-5 h-5" />
        </div>
        <p className="mt-3 text-[11px] font-mono uppercase tracking-[0.3em] text-[var(--text-muted)]/50">
          Error code: REEL_404 · Please rewind and try again
        </p>
      </div>

      <style>{`
        .nf-404 {
          text-shadow: 0 0 40px rgb(var(--primary-color) / 0.35), 0 4px 0 rgba(0,0,0,0.4);
          animation: nf-flicker 4s infinite;
        }
        @keyframes nf-flicker {
          0%, 100% { opacity: 1; }
          92% { opacity: 1; }
          93% { opacity: 0.6; transform: translateX(2px); }
          94% { opacity: 1; transform: translateX(-1px); }
          96% { opacity: 0.75; }
          97% { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default NotFound;

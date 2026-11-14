import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Clapperboard, Home, Compass, Search, Popcorn, RotateCcw } from 'lucide-react';

/**
 * Cinematic 404 — styled like a damaged film leader / broadcast error card.
 */
export const NotFound: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-[88vh] flex flex-col items-center justify-center overflow-hidden bg-[#05060a] px-4 select-none">
      {/* Deep ambient glows */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[15%] left-[10%] w-[420px] h-[420px] rounded-full bg-[rgb(var(--primary-color))]/15 blur-[130px]" />
        <div className="absolute bottom-[10%] right-[8%] w-[380px] h-[380px] rounded-full bg-pink-600/10 blur-[130px]" />
        <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black to-transparent" />
      </div>

      {/* VHS static noise overlay */}
      <div className="nf-static absolute inset-0 opacity-[0.05] pointer-events-none mix-blend-overlay" />
      {/* Scanlines */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.07]"
        style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.5) 3px, rgba(255,255,255,0.5) 4px)' }} />

      {/* Film-strip sprocket holes */}
      <div className="absolute top-5 inset-x-0 flex justify-center gap-2.5 opacity-30 pointer-events-none">
        {[...Array(22)].map((_, i) => <div key={i} className="w-2.5 h-4 rounded-[3px] bg-white/20" />)}
      </div>
      <div className="absolute bottom-5 inset-x-0 flex justify-center gap-2.5 opacity-30 pointer-events-none">
        {[...Array(22)].map((_, i) => <div key={i} className="w-2.5 h-4 rounded-[3px] bg-white/20" />)}
      </div>

      {/* Film countdown leader */}
      <div className="absolute top-16 left-1/2 -translate-x-1/2 flex items-center gap-4 pointer-events-none">
        {[3, 2, 1].map((n, i) => (
          <div
            key={n}
            className="nf-count w-9 h-9 rounded-full border border-white/20 bg-black/60 flex items-center justify-center"
            style={{ animationDelay: `${i * 1.2}s` }}
          >
            <span className="text-xs font-black text-white/70 font-mono">{n}</span>
          </div>
        ))}
        <div className="nf-crosshair w-3 h-3 rotate-45 border border-[rgb(var(--primary-color))]/60" />
      </div>

      <div className="relative z-10 flex flex-col items-center text-center max-w-2xl mt-16">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-red-500/30 bg-red-500/10 text-red-400 text-[11px] font-black uppercase tracking-[0.25em] mb-8">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
          </span>
          Signal Lost · REEL_404
        </div>

        {/* Giant glitchy 404 */}
        <h1 className="nf-404 relative select-none font-black leading-[0.85] text-[clamp(7rem,24vw,12rem)] tracking-tighter">
          <span className="absolute inset-0 text-cyan-400/70 translate-x-[-3px]" aria-hidden>404</span>
          <span className="absolute inset-0 text-pink-500/70 translate-x-[3px]" aria-hidden>404</span>
          <span className="relative text-white">4<span className="text-[rgb(var(--primary-color))]">0</span>4</span>
        </h1>

        <p className="mt-4 text-lg sm:text-xl font-bold text-[var(--text-main)]">
          This scene got cut from the final reel.
        </p>
        <p className="mt-2.5 text-sm text-[var(--text-muted)] max-w-md leading-relaxed">
          The page you're looking for doesn't exist — it may have been moved, renamed, or never made it to
          release. Don't worry, the show must go on.
        </p>

        {/* PLEASE STAND BY ticker */}
        <div className="mt-6 overflow-hidden w-full max-w-sm">
          <div className="nf-marquee whitespace-nowrap text-[10px] font-mono uppercase tracking-[0.4em] text-[var(--text-muted)]/60">
            Please stand by · Reconnecting to the archive · Please stand by · Reconnecting to the archive ·
          </div>
        </div>

        {/* Actions */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[rgb(var(--primary-color))] hover:brightness-110 text-white text-sm font-bold shadow-lg shadow-[rgb(var(--primary-color))]/30 transition-all active:scale-95"
          >
            <Home className="w-4 h-4" /> Back to Home
          </Link>
          <Link
            to="/discover"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/15 text-sm font-bold text-[var(--text-main)] transition-colors backdrop-blur-sm"
          >
            <Compass className="w-4 h-4 text-[rgb(var(--primary-color))]" /> Discover
          </Link>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/15 text-sm font-bold text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors backdrop-blur-sm"
          >
            <RotateCcw className="w-4 h-4" /> Go Back
          </button>
        </div>

        {/* Fun strip */}
        <div className="mt-12 flex items-center gap-5 text-white/40">
          <Popcorn className="w-5 h-5" />
          <Search className="w-5 h-5" />
          <Clapperboard className="w-5 h-5" />
        </div>
        <p className="mt-3 text-[11px] font-mono uppercase tracking-[0.3em] text-white/30">
          Error code: REEL_404 · Please rewind and try again
        </p>
      </div>

      <style>{`
        .nf-static {
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E");
          animation: nf-static 0.6s steps(4) infinite;
        }
        @keyframes nf-static {
          0% { transform: translate(0,0); } 25% { transform: translate(-2%,1%); }
          50% { transform: translate(1%,-2%); } 75% { transform: translate(-1%,2%); } 100% { transform: translate(0,0); }
        }
        .nf-404 { animation: nf-glitch 3.5s infinite; }
        @keyframes nf-glitch {
          0%, 100% { transform: translate(0,0); filter: none; }
          88% { transform: translate(0,0); }
          89% { transform: translate(-4px,2px) skewX(-2deg); filter: hue-rotate(30deg); }
          90% { transform: translate(3px,-1px); }
          91% { transform: translate(0,0); }
          94% { transform: translate(2px,1px) skewX(1deg); }
          95% { transform: translate(0,0); }
        }
        .nf-count { animation: nf-count 3.6s ease-in-out infinite; opacity: 0.25; }
        @keyframes nf-count {
          0%, 8% { opacity: 1; transform: scale(1); border-color: rgb(var(--primary-color) / 0.7); }
          30%, 100% { opacity: 0.25; transform: scale(0.85); }
        }
        .nf-crosshair { animation: nf-spin 6s linear infinite; }
        @keyframes nf-spin { to { transform: rotate(405deg); } }
        .nf-marquee { display: inline-block; animation: nf-scroll 18s linear infinite; }
        @keyframes nf-scroll { from { transform: translateX(100%); } to { transform: translateX(-100%); } }
      `}</style>
    </div>
  );
};

export default NotFound;

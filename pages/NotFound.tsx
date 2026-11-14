import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Clapperboard, Home, Compass, Search, Popcorn, RotateCcw } from 'lucide-react';

/**
 * Cinematic 404 — a dead broadcast channel on a retro TV set.
 */
export const NotFound: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-[92vh] flex flex-col items-center justify-center overflow-hidden bg-[#04050a] px-4 select-none">
      {/* Deep ambient glows */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[12%] left-[8%] w-[460px] h-[460px] rounded-full bg-[rgb(var(--primary-color))]/12 blur-[140px]" />
        <div className="absolute bottom-[8%] right-[6%] w-[400px] h-[400px] rounded-full bg-cyan-500/[0.07] blur-[140px]" />
        <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black to-transparent" />
      </div>

      {/* VHS static noise overlay */}
      <div className="nf-static absolute inset-0 opacity-[0.05] pointer-events-none mix-blend-overlay" />
      {/* Vignette */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.55) 100%)' }} />

      {/* Film-strip sprocket holes */}
      <div className="absolute top-5 inset-x-0 flex justify-center gap-2.5 opacity-30 pointer-events-none">
        {[...Array(24)].map((_, i) => <div key={i} className="w-2.5 h-4 rounded-[3px] bg-white/20" />)}
      </div>
      <div className="absolute bottom-24 inset-x-0 flex justify-center gap-2.5 opacity-30 pointer-events-none">
        {[...Array(24)].map((_, i) => <div key={i} className="w-2.5 h-4 rounded-[3px] bg-white/20" />)}
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

      <div className="relative z-10 flex flex-col items-center mt-14">
        {/* ===== RETRO TV SET ===== */}
        <div className="nf-tv relative">
          {/* Screen glare */}
          <div className="absolute -inset-1 rounded-[28px] bg-gradient-to-br from-white/10 via-transparent to-transparent pointer-events-none z-20" />

          {/* TV body */}
          <div className="relative rounded-[26px] bg-gradient-to-b from-[#1c1f2b] to-[#0b0d14] border border-white/10 p-3 sm:p-4 shadow-[0_40px_120px_-20px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.08)]">
            {/* Screen */}
            <div className="relative w-[min(88vw,620px)] aspect-video rounded-2xl overflow-hidden bg-black border border-black/60">
              {/* Static inside screen */}
              <div className="nf-screen-static absolute inset-0 opacity-60" />
              {/* Scanlines inside screen */}
              <div className="absolute inset-0 pointer-events-none opacity-[0.12]"
                style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.6) 2px, rgba(255,255,255,0.6) 3px)' }} />
              {/* Screen vignette */}
              <div className="absolute inset-0 pointer-events-none"
                style={{ background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.6) 100%)' }} />

              {/* Channel bug */}
              <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2 py-1 rounded bg-black/60 border border-white/15 backdrop-blur-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-[10px] font-black font-mono text-white/80 tracking-widest">CH·404</span>
              </div>

              {/* OSD text */}
              <div className="absolute top-3 right-3 text-[10px] font-mono text-white/50 tracking-widest">NO SIGNAL</div>

              {/* Center content */}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                <h1 className="nf-404 relative select-none font-black leading-[0.85] text-[clamp(4.5rem,14vw,8.5rem)] tracking-tighter">
                  <span className="absolute inset-0 text-cyan-400/70 translate-x-[-3px]" aria-hidden>404</span>
                  <span className="absolute inset-0 text-pink-500/70 translate-x-[3px]" aria-hidden>404</span>
                  <span className="relative text-white">4<span className="text-[rgb(var(--primary-color))]">0</span>4</span>
                </h1>
                <p className="text-[11px] sm:text-xs font-mono uppercase tracking-[0.35em] text-white/60 mt-1">
                  Please stand by
                </p>
              </div>

              {/* Bottom OSD bar */}
              <div className="absolute bottom-0 inset-x-0 h-7 bg-gradient-to-t from-black/70 to-transparent flex items-end justify-between px-3 pb-1">
                <span className="text-[9px] font-mono text-white/40 tracking-widest">AUDIO: STEREO</span>
                <span className="text-[9px] font-mono text-white/40 tracking-widest">STREAMHUB PRESENTS</span>
              </div>
            </div>

            {/* TV chin: brand + knobs */}
            <div className="flex items-center justify-between px-4 pt-3 pb-1">
              <span className="text-[10px] font-black tracking-[0.3em] text-white/30 uppercase">StreamHub</span>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#2a2e3d] to-[#14161f] border border-white/10 shadow-inner" />
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#2a2e3d] to-[#14161f] border border-white/10 shadow-inner" />
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/70 shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
              </div>
            </div>
          </div>

          {/* TV stand / neck */}
          <div className="mx-auto w-2/5 h-4 bg-gradient-to-b from-[#0b0d14] to-transparent" />
          <div className="mx-auto w-3/5 h-2.5 rounded-b-xl bg-gradient-to-b from-[#1a1d28] to-[#0a0b10] border border-white/10 border-t-0" />
        </div>

        {/* ===== Copy + actions ===== */}
        <div className="relative z-10 flex flex-col items-center text-center max-w-xl -mt-2">
          <p className="text-base sm:text-lg font-bold text-[var(--text-main)] mt-8">
            This scene got cut from the final reel.
          </p>
          <p className="mt-2 text-sm text-[var(--text-muted)] leading-relaxed">
            The page you're looking for doesn't exist — it may have been moved, renamed, or never made it to
            release. Don't worry, the show must go on.
          </p>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
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
        </div>
      </div>

      {/* ===== END CREDITS ===== */}
      <div className="absolute bottom-8 inset-x-0 overflow-hidden pointer-events-none opacity-60">
        <div className="nf-credits whitespace-nowrap text-center text-[10px] font-mono uppercase tracking-[0.35em] text-white/35">
          StreamHub presents · Starring you · Directed by the community · Director of photography: your browser ·
          Special thanks to the archive · No reels were harmed · StreamHub presents · Starring you ·
          Directed by the community · Director of photography: your browser · Special thanks to the archive · No reels were harmed ·
        </div>
      </div>

      <style>{`
        .nf-static {
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E");
          animation: nf-static 0.5s steps(4) infinite;
        }
        .nf-screen-static {
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)'/%3E%3C/svg%3E");
          animation: nf-static 0.35s steps(3) infinite;
        }
        @keyframes nf-static {
          0% { transform: translate(0,0); } 25% { transform: translate(-2%,1%); }
          50% { transform: translate(1%,-2%); } 75% { transform: translate(-1%,2%); } 100% { transform: translate(0,0); }
        }
        .nf-404 { animation: nf-glitch 3.2s infinite; text-shadow: 0 0 50px rgb(var(--primary-color) / 0.4), 0 6px 0 rgba(0,0,0,0.5); }
        @keyframes nf-glitch {
          0%, 100% { transform: translate(0,0); }
          86% { transform: translate(0,0); }
          87% { transform: translate(-5px,2px) skewX(-2deg); }
          88% { transform: translate(4px,-1px); }
          89% { transform: translate(0,0); }
          93% { transform: translate(3px,1px) skewX(1.5deg); }
          94% { transform: translate(-2px,0); }
          95% { transform: translate(0,0); }
        }
        .nf-count { animation: nf-count 3.6s ease-in-out infinite; opacity: 0.25; }
        @keyframes nf-count {
          0%, 8% { opacity: 1; transform: scale(1); border-color: rgb(var(--primary-color) / 0.7); }
          30%, 100% { opacity: 0.25; transform: scale(0.85); }
        }
        .nf-crosshair { animation: nf-spin 6s linear infinite; }
        @keyframes nf-spin { to { transform: rotate(405deg); } }
        .nf-credits { display: inline-block; animation: nf-credits 30s linear infinite; }
        @keyframes nf-credits { from { transform: translateX(100%); } to { transform: translateX(-100%); } }
        .nf-tv { animation: nf-tv-float 7s ease-in-out infinite; }
        @keyframes nf-tv-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
      `}</style>
    </div>
  );
};

export default NotFound;

import React, { useState } from 'react';
import { ShieldCheck, X, ExternalLink, Sparkles } from 'lucide-react';
import { useMusicPlayerStore } from '../store/useMusicPlayerStore';

export const ExtensionBanner: React.FC = () => {
  const extensionConnected = useMusicPlayerStore(state => state.extensionConnected);
  const [dismissed, setDismissed] = useState(false);

  if (extensionConnected || dismissed) return null;

  return (
    <div className="mx-6 mt-4 p-3 rounded-2xl bg-[#1c1c1e] border border-white/10 flex items-center justify-between gap-4 text-xs shadow-xl animate-fade-in">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-xl bg-[#fa243c]/15 text-[#fa243c] flex items-center justify-center shrink-0">
          <Sparkles className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="font-bold text-white tracking-tight flex items-center gap-1.5">
            <span>Xainy Music Companion Extension Not Detected</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/10 text-white/70 font-normal">
              High-Fidelity Web Mode Active
            </span>
          </p>
          <p className="text-white/50 text-[11px] truncate mt-0.5">
            Streaming via Xainy Music web audio pipeline. Install the companion extension to enable private YouTube session cookies & Discord RPC.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <a
          href="https://github.com/anassar12jS/bitchord-extension"
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors"
        >
          <span>Install Extension</span>
          <ExternalLink className="w-3 h-3" />
        </a>
        <button
          onClick={() => setDismissed(true)}
          className="p-1.5 text-white/40 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          title="Dismiss notice"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { X, ExternalLink, Download, Puzzle, Music2 } from 'lucide-react';
import { useMusicPlayerStore } from '../store/useMusicPlayerStore';

const EXTENSION_REPO = 'https://github.com/anassar12jS/bitchord-extension';

export const ExtensionBanner: React.FC = () => {
  const extensionConnected = useMusicPlayerStore(state => state.extensionConnected);
  const [dismissed, setDismissed] = useState(false);

  if (extensionConnected || dismissed) return null;

  return (
    <div className="mx-4 sm:mx-6 mt-4 rounded-2xl bg-gradient-to-br from-[#1c1c1e] to-[#141416] border border-white/10 p-4 sm:p-5 shadow-xl animate-fade-in">
      <div className="flex items-start gap-4">
        {/* Logo tile */}
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-pink-500 flex items-center justify-center shrink-0 shadow-lg shadow-fuchsia-500/20">
          <Music2 className="w-5 h-5 text-white" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="font-bold text-white tracking-tight text-sm">
            Install the Xainy Music extension
          </p>
          <p className="text-white/50 text-xs mt-1 leading-relaxed">
            The companion extension connects your YouTube Music account — unlocking search,
            your library, Liked Songs, playlists, and full-length playback.
          </p>

          {/* Quick steps */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 text-[11px] text-white/60">
            <span className="flex items-center gap-1.5">
              <Download className="w-3 h-3 text-white/40" /> Download &amp; unzip
            </span>
            <span className="flex items-center gap-1.5">
              <Puzzle className="w-3 h-3 text-white/40" /> Load unpacked in chrome://extensions
            </span>
            <span className="flex items-center gap-1.5">
              <Music2 className="w-3 h-3 text-white/40" /> Sign in at music.youtube.com
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          <a
            href={EXTENSION_REPO}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-xl bg-white text-black font-bold text-xs flex items-center gap-1.5 hover:bg-white/90 transition-colors shadow-md"
          >
            <span>Get Extension</span>
            <ExternalLink className="w-3 h-3" />
          </a>
          <button
            onClick={() => setDismissed(true)}
            className="p-1.5 text-white/40 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};


import React, { useMemo, useState } from 'react';
import { Stream } from '../types';
import { Magnet, Play, HardDrive, Copy, Check, PlayCircle, Download, Users, Zap } from 'lucide-react';

interface StreamListProps {
  streams: Stream[];
  loading: boolean;
  onPlay: (stream: Stream) => void;
}

export const StreamList: React.FC<StreamListProps> = ({ streams, loading, onPlay }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Sorting and Parsing Logic
  const sortedStreams = useMemo(() => {
    return [...streams].sort((a, b) => {
      const getText = (s: Stream) => (s.title || '') + (s.name || '');
      const textA = getText(a).toLowerCase();
      const textB = getText(b).toLowerCase();
      
      // Check for Debrid Cached status (standard convention is '+' symbol, e.g. [RD+], [TB+])
      const isCachedA = (a.title || '').includes('+') || (a.name || '').includes('+');
      const isCachedB = (b.title || '').includes('+') || (b.name || '').includes('+');

      // Quality Score
      const getQualityScore = (str: string) => {
        if (str.includes('2160p') || str.includes('4k') || str.includes('uhd')) return 4;
        if (str.includes('1080p')) return 3;
        if (str.includes('720p')) return 2;
        if (str.includes('480p')) return 1;
        return 0;
      };

      const qualA = getQualityScore(textA);
      const qualB = getQualityScore(textB);

      // 1. Sort by Cached status (Direct + Cached is best)
      if (isCachedA !== isCachedB) return isCachedA ? -1 : 1;

      // 2. Sort by Direct link presence (Direct is better than P2P)
      if (!!a.url !== !!b.url) return !!a.url ? -1 : 1;

      // 3. Sort by Quality
      if (qualA !== qualB) return qualB - qualA; // Higher quality first

      // 4. Seeds Score (parsing "👤 123" or similar)
      const getSeeds = (str: string) => {
        const match = str.match(/👤\s*(\d+)/) || str.match(/seeders:\s*(\d+)/i);
        return match ? parseInt(match[1]) : 0;
      };

      const seedsA = getSeeds(a.title || '');
      const seedsB = getSeeds(b.title || '');

      return seedsB - seedsA; // More seeds first
    });
  }, [streams]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="h-14 skeleton-loader rounded-md w-full"></div>
        ))}
      </div>
    );
  }

  if (streams.length === 0) {
    return (
      <div className="py-12 flex flex-col items-center justify-center text-center bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)]">
        <div className="w-12 h-12 bg-[var(--bg-hover)] rounded-full flex items-center justify-center mb-4 text-[var(--text-muted)]">
            <HardDrive className="w-6 h-6" />
        </div>
        <h3 className="text-base font-medium text-[var(--text-main)]">No streams found</h3>
        <p className="text-xs text-[var(--text-muted)] max-w-xs mt-2">
            Try checking your internet connection or selecting a different title.
        </p>
      </div>
    );
  }

  const handleCopy = (stream: Stream, index: number) => {
    if (stream.url) {
      navigator.clipboard.writeText(stream.url);
    } else if (stream.infoHash) {
      const magnet = `magnet:?xt=urn:btih:${stream.infoHash}&dn=${encodeURIComponent(stream.title || 'video')}`;
      navigator.clipboard.writeText(magnet);
    }
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleDownload = (stream: Stream) => {
    if (stream.url) {
      const a = document.createElement('a');
      a.href = stream.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.click();
    } else if (stream.infoHash) {
      const magnet = `magnet:?xt=urn:btih:${stream.infoHash}&dn=${encodeURIComponent(stream.title || 'video')}`;
      window.location.href = magnet;
    }
  };

  return (
    <div className="space-y-1 max-h-[600px] overflow-y-auto pr-1 custom-scrollbar">
      {sortedStreams.map((stream, idx) => {
        const titleLines = (stream.title || '').split('\n');
        const nameLines = (stream.name || '').split('\n');
        
        // Parsing Metadata
        const fullText = (stream.title || '') + ' ' + (stream.name || '');
        const qualityMatch = fullText.match(/(2160p|4k|1080p|720p|480p)/i);
        const quality = qualityMatch ? qualityMatch[0].toUpperCase() : 'UNK';
        
        const sizeMatch = fullText.match(/(\d+(\.\d+)?\s?(GB|MB))/i);
        const size = sizeMatch ? sizeMatch[0] : '';

        const seedsMatch = fullText.match(/👤\s*(\d+)/);
        const seeds = seedsMatch ? seedsMatch[1] : null;
        
        const source = nameLines[0] || 'P2P';
        const isDirect = !!stream.url;
        // Detect Cached status based on '+' symbol convention in Debrid addons (e.g., [RD+], [TB+])
        const isCached = isDirect && ((stream.title || '').includes('+') || (stream.name || '').includes('+'));

        return (
          <div 
            key={idx}
            className="group flex items-center justify-between bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] p-2.5 rounded-md border border-[var(--border-color)] transition-colors"
          >
            {/* Left: Icon & Details */}
            <div className="flex items-center gap-3 overflow-hidden flex-1 mr-2">
              <div className={`w-8 h-8 rounded flex items-center justify-center shrink-0 ${isCached ? 'text-blue-500 bg-blue-500/10' : isDirect ? 'text-orange-500 bg-orange-500/10' : 'text-[var(--text-muted)] bg-[var(--bg-hover)]'}`}>
                {isCached ? <Zap className="w-4 h-4 fill-blue-500" /> : isDirect ? <Download className="w-4 h-4" /> : <Magnet className="w-4 h-4" />}
              </div>
              
              <div className="min-w-0 flex-1 flex flex-col justify-center">
                <div className="flex items-center gap-2 text-sm text-[var(--text-main)] font-medium leading-tight">
                   <span>{quality}</span>
                   {isCached && <span className="text-[10px] bg-blue-500/10 text-blue-500 px-1.5 py-0.5 rounded border border-blue-500/20 font-bold">⚡ CACHED</span>}
                   {isDirect && !isCached && <span className="text-[10px] bg-orange-500/10 text-orange-500 px-1.5 py-0.5 rounded border border-orange-500/20 font-bold">☁️ DOWNLOAD</span>}
                   {size && <span className="text-xs text-[var(--text-muted)] font-normal">• {size}</span>}
                   {!isDirect && seeds && (
                     <span className="text-xs text-emerald-500 font-normal flex items-center gap-0.5">
                       <Users className="w-3 h-3" /> {seeds}
                     </span>
                   )}
                </div>
                <div className="text-[11px] text-[var(--text-muted)] font-mono truncate">
                   {source} • {titleLines.slice(0, 1).join(' ')}
                </div>
              </div>
            </div>
            
            {/* Right: Actions */}
            <div className="flex items-center gap-1.5 shrink-0">
                {/* Only show Play button for DIRECT links. P2P magnets should be download-only to avoid slow Webtor experience */}
                {isDirect && (
                    <button
                    onClick={() => onPlay(stream)}
                    className={`flex items-center gap-1.5 ${isCached ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-[var(--text-main)] hover:opacity-90 text-[var(--bg-main)]'} px-3 py-1.5 rounded text-xs font-bold transition-colors`}
                    >
                    <PlayCircle className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Play</span>
                    </button>
                )}

                <div className="flex items-center gap-1">
                    <button 
                        onClick={() => handleCopy(stream, idx)}
                        className="p-1.5 hover:bg-[var(--bg-hover)] rounded text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
                        title="Copy Link"
                    >
                        {copiedIndex === idx ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                    
                    <button 
                        onClick={() => handleDownload(stream)}
                        className={`p-1.5 hover:bg-[var(--bg-hover)] rounded text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors ${!isDirect ? 'bg-[var(--bg-hover)] text-[var(--text-main)]' : ''}`}
                        title="Download"
                    >
                        <Download className="w-4 h-4" />
                    </button>
                </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

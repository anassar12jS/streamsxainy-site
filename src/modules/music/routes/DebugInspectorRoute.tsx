import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  CheckCircle2, 
  XCircle, 
  Copy, 
  Check, 
  RefreshCw, 
  Send, 
  ShieldAlert, 
  Terminal, 
  ExternalLink,
  Layers,
  Music2,
  Radio
} from 'lucide-react';
import { extensionBridge, BridgeError } from '../extension/bridge';

export const DebugInspectorRoute: React.FC = () => {
  const [extStatus, setExtStatus] = useState(extensionBridge.getStatus());
  const [isLoading, setIsLoading] = useState(false);
  const [lastMethod, setLastMethod] = useState<string>('idle');
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [lastResult, setLastResult] = useState<any>(null);
  const [lastError, setLastError] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [customChannelId, setCustomChannelId] = useState<string>('');
  const [customPlaylistId, setCustomPlaylistId] = useState<string>('');

  useEffect(() => {
    return extensionBridge.subscribe(status => {
      setExtStatus(status);
    });
  }, []);

  const executeBridgeCall = async (method: string, params: Record<string, any> = {}) => {
    setIsLoading(true);
    setLastMethod(method);
    setLastError(null);
    const start = performance.now();

    try {
      let res: any;
      if (method === 'yt.fetch (FEmusic_home)') {
        const fetchRes = await extensionBridge.proxyFetch(
          'https://music.youtube.com/youtubei/v1/browse?prettyPrint=false',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              context: {
                client: {
                  clientName: 'WEB_REMIX',
                  clientVersion: '1.20240101.01.00',
                  hl: 'en',
                  gl: 'US',
                },
              },
              browseId: 'FEmusic_home',
            }),
          }
        );
        res = {
          status: fetchRes.status,
          statusText: fetchRes.statusText,
          headers: Object.fromEntries(fetchRes.headers.entries()),
          json: await fetchRes.json(),
        };
      } else {
        res = await extensionBridge.call(method, params, { timeoutMs: 15000 });
      }

      const elapsed = Math.round(performance.now() - start);
      setLatencyMs(elapsed);
      setLastResult(res);
    } catch (err: any) {
      const elapsed = Math.round(performance.now() - start);
      setLatencyMs(elapsed);
      setLastError({
        name: err.name,
        code: err.code || (err instanceof BridgeError ? err.code : 'UNKNOWN'),
        message: err.message,
        originalError: err.originalError,
      });
      setLastResult(null);
    } finally {
      setIsLoading(false);
    }
  };

  const redactPayload = (data: any): any => {
    if (!data) return data;
    try {
      const json = JSON.parse(JSON.stringify(data));
      const redact = (obj: any) => {
        if (!obj || typeof obj !== 'object') return;
        for (const key of Object.keys(obj)) {
          if (/token|cookie|authorization|secret|password|session/i.test(key)) {
            obj[key] = '[REDACTED_FOR_SECURITY]';
          } else if (typeof obj[key] === 'object') {
            redact(obj[key]);
          }
        }
      };
      redact(json);
      return json;
    } catch {
      return data;
    }
  };

  const copyToClipboard = () => {
    const content = lastError 
      ? JSON.stringify({ method: lastMethod, error: lastError }, null, 2)
      : JSON.stringify({ method: lastMethod, latencyMs, result: redactPayload(lastResult) }, null, 2);

    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-24 text-white">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#282828] pb-6">
        <div>
          <div className="flex items-center gap-3">
            <Terminal className="w-8 h-8 text-red-500" />
            <h1 className="text-2xl font-bold tracking-tight">Phase 0: BitChord Extension Debug Inspector</h1>
          </div>
          <p className="text-sm text-[#a3a3a3] mt-1">
            Real-time payload inspection for companion MV3 extension (ID: <code className="bg-[#1f1f1f] px-1.5 py-0.5 rounded text-xs text-white">pkddffeebcmhhanjcigilehaeonkkfih</code>)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${
            extStatus.available 
              ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800' 
              : 'bg-red-950/80 text-red-400 border border-red-800'
          }`}>
            {extStatus.available ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            {extStatus.available ? `Companion Active (v${extStatus.version || '0.4.4'})` : 'Companion Not Detected'}
          </div>

          <button
            onClick={() => executeBridgeCall('ping')}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#222222] hover:bg-[#2d2d2d] text-xs font-medium text-white transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading && lastMethod === 'ping' ? 'animate-spin' : ''}`} />
            Ping
          </button>
        </div>
      </div>

      {/* Control Buttons Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        
        {/* Core & YouTube Identity */}
        <div className="bg-[#161616] border border-[#282828] rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#a3a3a3] uppercase tracking-wider">
            <Radio className="w-4 h-4 text-red-500" />
            YouTube Music Identity
          </div>
          <div className="space-y-2">
            <button
              onClick={() => executeBridgeCall('yt.authState', { refresh: true })}
              disabled={isLoading}
              className="w-full text-left px-3 py-2 rounded-lg bg-[#202020] hover:bg-[#2a2a2a] text-sm font-medium transition-colors flex items-center justify-between"
            >
              <span>yt.authState (refresh: true)</span>
              <Send className="w-3.5 h-3.5 text-zinc-400" />
            </button>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Channel ID (UC...)"
                value={customChannelId}
                onChange={(e) => setCustomChannelId(e.target.value)}
                className="flex-1 bg-[#121212] border border-[#333] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-red-500"
              />
              <button
                onClick={() => executeBridgeCall('yt.selectChannel', { channelId: customChannelId || 'UCdefault' })}
                disabled={isLoading}
                className="px-3 py-1.5 bg-[#202020] hover:bg-[#2a2a2a] text-xs font-medium rounded-lg transition-colors"
              >
                Select
              </button>
            </div>

            <button
              onClick={() => executeBridgeCall('yt.fetch (FEmusic_home)')}
              disabled={isLoading}
              className="w-full text-left px-3 py-2 rounded-lg bg-[#202020] hover:bg-[#2a2a2a] text-sm font-medium transition-colors flex items-center justify-between"
            >
              <span>yt.fetch (POST FEmusic_home)</span>
              <Send className="w-3.5 h-3.5 text-zinc-400" />
            </button>
          </div>
        </div>

        {/* Spotify Integration */}
        <div className="bg-[#161616] border border-[#282828] rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#a3a3a3] uppercase tracking-wider">
            <Music2 className="w-4 h-4 text-emerald-500" />
            Spotify Integration
          </div>
          <div className="space-y-2">
            <button
              onClick={() => executeBridgeCall('spotify.authState')}
              disabled={isLoading}
              className="w-full text-left px-3 py-2 rounded-lg bg-[#202020] hover:bg-[#2a2a2a] text-sm font-medium transition-colors flex items-center justify-between"
            >
              <span>spotify.authState</span>
              <Send className="w-3.5 h-3.5 text-zinc-400" />
            </button>

            <button
              onClick={() => executeBridgeCall('spotify.playlists', { offset: 0, limit: 10 })}
              disabled={isLoading}
              className="w-full text-left px-3 py-2 rounded-lg bg-[#202020] hover:bg-[#2a2a2a] text-sm font-medium transition-colors flex items-center justify-between"
            >
              <span>spotify.playlists (10)</span>
              <Send className="w-3.5 h-3.5 text-zinc-400" />
            </button>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Spotify Playlist ID"
                value={customPlaylistId}
                onChange={(e) => setCustomPlaylistId(e.target.value)}
                className="flex-1 bg-[#121212] border border-[#333] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
              />
              <button
                onClick={() => executeBridgeCall('spotify.tracks', { playlistId: customPlaylistId || '37i9dQZF1DXcBWIGoYBM5M' })}
                disabled={isLoading}
                className="px-3 py-1.5 bg-[#202020] hover:bg-[#2a2a2a] text-xs font-medium rounded-lg transition-colors"
              >
                Tracks
              </button>
            </div>
          </div>
        </div>

        {/* Status & Latency Summary */}
        <div className="bg-[#161616] border border-[#282828] rounded-xl p-4 space-y-3 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="text-xs font-semibold text-[#a3a3a3] uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-400" />
              Execution Stats
            </div>
            <div className="text-sm space-y-1">
              <div className="flex justify-between text-xs py-1 border-b border-[#222]">
                <span className="text-zinc-400">Last Action:</span>
                <span className="font-mono text-white">{lastMethod}</span>
              </div>
              <div className="flex justify-between text-xs py-1 border-b border-[#222]">
                <span className="text-zinc-400">Roundtrip Latency:</span>
                <span className="font-mono text-emerald-400">{latencyMs !== null ? `${latencyMs} ms` : '—'}</span>
              </div>
              <div className="flex justify-between text-xs py-1">
                <span className="text-zinc-400">Status:</span>
                <span className={`font-semibold ${lastError ? 'text-red-400' : lastResult ? 'text-emerald-400' : 'text-zinc-400'}`}>
                  {isLoading ? 'Executing...' : lastError ? 'Failed' : lastResult ? '200 OK' : 'Idle'}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-[#222]">
            <span className="text-[11px] text-zinc-500 leading-tight block">
              Tip: Use this inspector to verify raw payloads before trusting any parsed data schema.
            </span>
          </div>
        </div>

      </div>

      {/* Response Viewer */}
      <div className="bg-[#121212] border border-[#282828] rounded-xl overflow-hidden shadow-2xl">
        <div className="bg-[#1a1a1a] px-4 py-3 border-b border-[#282828] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${
              lastError ? 'bg-red-500' : lastResult ? 'bg-emerald-500' : 'bg-zinc-600'
            }`} />
            <span className="text-xs font-mono text-zinc-300">
              Payload Viewer — {lastMethod}
            </span>
          </div>

          <button
            onClick={copyToClipboard}
            disabled={!lastResult && !lastError}
            className="flex items-center gap-1.5 px-3 py-1 bg-[#262626] hover:bg-[#333] disabled:opacity-40 disabled:hover:bg-[#262626] text-xs font-medium rounded text-white transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy Redacted JSON'}
          </button>
        </div>

        <div className="p-4 overflow-x-auto max-h-[500px] font-mono text-xs">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-zinc-400 gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-red-500" />
              <span>Awaiting companion extension response...</span>
            </div>
          ) : lastError ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-red-400 font-semibold">
                <ShieldAlert className="w-4 h-4" />
                <span>Error Code: {lastError.code}</span>
              </div>
              <pre className="text-red-300 bg-red-950/20 p-3 rounded-lg border border-red-900/40 whitespace-pre-wrap">
                {JSON.stringify(lastError, null, 2)}
              </pre>
            </div>
          ) : lastResult ? (
            <pre className="text-zinc-200 whitespace-pre-wrap">
              {JSON.stringify(redactPayload(lastResult), null, 2)}
            </pre>
          ) : (
            <div className="py-12 text-center text-zinc-500">
              Click any of the extension inspection buttons above to dispatch a live message.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

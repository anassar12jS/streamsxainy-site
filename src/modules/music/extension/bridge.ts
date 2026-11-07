/**
 * BitChord Companion Browser Extension Bridge
 * Detects MV3 companion extension for proxying CORS headers, YouTube Music session cookies,
 * Spotify Canvas animations, and Discord Rich Presence (RPC).
 */

export interface ExtensionStatus {
  available: boolean;
  version?: string;
  hasYouTubeAuth?: boolean;
  hasDiscordRpc?: boolean;
}

export class BitChordExtensionBridge {
  private static instance: BitChordExtensionBridge;
  private status: ExtensionStatus = { available: false };
  private listeners: Set<(status: ExtensionStatus) => void> = new Set();

  public static readonly EXTENSION_ID = 'pkddffeebcmhhanjcigilehaeonkkfih';

  private constructor() {
    this.init();
  }

  public static getInstance(): BitChordExtensionBridge {
    if (!BitChordExtensionBridge.instance) {
      BitChordExtensionBridge.instance = new BitChordExtensionBridge();
    }
    return BitChordExtensionBridge.instance;
  }

  private init() {
    if (typeof window === 'undefined') return;

    if ((window as any).__BITCHORD_EXTENSION__) {
      this.setStatus({
        available: true,
        version: (window as any).__BITCHORD_EXTENSION__.version || '0.4.4',
        hasYouTubeAuth: (window as any).__BITCHORD_EXTENSION__.hasYouTubeAuth,
        hasDiscordRpc: (window as any).__BITCHORD_EXTENSION__.hasDiscordRpc,
      });
      return;
    }

    // Step 2 FIXED: Added channel, direction, and handled lastError properly
    const pingExtension = () => {
      try {
        const chromeRuntime = (window as any).chrome?.runtime;
        if (chromeRuntime && typeof chromeRuntime.sendMessage === 'function') {
          chromeRuntime.sendMessage(
            BitChordExtensionBridge.EXTENSION_ID,
            { 
              channel: 'bitchord-bridge', // REQUIRED by background.js
              direction: 'to-extension',  // REQUIRED by background.js
              protocol: 1, 
              id: `ping-${Date.now()}`, 
              method: 'ping', 
              params: {} 
            },
            (response: any) => {
              if (chromeRuntime.lastError) {
                return; // suppress error if extension hasn't loaded yet
              }
              if (response && (response.version || response.protocol === 1 || response.ok)) {
                this.setStatus({
                  available: true,
                  version: response.result?.version || '0.4.4',
                  hasYouTubeAuth: true,
                  hasDiscordRpc: true,
                });
              }
            }
          );
        }
      } catch (e) {}
    };

    pingExtension();

    const onMessage = (event: MessageEvent) => {
      if (event.data && (event.data.type === 'BITCHORD_EXTENSION_PONG' || event.data.method === 'ping')) {
        this.setStatus({
          available: true,
          version: event.data.version || '0.4.4',
          hasYouTubeAuth: event.data.hasYouTubeAuth ?? true,
          hasDiscordRpc: event.data.hasDiscordRpc ?? true,
        });
      }
    };
    window.addEventListener('message', onMessage);

    try {
      window.postMessage({ type: 'BITCHORD_EXTENSION_PING', protocol: 1 }, '*');
    } catch {}

    const timer = setInterval(() => {
      if (this.status.available) {
        clearInterval(timer);
        return;
      }
      if ((window as any).__BITCHORD_EXTENSION__) {
        this.setStatus({ available: true, version: '0.4.4' });
        clearInterval(timer);
      } else {
        pingExtension();
      }
    }, 1000);

    setTimeout(() => clearInterval(timer), 8000);
  }

  private setStatus(newStatus: ExtensionStatus) {
    this.status = newStatus;
    this.listeners.forEach(cb => cb(this.status));
  }

  public getStatus(): ExtensionStatus {
    return this.status;
  }

  public subscribe(callback: (status: ExtensionStatus) => void): () => void {
    this.listeners.add(callback);
    callback(this.status);
    return () => this.listeners.delete(callback);
  }

  public async proxyFetch(input: RequestInfo | URL, options?: RequestInit): Promise<Response> {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const init = options || (typeof input === 'object' && !(input instanceof URL) ? (input as RequestInit) : {});

    // 1. Injected extension proxy if available
    if (this.status.available && (window as any).__BITCHORD_EXTENSION__?.proxyFetch) {
      try {
        return await (window as any).__BITCHORD_EXTENSION__.proxyFetch(url, init);
      } catch (e) {
        console.debug('Extension proxyFetch failed, falling back to direct fetch:', e);
      }
    }

    // 2. Direct chrome.runtime.sendMessage via yt.fetch
    const chromeRuntime = (window as any).chrome?.runtime;
    if (this.status.available && chromeRuntime && typeof chromeRuntime.sendMessage === 'function') {
      try {
        const isYt = /youtube\.com|googlevideo\.com/.test(url);
        if (isYt) {
          const resp = await new Promise<any>((resolve) => {
            let bodyStr: string | undefined;
            if (init.body) {
              bodyStr = typeof init.body === 'string' ? init.body : JSON.stringify(init.body);
            }
            chromeRuntime.sendMessage(
              BitChordExtensionBridge.EXTENSION_ID,
              {
                channel: 'bitchord-bridge',
                direction: 'to-extension',
                protocol: 1,
                id: `fetch-${Date.now()}-${Math.random()}`,
                method: 'yt.fetch',
                params: {
                  url,
                  method: init.method || 'GET',
                  headers: (init.headers as Record<string, string>) || {},
                  body: bodyStr,
                  auth: true,
                }
              },
              (res: any) => {
                if (chromeRuntime.lastError) {
                  resolve(null);
                } else {
                  resolve(res);
                }
              }
            );
          });

          if (resp && resp.ok && resp.result) {
            const r = resp.result;
            return new Response(r.body, {
              status: r.status || 200,
              headers: r.headers || {},
            });
          }
        }
      } catch (e) {
        console.debug('Extension yt.fetch failed, falling back to fetch:', e);
      }
    }

    const cleanInit: RequestInit = { ...init };
    const method = (cleanInit.method || 'GET').toUpperCase();
    if (method === 'GET' || method === 'HEAD') {
      delete cleanInit.body;
    }

    return fetch(url, cleanInit);
  }

  public updateDiscordRpc(track: { title: string; artist: string; duration: number; artwork?: string }) {
    if (!this.status.available) return;
    try {
      window.postMessage({
        type: 'BITCHORD_DISCORD_RPC_UPDATE',
        payload: {
          details: track.title,
          state: `by ${track.artist}`,
          largeImageKey: track.artwork || 'applemusic_logo',
          largeImageText: 'StreamHub BitChord Music',
          startTimestamp: Math.floor(Date.now() / 1000),
        },
      }, '*');
    } catch {}
  }
}

export const extensionBridge = BitChordExtensionBridge.getInstance();
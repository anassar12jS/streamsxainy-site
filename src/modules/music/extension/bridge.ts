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

    // 1. Direct window injection check
    if ((window as any).__BITCHORD_EXTENSION__) {
      this.setStatus({
        available: true,
        version: (window as any).__BITCHORD_EXTENSION__.version || '1.0.0',
        hasYouTubeAuth: (window as any).__BITCHORD_EXTENSION__.hasYouTubeAuth,
        hasDiscordRpc: (window as any).__BITCHORD_EXTENSION__.hasDiscordRpc,
      });
      return;
    }

    // 2. Window postMessage handshake protocol
    const onMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'BITCHORD_EXTENSION_PONG') {
        this.setStatus({
          available: true,
          version: event.data.version || '1.0.0',
          hasYouTubeAuth: event.data.hasYouTubeAuth ?? false,
          hasDiscordRpc: event.data.hasDiscordRpc ?? false,
        });
      }
    };
    window.addEventListener('message', onMessage);

    // Ping extension
    try {
      window.postMessage({ type: 'BITCHORD_EXTENSION_PING' }, '*');
    } catch {}

    // 3. Fallback: Check if chrome.runtime is exposed by extension content script
    setTimeout(() => {
      if (!this.status.available) {
        if ((window as any).__BITCHORD_EXTENSION__) {
          this.setStatus({ available: true, version: '1.0.0' });
        }
      }
    }, 1200);
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

  /**
   * Proxies an HTTP request through extension to bypass strict CORS if available.
   * Falls back to direct window.fetch if extension is absent.
   */
  public async proxyFetch(url: string, options: RequestInit = {}): Promise<Response> {
    if (this.status.available && (window as any).__BITCHORD_EXTENSION__?.proxyFetch) {
      try {
        return await (window as any).__BITCHORD_EXTENSION__.proxyFetch(url, options);
      } catch (e) {
        console.debug('Extension proxyFetch failed, falling back to direct fetch:', e);
      }
    }
    return fetch(url, options);
  }

  /**
   * Syncs current music playback with Discord Rich Presence via extension
   */
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

/**
 * Xainy Music Companion Browser Extension Bridge (MV3 Protocol 1)
 * Extension ID: pkddffeebcmhhanjcigilehaeonkkfih
 * 
 * Strict gateway to the Xainy Music MV3 extension for YouTube Music session cookies,
 * CORS bypass, Spotify OAuth & Discord Rich Presence.
 */

export type BridgeErrorCode = 
  | 'NO_EXTENSION' 
  | 'TIMEOUT' 
  | 'REJECTED' 
  | 'NOT_SIGNED_IN' 
  | 'NETWORK_ERROR'
  | 'UNKNOWN';

export class BridgeError extends Error {
  public readonly code: BridgeErrorCode;
  public readonly originalError?: any;

  constructor(code: BridgeErrorCode, message: string, originalError?: any) {
    super(message);
    this.name = 'BridgeError';
    this.code = code;
    this.originalError = originalError;
    Object.setPrototypeOf(this, BridgeError.prototype);
  }
}

export interface ExtensionStatus {
  available: boolean;
  version?: string;
  hasYouTubeAuth?: boolean;
  hasDiscordRpc?: boolean;
  activeAccount?: string;
}

/** One selectable YouTube Music channel (a Google account's own channel or a brand channel). */
export interface YtChannel {
  id: string;
  name: string;
  email?: string;
  handle?: string | null;
  photoUrl?: string;
  selected?: boolean;
  brand?: boolean;
}

/** Normalised `yt.authState`. Never contains invented accounts. */
export interface YtAuthState {
  extensionAvailable: boolean;
  /** Browser has Google session cookies */
  browserSignedIn: boolean;
  /** YouTube integration switched on in the extension popup */
  connected: boolean;
  /** YouTube actually accepted the session and returned an account */
  signedIn: boolean;
  problem?: string | null;
  /** code is the extension's own code when it sent one (e.g. 'forbidden'), else the BridgeError code */
  error?: { code: string; message: string } | null;
  accounts: YtChannel[];
  active: YtChannel | null;
}

export interface BridgeCallOptions {
  timeoutMs?: number;
  retryOnWakeup?: boolean;
}

const YOUTUBE_HOST_REGEX = /(?:^|\.)(?:youtube\.com|music\.youtube\.com|youtubei\.googleapis\.com|suggestqueries-clients6\.youtube\.com|googlevideo\.com|googleusercontent\.com|ggpht\.com)$/i;

export class XainyMusicBridge {
  private static instance: XainyMusicBridge;
  private status: ExtensionStatus = { available: false };
  private listeners: Set<(status: ExtensionStatus) => void> = new Set();
  public static readonly EXTENSION_ID = 'pkddffeebcmhhanjcigilehaeonkkfih';

  private constructor() {
    this.init();
  }

  public static getInstance(): XainyMusicBridge {
    if (!XainyMusicBridge.instance) {
      XainyMusicBridge.instance = new XainyMusicBridge();
    }
    return XainyMusicBridge.instance;
  }

  private init() {
    if (typeof window === 'undefined') return;

    // Check if extension injected global object
    if ((window as any).__BITCHORD_EXTENSION__) {
      this.setStatus({
        available: true,
        version: (window as any).__BITCHORD_EXTENSION__.version || '0.4.4',
        hasYouTubeAuth: (window as any).__BITCHORD_EXTENSION__.hasYouTubeAuth ?? false,
        hasDiscordRpc: (window as any).__BITCHORD_EXTENSION__.hasDiscordRpc ?? false,
      });
      return;
    }

    // Ping extension directly via chrome.runtime
    this.ping().catch(() => {});

    // Periodic detection check (first 10 seconds)
    let retries = 0;
    const interval = setInterval(async () => {
      retries++;
      if (this.status.available || retries > 8) {
        clearInterval(interval);
        return;
      }
      try {
        await this.ping(1200);
      } catch {}
    }, 1200);

    // Listen for postMessage from content scripts or companion tabs
    const onMessage = (event: MessageEvent) => {
      if (!event.data) return;
      // Only a real pong counts; a reply carrying channel:'bitchord-bridge' may be a refusal.
      if (
        event.data.type === 'BITCHORD_EXTENSION_PONG' ||
        event.data.type === 'BITCHORD_PONG' ||
        (event.data.channel === 'bitchord-bridge' && event.data.ok === true)
      ) {
        this.setStatus({
          available: true,
          version: event.data.version || event.data.result?.version,
        });
      }
    };
    window.addEventListener('message', onMessage);
  }

  public setStatus(newStatus: Partial<ExtensionStatus>) {
    this.status = { ...this.status, ...newStatus };
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
   * Verified single door to chrome.runtime for Xainy Music companion extension.
   * Envelope: { channel: 'bitchord-bridge', direction: 'to-extension', protocol: 1, id, method, params }
   */
  public async call<T = any>(
    method: string, 
    params: Record<string, any> = {}, 
    options: BridgeCallOptions = {}
  ): Promise<T> {
    const { timeoutMs = 15000, retryOnWakeup = true } = options;
    const chromeRuntime = (typeof window !== 'undefined' ? (window as any).chrome?.runtime : undefined);

    if (!chromeRuntime || typeof chromeRuntime.sendMessage !== 'function') {
      throw new BridgeError(
        'NO_EXTENSION',
        'Xainy Music companion browser extension is not detected in this browser.'
      );
    }

    const executeCall = (): Promise<T> => {
      return new Promise<T>((resolve, reject) => {
        let isSettled = false;
        const reqId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

        const timer = setTimeout(() => {
          if (!isSettled) {
            isSettled = true;
            reject(new BridgeError('TIMEOUT', `Extension request '${method}' timed out after ${timeoutMs}ms`));
          }
        }, timeoutMs);

        try {
          chromeRuntime.sendMessage(
            XainyMusicBridge.EXTENSION_ID,
            {
              channel: 'bitchord-bridge',
              direction: 'to-extension',
              protocol: 1,
              id: reqId,
              method,
              params: params || {},
            },
            (response: any) => {
              if (isSettled) return;
              isSettled = true;
              clearTimeout(timer);

              const lastError = chromeRuntime.lastError;
              if (lastError) {
                const errMsg = lastError.message || String(lastError);
                if (errMsg.includes('Receiving end does not exist') || errMsg.includes('Could not establish connection')) {
                  reject(new BridgeError('NO_EXTENSION', `Extension service worker asleep or unreachable: ${errMsg}`, lastError));
                } else {
                  reject(new BridgeError('REJECTED', `Extension error: ${errMsg}`, lastError));
                }
                return;
              }

              if (!response) {
                reject(new BridgeError('REJECTED', `Extension returned empty response for method '${method}'`));
                return;
              }

              if (response.ok === false || response.error) {
                const errDetail = typeof response.error === 'string' ? response.error : response.error?.message || 'Operation failed';
                const code: BridgeErrorCode = 
                  response.error?.code === 'NOT_SIGNED_IN' || /not signed in|unauthorized|auth/i.test(errDetail)
                    ? 'NOT_SIGNED_IN'
                    : 'REJECTED';
                reject(new BridgeError(code, errDetail, response.error));
                return;
              }

              // Update availability on successful response
              if (!this.status.available) {
                this.setStatus({ available: true });
              }

              // Return unwrapped result or full response
              const result = response.result !== undefined ? response.result : response;
              resolve(result as T);
            }
          );
        } catch (syncErr) {
          if (!isSettled) {
            isSettled = true;
            clearTimeout(timer);
            reject(new BridgeError('REJECTED', `Failed to send message: ${syncErr}`, syncErr));
          }
        }
      });
    };

    try {
      return await executeCall();
    } catch (err: any) {
      // Retry once if MV3 service worker was asleep
      if (
        retryOnWakeup && 
        err instanceof BridgeError && 
        err.code === 'NO_EXTENSION' && 
        err.message.includes('asleep')
      ) {
        await new Promise(r => setTimeout(r, 400));
        return await executeCall();
      }
      throw err;
    }
  }

  public async ping(timeoutMs = 2500): Promise<{ ok: boolean; version?: string }> {
    try {
      const res = await this.call<{ version?: string }>('ping', {}, { timeoutMs, retryOnWakeup: false });
      this.setStatus({ available: true, version: res?.version });
      return { ok: true, version: res?.version };
    } catch (err) {
      return { ok: false };
    }
  }

  /**
   * Helper to check if a URL belongs to YouTube/GoogleVideo services
   */
  public isYouTubeHost(url: string): boolean {
    try {
      const hostname = new URL(url).hostname;
      return YOUTUBE_HOST_REGEX.test(hostname);
    } catch {
      return /youtube\.com|googlevideo\.com/i.test(url);
    }
  }

  /**
   * Strict proxyFetch:
   * 1. Handles Request, URL, string inputs.
   * 2. Strips 'body' on GET/HEAD requests to prevent browser TypeError.
   * 3. Sends YouTube & Google requests through the extension via `yt.fetch`.
   * 4. NEVER falls back to window.fetch for YouTube hosts (throws typed BridgeError instead to avoid CORS 405s).
   * 5. Handles base64 encoded responses and null body HTTP status codes (101, 204, 205, 304).
   */
  public async proxyFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    let url: string;
    let method = 'GET';
    let headers: Record<string, string> = {};
    let body: any = undefined;

    if (input instanceof Request) {
      url = input.url;
      method = input.method;
      input.headers.forEach((v, k) => { headers[k] = v; });
      if (init?.body) {
        body = init.body;
      } else if (method !== 'GET' && method !== 'HEAD') {
        try {
          body = await input.clone().text();
        } catch {}
      }
    } else if (input instanceof URL) {
      url = input.toString();
    } else {
      url = String(input);
    }

    if (init) {
      if (init.method) method = init.method;
      if (init.headers) {
        if (init.headers instanceof Headers) {
          init.headers.forEach((v, k) => { headers[k] = v; });
        } else if (Array.isArray(init.headers)) {
          init.headers.forEach(([k, v]) => { headers[k] = v; });
        } else {
          headers = { ...headers, ...(init.headers as Record<string, string>) };
        }
      }
      if (init.body !== undefined) {
        body = init.body;
      }
    }

    method = method.toUpperCase();
    const isGetOrHead = method === 'GET' || method === 'HEAD';
    if (isGetOrHead) {
      body = undefined;
    }

    // Public static endpoints that YouTube doesn't need auth for or that yt.fetch explicitly rejects
    if (url.includes('/iframe_api')) {
      return new Response(
        `if (!window['YT']) {var YT = {loading: 0,loaded: 0};} (function(){ var player = "player/22c069eb/"; })();`,
        {
          status: 200,
          headers: { 'Content-Type': 'application/javascript; charset=utf-8' },
        }
      );
    }

    if (url.includes('/generate_204')) {
      return new Response(null, { status: 204 });
    }

    const isYt = this.isYouTubeHost(url);

    // If it's YouTube / Google Video, route through extension yt.fetch
    if (isYt) {
      try {
        let serializedBody: string | undefined = undefined;
        if (body !== undefined && !isGetOrHead) {
          if (typeof body === 'string') {
            serializedBody = body;
          } else if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) {
            serializedBody = new TextDecoder().decode(body);
          } else {
            serializedBody = JSON.stringify(body);
          }
        }

        const res = await this.call<any>('yt.fetch', {
          url,
          method,
          headers,
          body: serializedBody,
          auth: true,
        }, { timeoutMs: 20000 });

        if (res) {
          const status = res.status || 200;
          const resHeaders = res.headers || {};
          
          // HTTP 101, 204, 205, 304 cannot have a body
          const isNullBodyStatus = [101, 204, 205, 304].includes(status);
          if (isNullBodyStatus) {
            return new Response(null, { status, statusText: res.statusText, headers: resHeaders });
          }

          let responseBody: BodyInit | null = null;
          if (res.bodyEncoding === 'base64' && typeof res.body === 'string') {
            const binary = atob(res.body);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
              bytes[i] = binary.charCodeAt(i);
            }
            responseBody = bytes.buffer;
          } else if (res.body !== undefined && res.body !== null) {
            responseBody = typeof res.body === 'string' ? res.body : JSON.stringify(res.body);
          }

          return new Response(responseBody, {
            status,
            statusText: res.statusText,
            headers: resHeaders,
          });
        }
      } catch (extError: any) {
        // If extension says it doesn't serve this static URL (e.g. static player script or asset), try direct fetch
        const errMsg = extError?.message || String(extError);
        if (errMsg.includes("doesn't serve") || url.includes('/s/player/') || url.endsWith('.js') || url.endsWith('.css')) {
          try {
            return await fetch(url, { method, headers });
          } catch {}
        }

        // GROUND RULE #3: Never fall back to window.fetch for YouTube API endpoints!
        // That is what creates the 405 Method Not Allowed / CORS failure.
        console.warn(`[Xainy Music Bridge] Extension proxyFetch failed for ${url}:`, errMsg);
        throw new BridgeError(
          extError instanceof BridgeError ? extError.code : 'REJECTED',
          `Cannot fetch YouTube resource "${url}" without active Xainy Music Extension: ${errMsg}`,
          extError
        );
      }
    }

    // For non-YouTube hosts (e.g. Spotify APIs, lyrics, local routes), use window.fetch
    const directInit: RequestInit = {
      method,
      headers,
    };
    try {
      return await fetch(url, directInit);
    } catch (netErr: any) {
      console.debug(`[Bridge proxyFetch] Direct fetch failed for ${url}:`, netErr?.message);
      return new Response(JSON.stringify({ error: 'Direct fetch failed', message: netErr?.message }), {
        status: 502,
        statusText: 'Bad Gateway',
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  /**
   * Compatibility wrapper for older code calling sendExtensionMessage
   */
  public async sendExtensionMessage(method: string, params: any = {}): Promise<any> {
    try {
      return await this.call(method, params);
    } catch (e) {
      console.debug(`sendExtensionMessage('${method}') failed:`, e);
      return null;
    }
  }

  /**
   * Reads the REAL signed-in YouTube Music state from the extension. The extension returns
   * accounts[] each with channels[]; they are flattened here into one selectable list.
   * No placeholder or cached accounts are ever invented: when nothing is signed in,
   * `accounts` is empty and `problem` / `error` say why.
   */
  public async getAuthState(refresh = true): Promise<YtAuthState> {
    const empty: YtAuthState = {
      extensionAvailable: false,
      browserSignedIn: false,
      connected: false,
      signedIn: false,
      problem: null,
      error: null,
      accounts: [],
      active: null,
    };

    let raw: any;
    try {
      raw = await this.call<any>('yt.authState', { refresh }, { timeoutMs: 15000 });
    } catch (e: any) {
      const extCode = e?.originalError?.code; // e.g. 'forbidden' when the origin isn't allowed
      return {
        ...empty,
        extensionAvailable: e?.code !== 'NO_EXTENSION',
        error: { code: extCode || e?.code || 'UNKNOWN', message: e?.message || String(e) },
      };
    }

    const activeId: string | undefined = raw?.active?.id;
    const accounts: YtChannel[] = (raw?.accounts ?? []).flatMap((acc: any) =>
      (acc.channels ?? []).map((ch: any): YtChannel => ({
        id: ch.id,
        name: ch.name,
        email: acc.email ?? undefined,
        handle: ch.handle ?? null,
        photoUrl: ch.avatarUrl ?? acc.avatarUrl ?? undefined,
        brand: !!ch.brand,
        selected: ch.id === activeId,
      }))
    );
    const active = accounts.find(a => a.selected) ?? null;
    return {
      extensionAvailable: true,
      browserSignedIn: !!raw?.browserSignedIn,
      connected: !!raw?.connected,
      signedIn: !!raw?.signedIn && !!active,
      problem: raw?.problem ?? null,
      error: null,
      accounts,
      active,
    };
  }

  /**
   * Locks in the channel used for authenticated requests. Throws if the extension refuses
   * (it validates the id against the browser's real accounts).
   */
  public async selectChannel(channelId: string): Promise<YtAuthState> {
    await this.call('yt.selectChannel', { channelId });
    try {
      localStorage.setItem('bitchord_selected_channel_id', channelId);
    } catch {}
    return this.getAuthState(false);
  }

  public updateDiscordRpc(track: { title: string; artist: string; duration: number; artwork?: string }) {
    if (!this.status.available) return;
    try {
      this.call('discord.presence', { track, options: {} }, { timeoutMs: 3000, retryOnWakeup: false }).catch(() => {});
    } catch {}
  }
}

export const extensionBridge = XainyMusicBridge.getInstance();
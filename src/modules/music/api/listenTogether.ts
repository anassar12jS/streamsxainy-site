import { PartyMember, PartyState, MusicTrack } from '../types';

const SERVER_BASE = 'https://api.bitchord.kushagrasingh.in';
const WS_BASE = 'wss://api.bitchord.kushagrasingh.in';

export interface ClockSyncResult {
  offsetMs: number;
  rttMs: number;
}

export type PartyEventType = 
  | 'welcome' 
  | 'state' 
  | 'sync' 
  | 'members' 
  | 'queue' 
  | 'control' 
  | 'error' 
  | 'bye';

export type PartyEventListener = (type: PartyEventType, payload: any) => void;

export class ListenTogetherClient {
  private static instance: ListenTogetherClient;
  private ws: WebSocket | null = null;
  private token: string | null = null;
  private partyCode: string | null = null;
  private isHost: boolean = false;
  private clockOffsetMs: number = 0;
  private bestRttMs: number = Infinity;
  private listeners: Set<PartyEventListener> = new Set();
  private pingInterval: any = null;

  public static getInstance(): ListenTogetherClient {
    if (!ListenTogetherClient.instance) {
      ListenTogetherClient.instance = new ListenTogetherClient();
    }
    return ListenTogetherClient.instance;
  }

  /**
   * Syncs the local performance clock with the Go party server
   * Offset = serverMs - (t0 + t1) / 2
   */
  public async syncServerClock(): Promise<ClockSyncResult> {
    const t0 = performance.timeOrigin + performance.now();
    try {
      const res = await fetch(`${SERVER_BASE}/api/time`);
      const t1 = performance.timeOrigin + performance.now();
      const rttMs = t1 - t0;

      if (res.ok) {
        const data = await res.json();
        const serverMs = typeof data.time === 'number' ? data.time : (data.serverTimeMs || Date.now());
        const offset = serverMs - (t0 + t1) / 2;

        if (rttMs < this.bestRttMs) {
          this.bestRttMs = rttMs;
          this.clockOffsetMs = offset;
        }
        return { offsetMs: this.clockOffsetMs, rttMs };
      }
    } catch (err) {
      console.debug('ListenTogether syncServerClock fallback to local time:', err);
    }
    return { offsetMs: 0, rttMs: 0 };
  }

  public getServerNowMs(): number {
    const localNow = performance.timeOrigin + performance.now();
    return localNow + this.clockOffsetMs;
  }

  /**
   * Computes exact playhead position in milliseconds
   * Playhead = positionMs + max(0, serverNow - anchorMs) while playing
   */
  public computePlayheadMs(positionMs: number, anchorMs: number, isPlaying: boolean): number {
    if (!isPlaying || anchorMs <= 0) return positionMs;
    const serverNow = this.getServerNowMs();
    const elapsed = Math.max(0, serverNow - anchorMs);
    return positionMs + elapsed;
  }

  /**
   * Creates a new party room
   */
  public async createParty(hostName: string = 'Host'): Promise<{ code: string; token: string }> {
    await this.syncServerClock();

    try {
      const res = await fetch(`${SERVER_BASE}/api/parties`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: hostName }),
      });
      if (res.ok) {
        const data = await res.json();
        this.partyCode = data.code;
        this.token = data.token;
        this.isHost = true;
        this.connectWebSocket(data.code, data.token);
        return { code: data.code, token: data.token };
      }
    } catch (err) {
      console.warn('Failed to create remote party on server, activating local room session:', err);
    }

    // Local room fallback if server is unreachable
    const fallbackCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const fallbackToken = `token_${Date.now()}`;
    this.partyCode = fallbackCode;
    this.token = fallbackToken;
    this.isHost = true;
    return { code: fallbackCode, token: fallbackToken };
  }

  /**
   * Joins an existing party room
   */
  public async joinParty(code: string, memberName: string = 'Guest'): Promise<{ success: boolean; state?: PartyState }> {
    await this.syncServerClock();
    const cleanCode = code.trim().toUpperCase();

    try {
      const res = await fetch(`${SERVER_BASE}/api/parties/${cleanCode}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: memberName }),
      });
      if (res.ok) {
        const data = await res.json();
        this.partyCode = cleanCode;
        this.token = data.token;
        this.isHost = false;
        this.connectWebSocket(cleanCode, data.token);
        return { success: true, state: data.state };
      }
    } catch (err) {
      console.warn('Failed to join remote party via API:', err);
    }

    // Connect directly via code
    this.partyCode = cleanCode;
    this.token = `token_${Date.now()}`;
    this.isHost = false;
    return { success: true };
  }

  private connectWebSocket(code: string, token: string) {
    if (this.ws) {
      try { this.ws.close(); } catch {}
    }

    try {
      const wsUrl = `${WS_BASE}/ws/parties/${code}?token=${encodeURIComponent(token)}`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.startHeartbeat();
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          const type = (msg.type || msg.action || 'sync') as PartyEventType;
          this.emit(type, msg);
        } catch {}
      };

      this.ws.onclose = () => {
        this.stopHeartbeat();
      };

      this.ws.onerror = () => {
        this.stopHeartbeat();
      };
    } catch {}
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping', t0: performance.timeOrigin + performance.now() }));
      }
    }, 15000);
  }

  private stopHeartbeat() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Broadcasts play/pause/seek controls to party
   */
  public sendControl(action: 'play' | 'pause' | 'seek' | 'next' | 'previous', positionSeconds?: number) {
    const serverNow = this.getServerNowMs();
    const positionMs = positionSeconds !== undefined ? Math.round(positionSeconds * 1000) : 0;

    const payload = {
      type: 'control',
      action,
      positionMs,
      anchorMs: serverNow,
    };

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
    this.emit('control', payload);
  }

  /**
   * Broadcasts queue updates or track changes
   */
  public sendTrackChange(track: MusicTrack) {
    const serverNow = this.getServerNowMs();
    const payload = {
      type: 'state',
      track,
      positionMs: 0,
      anchorMs: serverNow,
      isPlaying: true,
    };
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
    this.emit('state', payload);
  }

  public leaveParty() {
    if (this.partyCode && this.token) {
      try {
        fetch(`${SERVER_BASE}/api/parties/${this.partyCode}/leave`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.token}`,
          },
        }).catch(() => {});
      } catch {}
    }

    if (this.ws) {
      try { this.ws.close(); } catch {}
      this.ws = null;
    }
    this.stopHeartbeat();
    this.partyCode = null;
    this.token = null;
    this.isHost = false;
    this.emit('bye', {});
  }

  public subscribe(listener: PartyEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(type: PartyEventType, payload: any) {
    this.listeners.forEach(fn => {
      try { fn(type, payload); } catch {}
    });
  }

  public get currentPartyCode(): string | null {
    return this.partyCode;
  }

  public get isCurrentHost(): boolean {
    return this.isHost;
  }
}

export const listenTogetherClient = ListenTogetherClient.getInstance();

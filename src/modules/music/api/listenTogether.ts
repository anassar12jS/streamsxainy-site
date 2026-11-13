import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { PartyMember, PartyState, MusicTrack } from '../types';

/**
 * Listen Together — real-time synced listening over Supabase Realtime.
 *
 * One public Realtime channel per party (`lt-party-{code}`) carries:
 *  - presence  → who is in the room (member list)
 *  - broadcast → host state snapshots + play/pause/seek controls
 *
 * Guests are listen-only: they receive state and follow it, they never
 * publish playback controls. The host is the single source of truth.
 *
 * Requires VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY (public anon key is
 * safe to ship — Realtime channels here are not backed by RLS tables).
 */

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || '';
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || '';

export const isPartyBackendConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

let supabase: SupabaseClient | null = null;
if (isPartyBackendConfigured) {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    realtime: { params: { eventsPerSecond: 10 } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type PartyEventType =
  | 'welcome'
  | 'state'
  | 'control'
  | 'members'
  | 'sync'
  | 'error'
  | 'bye'
  | 'host_left'
  | 'promoted'
  | 'member_joined'
  | 'chat';

export type PartyEventListener = (type: PartyEventType, payload: any) => void;

export interface RemotePlaybackState {
  track: MusicTrack | null;
  queue: MusicTrack[];
  queueIndex: number;
  positionMs: number;
  anchorMs: number;   // host-clock timestamp when positionMs was true
  isPlaying: boolean;
  /** If set, only this member should apply the message */
  to?: string;
}

export interface RemoteControl {
  action: 'play' | 'pause' | 'seek';
  positionMs?: number;
  /** host-clock timestamp the positionMs/anchor pair is anchored to */
  anchorMs?: number;
  to?: string;
}

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no ambiguous chars

const makeCode = (): string => {
  let code = '';
  for (let i = 0; i < 6; i++) code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return code;
};

interface SyncPing { t0: number; }
interface SyncPong { to: string; t0: number; t1: number; }

export class ListenTogetherClient {
  private static instance: ListenTogetherClient;
  private channel: RealtimeChannel | null = null;
  private partyCode: string | null = null;
  private memberId: string = '';
  private memberName: string = '';
  private isHost: boolean = false;
  private myJoinedAt = 0;
  private listeners: Set<PartyEventListener> = new Set();
  /** Offset that maps local Date.now() onto the host's clock domain */
  private clockOffsetMs: number = 0;
  private lastSyncAt = 0;
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private subscribed = false;

  public static getInstance(): ListenTogetherClient {
    if (!ListenTogetherClient.instance) {
      ListenTogetherClient.instance = new ListenTogetherClient();
    }
    return ListenTogetherClient.instance;
  }

  /** Host clock domain "now" for guests; local now for the host. */
  public getServerNowMs(): number {
    return Date.now() + this.clockOffsetMs;
  }

  /** playhead = positionMs + elapsed-since-anchor while playing */
  public computePlayheadMs(positionMs: number, anchorMs: number, isPlaying: boolean): number {
    if (!isPlaying || anchorMs <= 0) return positionMs;
    return positionMs + Math.max(0, this.getServerNowMs() - anchorMs);
  }

  public get configured(): boolean {
    return isPartyBackendConfigured;
  }

  public get currentPartyCode(): string | null {
    return this.partyCode;
  }

  public get isCurrentHost(): boolean {
    return this.isHost;
  }

  public get myMemberId(): string {
    return this.memberId;
  }

  public get myName(): string {
    return this.memberName;
  }

  // ---------------------------------------------------------------- create/join

  public async createParty(hostName: string): Promise<{ code?: string; error?: string }> {
    if (!supabase) return { error: 'Listen Together is not configured on this deployment.' };
    this.leaveParty();

    this.memberId = `m_${Math.random().toString(36).slice(2, 10)}`;
    this.memberName = hostName || 'Host';
    this.isHost = true;
    this.myJoinedAt = Date.now();

    // Retry a few codes in case of a rare collision on an existing channel
    for (let attempt = 0; attempt < 3; attempt++) {
      const code = makeCode();
      const channel = this.openChannel(code);
      const ok = await this.waitForSubscribe(channel);
      if (!ok) continue;
      this.partyCode = code;
      this.emit('welcome', { code, role: 'host' });
      return { code };
    }
    return { error: 'Could not create a party room. Try again.' };
  }

  public async joinParty(code: string, memberName: string): Promise<{ success: boolean; error?: string }> {
    if (!supabase) return { success: false, error: 'Listen Together is not configured on this deployment.' };
    const cleanCode = code.trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(cleanCode)) {
      return { success: false, error: 'Enter the 6-character party code.' };
    }
    this.leaveParty();

    this.memberId = `m_${Math.random().toString(36).slice(2, 10)}`;
    this.memberName = memberName || 'Guest';
    this.isHost = false;
    this.clockOffsetMs = 0;
    this.myJoinedAt = Date.now();

    const channel = this.openChannel(cleanCode);
    const ok = await this.waitForSubscribe(channel);
    if (!ok) return { success: false, error: 'Could not connect to that room.' };

    this.partyCode = cleanCode;
    // Announce ourselves — the host replies with the current state addressed to us
    this.send('hello', { memberId: this.memberId, name: this.memberName });
    this.emit('welcome', { code: cleanCode, role: 'guest' });
    return { success: true };
  }

  public leaveParty() {
    const wasHost = this.isHost;
    const code = this.partyCode;

    if (this.channel && supabase) {
      try {
        if (wasHost && code) {
          // Tell guests the room is done before we go
          this.channel.send({
            type: 'broadcast',
            event: 'party',
            payload: { kind: 'host_left' },
          });
        }
        supabase.removeChannel(this.channel);
      } catch {}
    }
    this.channel = null;
    if (this.syncInterval) { clearInterval(this.syncInterval); this.syncInterval = null; }
    this.partyCode = null;
    this.isHost = false;
    this.subscribed = false;
    if (code) this.emit('bye', { code });
  }

  // ---------------------------------------------------------------- host publish API

  /** Host: publish the full playback snapshot (track, queue, position anchor). */
  public publishState(state: Omit<RemotePlaybackState, 'anchorMs' | 'to'> & { to?: string }) {
    if (!this.isHost || !this.channel) return;
    const payload: RemotePlaybackState = { ...state, anchorMs: Date.now() };
    this.send('state', payload);
  }

  /** Host: publish a transport control, stamped with the host clock. */
  public publishControl(control: RemoteControl) {
    if (!this.isHost || !this.channel) return;
    this.send('control', { ...control, anchorMs: Date.now() });
  }

  /** Anyone in the room can chat — social, not a playback control. */
  public sendChat(text: string) {
    const clean = String(text || '').trim().slice(0, 200);
    if (!clean || !this.channel) return;
    this.send('chat', { memberId: this.memberId, name: this.memberName, text: clean, ts: Date.now() });
  }

  /** Guest → host promotion after the host leaves. Re-tracks presence and
   *  notifies listeners so the app layer starts publishing state again. */
  private promoteToHost() {
    if (this.isHost || !this.channel) return;
    this.isHost = true;
    this.clockOffsetMs = 0; // new clock domain — guests re-sync via ping-pong
    try {
      void this.channel.track({
        id: this.memberId,
        name: this.memberName,
        isHost: true,
        joinedAt: this.myJoinedAt,
      });
    } catch {}
    this.emit('promoted', {});
  }

  // ---------------------------------------------------------------- internals

  private openChannel(code: string): RealtimeChannel {
    this.subscribed = false;
    const channelName = `lt-party-${code}`;
    const channel = supabase!.channel(channelName, {
      config: {
        presence: { key: this.memberId },
        broadcast: { self: false, ack: false },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PartyMember>();
        const members: PartyMember[] = [];
        for (const presences of Object.values(state)) {
          for (const p of presences as any[]) {
            if (p?.name) members.push({ id: p.id || p.name, name: p.name, isHost: !!p.isHost, joinedAt: p.joinedAt });
          }
        }
        members.sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));
        this.emit('members', { members });

        // Host migration: if nobody carries the host flag, the earliest-joined
        // member promotes themselves — deterministic, so exactly one client wins.
        if (!this.isHost && members.length > 0 && !members.some(m => m.isHost)) {
          if (members[0].id === this.memberId) this.promoteToHost();
        }

        // Host: when someone new shows up, send them the current snapshot
        if (this.isHost && members.length > 1) {
          this.emit('member_joined', { members });
        }
      })
      .on('broadcast', { event: 'party' }, ({ payload }: { payload: any }) => {
        this.handleBroadcast(payload);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          this.subscribed = true;
          try {
            await channel.track({
              id: this.memberId,
              name: this.memberName,
              isHost: this.isHost,
              joinedAt: Date.now(),
            });
          } catch {}
          this.startClockSync();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          this.emit('error', { message: 'Lost connection to the party room.' });
        }
      });

    this.channel = channel;
    return channel;
  }

  private waitForSubscribe(channel: RealtimeChannel): Promise<boolean> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(this.subscribed), 8000);
      const check = setInterval(() => {
        if (this.subscribed) {
          clearTimeout(timeout);
          clearInterval(check);
          resolve(true);
        }
      }, 100);
      // If subscribe errored, subscribed stays false and we time out
      void channel;
    });
  }

  private send(kind: string, payload: any) {
    if (!this.channel) return;
    try {
      this.channel.send({ type: 'broadcast', event: 'party', payload: { kind, ...payload } });
    } catch {}
  }

  private handleBroadcast(raw: any) {
    if (!raw || typeof raw !== 'object') return;
    const kind = raw.kind as string;
    const addressedToMe = !raw.to || raw.to === this.memberId;

    switch (kind) {
      case 'state':
        if (addressedToMe) this.emit('state', raw as RemotePlaybackState & { kind: string });
        break;
      case 'control':
        if (addressedToMe) this.emit('control', raw as RemoteControl & { kind: string });
        break;
      case 'hello':
        // A guest arrived — if we're the host, the MusicModule layer responds
        // with a state snapshot addressed to them (via 'member_joined' above
        // and this explicit hello for immediacy).
        this.emit('member_joined', { hello: raw });
        break;
      case 'sync_request': {
        // Guests ask for the host clock; only the host answers
        if (this.isHost && raw.ping) {
          const ping = raw.ping as SyncPing;
          this.send('sync_response', { to: raw.memberId, t0: ping.t0, t1: Date.now() } satisfies SyncPong);
        }
        break;
      }
      case 'sync_response': {
        if (raw.to === this.memberId && typeof raw.t0 === 'number' && typeof raw.t1 === 'number') {
          const rtt = Date.now() - raw.t0;
          // offset such that localNow + offset ≈ hostNow(t1 midpoint)
          const offset = raw.t1 - (raw.t0 + rtt / 2);
          // Only accept sane offsets (< 1 day skew)
          if (Math.abs(offset) < 86_400_000) this.clockOffsetMs = offset;
        }
        break;
      }
      case 'host_left':
        // Party continues — presence sync will promote the earliest member.
        if (!this.isHost) this.emit('host_left', {});
        break;
      case 'chat':
        this.emit('chat', raw);
        break;
    }
  }

  /** Periodic clock re-sync for guests (cheap ping-pong every 30s). */
  private startClockSync() {
    if (this.syncInterval) clearInterval(this.syncInterval);
    const tick = () => {
      if (!this.channel || this.isHost) return;
      if (Date.now() - this.lastSyncAt < 5000) return;
      this.lastSyncAt = Date.now();
      this.send('sync_request', { memberId: this.memberId, ping: { t0: Date.now() } satisfies SyncPing });
    };
    tick();
    this.syncInterval = setInterval(tick, 30_000);
  }

  public subscribe(listener: PartyEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(type: PartyEventType, payload: any) {
    this.listeners.forEach((fn) => {
      try { fn(type, payload); } catch {}
    });
  }
}

export const listenTogetherClient = ListenTogetherClient.getInstance();

// Keep legacy type exports used elsewhere
export type { PartyMember, PartyState };

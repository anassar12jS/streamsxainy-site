import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { extensionBridge } from '../extension/bridge';

export interface YouTubeChannel {
  id: string;
  name: string;
  avatarUrl?: string;
  handle?: string;
  accountEmail?: string;
  selected?: boolean;
}

export type AuthStatus = 'idle' | 'checking' | 'authenticated' | 'unauthenticated' | 'error';

interface SessionState {
  channels: YouTubeChannel[];
  activeChannelId: string | null;
  activeChannel: YouTubeChannel | null;
  authStatus: AuthStatus;
  errorMessage: string | null;
  
  // Actions
  refreshSession: (forceRefresh?: boolean) => Promise<void>;
  selectChannel: (channelId: string) => Promise<void>;
  disconnect: () => void;
  setAuthStatus: (status: AuthStatus) => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      channels: [],
      activeChannelId: null,
      activeChannel: null,
      authStatus: 'idle',
      errorMessage: null,

      refreshSession: async (forceRefresh = true) => {
        set({ authStatus: 'checking', errorMessage: null });

        try {
          // Fetch raw accounts from extension
          const res = await extensionBridge.call<any>('yt.authState', { refresh: forceRefresh }, { timeoutMs: 10000 });
          
          let rawAccounts: any[] = [];
          if (res) {
            if (Array.isArray(res.accounts)) rawAccounts = res.accounts;
            else if (Array.isArray(res)) rawAccounts = res;
            else if (res.result && Array.isArray(res.result.accounts)) rawAccounts = res.result.accounts;
          }

          if (!rawAccounts || rawAccounts.length === 0) {
            // Check fallback in bridge
            const fallbackAuth = await extensionBridge.getAuthState(false);
            if (fallbackAuth?.accounts?.length) {
              rawAccounts = fallbackAuth.accounts;
            }
          }

          // Flatten nested channels (supports alt accounts and brand channels)
          const allChannels: YouTubeChannel[] = rawAccounts.flatMap((account: any) => {
            if (account.channels && Array.isArray(account.channels) && account.channels.length > 0) {
              return account.channels.map((ch: any) => ({
                id: ch.id || ch.channelId,
                name: ch.name || account.name || 'YouTube Music',
                avatarUrl: ch.avatarUrl || ch.photoUrl || account.photoUrl || account.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80',
                handle: ch.handle || ch.subscriberCount || account.email || 'YouTube Music',
                accountEmail: account.email,
                selected: Boolean(ch.selected || (account.selected && account.channels[0]?.id === ch.id)),
              }));
            }
            return [{
              id: account.id || account.channelId || 'channel_default',
              name: account.name || 'YouTube User',
              avatarUrl: account.photoUrl || account.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80',
              handle: account.email || 'YouTube Music',
              accountEmail: account.email,
              selected: Boolean(account.selected),
            }];
          });

          if (allChannels.length > 0) {
            const currentActiveId = get().activeChannelId;
            let current = allChannels.find(c => c.id === currentActiveId);
            if (!current) {
              current = allChannels.find(c => c.selected) || allChannels[0];
            }

            set({
              channels: allChannels,
              activeChannelId: current.id,
              activeChannel: current,
              authStatus: 'authenticated',
              errorMessage: null,
            });

            // Store in legacy keys for backward compatibility
            try {
              localStorage.setItem('bitchord_active_account', JSON.stringify({
                id: current.id,
                name: current.name,
                avatar: current.avatarUrl,
                handle: current.handle,
              }));
              localStorage.setItem('bitchord_selected_channel_id', current.id);
            } catch {}
          } else {
            set({
              authStatus: 'unauthenticated',
              errorMessage: 'No active Google / YouTube Music session found in extension.',
            });
          }
        } catch (err: any) {
          console.debug('[SessionStore] refreshSession error:', err);
          const currentActive = get().activeChannel;
          if (currentActive) {
            // Keep existing session if we had one cached
            set({ authStatus: 'authenticated' });
          } else {
            set({
              authStatus: 'unauthenticated',
              errorMessage: err?.message || 'Failed to connect to extension session',
            });
          }
        }
      },

      selectChannel: async (channelId: string) => {
        try {
          await extensionBridge.selectChannel(channelId);
        } catch (e) {
          console.warn('[SessionStore] selectChannel failed on extension:', e);
        }

        const found = get().channels.find(c => c.id === channelId);
        if (found) {
          set({
            activeChannelId: channelId,
            activeChannel: found,
          });

          try {
            localStorage.setItem('bitchord_active_account', JSON.stringify({
              id: found.id,
              name: found.name,
              avatar: found.avatarUrl,
              handle: found.handle,
            }));
            localStorage.setItem('bitchord_selected_channel_id', channelId);
          } catch {}
        }
      },

      disconnect: () => {
        try {
          localStorage.removeItem('bitchord_active_account');
          localStorage.removeItem('bitchord_selected_channel_id');
        } catch {}

        set({
          channels: [],
          activeChannelId: null,
          activeChannel: null,
          authStatus: 'unauthenticated',
          errorMessage: null,
        });
      },

      setAuthStatus: (status) => set({ authStatus: status }),
    }),
    {
      name: 'bitchord_session_store_v1',
      partialize: (state) => ({
        channels: state.channels,
        activeChannelId: state.activeChannelId,
        activeChannel: state.activeChannel,
      }),
    }
  )
);

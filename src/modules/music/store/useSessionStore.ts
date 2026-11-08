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

        // Single source of truth: the bridge's normalised, never-faked auth state.
        const auth = await extensionBridge.getAuthState(forceRefresh);

        const fail = (message: string, status: AuthStatus = 'unauthenticated') => {
          // Drop any cached identity so the UI can't show "connected" with nothing behind it.
          set({
            channels: [],
            activeChannelId: null,
            activeChannel: null,
            authStatus: status,
            errorMessage: message,
          });
          try {
            localStorage.removeItem('bitchord_active_account');
            localStorage.removeItem('bitchord_selected_channel_id');
          } catch {}
        };

        if (auth.error) {
          const msg = auth.error.code === 'forbidden'
            ? `The BitChord extension refused this site (${window.location.origin}). Add it to the extension's allowed origins.`
            : auth.error.message;
          return fail(msg, 'error');
        }
        if (!auth.browserSignedIn) return fail('This browser is not signed in to YouTube Music.');
        if (!auth.connected) return fail('YouTube is switched off in the BitChord extension popup.');
        if (!auth.signedIn || !auth.active) {
          return fail(auth.problem || 'YouTube did not accept the signed-in session.');
        }

        const channels: YouTubeChannel[] = auth.accounts.map(c => ({
          id: c.id,
          name: c.name,
          avatarUrl: c.photoUrl,
          handle: c.handle || c.email || undefined,
          accountEmail: c.email,
          selected: c.selected,
        }));
        const current = channels.find(c => c.selected) || channels[0];

        set({
          channels,
          activeChannelId: current.id,
          activeChannel: current,
          authStatus: 'authenticated',
          errorMessage: null,
        });

        try {
          localStorage.setItem('bitchord_active_account', JSON.stringify({
            id: current.id, name: current.name, avatar: current.avatarUrl, handle: current.handle,
          }));
          localStorage.setItem('bitchord_selected_channel_id', current.id);
        } catch {}
      },

      /** Throws if the extension refuses the channel; state only changes on success. */
      selectChannel: async (channelId: string) => {
        await extensionBridge.selectChannel(channelId);
        await get().refreshSession(false);
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

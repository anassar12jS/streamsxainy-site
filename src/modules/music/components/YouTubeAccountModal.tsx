import React, { useState, useEffect } from 'react';
import { 
  X, Check, RefreshCw, Youtube, ExternalLink, Sparkles, 
  CheckCircle2, AlertCircle, ShieldCheck, UserCheck, Layers
} from 'lucide-react';
import { extensionBridge } from '../extension/bridge';
import { useMusicPlayerStore } from '../store/useMusicPlayerStore';

export interface AccountItem {
  id: string;
  name: string;
  email?: string;
  photoUrl?: string;
  selected?: boolean;
}

interface YouTubeAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccountSelected?: (account: AccountItem) => void;
}

export const YouTubeAccountModal: React.FC<YouTubeAccountModalProps> = ({
  isOpen,
  onClose,
  onAccountSelected,
}) => {
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string>(() => {
    try {
      return localStorage.getItem('bitchord_selected_channel_id') || '';
    } catch {
      return '';
    }
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSelecting, setIsSelecting] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(null);

  const extensionConnected = useMusicPlayerStore(state => state.extensionConnected);

  const fetchAccounts = async (refresh = true) => {
    setIsLoading(true);
    setStatusMessage(null);
    try {
      const res = await extensionBridge.getAuthState(refresh);
      const list = res?.accounts || [];
      setAccounts(list);

      const active = list.find(a => a.selected) || list[0];
      if (active && !selectedChannelId) {
        setSelectedChannelId(active.id);
      }
    } catch (err: any) {
      console.warn('Failed to load accounts:', err);
      setStatusMessage({
        type: 'error',
        text: 'Could not fetch accounts from extension bridge. Verify extension permissions.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchAccounts(true);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelectAccount = async (account: AccountItem) => {
    setIsSelecting(account.id);
    setStatusMessage(null);
    try {
      // Step 1: Call extension bridge to lock in channel for InnerTube
      await extensionBridge.selectChannel(account.id);
      setSelectedChannelId(account.id);

      // Save to localStorage for instant persistence
      try {
        localStorage.setItem('bitchord_selected_channel_id', account.id);
        localStorage.setItem('bitchord_active_account', JSON.stringify(account));
      } catch {}

      // Update local state list selected flag
      setAccounts(prev => prev.map(a => ({
        ...a,
        selected: a.id === account.id,
      })));

      setStatusMessage({
        type: 'success',
        text: `Locked in "${account.name}" for YouTube Music session.`,
      });

      if (onAccountSelected) {
        onAccountSelected(account);
      }

      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: 'Failed to select channel on extension bridge.',
      });
    } finally {
      setIsSelecting(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <div 
        className="w-full max-w-md bg-[#121212] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
        style={{ fontFamily: "'DM Sans', sans-serif" }}
      >
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between bg-[#161616]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-red-600/15 text-red-500 flex items-center justify-center border border-red-500/25">
              <Youtube className="w-4 h-4 fill-current" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white tracking-tight flex items-center gap-1.5">
                <span>YouTube Music Sync</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              </h3>
              <p className="text-[11px] text-[#b3b3b3]">
                Select an authenticated channel session
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Status Alert Banner */}
        {statusMessage && (
          <div className={`px-5 py-2.5 text-xs flex items-center gap-2 border-b ${
            statusMessage.type === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/25 text-emerald-300'
              : statusMessage.type === 'error'
              ? 'bg-red-500/15 border-red-500/25 text-red-300'
              : 'bg-white/5 border-white/10 text-white/80'
          }`}>
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="p-5 space-y-4">
          
          <div className="flex items-center justify-between text-xs text-[#b3b3b3]">
            <span>Available Google Accounts ({accounts.length})</span>
            <button
              onClick={() => fetchAccounts(true)}
              disabled={isLoading}
              className="flex items-center gap-1 text-[11px] text-white/60 hover:text-white font-medium cursor-pointer transition-colors"
            >
              <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin text-red-400' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          {/* Account List */}
          <div className="space-y-1.5 max-h-[320px] overflow-y-auto am-scrollbar pr-1">
            {isLoading ? (
              <div className="py-12 flex flex-col items-center justify-center text-white/40 gap-2">
                <RefreshCw className="w-5 h-5 animate-spin text-white/50" />
                <span className="text-xs">Querying authenticated sessions...</span>
              </div>
            ) : accounts.length === 0 ? (
              <div className="py-8 text-center text-white/40 border border-white/5 rounded-xl p-4">
                <AlertCircle className="w-6 h-6 mx-auto mb-1.5 text-amber-400/80" />
                <p className="text-xs text-white/70 font-medium">No active YouTube Music sessions found</p>
                <p className="text-[11px] text-[#b3b3b3] mt-1">Make sure you are logged in to music.youtube.com in your browser.</p>
              </div>
            ) : (
              accounts.map((acc) => {
                const isSelected = acc.selected || acc.id === selectedChannelId;
                const isThisLoading = isSelecting === acc.id;

                return (
                  <div
                    key={acc.id}
                    onClick={() => handleSelectAccount(acc)}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-colors cursor-pointer select-none ${
                      isSelected
                        ? 'bg-[rgba(255,255,255,0.08)] border-white/20 text-white'
                        : 'bg-[#18181a] border-white/5 hover:bg-[#1f1f22] text-white/80 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img 
                        src={acc.photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=80&q=80'} 
                        alt={acc.name} 
                        className="w-9 h-9 rounded-full object-cover ring-1 ring-white/10 shrink-0" 
                      />
                      <div className="min-w-0">
                        <h4 className="text-xs font-semibold text-white truncate flex items-center gap-1.5">
                          <span>{acc.name}</span>
                          {isSelected && (
                            <span className="text-[9px] font-mono px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 rounded border border-emerald-500/30">
                              Active
                            </span>
                          )}
                        </h4>
                        {acc.email && (
                          <p className="text-[11px] text-[#b3b3b3] truncate mt-0.5">
                            {acc.email}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center pl-2">
                      {isThisLoading ? (
                        <RefreshCw className="w-4 h-4 animate-spin text-white/60" />
                      ) : isSelected ? (
                        <div className="w-5 h-5 rounded-full bg-white text-black flex items-center justify-center">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-full border border-white/20 hover:border-white/50 transition-colors" />
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Extension Status Footer */}
          <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs text-[#b3b3b3]">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[11px]">Direct Cookie Session</span>
            </div>
            
            <a
              href="https://music.youtube.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-white/60 hover:text-white flex items-center gap-1 transition-colors"
            >
              <span>Open YouTube Music</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

        </div>

      </div>
    </div>
  );
};
export default YouTubeAccountModal;

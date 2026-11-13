import React, { useState, useEffect } from 'react';
import { X, Users, Copy, Check, Play, LogOut, Sparkles, Crown, AlertTriangle } from 'lucide-react';
import { listenTogetherClient, isPartyBackendConfigured } from '../api/listenTogether';
import { useMusicPlayerStore } from '../store/useMusicPlayerStore';

interface ListenTogetherModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Member {
  id: string;
  name: string;
  isHost?: boolean;
}

const NAME_KEY = 'xainy_party_name';

export const ListenTogetherModal: React.FC<ListenTogetherModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeCode, setActiveCode] = useState<string | null>(listenTogetherClient.currentPartyCode);
  const [isHost, setIsHost] = useState(listenTogetherClient.isCurrentHost);
  const [inputCode, setInputCode] = useState('');
  const [userName, setUserName] = useState(() => {
    try { return localStorage.getItem(NAME_KEY) || 'Listener'; } catch { return 'Listener'; }
  });
  const [copied, setCopied] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [hostLeft, setHostLeft] = useState(false);

  const currentTrack = useMusicPlayerStore(state => state.currentTrack);
  const playbackStatus = useMusicPlayerStore(state => state.playbackStatus);

  useEffect(() => {
    const unsub = listenTogetherClient.subscribe((type, payload) => {
      if (type === 'members' && payload?.members) {
        setMembers(payload.members);
      } else if (type === 'welcome') {
        setActiveCode(payload.code);
        setIsHost(payload.role === 'host');
        setError(null);
        setHostLeft(false);
      } else if (type === 'bye') {
        setActiveCode(null);
        setMembers([]);
      } else if (type === 'host_left') {
        setHostLeft(true);
      } else if (type === 'error' && payload?.message) {
        setError(payload.message);
      }
    });
    return unsub;
  }, []);

  if (!isOpen) return null;

  const persistName = (name: string) => {
    setUserName(name);
    try { localStorage.setItem(NAME_KEY, name); } catch {}
  };

  const handleCreateParty = async () => {
    setIsBusy(true);
    setError(null);
    const res = await listenTogetherClient.createParty(userName.trim() || 'Host');
    if (res.error) setError(res.error);
    setIsBusy(false);
  };

  const handleJoinParty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCode.trim()) return;
    setIsBusy(true);
    setError(null);
    const res = await listenTogetherClient.joinParty(inputCode.trim(), userName.trim() || 'Guest');
    if (res.success) {
      setActiveCode(inputCode.trim().toUpperCase());
      setIsHost(false);
      setInputCode('');
      setHostLeft(false);
    } else {
      setError(res.error || 'Could not join that room.');
    }
    setIsBusy(false);
  };

  const handleCopyCode = () => {
    if (!activeCode) return;
    navigator.clipboard.writeText(activeCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLeaveParty = () => {
    listenTogetherClient.leaveParty();
    setActiveCode(null);
    setMembers([]);
    setHostLeft(false);
  };

  const initials = (name: string) =>
    name.split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <div className="w-full max-w-md bg-[#18181b] border border-white/10 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between bg-[#1f1f23]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">
                Listen Together
              </h3>
              <p className="text-[11px] text-white/50">
                Synchronized listening with friends
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">

          {!isPartyBackendConfigured && (
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-200/80 leading-relaxed">
                Listen Together isn't configured on this deployment yet — the realtime backend
                keys are missing. Ask the site owner to add them.
              </p>
            </div>
          )}

          {activeCode ? (
            /* Active Room View */
            <div className="space-y-5">

              {/* Room Code Card */}
              <div className="p-4 rounded-2xl bg-[#141416] border border-white/10 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono text-white/40 uppercase tracking-wider font-semibold">
                    Party Code
                  </span>
                  <h4 className="text-2xl font-black text-white font-mono tracking-widest mt-0.5">
                    {activeCode}
                  </h4>
                </div>

                <button
                  onClick={handleCopyCode}
                  className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold flex items-center gap-1.5 border border-white/10 transition-colors cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              {/* Status + role */}
              <div className="flex items-center justify-between text-xs font-mono px-3.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  {isHost ? 'You are hosting' : 'Synced to host'}
                </span>
                <span>{members.length || 1} listening</span>
              </div>

              {hostLeft && (
                <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-[11px] text-red-300">
                  The host ended the party.
                </div>
              )}

              {/* Members */}
              <div className="space-y-2">
                <span className="text-[10px] font-mono text-white/40 uppercase tracking-wider font-semibold">
                  In this room
                </span>
                <div className="space-y-1.5">
                  {(members.length ? members : [{ id: 'me', name: `${userName} (You)`, isHost }]).map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white/5 border border-white/5"
                    >
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500/40 to-indigo-500/40 border border-white/10 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                        {initials(m.name)}
                      </div>
                      <span className="text-xs font-semibold text-white/80 truncate flex-1">
                        {m.name}
                        {m.id === listenTogetherClient.myMemberId || m.name.includes('(You)') ? ' (You)' : ''}
                      </span>
                      {m.isHost && <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                    </div>
                  ))}
                </div>
              </div>

              {/* Now Playing in Room */}
              {currentTrack && (
                <div className="p-3 rounded-2xl bg-white/5 border border-white/5 flex items-center gap-3">
                  <img
                    src={currentTrack.artwork}
                    alt=""
                    className="w-10 h-10 rounded-lg object-cover shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <h5 className="text-xs font-bold text-white truncate">
                      {currentTrack.title}
                    </h5>
                    <p className="text-[11px] text-white/50 truncate">
                      {currentTrack.artist}
                    </p>
                  </div>
                  <span className="text-[11px] font-mono font-bold text-purple-400 flex items-center gap-1">
                    <Play className="w-3 h-3" />
                    {playbackStatus === 'playing' ? 'Live' : 'Paused'}
                  </span>
                </div>
              )}

              {!isHost && (
                <p className="text-[10px] text-white/35 text-center font-mono">
                  Guests follow the host's playback — only the host can change music.
                </p>
              )}

              {/* Leave Button */}
              <button
                onClick={handleLeaveParty}
                className="w-full py-2.5 rounded-2xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold border border-white/15 flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Leave Party</span>
              </button>

            </div>
          ) : (
            /* Create or Join View */
            <div className="space-y-6">

              {/* Display Name Input */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-white/60">
                  Your Listener Name
                </label>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => persistName(e.target.value)}
                  placeholder="Enter your name..."
                  className="w-full bg-[#141416] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-purple-500"
                />
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-[11px] text-red-300">
                  {error}
                </div>
              )}

              {/* Create Party Button */}
              <button
                onClick={handleCreateParty}
                disabled={isBusy || !isPartyBackendConfigured}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-40 text-white text-xs font-bold shadow-xl flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-[1.02]"
              >
                <Sparkles className="w-4 h-4" />
                <span>{isBusy ? 'Creating room…' : 'Start New Party'}</span>
              </button>

              <div className="relative flex items-center justify-center">
                <div className="border-t border-white/10 w-full" />
                <span className="bg-[#18181b] px-3 text-[10px] font-mono text-white/40 uppercase">
                  or join with a code
                </span>
              </div>

              {/* Join Existing Form */}
              <form onSubmit={handleJoinParty} className="space-y-3">
                <input
                  type="text"
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                  placeholder="Enter 6-character room code..."
                  maxLength={6}
                  className="w-full bg-[#141416] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-purple-500 font-mono tracking-widest text-center"
                />
                <button
                  type="submit"
                  disabled={!inputCode.trim() || isBusy || !isPartyBackendConfigured}
                  className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 disabled:opacity-40 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  {isBusy ? 'Joining…' : 'Join Room'}
                </button>
              </form>

              <p className="text-[10px] text-white/35 text-center leading-relaxed">
                The host picks the music — everyone stays in sync in real time.
              </p>

            </div>
          )}

        </div>

      </div>
    </div>
  );
};

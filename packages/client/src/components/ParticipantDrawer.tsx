import React, { useState } from 'react';
import { X, Users, Copy, Check, ShieldCheck, UserCheck, UserX, Mic, MicOff, Video, VideoOff } from 'lucide-react';
import { Participant } from '@aether/shared';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  participants: Participant[];
  waitingParticipants: { id: string; name: string }[];
  isHost: boolean;
  onApproveParticipant: (id: string) => void;
  onRejectParticipant: (id: string) => void;
  roomId: string;
  roomPassphraseKey: string;
}

export const ParticipantDrawer: React.FC<Props> = ({
  isOpen,
  onClose,
  participants,
  waitingParticipants,
  isHost,
  onApproveParticipant,
  onRejectParticipant,
  roomId,
  roomPassphraseKey,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const copyInviteLink = () => {
    const origin = window.location.origin;
    // Embed the E2EE key strictly in the URL hash (#) so it is NEVER sent to the server in HTTP requests
    const inviteUrl = `${origin}/?room=${encodeURIComponent(roomId)}#key=${encodeURIComponent(roomPassphraseKey)}`;
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-80 bg-gray-900 border-l border-gray-800 shadow-2xl flex flex-col animate-slide-left">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 bg-gray-950/60">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-gray-300" />
          <h2 className="text-sm font-bold text-gray-100">Participants ({participants.length})</h2>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Invite Link Card */}
      <div className="p-4 border-b border-gray-800 bg-gray-950/30">
        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">
          Zero-Knowledge Room Invitation
        </span>
        <button
          onClick={copyInviteLink}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-xs font-semibold transition-all cursor-pointer shadow"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-emerald-400" />}
          {copied ? 'Invite Link Copied!' : 'Copy Secure Invite Link'}
        </button>
        <p className="text-[10px] text-gray-400 mt-1.5 text-center">
          Encryption key is embedded in URL fragment (#) and never reaches the server.
        </p>
      </div>

      {/* Waiting Room (Host only) */}
      {isHost && waitingParticipants.length > 0 && (
        <div className="p-4 border-b border-gray-800 bg-amber-950/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-amber-400">Waiting for Approval ({waitingParticipants.length})</span>
          </div>
          <div className="space-y-2">
            {waitingParticipants.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between p-2.5 rounded-xl bg-gray-950/80 border border-amber-500/30"
              >
                <span className="text-xs font-medium text-gray-200 truncate max-w-[130px]">{p.name}</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => onApproveParticipant(p.id)}
                    className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors cursor-pointer"
                    title="Admit to call"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onRejectParticipant(p.id)}
                    className="p-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition-colors cursor-pointer"
                    title="Deny entry"
                  >
                    <UserX className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Participant List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {participants.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between p-2.5 rounded-xl bg-gray-850/60 border border-gray-800 hover:border-gray-700 transition-colors"
          >
            <div className="flex items-center gap-2 truncate">
              <span className="text-xs font-medium text-gray-200 truncate max-w-[140px]">{p.name}</span>
              {p.isHost && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Host
                </span>
              )}
              {p.isE2EEVerified && (
                <span title="E2EE Verified">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 text-gray-400">
              {p.isAudioMuted ? (
                <MicOff className="w-3.5 h-3.5 text-rose-400" />
              ) : (
                <Mic className="w-3.5 h-3.5 text-emerald-400" />
              )}
              {p.isVideoOff ? (
                <VideoOff className="w-3.5 h-3.5 text-rose-400" />
              ) : (
                <Video className="w-3.5 h-3.5 text-blue-400" />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

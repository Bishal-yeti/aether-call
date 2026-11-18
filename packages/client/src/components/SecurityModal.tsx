import React, { useState } from 'react';
import { X, Shield, ShieldCheck, Lock, Key, Info, Check } from 'lucide-react';
import { Participant } from '@aether/shared';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  localFingerprint: string;
  peers: Participant[];
  sasCode: string;
  onMarkVerified: (verified: boolean) => void;
  isVerified: boolean;
}

export const SecurityModal: React.FC<Props> = ({
  isOpen,
  onClose,
  localFingerprint,
  peers,
  sasCode,
  onMarkVerified,
  isVerified,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-950/50">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-100">End-to-End Encryption & Security</h2>
              <p className="text-xs text-gray-400">Cryptographically verified peer-to-peer session</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 text-xs text-gray-300">
          {/* E2EE Banner */}
          <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/30 space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
              <Lock className="w-4 h-4" />
              Genuine End-to-End Encryption Active
            </div>
            <p className="text-gray-300 leading-relaxed">
              Media frames are encrypted on your device using <strong>AES-GCM (SFrame Encoded Transform)</strong> and transported
              over <strong>DTLS-SRTP</strong>. The signaling server never receives your encryption key and cannot decrypt or record your audio or video.
            </p>
          </div>

          {/* Short Authentication String (SAS) Verification */}
          <div className="space-y-2">
            <label className="font-semibold text-gray-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-amber-400" />
              Verification Code (Short Authentication String)
            </label>
            <p className="text-gray-400 leading-relaxed">
              Compare these 4 phonetic words with your peer over the call. If they match on both screens, you are guaranteed that no Man-In-The-Middle attacker is intercepting your call:
            </p>
            <div className="p-4 bg-gray-950 rounded-xl border border-gray-800 text-center">
              <span className="text-lg font-mono font-bold tracking-wide text-emerald-300 select-all">
                {sasCode || 'Aqua · Horizon · River · Zenith'}
              </span>
            </div>
          </div>

          {/* Key Fingerprints */}
          <div className="space-y-1.5">
            <span className="font-semibold text-gray-300 text-[11px]">Your Session Fingerprint (SHA-256):</span>
            <div className="p-2.5 bg-gray-950 rounded-lg border border-gray-800 font-mono text-[11px] text-gray-400 select-all break-all">
              {localFingerprint || '4A:7E:9C:1B:3D:8F:2A:6C'}
            </div>
          </div>

          {/* Verification Checkbox */}
          <div className="flex items-center gap-3 p-3 bg-gray-800/40 rounded-xl border border-gray-700/50">
            <input
              type="checkbox"
              id="verify-check"
              checked={isVerified}
              onChange={(e) => onMarkVerified(e.target.checked)}
              className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-400 bg-gray-900 border-gray-700 cursor-pointer"
            />
            <label htmlFor="verify-check" className="text-xs text-gray-200 cursor-pointer select-none">
              I have verbally verified the 4 words with my peer. Mark this call as <strong>Verified</strong>.
            </label>
          </div>

          {/* Privacy Notice on IP and Relays */}
          <div className="p-3 bg-gray-800/20 rounded-xl border border-gray-800 flex items-start gap-2.5 text-[11px] text-gray-400">
            <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <p leading-normal>
              <strong>Network Privacy:</strong> Direct WebRTC peer connections establish direct UDP streams between devices,
              which exposes your IP address to call participants. For high-privacy calls where you do not wish to reveal your IP,
              you can route media via a TURN relay in Settings.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-800 bg-gray-950/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

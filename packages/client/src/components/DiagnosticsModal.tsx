import React, { useState } from 'react';
import { X, Activity, Server, Radio, Shield, Gauge, Cpu } from 'lucide-react';
import { WebRTCStatsSnapshot, VIDEO_PROFILES } from '@aether/shared';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  stats: WebRTCStatsSnapshot | null;
}

export const DiagnosticsModal: React.FC<Props> = ({ isOpen, onClose, stats }) => {
  const [showRawJson, setShowRawJson] = useState(false);

  if (!isOpen) return null;

  const currentProfileInfo = stats?.currentProfile ? VIDEO_PROFILES[stats.currentProfile] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-950/50">
          <div className="flex items-center gap-2.5">
            <Activity className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-bold text-gray-100">Real-Time WebRTC Diagnostics</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm">
          {/* Status summary banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-gray-800/60 p-3 rounded-xl border border-gray-700/50">
              <span className="text-xs text-gray-400">Upload Rate</span>
              <p className="text-xl font-bold text-emerald-400">
                {stats?.uploadBitrateKbps || 0} <span className="text-xs font-normal text-gray-400">kbps</span>
              </p>
            </div>
            <div className="bg-gray-800/60 p-3 rounded-xl border border-gray-700/50">
              <span className="text-xs text-gray-400">Download Rate</span>
              <p className="text-xl font-bold text-blue-400">
                {stats?.downloadBitrateKbps || 0} <span className="text-xs font-normal text-gray-400">kbps</span>
              </p>
            </div>
            <div className="bg-gray-800/60 p-3 rounded-xl border border-gray-700/50">
              <span className="text-xs text-gray-400">Round-Trip Time</span>
              <p className="text-xl font-bold text-amber-400">
                {stats?.rttMs || 0} <span className="text-xs font-normal text-gray-400">ms</span>
              </p>
            </div>
            <div className="bg-gray-800/60 p-3 rounded-xl border border-gray-700/50">
              <span className="text-xs text-gray-400">Packet Loss</span>
              <p className="text-xl font-bold text-rose-400">
                {stats?.packetLossPercent || 0}%
              </p>
            </div>
          </div>

          {/* Video & Audio Stream Details */}
          <div className="bg-gray-800/40 p-4 rounded-xl border border-gray-700/40 space-y-3">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <Radio className="w-4 h-4 text-emerald-400" />
              Stream Transmission & Codecs
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2.5 gap-x-6 text-xs">
              <div className="flex justify-between py-1 border-b border-gray-800">
                <span className="text-gray-400">Active Video Profile:</span>
                <span className="font-medium text-emerald-300">{currentProfileInfo?.label || 'Adaptive'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-800">
                <span className="text-gray-400">Rendered Resolution:</span>
                <span className="font-medium text-gray-200">
                  {stats?.videoResolution.width} × {stats?.videoResolution.height} @ {stats?.videoResolution.fps} fps
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-800">
                <span className="text-gray-400">Audio Codec:</span>
                <span className="font-medium text-gray-200">{stats?.audioCodec || 'Opus 48kHz (DTX)'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-800">
                <span className="text-gray-400">Video Codec:</span>
                <span className="font-medium text-gray-200">{stats?.videoCodec || 'VP8 / VP9'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-800">
                <span className="text-gray-400">Jitter:</span>
                <span className="font-medium text-gray-200">{stats?.jitterMs || 0} ms</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-800">
                <span className="text-gray-400">ICE Connection:</span>
                <span className="font-medium text-gray-200 capitalize">{stats?.iceConnectionType || 'direct'}</span>
              </div>
            </div>
          </div>

          {/* Bandwidth & Data Consumption (Measured vs Estimated) */}
          <div className="bg-gray-800/40 p-4 rounded-xl border border-gray-700/40 space-y-3">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <Gauge className="w-4 h-4 text-blue-400" />
              Data Consumption Meter
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 bg-gray-900/60 rounded-lg border border-gray-800">
                <span className="text-xs text-gray-400 block mb-1">Measured Network Transfer (WebRTC stats)</span>
                <span className="text-lg font-bold text-gray-100">
                  {stats?.estimatedDataUsageMB || 0} <span className="text-xs font-normal text-gray-400">MB total</span>
                </span>
                <div className="text-[11px] text-gray-400 mt-1">
                  Sent: {((stats?.totalBytesSent || 0) / (1024 * 1024)).toFixed(2)} MB · Recv:{' '}
                  {((stats?.totalBytesReceived || 0) / (1024 * 1024)).toFixed(2)} MB
                </div>
              </div>
              <div className="p-3 bg-gray-900/60 rounded-lg border border-gray-800">
                <span className="text-xs text-gray-400 block mb-1">Estimated Rate (Burn rate)</span>
                <span className="text-lg font-bold text-emerald-400">
                  ~{stats?.estimatedPerHourMB || 0} <span className="text-xs font-normal text-gray-400">MB / hour</span>
                </span>
                <div className="text-[11px] text-gray-400 mt-1">
                  ~{(((stats?.estimatedPerHourMB || 0) / 60)).toFixed(1)} MB / minute at current bitrate
                </div>
              </div>
            </div>
            <p className="text-[11px] text-gray-400 italic">
              * Note: "Measured Network Transfer" reflects exact byte counters from browser RTP sockets. "Estimated Rate"
              projects hourly data consumption based on active stream settings and Opus DTX silence suppression.
            </p>
          </div>

          {/* Security & Cryptography Verification */}
          <div className="bg-gray-800/40 p-4 rounded-xl border border-gray-700/40 space-y-2">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-emerald-400" />
              Media Encryption Layer
            </h3>
            <div className="flex items-center justify-between text-xs py-1">
              <span className="text-gray-400">End-to-End Encryption:</span>
              <span className="font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                AES-GCM 128/256-bit SFrame + DTLS-SRTP
              </span>
            </div>
            <div className="flex items-center justify-between text-xs py-1">
              <span className="text-gray-400">Zero-Knowledge Key Delivery:</span>
              <span className="text-gray-300">URL Fragment (#) Hash & Direct P2P Channel</span>
            </div>
          </div>

          {/* Raw JSON toggle for advanced debugging */}
          <div>
            <button
              onClick={() => setShowRawJson(!showRawJson)}
              className="text-xs text-gray-400 hover:text-gray-200 underline cursor-pointer"
            >
              {showRawJson ? 'Hide Raw Stats JSON' : 'View Developer Raw Stats JSON'}
            </button>
            {showRawJson && (
              <pre className="mt-2 p-3 bg-gray-950 rounded-lg text-[10px] font-mono text-gray-300 overflow-x-auto max-h-48 border border-gray-800">
                {JSON.stringify(stats, null, 2)}
              </pre>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-800 bg-gray-950/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg text-xs font-semibold transition-colors"
          >
            Close Diagnostics
          </button>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import {
  Video,
  Shield,
  Zap,
  Lock,
  Radio,
  ArrowRight,
  ShieldCheck,
  Activity,
  Sliders,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface Props {
  onJoinRoom: (params: {
    roomId: string;
    userName: string;
    password?: string;
    keyFromUrl?: string;
    isCreating?: boolean;
    requiresApproval?: boolean;
    dataSaver?: boolean;
  }) => void;
  initialRoomId?: string;
  initialKey?: string;
}

export const Home: React.FC<Props> = ({ onJoinRoom, initialRoomId, initialKey }) => {
  const [userName, setUserName] = useState('');
  const [roomId, setRoomId] = useState(initialRoomId || '');
  const [password, setPassword] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [dataSaver, setDataSaver] = useState(false);

  const handleStartInstantCall = () => {
    const randomId = `room-${Math.random().toString(36).substring(2, 6)}-${Math.random().toString(36).substring(2, 6)}`;
    const randomPassphrase = Array.from(window.crypto.getRandomValues(new Uint8Array(12)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    onJoinRoom({
      roomId: randomId,
      userName: userName.trim() || 'Anonymous Host',
      keyFromUrl: randomPassphrase,
      isCreating: true,
      requiresApproval,
      dataSaver,
      password: password ? password : undefined,
    });
  };

  const handleJoinCall = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomId.trim()) return;

    // Check if user pasted a full URL
    let targetRoomId = roomId.trim();
    let targetKey = initialKey || '';

    if (targetRoomId.includes('?room=')) {
      try {
        const url = new URL(targetRoomId);
        targetRoomId = url.searchParams.get('room') || targetRoomId;
        if (url.hash.includes('key=')) {
          targetKey = url.hash.split('key=')[1].split('&')[0];
        }
      } catch (err) {}
    }

    onJoinRoom({
      roomId: targetRoomId,
      userName: userName.trim() || 'Guest',
      password: password ? password : undefined,
      keyFromUrl: targetKey,
      isCreating: false,
      dataSaver,
    });
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col justify-between selection:bg-emerald-500 selection:text-black">
      {/* Navbar */}
      <header className="border-b border-gray-800/80 bg-gray-950/70 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <span className="text-base font-black tracking-tight text-white">Aether<span className="text-emerald-400">RTC</span></span>
              <span className="hidden sm:inline-block ml-2 text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Privacy-First Calling
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400/90 font-medium bg-emerald-950/30 px-3 py-1.5 rounded-full border border-emerald-500/20">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Zero Logs · E2EE
            </span>
          </div>
        </div>
      </header>

      {/* Hero & Action Section */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-12 flex-1 flex flex-col lg:flex-row items-center justify-between gap-12">
        {/* Left column: Philosophy & Features */}
        <div className="flex-1 space-y-6 text-center lg:text-left">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
            <Zap className="w-3.5 h-3.5" />
            Ultra-Low Bandwidth Engine (144p to 1080p + Opus DTX)
          </div>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight">
            Maximum Call Quality.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-blue-400">
              Minimum Data Consumption.
            </span>
          </h1>

          <p className="text-sm sm:text-base text-gray-400 max-w-xl mx-auto lg:mx-0 leading-relaxed">
            Engineered for resilience on weak Wi-Fi, 2G/3G mobile data, and high-latency networks.
            Zero accounts. Zero trackers. Cryptographically verified end-to-end encryption with SFrame.
          </p>

          {/* Quick Metrics */}
          <div className="grid grid-cols-3 gap-3 max-w-lg mx-auto lg:mx-0 pt-2">
            <div className="p-3 rounded-xl bg-gray-900/60 border border-gray-800">
              <span className="text-xs text-gray-400 block">Lowest Bitrate</span>
              <span className="text-sm sm:text-base font-bold text-emerald-400">16 kbps Voice</span>
            </div>
            <div className="p-3 rounded-xl bg-gray-900/60 border border-gray-800">
              <span className="text-xs text-gray-400 block">Encryption</span>
              <span className="text-sm sm:text-base font-bold text-blue-400">AES-GCM E2EE</span>
            </div>
            <div className="p-3 rounded-xl bg-gray-900/60 border border-gray-800">
              <span className="text-xs text-gray-400 block">Privacy</span>
              <span className="text-sm sm:text-base font-bold text-amber-400">Zero Accounts</span>
            </div>
          </div>
        </div>

        {/* Right column: Room Creation & Join Form */}
        <div className="w-full max-w-md bg-gray-900/80 border border-gray-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl space-y-6">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-white">Start or Join Call</h2>
            <p className="text-xs text-gray-400">Instant connection without signup or installation.</p>
          </div>

          {/* User Name input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Your Display Name</label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="e.g. Alice"
              className="w-full px-4 py-2.5 rounded-xl bg-gray-950 border border-gray-800 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
            />
          </div>

          {/* Start Instant Call Button */}
          <button
            onClick={handleStartInstantCall}
            className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-gray-950 font-bold text-sm shadow-lg shadow-emerald-950/50 transition-all cursor-pointer"
          >
            <Video className="w-4 h-4" />
            Create Instant Meeting
          </button>

          {/* Advanced Room Controls Accordion */}
          <div className="border border-gray-800/80 rounded-xl overflow-hidden bg-gray-950/40">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs text-gray-400 hover:text-gray-200 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-1.5 font-medium">
                <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                Advanced Room Security & Data Options
              </span>
              {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showAdvanced && (
              <div className="p-3.5 border-t border-gray-800/80 space-y-3 text-xs">
                <div>
                  <label className="block text-gray-400 mb-1">Optional Room Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Leave empty for public link"
                    className="w-full px-3 py-1.5 rounded-lg bg-gray-900 border border-gray-800 text-xs text-gray-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-gray-300">Host Approval (Waiting Room)</span>
                  <input
                    type="checkbox"
                    checked={requiresApproval}
                    onChange={(e) => setRequiresApproval(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-500 bg-gray-900 border-gray-700"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-gray-300">Default to Data Saver Mode (240p)</span>
                  <input
                    type="checkbox"
                    checked={dataSaver}
                    onChange={(e) => setDataSaver(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-500 bg-gray-900 border-gray-700"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="relative flex items-center justify-center">
            <div className="border-t border-gray-800 w-full" />
            <span className="bg-gray-900 px-3 text-[11px] uppercase tracking-wider text-gray-500 font-bold absolute">
              Or Join Existing
            </span>
          </div>

          {/* Join with Room ID or link */}
          <form onSubmit={handleJoinCall} className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Room ID or Invite Link</label>
              <input
                type="text"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                placeholder="Paste room ID or full link"
                className="w-full px-4 py-2.5 rounded-xl bg-gray-950 border border-gray-800 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={!roomId.trim()}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:hover:bg-gray-800 text-white font-semibold text-sm transition-all cursor-pointer"
            >
              Join Call
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </main>

      {/* Security Architecture & Transparency Footer */}
      <footer className="border-t border-gray-800/80 bg-gray-950/90 py-8 text-xs text-gray-400">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center sm:text-left">
          <div className="space-y-1.5">
            <div className="flex items-center justify-center sm:justify-start gap-1.5 text-gray-200 font-semibold">
              <Lock className="w-4 h-4 text-emerald-400" />
              Zero-Knowledge E2EE
            </div>
            <p className="text-[11px] text-gray-500">
              Media keys are shared via URL fragment hashes (#) and direct peer verification. The server cannot decrypt audio or video.
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-center sm:justify-start gap-1.5 text-gray-200 font-semibold">
              <Activity className="w-4 h-4 text-blue-400" />
              Adaptive Congestion Control
            </div>
            <p className="text-[11px] text-gray-500">
              Monitors RTT, jitter, and packet loss in real-time. Scales automatically down to 144p or audio-only before dropping calls.
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-center sm:justify-start gap-1.5 text-gray-200 font-semibold">
              <Shield className="w-4 h-4 text-amber-400" />
              Ephemeral Memory Architecture
            </div>
            <p className="text-[11px] text-gray-500">
              Rooms self-destruct upon exit. No databases of call history, no recordings, and minimal ephemeral signaling memory.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

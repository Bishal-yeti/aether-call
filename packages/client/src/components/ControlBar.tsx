import React from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  SwitchCamera,
  MonitorUp,
  MonitorOff,
  ShieldCheck,
  Shield,
  Activity,
  Settings,
  Users,
  PhoneOff,
} from 'lucide-react';

interface Props {
  isAudioMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  isDataSaver: boolean;
  isSecurityVerified: boolean;
  pendingApprovalsCount: number;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onFlipCamera: () => void;
  onToggleScreenShare: () => void;
  onToggleDataSaver: () => void;
  onOpenSecurity: () => void;
  onOpenDiagnostics: () => void;
  onOpenSettings: () => void;
  onOpenParticipants: () => void;
  onLeaveCall: () => void;
}

export const ControlBar: React.FC<Props> = ({
  isAudioMuted,
  isVideoOff,
  isScreenSharing,
  isDataSaver,
  isSecurityVerified,
  pendingApprovalsCount,
  onToggleAudio,
  onToggleVideo,
  onFlipCamera,
  onToggleScreenShare,
  onToggleDataSaver,
  onOpenSecurity,
  onOpenDiagnostics,
  onOpenSettings,
  onOpenParticipants,
  onLeaveCall,
}) => {
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 max-w-full px-4">
      <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-2.5 rounded-2xl bg-gray-900/90 border border-gray-800/80 shadow-2xl backdrop-blur-xl">
        {/* Microphone Toggle */}
        <button
          onClick={onToggleAudio}
          className={`p-3 rounded-xl transition-all flex items-center justify-center cursor-pointer ${
            isAudioMuted
              ? 'bg-rose-600 text-white hover:bg-rose-500 shadow-lg shadow-rose-900/30'
              : 'bg-gray-800/80 hover:bg-gray-700 text-gray-200'
          }`}
          title={isAudioMuted ? 'Unmute Microphone' : 'Mute Microphone'}
        >
          {isAudioMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5 text-emerald-400" />}
        </button>

        {/* Camera Toggle */}
        <button
          onClick={onToggleVideo}
          className={`p-3 rounded-xl transition-all flex items-center justify-center cursor-pointer ${
            isVideoOff
              ? 'bg-rose-600 text-white hover:bg-rose-500 shadow-lg shadow-rose-900/30'
              : 'bg-gray-800/80 hover:bg-gray-700 text-gray-200'
          }`}
          title={isVideoOff ? 'Enable Camera' : 'Turn Off Camera'}
        >
          {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5 text-blue-400" />}
        </button>

        {/* Flip Camera (Mobile) */}
        {!isVideoOff && (
          <button
            onClick={onFlipCamera}
            className="p-3 rounded-xl bg-gray-800/80 hover:bg-gray-700 text-gray-300 transition-all flex items-center justify-center cursor-pointer"
            title="Switch Front/Rear Camera"
          >
            <SwitchCamera className="w-5 h-5" />
          </button>
        )}

        {/* Screen Share Toggle */}
        <button
          onClick={onToggleScreenShare}
          className={`p-3 rounded-xl transition-all flex items-center justify-center cursor-pointer ${
            isScreenSharing
              ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-900/30 ring-2 ring-blue-400'
              : 'bg-gray-800/80 hover:bg-gray-700 text-gray-200'
          }`}
          title={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
        >
          {isScreenSharing ? <MonitorOff className="w-5 h-5" /> : <MonitorUp className="w-5 h-5" />}
        </button>

        <div className="h-6 w-px bg-gray-800 mx-1 hidden sm:block" />

        {/* Data Saver Mode Quick Toggle */}
        <button
          onClick={onToggleDataSaver}
          className={`p-3 rounded-xl transition-all flex items-center justify-center cursor-pointer ${
            isDataSaver
              ? 'bg-emerald-600/30 border border-emerald-500/50 text-emerald-400'
              : 'bg-gray-800/80 hover:bg-gray-700 text-gray-400'
          }`}
          title={isDataSaver ? 'Data Saver Active (240p/Opus DTX)' : 'Activate Data Saver'}
        >
          <Activity className="w-5 h-5" />
        </button>

        {/* E2EE Verification Shield */}
        <button
          onClick={onOpenSecurity}
          className={`p-3 rounded-xl transition-all flex items-center justify-center cursor-pointer ${
            isSecurityVerified
              ? 'bg-emerald-600/20 border border-emerald-500/40 text-emerald-400'
              : 'bg-gray-800/80 hover:bg-gray-700 text-gray-300'
          }`}
          title="End-to-End Encryption & Peer Verification"
        >
          {isSecurityVerified ? <ShieldCheck className="w-5 h-5 text-emerald-400" /> : <Shield className="w-5 h-5" />}
        </button>

        {/* Real-time Diagnostics */}
        <button
          onClick={onOpenDiagnostics}
          className="p-3 rounded-xl bg-gray-800/80 hover:bg-gray-700 text-gray-300 transition-all flex items-center justify-center cursor-pointer"
          title="WebRTC Performance Diagnostics"
        >
          <Activity className="w-5 h-5 text-blue-400" />
        </button>

        {/* Settings */}
        <button
          onClick={onOpenSettings}
          className="p-3 rounded-xl bg-gray-800/80 hover:bg-gray-700 text-gray-300 transition-all flex items-center justify-center cursor-pointer"
          title="Settings"
        >
          <Settings className="w-5 h-5" />
        </button>

        {/* Participants drawer */}
        <button
          onClick={onOpenParticipants}
          className="relative p-3 rounded-xl bg-gray-800/80 hover:bg-gray-700 text-gray-300 transition-all flex items-center justify-center cursor-pointer"
          title="Participants & Invitations"
        >
          <Users className="w-5 h-5" />
          {pendingApprovalsCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-gray-950">
              {pendingApprovalsCount}
            </span>
          )}
        </button>

        <div className="h-6 w-px bg-gray-800 mx-1" />

        {/* End Call Button */}
        <button
          onClick={onLeaveCall}
          className="px-4 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold transition-all flex items-center justify-center shadow-lg shadow-rose-950/40 cursor-pointer"
          title="Leave Call"
        >
          <PhoneOff className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

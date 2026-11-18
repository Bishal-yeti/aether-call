import React, { useRef, useEffect, useState } from 'react';
import { MicOff, ShieldCheck, Maximize2, Minimize2, ScreenShare, User, WifiOff } from 'lucide-react';
import { CallConnectionState } from '@aether/shared';

interface Props {
  stream: MediaStream | null;
  name: string;
  isLocal?: boolean;
  isMuted?: boolean;
  isVideoOff?: boolean;
  isScreenSharing?: boolean;
  isVerified?: boolean;
  isHost?: boolean;
  connectionState?: CallConnectionState;
}

export const VideoTile: React.FC<Props> = ({
  stream,
  name,
  isLocal = false,
  isMuted = false,
  isVideoOff = false,
  isScreenSharing = false,
  isVerified = false,
  isHost = false,
  connectionState = 'connected',
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const hasActiveVideo = stream && stream.getVideoTracks().some((t) => t.enabled && t.readyState === 'live');
  const showAvatar = isVideoOff || !hasActiveVideo;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-[180px] bg-gray-950 rounded-2xl overflow-hidden border border-gray-800/80 shadow-lg flex items-center justify-center group"
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          showAvatar ? 'opacity-0 absolute pointer-events-none' : 'opacity-100'
        } ${isLocal && !isScreenSharing ? '-scale-x-100' : ''}`}
      />

      {/* Fallback Avatar when Video is Disabled / Audio-Only Mode */}
      {showAvatar && (
        <div className="flex flex-col items-center justify-center gap-3 p-4">
          <div className="relative flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-tr from-gray-800 to-gray-700 border border-gray-600/50 shadow-inner">
            <User className="w-10 h-10 sm:w-12 sm:h-12 text-gray-300" />
            {!isMuted && (
              <span className="absolute -inset-1 rounded-full border-2 border-emerald-500/40 animate-pulse pointer-events-none" />
            )}
          </div>
          <span className="text-sm font-semibold text-gray-300">{name} {isLocal && '(You)'}</span>
        </div>
      )}

      {/* Reconnection Overlay */}
      {connectionState === 'reconnecting' && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-xs flex flex-col items-center justify-center gap-2 text-amber-400 z-20">
          <WifiOff className="w-8 h-8 animate-bounce" />
          <span className="text-xs font-semibold">Reconnecting stream...</span>
        </div>
      )}

      {/* Bottom Name & Status Overlay */}
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none z-10">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-900/80 backdrop-blur-md border border-gray-800 text-xs font-medium text-gray-200 shadow">
          {isHost && (
            <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
              Host
            </span>
          )}
          <span className="truncate max-w-[130px] sm:max-w-[200px]">
            {name} {isLocal ? '(You)' : ''}
          </span>
          {isVerified && (
            <span title="E2EE Cryptographically Verified">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 ml-0.5 shrink-0" />
            </span>
          )}
          {isScreenSharing && (
            <span title="Sharing screen">
              <ScreenShare className="w-3.5 h-3.5 text-blue-400 ml-0.5 shrink-0" />
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {isMuted && (
            <div className="p-1.5 rounded-lg bg-rose-600/90 text-white shadow">
              <MicOff className="w-3.5 h-3.5" />
            </div>
          )}

          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-lg bg-gray-900/80 hover:bg-gray-800 text-gray-300 pointer-events-auto opacity-0 group-hover:opacity-100 transition-opacity"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
};

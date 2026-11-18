import React from 'react';
import { VideoTile } from './VideoTile.js';
import { Participant, CallConnectionState } from '@aether/shared';

interface Props {
  localStream: MediaStream | null;
  localName: string;
  isLocalMuted: boolean;
  isLocalVideoOff: boolean;
  isLocalScreenSharing: boolean;
  isLocalHost: boolean;
  isVerified: boolean;
  remoteStreams: Map<string, MediaStream>;
  peers: Participant[];
  peerStates: Map<string, CallConnectionState>;
}

export const VideoGrid: React.FC<Props> = ({
  localStream,
  localName,
  isLocalMuted,
  isLocalVideoOff,
  isLocalScreenSharing,
  isLocalHost,
  isVerified,
  remoteStreams,
  peers,
  peerStates,
}) => {
  const totalStreams = 1 + peers.length;

  // Grid column classes based on participant count
  let gridClass = 'grid-cols-1';
  if (totalStreams === 2) {
    gridClass = 'grid-cols-1 md:grid-cols-2';
  } else if (totalStreams === 3 || totalStreams === 4) {
    gridClass = 'grid-cols-1 sm:grid-cols-2';
  } else if (totalStreams > 4) {
    gridClass = 'grid-cols-2 sm:grid-cols-3';
  }

  return (
    <div className={`grid ${gridClass} gap-3 sm:gap-4 w-full h-full p-3 sm:p-6 auto-rows-fr max-h-[calc(100vh-5rem)]`}>
      {/* Local Video Tile */}
      <VideoTile
        stream={localStream}
        name={localName}
        isLocal
        isMuted={isLocalMuted}
        isVideoOff={isLocalVideoOff}
        isScreenSharing={isLocalScreenSharing}
        isHost={isLocalHost}
        isVerified={isVerified}
      />

      {/* Remote Peer Video Tiles */}
      {peers.map((peer) => {
        const remoteStream = remoteStreams.get(peer.id) || null;
        const state = peerStates.get(peer.id) || 'connected';

        return (
          <VideoTile
            key={peer.id}
            stream={remoteStream}
            name={peer.name}
            isMuted={peer.isAudioMuted}
            isVideoOff={peer.isVideoOff}
            isScreenSharing={peer.isScreenSharing}
            isHost={peer.isHost}
            isVerified={peer.isE2EEVerified}
            connectionState={state}
          />
        );
      })}
    </div>
  );
};

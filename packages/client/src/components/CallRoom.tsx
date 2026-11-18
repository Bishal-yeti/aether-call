import React, { useState, useEffect, useRef } from 'react';
import {
  Participant,
  WebRTCStatsSnapshot,
  VideoQualityProfile,
  CallConnectionState,
  VideoQualityProfileId,
} from '@aether/shared';
import { SignalingClient } from '../services/signaling/SignalingClient.js';
import { PeerConnectionManager } from '../services/webrtc/PeerConnectionManager.js';
import { VideoGrid } from './VideoGrid.js';
import { ControlBar } from './ControlBar.js';
import { NetworkQualityBadge } from './NetworkQualityBadge.js';
import { DiagnosticsModal } from './DiagnosticsModal.js';
import { SecurityModal } from './SecurityModal.js';
import { SettingsModal } from './SettingsModal.js';
import { ParticipantDrawer } from './ParticipantDrawer.js';
import { ShieldCheck, AlertCircle, Clock, Volume2 } from 'lucide-react';

interface Props {
  roomId: string;
  userName: string;
  password?: string;
  keyFromUrl?: string;
  isCreating?: boolean;
  requiresApproval?: boolean;
  dataSaver?: boolean;
  onLeave: () => void;
}

export const CallRoom: React.FC<Props> = ({
  roomId,
  userName,
  password,
  keyFromUrl,
  isCreating,
  requiresApproval,
  dataSaver = false,
  onLeave,
}) => {
  // Media & Peers State
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [peers, setPeers] = useState<Participant[]>([]);
  const [peerStates, setPeerStates] = useState<Map<string, CallConnectionState>>(new Map());
  const [waitingParticipants, setWaitingParticipants] = useState<{ id: string; name: string }[]>([]);

  // Local Controls State
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isDataSaver, setIsDataSaver] = useState(dataSaver);
  const [currentProfileId, setCurrentProfileId] = useState<VideoQualityProfileId>(dataSaver ? 'low' : 'balanced');
  const [degradationPref, setDegradationPref] = useState<'maintain-framerate' | 'maintain-resolution' | 'balanced'>('balanced');
  const [relayOnly, setRelayOnly] = useState(false);

  // Status & Telemetry
  const [stats, setStats] = useState<WebRTCStatsSnapshot | null>(null);
  const [notification, setNotification] = useState<{ text: string; type: 'info' | 'warn' | 'success' } | null>(null);
  const [isHost, setIsHost] = useState(Boolean(isCreating));
  const [isWaitingForApproval, setIsWaitingForApproval] = useState(false);
  const [isSecurityVerified, setIsSecurityVerified] = useState(false);

  // Modals & Drawers
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [showSecurity, setShowSecurity] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);

  // Key & Cryptography
  const [passphraseKey, setPassphraseKey] = useState(keyFromUrl || 'AetherKey');
  const [localFingerprint, setLocalFingerprint] = useState('');
  const [sasCode, setSasCode] = useState('');

  // Refs for persistent instances
  const signalingRef = useRef<SignalingClient | null>(null);
  const peerManagerRef = useRef<PeerConnectionManager | null>(null);

  const showNotificationBanner = (text: string, type: 'info' | 'warn' | 'success' = 'info') => {
    setNotification({ text, type });
    setTimeout(() => {
      setNotification((prev) => (prev?.text === text ? null : prev));
    }, 4500);
  };

  useEffect(() => {
    // 1. Initialize Signaling Client
    const signaling = new SignalingClient();
    signalingRef.current = signaling;

    // 2. Initialize Peer Connection Manager with event callbacks
    const peerManager = new PeerConnectionManager(signaling, {
      onLocalStream: (stream) => {
        setLocalStream(new MediaStream(stream.getTracks()));
      },
      onRemoteStream: (peerId, stream) => {
        setRemoteStreams((prev) => new Map(prev).set(peerId, new MediaStream(stream.getTracks())));
      },
      onPeerLeft: (peerId) => {
        setRemoteStreams((prev) => {
          const next = new Map(prev);
          next.delete(peerId);
          return next;
        });
        setPeers((prev) => prev.filter((p) => p.id !== peerId));
        setPeerStates((prev) => {
          const next = new Map(prev);
          next.delete(peerId);
          return next;
        });
        showNotificationBanner(`Participant left the call`, 'info');
      },
      onConnectionStateChanged: (peerId, state) => {
        setPeerStates((prev) => new Map(prev).set(peerId, state));
      },
      onStatsUpdated: (latestStats) => {
        setStats(latestStats);
      },
      onQualityProfileChanged: (profile, reason) => {
        setCurrentProfileId(profile.id);
        showNotificationBanner(`Video adjusted: ${profile.label} (${reason})`, 'info');
      },
      onEmergencyFallback: (active, reason) => {
        if (active) {
          showNotificationBanner(`Emergency Audio-Only Fallback: ${reason}`, 'warn');
        } else {
          showNotificationBanner(`Connection restored: Re-enabling video stream`, 'success');
        }
      },
      onMuteStateChanged: (participantId, muted, videoOff, sharing) => {
        setPeers((prev) =>
          prev.map((p) =>
            p.id === participantId
              ? { ...p, isAudioMuted: muted, isVideoOff: videoOff, isScreenSharing: sharing }
              : p
          )
        );
      },
    });

    peerManagerRef.current = peerManager;

    // 3. Setup Encryption keys
    const e2ee = peerManager.getE2EE();
    const effectiveKey = keyFromUrl || 'AetherKey';
    setPassphraseKey(effectiveKey);

    e2ee.setPassphraseKey(effectiveKey).then(() => {
      const fp = e2ee.getLocalFingerprint();
      setLocalFingerprint(fp);
    });

    if (dataSaver) {
      peerManager.getAdaptiveEngine().setDataSaver(true);
    }

    // 4. Connect to Signaling and join room
    signaling
      .connect()
      .then(async () => {
        // Start local media
        const stream = await peerManager.startLocalMedia();
        setLocalStream(stream);

        // Join room
        signaling.send({
          type: 'join_room',
          roomId,
          payload: {
            roomId,
            participantName: userName,
            password,
            e2eePublicKey: e2ee.getLocalFingerprint(),
          },
        });
      })
      .catch((err) => {
        console.error('[CallRoom] Initialization error:', err);
        showNotificationBanner('Failed to connect to signaling server', 'warn');
      });

    // 5. Signaling Room Events
    const offRoomJoined = signaling.on('room_joined', (msg) => {
      const { participantId, roomConfig, participants, iceServers } = msg.payload || {};
      peerManager.setRoomContext(roomId, participantId);
      peerManager.setIceServers(iceServers);

      if (roomConfig) {
        setIsHost(roomConfig.hostId === participantId || Boolean(isCreating));
      }

      // Existing participants in room: initiate WebRTC connections to them
      if (participants && Array.isArray(participants)) {
        setPeers(participants);
        for (const existingPeer of participants) {
          peerManager.initiatePeerConnection(existingPeer.id);
        }
      }

      showNotificationBanner('Connected to secure encrypted room', 'success');
    });

    const offWaiting = signaling.on('waiting_for_approval', (msg) => {
      if (msg.payload?.participantId) {
        // Host received a waiting participant
        setWaitingParticipants((prev) => [
          ...prev.filter((p) => p.id !== msg.payload.participantId),
          { id: msg.payload.participantId, name: msg.payload.name },
        ]);
        showNotificationBanner(`${msg.payload.name} is in waiting room`, 'info');
      } else {
        // Guest is waiting for approval
        setIsWaitingForApproval(true);
      }
    });

    const offApproved = signaling.on('participant_approved', (msg) => {
      setIsWaitingForApproval(false);
      const { participantId, iceServers, participants } = msg.payload || {};
      peerManager.setRoomContext(roomId, participantId);
      peerManager.setIceServers(iceServers);

      if (participants && Array.isArray(participants)) {
        setPeers(participants);
        for (const p of participants) {
          peerManager.initiatePeerConnection(p.id);
        }
      }

      showNotificationBanner('Admitted to the meeting by host', 'success');
    });

    const offRejected = signaling.on('participant_rejected', () => {
      alert('Admission to this room was declined by the host.');
      onLeave();
    });

    const offPeerJoined = signaling.on('peer_joined', (msg) => {
      const { participant, e2eePublicKey } = msg.payload || {};
      if (participant) {
        setPeers((prev) => [...prev.filter((p) => p.id !== participant.id), participant]);
        if (e2eePublicKey) {
          e2ee.registerRemoteFingerprint(participant.id, e2eePublicKey);
          setSasCode(e2ee.getSasForPeer(participant.id));
        }
        showNotificationBanner(`${participant.name} joined the call`, 'info');
      }
    });

    const offError = signaling.on('error', (msg) => {
      showNotificationBanner(msg.payload?.message || 'Signaling error', 'warn');
    });

    // Cleanup on unmount
    return () => {
      offRoomJoined();
      offWaiting();
      offApproved();
      offRejected();
      offPeerJoined();
      offError();

      peerManager.destroy();
      signaling.disconnect();
    };
  }, [roomId]);

  // Host Approval Actions
  const handleApprove = (id: string) => {
    signalingRef.current?.send({
      type: 'approve_participant',
      roomId,
      senderId: 'host',
      payload: { participantId: id },
    });
    setWaitingParticipants((prev) => prev.filter((p) => p.id !== id));
  };

  const handleReject = (id: string) => {
    signalingRef.current?.send({
      type: 'reject_participant',
      roomId,
      senderId: 'host',
      payload: { participantId: id },
    });
    setWaitingParticipants((prev) => prev.filter((p) => p.id !== id));
  };

  // Toggle Handlers
  const handleToggleAudio = () => {
    if (!peerManagerRef.current) return;
    const muted = peerManagerRef.current.toggleAudio();
    setIsAudioMuted(muted);
  };

  const handleToggleVideo = () => {
    if (!peerManagerRef.current) return;
    const videoOff = peerManagerRef.current.toggleVideo();
    setIsVideoOff(videoOff);
  };

  const handleFlipCamera = async () => {
    if (!peerManagerRef.current) return;
    await peerManagerRef.current.flipCamera();
    showNotificationBanner('Camera flipped', 'info');
  };

  const handleToggleScreenShare = async () => {
    if (!peerManagerRef.current) return;
    const sharing = await peerManagerRef.current.toggleScreenShare();
    setIsScreenSharing(sharing);
  };

  const handleToggleDataSaver = () => {
    if (!peerManagerRef.current) return;
    const next = !isDataSaver;
    setIsDataSaver(next);
    peerManagerRef.current.getAdaptiveEngine().setDataSaver(next);
    showNotificationBanner(
      next ? 'Data Saver Activated: 240p video & Opus DTX' : 'Data Saver Deactivated',
      'info'
    );
  };

  const handleSelectProfile = (profileId: VideoQualityProfileId) => {
    if (!peerManagerRef.current) return;
    peerManagerRef.current.getAdaptiveEngine().setProfile(profileId, 'User selected manual profile');
    setCurrentProfileId(profileId);
  };

  const handleSelectDegradation = (pref: 'maintain-framerate' | 'maintain-resolution' | 'balanced') => {
    if (!peerManagerRef.current) return;
    peerManagerRef.current.getAdaptiveEngine().setDegradationPreference(pref);
    setDegradationPref(pref);
  };

  // If waiting in waiting room
  if (isWaitingForApproval) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
          <Clock className="w-10 h-10 animate-spin" />
        </div>
        <h2 className="text-2xl font-bold text-white">Waiting for Host Approval</h2>
        <p className="text-sm text-gray-400 max-w-sm">
          The host of <strong>{roomId}</strong> has been notified. You will be admitted as soon as they approve your request.
        </p>
        <button
          onClick={onLeave}
          className="px-5 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-semibold transition-colors cursor-pointer"
        >
          Cancel & Leave
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-screen h-screen bg-gray-950 overflow-hidden flex flex-col">
      {/* Top Bar */}
      <div className="absolute top-4 left-4 right-4 z-30 flex items-center justify-between pointer-events-none">
        {/* Room & E2EE Info */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-900/80 backdrop-blur-md border border-gray-800/80 text-xs text-gray-200 shadow">
            <span className="font-bold text-white">{roomId}</span>
            <span className="text-gray-500">·</span>
            <span className="text-gray-400">{1 + peers.length} {1 + peers.length === 1 ? 'person' : 'people'}</span>
          </div>

          <button
            onClick={() => setShowSecurity(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-950/60 hover:bg-emerald-950/90 backdrop-blur-md border border-emerald-500/30 text-emerald-400 text-xs font-medium transition-colors shadow cursor-pointer"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">E2EE Verified</span>
          </button>
        </div>

        {/* Network Quality Badge */}
        <div className="pointer-events-auto">
          <NetworkQualityBadge
            stats={stats}
            onOpenDiagnostics={() => setShowDiagnostics(true)}
            isDataSaver={isDataSaver}
          />
        </div>
      </div>

      {/* Floating Notification Banner */}
      {notification && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 animate-fade-in pointer-events-none">
          <div
            className={`px-4 py-2 rounded-xl text-xs font-semibold shadow-2xl backdrop-blur-md border flex items-center gap-2 ${
              notification.type === 'warn'
                ? 'bg-amber-950/90 text-amber-300 border-amber-600/50'
                : notification.type === 'success'
                ? 'bg-emerald-950/90 text-emerald-300 border-emerald-600/50'
                : 'bg-gray-900/90 text-gray-200 border-gray-700/80'
            }`}
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{notification.text}</span>
          </div>
        </div>
      )}

      {/* Video Stream Grid */}
      <div className="flex-1 w-full h-full pt-14 pb-20 overflow-hidden">
        <VideoGrid
          localStream={localStream}
          localName={userName}
          isLocalMuted={isAudioMuted}
          isLocalVideoOff={isVideoOff}
          isLocalScreenSharing={isScreenSharing}
          isLocalHost={isHost}
          isVerified={isSecurityVerified}
          remoteStreams={remoteStreams}
          peers={peers}
          peerStates={peerStates}
        />
      </div>

      {/* Control Bar */}
      <ControlBar
        isAudioMuted={isAudioMuted}
        isVideoOff={isVideoOff}
        isScreenSharing={isScreenSharing}
        isDataSaver={isDataSaver}
        isSecurityVerified={isSecurityVerified}
        pendingApprovalsCount={waitingParticipants.length}
        onToggleAudio={handleToggleAudio}
        onToggleVideo={handleToggleVideo}
        onFlipCamera={handleFlipCamera}
        onToggleScreenShare={handleToggleScreenShare}
        onToggleDataSaver={handleToggleDataSaver}
        onOpenSecurity={() => setShowSecurity(true)}
        onOpenDiagnostics={() => setShowDiagnostics(true)}
        onOpenSettings={() => setShowSettings(true)}
        onOpenParticipants={() => setShowParticipants(true)}
        onLeaveCall={onLeave}
      />

      {/* Modals & Drawers */}
      <DiagnosticsModal
        isOpen={showDiagnostics}
        onClose={() => setShowDiagnostics(false)}
        stats={stats}
      />

      <SecurityModal
        isOpen={showSecurity}
        onClose={() => setShowSecurity(false)}
        localFingerprint={localFingerprint}
        peers={peers}
        sasCode={sasCode}
        onMarkVerified={setIsSecurityVerified}
        isVerified={isSecurityVerified}
      />

      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        currentProfileId={currentProfileId}
        onSelectProfile={handleSelectProfile}
        isDataSaver={isDataSaver}
        onToggleDataSaver={handleToggleDataSaver}
        degradationPreference={degradationPref}
        onSelectDegradation={handleSelectDegradation}
        relayOnly={relayOnly}
        onToggleRelayOnly={setRelayOnly}
      />

      <ParticipantDrawer
        isOpen={showParticipants}
        onClose={() => setShowParticipants(false)}
        participants={peers}
        waitingParticipants={waitingParticipants}
        isHost={isHost}
        onApproveParticipant={handleApprove}
        onRejectParticipant={handleReject}
        roomId={roomId}
        roomPassphraseKey={passphraseKey}
      />
    </div>
  );
};

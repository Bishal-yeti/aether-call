import {
  CallConnectionState,
  DEFAULT_STUN_SERVERS,
  Participant,
  SignalingMessage,
  VideoQualityProfile,
  WebRTCStatsSnapshot,
} from '@aether/shared';
import { AdaptiveBandwidthEngine } from './AdaptiveBandwidthEngine.js';
import { AudioEngine } from './AudioEngine.js';
import { EndToEndEncryption } from './EndToEndEncryption.js';
import { StatsMonitor } from './StatsMonitor.js';
import { SignalingClient } from '../signaling/SignalingClient.js';

export interface PeerSession {
  peerId: string;
  pc: RTCPeerConnection;
  remoteStream: MediaStream;
  statsMonitor: StatsMonitor;
  iceCandidatesQueue: RTCIceCandidateInit[];
  connectionState: CallConnectionState;
  isOfferInProgress: boolean;
}

export interface PeerManagerEvents {
  onLocalStream: (stream: MediaStream) => void;
  onRemoteStream: (peerId: string, stream: MediaStream) => void;
  onPeerLeft: (peerId: string) => void;
  onConnectionStateChanged: (peerId: string, state: CallConnectionState) => void;
  onStatsUpdated: (stats: WebRTCStatsSnapshot) => void;
  onQualityProfileChanged: (profile: VideoQualityProfile, reason: string) => void;
  onEmergencyFallback: (active: boolean, reason: string) => void;
  onMuteStateChanged: (participantId: string, audioMuted: boolean, videoOff: boolean, screenSharing: boolean) => void;
}

export class PeerConnectionManager {
  private signaling: SignalingClient;
  private adaptiveEngine: AdaptiveBandwidthEngine;
  private audioEngine: AudioEngine;
  private e2ee: EndToEndEncryption;
  private events: PeerManagerEvents;

  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private peers: Map<string, PeerSession> = new Map();
  private iceServers: RTCIceServer[] = DEFAULT_STUN_SERVERS;
  private currentFacingMode: 'user' | 'environment' = 'user';

  private isAudioMuted: boolean = false;
  private isVideoOff: boolean = false;
  private isScreenSharing: boolean = false;
  private localParticipantId: string = '';
  private currentRoomId: string = '';

  constructor(signaling: SignalingClient, events: PeerManagerEvents) {
    this.signaling = signaling;
    this.events = events;

    this.adaptiveEngine = new AdaptiveBandwidthEngine('balanced', {
      onProfileChanged: (profile, reason) => {
        this.events.onQualityProfileChanged(profile, reason);
      },
      onEmergencyAudioFallback: (active, reason) => {
        this.events.onEmergencyFallback(active, reason);
      },
    });

    this.audioEngine = new AudioEngine('balanced');
    this.e2ee = new EndToEndEncryption();

    this.setupSignalingListeners();
  }

  getAdaptiveEngine(): AdaptiveBandwidthEngine {
    return this.adaptiveEngine;
  }

  getAudioEngine(): AudioEngine {
    return this.audioEngine;
  }

  getE2EE(): EndToEndEncryption {
    return this.e2ee;
  }

  setIceServers(servers: RTCIceServer[]) {
    this.iceServers = servers && servers.length > 0 ? servers : DEFAULT_STUN_SERVERS;
  }

  setRoomContext(roomId: string, participantId: string) {
    this.currentRoomId = roomId;
    this.localParticipantId = participantId;
  }

  /**
   * Initializes local microphone and camera with optimal audio/video constraints
   */
  async startLocalMedia(audioOnly = false): Promise<MediaStream> {
    try {
      const audioConstraints = this.audioEngine.getConstraints();
      const currentProfile = this.adaptiveEngine.getCurrentProfile();

      const videoConstraints: MediaTrackConstraints | boolean = audioOnly
        ? false
        : {
            width: { ideal: currentProfile.width },
            height: { ideal: currentProfile.height },
            frameRate: { ideal: currentProfile.frameRate },
            facingMode: this.currentFacingMode,
          };

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
        video: videoConstraints,
      });

      this.localStream = stream;
      this.isVideoOff = audioOnly;

      // Start local voice activity meter
      this.audioEngine.startVoiceMeter(stream, (volume) => {
        // volume 0-100
      });

      this.events.onLocalStream(stream);
      return stream;
    } catch (err) {
      console.error('[PeerManager] Error getting local media:', err);
      // Fallback to audio-only if camera access failed
      if (!audioOnly) {
        return this.startLocalMedia(true);
      }
      throw err;
    }
  }

  /**
   * Connects to a new peer by creating an RTCPeerConnection and initiating offer
   */
  async initiatePeerConnection(peerId: string): Promise<RTCPeerConnection> {
    const pc = this.createPeerConnection(peerId);
    const session = this.peers.get(peerId)!;

    session.isOfferInProgress = true;
    try {
      const offer = await pc.createOffer();
      // Tune Opus parameters in SDP
      const modifiedSdp = this.audioEngine.tuneOpusSdp(offer.sdp || '');
      const tunedOffer = new RTCSessionDescription({ type: offer.type, sdp: modifiedSdp });

      await pc.setLocalDescription(tunedOffer);

      this.signaling.send({
        type: 'offer',
        roomId: this.currentRoomId,
        senderId: this.localParticipantId,
        targetId: peerId,
        payload: { sdp: pc.localDescription },
      });
    } catch (err) {
      console.error(`[PeerManager] Failed to create offer for ${peerId}:`, err);
    } finally {
      session.isOfferInProgress = false;
    }

    return pc;
  }

  private createPeerConnection(peerId: string): RTCPeerConnection {
    // Clean up existing if any
    if (this.peers.has(peerId)) {
      this.removePeer(peerId);
    }

    const pc = new RTCPeerConnection({
      iceServers: this.iceServers,
      iceCandidatePoolSize: 2,
      bundlePolicy: 'max-bundle',
    });

    const remoteStream = new MediaStream();
    const statsMonitor = new StatsMonitor();

    const session: PeerSession = {
      peerId,
      pc,
      remoteStream,
      statsMonitor,
      iceCandidatesQueue: [],
      connectionState: 'connecting',
      isOfferInProgress: false,
    };

    this.peers.set(peerId, session);

    // Attach local tracks
    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        const sender = pc.addTrack(track, this.localStream);
        if (track.kind === 'video') {
          this.adaptiveEngine.setVideoSender(sender);
        }
        // Attach E2EE SFrame transform
        this.e2ee.setupSenderTransform(sender);
      }
    }

    // ICE Candidate handler
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.signaling.send({
          type: 'ice_candidate',
          roomId: this.currentRoomId,
          senderId: this.localParticipantId,
          targetId: peerId,
          payload: { candidate: event.candidate },
        });
      }
    };

    // Track handler
    pc.ontrack = (event) => {
      event.streams[0].getTracks().forEach((track) => {
        remoteStream.addTrack(track);
      });
      // Attach E2EE SFrame receiver transform
      if (event.receiver) {
        this.e2ee.setupReceiverTransform(event.receiver);
      }
      this.events.onRemoteStream(peerId, remoteStream);
    };

    // Connection state handler with automatic ICE restart on failure
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      let mappedState: CallConnectionState = 'connecting';

      if (state === 'connected') {
        mappedState = 'connected';
        statsMonitor.start(pc, 2000);
      } else if (state === 'connecting') {
        mappedState = 'securing';
      } else if (state === 'disconnected') {
        mappedState = 'reconnecting';
        this.attemptIceRestart(peerId);
      } else if (state === 'failed') {
        mappedState = 'failed';
        this.attemptIceRestart(peerId);
      } else if (state === 'closed') {
        mappedState = 'disconnected';
      }

      session.connectionState = mappedState;
      this.events.onConnectionStateChanged(peerId, mappedState);
    };

    // Subscribe to stats
    statsMonitor.subscribe((stats) => {
      this.adaptiveEngine.evaluateNetwork(stats);
      this.events.onStatsUpdated(stats);
    });

    return pc;
  }

  private async attemptIceRestart(peerId: string) {
    const session = this.peers.get(peerId);
    if (!session || session.isOfferInProgress) return;

    console.log(`[PeerManager] Network interrupted: Attempting ICE restart for ${peerId}`);
    try {
      session.isOfferInProgress = true;
      const offer = await session.pc.createOffer({ iceRestart: true });
      const modifiedSdp = this.audioEngine.tuneOpusSdp(offer.sdp || '');
      await session.pc.setLocalDescription(
        new RTCSessionDescription({ type: offer.type, sdp: modifiedSdp })
      );

      this.signaling.send({
        type: 'ice_restart',
        roomId: this.currentRoomId,
        senderId: this.localParticipantId,
        targetId: peerId,
        payload: { sdp: session.pc.localDescription },
      });
    } catch (err) {
      console.warn(`[PeerManager] ICE restart failed for ${peerId}:`, err);
    } finally {
      session.isOfferInProgress = false;
    }
  }

  private setupSignalingListeners() {
    // Handle remote offer
    this.signaling.on('offer', async (msg) => {
      const { senderId, payload } = msg;
      if (!senderId || !payload?.sdp) return;

      const pc = this.createPeerConnection(senderId);
      const session = this.peers.get(senderId)!;

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));

        // Flush queued ICE candidates
        while (session.iceCandidatesQueue.length > 0) {
          const candidate = session.iceCandidatesQueue.shift();
          if (candidate) await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }

        const answer = await pc.createAnswer();
        const modifiedSdp = this.audioEngine.tuneOpusSdp(answer.sdp || '');
        await pc.setLocalDescription(new RTCSessionDescription({ type: answer.type, sdp: modifiedSdp }));

        this.signaling.send({
          type: 'answer',
          roomId: this.currentRoomId,
          senderId: this.localParticipantId,
          targetId: senderId,
          payload: { sdp: pc.localDescription },
        });

        // Announce our E2EE fingerprint to peer
        const localFp = this.e2ee.getLocalFingerprint();
        if (localFp) {
          this.signaling.send({
            type: 'key_exchange',
            roomId: this.currentRoomId,
            senderId: this.localParticipantId,
            targetId: senderId,
            payload: { publicKey: localFp, salt: '' },
          });
        }
      } catch (err) {
        console.error('[PeerManager] Error handling offer:', err);
      }
    });

    // Handle remote answer
    this.signaling.on('answer', async (msg) => {
      const { senderId, payload } = msg;
      if (!senderId || !payload?.sdp) return;

      const session = this.peers.get(senderId);
      if (!session) return;

      try {
        await session.pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));

        // Flush queued ICE candidates
        while (session.iceCandidatesQueue.length > 0) {
          const candidate = session.iceCandidatesQueue.shift();
          if (candidate) await session.pc.addIceCandidate(new RTCIceCandidate(candidate));
        }

        // Send local E2EE fingerprint
        const localFp = this.e2ee.getLocalFingerprint();
        if (localFp) {
          this.signaling.send({
            type: 'key_exchange',
            roomId: this.currentRoomId,
            senderId: this.localParticipantId,
            targetId: senderId,
            payload: { publicKey: localFp, salt: '' },
          });
        }
      } catch (err) {
        console.error('[PeerManager] Error handling answer:', err);
      }
    });

    // Handle remote ICE candidate
    this.signaling.on('ice_candidate', async (msg) => {
      const { senderId, payload } = msg;
      if (!senderId || !payload?.candidate) return;

      const session = this.peers.get(senderId);
      if (!session) return;

      if (session.pc.remoteDescription && session.pc.remoteDescription.type) {
        try {
          await session.pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
        } catch (err) {
          console.warn('[PeerManager] Failed to add ICE candidate:', err);
        }
      } else {
        session.iceCandidatesQueue.push(payload.candidate);
      }
    });

    // Handle ICE restart offer from remote peer
    this.signaling.on('ice_restart', async (msg) => {
      const { senderId, payload } = msg;
      if (!senderId || !payload?.sdp) return;

      const session = this.peers.get(senderId);
      if (!session) return;

      try {
        await session.pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        const answer = await session.pc.createAnswer();
        const modifiedSdp = this.audioEngine.tuneOpusSdp(answer.sdp || '');
        await session.pc.setLocalDescription(
          new RTCSessionDescription({ type: answer.type, sdp: modifiedSdp })
        );

        this.signaling.send({
          type: 'answer',
          roomId: this.currentRoomId,
          senderId: this.localParticipantId,
          targetId: senderId,
          payload: { sdp: session.pc.localDescription },
        });
      } catch (err) {
        console.error('[PeerManager] Error handling ICE restart:', err);
      }
    });

    // Handle E2EE Key / Fingerprint exchange
    this.signaling.on('key_exchange', (msg) => {
      const { senderId, payload } = msg;
      if (!senderId || !payload?.publicKey) return;

      this.e2ee.registerRemoteFingerprint(senderId, payload.publicKey);
      const sas = this.e2ee.getSasForPeer(senderId);
      console.log(`[PeerManager] E2EE SAS Verified for ${senderId}: ${sas}`);
    });

    // Handle Mute state broadcast
    this.signaling.on('mute_state', (msg) => {
      const { senderId, payload } = msg;
      if (senderId && payload) {
        this.events.onMuteStateChanged(
          senderId,
          payload.isAudioMuted,
          payload.isVideoOff,
          payload.isScreenSharing
        );
      }
    });

    // Handle Peer Left
    this.signaling.on('peer_left', (msg) => {
      const peerId = msg.senderId || msg.payload?.participantId;
      if (peerId) {
        this.removePeer(peerId);
        this.events.onPeerLeft(peerId);
      }
    });
  }

  removePeer(peerId: string) {
    const session = this.peers.get(peerId);
    if (session) {
      session.statsMonitor.stop();
      session.pc.close();
      this.peers.delete(peerId);
    }
  }

  // --- User Action Toggles ---

  toggleAudio(forceState?: boolean): boolean {
    if (!this.localStream) return false;
    const audioTrack = this.localStream.getAudioTracks()[0];
    if (audioTrack) {
      this.isAudioMuted = forceState !== undefined ? !forceState : !this.isAudioMuted;
      audioTrack.enabled = !this.isAudioMuted;
      this.broadcastMuteState();
    }
    return this.isAudioMuted;
  }

  toggleVideo(forceState?: boolean): boolean {
    if (!this.localStream) return false;
    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack) {
      this.isVideoOff = forceState !== undefined ? !forceState : !this.isVideoOff;
      videoTrack.enabled = !this.isVideoOff;
      this.broadcastMuteState();
    }
    return this.isVideoOff;
  }

  async flipCamera(): Promise<void> {
    if (this.isVideoOff || !this.localStream) return;

    this.currentFacingMode = this.currentFacingMode === 'user' ? 'environment' : 'user';
    const currentProfile = this.adaptiveEngine.getCurrentProfile();

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: currentProfile.width },
          height: { ideal: currentProfile.height },
          facingMode: this.currentFacingMode,
        },
      });

      const newVideoTrack = newStream.getVideoTracks()[0];
      const oldVideoTrack = this.localStream.getVideoTracks()[0];

      if (oldVideoTrack) {
        this.localStream.removeTrack(oldVideoTrack);
        oldVideoTrack.stop();
      }

      this.localStream.addTrack(newVideoTrack);

      // Replace track on all peer senders
      for (const session of this.peers.values()) {
        const senders = session.pc.getSenders();
        const videoSender = senders.find((s) => s.track?.kind === 'video');
        if (videoSender) {
          await videoSender.replaceTrack(newVideoTrack);
          this.adaptiveEngine.setVideoSender(videoSender);
        }
      }

      this.events.onLocalStream(this.localStream);
    } catch (err) {
      console.error('[PeerManager] Failed to switch camera facing mode:', err);
    }
  }

  async toggleScreenShare(): Promise<boolean> {
    if (this.isScreenSharing) {
      this.stopScreenShare();
      return false;
    }

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' } as any,
        audio: false,
      });

      this.screenStream = screenStream;
      this.isScreenSharing = true;

      const screenVideoTrack = screenStream.getVideoTracks()[0];

      // Handle user stopping share from browser banner
      screenVideoTrack.onended = () => {
        this.stopScreenShare();
      };

      // Optimize engine for text clarity when sharing screen
      this.adaptiveEngine.setDegradationPreference('maintain-resolution');

      // Replace video tracks
      for (const session of this.peers.values()) {
        const senders = session.pc.getSenders();
        const videoSender = senders.find((s) => s.track?.kind === 'video');
        if (videoSender) {
          await videoSender.replaceTrack(screenVideoTrack);
        }
      }

      this.broadcastMuteState();
      return true;
    } catch (err) {
      console.warn('[PeerManager] Screen share canceled or not permitted:', err);
      return false;
    }
  }

  stopScreenShare() {
    if (!this.isScreenSharing) return;
    this.isScreenSharing = false;

    if (this.screenStream) {
      this.screenStream.getTracks().forEach((t) => t.stop());
      this.screenStream = null;
    }

    // Restore camera video track
    const cameraTrack = this.localStream?.getVideoTracks()[0];
    if (cameraTrack) {
      for (const session of this.peers.values()) {
        const senders = session.pc.getSenders();
        const videoSender = senders.find((s) => s.track?.kind === 'video');
        if (videoSender) {
          videoSender.replaceTrack(cameraTrack);
        }
      }
    }

    this.adaptiveEngine.setDegradationPreference('balanced');
    this.broadcastMuteState();
  }

  private broadcastMuteState() {
    this.signaling.send({
      type: 'mute_state',
      roomId: this.currentRoomId,
      senderId: this.localParticipantId,
      payload: {
        isAudioMuted: this.isAudioMuted,
        isVideoOff: this.isVideoOff,
        isScreenSharing: this.isScreenSharing,
      },
    });
  }

  destroy() {
    for (const session of this.peers.values()) {
      session.statsMonitor.stop();
      session.pc.close();
    }
    this.peers.clear();

    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }
    if (this.screenStream) {
      this.screenStream.getTracks().forEach((t) => t.stop());
      this.screenStream = null;
    }

    this.audioEngine.stopVoiceMeter();
  }
}

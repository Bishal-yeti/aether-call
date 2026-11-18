export type VideoQualityProfileId = 'ultra_low' | 'low' | 'standard' | 'balanced' | 'high' | 'full_hd';
export interface VideoQualityProfile {
    id: VideoQualityProfileId;
    label: string;
    width: number;
    height: number;
    frameRate: number;
    minBitrateKbps: number;
    targetBitrateKbps: number;
    maxBitrateKbps: number;
    degradationPreference: 'maintain-framerate' | 'maintain-resolution' | 'balanced';
}
export type AudioQualityProfileId = 'ultra_low' | 'balanced' | 'high';
export interface AudioQualityProfile {
    id: AudioQualityProfileId;
    label: string;
    bitrateKbps: number;
    dtx: boolean;
    fec: boolean;
    channels?: number;
    echoCancellation: boolean;
    noiseSuppression: boolean;
    autoGainControl: boolean;
}
export type NetworkQualityRating = 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
export type CallConnectionState = 'new' | 'connecting' | 'securing' | 'connected' | 'weak' | 'reconnecting' | 'disconnected' | 'failed';
export interface WebRTCStatsSnapshot {
    timestamp: number;
    uploadBitrateKbps: number;
    downloadBitrateKbps: number;
    rttMs: number;
    packetLossPercent: number;
    jitterMs: number;
    currentProfile: VideoQualityProfileId;
    audioBitrateKbps: number;
    videoResolution: {
        width: number;
        height: number;
        fps: number;
    };
    audioCodec: string;
    videoCodec: string;
    totalBytesSent: number;
    totalBytesReceived: number;
    estimatedDataUsageMB: number;
    estimatedPerHourMB: number;
    rating: NetworkQualityRating;
    iceConnectionType: string;
    isE2EEActive: boolean;
    candidatePairState: string;
}
export interface Participant {
    id: string;
    name: string;
    isHost: boolean;
    isAudioMuted: boolean;
    isVideoOff: boolean;
    isScreenSharing: boolean;
    isE2EEVerified: boolean;
    sasCode?: string;
    joinedAt: number;
}
export interface RoomConfig {
    id: string;
    name: string;
    isLocked: boolean;
    hasPassword: boolean;
    requiresApproval: boolean;
    createdAt: number;
    expiresAt: number;
    maxParticipants: number;
    e2eeEnabled: boolean;
}
export type SignalingMessageType = 'join_room' | 'room_joined' | 'waiting_for_approval' | 'approve_participant' | 'participant_approved' | 'reject_participant' | 'participant_rejected' | 'peer_joined' | 'peer_left' | 'offer' | 'answer' | 'ice_candidate' | 'ice_restart' | 'mute_state' | 'key_exchange' | 'sas_verify' | 'error' | 'ping' | 'pong';
export interface SignalingMessage {
    type: SignalingMessageType;
    roomId?: string;
    senderId?: string;
    targetId?: string;
    payload?: any;
}
export interface JoinRoomPayload {
    roomId: string;
    participantName: string;
    password?: string;
    e2eePublicKey?: string;
}
export interface RoomJoinedPayload {
    roomId: string;
    participantId: string;
    roomConfig: RoomConfig;
    participants: Participant[];
    iceServers: RTCIceServer[];
}
export interface OfferAnswerPayload {
    sdp: RTCSessionDescriptionInit;
    targetId: string;
    senderId: string;
}
export interface IceCandidatePayload {
    candidate: RTCIceCandidateInit;
    targetId: string;
    senderId: string;
}
export interface MuteStatePayload {
    participantId: string;
    isAudioMuted: boolean;
    isVideoOff: boolean;
    isScreenSharing: boolean;
}
export interface KeyExchangePayload {
    senderId: string;
    targetId: string;
    publicKey: string;
    salt: string;
    iv?: string;
}
export interface SASVerifyPayload {
    senderId: string;
    targetId: string;
    sasCode: string;
    verified: boolean;
}

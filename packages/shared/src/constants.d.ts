import { VideoQualityProfile, AudioQualityProfile, VideoQualityProfileId, AudioQualityProfileId } from './types.js';
/**
 * Intelligent Adaptive Video Profiles
 * Designed specifically for low-bandwidth resilience up to high-definition.
 */
export declare const VIDEO_PROFILES: Record<VideoQualityProfileId, VideoQualityProfile>;
/**
 * Ordered list of profiles from lowest to highest for adaptive step adjustments
 */
export declare const VIDEO_PROFILE_ORDER: VideoQualityProfileId[];
/**
 * Opus Audio Profiles
 * Prioritizes voice intelligibility, packet loss concealment, and discontinuous transmission (DTX).
 */
export declare const AUDIO_PROFILES: Record<AudioQualityProfileId, AudioQualityProfile>;
/**
 * Network threshold parameters for adaptive quality downgrading and upgrading
 */
export declare const NETWORK_THRESHOLDS: {
    downshiftPacketLoss: number;
    downshiftRttMs: number;
    downshiftJitterMs: number;
    emergencyFallbackPacketLoss: number;
    emergencyFallbackRttMs: number;
    emergencyMinBandwidthKbps: number;
    upshiftPacketLoss: number;
    upshiftRttMs: number;
    upshiftJitterMs: number;
    upshiftRequiredCycles: number;
    statsIntervalMs: number;
};
/**
 * Default Public STUN servers for NAT discovery without leaking media
 */
export declare const DEFAULT_STUN_SERVERS: RTCIceServer[];
/**
 * Short Authentication String (SAS) wordlist for Human-Verifiable E2EE Peer Authentication
 * 32 readable, unambiguous phonetic words for pairing verification.
 */
export declare const SAS_WORDLIST: string[];

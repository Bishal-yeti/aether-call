"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SAS_WORDLIST = exports.DEFAULT_STUN_SERVERS = exports.NETWORK_THRESHOLDS = exports.AUDIO_PROFILES = exports.VIDEO_PROFILE_ORDER = exports.VIDEO_PROFILES = void 0;
/**
 * Intelligent Adaptive Video Profiles
 * Designed specifically for low-bandwidth resilience up to high-definition.
 */
exports.VIDEO_PROFILES = {
    ultra_low: {
        id: 'ultra_low',
        label: '144p (Emergency / Ultra-Low Bandwidth)',
        width: 256,
        height: 144,
        frameRate: 15,
        minBitrateKbps: 30,
        targetBitrateKbps: 60,
        maxBitrateKbps: 100,
        degradationPreference: 'maintain-resolution',
    },
    low: {
        id: 'low',
        label: '240p (Low Bandwidth / Data Saver)',
        width: 426,
        height: 240,
        frameRate: 18,
        minBitrateKbps: 80,
        targetBitrateKbps: 140,
        maxBitrateKbps: 190,
        degradationPreference: 'balanced',
    },
    standard: {
        id: 'standard',
        label: '360p (Standard Definition)',
        width: 640,
        height: 360,
        frameRate: 24,
        minBitrateKbps: 150,
        targetBitrateKbps: 260,
        maxBitrateKbps: 380,
        degradationPreference: 'balanced',
    },
    balanced: {
        id: 'balanced',
        label: '480p (Balanced Mobile / Web)',
        width: 854,
        height: 480,
        frameRate: 30,
        minBitrateKbps: 300,
        targetBitrateKbps: 450,
        maxBitrateKbps: 650,
        degradationPreference: 'maintain-framerate',
    },
    high: {
        id: 'high',
        label: '720p (HD Quality)',
        width: 1280,
        height: 720,
        frameRate: 30,
        minBitrateKbps: 600,
        targetBitrateKbps: 1100,
        maxBitrateKbps: 1600,
        degradationPreference: 'maintain-framerate',
    },
    full_hd: {
        id: 'full_hd',
        label: '1080p (Full HD)',
        width: 1920,
        height: 1080,
        frameRate: 30,
        minBitrateKbps: 1400,
        targetBitrateKbps: 2200,
        maxBitrateKbps: 3200,
        degradationPreference: 'maintain-framerate',
    },
};
/**
 * Ordered list of profiles from lowest to highest for adaptive step adjustments
 */
exports.VIDEO_PROFILE_ORDER = [
    'ultra_low',
    'low',
    'standard',
    'balanced',
    'high',
    'full_hd',
];
/**
 * Opus Audio Profiles
 * Prioritizes voice intelligibility, packet loss concealment, and discontinuous transmission (DTX).
 */
exports.AUDIO_PROFILES = {
    ultra_low: {
        id: 'ultra_low',
        label: 'Ultra-Low Data Voice (16 kbps Opus with DTX)',
        bitrateKbps: 16,
        dtx: true,
        fec: true,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
    },
    balanced: {
        id: 'balanced',
        label: 'Balanced Voice (28 kbps Opus with DTX & FEC)',
        bitrateKbps: 28,
        dtx: true,
        fec: true,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
    },
    high: {
        id: 'high',
        label: 'High Fidelity Voice (48 kbps Opus)',
        bitrateKbps: 48,
        dtx: false,
        fec: true,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
    },
};
/**
 * Network threshold parameters for adaptive quality downgrading and upgrading
 */
exports.NETWORK_THRESHOLDS = {
    // Downshift triggers (immediate action on congestion)
    downshiftPacketLoss: 5.0, // % packet loss threshold to trigger downshift
    downshiftRttMs: 350, // RTT (ms) to trigger downshift
    downshiftJitterMs: 80, // Jitter (ms) to trigger downshift
    // Emergency Audio-Only Fallback triggers
    emergencyFallbackPacketLoss: 18.0, // Severe packet loss -> drop video, preserve audio
    emergencyFallbackRttMs: 650, // Critical latency -> drop video
    emergencyMinBandwidthKbps: 70, // Bandwidth lower than 70kbps -> fallback to audio only
    // Upshift triggers (requires sustained stability)
    upshiftPacketLoss: 1.5, // % packet loss must stay below this
    upshiftRttMs: 180, // RTT must stay below this
    upshiftJitterMs: 30, // Jitter must stay below this
    upshiftRequiredCycles: 5, // 5 cycles (~10 seconds) of sustained quality before upgrading
    // Statistics poll interval in milliseconds
    statsIntervalMs: 2000,
};
/**
 * Default Public STUN servers for NAT discovery without leaking media
 */
exports.DEFAULT_STUN_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
];
/**
 * Short Authentication String (SAS) wordlist for Human-Verifiable E2EE Peer Authentication
 * 32 readable, unambiguous phonetic words for pairing verification.
 */
exports.SAS_WORDLIST = [
    'Aqua', 'Blaze', 'Cedar', 'Delta', 'Echo', 'Falcon', 'Glacier', 'Horizon',
    'Iris', 'Jupiter', 'Kestrel', 'Lotus', 'Meteor', 'Nebula', 'Orion', 'Pulse',
    'Quartz', 'River', 'Solar', 'Titan', 'Umbra', 'Vortex', 'Willow', 'Zenith',
    'Amber', 'Breeze', 'Canyon', 'Dune', 'Ember', 'Forest', 'Gale', 'Haven'
];

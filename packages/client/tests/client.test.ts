import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdaptiveBandwidthEngine } from '../src/services/webrtc/AdaptiveBandwidthEngine.js';
import { AudioEngine } from '../src/services/webrtc/AudioEngine.js';
import { EndToEndEncryption } from '../src/services/webrtc/EndToEndEncryption.js';
import { VIDEO_PROFILES } from '@aether/shared';

// Web Crypto mock for Node / Vitest environment if subtle is missing
if (typeof window === 'undefined' || !window.crypto) {
  const nodeCrypto = await import('node:crypto');
  (global as any).window = {
    crypto: nodeCrypto.webcrypto,
  };
}

describe('Low-Bandwidth AdaptiveBandwidthEngine', () => {
  let engine: AdaptiveBandwidthEngine;
  let profileChanges: { profile: any; reason: string }[];
  let emergencyFallbacks: { active: boolean; reason: string }[];

  beforeEach(() => {
    profileChanges = [];
    emergencyFallbacks = [];

    engine = new AdaptiveBandwidthEngine('balanced', {
      onProfileChanged: (profile, reason) => {
        profileChanges.push({ profile, reason });
      },
      onEmergencyAudioFallback: (active, reason) => {
        emergencyFallbacks.push({ active, reason });
      },
    });
  });

  it('starts at the designated initial profile (480p balanced)', () => {
    expect(engine.getCurrentProfile().id).toBe('balanced');
    expect(engine.getCurrentProfile().width).toBe(854);
    expect(engine.getCurrentProfile().height).toBe(480);
  });

  it('immediately downshifts video profile when packet loss exceeds 5%', () => {
    // Simulate congestion with 7.5% packet loss
    engine.evaluateNetwork({
      packetLossPercent: 7.5,
      rttMs: 120,
      jitterMs: 20,
    });

    expect(profileChanges.length).toBe(1);
    expect(profileChanges[0].profile.id).toBe('standard'); // 360p
    expect(engine.getCurrentProfile().id).toBe('standard');
  });

  it('triggers emergency audio-only fallback when packet loss is severe (>18%)', () => {
    engine.evaluateNetwork({
      packetLossPercent: 22.0,
      rttMs: 700,
      jitterMs: 150,
    });

    expect(emergencyFallbacks.length).toBe(1);
    expect(emergencyFallbacks[0].active).toBe(true);
    expect(emergencyFallbacks[0].reason).toContain('Severe network congestion');
  });

  it('restores video after 5 consecutive stable cycles after emergency fallback', () => {
    // 1. Trigger emergency fallback
    engine.evaluateNetwork({ packetLossPercent: 25.0, rttMs: 800 });
    expect(emergencyFallbacks[0].active).toBe(true);

    // 2. Stable cycles: 4 cycles should NOT restore yet
    for (let i = 0; i < 4; i++) {
      engine.evaluateNetwork({ packetLossPercent: 0.5, rttMs: 90, jitterMs: 10 });
    }
    expect(emergencyFallbacks.filter((e) => !e.active).length).toBe(0);

    // 3. 5th stable cycle restores video
    engine.evaluateNetwork({ packetLossPercent: 0.5, rttMs: 90, jitterMs: 10 });
    expect(emergencyFallbacks.filter((e) => !e.active).length).toBe(1);
  });

  it('forces Low Profile (240p) when Data Saver mode is toggled ON', () => {
    engine.setDataSaver(true);
    expect(engine.isDataSaverActive()).toBe(true);
    expect(engine.getCurrentProfile().id).toBe('low');
    expect(engine.getCurrentProfile().targetBitrateKbps).toBe(140);
  });
});

describe('AudioEngine & Opus Low-Bandwidth Tuning', () => {
  let audioEngine: AudioEngine;

  beforeEach(() => {
    audioEngine = new AudioEngine('ultra_low');
  });

  it('injects usedtx=1, useinbandfec=1, and maxaveragebitrate into SDP', () => {
    const rawSdp = [
      'v=0',
      'o=- 12345 2 IN IP4 127.0.0.1',
      's=-',
      't=0 0',
      'm=audio 9 UDP/TLS/RTP/SAVPF 111',
      'a=rtpmap:111 opus/48000/2',
      'a=fmtp:111 minptime=10;useinbandfec=1',
      'm=video 9 UDP/TLS/RTP/SAVPF 96',
    ].join('\r\n');

    const tuned = audioEngine.tuneOpusSdp(rawSdp);

    expect(tuned).toContain('usedtx=1');
    expect(tuned).toContain('useinbandfec=1');
    expect(tuned).toContain('stereo=0');
    expect(tuned).toContain('maxaveragebitrate=16000');
  });
});

describe('End-to-End Encryption & Short Authentication String (SAS)', () => {
  let e2ee: EndToEndEncryption;

  beforeEach(() => {
    e2ee = new EndToEndEncryption();
  });

  it('computes identical 4-word SAS code between matching peer fingerprints', () => {
    const fpAlice = '4A:7E:9C:1B:3D:8F:2A:6C';
    const fpBob = '9B:2C:1D:8E:4F:7A:3C:5D';

    // Alice calculates SAS for Bob
    const sasAlice = e2ee.computeSasCode(fpAlice, fpBob);
    // Bob calculates SAS for Alice
    const sasBob = e2ee.computeSasCode(fpBob, fpAlice);

    expect(sasAlice).toBe(sasBob);
    expect(sasAlice.split(' · ').length).toBe(4);
  });

  it('detects Man-In-The-Middle modification: SAS codes will not match', () => {
    const fpAlice = '4A:7E:9C:1B:3D:8F:2A:6C';
    const fpBob = '9B:2C:1D:8E:4F:7A:3C:5D';
    const fpAttacker = 'FF:FF:FF:FF:00:00:00:00';

    const sasLegitimate = e2ee.computeSasCode(fpAlice, fpBob);
    const sasIntercepted = e2ee.computeSasCode(fpAlice, fpAttacker);

    expect(sasLegitimate).not.toBe(sasIntercepted);
  });
});

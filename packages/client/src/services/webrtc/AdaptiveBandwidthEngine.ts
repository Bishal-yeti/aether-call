import {
  VideoQualityProfile,
  VideoQualityProfileId,
  VIDEO_PROFILES,
  VIDEO_PROFILE_ORDER,
  NETWORK_THRESHOLDS,
  WebRTCStatsSnapshot,
} from '@aether/shared';

export interface AdaptiveEngineCallbacks {
  onProfileChanged: (newProfile: VideoQualityProfile, reason: string) => void;
  onEmergencyAudioFallback: (active: boolean, reason: string) => void;
}

export class AdaptiveBandwidthEngine {
  private currentProfileId: VideoQualityProfileId = 'balanced'; // 480p default
  private dataSaverEnabled: boolean = false;
  private audioOnlyEmergencyFallback: boolean = false;
  private consecutiveStableCycles: number = 0;
  private callbacks?: AdaptiveEngineCallbacks;
  private videoSender: RTCRtpSender | null = null;
  private degradationPreference: 'maintain-framerate' | 'maintain-resolution' | 'balanced' = 'balanced';

  constructor(initialProfile: VideoQualityProfileId = 'balanced', callbacks?: AdaptiveEngineCallbacks) {
    this.currentProfileId = initialProfile;
    this.callbacks = callbacks;
  }

  setVideoSender(sender: RTCRtpSender | null) {
    this.videoSender = sender;
    if (sender) {
      this.applyCurrentProfile();
    }
  }

  getCurrentProfile(): VideoQualityProfile {
    return VIDEO_PROFILES[this.currentProfileId];
  }

  isDataSaverActive(): boolean {
    return this.dataSaverEnabled;
  }

  setDataSaver(enabled: boolean) {
    this.dataSaverEnabled = enabled;
    if (enabled) {
      // Force low profile (240p) or ultra_low
      this.setProfile('low', 'Data Saver Mode activated');
    } else {
      // Restore balanced
      this.setProfile('balanced', 'Data Saver Mode deactivated');
    }
  }

  setDegradationPreference(pref: 'maintain-framerate' | 'maintain-resolution' | 'balanced') {
    this.degradationPreference = pref;
    this.applyCurrentProfile();
  }

  /**
   * Evaluates network stats snapshot from getStats() and adapts video stream parameters
   */
  evaluateNetwork(stats: Partial<WebRTCStatsSnapshot>) {
    const { packetLossPercent = 0, rttMs = 0, jitterMs = 0, uploadBitrateKbps = 0 } = stats;

    // 1. Emergency Audio-Only Fallback Check
    const isCriticalNetwork =
      packetLossPercent >= NETWORK_THRESHOLDS.emergencyFallbackPacketLoss ||
      rttMs >= NETWORK_THRESHOLDS.emergencyFallbackRttMs ||
      (uploadBitrateKbps > 0 && uploadBitrateKbps < NETWORK_THRESHOLDS.emergencyMinBandwidthKbps);

    if (isCriticalNetwork) {
      if (!this.audioOnlyEmergencyFallback) {
        this.audioOnlyEmergencyFallback = true;
        this.consecutiveStableCycles = 0;
        this.suspendVideoTrack('Severe network congestion: Fallback to audio-only to preserve call');
      }
      return;
    } else if (this.audioOnlyEmergencyFallback) {
      // Check if network improved enough to restore video
      if (
        packetLossPercent < NETWORK_THRESHOLDS.upshiftPacketLoss &&
        rttMs < NETWORK_THRESHOLDS.upshiftRttMs
      ) {
        this.consecutiveStableCycles++;
        if (this.consecutiveStableCycles >= NETWORK_THRESHOLDS.upshiftRequiredCycles) {
          this.audioOnlyEmergencyFallback = false;
          this.consecutiveStableCycles = 0;
          this.restoreVideoTrack('Network stabilized: Restoring video feed');
          // Re-enter at ultra-low or low
          this.setProfile(this.dataSaverEnabled ? 'ultra_low' : 'low', 'Cautious recovery after congestion');
        }
        return;
      } else {
        this.consecutiveStableCycles = 0;
        return;
      }
    }

    // 2. Check for Congestion / Downshift Triggers (immediate response)
    const isCongested =
      packetLossPercent >= NETWORK_THRESHOLDS.downshiftPacketLoss ||
      rttMs >= NETWORK_THRESHOLDS.downshiftRttMs ||
      jitterMs >= NETWORK_THRESHOLDS.downshiftJitterMs;

    if (isCongested) {
      this.consecutiveStableCycles = 0;
      this.stepDownProfile(
        `Congestion detected (Loss: ${packetLossPercent.toFixed(1)}%, RTT: ${Math.round(rttMs)}ms)`
      );
      return;
    }

    // 3. Check for Upshift Triggers (requires sustained stability to avoid oscillation)
    const isStable =
      packetLossPercent < NETWORK_THRESHOLDS.upshiftPacketLoss &&
      rttMs < NETWORK_THRESHOLDS.upshiftRttMs &&
      jitterMs < NETWORK_THRESHOLDS.upshiftJitterMs;

    if (isStable) {
      this.consecutiveStableCycles++;
      if (this.consecutiveStableCycles >= NETWORK_THRESHOLDS.upshiftRequiredCycles) {
        this.consecutiveStableCycles = 0;
        // If data saver is enabled, do not upshift past low
        if (!this.dataSaverEnabled || this.currentProfileId === 'ultra_low') {
          this.stepUpProfile('Sustained connection stability: stepping up quality');
        }
      }
    } else {
      this.consecutiveStableCycles = Math.max(0, this.consecutiveStableCycles - 1);
    }
  }

  stepDownProfile(reason: string) {
    const currentIndex = VIDEO_PROFILE_ORDER.indexOf(this.currentProfileId);
    if (currentIndex > 0) {
      const nextProfileId = VIDEO_PROFILE_ORDER[currentIndex - 1];
      this.setProfile(nextProfileId, reason);
    }
  }

  stepUpProfile(reason: string) {
    const maxAllowedIndex = this.dataSaverEnabled
      ? VIDEO_PROFILE_ORDER.indexOf('low')
      : VIDEO_PROFILE_ORDER.length - 1;

    const currentIndex = VIDEO_PROFILE_ORDER.indexOf(this.currentProfileId);
    if (currentIndex < maxAllowedIndex) {
      const nextProfileId = VIDEO_PROFILE_ORDER[currentIndex + 1];
      this.setProfile(nextProfileId, reason);
    }
  }

  setProfile(profileId: VideoQualityProfileId, reason: string) {
    if (this.currentProfileId === profileId) return;

    this.currentProfileId = profileId;
    const profile = VIDEO_PROFILES[profileId];

    this.applyCurrentProfile();

    if (this.callbacks?.onProfileChanged) {
      this.callbacks.onProfileChanged(profile, reason);
    }
  }

  private async applyCurrentProfile() {
    if (!this.videoSender) return;

    try {
      const profile = VIDEO_PROFILES[this.currentProfileId];
      const params = this.videoSender.getParameters();

      if (!params.encodings || params.encodings.length === 0) {
        params.encodings = [{}];
      }

      // Compute scale resolution factor relative to 720p base
      // 1080p -> 1.0 (or original)
      // 720p -> 1.0
      // 480p -> 1.5
      // 360p -> 2.0
      // 240p -> 3.0
      // 144p -> 5.0
      const scaleFactorMap: Record<VideoQualityProfileId, number> = {
        full_hd: 1.0,
        high: 1.0,
        balanced: 1.5,
        standard: 2.0,
        low: 3.0,
        ultra_low: 5.0,
      };

      params.encodings[0].maxBitrate = profile.maxBitrateKbps * 1000;
      params.encodings[0].scaleResolutionDownBy = scaleFactorMap[profile.id] || 1.0;
      params.encodings[0].maxFramerate = profile.frameRate;
      params.encodings[0].active = !this.audioOnlyEmergencyFallback;

      if ('degradationPreference' in params) {
        (params as any).degradationPreference = this.degradationPreference || profile.degradationPreference;
      }

      await this.videoSender.setParameters(params);
    } catch (err) {
      console.warn('[AdaptiveEngine] Error applying parameters to sender:', err);
    }
  }

  private suspendVideoTrack(reason: string) {
    if (this.videoSender?.track) {
      this.videoSender.track.enabled = false;
    }
    this.applyCurrentProfile();
    if (this.callbacks?.onEmergencyAudioFallback) {
      this.callbacks.onEmergencyAudioFallback(true, reason);
    }
  }

  private restoreVideoTrack(reason: string) {
    if (this.videoSender?.track) {
      this.videoSender.track.enabled = true;
    }
    this.applyCurrentProfile();
    if (this.callbacks?.onEmergencyAudioFallback) {
      this.callbacks.onEmergencyAudioFallback(false, reason);
    }
  }
}

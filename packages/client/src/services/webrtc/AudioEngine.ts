import { AudioQualityProfileId, AUDIO_PROFILES } from '@aether/shared';

export class AudioEngine {
  private currentProfileId: AudioQualityProfileId = 'balanced';
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private animFrameId: number | null = null;
  private onVolumeChange?: (volume: number) => void;

  constructor(profileId: AudioQualityProfileId = 'balanced') {
    this.currentProfileId = profileId;
  }

  getConstraints(): MediaTrackConstraints {
    const profile = AUDIO_PROFILES[this.currentProfileId];
    return {
      echoCancellation: profile.echoCancellation,
      noiseSuppression: profile.noiseSuppression,
      autoGainControl: profile.autoGainControl,
      channelCount: profile.channels || 1,
      sampleRate: 48000,
    };
  }

  setProfile(profileId: AudioQualityProfileId) {
    this.currentProfileId = profileId;
  }

  /**
   * Modifies SDP to tune Opus codec for low-bandwidth resilience, FEC, and DTX
   */
  tuneOpusSdp(sdp: string): string {
    const profile = AUDIO_PROFILES[this.currentProfileId];
    const bitrateBps = profile.bitrateKbps * 1000;
    const dtxValue = profile.dtx ? 1 : 0;
    const fecValue = profile.fec ? 1 : 0;

    const lines = sdp.split('\r\n');
    let opusPayloadType: string | null = null;

    // Find Opus payload type
    for (const line of lines) {
      if (line.startsWith('a=rtpmap:') && line.toLowerCase().includes('opus/48000')) {
        const match = line.match(/^a=rtpmap:(\d+)\s+/);
        if (match) {
          opusPayloadType = match[1];
          break;
        }
      }
    }

    if (!opusPayloadType) return sdp;

    let fmtpFound = false;
    const modifiedLines = lines.map((line) => {
      if (line.startsWith(`a=fmtp:${opusPayloadType}`)) {
        fmtpFound = true;
        // Inject or update opus parameters
        let params = line.substring(`a=fmtp:${opusPayloadType} `.length);
        const paramMap = new Map<string, string>();
        params.split(';').forEach((p) => {
          const [k, v] = p.trim().split('=');
          if (k) paramMap.set(k, v || '');
        });

        paramMap.set('usedtx', dtxValue.toString());
        paramMap.set('useinbandfec', fecValue.toString());
        paramMap.set('maxaveragebitrate', bitrateBps.toString());
        paramMap.set('stereo', '0'); // mono voice saves 50% bandwidth

        const newParams = Array.from(paramMap.entries())
          .map(([k, v]) => `${k}=${v}`)
          .join(';');

        return `a=fmtp:${opusPayloadType} ${newParams}`;
      }
      return line;
    });

    if (!fmtpFound) {
      // Find where to append fmtp
      const rtpmapIndex = modifiedLines.findIndex((line) =>
        line.startsWith(`a=rtpmap:${opusPayloadType}`)
      );
      if (rtpmapIndex !== -1) {
        modifiedLines.splice(
          rtpmapIndex + 1,
          0,
          `a=fmtp:${opusPayloadType} usedtx=${dtxValue};useinbandfec=${fecValue};maxaveragebitrate=${bitrateBps};stereo=0`
        );
      }
    }

    return modifiedLines.join('\r\n');
  }

  /**
   * Connect an audio track to Web Audio Analyser for local voice activity meter
   */
  startVoiceMeter(stream: MediaStream, callback: (volume: number) => void) {
    this.stopVoiceMeter();
    this.onVolumeChange = callback;

    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) return;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioCtx();
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.4;
      source.connect(this.analyser);

      const bufferLength = this.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const update = () => {
        if (!this.analyser) return;
        this.analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        const normalized = Math.min(100, Math.round((average / 128) * 100));
        this.onVolumeChange?.(normalized);
        this.animFrameId = requestAnimationFrame(update);
      };

      update();
    } catch (err) {
      console.warn('[AudioEngine] Could not initialize voice meter:', err);
    }
  }

  stopVoiceMeter() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
      this.analyser = null;
    }
  }
}

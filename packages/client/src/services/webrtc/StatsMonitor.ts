import {
  WebRTCStatsSnapshot,
  NetworkQualityRating,
  VideoQualityProfileId,
} from '@aether/shared';

export type StatsListener = (stats: WebRTCStatsSnapshot) => void;

export class StatsMonitor {
  private pc: RTCPeerConnection | null = null;
  private intervalId: number | null = null;
  private listeners: Set<StatsListener> = new Set();

  private lastBytesSent: number = 0;
  private lastBytesReceived: number = 0;
  private lastTimestamp: number = 0;
  private totalBytesSentBase: number = 0;
  private totalBytesReceivedBase: number = 0;
  private currentProfileId: VideoQualityProfileId = 'balanced';
  private isE2EEActive: boolean = false;

  start(pc: RTCPeerConnection, pollIntervalMs = 2000) {
    this.stop();
    this.pc = pc;
    this.lastTimestamp = Date.now();
    this.intervalId = window.setInterval(() => this.collectStats(), pollIntervalMs);
  }

  stop() {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.pc = null;
  }

  setCurrentProfile(profileId: VideoQualityProfileId) {
    this.currentProfileId = profileId;
  }

  setE2EEActive(active: boolean) {
    this.isE2EEActive = active;
  }

  subscribe(listener: StatsListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private async collectStats() {
    if (!this.pc) return;

    try {
      const stats = await this.pc.getStats();
      const now = Date.now();
      const timeDeltaSec = (now - this.lastTimestamp) / 1000;
      if (timeDeltaSec <= 0) return;

      let currentBytesSent = 0;
      let currentBytesReceived = 0;
      let packetsLost = 0;
      let packetsReceived = 0;
      let rttMs = 0;
      let jitterMs = 0;
      let audioCodec = 'Opus (48kHz)';
      let videoCodec = 'VP8 / VP9';
      let videoWidth = 0;
      let videoHeight = 0;
      let fps = 0;
      let iceConnectionType = 'direct';
      let candidatePairState = 'in-progress';

      stats.forEach((report) => {
        // Outbound RTP (Upload)
        if (report.type === 'outbound-rtp') {
          if (typeof report.bytesSent === 'number') {
            currentBytesSent += report.bytesSent;
          }
          if (report.kind === 'video') {
            if (report.frameWidth) videoWidth = report.frameWidth;
            if (report.frameHeight) videoHeight = report.frameHeight;
            if (report.framesPerSecond) fps = Math.round(report.framesPerSecond);
          }
        }

        // Inbound RTP (Download)
        if (report.type === 'inbound-rtp') {
          if (typeof report.bytesReceived === 'number') {
            currentBytesReceived += report.bytesReceived;
          }
          if (typeof report.packetsLost === 'number') {
            packetsLost += report.packetsLost;
          }
          if (typeof report.packetsReceived === 'number') {
            packetsReceived += report.packetsReceived;
          }
          if (typeof report.jitter === 'number') {
            jitterMs = Math.round(report.jitter * 1000);
          }
          if (report.kind === 'video' && (!videoWidth || !videoHeight)) {
            if (report.frameWidth) videoWidth = report.frameWidth;
            if (report.frameHeight) videoHeight = report.frameHeight;
            if (report.framesPerSecond) fps = Math.round(report.framesPerSecond);
          }
        }

        // Candidate pair (RTT & ICE state)
        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          candidatePairState = report.state;
          if (typeof report.currentRoundTripTime === 'number') {
            rttMs = Math.round(report.currentRoundTripTime * 1000);
          }
          if (report.localCandidateId) {
            const localCandidate = stats.get(report.localCandidateId);
            if (localCandidate) {
              iceConnectionType = localCandidate.candidateType || 'direct';
            }
          }
        }

        // Codec identification
        if (report.type === 'codec') {
          const mime = report.mimeType || '';
          if (mime.includes('audio') && mime.includes('opus')) {
            audioCodec = 'Opus';
          }
          if (mime.includes('video')) {
            if (mime.includes('VP9')) videoCodec = 'VP9';
            else if (mime.includes('AV1')) videoCodec = 'AV1';
            else if (mime.includes('H264')) videoCodec = 'H.264';
            else if (mime.includes('VP8')) videoCodec = 'VP8';
          }
        }
      });

      // Calculate transfer rates
      const bytesSentDelta = Math.max(0, currentBytesSent - this.lastBytesSent);
      const bytesRecvDelta = Math.max(0, currentBytesReceived - this.lastBytesReceived);

      // Bitrate in kbps
      const uploadBitrateKbps = Math.round((bytesSentDelta * 8) / (timeDeltaSec * 1000));
      const downloadBitrateKbps = Math.round((bytesRecvDelta * 8) / (timeDeltaSec * 1000));

      // Packet loss percentage
      const totalPackets = packetsLost + packetsReceived;
      const packetLossPercent =
        totalPackets > 0 ? Math.min(100, (packetsLost / totalPackets) * 100) : 0;

      // Update counters
      this.lastBytesSent = currentBytesSent;
      this.lastBytesReceived = currentBytesReceived;
      this.lastTimestamp = now;

      // Estimated total data usage in Megabytes
      const totalBytes = currentBytesSent + currentBytesReceived;
      const estimatedDataUsageMB = parseFloat((totalBytes / (1024 * 1024)).toFixed(2));

      // Estimated MB per hour based on current active bitrates
      const totalBitrateKbps = uploadBitrateKbps + downloadBitrateKbps;
      const estimatedPerHourMB = Math.round((totalBitrateKbps * 3600) / (8 * 1024));

      // Evaluate rating
      const rating = this.evaluateRating(packetLossPercent, rttMs, jitterMs);

      const snapshot: WebRTCStatsSnapshot = {
        timestamp: now,
        uploadBitrateKbps,
        downloadBitrateKbps,
        rttMs,
        packetLossPercent: parseFloat(packetLossPercent.toFixed(1)),
        jitterMs,
        currentProfile: this.currentProfileId,
        audioBitrateKbps: Math.min(uploadBitrateKbps, 32),
        videoResolution: {
          width: videoWidth || 640,
          height: videoHeight || 360,
          fps: fps || 24,
        },
        audioCodec,
        videoCodec,
        totalBytesSent: currentBytesSent,
        totalBytesReceived: currentBytesReceived,
        estimatedDataUsageMB,
        estimatedPerHourMB,
        rating,
        iceConnectionType,
        isE2EEActive: this.isE2EEActive,
        candidatePairState,
      };

      for (const listener of this.listeners) {
        listener(snapshot);
      }
    } catch (err) {
      console.warn('[StatsMonitor] Error fetching getStats:', err);
    }
  }

  private evaluateRating(packetLoss: number, rtt: number, jitter: number): NetworkQualityRating {
    if (packetLoss >= 15 || rtt >= 650 || jitter >= 120) return 'critical';
    if (packetLoss >= 6 || rtt >= 350 || jitter >= 60) return 'poor';
    if (packetLoss >= 2.5 || rtt >= 200 || jitter >= 35) return 'fair';
    if (packetLoss >= 0.8 || rtt >= 120) return 'good';
    return 'excellent';
  }
}

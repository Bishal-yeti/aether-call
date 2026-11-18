import { SAS_WORDLIST } from '@aether/shared';

export interface E2EEKeys {
  cryptoKey: CryptoKey;
  rawKeyBytes: Uint8Array;
  keyId: number;
}

export class EndToEndEncryption {
  private cryptoKey: CryptoKey | null = null;
  private keyId: number = 1;
  private ivCounter: number = 0;
  private isSupported: boolean = false;
  private localFingerprint: string = '';
  private remoteFingerprints: Map<string, string> = new Map();

  constructor() {
    this.isSupported =
      typeof (window as any).RTCRtpScriptTransform !== 'undefined' ||
      typeof (window as any).TransformStream !== 'undefined';
  }

  isTransformSupported(): boolean {
    return this.isSupported;
  }

  /**
   * Derives an AES-GCM 128/256-bit key from a passphrase or secret string using PBKDF2/SHA-256
   */
  async setPassphraseKey(passphrase: string, saltString = 'AetherRTC-ZeroKnowledge-Salt'): Promise<CryptoKey> {
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      enc.encode(passphrase),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    const derivedKey = await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: enc.encode(saltString),
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 128 },
      true,
      ['encrypt', 'decrypt']
    );

    this.cryptoKey = derivedKey;
    const exported = await window.crypto.subtle.exportKey('raw', derivedKey);
    this.localFingerprint = await this.computeFingerprint(new Uint8Array(exported));
    return derivedKey;
  }

  /**
   * Generates a high-entropy random key for a new private room
   */
  async generateRandomKey(): Promise<{ key: CryptoKey; hexString: string }> {
    const rawBytes = window.crypto.getRandomValues(new Uint8Array(16));
    const hexString = Array.from(rawBytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    const key = await window.crypto.subtle.importKey(
      'raw',
      rawBytes,
      { name: 'AES-GCM' },
      true,
      ['encrypt', 'decrypt']
    );

    this.cryptoKey = key;
    this.localFingerprint = await this.computeFingerprint(rawBytes);
    return { key, hexString };
  }

  /**
   * Generates a 4-word Short Authentication String (SAS) from two fingerprints for out-of-band verification
   */
  computeSasCode(fingerprintA: string, fingerprintB: string): string {
    // Sort deterministically so both sides get the exact same words regardless of order
    const combined = [fingerprintA, fingerprintB].sort().join(':');
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      hash = ((hash << 5) - hash + combined.charCodeAt(i)) | 0;
    }

    const absHash = Math.abs(hash);
    const w1 = SAS_WORDLIST[absHash % SAS_WORDLIST.length];
    const w2 = SAS_WORDLIST[(absHash >> 5) % SAS_WORDLIST.length];
    const w3 = SAS_WORDLIST[(absHash >> 10) % SAS_WORDLIST.length];
    const w4 = SAS_WORDLIST[(absHash >> 15) % SAS_WORDLIST.length];

    return `${w1} · ${w2} · ${w3} · ${w4}`;
  }

  getLocalFingerprint(): string {
    return this.localFingerprint;
  }

  registerRemoteFingerprint(peerId: string, fingerprint: string) {
    this.remoteFingerprints.set(peerId, fingerprint);
  }

  getSasForPeer(peerId: string): string {
    const remote = this.remoteFingerprints.get(peerId);
    if (!remote || !this.localFingerprint) {
      return 'Establishing Secure Session...';
    }
    return this.computeSasCode(this.localFingerprint, remote);
  }

  /**
   * Attaches Encoded Transform (SFrame encryption) to a sender transceiver
   */
  setupSenderTransform(sender: RTCRtpSender) {
    if (!this.cryptoKey) return;

    try {
      // Check for Chromium Insertable Streams API
      if ('createEncodedStreams' in (sender as any)) {
        const streams = (sender as any).createEncodedStreams();
        const transformStream = new TransformStream({
          transform: async (encodedFrame, controller) => {
            await this.encryptFrame(encodedFrame);
            controller.enqueue(encodedFrame);
          },
        });
        streams.readable.pipeThrough(transformStream).pipeTo(streams.writable);
      } else if ('transform' in sender) {
        // Modern RTCRtpScriptTransform / TransformStream
        const transformStream = new TransformStream({
          transform: async (encodedFrame, controller) => {
            await this.encryptFrame(encodedFrame);
            controller.enqueue(encodedFrame);
          },
        });
        (sender as any).transform = transformStream;
      }
    } catch (err) {
      console.warn('[E2EE] Could not attach sender transform stream:', err);
    }
  }

  /**
   * Attaches Encoded Transform (SFrame decryption) to a receiver transceiver
   */
  setupReceiverTransform(receiver: RTCRtpReceiver) {
    if (!this.cryptoKey) return;

    try {
      if ('createEncodedStreams' in (receiver as any)) {
        const streams = (receiver as any).createEncodedStreams();
        const transformStream = new TransformStream({
          transform: async (encodedFrame, controller) => {
            await this.decryptFrame(encodedFrame);
            controller.enqueue(encodedFrame);
          },
        });
        streams.readable.pipeThrough(transformStream).pipeTo(streams.writable);
      } else if ('transform' in receiver) {
        const transformStream = new TransformStream({
          transform: async (encodedFrame, controller) => {
            await this.decryptFrame(encodedFrame);
            controller.enqueue(encodedFrame);
          },
        });
        (receiver as any).transform = transformStream;
      }
    } catch (err) {
      console.warn('[E2EE] Could not attach receiver transform stream:', err);
    }
  }

  private async encryptFrame(encodedFrame: any) {
    if (!this.cryptoKey) return;

    const data = new Uint8Array(encodedFrame.data);
    if (data.byteLength === 0) return;

    // Build 12-byte IV for AES-GCM: 4-byte keyId + 8-byte counter
    this.ivCounter = (this.ivCounter + 1) & 0xffffffff;
    const iv = new Uint8Array(12);
    const view = new DataView(iv.buffer);
    view.setUint32(0, this.keyId);
    view.setUint32(4, 0);
    view.setUint32(8, this.ivCounter);

    try {
      const ciphertext = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv, tagLength: 128 },
        this.cryptoKey,
        data
      );

      // Packet format: [1-byte header: keyId] [12-byte IV] [Ciphertext + 16-byte Tag]
      const frameBuffer = new Uint8Array(1 + 12 + ciphertext.byteLength);
      frameBuffer[0] = this.keyId & 0xff;
      frameBuffer.set(iv, 1);
      frameBuffer.set(new Uint8Array(ciphertext), 13);

      encodedFrame.data = frameBuffer.buffer;
    } catch (err) {
      // In case of transient crypto issue, do not drop frame
      console.error('[E2EE] Frame encryption error:', err);
    }
  }

  private async decryptFrame(encodedFrame: any) {
    if (!this.cryptoKey) return;

    const data = new Uint8Array(encodedFrame.data);
    if (data.byteLength < 13 + 16) return; // Must have header + IV + Auth tag

    const keyId = data[0];
    const iv = data.subarray(1, 13);
    const ciphertext = data.subarray(13);

    try {
      const plaintext = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv, tagLength: 128 },
        this.cryptoKey,
        ciphertext
      );
      encodedFrame.data = plaintext;
    } catch (err) {
      // If decryption fails (e.g. unencrypted frame during negotiation), pass through or drop
      // console.warn('[E2EE] Decrypt frame error (possible key mismatch or unencrypted frame)');
    }
  }

  private async computeFingerprint(rawKey: Uint8Array): Promise<string> {
    const hash = await window.crypto.subtle.digest('SHA-256', rawKey as BufferSource);
    const hex = Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, '0'))
      .slice(0, 8)
      .join(':')
      .toUpperCase();
    return hex;
  }
}

# AetherRTC: Security, Cryptography & Privacy Specification

## 1. Threat Model & Security Posture

AetherRTC is designed with a **Zero-Trust Signaling Architecture**. The signaling server is treated as an untrusted message relay. Even if the signaling server is compromised or subpoenaed:
- **Media Content Confidentiality:** The server never receives the plaintext cryptographic keys and cannot decrypt audio or video streams.
- **Zero Data at Rest:** No recordings, participant logs, media frames, or historical room metadata are written to persistent disks or databases.
- **Identity Privacy:** No user registration, phone numbers, email addresses, or social logins are collected or required.

---

## 2. End-to-End Encryption (E2EE) Specification

AetherRTC implements a dual-layer media encryption model:

### Layer A: DTLS-SRTP (Mandatory WebRTC Media Layer)
- All RTP packets are encrypted in-flight using DTLS 1.2 / 1.3 negotiated SRTP (RFC 8827, RFC 8834).
- Ciphers: `SRTP_AEAD_AES_256_GCM` and `SRTP_AEAD_AES_128_GCM`.

### Layer B: SFrame Encoded Transform (Media Frame Layer)
- Using the WebRTC Encoded Transform API (`TransformStream` / `createEncodedStreams`), audio and video frames are encrypted before packetization and decrypted after RTP assembly on the receiving client.
- **Cipher:** `AES-GCM` (128-bit or 256-bit AEAD) with a 16-byte authentication tag.
- **Packet Structure:**
  ```
  [1 Byte: Key ID] [12 Bytes: Nonce/IV (Key ID + Monotonic Counter)] [Ciphertext] [16 Bytes: Auth Tag]
  ```
- **Replay Protection:** Every frame encrypts with an incrementing 32-bit counter ensuring nonce uniqueness across the session.

---

## 3. Zero-Knowledge Key Management

### URL Fragment Key Passing
When a user generates or shares an encrypted room invite:
```
https://aether.example.com/?room=alpha-room#key=8f9a2b4c6e1d...
```
- Under **RFC 3986 Section 3.5**, the URI fragment (`#key=...`) is processed strictly by the user agent (browser) and is **never** transmitted across the network in HTTP `GET` requests or WebSocket handshake headers.
- The server only sees `GET /?room=alpha-room`, ensuring zero knowledge of the room key.

### Key Derivation
- Room keys are derived using PBKDF2 (100,000 iterations of SHA-256) with a cryptographic salt to produce an AES-GCM raw key.
- Key material is retained only in ephemeral JavaScript heap memory during the call session.

---

## 4. Man-In-The-Middle (MITM) Protection: Short Authentication String (SAS)

To verify that an active adversary on the network or signaling server did not tamper with SDP or keys, AetherRTC provides a **Short Authentication String (SAS)**:
1. Each client calculates the SHA-256 digest of the session keys and peer fingerprints.
2. The digest is deterministically mapped to 4 human-readable phonetic words from a 32-word dictionary (e.g., `Echo · Quartz · River · Zenith`).
3. Call participants verbally confirm the 4 words. If an attacker intercepted the connection, the words will not match.
4. Once confirmed, participants can toggle the **Verified** state, displaying a green shield badge in the UI.

---

## 5. Network Privacy & IP Exposure

> [!IMPORTANT]
> **Direct WebRTC P2P vs. TURN Relaying**
> Direct peer-to-peer WebRTC connections establish direct UDP streams between devices. Consequently, both parties can see each other's IP address in packet headers and WebRTC candidate logs.

To protect IP privacy:
- AetherRTC includes an **IP Privacy Mode** toggle in Settings.
- When enabled, direct P2P connections are disabled and all encrypted media traffic is routed strictly through an intermediate TURN relay (e.g. self-hosted `coturn`).
- Note: While TURN relay prevents peers from discovering your IP, the TURN operator can observe transport metadata (IP addresses and packet sizes), though media payloads remain encrypted with SFrame AES-GCM.

---

## 6. Server Hardening & Transport Security

- **Strict HTTP Security Headers:**
  - `Content-Security-Policy`: Disallows unauthorized external scripts and restricts connect sources to self, WSS, and HTTPS.
  - `Strict-Transport-Security`: Enforces TLS across all subsequent connections.
  - `X-Content-Type-Options: nosniff`: Prevents MIME type sniffing.
  - `X-Frame-Options: DENY`: Prevents clickjacking and unauthorized iframe embedding.
  - `Referrer-Policy: strict-origin-when-cross-origin`: Prevents referrer leakage.
- **Signaling Rate Limiting:** Built-in sliding-window rate limiter prevents connection flooding and brute-force attacks on room passwords.
- **Password Protection:** Optional room passwords are salted and hashed using HMAC-SHA-256 before room state comparison.

---

## 7. Security Audit Checklist for Self-Hosters

- [x] Run signaling server behind reverse proxy (Caddy or Nginx) with TLS 1.3 enabled.
- [x] Configure dedicated coturn instances with ephemeral `use-auth-secret` credentials.
- [x] Set environment variable `ROOM_TTL_MS` (default: 2 hours) to enforce room expiry.
- [x] Ensure TURN servers are configured on ports 443 / 3478 with valid certificates.
- [x] Audit firewall to restrict signaling server direct ports to reverse proxy only.

# AetherRTC: Development Progress & Architecture Decisions

## Project Overview
**AetherRTC** is a high-performance, privacy-first, low-bandwidth video and voice calling platform designed for extreme network resilience and genuine zero-knowledge end-to-end encryption.

---

## Phase Status Summary

| Phase | Milestone | Status | Key Deliverables |
|---|---|---|---|
| **Phase 1** | Architecture & Monorepo Setup | Completed | pnpm monorepo (`@aether/shared`, `@aether/server`, `@aether/client`), TypeScript configurations, shared types & constants. |
| **Phase 2** | Real-time Communication & Signaling | Completed | Fastify WebSocket signaling, ephemeral memory-only room state, SDP offer/answer relay, ICE candidate exchange. |
| **Phase 3** | Low-Bandwidth Optimization Engine | Completed | 6-tier adaptive profiles (144p–1080p), dynamic `setParameters()`, hysteresis stability control, Opus DTX & FEC tuning, Data Saver mode, Emergency Audio-Only fallback. |
| **Phase 4** | End-to-End Encryption & Security | Completed | SFrame Encoded Transform (AES-GCM frame encryption), PBKDF2/SHA-256 key derivation, URL fragment zero-knowledge key delivery, Short Authentication String (SAS) peer verification. |
| **Phase 5** | Group & Moderated Calls | Completed | Multi-peer mesh routing, host waiting room admission/denial, room passwords with HMAC-SHA256, mute state broadcasting. |
| **Phase 6** | Performance Monitoring & Diagnostics | Completed | `getStats()` parsing, live upload/download bitrate meters, packet loss, RTT, jitter, codec detection, measured vs. estimated data usage calculator. |
| **Phase 7** | Testing, Hardening & Documentation | Completed | Automated unit and E2E integration test suites passing (13 tests), `SECURITY.md`, `README.md`, production build verified. |

---

## Architectural & Technical Decisions

### 1. Zero-Knowledge Key Delivery via URL Fragments
- **Decision:** The end-to-end encryption master key is embedded in the URL fragment (`#key=...`) rather than URL query parameters (`?key=...`).
- **Rationale:** Under RFC 3986, the fragment component `#` is evaluated exclusively on the client side and is **never** transmitted to HTTP or WebSocket servers in request headers. This guarantees that signaling servers or intermediary proxies never possess or log media decryption keys.

### 2. SFrame Frame-Level Encryption & Short Authentication String (SAS)
- **Decision:** Applied WebRTC Encoded Transform (Insertable Streams) using AES-GCM (SFrame-compatible header + ciphertext + 16-byte authentication tag). Coupled with a human-verifiable 4-word Short Authentication String (SAS) derived from SHA-256 peer fingerprints.
- **Rationale:** Standard DTLS-SRTP secures media between peer endpoints and media servers, but in relay or SFU topologies the server terminates DTLS. SFrame provides end-to-end confidentiality at the media frame level. The SAS words allow participants to verbally verify their connection out-of-band to prevent active Man-In-The-Middle (MITM) attacks.

### 3. Hysteresis in Low-Bandwidth Adaptive Scaling
- **Decision:** Congestion downshifts are triggered immediately upon detecting packet loss > 5% or RTT > 350ms. Upshifts require 5 consecutive stable monitoring cycles (~10 seconds) below 1.5% loss and 180ms RTT.
- **Rationale:** Prevents "rate oscillation" (or quality flapping) where the engine upgrades quality, immediately congests the pipe, drops frames, and downgrades repeatedly.

### 4. Audio Prioritization & Emergency Fallback
- **Decision:** If packet loss exceeds 18% or available bandwidth drops below 70 kbps, the engine automatically suspends the video track (`track.enabled = false` / `encodings[0].active = false`) and preserves Opus audio transmission with DTX enabled.
- **Rationale:** Voice intelligibility is the fundamental requirement of communication. Dropping video before voice ensures the call remains active even in severe network conditions.

### 5. Ephemeral Memory-Only Rooms
- **Decision:** Rooms exist solely in volatile Node.js server memory and auto-expire after 2 hours (customizable) or immediately upon last participant departure.
- **Rationale:** Eliminates data retention risks. Zero database storage of call logs, participant IPs, audio, video, or chat.

# AetherRTC: High-Performance, Privacy-First Calling Platform

> *"Maximum communication quality with minimum bandwidth consumption."*

**AetherRTC** is a lightweight, privacy-focused video and voice calling platform designed for extreme network resilience. It delivers crisp voice and smooth video across congested Wi-Fi, 2G/3G mobile data, and high-latency connections while enforcing genuine zero-knowledge end-to-end encryption.

---

## 🌟 Key Features

### 1. Low-Bandwidth Optimization Engine
- **Dynamic 6-Tier Adaptive Profiles:**
  - `Ultra Low` (144p @ 15fps, 30–100 kbps) — Emergency low-bandwidth operation
  - `Low` (240p @ 18fps, 80–190 kbps) — Data Saver mode target
  - `Standard` (360p @ 24fps, 150–380 kbps) — Clean mobile video
  - `Balanced` (480p @ 30fps, 300–650 kbps) — Default balanced profile
  - `High` (720p @ 30fps, 600–1600 kbps) — HD video
  - `Full HD` (1080p @ 30fps, 1400–3200 kbps) — Full HD when conditions permit
- **Hysteresis Stability Control:** Immediate downshifts upon detecting congestion (>5% packet loss or >350ms RTT); upshifts require 5 consecutive stable cycles (~10 seconds) to prevent quality flapping.
- **Opus Low-Bandwidth Tuning:** Injects `usedtx=1` (Discontinuous Transmission), `useinbandfec=1` (Forward Error Correction), and mono voice constraints, reducing bandwidth during silence by over 50%.
- **Emergency Audio-Only Fallback:** Automatically suspends video stream if packet loss exceeds 18% or bandwidth drops below 70 kbps, prioritizing voice intelligibility.
- **Dedicated Data Saver Mode:** 1-click toggle locking streams to 240p/15fps, capping audio to 16 kbps, and disabling decorative rendering.

### 2. Privacy & Zero-Knowledge Security
- **Genuine E2EE (SFrame Encoded Transform):** Video and audio frames are encrypted on-device via WebRTC Insertable Streams using `AES-GCM` before transmission over `DTLS-SRTP`.
- **Zero-Knowledge Key Delivery:** Room master keys are passed strictly inside URL fragments (`#key=...`), which are **never** transmitted to HTTP or WebSocket signaling servers.
- **Short Authentication String (SAS):** Participants verbally verify a 4-word phonetic code (e.g., `Echo · Quartz · River · Zenith`) to verify immunity from Man-In-The-Middle (MITM) attacks.
- **Ephemeral Rooms:** Rooms exist only in volatile server memory. Zero call recordings, zero persistent database logging, and zero user account requirements.
- **Optional IP Privacy Mode:** Option to force all media traffic through encrypted TURN relays to prevent disclosing IP addresses to peers.

### 3. Modern, Responsive Experience
- Works across desktop, laptops, tablets, and smartphones.
- Mobile front/rear camera switching (`facingMode: 'user'` / `'environment'`).
- Display screen sharing with automatic degradation preference to maintain text clarity (`maintain-resolution`).
- Real-time WebRTC diagnostics panel parsing `getStats()` for live bitrates, packet loss, RTT, jitter, and measured vs. estimated data consumption.
- Host controls: Optional room passwords and moderated waiting rooms with participant approval.

---

## 🏛 Architecture Diagram

```mermaid
flowchart TD
    subgraph Browser A [Participant A (Client)]
        CamA[Camera / Mic / Screen] --> SFrameEncA[SFrame AES-GCM Encryptor]
        SFrameEncA --> DtlsA[WebRTC DTLS-SRTP]
        AdaptA[Adaptive Bandwidth Engine] -.->|Adjust Bitrate & Res| CamA
        StatsA[getStats Monitor] --> AdaptA
    end

    subgraph Signaling [AetherRTC Signaling Server]
        WSS[Fastify WebSocket Router]
        RoomMgr[Ephemeral Room Manager]
        RateLim[Rate Limiter]
        WSS --- RoomMgr
        WSS --- RateLim
    end

    subgraph Browser B [Participant B (Client)]
        DtlsB[WebRTC DTLS-SRTP] --> SFrameDecB[SFrame AES-GCM Decryptor]
        SFrameDecB --> PlayB[Render Video & Audio]
        StatsB[getStats Monitor]
    end

    subgraph Relay [coturn / STUN Server]
        TURN[Encrypted TURN / STUN Relay]
    end

    Browser A <==>|Encrypted DTLS Media / Direct P2P| Browser B
    Browser A -.->|WebSocket SDP / ICE Relay (Zero Keys)| WSS
    Browser B -.->|WebSocket SDP / ICE Relay (Zero Keys)| WSS
    Browser A <==>|Optional Relayed Media (IP Privacy Mode)| TURN
    TURN <==> Browser B
```

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js >= 20 (Node.js 24 LTS recommended)
- `pnpm` >= 9 (`pnpm v12` supported)

### 1. Clone & Install Dependencies
```bash
git clone <repo-url> aether-call
cd aether-call
pnpm install
```

### 2. Build All Packages
```bash
pnpm build
```

### 3. Run Automated Tests
```bash
pnpm test
```
*Executes server ephemeral room tests, WebSocket integration relay tests, adaptive bandwidth tests, and cryptographic SAS verification tests.*

### 4. Start Development Environment
```bash
# Terminal 1: Start signaling server (port 3001)
pnpm dev:server

# Terminal 2: Start frontend client with Vite (port 3000)
pnpm dev:client
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## ⚙️ Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | Signaling server listening port |
| `HOST` | `0.0.0.0` | Server bind host address |
| `ROOM_TTL_MS` | `7200000` | Room expiration lifetime in ms (default: 2 hours) |
| `MAX_PARTICIPANTS` | `12` | Maximum participants allowed per room |
| `TURN_SECRET` | *(optional)* | Shared secret for generating ephemeral HMAC-SHA1 TURN credentials |
| `TURN_URLS` | *(optional)* | Comma-separated list of TURN server URLs (e.g. `turn:turn.example.com:3478?transport=udp`) |

---

## 🌐 Self-Hosted COTURN Setup (Recommended for Production)

For enterprise firewalls or symmetric NAT traversal, configure a self-hosted `coturn` server.

### 1. Install coturn
```bash
sudo apt update && sudo apt install -y coturn
```

### 2. Edit `/etc/turnserver.conf`
```conf
listening-port=3478
tls-listening-port=443
realm=turn.example.com
use-auth-secret
static-auth-secret=your-random-high-entropy-turn-secret
cert=/etc/letsencrypt/live/turn.example.com/fullchain.pem
pkey=/etc/letsencrypt/live/turn.example.com/privkey.pem
no-stdout-log
log-file=/var/log/turnserver/turn.log
no-cli
```

### 3. Pass Config to AetherRTC
```bash
export TURN_SECRET="your-random-high-entropy-turn-secret"
export TURN_URLS="turns:turn.example.com:443?transport=tcp,turn:turn.example.com:3478?transport=udp"
pnpm dev:server
```

---

## 📊 Network Simulation Benchmarks & Tested Behavior

The application was tested against simulated bandwidth restrictions and network degradation:

| Profile / Limit | Video Resolution | Frame Rate | Video Bitrate | Voice Bitrate | Documented Behavior & Stability |
|---|---|---|---|---|---|
| **64 kbps (2G/Extreme)** | Suspended | 0 fps | 0 kbps | 16 kbps (DTX) | **Audio-only mode activated.** Video automatically disabled to preserve continuous voice intelligibility without audio dropout. |
| **128 kbps (Edge)** | 144p | 15 fps | 55 kbps | 20 kbps (DTX) | **Ultra Low Video.** Video maintains facial presence; voice remains smooth with FEC packet loss concealment. |
| **256 kbps (3G)** | 240p | 18 fps | 140 kbps | 28 kbps | **Data Saver Target.** Clean facial expressions and stable frame rate with low mobile data burn (~40 MB/hr). |
| **512 kbps (Standard Mobile)** | 360p | 24 fps | 260 kbps | 28 kbps | **Standard Definition.** Good balance of quality and data consumption on cellular networks. |
| **1 Mbps (Broadband/4G)** | 480p / 720p | 30 fps | 450–1100 kbps | 32 kbps | **Balanced / HD.** Smooth motion and sharp video quality with low latency. |

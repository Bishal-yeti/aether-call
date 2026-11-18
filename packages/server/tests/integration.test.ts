import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { WebSocket } from 'ws';
import { RoomManager } from '../src/signaling/RoomManager.js';
import { SignalingHandler } from '../src/signaling/SignalingHandler.js';
import { InMemoryRateLimiter } from '../src/security/rateLimiter.js';
import { SignalingMessage } from '@aether/shared';

describe('AetherRTC End-to-End Signaling & Relay Integration', () => {
  let app: FastifyInstance;
  let serverPort: number;
  let roomManager: RoomManager;
  let signalingHandler: SignalingHandler;

  beforeAll(async () => {
    app = fastify();
    await app.register(cors, { origin: true });
    await app.register(websocket);

    const rateLimiter = new InMemoryRateLimiter(500, 60000);
    roomManager = new RoomManager();
    signalingHandler = new SignalingHandler(roomManager, rateLimiter);

    app.get('/ws', { websocket: true }, (socket, req) => {
      const ip = req.socket.remoteAddress || '127.0.0.1';
      signalingHandler.handleConnection(socket, ip);
    });

    await app.listen({ port: 0, host: '127.0.0.1' });
    const address = app.server.address() as any;
    serverPort = address.port;
  });

  afterAll(async () => {
    roomManager.destroy();
    await app.close();
  });

  it('performs full 2-peer room join, SDP offer/answer relay, ICE candidate exchange, and SAS key exchange', async () => {
    const wsUrl = `ws://127.0.0.1:${serverPort}/ws`;
    const clientA = new WebSocket(wsUrl);
    const clientB = new WebSocket(wsUrl);

    await Promise.all([
      new Promise((res) => clientA.on('open', res)),
      new Promise((res) => clientB.on('open', res)),
    ]);

    const messagesA: SignalingMessage[] = [];
    const messagesB: SignalingMessage[] = [];

    clientA.on('message', (data) => messagesA.push(JSON.parse(data.toString())));
    clientB.on('message', (data) => messagesB.push(JSON.parse(data.toString())));

    const roomId = 'test-e2e-room';

    // 1. Client A joins room as Host
    clientA.send(
      JSON.stringify({
        type: 'join_room',
        payload: {
          roomId,
          participantName: 'Alice',
          e2eePublicKey: 'ALICE_FP_4A7E9C',
        },
      })
    );

    // Wait for room_joined
    await new Promise((resolve) => {
      const interval = setInterval(() => {
        if (messagesA.some((m) => m.type === 'room_joined')) {
          clearInterval(interval);
          resolve(true);
        }
      }, 20);
    });

    const roomJoinedA = messagesA.find((m) => m.type === 'room_joined');
    expect(roomJoinedA).toBeDefined();
    const aliceId = roomJoinedA!.payload.participantId;
    expect(aliceId).toMatch(/^peer_/);

    // 2. Client B joins room
    clientB.send(
      JSON.stringify({
        type: 'join_room',
        payload: {
          roomId,
          participantName: 'Bob',
          e2eePublicKey: 'BOB_FP_9B2C1D',
        },
      })
    );

    // Wait for Bob room_joined and Alice peer_joined
    await new Promise((resolve) => {
      const interval = setInterval(() => {
        const bobJoined = messagesB.some((m) => m.type === 'room_joined');
        const aliceNotified = messagesA.some((m) => m.type === 'peer_joined');
        if (bobJoined && aliceNotified) {
          clearInterval(interval);
          resolve(true);
        }
      }, 20);
    });

    const roomJoinedB = messagesB.find((m) => m.type === 'room_joined');
    expect(roomJoinedB).toBeDefined();
    const bobId = roomJoinedB!.payload.participantId;
    expect(bobId).toMatch(/^peer_/);

    const peerJoinedAlice = messagesA.find((m) => m.type === 'peer_joined');
    expect(peerJoinedAlice!.payload.participant.name).toBe('Bob');
    expect(peerJoinedAlice!.payload.e2eePublicKey).toBe('BOB_FP_9B2C1D');

    // 3. Alice sends SDP Offer to Bob
    clientA.send(
      JSON.stringify({
        type: 'offer',
        roomId,
        senderId: aliceId,
        targetId: bobId,
        payload: { sdp: { type: 'offer', sdp: 'v=0\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\n' } },
      })
    );

    // Wait for Bob to receive offer
    await new Promise((resolve) => {
      const interval = setInterval(() => {
        if (messagesB.some((m) => m.type === 'offer')) {
          clearInterval(interval);
          resolve(true);
        }
      }, 20);
    });

    const bobOffer = messagesB.find((m) => m.type === 'offer')!;
    expect(bobOffer.senderId).toBe(aliceId);
    expect(bobOffer.payload.sdp.type).toBe('offer');

    // 4. Bob replies with SDP Answer
    clientB.send(
      JSON.stringify({
        type: 'answer',
        roomId,
        senderId: bobId,
        targetId: aliceId,
        payload: { sdp: { type: 'answer', sdp: 'v=0\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\n' } },
      })
    );

    await new Promise((resolve) => {
      const interval = setInterval(() => {
        if (messagesA.some((m) => m.type === 'answer')) {
          clearInterval(interval);
          resolve(true);
        }
      }, 20);
    });

    const aliceAnswer = messagesA.find((m) => m.type === 'answer')!;
    expect(aliceAnswer.senderId).toBe(bobId);
    expect(aliceAnswer.payload.sdp.type).toBe('answer');

    // 5. ICE Candidate exchange
    clientA.send(
      JSON.stringify({
        type: 'ice_candidate',
        roomId,
        senderId: aliceId,
        targetId: bobId,
        payload: { candidate: { candidate: 'candidate:1 1 UDP 2130706431 127.0.0.1 50000 typ host' } },
      })
    );

    await new Promise((resolve) => {
      const interval = setInterval(() => {
        if (messagesB.some((m) => m.type === 'ice_candidate')) {
          clearInterval(interval);
          resolve(true);
        }
      }, 20);
    });

    const bobCandidate = messagesB.find((m) => m.type === 'ice_candidate')!;
    expect(bobCandidate.payload.candidate.candidate).toContain('127.0.0.1');

    // 6. Bob disconnects
    clientB.close();

    await new Promise((resolve) => {
      const interval = setInterval(() => {
        if (messagesA.some((m) => m.type === 'peer_left')) {
          clearInterval(interval);
          resolve(true);
        }
      }, 20);
    });

    const peerLeftAlice = messagesA.find((m) => m.type === 'peer_left')!;
    expect(peerLeftAlice.senderId).toBe(bobId);

    clientA.close();
  });
});

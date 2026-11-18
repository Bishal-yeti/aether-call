import { WebSocket } from 'ws';
import { SignalingMessage, Participant, DEFAULT_STUN_SERVERS } from '@aether/shared';
import { RoomManager } from './RoomManager.js';
import { InMemoryRateLimiter } from '../security/rateLimiter.js';
import { config } from '../config.js';
import { generateTurnCredentials } from '../security/cryptoUtils.js';

export class SignalingHandler {
  private roomManager: RoomManager;
  private rateLimiter: InMemoryRateLimiter;

  constructor(roomManager: RoomManager, rateLimiter: InMemoryRateLimiter) {
    this.roomManager = roomManager;
    this.rateLimiter = rateLimiter;
  }

  handleConnection(socket: WebSocket, ip: string) {
    // Check connection rate limit
    if (!this.rateLimiter.isAllowed(ip)) {
      socket.send(
        JSON.stringify({
          type: 'error',
          payload: { message: 'Rate limit exceeded. Please wait a moment.' },
        })
      );
      socket.close(1008, 'Rate limit exceeded');
      return;
    }

    socket.on('message', (data: Buffer | string) => {
      try {
        const message: SignalingMessage = JSON.parse(data.toString());
        this.processMessage(socket, message, ip);
      } catch (err) {
        socket.send(
          JSON.stringify({
            type: 'error',
            payload: { message: 'Malformed JSON signaling message' },
          })
        );
      }
    });

    socket.on('close', () => {
      this.roomManager.leaveRoom(socket);
    });

    socket.on('error', (err) => {
      console.error('[Signaling] WebSocket error:', err.message);
      this.roomManager.leaveRoom(socket);
    });
  }

  private processMessage(socket: WebSocket, msg: SignalingMessage, ip: string) {
    switch (msg.type) {
      case 'ping': {
        socket.send(JSON.stringify({ type: 'pong' }));
        break;
      }

      case 'join_room': {
        const { roomId, participantName, password, e2eePublicKey } = msg.payload || {};
        if (!roomId) {
          socket.send(
            JSON.stringify({
              type: 'error',
              payload: { message: 'Room ID is required' },
            })
          );
          return;
        }

        const result = this.roomManager.joinRoom(
          roomId,
          participantName,
          socket,
          ip,
          password,
          e2eePublicKey
        );

        if (!result.success) {
          socket.send(
            JSON.stringify({
              type: 'error',
              roomId,
              payload: { message: result.error || 'Failed to join room' },
            })
          );
          return;
        }

        if (result.waiting) {
          socket.send(
            JSON.stringify({
              type: 'waiting_for_approval',
              roomId,
              payload: { message: 'Waiting for room host approval' },
            })
          );
          return;
        }

        const room = result.room!;
        const participant = result.participant!;

        // Generate ICE servers (dynamic TURN credentials if turnSecret configured)
        let iceServers = [...config.iceServers];
        if (config.turnSecret && config.turnUrls && config.turnUrls.length > 0) {
          const creds = generateTurnCredentials(participant.id, config.turnSecret);
          iceServers = [
            ...DEFAULT_STUN_SERVERS,
            {
              urls: config.turnUrls,
              username: creds.username,
              credential: creds.credential,
            },
          ];
        }

        // Collect existing participants (excluding self)
        const existingParticipants: Participant[] = [];
        for (const [id, session] of room.participants.entries()) {
          if (id !== participant.id) {
            existingParticipants.push(session.participant);
          }
        }

        // Notify caller that join succeeded
        socket.send(
          JSON.stringify({
            type: 'room_joined',
            roomId,
            payload: {
              roomId,
              participantId: participant.id,
              roomConfig: room.config,
              participants: existingParticipants,
              iceServers,
            },
          })
        );

        // Notify other peers in room about new peer
        this.roomManager.broadcastToRoom(
          roomId,
          {
            type: 'peer_joined',
            roomId,
            senderId: participant.id,
            payload: {
              participant,
              e2eePublicKey,
            },
          },
          participant.id
        );
        break;
      }

      case 'offer':
      case 'answer':
      case 'ice_candidate':
      case 'ice_restart':
      case 'key_exchange':
      case 'sas_verify': {
        const { roomId, targetId } = msg;
        if (!roomId || !targetId) {
          socket.send(
            JSON.stringify({
              type: 'error',
              payload: { message: 'Missing roomId or targetId for relay message' },
            })
          );
          return;
        }

        // Pure relay: Fastify/Signaling does not inspect payload or keys
        this.roomManager.sendToParticipant(roomId, targetId, msg);
        break;
      }

      case 'mute_state': {
        const { roomId, senderId } = msg;
        if (!roomId || !senderId) return;

        const room = this.roomManager.getRoom(roomId);
        if (room) {
          const session = room.participants.get(senderId);
          if (session && msg.payload) {
            session.participant.isAudioMuted = Boolean(msg.payload.isAudioMuted);
            session.participant.isVideoOff = Boolean(msg.payload.isVideoOff);
            session.participant.isScreenSharing = Boolean(msg.payload.isScreenSharing);
          }
        }

        // Broadcast to all other peers in the room
        this.roomManager.broadcastToRoom(roomId, msg, senderId);
        break;
      }

      case 'approve_participant': {
        const { roomId, senderId, payload } = msg;
        if (!roomId || !senderId || !payload?.participantId) return;
        this.roomManager.approveParticipant(roomId, senderId, payload.participantId);
        break;
      }

      case 'reject_participant': {
        const { roomId, senderId, payload } = msg;
        if (!roomId || !senderId || !payload?.participantId) return;
        this.roomManager.rejectParticipant(roomId, senderId, payload.participantId);
        break;
      }

      default:
        console.warn(`[Signaling] Unrecognized message type: ${(msg as any).type}`);
        break;
    }
  }
}

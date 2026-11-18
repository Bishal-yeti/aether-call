import { WebSocket } from 'ws';
import {
  Participant,
  RoomConfig,
  SignalingMessage,
  DEFAULT_STUN_SERVERS,
} from '@aether/shared';
import { hashRoomPassword, generateRoomSalt } from '../security/cryptoUtils.js';

export interface ParticipantSession {
  participant: Participant;
  socket: WebSocket;
  ip: string;
  e2eePublicKey?: string;
  joinedAt: number;
}

export interface InternalRoom {
  config: RoomConfig;
  salt: string;
  passwordHash?: string;
  hostId: string;
  participants: Map<string, ParticipantSession>;
  waitingParticipants: Map<string, ParticipantSession>;
}

export class RoomManager {
  private rooms: Map<string, InternalRoom> = new Map();
  private socketToParticipant: Map<WebSocket, { roomId: string; participantId: string }> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Run cleanup every 60 seconds
    this.cleanupInterval = setInterval(() => this.cleanupExpiredRooms(), 60000);
  }

  getRoom(roomId: string): InternalRoom | undefined {
    return this.rooms.get(roomId);
  }

  createOrGetRoom(
    roomId: string,
    options: {
      name?: string;
      password?: string;
      requiresApproval?: boolean;
      maxParticipants?: number;
      ttlMs?: number;
    } = {}
  ): InternalRoom {
    let room = this.rooms.get(roomId);
    if (!room) {
      const salt = generateRoomSalt();
      const passwordHash = options.password
        ? hashRoomPassword(options.password, salt)
        : undefined;

      const ttl = options.ttlMs || 7200000; // default 2 hours
      const now = Date.now();

      const config: RoomConfig = {
        id: roomId,
        name: options.name || `Room ${roomId.substring(0, 8)}`,
        isLocked: false,
        hasPassword: Boolean(options.password),
        requiresApproval: Boolean(options.requiresApproval),
        createdAt: now,
        expiresAt: now + ttl,
        maxParticipants: options.maxParticipants || 12,
        e2eeEnabled: true,
      };

      room = {
        config,
        salt,
        passwordHash,
        hostId: '',
        participants: new Map(),
        waitingParticipants: new Map(),
      };

      this.rooms.set(roomId, room);
    }
    return room;
  }

  joinRoom(
    roomId: string,
    participantName: string,
    socket: WebSocket,
    ip: string,
    password?: string,
    e2eePublicKey?: string
  ): {
    success: boolean;
    error?: string;
    waiting?: boolean;
    participant?: Participant;
    room?: InternalRoom;
  } {
    const room = this.createOrGetRoom(roomId);

    // Verify room expiration
    if (Date.now() > room.config.expiresAt) {
      return { success: false, error: 'Room has expired' };
    }

    // Verify password if protected
    if (room.passwordHash) {
      if (!password) {
        return { success: false, error: 'Password required' };
      }
      const hashed = hashRoomPassword(password, room.salt);
      if (hashed !== room.passwordHash) {
        return { success: false, error: 'Incorrect room password' };
      }
    }

    // Check capacity
    if (room.participants.size >= room.config.maxParticipants) {
      return { success: false, error: 'Room is full' };
    }

    const participantId = `peer_${Math.random().toString(36).substring(2, 9)}`;
    const isFirst = room.participants.size === 0;

    if (isFirst) {
      room.hostId = participantId;
    }

    const participant: Participant = {
      id: participantId,
      name: participantName || `Guest ${participantId.substring(5)}`,
      isHost: isFirst,
      isAudioMuted: false,
      isVideoOff: false,
      isScreenSharing: false,
      isE2EEVerified: false,
      joinedAt: Date.now(),
    };

    const session: ParticipantSession = {
      participant,
      socket,
      ip,
      e2eePublicKey,
      joinedAt: Date.now(),
    };

    // If room requires host approval and caller is not the host
    if (room.config.requiresApproval && !isFirst) {
      room.waitingParticipants.set(participantId, session);
      this.socketToParticipant.set(socket, { roomId, participantId });

      // Notify host that someone is waiting
      const hostSession = room.participants.get(room.hostId);
      if (hostSession && hostSession.socket.readyState === WebSocket.OPEN) {
        this.send(hostSession.socket, {
          type: 'waiting_for_approval',
          roomId,
          payload: {
            participantId,
            name: participant.name,
          },
        });
      }

      return { success: true, waiting: true, participant, room };
    }

    // Normal join
    room.participants.set(participantId, session);
    this.socketToParticipant.set(socket, { roomId, participantId });

    return { success: true, waiting: false, participant, room };
  }

  approveParticipant(roomId: string, hostId: string, participantId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room || room.hostId !== hostId) return false;

    const session = room.waitingParticipants.get(participantId);
    if (!session) return false;

    room.waitingParticipants.delete(participantId);
    room.participants.set(participantId, session);

    // Notify approved participant
    const existingParticipants: Participant[] = [];
    for (const [pId, pSession] of room.participants.entries()) {
      if (pId !== participantId) {
        existingParticipants.push(pSession.participant);
      }
    }

    this.send(session.socket, {
      type: 'participant_approved',
      roomId,
      payload: {
        roomId,
        participantId,
        roomConfig: room.config,
        participants: existingParticipants,
        iceServers: DEFAULT_STUN_SERVERS,
      },
    });

    // Notify other peers in room about new peer
    this.broadcastToRoom(roomId, {
      type: 'peer_joined',
      roomId,
      payload: {
        participant: session.participant,
        e2eePublicKey: session.e2eePublicKey,
      },
    }, participantId);

    return true;
  }

  rejectParticipant(roomId: string, hostId: string, participantId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room || room.hostId !== hostId) return false;

    const session = room.waitingParticipants.get(participantId);
    if (!session) return false;

    room.waitingParticipants.delete(participantId);
    this.socketToParticipant.delete(session.socket);

    this.send(session.socket, {
      type: 'participant_rejected',
      roomId,
      payload: { reason: 'Admission rejected by host' },
    });

    return true;
  }

  leaveRoom(socket: WebSocket): { roomId?: string; participantId?: string } {
    const mapping = this.socketToParticipant.get(socket);
    if (!mapping) return {};

    const { roomId, participantId } = mapping;
    this.socketToParticipant.delete(socket);

    const room = this.rooms.get(roomId);
    if (!room) return { roomId, participantId };

    room.waitingParticipants.delete(participantId);
    const session = room.participants.get(participantId);
    room.participants.delete(participantId);

    // If host left, elect new host
    if (room.hostId === participantId && room.participants.size > 0) {
      const nextHostId = room.participants.keys().next().value;
      if (nextHostId) {
        room.hostId = nextHostId;
        const nextHost = room.participants.get(nextHostId);
        if (nextHost) {
          nextHost.participant.isHost = true;
        }
      }
    }

    // Broadcast peer_left
    this.broadcastToRoom(roomId, {
      type: 'peer_left',
      roomId,
      senderId: participantId,
      payload: {
        participantId,
        newHostId: room.hostId,
      },
    });

    // If room is empty, schedule early cleanup or remove
    if (room.participants.size === 0 && room.waitingParticipants.size === 0) {
      this.rooms.delete(roomId);
    }

    return { roomId, participantId };
  }

  broadcastToRoom(roomId: string, message: SignalingMessage, excludeParticipantId?: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    for (const [id, session] of room.participants.entries()) {
      if (id !== excludeParticipantId && session.socket.readyState === WebSocket.OPEN) {
        this.send(session.socket, message);
      }
    }
  }

  sendToParticipant(roomId: string, targetId: string, message: SignalingMessage) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const session = room.participants.get(targetId);
    if (session && session.socket.readyState === WebSocket.OPEN) {
      this.send(session.socket, message);
    }
  }

  send(socket: WebSocket, message: SignalingMessage) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }

  private cleanupExpiredRooms() {
    const now = Date.now();
    for (const [id, room] of this.rooms.entries()) {
      if (now > room.config.expiresAt) {
        // Notify participants and close
        this.broadcastToRoom(id, {
          type: 'error',
          roomId: id,
          payload: { message: 'Room has expired' },
        });
        this.rooms.delete(id);
      }
    }
  }

  destroy() {
    clearInterval(this.cleanupInterval);
  }
}

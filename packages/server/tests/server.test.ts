import { describe, it, expect, beforeEach } from 'vitest';
import { RoomManager } from '../src/signaling/RoomManager.js';
import { InMemoryRateLimiter } from '../src/security/rateLimiter.js';
import { hashRoomPassword, generateRoomSalt } from '../src/security/cryptoUtils.js';

describe('RoomManager & Ephemeral Rooms', () => {
  let manager: RoomManager;

  beforeEach(() => {
    manager = new RoomManager();
  });

  it('creates an ephemeral room with default configurations', () => {
    const room = manager.createOrGetRoom('test-room-1', { name: 'Conference A' });
    expect(room.config.id).toBe('test-room-1');
    expect(room.config.name).toBe('Conference A');
    expect(room.config.hasPassword).toBe(false);
    expect(room.config.requiresApproval).toBe(false);
    expect(room.participants.size).toBe(0);
  });

  it('verifies password-protected room security', () => {
    const salt = generateRoomSalt();
    const hash = hashRoomPassword('secret123', salt);
    expect(hashRoomPassword('secret123', salt)).toBe(hash);
    expect(hashRoomPassword('wrongpass', salt)).not.toBe(hash);

    const room = manager.createOrGetRoom('protected-room', { password: 'pass' });
    expect(room.config.hasPassword).toBe(true);

    const mockSocket = { readyState: 1, send: () => {} } as any;

    const failAttempt = manager.joinRoom('protected-room', 'Alice', mockSocket, '127.0.0.1', 'wrong');
    expect(failAttempt.success).toBe(false);
    expect(failAttempt.error).toBe('Incorrect room password');

    const successAttempt = manager.joinRoom('protected-room', 'Alice', mockSocket, '127.0.0.1', 'pass');
    expect(successAttempt.success).toBe(true);
    expect(successAttempt.participant?.name).toBe('Alice');
    expect(successAttempt.participant?.isHost).toBe(true);
  });

  it('handles host approval and waiting room workflows', () => {
    manager.createOrGetRoom('moderated-room', { requiresApproval: true });
    const hostSocket = { readyState: 1, send: () => {} } as any;
    const guestSocket = { readyState: 1, send: () => {} } as any;

    // First person is host
    const hostJoin = manager.joinRoom('moderated-room', 'HostUser', hostSocket, '127.0.0.1');
    expect(hostJoin.success).toBe(true);
    expect(hostJoin.waiting).toBe(false);
    expect(hostJoin.participant?.isHost).toBe(true);

    // Second person is placed in waiting room
    const guestJoin = manager.joinRoom('moderated-room', 'GuestUser', guestSocket, '127.0.0.1');
    expect(guestJoin.success).toBe(true);
    expect(guestJoin.waiting).toBe(true);

    const guestId = guestJoin.participant!.id;
    const hostId = hostJoin.participant!.id;

    // Host approves guest
    const approved = manager.approveParticipant('moderated-room', hostId, guestId);
    expect(approved).toBe(true);

    const updatedRoom = manager.getRoom('moderated-room')!;
    expect(updatedRoom.participants.has(guestId)).toBe(true);
    expect(updatedRoom.waitingParticipants.has(guestId)).toBe(false);
  });
});

describe('InMemoryRateLimiter', () => {
  it('allows requests within threshold and blocks excessive calls', () => {
    const limiter = new InMemoryRateLimiter(3, 1000);
    const ip = '192.168.1.100';

    expect(limiter.isAllowed(ip)).toBe(true);
    expect(limiter.isAllowed(ip)).toBe(true);
    expect(limiter.isAllowed(ip)).toBe(true);
    expect(limiter.isAllowed(ip)).toBe(false); // 4th request blocked
  });
});

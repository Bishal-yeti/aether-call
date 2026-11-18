import fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import websocket from '@fastify/websocket';
import { config } from './config.js';
import { RoomManager } from './signaling/RoomManager.js';
import { SignalingHandler } from './signaling/SignalingHandler.js';
import { InMemoryRateLimiter } from './security/rateLimiter.js';

const app = fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
  },
  trustProxy: true,
});

// Register security headers
await app.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", 'ws:', 'wss:', 'https:'],
      mediaSrc: ["'self'", 'blob:'],
      imgSrc: ["'self'", 'data:', 'blob:'],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
  crossOriginEmbedderPolicy: false,
});

// Register CORS
await app.register(cors, {
  origin: true,
  methods: ['GET', 'POST', 'OPTIONS'],
});

// Register WebSocket support
await app.register(websocket);

// Initialize managers
const rateLimiter = new InMemoryRateLimiter(120, 60000);
const roomManager = new RoomManager();
const signalingHandler = new SignalingHandler(roomManager, rateLimiter);

// Health check endpoint
app.get('/health', async () => {
  return {
    status: 'healthy',
    timestamp: Date.now(),
    uptimeSeconds: Math.floor(process.uptime()),
    platform: 'AetherRTC Privacy-First Calling Engine',
  };
});

// ICE server configuration endpoint
app.get('/api/ice-servers', async () => {
  return {
    iceServers: config.iceServers,
  };
});

// Create Room REST endpoint
app.post<{
  Body: {
    roomId?: string;
    name?: string;
    password?: string;
    requiresApproval?: boolean;
    ttlMinutes?: number;
  };
}>('/api/rooms', async (request, reply) => {
  const { roomId, name, password, requiresApproval, ttlMinutes } = request.body || {};
  const id = roomId || `room_${Math.random().toString(36).substring(2, 10)}`;
  const ttlMs = ttlMinutes ? ttlMinutes * 60 * 1000 : 7200000;

  const room = roomManager.createOrGetRoom(id, {
    name,
    password,
    requiresApproval,
    ttlMs,
  });

  return {
    success: true,
    room: {
      id: room.config.id,
      name: room.config.name,
      hasPassword: room.config.hasPassword,
      requiresApproval: room.config.requiresApproval,
      expiresAt: room.config.expiresAt,
    },
  };
});

// WebSocket Signaling Route
app.get('/ws', { websocket: true }, (socket, req) => {
  const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
  signalingHandler.handleConnection(socket, ip);
});

// Graceful shutdown
const signals = ['SIGINT', 'SIGTERM'] as const;
for (const signal of signals) {
  process.on(signal, async () => {
    app.log.info(`Received ${signal}, shutting down gracefully...`);
    roomManager.destroy();
    await app.close();
    process.exit(0);
  });
}

// Start server
try {
  await app.listen({ port: config.port, host: config.host });
  app.log.info(`AetherRTC Signaling Server running on http://${config.host}:${config.port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

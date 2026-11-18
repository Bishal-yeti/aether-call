import { DEFAULT_STUN_SERVERS } from '@aether/shared';

export interface ServerConfig {
  port: number;
  host: string;
  roomTtlMs: number;
  maxParticipantsPerRoom: number;
  turnSecret?: string;
  turnUrls?: string[];
  iceServers: RTCIceServer[];
}

export const config: ServerConfig = {
  port: parseInt(process.env.PORT || '3001', 10),
  host: process.env.HOST || '0.0.0.0',
  roomTtlMs: parseInt(process.env.ROOM_TTL_MS || '7200000', 10), // 2 hours
  maxParticipantsPerRoom: parseInt(process.env.MAX_PARTICIPANTS || '12', 10),
  turnSecret: process.env.TURN_SECRET,
  turnUrls: process.env.TURN_URLS ? process.env.TURN_URLS.split(',') : undefined,
  iceServers: [
    ...DEFAULT_STUN_SERVERS,
    ...(process.env.TURN_URLS
      ? [{ urls: process.env.TURN_URLS.split(',') }]
      : []),
  ],
};

import crypto from 'node:crypto';

export function hashRoomPassword(password: string, salt: string): string {
  return crypto.createHmac('sha256', salt).update(password).digest('hex');
}

export function generateRoomSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

export function generateTurnCredentials(userId: string, secret: string, ttlSeconds = 86400) {
  const timestamp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const username = `${timestamp}:${userId}`;
  const hmac = crypto.createHmac('sha1', secret);
  hmac.update(username);
  const credential = hmac.digest('base64');
  return { username, credential };
}

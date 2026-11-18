export class InMemoryRateLimiter {
  private requests: Map<string, number[]> = new Map();
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests = 60, windowMs = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;

    // Periodically clean up old entries to prevent memory leak
    setInterval(() => this.cleanup(), 60000);
  }

  isAllowed(ip: string): boolean {
    const now = Date.now();
    const timestamps = this.requests.get(ip) || [];

    // Filter out timestamps older than the window
    const recent = timestamps.filter((t) => now - t < this.windowMs);

    if (recent.length >= this.maxRequests) {
      return false;
    }

    recent.push(now);
    this.requests.set(ip, recent);
    return true;
  }

  private cleanup() {
    const now = Date.now();
    for (const [ip, timestamps] of this.requests.entries()) {
      const active = timestamps.filter((t) => now - t < this.windowMs);
      if (active.length === 0) {
        this.requests.delete(ip);
      } else {
        this.requests.set(ip, active);
      }
    }
  }
}

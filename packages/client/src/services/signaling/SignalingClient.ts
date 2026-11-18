import { SignalingMessage, SignalingMessageType } from '@aether/shared';

export type MessageHandler = (message: SignalingMessage) => void;

export class SignalingClient {
  private socket: WebSocket | null = null;
  private url: string;
  private handlers: Map<string, Set<MessageHandler>> = new Map();
  private reconnectTimer: number | null = null;
  private pingInterval: number | null = null;
  private isIntentionalClose: boolean = false;
  private queuedMessages: string[] = [];

  constructor(customUrl?: string) {
    if (customUrl) {
      this.url = customUrl;
    } else {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      this.url = `${protocol}//${window.location.host}/ws`;
    }
  }

  connect(): Promise<void> {
    this.isIntentionalClose = false;
    return new Promise((resolve, reject) => {
      try {
        this.socket = new WebSocket(this.url);

        this.socket.onopen = () => {
          this.startHeartbeat();
          // Flush any queued messages
          while (this.queuedMessages.length > 0) {
            const msg = this.queuedMessages.shift();
            if (msg && this.socket?.readyState === WebSocket.OPEN) {
              this.socket.send(msg);
            }
          }
          resolve();
        };

        this.socket.onmessage = (event) => {
          try {
            const msg: SignalingMessage = JSON.parse(event.data);
            this.emit(msg.type, msg);
          } catch (err) {
            console.error('[SignalingClient] Failed to parse message:', err);
          }
        };

        this.socket.onerror = (err) => {
          console.warn('[SignalingClient] Socket error');
        };

        this.socket.onclose = () => {
          this.stopHeartbeat();
          if (!this.isIntentionalClose) {
            this.scheduleReconnect();
          }
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  disconnect() {
    this.isIntentionalClose = true;
    this.stopHeartbeat();
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  send(message: SignalingMessage) {
    const data = JSON.stringify(message);
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(data);
    } else {
      this.queuedMessages.push(data);
    }
  }

  on(type: SignalingMessageType | 'open' | 'close', handler: MessageHandler): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);
    return () => this.off(type, handler);
  }

  off(type: string, handler: MessageHandler) {
    const set = this.handlers.get(type);
    if (set) {
      set.delete(handler);
    }
  }

  private emit(type: string, message: SignalingMessage) {
    const set = this.handlers.get(type);
    if (set) {
      for (const handler of set) {
        handler(message);
      }
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.pingInterval = window.setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping' });
      }
    }, 15000);
  }

  private stopHeartbeat() {
    if (this.pingInterval !== null) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer !== null) return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch(() => {});
    }, 2000);
  }
}

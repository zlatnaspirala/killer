/**
 * Abstract Base Class for Network Transports
 */
export class BaseTransport {
  constructor(name, config) {
    this.name = name;
    this.config = config;
    this.listeners = new Map();
    this.connected = false;
    this.pingMs = 0;
    this.bytesSent = 0;
    this.bytesReceived = 0;
    this.packetsSent = 0;
    this.packetsReceived = 0;
  }

  connect() {
    throw new Error('connect() must be implemented by subclass');
  }

  disconnect() {
    throw new Error('disconnect() must be implemented by subclass');
  }

  send(event, payload, options = {}) {
    throw new Error('send() must be implemented by subclass');
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (!this.listeners.has(event)) return;
    const callbacks = this.listeners.get(event).filter(cb => cb !== callback);
    this.listeners.set(event, callbacks);
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(cb => {
        try {
          cb(data);
        } catch (e) {
          console.error(`[Transport:${this.name}] Error handling event '${event}':`, e);
        }
      });
    }
  }

  getStatus() {
    return {
      name: this.name,
      connected: this.connected,
      pingMs: this.pingMs,
      bytesSent: this.bytesSent,
      bytesReceived: this.bytesReceived,
      packetsSent: this.packetsSent,
      packetsReceived: this.packetsReceived
    };
  }
}

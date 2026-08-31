import { BaseTransport } from './BaseTransport.js';

export class WebSocketTransport extends BaseTransport {
  constructor(config) {
    super('WebSocket', config);
    this.socket = null;
    this.pingInterval = null;
  }

  connect() {
    const url = this.config.endpoints.websocket;
    console.log(`[WebSocketTransport] Connecting to ${url}...`);
    this.emit('status', { state: 'connecting', message: `Connecting to ${url}...` });

    try {
      this.socket = new WebSocket(url);
      this.socket.binaryType = 'arraybuffer';

      this.socket.onopen = () => {
        this.connected = true;
        console.log('[WebSocketTransport] Connected successfully');
        this.emit('status', { state: 'connected', message: 'WebSocket Connected' });
        this.startPingLoop();
      };

      this.socket.onmessage = (event) => {
        this.packetsReceived++;
        if (typeof event.data === 'string') {
          this.bytesReceived += event.data.length;
          try {
            const msg = JSON.parse(event.data);
            if (msg.event === 'pong') {
              this.pingMs = Math.round(performance.now() - msg.timestamp);
              this.emit('ping', this.pingMs);
              return;
            }
            this.emit(msg.event, msg.payload);
          } catch (e) {
            console.warn('[WebSocketTransport] Malformed JSON message', e);
          }
        } else if (event.data instanceof ArrayBuffer) {
          this.bytesReceived += event.data.byteLength;
          this.emit('binary', event.data);
        }
      };

      this.socket.onerror = (err) => {
        const errorMsg = err?.message || 'WebSocket connection error';
        console.warn(`[WebSocketTransport] ${errorMsg}`);
        this.emit('status', { state: 'error', message: errorMsg });
      };

      this.socket.onclose = (evt) => {
        this.connected = false;
        this.stopPingLoop();
        console.log('[WebSocketTransport] Connection closed', evt.reason);
        this.emit('status', { state: 'disconnected', message: `Disconnected (${evt.reason || 'Closed'})` });
      };
    } catch (e) {
      this.connected = false;
      this.emit('status', { state: 'error', message: `Failed to create socket: ${e.message}` });
    }
  }

  disconnect() {
    this.stopPingLoop();
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.connected = false;
  }

  send(event, payload, options = {}) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return false;

    if (payload instanceof ArrayBuffer || ArrayBuffer.isView(payload)) {
      const buf = payload instanceof ArrayBuffer ? payload : payload.buffer;
      this.socket.send(buf);
      this.bytesSent += buf.byteLength;
      this.packetsSent++;
      return true;
    }

    const json = JSON.stringify({ event, payload, timestamp: performance.now() });
    this.socket.send(json);
    this.bytesSent += json.length;
    this.packetsSent++;
    return true;
  }

  startPingLoop() {
    this.stopPingLoop();
    this.pingInterval = setInterval(() => {
      if (this.connected) {
        this.send('ping', {}, { timestamp: performance.now() });
      }
    }, 2000);
  }

  stopPingLoop() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
}

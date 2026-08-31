import { NetworkConfig } from '../../network.config.js';
import { WebSocketTransport } from './transports/WebSocketTransport.js';
import { WebRTCPeerTransport } from './transports/WebRTCPeerTransport.js';
import { OpenViduAdapter } from './transports/OpenViduAdapter.js';
import { KurentoAdapter } from './transports/KurentoAdapter.js';
import { GeckosAdapter } from './transports/GeckosAdapter.js';

export class NetworkManager {
  constructor(config = NetworkConfig) {
    this.config = config;
    this.activeTransport = null;
    this.transportName = config.activeTransport || 'webrtc';
    this.mediaServer = config.mediaServer || 'openvidu';
    this.eventListeners = new Map();
    this.peers = new Map();
    this.localPlayerId = 'player_' + Math.random().toString(36).substr(2, 6);
    this.tickTimer = null;
    this.isAutoFallbackEnabled = config.autoFallbackToWebSocket ?? true;

    console.log(`[NetworkManager] Initialized with config: activeTransport=${this.transportName}, mediaServer=${this.mediaServer}`);
  }

  init() {
    this.createTransport(this.transportName);
  }

  createTransport(name) {
    if (this.activeTransport) {
      this.activeTransport.disconnect();
      this.activeTransport = null;
    }

    this.transportName = name;
    console.log(`[NetworkManager] Instantiating Transport: '${name}' (Media Server Mode: '${this.mediaServer}')`);

    switch (name) {
      case 'websocket':
        this.activeTransport = new WebSocketTransport(this.config);
        break;

      case 'webrtc':
        this.activeTransport = new WebRTCPeerTransport(this.config);
        break;

      case 'openvidu':
        this.activeTransport = new OpenViduAdapter(this.config);
        break;

      case 'kurento':
        this.activeTransport = new KurentoAdapter(this.config);
        break;

      case 'geckos':
        this.activeTransport = new GeckosAdapter(this.config);
        break;

      default:
        console.warn(`[NetworkManager] Unknown transport '${name}', falling back to WebSocket`);
        this.activeTransport = new WebSocketTransport(this.config);
        this.transportName = 'websocket';
        break;
    }

    // Bind event forwarding
    this.activeTransport.on('status', (evt) => {
      this.emit('status', { ...evt, transport: this.transportName, mediaServer: this.mediaServer });

      // Handle Auto Fallback if WebRTC/Media Server fails
      if (evt.state === 'error' && name !== 'websocket' && this.isAutoFallbackEnabled) {
        console.warn(`[NetworkManager] Transport '${name}' failed. Auto-falling back to WebSocket...`);
        this.switchTransport('websocket');
      }
    });

    this.activeTransport.on('ping', (pingMs) => this.emit('ping', pingMs));
    this.activeTransport.on('playerTransform', (data) => this.emit('playerTransform', data));
    this.activeTransport.on('playerFire', (data) => this.emit('playerFire', data));
    this.activeTransport.on('worldElevator', (data) => this.emit('worldElevator', data));
    this.activeTransport.on('worldTeleport', (data) => this.emit('worldTeleport', data));
    this.activeTransport.on('binary', (buf) => this.handleBinaryPacket(buf));

    this.activeTransport.connect();
  }

  switchTransport(name) {
    if (this.transportName === name && this.activeTransport?.connected) return;
    console.log(`[NetworkManager] Hot-switching transport to '${name}'...`);
    this.createTransport(name);
  }

  switchMediaServer(serverName) {
    console.log(`[NetworkManager] Switching Media Server backend to '${serverName}'...`);
    this.mediaServer = serverName;
    this.config.mediaServer = serverName;

    // Map media server to appropriate transport
    if (serverName === 'openvidu') {
      this.switchTransport('openvidu');
    } else if (serverName === 'kurento') {
      this.switchTransport('kurento');
    } else if (serverName === 'geckos') {
      this.switchTransport('geckos');
    } else if (serverName === 'mesh') {
      this.switchTransport('webrtc');
    } else {
      this.switchTransport('websocket');
    }
  }

  sendTransform(position, rotation, stateFlags = 0) {
    if (!this.activeTransport || !this.activeTransport.connected) return;

    if (this.config.enableBinaryPackets) {
      // Packed Float32Array: [100 (Type), idHash, px, py, pz, pitch, yaw, stateFlags]
      const buf = new Float32Array(8);
      buf[0] = 100.0; // Event Code 100 = PlayerTransform
      buf[1] = position[0];
      buf[2] = position[1];
      buf[3] = position[2];
      buf[4] = rotation[0];
      buf[5] = rotation[1];
      buf[6] = rotation[2];
      buf[7] = stateFlags;
      this.activeTransport.send('playerTransform', buf.buffer);
    } else {
      this.activeTransport.send('playerTransform', {
        id: this.localPlayerId,
        pos: position,
        rot: rotation,
        flags: stateFlags
      });
    }
  }

  sendFire(origin, direction, weaponType) {
    if (!this.activeTransport) return;
    this.activeTransport.send('playerFire', {
      id: this.localPlayerId,
      origin,
      dir: direction,
      weapon: weaponType,
      t: performance.now()
    });
  }

  sendElevatorState(elevatorId, posY, movingUp) {
    if (!this.activeTransport) return;
    this.activeTransport.send('worldElevator', {
      id: elevatorId,
      y: posY,
      up: movingUp
    });
  }

  sendTeleportEvent(portalId, targetPos) {
    if (!this.activeTransport) return;
    this.activeTransport.send('worldTeleport', {
      portalId,
      target: targetPos,
      playerId: this.localPlayerId
    });
  }

  handleBinaryPacket(buffer) {
    const view = new Float32Array(buffer);
    if (view.length < 8) return;
    const type = view[0];
    if (type === 100.0) { // PlayerTransform
      this.emit('playerTransform', {
        id: 'remote_peer',
        pos: [view[1], view[2], view[3]],
        rot: [view[4], view[5], view[6]],
        flags: view[7]
      });
    }
  }

  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (!this.eventListeners.has(event)) return;
    const callbacks = this.eventListeners.get(event).filter(cb => cb !== callback);
    this.eventListeners.set(event, callbacks);
  }

  emit(event, data) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).forEach(cb => {
        try { cb(data); } catch (e) { console.error(e); }
      });
    }
  }

  getTelemetry() {
    const stats = this.activeTransport ? this.activeTransport.getStatus() : {};
    return {
      activeTransport: this.transportName,
      mediaServer: this.mediaServer,
      connected: this.activeTransport ? this.activeTransport.connected : false,
      pingMs: stats.pingMs || 0,
      bytesSent: stats.bytesSent || 0,
      bytesReceived: stats.bytesReceived || 0,
      packetsSent: stats.packetsSent || 0,
      packetsReceived: stats.packetsReceived || 0,
      autoFallback: this.isAutoFallbackEnabled
    };
  }

  disconnect() {
    if (this.activeTransport) {
      this.activeTransport.disconnect();
    }
  }
}

// Global Singleton instance for engine usage
export const globalNetworkManager = new NetworkManager();
export default globalNetworkManager;

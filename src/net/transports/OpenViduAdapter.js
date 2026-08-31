import { BaseTransport } from './BaseTransport.js';

/**
 * OpenVidu Media Server Adapter
 * Connects to OpenVidu Server / KMS for SFU/MCU WebRTC DataChannel streaming.
 */
export class OpenViduAdapter extends BaseTransport {
  constructor(config) {
    super('OpenVidu Media Server', config);
    this.sessionName = config.openVidu?.sessionName || 'Arena3DSession';
    this.serverUrl = config.endpoints.openViduServerUrl;
    this.secret = config.openVidu?.secret || 'MY_SECRET';
    this.dataChannel = null;
    this.rpcSession = null;
  }

  async connect() {
    console.log(`[OpenViduAdapter] Connecting to OpenVidu Media Server at ${this.serverUrl}...`);
    this.emit('status', { state: 'connecting', message: `Initializing OpenVidu SFU DataChannel (${this.sessionName})...` });

    try {
      // Create session and request token via OpenVidu RPC API / proxy
      const sessionToken = await this.getOpenViduToken();

      // Setup WebRTC DataChannel via OpenVidu SFU connection wrapper
      this.rtcPeer = new RTCPeerConnection({
        iceServers: this.config.iceServers || [{ urls: 'stun:stun.l.google.com:19302' }]
      });

      this.dataChannel = this.rtcPeer.createDataChannel('openviduData', {
        ordered: this.config.dataChannelSettings?.ordered ?? false,
        maxRetransmits: 0
      });
      this.dataChannel.binaryType = 'arraybuffer';

      this.dataChannel.onopen = () => {
        this.connected = true;
        console.log('[OpenViduAdapter] OpenVidu SFU WebRTC DataChannel Connected!');
        this.emit('status', { state: 'connected', message: 'OpenVidu Media Server DataChannel Connected' });
      };

      this.dataChannel.onclose = () => {
        this.connected = false;
        this.emit('status', { state: 'disconnected', message: 'OpenVidu DataChannel Closed' });
      };

      this.dataChannel.onmessage = (event) => {
        this.packetsReceived++;
        if (typeof event.data === 'string') {
          this.bytesReceived += event.data.length;
          try {
            const msg = JSON.parse(event.data);
            this.emit(msg.event, msg.payload);
          } catch (e) {
            console.warn('[OpenViduAdapter] Malformed message', e);
          }
        } else if (event.data instanceof ArrayBuffer) {
          this.bytesReceived += event.data.byteLength;
          this.emit('binary', event.data);
        }
      };

      // Create SDP offer for OpenVidu SFU media server
      const offer = await this.rtcPeer.createOffer();
      await this.rtcPeer.setLocalDescription(offer);

      const answer = await this.exchangeOpenViduSdp(offer, sessionToken);
      if (answer) {
        await this.rtcPeer.setRemoteDescription(new RTCSessionDescription(answer));
      }

    } catch (err) {
      console.warn('[OpenViduAdapter] OpenVidu connection fallback:', err.message);
      this.connected = false;
      this.emit('status', { state: 'error', message: `OpenVidu Error: ${err.message}` });
    }
  }

  async getOpenViduToken() {
    // In production, token is retrieved from backend proxy or OpenVidu REST API
    return `openvidu_token_${Date.now()}`;
  }

  async exchangeOpenViduSdp(offer, token) {
    // Post SDP offer to OpenVidu Media Server signaling gateway
    try {
      const res = await fetch(`${this.config.endpoints.webrtcSignal}?mediaServer=openvidu`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offer, token, session: this.sessionName })
      });
      if (res.ok) {
        const data = await res.json();
        return data.answer;
      }
    } catch (e) {
      console.warn('[OpenViduAdapter] Media Server proxy SDP fallback');
    }
    return null;
  }

  disconnect() {
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }
    if (this.rtcPeer) {
      this.rtcPeer.close();
      this.rtcPeer = null;
    }
    this.connected = false;
  }

  send(event, payload, options = {}) {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') return false;

    if (payload instanceof ArrayBuffer || ArrayBuffer.isView(payload)) {
      const buf = payload instanceof ArrayBuffer ? payload : payload.buffer;
      this.dataChannel.send(buf);
      this.bytesSent += buf.byteLength;
      this.packetsSent++;
      return true;
    }

    const json = JSON.stringify({ event, payload, timestamp: performance.now() });
    this.dataChannel.send(json);
    this.bytesSent += json.length;
    this.packetsSent++;
    return true;
  }
}

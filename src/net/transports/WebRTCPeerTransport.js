import { BaseTransport } from './BaseTransport.js';

export class WebRTCPeerTransport extends BaseTransport {
  constructor(config) {
    super('WebRTC DataChannel', config);
    this.peerConnection = null;
    this.dataChannel = null;
    this.signalingUrl = config.endpoints.webrtcSignal;
    this.peerId = 'peer_' + Math.random().toString(36).substr(2, 6);
  }

  async connect() {
    console.log(`[WebRTCPeerTransport] Initializing WebRTC DataChannel connection...`);
    this.emit('status', { state: 'connecting', message: 'Gathering ICE & Setting up RTCDataChannel...' });

    try {
      const rtcConfig = {
        iceServers: this.config.iceServers || [{ urls: 'stun:stun.l.google.com:19302' }]
      };

      this.peerConnection = new RTCPeerConnection(rtcConfig);

      // Create unordered low-latency DataChannel (UDP semantics)
      const dcOptions = {
        ordered: this.config.dataChannelSettings?.ordered ?? false,
        maxRetransmits: this.config.dataChannelSettings?.maxRetransmits ?? 0
      };

      this.dataChannel = this.peerConnection.createDataChannel('gameData', dcOptions);
      this.dataChannel.binaryType = 'arraybuffer';

      this.setupDataChannelEvents(this.dataChannel);

      // Handle ICE Candidates
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          this.sendSignal({ type: 'candidate', candidate: event.candidate, from: this.peerId });
        }
      };

      this.peerConnection.onconnectionstatechange = () => {
        const state = this.peerConnection.connectionState;
        console.log(`[WebRTCPeerTransport] PeerConnection state: ${state}`);
        if (state === 'connected') {
          this.connected = true;
          this.emit('status', { state: 'connected', message: 'WebRTC P2P Direct DataChannel Connected' });
        } else if (state === 'failed' || state === 'disconnected') {
          this.connected = false;
          this.emit('status', { state: 'disconnected', message: `WebRTC Connection ${state}` });
        }
      };

      // Create Offer
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      // Post offer to signaling server
      const answerResponse = await this.sendSignal({ type: 'offer', offer, from: this.peerId });
      if (answerResponse && answerResponse.answer) {
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answerResponse.answer));
      }

    } catch (e) {
      console.warn('[WebRTCPeerTransport] WebRTC DataChannel setup failed:', e);
      this.connected = false;
      this.emit('status', { state: 'error', message: `WebRTC Error: ${e.message}` });
    }
  }

  setupDataChannelEvents(dc) {
    dc.onopen = () => {
      this.connected = true;
      console.log('[WebRTCPeerTransport] DataChannel Open! Ready for high-frequency UDP state streaming.');
      this.emit('status', { state: 'connected', message: 'WebRTC DataChannel OPEN' });
    };

    dc.onclose = () => {
      this.connected = false;
      console.log('[WebRTCPeerTransport] DataChannel Closed');
      this.emit('status', { state: 'disconnected', message: 'DataChannel Closed' });
    };

    dc.onerror = (err) => {
      console.error('[WebRTCPeerTransport] DataChannel Error:', err);
    };

    dc.onmessage = (event) => {
      this.packetsReceived++;
      if (typeof event.data === 'string') {
        this.bytesReceived += event.data.length;
        try {
          const msg = JSON.parse(event.data);
          this.emit(msg.event, msg.payload);
        } catch (e) {
          console.warn('[WebRTCPeerTransport] Malformed JSON message', e);
        }
      } else if (event.data instanceof ArrayBuffer) {
        this.bytesReceived += event.data.byteLength;
        this.emit('binary', event.data);
      }
    };
  }

  async sendSignal(payload) {
    try {
      const res = await fetch(this.signalingUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('[WebRTCPeerTransport] Signaling request fallback:', err.message);
    }
    return null;
  }

  disconnect() {
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
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

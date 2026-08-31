import { BaseTransport } from './BaseTransport.js';

/**
 * Kurento Media Server (KMS) Adapter
 * Manages Kurento WebRtcEndpoint pipeline data channels via JSON-RPC.
 */
export class KurentoAdapter extends BaseTransport {
  constructor(config) {
    super('Kurento Media Server', config);
    this.serverUrl = config.endpoints.kurentoServerUrl;
    this.ws = null;
    this.rtcPeer = null;
    this.dataChannel = null;
  }

  async connect() {
    console.log(`[KurentoAdapter] Connecting to Kurento Media Server at ${this.serverUrl}...`);
    this.emit('status', { state: 'connecting', message: 'Connecting to Kurento Media Server JSON-RPC...' });

    try {
      this.rtcPeer = new RTCPeerConnection({
        iceServers: this.config.iceServers || [{ urls: 'stun:stun.l.google.com:19302' }]
      });

      this.dataChannel = this.rtcPeer.createDataChannel('kmsData', {
        ordered: this.config.dataChannelSettings?.ordered ?? false,
        maxRetransmits: 0
      });
      this.dataChannel.binaryType = 'arraybuffer';

      this.dataChannel.onopen = () => {
        this.connected = true;
        console.log('[KurentoAdapter] KMS WebRtcEndpoint DataChannel OPEN!');
        this.emit('status', { state: 'connected', message: 'Kurento KMS DataChannel Connected' });
      };

      this.dataChannel.onclose = () => {
        this.connected = false;
        this.emit('status', { state: 'disconnected', message: 'Kurento DataChannel Closed' });
      };

      this.dataChannel.onmessage = (event) => {
        this.packetsReceived++;
        if (typeof event.data === 'string') {
          this.bytesReceived += event.data.length;
          try {
            const msg = JSON.parse(event.data);
            this.emit(msg.event, msg.payload);
          } catch (e) {
            console.warn('[KurentoAdapter] Malformed JSON message', e);
          }
        } else if (event.data instanceof ArrayBuffer) {
          this.bytesReceived += event.data.byteLength;
          this.emit('binary', event.data);
        }
      };

      const offer = await this.rtcPeer.createOffer();
      await this.rtcPeer.setLocalDescription(offer);

      // Post SDP offer to signaling endpoint for Kurento pipeline allocation
      const res = await fetch(`${this.config.endpoints.webrtcSignal}?mediaServer=kurento`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offer, pipeline: this.config.kurento?.pipelineName })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.answer) {
          await this.rtcPeer.setRemoteDescription(new RTCSessionDescription(data.answer));
        }
      }

    } catch (e) {
      console.warn('[KurentoAdapter] Connection warning:', e.message);
      this.connected = false;
      this.emit('status', { state: 'error', message: `Kurento Error: ${e.message}` });
    }
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

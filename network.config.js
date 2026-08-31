/**
 * ============================================================================
 * MAIN NETWORK & MEDIA SERVER CONFIGURATION FILE
 * ============================================================================
 * Central configuration for WebGL & WASM Engine Multiplayer Networking.
 *
 * Supports switching between:
 *  1. Classic WebSockets ('websocket')
 *  2. Direct WebRTC DataChannels ('webrtc')
 *  3. Geckos.io UDP-over-WebRTC ('geckos')
 *  4. OpenVidu Media Server ('openvidu')
 *  5. Kurento Media Server ('kurento')
 *
 * Fully HTML5 & WASM compatible across Web, Desktop, and Mobile.
 */

export const NetworkConfig = {
  // Primary Active Transport Mode: 'websocket' | 'webrtc' | 'geckos' | 'openvidu' | 'kurento'
  activeTransport: 'websocket',

  // Media Server Backend selection: 'openvidu' | 'kurento' | 'geckos' | 'mesh' | 'websocket_server'
  mediaServer: 'openvidu',

  // Auto Fallback: Automatically downgrade to Classic WebSocket if WebRTC / Media Server fails ICE
  autoFallbackToWebSocket: true,

  // Network Endpoints Configuration
  endpoints: {
    // WebSocket signaling & fallback endpoint
    websocket: (typeof window !== 'undefined')
      ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`
      : 'ws://localhost:3000/ws',

    // WebRTC peer signaling endpoint
    webrtcSignal: (typeof window !== 'undefined')
      ? `${window.location.protocol}//${window.location.host}/api/webrtc/signal`
      : 'http://localhost:3000/api/webrtc/signal',

    // OpenVidu Media Server endpoint (OpenVidu Server / KMS)
    openViduServerUrl: 'https://localhost:4443',

    // Kurento Media Server endpoint (JSON-RPC)
    kurentoServerUrl: 'ws://localhost:8888/kurento',

    // Geckos.io server endpoint
    geckosUrl: (typeof window !== 'undefined')
      ? `${window.location.protocol}//${window.location.host}`
      : 'http://localhost:3000'
  },

  // STUN / TURN ICE Servers for NAT Traversal
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' }
  ],

  // DataChannel Options (WebRTC / OpenVidu / Kurento / Geckos)
  dataChannelSettings: {
    ordered: false,          // false = UDP-style unordered for low latency movement
    maxRetransmits: 0,       // 0 = Drop lost packets instead of blocking stream
    binaryType: 'arraybuffer'
  },

  // Network Tick Rates & Telemetry
  snapshotRateHz: 30,        // 30 updates per second (33.3ms per packet)
  interpolationDelayMs: 45,  // Smooth entity interpolation buffer
  enableBinaryPackets: true, // Use binary ArrayBuffers for zero garbage collection

  // Matchmaking & Multiplayer Lobby Flags
  matchmaking: {
    minimumplayers: 2,         // Minimum players required to start match
    maximumplayers: 10,        // Maximum players allowed per match room
    autoStartWhenFull: true,   // Auto start match when room hits max players
    lobbyCountdownSeconds: 5,  // Countdown duration before spawning
    defaultMap: 'q3dm17',      // Default arena map (q3dm17, dm6, dm4, ztn)
    region: 'EU-Central (London)'
  },

  // OpenVidu Media Server Settings
  openVidu: {
    secret: 'MY_SECRET',
    sessionName: 'Arena3DSession',
    publisherProperties: {
      audio: false,
      video: false,
      dataChannels: true
    }
  },

  // Kurento Media Server Settings
  kurento: {
    pipelineName: 'ArenaPipeline',
    endpointType: 'WebRtcEndpoint',
    dataChannelsEnabled: true
  }
};

export default NetworkConfig;

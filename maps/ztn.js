// maps/ztn.js
// Quake Arena Map 4: Blood Run (ZTNDM3)
import { generateStairs } from './utils.js';

export const mapZTN = {
  id: "ztn",
  name: "Blood Run (ZTNDM3 / Dual Tech Halls & Coolant Tunnel)",
  quakeTitle: "ZTNDM3 / Blood Run",
  environment: "Tech Duel Atrium",
  style: "Dual Tech Halls & Coolant Tunnel",
  tag: "ZTN TECH",
  desc: "Huge 2-Room tournament arena featuring South Reactor Atrium and North Teleport Hub connected by a 24m Coolant Tunnel with upper Floor 2 catwalks and open staircases.",
  ambientColor: 0.40,
  floorScale: [64.0, 0.6, 96.0],
  floorColor: [0.18, 0.22, 0.26],
  floorRoughness: 0.70,
  floorMetallic: 0.60,
  groundFloor: { pos: [0, -0.5, 0], scale: [64.0, 0.6, 96.0], color: [0.18, 0.22, 0.26], roughness: 0.70, metallic: 0.60 },
  staticGeometry: [
    // ROOM 1: South Reactor Atrium (Z = +14 to +48)
    { id: 2, name: "South_Reactor_Core", type: "Cooling Tower Monolith", pos: [0.0, 4.0, 30.0], scale: [5.0, 8.0, 5.0], roughness: 0.15, metallic: 0.95, color: [0.08, 0.65, 0.60], collider: "AABB Box (5x8x5m)", layer: "Layer_Obstacle", trigger: false, badge: "Reactor Core", contact: false },
    { id: 3, name: "Floor2_South_Catwalk", type: "Tech Balcony", pos: [0.0, 3.9, 42.0], scale: [60.0, 0.6, 12.0], roughness: 0.20, metallic: 0.95, color: [0.15, 0.45, 0.75], collider: "AABB Box (60x0.6x12m)", layer: "Layer_Obstacle", trigger: false, badge: "South Floor 2", contact: false },
    { id: 4, name: "Floor2_South_Walkway_West", type: "Tech Catwalk", pos: [-20.0, 3.9, 24.0], scale: [5.0, 0.6, 24.0], roughness: 0.20, metallic: 0.95, color: [0.15, 0.45, 0.75], collider: "AABB Box (5x0.6x24m)", layer: "Layer_Obstacle", trigger: false, badge: "West Catwalk", contact: false },
    { id: 5, name: "Floor2_South_Walkway_East", type: "Tech Catwalk", pos: [20.0, 3.9, 24.0], scale: [5.0, 0.6, 24.0], roughness: 0.20, metallic: 0.95, color: [0.15, 0.45, 0.75], collider: "AABB Box (5x0.6x24m)", layer: "Layer_Obstacle", trigger: false, badge: "East Catwalk", contact: false },
    ...generateStairs(40, "South_Tech_Stairs_West", -28.0, 16.0, 36.0, 0.0, 4.2, 12, 4.5, [0.22, 0.28, 0.35]),
    ...generateStairs(60, "South_Tech_Stairs_East", 28.0, 16.0, 36.0, 0.0, 4.2, 12, 4.5, [0.22, 0.28, 0.35]),

    // CONNECTING COOLANT TUNNEL (Z = -12 to +12, X = -10 to +10)
    { id: 10, name: "Tunnel_Tech_Wall_West", type: "Steel Tunnel Wall", pos: [-11.0, 5.0, 0.0], scale: [2.0, 10.0, 24.0], roughness: 0.65, metallic: 0.35, color: [0.18, 0.22, 0.26], collider: "AABB Box (2x10x24m)", layer: "Layer_Obstacle", trigger: false, badge: "Tunnel Wall", contact: false },
    { id: 11, name: "Tunnel_Tech_Wall_East", type: "Steel Tunnel Wall", pos: [11.0, 5.0, 0.0], scale: [2.0, 10.0, 24.0], roughness: 0.65, metallic: 0.35, color: [0.18, 0.22, 0.26], collider: "AABB Box (2x10x24m)", layer: "Layer_Obstacle", trigger: false, badge: "Tunnel Wall", contact: false },
    { id: 12, name: "Floor2_Tunnel_Catwalk_Bridge", type: "Upper Tech Bridge", pos: [0.0, 3.9, 0.0], scale: [8.0, 0.6, 24.0], roughness: 0.30, metallic: 0.80, color: [0.22, 0.30, 0.38], collider: "AABB Box (8x0.6x24m)", layer: "Layer_Obstacle", trigger: false, badge: "Tunnel Bridge", contact: false },

    // ROOM 2: North Teleport Hub (Z = -48 to -14)
    { id: 15, name: "North_Teleport_Arch", type: "Quantum Portal Frame", pos: [0.0, 2.5, -30.0], scale: [1.2, 4.5, 4.0], roughness: 0.10, metallic: 0.95, color: [0.06, 0.85, 0.95], collider: "AABB Box (1.2x4.5x4m)", layer: "Layer_Obstacle", trigger: false, badge: "Teleport Frame", contact: false },
    { id: 16, name: "Floor2_North_Catwalk", type: "Tech Balcony", pos: [0.0, 3.9, -42.0], scale: [60.0, 0.6, 12.0], roughness: 0.20, metallic: 0.95, color: [0.15, 0.45, 0.75], collider: "AABB Box (60x0.6x12m)", layer: "Layer_Obstacle", trigger: false, badge: "North Floor 2", contact: false },
    { id: 17, name: "Floor2_North_Walkway_West", type: "Tech Catwalk", pos: [-20.0, 3.9, -24.0], scale: [5.0, 0.6, 24.0], roughness: 0.20, metallic: 0.95, color: [0.15, 0.45, 0.75], collider: "AABB Box (5x0.6x24m)", layer: "Layer_Obstacle", trigger: false, badge: "West Catwalk", contact: false },
    { id: 18, name: "Floor2_North_Walkway_East", type: "Tech Catwalk", pos: [20.0, 3.9, -24.0], scale: [5.0, 0.6, 24.0], roughness: 0.20, metallic: 0.95, color: [0.15, 0.45, 0.75], collider: "AABB Box (5x0.6x24m)", layer: "Layer_Obstacle", trigger: false, badge: "East Catwalk", contact: false },
    ...generateStairs(80, "North_Tech_Stairs_West", -28.0, -16.0, -36.0, 0.0, 4.2, 12, 4.5, [0.22, 0.28, 0.35]),
    ...generateStairs(100, "North_Tech_Stairs_East", 28.0, -16.0, -36.0, 0.0, 4.2, 12, 4.5, [0.22, 0.28, 0.35]),

    // PERIMETER WALLS & LIGHTING
    { id: 101, name: "South_Reactor_Spheric_Light", type: "Spheric Area Light", isLight: true, lightType: "point", pos: [0.0, 6.0, 30.0], scale: [1.4, 1.4, 1.4], color: [0.08, 0.85, 0.75], intensity: 22.0, radius: 14.0, roughness: 0.1, metallic: 0.9, collider: "Point Light Sphere", layer: "Layer_Light", trigger: false, badge: "Area Light", contact: false },
    { id: 102, name: "North_Portal_Spotlight", type: "Spot Light", isLight: true, lightType: "spot", pos: [0.0, 8.0, -30.0], lightDir: [0.0, -1.0, 0.1], scale: [1.0, 1.5, 1.0], color: [0.5, 0.9, 1.0], intensity: 22.0, spotCutoff: 0.86, outerCutoff: 0.72, roughness: 0.1, metallic: 0.9, collider: "Spot Light Cone", layer: "Layer_Light", trigger: false, badge: "Spot Light", contact: false },
    { id: 103, name: "Coolant_Tunnel_Spheric_Light", type: "Spheric Area Light", isLight: true, lightType: "point", pos: [0.0, 4.5, 0.0], scale: [1.0, 1.0, 1.0], color: [0.2, 0.6, 1.0], intensity: 15.0, radius: 9.0, roughness: 0.1, metallic: 0.9, collider: "Point Light Sphere", layer: "Layer_Light", trigger: false, badge: "Area Light", contact: false },
    { id: 20, name: "Perimeter_Wall_North", type: "Steel Perimeter Wall", pos: [0.0, 6.0, -48.0], scale: [64.0, 12.0, 2.0], roughness: 0.65, metallic: 0.35, color: [0.18, 0.22, 0.26], collider: "AABB Box (64x12x2m)", layer: "Layer_Obstacle", trigger: false, badge: "North Wall", contact: false },
    { id: 21, name: "Perimeter_Wall_South", type: "Steel Perimeter Wall", pos: [0.0, 6.0, 48.0], scale: [64.0, 12.0, 2.0], roughness: 0.65, metallic: 0.35, color: [0.18, 0.22, 0.26], collider: "AABB Box (64x12x2m)", layer: "Layer_Obstacle", trigger: false, badge: "South Wall", contact: false },
    { id: 22, name: "Perimeter_Wall_West", type: "Steel Perimeter Wall", pos: [-32.0, 6.0, 0.0], scale: [2.0, 12.0, 96.0], roughness: 0.65, metallic: 0.35, color: [0.18, 0.22, 0.26], collider: "AABB Box (2x12x96m)", layer: "Layer_Obstacle", trigger: false, badge: "West Wall", contact: false },
    { id: 23, name: "Perimeter_Wall_East", type: "Steel Perimeter Wall", pos: [32.0, 6.0, 0.0], scale: [2.0, 12.0, 96.0], roughness: 0.65, metallic: 0.35, color: [0.18, 0.22, 0.26], collider: "AABB Box (2x12x96m)", layer: "Layer_Obstacle", trigger: false, badge: "East Wall", contact: false }
  ],
  playerSpawns: [
    { id: 1, name: "South Reactor Atrium", type: "FFA Primary", pos: [0.0, 0.0, 20.0], yaw: 0.0, desc: "South reactor floor facing the coolant tunnel." },
    { id: 2, name: "North Teleport Hub", type: "Hub Spawn", pos: [0.0, 0.0, -20.0], yaw: 3.14, desc: "North teleport hub looking south." },
    { id: 3, name: "Upper Tunnel Catwalk", type: "High Balcony", pos: [0.0, 4.2, 0.0], yaw: 0.0, desc: "Floor 2 catwalk bridge inside the coolant tunnel." }
  ],
  itemSpawns: [
    { id: 231, itemKey: "armor_red", name: "Red Heavy Battle Armor (+100 AP)", category: "armor", pos: [0.0, 5.0, 42.0], respawnDelay: 30.0, respawnTimer: 0.0, active: true, color: [0.95, 0.20, 0.30], scale: [0.6, 0.6, 0.6], meshType: 'cube', effect: '+100 Armor (75% Absorb)' },
    { id: 232, itemKey: "megahealth", name: "MegaHealth Sphere (+100 HP)", category: "health", pos: [0.0, 5.0, 0.0], respawnDelay: 60.0, respawnTimer: 0.0, active: true, color: [0.06, 0.92, 0.95], scale: [0.6, 0.6, 0.6], meshType: 'sphere', effect: '+100 HP Overheal' },
    { id: 233, itemKey: "powerup_regen", name: "Regeneration Rune (+15 HP/s)", category: "powerup", pos: [0.0, 1.4, -30.0], respawnDelay: 90.0, respawnTimer: 0.0, active: true, color: [0.15, 0.95, 0.45], scale: [0.7, 0.7, 0.7], meshType: 'gem', effect: '+15 HP/sec Regen (30s)' }
  ]
};

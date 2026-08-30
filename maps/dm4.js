// maps/dm4.js
// Quake Arena Map 1: The Bad Place (DM4)
import { generateStairs } from './utils.js';

export const mapDM4 = {
  id: "dm4",
  name: "The Bad Place (DM4 / Two Vaults & Magma Tunnel)",
  quakeTitle: "Q1DM4 / The Bad Place",
  environment: "Lava Chasm",
  style: "Two Vaults & Magma Tunnel",
  tag: "DM4 LAVA",
  desc: "Huge 2-Room arena featuring South Molten Atrium and North Crypt Vault connected by a 24m Magma Tunnel with upper Floor 2 bridge and open grand staircases.",
  ambientColor: 0.55,
  floorScale: [64.0, 0.6, 96.0],
  floorColor: [0.32, 0.18, 0.15],
  floorRoughness: 0.95,
  floorMetallic: 0.05,
  groundFloor: { pos: [0, -0.5, 0], scale: [64.0, 0.6, 96.0], color: [0.32, 0.18, 0.15], roughness: 0.95, metallic: 0.05 },
  staticGeometry: [
    // ROOM 1: SOUTH MOLTEN ATRIUM (Z = +14 to +48)
    { id: 2, name: "South_Lava_Core_Pit", type: "Molten Lava Core", pos: [0.0, 0.2, 30.0], scale: [12.0, 0.4, 12.0], roughness: 0.05, metallic: 0.95, color: [0.95, 0.30, 0.05], collider: "AABB Box (12x0.4x12m)", layer: "Layer_Obstacle", trigger: false, badge: "Lava Pit", contact: false },
    { id: 3, name: "South_Lava_Basalt_Rim", type: "Basalt Rim", pos: [0.0, 0.5, 30.0], scale: [15.0, 0.6, 15.0], roughness: 0.60, metallic: 0.30, color: [0.25, 0.20, 0.20], collider: "AABB Box (15x0.6x15m)", layer: "Layer_Obstacle", trigger: false, badge: "Lava Rim", contact: false },
    { id: 4, name: "South_Pillar_SW", type: "Volcanic Pillar", pos: [-10.0, 4.5, 28.0], scale: [2.5, 9.0, 2.5], roughness: 0.50, metallic: 0.40, color: [0.35, 0.20, 0.18], collider: "AABB Box (2.5x9x2.5m)", layer: "Layer_Obstacle", trigger: false, badge: "Volcanic Pillar", contact: false },
    { id: 5, name: "South_Pillar_SE", type: "Volcanic Pillar", pos: [10.0, 4.5, 28.0], scale: [2.5, 9.0, 2.5], roughness: 0.50, metallic: 0.40, color: [0.35, 0.20, 0.18], collider: "AABB Box (2.5x9x2.5m)", layer: "Layer_Obstacle", trigger: false, badge: "Volcanic Pillar", contact: false },

    // FLOOR 2: South Balcony & Mezzanine (at Y=4.2, Z from +36 to +48)
    { id: 6, name: "Floor2_South_Balcony", type: "Mezzanine Floor", pos: [0.0, 3.9, 42.0], scale: [60.0, 0.6, 12.0], roughness: 0.40, metallic: 0.60, color: [0.45, 0.25, 0.20], collider: "AABB Box (60x0.6x12m)", layer: "Layer_Obstacle", trigger: false, badge: "South Floor 2", contact: false },
    { id: 7, name: "Floor2_South_Walkway_West", type: "Catwalk Platform", pos: [-20.0, 3.9, 24.0], scale: [5.0, 0.6, 24.0], roughness: 0.40, metallic: 0.60, color: [0.45, 0.25, 0.20], collider: "AABB Box (5x0.6x24m)", layer: "Layer_Obstacle", trigger: false, badge: "West Catwalk", contact: false },
    { id: 8, name: "Floor2_South_Walkway_East", type: "Catwalk Platform", pos: [20.0, 3.9, 24.0], scale: [5.0, 0.6, 24.0], roughness: 0.40, metallic: 0.60, color: [0.45, 0.25, 0.20], collider: "AABB Box (5x0.6x24m)", layer: "Layer_Obstacle", trigger: false, badge: "East Catwalk", contact: false },

    // REAL STAIRS TO SOUTH FLOOR 2
    ...generateStairs(40, "South_West_Stairs", -28.0, 16.0, 36.0, 0.0, 4.2, 12, 4.5, [0.38, 0.28, 0.25]),
    ...generateStairs(60, "South_East_Stairs", 28.0, 16.0, 36.0, 0.0, 4.2, 12, 4.5, [0.38, 0.28, 0.25]),

    // CONNECTING TUNNEL (Z = -12 to +12, X = -10 to +10)
    { id: 10, name: "Tunnel_West_Wall", type: "Tunnel Rock Wall", pos: [-11.0, 5.0, 0.0], scale: [2.0, 10.0, 24.0], roughness: 0.70, metallic: 0.15, color: [0.28, 0.16, 0.14], collider: "AABB Box (2x10x24m)", layer: "Layer_Obstacle", trigger: false, badge: "Tunnel Wall", contact: false },
    { id: 11, name: "Tunnel_East_Wall", type: "Tunnel Rock Wall", pos: [11.0, 5.0, 0.0], scale: [2.0, 10.0, 24.0], roughness: 0.70, metallic: 0.15, color: [0.28, 0.16, 0.14], collider: "AABB Box (2x10x24m)", layer: "Layer_Obstacle", trigger: false, badge: "Tunnel Wall", contact: false },
    { id: 12, name: "Tunnel_Arch_South", type: "Tunnel Archway", pos: [0.0, 7.5, 12.0], scale: [22.0, 3.0, 2.0], roughness: 0.50, metallic: 0.30, color: [0.35, 0.20, 0.18], collider: "AABB Box (22x3x2m)", layer: "Layer_Obstacle", trigger: false, badge: "Tunnel Arch", contact: false },
    { id: 13, name: "Tunnel_Arch_North", type: "Tunnel Archway", pos: [0.0, 7.5, -12.0], scale: [22.0, 3.0, 2.0], roughness: 0.50, metallic: 0.30, color: [0.35, 0.20, 0.18], collider: "AABB Box (22x3x2m)", layer: "Layer_Obstacle", trigger: false, badge: "Tunnel Arch", contact: false },

    // UPPER FLOOR 2 TUNNEL BRIDGE
    { id: 14, name: "Floor2_Tunnel_Bridge", type: "Upper Bridge Corridor", pos: [0.0, 3.9, 0.0], scale: [8.0, 0.6, 24.0], roughness: 0.40, metallic: 0.60, color: [0.45, 0.25, 0.20], collider: "AABB Box (8x0.6x24m)", layer: "Layer_Obstacle", trigger: false, badge: "Tunnel Bridge", contact: false },

    // ROOM 2: NORTH CRYPT VAULT (Z = -48 to -14)
    { id: 16, name: "North_Crypt_Altar", type: "Stone Crypt Altar", pos: [0.0, 0.5, -30.0], scale: [10.0, 0.8, 10.0], roughness: 0.30, metallic: 0.70, color: [0.40, 0.22, 0.20], collider: "AABB Box (10x0.8x10m)", layer: "Layer_Obstacle", trigger: false, badge: "Crypt Altar", contact: false },
    { id: 17, name: "North_Monolith_Pillar", type: "Crypt Monolith", pos: [0.0, 4.5, -30.0], scale: [2.0, 7.0, 2.0], roughness: 0.20, metallic: 0.95, color: [0.85, 0.35, 0.20], collider: "AABB Box (2x7x2m)", layer: "Layer_Obstacle", trigger: false, badge: "Crypt Monolith", contact: false },
    { id: 18, name: "North_Pillar_NW", type: "Volcanic Pillar", pos: [-10.0, 4.5, -28.0], scale: [2.5, 9.0, 2.5], roughness: 0.50, metallic: 0.40, color: [0.35, 0.20, 0.18], collider: "AABB Box (2.5x9x2.5m)", layer: "Layer_Obstacle", trigger: false, badge: "Volcanic Pillar", contact: false },
    { id: 19, name: "North_Pillar_NE", type: "Volcanic Pillar", pos: [10.0, 4.5, -28.0], scale: [2.5, 9.0, 2.5], roughness: 0.50, metallic: 0.40, color: [0.35, 0.20, 0.18], collider: "AABB Box (2.5x9x2.5m)", layer: "Layer_Obstacle", trigger: false, badge: "Volcanic Pillar", contact: false },

    // FLOOR 2: North Balcony & Mezzanine (at Y=4.2, Z from -48 to -36)
    { id: 20, name: "Floor2_North_Balcony", type: "Mezzanine Floor", pos: [0.0, 3.9, -42.0], scale: [60.0, 0.6, 12.0], roughness: 0.40, metallic: 0.60, color: [0.45, 0.25, 0.20], collider: "AABB Box (60x0.6x12m)", layer: "Layer_Obstacle", trigger: false, badge: "North Floor 2", contact: false },
    { id: 21, name: "Floor2_North_Walkway_West", type: "Catwalk Platform", pos: [-20.0, 3.9, -24.0], scale: [5.0, 0.6, 24.0], roughness: 0.40, metallic: 0.60, color: [0.45, 0.25, 0.20], collider: "AABB Box (5x0.6x24m)", layer: "Layer_Obstacle", trigger: false, badge: "West Catwalk", contact: false },
    { id: 22, name: "Floor2_North_Walkway_East", type: "Catwalk Platform", pos: [20.0, 3.9, -24.0], scale: [5.0, 0.6, 24.0], roughness: 0.40, metallic: 0.60, color: [0.45, 0.25, 0.20], collider: "AABB Box (5x0.6x24m)", layer: "Layer_Obstacle", trigger: false, badge: "East Catwalk", contact: false },

    // REAL STAIRS TO NORTH FLOOR 2
    ...generateStairs(80, "North_West_Stairs", -28.0, -16.0, -36.0, 0.0, 4.2, 12, 4.5, [0.38, 0.28, 0.25]),
    ...generateStairs(100, "North_East_Stairs", 28.0, -16.0, -36.0, 0.0, 4.2, 12, 4.5, [0.38, 0.28, 0.25]),

    // LIGHT ENTITIES & PERIMETER WALLS
    { id: 101, name: "South_Lava_Light_Spheric", type: "Spheric Area Light", isLight: true, lightType: "point", pos: [0.0, 5.5, 30.0], scale: [1.2, 1.2, 1.2], color: [1.0, 0.45, 0.1], intensity: 18.0, radius: 14.0, roughness: 0.1, metallic: 0.9, collider: "Point Light Sphere", layer: "Layer_Light", trigger: false, badge: "Area Light", contact: false },
    { id: 102, name: "North_Crypt_Spotlight", type: "Spot Light", isLight: true, lightType: "spot", pos: [0.0, 8.5, -30.0], lightDir: [0.0, -1.0, 0.1], scale: [1.0, 1.5, 1.0], color: [0.2, 0.85, 1.0], intensity: 22.0, spotCutoff: 0.85, outerCutoff: 0.70, roughness: 0.1, metallic: 0.9, collider: "Spot Light Cone", layer: "Layer_Light", trigger: false, badge: "Spot Light", contact: false },
    { id: 103, name: "Magma_Tunnel_Light", type: "Spheric Area Light", isLight: true, lightType: "point", pos: [0.0, 4.5, 0.0], scale: [1.0, 1.0, 1.0], color: [1.0, 0.65, 0.25], intensity: 14.0, radius: 10.0, roughness: 0.1, metallic: 0.9, collider: "Point Light Sphere", layer: "Layer_Light", trigger: false, badge: "Area Light", contact: false },
    { id: 25, name: "Perimeter_Wall_North", type: "Volcanic Wall", pos: [0.0, 6.0, -48.0], scale: [64.0, 12.0, 2.0], roughness: 0.70, metallic: 0.15, color: [0.28, 0.16, 0.14], collider: "AABB Box (64x12x2m)", layer: "Layer_Obstacle", trigger: false, badge: "North Wall", contact: false },
    { id: 26, name: "Perimeter_Wall_South", type: "Volcanic Wall", pos: [0.0, 6.0, 48.0], scale: [64.0, 12.0, 2.0], roughness: 0.70, metallic: 0.15, color: [0.28, 0.16, 0.14], collider: "AABB Box (64x12x2m)", layer: "Layer_Obstacle", trigger: false, badge: "South Wall", contact: false },
    { id: 27, name: "Perimeter_Wall_West", type: "Volcanic Wall", pos: [-32.0, 6.0, 0.0], scale: [2.0, 12.0, 96.0], roughness: 0.70, metallic: 0.15, color: [0.28, 0.16, 0.14], collider: "AABB Box (2x12x96m)", layer: "Layer_Obstacle", trigger: false, badge: "West Wall", contact: false },
    { id: 28, name: "Perimeter_Wall_East", type: "Volcanic Wall", pos: [32.0, 6.0, 0.0], scale: [2.0, 12.0, 96.0], roughness: 0.70, metallic: 0.15, color: [0.28, 0.16, 0.14], collider: "AABB Box (2x12x96m)", layer: "Layer_Obstacle", trigger: false, badge: "East Wall", contact: false }
  ],
  teleporters: [
    { id: 1, name: "South Molten Portal", pos: [0.0, 0.5, 30.0], targetPos: [0.0, 4.2, -42.0], radius: 1.8, color: [1.0, 0.45, 0.1], label: "Warp -> North Floor 2" },
    { id: 2, name: "North Crypt Portal", pos: [0.0, 0.5, -30.0], targetPos: [0.0, 4.2, 42.0], radius: 1.8, color: [0.95, 0.25, 0.25], label: "Warp -> South Floor 2" }
  ],
  elevators: [
    { id: 1, name: "Magma Tunnel Industrial Lift", pos: [0.0, 0.4, 0.0], startY: 0.4, endY: 4.2, scale: [4.0, 0.4, 4.0], speed: 3.0, color: [0.45, 0.28, 0.22], label: "Tunnel Magma Lift" }
  ],
  playerSpawns: [
    { id: 1, name: "South Molten Atrium", type: "FFA Primary", pos: [0.0, 0.0, 20.0], yaw: 0.0, desc: "South lava room looking towards the connecting magma tunnel." },
    { id: 2, name: "North Crypt Vault", type: "Vault Spawn", pos: [0.0, 0.0, -20.0], yaw: 3.14, desc: "North crypt chamber near the high altar." },
    { id: 3, name: "South Floor 2 Balcony", type: "High Mezzanine", pos: [0.0, 4.2, 42.0], yaw: 3.14, desc: "Upper Floor 2 balcony overlooking the southern lava core." },
    { id: 4, name: "North Floor 2 Balcony", type: "High Mezzanine", pos: [0.0, 4.2, -42.0], yaw: 0.0, desc: "Upper Floor 2 balcony overlooking the northern crypt." },
    { id: 5, name: "Upper Tunnel Bridge", type: "High Bridge", pos: [0.0, 4.2, 0.0], yaw: 0.0, desc: "Floor 2 connecting bridge suspended over the magma tunnel." }
  ],
  itemSpawns: [
    { id: 221, itemKey: "megahealth", name: "MegaHealth Sphere (+100 HP)", category: "health", pos: [0.0, 5.0, 0.0], respawnDelay: 60.0, respawnTimer: 0.0, active: true, color: [0.06, 0.92, 0.95], scale: [0.6, 0.6, 0.6], meshType: 'sphere', effect: '+100 HP Overheal' },
    { id: 222, itemKey: "armor_red", name: "Red Heavy Battle Armor (+100 AP)", category: "armor", pos: [0.0, 5.0, -42.0], respawnDelay: 30.0, respawnTimer: 0.0, active: true, color: [0.95, 0.20, 0.30], scale: [0.6, 0.6, 0.6], meshType: 'cube', effect: '+100 Armor (75% Absorb)' },
    { id: 223, itemKey: "powerup_haste", name: "Haste Speed Rune (+60% Speed)", category: "powerup", pos: [0.0, 1.4, 30.0], respawnDelay: 90.0, respawnTimer: 0.0, active: true, color: [0.95, 0.85, 0.15], scale: [0.7, 0.7, 0.7], meshType: 'gem', effect: '+60% Movement & Sprint (25s)' },
    { id: 224, itemKey: "ammo_rockets", name: "High-Explosive Rocket Shells (+10)", category: "ammo", pos: [-16.0, 0.8, -30.0], respawnDelay: 25.0, respawnTimer: 0.0, active: true, color: [0.95, 0.45, 0.10], scale: [0.5, 0.5, 0.5], meshType: 'cube', effect: '+10 HE Rockets' },
    { id: 225, itemKey: "ammo_plasma", name: "Plasma Energy Cells (+50)", category: "ammo", pos: [16.0, 0.8, 30.0], respawnDelay: 20.0, respawnTimer: 0.0, active: true, color: [0.06, 0.85, 0.95], scale: [0.45, 0.45, 0.45], meshType: 'cube', effect: '+50 Energy Cells' },
    { id: 226, itemKey: "health_medium", name: "Medium Health Pack (+25 HP)", category: "health", pos: [0.0, 0.8, 0.0], respawnDelay: 20.0, respawnTimer: 0.0, active: true, color: [0.10, 0.85, 0.40], scale: [0.45, 0.45, 0.45], meshType: 'sphere', effect: '+25 HP' }
  ]
};

// maps/dm6.js
// Quake Arena Map 2: The Dark Zone (DM6)
import { generateStairs } from './utils.js';

export const mapDM6 = {
  id: "dm6",
  name: "The Dark Zone (DM6 / Twin Cathedrals & Crypt Tunnel)",
  quakeTitle: "Q1DM6 / The Dark Zone",
  environment: "Gothic Spire",
  style: "Twin Cathedrals & Crypt Tunnel",
  tag: "DM6 ARENA",
  desc: "Sprawling 2-Room Gothic arena with South Quad Cathedral and North Teleport Sanctuary connected by a 24m Crypt Tunnel, upper Floor 2 catwalks, and open grand stairs.",
  ambientColor: 0.45,
  floorScale: [64.0, 0.6, 96.0],
  floorColor: [0.22, 0.24, 0.28],
  floorRoughness: 0.85,
  floorMetallic: 0.15,
  groundFloor: { pos: [0, -0.5, 0], scale: [64.0, 0.6, 96.0], color: [0.22, 0.24, 0.28], roughness: 0.85, metallic: 0.15 },
  staticGeometry: [
    // ROOM 1: SOUTH QUAD CATHEDRAL (Z = +14 to +48)
    { id: 2, name: "South_Quad_Pedestal", type: "Gothic Dais", pos: [0.0, 0.4, 30.0], scale: [8.0, 0.8, 8.0], roughness: 0.30, metallic: 0.75, color: [0.35, 0.38, 0.45], collider: "AABB Box (8x0.8x8m)", layer: "Layer_Obstacle", trigger: false, badge: "Quad Dais", contact: false },
    { id: 3, name: "South_Quad_Monolith", type: "Gothic Monolith", pos: [0.0, 4.5, 30.0], scale: [2.0, 7.5, 2.0], roughness: 0.20, metallic: 0.95, color: [0.85, 0.35, 0.20], collider: "AABB Box (2x7.5x2m)", layer: "Layer_Obstacle", trigger: false, badge: "Spire Monolith", contact: false },
    { id: 4, name: "South_Pillar_NW", type: "Fluted Stone Pillar", pos: [-10.0, 4.5, 20.0], scale: [2.5, 9.0, 2.5], roughness: 0.45, metallic: 0.55, color: [0.42, 0.40, 0.38], collider: "AABB Box (2.5x9x2.5m)", layer: "Layer_Obstacle", trigger: false, badge: "Gothic Pillar", contact: false },
    { id: 5, name: "South_Pillar_NE", type: "Fluted Stone Pillar", pos: [10.0, 4.5, 20.0], scale: [2.5, 9.0, 2.5], roughness: 0.45, metallic: 0.55, color: [0.42, 0.40, 0.38], collider: "AABB Box (2.5x9x2.5m)", layer: "Layer_Obstacle", trigger: false, badge: "Gothic Pillar", contact: false },

    // FLOOR 2: South Catwalk Balcony (at Y=4.2, Z from +36 to +48)
    { id: 6, name: "Floor2_South_Balcony", type: "Catwalk Platform", pos: [0.0, 3.9, 42.0], scale: [60.0, 0.6, 12.0], roughness: 0.35, metallic: 0.85, color: [0.28, 0.32, 0.38], collider: "AABB Box (60x0.6x12m)", layer: "Layer_Obstacle", trigger: false, badge: "South Floor 2", contact: false },
    { id: 7, name: "Floor2_South_Walkway_West", type: "Catwalk Platform", pos: [-20.0, 3.9, 24.0], scale: [5.0, 0.6, 24.0], roughness: 0.35, metallic: 0.85, color: [0.28, 0.32, 0.38], collider: "AABB Box (5x0.6x24m)", layer: "Layer_Obstacle", trigger: false, badge: "West Catwalk", contact: false },
    { id: 8, name: "Floor2_South_Walkway_East", type: "Catwalk Platform", pos: [20.0, 3.9, 24.0], scale: [5.0, 0.6, 24.0], roughness: 0.35, metallic: 0.85, color: [0.28, 0.32, 0.38], collider: "AABB Box (5x0.6x24m)", layer: "Layer_Obstacle", trigger: false, badge: "East Catwalk", contact: false },

    // REAL STAIRS TO SOUTH FLOOR 2
    ...generateStairs(40, "South_West_Stairs", -28.0, 16.0, 36.0, 0.0, 4.2, 12, 4.5, [0.32, 0.35, 0.40]),
    ...generateStairs(60, "South_East_Stairs", 28.0, 16.0, 36.0, 0.0, 4.2, 12, 4.5, [0.32, 0.35, 0.40]),

    // CONNECTING CRYPT TUNNEL (Z = -12 to +12, X = -10 to +10)
    { id: 10, name: "Tunnel_Gothic_Wall_West", type: "Gothic Stone Wall", pos: [-11.0, 5.0, 0.0], scale: [2.0, 10.0, 24.0], roughness: 0.65, metallic: 0.25, color: [0.25, 0.26, 0.30], collider: "AABB Box (2x10x24m)", layer: "Layer_Obstacle", trigger: false, badge: "Crypt Tunnel Wall", contact: false },
    { id: 11, name: "Tunnel_Gothic_Wall_East", type: "Gothic Stone Wall", pos: [11.0, 5.0, 0.0], scale: [2.0, 10.0, 24.0], roughness: 0.65, metallic: 0.25, color: [0.25, 0.26, 0.30], collider: "AABB Box (2x10x24m)", layer: "Layer_Obstacle", trigger: false, badge: "Crypt Tunnel Wall", contact: false },
    { id: 12, name: "Tunnel_Arch_South", type: "Gothic Arch", pos: [0.0, 7.5, 12.0], scale: [22.0, 3.0, 2.0], roughness: 0.45, metallic: 0.55, color: [0.42, 0.40, 0.38], collider: "AABB Box (22x3x2m)", layer: "Layer_Obstacle", trigger: false, badge: "Gothic Arch", contact: false },
    { id: 13, name: "Tunnel_Arch_North", type: "Gothic Arch", pos: [0.0, 7.5, -12.0], scale: [22.0, 3.0, 2.0], roughness: 0.45, metallic: 0.55, color: [0.42, 0.40, 0.38], collider: "AABB Box (22x3x2m)", layer: "Layer_Obstacle", trigger: false, badge: "Gothic Arch", contact: false },

    // UPPER FLOOR 2 TUNNEL BRIDGE
    { id: 14, name: "Floor2_Tunnel_Bridge", type: "Catwalk Platform", pos: [0.0, 3.9, 0.0], scale: [8.0, 0.6, 24.0], roughness: 0.35, metallic: 0.85, color: [0.28, 0.32, 0.38], collider: "AABB Box (8x0.6x24m)", layer: "Layer_Obstacle", trigger: false, badge: "Tunnel Bridge", contact: false },

    // ROOM 2: NORTH TELEPORT SANCTUARY (Z = -48 to -14)
    { id: 16, name: "North_Teleport_Portal_West", type: "Energy Teleport Portal", pos: [-10.0, 2.2, -30.0], scale: [1.0, 4.5, 4.0], roughness: 0.10, metallic: 0.95, color: [0.10, 0.75, 0.95], collider: "AABB Box (1x4.5x4m)", layer: "Layer_Obstacle", trigger: false, badge: "Teleport Portal", contact: false },
    { id: 17, name: "North_Teleport_Portal_East", type: "Energy Teleport Portal", pos: [10.0, 2.2, -30.0], scale: [1.0, 4.5, 4.0], roughness: 0.10, metallic: 0.95, color: [0.10, 0.75, 0.95], collider: "AABB Box (1x4.5x4m)", layer: "Layer_Obstacle", trigger: false, badge: "Teleport Portal", contact: false },
    { id: 18, name: "North_Mega_Dais", type: "Gothic Dais", pos: [0.0, 0.4, -30.0], scale: [8.0, 0.8, 8.0], roughness: 0.30, metallic: 0.75, color: [0.35, 0.38, 0.45], collider: "AABB Box (8x0.8x8m)", layer: "Layer_Obstacle", trigger: false, badge: "Mega Dais", contact: false },

    // FLOOR 2: North Balcony (at Y=4.2, Z from -48 to -36)
    { id: 20, name: "Floor2_North_Balcony", type: "Catwalk Platform", pos: [0.0, 3.9, -42.0], scale: [60.0, 0.6, 12.0], roughness: 0.35, metallic: 0.85, color: [0.28, 0.32, 0.38], collider: "AABB Box (60x0.6x12m)", layer: "Layer_Obstacle", trigger: false, badge: "North Floor 2", contact: false },
    { id: 21, name: "Floor2_North_Walkway_West", type: "Catwalk Platform", pos: [-20.0, 3.9, -24.0], scale: [5.0, 0.6, 24.0], roughness: 0.35, metallic: 0.85, color: [0.28, 0.32, 0.38], collider: "AABB Box (5x0.6x24m)", layer: "Layer_Obstacle", trigger: false, badge: "West Catwalk", contact: false },
    { id: 22, name: "Floor2_North_Walkway_East", type: "Catwalk Platform", pos: [20.0, 3.9, -24.0], scale: [5.0, 0.6, 24.0], roughness: 0.35, metallic: 0.85, color: [0.28, 0.32, 0.38], collider: "AABB Box (5x0.6x24m)", layer: "Layer_Obstacle", trigger: false, badge: "East Catwalk", contact: false },

    // REAL STAIRS TO NORTH FLOOR 2
    ...generateStairs(80, "North_West_Stairs", -28.0, -16.0, -36.0, 0.0, 4.2, 12, 4.5, [0.32, 0.35, 0.40]),
    ...generateStairs(100, "North_East_Stairs", 28.0, -16.0, -36.0, 0.0, 4.2, 12, 4.5, [0.32, 0.35, 0.40]),

    // ARENA LIGHT ENTITIES & PERIMETER WALLS
    { id: 101, name: "Quad_Cathedral_Spotlight", type: "Spot Light", isLight: true, lightType: "spot", pos: [0.0, 9.0, 30.0], lightDir: [0.0, -1.0, 0.0], scale: [1.2, 1.6, 1.2], color: [1.0, 0.85, 0.25], intensity: 25.0, spotCutoff: 0.88, outerCutoff: 0.72, roughness: 0.1, metallic: 0.9, collider: "Spot Light Cone", layer: "Layer_Light", trigger: false, badge: "Spot Light", contact: false },
    { id: 102, name: "North_Sanctuary_Spheric_Light", type: "Spheric Area Light", isLight: true, lightType: "point", pos: [0.0, 5.5, -30.0], scale: [1.2, 1.2, 1.2], color: [0.1, 0.75, 1.0], intensity: 18.0, radius: 12.0, roughness: 0.1, metallic: 0.9, collider: "Point Light Sphere", layer: "Layer_Light", trigger: false, badge: "Area Light", contact: false },
    { id: 103, name: "Crypt_Tunnel_Spotlight", type: "Spot Light", isLight: true, lightType: "spot", pos: [0.0, 6.0, 0.0], lightDir: [0.0, -1.0, 0.2], scale: [1.0, 1.4, 1.0], color: [0.2, 1.0, 0.45], intensity: 16.0, spotCutoff: 0.82, outerCutoff: 0.65, roughness: 0.1, metallic: 0.9, collider: "Spot Light Cone", layer: "Layer_Light", trigger: false, badge: "Spot Light", contact: false },
    { id: 25, name: "Perimeter_Wall_North", type: "Fortified Castle Wall", pos: [0.0, 6.0, -48.0], scale: [64.0, 12.0, 2.0], roughness: 0.70, metallic: 0.20, color: [0.25, 0.26, 0.30], collider: "AABB Box (64x12x2m)", layer: "Layer_Obstacle", trigger: false, badge: "North Wall", contact: false },
    { id: 26, name: "Perimeter_Wall_South", type: "Fortified Castle Wall", pos: [0.0, 6.0, 48.0], scale: [64.0, 12.0, 2.0], roughness: 0.70, metallic: 0.20, color: [0.25, 0.26, 0.30], collider: "AABB Box (64x12x2m)", layer: "Layer_Obstacle", trigger: false, badge: "South Wall", contact: false },
    { id: 27, name: "Perimeter_Wall_West", type: "Fortified Castle Wall", pos: [-32.0, 6.0, 0.0], scale: [2.0, 12.0, 96.0], roughness: 0.70, metallic: 0.20, color: [0.25, 0.26, 0.30], collider: "AABB Box (2x12x96m)", layer: "Layer_Obstacle", trigger: false, badge: "West Wall", contact: false },
    { id: 28, name: "Perimeter_Wall_East", type: "Fortified Castle Wall", pos: [32.0, 6.0, 0.0], scale: [2.0, 12.0, 96.0], roughness: 0.70, metallic: 0.20, color: [0.25, 0.26, 0.30], collider: "AABB Box (2x12x96m)", layer: "Layer_Obstacle", trigger: false, badge: "East Wall", contact: false }
  ],
  teleporters: [
    { id: 1, name: "Sanctuary West Portal", pos: [-10.0, 0.4, -30.0], targetPos: [0.0, 4.2, 42.0], radius: 1.8, color: [0.1, 0.85, 1.0], label: "Warp -> South Floor 2" },
    { id: 2, name: "Sanctuary East Portal", pos: [10.0, 0.4, -30.0], targetPos: [0.0, 4.2, 0.0], radius: 1.8, color: [0.2, 0.95, 0.5], label: "Warp -> Tunnel Bridge" }
  ],
  elevators: [
    { id: 1, name: "Quad Cathedral Hydraulic Lift", pos: [0.0, 0.4, 30.0], startY: 0.4, endY: 4.2, scale: [4.5, 0.4, 4.5], speed: 3.2, color: [0.35, 0.38, 0.52], label: "Cathedral Hydraulic Lift" }
  ],
  playerSpawns: [
    { id: 1, name: "South Quad Cathedral", type: "FFA Primary", pos: [0.0, 0.0, 20.0], yaw: 0.0, desc: "South cathedral hall facing the central crypt tunnel." },
    { id: 2, name: "North Teleport Sanctuary", type: "High Perch", pos: [0.0, 0.0, -20.0], yaw: 3.14, desc: "North sanctuary between teleporter gateways." },
    { id: 3, name: "South Floor 2 Balcony", type: "Booster Ledge", pos: [0.0, 4.2, 42.0], yaw: 3.14, desc: "South upper mezzanine overlooking the Quad cathedral." },
    { id: 4, name: "Upper Tunnel Bridge", type: "Sniper Peak", pos: [0.0, 4.2, 0.0], yaw: 0.0, desc: "High bridge overlooking the entire connecting crypt tunnel." }
  ],
  itemSpawns: [
    { id: 201, itemKey: "megahealth", name: "MegaHealth (+100 HP)", category: "health", pos: [0.0, 1.2, -30.0], respawnDelay: 60.0, respawnTimer: 0.0, active: true, color: [0.06, 0.92, 0.95], scale: [0.6, 0.6, 0.6], meshType: 'sphere', effect: '+100 HP Overheal' },
    { id: 202, itemKey: "armor_red", name: "Red Heavy Battle Armor (+100 AP)", category: "armor", pos: [0.0, 5.0, 42.0], respawnDelay: 30.0, respawnTimer: 0.0, active: true, color: [0.95, 0.20, 0.30], scale: [0.6, 0.6, 0.6], meshType: 'cube', effect: '+100 Armor (75% Absorb)' },
    { id: 203, itemKey: "powerup_quad", name: "Quad Damage Rune (4x DMG)", category: "powerup", pos: [0.0, 1.4, 30.0], respawnDelay: 120.0, respawnTimer: 0.0, active: true, color: [0.20, 0.55, 1.0], scale: [0.7, 0.7, 0.7], meshType: 'gem', effect: '4x Projectile Damage (30s)' },
    { id: 204, itemKey: "ammo_plasma", name: "Plasma Energy Cells (+50)", category: "ammo", pos: [-16.0, 0.8, 30.0], respawnDelay: 20.0, respawnTimer: 0.0, active: true, color: [0.06, 0.85, 0.95], scale: [0.45, 0.45, 0.45], meshType: 'cube', effect: '+50 Energy Cells' },
    { id: 205, itemKey: "ammo_slugs", name: "Heavy Kinetic Slugs (+30)", category: "ammo", pos: [16.0, 0.8, -30.0], respawnDelay: 20.0, respawnTimer: 0.0, active: true, color: [0.95, 0.65, 0.15], scale: [0.45, 0.45, 0.45], meshType: 'cube', effect: '+30 Kinetic Slugs' },
    { id: 206, itemKey: "health_small", name: "Small Health Vial (+15 HP)", category: "health", pos: [0.0, 0.8, 0.0], respawnDelay: 15.0, respawnTimer: 0.0, active: true, color: [0.15, 0.95, 0.65], scale: [0.4, 0.4, 0.4], meshType: 'sphere', effect: '+15 HP' }
  ]
};

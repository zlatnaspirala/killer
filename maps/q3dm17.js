// maps/q3dm17.js
// Quake Arena Map 3: The Longest Yard (Q3DM17)
import { generateStairs } from './utils.js';

export const mapQ3DM17 = {
  id: "q3dm17",
  name: "The Longest Yard (Q3DM17 / Twin Void Islands & Space Bridge)",
  quakeTitle: "Q3DM17 / The Longest Yard",
  environment: "Cosmic Void",
  style: "Twin Void Islands & Space Bridge",
  tag: "Q3DM17 VOID",
  desc: "Huge suspended 2-Room cosmic arena featuring South Launch Courtyard and North Sniper Island connected by an expanded 16m Void Bridge with real elevator shaft hole, sharp elongated pyramids, and bidirectional teleporters.",
  ambientColor: 0.30,
  floorScale: [70.0, 0.6, 96.0],
  floorColor: [0.15, 0.16, 0.22],
  floorRoughness: 0.90,
  floorMetallic: 0.40,
  groundFloor: { pos: [0, -0.5, 0], scale: [70.0, 0.6, 96.0], color: [0.15, 0.16, 0.22], roughness: 0.90, metallic: 0.40 },
  staticGeometry: [
    // ROOM 1: South Launch Courtyard (Z = +14 to +45)
    { id: 2, name: "South_Upper_Dais", type: "Raised Octagon", pos: [0.0, 0.6, 28.0], scale: [22.0, 0.6, 22.0], roughness: 0.25, metallic: 0.85, color: [0.22, 0.20, 0.35], collider: "AABB Box (22x0.6x22m)", layer: "Layer_Obstacle", trigger: false, badge: "South Dais", contact: false },
    { id: 3, name: "Floor2_South_Deck", type: "High Sniper Deck", pos: [0.0, 3.9, 38.0], scale: [56.0, 0.6, 10.0], roughness: 0.20, metallic: 0.95, color: [0.35, 0.25, 0.50], collider: "AABB Box (56x0.6x10m)", layer: "Layer_Obstacle", trigger: false, badge: "South Floor 2", contact: false },
    // Expanded South Board Extensions
    { id: 4, name: "South_Board_Extension_West", type: "Expanded Deck", pos: [-20.0, 0.5, 28.0], scale: [12.0, 0.6, 22.0], roughness: 0.28, metallic: 0.80, color: [0.18, 0.18, 0.28], collider: "AABB Box (12x0.6x22m)", layer: "Layer_Obstacle", trigger: false },
    { id: 5, name: "South_Board_Extension_East", type: "Expanded Deck", pos: [20.0, 0.5, 28.0], scale: [12.0, 0.6, 22.0], roughness: 0.28, metallic: 0.80, color: [0.18, 0.18, 0.28], collider: "AABB Box (12x0.6x22m)", layer: "Layer_Obstacle", trigger: false },
    ...generateStairs(40, "South_Launch_Stairs_West", -24.0, 16.0, 33.0, 0.0, 4.2, 10, 4.5, [0.30, 0.22, 0.45]),
    ...generateStairs(50, "South_Launch_Stairs_East", 24.0, 16.0, 33.0, 0.0, 4.2, 10, 4.5, [0.30, 0.22, 0.45]),

    // EXPANDED CONNECTING VOID TUNNEL / SKYWAY (Z = -12 to +12) - expanded from 12m to 16m wide
    { id: 6, name: "Void_Skyway_Bridge", type: "Expanded Suspended Skyway", pos: [0.0, 0.4, 0.0], scale: [16.0, 0.6, 24.0], roughness: 0.20, metallic: 0.90, color: [0.20, 0.18, 0.30], collider: "AABB Box (16x0.6x24m)", layer: "Layer_Obstacle", trigger: false, badge: "Void Skyway", contact: false },

    // PROFESSIONAL FLOOR 2 UPPER SKY BRIDGE WITH ELEVATOR SHAFT HOLE
    // Leaves exact [4.8m x 4.8m] central opening at [0, 3.9, 0] so elevator fits through smoothly to second floor!
    { id: 71, name: "Floor2_Upper_Sky_Bridge_North", type: "Upper Sky Bridge North", pos: [0.0, 3.9, -7.5], scale: [8.0, 0.6, 9.0], roughness: 0.20, metallic: 0.95, color: [0.35, 0.25, 0.50], collider: "AABB Box (8x0.6x9m)", layer: "Layer_Obstacle", trigger: false, badge: "Upper Bridge North", contact: false },
    { id: 72, name: "Floor2_Upper_Sky_Bridge_South", type: "Upper Sky Bridge South", pos: [0.0, 3.9, 7.5], scale: [8.0, 0.6, 9.0], roughness: 0.20, metallic: 0.95, color: [0.35, 0.25, 0.50], collider: "AABB Box (8x0.6x9m)", layer: "Layer_Obstacle", trigger: false, badge: "Upper Bridge South", contact: false },
    { id: 73, name: "Floor2_Upper_Sky_Bridge_CatwalkWest", type: "Hole Catwalk West", pos: [-3.3, 3.9, 0.0], scale: [1.4, 0.6, 6.0], roughness: 0.20, metallic: 0.95, color: [0.35, 0.25, 0.50], collider: "AABB Box (1.4x0.6x6m)", layer: "Layer_Obstacle", trigger: false, badge: "Upper Shaft Catwalk W", contact: false },
    { id: 74, name: "Floor2_Upper_Sky_Bridge_CatwalkEast", type: "Hole Catwalk East", pos: [3.3, 3.9, 0.0], scale: [1.4, 0.6, 6.0], roughness: 0.20, metallic: 0.95, color: [0.35, 0.25, 0.50], collider: "AABB Box (1.4x0.6x6m)", layer: "Layer_Obstacle", trigger: false, badge: "Upper Shaft Catwalk E", contact: false },

    // Professional Elevator Guide Pillars framing the 4 corners of the elevator shaft
    { id: 75, name: "Elevator_Guide_NW", type: "Shaft Pillar", pos: [-2.45, 2.15, -2.45], scale: [0.35, 4.3, 0.35], roughness: 0.15, metallic: 0.95, color: [0.55, 0.60, 0.75], collider: "AABB Box (0.35x4.3x0.35m)", layer: "Layer_Obstacle", trigger: false },
    { id: 76, name: "Elevator_Guide_NE", type: "Shaft Pillar", pos: [2.45, 2.15, -2.45], scale: [0.35, 4.3, 0.35], roughness: 0.15, metallic: 0.95, color: [0.55, 0.60, 0.75], collider: "AABB Box (0.35x4.3x0.35m)", layer: "Layer_Obstacle", trigger: false },
    { id: 77, name: "Elevator_Guide_SW", type: "Shaft Pillar", pos: [-2.45, 2.15, 2.45], scale: [0.35, 4.3, 0.35], roughness: 0.15, metallic: 0.95, color: [0.55, 0.60, 0.75], collider: "AABB Box (0.35x4.3x0.35m)", layer: "Layer_Obstacle", trigger: false },
    { id: 78, name: "Elevator_Guide_SE", type: "Shaft Pillar", pos: [2.45, 2.15, 2.45], scale: [0.35, 4.3, 0.35], roughness: 0.15, metallic: 0.95, color: [0.55, 0.60, 0.75], collider: "AABB Box (0.35x4.3x0.35m)", layer: "Layer_Obstacle", trigger: false },

    // ROOM 2: North Sniper Island (Z = -45 to -14)
    { id: 10, name: "North_Sniper_Dais", type: "Raised Octagon", pos: [0.0, 0.6, -28.0], scale: [22.0, 0.6, 22.0], roughness: 0.25, metallic: 0.85, color: [0.22, 0.20, 0.35], collider: "AABB Box (22x0.6x22m)", layer: "Layer_Obstacle", trigger: false, badge: "North Dais", contact: false },
    { id: 11, name: "Floor2_North_Deck", type: "High Sniper Deck", pos: [0.0, 3.9, -38.0], scale: [56.0, 0.6, 10.0], roughness: 0.20, metallic: 0.95, color: [0.35, 0.25, 0.50], collider: "AABB Box (56x0.6x10m)", layer: "Layer_Obstacle", trigger: false, badge: "North Floor 2", contact: false },
    // Expanded North Board Extensions
    { id: 12, name: "North_Board_Extension_West", type: "Expanded Deck", pos: [-20.0, 0.5, -28.0], scale: [12.0, 0.6, 22.0], roughness: 0.28, metallic: 0.80, color: [0.18, 0.18, 0.28], collider: "AABB Box (12x0.6x22m)", layer: "Layer_Obstacle", trigger: false },
    { id: 13, name: "North_Board_Extension_East", type: "Expanded Deck", pos: [20.0, 0.5, -28.0], scale: [12.0, 0.6, 22.0], roughness: 0.28, metallic: 0.80, color: [0.18, 0.18, 0.28], collider: "AABB Box (12x0.6x22m)", layer: "Layer_Obstacle", trigger: false },
    ...generateStairs(60, "North_Sniper_Stairs_West", -24.0, -16.0, -33.0, 0.0, 4.2, 10, 4.5, [0.30, 0.22, 0.45]),
    ...generateStairs(70, "North_Sniper_Stairs_East", 24.0, -16.0, -33.0, 0.0, 4.2, 10, 4.5, [0.30, 0.22, 0.45]),

    // TELEPORT OBJECT: POINT A (South-West) & POINT B (North-East) AND VICE VERSA
    { id: 80, name: "Teleport_Gateway_A_Base", type: "Teleport Pad A", pos: [-18.0, 0.3, 24.0], scale: [4.5, 0.4, 4.5], roughness: 0.15, metallic: 0.95, color: [0.10, 0.65, 0.90], collider: "AABB Box (4.5x0.4x4.5m)", layer: "Layer_Obstacle", trigger: false },
    { id: 81, name: "Teleport_Gateway_A_PillarL", type: "Gateway Arch", pos: [-19.8, 1.8, 24.0], scale: [0.45, 3.0, 0.45], roughness: 0.2, metallic: 0.9, color: [0.2, 0.85, 1.0], collider: "AABB Box (0.45x3x0.45m)", layer: "Layer_Obstacle", trigger: false },
    { id: 82, name: "Teleport_Gateway_A_PillarR", type: "Gateway Arch", pos: [-16.2, 1.8, 24.0], scale: [0.45, 3.0, 0.45], roughness: 0.2, metallic: 0.9, color: [0.2, 0.85, 1.0], collider: "AABB Box (0.45x3x0.45m)", layer: "Layer_Obstacle", trigger: false },

    { id: 85, name: "Teleport_Gateway_B_Base", type: "Teleport Pad B", pos: [18.0, 0.3, -24.0], scale: [4.5, 0.4, 4.5], roughness: 0.15, metallic: 0.95, color: [0.85, 0.15, 0.65], collider: "AABB Box (4.5x0.4x4.5m)", layer: "Layer_Obstacle", trigger: false },
    { id: 86, name: "Teleport_Gateway_B_PillarL", type: "Gateway Arch", pos: [16.2, 1.8, -24.0], scale: [0.45, 3.0, 0.45], roughness: 0.2, metallic: 0.9, color: [1.0, 0.30, 0.85], collider: "AABB Box (0.45x3x0.45m)", layer: "Layer_Obstacle", trigger: false },
    { id: 87, name: "Teleport_Gateway_B_PillarR", type: "Gateway Arch", pos: [19.8, 1.8, -24.0], scale: [0.45, 3.0, 0.45], roughness: 0.2, metallic: 0.9, color: [1.0, 0.30, 0.85], collider: "AABB Box (0.45x3x0.45m)", layer: "Layer_Obstacle", trigger: false },

    // SHARP EDGES IN THE FORM OF ELONGATED PYRAMIDS (Lining the board edges into cosmic void)
    { id: 90, name: "Sharp_Pyramid_Spike_01", type: "Sharp Edge Pyramid", meshType: 'pyramid', pos: [-8.2, 0.4, 6.0], scale: [1.2, -4.5, 1.2], roughness: 0.2, metallic: 0.9, color: [0.40, 0.12, 0.18], collider: "Sharp Pyramid (1.2x4.5m)", layer: "Layer_Obstacle", trigger: false },
    { id: 91, name: "Sharp_Pyramid_Spike_02", type: "Sharp Edge Pyramid", meshType: 'pyramid', pos: [-8.2, 0.4, -6.0], scale: [1.2, -4.5, 1.2], roughness: 0.2, metallic: 0.9, color: [0.40, 0.12, 0.18], collider: "Sharp Pyramid (1.2x4.5m)", layer: "Layer_Obstacle", trigger: false },
    { id: 92, name: "Sharp_Pyramid_Spike_03", type: "Sharp Edge Pyramid", meshType: 'pyramid', pos: [8.2, 0.4, 6.0], scale: [1.2, -4.5, 1.2], roughness: 0.2, metallic: 0.9, color: [0.40, 0.12, 0.18], collider: "Sharp Pyramid (1.2x4.5m)", layer: "Layer_Obstacle", trigger: false },
    { id: 93, name: "Sharp_Pyramid_Spike_04", type: "Sharp Edge Pyramid", meshType: 'pyramid', pos: [8.2, 0.4, -6.0], scale: [1.2, -4.5, 1.2], roughness: 0.2, metallic: 0.9, color: [0.40, 0.12, 0.18], collider: "Sharp Pyramid (1.2x4.5m)", layer: "Layer_Obstacle", trigger: false },

    { id: 94, name: "Sharp_Pyramid_Spike_05", type: "Sharp Edge Pyramid", meshType: 'pyramid', pos: [-26.0, 0.5, 28.0], scale: [1.4, -5.0, 1.4], roughness: 0.2, metallic: 0.9, color: [0.45, 0.10, 0.16], collider: "Sharp Pyramid (1.4x5m)", layer: "Layer_Obstacle", trigger: false },
    { id: 95, name: "Sharp_Pyramid_Spike_06", type: "Sharp Edge Pyramid", meshType: 'pyramid', pos: [26.0, 0.5, 28.0], scale: [1.4, -5.0, 1.4], roughness: 0.2, metallic: 0.9, color: [0.45, 0.10, 0.16], collider: "Sharp Pyramid (1.4x5m)", layer: "Layer_Obstacle", trigger: false },
    { id: 96, name: "Sharp_Pyramid_Spike_07", type: "Sharp Edge Pyramid", meshType: 'pyramid', pos: [-26.0, 0.5, -28.0], scale: [1.4, -5.0, 1.4], roughness: 0.2, metallic: 0.9, color: [0.45, 0.10, 0.16], collider: "Sharp Pyramid (1.4x5m)", layer: "Layer_Obstacle", trigger: false },
    { id: 97, name: "Sharp_Pyramid_Spike_08", type: "Sharp Edge Pyramid", meshType: 'pyramid', pos: [26.0, 0.5, -28.0], scale: [1.4, -5.0, 1.4], roughness: 0.2, metallic: 0.9, color: [0.45, 0.10, 0.16], collider: "Sharp Pyramid (1.4x5m)", layer: "Layer_Obstacle", trigger: false },

    // Upright Elongated Pyramid Perimeter Spires
    { id: 98, name: "Pyramid_Spire_SouthW", type: "Elongated Spire", meshType: 'pyramid', pos: [-11.0, 0.6, 39.0], scale: [1.0, 3.8, 1.0], roughness: 0.15, metallic: 0.95, color: [0.55, 0.15, 0.25], collider: "Pyramid Spire", layer: "Layer_Obstacle", trigger: false },
    { id: 99, name: "Pyramid_Spire_SouthE", type: "Elongated Spire", meshType: 'pyramid', pos: [11.0, 0.6, 39.0], scale: [1.0, 3.8, 1.0], roughness: 0.15, metallic: 0.95, color: [0.55, 0.15, 0.25], collider: "Pyramid Spire", layer: "Layer_Obstacle", trigger: false },
    { id: 100, name: "Pyramid_Spire_NorthW", type: "Elongated Spire", meshType: 'pyramid', pos: [-11.0, 0.6, -39.0], scale: [1.0, 3.8, 1.0], roughness: 0.15, metallic: 0.95, color: [0.55, 0.15, 0.25], collider: "Pyramid Spire", layer: "Layer_Obstacle", trigger: false },
    { id: 104, name: "Pyramid_Spire_NorthE", type: "Elongated Spire", meshType: 'pyramid', pos: [11.0, 0.6, -39.0], scale: [1.0, 3.8, 1.0], roughness: 0.15, metallic: 0.95, color: [0.55, 0.15, 0.25], collider: "Pyramid Spire", layer: "Layer_Obstacle", trigger: false },

    // LIGHT ENTITIES
    { id: 101, name: "Void_Skyway_Spheric_Light", type: "Spheric Area Light", isLight: true, lightType: "point", pos: [0.0, 5.5, 0.0], scale: [1.2, 1.2, 1.2], color: [0.85, 0.25, 1.0], intensity: 18.0, radius: 12.0, roughness: 0.1, metallic: 0.9, collider: "Point Light Sphere", layer: "Layer_Light", trigger: false, badge: "Area Light", contact: false },
    { id: 102, name: "South_Launch_Spotlight", type: "Spot Light", isLight: true, lightType: "spot", pos: [0.0, 8.0, 24.0], target: [0.0, 0.6, 28.0], lightDir: [0.0, -0.88, 0.47], scale: [1.0, 1.5, 1.0], color: [0.2, 0.9, 1.0], intensity: 26.0, spotCutoffAngle: 45, spotCutoff: 0.707, outerCutoff: 0.53, roughness: 0.1, metallic: 0.9, collider: "Spot Light Cone", layer: "Layer_Light", trigger: false, badge: "Spot Light", contact: false },
    { id: 103, name: "North_Sniper_Spotlight", type: "Spot Light", isLight: true, lightType: "spot", pos: [0.0, 8.0, -24.0], target: [0.0, 0.6, -28.0], lightDir: [0.0, -0.88, -0.47], scale: [1.0, 1.5, 1.0], color: [0.95, 0.35, 1.0], intensity: 26.0, spotCutoffAngle: 45, spotCutoff: 0.707, outerCutoff: 0.53, roughness: 0.1, metallic: 0.9, collider: "Spot Light Cone", layer: "Layer_Light", trigger: false, badge: "Spot Light", contact: false }
  ],
  teleporters: [
    // Bidirectional Teleport Pair: Point A <-> Point B
    { id: 10, name: "Quantum Portal A", pos: [-18.0, 0.6, 24.0], targetPos: [18.0, 0.6, -24.0], radius: 2.2, color: [0.1, 0.85, 1.0], label: "Warp A -> B" },
    { id: 11, name: "Quantum Portal B", pos: [18.0, 0.6, -24.0], targetPos: [-18.0, 0.6, 24.0], radius: 2.2, color: [0.95, 0.25, 0.95], label: "Warp B -> A" },
    // Platform to High Sniper Perches
    { id: 1, name: "South Launch Portal", pos: [0.0, 0.6, 28.0], targetPos: [0.0, 4.5, -38.0], radius: 1.8, color: [0.1, 0.85, 1.0], label: "Warp -> North Floor 2" },
    { id: 2, name: "North Sniper Portal", pos: [0.0, 0.6, -28.0], targetPos: [0.0, 4.5, 38.0], radius: 1.8, color: [0.95, 0.25, 0.95], label: "Warp -> South Floor 2" }
  ],
  elevators: [
    // Fits perfectly into the Floor 2 opening [4.8m x 4.8m] and flushes smoothly at Y = 3.9
    { id: 1, name: "Void Skyway Kinetic Lift", pos: [0.0, 0.4, 0.0], startY: 0.4, endY: 3.9, scale: [4.6, 0.4, 4.6], speed: 2.8, color: [0.28, 0.38, 0.58], label: "Void Hydraulic Lift" }
  ],
  playerSpawns: [
    { id: 1, name: "South Launch Courtyard", type: "FFA Primary", pos: [0.0, 0.6, 20.0], yaw: 0.0, desc: "South void platform facing the space bridge." },
    { id: 2, name: "North Sniper Island", type: "Sniper Perch", pos: [0.0, 0.6, -20.0], yaw: 3.14, desc: "North floating island facing south." },
    { id: 3, name: "Upper Sky Bridge", type: "High Perch", pos: [0.0, 4.2, 0.0], yaw: 0.0, desc: "Floor 2 bridge suspended over the cosmic abyss." }
  ],
  itemSpawns: [
    { id: 211, itemKey: "ammo_railgun", name: "Quantum Railgun Slugs (+15)", category: "ammo", pos: [0.0, 5.0, -38.0], respawnDelay: 30.0, respawnTimer: 0.0, active: true, color: [0.85, 0.35, 0.95], scale: [0.5, 0.5, 0.5], meshType: 'gem', effect: '+15 Railgun Slugs' },
    { id: 212, itemKey: "powerup_quad", name: "Quad Damage Rune (4x DMG)", category: "powerup", pos: [0.0, 5.0, 38.0], respawnDelay: 120.0, respawnTimer: 0.0, active: true, color: [0.20, 0.55, 1.0], scale: [0.65, 0.65, 0.65], meshType: 'gem', effect: '4x Projectile Damage (30s)' },
    { id: 213, itemKey: "armor_yellow", name: "Yellow Combat Armor (+75 AP)", category: "armor", pos: [0.0, 1.2, 0.0], respawnDelay: 25.0, respawnTimer: 0.0, active: true, color: [0.95, 0.80, 0.15], scale: [0.55, 0.55, 0.55], meshType: 'cube', effect: '+75 Armor (66% Absorb)' }
  ]
};


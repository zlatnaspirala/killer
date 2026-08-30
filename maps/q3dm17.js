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
  desc: "Huge suspended 2-Room cosmic arena featuring South Launch Courtyard and North Sniper Island connected by a 24m Void Bridge with real stepped launch stairs.",
  ambientColor: 0.30,
  floorScale: [60.0, 0.6, 90.0],
  floorColor: [0.15, 0.16, 0.22],
  floorRoughness: 0.90,
  floorMetallic: 0.40,
  groundFloor: { pos: [0, -0.5, 0], scale: [60.0, 0.6, 90.0], color: [0.15, 0.16, 0.22], roughness: 0.90, metallic: 0.40 },
  staticGeometry: [
    // ROOM 1: South Launch Courtyard (Z = +14 to +45)
    { id: 2, name: "South_Upper_Dais", type: "Raised Octagon", pos: [0.0, 0.6, 28.0], scale: [18.0, 0.6, 18.0], roughness: 0.25, metallic: 0.85, color: [0.22, 0.20, 0.35], collider: "AABB Box (18x0.6x18m)", layer: "Layer_Obstacle", trigger: false, badge: "South Dais", contact: false },
    { id: 3, name: "Floor2_South_Deck", type: "High Sniper Deck", pos: [0.0, 3.9, 38.0], scale: [54.0, 0.6, 10.0], roughness: 0.20, metallic: 0.95, color: [0.35, 0.25, 0.50], collider: "AABB Box (54x0.6x10m)", layer: "Layer_Obstacle", trigger: false, badge: "South Floor 2", contact: false },
    ...generateStairs(40, "South_Launch_Stairs_West", -24.0, 16.0, 33.0, 0.0, 4.2, 10, 4.5, [0.30, 0.22, 0.45]),
    ...generateStairs(50, "South_Launch_Stairs_East", 24.0, 16.0, 33.0, 0.0, 4.2, 10, 4.5, [0.30, 0.22, 0.45]),

    // CONNECTING VOID TUNNEL / SKYWAY (Z = -12 to +12)
    { id: 6, name: "Void_Skyway_Bridge", type: "Suspended Skyway", pos: [0.0, 0.4, 0.0], scale: [12.0, 0.6, 24.0], roughness: 0.20, metallic: 0.90, color: [0.20, 0.18, 0.30], collider: "AABB Box (12x0.6x24m)", layer: "Layer_Obstacle", trigger: false, badge: "Void Skyway", contact: false },
    { id: 7, name: "Floor2_Upper_Sky_Bridge", type: "Upper Sky Bridge", pos: [0.0, 3.9, 0.0], scale: [8.0, 0.6, 24.0], roughness: 0.20, metallic: 0.95, color: [0.35, 0.25, 0.50], collider: "AABB Box (8x0.6x24m)", layer: "Layer_Obstacle", trigger: false, badge: "Upper Bridge", contact: false },

    // ROOM 2: North Sniper Island (Z = -45 to -14)
    { id: 10, name: "North_Sniper_Dais", type: "Raised Octagon", pos: [0.0, 0.6, -28.0], scale: [18.0, 0.6, 18.0], roughness: 0.25, metallic: 0.85, color: [0.22, 0.20, 0.35], collider: "AABB Box (18x0.6x18m)", layer: "Layer_Obstacle", trigger: false, badge: "North Dais", contact: false },
    { id: 11, name: "Floor2_North_Deck", type: "High Sniper Deck", pos: [0.0, 3.9, -38.0], scale: [54.0, 0.6, 10.0], roughness: 0.20, metallic: 0.95, color: [0.35, 0.25, 0.50], collider: "AABB Box (54x0.6x10m)", layer: "Layer_Obstacle", trigger: false, badge: "North Floor 2", contact: false },
    ...generateStairs(60, "North_Sniper_Stairs_West", -24.0, -16.0, -33.0, 0.0, 4.2, 10, 4.5, [0.30, 0.22, 0.45]),
    ...generateStairs(70, "North_Sniper_Stairs_East", 24.0, -16.0, -33.0, 0.0, 4.2, 10, 4.5, [0.30, 0.22, 0.45]),

    // LIGHT ENTITIES
    { id: 101, name: "Void_Skyway_Spheric_Light", type: "Spheric Area Light", isLight: true, lightType: "point", pos: [0.0, 5.5, 0.0], scale: [1.2, 1.2, 1.2], color: [0.85, 0.25, 1.0], intensity: 18.0, radius: 12.0, roughness: 0.1, metallic: 0.9, collider: "Point Light Sphere", layer: "Layer_Light", trigger: false, badge: "Area Light", contact: false },
    { id: 102, name: "South_Launch_Spotlight", type: "Spot Light", isLight: true, lightType: "spot", pos: [0.0, 8.0, 28.0], lightDir: [0.0, -1.0, -0.2], scale: [1.0, 1.5, 1.0], color: [0.2, 0.9, 1.0], intensity: 20.0, spotCutoff: 0.85, outerCutoff: 0.70, roughness: 0.1, metallic: 0.9, collider: "Spot Light Cone", layer: "Layer_Light", trigger: false, badge: "Spot Light", contact: false },
    { id: 103, name: "North_Sniper_Spotlight", type: "Spot Light", isLight: true, lightType: "spot", pos: [0.0, 8.0, -28.0], lightDir: [0.0, -1.0, 0.2], scale: [1.0, 1.5, 1.0], color: [0.95, 0.35, 1.0], intensity: 20.0, spotCutoff: 0.85, outerCutoff: 0.70, roughness: 0.1, metallic: 0.9, collider: "Spot Light Cone", layer: "Layer_Light", trigger: false, badge: "Spot Light", contact: false }
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

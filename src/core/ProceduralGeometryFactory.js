/**
 * Procedural Math Geometry Factory & MOBA Forest Layout Engine
 * Generates procedural 3D tree meshes, foliage canopies, boulders, paths, and classic 3-lane MOBA layouts.
 * Pure native WebGL geometry buffers with zero external dependencies.
 */

// Simple deterministic pseudo-random number generator for reproducible procedural layout
class PRNG {
  constructor(seed = 12345) {
    this.seed = seed % 2147483647;
    if (this.seed <= 0) this.seed += 2147483646;
  }
  next() {
    this.seed = (this.seed * 16807) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }
  range(min, max) {
    return min + this.next() * (max - min);
  }
}

/**
 * Procedural Math Geometry Factory
 */
export class ProceduralGeometryFactory {
  /**
   * Generates a parametric cylinder (with optional root fluting / tapering)
   */
  static createCylinder(radiusTop = 0.5, radiusBottom = 0.7, height = 2.0, radialSegments = 12, heightSegments = 4, flareBottom = true) {
    const positions = [];
    const normals = [];
    const uvs = [];
    const barys = [];
    const indices = [];

    for (let y = 0; y <= heightSegments; y++) {
      const v = y / heightSegments;
      const posY = v * height;
      
      // Radius interpolation with optional organic root flare at the base
      let r = radiusBottom + (radiusTop - radiusBottom) * v;
      if (flareBottom && v < 0.25) {
        const flare = Math.pow(1.0 - (v / 0.25), 2.2) * 0.45;
        r += flare;
      }

      for (let x = 0; x <= radialSegments; x++) {
        const u = x / radialSegments;
        const theta = u * Math.PI * 2;
        const sinT = Math.sin(theta);
        const cosT = Math.cos(theta);

        positions.push(cosT * r, posY, sinT * r);
        
        // Slope normal
        const slope = (radiusBottom - radiusTop) / height;
        const nVec = [cosT, slope, sinT];
        const nLen = Math.hypot(...nVec) || 1;
        normals.push(nVec[0] / nLen, nVec[1] / nLen, nVec[2] / nLen);

        uvs.push(u, v);
        barys.push((x + y) % 3 === 0 ? 1 : 0, (x + y) % 3 === 1 ? 1 : 0, (x + y) % 3 === 2 ? 1 : 0);
      }
    }

    const stride = radialSegments + 1;
    for (let y = 0; y < heightSegments; y++) {
      for (let x = 0; x < radialSegments; x++) {
        const i0 = y * stride + x;
        const i1 = i0 + 1;
        const i2 = (y + 1) * stride + x;
        const i3 = i2 + 1;

        indices.push(i0, i2, i1);
        indices.push(i1, i2, i3);
      }
    }

    return { positions, normals, uvs, barys, indices };
  }

  /**
   * Generates a conical foliage tier (for pines, conifers)
   */
  static createCone(radius = 1.2, height = 1.8, radialSegments = 14, heightSegments = 3, scallop = 0.15) {
    const positions = [];
    const normals = [];
    const uvs = [];
    const barys = [];
    const indices = [];

    // Apex vertex
    const apexIndex = 0;
    positions.push(0, height, 0);
    normals.push(0, 1, 0);
    uvs.push(0.5, 1.0);
    barys.push(1, 0, 0);

    for (let y = 1; y <= heightSegments; y++) {
      const v = y / heightSegments;
      const posY = height * (1.0 - v);
      const rBase = radius * v;

      for (let x = 0; x <= radialSegments; x++) {
        const u = x / radialSegments;
        const theta = u * Math.PI * 2;
        
        // Organic scalloped edge for needle skirts
        const wave = Math.sin(theta * radialSegments * 0.5) * scallop * (v > 0.8 ? 1.0 : 0.2);
        const r = rBase + wave;

        const posX = Math.cos(theta) * r;
        const posZ = Math.sin(theta) * r;

        positions.push(posX, posY, posZ);

        const nx = Math.cos(theta);
        const ny = radius / height;
        const nz = Math.sin(theta);
        const len = Math.hypot(nx, ny, nz) || 1;
        normals.push(nx / len, ny / len, nz / len);

        uvs.push(u, 1.0 - v);
        barys.push((x + y) % 3 === 0 ? 1 : 0, (x + y) % 3 === 1 ? 1 : 0, (x + y) % 3 === 2 ? 1 : 0);
      }
    }

    const stride = radialSegments + 1;
    // Connect apex to first ring
    for (let x = 0; x < radialSegments; x++) {
      const nextX = x + 1;
      indices.push(apexIndex, 1 + x, 1 + nextX);
    }

    // Connect rings
    for (let y = 1; y < heightSegments; y++) {
      const ringOffset1 = 1 + (y - 1) * stride;
      const ringOffset2 = 1 + y * stride;
      for (let x = 0; x < radialSegments; x++) {
        const i0 = ringOffset1 + x;
        const i1 = i0 + 1;
        const i2 = ringOffset2 + x;
        const i3 = i2 + 1;

        indices.push(i0, i2, i1);
        indices.push(i1, i2, i3);
      }
    }

    return { positions, normals, uvs, barys, indices };
  }

  /**
   * Generates a multi-lobed organic foliage canopy for Broadleaf / Ancient Oaks
   */
  static createOrganicCanopy(radius = 1.6, latBands = 14, longBands = 14, seed = 42, roughness = 0.28) {
    const rng = new PRNG(seed);
    const positions = [];
    const normals = [];
    const uvs = [];
    const barys = [];
    const indices = [];

    // Spherical harmonics / lobes distortion
    const lobes = 4;
    const freqs = [rng.range(1.5, 3.5), rng.range(2.0, 4.0), rng.range(1.0, 3.0)];

    for (let lat = 0; lat <= latBands; lat++) {
      const theta = (lat * Math.PI) / latBands;
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);

      for (let lon = 0; lon <= longBands; lon++) {
        const phi = (lon * 2 * Math.PI) / longBands;
        const sinPhi = Math.sin(phi);
        const cosPhi = Math.cos(phi);

        // Mathematical multi-frequency organic displacement
        const distortion = 1.0 + 
          roughness * (
            Math.sin(freqs[0] * phi) * Math.cos(freqs[1] * theta) * 0.5 +
            Math.cos(freqs[2] * phi * 1.5) * Math.sin(theta * 2.0) * 0.35 +
            Math.sin(phi * lobes) * 0.15
          );

        // Flatten bottom of canopy slightly for authentic tree silhouette
        const yFlatten = cosTheta < -0.3 ? 0.7 : 1.0;
        const currentR = radius * distortion;

        const x = cosPhi * sinTheta * currentR;
        const y = cosTheta * currentR * yFlatten;
        const z = sinPhi * sinTheta * currentR;

        positions.push(x, y + radius * 0.8, z);

        // Normal vector pointing outwards
        const nLen = Math.hypot(x, y, z) || 1;
        normals.push(x / nLen, y / nLen, z / nLen);

        uvs.push(lon / longBands, lat / latBands);
        barys.push((lat + lon) % 3 === 0 ? 1 : 0, (lat + lon) % 3 === 1 ? 1 : 0, (lat + lon) % 3 === 2 ? 1 : 0);
      }
    }

    for (let lat = 0; lat < latBands; lat++) {
      for (let lon = 0; lon < longBands; lon++) {
        const first = lat * (longBands + 1) + lon;
        const second = first + longBands + 1;
        indices.push(first, second, first + 1);
        indices.push(second, second + 1, first + 1);
      }
    }

    return { positions, normals, uvs, barys, indices };
  }

  /**
   * Generates a multi-faceted rugged boulder geometry
   */
  static createBoulder(radius = 1.0, seed = 77) {
    const rng = new PRNG(seed);
    const t = (1.0 + Math.sqrt(5.0)) / 2.0;
    const baseVerts = [
      -1, t, 0,  1, t, 0, -1,-t, 0,  1,-t, 0,
       0,-1, t,  0, 1, t,  0,-1,-t,  0, 1,-t,
       t, 0,-1,  t, 0, 1, -t, 0,-1, -t, 0, 1
    ];

    const perturbedVerts = [];
    for (let i = 0; i < baseVerts.length; i += 3) {
      const vx = baseVerts[i];
      const vy = baseVerts[i+1];
      const vz = baseVerts[i+2];
      const len = Math.hypot(vx, vy, vz) || 1;

      // Organic stone displacement
      const disp = 1.0 + rng.range(-0.25, 0.25);
      const px = (vx / len) * radius * disp;
      const py = (vy / len) * radius * disp * 0.75; // Flatten slightly into rock shape
      const pz = (vz / len) * radius * disp;
      perturbedVerts.push(px, py, pz);
    }

    const rawIdx = [
      0,11,5, 0,5,1, 0,1,7, 0,7,10, 0,10,11,
      1,5,9, 5,11,4, 11,10,2, 10,7,6, 7,1,8,
      3,9,4, 3,4,2, 3,2,6, 3,6,8, 3,8,9,
      4,9,5, 2,4,11, 6,2,10, 8,6,7, 9,8,1
    ];

    // Build flat-shaded normals for distinct rock facets
    const positions = [];
    const normals = [];
    const uvs = [];
    const barys = [];
    const indices = [];

    for (let f = 0; f < rawIdx.length; f += 3) {
      const i0 = rawIdx[f] * 3;
      const i1 = rawIdx[f + 1] * 3;
      const i2 = rawIdx[f + 2] * 3;

      const p0 = [perturbedVerts[i0], perturbedVerts[i0+1], perturbedVerts[i0+2]];
      const p1 = [perturbedVerts[i1], perturbedVerts[i1+1], perturbedVerts[i1+2]];
      const p2 = [perturbedVerts[i2], perturbedVerts[i2+1], perturbedVerts[i2+2]];

      // Face normal
      const e1 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
      const e2 = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
      const nx = e1[1]*e2[2] - e1[2]*e2[1];
      const ny = e1[2]*e2[0] - e1[0]*e2[2];
      const nz = e1[0]*e2[1] - e1[1]*e2[0];
      const nl = Math.hypot(nx, ny, nz) || 1;
      const fn = [nx / nl, ny / nl, nz / nl];

      const startIdx = positions.length / 3;
      positions.push(...p0, ...p1, ...p2);
      normals.push(...fn, ...fn, ...fn);
      uvs.push(0, 0, 1, 0, 0.5, 1);
      barys.push(1,0,0, 0,1,0, 0,0,1);
      indices.push(startIdx, startIdx + 1, startIdx + 2);
    }

    return { positions, normals, uvs, barys, indices };
  }
}

/**
 * Procedural Forest & Classic MOBA 3-Lane Layout Engine
 */
export class ProceduralForestLayoutEngine {
  constructor() {
    this.trees = [];
    this.boulders = [];
    this.bushes = [];
    this.towers = [];
    this.lanePaths = {
      top: [],
      mid: [],
      bot: []
    };
    this.riverPath = [];
    this.initialized = false;
  }

  /**
   * Initializes the entire procedural layout
   */
  initMapLayout() {
    if (this.initialized) return;
    this.initialized = true;

    // 1. Classic Dota 3-Lane Waypoint Definitions
    // Top Lane: Curves north along west forest border, crosses top river corner, enters enemy base
    this.lanePaths.top = [
      [-14.0, 0, -14.0], // Red Base
      [-14.0, 0, -6.0],  // Red Top Tier 2 Tower Area
      [-14.0, 0, 3.5],   // Red Top Tier 1 Tower Area
      [-11.5, 0, 11.5],  // River Top Shallows Crossing
      [-3.5, 0, 14.0],   // Black Top Tier 1 Tower Area
      [6.0, 0, 14.0],    // Black Top Tier 2 Tower Area
      [14.0, 0, 14.0]    // Black Base
    ];

    // Mid Lane: Classic straight diagonal through river bridge
    this.lanePaths.mid = [
      [-14.0, 0, -14.0], // Red Base
      [-8.5, 0, -8.5],   // Red Mid Tier 2 Area
      [-4.5, 0, -4.5],   // Red Mid Tier 1 Tower
      [0.0, 0, 0.0],     // River Center Shallows & Ancient Runes
      [4.5, 0, 4.5],     // Black Mid Tier 1 Tower
      [8.5, 0, 8.5],     // Black Mid Tier 2 Area
      [14.0, 0, 14.0]    // Black Base
    ];

    // Bottom Lane: Curves east along south forest border, crosses bottom river corner, enters enemy base
    this.lanePaths.bot = [
      [-14.0, 0, -14.0], // Red Base
      [-6.0, 0, -14.0],  // Red Bot Tier 2 Tower Area
      [3.5, 0, -14.0],   // Red Bot Tier 1 Tower Area
      [11.5, 0, -11.5],  // River Bot Shallows Crossing
      [14.0, 0, -3.5],   // Black Bot Tier 1 Tower Area
      [14.0, 0, 6.0],    // Black Bot Tier 2 Tower Area
      [14.0, 0, 14.0]    // Black Base
    ];

    // River bed points
    this.riverPath = [
      [-18.0, 0, 18.0],
      [-10.0, 0, 10.0],
      [0.0, 0, 0.0],
      [10.0, 0, -10.0],
      [18.0, 0, -18.0]
    ];

    // 2. Defensive Towers for all 3 classic lanes
    this.towers = [
      // Top Lane
      { id: 'tower_red_top', team: 'RED', lane: 'top', pos: [-14.0, 0, 3.5], hp: 1200, maxHp: 1200, mp: 400, maxMp: 400, damage: 65, range: 7.0, attackTimer: 0 },
      { id: 'tower_black_top', team: 'BLACK', lane: 'top', pos: [-3.5, 0, 14.0], hp: 1200, maxHp: 1200, mp: 400, maxMp: 400, damage: 65, range: 7.0, attackTimer: 0 },
      // Mid Lane
      { id: 'tower_red_mid', team: 'RED', lane: 'mid', pos: [-4.5, 0, -4.5], hp: 1200, maxHp: 1200, mp: 400, maxMp: 400, damage: 65, range: 7.0, attackTimer: 0 },
      { id: 'tower_black_mid', team: 'BLACK', lane: 'mid', pos: [4.5, 0, 4.5], hp: 1200, maxHp: 1200, mp: 400, maxMp: 400, damage: 65, range: 7.0, attackTimer: 0 },
      // Bottom Lane
      { id: 'tower_red_bot', team: 'RED', lane: 'bot', pos: [3.5, 0, -14.0], hp: 1200, maxHp: 1200, mp: 400, maxMp: 400, damage: 65, range: 7.0, attackTimer: 0 },
      { id: 'tower_black_bot', team: 'BLACK', lane: 'bot', pos: [14.0, 0, -3.5], hp: 1200, maxHp: 1200, mp: 400, maxMp: 400, damage: 65, range: 7.0, attackTimer: 0 },
      // Base Guardian Towers
      { id: 'tower_red_base', team: 'RED', lane: 'base', pos: [-11.5, 0, -11.5], hp: 1500, maxHp: 1500, mp: 600, maxMp: 600, damage: 80, range: 7.5, attackTimer: 0 },
      { id: 'tower_black_base', team: 'BLACK', lane: 'base', pos: [11.5, 0, 11.5], hp: 1500, maxHp: 1500, mp: 600, maxMp: 600, damage: 80, range: 7.5, attackTimer: 0 }
    ];

    // 3. Generate Procedural Forest Trees
    this.generateForestTrees();
  }

  /**
   * Distance from point [x, z] to a line segment [p1, p2]
   */
  distToSegment(x, z, p1, p2) {
    const l2 = Math.hypot(p2[0] - p1[0], p2[2] - p1[2]) ** 2;
    if (l2 === 0) return Math.hypot(x - p1[0], z - p1[2]);
    let t = ((x - p1[0]) * (p2[0] - p1[0]) + (z - p1[2]) * (p2[2] - p1[2])) / l2;
    t = Math.max(0, Math.min(1, t));
    const px = p1[0] + t * (p2[0] - p1[0]);
    const pz = p1[2] + t * (p2[2] - p1[2]);
    return Math.hypot(x - px, z - pz);
  }

  /**
   * Checks whether [x, z] is inside any lane corridor (which must remain free of trees)
   */
  isPointInLaneOrSanctuary(x, z, laneClearance = 2.4) {
    // Red Base Sanctuary
    if (Math.hypot(x - (-15.0), z - (-15.0)) < 5.2) return true;
    // Black Base Sanctuary
    if (Math.hypot(x - 15.0, z - 15.0) < 5.2) return true;
    // Center River Rune Shrine
    if (Math.hypot(x, z) < 2.0) return true;

    // Check all 3 classic lanes
    const lanes = [this.lanePaths.top, this.lanePaths.mid, this.lanePaths.bot];
    for (const path of lanes) {
      for (let i = 0; i < path.length - 1; i++) {
        if (this.distToSegment(x, z, path[i], path[i + 1]) < laneClearance) {
          return true;
        }
      }
    }

    // Check towers clearance
    for (const t of this.towers) {
      if (Math.hypot(x - t.pos[0], z - t.pos[2]) < 2.2) return true;
    }

    return false;
  }

  /**
   * Procedurally places trees throughout jungle quadrants and perimeter forests
   */
  generateForestTrees() {
    this.trees = [];
    this.boulders = [];
    this.bushes = [];

    const rng = new PRNG(998877);
    const treeTypes = ['oak', 'pine', 'willow', 'ancient_spire'];

    // Sample candidate spots in a jittered grid
    const mapExtent = 18.5;
    const step = 2.2;

    for (let gx = -mapExtent; gx <= mapExtent; gx += step) {
      for (let gz = -mapExtent; gz <= mapExtent; gz += step) {
        const jx = gx + rng.range(-0.7, 0.7);
        const jz = gz + rng.range(-0.7, 0.7);

        // Keep lanes and bases open
        if (this.isPointInLaneOrSanctuary(jx, jz, 2.5)) continue;

        // Check distance to existing trees (Poisson spacing)
        let tooClose = false;
        for (const t of this.trees) {
          if (Math.hypot(jx - t.x, jz - t.z) < 2.2) {
            tooClose = true;
            break;
          }
        }
        if (tooClose) continue;

        // Determine tree archetype based on zone
        let type = 'oak';
        const distFromCenter = Math.hypot(jx, jz);

        if (distFromCenter > 15.0) {
          // Perimeter dense ancient boundary
          type = rng.next() > 0.4 ? 'pine' : 'ancient_spire';
        } else if (jx * jz < 0) {
          // Jungle quadrants (North-West or South-East)
          const roll = rng.next();
          if (roll < 0.45) type = 'oak';
          else if (roll < 0.75) type = 'pine';
          else type = 'willow';
        } else {
          type = rng.next() > 0.5 ? 'oak' : 'pine';
        }

        const scale = rng.range(0.85, 1.45);
        const heightScale = rng.range(0.9, 1.3);
        const rotY = rng.range(0, Math.PI * 2);

        // Natural forest foliage palette variations
        const foliagePalettes = {
          oak: [
            [0.12, 0.48, 0.18], // Lush emerald
            [0.18, 0.55, 0.22], // Radiant canopy
            [0.08, 0.38, 0.12]  // Deep hollow green
          ],
          pine: [
            [0.06, 0.35, 0.16], // Dark pine needle
            [0.09, 0.42, 0.20], // Forest evergreen
            [0.04, 0.28, 0.14]  // Deep shadow conifer
          ],
          willow: [
            [0.22, 0.42, 0.20], // Weeping moss
            [0.45, 0.15, 0.18], // Hollow blood willow (crimson fronds)
            [0.15, 0.45, 0.30]  // Misty green
          ],
          ancient_spire: [
            [0.10, 0.40, 0.15],
            [0.25, 0.50, 0.20]
          ]
        };

        const trunkPalette = [
          [0.32, 0.20, 0.12], // Deep bark
          [0.26, 0.16, 0.10], // Dark oak wood
          [0.38, 0.24, 0.14]  // Weathered pine
        ];

        const pList = foliagePalettes[type] || foliagePalettes.oak;
        const folColor = pList[Math.floor(rng.next() * pList.length)];
        const trColor = trunkPalette[Math.floor(rng.next() * trunkPalette.length)];

        this.trees.push({
          id: `tree_${this.trees.length}`,
          x: jx,
          z: jz,
          y: 0.0,
          scale,
          heightScale,
          rotY,
          type,
          foliageColor: folColor,
          trunkColor: trColor,
          collisionRadius: 0.55 * scale
        });

        // Occasionally place companion boulder or bush near tree base
        if (rng.next() < 0.28) {
          const bx = jx + rng.range(-1.2, 1.2);
          const bz = jz + rng.range(-1.2, 1.2);
          if (!this.isPointInLaneOrSanctuary(bx, bz, 1.8)) {
            this.boulders.push({
              x: bx,
              z: bz,
              scale: rng.range(0.5, 0.95),
              rotY: rng.range(0, Math.PI * 2),
              color: [0.35, 0.36, 0.38]
            });
          }
        }
      }
    }
  }

  /**
   * Returns lane waypoints for a specific team and lane
   * RED moves from index 0 -> N
   * BLACK moves from index N -> 0 (reversed)
   */
  getCreepWaypoints(lane = 'mid', team = 'RED') {
    const raw = this.lanePaths[lane] || this.lanePaths.mid;
    if (team === 'RED') {
      return raw.map(p => [...p]);
    } else {
      return [...raw].reverse().map(p => [...p]);
    }
  }

  /**
   * Collision resolution against procedural trees
   */
  resolveTreeCollisions(pos, unitRadius = 0.5) {
    if (!pos) return;
    for (let i = 0; i < this.trees.length; i++) {
      const tree = this.trees[i];
      const dx = pos[0] - tree.x;
      const dz = pos[2] - tree.z;
      const dist = Math.hypot(dx, dz);
      const minDist = unitRadius + tree.collisionRadius;
      if (dist < minDist && dist > 0.001) {
        const push = minDist - dist;
        pos[0] += (dx / dist) * push;
        pos[2] += (dz / dist) * push;
      }
    }
  }
}

export const globalForestLayoutEngine = new ProceduralForestLayoutEngine();

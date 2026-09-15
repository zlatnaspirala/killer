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
        const flare = Math.pow(1.0 - (v / 0.25), 2.2) * (radiusBottom * 0.35);
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

  /**
   * Generates a curved grass tuft comprising multiple organically bent blades tapering to points
   */
  static createCurvedGrassTuft(bladesCount = 5) {
    const positions = [];
    const normals = [];
    const uvs = [];
    const barys = [];
    const indices = [];

    const rng = new PRNG(12345);

    for (let b = 0; b < bladesCount; b++) {
      // Angle around the center of the tuft
      const angle = (b / bladesCount) * Math.PI * 2 + rng.range(-0.15, 0.15);
      // Curve bending outward direction
      const curveDirX = Math.cos(angle) * rng.range(0.22, 0.38);
      const curveDirZ = Math.sin(angle) * rng.range(0.22, 0.38);

      const height = rng.range(0.85, 1.35);
      const width = rng.range(0.09, 0.14);

      const segments = 4;
      const startIndex = positions.length / 3;

      for (let s = 0; s <= segments; s++) {
        const t = s / segments;
        // Bending math: quadratic bending curve
        const bendX = curveDirX * t * t;
        const bendZ = curveDirZ * t * t;

        const y = t * height;
        // Tapering width towards top
        const currentWidth = width * (1.0 - t * 0.95);

        // Orthogonal vector for blade width
        const orthX = -Math.sin(angle) * currentWidth;
        const orthZ = Math.cos(angle) * currentWidth;

        // Left and right vertices of the blade segment
        const lx = bendX - orthX;
        const lz = bendZ - orthZ;
        const rx = bendX + orthX;
        const rz = bendZ + orthZ;

        // Add 2 vertices per segment
        positions.push(lx, y, lz);
        positions.push(rx, y, rz);

        // Normals pointing upwards/outwards
        const nx = Math.cos(angle) * 0.5;
        const ny = 0.86;
        const nz = Math.sin(angle) * 0.5;
        normals.push(nx, ny, nz);
        normals.push(nx, ny, nz);

        uvs.push(0.0, t);
        uvs.push(1.0, t);

        barys.push(1, 0, 0, 0, 1, 0);
      }

      // Indices for this blade's segments
      for (let s = 0; s < segments; s++) {
        const i0 = startIndex + s * 2;
        const i1 = i0 + 1;
        const i2 = i0 + 2;
        const i3 = i0 + 3;

        // Two triangles per segment
        indices.push(i0, i1, i2);
        indices.push(i1, i3, i2);
      }
    }

    return { positions, normals, uvs, barys, indices };
  }

  /**
   * Generates continuous organic road ribbon geometry with realistic wavy, jagged edges (NO straight lines)
   * Includes elevated road crown and organic earth fringes that blend naturally into the terrain
   */
  static createProceduralRoadRibbon(lanesDict) {
    const positions = [];
    const normals = [];
    const uvs = [];
    const barys = [];
    const indices = [];

    const rng = new PRNG(776655);

    Object.keys(lanesDict).forEach(laneKey => {
      const wps = lanesDict[laneKey];
      if (!wps || wps.length < 2) return;

      const baseWidth = laneKey === 'mid' ? 3.4 : 2.8;
      const halfWidth = baseWidth * 0.5;

      // Sample along continuous polyline with small steps for high fidelity organic curves
      const stepDist = 0.9;
      let totalDist = 0;

      // Calculate cumulative lengths
      const segLengths = [];
      let laneLength = 0;
      for (let i = 0; i < wps.length - 1; i++) {
        const d = Math.hypot(wps[i + 1][0] - wps[i][0], wps[i + 1][2] - wps[i][2]);
        segLengths.push(d);
        laneLength += d;
      }

      let currentSeg = 0;
      let distInSeg = 0;
      let laneStartIndex = positions.length / 3;
      let crossSections = 0;

      while (totalDist <= laneLength) {
        // Find segment
        while (currentSeg < segLengths.length - 1 && distInSeg > segLengths[currentSeg]) {
          distInSeg -= segLengths[currentSeg];
          currentSeg++;
        }

        const tSeg = Math.min(1.0, Math.max(0.0, distInSeg / Math.max(0.001, segLengths[currentSeg])));
        const p1 = wps[currentSeg];
        const p2 = wps[currentSeg + 1] || p1;

        // Smooth position interpolation
        const cx = p1[0] + (p2[0] - p1[0]) * tSeg;
        const cz = p1[2] + (p2[2] - p1[2]) * tSeg;

        // Tangent and 2D normal
        const tdx = p2[0] - p1[0];
        const tdz = p2[2] - p1[2];
        const tLen = Math.hypot(tdx, tdz) || 1.0;
        const nx = -tdz / tLen;
        const nz = tdx / tLen;

        // Organic edge wobble calculations (multi-frequency natural noise)
        const wobbleL = Math.sin(totalDist * 0.95) * 0.45 + Math.cos(totalDist * 2.3) * 0.25 + Math.sin(totalDist * 5.1) * 0.15 + rng.range(-0.15, 0.15);
        const wobbleR = Math.cos(totalDist * 0.88) * 0.42 + Math.sin(totalDist * 2.5) * 0.28 + Math.cos(totalDist * 4.7) * 0.14 + rng.range(-0.15, 0.15);

        const wL = halfWidth + wobbleL;
        const wR = halfWidth + wobbleR;

        // 5 vertices across: [Fringe Left, Stone Edge Left, Crown Center, Stone Edge Right, Fringe Right]
        const vCols = [
          { off: -(wL + 0.45), y: 0.010, u: 0.0 },
          { off: -wL,          y: 0.024, u: 0.2 },
          { off: 0.0,          y: 0.038, u: 0.5 }, // Elevated road crown
          { off: wR,           y: 0.024, u: 0.8 },
          { off: wR + 0.45,    y: 0.010, u: 1.0 }
        ];

        for (let c = 0; c < 5; c++) {
          const col = vCols[c];
          const px = cx + nx * col.off;
          const pz = cz + nz * col.off;

          positions.push(px, col.y, pz);
          normals.push(0.0, 1.0, 0.0);
          uvs.push(col.u, totalDist * 0.45);
          barys.push(1, 0, 0);
        }

        crossSections++;
        totalDist += stepDist;
        distInSeg += stepDist;
      }

      // Generate quad triangles between cross sections
      for (let s = 0; s < crossSections - 1; s++) {
        const row0 = laneStartIndex + s * 5;
        const row1 = laneStartIndex + (s + 1) * 5;

        for (let c = 0; c < 4; c++) {
          const i0 = row0 + c;
          const i1 = row0 + c + 1;
          const i2 = row1 + c;
          const i3 = row1 + c + 1;

          indices.push(i0, i1, i2);
          indices.push(i1, i3, i2);
        }
      }
    });

    return { positions, normals, uvs, barys, indices };
  }

  /**
   * Generates organic river ribbon with flowing banks and center expansion for water simulation
   */
  static createProceduralRiverRibbon(riverPath, baseWidth = 8.8) {
    const positions = [];
    const normals = [];
    const uvs = [];
    const barys = [];
    const indices = [];

    const rng = new PRNG(112233);
    const halfWidth = baseWidth * 0.5;

    let laneLength = 0;
    const segLengths = [];
    for (let i = 0; i < riverPath.length - 1; i++) {
      const d = Math.hypot(riverPath[i + 1][0] - riverPath[i][0], riverPath[i + 1][2] - riverPath[i][2]);
      segLengths.push(d);
      laneLength += d;
    }

    const stepDist = 1.2;
    let totalDist = 0;
    let currentSeg = 0;
    let distInSeg = 0;
    let crossSections = 0;

    while (totalDist <= laneLength) {
      while (currentSeg < segLengths.length - 1 && distInSeg > segLengths[currentSeg]) {
        distInSeg -= segLengths[currentSeg];
        currentSeg++;
      }

      const tSeg = Math.min(1.0, Math.max(0.0, distInSeg / Math.max(0.001, segLengths[currentSeg])));
      const p1 = riverPath[currentSeg];
      const p2 = riverPath[currentSeg + 1] || p1;

      const cx = p1[0] + (p2[0] - p1[0]) * tSeg;
      const cz = p1[2] + (p2[2] - p1[2]) * tSeg;

      const tdx = p2[0] - p1[0];
      const tdz = p2[2] - p1[2];
      const tLen = Math.hypot(tdx, tdz) || 1.0;
      const nx = -tdz / tLen;
      const nz = tdx / tLen;

      // Wider pool at the center of the map (ancient rune shrine)
      const centerProximity = Math.max(0.0, 1.0 - Math.hypot(cx, cz) / 32.0);
      const centerExpansion = centerProximity * 2.8;

      // Organic bank ripples
      const bankWobbleL = Math.sin(totalDist * 0.4) * 0.8 + Math.cos(totalDist * 1.2) * 0.4 + rng.range(-0.2, 0.2);
      const bankWobbleR = Math.cos(totalDist * 0.38) * 0.75 + Math.sin(totalDist * 1.3) * 0.45 + rng.range(-0.2, 0.2);

      const wL = halfWidth + centerExpansion + bankWobbleL;
      const wR = halfWidth + centerExpansion + bankWobbleR;

      // 4 vertices across river: Bank Left, Shallows Left, Shallows Right, Bank Right
      const vCols = [
        { off: -wL,        y: 0.018, u: 0.0 },
        { off: -wL * 0.45, y: 0.015, u: 0.35 },
        { off: wR * 0.45,  y: 0.015, u: 0.65 },
        { off: wR,         y: 0.018, u: 1.0 }
      ];

      for (let c = 0; c < 4; c++) {
        const col = vCols[c];
        positions.push(cx + nx * col.off, col.y, cz + nz * col.off);
        normals.push(0.0, 1.0, 0.0);
        uvs.push(col.u, totalDist * 0.15); // U across banks, V along river current
        barys.push(1, 0, 0);
      }

      crossSections++;
      totalDist += stepDist;
      distInSeg += stepDist;
    }

    for (let s = 0; s < crossSections - 1; s++) {
      const row0 = s * 4;
      const row1 = (s + 1) * 4;

      for (let c = 0; c < 3; c++) {
        const i0 = row0 + c;
        const i1 = row0 + c + 1;
        const i2 = row1 + c;
        const i3 = row1 + c + 1;

        indices.push(i0, i1, i2);
        indices.push(i1, i3, i2);
      }
    }

    return { positions, normals, uvs, barys, indices };
  }

  /**
   * Generates a wetland river reed / cattail tuft with extra aquatic geometry
   * Distinct from normal grass: tall tubular stalks with 3D cylindrical brown cattail heads & broad base leaves
   */
  static createRiverReedTuft(stalkCount = 5) {
    const positions = [];
    const normals = [];
    const uvs = [];
    const barys = [];
    const indices = [];

    const rng = new PRNG(88123);

    for (let s = 0; s < stalkCount; s++) {
      const angle = (s / stalkCount) * Math.PI * 2 + rng.range(-0.25, 0.25);
      const radOffset = rng.range(0.08, 0.22);
      const baseX = Math.cos(angle) * radOffset;
      const baseZ = Math.sin(angle) * radOffset;

      const totalH = rng.range(1.9, 2.6); // Taller than normal grass
      const curveX = Math.cos(angle) * rng.range(0.2, 0.45);
      const curveZ = Math.sin(angle) * rng.range(0.2, 0.45);

      // 1. Slender Reed Stalk (tapered cylinder segments)
      const stalkSegs = 6;
      const radialSegs = 5;
      const stalkBaseIdx = positions.length / 3;

      for (let y = 0; y <= stalkSegs; y++) {
        const t = y / stalkSegs;
        const curY = t * totalH;
        const offX = baseX + curveX * (t * t);
        const offZ = baseZ + curveZ * (t * t);
        const r = 0.032 * (1.0 - t * 0.45);

        for (let rIdx = 0; rIdx <= radialSegs; rIdx++) {
          const theta = (rIdx / radialSegs) * Math.PI * 2;
          const px = offX + Math.cos(theta) * r;
          const pz = offZ + Math.sin(theta) * r;

          positions.push(px, curY, pz);
          normals.push(Math.cos(theta), 0.25, Math.sin(theta));
          uvs.push(rIdx / radialSegs, t * 0.7); // v in [0, 0.7] = green stalk
          barys.push(rIdx % 2 === 0 ? 1 : 0, rIdx % 2 === 1 ? 1 : 0, 0);
        }
      }

      const rowStride = radialSegs + 1;
      for (let y = 0; y < stalkSegs; y++) {
        for (let rIdx = 0; rIdx < radialSegs; rIdx++) {
          const i0 = stalkBaseIdx + y * rowStride + rIdx;
          const i1 = i0 + 1;
          const i2 = stalkBaseIdx + (y + 1) * rowStride + rIdx;
          const i3 = i2 + 1;

          indices.push(i0, i2, i1);
          indices.push(i1, i2, i3);
        }
      }

      // 2. 3D Cattail Cylinder Head (Brown velvety bulrush head near the top)
      const catStartT = 0.68;
      const catEndT = 0.88;
      const catStartY = totalH * catStartT;
      const catEndY = totalH * catEndT;
      const catHeight = catEndY - catStartY;
      const catRad = 0.055;
      const catSegs = 4;
      const catBaseIdx = positions.length / 3;

      for (let cy = 0; cy <= catSegs; cy++) {
        const ct = cy / catSegs;
        const py = catStartY + ct * catHeight;
        const blendT = catStartT + ct * (catEndT - catStartT);
        const offX = baseX + curveX * (blendT * blendT);
        const offZ = baseZ + curveZ * (blendT * blendT);
        // Bulge in center of cattail
        const bulge = Math.sin(ct * Math.PI) * 0.02 + catRad;

        for (let rIdx = 0; rIdx <= radialSegs; rIdx++) {
          const theta = (rIdx / radialSegs) * Math.PI * 2;
          positions.push(offX + Math.cos(theta) * bulge, py, offZ + Math.sin(theta) * bulge);
          normals.push(Math.cos(theta), 0.1, Math.sin(theta));
          uvs.push(rIdx / radialSegs, 0.85 + ct * 0.15); // v in [0.85, 1.0] = brown cattail head
          barys.push(0, 1, 0);
        }
      }

      for (let cy = 0; cy < catSegs; cy++) {
        for (let rIdx = 0; rIdx < radialSegs; rIdx++) {
          const i0 = catBaseIdx + cy * rowStride + rIdx;
          const i1 = i0 + 1;
          const i2 = catBaseIdx + (cy + 1) * rowStride + rIdx;
          const i3 = i2 + 1;

          indices.push(i0, i2, i1);
          indices.push(i1, i2, i3);
        }
      }

      // 3. Broad arching aquatic blade leaves at waterline
      const leafCount = 2;
      for (let l = 0; l < leafCount; l++) {
        const leafAngle = angle + (l === 0 ? 0.8 : -0.8);
        const leafH = totalH * rng.range(0.45, 0.65);
        const leafCurve = rng.range(0.45, 0.7);
        const leafWidth = 0.065;
        const leafSegs = 4;
        const leafBaseIdx = positions.length / 3;

        for (let ly = 0; ly <= leafSegs; ly++) {
          const lt = ly / leafSegs;
          const py = lt * leafH;
          const lx = baseX + Math.cos(leafAngle) * (leafCurve * lt * lt);
          const lz = baseZ + Math.sin(leafAngle) * (leafCurve * lt * lt);
          const curW = leafWidth * (1.0 - lt * 0.85);

          const orthX = -Math.sin(leafAngle) * curW;
          const orthZ = Math.cos(leafAngle) * curW;

          positions.push(lx - orthX, py, lz - orthZ);
          positions.push(lx + orthX, py, lz + orthZ);
          normals.push(0, 0.9, 0);
          normals.push(0, 0.9, 0);
          uvs.push(0.0, lt * 0.5);
          uvs.push(1.0, lt * 0.5);
          barys.push(1, 0, 0, 0, 1, 0);
        }

        for (let ly = 0; ly < leafSegs; ly++) {
          const i0 = leafBaseIdx + ly * 2;
          const i1 = i0 + 1;
          const i2 = i0 + 2;
          const i3 = i0 + 3;
          indices.push(i0, i2, i1);
          indices.push(i1, i2, i3);
        }
      }
    }

    return { positions, normals, uvs, barys, indices };
  }

  /**
   * Generates a floating Water Lily Pad with a delicate lotus blossom
   */
  static createWaterLilyPad() {
    const positions = [];
    const normals = [];
    const uvs = [];
    const barys = [];
    const indices = [];

    // 1. Lily Pad Disc with V-notch slice
    const padRad = 0.42;
    const radialSegs = 14;
    const padCenterIdx = 0;
    positions.push(0, 0.015, 0);
    normals.push(0, 1, 0);
    uvs.push(0.5, 0.5);
    barys.push(1, 0, 0);

    // Leave a 35-degree slit for realistic water lily notch
    const startAngle = 0.35;
    const endAngle = Math.PI * 2 - 0.35;

    for (let i = 0; i <= radialSegs; i++) {
      const theta = startAngle + (i / radialSegs) * (endAngle - startAngle);
      const px = Math.cos(theta) * padRad;
      const pz = Math.sin(theta) * padRad;
      positions.push(px, 0.015, pz);
      normals.push(0, 1, 0);
      uvs.push(0.5 + Math.cos(theta) * 0.45, 0.5 + Math.sin(theta) * 0.45);
      barys.push(i % 2 === 0 ? 1 : 0, i % 2 === 1 ? 1 : 0, 0);
    }

    for (let i = 1; i <= radialSegs; i++) {
      indices.push(padCenterIdx, i, i + 1);
    }

    // 2. Lotus Blossom at center (Layered angled petals)
    const petalCount = 8;
    const petalBaseRad = 0.03;
    const petalTipRad = 0.16;
    const petalH = 0.09;

    for (let p = 0; p < petalCount; p++) {
      const pAngle = (p / petalCount) * Math.PI * 2;
      const pBaseIdx = positions.length / 3;

      const c = Math.cos(pAngle), s = Math.sin(pAngle);
      const orthX = -s * 0.045, orthZ = c * 0.045;

      // Base
      positions.push(c * petalBaseRad, 0.018, s * petalBaseRad);
      normals.push(c * 0.5, 0.86, s * 0.5);
      uvs.push(0.5, 0.5);
      barys.push(1, 0, 0);

      // Left petal edge
      positions.push(c * (petalTipRad * 0.6) + orthX, 0.018 + petalH * 0.6, s * (petalTipRad * 0.6) + orthZ);
      normals.push(c * 0.7, 0.6, s * 0.7);
      uvs.push(0.2, 0.8);
      barys.push(0, 1, 0);

      // Right petal edge
      positions.push(c * (petalTipRad * 0.6) - orthX, 0.018 + petalH * 0.6, s * (petalTipRad * 0.6) - orthZ);
      normals.push(c * 0.7, 0.6, s * 0.7);
      uvs.push(0.8, 0.8);
      barys.push(0, 0, 1);

      // Petal Tip
      positions.push(c * petalTipRad, 0.018 + petalH, s * petalTipRad);
      normals.push(c * 0.8, 0.5, s * 0.8);
      uvs.push(0.5, 1.0);
      barys.push(1, 0, 0);

      indices.push(pBaseIdx, pBaseIdx + 1, pBaseIdx + 2);
      indices.push(pBaseIdx + 1, pBaseIdx + 3, pBaseIdx + 2);
    }

    // 3. Central golden pistil/stamen dome
    const stamenCenter = positions.length / 3;
    positions.push(0, 0.018 + petalH * 0.75, 0);
    normals.push(0, 1, 0);
    uvs.push(0.5, 0.5);
    barys.push(1, 1, 0);

    const sSegs = 6;
    for (let s = 0; s <= sSegs; s++) {
      const theta = (s / sSegs) * Math.PI * 2;
      positions.push(Math.cos(theta) * 0.038, 0.018 + petalH * 0.55, Math.sin(theta) * 0.038);
      normals.push(Math.cos(theta), 0.7, Math.sin(theta));
      uvs.push(0.5, 0.5);
      barys.push(0, 1, 0);
    }
    for (let s = 1; s <= sSegs; s++) {
      indices.push(stamenCenter, stamenCenter + s, stamenCenter + s + 1);
    }

    return { positions, normals, uvs, barys, indices };
  }

  /**
   * Generates a multi-stem Wildflower Tuft with blooming blossoms
   */
  static createWildFlowerTuft(flowerCount = 4) {
    const positions = [];
    const normals = [];
    const uvs = [];
    const barys = [];
    const indices = [];

    const rng = new PRNG(77331);

    for (let f = 0; f < flowerCount; f++) {
      const fAngle = (f / flowerCount) * Math.PI * 2 + rng.range(-0.3, 0.3);
      const rad = rng.range(0.08, 0.22);
      const fx = Math.cos(fAngle) * rad;
      const fz = Math.sin(fAngle) * rad;
      const h = rng.range(0.45, 0.75);

      // Flower Stem
      const stemBaseIdx = positions.length / 3;
      const tiltX = Math.cos(fAngle) * 0.08;
      const tiltZ = Math.sin(fAngle) * 0.08;

      positions.push(fx - 0.018, 0, fz);
      positions.push(fx + 0.018, 0, fz);
      positions.push(fx + tiltX - 0.012, h, fz + tiltZ);
      positions.push(fx + tiltX + 0.012, h, fz + tiltZ);

      normals.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
      uvs.push(0, 0, 1, 0, 0, 0.5, 1, 0.5);
      barys.push(1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 0, 0);
      indices.push(stemBaseIdx, stemBaseIdx + 2, stemBaseIdx + 1);
      indices.push(stemBaseIdx + 1, stemBaseIdx + 2, stemBaseIdx + 3);

      // 5 Petals blossom atop the stem
      const blossomCenter = [fx + tiltX, h + 0.02, fz + tiltZ];
      const petalPetals = 5;
      const petalRad = rng.range(0.07, 0.11);

      for (let p = 0; p < petalPetals; p++) {
        const pAng = (p / petalPetals) * Math.PI * 2;
        const pIdx = positions.length / 3;

        const c = Math.cos(pAng), s = Math.sin(pAng);
        const orthX = -s * 0.035, orthZ = c * 0.035;

        positions.push(blossomCenter[0], blossomCenter[1], blossomCenter[2]);
        positions.push(blossomCenter[0] + c * (petalRad * 0.6) + orthX, blossomCenter[1] + 0.02, blossomCenter[2] + s * (petalRad * 0.6) + orthZ);
        positions.push(blossomCenter[0] + c * (petalRad * 0.6) - orthX, blossomCenter[1] + 0.02, blossomCenter[2] + s * (petalRad * 0.6) - orthZ);
        positions.push(blossomCenter[0] + c * petalRad, blossomCenter[1] + 0.01, blossomCenter[2] + s * petalRad);

        normals.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
        uvs.push(0.5, 0.5, 0.2, 0.8, 0.8, 0.8, 0.5, 1.0);
        barys.push(1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 0, 0);

        indices.push(pIdx, pIdx + 1, pIdx + 2);
        indices.push(pIdx + 1, pIdx + 3, pIdx + 2);
      }
    }

    return { positions, normals, uvs, barys, indices };
  }

  /**
   * Generates a cute 3D low-poly Frog geometry with perched eyes & folded legs
   */
  static createLittleFrog() {
    const positions = [];
    const normals = [];
    const uvs = [];
    const barys = [];
    const indices = [];

    // 1. Rounded low-poly Frog Torso (ellipsoid)
    const latSegs = 6;
    const lonSegs = 10;
    const rx = 0.22, ry = 0.16, rz = 0.28;

    for (let y = 0; y <= latSegs; y++) {
      const v = y / latSegs;
      const theta = v * Math.PI;
      const sinT = Math.sin(theta), cosT = Math.cos(theta);

      for (let x = 0; x <= lonSegs; x++) {
        const u = x / lonSegs;
        const phi = u * Math.PI * 2;
        const sinP = Math.sin(phi), cosP = Math.cos(phi);

        // Pear shape: slightly wider at rear (negative Z) and lower
        const taper = 1.0 - (cosP * 0.18);
        const px = cosP * rx * sinT * taper;
        const py = cosT * ry + 0.14; // resting on ground
        const pz = sinP * rz * sinT;

        positions.push(px, py, pz);
        const nx = px / rx, ny = (py - 0.14) / ry, nz = pz / rz;
        const nl = Math.hypot(nx, ny, nz) || 1;
        normals.push(nx / nl, ny / nl, nz / nl);
        uvs.push(u, v);
        barys.push((x + y) % 3 === 0 ? 1 : 0, (x + y) % 3 === 1 ? 1 : 0, (x + y) % 3 === 2 ? 1 : 0);
      }
    }

    const stride = lonSegs + 1;
    for (let y = 0; y < latSegs; y++) {
      for (let x = 0; x < lonSegs; x++) {
        const i0 = y * stride + x;
        const i1 = i0 + 1;
        const i2 = (y + 1) * stride + x;
        const i3 = i2 + 1;
        indices.push(i0, i2, i1);
        indices.push(i1, i2, i3);
      }
    }

    // 2. Perched Bulging Eyes (Left and Right)
    const eyeCenters = [
      [-0.09, 0.23, 0.14],
      [0.09, 0.23, 0.14]
    ];
    const eyeRad = 0.052;
    const eyeSegs = 6;

    for (const ec of eyeCenters) {
      const eyeBase = positions.length / 3;
      positions.push(ec[0], ec[1] + eyeRad, ec[2]);
      normals.push(0, 1, 0);
      uvs.push(0.5, 0.5);
      barys.push(1, 0, 0);

      for (let s = 0; s <= eyeSegs; s++) {
        const ang = (s / eyeSegs) * Math.PI * 2;
        const px = ec[0] + Math.cos(ang) * eyeRad;
        const pz = ec[2] + Math.sin(ang) * eyeRad;
        positions.push(px, ec[1], pz);
        normals.push(Math.cos(ang), 0.5, Math.sin(ang));
        uvs.push(0.5 + Math.cos(ang) * 0.4, 0.5 + Math.sin(ang) * 0.4);
        barys.push(0, 1, 0);
      }
      for (let s = 1; s <= eyeSegs; s++) {
        indices.push(eyeBase, eyeBase + s, eyeBase + s + 1);
      }
    }

    // 3. Folded Hind Legs (Left and Right side flanks)
    const hindLegs = [
      { side: -1, offset: [-0.19, 0.09, -0.09] },
      { side: 1, offset: [0.19, 0.09, -0.09] }
    ];

    for (const leg of hindLegs) {
      const lBase = positions.length / 3;
      const ox = leg.offset[0], oy = leg.offset[1], oz = leg.offset[2];
      const s = leg.side;

      // Leg joint pyramid/prism
      positions.push(ox, oy + 0.08, oz);
      positions.push(ox + s * 0.12, oy + 0.04, oz - 0.08);
      positions.push(ox + s * 0.08, 0.02, oz + 0.06);
      positions.push(ox + s * 0.14, 0.02, oz + 0.12); // Foot forward

      normals.push(s * 0.5, 0.8, -0.3, s * 0.8, 0.5, -0.3, s * 0.5, 0.8, 0.3, 0, 1, 0);
      uvs.push(0, 0, 1, 0, 0, 1, 1, 1);
      barys.push(1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 0, 0);

      indices.push(lBase, lBase + 1, lBase + 2);
      indices.push(lBase + 1, lBase + 3, lBase + 2);
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
    this.grass = [];
    this.riverReeds = [];
    this.waterLilies = [];
    this.wildFlowers = [];
    this.frogs = [];
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
   * Initializes the entire procedural layout (Expanded & Enlarged Map Layout)
   */
  initMapLayout() {
    if (this.initialized) return;
    this.initialized = true;

    // 1. Classic Dota 3-Lane Waypoint Definitions (Enlarged 35x35 extent map)
    // Top Lane: Curves north along west forest border, crosses top river corner, enters enemy base
    this.lanePaths.top = [
      [-35.0, 0, -35.0], // Red Base
      [-35.0, 0, -16.0], // Red Top Tier 2 Tower Area
      [-35.0, 0, 9.0],   // Red Top Tier 1 Tower Area
      [-26.0, 0, 26.0],  // River Top Shallows Crossing
      [-9.0, 0, 35.0],   // Black Top Tier 1 Tower Area
      [16.0, 0, 35.0],   // Black Top Tier 2 Tower Area
      [35.0, 0, 35.0]    // Black Base
    ];

    // Mid Lane: Classic straight diagonal through river bridge
    this.lanePaths.mid = [
      [-35.0, 0, -35.0], // Red Base
      [-22.0, 0, -22.0], // Red Mid Tier 2 Area
      [-11.0, 0, -11.0], // Red Mid Tier 1 Tower
      [0.0, 0, 0.0],     // River Center Shallows & Ancient Runes
      [11.0, 0, 11.0],   // Black Mid Tier 1 Tower
      [22.0, 0, 22.0],   // Black Mid Tier 2 Area
      [35.0, 0, 35.0]    // Black Base
    ];

    // Bottom Lane: Curves east along south forest border, crosses bottom river corner, enters enemy base
    this.lanePaths.bot = [
      [-35.0, 0, -35.0], // Red Base
      [-16.0, 0, -35.0], // Red Bot Tier 2 Tower Area
      [9.0, 0, -35.0],   // Red Bot Tier 1 Tower Area
      [26.0, 0, -26.0],  // River Bot Shallows Crossing
      [35.0, 0, -9.0],   // Black Bot Tier 1 Tower Area
      [35.0, 0, 16.0],   // Black Bot Tier 2 Tower Area
      [35.0, 0, 35.0]    // Black Base
    ];

    // River bed points (Enlarged across full map diagonal)
    this.riverPath = [
      [-48.0, 0, 48.0],
      [-25.0, 0, 25.0],
      [0.0, 0, 0.0],
      [25.0, 0, -25.0],
      [48.0, 0, -48.0]
    ];

    // 2. Defensive Towers for all 3 classic lanes (Scaled to enlarged map)
    this.towers = [
      // Top Lane
      { id: 'tower_red_top', team: 'RED', lane: 'top', pos: [-35.0, 0, 9.0], hp: 2400, maxHp: 2400, mp: 400, maxMp: 400, damage: 130, range: 15.0, attackTimer: 0 },
      { id: 'tower_black_top', team: 'BLACK', lane: 'top', pos: [-9.0, 0, 35.0], hp: 2400, maxHp: 2400, mp: 400, maxMp: 400, damage: 130, range: 15.0, attackTimer: 0 },
      // Mid Lane
      { id: 'tower_red_mid', team: 'RED', lane: 'mid', pos: [-11.0, 0, -11.0], hp: 2400, maxHp: 2400, mp: 400, maxMp: 400, damage: 130, range: 15.0, attackTimer: 0 },
      { id: 'tower_black_mid', team: 'BLACK', lane: 'mid', pos: [11.0, 0, 11.0], hp: 2400, maxHp: 2400, mp: 400, maxMp: 400, damage: 130, range: 15.0, attackTimer: 0 },
      // Bottom Lane
      { id: 'tower_red_bot', team: 'RED', lane: 'bot', pos: [9.0, 0, -35.0], hp: 2400, maxHp: 2400, mp: 400, maxMp: 400, damage: 130, range: 15.0, attackTimer: 0 },
      { id: 'tower_black_bot', team: 'BLACK', lane: 'bot', pos: [35.0, 0, -9.0], hp: 2400, maxHp: 2400, mp: 400, maxMp: 400, damage: 130, range: 15.0, attackTimer: 0 },
      // Base Guardian Towers
      { id: 'tower_red_base', team: 'RED', lane: 'base', pos: [-28.0, 0, -28.0], hp: 3000, maxHp: 3000, mp: 600, maxMp: 600, damage: 160, range: 16.0, attackTimer: 0 },
      { id: 'tower_black_base', team: 'BLACK', lane: 'base', pos: [28.0, 0, 28.0], hp: 3000, maxHp: 3000, mp: 600, maxMp: 600, damage: 160, range: 16.0, attackTimer: 0 }
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
  isPointInLaneOrSanctuary(x, z, laneClearance = 4.8) {
    // Red Base Sanctuary (scaled to enlarged map)
    if (Math.hypot(x - (-35.0), z - (-35.0)) < 11.5) return true;
    // Black Base Sanctuary (scaled to enlarged map)
    if (Math.hypot(x - 35.0, z - 35.0) < 11.5) return true;
    // Center River Rune Shrine
    if (Math.hypot(x, z) < 4.5) return true;

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
      if (Math.hypot(x - t.pos[0], z - t.pos[2]) < 4.8) return true;
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
    this.grass = [];

    const rng = new PRNG(998877);
    const treeTypes = ['oak', 'pine', 'willow', 'ancient_spire'];

    // Sample candidate spots across enlarged map (mapExtent 46.0)
    const mapExtent = 46.0;
    const step = 4.4;

    for (let gx = -mapExtent; gx <= mapExtent; gx += step) {
      for (let gz = -mapExtent; gz <= mapExtent; gz += step) {
        const jx = gx + rng.range(-1.4, 1.4);
        const jz = gz + rng.range(-1.4, 1.4);

        // Keep lanes and bases open
        if (this.isPointInLaneOrSanctuary(jx, jz, 5.0)) continue;

        // Check distance to existing trees (Poisson spacing scaled)
        let tooClose = false;
        for (const t of this.trees) {
          if (Math.hypot(jx - t.x, jz - t.z) < 4.4) {
            tooClose = true;
            break;
          }
        }
        if (tooClose) continue;

        // Determine tree archetype based on zone
        let type = 'oak';
        const distFromCenter = Math.hypot(jx, jz);

        if (distFromCenter > 38.0) {
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
          // Tight trunk cylinder collision radius (actual trunk base radius ~0.22 * scale)
          collisionRadius: Math.min(0.35, 0.22 * scale + 0.04)
        });

        // Place companion boulder near tree base with high probability (more rocky decoration)
        if (rng.next() < 0.65) {
          const bx = jx + rng.range(-2.8, 2.8);
          const bz = jz + rng.range(-2.8, 2.8);
          if (!this.isPointInLaneOrSanctuary(bx, bz, 3.2)) {
            this.boulders.push({
              x: bx,
              z: bz,
              scale: rng.range(0.55, 1.25), // varied larger sizes for better env
              rotY: rng.range(0, Math.PI * 2),
              color: [0.32, 0.34, 0.36]
            });
          }
        }
      }
    }

    // Procedural wild forest grass generation - Much higher density and coverage across enlarged map
    const grassRng = new PRNG(445566);
    const grassExtent = 47.0;
    const grassStep = 1.0; // ultra dense lush grass layout (3x more grass)
    for (let gx = -grassExtent; gx <= grassExtent; gx += grassStep) {
      for (let gz = -grassExtent; gz <= grassExtent; gz += grassStep) {
        const jx = gx + grassRng.range(-0.45, 0.45);
        const jz = gz + grassRng.range(-0.45, 0.45);

        // Keep lanes and core bases open, allow slightly closer on edges
        if (this.isPointInLaneOrSanctuary(jx, jz, 2.0)) continue;

        const scaleX = grassRng.range(0.18, 0.38); // grass tuft width
        const scaleY = grassRng.range(0.60, 1.45); // grass tuft height
        const rotY = grassRng.range(0, Math.PI * 2);

        const greenRoll = grassRng.next();
        let color = [0.12, 0.42, 0.16]; // Deep forest green
        if (greenRoll < 0.35) {
          color = [0.22, 0.52, 0.18]; // Vibrant green
        } else if (greenRoll < 0.70) {
          color = [0.28, 0.45, 0.14]; // Olive mossy green
        } else if (greenRoll < 0.85) {
          color = [0.16, 0.58, 0.22]; // Fresh spring green
        }

        this.grass.push({
          x: jx,
          z: jz,
          scaleX,
          scaleY,
          rotY,
          color
        });
      }
    }

    // 1. Procedural River Reeds (Aquatic grass with extra Cattail & aquatic leaf geometry in water/river)
    this.riverReeds = [];
    const reedRng = new PRNG(339911);
    for (let d = -45.0; d <= 45.0; d += 1.4) {
      // Along river diagonal (-d, d)
      const riverCenter = [-d, d];
      // Lateral offset across river bed (-3.2 to 3.2 m from centerline)
      const lateralOff = reedRng.range(-3.6, 3.6);
      // Unit normal perpendicular to river diagonal (-1, 1) is (1, 1) / sqrt(2)
      const invSqrt2 = 0.7071;
      const rx = riverCenter[0] + lateralOff * invSqrt2 + reedRng.range(-0.35, 0.35);
      const rz = riverCenter[1] + lateralOff * invSqrt2 + reedRng.range(-0.35, 0.35);

      // Keep center rune shrine clear
      if (Math.hypot(rx, rz) < 4.2) continue;

      this.riverReeds.push({
        x: rx,
        z: rz,
        scaleX: reedRng.range(0.35, 0.55),
        scaleY: reedRng.range(0.85, 1.35),
        rotY: reedRng.range(0, Math.PI * 2),
        color: [0.14, 0.46, 0.18] // Aquatic wetland green
      });
    }

    // 2. Floating Water Lily Pads with blooming Lotus Blossoms
    this.waterLilies = [];
    const lilyRng = new PRNG(552277);
    const lilyBlossomColors = [
      [0.98, 0.65, 0.82], // Lotus Pink
      [0.96, 0.96, 0.98], // Pure White
      [0.85, 0.72, 0.98], // Soft Lavender
      [0.99, 0.85, 0.55]  // Sunrise Golden
    ];
    for (let d = -40.0; d <= 40.0; d += 2.2) {
      const riverCenter = [-d, d];
      const lateralOff = lilyRng.range(-2.8, 2.8);
      const invSqrt2 = 0.7071;
      const lx = riverCenter[0] + lateralOff * invSqrt2 + lilyRng.range(-0.4, 0.4);
      const lz = riverCenter[1] + lateralOff * invSqrt2 + lilyRng.range(-0.4, 0.4);

      if (Math.hypot(lx, lz) < 4.5) continue;

      const blossomCol = lilyBlossomColors[Math.floor(lilyRng.next() * lilyBlossomColors.length)];
      this.waterLilies.push({
        x: lx,
        z: lz,
        scale: lilyRng.range(0.65, 1.15),
        rotY: lilyRng.range(0, Math.PI * 2),
        color: [0.12, 0.52, 0.22], // Pad deep green
        blossomColor: blossomCol
      });
    }

    // 3. Blooming Wildflower Clusters (Delicate colorful blossoms throughout forest)
    this.wildFlowers = [];
    const flowerRng = new PRNG(114488);
    const flowerPalettes = [
      [0.95, 0.22, 0.24], // Poppy Red
      [0.98, 0.85, 0.15], // Sunflower Gold
      [0.32, 0.55, 0.95], // Cornflower Blue
      [0.88, 0.35, 0.82], // Orchid Purple
      [0.95, 0.95, 0.98]  // Mountain Edelweiss White
    ];

    for (let gx = -42.0; gx <= 42.0; gx += 3.8) {
      for (let gz = -42.0; gz <= 42.0; gz += 3.8) {
        if (flowerRng.next() > 0.55) continue;
        const fx = gx + flowerRng.range(-1.4, 1.4);
        const fz = gz + flowerRng.range(-1.4, 1.4);

        if (this.isPointInLaneOrSanctuary(fx, fz, 2.2)) continue;
        // Don't place in deep river
        const distDiag = Math.abs(fx + fz) * 0.7071;
        if (distDiag < 3.2) continue;

        const fColor = flowerPalettes[Math.floor(flowerRng.next() * flowerPalettes.length)];
        this.wildFlowers.push({
          x: fx,
          z: fz,
          scale: flowerRng.range(0.7, 1.25),
          rotY: flowerRng.range(0, Math.PI * 2),
          color: fColor
        });
      }
    }

    // 4. Neutral Riverbank Frogs (Low-poly cute animated frogs)
    this.frogs = [];
    const frogRng = new PRNG(661144);
    for (let d = -38.0; d <= 38.0; d += 4.5) {
      // Place near riverbanks or shallows
      const riverCenter = [-d, d];
      // Place on left or right bank
      const side = frogRng.next() > 0.5 ? 1 : -1;
      const bankDist = side * frogRng.range(3.1, 4.8);
      const invSqrt2 = 0.7071;
      const frogX = riverCenter[0] + bankDist * invSqrt2 + frogRng.range(-0.5, 0.5);
      const frogZ = riverCenter[1] + bankDist * invSqrt2 + frogRng.range(-0.5, 0.5);

      if (this.isPointInLaneOrSanctuary(frogX, frogZ, 2.5)) continue;

      // Face towards river water
      const toWaterX = -frogX - frogZ;
      const rotY = Math.atan2(toWaterX, -frogX) + frogRng.range(-0.35, 0.35);

      this.frogs.push({
        id: `frog_${this.frogs.length}`,
        x: frogX,
        z: frogZ,
        scale: frogRng.range(0.65, 0.95),
        rotY,
        color: [0.18, 0.56, 0.16] // Vibrant moss frog green
      });
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
    // Cap effective unit collision radius against tree trunks so units don't snag on trees from far away
    const effUnitRadius = Math.min(unitRadius, 0.32);
    for (let i = 0; i < this.trees.length; i++) {
      const tree = this.trees[i];
      const dx = pos[0] - tree.x;
      const dz = pos[2] - tree.z;
      const dist = Math.hypot(dx, dz);
      // Realistic trunk-only collision radius (strictly matches trunk cylinder geometry)
      const treeR = tree.collisionRadius !== undefined
        ? Math.min(tree.collisionRadius, 0.25 * (tree.scale || 1.0) + 0.04)
        : 0.25;
      const minDist = effUnitRadius + treeR;
      if (dist < minDist && dist > 0.0001) {
        const push = minDist - dist;
        pos[0] += (dx / dist) * push;
        pos[2] += (dz / dist) * push;
      }
    }
  }
}

export const globalForestLayoutEngine = new ProceduralForestLayoutEngine();

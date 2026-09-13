/**
 * Sacred Geometry Mesh Factory for Fantasy MOBA Visuals
 * Generates mathematically rigorous sacred geometric circles, pentagrams,
 * hexagrams, Valknut triple-triangles, octagrams, heptagrams, Metatron lattices,
 * and magical shockwave spell meshes for heroes and magical abilities.
 */

function createLineQuad(p0, p1, width, positions, normals, uvs, barys, indices) {
  const dx = p1[0] - p0[0], dz = p1[1] - p0[1];
  const len = Math.hypot(dx, dz) || 1e-4;
  const nx = (-dz / len) * (width * 0.5);
  const nz = (dx / len) * (width * 0.5);

  const base = positions.length / 3;
  positions.push(
    p0[0] + nx, 0, p0[1] + nz,
    p0[0] - nx, 0, p0[1] - nz,
    p1[0] + nx, 0, p1[1] + nz,
    p1[0] - nx, 0, p1[1] - nz
  );
  normals.push(0, 1, 0,  0, 1, 0,  0, 1, 0,  0, 1, 0);
  uvs.push(0, 0,  1, 0,  0, 1,  1, 1);
  barys.push(1, 0, 0,  0, 1, 0,  0, 0, 1,  1, 0, 0);
  indices.push(base, base + 1, base + 2,  base + 2, base + 1, base + 3);
}

function createRingGeometry(innerR, outerR, segs, positions, normals, uvs, barys, indices) {
  const base = positions.length / 3;
  for (let i = 0; i <= segs; i++) {
    const theta = (i / segs) * Math.PI * 2;
    const cosT = Math.cos(theta), sinT = Math.sin(theta);
    positions.push(cosT * innerR, 0, sinT * innerR);
    positions.push(cosT * outerR, 0, sinT * outerR);
    normals.push(0, 1, 0,  0, 1, 0);
    uvs.push(i / segs, 0,  i / segs, 1);
    barys.push(1, 0, 0,  0, 1, 0);
  }
  for (let i = 0; i < segs; i++) {
    const i0 = base + i * 2;
    const o0 = base + i * 2 + 1;
    const i1 = base + (i + 1) * 2;
    const o1 = base + (i + 1) * 2 + 1;
    indices.push(i0, o0, i1,  i1, o0, o1);
  }
}

function createNodeDiamond(center, size, positions, normals, uvs, barys, indices) {
  const base = positions.length / 3;
  const s = size * 0.5;
  positions.push(
    center[0], 0, center[1] - s,
    center[0] + s, 0, center[1],
    center[0], 0, center[1] + s,
    center[0] - s, 0, center[1]
  );
  normals.push(0, 1, 0,  0, 1, 0,  0, 1, 0,  0, 1, 0);
  uvs.push(0.5, 0,  1, 0.5,  0.5, 1,  0, 0.5);
  barys.push(1, 0, 0,  0, 1, 0,  0, 0, 1,  1, 0, 0);
  indices.push(base, base + 1, base + 2,  base, base + 2, base + 3);
}

export class SacredGeometryFactory {
  /**
   * 1. ARISSA: Sacred Pentagram Magic Circle
   * Double outer concentric rings, 5-pointed star with inscribed golden-ratio diagonals,
   * inner concentric ring, and 5 perimeter node diamonds.
   */
  static createPentagramCircle(r = 1.0, w = 0.038) {
    const positions = [], normals = [], uvs = [], barys = [], indices = [];

    // Outer double ring
    createRingGeometry(r * 0.94, r, 48, positions, normals, uvs, barys, indices);
    createRingGeometry(r * 0.81, r * 0.84, 40, positions, normals, uvs, barys, indices);
    // Inner center ring
    createRingGeometry(r * 0.28, r * 0.31, 28, positions, normals, uvs, barys, indices);

    // 5-pointed star lines
    const starR = r * 0.81;
    const pts = [];
    for (let i = 0; i < 5; i++) {
      const a = i * ((Math.PI * 2) / 5) - Math.PI * 0.5;
      const pt = [Math.cos(a) * starR, Math.sin(a) * starR];
      pts.push(pt);
      createNodeDiamond(pt, w * 2.6, positions, normals, uvs, barys, indices);
    }
    const order = [0, 2, 4, 1, 3, 0];
    for (let i = 0; i < 5; i++) {
      createLineQuad(pts[order[i]], pts[order[i + 1]], w, positions, normals, uvs, barys, indices);
    }

    // Inscribed inverted mini-pentagram
    const innerStarR = r * 0.31;
    const innerPts = [];
    for (let i = 0; i < 5; i++) {
      const a = i * ((Math.PI * 2) / 5) + Math.PI * 0.5;
      innerPts.push([Math.cos(a) * innerStarR, Math.sin(a) * innerStarR]);
    }
    for (let i = 0; i < 5; i++) {
      createLineQuad(innerPts[order[i]], innerPts[order[i + 1]], w * 0.75, positions, normals, uvs, barys, indices);
    }

    return { positions, normals, uvs, barys, indices };
  }

  /**
   * 2. ERIKA: Sacred Hexagram / Seal of Solomon Magic Circle
   * Double outer concentric rings, 2 intertwined equilateral triangles (6-pointed star),
   * inscribed inner ring, central sacred node, and 6 outer rune diamonds.
   */
  static createHexagramCircle(r = 1.0, w = 0.038) {
    const positions = [], normals = [], uvs = [], barys = [], indices = [];

    // Outer double ring
    createRingGeometry(r * 0.94, r, 48, positions, normals, uvs, barys, indices);
    createRingGeometry(r * 0.82, r * 0.85, 42, positions, normals, uvs, barys, indices);
    // Inner concentric ring
    createRingGeometry(r * 0.44, r * 0.47, 32, positions, normals, uvs, barys, indices);

    const starR = r * 0.82;
    // Triangle A (Pointing Up)
    const tA = [];
    for (let i = 0; i < 3; i++) {
      const a = i * ((Math.PI * 2) / 3) - Math.PI * 0.5;
      const pt = [Math.cos(a) * starR, Math.sin(a) * starR];
      tA.push(pt);
      createNodeDiamond(pt, w * 2.5, positions, normals, uvs, barys, indices);
    }
    createLineQuad(tA[0], tA[1], w, positions, normals, uvs, barys, indices);
    createLineQuad(tA[1], tA[2], w, positions, normals, uvs, barys, indices);
    createLineQuad(tA[2], tA[0], w, positions, normals, uvs, barys, indices);

    // Triangle B (Pointing Down)
    const tB = [];
    for (let i = 0; i < 3; i++) {
      const a = i * ((Math.PI * 2) / 3) + Math.PI * 0.5;
      const pt = [Math.cos(a) * starR, Math.sin(a) * starR];
      tB.push(pt);
      createNodeDiamond(pt, w * 2.5, positions, normals, uvs, barys, indices);
    }
    createLineQuad(tB[0], tB[1], w, positions, normals, uvs, barys, indices);
    createLineQuad(tB[1], tB[2], w, positions, normals, uvs, barys, indices);
    createLineQuad(tB[2], tB[0], w, positions, normals, uvs, barys, indices);

    // Center focal diamond
    createNodeDiamond([0, 0], w * 3.5, positions, normals, uvs, barys, indices);

    return { positions, normals, uvs, barys, indices };
  }

  /**
   * 3. MONSTER: Valknut / Trinity of Triangles Sacred Circle
   * 3 interlocking equilateral triangles forming the Norse Valknut knot,
   * bounded by an outer runic wheel and inner power core.
   */
  static createTripleTriangleCircle(r = 1.0, w = 0.042) {
    const positions = [], normals = [], uvs = [], barys = [], indices = [];

    // Outer rings
    createRingGeometry(r * 0.93, r, 48, positions, normals, uvs, barys, indices);
    createRingGeometry(r * 0.81, r * 0.84, 40, positions, normals, uvs, barys, indices);

    // 3 interlocking triangles with radial offsets
    const offsetR = r * 0.22;
    const triR = r * 0.56;

    for (let k = 0; k < 3; k++) {
      const centerAngle = k * ((Math.PI * 2) / 3) - Math.PI * 0.5;
      const cx = Math.cos(centerAngle) * offsetR;
      const cz = Math.sin(centerAngle) * offsetR;

      const tPts = [];
      for (let i = 0; i < 3; i++) {
        const a = centerAngle + i * ((Math.PI * 2) / 3);
        const pt = [cx + Math.cos(a) * triR, cz + Math.sin(a) * triR];
        tPts.push(pt);
      }
      createLineQuad(tPts[0], tPts[1], w, positions, normals, uvs, barys, indices);
      createLineQuad(tPts[1], tPts[2], w, positions, normals, uvs, barys, indices);
      createLineQuad(tPts[2], tPts[0], w, positions, normals, uvs, barys, indices);

      // Node diamond at peak
      createNodeDiamond(tPts[0], w * 2.8, positions, normals, uvs, barys, indices);
    }

    // Central circular eye
    createRingGeometry(r * 0.12, r * 0.16, 20, positions, normals, uvs, barys, indices);

    return { positions, normals, uvs, barys, indices };
  }

  /**
   * 4. BOT: Octagram Quantum Star / Sacred Circuit Mandala
   * 2 interlocking squares (8-pointed star) with concentric tech-rune rings
   * and 8 radial bus traces.
   */
  static createOctagramCircle(r = 1.0, w = 0.038) {
    const positions = [], normals = [], uvs = [], barys = [], indices = [];

    // Outer double ring
    createRingGeometry(r * 0.94, r, 48, positions, normals, uvs, barys, indices);
    createRingGeometry(r * 0.77, r * 0.80, 40, positions, normals, uvs, barys, indices);
    createRingGeometry(r * 0.32, r * 0.35, 32, positions, normals, uvs, barys, indices);

    const starR = r * 0.77;
    // Square 1
    const sq1 = [];
    for (let i = 0; i < 4; i++) {
      const a = i * (Math.PI * 0.5);
      const pt = [Math.cos(a) * starR, Math.sin(a) * starR];
      sq1.push(pt);
      createNodeDiamond(pt, w * 2.4, positions, normals, uvs, barys, indices);
    }
    for (let i = 0; i < 4; i++) {
      createLineQuad(sq1[i], sq1[(i + 1) % 4], w, positions, normals, uvs, barys, indices);
    }

    // Square 2 (Rotated 45 degrees)
    const sq2 = [];
    for (let i = 0; i < 4; i++) {
      const a = i * (Math.PI * 0.5) + Math.PI * 0.25;
      const pt = [Math.cos(a) * starR, Math.sin(a) * starR];
      sq2.push(pt);
      createNodeDiamond(pt, w * 2.4, positions, normals, uvs, barys, indices);
    }
    for (let i = 0; i < 4; i++) {
      createLineQuad(sq2[i], sq2[(i + 1) % 4], w, positions, normals, uvs, barys, indices);
    }

    // 8 radial connector traces
    for (let i = 0; i < 8; i++) {
      const a = i * (Math.PI * 0.25);
      const pInner = [Math.cos(a) * (r * 0.35), Math.sin(a) * (r * 0.35)];
      const pOuter = [Math.cos(a) * (r * 0.94), Math.sin(a) * (r * 0.94)];
      createLineQuad(pInner, pOuter, w * 0.6, positions, normals, uvs, barys, indices);
    }

    // Central diamond core
    createNodeDiamond([0, 0], w * 3.6, positions, normals, uvs, barys, indices);

    return { positions, normals, uvs, barys, indices };
  }

  /**
   * 5. SKELETONZ: Sacred Heptagram / Necromantic 7-Star Circle
   * Acute 7-pointed star (vertex connection step 3), double concentric glyph rings,
   * 7 outer boundary runic nodes, and inner void core.
   */
  static createHeptagramCircle(r = 1.0, w = 0.038) {
    const positions = [], normals = [], uvs = [], barys = [], indices = [];

    // Outer double ring
    createRingGeometry(r * 0.94, r, 56, positions, normals, uvs, barys, indices);
    createRingGeometry(r * 0.82, r * 0.85, 49, positions, normals, uvs, barys, indices);
    createRingGeometry(r * 0.26, r * 0.29, 28, positions, normals, uvs, barys, indices);

    const starR = r * 0.82;
    const pts = [];
    for (let i = 0; i < 7; i++) {
      const a = i * ((Math.PI * 2) / 7) - Math.PI * 0.5;
      const pt = [Math.cos(a) * starR, Math.sin(a) * starR];
      pts.push(pt);
      createNodeDiamond(pt, w * 2.5, positions, normals, uvs, barys, indices);
    }

    // Connect 7-star with step of 3 for acute mystic rays
    let cur = 0;
    for (let i = 0; i < 7; i++) {
      const next = (cur + 3) % 7;
      createLineQuad(pts[cur], pts[next], w, positions, normals, uvs, barys, indices);
      cur = next;
    }

    return { positions, normals, uvs, barys, indices };
  }

  /**
   * 6. WOMAN MOBILE: Sacred Metatron's Cube / Flower of Life Lattice
   * 13 interconnected circles and 6-pointed hexagonal geometric lattice
   * with celestial concentric orbital boundaries.
   */
  static createMetatronCircle(r = 1.0, w = 0.035) {
    const positions = [], normals = [], uvs = [], barys = [], indices = [];

    // Outer boundary rings
    createRingGeometry(r * 0.94, r, 48, positions, normals, uvs, barys, indices);
    createRingGeometry(r * 0.78, r * 0.81, 42, positions, normals, uvs, barys, indices);
    createRingGeometry(r * 0.46, r * 0.49, 36, positions, normals, uvs, barys, indices);
    createRingGeometry(r * 0.18, r * 0.21, 24, positions, normals, uvs, barys, indices);

    // 6 Outer circle centers + 6 Inner circle centers + 1 Central
    const outerNodes = [];
    const outerR = r * 0.78;
    for (let i = 0; i < 6; i++) {
      const a = i * (Math.PI / 3) - Math.PI * 0.5;
      const pt = [Math.cos(a) * outerR, Math.sin(a) * outerR];
      outerNodes.push(pt);
      createNodeDiamond(pt, w * 2.4, positions, normals, uvs, barys, indices);
    }

    const innerNodes = [];
    const innerR = r * 0.46;
    for (let i = 0; i < 6; i++) {
      const a = i * (Math.PI / 3);
      const pt = [Math.cos(a) * innerR, Math.sin(a) * innerR];
      innerNodes.push(pt);
      createNodeDiamond(pt, w * 2.0, positions, normals, uvs, barys, indices);
    }

    // Connect all outer nodes in hexagon
    for (let i = 0; i < 6; i++) {
      createLineQuad(outerNodes[i], outerNodes[(i + 1) % 6], w, positions, normals, uvs, barys, indices);
    }
    // Connect outer nodes across diametrically (through center)
    for (let i = 0; i < 3; i++) {
      createLineQuad(outerNodes[i], outerNodes[i + 3], w * 0.85, positions, normals, uvs, barys, indices);
    }
    // Connect outer nodes to adjacent inner nodes
    for (let i = 0; i < 6; i++) {
      createLineQuad(outerNodes[i], innerNodes[i], w * 0.7, positions, normals, uvs, barys, indices);
      createLineQuad(outerNodes[i], innerNodes[(i + 5) % 6], w * 0.7, positions, normals, uvs, barys, indices);
    }

    createNodeDiamond([0, 0], w * 3.5, positions, normals, uvs, barys, indices);

    return { positions, normals, uvs, barys, indices };
  }

  /**
   * 7. SPELL VFX: Sacred Shockwave Nova (Area Blast Q & Spells)
   * 3-tiered expanding concentric geometric shockwave with 12 radial sunburst spikes
   * and an inscribed sacred rotating triangle mandala.
   */
  static createSacredNovaMesh(r = 1.0, w = 0.05) {
    const positions = [], normals = [], uvs = [], barys = [], indices = [];

    // Outer primary shockwave ring
    createRingGeometry(r * 0.90, r, 54, positions, normals, uvs, barys, indices);
    // Mid secondary compression ring
    createRingGeometry(r * 0.65, r * 0.70, 42, positions, normals, uvs, barys, indices);
    // Inner pulse ring
    createRingGeometry(r * 0.35, r * 0.40, 30, positions, normals, uvs, barys, indices);

    // 12 radial sunburst spikes
    for (let i = 0; i < 12; i++) {
      const a = i * ((Math.PI * 2) / 12);
      const isMajor = (i % 2 === 0);
      const rStart = r * (isMajor ? 0.35 : 0.65);
      const rEnd = r * (isMajor ? 1.08 : 0.92);
      const p0 = [Math.cos(a) * rStart, Math.sin(a) * rStart];
      const p1 = [Math.cos(a) * rEnd, Math.sin(a) * rEnd];
      createLineQuad(p0, p1, w * (isMajor ? 1.2 : 0.8), positions, normals, uvs, barys, indices);
    }

    // Inscribed triangle mandala in the center
    const triR = r * 0.65;
    const t0 = [0, -triR];
    const t1 = [Math.cos(Math.PI / 6) * triR, Math.sin(Math.PI / 6) * triR];
    const t2 = [-Math.cos(Math.PI / 6) * triR, Math.sin(Math.PI / 6) * triR];
    createLineQuad(t0, t1, w, positions, normals, uvs, barys, indices);
    createLineQuad(t1, t2, w, positions, normals, uvs, barys, indices);
    createLineQuad(t2, t0, w, positions, normals, uvs, barys, indices);

    return { positions, normals, uvs, barys, indices };
  }

  /**
   * 8. SPELL VFX: Sacred Geodesic Shield Dome (Barrier Field E)
   * 3D hemispherical geodesic energy dome with faceted glowing hexagons and triangles.
   */
  static createSacredShieldDome(radius = 1.6, rings = 7, segments = 16) {
    const positions = [], normals = [], uvs = [], barys = [], indices = [];

    for (let r = 0; r <= rings; r++) {
      const phi = (r / rings) * (Math.PI * 0.5); // 0 to 90 degrees (hemisphere)
      const sinPhi = Math.sin(phi);
      const cosPhi = Math.cos(phi);
      const y = cosPhi * radius;
      const ringRad = sinPhi * radius;

      for (let s = 0; s <= segments; s++) {
        const theta = (s / segments) * (Math.PI * 2);
        const cosTheta = Math.cos(theta);
        const sinTheta = Math.sin(theta);
        const x = cosTheta * ringRad;
        const z = sinTheta * ringRad;

        positions.push(x, y, z);
        const len = Math.hypot(x, y, z) || 1;
        normals.push(x / len, y / len, z / len);
        uvs.push(s / segments, r / rings);
        barys.push(r % 2 === 0 ? 1 : 0, s % 2 === 0 ? 1 : 0, 0);
      }
    }

    for (let r = 0; r < rings; r++) {
      for (let s = 0; s < segments; s++) {
        const i0 = r * (segments + 1) + s;
        const i1 = i0 + 1;
        const i2 = (r + 1) * (segments + 1) + s;
        const i3 = i2 + 1;
        indices.push(i0, i2, i1,  i1, i2, i3);
      }
    }

    return { positions, normals, uvs, barys, indices };
  }

  /**
   * 9. SPELL VFX: Grand Hollow Eclipse Ultimate Ritual Circle (Spell R)
   * Massive multi-tier ritual matrix: outer runic zodiac ring, rotating hexagram,
   * intersecting pentagram, radial power conduits, and dark energy core.
   */
  static createSacredUltimateCircle(r = 1.0, w = 0.045) {
    const positions = [], normals = [], uvs = [], barys = [], indices = [];

    // 4 Concentric boundary rings
    createRingGeometry(r * 0.95, r, 64, positions, normals, uvs, barys, indices);
    createRingGeometry(r * 0.88, r * 0.90, 60, positions, normals, uvs, barys, indices);
    createRingGeometry(r * 0.58, r * 0.61, 48, positions, normals, uvs, barys, indices);
    createRingGeometry(r * 0.28, r * 0.31, 36, positions, normals, uvs, barys, indices);

    // Outer 16 radial glyph tick marks
    for (let i = 0; i < 16; i++) {
      const a = i * ((Math.PI * 2) / 16);
      const p0 = [Math.cos(a) * (r * 0.90), Math.sin(a) * (r * 0.90)];
      const p1 = [Math.cos(a) * (r * 0.95), Math.sin(a) * (r * 0.95)];
      createLineQuad(p0, p1, w * 1.4, positions, normals, uvs, barys, indices);
    }

    // Mid Hexagram (Triangle A + B)
    const hexR = r * 0.88;
    const tA = [], tB = [];
    for (let i = 0; i < 3; i++) {
      const aA = i * ((Math.PI * 2) / 3) - Math.PI * 0.5;
      const aB = i * ((Math.PI * 2) / 3) + Math.PI * 0.5;
      tA.push([Math.cos(aA) * hexR, Math.sin(aA) * hexR]);
      tB.push([Math.cos(aB) * hexR, Math.sin(aB) * hexR]);
    }
    for (let i = 0; i < 3; i++) {
      createLineQuad(tA[i], tA[(i + 1) % 3], w, positions, normals, uvs, barys, indices);
      createLineQuad(tB[i], tB[(i + 1) % 3], w, positions, normals, uvs, barys, indices);
    }

    // Inner Pentagram (5-star) inside the mid ring
    const starR = r * 0.58;
    const pts = [];
    for (let i = 0; i < 5; i++) {
      const a = i * ((Math.PI * 2) / 5) - Math.PI * 0.5;
      pts.push([Math.cos(a) * starR, Math.sin(a) * starR]);
    }
    const order = [0, 2, 4, 1, 3, 0];
    for (let i = 0; i < 5; i++) {
      createLineQuad(pts[order[i]], pts[order[i + 1]], w, positions, normals, uvs, barys, indices);
    }

    // Center focal diamond
    createNodeDiamond([0, 0], w * 4.5, positions, normals, uvs, barys, indices);

    return { positions, normals, uvs, barys, indices };
  }
}

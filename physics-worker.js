// 🟢 Physics Solver Web Worker for 3D Plinko Cascade
// Offloads heavy physics, collision detection, and multi-engine math from the main thread.

let world = {
  engine: 'classic2d', // 'classic2d' | 'jolt' | 'cannon' | 'ammo'
  pegs: [],
  rows: 8,
  gravity: -4.0,
  bounciness: 0.55,
  balls: [],
  bounds: { minX: -0.92, maxX: 0.92, minY: 0.41, maxY: 2.6 },
  roulette: {
    active: false,
    wheelAngle: 0.0,
    wheelSpeed: -2.8,
    ball: null,
    pockets: 37,
    bounciness: 0.58
  }
};

// Handle incoming messages from the main thread
self.onmessage = function(e) {
  const data = e.data;
  if (!data) return;

  switch (data.type) {
    case 'init':
      world.pegs = data.pegs || [];
      world.rows = data.rows || 8;
      world.gravity = data.gravity !== undefined ? data.gravity : -4.0;
      world.bounciness = data.bounciness !== undefined ? data.bounciness : 0.55;
      world.balls = [];
      break;

    case 'updateSettings':
      if (data.gravity !== undefined) world.gravity = data.gravity;
      if (data.bounciness !== undefined) world.bounciness = data.bounciness;
      break;

    case 'setEngine':
      world.engine = data.engine || 'classic2d';
      break;

    case 'dropBall':
      world.balls.push({
        id: data.id,
        pos: [data.pos[0], data.pos[1], data.pos[2] || 0.0],
        vel: [data.vel[0], data.vel[1], data.vel[2] || 0.0],
        radius: data.radius || 0.032,
        color: data.color || [1, 1, 1],
        lastPegHitId: '',
        rot: [0, 0, 0], // Angular orientation
        angVel: [0, 0, 0], // Angular velocity
        age: 0
      });
      break;

    case 'reset':
      world.balls = [];
      if (world.roulette) {
        world.roulette.ball = null;
      }
      break;

    case 'initRoulette':
      world.roulette = {
        active: true,
        wheelAngle: data.wheelAngle !== undefined ? data.wheelAngle : 0.0,
        wheelSpeed: -1.2,
        ball: {
          r: 0.68,
          theta: 0.0,
          z: 0.026,
          vr: 0.0,
          vTheta: 0.0,
          vz: 0.0,
          phase: 'trapped',
          rot: [0, 0, 0],
          pocketIndex: 0,
          trapped: true,
          circlesCompleted: 0,
          clatterTimer: 0,
          pos: [0.68, 0.0, 0.026],
          vel: [0, 0, 0]
        },
        pockets: 37,
        bounciness: 0.58
      };
      break;

    case 'spinRoulette':
      const startAngle = Math.random() * 2 * Math.PI;
      // High initial tangential launch speed along the upper rim
      const initialTangentialSpeed = 5.2 + Math.random() * 1.0;
      if (world.roulette) {
        world.roulette.active = true;
        world.roulette.wheelSpeed = -2.8 - Math.random() * 0.8;
        world.roulette.ball = {
          r: 1.10, // Outer rim track
          theta: startAngle,
          z: 0.20,
          vr: 0.0,
          vTheta: initialTangentialSpeed,
          vz: 0.0,
          phase: 'rim',
          rot: [0, 0, 0],
          pocketIndex: -1,
          trapped: false,
          circlesCompleted: 0,
          clatterTimer: 0,
          pos: [1.10 * Math.cos(startAngle), 1.10 * Math.sin(startAngle), 0.20],
          vel: [-initialTangentialSpeed * Math.sin(startAngle), initialTangentialSpeed * Math.cos(startAngle), 0.0]
        };
      }
      break;

    case 'tick':
      const dt = Math.min(data.dt || 0.016, 0.1); // Cap delta time to prevent giant leaps
      const result = stepPhysics(dt);
      let rouletteResult = null;
      if (world.roulette && world.roulette.active) {
        rouletteResult = stepRoulettePhysics(dt);
      }
      self.postMessage({
        type: 'tickResult',
        balls: result.balls,
        hits: result.hits,
        roulette: rouletteResult
      });
      break;
  }
};

// Core physics integration dispatcher
function stepPhysics(dt) {
  const hits = [];
  const activeBalls = [];

  // Filter out balls that fell below the bins
  for (let i = 0; i < world.balls.length; i++) {
    const b = world.balls[i];
    b.age += dt;

    // Simulate based on selected physics engine
    let hitPeg = null;
    if (world.engine === 'cannon') {
      hitPeg = stepCannon3D(b, dt);
    } else if (world.engine === 'jolt') {
      hitPeg = stepJolt3D(b, dt);
    } else if (world.engine === 'ammo') {
      hitPeg = stepAmmoCCD(b, dt);
    } else {
      hitPeg = stepClassic2D(b, dt);
    }

    if (hitPeg) {
      hits.push({
        ballId: b.id,
        pegId: hitPeg.id,
        x: hitPeg.x,
        y: hitPeg.y,
        color: b.color
      });
    }

    // Keep ball if it is above the deletion threshold (Y = 0.38)
    if (b.pos[1] > 0.38) {
      activeBalls.push(b);
    }
  }

  world.balls = activeBalls;

  return {
    balls: activeBalls.map(b => ({
      id: b.id,
      pos: b.pos,
      vel: b.vel,
      rot: b.rot,
      angVel: b.angVel
    })),
    hits: hits
  };
}

// ----------------------------------------------------
// SOLVER 1: Classic 2D Plinko Physics
// ----------------------------------------------------
function stepClassic2D(b, dt) {
  // Apply Gravity
  b.vel[1] += world.gravity * dt;
  
  // Damping
  b.vel[0] *= Math.exp(-0.15 * dt);
  b.vel[1] *= Math.exp(-0.05 * dt);

  // Position Step
  b.pos[0] += b.vel[0] * dt;
  b.pos[1] += b.vel[1] * dt;
  b.pos[2] = 0.0; // Stay strictly on flat 2D plane

  // Side Wall Collisions
  const wallLimit = 0.94 - b.radius;
  if (b.pos[0] < -wallLimit) {
    b.pos[0] = -wallLimit;
    b.vel[0] = -b.vel[0] * world.bounciness;
  } else if (b.pos[0] > wallLimit) {
    b.pos[0] = wallLimit;
    b.vel[0] = -b.vel[0] * world.bounciness;
  }

  // Peg Collision Resolution
  let closestPeg = null;
  let minPegDist = 999.0;
  
  for (let j = 0; j < world.pegs.length; j++) {
    const peg = world.pegs[j];
    const dx = b.pos[0] - peg.x;
    const dy = b.pos[1] - peg.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < minPegDist) {
      minPegDist = d;
      closestPeg = peg;
    }
  }

  const pegRadius = 0.024;
  const collisionRadius = b.radius + pegRadius;
  let returnedHitPeg = null;

  if (closestPeg && minPegDist < collisionRadius) {
    const dx = b.pos[0] - closestPeg.x;
    const dy = b.pos[1] - closestPeg.y;
    const nLen = minPegDist > 0.0001 ? minPegDist : 0.0001;
    const nx = dx / nLen;
    const ny = dy / nLen;

    // Resolve overlap
    b.pos[0] = closestPeg.x + nx * collisionRadius;
    b.pos[1] = closestPeg.y + ny * collisionRadius;

    // Bouncing impulse
    const dot = b.vel[0] * nx + b.vel[1] * ny;
    if (dot < 0) {
      b.vel[0] = b.vel[0] - (1.0 + world.bounciness) * dot * nx;
      b.vel[1] = b.vel[1] - (1.0 + world.bounciness) * dot * ny;
      
      // Inject slight random dispersion to clear stackings
      b.vel[0] += (Math.random() - 0.5) * 0.18;
    }

    if (b.lastPegHitId !== closestPeg.id) {
      b.lastPegHitId = closestPeg.id;
      returnedHitPeg = closestPeg;
    }
  } else if (closestPeg && minPegDist > collisionRadius + 0.05) {
    if (b.lastPegHitId === closestPeg.id) {
      b.lastPegHitId = '';
    }
  }

  return returnedHitPeg;
}

// ----------------------------------------------------
// SOLVER 2: Cannon 3D Rigid-Body Solver (Simulated)
// ----------------------------------------------------
function stepCannon3D(b, dt) {
  // Cannon 3D simulation adds depth variance, glass collisions, and rotational torque
  b.vel[1] += world.gravity * dt;
  
  // High damping for rigid body feel
  b.vel[0] *= Math.exp(-0.18 * dt);
  b.vel[1] *= Math.exp(-0.06 * dt);
  b.vel[2] *= Math.exp(-0.35 * dt); // Back-to-plane damping

  // Rotation Euler steps
  b.rot[0] += b.angVel[0] * dt;
  b.rot[1] += b.angVel[1] * dt;
  b.rot[2] += b.angVel[2] * dt;

  // Integrate positions
  b.pos[0] += b.vel[0] * dt;
  b.pos[1] += b.vel[1] * dt;
  b.pos[2] += b.vel[2] * dt;

  // Glass panel enclosure boundaries (Z: front/back)
  const glassBoundary = 0.04;
  if (b.pos[2] < -glassBoundary) {
    b.pos[2] = -glassBoundary;
    b.vel[2] = -b.vel[2] * world.bounciness * 0.6;
    b.angVel[0] += b.vel[1] * 0.5; // Friction adds angular velocity
  } else if (b.pos[2] > glassBoundary) {
    b.pos[2] = glassBoundary;
    b.vel[2] = -b.vel[2] * world.bounciness * 0.6;
    b.angVel[0] -= b.vel[1] * 0.5;
  }

  // Side boundaries
  const wallLimit = 0.94 - b.radius;
  if (b.pos[0] < -wallLimit) {
    b.pos[0] = -wallLimit;
    b.vel[0] = -b.vel[0] * world.bounciness;
    b.angVel[2] = -b.vel[1] * 3.0; // Bouncing generates spin
  } else if (b.pos[0] > wallLimit) {
    b.pos[0] = wallLimit;
    b.vel[0] = -b.vel[0] * world.bounciness;
    b.angVel[2] = b.vel[1] * 3.0;
  }

  // Cylinder Peg Collisions in 3D (Pegs are cylinders aligned along Z-axis)
  let closestPeg = null;
  let minPegDist = 999.0;
  
  for (let j = 0; j < world.pegs.length; j++) {
    const peg = world.pegs[j];
    const dx = b.pos[0] - peg.x;
    const dy = b.pos[1] - peg.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < minPegDist) {
      minPegDist = d;
      closestPeg = peg;
    }
  }

  const pegRadius = 0.024;
  const collisionRadius = b.radius + pegRadius;
  let returnedHitPeg = null;

  if (closestPeg && minPegDist < collisionRadius) {
    // 3D vector normal
    const dx = b.pos[0] - closestPeg.x;
    const dy = b.pos[1] - closestPeg.y;
    const dz = b.pos[2] || 0.0; // Distance to the cylinder center line

    const planeLen = Math.sqrt(dx * dx + dy * dy);
    const nx = dx / (planeLen || 0.0001);
    const ny = dy / (planeLen || 0.0001);
    const nz = dz * 3.0; // 3D deflection factor

    // Normalize 3D vector
    const len3d = Math.sqrt(nx*nx + ny*ny + nz*nz);
    const n3x = nx / len3d;
    const n3y = ny / len3d;
    const n3z = nz / len3d;

    // Push out in 3D
    b.pos[0] = closestPeg.x + nx * collisionRadius;
    b.pos[1] = closestPeg.y + ny * collisionRadius;
    b.pos[2] += n3z * 0.01;

    // Cannon Impulse Resolution
    const dot = b.vel[0] * n3x + b.vel[1] * n3y + b.vel[2] * n3z;
    if (dot < 0) {
      const impulse = -(1.0 + world.bounciness) * dot;
      b.vel[0] += impulse * n3x;
      b.vel[1] += impulse * n3y;
      b.vel[2] += impulse * n3z * 0.5;

      // Add angular torque based on friction of collision
      b.angVel[0] += (b.vel[1] * n3z - b.vel[2] * n3y) * 2.0;
      b.angVel[1] += (b.vel[2] * n3x - b.vel[0] * n3z) * 2.0;
      b.angVel[2] += (b.vel[0] * n3y - b.vel[1] * n3x) * 2.0;

      // Random perturbation to break perfect symmetries
      b.vel[0] += (Math.random() - 0.5) * 0.12;
      b.vel[2] += (Math.random() - 0.5) * 0.15;
    }

    if (b.lastPegHitId !== closestPeg.id) {
      b.lastPegHitId = closestPeg.id;
      returnedHitPeg = closestPeg;
    }
  } else if (closestPeg && minPegDist > collisionRadius + 0.05) {
    if (b.lastPegHitId === closestPeg.id) {
      b.lastPegHitId = '';
    }
  }

  return returnedHitPeg;
}

// ----------------------------------------------------
// SOLVER 3: Jolt 3D Solver (Simulated Sub-steps)
// ----------------------------------------------------
function stepJolt3D(b, dt) {
  // Jolt features highly stabilized solver iterations to eliminate overlapping jitter
  const SUB_STEPS = 4;
  const sDt = dt / SUB_STEPS;
  let returnedHitPeg = null;

  for (let s = 0; s < SUB_STEPS; s++) {
    // Apply gravity
    b.vel[1] += world.gravity * sDt;

    // Drag / friction
    b.vel[0] *= Math.exp(-0.1 * sDt);
    b.vel[1] *= Math.exp(-0.04 * sDt);
    b.vel[2] *= Math.exp(-0.25 * sDt);

    // Positions step
    b.pos[0] += b.vel[0] * sDt;
    b.pos[1] += b.vel[1] * sDt;
    b.pos[2] += b.vel[2] * sDt;

    // High spin
    b.rot[0] += b.angVel[0] * sDt;
    b.rot[1] += b.angVel[1] * sDt;
    b.rot[2] += b.angVel[2] * sDt;

    // Walls
    const wallLimit = 0.94 - b.radius;
    if (b.pos[0] < -wallLimit) {
      b.pos[0] = -wallLimit;
      b.vel[0] = -b.vel[0] * world.bounciness;
      b.angVel[2] = -b.vel[1] * 2.0;
    } else if (b.pos[0] > wallLimit) {
      b.pos[0] = wallLimit;
      b.vel[0] = -b.vel[0] * world.bounciness;
      b.angVel[2] = b.vel[1] * 2.0;
    }

    // Back & Front glass
    const glassBoundary = 0.035;
    if (b.pos[2] < -glassBoundary) {
      b.pos[2] = -glassBoundary;
      b.vel[2] = -b.vel[2] * world.bounciness * 0.7;
    } else if (b.pos[2] > glassBoundary) {
      b.pos[2] = glassBoundary;
      b.vel[2] = -b.vel[2] * world.bounciness * 0.7;
    }

    // Peg cylinder collisions
    let closestPeg = null;
    let minPegDist = 999.0;
    for (let j = 0; j < world.pegs.length; j++) {
      const peg = world.pegs[j];
      const dx = b.pos[0] - peg.x;
      const dy = b.pos[1] - peg.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < minPegDist) {
        minPegDist = d;
        closestPeg = peg;
      }
    }

    const pegRadius = 0.024;
    const collisionRadius = b.radius + pegRadius;

    if (closestPeg && minPegDist < collisionRadius) {
      const dx = b.pos[0] - closestPeg.x;
      const dy = b.pos[1] - closestPeg.y;
      const nx = dx / (minPegDist || 0.0001);
      const ny = dy / (minPegDist || 0.0001);

      // Jolt manifold stabilization: instantaneous overlap resolution
      b.pos[0] = closestPeg.x + nx * collisionRadius;
      b.pos[1] = closestPeg.y + ny * collisionRadius;
      
      // Deflect on Z
      const deflectionZ = (Math.random() - 0.5) * 0.08;
      b.pos[2] += deflectionZ * sDt;

      const dot = b.vel[0] * nx + b.vel[1] * ny;
      if (dot < 0) {
        // High elastic restitution bounce
        const restitution = world.bounciness * 1.05; 
        b.vel[0] = b.vel[0] - (1.0 + restitution) * dot * nx;
        b.vel[1] = b.vel[1] - (1.0 + restitution) * dot * ny;
        b.vel[2] += deflectionZ * 2.0;

        // Apply angular velocity spin
        b.angVel[0] += (Math.random() - 0.5) * 4.0;
        b.angVel[1] += (Math.random() - 0.5) * 4.0;
        b.angVel[2] += (b.vel[0] * ny - b.vel[1] * nx) * 1.2;
      }

      if (b.lastPegHitId !== closestPeg.id) {
        b.lastPegHitId = closestPeg.id;
        returnedHitPeg = closestPeg;
      }
    } else if (closestPeg && minPegDist > collisionRadius + 0.05) {
      if (b.lastPegHitId === closestPeg.id) {
        b.lastPegHitId = '';
      }
    }
  }

  return returnedHitPeg;
}

// ----------------------------------------------------
// SOLVER 4: Ammo Continuous Collision Solver (CCD)
// ----------------------------------------------------
function stepAmmoCCD(b, dt) {
  // CCD sweeps ahead along the movement vector to guarantee no peg tunneling
  const prevX = b.pos[0];
  const prevY = b.pos[1];
  const prevZ = b.pos[2];

  // Primary Euler motion step
  b.vel[1] += world.gravity * dt;
  b.vel[0] *= Math.exp(-0.16 * dt);
  b.vel[1] *= Math.exp(-0.05 * dt);
  b.vel[2] *= Math.exp(-0.3 * dt);

  const nextX = prevX + b.vel[0] * dt;
  const nextY = prevY + b.vel[1] * dt;
  const nextZ = prevZ + b.vel[2] * dt;

  // Let's sweep and search for the earliest peg intersection along this path segment
  let hitPeg = null;
  let hitT = 1.0;
  let pegRadius = 0.024;
  const collisionRadius = b.radius + pegRadius;

  for (let j = 0; j < world.pegs.length; j++) {
    const peg = world.pegs[j];
    // Find closest point on segment from (prevX, prevY) to (nextX, nextY) to the peg (peg.x, peg.y)
    const segX = nextX - prevX;
    const segY = nextY - prevY;
    const pegSegX = peg.x - prevX;
    const pegSegY = peg.y - prevY;

    const segLenSq = segX * segX + segY * segY;
    let t = 0;
    if (segLenSq > 0.000001) {
      t = Math.max(0, Math.min(1, (pegSegX * segX + pegSegY * segY) / segLenSq));
    }

    const closestOnSegX = prevX + t * segX;
    const closestOnSegY = prevY + t * segY;

    const dx = closestOnSegX - peg.x;
    const dy = closestOnSegY - peg.y;
    const distSq = dx * dx + dy * dy;

    if (distSq < collisionRadius * collisionRadius) {
      if (t < hitT) {
        hitT = t;
        hitPeg = peg;
      }
    }
  }

  let returnedHitPeg = null;

  if (hitPeg) {
    // Ammo CCD collision resolution
    // Resolve location back to the exact contact sweep moment
    b.pos[0] = prevX + b.vel[0] * dt * hitT;
    b.pos[1] = prevY + b.vel[1] * dt * hitT;
    b.pos[2] = prevZ + b.vel[2] * dt * hitT;

    const dx = b.pos[0] - hitPeg.x;
    const dy = b.pos[1] - hitPeg.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 0.0001;
    const nx = dx / dist;
    const ny = dy / dist;

    // Push out safely
    b.pos[0] = hitPeg.x + nx * collisionRadius;
    b.pos[1] = hitPeg.y + ny * collisionRadius;

    // Reflect velocity
    const dot = b.vel[0] * nx + b.vel[1] * ny;
    if (dot < 0) {
      b.vel[0] = b.vel[0] - (1.0 + world.bounciness) * dot * nx;
      b.vel[1] = b.vel[1] - (1.0 + world.bounciness) * dot * ny;

      // Add rotational momentum and angular effects
      b.angVel[0] += (Math.random() - 0.5) * 3.0;
      b.angVel[1] += (Math.random() - 0.5) * 3.0;
      b.angVel[2] += (b.vel[0] * ny - b.vel[1] * nx) * 1.5;

      // Small bounce deflection
      b.pos[2] += (Math.random() - 0.5) * 0.01;
      b.vel[2] += (Math.random() - 0.5) * 0.1;
    }

    if (b.lastPegHitId !== hitPeg.id) {
      b.lastPegHitId = hitPeg.id;
      returnedHitPeg = hitPeg;
    }
  } else {
    // No intersection found, update positions fully
    b.pos[0] = nextX;
    b.pos[1] = nextY;
    b.pos[2] = nextZ;

    // Spin rotations
    b.rot[0] += b.angVel[0] * dt;
    b.rot[1] += b.angVel[1] * dt;
    b.rot[2] += b.angVel[2] * dt;
  }

  // Enforce walls
  const wallLimit = 0.94 - b.radius;
  if (b.pos[0] < -wallLimit) {
    b.pos[0] = -wallLimit;
    b.vel[0] = -b.vel[0] * world.bounciness;
    b.angVel[2] = -b.vel[1] * 3.0;
  } else if (b.pos[0] > wallLimit) {
    b.pos[0] = wallLimit;
    b.vel[0] = -b.vel[0] * world.bounciness;
    b.angVel[2] = b.vel[1] * 3.0;
  }

  return returnedHitPeg;
}

// ----------------------------------------------------
// ROULETTE SIMULATION PHYSICS ENGINE (3D ANALYTICAL)
// ----------------------------------------------------
function stepRoulettePhysics(dt) {
  const r = world.roulette;
  if (!r || !r.active) return null;

  // 1. Slow down the wheel speed gradually over time
  r.wheelSpeed *= Math.exp(-0.025 * dt);
  if (Math.abs(r.wheelSpeed) < 0.6) {
    r.wheelSpeed = -0.6; // gentle continuous idle
  }
  r.wheelAngle = (r.wheelAngle + r.wheelSpeed * dt) % (2 * Math.PI);

  const b = r.ball;
  if (!b) return { wheelAngle: r.wheelAngle, ball: null, hitSound: null, winPocket: null };

  let hitSound = null;
  let winPocket = null;

  if (b.trapped) {
    // Ball sits inside pocket, locked to rotating coordinate
    const targetAngle = r.wheelAngle + b.pocketIndex * (2 * Math.PI / 37) + (Math.PI / 37);
    b.r = 0.68;
    b.z = 0.026;
    b.pos[0] = b.r * Math.cos(targetAngle);
    b.pos[1] = b.r * Math.sin(targetAngle);
    b.pos[2] = b.z;
    b.vel = [0, 0, 0];
    b.rot[2] = targetAngle;
  } else if (b.phase === 'rim') {
    // PHASE 1: BALL ROLLING AROUND UPPER RIM TRACK (MULTIPLE CIRCLES)
    // Held against outer rim track by centrifugal force at r = 1.10
    const omega = b.vTheta / b.r;
    b.theta += omega * dt;
    b.circlesCompleted = (b.circlesCompleted || 0) + (omega * dt) / (2 * Math.PI);

    // Track friction gradually slows down the ball
    b.vTheta *= Math.exp(-0.16 * dt);

    // Subtle rolling clatter sound periodically
    b.clatterTimer = (b.clatterTimer || 0) + dt;
    if (b.clatterTimer > 0.32) {
      b.clatterTimer = 0;
      hitSound = 'ammo'; // rim roll sound
    }

    // When speed drops below 2.4 m/s AND at least ~3 circles completed,
    // gravity overcomes centrifugal force, pulling ball down the slope!
    if (b.vTheta < 2.4 || b.circlesCompleted > 4.5) {
      b.phase = 'slope';
      b.vr = -0.3; // initial inward radial velocity
      hitSound = 'rim';
    }

    b.pos[0] = b.r * Math.cos(b.theta);
    b.pos[1] = b.r * Math.sin(b.theta);
    b.pos[2] = 0.20;

    // Ball rolling rotation
    b.rot[0] += b.vTheta * dt * 7.0;
    b.rot[1] += b.vTheta * dt * 5.0;

  } else if (b.phase === 'slope') {
    // PHASE 2: GRAVITY SLIDES BALL DOWN THE CONCAVE BOWL
    // Inward slope gravity vs centrifugal force
    const centAcc = (b.vTheta * b.vTheta) / b.r;
    const slopeGravity = 4.2; // inward gravitational pull along bowl slope
    const netRadAcc = -slopeGravity + centAcc * 0.45;

    b.vr += netRadAcc * dt;
    b.vr *= Math.exp(-0.4 * dt); // slope friction

    b.r += b.vr * dt;
    b.vTheta *= Math.exp(-0.35 * dt);
    const omega = b.vTheta / (b.r || 0.1);
    b.theta += omega * dt;

    // Height follows the bowl curve down (r = 1.10 -> z = 0.20, r = 0.74 -> z = 0.035)
    b.z = 0.035 + Math.max(0, b.r - 0.74) * 0.46;

    // DEFLECTORS (DIAMONDS): 8 brass deflectors positioned at r = 0.92
    if (b.r >= 0.88 && b.r <= 0.96) {
      for (let k = 0; k < 8; k++) {
        const defAngle = k * (Math.PI / 4);
        let dAng = Math.abs((b.theta - defAngle) % (2 * Math.PI));
        if (dAng > Math.PI) dAng = 2 * Math.PI - dAng;
        if (dAng < 0.15 && !b._lastDefHit) {
          b._lastDefHit = true;
          // Bounce off deflector: randomize radial velocity and kick tangential velocity
          b.vr += 0.35 + Math.random() * 0.35;
          b.vTheta *= 0.75;
          hitSound = 'rim';
          break;
        }
      }
    } else {
      b._lastDefHit = false;
    }

    // Ball reaches the wheel pocket frets boundary!
    if (b.r <= 0.76) {
      b.phase = 'pocket';
      b.z = 0.035;
      hitSound = 'peg';
    }

    b.pos[0] = b.r * Math.cos(b.theta);
    b.pos[1] = b.r * Math.sin(b.theta);
    b.pos[2] = b.z;

    b.rot[0] += b.vTheta * dt * 8.0;
    b.rot[1] += b.vr * dt * 8.0;

  } else if (b.phase === 'pocket') {
    // PHASE 3: CLATTERING ACROSS 37 POCKET SEPARATORS
    b.r = Math.max(0.66, b.r - 0.25 * dt);
    
    b.vTheta *= Math.exp(-2.5 * dt);
    const wheelTangential = r.wheelSpeed * b.r;
    b.vTheta += (wheelTangential - b.vTheta) * 0.22;

    const omega = b.vTheta / b.r;
    b.theta += omega * dt;

    b.clatterTimer = (b.clatterTimer || 0) + dt;
    if (b.clatterTimer > 0.08 && Math.abs(b.vTheta - wheelTangential) > 0.3) {
      b.clatterTimer = 0;
      hitSound = 'peg'; // separator click
      b.z = 0.035 + Math.random() * 0.02;
    } else {
      b.z = 0.025;
    }

    // Check if settled into a pocket
    if (Math.abs(b.vTheta - wheelTangential) < 0.28 && b.r <= 0.68) {
      let relAngle = (b.theta - r.wheelAngle) % (2 * Math.PI);
      if (relAngle < 0) relAngle += 2 * Math.PI;

      const seg = (2 * Math.PI) / 37;
      let pocketIdx = Math.floor(relAngle / seg) % 37;
      if (pocketIdx < 0) pocketIdx += 37;

      b.trapped = true;
      b.phase = 'trapped';
      b.pocketIndex = pocketIdx;
      winPocket = pocketIdx;
      hitSound = 'pocket';
    }

    b.pos[0] = b.r * Math.cos(b.theta);
    b.pos[1] = b.r * Math.sin(b.theta);
    b.pos[2] = b.z;
    b.rot[0] += b.vTheta * dt * 6.0;
  }

  return {
    wheelAngle: r.wheelAngle,
    ball: {
      pos: b.pos,
      rot: b.rot,
      pocketIndex: b.pocketIndex,
      trapped: b.trapped
    },
    hitSound: hitSound,
    winPocket: winPocket
  };
}

// maps/utils.js
// Real Stepped Staircase Generator - Creates solid stepped treads with zero underside collision bugs
export function generateStairs(startId, namePrefix, startX, startZ, endZ, groundY, topY, stepCount, width, color) {
  const steps = [];
  const totalRise = topY - groundY;
  const stepRise = totalRise / stepCount;
  const zSpan = endZ - startZ;
  const stepRun = Math.abs(zSpan) / stepCount;
  const zDir = Math.sign(zSpan);

  for (let i = 0; i < stepCount; i++) {
    const stepHeight = groundY + stepRise * (i + 1);
    const zCenter = startZ + zDir * (i * stepRun + stepRun * 0.5);
    const yCenter = stepHeight * 0.5;
    steps.push({
      id: startId + i,
      name: `${namePrefix}_Step_${i + 1}`,
      type: "Stone Stair Step",
      pos: [startX, yCenter, zCenter],
      scale: [width, stepHeight, stepRun * 1.08],
      roughness: 0.55,
      metallic: 0.35,
      color: color || [0.32, 0.35, 0.40],
      collider: `AABB Step (${width.toFixed(1)}x${stepHeight.toFixed(2)}x${(stepRun * 1.08).toFixed(2)}m)`,
      layer: "Layer_Obstacle",
      trigger: false,
      badge: `${namePrefix} Step ${i + 1}`,
      contact: false
    });
  }
  return steps;
}

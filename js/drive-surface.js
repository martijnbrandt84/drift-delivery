import * as THREE from 'three';
import { TOWN_ELEV, WATER_LEVEL, MAX_WADING_TERRAIN_Y, getClosestNetworkRoad } from './roads.js';
import { driveways } from './water-lots.js';
import { getTerrainHeight } from './terrain.js';

// =========================================================
// SUPERSNELLE GEBAKKEN RIJHOOGTE FUNCTIE (O(1) TIJDENS GAMEPLAY!)
// =========================================================
function computeExactDriveSurface(x, z, currentY = null) {
  const { sample: rs, marginDist } = getClosestNetworkRoad(x, z);
  const terrH = getTerrainHeight(x, z);

  const effectiveRoadY = rs ? rs.y : 0;
  const onAnyBridge = Boolean(rs && rs.onBridge);

  if (rs && marginDist <= 0.45) {
    // Alleen op grond/water blijven als de auto al duidelijk onder de brug zit (bijv. in water of laag in de vallei)
    if (onAnyBridge && currentY !== null && currentY < effectiveRoadY - 1.5 && effectiveRoadY - terrH > 2.0) {
      return { height: Math.max(terrH, WATER_LEVEL - 0.12), onAsphalt: false };
    }
    return { height: effectiveRoadY + 0.10, onAsphalt: true };
  }

  const inWestBlock = x > -23.7 && x < -4.3 && z > 84.9 && z < 107.7;
  const inEastBlock = x > 4.3 && x < 23.7 && z > 84.9 && z < 107.7;
  if (inWestBlock || inEastBlock) {
    return { height: TOWN_ELEV + 0.16, onAsphalt: true };
  }

  for (const d of driveways) {
    const l2 = (d.x2 - d.x1) ** 2 + (d.z2 - d.z1) ** 2;
    if (l2 > 0) {
      const proj = THREE.MathUtils.clamp(((x - d.x1) * (d.x2 - d.x1) + (z - d.z1) * (d.z2 - d.z1)) / l2, 0, 1);
      const px = d.x1 + proj * (d.x2 - d.x1);
      const pz = d.z1 + proj * (d.z2 - d.z1);
      if (Math.hypot(x - px, z - pz) <= d.halfWidth) {
        return { height: THREE.MathUtils.lerp(d.y1, d.y2, proj) + 0.12, onAsphalt: false };
      }
    }
  }

  if (rs && !onAnyBridge && marginDist <= 2.4) {
    const t = (marginDist - 0.45) / 1.95;
    return { height: THREE.MathUtils.lerp(effectiveRoadY + 0.10, terrH, t), onAsphalt: false };
  }

  return { height: terrH, onAsphalt: false };
}

export function getDriveHeightAndWaterState(x, z, currentY = null) {
  const surf = computeExactDriveSurface(x, z, currentY);
  const wDepth = surf.onAsphalt ? 0 : Math.max(0, WATER_LEVEL - surf.height);
  return {
    height: surf.height,
    onAsphalt: surf.onAsphalt,
    inShallowWater: !surf.onAsphalt && wDepth > 0.02 && surf.height >= MAX_WADING_TERRAIN_Y,
    inDeepWater: !surf.onAsphalt && surf.height < MAX_WADING_TERRAIN_Y,
    waterDepth: wDepth
  };
}
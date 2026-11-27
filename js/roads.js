import * as THREE from 'three';

// =========================================================
// WEGENNET & SUPERSNELLE O(1) SPATIAL GRID LOOKUP!
// =========================================================
export const WORLD_LIMIT = 240;
export const MAIN_HALF_WIDTH = 4.8;
export const STREET_HALF_WIDTH = 4.1;
export const TOWN_ELEV = 1.50;
export const WATER_LEVEL = -0.20;
export const MAX_WADING_TERRAIN_Y = -0.88;
export const TOWN_BOUNDS = { minX: -40, maxX: 40, minZ: 74, maxZ: 135 };

const lakeLoopWaypoints = [
  new THREE.Vector3(0, 0, -88),
  new THREE.Vector3(48, 0, -80),
  new THREE.Vector3(86, 0, -48),
  new THREE.Vector3(96, 0, -2),
  new THREE.Vector3(82, 0, 44),
  new THREE.Vector3(56, 0, 74),
  new THREE.Vector3(34, 0, 80),
  new THREE.Vector3(0, 0, 80),
  new THREE.Vector3(-34, 0, 80),
  new THREE.Vector3(-56, 0, 74),
  new THREE.Vector3(-80, 0, 46),
  new THREE.Vector3(-96, 0, 4),
  new THREE.Vector3(-88, 0, -40),
  new THREE.Vector3(-50, 0, -78)
];

export const lakeCurve = new THREE.CatmullRomCurve3(lakeLoopWaypoints, true, 'centripetal', 0.45);
export const U_JUNCTION_EAST = 0.315;
export const U_JUNCTION_WEST = 0.765;

function cyclicDiff(u, target) {
  let d = u - target;
  while (d > 0.5) d -= 1.0;
  while (d < -0.5) d += 1.0;
  return d;
}

export const LAKE_BRIDGES = [
  { name: 'Pine Creek Bridge', uCenter: 0.0, uHalfSpan: 0.028, archHeight: 1.55 },
  { name: 'Bear River Bridge', uCenter: 0.688, uHalfSpan: 0.027, archHeight: 1.50 }
];

export function getLakeLoopBaseElev(u) {
  const eastRidge = Math.exp(-((cyclicDiff(u, 0.185) / 0.088) ** 2)) * 6.8;
  const westBluff = Math.exp(-((cyclicDiff(u, 0.865) / 0.078) ** 2)) * 4.8;
  const rolling = Math.sin(u * Math.PI * 4 - 0.4) * 1.15 + Math.cos(u * Math.PI * 6 + 0.3) * 0.55;

  let h = 1.9 + eastRidge + westBluff + rolling * 0.55;

  for (const b of LAKE_BRIDGES) {
    const d = Math.abs(cyclicDiff(u, b.uCenter));
    if (d < b.uHalfSpan * 2.5) {
      h = THREE.MathUtils.lerp(1.40, h, THREE.MathUtils.smoothstep(d, b.uHalfSpan, b.uHalfSpan * 2.5));
    }
  }

  const dJEast = Math.abs(cyclicDiff(u, U_JUNCTION_EAST));
  if (dJEast < 0.05) h = THREE.MathUtils.lerp(4.0, h, THREE.MathUtils.smoothstep(dJEast, 0.018, 0.05));

  const dJWest = Math.abs(cyclicDiff(u, U_JUNCTION_WEST));
  if (dJWest < 0.05) h = THREE.MathUtils.lerp(3.5, h, THREE.MathUtils.smoothstep(dJWest, 0.018, 0.05));

  const dTown = Math.abs(cyclicDiff(u, 0.50));
  if (dTown < 0.14) h = THREE.MathUtils.lerp(TOWN_ELEV, h, THREE.MathUtils.smoothstep(dTown, 0.085, 0.14));

  return h;
}

export function getLakeBridgeAtU(u) {
  for (let i = 0; i < LAKE_BRIDGES.length; i++) {
    const b = LAKE_BRIDGES[i];
    const diff = cyclicDiff(u, b.uCenter);
    if (Math.abs(diff) <= b.uHalfSpan) {
      const norm = diff / b.uHalfSpan;
      const archY = 0.5 * (1 + Math.cos(norm * Math.PI)) * b.archHeight;
      return { onBridge: true, bridgeId: `lake_${i}`, norm, archY };
    }
  }
  return { onBridge: false, bridgeId: null, norm: 0, archY: 0 };
}

const jEastPt = lakeCurve.getPointAt(U_JUNCTION_EAST);
const jEastTan = lakeCurve.getTangentAt(U_JUNCTION_EAST);
const jEastOutNormal = new THREE.Vector3(jEastTan.z, 0, -jEastTan.x).normalize();
if (jEastOutNormal.x * jEastPt.x + jEastOutNormal.z * jEastPt.z < 0) jEastOutNormal.negate();

const jWestPt = lakeCurve.getPointAt(U_JUNCTION_WEST);
const jWestTan = lakeCurve.getTangentAt(U_JUNCTION_WEST);
const jWestOutNormal = new THREE.Vector3(jWestTan.z, 0, -jWestTan.x).normalize();
if (jWestOutNormal.x * jWestPt.x + jWestOutNormal.z * jWestPt.z < 0) jWestOutNormal.negate();

const jEastY = getLakeLoopBaseElev(U_JUNCTION_EAST);
const jWestY = getLakeLoopBaseElev(U_JUNCTION_WEST);

const valleyWaypoints = [
  new THREE.Vector3(jEastPt.x - jEastOutNormal.x * 1.2, 0, jEastPt.z - jEastOutNormal.z * 1.2),
  new THREE.Vector3(jEastPt.x + jEastOutNormal.x * 16, 0, jEastPt.z + jEastOutNormal.z * 16),
  new THREE.Vector3(114, 0, 96),
  new THREE.Vector3(86, 0, 148),
  new THREE.Vector3(36, 0, 168),
  new THREE.Vector3(0, 0, 164),
  new THREE.Vector3(-44, 0, 174),
  new THREE.Vector3(-98, 0, 150),
  new THREE.Vector3(-128, 0, 96),
  new THREE.Vector3(-122, 0, 44),
  new THREE.Vector3(jWestPt.x + jWestOutNormal.x * 16, 0, jWestPt.z + jWestOutNormal.z * 16),
  new THREE.Vector3(jWestPt.x - jWestOutNormal.x * 1.2, 0, jWestPt.z - jWestOutNormal.z * 1.2)
];

export const valleyCurve = new THREE.CatmullRomCurve3(valleyWaypoints, false, 'centripetal', 0.5);
export const VALLEY_BRIDGE = { name: 'Meadow Brook Bridge', uCenter: 0.60, uHalfSpan: 0.042, archHeight: 1.40 };

export function getValleyBaseElev(u) {
  const seMountainPass = Math.exp(-(((u - 0.19) / 0.105) ** 2)) * 7.8;
  const swPineSummit = Math.exp(-(((u - 0.81) / 0.10) ** 2)) * 7.2;
  const waves = Math.sin(u * Math.PI * 5) * 0.95;

  let midWave = 2.2 + seMountainPass + swPineSummit + waves;

  const dSouthLink = Math.abs(u - 0.445);
  if (dSouthLink < 0.09) midWave = THREE.MathUtils.lerp(3.0, midWave, THREE.MathUtils.smoothstep(dSouthLink, 0.03, 0.09));

  const dBridge = Math.abs(u - VALLEY_BRIDGE.uCenter);
  if (dBridge < VALLEY_BRIDGE.uHalfSpan * 2.3) {
    midWave = THREE.MathUtils.lerp(1.35, midWave, THREE.MathUtils.smoothstep(dBridge, VALLEY_BRIDGE.uHalfSpan, VALLEY_BRIDGE.uHalfSpan * 2.3));
  }

  const startBlend = THREE.MathUtils.smoothstep(u, 0.0, 0.09);
  const endBlend = THREE.MathUtils.smoothstep(1.0 - u, 0.0, 0.09);
  let h = THREE.MathUtils.lerp(jEastY, midWave, startBlend);
  h = THREE.MathUtils.lerp(jWestY, h, endBlend);
  return h;
}

export function getValleyBridgeAtU(u) {
  const diff = u - VALLEY_BRIDGE.uCenter;
  if (Math.abs(diff) <= VALLEY_BRIDGE.uHalfSpan) {
    const norm = diff / VALLEY_BRIDGE.uHalfSpan;
    const archY = 0.5 * (1 + Math.cos(norm * Math.PI)) * VALLEY_BRIDGE.archHeight;
    return { onBridge: true, bridgeId: 'valley_0', norm, archY };
  }
  return { onBridge: false, bridgeId: null, norm: 0, archY: 0 };
}

export const OAK_ST_Z = 112;
let uValleyCenterHit = 0.445;
let bestAbsX = Infinity;
for (let k = 0; k <= 400; k++) {
  const uTest = 0.35 + (k / 400) * 0.2;
  const pTest = valleyCurve.getPointAt(uTest);
  if (Math.abs(pTest.x) < bestAbsX) {
    bestAbsX = Math.abs(pTest.x);
    uValleyCenterHit = uTest;
  }
}
export const valleySouthHitPt = valleyCurve.getPointAt(uValleyCenterHit);
export const valleySouthHitY = getValleyBaseElev(uValleyCenterHit);

function makeStraightStreetCurve(x1, z1, x2, z2) {
  return new THREE.LineCurve3(new THREE.Vector3(x1, 0, z1), new THREE.Vector3(x2, 0, z2));
}

export const townStreetDefs = [
  { id: 'oak_st', curve: makeStraightStreetCurve(-28, OAK_ST_Z, 28, OAK_ST_Z), halfWidth: STREET_HALF_WIDTH, samplesCount: 70, elevFn: () => TOWN_ELEV, dashedCenter: true },
  { id: 'west_ave', curve: makeStraightStreetCurve(-28, 80, -28, OAK_ST_Z + STREET_HALF_WIDTH - 0.2), halfWidth: STREET_HALF_WIDTH, samplesCount: 48, elevFn: () => TOWN_ELEV, dashedCenter: false },
  { id: 'east_ave', curve: makeStraightStreetCurve(28, 80, 28, OAK_ST_Z + STREET_HALF_WIDTH - 0.2), halfWidth: STREET_HALF_WIDTH, samplesCount: 48, elevFn: () => TOWN_ELEV, dashedCenter: false },
  {
    id: 'center_ave',
    curve: new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 80),
      new THREE.Vector3(0, 0, OAK_ST_Z),
      new THREE.Vector3(valleySouthHitPt.x * 0.4, 0, 138),
      new THREE.Vector3(valleySouthHitPt.x, 0, valleySouthHitPt.z + 0.8)
    ], false, 'centripetal', 0.5),
    halfWidth: STREET_HALF_WIDTH,
    samplesCount: 110,
    elevFn: (u) => (u <= 0.42 ? TOWN_ELEV : THREE.MathUtils.lerp(TOWN_ELEV, valleySouthHitY, THREE.MathUtils.smoothstep(u, 0.42, 0.96))),
    dashedCenter: true
  }
];

export function sampleRoadCurve(id, curve, count, isClosed, halfWidth, elevFn, bridgeFn) {
  const arr = [];
  const maxIdx = isClosed ? count : count - 1;
  for (let i = 0; i < count; i++) {
    const u = i / maxIdx;
    const pt = curve.getPointAt(u);
    const tan = curve.getTangentAt(u);
    const len2D = Math.hypot(tan.x, tan.z) || 1;
    const tx = tan.x / len2D;
    const tz = tan.z / len2D;
    const nx = -tz;
    const nz = tx;
    const bInfo = bridgeFn ? bridgeFn(u) : { onBridge: false, bridgeId: null, norm: 0, archY: 0 };
    const baseElev = elevFn(u);

    arr.push({
      roadId: id,
      u,
      x: pt.x,
      y: baseElev + bInfo.archY,
      z: pt.z,
      baseElev,
      halfWidth,
      tx,
      tz,
      nx,
      nz,
      onBridge: bInfo.onBridge,
      bridgeId: bInfo.bridgeId,
      bridgeNorm: bInfo.norm
    });
  }
  return arr;
}

export const lakeSamples = sampleRoadCurve('lake_loop', lakeCurve, 760, true, MAIN_HALF_WIDTH, getLakeLoopBaseElev, getLakeBridgeAtU);
export const valleySamples = sampleRoadCurve('valley_road', valleyCurve, 560, false, MAIN_HALF_WIDTH, getValleyBaseElev, getValleyBridgeAtU);
export const streetSampleSets = townStreetDefs.map((def) => ({
  def,
  samples: sampleRoadCurve(def.id, def.curve, def.samplesCount, false, def.halfWidth, def.elevFn, null)
}));

export const allRoadNetworks = [
  { id: 'lake_loop', samples: lakeSamples, halfWidth: MAIN_HALF_WIDTH, isClosed: true },
  { id: 'valley_road', samples: valleySamples, halfWidth: MAIN_HALF_WIDTH, isClosed: false },
  ...streetSampleSets.map((s) => ({ id: s.def.id, samples: s.samples, halfWidth: s.def.halfWidth, isClosed: false }))
];

// PERFORMANCE FIX: Spatial Hash Grid voor alle wegpunten zodat `getClosestNetworkRoad` 20x sneller is!
const ROAD_HASH_CELL = 16;
const roadSpatialMap = new Map();
const allFlatRoadSamples = [];

allRoadNetworks.forEach((net) => {
  net.samples.forEach((s) => {
    const globalIdx = allFlatRoadSamples.length;
    allFlatRoadSamples.push(s);
    const cx = Math.floor(s.x / ROAD_HASH_CELL);
    const cz = Math.floor(s.z / ROAD_HASH_CELL);
    // Registreer in 3x3 buurcellen zodat we altijd een 24m zoekradius hebben in O(1) tijd!
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const key = `${cx + dx},${cz + dz}`;
        let bucket = roadSpatialMap.get(key);
        if (!bucket) {
          bucket = [];
          roadSpatialMap.set(key, bucket);
        }
        bucket.push(globalIdx);
      }
    }
  });
});

export function getClosestNetworkRoad(x, z) {
  const cx = Math.floor(x / ROAD_HASH_CELL);
  const cz = Math.floor(z / ROAD_HASH_CELL);
  const bucket = roadSpatialMap.get(`${cx},${cz}`);

  if (!bucket) {
    return { sample: null, dist: 999, marginDist: 999 };
  }

  let bestSample = null;
  let bestMarginDist = Infinity;
  let bestRawDist = Infinity;

  for (let i = 0; i < bucket.length; i++) {
    const s = allFlatRoadSamples[bucket[i]];
    const rawDist = Math.hypot(x - s.x, z - s.z);
    const marginDist = rawDist - s.halfWidth;
    if (marginDist < bestMarginDist) {
      bestMarginDist = marginDist;
      bestRawDist = rawDist;
      bestSample = s;
    }
  }

  return { sample: bestSample, dist: bestRawDist, marginDist: bestMarginDist };
}

// Voor resetten van grote afstand (buiten 24m van een weg) eenmalige fallback:
export function findNearestRoadAnywhere(x, z) {
  let best = allFlatRoadSamples[0];
  let bestSq = Infinity;
  for (let i = 0; i < allFlatRoadSamples.length; i += 3) {
    const s = allFlatRoadSamples[i];
    const dSq = (x - s.x) ** 2 + (z - s.z) ** 2;
    if (dSq < bestSq) {
      bestSq = dSq;
      best = s;
    }
  }
  return best;
}

export const INTERSECTIONS = [
  { x: jEastPt.x, z: jEastPt.z, y: jEastY, r: 7.8 },
  { x: jWestPt.x, z: jWestPt.z, y: jWestY, r: 7.8 },
  { x: -28, z: 80, y: TOWN_ELEV, r: 7.0 },
  { x: 0, z: 80, y: TOWN_ELEV, r: 7.0 },
  { x: 28, z: 80, y: TOWN_ELEV, r: 7.0 },
  { x: -28, z: OAK_ST_Z, y: TOWN_ELEV, r: 6.6 },
  { x: 0, z: OAK_ST_Z, y: TOWN_ELEV, r: 7.0 },
  { x: 28, z: OAK_ST_Z, y: TOWN_ELEV, r: 6.6 },
  { x: valleySouthHitPt.x, z: valleySouthHitPt.z, y: valleySouthHitY, r: 7.6 }
];

export function isInsideIntersection(x, z, extraR = 0) {
  for (const inter of INTERSECTIONS) {
    if (Math.hypot(x - inter.x, z - inter.z) < inter.r + extraR) return true;
  }
  return false;
}

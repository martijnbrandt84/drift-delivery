import * as THREE from 'three';
import {
  ISLAND_CENTER, getNaturalGroundBase, getIslandPolar, getCoastRadius
} from './landscape.js';

// =========================================================
// WEGENNET & SUPERSNELLE O(1) SPATIAL GRID LOOKUP!
// =========================================================
export const WORLD_LIMIT = 420;
export const MAIN_HALF_WIDTH = 4.8;
export const STREET_HALF_WIDTH = 4.1;
export const TOWN_ELEV = 1.50;
export const WATER_LEVEL = -0.20;
export const MAX_WADING_TERRAIN_Y = -0.88;
export const TOWN_BOUNDS = { minX: -46, maxX: 46, minZ: 74, maxZ: 136 };

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

function getRawLakeLoopElev(u) {
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

// Extra T-splitsing aan de noordoostkant van de meerweg: verbindingsweg naar de kustweg
export const U_LAKE_NORTH_JUNCTION = 0.142;
export const U_LAKE_EAST_JUNCTION = 0.232;
export const U_LAKE_PINE_JUNCTION = 0.928;
const lakeJunctionFlats = [U_LAKE_NORTH_JUNCTION, U_LAKE_EAST_JUNCTION, U_LAKE_PINE_JUNCTION].map((uj) => ({ uj, y: getRawLakeLoopElev(uj) }));

export function getLakeLoopBaseElev(u) {
  let h = getRawLakeLoopElev(u);
  for (const f of lakeJunctionFlats) {
    const d = Math.abs(cyclicDiff(u, f.uj));
    if (d < 0.04) h = THREE.MathUtils.lerp(f.y, h, THREE.MathUtils.smoothstep(d, 0.014, 0.04));
  }
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
// Houten brug over Bear Creek (vervangt de oude rode hangbrug bij de boerderij)
// (midden precies boven de rivier, die de weg bij u=0,868 kruist; overspant water plus de afgegraven oevers)
export const VALLEY_CREEK_BRIDGE = { name: 'Bear Creek Bridge', uCenter: 0.868, uHalfSpan: 0.034, archHeight: 1.5, deckY: 3.4 };
export const VALLEY_BRIDGES = [VALLEY_BRIDGE, VALLEY_CREEK_BRIDGE];

function getRawValleyElev(u) {
  const seMountainPass = Math.exp(-(((u - 0.19) / 0.105) ** 2)) * 7.8;
  const swPineSummit = Math.exp(-(((u - 0.78) / 0.09) ** 2)) * 4.6;
  const waves = Math.sin(u * Math.PI * 5) * 0.95;

  let midWave = 2.2 + seMountainPass + swPineSummit + waves;

  const dSouthLink = Math.abs(u - 0.445);
  if (dSouthLink < 0.09) midWave = THREE.MathUtils.lerp(3.0, midWave, THREE.MathUtils.smoothstep(dSouthLink, 0.03, 0.09));

  const dBridge = Math.abs(u - VALLEY_BRIDGE.uCenter);
  if (dBridge < VALLEY_BRIDGE.uHalfSpan * 2.3) {
    midWave = THREE.MathUtils.lerp(1.35, midWave, THREE.MathUtils.smoothstep(dBridge, VALLEY_BRIDGE.uHalfSpan, VALLEY_BRIDGE.uHalfSpan * 2.3));
  }

  const dCreek = Math.abs(u - VALLEY_CREEK_BRIDGE.uCenter);
  const creekBlend = VALLEY_CREEK_BRIDGE.uHalfSpan * 4.2;
  if (dCreek < creekBlend) {
    midWave = THREE.MathUtils.lerp(VALLEY_CREEK_BRIDGE.deckY, midWave, THREE.MathUtils.smoothstep(dCreek, VALLEY_CREEK_BRIDGE.uHalfSpan, creekBlend));
  }

  const startBlend = THREE.MathUtils.smoothstep(u, 0.0, 0.09);
  const endBlend = THREE.MathUtils.smoothstep(1.0 - u, 0.0, 0.09);
  let h = THREE.MathUtils.lerp(jEastY, midWave, startBlend);
  h = THREE.MathUtils.lerp(jWestY, h, endBlend);
  return h;
}

// Twee extra T-splitsingen op de valleiweg: naar de zuidkust en naar de westkust
export const U_VALLEY_SOUTH_JUNCTION = 0.31;
export const U_VALLEY_WEST_JUNCTION = 0.795;

// De twee buitenste dorpslanen (x = -28 en x = +28) lopen nu door tot op de valleiweg
function valleyUAtX(targetX, u0, u1) {
  let best = u0;
  let bestD = Infinity;
  for (let k = 0; k <= 400; k++) {
    const u = u0 + ((u1 - u0) * k) / 400;
    const d = Math.abs(valleyCurve.getPointAt(u).x - targetX);
    if (d < bestD) { bestD = d; best = u; }
  }
  return best;
}
export const U_VALLEY_WEST_AVE = valleyUAtX(-28, 0.42, 0.6);
export const U_VALLEY_EAST_AVE = valleyUAtX(28, 0.3, 0.45);
const valleyJunctionFlats = [U_VALLEY_SOUTH_JUNCTION, U_VALLEY_WEST_JUNCTION, U_VALLEY_WEST_AVE, U_VALLEY_EAST_AVE].map((uj) => ({ uj, y: getRawValleyElev(uj) }));

export function getValleyBaseElev(u) {
  let h = getRawValleyElev(u);
  for (const f of valleyJunctionFlats) {
    const d = Math.abs(u - f.uj);
    if (d < 0.05) h = THREE.MathUtils.lerp(f.y, h, THREE.MathUtils.smoothstep(d, 0.016, 0.05));
  }
  return h;
}

export function getValleyBridgeAtU(u) {
  for (let i = 0; i < VALLEY_BRIDGES.length; i++) {
    const b = VALLEY_BRIDGES[i];
    const diff = u - b.uCenter;
    if (Math.abs(diff) <= b.uHalfSpan) {
      const norm = diff / b.uHalfSpan;
      const archY = 0.5 * (1 + Math.cos(norm * Math.PI)) * b.archHeight;
      return { onBridge: true, bridgeId: `valley_${i}`, norm, archY };
    }
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

// Laan van de meerweg (z = 80) recht door het dorp tot op de valleiweg
function makeLongAvenue(id, x, uValley) {
  const vp = valleyCurve.getPointAt(uValley);
  const vy = getValleyBaseElev(uValley);
  const pts = [
    new THREE.Vector3(x, 0, 80),
    new THREE.Vector3(x, 0, OAK_ST_Z),
    new THREE.Vector3(x, 0, 137),
    new THREE.Vector3(THREE.MathUtils.lerp(x, vp.x, 0.6), 0, (137 + vp.z) * 0.5 + 3),
    new THREE.Vector3(vp.x, 0, vp.z + 1.2)
  ];
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.5);
  const L = curve.getLength();
  const uTownEnd = (137 - 80) / L;
  return {
    id,
    curve,
    halfWidth: STREET_HALF_WIDTH,
    samplesCount: Math.round(L / 0.8),
    elevFn: (u) => (u <= uTownEnd ? TOWN_ELEV : THREE.MathUtils.lerp(TOWN_ELEV, vy, THREE.MathUtils.smoothstep(u, uTownEnd, 0.97))),
    dashedCenter: true,
    valleyEnd: { x: vp.x, z: vp.z, y: vy }
  };
}

export const townStreetDefs = [
  { id: 'oak_st', curve: makeStraightStreetCurve(-28, OAK_ST_Z, 28, OAK_ST_Z), halfWidth: STREET_HALF_WIDTH, samplesCount: 70, elevFn: () => TOWN_ELEV, dashedCenter: true },
  makeLongAvenue('west_ave', -28, U_VALLEY_WEST_AVE),
  makeLongAvenue('east_ave', 28, U_VALLEY_EAST_AVE),
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

// =========================================================
// RIVIEREN (nu doorgetrokken tot aan de oceaan)
// =========================================================
function createRiverFromBridgeSample(centerS, halfWidth, flowsIntoLake = true, bendSign = 1, widenTo = null) {
  const dotToCenter = (-centerS.x) * centerS.nx + (-centerS.z) * centerS.nz;
  const inSign = dotToCenter >= 0 ? 1 : -1;
  const inX = centerS.nx * inSign;
  const inZ = centerS.nz * inSign;
  const outX = -inX;
  const outZ = -inZ;
  const sideX = centerS.tx;
  const sideZ = centerS.tz;

  const pts = flowsIntoLake
    ? [
        new THREE.Vector3(centerS.x + inX * 48, 0, centerS.z + inZ * 48),
        new THREE.Vector3(centerS.x + inX * 24 + sideX * 5 * bendSign, 0, centerS.z + inZ * 24 + sideZ * 5 * bendSign),
        new THREE.Vector3(centerS.x + inX * 11, 0, centerS.z + inZ * 11),
        new THREE.Vector3(centerS.x, 0, centerS.z),
        new THREE.Vector3(centerS.x + outX * 11, 0, centerS.z + outZ * 11),
        new THREE.Vector3(centerS.x + outX * 44 - sideX * 12 * bendSign, 0, centerS.z + outZ * 44 - sideZ * 12 * bendSign),
        new THREE.Vector3(centerS.x + outX * 95 + sideX * 16 * bendSign, 0, centerS.z + outZ * 95 + sideZ * 16 * bendSign),
        new THREE.Vector3(centerS.x + outX * 155, 0, centerS.z + outZ * 155)
      ]
    : [
        new THREE.Vector3(centerS.x + inX * 36 + sideX * 8, 0, centerS.z + inZ * 36 + sideZ * 8),
        new THREE.Vector3(centerS.x + inX * 18, 0, centerS.z + inZ * 18),
        new THREE.Vector3(centerS.x + inX * 10, 0, centerS.z + inZ * 10),
        new THREE.Vector3(centerS.x, 0, centerS.z),
        new THREE.Vector3(centerS.x + outX * 10, 0, centerS.z + outZ * 10),
        new THREE.Vector3(centerS.x + outX * 38 - sideX * 10, 0, centerS.z + outZ * 38 - sideZ * 10),
        new THREE.Vector3(centerS.x + outX * 85 + sideX * 12, 0, centerS.z + outZ * 85 + sideZ * 12)
      ];

  // Doortrekken naar zee: in de laatste stroomrichting verder meanderen tot voorbij de kustlijn
  for (let k = 0; k < 8; k++) {
    const last = pts[pts.length - 1];
    const pol = getIslandPolar(last.x, last.z);
    if (pol.r > getCoastRadius(pol.theta) + 30) break;
    const prev = pts[pts.length - 2];
    const dir = new THREE.Vector3(last.x - prev.x, 0, last.z - prev.z).normalize();
    // Zachte bijsturing richting open zee zodat de rivier niet langs de kust blijft lopen
    const radial = new THREE.Vector3(last.x - ISLAND_CENTER.x, 0, last.z - ISLAND_CENTER.z).normalize();
    dir.lerp(radial, 0.35).normalize();
    const wiggle = (k % 2 === 0 ? 1 : -1) * 9 * bendSign;
    pts.push(new THREE.Vector3(last.x + dir.x * 55 - dir.z * wiggle, 0, last.z + dir.z * 55 + dir.x * wiggle));
  }

  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.5);
  const count = Math.max(70, Math.round(curve.getLength() / 3.2));
  const sampled = [];
  for (let k = 0; k <= count; k++) {
    const t = k / count;
    const p = curve.getPointAt(t);
    // Optioneel: de rivier wordt richting zee steeds breder (brede monding)
    const hw = widenTo ? THREE.MathUtils.lerp(halfWidth, widenTo, THREE.MathUtils.smoothstep(t, 0.3, 0.88)) : halfWidth;
    sampled.push({ x: p.x, z: p.z, hw });
  }
  return { sampled, halfWidth, maxHalfWidth: widenTo ?? halfWidth, pondCenter: flowsIntoLake ? null : pts[0] };
}

const lakeBridge0Sample = lakeSamples[0];
const lakeBridge1Sample = lakeSamples[Math.round(LAKE_BRIDGES[1].uCenter * lakeSamples.length)];
const valleyBridgeSample = valleySamples[Math.round(VALLEY_BRIDGE.uCenter * (valleySamples.length - 1))];

export const riverCurves = [
  // Pine River: vanuit het meer naar de noordkust, steeds breder — hier ligt de grote rode brug
  createRiverFromBridgeSample(lakeBridge0Sample, 7.4, true, 1, 32),
  createRiverFromBridgeSample(lakeBridge1Sample, 7.2, true, -1),
  createRiverFromBridgeSample(valleyBridgeSample, 6.2, false, 1)
];

// Pond Creek: vanaf het doodlopende eind van de zuidelijke beek (de vijver) naar het noorden,
// tussen de meerweg en de valleiweg door, tot in de westelijke rivier
{
  const pond = riverCurves[2].pondCenter;
  const creekPts = [[pond.x, pond.z], [-77, 110], [-87, 94], [-95, 77], [-99, 60], [-102, 50], [-108, 43.5], [-115, 39]];
  const curve = new THREE.CatmullRomCurve3(creekPts.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal', 0.5);
  const count = Math.round(curve.getLength() / 3.2);
  const sampled = [];
  for (let k = 0; k <= count; k++) {
    const p = curve.getPointAt(k / count);
    // Bredere monding waar de beek in de Bear River uitkomt
    sampled.push({ x: p.x, z: p.z, hw: THREE.MathUtils.lerp(5.2, 7.4, THREE.MathUtils.smoothstep(k / count, 0.8, 1.0)) });
  }
  riverCurves.push({ sampled, halfWidth: 5.2, maxHalfWidth: 7.4, pondCenter: null, name: 'Pond Creek' });
}

// Vroegere vijver aan het begin van de zuidelijke beek (alleen nog als referentiepunt)
export const VALLEY_POND = { x: riverCurves[2].pondCenter.x, z: riverCurves[2].pondCenter.z, r: 0 };

riverCurves.forEach((riv) => {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  riv.sampled.forEach((p) => {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
  });
  riv.bbox = { minX, maxX, minZ, maxZ };
});

// Ruimtelijk raster met rivierpunten: alleen punten tot ~18m buiten de oever worden opgezocht.
// Verder weg geeft getDistToRivers een grote waarde terug (alle gebruikers kijken alleen dichtbij).
const RIVER_CELL = 16;
const RIVER_REACH = 18;
const riverGrid = new Map();
const riverKey = (cx, cz) => (cx + 2048) * 4096 + (cz + 2048);
const riverPts = [];
riverCurves.forEach((riv) => {
  riv.sampled.forEach((p) => {
    const idx = riverPts.length;
    riverPts.push(p);
    const reach = p.hw + RIVER_REACH;
    const c0x = Math.floor((p.x - reach) / RIVER_CELL);
    const c1x = Math.floor((p.x + reach) / RIVER_CELL);
    const c0z = Math.floor((p.z - reach) / RIVER_CELL);
    const c1z = Math.floor((p.z + reach) / RIVER_CELL);
    for (let cx = c0x; cx <= c1x; cx++) {
      for (let cz = c0z; cz <= c1z; cz++) {
        const key = riverKey(cx, cz);
        let bucket = riverGrid.get(key);
        if (!bucket) { bucket = []; riverGrid.set(key, bucket); }
        bucket.push(idx);
      }
    }
  });
});

export function getDistToRivers(x, z) {
  let minEffective = 999;
  const bucket = riverGrid.get(riverKey(Math.floor(x / RIVER_CELL), Math.floor(z / RIVER_CELL)));
  if (bucket) {
    for (let i = 0; i < bucket.length; i++) {
      const p = riverPts[bucket[i]];
      const d = Math.hypot(x - p.x, z - p.z) - p.hw;
      if (d < minEffective) minEffective = d;
    }
  }
  // Geen ronde vijverkom meer: de beek loopt nu door (Pond Creek sluit aan op de zuidelijke beek)
  return minEffective;
}

// =========================================================
// HOOGTEPROFIELEN VOOR NIEUWE WEGEN: volgen de natuurlijke grond (gladgestreken),
// met automatische bruggen over rivieren en zee-inhammen en vlakke T-splitsingen.
// =========================================================
function segIntersectT(ax, az, bx, bz, cx, cz, dx, dz) {
  const rX = bx - ax, rZ = bz - az, sX = dx - cx, sZ = dz - cz;
  const denom = rX * sZ - rZ * sX;
  if (Math.abs(denom) < 1e-9) return -1;
  const t = ((cx - ax) * sZ - (cz - az) * sX) / denom;
  const v = ((cx - ax) * rZ - (cz - az) * rX) / denom;
  return t >= 0 && t <= 1 && v >= 0 && v <= 1 ? t : -1;
}

function buildRoadProfile(curve, closed, opts = {}) {
  const L = curve.getLength();
  const N = Math.max(64, Math.round(L / 1.5));
  const step = L / N;
  const count = closed ? N : N + 1;
  const pts = [];
  const raw = new Float64Array(count);
  for (let i = 0; i < count; i++) {
    const p = curve.getPointAt(i / N);
    pts.push(p);
    raw[i] = getNaturalGroundBase(p.x, p.z);
  }
  const wrap = (i) => (closed ? ((i % count) + count) % count : THREE.MathUtils.clamp(i, 0, count - 1));

  // 1. Zee/meer onder de weg: markeren en lineair overbruggen
  const isWater = Array.from(raw, (h) => h < 0.15);
  const waterRuns = [];
  {
    const startScan = closed ? Math.max(0, isWater.findIndex((w) => !w)) : 0;
    const visited = new Uint8Array(count);
    for (let k = 0; k < count; k++) {
      const i = wrap(startScan + k);
      if (!isWater[i] || visited[i]) continue;
      let len = 0;
      while (len < count && isWater[wrap(i + len)] && !(closed === false && i + len >= count)) {
        visited[wrap(i + len)] = 1;
        len++;
      }
      waterRuns.push({ a: i, len });
    }
    waterRuns.forEach(({ a, len }) => {
      const hA = raw[wrap(a - 1)];
      const hB = raw[wrap(a + len)];
      for (let k = 0; k < len; k++) raw[wrap(a + k)] = THREE.MathUtils.lerp(hA, hB, (k + 1) / (len + 1));
    });
  }

  // 2. Gladstrijken (3x box blur)
  const radius = Math.max(1, Math.round((opts.smoothM ?? 50) / step));
  let cur = raw;
  for (let pass = 0; pass < 3; pass++) {
    const next = new Float64Array(count);
    for (let i = 0; i < count; i++) {
      let sum = 0;
      for (let k = -radius; k <= radius; k++) sum += cur[wrap(i + k)];
      next[i] = sum / (radius * 2 + 1);
    }
    cur = next;
  }
  const minY = opts.minY ?? 1.8;
  for (let i = 0; i < count; i++) cur[i] = Math.max(cur[i], minY);

  const uDist = (u, c) => {
    let d = u - c;
    if (closed) { while (d > 0.5) d -= 1; while (d < -0.5) d += 1; }
    return Math.abs(d);
  };
  const applyFlat = (uc, y, flatM, blendM) => {
    for (let i = 0; i < count; i++) {
      const dm = uDist(i / N, uc) * L;
      if (dm < blendM) cur[i] = THREE.MathUtils.lerp(y, cur[i], THREE.MathUtils.smoothstep(dm, flatM, blendM));
    }
  };

  // 3. Bruggen: zee-inhammen (hangbrug) en rivierkruisingen (houten brug)
  const bridges = [];
  waterRuns.forEach(({ a, len }) => {
    let realWater = false;
    for (let k = 0; k < len && !realWater; k++) {
      const p = pts[wrap(a + k)];
      const pol = getIslandPolar(p.x, p.z);
      if (pol.r > getCoastRadius(pol.theta) - 30 || getDistToRivers(p.x, p.z) < 2) realWater = true;
    }
    if (!realWater) return; // landinwaartse laagte: wordt land, de weg loopt er gewoon overheen
    const uCenter = ((a + (len - 1) * 0.5) / N) % 1;
    const halfM = len * step * 0.5 + 9;
    const isLong = halfM > 26;
    const deckY = Math.max(isLong ? 5.0 : 1.6, cur[wrap(a + Math.round(len * 0.5))]);
    applyFlat(uCenter, deckY, halfM, halfM * 2.2);
    bridges.push({ uCenter, uHalfSpan: halfM / L, archHeight: isLong ? 2.6 : 1.4, type: isLong ? 'suspension' : 'wood' });
  });

  for (const riv of riverCurves) {
    for (let i = 0; i < count - (closed ? 0 : 1); i++) {
      const p0 = pts[i];
      const p1 = pts[wrap(i + 1)];
      for (let k = 0; k < riv.sampled.length - 1; k++) {
        const r0 = riv.sampled[k];
        const r1 = riv.sampled[k + 1];
        const t = segIntersectT(p0.x, p0.z, p1.x, p1.z, r0.x, r0.z, r1.x, r1.z);
        if (t < 0) continue;
        const uCenter = ((i + t) / N) % 1;
        if (bridges.some((b) => uDist(uCenter, b.uCenter) * L < 30)) continue;
        const hw = r0.hw + (r1.hw - r0.hw) * 0.5;
        if (hw > 16) {
          // Brede rivier: de iconische rode hangbrug, hoog boven het water
          const halfM = hw + 12;
          const deckY = Math.max(5.2, cur[wrap(Math.round(uCenter * N))]);
          applyFlat(uCenter, deckY, halfM, halfM * 2.2);
          bridges.push({ uCenter, uHalfSpan: halfM / L, archHeight: 2.6, type: 'suspension' });
        } else {
          const halfM = hw + 10;
          // Dek iets boven de oever houden (max 4.2m) met een lange, rustige aanloop i.p.v. een steile duik
          const deckY = THREE.MathUtils.clamp(cur[wrap(Math.round(uCenter * N))], 1.45, 4.2);
          applyFlat(uCenter, deckY, halfM, halfM + 48);
          bridges.push({ uCenter, uHalfSpan: halfM / L, archHeight: 1.5, type: 'wood' });
        }
      }
    }
  }

  // Optioneel: gelijkmatige klim (spiraalweg) van begin- naar eindhoogte
  if (opts.linearRamp) {
    const y0 = opts.flats && opts.flats[0] && opts.flats[0].u === 0 && opts.flats[0].y != null ? opts.flats[0].y : cur[0];
    const y1 = cur[count - 1];
    for (let i = 0; i < count; i++) cur[i] = THREE.MathUtils.lerp(y0, y1, i / (count - 1));
  }

  // 4. Vlakke T-splitsingen (aansluitingen op andere wegen)
  (opts.flats || []).forEach((f) => {
    const y = f.y ?? cur[wrap(Math.round(f.u * N))];
    f.resolvedY = y;
    applyFlat(f.u, y, f.flatM ?? 9, f.blendM ?? 38);
  });

  const elevFn = (u) => {
    const fi = (closed ? ((u % 1) + 1) % 1 : THREE.MathUtils.clamp(u, 0, 1)) * N;
    const i0 = Math.floor(fi);
    const f = fi - i0;
    return THREE.MathUtils.lerp(cur[wrap(i0)], cur[wrap(i0 + 1)], f);
  };
  const bridgeFn = (u) => {
    for (let i = 0; i < bridges.length; i++) {
      const b = bridges[i];
      let diff = u - b.uCenter;
      if (closed) { while (diff > 0.5) diff -= 1; while (diff < -0.5) diff += 1; }
      if (Math.abs(diff) <= b.uHalfSpan) {
        const norm = diff / b.uHalfSpan;
        const archY = 0.5 * (1 + Math.cos(norm * Math.PI)) * b.archHeight;
        return { onBridge: true, bridgeId: `${opts.id}_${i}`, norm, archY };
      }
    }
    return { onBridge: false, bridgeId: null, norm: 0, archY: 0 };
  };
  return { elevFn, bridgeFn, bridges, length: L };
}

function closestUOnCurve(curve, x, z, closed, steps = 2000) {
  let best = 0;
  let bestD = Infinity;
  for (let k = 0; k <= steps; k++) {
    const u = k / steps;
    const p = curve.getPointAt(closed ? u % 1 : u);
    const d = (p.x - x) ** 2 + (p.z - z) ** 2;
    if (d < bestD) { bestD = d; best = u % 1; }
  }
  return best;
}

function frameAt(curve, u) {
  const pt = curve.getPointAt(u);
  const tan = curve.getTangentAt(u);
  const len = Math.hypot(tan.x, tan.z) || 1;
  const tx = tan.x / len;
  const tz = tan.z / len;
  return { pt, tx, tz, nx: -tz, nz: tx };
}

// =========================================================
// KUSTWEG (COAST HWY): onregelmatige route rond het eiland —
// strandboulevard in het zuiden, kliffen in het oosten, hangbrug over de fjord,
// en een slingerend stuk langs de bosrijke noordwestkust.
// =========================================================
const COAST_HWY_POINTS = [
  [-284, 52], [-266, 8], [-255, -25], [-262, -85], [-250, -150], [-215, -200], [-162, -246], [-100, -270],
  [-40, -276], [12, -268], [62, -252], [112, -222], [150, -178], [185, -137], [220, -98],
  [258, -52], [296, 2], [304, 54], [278, 100], [254, 140], [250, 184], [222, 222], [176, 252], [128, 288],
  [62, 318], [-15, 324], [-92, 315], [-160, 290], [-210, 252], [-248, 200], [-276, 150], [-296, 104]
];
export const ringCurve = new THREE.CatmullRomCurve3(
  COAST_HWY_POINTS.map(([x, z]) => new THREE.Vector3(x, 0, z)),
  true,
  'centripetal',
  0.5
);

// Aansluitpunten op de kustweg (wereldpunten; u wordt opgezocht)
const RING_JUNCTION_POINTS = {
  north: [112, -222],
  south: [80, 315],
  west: [-268, 14],
  east: [228, -89],
  prairie: [152, 270],
  trailWest: [-257, -45],
  trailNorth: [-64, -276]
};
export const RING_JUNCTIONS = {};
Object.entries(RING_JUNCTION_POINTS).forEach(([key, [x, z]]) => {
  RING_JUNCTIONS[key] = { u: closestUOnCurve(ringCurve, x, z, true) };
});

const ringProfile = buildRoadProfile(ringCurve, true, {
  id: 'coast_hwy',
  smoothM: 38,
  minY: 2.0,
  flats: Object.values(RING_JUNCTIONS).map((j) => {
    const f = { u: j.u };
    j.flat = f;
    return f;
  })
});
export const getRingBaseElev = ringProfile.elevFn;
export const getRingBridgeAtU = ringProfile.bridgeFn;
export const RING_BRIDGES = ringProfile.bridges;
Object.values(RING_JUNCTIONS).forEach((j) => {
  const fr = frameAt(ringCurve, j.u);
  // normaal richting eilandcentrum
  let inX = fr.nx, inZ = fr.nz;
  if (inX * (ISLAND_CENTER.x - fr.pt.x) + inZ * (ISLAND_CENTER.z - fr.pt.z) < 0) { inX = -inX; inZ = -inZ; }
  j.x = fr.pt.x; j.z = fr.pt.z; j.y = j.flat.resolvedY; j.inX = inX; j.inZ = inZ;
});

// =========================================================
// VERBINDINGSWEGEN: binnenland -> kustweg
// =========================================================
function hostJunction(curve, u, elevFn) {
  const fr = frameAt(curve, u);
  let outX = fr.nx, outZ = fr.nz;
  if (outX * (fr.pt.x - ISLAND_CENTER.x) + outZ * (fr.pt.z - ISLAND_CENTER.z) < 0) { outX = -outX; outZ = -outZ; }
  return { x: fr.pt.x, z: fr.pt.z, y: elevFn(u), outX, outZ };
}

function ringEndpoint(ringJ, fromInside = true) {
  // Benadering vanaf de binnenkant van de kustweg (richting eilandcentrum)
  const s = fromInside ? 1 : -1;
  return { x: ringJ.x, z: ringJ.z, y: ringJ.y, outX: ringJ.inX * s, outZ: ringJ.inZ * s };
}

function makeLinkRoad(id, a, b, midPoints, smoothM = 40, teePoints = []) {
  // a en b: { x, z, y, outX, outZ } met out = richting waarin de nieuwe weg vertrekt
  const wps = [
    new THREE.Vector3(a.x - a.outX * 1.2, 0, a.z - a.outZ * 1.2),
    new THREE.Vector3(a.x + a.outX * 16, 0, a.z + a.outZ * 16),
    ...midPoints.map((p) => new THREE.Vector3(p[0], 0, p[1])),
    new THREE.Vector3(b.x + b.outX * 16, 0, b.z + b.outZ * 16),
    new THREE.Vector3(b.x - b.outX * 1.2, 0, b.z - b.outZ * 1.2)
  ];
  const curve = new THREE.CatmullRomCurve3(wps, false, 'centripetal', 0.5);
  const teeFlats = teePoints.map(([tx, tz]) => ({ u: closestUOnCurve(curve, tx, tz, false), flatM: 6, blendM: 30 }));
  const prof = buildRoadProfile(curve, false, {
    id,
    smoothM,
    minY: 1.8,
    flats: [
      { u: 0, y: a.y, flatM: 6, blendM: 34 },
      { u: 1, y: b.y, flatM: 6, blendM: 34 },
      ...teeFlats
    ]
  });
  return { id, curve, elevFn: prof.elevFn, bridgeFn: prof.bridgeFn, bridges: prof.bridges, host: a, ringJ: b, tees: teeFlats };
}

// T-splitsing halverwege een verbindingsweg; 'out' wijst naar de kant waar de nieuwe weg vertrekt
function teeJunction(road, teeIdx, towardX, towardZ) {
  const t = road.tees[teeIdx];
  const fr = frameAt(road.curve, t.u);
  let outX = fr.nx, outZ = fr.nz;
  if (outX * (towardX - fr.pt.x) + outZ * (towardZ - fr.pt.z) < 0) { outX = -outX; outZ = -outZ; }
  return { x: fr.pt.x, z: fr.pt.z, y: t.resolvedY, outX, outZ };
}

const hostNorth = hostJunction(lakeCurve, U_LAKE_NORTH_JUNCTION, getLakeLoopBaseElev);
const hostSouth = hostJunction(valleyCurve, U_VALLEY_SOUTH_JUNCTION, getValleyBaseElev);
const hostWest = hostJunction(valleyCurve, U_VALLEY_WEST_JUNCTION, getValleyBaseElev);
const hostEast = hostJunction(lakeCurve, U_LAKE_EAST_JUNCTION, getLakeLoopBaseElev);

export const connectorRoads = [
  makeLinkRoad('north_link', hostNorth, ringEndpoint(RING_JUNCTIONS.north), [[92, -130], [112, -178]]),
  makeLinkRoad('south_link', hostSouth, ringEndpoint(RING_JUNCTIONS.south), [[78, 215], [92, 262]]),
  makeLinkRoad('west_link', hostWest, ringEndpoint(RING_JUNCTIONS.west), [[-176, 52], [-222, 30]]),
  // Fox Lake Road: van de meerweg langs de zuidoever van Fox Lake naar de oostelijke kustweg
  makeLinkRoad('fox_lake_road', hostEast, ringEndpoint(RING_JUNCTIONS.east), [[132, -24], [168, -34], [198, -48], [212, -70]], 32, [[176, -37]])
];

// Timber Trail: smal kronkelend bospad door de heuvels met een haarspeldbocht,
// tussen de westkust en de noordkust (alternatieve route door het bos)
export const timberTrail = makeLinkRoad(
  'timber_trail',
  ringEndpoint(RING_JUNCTIONS.trailWest),
  ringEndpoint(RING_JUNCTIONS.trailNorth),
  [
    [-200, -52], [-178, -82], [-186, -112], [-212, -124], [-222, -146], [-196, -166],
    [-160, -150], [-128, -132], [-104, -158], [-110, -192], [-82, -214], [-48, -222]
  ],
  22,
  [[-50, -224]]
);

// =========================================================
// NIEUWE ZIJTAKKEN
// - Pine River Road: van de meerweg langs de westoever van Pine River naar het Timber Trail
// - Prairie Road: van Fox Lake Road dwars door het open oosten, langs Moose Lake, naar de kustweg
// =========================================================
const hostPine = hostJunction(lakeCurve, U_LAKE_PINE_JUNCTION, getLakeLoopBaseElev);
const foxRoad = connectorRoads.find((c) => c.id === 'fox_lake_road');
export const branchRoads = [
  makeLinkRoad(
    'pine_river_road',
    hostPine,
    teeJunction(timberTrail, 0, -26, -212),
    [[-30, -112], [-37, -136], [-25, -162], [-15, -187], [-24, -210]],
    26
  ),
  makeLinkRoad(
    'prairie_road',
    teeJunction(foxRoad, 0, 177, 0),
    ringEndpoint(RING_JUNCTIONS.prairie),
    [[177, -6], [179, 15], [192, 48], [190, 90], [176, 122], [164, 160], [151, 204], [146, 240]],
    30
  )
];

export const outerRoadDefs = [
  { id: 'coast_hwy', curve: ringCurve, elevFn: getRingBaseElev, bridgeFn: getRingBridgeAtU, bridges: RING_BRIDGES, isClosed: true },
  ...connectorRoads.map((c) => ({ ...c, isClosed: false })),
  { ...timberTrail, isClosed: false },
  ...branchRoads.map((c) => ({ ...c, isClosed: false }))
];
outerRoadDefs.forEach((def) => {
  const count = Math.max(80, Math.round(def.curve.getLength() / 0.85));
  def.samples = sampleRoadCurve(def.id, def.curve, count, def.isClosed, MAIN_HALF_WIDTH, def.elevFn, def.bridgeFn);
});
export const ringSamples = outerRoadDefs[0].samples;

export const allRoadNetworks = [
  { id: 'lake_loop', samples: lakeSamples, halfWidth: MAIN_HALF_WIDTH, isClosed: true },
  { id: 'valley_road', samples: valleySamples, halfWidth: MAIN_HALF_WIDTH, isClosed: false },
  ...streetSampleSets.map((s) => ({ id: s.def.id, samples: s.samples, halfWidth: s.def.halfWidth, isClosed: false })),
  ...outerRoadDefs.map((d) => ({ id: d.id, samples: d.samples, halfWidth: MAIN_HALF_WIDTH, isClosed: d.isClosed }))
];

// PERFORMANCE FIX: Spatial Hash Grid voor alle wegpunten zodat `getClosestNetworkRoad` 20x sneller is!
const ROAD_HASH_CELL = 16;
const roadSpatialMap = new Map();
// Numerieke sleutel i.p.v. een string: geen garbage per opvraging (terrein-bake én elk frame)
const roadHashKey = (cx, cz) => (cx + 2048) * 4096 + (cz + 2048);
const allFlatRoadSamples = [];

allRoadNetworks.forEach((net) => {
  net.samples.forEach((s) => {
    const globalIdx = allFlatRoadSamples.length;
    allFlatRoadSamples.push(s);
    const cx = Math.floor(s.x / ROAD_HASH_CELL);
    const cz = Math.floor(s.z / ROAD_HASH_CELL);
    // Registreer in 5x5 buurcellen: elke weg wordt tot minstens 32 m afstand gevonden
    // (nodig voor de brede, flauwe taluds langs wegen; anders ontstaat een richel aan de rand van het zoekbereik)
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        const key = roadHashKey(cx + dx, cz + dz);
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
  const bucket = roadSpatialMap.get(roadHashKey(cx, cz));

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
  { x: valleySouthHitPt.x, z: valleySouthHitPt.z, y: valleySouthHitY, r: 7.6 },
  // De doorgetrokken dorpslanen sluiten aan op de valleiweg
  ...townStreetDefs.filter((d) => d.valleyEnd).map((d) => ({ x: d.valleyEnd.x, z: d.valleyEnd.z, y: d.valleyEnd.y, r: 7.0 })),
  // Nieuwe T-splitsingen van de verbindingswegen en de spiraalweg
  ...connectorRoads.flatMap((c) => [
    { x: c.host.x, z: c.host.z, y: c.host.y, r: 7.8 },
    { x: c.ringJ.x, z: c.ringJ.z, y: c.ringJ.y, r: 7.8 }
  ]),
  { x: timberTrail.host.x, z: timberTrail.host.z, y: timberTrail.host.y, r: 7.8 },
  { x: timberTrail.ringJ.x, z: timberTrail.ringJ.z, y: timberTrail.ringJ.y, r: 7.8 },
  ...branchRoads.flatMap((c) => [
    { x: c.host.x, z: c.host.z, y: c.host.y, r: 7.8 },
    { x: c.ringJ.x, z: c.ringJ.z, y: c.ringJ.y, r: 7.8 }
  ])
];

export function isInsideIntersection(x, z, extraR = 0) {
  for (const inter of INTERSECTIONS) {
    if (Math.hypot(x - inter.x, z - inter.z) < inter.r + extraR) return true;
  }
  return false;
}

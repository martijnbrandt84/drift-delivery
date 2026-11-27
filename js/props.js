import * as THREE from 'three';
import {
  scene, makeToonMat, registerSeasonalMat, createMergedToonProp, instantiateBakedProp,
  pineSnowCapObjects, deciduousFoliageObjects
} from './scene-setup.js';
import { TOWN_BOUNDS, TOWN_ELEV, getClosestNetworkRoad } from './roads.js';
import { driveways, ruralLots, getDistToRivers } from './water-lots.js';
import { hardColliders, registerDestructible } from './demolition.js';
import { getTerrainHeight, getLocalSlope } from './terrain.js';
import { stoneMat } from './town.js';

// =========================================================
// GEBAKKEN 1-MESH BOMEN & STRUIKEN (NUL LAG, 60FPS!)
// =========================================================
const trunkMat = makeToonMat(0x6b3f28);
const birchTrunkMat = makeToonMat(0xeae0d0);
const pineMats = [
  makeToonMat(0x2f5e41),
  makeToonMat(0x3d6e49),
  makeToonMat(0x4c7c46),
  makeToonMat(0x264d36)
];
const thickSnowMat = makeToonMat(0xf5faff);
const aspenMats = [
  makeToonMat(0xe89f38),
  makeToonMat(0xdc6a35),
  makeToonMat(0xc94a38),
  makeToonMat(0x5d8f44),
  makeToonMat(0x889e42),
  makeToonMat(0xd9b83b)
];
const shrubMats = [
  registerSeasonalMat(0x6e9e48, 0x7d8c7c),
  registerSeasonalMat(0x558546, 0x5c7563),
  registerSeasonalMat(0x8ab048, 0x8a9988),
  registerSeasonalMat(0x3f6e3c, 0x556b5d),
  registerSeasonalMat(0xd98236, 0x8f7a68)
];

// Bak gedeelde Dennenboom-templates
export const pineNeedleParts = [];
export const pineSnowParts = [];
for (let k = 0; k < 4; k++) {
  const r = 2.18 - k * 0.38;
  const h = 2.35 - k * 0.2;
  const y = 2.4 + k * 1.25;
  pineNeedleParts.push({ geo: new THREE.ConeGeometry(r, h, 7), matrix: new THREE.Matrix4().makeTranslation(0, y, 0) });

  const capH = h * (0.58 + k * 0.06);
  const capR = r * 0.84;
  const mCap = new THREE.Matrix4().makeRotationY(0.12).setPosition(0, y + (h - capH) * 0.5 + 0.07, 0);
  pineSnowParts.push({ geo: new THREE.ConeGeometry(capR, capH, 7), matrix: mCap });

  if (k < 3) {
    for (let b = 0; b < 4; b++) {
      const ba = (b / 4) * Math.PI * 2 + k * 0.7;
      const mBlob = new THREE.Matrix4().makeScale(1.3, 0.55, 1.1).setPosition(Math.cos(ba) * (r * 0.68), y - h * 0.22, Math.sin(ba) * (r * 0.68));
      pineSnowParts.push({ geo: new THREE.SphereGeometry(0.32, 5, 5), matrix: mBlob });
    }
  }
}

export const bakedPineTrunk = createMergedToonProp(
  [{ geo: new THREE.CylinderGeometry(0.28, 0.50, 2.95, 7), matrix: new THREE.Matrix4().makeTranslation(0, 1.15, 0) }],
  trunkMat,
  0.045,
  true
);
const bakedPineNeedles = pineMats.map((mat) => createMergedToonProp(pineNeedleParts, mat, 0.05, true));
export const bakedPineSnow = createMergedToonProp(pineSnowParts, thickSnowMat, 0.035, false);

export function createPineFast(scale) {
  const g = new THREE.Group();
  g.add(instantiateBakedProp(bakedPineTrunk));
  g.add(instantiateBakedProp(bakedPineNeedles[Math.floor(Math.random() * bakedPineNeedles.length)]));

  const snowMesh = instantiateBakedProp(bakedPineSnow);
  snowMesh.visible = false;
  g.add(snowMesh);
  pineSnowCapObjects.push(snowMesh);

  g.scale.setScalar(scale);
  return g;
}

// Bak gedeelde Loofboom-templates
const birchSkeletonParts = [
  { geo: new THREE.CylinderGeometry(0.14, 0.40, 3.65, 7), matrix: new THREE.Matrix4().makeTranslation(0, 1.50, 0) }
];
const birchSnowParts = [];

[0.2, 1.85, 3.4, 4.95].forEach((ang, idx) => {
  const pivotM = new THREE.Matrix4()
    .makeTranslation(0, 2.45 + (idx % 2) * 0.35, 0)
    .multiply(new THREE.Matrix4().makeRotationY(ang))
    .multiply(new THREE.Matrix4().makeRotationZ(0.58 + (idx % 2) * 0.12));

  const limbM = pivotM.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.9, 0));
  birchSkeletonParts.push({ geo: new THREE.CylinderGeometry(0.055, 0.13, 1.85, 5), matrix: limbM });

  const twigM = pivotM.clone()
    .multiply(new THREE.Matrix4().makeTranslation(0.18, 1.45, 0))
    .multiply(new THREE.Matrix4().makeRotationZ(-0.52));
  birchSkeletonParts.push({ geo: new THREE.CylinderGeometry(0.035, 0.065, 0.95, 5), matrix: twigM });

  const snowM = pivotM.clone()
    .multiply(new THREE.Matrix4().makeTranslation(0, 1.15, 0))
    .multiply(new THREE.Matrix4().makeScale(0.7, 0.4, 2.2));
  birchSnowParts.push({ geo: new THREE.SphereGeometry(0.14, 5, 5), matrix: snowM });
});

export const bakedBirchSkeleton = createMergedToonProp(birchSkeletonParts, birchTrunkMat, 0.038, true);
export const bakedBirchSnow = createMergedToonProp(birchSnowParts, thickSnowMat, 0, false);

export const crownParts = [
  { geo: new THREE.IcosahedronGeometry(1.65, 1), matrix: new THREE.Matrix4().makeScale(1, 1.2, 1).setPosition(0, 3.85, 0) },
  { geo: new THREE.IcosahedronGeometry(1.1, 1), matrix: new THREE.Matrix4().makeTranslation(0.85, 3.35, 0.4) }
];
const bakedAspenCrowns = aspenMats.map((mat) => createMergedToonProp(crownParts, mat, 0.05, true));

export function createDeciduousTreeFast(scale) {
  const g = new THREE.Group();
  g.add(instantiateBakedProp(bakedBirchSkeleton));

  const bSnow = instantiateBakedProp(bakedBirchSnow);
  bSnow.visible = false;
  g.add(bSnow);
  pineSnowCapObjects.push(bSnow);

  const foliage = instantiateBakedProp(bakedAspenCrowns[Math.floor(Math.random() * bakedAspenCrowns.length)]);
  g.add(foliage);
  deciduousFoliageObjects.push(foliage);

  g.scale.setScalar(scale);
  return g;
}

// Gebakken Struik met meer volume en kleine & grote varianten door elkaar
const sharedLobeGeo = new THREE.IcosahedronGeometry(0.78, 1);
const bakedShrubs = shrubMats.map((mat) =>
  createMergedToonProp(
    [
      { geo: sharedLobeGeo, matrix: new THREE.Matrix4().makeScale(1.18, 0.86, 1.12).setPosition(0, 0.5, 0) },
      { geo: sharedLobeGeo, matrix: new THREE.Matrix4().makeScale(0.76, 0.68, 0.78).setPosition(0.45, 0.36, 0.25) }
    ],
    mat,
    0.04,
    false
  )
);
const shrubSnowGeo = sharedLobeGeo.clone();
shrubSnowGeo.applyMatrix4(new THREE.Matrix4().makeScale(1.05, 0.45, 1.02).setPosition(0, 0.78, 0));

export function createShrubFast(baseScale = 1) {
  const g = instantiateBakedProp(bakedShrubs[Math.floor(Math.random() * bakedShrubs.length)]);
  const sCap = new THREE.Mesh(shrubSnowGeo, thickSnowMat);
  sCap.visible = false;
  g.add(sCap);
  pineSnowCapObjects.push(sCap);

  const widthVar = 0.85 + Math.random() * 0.38;
  const heightVar = 0.82 + Math.random() * 0.35;
  g.scale.set(baseScale * widthVar, baseScale * heightVar, baseScale / widthVar);
  return g;
}

export function isInsideTownFootprint(x, z, pad = 0) {
  return x > TOWN_BOUNDS.minX - pad && x < TOWN_BOUNDS.maxX + pad && z > TOWN_BOUNDS.minZ - pad && z < TOWN_BOUNDS.maxZ + pad;
}

export function isNearAnyDriveway(x, z, margin = 2.5) {
  for (const d of driveways) {
    const l2 = (d.x2 - d.x1) ** 2 + (d.z2 - d.z1) ** 2;
    const t = THREE.MathUtils.clamp(((x - d.x1) * (d.x2 - d.x1) + (z - d.z1) * (d.z2 - d.z1)) / l2, 0, 1);
    if (Math.hypot(x - (d.x1 + t * (d.x2 - d.x1)), z - (d.z1 + t * (d.z2 - d.z1))) < d.halfWidth + margin) return true;
  }
  return false;
}

export function isNearAnyRuralLot(x, z, radius = 9.2) {
  for (const lot of ruralLots) {
    if (Math.hypot(x - lot.x, z - lot.z) < radius) return true;
  }
  return false;
}

[-14.5, 14.5, -21.5, 21.5].forEach((tx) => {
  const townTree = createDeciduousTreeFast(0.88);
  const y = TOWN_ELEV + 0.14;
  townTree.position.set(tx, y, 96.2);
  scene.add(townTree);
  registerDestructible(townTree, tx, y, 96.2, 0.85, 'tree', 20, 'Dorpsboom');
});

// Enkele dichtere bosplekken verspreid over het landschap
const denseGroveCenters = [
  { x: -78, z: 32, r: 34 },
  { x: 84,  z: 28, r: 36 },
  { x: -65, z: -68, r: 38 },
  { x: 12,  z: -88, r: 32 }
];

function isInDenseGrove(x, z) {
  return denseGroveCenters.some((g) => Math.hypot(x - g.x, z - g.z) < g.r);
}

const placedTreeCoords = [];
let placedTrees = 0;
let attempts = 0;

while (placedTrees < 360 && attempts < 5400) {
  attempts++;
  let tx, tz;
  const inGrove = placedTrees < 110 && Math.random() < 0.55;

  if (inGrove) {
    const g = denseGroveCenters[placedTrees % denseGroveCenters.length];
    const ang = Math.random() * Math.PI * 2;
    const rad = Math.random() * g.r;
    tx = g.x + Math.cos(ang) * rad;
    tz = g.z + Math.sin(ang) * rad;
  } else {
    tx = (Math.random() - 0.5) * 440;
    tz = (Math.random() - 0.5) * 440;
  }

  if (isInsideTownFootprint(tx, tz, 4.5) || isNearAnyRuralLot(tx, tz, 9.5)) continue;

  const groveDensity = Math.sin(tx * 0.032) * Math.cos(tz * 0.032) + Math.sin((tx + tz) * 0.018) * 0.5;
  if (!isInDenseGrove(tx, tz) && groveDensity < -0.22 && Math.random() < 0.72) continue;

  const ty = getTerrainHeight(tx, tz);
  if (ty < 0.65 || ty > 16.0) continue;
  if (getLocalSlope(tx, tz) > 0.55) continue;

  const { marginDist } = getClosestNetworkRoad(tx, tz);
  if (marginDist < 3.2 || getDistToRivers(tx, tz) < 3.5 || isNearAnyDriveway(tx, tz, 2.8)) continue;

  const minSpacing = isInDenseGrove(tx, tz) ? 2.6 : 3.6;
  let tooClose = false;
  for (let p = 0; p < placedTreeCoords.length; p++) {
    const pt = placedTreeCoords[p];
    if (Math.hypot(tx - pt.x, tz - pt.z) < minSpacing) { tooClose = true; break; }
  }
  if (tooClose) continue;

  let overlap = false;
  for (const c of hardColliders) {
    if (Math.hypot(tx - c.x, tz - c.z) < c.r + 2.8) { overlap = true; break; }
  }
  if (overlap) continue;

  const scale = 0.78 + Math.random() * 0.78;
  const isDecid = Math.random() < (tx < -15 || ty < 2.2 ? 0.52 : 0.34);
  const tree = isDecid ? createDeciduousTreeFast(scale) : createPineFast(scale);
  tree.position.set(tx, ty, tz);
  tree.rotation.y = Math.random() * Math.PI * 2;
  scene.add(tree);

  placedTreeCoords.push({ x: tx, z: tz });
  registerDestructible(tree, tx, ty, tz, 0.85 * scale, 'tree', 15, isDecid ? 'Loofboom' : 'Dennenboom');
  placedTrees++;
}

// Mix van kleine struikjes (0.45..0.75) en grote struiken (1.15..1.85) door elkaar
let placedShrubs = 0;
let shrubTries = 0;
while (placedShrubs < 240 && shrubTries < 3600) {
  shrubTries++;
  const sx = (Math.random() - 0.5) * 425;
  const sz = (Math.random() - 0.5) * 425;
  if (isInsideTownFootprint(sx, sz, 2.5) || isNearAnyRuralLot(sx, sz, 7.5) || isNearAnyDriveway(sx, sz, 1.8)) continue;

  const sy = getTerrainHeight(sx, sz);
  if (sy < 0.45 || sy > 13.5) continue;
  if (getLocalSlope(sx, sz) > 0.5) continue;
  const { marginDist } = getClosestNetworkRoad(sx, sz);
  if (marginDist < 1.8 || getDistToRivers(sx, sz) < 1.8) continue;

  const isLargeShrub = Math.random() < 0.45;
  const shrubScale = isLargeShrub
    ? 1.15 + Math.random() * 0.70
    : 0.45 + Math.random() * 0.32;

  const shrub = createShrubFast(shrubScale);
  shrub.position.set(sx, sy, sz);
  shrub.rotation.y = Math.random() * Math.PI * 2;
  scene.add(shrub);
  registerDestructible(shrub, sx, sy, sz, Math.max(0.6, 0.85 * shrubScale), 'shrub', 3, isLargeShrub ? 'Grote struik' : 'Struik');
  placedShrubs++;
}

export const bakedRock = createMergedToonProp(
  [{ geo: new THREE.DodecahedronGeometry(1.0, 0), matrix: new THREE.Matrix4().makeScale(1.1, 0.65, 0.95) }],
  stoneMat,
  0.048,
  false
);
for (let i = 0; i < 40; i++) {
  const rx = (Math.random() - 0.5) * 420;
  const rz = (Math.random() - 0.5) * 420;
  if (isInsideTownFootprint(rx, rz, 6.5) || isNearAnyRuralLot(rx, rz, 9.5) || isNearAnyDriveway(rx, rz, 3.5)) continue;

  const ry = getTerrainHeight(rx, rz);
  if (ry < 0.45) continue;
  if (getLocalSlope(rx, rz) > 0.95) continue;
  const { marginDist } = getClosestNetworkRoad(rx, rz);
  if (marginDist < 5.0) continue;

  const rs = 0.85 + Math.random() * 1.25;
  const rock = instantiateBakedProp(bakedRock);
  rock.scale.setScalar(rs);
  rock.position.set(rx, ry + 0.15, rz);
  rock.rotation.set(0.15, Math.random() * Math.PI, 0.12);
  scene.add(rock);
  hardColliders.push({ x: rx, z: rz, r: rs * 0.85, wild: true, mesh: rock });
}
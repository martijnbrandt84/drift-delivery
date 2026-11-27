import * as THREE from 'three';
import {
  scene, makeToonMat, createMergedToonProp, outlineMat, deciduousFoliageObjects, pineSnowCapObjects
} from './scene-setup.js';
import { WATER_LEVEL, getClosestNetworkRoad, getDistToRivers } from './roads.js';
import { ruralLots } from './water-lots.js';
import { ISLAND_CENTER, getIslandPolar, getCoastRadius, MOOSE_LAKE, FOX_LAKE } from './landscape.js';
import { destructibles, registerInstancedDestructible } from './demolition.js';
import { getTerrainHeight, getLocalSlope } from './terrain.js';
import { isInsideTownFootprint, isNearAnyDriveway } from './props.js';

// =========================================================
// MEER VARIATIE IN HET GROEN — in de stijl van Pinewood:
// esdoorns, losse eiken, dode dennen, varens, omgevallen stammen, stronken,
// paddenstoelen, riet langs het water, helmgras aan de kust en wilde bloemen.
// Alles instanced: een handvol draw calls voor duizenden plantjes.
// =========================================================

// ---------- Hulpjes ----------
function lotBlocked(x, z, extra = 6) {
  for (const lot of ruralLots) {
    if (lot.flatBox) {
      const c = Math.cos(lot.yaw);
      const s = Math.sin(lot.yaw);
      const dx = x - lot.x;
      const dz = z - lot.z;
      const lx = dx * c - dz * s;
      const lz = dx * s + dz * c;
      const fb = lot.flatBox;
      if (lx > fb.minLX - extra && lx < fb.maxLX + extra && lz > fb.minLZ - extra && lz < fb.maxLZ + extra + 4) return true;
    } else if (Math.hypot(x - lot.x, z - lot.z) < (lot.type === 'villa' ? 32 : 13)) {
      return true;
    }
  }
  return false;
}

// Snel raster van bestaande bomen/objecten, zodat nieuw groen er niet doorheen groeit
const occGrid = new Map();
const occKey = (x, z) => `${Math.floor(x / 5)},${Math.floor(z / 5)}`;
function occupy(x, z, r) {
  const k = occKey(x, z);
  if (!occGrid.has(k)) occGrid.set(k, []);
  occGrid.get(k).push({ x, z, r });
}
destructibles.forEach((d) => occupy(d.x, d.z, d.r || 1));
function isFree(x, z, r) {
  const cx = Math.floor(x / 5);
  const cz = Math.floor(z / 5);
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
    const arr = occGrid.get(`${cx + dx},${cz + dz}`);
    if (arr) for (const p of arr) if (Math.hypot(x - p.x, z - p.z) < r + p.r) return false;
  }
  return true;
}

function randomIslandPoint(minR = 0) {
  const ang = Math.random() * Math.PI * 2;
  const rr = minR + Math.sqrt(Math.random()) * (430 - minR);
  return { x: ISLAND_CENTER.x + Math.cos(ang) * rr, z: ISLAND_CENTER.z + Math.sin(ang) * rr };
}

function forestDensity(x, z) {
  return (
    Math.sin(x * 0.018 + 1.3) * Math.cos(z * 0.021 - 0.4) +
    Math.sin((x + z) * 0.011) * 0.5 +
    Math.cos((x - z) * 0.027 + 0.8) * 0.3
  );
}

function landOk(x, z, roadMargin = 4) {
  const pol = getIslandPolar(x, z);
  if (pol.r > getCoastRadius(pol.theta) - 8) return false;
  if (getClosestNetworkRoad(x, z).marginDist < roadMargin) return false;
  if (isInsideTownFootprint(x, z, 6) || lotBlocked(x, z) || isNearAnyDriveway(x, z, 3)) return false;
  return true;
}

// Instanced set (+ optioneel outline) met per-instance matrix en kleur
function buildSet(baked, items, { material = null, colors = null, castShadow = false, outline = true } = {}) {
  if (!items.length) return null;
  const mat = material ?? baked.material;
  const main = new THREE.InstancedMesh(baked.mergedMain, mat, items.length);
  main.castShadow = castShadow;
  const out = outline && baked.mergedOut ? new THREE.InstancedMesh(baked.mergedOut, outlineMat, items.length) : null;
  const dummy = new THREE.Object3D();
  items.forEach((t, i) => {
    dummy.position.set(t.x, t.y, t.z);
    dummy.rotation.set(t.leanX ?? 0, t.rot, t.leanZ ?? 0);
    dummy.scale.set(t.scale * (t.w ?? 1), t.scale * (t.h ?? 1), t.scale * (t.w ?? 1));
    dummy.updateMatrix();
    main.setMatrixAt(i, dummy.matrix);
    if (out) out.setMatrixAt(i, dummy.matrix);
    if (colors) main.setColorAt(i, t.color ?? colors[i % colors.length]);
  });
  main.instanceMatrix.needsUpdate = true;
  if (main.instanceColor) main.instanceColor.needsUpdate = true;
  main.computeBoundingSphere();
  scene.add(main);
  if (out) {
    out.instanceMatrix.needsUpdate = true;
    out.computeBoundingSphere();
    scene.add(out);
  }
  return { main, out };
}

// Niet-sloopbare begroeiing (varens, riet, gras, bloemen, paddenstoelen) kan plaatselijk worden weggehaald
const clearable = [];
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
export function clearVegetationAround(x, z, r) {
  clearable.forEach(({ items, sets }) => {
    items.forEach((t, i) => {
      if (Math.hypot(t.x - x, t.z - z) > r) return;
      sets.forEach((set) => {
        if (!set) return;
        set.main.setMatrixAt(i, ZERO);
        set.main.instanceMatrix.needsUpdate = true;
        if (set.out) {
          set.out.setMatrixAt(i, ZERO);
          set.out.instanceMatrix.needsUpdate = true;
        }
      });
    });
  });
}

function registerSets(items, sets, r, kind, pts, label) {
  items.forEach((t, i) => {
    const refs = [];
    sets.forEach((set) => {
      if (!set) return;
      refs.push({ mesh: set.main, index: i });
      if (set.out) refs.push({ mesh: set.out, index: i });
    });
    registerInstancedDestructible(refs, t.x, t.y, t.z, t.rot, t.scale, r * t.scale, kind, pts, label, t);
  });
}

const M4 = () => new THREE.Matrix4();
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// =========================================================
// 1. ESDOORNS (maple) — breed, rond, rood/oranje: typisch Canadees
// =========================================================
const mapleTrunkMat = makeToonMat(0x5b3a26);
const mapleCrownMat = makeToonMat(0xffffff);
const MAPLE_COLORS = [0xc8322a, 0xd8482a, 0xe8702a, 0xb52a2e, 0xe09030].map((c) => new THREE.Color(c));
const bakedMapleTrunk = createMergedToonProp([
  { geo: new THREE.CylinderGeometry(0.22, 0.42, 2.8, 7), matrix: M4().makeTranslation(0, 1.4, 0) },
  { geo: new THREE.CylinderGeometry(0.08, 0.16, 1.6, 5), matrix: M4().makeTranslation(0.45, 2.9, 0).multiply(M4().makeRotationZ(-0.6)) },
  { geo: new THREE.CylinderGeometry(0.08, 0.16, 1.5, 5), matrix: M4().makeTranslation(-0.4, 2.8, 0.2).multiply(M4().makeRotationZ(0.65)) }
], mapleTrunkMat, 0.04, true);
const bakedMapleCrown = createMergedToonProp([
  { geo: new THREE.IcosahedronGeometry(1.7, 1), matrix: M4().makeScale(1.25, 0.85, 1.2).setPosition(0, 4.0, 0) },
  { geo: new THREE.IcosahedronGeometry(1.15, 1), matrix: M4().makeScale(1, 0.85, 1).setPosition(1.35, 3.6, 0.3) },
  { geo: new THREE.IcosahedronGeometry(1.1, 1), matrix: M4().makeScale(1, 0.85, 1).setPosition(-1.3, 3.55, -0.2) },
  { geo: new THREE.IcosahedronGeometry(1.0, 1), matrix: M4().makeScale(1, 0.8, 1).setPosition(0.1, 3.5, 1.3) },
  { geo: new THREE.IcosahedronGeometry(0.95, 1), matrix: M4().makeTranslation(-0.2, 4.9, -0.4) }
], mapleCrownMat, 0.05, true);

// =========================================================
// 2. LOSSE EIKEN in de weides — groot, donkergroen, breed
// =========================================================
const oakCrownMat = makeToonMat(0xffffff);
const OAK_COLORS = [0x4f7a3a, 0x5c8540, 0x6a8a3c, 0x8a8a3a].map((c) => new THREE.Color(c));
const bakedOakTrunk = createMergedToonProp([
  { geo: new THREE.CylinderGeometry(0.4, 0.7, 3.0, 8), matrix: M4().makeTranslation(0, 1.5, 0) },
  { geo: new THREE.CylinderGeometry(0.14, 0.28, 2.2, 6), matrix: M4().makeTranslation(0.75, 3.2, 0).multiply(M4().makeRotationZ(-0.75)) },
  { geo: new THREE.CylinderGeometry(0.14, 0.28, 2.2, 6), matrix: M4().makeTranslation(-0.7, 3.1, 0.3).multiply(M4().makeRotationZ(0.8)) }
], mapleTrunkMat, 0.045, true);
const bakedOakCrown = createMergedToonProp([
  { geo: new THREE.IcosahedronGeometry(2.3, 1), matrix: M4().makeScale(1.35, 0.8, 1.3).setPosition(0, 4.6, 0) },
  { geo: new THREE.IcosahedronGeometry(1.5, 1), matrix: M4().makeScale(1, 0.8, 1).setPosition(2.0, 4.1, 0.4) },
  { geo: new THREE.IcosahedronGeometry(1.5, 1), matrix: M4().makeScale(1, 0.8, 1).setPosition(-2.0, 4.0, -0.3) },
  { geo: new THREE.IcosahedronGeometry(1.3, 1), matrix: M4().makeTranslation(0.3, 5.6, -0.6) }
], oakCrownMat, 0.05, true);

// =========================================================
// 3. DODE DENNEN — kale grijze stammen met stompe takken
// =========================================================
const deadWoodMat = makeToonMat(0x8a7e72);
const deadParts = [{ geo: new THREE.CylinderGeometry(0.12, 0.42, 6.4, 7), matrix: M4().makeTranslation(0, 3.2, 0) }];
for (let k = 0; k < 6; k++) {
  const a = k * 2.1;
  const y = 2.6 + k * 0.6;
  const len = 1.2 - k * 0.12;
  deadParts.push({
    geo: new THREE.CylinderGeometry(0.03, 0.08, len, 4),
    matrix: M4().makeTranslation(Math.cos(a) * len * 0.45, y, Math.sin(a) * len * 0.45)
      .multiply(M4().makeRotationY(-a))
      .multiply(M4().makeRotationZ(-1.25))
  });
}
const bakedDeadPine = createMergedToonProp(deadParts, deadWoodMat, 0.04, true);

// =========================================================
// 4. BOSBODEM: varens, stammen, stronken, paddenstoelen
// =========================================================
const fernMat = makeToonMat(0xffffff, { side: THREE.DoubleSide });
const FERN_COLORS = [0x4f8a3c, 0x5f9640, 0x6f9a3a, 0xa88a3a].map((c) => new THREE.Color(c));
const fernParts = [];
for (let k = 0; k < 7; k++) {
  const a = (k / 7) * Math.PI * 2;
  const leaf = new THREE.ConeGeometry(0.22, 1.25, 4);
  fernParts.push({
    geo: leaf,
    matrix: M4().makeRotationY(a).multiply(M4().makeTranslation(0, 0.38, 0.45)).multiply(M4().makeRotationX(1.05)).multiply(M4().makeScale(1, 1, 0.25))
  });
}
const bakedFern = createMergedToonProp(fernParts, fernMat, 0, false);

const logBarkMat = makeToonMat(0x6b4a32);
const logEndMat = makeToonMat(0xd8b07a);
const bakedLog = createMergedToonProp([
  { geo: new THREE.CylinderGeometry(0.42, 0.48, 5.0, 8), matrix: M4().makeRotationZ(Math.PI / 2).setPosition(0, 0.4, 0) },
  { geo: new THREE.CylinderGeometry(0.06, 0.1, 0.9, 4), matrix: M4().makeTranslation(-0.8, 0.95, 0.2).multiply(M4().makeRotationZ(0.5)) },
  { geo: new THREE.CylinderGeometry(0.05, 0.09, 0.7, 4), matrix: M4().makeTranslation(1.2, 0.85, -0.25).multiply(M4().makeRotationX(0.6)) }
], logBarkMat, 0.04, true);
const bakedLogEnds = createMergedToonProp([
  { geo: new THREE.CircleGeometry(0.4, 8), matrix: M4().makeRotationY(Math.PI / 2).setPosition(2.51, 0.4, 0) },
  { geo: new THREE.CircleGeometry(0.44, 8), matrix: M4().makeRotationY(-Math.PI / 2).setPosition(-2.51, 0.4, 0) }
], logEndMat, 0, false);
const bakedStump = createMergedToonProp([
  { geo: new THREE.CylinderGeometry(0.5, 0.65, 0.7, 8), matrix: M4().makeTranslation(0, 0.35, 0) },
  { geo: new THREE.CylinderGeometry(0.1, 0.2, 0.6, 5), matrix: M4().makeTranslation(0.55, 0.15, 0).multiply(M4().makeRotationZ(-1.2)) }
], logBarkMat, 0.04, false);
const bakedStumpTop = createMergedToonProp([
  { geo: new THREE.CircleGeometry(0.48, 8), matrix: M4().makeRotationX(-Math.PI / 2).setPosition(0, 0.71, 0) }
], logEndMat, 0, false);
const mushCapMat = makeToonMat(0xd6332a);
const mushStemMat = makeToonMat(0xf4ecd8);
const bakedMushCaps = createMergedToonProp([
  { geo: new THREE.SphereGeometry(0.2, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), matrix: M4().makeTranslation(0, 0.28, 0) },
  { geo: new THREE.SphereGeometry(0.14, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), matrix: M4().makeTranslation(0.3, 0.2, 0.15) },
  { geo: new THREE.SphereGeometry(0.11, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), matrix: M4().makeTranslation(-0.2, 0.16, 0.25) }
], mushCapMat, 0.02, false);
const bakedMushStems = createMergedToonProp([
  { geo: new THREE.CylinderGeometry(0.05, 0.07, 0.28, 5), matrix: M4().makeTranslation(0, 0.14, 0) },
  { geo: new THREE.CylinderGeometry(0.04, 0.05, 0.2, 5), matrix: M4().makeTranslation(0.3, 0.1, 0.15) },
  { geo: new THREE.CylinderGeometry(0.03, 0.04, 0.16, 5), matrix: M4().makeTranslation(-0.2, 0.08, 0.25) }
], mushStemMat, 0, false);

// =========================================================
// 5. WATERKANT EN KUST: riet met lisdodden, helmgras
// =========================================================
const reedMat = makeToonMat(0xffffff);
const REED_COLORS = [0x7a9a48, 0x8aa050, 0x9a9a52, 0xb0a058].map((c) => new THREE.Color(c));
const reedParts = [];
for (let k = 0; k < 9; k++) {
  const a = k * 2.4;
  const rr = 0.15 + (k % 3) * 0.18;
  const h = 1.3 + (k % 4) * 0.3;
  reedParts.push({
    geo: new THREE.ConeGeometry(0.05, h, 3),
    matrix: M4().makeTranslation(Math.cos(a) * rr, h / 2, Math.sin(a) * rr).multiply(M4().makeRotationZ((k % 2 ? 1 : -1) * 0.12))
  });
}
const bakedReeds = createMergedToonProp(reedParts, reedMat, 0, false);
const cattailMat = makeToonMat(0x5a3a22);
const cattailParts = [];
[[0.15, 1.75, 0], [-0.2, 1.55, 0.15], [0.05, 1.95, -0.2]].forEach(([x, y, z]) => {
  cattailParts.push({ geo: new THREE.CylinderGeometry(0.07, 0.07, 0.36, 6), matrix: M4().makeTranslation(x, y, z) });
});
const bakedCattails = createMergedToonProp(cattailParts, cattailMat, 0.015, false);

const grassMat = makeToonMat(0xffffff, { side: THREE.DoubleSide });
const DUNE_COLORS = [0xb8b060, 0xa8a858, 0xc8b86a].map((c) => new THREE.Color(c));
const tuftParts = [];
for (let k = 0; k < 8; k++) {
  const a = (k / 8) * Math.PI * 2;
  tuftParts.push({
    geo: new THREE.ConeGeometry(0.06, 0.9, 3),
    matrix: M4().makeRotationY(a).multiply(M4().makeTranslation(0, 0.4, 0.12)).multiply(M4().makeRotationX(0.35))
  });
}
const bakedTuft = createMergedToonProp(tuftParts, grassMat, 0, false);

// =========================================================
// 6. WILDE BLOEMEN in de weides
// =========================================================
const flowerMat = makeToonMat(0xffffff);
const FLOWER_COLORS = [0xffffff, 0xf4d03f, 0xb57edc, 0xe86a9a, 0x6aa0e8, 0xf08a3a].map((c) => new THREE.Color(c));
const flowerParts = [];
for (let k = 0; k < 7; k++) {
  const a = k * 2.6;
  const rr = 0.2 + (k % 3) * 0.3;
  flowerParts.push({ geo: new THREE.IcosahedronGeometry(0.11, 0), matrix: M4().makeTranslation(Math.cos(a) * rr, 0.32 + (k % 2) * 0.1, Math.sin(a) * rr) });
}
const bakedFlowers = createMergedToonProp(flowerParts, flowerMat, 0, false);
const stemMat = makeToonMat(0x5f9640);
const stemParts = [];
for (let k = 0; k < 7; k++) {
  const a = k * 2.6;
  const rr = 0.2 + (k % 3) * 0.3;
  stemParts.push({ geo: new THREE.CylinderGeometry(0.02, 0.02, 0.34, 3), matrix: M4().makeTranslation(Math.cos(a) * rr, 0.16, Math.sin(a) * rr) });
}
const bakedStems = createMergedToonProp(stemParts, stemMat, 0, false);

// =========================================================
// PLAATSEN
// =========================================================
const maples = [];
const oaks = [];
const deads = [];
const ferns = [];
const logs = [];
const stumps = [];
const mushrooms = [];
const reeds = [];
const cattails = [];
const tufts = [];
const flowers = [];

const baseItem = (x, z, scale, extra = {}) => ({ x, y: getTerrainHeight(x, z), z, scale, rot: Math.random() * Math.PI * 2, ...extra });

// Esdoorns: langs wegen buiten het dorp en aan bosranden
for (let a = 0; a < 9000 && maples.length < 70; a++) {
  const p = randomIslandPoint(60);
  const m = getClosestNetworkRoad(p.x, p.z).marginDist;
  if (m < 4.5 || m > 14) continue;
  if (!landOk(p.x, p.z, 4.5)) continue;
  if (getTerrainHeight(p.x, p.z) < WATER_LEVEL + 0.8 || getLocalSlope(p.x, p.z) > 0.6) continue;
  if (getDistToRivers(p.x, p.z) < 5) continue;
  if (!isFree(p.x, p.z, 3.2)) continue;
  const s = 0.85 + Math.random() * 0.35;
  maples.push(baseItem(p.x, p.z, s, { color: pick(MAPLE_COLORS) }));
  occupy(p.x, p.z, 2.4);
}

// Losse eiken: open plekken (weinig bos)
for (let a = 0; a < 9000 && oaks.length < 26; a++) {
  const p = randomIslandPoint(140);
  if (forestDensity(p.x, p.z) > -0.3) continue;
  if (!landOk(p.x, p.z, 9)) continue;
  if (getTerrainHeight(p.x, p.z) < WATER_LEVEL + 1 || getLocalSlope(p.x, p.z) > 0.45) continue;
  if (getDistToRivers(p.x, p.z) < 7) continue;
  if (!isFree(p.x, p.z, 7)) continue;
  oaks.push(baseItem(p.x, p.z, 0.95 + Math.random() * 0.3, { color: pick(OAK_COLORS) }));
  occupy(p.x, p.z, 4);
}

// Bosbodem: in de dichte bossen buiten de kern
for (let a = 0; a < 40000 && (ferns.length < 900 || logs.length < 60 || deads.length < 30); a++) {
  const p = randomIslandPoint(150);
  const dens = forestDensity(p.x, p.z);
  if (dens < 0.1) continue;
  if (!landOk(p.x, p.z, 3)) continue;
  const y = getTerrainHeight(p.x, p.z);
  if (y < WATER_LEVEL + 0.7 || getLocalSlope(p.x, p.z) > 0.8) continue;
  if (getDistToRivers(p.x, p.z) < 3) continue;
  const r = Math.random();
  if (r < 0.05 && deads.length < 40 && isFree(p.x, p.z, 2.5)) {
    deads.push(baseItem(p.x, p.z, 0.8 + Math.random() * 0.4, { leanX: (Math.random() - 0.5) * 0.12, leanZ: (Math.random() - 0.5) * 0.12 }));
    occupy(p.x, p.z, 1.2);
  } else if (r < 0.12 && logs.length < 70 && isFree(p.x, p.z, 3)) {
    logs.push(baseItem(p.x, p.z, 0.8 + Math.random() * 0.4));
    occupy(p.x, p.z, 2.4);
    if (Math.random() < 0.6) mushrooms.push(baseItem(p.x + (Math.random() - 0.5) * 2, p.z + 1.0, 0.9 + Math.random() * 0.4));
  } else if (r < 0.17 && stumps.length < 110 && isFree(p.x, p.z, 1.5)) {
    stumps.push(baseItem(p.x, p.z, 0.8 + Math.random() * 0.5));
    occupy(p.x, p.z, 0.8);
    if (Math.random() < 0.3) mushrooms.push(baseItem(p.x + 0.8, p.z + 0.5, 0.8 + Math.random() * 0.4));
  } else if (ferns.length < 900 && isFree(p.x, p.z, 0.6)) {
    ferns.push(baseItem(p.x, p.z, 0.8 + Math.random() * 0.7, { color: pick(FERN_COLORS) }));
  }
}

// Riet en lisdodden langs meren en rivieren (niet aan zee)
for (let a = 0; a < 40000 && reeds.length < 650; a++) {
  const p = randomIslandPoint(0);
  const pol = getIslandPolar(p.x, p.z);
  if (pol.r > getCoastRadius(pol.theta) - 30) continue;
  const y = getTerrainHeight(p.x, p.z);
  if (y < WATER_LEVEL - 0.25 || y > WATER_LEVEL + 0.5) continue;
  if (getClosestNetworkRoad(p.x, p.z).marginDist < 3) continue;
  if (isInsideTownFootprint(p.x, p.z, 2) || lotBlocked(p.x, p.z, 2) || isNearAnyDriveway(p.x, p.z, 2)) continue;
  const it = baseItem(p.x, p.z, 0.75 + Math.random() * 0.6, { color: pick(REED_COLORS) });
  it.y = Math.max(it.y, WATER_LEVEL - 0.2);
  reeds.push(it);
  if (Math.random() < 0.45) cattails.push({ ...it });
}

// Helmgras op de stranden en duinen
for (let a = 0; a < 30000 && tufts.length < 700; a++) {
  const ang = Math.random() * Math.PI * 2;
  const coastR = getCoastRadius(ang);
  const rr = coastR - 5 - Math.random() * 45;
  const x = ISLAND_CENTER.x + Math.cos(ang) * rr;
  const z = ISLAND_CENTER.z + Math.sin(ang) * rr;
  const y = getTerrainHeight(x, z);
  if (y < WATER_LEVEL + 0.35 || y > 4.5) continue;
  if (getClosestNetworkRoad(x, z).marginDist < 2.5) continue;
  if (isInsideTownFootprint(x, z, 2) || lotBlocked(x, z, 3) || isNearAnyDriveway(x, z, 2)) continue;
  if (!isFree(x, z, 0.4)) continue;
  tufts.push(baseItem(x, z, 0.8 + Math.random() * 0.7, { color: pick(DUNE_COLORS) }));
}

// Wilde bloemen: open weides en bermen
for (let a = 0; a < 30000 && flowers.length < 900; a++) {
  const p = randomIslandPoint(110);
  if (forestDensity(p.x, p.z) > 0.05) continue;
  if (!landOk(p.x, p.z, 2.5)) continue;
  const y = getTerrainHeight(p.x, p.z);
  if (y < WATER_LEVEL + 0.6 || getLocalSlope(p.x, p.z) > 0.6) continue;
  if (Math.hypot(p.x - MOOSE_LAKE.x, p.z - MOOSE_LAKE.z) < MOOSE_LAKE.r + 2) continue;
  if (Math.hypot(p.x - FOX_LAKE.x, p.z - FOX_LAKE.z) < FOX_LAKE.r + 2) continue;
  if (!isFree(p.x, p.z, 0.5)) continue;
  // In plukjes van 3-5 bij elkaar, één kleur per plukje
  const col = pick(FLOWER_COLORS);
  const n = 3 + Math.floor(Math.random() * 3);
  for (let k = 0; k < n; k++) {
    const fx = p.x + (Math.random() - 0.5) * 3;
    const fz = p.z + (Math.random() - 0.5) * 3;
    flowers.push(baseItem(fx, fz, 0.8 + Math.random() * 0.5, { color: col }));
  }
}

// ---------- Bouwen ----------
{
  const trunk = buildSet(bakedMapleTrunk, maples, { castShadow: true });
  const crown = buildSet(bakedMapleCrown, maples, { material: mapleCrownMat, colors: MAPLE_COLORS, castShadow: true });
  if (crown) {
    deciduousFoliageObjects.push(crown.main);
    if (crown.out) deciduousFoliageObjects.push(crown.out);
  }
  registerSets(maples, [trunk, crown], 0.6, 'tree', 15, 'Maple');
}
{
  const trunk = buildSet(bakedOakTrunk, oaks, { castShadow: true });
  const crown = buildSet(bakedOakCrown, oaks, { material: oakCrownMat, colors: OAK_COLORS, castShadow: true });
  if (crown) {
    deciduousFoliageObjects.push(crown.main);
    if (crown.out) deciduousFoliageObjects.push(crown.out);
  }
  registerSets(oaks, [trunk, crown], 0.9, 'tree', 20, 'Oak');
}
{
  const set = buildSet(bakedDeadPine, deads, { castShadow: true });
  registerSets(deads, [set], 0.5, 'tree', 10, 'Dead pine');
}
{
  const bark = buildSet(bakedLog, logs, { castShadow: true });
  const ends = buildSet(bakedLogEnds, logs, { outline: false });
  registerSets(logs, [bark, ends], 1.2, 'small', 6, 'Log');
}
{
  const bark = buildSet(bakedStump, stumps, {});
  const top = buildSet(bakedStumpTop, stumps, { outline: false });
  registerSets(stumps, [bark, top], 0.6, 'small', 3, 'Tree stump');
}
{
  const caps = buildSet(bakedMushCaps, mushrooms, {});
  const stems = buildSet(bakedMushStems, mushrooms, { outline: false });
  clearable.push({ items: mushrooms, sets: [caps, stems] });
  [caps, stems].forEach((s) => {
    if (!s) return;
    deciduousFoliageObjects.push(s.main);
    if (s.out) deciduousFoliageObjects.push(s.out);
  });
}
{
  const f = buildSet(bakedFern, ferns, { material: fernMat, colors: FERN_COLORS, outline: false });
  clearable.push({ items: ferns, sets: [f] });
  if (f) deciduousFoliageObjects.push(f.main);
}
clearable.push({ items: reeds, sets: [buildSet(bakedReeds, reeds, { material: reedMat, colors: REED_COLORS, outline: false })] });
clearable.push({ items: cattails, sets: [buildSet(bakedCattails, cattails, {})] });
clearable.push({ items: tufts, sets: [buildSet(bakedTuft, tufts, { material: grassMat, colors: DUNE_COLORS, outline: false })] });
{
  const fl = buildSet(bakedFlowers, flowers, { material: flowerMat, colors: FLOWER_COLORS, outline: false });
  const st = buildSet(bakedStems, flowers, { outline: false });
  clearable.push({ items: flowers, sets: [fl, st] });
  [fl, st].forEach((s) => { if (s) deciduousFoliageObjects.push(s.main); });
}

// Dode dennen en stammen krijgen in de winter geen sneeuw nodig; de rest verdwijnt onder de sneeuw
void pineSnowCapObjects;

export const vegetationStats = {
  maples: maples.length, oaks: oaks.length, deads: deads.length, ferns: ferns.length, logs: logs.length,
  stumps: stumps.length, mushrooms: mushrooms.length, reeds: reeds.length, tufts: tufts.length, flowers: flowers.length
};

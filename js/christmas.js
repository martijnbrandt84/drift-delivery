import * as THREE from 'three';
import { makeToonMat, createOutlinedMesh, christmasGroup } from './scene-setup.js';
import { WATER_LEVEL } from './roads.js';
import { ruralLots } from './water-lots.js';
import { ISLAND_CENTER, getIslandPolar, getCoastRadius } from './landscape.js';
import { destructibles, registerDestructible } from './demolition.js';
import { getTerrainHeight } from './terrain.js';
import { iceState } from './drive-surface.js';
import { XMAS_TREE_POS } from './town.js';

// =========================================================
// KERST: bevroren meren om op te driften, sneeuwpoppen bij de huizen
// en een vrij plein rond de dorpsspar.
// Alles hangt in christmasGroup en is dus alleen zichtbaar in de winterstand.
// =========================================================

// ---------- Plein rond de dorpsspar vrijhouden ----------
for (let i = destructibles.length - 1; i >= 0; i--) {
  const d = destructibles[i];
  if (d.instRefs) continue;
  if (Math.hypot(d.x - XMAS_TREE_POS.x, d.z - XMAS_TREE_POS.z) < 9.5) {
    if (d.mesh && d.mesh.parent) d.mesh.parent.remove(d.mesh);
    destructibles.splice(i, 1);
  }
}

// ---------- Bevroren meren, rivieren en fjord ----------
const ICE_CELL = 2.2;
const ICE_MIN_X = -420;
const ICE_MIN_Z = -400;
const ICE_N = Math.ceil(860 / ICE_CELL);
const iceMask = new Uint8Array(ICE_N * ICE_N);

function cellIsIce(x, z) {
  const pol = getIslandPolar(x, z);
  // De open oceaan bevriest niet; alles binnen de kustlijn wel (meren, rivieren, fjord)
  if (getCoastRadius(pol.theta) - pol.r < 4) return false;
  return getTerrainHeight(x, z) < WATER_LEVEL - 0.04;
}

const icePositions = [];
for (let j = 0; j < ICE_N; j++) {
  for (let i = 0; i < ICE_N; i++) {
    const cx = ICE_MIN_X + (i + 0.5) * ICE_CELL;
    const cz = ICE_MIN_Z + (j + 0.5) * ICE_CELL;
    if (Math.hypot(cx - ISLAND_CENTER.x, cz - ISLAND_CENTER.z) > 430) continue;
    if (!cellIsIce(cx, cz)) continue;
    iceMask[j * ICE_N + i] = 1;
  }
}
// Ijsplaat iets ruimer dan het water (de oever-randen verdwijnen onder het terrein)
const ICE_Y = WATER_LEVEL + 0.05;
for (let j = 1; j < ICE_N - 1; j++) {
  for (let i = 1; i < ICE_N - 1; i++) {
    let near = false;
    for (let dj = -1; dj <= 1 && !near; dj++) for (let di = -1; di <= 1; di++) if (iceMask[(j + dj) * ICE_N + i + di]) { near = true; break; }
    if (!near) continue;
    const x0 = ICE_MIN_X + i * ICE_CELL;
    const z0 = ICE_MIN_Z + j * ICE_CELL;
    const x1 = x0 + ICE_CELL;
    const z1 = z0 + ICE_CELL;
    icePositions.push(x0, ICE_Y, z0, x0, ICE_Y, z1, x1, ICE_Y, z1, x0, ICE_Y, z0, x1, ICE_Y, z1, x1, ICE_Y, z0);
  }
}
if (icePositions.length) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(icePositions, 3));
  geo.computeVertexNormals();
  const ice = new THREE.Mesh(geo, makeToonMat(0xd6eef6, { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
  ice.receiveShadow = true;
  christmasGroup.add(ice);
}

iceState.isIce = (x, z) => {
  const i = Math.floor((x - ICE_MIN_X) / ICE_CELL);
  const j = Math.floor((z - ICE_MIN_Z) / ICE_CELL);
  if (i < 1 || j < 1 || i >= ICE_N - 1 || j >= ICE_N - 1) return false;
  // Ook direct naast het water is ijs, zodat je soepel de oever op/af rijdt
  for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if (iceMask[(j + dj) * ICE_N + i + di]) return true;
  return false;
};
iceState.surfaceY = ICE_Y;

// ---------- Sneeuwpoppen ----------
const snowMat = makeToonMat(0xf7fbff);
const coalMat = makeToonMat(0x222222);
const carrotMat = makeToonMat(0xf07a24);
const scarfMats = [makeToonMat(0xd62839), makeToonMat(0x2d6e3e), makeToonMat(0x3f78a8)];
const hatMat = makeToonMat(0x2b2b2b);

function createSnowman(scarfMat) {
  const g = new THREE.Group();
  [[0.75, 0.62], [0.55, 1.6], [0.4, 2.35]].forEach(([r, y]) => {
    const ball = createOutlinedMesh(new THREE.SphereGeometry(r, 12, 9), snowMat, 0.035);
    ball.position.y = y;
    g.add(ball);
  });
  [-0.14, 0.14].forEach((ex) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 5, 4), coalMat);
    eye.position.set(ex, 2.45, 0.36);
    g.add(eye);
  });
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.38, 6), carrotMat);
  nose.rotation.x = Math.PI * 0.5;
  nose.position.set(0, 2.35, 0.5);
  g.add(nose);
  [1.75, 1.5].forEach((by) => {
    const button = new THREE.Mesh(new THREE.SphereGeometry(0.05, 5, 4), coalMat);
    button.position.set(0, by, 0.54);
    g.add(button);
  });
  const scarf = createOutlinedMesh(new THREE.TorusGeometry(0.4, 0.1, 6, 14), scarfMat, 0.02, false);
  scarf.rotation.x = Math.PI * 0.5;
  scarf.position.y = 2.02;
  g.add(scarf);
  const brim = createOutlinedMesh(new THREE.CylinderGeometry(0.42, 0.42, 0.05, 12), hatMat, 0.02, false);
  brim.position.y = 2.7;
  g.add(brim);
  const crown = createOutlinedMesh(new THREE.CylinderGeometry(0.28, 0.28, 0.45, 12), hatMat, 0.02, false);
  crown.position.y = 2.95;
  g.add(crown);
  [-1, 1].forEach((side) => {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.9, 4), makeToonMat(0x5a3520));
    arm.position.set(side * 0.75, 1.75, 0);
    arm.rotation.z = side * -1.0;
    g.add(arm);
  });
  return g;
}

function placeSnowman(x, z, yaw, k) {
  const sm = createSnowman(scarfMats[k % scarfMats.length]);
  sm.position.set(x, getTerrainHeight(x, z), z);
  sm.rotation.y = yaw;
  sm.scale.setScalar(0.9 + (k % 3) * 0.12);
  christmasGroup.add(sm);
  registerDestructible(sm, x, sm.position.y, z, 0.8, 'small', 10, 'Sneeuwpop');
  destructibles[destructibles.length - 1].season = 'winter';
}

let snowmanIdx = 0;
// Rond de dorpsspar
[[-5.2, 4.4], [5.0, 4.8], [-4.6, -5.2]].forEach(([dx, dz]) => {
  placeSnowman(XMAS_TREE_POS.x + dx, XMAS_TREE_POS.z + dz, Math.atan2(-dx, -dz) + Math.PI, snowmanIdx++);
});
// Bij de huizen, villa, diner en boerderijen
ruralLots.forEach((lot) => {
  const c = Math.cos(lot.yaw);
  const s = Math.sin(lot.yaw);
  const at = (lx, lz) => ({ x: lot.x + lx * c + lz * s, z: lot.z - lx * s + lz * c });
  let spot = null;
  if (lot.type === 'farm') spot = at(-12, 1);
  else if (lot.type === 'diner') spot = at(-22, -15);
  else if (lot.type === 'villa') spot = at(6.5, 4);
  else if (lot.type === 'store') spot = at(-17, 18);
  else if (lot.type === 'camping') spot = at(0, 11);
  else if (lot.type === 'fair' || lot.type === 'sawmill') spot = at(-5, 18);
  else if (lot.type === 'cinema') spot = at(11, -1.5);
  else if (lot.type === 'airfield') spot = at(-16, 4);
  else if (lot.type === 'coffee') spot = at(9, -7);
  else if (lot.type === 'police') spot = at(-14, 8);
  else spot = at(3.6, 6.2);
  placeSnowman(spot.x, spot.z, lot.yaw, snowmanIdx++);
});

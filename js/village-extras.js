import * as THREE from 'three';
import { scene, makeToonMat, registerSeasonalMat, createOutlinedMesh } from './scene-setup.js';
import { WATER_LEVEL, getClosestNetworkRoad } from './roads.js';
import { ruralLots } from './water-lots.js';
import { hardColliders, destructibles, registerDestructible } from './demolition.js';
import { getTerrainHeight } from './terrain.js';
import { walkways } from './drive-surface.js';
import { XMAS_TREE_POS } from './town.js';
import { OCEAN_FLOOR } from './landscape.js';
import { tagMap } from './map-tags.js';

// =========================================================
// DORPSDETAILS: rode Amerikaanse brievenbussen, een muziekkapel aan de oever
// en een lange pier bij de strandcamping (waar je op kunt rijden).
// =========================================================

// ---------- Brievenbussen bij vrijstaande huizen (omver te rijden) ----------
const mailRedMat = makeToonMat(0xc4202f);
const mailPostMat = registerSeasonalMat(0x6b4a2b, 0x8a7a6a);
const mailFlagMat = makeToonMat(0xffd23f);
const mailDarkMat = makeToonMat(0x2b2b2b);

function createMailbox() {
  const g = new THREE.Group();
  const post = createOutlinedMesh(new THREE.BoxGeometry(0.14, 1.1, 0.14), mailPostMat, 0.02, false);
  post.position.y = 0.55;
  g.add(post);
  const arm = createOutlinedMesh(new THREE.BoxGeometry(0.2, 0.08, 0.5), mailPostMat, 0.015, false);
  arm.position.set(0, 1.12, 0.05);
  g.add(arm);
  const box = createOutlinedMesh(new THREE.BoxGeometry(0.32, 0.26, 0.58), mailRedMat, 0.025);
  box.position.set(0, 1.28, 0.08);
  g.add(box);
  const top = createOutlinedMesh(new THREE.CylinderGeometry(0.16, 0.16, 0.58, 10, 1, false, 0, Math.PI), mailRedMat, 0.025, false);
  top.rotation.x = Math.PI * 0.5;
  top.rotation.z = Math.PI * 0.5;
  top.position.set(0, 1.41, 0.08);
  g.add(top);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.3), mailDarkMat);
  door.position.set(0, 1.32, 0.375);
  g.add(door);
  const flag = createOutlinedMesh(new THREE.BoxGeometry(0.04, 0.32, 0.1), mailFlagMat, 0.012, false);
  flag.position.set(0.18, 1.52, -0.05);
  g.add(flag);
  return g;
}

ruralLots.forEach((lot, i) => {
  const isHouse = lot.type === 'cabin' || lot.type.startsWith('house') || lot.type === 'villa';
  if (!isHouse || lot.noDriveway) return;
  const dx = lot.x - lot.roadX;
  const dz = lot.z - lot.roadZ;
  const len = Math.hypot(dx, dz) || 1;
  const fx = dx / len;
  const fz = dz / len;
  // Naast de oprit, net van de weg af
  const side = i % 2 ? 1 : -1;
  let x = lot.roadX + fx * 2.4 - fz * side * 3.6;
  let z = lot.roadZ + fz * 2.4 + fx * side * 3.6;
  if (getClosestNetworkRoad(x, z).marginDist < 0.6) {
    x += fx * 1.2;
    z += fz * 1.2;
  }
  const y = getTerrainHeight(x, z);
  const mb = createMailbox();
  mb.position.set(x, y, z);
  // Klepje naar de weg
  mb.rotation.y = Math.atan2(-fx, -fz);
  scene.add(mb);
  registerDestructible(mb, x, y, z, 0.45, 'small', 8, 'Brievenbus');
});

// ---------- Muziekkapel op het groen aan de oever ----------
const kapelWhiteMat = makeToonMat(0xf8f4ea);
const kapelRoofMat = registerSeasonalMat(0x2f6b4a, 0xf2f6fb);
const kapelTrimMat = makeToonMat(0xc4202f);
const kapelFloorMat = registerSeasonalMat(0xb89a74, 0xe8eff6);
const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
const bulbGeo = new THREE.SphereGeometry(0.09, 6, 5);

function createBandstand__build() {
  const g = new THREE.Group();
  const R = 3.6;
  const base = createOutlinedMesh(new THREE.CylinderGeometry(R + 0.3, R + 0.5, 0.9, 8), kapelWhiteMat, 0.045, false, true);
  base.position.y = 0.45;
  g.add(base);
  const floor = createOutlinedMesh(new THREE.CylinderGeometry(R + 0.15, R + 0.15, 0.12, 8), kapelFloorMat, 0.02, false, true);
  floor.position.y = 0.96;
  g.add(floor);
  const steps = createOutlinedMesh(new THREE.BoxGeometry(1.8, 0.45, 1.0), kapelWhiteMat, 0.03, false, true);
  steps.position.set(0, 0.22, R + 0.7);
  g.add(steps);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
    const col = createOutlinedMesh(new THREE.CylinderGeometry(0.13, 0.15, 3.0, 8), kapelWhiteMat, 0.025, false);
    col.position.set(Math.cos(a) * R, 2.5, Math.sin(a) * R);
    g.add(col);
    // Hekje tussen de kolommen (behalve aan de trapkant)
    const a2 = ((k + 1) / 8) * Math.PI * 2 + Math.PI / 8;
    const mid = (a + a2) * 0.5;
    if (Math.abs(Math.sin(mid) - 1) > 0.2) {
      const rail = createOutlinedMesh(new THREE.BoxGeometry(2 * R * Math.sin(Math.PI / 8), 0.12, 0.1), kapelTrimMat, 0.015, false);
      rail.position.set(Math.cos(mid) * R * Math.cos(Math.PI / 8), 1.75, Math.sin(mid) * R * Math.cos(Math.PI / 8));
      rail.rotation.y = -mid + Math.PI * 0.5;
      g.add(rail);
    }
  }
  const eave = createOutlinedMesh(new THREE.CylinderGeometry(R + 0.4, R + 0.4, 0.3, 8), kapelTrimMat, 0.035, false);
  eave.position.y = 4.1;
  g.add(eave);
  const roof = createOutlinedMesh(new THREE.ConeGeometry(R + 0.8, 2.4, 8), kapelRoofMat, 0.05);
  roof.position.y = 5.45;
  roof.rotation.y = Math.PI / 8;
  g.add(roof);
  const finial = createOutlinedMesh(new THREE.SphereGeometry(0.25, 8, 6), makeToonMat(0xffd23f), 0.02, false);
  finial.position.y = 6.8;
  g.add(finial);
  // Lampjes langs de dakrand
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2;
    const bulb = new THREE.Mesh(bulbGeo, bulbMat);
    bulb.position.set(Math.cos(a) * (R + 0.45), 3.92, Math.sin(a) * (R + 0.45));
    g.add(bulb);
  }
  // Muzieklessenaars en een trom op het podium
  [[-1.2, -0.6], [0.2, -1.3], [1.3, -0.4]].forEach(([sx, sz]) => {
    const stand = createOutlinedMesh(new THREE.BoxGeometry(0.5, 0.05, 0.35), mailDarkMat, 0.01, false);
    stand.position.set(sx, 2.1, sz);
    stand.rotation.x = -0.5;
    g.add(stand);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.1, 4), mailDarkMat);
    pole.position.set(sx, 1.55, sz);
    g.add(pole);
  });
  const drum = createOutlinedMesh(new THREE.CylinderGeometry(0.45, 0.45, 0.5, 12), kapelTrimMat, 0.02, false);
  drum.position.set(0, 1.3, 0.4);
  g.add(drum);
  return g;
}

{
  const bx = XMAS_TREE_POS.x - 19;
  const bz = XMAS_TREE_POS.z - 2;
  // Plek vrijmaken
  for (let i = destructibles.length - 1; i >= 0; i--) {
    const d = destructibles[i];
    if (d.instRefs || d.kind === 'small') continue;
    if (Math.hypot(d.x - bx, d.z - bz) < 7.5) {
      if (d.mesh && d.mesh.parent) d.mesh.parent.remove(d.mesh);
      destructibles.splice(i, 1);
    }
  }
  const stand = createBandstand();
  stand.position.set(bx, getTerrainHeight(bx, bz) - 0.1, bz);
  // Trap richting het dorp (de meerweg ligt aan de zuidkant)
  stand.rotation.y = 0;
  scene.add(stand);
  hardColliders.push({ x: bx, z: bz, r: 4.0 });
  // Bankjes ervoor
  [-3, 3].forEach((ox) => {
    const bench = new THREE.Group();
    const seat = createOutlinedMesh(new THREE.BoxGeometry(2.0, 0.12, 0.5), mailPostMat, 0.02, false);
    seat.position.y = 0.5;
    bench.add(seat);
    const back = createOutlinedMesh(new THREE.BoxGeometry(2.0, 0.5, 0.1), mailPostMat, 0.02, false);
    back.position.set(0, 0.8, 0.22);
    bench.add(back);
    const x = bx + ox;
    const z = bz + 6.4;
    const y = getTerrainHeight(x, z);
    bench.position.set(x, y, z);
    bench.rotation.y = Math.PI;
    scene.add(bench);
    registerDestructible(bench, x, y, z, 0.9, 'small', 10, 'Bankje');
  });
}

// Kaart: gebouwen krijgen hun soort mee (zie map-tags.js)
function createBandstand(...args) { return tagMap(createBandstand__build(...args), 'civic'); }

import * as THREE from 'three';
import { scene, makeToonMat, registerSeasonalMat, createOutlinedMesh } from './scene-setup.js';
import { WATER_LEVEL, getClosestNetworkRoad } from './roads.js';
import { ruralLots } from './water-lots.js';
import { hardColliders, destructibles, registerDestructible } from './demolition.js';
import { getTerrainHeight } from './terrain.js';
import { walkways } from './drive-surface.js';
import { XMAS_TREE_POS } from './town.js';
import { OCEAN_FLOOR } from './landscape.js';

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

function createBandstand() {
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

// ---------- Pier bij de strandcamping ----------
const pierPlankMat = registerSeasonalMat(0x9a7448, 0xe8eff6);
const pierPostMat = makeToonMat(0x5c432b);
const pierRailMat = registerSeasonalMat(0xf6f2ea, 0xffffff);

{
  const camp = ruralLots.find((l) => l.type === 'camping');
  if (camp) {
    // Richting: van de weg af, het terrein uit, de zee in
    let dx = camp.x - camp.roadX;
    let dz = camp.z - camp.roadZ;
    const len = Math.hypot(dx, dz) || 1;
    dx /= len;
    dz /= len;
    // Startpunt: waar het strand begint (terrein zakt onder ~1.0m)
    let startT = 0;
    for (let t = 0; t < 120; t += 1) {
      const h = getTerrainHeight(camp.x + dx * t, camp.z + dz * t);
      if (h < 0.9) { startT = t; break; }
    }
    const x1 = camp.x + dx * startT;
    const z1 = camp.z + dz * startT;
    const pierLen = 52;
    const x2 = x1 + dx * pierLen;
    const z2 = z1 + dz * pierLen;
    const deckY = Math.max(1.1, getTerrainHeight(x1, z1) + 0.15);
    const halfW = 2.0;
    const yaw = Math.atan2(dx, dz);
    const nx = -dz;
    const nz = dx;

    const g = new THREE.Group();
    const deck = createOutlinedMesh(new THREE.BoxGeometry(halfW * 2, 0.3, pierLen), pierPlankMat, 0.04, false, true);
    deck.position.set(0, -0.15, pierLen * 0.5);
    g.add(deck);
    // Planknaden voor het houten uiterlijk
    for (let k = 1; k < pierLen; k += 1.2) {
      const seam = new THREE.Mesh(new THREE.BoxGeometry(halfW * 2 - 0.1, 0.02, 0.05), pierPostMat);
      seam.position.set(0, 0.01, k);
      g.add(seam);
    }
    // Palen tot op de zeebodem
    for (let k = 2; k <= pierLen; k += 5) {
      [-1, 1].forEach((side) => {
        const pileLen = deckY - OCEAN_FLOOR + 0.5;
        const pile = createOutlinedMesh(new THREE.CylinderGeometry(0.2, 0.24, pileLen, 7), pierPostMat, 0.025, false);
        pile.position.set(side * (halfW - 0.2), -pileLen * 0.5, k);
        g.add(pile);
      });
    }
    // Witte reling met paaltjes en een paar lantaarns
    [-1, 1].forEach((side) => {
      const rail = createOutlinedMesh(new THREE.BoxGeometry(0.1, 0.1, pierLen - 1), pierRailMat, 0.015, false);
      rail.position.set(side * (halfW - 0.1), 1.0, pierLen * 0.5 + 0.5);
      g.add(rail);
      for (let k = 1; k <= pierLen; k += 2.5) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.0, 0.12), pierRailMat);
        post.position.set(side * (halfW - 0.1), 0.5, k);
        g.add(post);
      }
      for (let k = 10; k <= pierLen; k += 14) {
        const lampPost = createOutlinedMesh(new THREE.CylinderGeometry(0.06, 0.08, 2.6, 6), pierPostMat, 0.02, false);
        lampPost.position.set(side * (halfW - 0.1), 1.3, k);
        g.add(lampPost);
        const lamp = createOutlinedMesh(new THREE.BoxGeometry(0.3, 0.36, 0.3), bulbMat, 0.02, false);
        lamp.position.set(side * (halfW - 0.1), 2.75, k);
        g.add(lamp);
      }
    });
    // Visserskeetje en reddingsboei aan het eind
    const hut = createOutlinedMesh(new THREE.BoxGeometry(2.2, 2.0, 1.8), makeToonMat(0x3f78a8), 0.035);
    hut.position.set(0.6, 1.0, pierLen - 1.6);
    g.add(hut);
    const hutRoof = createOutlinedMesh(new THREE.BoxGeometry(2.6, 0.18, 2.2), pierRailMat, 0.025, false);
    hutRoof.position.set(0.6, 2.1, pierLen - 1.6);
    g.add(hutRoof);
    const buoy = createOutlinedMesh(new THREE.TorusGeometry(0.35, 0.11, 6, 14), mailRedMat, 0.02, false);
    buoy.position.set(-halfW + 0.1, 1.2, pierLen - 6);
    buoy.rotation.y = Math.PI * 0.5;
    g.add(buoy);

    g.position.set(x1, deckY, z1);
    g.rotation.y = yaw;
    scene.add(g);

    // Je kunt er zelf op rijden
    walkways.push({ x1, z1, x2, z2, halfWidth: halfW - 0.25, y: deckY });
    // Reling als botsrand; het keetje aan het eind ook
    for (let k = 2; k <= pierLen; k += 3) {
      [-1, 1].forEach((side) => {
        hardColliders.push({ x: x1 + dx * k + nx * side * (halfW + 0.3), z: z1 + dz * k + nz * side * (halfW + 0.3), r: 0.45 });
      });
    }
    const hx = x1 + dx * (pierLen - 1.6) + nx * 0.6;
    const hz = z1 + dz * (pierLen - 1.6) + nz * 0.6;
    hardColliders.push({ x: hx, z: hz, r: 1.3 });
    void WATER_LEVEL;
  }
}

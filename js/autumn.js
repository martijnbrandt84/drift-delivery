import * as THREE from 'three';
import {
  scene, makeToonMat, createOutlinedMesh, createMergedToonProp, instantiateBakedProp, outlineMat,
  deciduousFoliageObjects
} from './scene-setup.js';
import { getClosestNetworkRoad, getDistToRivers } from './roads.js';
import { ruralLots } from './water-lots.js';
import { destructibles, registerDestructible, registerInstancedDestructible } from './demolition.js';
import { getTerrainHeight } from './terrain.js';
import { farmDecor } from './farm.js';
import { gardenPumpkinSpots } from './garden-center.js';

// =========================================================
// HERFSTDETAILS: pompoenen, bladerhopen en vogelverschrikkers.
// Alles verdwijnt automatisch in de winterstand (via deciduousFoliageObjects).
// =========================================================

function lotLocalToWorld(lot, lx, lz) {
  const c = Math.cos(lot.yaw);
  const s = Math.sin(lot.yaw);
  return { x: lot.x + lx * c + lz * s, z: lot.z - lx * s + lz * c };
}

// ---------- Pompoenen (instanced: honderden pompoenen in 3 draw calls) ----------
const pumpkinGeo = new THREE.SphereGeometry(0.42, 10, 7);
{
  // Ribbels: radius iets laten golven rondom de as
  const pos = pumpkinGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const a = Math.atan2(z, x);
    const rib = 1 + Math.cos(a * 8) * 0.06;
    pos.setX(i, x * rib);
    pos.setZ(i, z * rib);
  }
  pumpkinGeo.scale(1.15, 0.78, 1.15);
  pumpkinGeo.translate(0, 0.3, 0);
  pumpkinGeo.computeVertexNormals();
}
const bakedPumpkin = createMergedToonProp([{ geo: pumpkinGeo, matrix: new THREE.Matrix4() }], makeToonMat(0xffffff), 0.035, true);
const stemGeo = new THREE.CylinderGeometry(0.05, 0.07, 0.22, 5);
stemGeo.rotateZ(0.25);
stemGeo.translate(0.02, 0.68, 0);
const stemMat = makeToonMat(0x5b6b2e);
const PUMPKIN_COLORS = [0xf08a24, 0xe8741c, 0xf2a33a, 0xd9661a, 0xf5c04a].map((c) => new THREE.Color(c));

const pumpkinSpots = [];
function addPumpkin(x, z, scale = 1, y = null) {
  const { marginDist } = getClosestNetworkRoad(x, z);
  if (marginDist < 0.8) return;
  pumpkinSpots.push({ x, z, y: y ?? getTerrainHeight(x, z), scale, rot: Math.random() * Math.PI * 2 });
}

// Pompoenen bij de voordeur van elk huis, de villa en de diner
ruralLots.forEach((lot) => {
  if (lot.type === 'farm' || lot.type === 'store') return;
  if (lot.type === 'diner') {
    // Op de stoep langs de pui, naast de entree en op de rechterhoek
    [[-12.9, -1.6], [-12.1, -1.45], [-0.4, -1.55]].forEach(([lx, lz]) => {
      const w = lotLocalToWorld(lot, lx, lz);
      addPumpkin(w.x, w.z, 1.1, lot.roadY - 0.02 + 0.16);
    });
    return;
  }
  if (lot.type === 'cinema') {
    [[7.5, -1.6], [8.3, -2.1], [-12, -1.4]].forEach(([lx, lz]) => {
      const w = lotLocalToWorld(lot, lx, lz);
      addPumpkin(w.x, w.z, 1.0);
    });
    return;
  }
  if (lot.type === 'motel' || lot.type === 'sawmill' || lot.type === 'fair' || lot.type === 'airfield' || lot.type === 'coffee' || lot.type === 'police' || lot.type === 'school' || lot.type === 'garden') return;
  if (lot.type === 'villa') {
    const stepY = getTerrainHeight(lot.x, lot.z) + 0.16; // onderste trede van het bordes
    [[-2.35, -1.65, 1.15], [2.35, -1.65, 1.15], [-1.75, -1.6, 0.8]].forEach(([lx, lz, sc]) => {
      const w = lotLocalToWorld(lot, lx, lz);
      addPumpkin(w.x, w.z, sc, stepY);
    });
    return;
  }
  [[-2.2, 4.8], [-2.9, 5.3], [2.4, 4.9]].forEach(([lx, lz], i) => {
    const w = lotLocalToWorld(lot, lx, lz);
    addPumpkin(w.x, w.z, i === 0 ? 1.25 : 0.85);
  });
});

// Pompoenveld op de plek die de boerderij ervoor heeft ingericht: pompoenen liggen op de rijen ranken
// (de omgeploegde grond en de ranken maakt farm.js; hier alleen de pompoenen)
Object.values(farmDecor).forEach(({ lot: farm, pumpkinRows }) => {
  if (!pumpkinRows) return;
  pumpkinRows.forEach(([x0, x1, rz]) => {
    for (let lx = x0 + 0.6; lx <= x1 - 0.5; lx += 1.25 + Math.random() * 0.7) {
      if (Math.random() < 0.15) continue;
      const w = lotLocalToWorld(farm, lx, rz + (Math.random() - 0.5) * 0.6);
      addPumpkin(w.x, w.z, 0.75 + Math.random() * 0.6);
    }
  });
});
// Het seizoensplein van het tuincentrum: pompoenen op hooibalen
gardenPumpkinSpots.forEach((p) => addPumpkin(p.x, p.z, p.scale, p.y));

if (pumpkinSpots.length) {
  const n = pumpkinSpots.length;
  const body = new THREE.InstancedMesh(bakedPumpkin.mergedMain, bakedPumpkin.material, n);
  const outline = new THREE.InstancedMesh(bakedPumpkin.mergedOut, outlineMat, n);
  const stems = new THREE.InstancedMesh(stemGeo, stemMat, n);
  const dummy = new THREE.Object3D();
  pumpkinSpots.forEach((p, i) => {
    dummy.position.set(p.x, p.y - 0.05, p.z);
    dummy.rotation.set(0, p.rot, 0);
    dummy.scale.setScalar(p.scale);
    dummy.updateMatrix();
    body.setMatrixAt(i, dummy.matrix);
    outline.setMatrixAt(i, dummy.matrix);
    stems.setMatrixAt(i, dummy.matrix);
    body.setColorAt(i, PUMPKIN_COLORS[i % PUMPKIN_COLORS.length]);
  });
  [body, outline, stems].forEach((m) => {
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
    scene.add(m);
    deciduousFoliageObjects.push(m);
  });
  body.castShadow = true;
  if (body.instanceColor) body.instanceColor.needsUpdate = true;
  // Elke pompoen kun je aanrijden: hij vliegt weg en ligt na een tijdje weer op zijn plek
  pumpkinSpots.forEach((p, i) => {
    registerInstancedDestructible(
      [{ mesh: body, index: i }, { mesh: outline, index: i }, { mesh: stems, index: i }],
      p.x, p.y - 0.05, p.z, p.rot, p.scale, 0.5 * p.scale + 0.15, 'small', 4, 'Pumpkin'
    );
    destructibles[destructibles.length - 1].season = 'autumn';
  });
}

// ---------- Bladerhopen onder de loofbomen (rij erdoorheen: blaadjes stuiven op!) ----------
const leafPileVariants = [0xd9662b, 0xe8a33a, 0xc4472f].map((hex) => {
  const lobe = new THREE.IcosahedronGeometry(0.75, 0);
  return createMergedToonProp(
    [
      { geo: lobe, matrix: new THREE.Matrix4().makeScale(1.5, 0.38, 1.25).setPosition(0, 0.12, 0) },
      { geo: lobe, matrix: new THREE.Matrix4().makeScale(0.95, 0.32, 0.9).setPosition(0.75, 0.1, 0.35) },
      { geo: lobe, matrix: new THREE.Matrix4().makeScale(0.8, 0.3, 0.85).setPosition(-0.6, 0.08, -0.45) }
    ],
    makeToonMat(hex),
    0.03,
    false
  );
});

{
  const decidTrees = destructibles.filter((d) => d.kind === 'tree' && d.label !== 'Pine tree' && !d.instRefs);
  let placed = 0;
  for (let i = 0; i < decidTrees.length && placed < 46; i++) {
    const t = decidTrees[(i * 7) % decidTrees.length];
    const ang = Math.random() * Math.PI * 2;
    const x = t.x + Math.cos(ang) * 2.0;
    const z = t.z + Math.sin(ang) * 2.0;
    const { marginDist } = getClosestNetworkRoad(x, z);
    if (marginDist < 1.2 || getDistToRivers(x, z) < 2.5) continue;
    const y = getTerrainHeight(x, z);
    if (y < 0.5) continue;
    const pile = instantiateBakedProp(leafPileVariants[placed % leafPileVariants.length]);
    pile.position.set(x, y, z);
    pile.rotation.y = Math.random() * Math.PI * 2;
    pile.scale.setScalar(0.85 + Math.random() * 0.4);
    scene.add(pile);
    deciduousFoliageObjects.push(pile);
    registerDestructible(pile, x, y, z, 1.2, 'shrub', 3, 'Leaf pile');
    destructibles[destructibles.length - 1].season = 'autumn';
    placed++;
  }
}

// ---------- Vogelverschrikkers in de akkers ----------
const strawMat = makeToonMat(0xe0b75a);
const shirtMats = [makeToonMat(0xb8432f), makeToonMat(0x3f6b8f)];
const jeansMat = makeToonMat(0x3c5a86);
const hatMat = makeToonMat(0x8a6a3a);
const poleMat = makeToonMat(0x6b4a2b);
const burlapMat = makeToonMat(0xd9c49a);

function createScarecrow(shirtMat) {
  const g = new THREE.Group();
  const pole = createOutlinedMesh(new THREE.BoxGeometry(0.16, 2.6, 0.16), poleMat, 0.02, false);
  pole.position.y = 1.3;
  g.add(pole);
  const arms = createOutlinedMesh(new THREE.BoxGeometry(2.2, 0.14, 0.14), poleMat, 0.02, false);
  arms.position.y = 1.95;
  g.add(arms);
  const shirt = createOutlinedMesh(new THREE.BoxGeometry(0.85, 0.9, 0.45), shirtMat, 0.035);
  shirt.position.y = 1.75;
  g.add(shirt);
  const sleeves = createOutlinedMesh(new THREE.BoxGeometry(1.9, 0.3, 0.32), shirtMat, 0.03, false);
  sleeves.position.y = 1.95;
  g.add(sleeves);
  [-1, 1].forEach((side) => {
    const straw = createOutlinedMesh(new THREE.ConeGeometry(0.14, 0.32, 5), strawMat, 0.02, false);
    straw.position.set(side * 1.08, 1.95, 0);
    straw.rotation.z = side * Math.PI * 0.5;
    g.add(straw);
  });
  const pants = createOutlinedMesh(new THREE.BoxGeometry(0.7, 0.55, 0.4), jeansMat, 0.03, false);
  pants.position.y = 1.05;
  g.add(pants);
  const head = createOutlinedMesh(new THREE.SphereGeometry(0.34, 8, 6), burlapMat, 0.03);
  head.position.y = 2.5;
  g.add(head);
  const brim = createOutlinedMesh(new THREE.CylinderGeometry(0.6, 0.6, 0.06, 10), hatMat, 0.025, false);
  brim.position.y = 2.74;
  g.add(brim);
  const crown = createOutlinedMesh(new THREE.ConeGeometry(0.3, 0.45, 8), hatMat, 0.025, false);
  crown.position.y = 2.98;
  g.add(crown);
  return g;
}

Object.values(farmDecor).forEach(({ lot: farm, scarecrows }, fi) => {
  scarecrows.forEach(([lx, lz], k) => {
    const w = lotLocalToWorld(farm, lx, lz);
    const y = getTerrainHeight(w.x, w.z);
    const sc = createScarecrow(shirtMats[(fi + k) % shirtMats.length]);
    sc.position.set(w.x, y, w.z);
    sc.rotation.y = farm.yaw + (Math.random() - 0.5) * 0.5;
    scene.add(sc);
    registerDestructible(sc, w.x, y, w.z, 0.9, 'small', 18, 'Scarecrow');
  });
});

export const AUTUMN_STATS = { pumpkins: pumpkinSpots.length };

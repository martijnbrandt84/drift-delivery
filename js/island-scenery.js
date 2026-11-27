import * as THREE from 'three';
import {
  scene, makeToonMat, registerSeasonalMat, createOutlinedMesh, outlineMat,
  pineSnowCapObjects, deciduousFoliageObjects
} from './scene-setup.js';
import {
  WATER_LEVEL, getClosestNetworkRoad, getDistToRivers, ringCurve, connectorRoads, timberTrail, RING_BRIDGES, branchRoads
} from './roads.js';
import { ruralLots } from './water-lots.js';
import {
  ISLAND_CENTER, getIslandPolar, getCoastRadius, getCliffiness, MOOSE_LAKE, FOX_LAKE, LOOKOUT_HILL
} from './landscape.js';
import { hardColliders, destructibles, registerInstancedDestructible, registerDestructible, markLastPlanted } from './demolition.js';
import { houseWindows, warmWindowMat, createParkTree } from './town.js';
import { getTerrainHeight, getLocalSlope } from './terrain.js';
import {
  bakedPineTrunk, pineNeedleParts, bakedPineSnow, bakedBirchSkeleton, bakedBirchSnow, crownParts, bakedRock,
  isInsideTownFootprint, isNearAnyDriveway, createPineFast, createShrubFast
} from './props.js';
import { createMergedToonProp } from './scene-setup.js';
import { createRoadSign } from './scenery.js';

// =========================================================
// BUITENGEBIED: INSTANCED BOSSEN & ROTSEN (paar draw calls voor >1000 bomen)
// =========================================================
const CHUNK = 220;

// Witte basis-materialen: de kleur komt per boom uit instanceColor
const pineTintMat = makeToonMat(0xffffff);
const crownTintMat = makeToonMat(0xffffff);
const bakedPineTint = createMergedToonProp(pineNeedleParts, pineTintMat, 0.05, true);
const bakedCrownTint = createMergedToonProp(crownParts, crownTintMat, 0.05, true);

const PINE_COLORS = [0x2f5e41, 0x3d6e49, 0x4c7c46, 0x264d36, 0x2c5a4c, 0x56804a, 0x35664a].map((c) => new THREE.Color(c));
const CROWN_COLORS = [0xe89f38, 0xdc6a35, 0xc94a38, 0x5d8f44, 0x889e42, 0xd9b83b].map((c) => new THREE.Color(c));

function isInsideSpecialLot(x, z) {
  for (const lot of ruralLots) {
    if (lot.flatBox) {
      // Grote kavels: rechthoek rond het terrein vrijhouden (camping: bos tot vlak aan de rand)
      const c = Math.cos(lot.yaw);
      const s = Math.sin(lot.yaw);
      const dx = x - lot.x;
      const dz = z - lot.z;
      const lx = dx * c - dz * s;
      const lz = dx * s + dz * c;
      const fb = lot.flatBox;
      const m = lot.type === 'motel' ? 2 : lot.type === 'farm' ? 10 : 6;
      if (lx > fb.minLX - m && lx < fb.maxLX + m && lz > fb.minLZ - m && lz < fb.maxLZ + m + 4) return true;
      continue;
    }
    const pad = lot.type === 'villa' ? 32 : 12;
    if (Math.hypot(x - lot.x, z - lot.z) < pad) return true;
  }
  return false;
}

function forestDensity(x, z) {
  return (
    Math.sin(x * 0.018 + 1.3) * Math.cos(z * 0.021 - 0.4) +
    Math.sin((x + z) * 0.011) * 0.5 +
    Math.cos((x - z) * 0.027 + 0.8) * 0.3
  );
}

const summitPos = { x: LOOKOUT_HILL.x, z: LOOKOUT_HILL.z };

// Bestaande (losse) bomen uit props.js, zodat het bos daar niet doorheen groeit
const existingTreeGrid = new Map();
destructibles.forEach((d) => {
  if (d.kind !== 'tree') return;
  const key = Math.floor(d.x / 6) + ',' + Math.floor(d.z / 6);
  if (!existingTreeGrid.has(key)) existingTreeGrid.set(key, []);
  existingTreeGrid.get(key).push(d);
});

function collectForestSpots() {
  const spots = [];
  const placed = new Map();
  const cellKey = (x, z) => `${Math.floor(x / 6)},${Math.floor(z / 6)}`;
  const tooClose = (x, z, minD) => {
    const cx = Math.floor(x / 6);
    const cz = Math.floor(z / 6);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      const arr = placed.get(`${cx + dx},${cz + dz}`);
      if (arr) for (const p of arr) if (Math.hypot(x - p.x, z - p.z) < minD) return true;
      const old = existingTreeGrid.get(`${cx + dx},${cz + dz}`);
      if (old) for (const p of old) if (Math.hypot(x - p.x, z - p.z) < minD) return true;
    }
    return false;
  };

  for (let attempt = 0; attempt < 26000 && spots.length < 1700; attempt++) {
    const ang = Math.random() * Math.PI * 2;
    const rr = Math.sqrt(Math.random()) * 420;
    const x = ISLAND_CENTER.x + Math.cos(ang) * rr;
    const z = ISLAND_CENTER.z + Math.sin(ang) * rr;

    const pol = getIslandPolar(x, z);
    // Alleen buiten de oude kern (daar staan al de losse bomen uit props.js)
    if (pol.r < 150) continue;
    if (pol.r > getCoastRadius(pol.theta) - 10) continue;

    const dens = forestDensity(x, z);
    if (dens < -0.25) continue;
    if (dens < 0.15 && Math.random() < 0.6) continue;

    const y = getTerrainHeight(x, z);
    if (y < 0.75) continue;
    if (getLocalSlope(x, z) > 0.75) continue;

    const { marginDist } = getClosestNetworkRoad(x, z);
    if (marginDist < 4.0) continue;
    if (getDistToRivers(x, z) < 4.0) continue;
    if (Math.hypot(x - MOOSE_LAKE.x, z - MOOSE_LAKE.z) < MOOSE_LAKE.r + 4) continue;
    if (Math.hypot(x - FOX_LAKE.x, z - FOX_LAKE.z) < FOX_LAKE.r + 4) continue;
    if (Math.hypot(x - summitPos.x, z - summitPos.z) < 16) continue;
    if (isInsideTownFootprint(x, z, 6) || isInsideSpecialLot(x, z) || isNearAnyDriveway(x, z, 3)) continue;
    if (tooClose(x, z, dens > 0.5 ? 3.0 : 4.2)) continue;

    const key = cellKey(x, z);
    if (!placed.has(key)) placed.set(key, []);
    placed.get(key).push({ x, z });

    const isPine = y > 9 || Math.random() < 0.68;
    spots.push({ x, y, z, scale: 0.8 + Math.random() * 0.75, rot: Math.random() * Math.PI * 2, isPine });
  }
  return spots;
}

function buildInstancedSet(baked, list, material, castShadow, tintColors = null) {
  const main = new THREE.InstancedMesh(baked.mergedMain, material ?? baked.material, list.length);
  main.castShadow = castShadow;
  main.receiveShadow = false;
  const outline = baked.mergedOut ? new THREE.InstancedMesh(baked.mergedOut, outlineMat, list.length) : null;
  const dummy = new THREE.Object3D();
  list.forEach((t, i) => {
    dummy.position.set(t.x, t.y, t.z);
    dummy.rotation.set(t.leanX ?? 0, t.rot, t.leanZ ?? 0);
    dummy.scale.set(t.scale * (t.w ?? 1), t.scale * (t.h ?? 1), t.scale * (t.w ?? 1));
    dummy.updateMatrix();
    main.setMatrixAt(i, dummy.matrix);
    if (outline) outline.setMatrixAt(i, dummy.matrix);
    if (tintColors) main.setColorAt(i, tintColors[Math.floor(Math.random() * tintColors.length)]);
  });
  main.instanceMatrix.needsUpdate = true;
  if (main.instanceColor) main.instanceColor.needsUpdate = true;
  main.computeBoundingSphere();
  scene.add(main);
  if (outline) {
    outline.instanceMatrix.needsUpdate = true;
    outline.computeBoundingSphere();
    scene.add(outline);
  }
  return { main, outline };
}

function buildOuterForest() {
  const spots = collectForestSpots();
  // Variatie in vorm: slanke hoge dennen, brede lage dennen en hier en daar een boom die iets helt
  spots.forEach((t) => {
    const r = Math.random();
    if (t.isPine) {
      if (r < 0.3) { t.w = 0.8; t.h = 1.22; } else if (r < 0.5) { t.w = 1.15; t.h = 0.88; }
    } else if (r < 0.35) { t.w = 1.12; t.h = 0.92; }
    const pol = getIslandPolar(t.x, t.z);
    const toCoast = getCoastRadius(pol.theta) - pol.r;
    if (t.isPine && toCoast < 55) {
      // Windscheve dennen aan de kust: hellen landinwaarts, iets breder en lager
      const lean = THREE.MathUtils.lerp(0.2, 0.06, toCoast / 55);
      const ix = -Math.cos(pol.theta);
      const iz = -Math.sin(pol.theta);
      t.leanX = iz * lean;
      t.leanZ = -ix * lean;
      t.w = 1.1;
      t.h = 0.85;
    } else if (Math.random() < 0.15) {
      const la = Math.random() * Math.PI * 2;
      t.leanX = Math.cos(la) * 0.06;
      t.leanZ = Math.sin(la) * 0.06;
    }
  });
  const chunks = new Map();
  spots.forEach((s) => {
    const key = `${Math.floor(s.x / CHUNK)},${Math.floor(s.z / CHUNK)}`;
    if (!chunks.has(key)) chunks.set(key, { pines: [], decid: [] });
    (s.isPine ? chunks.get(key).pines : chunks.get(key).decid).push(s);
  });

  // Elke boom wordt een sloopbaar object: bij een botsing valt hij om (net als de bomen in de kern)
  const registerTrees = (list, sets, label) => {
    list.forEach((t, i) => {
      const refs = [];
      sets.forEach((set) => {
        refs.push({ mesh: set.main, index: i });
        if (set.outline) refs.push({ mesh: set.outline, index: i });
      });
      registerInstancedDestructible(refs, t.x, t.y, t.z, t.rot, t.scale, 0.85 * t.scale, 'tree', 15, label, t);
    });
  };

  chunks.forEach(({ pines, decid }) => {
    if (pines.length) {
      const trunk = buildInstancedSet(bakedPineTrunk, pines, null, true);
      const needles = buildInstancedSet(bakedPineTint, pines, pineTintMat, true, PINE_COLORS);
      const snow = buildInstancedSet(bakedPineSnow, pines, null, false);
      snow.main.visible = false;
      pineSnowCapObjects.push(snow.main);
      if (snow.outline) { snow.outline.visible = false; pineSnowCapObjects.push(snow.outline); }
      registerTrees(pines, [trunk, needles, snow], 'Pine tree');
    }
    if (decid.length) {
      const skel = buildInstancedSet(bakedBirchSkeleton, decid, null, true);
      const crowns = buildInstancedSet(bakedCrownTint, decid, crownTintMat, true, CROWN_COLORS);
      deciduousFoliageObjects.push(crowns.main);
      if (crowns.outline) deciduousFoliageObjects.push(crowns.outline);
      const bSnow = buildInstancedSet(bakedBirchSnow, decid, null, false);
      bSnow.main.visible = false;
      pineSnowCapObjects.push(bSnow.main);
      registerTrees(decid, [skel, crowns, bSnow], 'Tree');
    }
  });
  return spots.length;
}

function buildMountainBoulders() {
  const list = [];
  for (let attempt = 0; attempt < 5000 && list.length < 110; attempt++) {
    const ang = Math.random() * Math.PI * 2;
    const rr = 170 + Math.random() * 250;
    const x = ISLAND_CENTER.x + Math.cos(ang) * rr;
    const z = ISLAND_CENTER.z + Math.sin(ang) * rr;
    const pol = getIslandPolar(x, z);
    const inland = getCoastRadius(pol.theta) - pol.r;
    if (inland < 2) continue;
    const y = getTerrainHeight(x, z);
    if (y < 0.6) continue;
    const slope = getLocalSlope(x, z);
    // Rotsblokken op de kliffen langs de kust en op steile bosheuvels
    const rocky = (inland < 30 && getCliffiness(pol.theta) > 0.5) || slope > 0.45;
    if (!rocky) continue;
    const { marginDist } = getClosestNetworkRoad(x, z);
    if (marginDist < 5.5 || getDistToRivers(x, z) < 4) continue;
    if (Math.hypot(x - summitPos.x, z - summitPos.z) < 16) continue;
    if (isInsideSpecialLot(x, z)) continue;
    const s = 0.9 + Math.random() * 1.9;
    list.push({ x, y: y + 0.1 * s, z, scale: s, rot: Math.random() * Math.PI });
    hardColliders.push({ x, z, r: s * 0.85 });
  }
  if (list.length) buildInstancedSet(bakedRock, list, null, false);
}

const forestCount = buildOuterForest();
buildMountainBoulders();

// =========================================================
// UITKIJKTOREN OP DE HOOGSTE BOSHEUVEL (langs het Timber Trail)
// =========================================================
function buildFireLookout() {
  const x = LOOKOUT_HILL.x;
  const z = LOOKOUT_HILL.z;
  const baseY = getTerrainHeight(x, z);
  const g = new THREE.Group();
  const woodMat = registerSeasonalMat(0x7a4a2a, 0x8a6a55);
  const darkWoodMat = makeToonMat(0x5a3520);
  const cabinMat = registerSeasonalMat(0xc9a273, 0xd8c8b8);
  const roofMat = registerSeasonalMat(0x9c3b2e, 0xf2f6fb);

  const legH = 9.0;
  const footHalf = 2.4;
  const topHalf = 1.5;
  const up = new THREE.Vector3(0, 1, 0);
  const footStoneMat = makeToonMat(0x8d8379);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    // Schuin aflopende poten: van de voet (op de eigen grondhoogte, iets ingegraven) tot onder het plateau
    const footY = getTerrainHeight(x + sx * footHalf, z + sz * footHalf) - baseY - 0.35;
    const bottom = new THREE.Vector3(sx * footHalf, footY, sz * footHalf);
    const top = new THREE.Vector3(sx * topHalf, legH + 0.05, sz * topHalf);
    const dir = top.clone().sub(bottom);
    const len = dir.length();
    const leg = createOutlinedMesh(new THREE.BoxGeometry(0.32, len, 0.32), woodMat, 0.035);
    leg.position.copy(bottom).add(top).multiplyScalar(0.5);
    leg.quaternion.setFromUnitVectors(up, dir.normalize());
    g.add(leg);
    const stone = createOutlinedMesh(new THREE.BoxGeometry(0.75, 0.5, 0.75), footStoneMat, 0.03, false);
    stone.position.set(sx * footHalf, footY + 0.45, sz * footHalf);
    g.add(stone);
  });
  // Kruisverbanden
  [2.4, 5.0, 7.4].forEach((by) => {
    const half = THREE.MathUtils.lerp(footHalf, topHalf, by / legH);
    [0, Math.PI / 2].forEach((rot) => {
      [-1, 1].forEach((side) => {
        const brace = createOutlinedMesh(new THREE.BoxGeometry(half * 2 + 0.3, 0.18, 0.18), darkWoodMat, 0.025, false);
        brace.position.set(rot === 0 ? 0 : side * half, by, rot === 0 ? side * half : 0);
        brace.rotation.y = rot;
        g.add(brace);
      });
    });
  });
  const deck = createOutlinedMesh(new THREE.BoxGeometry(4.6, 0.3, 4.6), darkWoodMat, 0.04, true, true);
  deck.position.y = legH + 0.15;
  g.add(deck);
  const cabin = createOutlinedMesh(new THREE.BoxGeometry(3.2, 2.0, 3.2), cabinMat, 0.04);
  cabin.position.y = legH + 1.3;
  g.add(cabin);
  [0, 1, 2, 3].forEach((k) => {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.9), warmWindowMat);
    const a = (k * Math.PI) / 2;
    win.position.set(Math.sin(a) * 1.62, legH + 1.55, Math.cos(a) * 1.62);
    win.rotation.y = a;
    g.add(win);
    houseWindows.push({ mesh: win, timer: Math.random() * 10 });
  });
  const roof = createOutlinedMesh(new THREE.ConeGeometry(3.0, 1.5, 4), roofMat, 0.045);
  roof.position.y = legH + 3.05;
  roof.rotation.y = Math.PI / 4;
  g.add(roof);
  // Vlaggetje
  const pole = createOutlinedMesh(new THREE.CylinderGeometry(0.05, 0.05, 1.8, 5), darkWoodMat, 0.02, false);
  pole.position.y = legH + 4.4;
  g.add(pole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.55), new THREE.MeshBasicMaterial({ color: 0xe0452f, side: THREE.DoubleSide }));
  flag.position.set(0.47, legH + 5.0, 0);
  g.add(flag);

  g.position.set(x, baseY, z);
  scene.add(g);
  hardColliders.push({ x, z, r: 2.9 });
}
buildFireLookout();

// =========================================================
// MOOSE LAKE: STEIGER BIJ DE LODGE
// =========================================================
function buildMoosePier() {
  const lodge = ruralLots.find((l) => l.tag === 'moose_lodge');
  const dirX = lodge ? MOOSE_LAKE.x - lodge.x : -1;
  const dirZ = lodge ? MOOSE_LAKE.z - lodge.z : 0;
  const len = Math.hypot(dirX, dirZ) || 1;
  const ux = -dirX / len;
  const uz = -dirZ / len;
  // Van de oever (r+1) het meer in
  const x1 = MOOSE_LAKE.x + ux * (MOOSE_LAKE.r + 1.5);
  const z1 = MOOSE_LAKE.z + uz * (MOOSE_LAKE.r + 1.5);
  const x2 = MOOSE_LAKE.x + ux * (MOOSE_LAKE.r - 9);
  const z2 = MOOSE_LAKE.z + uz * (MOOSE_LAKE.r - 9);
  const plankMat = makeToonMat(0x8a6a44);
  const postMat = makeToonMat(0x5c432b);
  const baseY = WATER_LEVEL + 0.34;
  const deckLen = Math.hypot(x2 - x1, z2 - z1);
  const deck = createOutlinedMesh(new THREE.BoxGeometry(2.0, 0.22, deckLen), plankMat, 0.035, false, true);
  deck.position.set((x1 + x2) * 0.5, baseY, (z1 + z2) * 0.5);
  deck.rotation.y = Math.atan2(x2 - x1, z2 - z1);
  scene.add(deck);
  for (let i = 0; i <= 4; i++) {
    const t = i / 4;
    [-0.85, 0.85].forEach((side) => {
      const px = THREE.MathUtils.lerp(x1, x2, t) + -uz * side;
      const pz = THREE.MathUtils.lerp(z1, z2, t) + ux * side;
      const pile = createOutlinedMesh(new THREE.CylinderGeometry(0.1, 0.13, 2.2, 6), postMat, 0.02, false);
      pile.position.set(px, baseY - 1.0, pz);
      scene.add(pile);
    });
  }
  // Roeibootje aan de steiger
  const boat = new THREE.Group();
  const hull = createOutlinedMesh(new THREE.BoxGeometry(1.3, 0.45, 3.2), makeToonMat(0xc2502f), 0.04);
  hull.position.y = 0.1;
  boat.add(hull);
  const seat = createOutlinedMesh(new THREE.BoxGeometry(1.2, 0.1, 0.4), plankMat, 0.02, false);
  seat.position.y = 0.36;
  boat.add(seat);
  boat.position.set(x2 + -uz * 2.0, WATER_LEVEL + 0.05, z2 + ux * 2.0);
  boat.rotation.y = Math.atan2(x2 - x1, z2 - z1);
  scene.add(boat);
}
buildMoosePier();

// =========================================================
// STRANDWACHTTORENS OP DE ZANDSTRANDEN
// =========================================================
function buildLifeguardTower(x, z, faceYaw) {
  const g = new THREE.Group();
  const whiteMat = registerSeasonalMat(0xf3efe6, 0xffffff);
  const redMat = makeToonMat(0xd9452f);
  [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]].forEach(([lx, lz]) => {
    const leg = createOutlinedMesh(new THREE.BoxGeometry(0.18, 2.4, 0.18), whiteMat, 0.025, false);
    leg.position.set(lx, 1.2, lz);
    g.add(leg);
  });
  const hut = createOutlinedMesh(new THREE.BoxGeometry(2.0, 1.3, 2.0), redMat, 0.04);
  hut.position.y = 3.05;
  g.add(hut);
  const roof = createOutlinedMesh(new THREE.BoxGeometry(2.5, 0.18, 2.5), whiteMat, 0.035);
  roof.position.y = 3.8;
  g.add(roof);
  const ramp = createOutlinedMesh(new THREE.BoxGeometry(0.8, 0.1, 3.0), whiteMat, 0.02, false);
  ramp.position.set(0, 1.2, 2.0);
  ramp.rotation.x = 0.75;
  g.add(ramp);
  // Parasol ernaast
  const pole = createOutlinedMesh(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 5), whiteMat, 0.015, false);
  pole.position.set(3.2, 1.1, 0.5);
  g.add(pole);
  const shade = createOutlinedMesh(new THREE.ConeGeometry(1.4, 0.55, 8), makeToonMat(0x2f9fd0), 0.03, false);
  shade.position.set(3.2, 2.35, 0.5);
  g.add(shade);

  g.position.set(x, getTerrainHeight(x, z), z);
  g.rotation.y = faceYaw;
  scene.add(g);
  hardColliders.push({ x, z, r: 1.4 });
}

function buildBeachTowers() {
  let placed = 0;
  const usedThetas = [];
  for (let k = 0; k < 360 && placed < 5; k++) {
    const theta = -Math.PI + (k / 360) * Math.PI * 2 + 0.31;
    if (getCliffiness(theta) > 0.12) continue;
    if (usedThetas.some((t) => Math.abs(t - theta) < 0.6)) continue;
    const r = getCoastRadius(theta) - 5;
    const x = ISLAND_CENTER.x + Math.cos(theta) * r;
    const z = ISLAND_CENTER.z + Math.sin(theta) * r;
    const y = getTerrainHeight(x, z);
    if (y < 0.05 || y > 0.9) continue;
    if (getDistToRivers(x, z) < 12) continue;
    // kijkt uit over zee
    buildLifeguardTower(x, z, Math.atan2(Math.cos(theta), Math.sin(theta)));
    usedThetas.push(theta);
    placed++;
  }
}
buildBeachTowers();

// =========================================================
// WEGWIJZERS VOOR HET NIEUWE WEGENNET
// =========================================================
function signAlong(curve, u, sideSign, lines, flip = false) {
  const pt = curve.getPointAt(u);
  const tan = curve.getTangentAt(u);
  const len = Math.hypot(tan.x, tan.z) || 1;
  const tx = tan.x / len;
  const tz = tan.z / len;
  const x = pt.x + -tz * sideSign * 7.0;
  const z = pt.z + tx * sideSign * 7.0;
  createRoadSign(x, z, getTerrainHeight(x, z), Math.atan2(flip ? -tx : tx, flip ? -tz : tz), lines);
}

// Zoek een plek langs de weg die niet op/naast een brug ligt
function clearDistAlong(def, startM, dirSign) {
  const L = def.curve.getLength();
  for (let d = startM; d < startM + 60; d += 3) {
    const u = dirSign > 0 ? d / L : 1 - d / L;
    const onOrNear = def.bridges.some((b) => Math.abs(u - b.uCenter) * L < b.uHalfSpan * L + 8);
    if (!onOrNear) return u;
  }
  return dirSign > 0 ? startM / L : 1 - startM / L;
}

connectorRoads.forEach((c) => {
  const uStart = clearDistAlong(c, 24, 1);
  const uEnd = clearDistAlong(c, 24, -1);
  // Bij het begin (vanuit het binnenland): wijst naar de kust
  signAlong(c.curve, uStart, 1, ['COAST HWY', 'Coast road'], true);
  // Bij het eind (vanaf de kust): wijst naar Pinewood
  signAlong(c.curve, uEnd, 1, ['PINEWOOD', 'Centrum']);
});

signAlong(timberTrail.curve, clearDistAlong(timberTrail, 24, 1), 1, ['TIMBER TRAIL', 'Lookout tower'], true);
signAlong(timberTrail.curve, clearDistAlong(timberTrail, 24, -1), 1, ['TIMBER TRAIL', 'Lookout tower']);

{
  const lodge = ruralLots.find((l) => l.tag === 'moose_lodge');
  if (lodge) {
    const ringLen = ringCurve.getLength();
    signAlong(ringCurve, (lodge.u + 30 / ringLen) % 1, -1, ['MOOSE LAKE', 'Lodge'], true);
    signAlong(ringCurve, (lodge.u - 30 / ringLen + 1) % 1, -1, ['MOOSE LAKE', 'Lodge']);
  }
}

RING_BRIDGES.filter((b) => b.type === 'suspension').forEach((b) => {
  const ringLen = ringCurve.getLength();
  signAlong(ringCurve, (b.uCenter - b.uHalfSpan - 22 / ringLen + 1) % 1, -1, ['PINEWOOD BRIDGE', 'Pine River']);
  signAlong(ringCurve, (b.uCenter + b.uHalfSpan + 22 / ringLen) % 1, -1, ['PINEWOOD BRIDGE', 'Pine River'], true);
});

export const ISLAND_STATS = { forestCount };

// Bord bij de inrit van de Pinewood Mall
{
  const mall = ruralLots.find((l) => l.type === 'store');
  if (mall) {
    const ax = Math.cos(mall.yaw);
    const az = -Math.sin(mall.yaw);
    const tx = mall.x - mall.roadX;
    const tz = mall.z - mall.roadZ;
    const tl = Math.hypot(tx, tz) || 1;
    const sx = mall.roadX + ax * 7.5 + (tx / tl) * 3.0;
    const sz = mall.roadZ + az * 7.5 + (tz / tl) * 3.0;
    createRoadSign(sx, sz, getTerrainHeight(sx, sz), mall.yaw, ['PINEWOOD MALL', 'Entrance']);
  }
}

// Wegwijzers voor de zijtakken
branchRoads.forEach((road) => {
  const names = road.id === 'pine_river_road' ? ['PINE RIVER RD', 'River & forest'] : ['PRAIRIE ROAD', 'Moose Lake · Beach'];
  signAlong(road.curve, clearDistAlong(road, 24, 1), 1, names, true);
  signAlong(road.curve, clearDistAlong(road, 24, -1), 1, names);
});

// Groen rond Pine Coffee
{
  const lot = ruralLots.find((l) => l.type === 'coffee');
  if (lot) {
    const c = Math.cos(lot.yaw);
    const sn = Math.sin(lot.yaw);
    const toWorld = (lx, lz) => ({ x: lot.x + lx * c + lz * sn, z: lot.z - lx * sn + lz * c });
    // Groene omlijsting: bomen, dennen en struiken rondom (je kunt ze omrijden)
    const greenery = [
      // achterkant
      [-11, -11, 'd'], [-6.5, -12, 'p'], [-2, -11.5, 'd'], [2.5, -12.5, 'p'], [7, -11, 'd'], [11, -12, 'p'],
      [-8.5, -9.6, 's'], [0.5, -9.6, 's'], [5.5, -9.4, 's'],
      // linkerkant (bij het terras)
      [-12, -6, 'p'], [-12.5, -1, 'd'], [-12, 4, 'p'], [-10.4, -3.5, 's'], [-10.4, 1.5, 's'], [-10.4, 6.5, 's'],
      // rechterkant (langs de drive-thru)
      [9, -6, 'd'], [10.5, -1.5, 'p'], [9, 3, 'd'], [10.5, 7, 'p'], [7.2, -7.5, 's'], [7.2, 0.5, 's'], [7.4, 6, 's']
    ];
    greenery.forEach(([lx, lz, kind]) => {
      const p = toWorld(lx, lz);
      const y = getTerrainHeight(p.x, p.z);
      let obj;
      if (kind === 's') {
        const sc = 0.65 + Math.random() * 0.5;
        obj = createShrubFast(sc);
        obj.position.set(p.x, y, p.z);
        scene.add(obj);
        registerDestructible(obj, p.x, y, p.z, Math.max(0.6, 0.85 * sc), 'shrub', 3, 'Shrub');
      } else if (kind === 'p') {
        const sc = 0.75 + Math.random() * 0.35;
        obj = createPineFast(sc);
        obj.position.set(p.x, y, p.z);
        obj.rotation.y = Math.random() * Math.PI * 2;
        scene.add(obj);
        registerDestructible(obj, p.x, y, p.z, 0.85 * sc, 'tree', 15, 'Pine tree');
      } else {
        obj = createParkTree();
        obj.position.set(p.x, y, p.z);
        obj.scale.setScalar(1.1 + Math.random() * 0.25);
        scene.add(obj);
        registerDestructible(obj, p.x, y, p.z, 0.7, 'tree', 15, 'Tree');
      }
      markLastPlanted();
    });
  }
}

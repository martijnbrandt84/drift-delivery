import * as THREE from 'three';
import {
  scene, createOutlinedMesh, makeToonMat, registerSeasonalMat, christmasGroup, pineSnowCapObjects
} from './scene-setup.js';
import { TOWN_ELEV } from './roads.js';
import { ruralLots } from './water-lots.js';
import { hardColliders, registerDestructible } from './demolition.js';
import { getTerrainHeight } from './terrain.js';

// =========================================================
// STADJE PINEWOOD CREEK — VOLGEBOUWDE BLOKKEN, AANEENGESLOTEN
// WINKELSTRATEN, RIJTJESHUIZEN & BREED STADSPLEIN ZONDER KIEREN
// =========================================================
export const chimneySmokes = [];
export const houseWindows = [];
export const stoneMat = makeToonMat(0x8d8379);
export const warmWindowMat = new THREE.MeshBasicMaterial({ color: 0x9fc8d9 });
export const nightLampHalos = [];
export let giantStarMesh = null;
// Plek van de grote dorpsspar: op het groen tussen het stadje en het meer
export const XMAS_TREE_POS = { x: 0, z: 67 };
const garlandMat = new THREE.MeshBasicMaterial({ color: 0xffd86b });
const ribbonMat = makeToonMat(0xffd23f);
const caneWhiteMat = makeToonMat(0xfaf6f0);
const caneRedMat = makeToonMat(0xd62839);

// --- Materialen ---
const trimWhiteMat = makeToonMat(0xfff5e6);
const sidewalkMat = registerSeasonalMat(0xe6dac8, 0xeef4fa);
const plazaTileMat = registerSeasonalMat(0xd5c4ae, 0xe6eff7);
const courtyardPaverMat = registerSeasonalMat(0xcbbba6, 0xe2ecf5);
const blockLawnMat = registerSeasonalMat(0x87b356, 0xf4f8fc);
const sharedHouseRoofMat = registerSeasonalMat(0x54463f, 0xf2f7fc);
const altSlateRoofMat = registerSeasonalMat(0x43515e, 0xeef4fa);
const cabinRoofMat = registerSeasonalMat(0x4a3830, 0xf2f7fc);
const aframeRoofMat = registerSeasonalMat(0xb84830, 0xeef4fa);

const clockFaceMat = new THREE.MeshBasicMaterial({ color: 0xfff8ee });
const clockHandMat = new THREE.MeshBasicMaterial({ color: 0x2a1810 });
const flagMat = makeToonMat(0x3a6ea5);

const streetPostMat = makeToonMat(0x2f3638);
const treeGrateMat = makeToonMat(0x3b3532);
const streetLampGlow = new THREE.MeshBasicMaterial({ color: 0xffe896 });
const lampHaloMat = new THREE.MeshBasicMaterial({
  color: 0xffcf6b,
  transparent: true,
  opacity: 0.18,
  depthWrite: false
});
const wreathGreenMat = makeToonMat(0x2d6e3e);
const bowRedMat = makeToonMat(0xd92b2b);
const hydrantRedMat = makeToonMat(0xd92b2b);
const benchWoodMat = makeToonMat(0x8a5a35);
const binMat = makeToonMat(0x3e5c47);

const fountainStoneMat = stoneMat;
const fountainWaterMat = new THREE.MeshBasicMaterial({ color: 0x5ec2d9 });
const parkTreeTrunkMat = makeToonMat(0x6b3f28);
const parkTreeLeafMat = registerSeasonalMat(0x3f7a4a, 0xdbe8f4);

const storeAsphaltMat = makeToonMat(0x4a474c);
const storeLineMat = new THREE.MeshBasicMaterial({ color: 0xfff8eb });
const wheelStopMat = makeToonMat(0xcfc8be);

const xmasBulbMats = [
  new THREE.MeshBasicMaterial({ color: 0xff3b3b }),
  new THREE.MeshBasicMaterial({ color: 0x3be860 }),
  new THREE.MeshBasicMaterial({ color: 0xffd93b }),
  new THREE.MeshBasicMaterial({ color: 0x45b6ff })
];
const bulbGeo = new THREE.SphereGeometry(0.14, 6, 6);

// =========================================================
// EXACTE STRAATGRENZEN UIT ROADS.JS (GEEN MILLIMETER GRAS!)
// West Ave: [-32.1 .. -23.9] | Center Ave: [-4.1 .. +4.1] | East Ave: [+23.9 .. +32.1]
// Hoofdstraat noordrand: z = 84.8 (lichte boog tot 85.45 in het midden van een blok)
// Oak St: [107.9 .. 116.1]
// =========================================================
function addRoofStringLights(targetWorldObj, width, yPos, zFront) {
  targetWorldObj.updateMatrixWorld(true);
  const count = Math.max(5, Math.floor(width / 0.95));
  for (let i = 0; i <= count; i++) {
    const lx = -width * 0.48 + (i / count) * (width * 0.96);
    const sag = Math.sin((i / count) * Math.PI) * 0.1;
    const localPt = new THREE.Vector3(lx, yPos - sag, zFront).applyMatrix4(targetWorldObj.matrixWorld);
    const bulb = new THREE.Mesh(bulbGeo, xmasBulbMats[i % xmasBulbMats.length]);
    bulb.position.copy(localPt);
    christmasGroup.add(bulb);
  }
}

function createSidewalkStrip(centerX, centerZ, widthX, depthZ) {
  const slab = createOutlinedMesh(new THREE.BoxGeometry(widthX, 0.56, depthZ), sidewalkMat, 0.04, false, true);
  slab.position.set(centerX, TOWN_ELEV - 0.14, centerZ);
  scene.add(slab);
}

function createSeamlessBlockBase(minX, maxX, minZ, maxZ, sw = 1.9, innerMat = courtyardPaverMat) {
  const fullW = maxX - minX;
  const innerD = (maxZ - minZ) - sw * 2;
  const centerX = (minX + maxX) * 0.5;
  const centerZ = (minZ + maxZ) * 0.5;

  createSidewalkStrip(centerX, minZ + sw * 0.5, fullW, sw);
  createSidewalkStrip(centerX, maxZ - sw * 0.5, fullW, sw);

  if (innerD > 0.05) {
    createSidewalkStrip(minX + sw * 0.5, centerZ, sw, innerD);
    createSidewalkStrip(maxX - sw * 0.5, centerZ, sw, innerD);
  }

  const innerW = fullW - sw * 2;
  if (innerW > 0.1 && innerD > 0.1 && innerMat) {
    const innerPad = createOutlinedMesh(new THREE.BoxGeometry(innerW + 0.06, 0.52, innerD + 0.06), innerMat, 0.032, false, true);
    innerPad.position.set(centerX, TOWN_ELEV - 0.14, centerZ);
    scene.add(innerPad);
  }
}

function createParkTree() {
  const g = new THREE.Group();
  const trunk = createOutlinedMesh(new THREE.CylinderGeometry(0.19, 0.27, 1.75, 7), parkTreeTrunkMat, 0.03);
  trunk.position.y = 0.88;
  g.add(trunk);
  const crown = createOutlinedMesh(new THREE.IcosahedronGeometry(1.25, 1), parkTreeLeafMat, 0.045);
  crown.position.y = 2.35;
  g.add(crown);
  return g;
}

function createPlazaGrateTree() {
  const g = new THREE.Group();
  const grate = createOutlinedMesh(new THREE.CylinderGeometry(0.88, 0.9, 0.05, 12), treeGrateMat, 0.02, false, true);
  grate.position.y = 0.025;
  g.add(grate);

  const innerRing = new THREE.Mesh(new THREE.RingGeometry(0.32, 0.76, 12), stoneMat);
  innerRing.rotation.x = -Math.PI * 0.5;
  innerRing.position.y = 0.055;
  g.add(innerRing);

  const tree = createParkTree();
  g.add(tree);
  return g;
}

function createParkingIslandTree(size = 1.9) {
  const g = new THREE.Group();
  const curb = createOutlinedMesh(new THREE.BoxGeometry(size, 0.24, size), stoneMat, 0.03, false, true);
  curb.position.y = 0.12;
  g.add(curb);
  const tree = createParkTree();
  tree.position.y = 0.22;
  g.add(tree);
  return g;
}

// =========================================================
// STRAATMEUBILAIR (HOEKLANTAARNS, BRANDKRANEN, BANKJES, BAKKEN)
// =========================================================
function createSmashableStreetLampAt(x, y, z) {
  const g = new THREE.Group();
  const pole = createOutlinedMesh(new THREE.CylinderGeometry(0.1, 0.15, 3.6, 7), streetPostMat, 0.028);
  pole.position.y = 1.8;
  g.add(pole);

  const globe = createOutlinedMesh(new THREE.SphereGeometry(0.32, 8, 8), streetLampGlow, 0.03, false, false);
  globe.position.y = 3.75;
  g.add(globe);

  // Cirkelvormige lichtbol rond de lantaarnkop in Nachtmodus
  const haloSphere = new THREE.Mesh(new THREE.SphereGeometry(1.15, 12, 10), lampHaloMat);
  haloSphere.position.y = 3.75;
  haloSphere.visible = false;
  g.add(haloSphere);
  nightLampHalos.push(haloSphere);

  const wreath = new THREE.Group();
  wreath.add(createOutlinedMesh(new THREE.TorusGeometry(0.32, 0.1, 6, 10), wreathGreenMat, 0.02, false, false));
  const bow = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.16, 0.14), bowRedMat);
  bow.position.set(0, -0.3, 0.08);
  wreath.add(bow);
  wreath.position.set(0, 2.75, 0);
  wreath.visible = false;
  g.add(wreath);
  pineSnowCapObjects.push(wreath);

  g.position.set(x, y, z);
  scene.add(g);
  registerDestructible(g, x, y, z, 0.65, 'small', 28, 'Straatlantaarn');
}

function placeCornerLamps(minX, maxX, minZ, maxZ, inset = 0.95) {
  const py = TOWN_ELEV + 0.14;
  const southZ = minZ < 85.2 ? minZ + 1.15 : minZ + inset;
  createSmashableStreetLampAt(minX + inset, py, southZ);
  createSmashableStreetLampAt(maxX - inset, py, southZ);
  createSmashableStreetLampAt(minX + inset, py, maxZ - inset);
  createSmashableStreetLampAt(maxX - inset, py, maxZ - inset);
}

function createSmashableHydrant(x, z) {
  const g = new THREE.Group();
  const body = createOutlinedMesh(new THREE.CylinderGeometry(0.21, 0.25, 0.76, 8), hydrantRedMat, 0.028, false);
  body.position.y = 0.38;
  g.add(body);
  const nozzles = createOutlinedMesh(new THREE.CylinderGeometry(0.08, 0.08, 0.56, 6), trimWhiteMat, 0.02, false);
  nozzles.rotation.z = Math.PI * 0.5;
  nozzles.position.y = 0.52;
  g.add(nozzles);
  const top = createOutlinedMesh(new THREE.SphereGeometry(0.21, 8, 6), hydrantRedMat, 0.025, false);
  top.position.y = 0.78;
  g.add(top);

  const py = TOWN_ELEV + 0.14;
  g.position.set(x, py, z);
  scene.add(g);
  registerDestructible(g, x, py, z, 0.55, 'small', 32, 'Brandkraan');
}

function createBenchAt(x, y, z, rotY = 0) {
  const g = new THREE.Group();
  const seat = createOutlinedMesh(new THREE.BoxGeometry(1.65, 0.1, 0.5), benchWoodMat, 0.02, false);
  seat.position.y = 0.46;
  g.add(seat);
  const back = createOutlinedMesh(new THREE.BoxGeometry(1.65, 0.5, 0.08), benchWoodMat, 0.02, false);
  back.position.set(0, 0.74, -0.21);
  g.add(back);
  [-0.7, 0.7].forEach((lx) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.46, 0.46), streetPostMat);
    leg.position.set(lx, 0.23, 0);
    g.add(leg);
  });

  g.position.set(x, y, z);
  g.rotation.y = rotY;
  scene.add(g);
  registerDestructible(g, x, y, z, 0.9, 'small', 10, 'Bankje');
}

function createBench(x, z, rotY = 0) {
  createBenchAt(x, TOWN_ELEV + 0.14, z, rotY);
}

function createTrashBinAt(x, y, z) {
  const g = new THREE.Group();
  const body = createOutlinedMesh(new THREE.CylinderGeometry(0.27, 0.23, 0.62, 10), binMat, 0.03, false);
  body.position.y = 0.31;
  g.add(body);
  const lid = createOutlinedMesh(new THREE.CylinderGeometry(0.29, 0.29, 0.06, 10), streetPostMat, 0.02, false);
  lid.position.y = 0.64;
  g.add(lid);

  g.position.set(x, y, z);
  scene.add(g);
  registerDestructible(g, x, y, z, 0.4, 'small', 6, 'Prullenbak');
}

function createTrashBin(x, z) {
  createTrashBinAt(x, TOWN_ELEV + 0.14, z);
}

function createFountain() {
  const g = new THREE.Group();
  const outerRim = createOutlinedMesh(new THREE.CylinderGeometry(2.35, 2.55, 0.54, 18), fountainStoneMat, 0.04, false);
  outerRim.position.y = 0.27;
  g.add(outerRim);

  const water = new THREE.Mesh(new THREE.CylinderGeometry(2.12, 2.12, 0.1, 18), fountainWaterMat);
  water.position.y = 0.55;
  g.add(water);

  const column = createOutlinedMesh(new THREE.CylinderGeometry(0.34, 0.44, 1.45, 10), fountainStoneMat, 0.03, false);
  column.position.y = 1.25;
  g.add(column);

  const topBasin = createOutlinedMesh(new THREE.CylinderGeometry(0.95, 1.05, 0.32, 14), fountainStoneMat, 0.035, false);
  topBasin.position.y = 2.0;
  g.add(topBasin);

  const topWater = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.82, 0.07, 14), fountainWaterMat);
  topWater.position.y = 2.17;
  g.add(topWater);
  return g;
}

// =========================================================
// AANEENGESLOTEN STADSWINKELS & GESCHAKELDE RIJTJESHUIZEN
// =========================================================
function createAttachedShop(width, height, depth, wallHex, awningHex, roofTrimHex) {
  const g = new THREE.Group();
  const wallMat = makeToonMat(wallHex);
  const awningMat = makeToonMat(awningHex);
  const corniceMat = registerSeasonalMat(roofTrimHex, 0xf2f7fc);

  const body = createOutlinedMesh(new THREE.BoxGeometry(width, height, depth), wallMat, 0.05);
  body.position.y = height * 0.5;
  g.add(body);

  const parapet = createOutlinedMesh(new THREE.BoxGeometry(width, 0.78, 0.52), corniceMat, 0.04, false);
  parapet.position.set(0, height + 0.34, depth * 0.5 - 0.18);
  g.add(parapet);

  const signBoard = createOutlinedMesh(new THREE.BoxGeometry(width * 0.76, 0.62, 0.18), trimWhiteMat, 0.032, false);
  signBoard.position.set(0, height - 0.55, depth * 0.5 + 0.09);
  g.add(signBoard);

  const awning = createOutlinedMesh(new THREE.BoxGeometry(width * 0.94, 0.22, 1.15), awningMat, 0.035, false);
  awning.position.set(0, 2.65, depth * 0.5 + 0.52);
  awning.rotation.x = 0.25;
  g.add(awning);

  const door = createOutlinedMesh(new THREE.BoxGeometry(0.96, 2.12, 0.12), makeToonMat(0x593423), 0.028, false);
  door.position.set(0, 1.06, depth * 0.5 + 0.04);
  g.add(door);

  const winSpan = width * 0.28;
  [-winSpan, winSpan].forEach((wx) => {
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(1.4, width * 0.26), 1.28), warmWindowMat);
    glass.position.set(wx, 1.4, depth * 0.5 + 0.07);
    g.add(glass);
    houseWindows.push({ mesh: glass, timer: Math.random() * 10 });
  });

  const upperFloors = height >= 6.8 ? [3.55, 5.55] : height >= 4.9 ? [3.45] : [];
  upperFloors.forEach((wy) => {
    [-winSpan, winSpan].forEach((wx) => {
      const upGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.88, 1.05), warmWindowMat);
      upGlass.position.set(wx, wy, depth * 0.5 + 0.07);
      g.add(upGlass);
      houseWindows.push({ mesh: upGlass, timer: Math.random() * 10 });
    });
  });

  g.userData.lightSpecs = { width: width * 0.94, yPos: 2.52, zFront: depth * 0.5 + 1.04 };
  return g;
}

function createRowTownHouse(width, height, depth, sidingHex, altRoof = false) {
  const g = new THREE.Group();
  const stoopDepth = 0.85;
  const roofMat = altRoof ? altSlateRoofMat : sharedHouseRoofMat;

  const plinth = createOutlinedMesh(new THREE.BoxGeometry(width, 0.44, depth), stoneMat, 0.038, false);
  plinth.position.y = 0.1;
  g.add(plinth);

  const body = createOutlinedMesh(new THREE.BoxGeometry(width, height, depth), makeToonMat(sidingHex), 0.05);
  body.position.y = height * 0.5 + 0.2;
  g.add(body);

  const rShape = new THREE.Shape();
  rShape.moveTo(-(depth * 0.5 + 0.22), 0);
  rShape.lineTo(0, 1.75);
  rShape.lineTo(depth * 0.5 + 0.22, 0);
  rShape.closePath();
  const rGeo = new THREE.ExtrudeGeometry(rShape, { depth: width, bevelEnabled: false });
  rGeo.rotateY(Math.PI * 0.5);
  rGeo.translate(-width * 0.5, 0, 0);
  const roof = createOutlinedMesh(rGeo, roofMat, 0.052);
  roof.position.y = height + 0.18;
  g.add(roof);

  const stoop = createOutlinedMesh(new THREE.BoxGeometry(1.75, 0.42, stoopDepth), stoneMat, 0.032, false);
  stoop.position.set(0, 0.12, depth * 0.5 + stoopDepth * 0.5);
  g.add(stoop);

  const canopy = createOutlinedMesh(new THREE.BoxGeometry(1.9, 0.18, stoopDepth + 0.1), roofMat, 0.032, false);
  canopy.position.set(0, 2.58, depth * 0.5 + stoopDepth * 0.5);
  canopy.rotation.x = 0.15;
  g.add(canopy);

  [-0.75, 0.75].forEach((px) => {
    const post = createOutlinedMesh(new THREE.BoxGeometry(0.16, 2.18, 0.16), trimWhiteMat, 0.025, false);
    post.position.set(px, 1.4, depth * 0.5 + stoopDepth - 0.12);
    g.add(post);
  });

  const door = createOutlinedMesh(new THREE.BoxGeometry(0.95, 2.02, 0.14), makeToonMat(0x8f3224), 0.028, false);
  door.position.set(0, 1.34, depth * 0.5 + 0.05);
  g.add(door);

  [-width * 0.29, width * 0.29].forEach((wx) => {
    [1.62, height - 0.75].forEach((wy) => {
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.88), warmWindowMat);
      glass.position.set(wx, wy, depth * 0.5 + 0.07);
      g.add(glass);
      houseWindows.push({ mesh: glass, timer: Math.random() * 10 });
    });
  });

  const chim = createOutlinedMesh(new THREE.BoxGeometry(0.72, height + 2.0, 0.72), makeToonMat(0xa64632), 0.04, false);
  chim.position.set(-width * 0.28, (height + 2.0) * 0.5 + 0.15, -0.35);
  g.add(chim);

  g.userData.chimneyTop = new THREE.Vector3(-width * 0.28, height + 2.2, -0.35);
  g.userData.lightSpecs = { width: width * 0.94, yPos: height + 0.15, zFront: depth * 0.5 + 0.28 };
  return g;
}

function createDetachedRuralHouse(sidingHex) {
  const g = new THREE.Group();
  const w = 6.4, h = 4.3, d = 5.4;

  const plinth = createOutlinedMesh(new THREE.BoxGeometry(w + 0.2, 0.45, d + 0.2), stoneMat, 0.04, false);
  plinth.position.y = 0.05;
  g.add(plinth);

  const body = createOutlinedMesh(new THREE.BoxGeometry(w, h, d), makeToonMat(sidingHex), 0.058);
  body.position.y = h * 0.5 + 0.18;
  g.add(body);

  const rShape = new THREE.Shape();
  rShape.moveTo(-(w * 0.5 + 0.35), 0);
  rShape.lineTo(0, 2.1);
  rShape.lineTo(w * 0.5 + 0.35, 0);
  rShape.closePath();
  const rGeo = new THREE.ExtrudeGeometry(rShape, { depth: d + 0.6, bevelEnabled: false });
  rGeo.translate(0, 0, -(d + 0.6) * 0.5);
  const roof = createOutlinedMesh(rGeo, sharedHouseRoofMat, 0.06);
  roof.position.y = h + 0.12;
  g.add(roof);

  const porch = createOutlinedMesh(new THREE.BoxGeometry(w * 0.92, 0.45, 1.8), stoneMat, 0.04, false);
  porch.position.set(0, 0.12, d * 0.5 + 0.88);
  g.add(porch);

  const pRoof = createOutlinedMesh(new THREE.BoxGeometry(w * 0.96, 0.2, 2.05), sharedHouseRoofMat, 0.04, false);
  pRoof.position.set(0, 2.6, d * 0.5 + 0.85);
  pRoof.rotation.x = 0.18;
  g.add(pRoof);

  [-w * 0.38, w * 0.38].forEach((px) => {
    const col = createOutlinedMesh(new THREE.BoxGeometry(0.22, 2.25, 0.22), trimWhiteMat, 0.03, false);
    col.position.set(px, 1.4, d * 0.5 + 1.6);
    g.add(col);
  });

  const door = createOutlinedMesh(new THREE.BoxGeometry(1.0, 2.0, 0.15), makeToonMat(0xbf4630), 0.03, false);
  door.position.set(0, 1.35, d * 0.5 + 0.06);
  g.add(door);

  [-w * 0.28, w * 0.28].forEach((wx) => {
    [1.65, h - 0.85].forEach((wy) => {
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 0.84), warmWindowMat);
      glass.position.set(wx, wy, d * 0.5 + 0.08);
      g.add(glass);
      houseWindows.push({ mesh: glass, timer: Math.random() * 10 });
    });
  });

  const chim = createOutlinedMesh(new THREE.BoxGeometry(0.9, h + 1.4, 0.9), makeToonMat(0xa64632), 0.048, false);
  chim.position.set(-w * 0.48, (h + 1.4) * 0.5 + 0.1, -0.4);
  g.add(chim);

  g.userData.chimneyTop = new THREE.Vector3(-w * 0.48, h + 1.6, -0.4);
  g.userData.lightSpecs = { width: w * 0.9, yPos: 2.48, zFront: d * 0.5 + 1.82 };
  return g;
}

function createGemeentehuis() {
  const g = new THREE.Group();
  const w = 11.4, h = 5.4, d = 5.6;

  const plinth = createOutlinedMesh(new THREE.BoxGeometry(w + 0.5, 0.52, d + 0.5), stoneMat, 0.045, false);
  plinth.position.y = 0.1;
  g.add(plinth);

  [0, 1, 2].forEach((step) => {
    const stepMesh = createOutlinedMesh(new THREE.BoxGeometry(w * 0.46 - step * 0.55, 0.22, 0.5), stoneMat, 0.025, false);
    stepMesh.position.set(0, 0.1 + step * 0.22, d * 0.5 + 0.55 + step * 0.46);
    g.add(stepMesh);
  });

  const body = createOutlinedMesh(new THREE.BoxGeometry(w, h, d), makeToonMat(0xfaf3e3), 0.06);
  body.position.y = h * 0.5 + 0.35;
  g.add(body);

  const cornice = createOutlinedMesh(new THREE.BoxGeometry(w + 0.3, 0.42, d + 0.3), trimWhiteMat, 0.038, false);
  cornice.position.y = h + 0.42;
  g.add(cornice);

  const pedimentShape = new THREE.Shape();
  pedimentShape.moveTo(-3.6, 0);
  pedimentShape.lineTo(0, 1.75);
  pedimentShape.lineTo(3.6, 0);
  pedimentShape.closePath();
  const pedimentGeo = new THREE.ExtrudeGeometry(pedimentShape, { depth: 0.65, bevelEnabled: false });
  pedimentGeo.translate(0, 0, -0.32);
  const pediment = createOutlinedMesh(pedimentGeo, registerSeasonalMat(0xe3d7bb, 0xf2f7fc), 0.05);
  pediment.position.set(0, h + 0.55, d * 0.5 + 1.35);
  g.add(pediment);

  [-2.85, -1.0, 1.0, 2.85].forEach((px) => {
    const col = createOutlinedMesh(new THREE.CylinderGeometry(0.25, 0.3, h - 0.2, 10), trimWhiteMat, 0.03, false);
    col.position.set(px, h * 0.5 + 0.25, d * 0.5 + 1.45);
    g.add(col);
  });

  const porchRoof = createOutlinedMesh(new THREE.BoxGeometry(7.2, 0.32, 2.05), trimWhiteMat, 0.04, false);
  porchRoof.position.set(0, h + 0.35, d * 0.5 + 1.35);
  g.add(porchRoof);

  const door = createOutlinedMesh(new THREE.BoxGeometry(1.65, 2.65, 0.16), makeToonMat(0x593423), 0.03, false);
  door.position.set(0, 1.65, d * 0.5 + 0.1);
  g.add(door);

  [-4.2, -2.15, 2.15, 4.2].forEach((wx) => {
    [1.7, h - 0.65].forEach((wy) => {
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 1.42), warmWindowMat);
      glass.position.set(wx, wy, d * 0.5 + 0.08);
      g.add(glass);
      houseWindows.push({ mesh: glass, timer: Math.random() * 10 });
    });
  });

  const steepleBase = createOutlinedMesh(new THREE.BoxGeometry(2.1, 2.3, 2.1), trimWhiteMat, 0.045, false);
  steepleBase.position.set(0, h + 1.95, 0.4);
  g.add(steepleBase);

  const clockFace = new THREE.Mesh(new THREE.CircleGeometry(0.78, 16), clockFaceMat);
  clockFace.position.set(0, h + 1.95, 1.48);
  g.add(clockFace);
  [[0, 0.36, 0.11], [0.26, 0, 0.09]].forEach(([hx, hy, hl]) => {
    const hand = new THREE.Mesh(new THREE.BoxGeometry(hl, 0.08, 0.03), clockHandMat);
    hand.position.set(hx * 0.5, h + 1.95 + hy * 0.5, 1.52);
    g.add(hand);
  });

  const spire = createOutlinedMesh(new THREE.ConeGeometry(1.55, 3.4, 4), registerSeasonalMat(0x475666, 0xdce8f5), 0.05);
  spire.position.set(0, h + 4.75, 0.4);
  spire.rotation.y = Math.PI / 4;
  g.add(spire);

  const pole = createOutlinedMesh(new THREE.CylinderGeometry(0.07, 0.09, 4.6, 6), trimWhiteMat, 0.02, false);
  pole.position.set(4.6, 2.3, d * 0.5 + 1.1);
  g.add(pole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 0.62), flagMat);
  flag.position.set(5.0, 4.3, d * 0.5 + 1.1);
  g.add(flag);

  g.userData.lightSpecs = { width: w * 0.92, yPos: h + 0.55, zFront: d * 0.5 + 0.35 };
  return g;
}

function buildChristmasTownCenterpiece() {
  // De grote dorpsspar staat op het groen tussen het stadje en het meer.
  // Het hele jaar een flinke spar; in de winter met ballen, slinger, ster en cadeaus.
  const treeX = XMAS_TREE_POS.x;
  const treeZ = XMAS_TREE_POS.z;
  const baseY = getTerrainHeight(treeX, treeZ) - 0.05;

  const treeGroup = new THREE.Group();
  treeGroup.position.set(treeX, baseY, treeZ);
  scene.add(treeGroup);
  const decoGroup = new THREE.Group();
  decoGroup.position.set(treeX, baseY, treeZ);
  christmasGroup.add(decoGroup);

  const trunk = createOutlinedMesh(new THREE.CylinderGeometry(0.42, 0.62, 2.1, 8), makeToonMat(0x6b3f28), 0.05);
  trunk.position.y = 1.05;
  treeGroup.add(trunk);

  const spruceMat = makeToonMat(0x255e3a);
  const snowLayerMat = makeToonMat(0xf5faff);

  for (let tier = 0; tier < 5; tier++) {
    const r = 2.9 - tier * 0.48;
    const h = 2.5 - tier * 0.24;
    const y = 2.15 + tier * 1.55;
    const cone = createOutlinedMesh(new THREE.ConeGeometry(r, h, 9), spruceMat, 0.05);
    cone.position.y = y;
    treeGroup.add(cone);

    const snowSkirt = createOutlinedMesh(new THREE.ConeGeometry(r * 0.92, h * 0.45, 9), snowLayerMat, 0.04, false);
    snowSkirt.position.y = y + h * 0.26;
    snowSkirt.visible = false;
    treeGroup.add(snowSkirt);
    pineSnowCapObjects.push(snowSkirt);

    const ornaments = 9 - tier;
    for (let o = 0; o < ornaments; o++) {
      const ang = (o / ornaments) * Math.PI * 2 + tier * 0.5;
      const orbR = r * 0.84;
      const orb = new THREE.Mesh(bulbGeo, xmasBulbMats[(o + tier) % xmasBulbMats.length]);
      orb.scale.setScalar(1.3);
      orb.position.set(Math.cos(ang) * orbR, y - h * 0.28, Math.sin(ang) * orbR);
      decoGroup.add(orb);
    }
  }

  // Gouden slinger die in een spiraal om de boom loopt
  for (let k = 0; k < 70; k++) {
    const t = k / 70;
    const y = 1.6 + t * 7.4;
    const r = THREE.MathUtils.lerp(2.75, 0.55, t) * 0.92;
    const a = t * Math.PI * 2 * 3.2;
    const bead = new THREE.Mesh(bulbGeo, garlandMat);
    bead.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
    decoGroup.add(bead);
  }

  const star = createOutlinedMesh(
    new THREE.OctahedronGeometry(0.72, 0),
    new THREE.MeshBasicMaterial({ color: 0xffe45e }),
    0.045,
    false,
    false
  );
  star.position.y = 9.75;
  decoGroup.add(star);
  giantStarMesh = star;

  // Cadeaus onder de boom
  const giftColors = [0xd62839, 0x2d6e3e, 0x3f78a8, 0xffd23f, 0xc94a8a, 0xf6f2ea];
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2 + 0.3;
    const sz = 0.55 + (k % 3) * 0.2;
    const gift = createOutlinedMesh(new THREE.BoxGeometry(sz, sz * 0.8, sz), makeToonMat(giftColors[k % giftColors.length]), 0.025);
    gift.position.set(Math.cos(a) * 3.3, sz * 0.4, Math.sin(a) * 3.3);
    gift.rotation.y = a;
    decoGroup.add(gift);
    const ribbonA = new THREE.Mesh(new THREE.BoxGeometry(sz + 0.02, sz * 0.82, 0.1), ribbonMat);
    ribbonA.position.copy(gift.position);
    ribbonA.rotation.y = a;
    decoGroup.add(ribbonA);
    const ribbonB = ribbonA.clone();
    ribbonB.rotation.y = a + Math.PI * 0.5;
    decoGroup.add(ribbonB);
  }

  // Zuurstokken in een kring rondom het plein
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    const cane = new THREE.Group();
    const stick = createOutlinedMesh(new THREE.CylinderGeometry(0.12, 0.12, 2.0, 8), caneWhiteMat, 0.02, false);
    stick.position.y = 1.0;
    cane.add(stick);
    for (let s = 0; s < 5; s++) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.125, 0.04, 4, 10), caneRedMat);
      band.rotation.x = Math.PI * 0.5 + 0.35;
      band.position.y = 0.25 + s * 0.38;
      cane.add(band);
    }
    const hook = createOutlinedMesh(new THREE.TorusGeometry(0.3, 0.12, 6, 12, Math.PI), caneRedMat, 0.02, false);
    hook.position.set(0.3, 2.0, 0);
    cane.add(hook);
    cane.position.set(Math.cos(a) * 7.0, 0, Math.sin(a) * 7.0);
    cane.rotation.y = -a;
    decoGroup.add(cane);
  }

  hardColliders.push({ x: treeX, z: treeZ, r: 3.0 });
}

// =========================================================
// HULPFUNCTIES VOOR AANEENGESLOTEN GEVELRIJEN
// =========================================================
function placeShopHelper(x, z, rotY, w, h, d, wall, awn, trim) {
  const shop = createAttachedShop(w, h, d, wall, awn, trim);
  shop.position.set(x, TOWN_ELEV + 0.14, z);
  shop.rotation.y = rotY;
  scene.add(shop);
  hardColliders.push({ x, z, r: Math.min(w, d) * 0.48 });
  addRoofStringLights(shop, shop.userData.lightSpecs.width, shop.userData.lightSpecs.yPos, shop.userData.lightSpecs.zFront);
}

function placeRowHouseHelper(x, z, rotY, w, h, d, color, altRoof = false) {
  const house = createRowTownHouse(w, h, d, color, altRoof);
  house.position.set(x, TOWN_ELEV + 0.14, z);
  house.rotation.y = rotY;
  scene.add(house);
  hardColliders.push({ x, z, r: Math.min(w, d) * 0.48 });
  addRoofStringLights(house, house.userData.lightSpecs.width, house.userData.lightSpecs.yPos, house.userData.lightSpecs.zFront);

  if (house.userData.chimneyTop) {
    house.updateMatrixWorld(true);
    chimneySmokes.push({
      origin: house.userData.chimneyTop.clone().applyMatrix4(house.matrixWorld),
      timer: Math.random() * 2
    });
  }
}

// =========================================================
// OPBOUW PINEWOOD CREEK CENTRUM
// =========================================================
function buildPinewoodTown() {
  const sidewalkTopY = TOWN_ELEV + 0.14;
  const SW = 2.0;

  createSeamlessBlockBase(-23.95, -4.05, 84.75, 107.95, SW, courtyardPaverMat);
  placeCornerLamps(-23.95, -4.05, 84.75, 107.95, 1.0);

  const swMainShops = [
    { x: -19.9625, w: 3.975, h: 6.2, wall: 0xd96b43, awn: 0xfff3de, trim: 0x6e3824 },
    { x: -15.9875, w: 3.975, h: 5.3, wall: 0x6289a6, awn: 0xe69f38, trim: 0x385063 },
    { x: -12.0125, w: 3.975, h: 6.8, wall: 0xebdcd0, awn: 0xd64535, trim: 0xb83b2b },
    { x: -8.0375,  w: 3.975, h: 5.7, wall: 0x73946b, awn: 0xf5ead3, trim: 0x3f5939 }
  ];
  swMainShops.forEach((s) => placeShopHelper(s.x, 89.85, Math.PI, s.w, s.h, 6.2, s.wall, s.awn, s.trim));

  placeShopHelper(-8.75, 94.8, Math.PI / 2, 3.7, 5.4, 5.4, 0xd49a45, 0x385063, 0x7a521d);
  placeShopHelper(-8.75, 98.5, Math.PI / 2, 3.7, 5.9, 5.4, 0xb85242, 0xfff3de, 0x6b281e);

  placeShopHelper(-19.25, 94.8, -Math.PI / 2, 3.7, 5.6, 5.4, 0x5c7d99, 0xd95d30, 0x2e4354);
  placeShopHelper(-19.25, 98.5, -Math.PI / 2, 3.7, 5.1, 5.4, 0xc98b63, 0x2d6e3e, 0x6e4429);

  const swOakHouses = [
    { x: -19.9625, c: 0x9ab06a, alt: false },
    { x: -15.9875, c: 0xd8a948, alt: true },
    { x: -12.0125, c: 0xb84a39, alt: false },
    { x: -8.0375,  c: 0x6792ab, alt: true }
  ];
  swOakHouses.forEach((h) => placeRowHouseHelper(h.x, 102.725, 0, 3.975, 4.4, 4.75, h.c, h.alt));

  createSeamlessBlockBase(4.05, 23.95, 84.75, 107.95, SW, plazaTileMat);
  placeCornerLamps(4.05, 23.95, 84.75, 107.95, 1.0);

  const fountain = createFountain();
  fountain.position.set(14.0, sidewalkTopY, 92.6);
  scene.add(fountain);
  hardColliders.push({ x: 14.0, z: 92.6, r: 2.55 });

  [
    [14.0, 88.7, 0],
    [14.0, 96.5, Math.PI],
    [9.4,  91.2, Math.PI / 2],
    [9.4,  94.0, Math.PI / 2],
    [18.6, 91.2, -Math.PI / 2],
    [18.6, 94.0, -Math.PI / 2]
  ].forEach(([bx, bz, rot]) => createBench(bx, bz, rot));

  [
    [7.4,  88.4],
    [20.6, 88.4],
    [7.4,  93.2],
    [20.6, 93.2],
    [7.4,  98.0],
    [20.6, 98.0]
  ].forEach(([tx, tz]) => {
    const pTree = createPlazaGrateTree();
    pTree.position.set(tx, sidewalkTopY, tz);
    scene.add(pTree);
    hardColliders.push({ x: tx, z: tz, r: 0.65 });
  });

  const townHall = createGemeentehuis();
  townHall.position.set(14.0, sidewalkTopY, 103.0);
  townHall.rotation.y = Math.PI;
  scene.add(townHall);
  hardColliders.push({ x: 10.8, z: 103.0, r: 2.9 });
  hardColliders.push({ x: 14.0, z: 103.0, r: 3.0 });
  hardColliders.push({ x: 17.2, z: 103.0, r: 2.9 });
  addRoofStringLights(townHall, townHall.userData.lightSpecs.width, townHall.userData.lightSpecs.yPos, townHall.userData.lightSpecs.zFront);

  createSeamlessBlockBase(-23.95, -4.05, 116.05, 134.85, SW, courtyardPaverMat);
  placeCornerLamps(-23.95, -4.05, 116.05, 134.85, 1.0);

  const nwOakShops = [
    { x: -19.9625, w: 3.975, h: 5.5, wall: 0xc45a41, awn: 0xf7ebd2, trim: 0x6e2b1c },
    { x: -15.9875, w: 3.975, h: 6.3, wall: 0x4f758c, awn: 0xf4b41a, trim: 0x2b4352 },
    { x: -12.0125, w: 3.975, h: 5.2, wall: 0xe3cfa8, awn: 0x2d6e3e, trim: 0x7a6542 },
    { x: -8.0375,  w: 3.975, h: 6.0, wall: 0x8c584c, awn: 0xfff3de, trim: 0x4a2a22 }
  ];
  nwOakShops.forEach((s) => placeShopHelper(s.x, 121.05, Math.PI, s.w, s.h, 6.0, s.wall, s.awn, s.trim));

  placeRowHouseHelper(-18.6, 126.4, -Math.PI / 2, 4.3, 4.5, 5.0, 0xe6a147, false);
  placeRowHouseHelper(-18.6, 130.7, -Math.PI / 2, 4.3, 4.2, 5.0, 0x84a876, true);

  placeRowHouseHelper(-9.4, 126.4, Math.PI / 2, 4.3, 4.3, 5.0, 0x5b83a1, true);
  placeRowHouseHelper(-9.4, 130.7, Math.PI / 2, 4.3, 4.6, 5.0, 0xd66853, false);

  createSeamlessBlockBase(4.05, 23.95, 116.05, 134.85, SW, courtyardPaverMat);
  placeCornerLamps(4.05, 23.95, 116.05, 134.85, 1.0);

  placeShopHelper(8.0375,  121.05, Math.PI, 3.975, 6.4, 6.0, 0x3f6a82, 0xe69f38, 0x233d4d);
  placeShopHelper(12.0125, 121.05, Math.PI, 3.975, 5.6, 6.0, 0xd97b48, 0xfff3de, 0x753c1d);
  placeRowHouseHelper(15.9875, 121.4, Math.PI, 3.975, 4.7, 5.0, 0xe3b857, false);
  placeRowHouseHelper(19.9625, 121.4, Math.PI, 3.975, 4.4, 5.0, 0x7a9e7e, true);

  placeRowHouseHelper(9.4, 126.4, -Math.PI / 2, 4.3, 4.4, 5.0, 0xc9966b, false);
  placeRowHouseHelper(9.4, 130.7, -Math.PI / 2, 4.3, 4.6, 5.0, 0x9ab06a, true);

  placeRowHouseHelper(18.6, 126.4, Math.PI / 2, 4.3, 4.5, 5.0, 0xb84a39, true);
  placeRowHouseHelper(18.6, 130.7, Math.PI / 2, 4.3, 4.2, 5.0, 0x5b83a1, false);

  createSeamlessBlockBase(-42.6, -32.05, 84.75, 116.1, SW, courtyardPaverMat);
  placeCornerLamps(-42.6, -32.05, 84.75, 116.1, 1.0);

  placeShopHelper(-37.05, 89.05,  Math.PI / 2, 4.6, 5.8, 6.0, 0xc9643b, 0xfff3de, 0x6b2f18);
  placeShopHelper(-37.05, 93.65,  Math.PI / 2, 4.6, 5.2, 6.0, 0x567d65, 0xf4b41a, 0x2d4536);
  placeRowHouseHelper(-37.4, 98.2,  Math.PI / 2, 4.5, 4.4, 5.0, 0xe3b857, false);
  placeRowHouseHelper(-37.4, 102.7, Math.PI / 2, 4.5, 4.6, 5.0, 0x6792ab, true);
  placeRowHouseHelper(-37.4, 107.2, Math.PI / 2, 4.5, 4.3, 5.0, 0xd66853, false);
  placeRowHouseHelper(-37.4, 111.7, Math.PI / 2, 4.5, 4.5, 5.0, 0x9ab06a, true);

  createSeamlessBlockBase(32.05, 42.6, 84.75, 116.1, SW, courtyardPaverMat);
  placeCornerLamps(32.05, 42.6, 84.75, 116.1, 1.0);

  placeShopHelper(37.05, 89.05,  -Math.PI / 2, 4.6, 6.0, 6.0, 0x4d728f, 0xd95d30, 0x293f52);
  placeShopHelper(37.05, 93.65,  -Math.PI / 2, 4.6, 5.3, 6.0, 0xd49a45, 0xfff3de, 0x73501c);
  placeRowHouseHelper(37.4, 98.2,  -Math.PI / 2, 4.5, 4.5, 5.0, 0x7a9e7e, true);
  placeRowHouseHelper(37.4, 102.7, -Math.PI / 2, 4.5, 4.3, 5.0, 0xc9966b, false);
  placeRowHouseHelper(37.4, 107.2, -Math.PI / 2, 4.5, 4.6, 5.0, 0xb84a39, true);
  placeRowHouseHelper(37.4, 111.7, -Math.PI / 2, 4.5, 4.4, 5.0, 0xd8a948, false);

  [
    [-14.0, 85.95],
    [10.5,  85.95],
    [-14.0, 107.0],
    [19.5,  107.0],
    [-14.0, 117.0],
    [14.0,  117.0],
    [-5.0,  96.5],
    [5.0,   96.5],
    [-33.0, 100.5],
    [33.0,  100.5]
  ].forEach(([hx, hz]) => createSmashableHydrant(hx, hz));

  [
    [-18.0, 86.05],
    [-10.0, 86.05],
    [11.8,  86.05],
    [16.2,  86.05],
    [-23.0, 96.5],
    [23.0,  96.5],
    [-10.0, 107.0],
    [-10.0, 117.0],
    [10.0,  117.0],
    [-5.0,  125.0],
    [-33.0, 91.5],
    [33.0,  109.5]
  ].forEach(([tx, tz]) => createTrashBin(tx, tz));

  buildChristmasTownCenterpiece();
}
buildPinewoodTown();

// =========================================================
// GROTE SUPERMARKT + PINEWOOD MALL & PARKEERPLAATS (18 VAKKEN + BOMEN)
// =========================================================
function rotateLocal(lx, lz, yaw) {
  const s = Math.sin(yaw);
  const c = Math.cos(yaw);
  return { x: lx * c + lz * s, z: -lx * s + lz * c };
}

let mallExclusionZone = null;

function createSupermarketWing() {
  const g = new THREE.Group();
  const w = 11.4, h = 5.8, d = 8.8;

  const body = createOutlinedMesh(new THREE.BoxGeometry(w, h, d), makeToonMat(0xf5efe6), 0.055);
  body.position.y = h * 0.5;
  g.add(body);

  const fascia = createOutlinedMesh(new THREE.BoxGeometry(w + 0.1, 1.15, d + 0.16), makeToonMat(0x2d8a4e), 0.045, false);
  fascia.position.y = h - 0.35;
  g.add(fascia);

  const accent = new THREE.Mesh(new THREE.BoxGeometry(w + 0.14, 0.22, d + 0.2), makeToonMat(0xf4b41a));
  accent.position.y = h - 0.98;
  g.add(accent);

  const signBoard = createOutlinedMesh(new THREE.BoxGeometry(7.0, 0.95, 0.24), trimWhiteMat, 0.035, false);
  signBoard.position.set(0, h + 0.38, d * 0.5 - 0.15);
  g.add(signBoard);

  const canopy = createOutlinedMesh(new THREE.BoxGeometry(5.4, 0.26, 1.55), makeToonMat(0x236e3d), 0.038, false);
  canopy.position.set(0, 2.85, d * 0.5 + 0.72);
  g.add(canopy);

  const slidingDoorFrame = createOutlinedMesh(new THREE.BoxGeometry(3.2, 2.55, 0.16), streetPostMat, 0.03, false);
  slidingDoorFrame.position.set(0, 1.28, d * 0.5 + 0.05);
  g.add(slidingDoorFrame);

  [-0.74, 0.74].forEach((dx) => {
    const doorGlass = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 2.3), warmWindowMat);
    doorGlass.position.set(dx, 1.28, d * 0.5 + 0.15);
    g.add(doorGlass);
    houseWindows.push({ mesh: doorGlass, timer: Math.random() * 10 });
  });

  [-3.6, 3.6].forEach((wx) => {
    const shopWin = new THREE.Mesh(new THREE.PlaneGeometry(2.85, 2.1), warmWindowMat);
    shopWin.position.set(wx, 1.65, d * 0.5 + 0.07);
    g.add(shopWin);
    houseWindows.push({ mesh: shopWin, timer: Math.random() * 10 });
  });

  g.userData.lightSpecs = { width: w * 0.94, yPos: h + 0.2, zFront: d * 0.5 + 0.2 };
  return g;
}

function createMallAtriumCenter() {
  const g = new THREE.Group();
  const w = 10.8, h = 8.8, d = 9.4;

  const body = createOutlinedMesh(new THREE.BoxGeometry(w, h, d), makeToonMat(0xfaf4ea), 0.06);
  body.position.y = h * 0.5;
  g.add(body);

  const domeRoof = createOutlinedMesh(
    new THREE.CylinderGeometry(3.5, 3.5, d - 0.6, 12, 1, false, 0, Math.PI),
    registerSeasonalMat(0x4b6b88, 0xdce8f5),
    0.05
  );
  domeRoof.rotation.z = Math.PI * 0.5;
  domeRoof.rotation.y = Math.PI * 0.5;
  domeRoof.position.y = h;
  g.add(domeRoof);

  const crown = createOutlinedMesh(new THREE.BoxGeometry(w + 0.2, 0.95, 0.6), registerSeasonalMat(0xc9643b, 0xeef4fa), 0.045, false);
  crown.position.set(0, h + 0.35, d * 0.5 - 0.15);
  g.add(crown);

  const mallSign = createOutlinedMesh(new THREE.BoxGeometry(7.6, 1.18, 0.28), trimWhiteMat, 0.04, false);
  mallSign.position.set(0, h - 0.85, d * 0.5 + 0.14);
  g.add(mallSign);

  [-2.6, 0, 2.6].forEach((gx) => {
    [2.15, 5.5].forEach((gy) => {
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 2.5), warmWindowMat);
      pane.position.set(gx, gy, d * 0.5 + 0.08);
      g.add(pane);
      houseWindows.push({ mesh: pane, timer: Math.random() * 10 });
    });
  });

  [-4.3, -1.3, 1.3, 4.3].forEach((px) => {
    const pilaster = createOutlinedMesh(new THREE.BoxGeometry(0.32, h - 1.4, 0.26), trimWhiteMat, 0.03, false);
    pilaster.position.set(px, (h - 1.4) * 0.5 + 0.2, d * 0.5 + 0.1);
    g.add(pilaster);
  });

  const marquee = createOutlinedMesh(new THREE.BoxGeometry(7.4, 0.32, 1.75), makeToonMat(0xc9643b), 0.04, false);
  marquee.position.set(0, 3.15, d * 0.5 + 0.82);
  g.add(marquee);

  const mainDoors = createOutlinedMesh(new THREE.BoxGeometry(3.5, 2.6, 0.18), makeToonMat(0x4a3528), 0.03, false);
  mainDoors.position.set(0, 1.3, d * 0.5 + 0.06);
  g.add(mainDoors);

  g.userData.lightSpecs = { width: w * 0.94, yPos: h + 0.6, zFront: d * 0.5 + 0.25 };
  return g;
}

function createMallRetailWing() {
  const g = new THREE.Group();
  const w = 11.4, h = 7.0, d = 8.8;

  const body = createOutlinedMesh(new THREE.BoxGeometry(w, h, d), makeToonMat(0xe8d8c5), 0.055);
  body.position.y = h * 0.5;
  g.add(body);

  const parapet = createOutlinedMesh(new THREE.BoxGeometry(w + 0.1, 0.75, d + 0.16), registerSeasonalMat(0x52657a, 0xeef4fa), 0.045, false);
  parapet.position.y = h + 0.25;
  g.add(parapet);

  [
    { x: -2.85, awn: 0xd95d30 },
    { x: 2.85,  awn: 0x3b7ea1 }
  ].forEach((bt) => {
    const awning = createOutlinedMesh(new THREE.BoxGeometry(4.5, 0.22, 1.3), makeToonMat(bt.awn), 0.035, false);
    awning.position.set(bt.x, 2.75, d * 0.5 + 0.58);
    awning.rotation.x = 0.24;
    g.add(awning);

    const lowerWin = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 1.85), warmWindowMat);
    lowerWin.position.set(bt.x, 1.55, d * 0.5 + 0.07);
    g.add(lowerWin);
    houseWindows.push({ mesh: lowerWin, timer: Math.random() * 10 });

    const upperWin = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 1.55), warmWindowMat);
    upperWin.position.set(bt.x, 4.85, d * 0.5 + 0.07);
    g.add(upperWin);
    houseWindows.push({ mesh: upperWin, timer: Math.random() * 10 });
  });

  const hvac = createOutlinedMesh(new THREE.BoxGeometry(2.4, 0.9, 1.8), stoneMat, 0.03, false);
  hvac.position.set(2.2, h + 0.85, -1.2);
  g.add(hvac);

  g.userData.lightSpecs = { width: w * 0.94, yPos: h + 0.45, zFront: d * 0.5 + 0.2 };
  return g;
}

function buildGeneralStore() {
  const lot = ruralLots.find((l) => l.type === 'store');
  if (!lot) return;
  const { x: baseX, y: baseY, z: baseZ, yaw } = lot;

  const surfaceY = lot.roadY - 0.02;
  const slabDepthH = 3.2;

  mallExclusionZone = { baseX, baseZ, yaw };

  const complexGroup = new THREE.Group();
  complexGroup.position.set(baseX, surfaceY, baseZ);
  complexGroup.rotation.y = yaw;
  scene.add(complexGroup);

  const pad = new THREE.Mesh(new THREE.BoxGeometry(33.6, slabDepthH, 19.6), storeAsphaltMat);
  pad.position.set(0, -slabDepthH * 0.5, 9.8);
  pad.receiveShadow = true;
  complexGroup.add(pad);

  const promenade = createOutlinedMesh(new THREE.BoxGeometry(34.2, slabDepthH + 0.16, 2.3), sidewalkMat, 0.042, false, true);
  promenade.position.set(0, -slabDepthH * 0.5 + 0.08, -1.15);
  complexGroup.add(promenade);

  const mallPlinth = createOutlinedMesh(new THREE.BoxGeometry(34.2, slabDepthH + 0.16, 9.8), stoneMat, 0.04, false, true);
  mallPlinth.position.set(0, -slabDepthH * 0.5 + 0.08, -7.2);
  complexGroup.add(mallPlinth);

  const superWing = createSupermarketWing();
  superWing.position.set(-11.1, 0.16, -2.3 - 4.4);
  complexGroup.add(superWing);

  const atrium = createMallAtriumCenter();
  atrium.position.set(0, 0.16, -2.3 - 4.7);
  complexGroup.add(atrium);

  const retailWing = createMallRetailWing();
  retailWing.position.set(11.1, 0.16, -2.3 - 4.4);
  complexGroup.add(retailWing);

  const cartBay = createOutlinedMesh(new THREE.BoxGeometry(2.6, 1.3, 1.2), trimWhiteMat, 0.025, false);
  cartBay.position.set(-15.3, 0.81, -1.15);
  complexGroup.add(cartBay);

  complexGroup.updateMatrixWorld(true);
  [superWing, atrium, retailWing].forEach((wing) => {
    addRoofStringLights(wing, wing.userData.lightSpecs.width, wing.userData.lightSpecs.yPos, wing.userData.lightSpecs.zFront);
  });

  [-13.8, -8.2, -2.7, 2.7, 8.2, 13.8].forEach((cx) => {
    const wc = rotateLocal(cx, -6.8, yaw);
    hardColliders.push({ x: baseX + wc.x, z: baseZ + wc.z, r: 4.35 });
  });

  const bayWidth = 2.35;
  const bayDepth = 3.8;
  const stripeGeo = new THREE.PlaneGeometry(0.16, bayDepth);
  const stopGeo = new THREE.BoxGeometry(1.55, 0.1, 0.22);

  function addParkingRow(xCenters, rowZ, stopOffsetZ) {
    const lineXs = [];
    xCenters.forEach((cx, idx) => {
      if (idx === 0 || Math.abs(cx - xCenters[idx - 1] - bayWidth) > 0.2) {
        lineXs.push(cx - bayWidth * 0.5);
      }
      lineXs.push(cx + bayWidth * 0.5);

      const stop = new THREE.Mesh(stopGeo, wheelStopMat);
      stop.position.set(cx, 0.05, rowZ + stopOffsetZ);
      complexGroup.add(stop);
    });

    lineXs.forEach((lx) => {
      const stripe = new THREE.Mesh(stripeGeo, storeLineMat);
      stripe.rotation.x = -Math.PI * 0.5;
      stripe.position.set(lx, 0.015, rowZ);
      complexGroup.add(stripe);
    });
  }

  addParkingRow([-13.2, -10.85, -8.5, -6.15, -3.8, 3.8, 6.15, 8.5, 10.85, 13.2], 10.8, 1.5);
  addParkingRow([-12.0, -9.65, -7.3, -4.95, 4.95, 7.3, 9.65, 12.0], 2.2, -1.5);

  [
    [-15.3, 10.8],
    [15.3,  10.8],
    [-14.6, 2.2],
    [-2.4,  2.2],
    [2.4,   2.2],
    [14.6,  2.2]
  ].forEach(([tx, tz]) => {
    const island = createParkingIslandTree(1.9);
    island.position.set(tx, 0, tz);
    complexGroup.add(island);
    const wp = rotateLocal(tx, tz, yaw);
    hardColliders.push({ x: baseX + wp.x, z: baseZ + wp.z, r: 0.95 });
  });

  const promY = surfaceY + 0.16;
  [-15.8, -5.4, 5.4, 15.8].forEach((lx) => {
    const wp = rotateLocal(lx, -0.5, yaw);
    createSmashableStreetLampAt(baseX + wp.x, promY, baseZ + wp.z);
  });

  [-7.8, 7.8].forEach((lx) => {
    const wp = rotateLocal(lx, -1.5, yaw);
    createBenchAt(baseX + wp.x, promY, baseZ + wp.z, yaw);
  });

  [-13.0, -1.9, 13.0].forEach((lx) => {
    const wp = rotateLocal(lx, -0.6, yaw);
    createTrashBinAt(baseX + wp.x, promY, baseZ + wp.z);
  });
}
buildGeneralStore();

// =========================================================
// FASTFOOD-DINER LANGS DE STRANDBOULEVARD: hoge reclamezuil, rood-witte luifel,
// reuzenburger op het dak, drive-thru en een handvol parkeervakken
// =========================================================
function makeDinerSignTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#d62839';
  ctx.fillRect(0, 0, 512, 256);
  ctx.strokeStyle = '#ffd23f';
  ctx.lineWidth = 18;
  ctx.strokeRect(9, 9, 494, 238);
  ctx.fillStyle = '#fffaf0';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'italic 900 128px system-ui, sans-serif';
  ctx.fillText('DINER', 256, 110);
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 34px system-ui, sans-serif';
  ctx.fillText('BURGERS · FRIES · SHAKES', 256, 205);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function makeOpenSignTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#1b2a3a';
  ctx.fillRect(0, 0, 256, 128);
  ctx.fillStyle = '#5ef2d6';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 54px system-ui, sans-serif';
  ctx.fillText('OPEN 24/7', 128, 66);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

const dinerCreamMat = makeToonMat(0xfdf6e3);
const dinerRedMat = makeToonMat(0xd62839);
const dinerChromeMat = makeToonMat(0xcfd8dc);
const dinerTealRoofMat = registerSeasonalMat(0x2bb3a3, 0xf2f6fb);
const dinerYellowMat = makeToonMat(0xffd23f);
const bunMat = makeToonMat(0xe0a04a);
const pattyMat = makeToonMat(0x5a3220);
const lettuceMat = makeToonMat(0x6cc04a);
const cheeseMat = makeToonMat(0xffc83d);

function createDinerBuilding() {
  const g = new THREE.Group();
  const w = 15.0, h = 4.0, d = 8.0;

  const body = createOutlinedMesh(new THREE.BoxGeometry(w, h, d), dinerCreamMat, 0.055);
  body.position.y = h * 0.5;
  g.add(body);

  const kick = createOutlinedMesh(new THREE.BoxGeometry(w + 0.12, 0.95, d + 0.12), dinerRedMat, 0.04, false);
  kick.position.y = 0.48;
  g.add(kick);

  const chrome = new THREE.Mesh(new THREE.BoxGeometry(w + 0.18, 0.2, d + 0.18), dinerChromeMat);
  chrome.position.y = 1.05;
  g.add(chrome);
  const chromeTop = new THREE.Mesh(new THREE.BoxGeometry(w + 0.18, 0.2, d + 0.18), dinerRedMat);
  chromeTop.position.y = 3.25;
  g.add(chromeTop);

  // Grote ramen rondom de voorkant (lichtgevend 's nachts)
  [-5.0, -1.7, 1.7, 5.0].forEach((wx, i) => {
    if (i === 1 || i === 2) {
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.85), warmWindowMat);
      pane.position.set(wx + (i === 1 ? -0.4 : 0.4), 2.15, d * 0.5 + 0.06);
      g.add(pane);
      houseWindows.push({ mesh: pane, timer: Math.random() * 10 });
    } else {
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.85), warmWindowMat);
      pane.position.set(wx, 2.15, d * 0.5 + 0.06);
      g.add(pane);
      houseWindows.push({ mesh: pane, timer: Math.random() * 10 });
    }
  });
  [-1, 1].forEach((side) => {
    const sidePane = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.85), warmWindowMat);
    sidePane.position.set(side * (w * 0.5 + 0.06), 2.15, 0.6);
    sidePane.rotation.y = side * Math.PI * 0.5;
    g.add(sidePane);
    houseWindows.push({ mesh: sidePane, timer: Math.random() * 10 });
  });

  // Glazen deur met chromen kader in het midden
  const doorFrame = createOutlinedMesh(new THREE.BoxGeometry(1.6, 2.6, 0.16), dinerChromeMat, 0.03, false);
  doorFrame.position.set(0, 1.3, d * 0.5 + 0.05);
  g.add(doorFrame);
  const doorGlass = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 2.3), warmWindowMat);
  doorGlass.position.set(0, 1.3, d * 0.5 + 0.15);
  g.add(doorGlass);

  // Overstekend plat dak
  const roof = createOutlinedMesh(new THREE.BoxGeometry(w + 1.4, 0.4, d + 1.6), dinerTealRoofMat, 0.045);
  roof.position.y = h + 0.2;
  g.add(roof);

  // Rood-wit gestreepte luifel over de ramen
  const stripes = 12;
  for (let k = 0; k < stripes; k++) {
    const sw = (w - 0.6) / stripes;
    const stripe = createOutlinedMesh(new THREE.BoxGeometry(sw, 0.14, 1.5), k % 2 === 0 ? dinerRedMat : dinerCreamMat, 0.02, false);
    stripe.position.set(-w * 0.5 + 0.3 + sw * (k + 0.5), 3.45, d * 0.5 + 0.7);
    stripe.rotation.x = 0.32;
    g.add(stripe);
  }

  // Reuzenburger op het dak
  const burger = new THREE.Group();
  const bottomBun = createOutlinedMesh(new THREE.CylinderGeometry(1.5, 1.4, 0.5, 14), bunMat, 0.04);
  bottomBun.position.y = 0.25;
  burger.add(bottomBun);
  const patty = createOutlinedMesh(new THREE.CylinderGeometry(1.62, 1.62, 0.42, 14), pattyMat, 0.04);
  patty.position.y = 0.71;
  burger.add(patty);
  const cheese = createOutlinedMesh(new THREE.BoxGeometry(2.7, 0.1, 2.7), cheeseMat, 0.02, false);
  cheese.position.y = 0.96;
  cheese.rotation.y = Math.PI / 4;
  burger.add(cheese);
  const lettuce = createOutlinedMesh(new THREE.CylinderGeometry(1.75, 1.7, 0.16, 14), lettuceMat, 0.03, false);
  lettuce.position.y = 1.08;
  burger.add(lettuce);
  const topBun = createOutlinedMesh(new THREE.SphereGeometry(1.55, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), bunMat, 0.045);
  topBun.position.y = 1.16;
  topBun.scale.y = 0.85;
  burger.add(topBun);
  burger.position.set(3.6, h + 0.4, -0.6);
  g.add(burger);

  // Klein "OPEN 24/7" bordje boven de deur
  const openSign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.95), new THREE.MeshBasicMaterial({ map: makeOpenSignTexture() }));
  openSign.position.set(-3.8, h + 0.95, d * 0.5 + 0.55);
  g.add(openSign);
  const openBack = createOutlinedMesh(new THREE.BoxGeometry(2.55, 1.08, 0.12), dinerChromeMat, 0.025, false);
  openBack.position.set(-3.8, h + 0.95, d * 0.5 + 0.47);
  g.add(openBack);

  g.userData.lightSpecs = { width: w * 0.94, yPos: h + 0.45, zFront: d * 0.5 + 0.85 };
  return g;
}

function createDinerPylon() {
  const g = new THREE.Group();
  [-1.6, 1.6].forEach((px) => {
    const pole = createOutlinedMesh(new THREE.BoxGeometry(0.45, 9.0, 0.45), dinerRedMat, 0.035);
    pole.position.set(px, 4.5, 0);
    g.add(pole);
  });
  const signMat = new THREE.MeshBasicMaterial({ map: makeDinerSignTexture() });
  const board = createOutlinedMesh(new THREE.BoxGeometry(6.4, 3.2, 0.45), dinerRedMat, 0.05, false);
  board.position.y = 7.6;
  g.add(board);
  [1, -1].forEach((side) => {
    const face = new THREE.Mesh(new THREE.PlaneGeometry(6.1, 2.95), signMat);
    face.position.set(0, 7.6, side * 0.24);
    if (side < 0) face.rotation.y = Math.PI;
    g.add(face);
  });
  // Gele pijl bovenop, typisch Amerikaans
  const arrow = createOutlinedMesh(new THREE.ConeGeometry(0.9, 1.6, 4), dinerYellowMat, 0.035, false);
  arrow.position.set(0, 9.9, 0);
  arrow.rotation.y = Math.PI / 4;
  g.add(arrow);
  const ring = createOutlinedMesh(new THREE.TorusGeometry(0.7, 0.12, 6, 16), dinerYellowMat, 0.02, false);
  ring.position.set(0, 9.2, 0);
  g.add(ring);
  return g;
}

function createDriveThruMenu() {
  const g = new THREE.Group();
  const post = createOutlinedMesh(new THREE.BoxGeometry(0.2, 1.6, 0.2), streetPostMat, 0.02, false);
  post.position.y = 0.8;
  g.add(post);
  const board = createOutlinedMesh(new THREE.BoxGeometry(1.8, 1.1, 0.18), dinerRedMat, 0.03, false);
  board.position.y = 1.9;
  g.add(board);
  const menu = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 0.85), dinerYellowMat);
  menu.position.set(0, 1.9, 0.1);
  g.add(menu);
  return g;
}

function buildRoadsideDiner() {
  const lot = ruralLots.find((l) => l.type === 'diner');
  if (!lot) return;
  const { x: baseX, z: baseZ, yaw } = lot;
  const surfaceY = lot.roadY - 0.02;
  const g = new THREE.Group();
  g.position.set(baseX, surfaceY, baseZ);
  g.rotation.y = yaw;
  scene.add(g);

  // Asfalt parkeerterrein tot aan de weg + stoep/plint rond het gebouw
  const roadEdgeLZ = lot.dist - 4.6;
  const slabH = 3.2;
  const padDepth = roadEdgeLZ + 2.0;
  const pad = new THREE.Mesh(new THREE.BoxGeometry(34, slabH, padDepth), storeAsphaltMat);
  pad.position.set(0, -slabH * 0.5, roadEdgeLZ - padDepth * 0.5);
  pad.receiveShadow = true;
  g.add(pad);
  const plinth = createOutlinedMesh(new THREE.BoxGeometry(19, slabH + 0.16, 11.5), sidewalkMat, 0.04, false, true);
  plinth.position.set(-1, -slabH * 0.5 + 0.08, -7.2);
  g.add(plinth);

  const building = createDinerBuilding();
  building.position.set(-1, 0.16, -7.5);
  g.add(building);

  // Reclamezuil aan de weg (bord dwars op de weg zodat je het van ver ziet aankomen)
  const pylon = createDinerPylon();
  pylon.position.set(-15.5, 0, roadEdgeLZ - 2.2);
  pylon.rotation.y = Math.PI * 0.5;
  g.add(pylon);

  const menuBoard = createDriveThruMenu();
  menuBoard.position.set(10.2, 0, -6.0);
  menuBoard.rotation.y = -Math.PI * 0.5;
  g.add(menuBoard);

  // Zes parkeervakken voor de deur
  const bayW = 2.5;
  const bayD = 4.0;
  const stripeGeo = new THREE.PlaneGeometry(0.16, bayD);
  const stopGeo = new THREE.BoxGeometry(1.55, 0.1, 0.22);
  const rowZ = 1.6;
  for (let k = 0; k <= 6; k++) {
    const lx = -8.5 + k * bayW;
    const stripe = new THREE.Mesh(stripeGeo, storeLineMat);
    stripe.rotation.x = -Math.PI * 0.5;
    stripe.position.set(lx, 0.02, rowZ);
    g.add(stripe);
    if (k < 6) {
      const stop = new THREE.Mesh(stopGeo, wheelStopMat);
      stop.position.set(lx + bayW * 0.5, 0.05, rowZ - bayD * 0.5 + 0.35);
      g.add(stop);
    }
  }

  // Picknicktafels naast de diner
  const tableMat = registerSeasonalMat(0xd62839, 0xf2f6fb);
  [[11.0, -11.0], [13.6, -8.0]].forEach(([tx, tz]) => {
    const top = createOutlinedMesh(new THREE.BoxGeometry(1.8, 0.12, 0.9), tableMat, 0.025, false);
    top.position.set(tx, 0.78, tz);
    g.add(top);
    [-0.65, 0.65].forEach((bz) => {
      const bench = createOutlinedMesh(new THREE.BoxGeometry(1.8, 0.1, 0.32), tableMat, 0.02, false);
      bench.position.set(tx, 0.45, tz + bz);
      g.add(bench);
    });
    const leg = createOutlinedMesh(new THREE.BoxGeometry(0.14, 0.76, 0.6), streetPostMat, 0.02, false);
    leg.position.set(tx, 0.38, tz);
    g.add(leg);
  });

  g.updateMatrixWorld(true);
  addRoofStringLights(building, building.userData.lightSpecs.width, building.userData.lightSpecs.yPos, building.userData.lightSpecs.zFront);

  const toWorld = (lx, lz) => {
    const w = rotateLocal(lx, lz, yaw);
    return { x: baseX + w.x, z: baseZ + w.z };
  };
  [-6, -1, 4].forEach((cx) => {
    const p = toWorld(cx, -7.5);
    hardColliders.push({ x: p.x, z: p.z, r: 4.2 });
  });
  const pp = toWorld(-15.5, roadEdgeLZ - 2.2);
  hardColliders.push({ x: pp.x, z: pp.z, r: 1.9 });
  const mp = toWorld(10.2, -6.0);
  hardColliders.push({ x: mp.x, z: mp.z, r: 0.6 });

  // Nachtgloed van het bord
  const glow = new THREE.PointLight(0xff6a4a, 0, 30, 1.6);
  glow.position.set(pp.x, surfaceY + 7.6, pp.z);
  scene.add(glow);
  dinerNightLights.push(glow);
}
export const dinerNightLights = [];
buildRoadsideDiner();


// =========================================================
// LANDELIJKE KAVELS BUITEN HET DORP
// =========================================================
function createLogCabin() {
  const g = new THREE.Group();
  const logMat = makeToonMat(0x8f5531);

  const plinth = createOutlinedMesh(new THREE.BoxGeometry(6.4, 0.45, 5.2), stoneMat, 0.04, false);
  plinth.position.y = 0.05;
  g.add(plinth);

  const box = createOutlinedMesh(new THREE.BoxGeometry(6.2, 3.1, 5.0), logMat, 0.06);
  box.position.y = 1.72;
  g.add(box);

  const rShape = new THREE.Shape();
  rShape.moveTo(-3.5, 0);
  rShape.lineTo(0, 2.15);
  rShape.lineTo(3.5, 0);
  rShape.closePath();
  const rGeo = new THREE.ExtrudeGeometry(rShape, { depth: 5.8, bevelEnabled: false });
  rGeo.translate(0, 0, -2.9);
  const roof = createOutlinedMesh(rGeo, cabinRoofMat, 0.06);
  roof.position.y = 3.22;
  g.add(roof);

  const porch = createOutlinedMesh(new THREE.BoxGeometry(6.2, 0.42, 2.1), logMat, 0.045, false);
  porch.position.set(0, 0.14, 3.45);
  g.add(porch);

  const pRoof = createOutlinedMesh(new THREE.BoxGeometry(6.4, 0.22, 2.4), cabinRoofMat, 0.045, false);
  pRoof.position.set(0, 2.7, 3.45);
  pRoof.rotation.x = 0.2;
  g.add(pRoof);

  [-1.8, 1.8].forEach((wx) => {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.85), warmWindowMat);
    win.position.set(wx, 1.85, 2.54);
    g.add(win);
    houseWindows.push({ mesh: win, timer: Math.random() * 10 });
  });

  const chim = createOutlinedMesh(new THREE.BoxGeometry(1.1, 4.9, 1.15), stoneMat, 0.055, false);
  chim.position.set(3.25, 2.5, -0.5);
  g.add(chim);

  g.userData.chimneyTop = new THREE.Vector3(3.25, 5.15, -0.5);
  g.userData.lightSpecs = { width: 5.8, yPos: 2.52, zFront: 4.65 };
  return g;
}

function createAFrameCabin() {
  const g = new THREE.Group();
  const cedarMat = makeToonMat(0xd99b66);

  const deck = createOutlinedMesh(new THREE.BoxGeometry(6.6, 0.45, 8.0), cedarMat, 0.05, false);
  deck.position.y = 0.15;
  g.add(deck);

  const shape = new THREE.Shape();
  shape.moveTo(-3.3, 0);
  shape.lineTo(0, 5.6);
  shape.lineTo(3.3, 0);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, { depth: 6.2, bevelEnabled: false });
  geo.translate(0, 0, -3.1);
  const roof = createOutlinedMesh(geo, aframeRoofMat, 0.065);
  roof.position.y = 0.38;
  g.add(roof);

  const innerGeo = new THREE.ExtrudeGeometry(shape, { depth: 5.6, bevelEnabled: false });
  innerGeo.scale(0.84, 0.84, 1);
  innerGeo.translate(0, 0, -2.8);
  const wall = new THREE.Mesh(innerGeo, cedarMat);
  wall.position.y = 0.38;
  g.add(wall);

  const bigWin = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 2.0), warmWindowMat);
  bigWin.position.set(0, 1.78, 2.86);
  g.add(bigWin);
  houseWindows.push({ mesh: bigWin, timer: Math.random() * 10 });

  return g;
}

// =========================================================
// GROTE VILLA AAN MOOSE LAKE: herenhuis met vleugels, zuilenportiek,
// zwembad met terras, heggen en een fontein op het voorplein
// =========================================================
const villaWallMat = makeToonMat(0xf6f0e4);
const villaRoofMat = registerSeasonalMat(0x3e4a5c, 0xf2f6fb);
const villaTrimMat = makeToonMat(0xd9cdb8);
const villaShutterMat = makeToonMat(0x2f5d50);
const villaDoorMat = makeToonMat(0x5a3324);
const poolWaterMat = new THREE.MeshBasicMaterial({ color: 0x5fd0e6 });
const poolDeckMat = registerSeasonalMat(0xe2d2b4, 0xf2f6fb);
const hedgeMat = registerSeasonalMat(0x3f6e3c, 0xe8eff4);

function hipRoof(w, d, h, mat) {
  // Schilddak: piramide-vorm gestrekt over de lengte
  const geo = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1);
  geo.rotateY(Math.PI / 4);
  geo.translate(0, 0.5, 0);
  const mesh = createOutlinedMesh(geo, mat, 0.05);
  mesh.scale.set(w + 0.9, h, d + 0.9);
  return mesh;
}

function addVillaWindows(g, xs, ys, z, rotY = 0) {
  xs.forEach((wx) => {
    ys.forEach((wy) => {
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.45), warmWindowMat);
      const frame = createOutlinedMesh(new THREE.BoxGeometry(1.35, 1.7, 0.08), villaTrimMat, 0.02, false);
      const shutters = [-0.85, 0.85].map((sx) => {
        const sh = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.55, 0.06), villaShutterMat);
        sh.position.set(sx, 0, 0.02);
        return sh;
      });
      const holder = new THREE.Group();
      glass.position.z = 0.06;
      holder.add(frame, glass, ...shutters);
      if (rotY === 0) holder.position.set(wx, wy, z);
      else holder.position.set(z * Math.sign(rotY), wy, wx);
      holder.rotation.y = rotY;
      g.add(holder);
      houseWindows.push({ mesh: glass, timer: Math.random() * 10 });
    });
  });
}

function createVilla() {
  const g = new THREE.Group();
  const mainW = 13.0, mainD = 8.5, mainH = 7.0;

  const plinth = createOutlinedMesh(new THREE.BoxGeometry(mainW + 13.4, 0.6, mainD + 1.2), stoneMat, 0.04, false, true);
  plinth.position.y = 0.2;
  g.add(plinth);

  // Hoofdgebouw (2 verdiepingen)
  const main = createOutlinedMesh(new THREE.BoxGeometry(mainW, mainH, mainD), villaWallMat, 0.06);
  main.position.y = mainH * 0.5 + 0.45;
  g.add(main);
  const cornice = createOutlinedMesh(new THREE.BoxGeometry(mainW + 0.4, 0.35, mainD + 0.4), villaTrimMat, 0.035, false);
  cornice.position.y = mainH + 0.45;
  g.add(cornice);
  const roof = hipRoof(mainW, mainD, 3.4, villaRoofMat);
  roof.position.y = mainH + 0.6;
  g.add(roof);
  addVillaWindows(g, [-4.6, -2.3, 2.3, 4.6], [2.3, 5.5], mainD * 0.5 + 0.02);

  // Twee lagere vleugels
  [-1, 1].forEach((side) => {
    const wingW = 6.2, wingD = 7.0, wingH = 4.2;
    const wing = createOutlinedMesh(new THREE.BoxGeometry(wingW, wingH, wingD), villaWallMat, 0.055);
    wing.position.set(side * (mainW * 0.5 + wingW * 0.5 - 0.1), wingH * 0.5 + 0.45, -0.4);
    g.add(wing);
    const wRoof = hipRoof(wingW, wingD, 2.2, villaRoofMat);
    wRoof.position.set(side * (mainW * 0.5 + wingW * 0.5 - 0.1), wingH + 0.55, -0.4);
    g.add(wRoof);
    addVillaWindows(g, [side * (mainW * 0.5 + 1.7), side * (mainW * 0.5 + 4.3)], [2.3], wingD * 0.5 - 0.38);
  });

  // Zuilenportiek met balkon
  const portico = createOutlinedMesh(new THREE.BoxGeometry(5.4, 0.35, 2.6), villaTrimMat, 0.04, false);
  portico.position.set(0, 4.15, mainD * 0.5 + 1.3);
  g.add(portico);
  [-2.3, -0.8, 0.8, 2.3].forEach((cx) => {
    const col = createOutlinedMesh(new THREE.CylinderGeometry(0.22, 0.26, 3.6, 10), villaTrimMat, 0.03, false);
    col.position.set(cx, 2.3, mainD * 0.5 + 2.3);
    g.add(col);
  });
  const steps = createOutlinedMesh(new THREE.BoxGeometry(4.6, 0.3, 1.6), stoneMat, 0.03, false, true);
  steps.position.set(0, 0.35, mainD * 0.5 + 3.1);
  g.add(steps);
  const door = createOutlinedMesh(new THREE.BoxGeometry(1.6, 2.6, 0.14), villaDoorMat, 0.03, false);
  door.position.set(0, 1.75, mainD * 0.5 + 0.06);
  g.add(door);
  const balconyRail = createOutlinedMesh(new THREE.BoxGeometry(5.4, 0.5, 0.12), villaTrimMat, 0.02, false);
  balconyRail.position.set(0, 4.6, mainD * 0.5 + 2.55);
  g.add(balconyRail);

  // Schoorstenen
  [-1, 1].forEach((side) => {
    const chim = createOutlinedMesh(new THREE.BoxGeometry(0.9, 3.2, 0.9), stoneMat, 0.04, false);
    chim.position.set(side * 4.2, mainH + 2.0, -1.4);
    g.add(chim);
  });

  // Zwembad met terras aan de zijkant (richting het meer)
  const deck = createOutlinedMesh(new THREE.BoxGeometry(11.0, 0.3, 7.5), poolDeckMat, 0.035, false, true);
  deck.position.set(mainW * 0.5 + 6.2 + 7.0, 0.3, 3.4);
  g.add(deck);
  const pool = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.1, 4.0), poolWaterMat);
  pool.position.set(mainW * 0.5 + 6.2 + 7.0, 0.47, 3.4);
  g.add(pool);
  [-2.2, 2.2].forEach((lx) => {
    const lounger = createOutlinedMesh(new THREE.BoxGeometry(0.7, 0.25, 1.9), trimWhiteMat, 0.02, false);
    lounger.position.set(mainW * 0.5 + 6.2 + 7.0 + lx, 0.6, 6.4);
    g.add(lounger);
  });

  // Voorplein met fontein en heggen
  const court = createOutlinedMesh(new THREE.BoxGeometry(14, 0.3, 7.5), poolDeckMat, 0.03, false, true);
  court.position.set(0, 0.12, mainD * 0.5 + 7.6);
  g.add(court);
  const basin = createOutlinedMesh(new THREE.CylinderGeometry(1.9, 2.1, 0.55, 16), stoneMat, 0.035, false);
  basin.position.set(0, 0.5, mainD * 0.5 + 8.0);
  g.add(basin);
  const fWater = new THREE.Mesh(new THREE.CylinderGeometry(1.65, 1.65, 0.08, 16), poolWaterMat);
  fWater.position.set(0, 0.76, mainD * 0.5 + 8.0);
  g.add(fWater);
  const spout = createOutlinedMesh(new THREE.CylinderGeometry(0.2, 0.35, 1.3, 8), stoneMat, 0.025, false);
  spout.position.set(0, 1.25, mainD * 0.5 + 8.0);
  g.add(spout);
  [-1, 1].forEach((side) => {
    const hedge = createOutlinedMesh(new THREE.BoxGeometry(5.0, 1.0, 1.0), hedgeMat, 0.035, false);
    hedge.position.set(side * 5.0, 0.75, mainD * 0.5 + 11.0);
    g.add(hedge);
  });

  g.userData.lightSpecs = { width: mainW * 0.94, yPos: mainH + 0.7, zFront: mainD * 0.5 + 0.3 };
  g.userData.chimneyTop = new THREE.Vector3(4.2, mainH + 3.7, -1.4);
  return g;
}

function buildVilla(lot) {
  const mesh = createVilla();
  // Villa staat iets van de oprit af: het voorplein ligt aan het eind van de oprijlaan
  const back = rotateLocal(0, -9.5, lot.yaw);
  const vx = lot.x + back.x;
  const vz = lot.z + back.z;
  mesh.position.set(vx, getTerrainHeight(lot.x, lot.z), vz);
  mesh.rotation.y = lot.yaw;
  scene.add(mesh);
  addRoofStringLights(mesh, mesh.userData.lightSpecs.width, mesh.userData.lightSpecs.yPos, mesh.userData.lightSpecs.zFront);
  mesh.updateMatrixWorld(true);
  chimneySmokes.push({ origin: mesh.userData.chimneyTop.clone().applyMatrix4(mesh.matrixWorld), timer: Math.random() * 1.8 });
  [[-9.5, -0.4], [-3.5, 0], [3.5, 0], [9.5, -0.4], [19.7, 3.4]].forEach(([lx, lz]) => {
    const p = rotateLocal(lx, lz, lot.yaw);
    hardColliders.push({ x: vx + p.x, z: vz + p.z, r: lx === 19.7 ? 4.0 : 4.2 });
  });
  const f = rotateLocal(0, 12.25, lot.yaw);
  hardColliders.push({ x: vx + f.x, z: vz + f.z, r: 2.2 });
}

ruralLots.forEach((lot) => {
  if (lot.type === 'farm' || lot.type === 'store' || lot.type === 'diner' || lot.type === 'camping' || lot.type === 'sawmill' || lot.type === 'fair') return;
  if (lot.type === 'villa') {
    buildVilla(lot);
    return;
  }

  if (mallExclusionZone) {
    const dx = lot.x - mallExclusionZone.baseX;
    const dz = lot.z - mallExclusionZone.baseZ;
    if (dx * dx + dz * dz < 25 * 25) return;
  }

  let mesh;
  if (lot.type === 'cabin') mesh = createLogCabin();
  else if (lot.type === 'aframe') mesh = createAFrameCabin();
  else if (lot.type === 'house_blue') mesh = createDetachedRuralHouse(0x5b83a1);
  else if (lot.type === 'house_red') mesh = createDetachedRuralHouse(0xb84a39);
  else mesh = createDetachedRuralHouse(0xe3b857);

  const exactPadY = getTerrainHeight(lot.x, lot.z);
  mesh.position.set(lot.x, exactPadY, lot.z);
  mesh.rotation.y = lot.yaw;
  scene.add(mesh);
  hardColliders.push({ x: lot.x, z: lot.z, r: 4.1 });

  if (mesh.userData.lightSpecs) {
    addRoofStringLights(mesh, mesh.userData.lightSpecs.width, mesh.userData.lightSpecs.yPos, mesh.userData.lightSpecs.zFront);
  }
  if (mesh.userData.chimneyTop) {
    mesh.updateMatrixWorld(true);
    chimneySmokes.push({
      origin: mesh.userData.chimneyTop.clone().applyMatrix4(mesh.matrixWorld),
      timer: Math.random() * 1.8
    });
  }
});
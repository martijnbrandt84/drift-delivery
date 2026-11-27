import * as THREE from 'three';
import {
  scene, createOutlinedMesh, makeToonMat, registerSeasonalMat, christmasGroup, pineSnowCapObjects
} from './scene-setup.js';
import { TOWN_ELEV } from './roads.js';
import { ruralLots } from './water-lots.js';
import { hardColliders, registerDestructible, destructibles, markLastPlanted } from './demolition.js';
import { getTerrainHeight } from './terrain.js';
import { tagMap } from './map-tags.js';

// Tekst op borden: altijd net vóór het bord tekenen (geen flikkeren/wegvallen op afstand)
// Borden: echte sRGB-kleuren en geen filmische tonemapping, zodat rood rood blijft en tekst scherp is
const SIGN_MAT_OPTS = { polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, toneMapped: false };
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
// Wijzers van de klok op het gemeentehuis (volgen de speltijd)
export const townClockHands = [];
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

const cypressMat = makeToonMat(0x2c5a3c);
const blossomMat = registerSeasonalMat(0xe8a6c0, 0xf2f6fb);
const roundLeafMat = registerSeasonalMat(0x5f8f3e, 0xe8eff4);
// Losse dubbele garage naast de villa (zelfde muren en dak), linkerdeur open, rechterdeur dicht
function createVillaGarage() {
  const g = new THREE.Group();
  const w = 8.0, d = 6.6, h = 3.4;
  const plinth = createOutlinedMesh(new THREE.BoxGeometry(w + 0.4, 0.3, d + 0.4), stoneMat, 0.03, false, true);
  plinth.position.y = 0.05;
  g.add(plinth);
  // Achterwand, zijwanden en middenmuur (de vakken zijn open aan de voorkant)
  const back = createOutlinedMesh(new THREE.BoxGeometry(w, h, 0.3), villaWallMat, 0.045);
  back.position.set(0, h / 2 + 0.2, -d / 2 + 0.15);
  g.add(back);
  [-w / 2 + 0.15, 0, w / 2 - 0.15].forEach((x) => {
    const wall = createOutlinedMesh(new THREE.BoxGeometry(0.3, h, d), villaWallMat, 0.045);
    wall.position.set(x, h / 2 + 0.2, 0);
    g.add(wall);
  });
  const lintel = createOutlinedMesh(new THREE.BoxGeometry(w, 0.7, 0.3), villaWallMat, 0.04);
  lintel.position.set(0, h - 0.15, d / 2 - 0.15);
  g.add(lintel);
  const cornice = createOutlinedMesh(new THREE.BoxGeometry(w + 0.3, 0.25, d + 0.3), villaTrimMat, 0.03, false);
  cornice.position.y = h + 0.3;
  g.add(cornice);
  const roof = hipRoof(w, d, 1.9, villaRoofMat);
  roof.position.y = h + 0.42;
  g.add(roof);
  // Rechterdeur dicht (gepaneeld), linker vak open met donker interieur
  const door = createOutlinedMesh(new THREE.BoxGeometry(3.4, 2.75, 0.12), trimWhiteMat, 0.02, false);
  door.position.set(w / 4, 1.58, d / 2 - 0.05);
  g.add(door);
  for (let k = 0; k < 4; k++) {
    const groove = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.05, 0.03), villaTrimMat);
    groove.position.set(w / 4, 0.55 + k * 0.62, d / 2 + 0.02);
    g.add(groove);
  }
  const inside = new THREE.Mesh(new THREE.BoxGeometry(3.5, 2.8, 0.05), makeToonMat(0x3a3530));
  inside.position.set(-w / 4, 1.6, -d / 2 + 0.32);
  g.add(inside);
  const floor = new THREE.Mesh(new THREE.BoxGeometry(w - 0.6, 0.04, d - 0.4), makeToonMat(0x9a958c));
  floor.position.set(0, 0.22, 0);
  g.add(floor);
  // Lantaarns naast de deuren
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe08a });
  [-w / 2 + 0.05, w / 2 - 0.05].forEach((x) => {
    const lamp = createOutlinedMesh(new THREE.BoxGeometry(0.22, 0.34, 0.22), lampMat, 0.015, false);
    lamp.position.set(x, 2.3, d / 2 + 0.15);
    g.add(lamp);
  });
  return g;
}

function createGardenTree(kind) {
  if (kind === 'cypress') {
    const g = new THREE.Group();
    const trunk = createOutlinedMesh(new THREE.CylinderGeometry(0.12, 0.16, 0.8, 6), parkTreeTrunkMat, 0.02);
    trunk.position.y = 0.4;
    g.add(trunk);
    const body = createOutlinedMesh(new THREE.CylinderGeometry(0.12, 0.62, 4.6, 8), cypressMat, 0.035);
    body.position.y = 3.0;
    g.add(body);
    return g;
  }
  if (kind === 'blossom' || kind === 'round') {
    const g = new THREE.Group();
    const trunk = createOutlinedMesh(new THREE.CylinderGeometry(0.17, 0.24, 1.6, 7), parkTreeTrunkMat, 0.03);
    trunk.position.y = 0.8;
    g.add(trunk);
    const mat = kind === 'blossom' ? blossomMat : roundLeafMat;
    const c1 = createOutlinedMesh(new THREE.IcosahedronGeometry(1.35, 1), mat, 0.045);
    c1.scale.set(1.15, 0.85, 1.15);
    c1.position.y = 2.4;
    g.add(c1);
    const c2 = createOutlinedMesh(new THREE.IcosahedronGeometry(0.85, 1), mat, 0.035);
    c2.position.set(0.9, 2.1, 0.3);
    g.add(c2);
    return g;
  }
  const t = createParkTree();
  t.scale.set(1.0, 1.55, 1.0);
  return t;
}

export function createParkTree() {
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
  registerDestructible(g, x, y, z, 0.65, 'small', 28, 'Street lamp');
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
  registerDestructible(g, x, py, z, 0.55, 'small', 32, 'Fire hydrant');
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
  registerDestructible(g, x, y, z, 0.9, 'small', 10, 'Bench');
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
  registerDestructible(g, x, y, z, 0.4, 'small', 6, 'Trash can');
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
function createAttachedShop__build(width, height, depth, wallHex, awningHex, roofTrimHex) {
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

function createRowTownHouse__build(width, height, depth, sidingHex, altRoof = false) {
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

function createDetachedRuralHouse__build(sidingHex) {
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

function createGemeentehuis__build() {
  const g = new THREE.Group();
  const w = 16.0, h = 5.4, d = 5.6;

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

  [-6.6, -4.4, -2.2, 2.2, 4.4, 6.6].forEach((wx) => {
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
  // Donkere rand en 12 uurstreepjes
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.06, 6, 24), clockHandMat);
  rim.position.set(0, h + 1.95, 1.5);
  g.add(rim);
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    const tick = new THREE.Mesh(new THREE.BoxGeometry(k % 3 === 0 ? 0.07 : 0.04, k % 3 === 0 ? 0.17 : 0.11, 0.02), clockHandMat);
    tick.position.set(Math.sin(a) * 0.64, h + 1.95 + Math.cos(a) * 0.64, 1.5);
    tick.rotation.z = -a;
    g.add(tick);
  }
  // Echte wijzers die om het midden draaien (bijgewerkt met de speltijd, zie main.js)
  const makeHand = (len, thick) => {
    const pivot = new THREE.Group();
    pivot.position.set(0, h + 1.95, 1.52);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(thick, len, 0.03), clockHandMat);
    bar.position.y = len * 0.5 - 0.06;
    pivot.add(bar);
    g.add(pivot);
    return pivot;
  };
  const hourHand = makeHand(0.4, 0.075);
  const minuteHand = makeHand(0.6, 0.05);
  hourHand.position.z += 0.01;
  const hub = new THREE.Mesh(new THREE.CircleGeometry(0.06, 10), clockHandMat);
  hub.position.set(0, h + 1.95, 1.545);
  g.add(hub);
  townClockHands.push({ hour: hourHand, minute: minuteHand });

  const spire = createOutlinedMesh(new THREE.ConeGeometry(1.55, 3.4, 4), registerSeasonalMat(0x475666, 0xdce8f5), 0.05);
  spire.position.set(0, h + 4.75, 0.4);
  spire.rotation.y = Math.PI / 4;
  g.add(spire);

  const pole = createOutlinedMesh(new THREE.CylinderGeometry(0.07, 0.09, 4.6, 6), trimWhiteMat, 0.02, false);
  pole.position.set(5.6, 2.3, d * 0.5 + 1.1);
  g.add(pole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 0.62), flagMat);
  flag.position.set(6.0, 4.3, d * 0.5 + 1.1);
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
    gift.position.set(0, sz * 0.4, 0);
    const ribbonA = new THREE.Mesh(new THREE.BoxGeometry(sz + 0.02, sz * 0.82, 0.1), ribbonMat);
    ribbonA.position.copy(gift.position);
    const ribbonB = ribbonA.clone();
    ribbonB.rotation.y = Math.PI * 0.5;
    const giftHolder = new THREE.Group();
    giftHolder.add(gift, ribbonA, ribbonB);
    const gx = treeX + Math.cos(a) * 3.3;
    const gz = treeZ + Math.sin(a) * 3.3;
    giftHolder.position.set(gx, baseY, gz);
    giftHolder.rotation.y = a;
    christmasGroup.add(giftHolder);
    registerDestructible(giftHolder, gx, baseY, gz, 0.5, 'small', 6, 'Present');
    destructibles[destructibles.length - 1].season = 'winter';
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
    const cx = treeX + Math.cos(a) * 7.0;
    const cz = treeZ + Math.sin(a) * 7.0;
    const cy = getTerrainHeight(cx, cz);
    cane.position.set(cx, cy, cz);
    cane.rotation.y = -a;
    christmasGroup.add(cane);
    registerDestructible(cane, cx, cy, cz, 0.4, 'small', 5, 'Candy cane');
    destructibles[destructibles.length - 1].season = 'winter';
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
// HERKENBARE WINKELS: elk met eigen kleuren, naambord en typisch detail
// =========================================================
const SHOP_TYPES = {
  bakery: { wall: 0xe8c9a0, awn: 0xb8432f, trim: 0x7a4a2a, label: 'BAKERY', bg: '#7a4a2a', fg: '#fff3de' },
  books: { wall: 0x2f5d50, awn: 0xe8c46a, trim: 0x1d3a32, label: 'BOOKS', bg: '#1d3a32', fg: '#f3e3c3' },
  pharmacy: { wall: 0xf2f0ea, awn: 0x2f8a4e, trim: 0x2f8a4e, label: 'PHARMACY', bg: '#2f8a4e', fg: '#ffffff' },
  hardware: { wall: 0x8c3a2a, awn: 0x3a3f45, trim: 0x3a3f45, label: 'HARDWARE', bg: '#3a3f45', fg: '#f4b41a' },
  barber: { wall: 0xdfe6ee, awn: 0x2f4f8a, trim: 0xb8243a, label: 'BARBER', bg: '#b8243a', fg: '#ffffff' },
  icecream: { wall: 0xf7c6d9, awn: 0x7fd1c7, trim: 0xe07ab8, label: 'ICE CREAM', bg: '#e07ab8', fg: '#ffffff' },
  post: { wall: 0xd8d2c4, awn: 0x2a4a8a, trim: 0x2a4a8a, label: 'POST OFFICE', bg: '#2a4a8a', fg: '#ffffff' },
  bank: { wall: 0xe6dcc6, awn: 0x4a4a4a, trim: 0x8a7a5a, label: 'BANK', bg: '#3a3a3a', fg: '#e8c46a' },
  cafe: { wall: 0x6b4a3a, awn: 0xe8dcc8, trim: 0x3a2a20, label: 'COFFEE', bg: '#3a2a20', fg: '#f3e3c3' },
  florist: { wall: 0xf3e8f0, awn: 0x8ac06a, trim: 0x6a9a4a, label: 'FLOWERS', bg: '#6a9a4a', fg: '#ffffff' },
  toys: { wall: 0xf4b41a, awn: 0x3f78a8, trim: 0xd94e3a, label: 'TOYS', bg: '#d94e3a', fg: '#ffffff' },
  grocery: { wall: 0x9ab06a, awn: 0xf5ead3, trim: 0x4a6a3a, label: 'GROCERY', bg: '#4a6a3a', fg: '#fff3de' },
  laundry: { wall: 0xbfdbe8, awn: 0x3f78a8, trim: 0x3f78a8, label: 'LAUNDRY', bg: '#3f78a8', fg: '#ffffff' },
  music: { wall: 0x4a3a6a, awn: 0xf4b41a, trim: 0x2a2040, label: 'RECORDS', bg: '#2a2040', fg: '#f4b41a' },
  pizza: { wall: 0xf2e6d0, awn: 0xd62839, trim: 0x2f8a4e, label: 'PIZZA', bg: '#2f8a4e', fg: '#ffffff' }
};

const shopSignTexCache = new Map();
function getShopSignTexture(cfg) {
  const aspect = cfg.aspect ?? 4;
  const key = `${cfg.label}|${cfg.bg}|${aspect.toFixed(2)}`;
  if (shopSignTexCache.has(key)) return shopSignTexCache.get(key);
  const canvas = document.createElement('canvas');
  const H = 96;
  const W = Math.max(192, Math.min(1024, Math.round(H * aspect)));
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = cfg.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = cfg.fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Zo groot mogelijk, maar altijd binnen het bord (met marge)
  let size = 62;
  ctx.font = `900 ${size}px system-ui, sans-serif`;
  const tw = ctx.measureText ? ctx.measureText(cfg.label).width : 0;
  if (tw > W * 0.9) size = Math.max(20, Math.floor(size * (W * 0.9) / tw));
  ctx.font = `900 ${size}px system-ui, sans-serif`;
  ctx.fillText(cfg.label, W / 2, H / 2 + 3);
  const tex = Object.assign(new THREE.CanvasTexture(canvas), { colorSpace: THREE.SRGBColorSpace });
  tex.needsUpdate = true;
  shopSignTexCache.set(key, tex);
  return tex;
}

function addHangingSign(g, x, y, z, mesh) {
  const bracket = createOutlinedMesh(new THREE.BoxGeometry(0.08, 0.08, 0.9), streetPostMat, 0.015, false);
  bracket.position.set(x, y + 0.45, z + 0.45);
  g.add(bracket);
  mesh.position.set(x, y, z + 0.8);
  g.add(mesh);
}

function createNamedShop__build(type, width, height, depth) {
  const cfg = SHOP_TYPES[type];
  const g = createAttachedShop(width, height, depth, cfg.wall, cfg.awn, cfg.trim);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(width * 0.72, 0.5), new THREE.MeshBasicMaterial({ map: getShopSignTexture(cfg), ...SIGN_MAT_OPTS }));
  sign.position.set(0, height - 0.55, depth * 0.5 + 0.23);
  g.add(sign);
  const front = depth * 0.5;
  const sideX = width * 0.5 - 0.25;

  if (type === 'bakery') {
    const pretzel = createOutlinedMesh(new THREE.TorusKnotGeometry(0.28, 0.08, 40, 6, 2, 3), makeToonMat(0xc98a3a), 0.02, false);
    addHangingSign(g, sideX, 3.4, front, pretzel);
  } else if (type === 'barber') {
    const pole = new THREE.Group();
    const tube = createOutlinedMesh(new THREE.CylinderGeometry(0.14, 0.14, 1.1, 10), makeToonMat(0xffffff), 0.02, false);
    pole.add(tube);
    for (let k = 0; k < 4; k++) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.145, 0.035, 4, 12), makeToonMat(k % 2 ? 0x2f4f8a : 0xd62839));
      band.rotation.x = Math.PI * 0.5 + 0.4;
      band.position.y = -0.4 + k * 0.27;
      pole.add(band);
    }
    [0.6, -0.6].forEach((cy) => {
      const cap = createOutlinedMesh(new THREE.SphereGeometry(0.16, 8, 6), makeToonMat(0xe8c46a), 0.015, false);
      cap.position.y = cy;
      pole.add(cap);
    });
    pole.position.set(-sideX + 0.1, 1.9, front + 0.3);
    g.add(pole);
  } else if (type === 'pharmacy') {
    const cross = new THREE.Group();
    const greenMat = new THREE.MeshBasicMaterial({ color: 0x3fd07a });
    cross.add(new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.7, 0.24), greenMat));
    cross.add(new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.24, 0.7), greenMat));
    cross.rotation.y = Math.PI * 0.5;
    addHangingSign(g, sideX, 3.5, front, cross);
  } else if (type === 'icecream') {
    const cone = new THREE.Group();
    const wafer = createOutlinedMesh(new THREE.ConeGeometry(0.45, 1.3, 10), makeToonMat(0xd9a45a), 0.03, false);
    wafer.rotation.x = Math.PI;
    cone.add(wafer);
    [[0xf7c6d9, 0.75], [0x7fd1c7, 1.25], [0xfff3de, 1.7]].forEach(([c, y]) => {
      const scoop = createOutlinedMesh(new THREE.SphereGeometry(0.42, 10, 8), makeToonMat(c), 0.025, false);
      scoop.position.y = y - 0.2;
      cone.add(scoop);
    });
    cone.position.set(0, height + 1.4, front - 0.25);
    g.add(cone);
  } else if (type === 'post') {
    const flagPole = createOutlinedMesh(new THREE.CylinderGeometry(0.05, 0.06, 4.0, 6), makeToonMat(0xd9d9d9), 0.015, false);
    flagPole.position.set(sideX, height + 1.6, front - 0.4);
    g.add(flagPole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.65), new THREE.MeshBasicMaterial({ color: 0x2a4a8a, side: THREE.DoubleSide }));
    flag.position.set(sideX + 0.58, height + 3.2, front - 0.4);
    g.add(flag);
    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.12), new THREE.MeshBasicMaterial({ color: 0xd62839, side: THREE.DoubleSide }));
    stripe.position.set(sideX + 0.58, height + 3.0, front - 0.39);
    g.add(stripe);
  } else if (type === 'bank') {
    [-0.85, 0.85].forEach((cx) => {
      const col = createOutlinedMesh(new THREE.CylinderGeometry(0.16, 0.18, 2.4, 10), makeToonMat(0xf3ead6), 0.02, false);
      col.position.set(cx, 1.2, front + 0.25);
      g.add(col);
    });
  } else if (type === 'books') {
    const book = createOutlinedMesh(new THREE.BoxGeometry(0.12, 0.55, 0.42), makeToonMat(0xb8432f), 0.015, false);
    addHangingSign(g, sideX, 3.4, front, book);
  } else if (type === 'cafe') {
    const cup = new THREE.Group();
    const body = createOutlinedMesh(new THREE.CylinderGeometry(0.22, 0.17, 0.35, 10), makeToonMat(0xffffff), 0.015, false);
    cup.add(body);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.03, 4, 8), makeToonMat(0xffffff));
    handle.position.x = 0.24;
    cup.add(handle);
    addHangingSign(g, sideX, 3.4, front, cup);
  } else if (type === 'florist' || type === 'grocery') {
    [-width * 0.28, width * 0.28].forEach((bx) => {
      const box = createOutlinedMesh(new THREE.BoxGeometry(1.2, 0.3, 0.35), makeToonMat(0x6b4a2b), 0.015, false);
      box.position.set(bx, 0.6, front + 0.25);
      g.add(box);
      for (let k = 0; k < 4; k++) {
        const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.13, 6, 5), makeToonMat(type === 'grocery' ? [0xd94e3a, 0xf4b41a, 0x6cc04a, 0xe0762f][k] : [0xe07ab8, 0xffd23f, 0xd94e3a, 0xffffff][k]));
        bloom.position.set(bx - 0.42 + k * 0.28, 0.85, front + 0.25);
        g.add(bloom);
      }
    });
  } else if (type === 'hardware') {
    const saw = createOutlinedMesh(new THREE.BoxGeometry(0.1, 0.4, 0.75), makeToonMat(0xc9d2da), 0.015, false);
    addHangingSign(g, sideX, 3.4, front, saw);
  } else if (type === 'pizza') {
    const pie = createOutlinedMesh(new THREE.CylinderGeometry(0.42, 0.42, 0.08, 14), makeToonMat(0xf0b84a), 0.015, false);
    pie.rotation.z = Math.PI * 0.5;
    addHangingSign(g, sideX, 3.4, front, pie);
  } else if (type === 'music') {
    const record = createOutlinedMesh(new THREE.CylinderGeometry(0.4, 0.4, 0.05, 16), makeToonMat(0x1a1a1a), 0.015, false);
    record.rotation.z = Math.PI * 0.5;
    addHangingSign(g, sideX, 3.4, front, record);
  }
  return g;
}

// Klein pleintje tussen de panden: gras, boom en een bankje
function createPocketPark(x, z, rotY) {
  const lawn = createOutlinedMesh(new THREE.BoxGeometry(4.3, 0.2, 6.0), blockLawnMat, 0.02, false, true);
  lawn.position.set(x, TOWN_ELEV + 0.18, z);
  lawn.rotation.y = rotY;
  scene.add(lawn);
  const tree = createParkTree();
  tree.position.set(x, TOWN_ELEV + 0.28, z);
  scene.add(tree);
  hardColliders.push({ x, z, r: 0.6 });
  const fwd = { x: Math.sin(rotY), z: Math.cos(rotY) };
  createBench(x + fwd.x * 2.2, z + fwd.z * 2.2, rotY + Math.PI);
}

function placeNamedShop(x, z, rotY, type, w, h, d) {
  const shop = createNamedShop(type, w, h, d);
  shop.position.set(x, TOWN_ELEV + 0.14, z);
  shop.rotation.y = rotY;
  scene.add(shop);
  hardColliders.push({ x, z, r: Math.min(w, d) * 0.48 });
  addRoofStringLights(shop, shop.userData.lightSpecs.width, shop.userData.lightSpecs.yPos, shop.userData.lightSpecs.zFront);
}

// =========================================================
// APPARTEMENTENGEBOUWEN: 4 verdiepingen met balkons, entree-luifel en watertoren op het dak
// =========================================================
function createApartmentBuilding__build(width, floors, depth, wallHex, trimHex, withTower = true, opts = {}) {
  floors = Math.min(3, floors);
  const roofType = opts.roof ?? 'flat';
  const g = new THREE.Group();
  const floorH = 3.0;
  const h = floors * floorH + 0.6;
  const wallMat = makeToonMat(wallHex);
  const trimMat = registerSeasonalMat(trimHex, 0xf2f7fc);

  const body = createOutlinedMesh(new THREE.BoxGeometry(width, h, depth), wallMat, 0.055);
  body.position.y = h * 0.5;
  g.add(body);
  for (let f = 1; f < floors; f++) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(width + 0.08, 0.16, depth + 0.08), trimMat);
    band.position.y = f * floorH + 0.3;
    g.add(band);
  }
  if (roofType === 'gable') {
    // Puntdak met dakkapel: oud houten appartementenpand
    const rShape = new THREE.Shape();
    rShape.moveTo(-(width * 0.5 + 0.4), 0);
    rShape.lineTo(0, 2.2);
    rShape.lineTo(width * 0.5 + 0.4, 0);
    rShape.closePath();
    const rGeo = new THREE.ExtrudeGeometry(rShape, { depth: depth + 0.6, bevelEnabled: false });
    rGeo.translate(0, 0, -(depth + 0.6) * 0.5);
    const roof = createOutlinedMesh(rGeo, registerSeasonalMat(opts.roofHex ?? 0x5a4a44, 0xf2f6fb), 0.05);
    roof.position.y = h;
    g.add(roof);
    const dormer = createOutlinedMesh(new THREE.BoxGeometry(1.4, 1.0, 1.2), wallMat, 0.03, false);
    dormer.position.set(0, h + 0.9, depth * 0.5 - 0.6);
    g.add(dormer);
    const dGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.6), warmWindowMat);
    dGlass.position.set(0, h + 0.9, depth * 0.5 + 0.01);
    g.add(dGlass);
    houseWindows.push({ mesh: dGlass, timer: Math.random() * 10 });
    withTower = false;
  } else {
    const parapet = createOutlinedMesh(new THREE.BoxGeometry(width + 0.3, 0.6, depth + 0.3), trimMat, 0.04, false);
    parapet.position.y = h + 0.2;
    g.add(parapet);
    const roofFill = new THREE.Mesh(new THREE.BoxGeometry(width - 0.2, 0.1, depth - 0.2), makeToonMat(0x5a5a60));
    roofFill.position.y = h + 0.45;
    g.add(roofFill);
  }

  const cols = Math.max(2, Math.floor(width / 2.1));
  const colStep = width / cols;
  for (let f = 0; f < floors; f++) {
    const wy = f * floorH + 1.8;
    for (let c = 0; c < cols; c++) {
      const wx = -width * 0.5 + colStep * (c + 0.5);
      if (f === 0 && Math.abs(wx) < 1.1) continue; // entree
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.3), warmWindowMat);
      glass.position.set(wx, wy, depth * 0.5 + 0.06);
      g.add(glass);
      houseWindows.push({ mesh: glass, timer: Math.random() * 10 });
      // Erkers: uitstekende raamkasten over de verdiepingen
      if (opts.bays && f > 0 && (c === 0 || c === cols - 1)) {
        const bay = createOutlinedMesh(new THREE.BoxGeometry(1.4, 2.0, 0.7), wallMat, 0.03, false);
        bay.position.set(wx, wy - 0.1, depth * 0.5 + 0.35);
        g.add(bay);
        const bayGlass = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.2), warmWindowMat);
        bayGlass.position.set(wx, wy, depth * 0.5 + 0.71);
        g.add(bayGlass);
        houseWindows.push({ mesh: bayGlass, timer: Math.random() * 10 });
        continue;
      }
      // Balkons op de verdiepingen, om en om
      if (!opts.noBalconies && f > 0 && (c + f) % 2 === 0) {
        const slab = createOutlinedMesh(new THREE.BoxGeometry(1.5, 0.14, 0.9), trimMat, 0.02, false);
        slab.position.set(wx, wy - 0.95, depth * 0.5 + 0.45);
        g.add(slab);
        const rail = createOutlinedMesh(new THREE.BoxGeometry(1.5, 0.55, 0.06), streetPostMat, 0.015, false);
        rail.position.set(wx, wy - 0.6, depth * 0.5 + 0.88);
        g.add(rail);
      }
    }
    // Zijramen
    [-1, 1].forEach((side) => {
      for (let c = 0; c < Math.max(1, Math.floor(depth / 3)); c++) {
        const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.2), warmWindowMat);
        glass.position.set(side * (width * 0.5 + 0.06), wy, -depth * 0.5 + (depth / Math.floor(depth / 3)) * (c + 0.5));
        glass.rotation.y = side * Math.PI * 0.5;
        g.add(glass);
        houseWindows.push({ mesh: glass, timer: Math.random() * 10 });
      }
    });
  }
  // Entree met luifel en dubbele deur
  const door = createOutlinedMesh(new THREE.BoxGeometry(1.6, 2.3, 0.12), makeToonMat(0x3a2a20), 0.025, false);
  door.position.set(0, 1.15, depth * 0.5 + 0.04);
  g.add(door);
  const canopy = createOutlinedMesh(new THREE.BoxGeometry(2.6, 0.18, 1.4), trimMat, 0.03, false);
  canopy.position.set(0, 2.6, depth * 0.5 + 0.7);
  g.add(canopy);
  const steps = createOutlinedMesh(new THREE.BoxGeometry(2.2, 0.2, 0.8), stoneMat, 0.02, false, true);
  steps.position.set(0, 0.1, depth * 0.5 + 0.4);
  g.add(steps);

  if (withTower) {
    // Houten watertoren op het dak — typisch voor oude Amerikaanse appartementen
    const tower = new THREE.Group();
    [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.6, 0.12), streetPostMat);
      leg.position.set(lx, 0.8, lz);
      tower.add(leg);
    });
    const tank = createOutlinedMesh(new THREE.CylinderGeometry(1.05, 1.05, 1.8, 12), makeToonMat(0x8a5a33), 0.035);
    tank.position.y = 2.5;
    tower.add(tank);
    const cap = createOutlinedMesh(new THREE.ConeGeometry(1.15, 0.8, 12), registerSeasonalMat(0x5a5a60, 0xf2f6fb), 0.03, false);
    cap.position.y = 3.8;
    tower.add(cap);
    tower.position.set(width * 0.22, h + 0.5, -depth * 0.15);
    tower.scale.setScalar(Math.min(1, width / 8));
    g.add(tower);
  }
  g.userData.lightSpecs = { width: width * 0.94, yPos: h + 0.4, zFront: depth * 0.5 + 0.2 };
  return g;
}

function placeApartment(x, z, rotY, width, floors, depth, wallHex, trimHex, withTower = true, opts = {}) {
  const apt = createApartmentBuilding(width, floors, depth, wallHex, trimHex, withTower, opts);
  apt.position.set(x, TOWN_ELEV + 0.14, z);
  apt.rotation.y = rotY;
  scene.add(apt);
  // Botscirkels verdeeld over de breedte (lokale x-as volgt de rotatie)
  const n = Math.max(1, Math.round(width / 4));
  for (let k = 0; k < n; k++) {
    const lx = -width * 0.5 + (width / n) * (k + 0.5);
    hardColliders.push({ x: x + Math.cos(rotY) * lx, z: z - Math.sin(rotY) * lx, r: Math.min(depth, width / n) * 0.55 });
  }
  addRoofStringLights(apt, apt.userData.lightSpecs.width, apt.userData.lightSpecs.yPos, apt.userData.lightSpecs.zFront);
}

// =========================================================
// OPBOUW PINEWOOD CREEK CENTRUM
// =========================================================
function buildPinewoodTown() {
  const sidewalkTopY = TOWN_ELEV + 0.14;
  const SW = 2.0;

  createSeamlessBlockBase(-23.95, -4.05, 84.75, 107.95, SW, courtyardPaverMat);
  placeCornerLamps(-23.95, -4.05, 84.75, 107.95, 1.0);

  [
    { x: -19.9625, h: 6.2, type: 'bakery' },
    { x: -15.9875, h: 5.3, type: 'books' },
    { x: -12.0125, h: 6.8, type: 'pharmacy' },
    { x: -8.0375,  h: 5.7, type: 'hardware' }
  ].forEach((s) => placeNamedShop(s.x, 89.85, Math.PI, s.type, 3.975, s.h, 6.2));

  placeNamedShop(-8.75, 94.8, Math.PI / 2, 'cafe', 3.7, 5.4, 5.4);
  placeShopHelper(-8.75, 98.5, Math.PI / 2, 3.7, 5.9, 5.4, 0xb85242, 0xfff3de, 0x6b281e);

  placeNamedShop(-19.25, 94.8, -Math.PI / 2, 'florist', 3.7, 5.6, 5.4);
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
    [20.6, 93.2]
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
  [7.6, 10.8, 14.0, 17.2, 20.4].forEach((hx) => hardColliders.push({ x: hx, z: 103.0, r: 2.9 }));
  addRoofStringLights(townHall, townHall.userData.lightSpecs.width, townHall.userData.lightSpecs.yPos, townHall.userData.lightSpecs.zFront);

  createSeamlessBlockBase(-23.95, -4.05, 116.05, 134.85, SW, courtyardPaverMat);
  placeCornerLamps(-23.95, -4.05, 116.05, 134.85, 1.0);

  [
    { x: -19.9625, h: 5.5, type: 'barber' },
    { x: -15.9875, h: 6.3, type: 'icecream' },
    { x: -12.0125, h: 5.2, type: 'post' },
    { x: -8.0375,  h: 6.0, type: 'bank' }
  ].forEach((s) => placeNamedShop(s.x, 121.05, Math.PI, s.type, 3.975, s.h, 6.0));

  placeRowHouseHelper(-18.6, 126.4, -Math.PI / 2, 4.3, 4.5, 5.0, 0xe6a147, false);
  placeRowHouseHelper(-18.6, 130.7, -Math.PI / 2, 4.3, 4.2, 5.0, 0x84a876, true);

  placeRowHouseHelper(-9.4, 126.4, Math.PI / 2, 4.3, 4.3, 5.0, 0x5b83a1, true);
  placeRowHouseHelper(-9.4, 130.7, Math.PI / 2, 4.3, 4.6, 5.0, 0xd66853, false);

  createSeamlessBlockBase(4.05, 23.95, 116.05, 134.85, SW, courtyardPaverMat);
  placeCornerLamps(4.05, 23.95, 116.05, 134.85, 1.0);

  placeNamedShop(8.0375,  121.05, Math.PI, 'toys', 3.975, 6.4, 6.0);
  placeNamedShop(12.0125, 121.05, Math.PI, 'music', 3.975, 5.6, 6.0);
  placeRowHouseHelper(15.9875, 121.4, Math.PI, 3.975, 4.7, 5.0, 0xe3b857, false);
  placeRowHouseHelper(19.9625, 121.4, Math.PI, 3.975, 4.4, 5.0, 0x7a9e7e, true);

  placeRowHouseHelper(9.4, 126.4, -Math.PI / 2, 4.3, 4.4, 5.0, 0xc9966b, false);
  placeRowHouseHelper(9.4, 130.7, -Math.PI / 2, 4.3, 4.6, 5.0, 0x9ab06a, true);

  placeRowHouseHelper(18.6, 126.4, Math.PI / 2, 4.3, 4.5, 5.0, 0xb84a39, true);
  placeRowHouseHelper(18.6, 130.7, Math.PI / 2, 4.3, 4.2, 5.0, 0x5b83a1, false);

  createSeamlessBlockBase(-42.6, -32.05, 84.75, 116.1, SW, courtyardPaverMat);
  placeCornerLamps(-42.6, -32.05, 84.75, 116.1, 1.0);

  placeNamedShop(-37.05, 89.05,  Math.PI / 2, 'grocery', 4.6, 5.8, 6.0);
  placeNamedShop(-37.05, 93.65,  Math.PI / 2, 'laundry', 4.6, 5.2, 6.0);
  placeRowHouseHelper(-37.4, 98.2,  Math.PI / 2, 4.5, 4.4, 5.0, 0xe3b857, false);
  // Pleintje als adempauze in de rij
  createPocketPark(-37.4, 102.7, Math.PI / 2);
  placeApartment(-37.3, 108.4, Math.PI / 2, 6.8, 3, 7.2, 0xb5654a, 0xe8dcc8, true);
  placeRowHouseHelper(-37.4, 113.9, Math.PI / 2, 3.6, 4.2, 5.0, 0x84a876, false);

  createSeamlessBlockBase(32.05, 42.6, 84.75, 116.1, SW, courtyardPaverMat);
  placeCornerLamps(32.05, 42.6, 84.75, 116.1, 1.0);

  placeShopHelper(37.05, 89.05,  -Math.PI / 2, 4.6, 6.0, 6.0, 0x4d728f, 0xd95d30, 0x293f52);
  placeShopHelper(37.05, 93.65,  -Math.PI / 2, 4.6, 5.3, 6.0, 0xd49a45, 0xfff3de, 0x73501c);
  createPocketPark(37.4, 98.2, -Math.PI / 2);
  placeRowHouseHelper(37.4, 102.7, -Math.PI / 2, 4.5, 4.3, 5.0, 0xc9966b, false);
  placeApartment(37.3, 108.4, -Math.PI / 2, 6.8, 2, 7.2, 0x6b8aa6, 0xf2ece0, false, { roof: 'gable', roofHex: 0x3d4b5c });
  placeRowHouseHelper(37.4, 113.9, -Math.PI / 2, 3.6, 4.4, 5.0, 0xe3b857, true);

  // ---- Twee nieuwe blokken ten zuiden van Oak Street, langs de doorgetrokken lanen ----
  createSeamlessBlockBase(-44.0, -32.05, 116.05, 134.85, SW, courtyardPaverMat);
  placeCornerLamps(-44.0, -32.05, 116.05, 134.85, 1.0);
  placeApartment(-37.8, 120.05, Math.PI / 2, 6.5, 2, 7.0, 0xe3cfa8, 0x7a5a3a, false, { roof: 'gable', roofHex: 0x8a3a2a, noBalconies: true });
  placeRowHouseHelper(-37.4, 125.4, Math.PI / 2, 4.2, 4.5, 5.0, 0xd66853, false);
  placeApartment(-37.8, 130.85, Math.PI / 2, 6.5, 3, 7.0, 0x9a5a44, 0xe8dcc8, true);

  createSeamlessBlockBase(32.05, 44.0, 116.05, 134.85, SW, courtyardPaverMat);
  placeCornerLamps(32.05, 44.0, 116.05, 134.85, 1.0);
  placeApartment(37.8, 120.0, -Math.PI / 2, 6.6, 3, 7.0, 0x7a9e7e, 0xf2ece0, true, { bays: true, noBalconies: true });
  placeNamedShop(37.6, 125.7, -Math.PI / 2, 'pizza', 4.4, 5.4, 6.0);
  placeRowHouseHelper(37.8, 130.0, -Math.PI / 2, 3.8, 4.4, 5.0, 0x5b83a1, true);

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
    [33.0,  100.5],
    [-33.0, 126.0],
    [33.0,  125.5]
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
    [33.0,  109.5],
    [-33.0, 118.5],
    [33.0,  133.5]
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

function mallTextPlane(label, bg, fg, w, h) {
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: getShopSignTexture({ label, bg, fg, aspect: w / h }), ...SIGN_MAT_OPTS }));
}

// Winkelwagentje (los, omrijdbaar op de parkeerplaats; of in de karrenstalling)
const cartWireMat = makeToonMat(0xb8c2cc);
const cartRedMat = makeToonMat(0xd62839);
function createShoppingCart() {
  const g = new THREE.Group();
  const basket = createOutlinedMesh(new THREE.BoxGeometry(0.6, 0.45, 0.9), cartWireMat, 0.015, false);
  basket.position.y = 0.75;
  g.add(basket);
  const inner = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.36, 0.8), makeToonMat(0x5a646e));
  inner.position.y = 0.8;
  g.add(inner);
  const handle = createOutlinedMesh(new THREE.BoxGeometry(0.62, 0.07, 0.07), cartRedMat, 0.01, false);
  handle.position.set(0, 1.05, -0.5);
  g.add(handle);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.06), cartWireMat);
  frame.position.set(0, 0.32, -0.38);
  g.add(frame);
  [[-0.25, 0.35], [0.25, 0.35], [-0.25, -0.35], [0.25, -0.35]].forEach(([wx, wz]) => {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 8), makeToonMat(0x2b2b2b));
    wheel.rotation.z = Math.PI * 0.5;
    wheel.position.set(wx, 0.08, wz);
    g.add(wheel);
  });
  return g;
}

function createProduceStand() {
  const g = new THREE.Group();
  const table = createOutlinedMesh(new THREE.BoxGeometry(2.4, 0.8, 1.0), makeToonMat(0x8a5a33), 0.025, false);
  table.position.y = 0.4;
  g.add(table);
  [[0xd94e3a, -0.8], [0xf4b41a, 0], [0x6cc04a, 0.8]].forEach(([c, x]) => {
    const crate = createOutlinedMesh(new THREE.BoxGeometry(0.7, 0.28, 0.8), makeToonMat(0xc9a273), 0.015, false);
    crate.position.set(x, 0.95, 0);
    crate.rotation.x = -0.25;
    g.add(crate);
    for (let k = 0; k < 6; k++) {
      const fruit = new THREE.Mesh(new THREE.SphereGeometry(0.11, 6, 5), makeToonMat(c));
      fruit.position.set(x - 0.22 + (k % 3) * 0.22, 1.12, -0.15 + Math.floor(k / 3) * 0.3);
      g.add(fruit);
    }
  });
  const awn = createOutlinedMesh(new THREE.BoxGeometry(2.6, 0.12, 1.3), makeToonMat(0x2d8a4e), 0.02, false);
  awn.position.set(0, 2.1, 0.1);
  awn.rotation.x = 0.2;
  g.add(awn);
  [-1.2, 1.2].forEach((px) => {
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.4, 0.07), streetPostMat);
    pole.position.set(px, 1.4, 0.55);
    g.add(pole);
  });
  return g;
}

function createSupermarketWing__build() {
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
  signBoard.position.set(0, h + 0.75, d * 0.5 - 0.05);
  g.add(signBoard);
  [-2.6, 2.6].forEach((sx) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.5, 0.14), trimWhiteMat);
    leg.position.set(sx, h + 0.2, d * 0.5 - 0.15);
    g.add(leg);
  });
  const superText = mallTextPlane('SUPERMARKET', '#2d8a4e', '#ffffff', 6.7, 0.82);
  superText.position.set(0, h + 0.75, d * 0.5 + 0.13);
  g.add(superText);

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

function createMallAtriumCenter__build() {
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
  const mallText = mallTextPlane('PINEWOOD MALL', '#c9643b', '#fff8ee', 7.3, 0.98);
  mallText.position.set(0, h - 0.85, d * 0.5 + 0.33);
  g.add(mallText);
  // Vlaggen op het dak
  [-3.6, 3.6].forEach((fx, i) => {
    const pole = createOutlinedMesh(new THREE.CylinderGeometry(0.05, 0.06, 3.0, 6), makeToonMat(0xd9d9d9), 0.015, false);
    pole.position.set(fx, h + 2.2, d * 0.5 - 0.6);
    g.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.7), new THREE.MeshBasicMaterial({ color: i ? 0x2d8a4e : 0xc9643b, side: THREE.DoubleSide }));
    flag.position.set(fx + 0.62, h + 3.3, d * 0.5 - 0.6);
    g.add(flag);
  });

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

function createMallRetailWing__build() {
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
    const shopBoard = createOutlinedMesh(new THREE.BoxGeometry(4.0, 0.62, 0.14), trimWhiteMat, 0.025, false);
    shopBoard.position.set(bt.x, 3.55, d * 0.5 + 0.08);
    g.add(shopBoard);
    const shopText = bt.x < 0 ? mallTextPlane('SHOES', '#d95d30', '#ffffff', 3.8, 0.52) : mallTextPlane('FASHION', '#3b7ea1', '#ffffff', 3.8, 0.52);
    shopText.position.set(bt.x, 3.55, d * 0.5 + 0.2);
    g.add(shopText);

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

// Bouwmarkt met houten gevel en een groene luifel (past bij Pinewood)
function createHardwareStore__build() {
  const g = new THREE.Group();
  const w = 11.6, h = 6.2, d = 9.0;
  const wood = makeToonMat(0x8a5a3c);
  const green = makeToonMat(0x2f6b45);
  const body = createOutlinedMesh(new THREE.BoxGeometry(w, h, d), wood, 0.055);
  body.position.y = h * 0.5;
  g.add(body);
  // Verticale planken
  for (let k = 0; k < 12; k++) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(0.06, h - 0.4, 0.05), makeToonMat(0x6e4630));
    plank.position.set(-w * 0.5 + 0.5 + k * ((w - 1) / 11), h * 0.5, d * 0.5 + 0.03);
    g.add(plank);
  }
  // Schuurdak
  const rShape = new THREE.Shape();
  rShape.moveTo(-(w * 0.5 + 0.4), 0);
  rShape.lineTo(0, 1.6);
  rShape.lineTo(w * 0.5 + 0.4, 0);
  rShape.closePath();
  const rGeo = new THREE.ExtrudeGeometry(rShape, { depth: d + 0.6, bevelEnabled: false });
  rGeo.translate(0, 0, -(d + 0.6) * 0.5);
  const roof = createOutlinedMesh(rGeo, registerSeasonalMat(0x2f4a3a, 0xf2f6fb), 0.05);
  roof.position.y = h;
  g.add(roof);
  // Grote schuifdeur en etalage
  const door = createOutlinedMesh(new THREE.BoxGeometry(3.4, 3.4, 0.12), green, 0.03, false);
  door.position.set(-2.6, 1.7, d * 0.5 + 0.1);
  g.add(door);
  const doorGlass = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.9), warmWindowMat);
  doorGlass.position.set(-2.6, 1.6, d * 0.5 + 0.17);
  g.add(doorGlass);
  houseWindows.push({ mesh: doorGlass, timer: Math.random() * 10 });
  const win = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.9), warmWindowMat);
  win.position.set(2.8, 1.8, d * 0.5 + 0.07);
  g.add(win);
  houseWindows.push({ mesh: win, timer: Math.random() * 10 });
  const awning = createOutlinedMesh(new THREE.BoxGeometry(w - 0.6, 0.2, 1.4), green, 0.035, false);
  awning.position.set(0, 3.75, d * 0.5 + 0.65);
  awning.rotation.x = 0.22;
  g.add(awning);
  const board = createOutlinedMesh(new THREE.BoxGeometry(9.4, 1.6, 0.16), green, 0.03, false);
  board.position.set(0, 5.05, d * 0.5 + 0.1);
  g.add(board);
  const textTop = mallTextPlane('PINEWOOD', '#2f6b45', '#f4c430', 4.4, 0.55);
  textTop.position.set(0, 5.5, d * 0.5 + 0.23);
  g.add(textTop);
  const text = mallTextPlane('HARDWARE', '#2f6b45', '#ffffff', 8.8, 0.85);
  text.position.set(0, 4.85, d * 0.5 + 0.23);
  g.add(text);
  g.userData.lightSpecs = { width: w * 0.94, yPos: h - 0.2, zFront: d * 0.5 + 0.3 };
  return g;
}

// Klein café met gestreepte luifel
function createMallCafe__build() {
  const g = new THREE.Group();
  const w = 5.6, h = 4.6, d = 8.0;
  const body = createOutlinedMesh(new THREE.BoxGeometry(w, h, d), makeToonMat(0xf2e6d0), 0.05);
  body.position.y = h * 0.5;
  g.add(body);
  const parapet = createOutlinedMesh(new THREE.BoxGeometry(w + 0.1, 0.5, d + 0.12), makeToonMat(0x2f7a8a), 0.04, false);
  parapet.position.y = h + 0.2;
  g.add(parapet);
  const win = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.0), warmWindowMat);
  win.position.set(0, 1.7, d * 0.5 + 0.07);
  g.add(win);
  houseWindows.push({ mesh: win, timer: Math.random() * 10 });
  for (let k = 0; k < 7; k++) {
    const stripe = createOutlinedMesh(new THREE.BoxGeometry(0.78, 0.12, 1.3), makeToonMat(k % 2 ? 0xf6f2ea : 0x2f7a8a), 0.015, false);
    stripe.position.set(-2.35 + k * 0.78, 3.15, d * 0.5 + 0.6);
    stripe.rotation.x = 0.3;
    g.add(stripe);
  }
  const board = createOutlinedMesh(new THREE.BoxGeometry(4.6, 0.8, 0.14), makeToonMat(0x2f7a8a), 0.025, false);
  board.position.set(0, 3.95, d * 0.5 + 0.08);
  g.add(board);
  const text = mallTextPlane('CAFÉ', '#2f7a8a', '#ffffff', 4.3, 0.7);
  text.position.set(0, 3.95, d * 0.5 + 0.2);
  g.add(text);
  g.userData.lightSpecs = { width: w * 0.94, yPos: h + 0.3, zFront: d * 0.5 + 0.2 };
  return g;
}

const MALL_SCALE = 1.0; // ware grootte: de mall wordt breder met extra panden, niet opgerekt
function buildGeneralStore() {
  const rl = (lx, lz, yw) => rotateLocal(lx * MALL_SCALE, lz * MALL_SCALE, yw);
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

  const pad = tagMap(new THREE.Mesh(new THREE.BoxGeometry(33.6, slabDepthH, 19.6), storeAsphaltMat), 'paved');
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

  // Karrenstalling met een rij in elkaar geschoven winkelwagentjes
  const corralRoof = createOutlinedMesh(new THREE.BoxGeometry(3.2, 0.12, 1.4), makeToonMat(0x2d8a4e), 0.02, false);
  corralRoof.position.set(-15.3, 2.0, -1.15);
  complexGroup.add(corralRoof);
  [-1.5, 1.5].forEach((px) => {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.9, 0.08), streetPostMat);
    post.position.set(-15.3 + px, 1.1, -1.15);
    complexGroup.add(post);
  });
  for (let k = 0; k < 5; k++) {
    const cart = createShoppingCart();
    cart.position.set(-16.6 + k * 0.6, 0.16, -1.15);
    cart.rotation.y = Math.PI * 0.5;
    // De mallgroep is alleen in lengte/breedte vergroot: wagentjes houden hun echte maat
    cart.scale.set(0.95 / MALL_SCALE, 0.95, 0.95 / MALL_SCALE);
    complexGroup.add(cart);
  }

  // Groente- en fruitkramen voor de supermarkt
  {
    const stand = createProduceStand();
    stand.position.set(-7.4, 0.16, -1.3);
    stand.scale.set(1 / MALL_SCALE, 1, 1 / MALL_SCALE);
    complexGroup.add(stand);
    const sp = rl(-7.4, -1.3, yaw);
    hardColliders.push({ x: baseX + sp.x, z: baseZ + sp.z, r: 1.1 });
  }

  // Reclamezuil naast de inrit met de winkels eronder
  const pylon = new THREE.Group();
  [-1.2, 1.2].forEach((px) => {
    const leg = createOutlinedMesh(new THREE.BoxGeometry(0.35, 8.0, 0.35), makeToonMat(0x52657a), 0.03);
    leg.position.set(px, 4.0, 0);
    pylon.add(leg);
  });
  const pylonTop = createOutlinedMesh(new THREE.BoxGeometry(4.2, 1.4, 0.4), makeToonMat(0xc9643b), 0.04, false);
  pylonTop.position.y = 7.6;
  pylon.add(pylonTop);
  [1, -1].forEach((side) => {
    const t = mallTextPlane('PINEWOOD MALL', '#c9643b', '#fff8ee', 4.0, 1.2);
    t.position.set(0, 7.6, side * 0.25);
    if (side < 0) t.rotation.y = Math.PI;
    pylon.add(t);
  });
  [['SUPERMARKET', '#2d8a4e'], ['SHOES', '#d95d30'], ['FASHION', '#3b7ea1']].forEach(([label, bg], i) => {
    const panel = createOutlinedMesh(new THREE.BoxGeometry(3.6, 0.6, 0.3), trimWhiteMat, 0.02, false);
    panel.position.y = 6.4 - i * 0.72;
    pylon.add(panel);
    [1, -1].forEach((side) => {
      const t = mallTextPlane(label, bg, '#ffffff', 3.4, 0.5);
      t.position.set(0, 6.4 - i * 0.72, side * 0.2);
      if (side < 0) t.rotation.y = Math.PI;
      pylon.add(t);
    });
  });
  // De zuil staat buiten de geschaalde groep, net naast de inrit aan de rand van de parkeerplaats
  {
    const pp = rotateLocal(-9.5, 21.0, yaw);
    pylon.position.set(baseX + pp.x, surfaceY, baseZ + pp.z);
    pylon.rotation.y = yaw;
    scene.add(pylon);
    hardColliders.push({ x: baseX + pp.x, z: baseZ + pp.z, r: 1.4 });
  }

  // Losse winkelwagentjes op de parkeerplaats (omrijdbaar)
  [[-5.5, 7.0, 0.4], [6.8, 14.2, 2.2], [-12.5, 14.0, -1.0]].forEach(([lx, lz, rot]) => {
    const lp = rl(lx, lz, yaw);
    const cart = createShoppingCart();
    const wx = baseX + lp.x;
    const wz = baseZ + lp.z;
    cart.position.set(wx, surfaceY, wz);
    cart.rotation.y = yaw + rot;
    scene.add(cart);
    registerDestructible(cart, wx, surfaceY, wz, 0.55, 'small', 6, 'Shopping cart');
  });

  complexGroup.updateMatrixWorld(true);
  [superWing, atrium, retailWing].forEach((wing) => {
    addRoofStringLights(wing, wing.userData.lightSpecs.width, wing.userData.lightSpecs.yPos, wing.userData.lightSpecs.zFront);
  });

  // ---- Uitbreiding rechts: bouwmarkt met tuincentrum, een café en een tweede parkeervak ----
  {
    const extPad = tagMap(new THREE.Mesh(new THREE.BoxGeometry(19.8, slabDepthH, 19.6), storeAsphaltMat), 'paved');
    extPad.position.set(26.5, -slabDepthH * 0.5, 9.8);
    extPad.receiveShadow = true;
    complexGroup.add(extPad);
    const extProm = createOutlinedMesh(new THREE.BoxGeometry(19.8, slabDepthH + 0.16, 2.3), sidewalkMat, 0.042, false, true);
    extProm.position.set(26.5, -slabDepthH * 0.5 + 0.08, -1.15);
    complexGroup.add(extProm);
    const extPlinth = createOutlinedMesh(new THREE.BoxGeometry(19.8, slabDepthH + 0.16, 9.8), stoneMat, 0.04, false, true);
    extPlinth.position.set(26.5, -slabDepthH * 0.5 + 0.08, -7.2);
    complexGroup.add(extPlinth);

    const hardware = createHardwareStore();
    hardware.position.set(23.4, 0.16, -6.9);
    complexGroup.add(hardware);
    const cafe = createMallCafe();
    cafe.position.set(32.4, 0.16, -6.4);
    complexGroup.add(cafe);
    [19.6, 23.4, 27.2].forEach((cx) => {
      const wc = rl(cx, -6.9, yaw);
      hardColliders.push({ x: baseX + wc.x, z: baseZ + wc.z, r: 4.4 });
    });
    {
      const wc = rl(32.4, -6.6, yaw);
      hardColliders.push({ x: baseX + wc.x, z: baseZ + wc.z, r: 3.4 });
    }

    // Tuincentrum-uitstalling voor de bouwmarkt: planten in potten op pallets, stapel brandhout
    const potMat = makeToonMat(0xb8643a);
    const palletMat = makeToonMat(0xc9a06a);
    const plantMats = [makeToonMat(0x4f8a3c), makeToonMat(0x6a9a40), makeToonMat(0x3f6e3c)];
    [[19.4, -0.9], [21.9, -0.9]].forEach(([px, pz], pi) => {
      const pallet = createOutlinedMesh(new THREE.BoxGeometry(2.0, 0.18, 1.1), palletMat, 0.02, false);
      pallet.position.set(px, 0.25, pz);
      complexGroup.add(pallet);
      for (let k = 0; k < 6; k++) {
        const ox = -0.7 + (k % 3) * 0.7;
        const oz = k < 3 ? -0.25 : 0.25;
        const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.3, 7), potMat);
        pot.position.set(px + ox, 0.5, pz + oz);
        complexGroup.add(pot);
        const plant = createOutlinedMesh(new THREE.IcosahedronGeometry(0.28, 0), plantMats[(k + pi) % 3], 0.015, false);
        plant.position.set(px + ox, 0.8, pz + oz);
        complexGroup.add(plant);
      }
    });
    const woodMat = makeToonMat(0x8a5a36);
    const woodEndMat = makeToonMat(0xd8b07a);
    for (let r = 0; r < 3; r++) {
      for (let k = 0; k < 4 - r; k++) {
        const log = createOutlinedMesh(new THREE.CylinderGeometry(0.16, 0.16, 1.1, 7), woodMat, 0.012, false);
        log.rotation.x = Math.PI / 2;
        log.position.set(23.0 + k * 0.34 + r * 0.17, 0.33 + r * 0.29, -1.0);
        complexGroup.add(log);
        const end = new THREE.Mesh(new THREE.CircleGeometry(0.15, 7), woodEndMat);
        end.position.set(23.0 + k * 0.34 + r * 0.17, 0.33 + r * 0.29, -0.44);
        complexGroup.add(end);
      }
    }
    // Café-terrasje
    [[30.6, -0.8], [33.6, -0.8]].forEach(([tx, tz], k) => {
      const top = createOutlinedMesh(new THREE.CylinderGeometry(0.5, 0.5, 0.06, 10), makeToonMat(0xf6f2ea), 0.012, false);
      top.position.set(tx, 0.92, tz);
      complexGroup.add(top);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.3, 6), streetPostMat);
      leg.position.set(tx, 1.3, tz);
      complexGroup.add(leg);
      const umb = createOutlinedMesh(new THREE.ConeGeometry(1.2, 0.45, 8), makeToonMat(k ? 0x2f7a8a : 0xf4b41a), 0.02, false);
      umb.position.set(tx, 2.5, tz);
      complexGroup.add(umb);
    });

  }

  [-13.8, -8.2, -2.7, 2.7, 8.2, 13.8].forEach((cx) => {
    const wc = rl(cx, -6.8, yaw);
    hardColliders.push({ x: baseX + wc.x, z: baseZ + wc.z, r: 4.35 * MALL_SCALE });
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
  // Tweede parkeervak bij de uitbreiding rechts
  addParkingRow([19.6, 21.95, 24.3, 26.65, 29.0, 31.35, 33.7], 10.8, 1.5);
  addParkingRow([20.8, 23.15, 25.5, 27.85, 30.2, 32.55], 2.2, -1.5);

  // Plantenstroken rondom de parkeerplaats. De lange stroken stoppen precies waar de voorstroken beginnen,
  // zodat de hoeken netjes als een L aansluiten. Opening voor de inrit (midden) en een doorgang naar de bouwmarkt.
  const STRIP = 1.4;
  const FRONT_Z0 = 18.2; // voorstrook loopt van 18.2 tot 19.6
  const planterStrips = [
    // [x0, x1, z0, z1]
    [-16.7, -15.3, 0, FRONT_Z0],       // linkerrand
    [-16.7, -5.9, FRONT_Z0, 19.6],     // voor links (tot de inrit)
    [5.9, 16.7, FRONT_Z0, 19.6],       // voor rechts (vanaf de inrit)
    [15.3, 16.7, 0, 5.2],              // middenstrook (deel 1)
    [15.3, 16.7, 12.9, FRONT_Z0],      // middenstrook (deel 2) — daartussen de doorgang
    [16.7, 36.4, FRONT_Z0, 19.6],      // voor bouwmarkt-vak
    [35.0, 36.4, 0, FRONT_Z0]          // rechterrand
  ];
  const hedgeMat = registerSeasonalMat(0x3f6e3c, 0xe8eff4);
  planterStrips.forEach(([x0, x1, z0, z1]) => {
    const w = x1 - x0;
    const d = z1 - z0;
    const cx = (x0 + x1) * 0.5;
    const cz = (z0 + z1) * 0.5;
    const curb = createOutlinedMesh(new THREE.BoxGeometry(w, 0.26, d), stoneMat, 0.025, false, true);
    curb.position.set(cx, 0.13, cz);
    complexGroup.add(curb);
    const grass = new THREE.Mesh(new THREE.BoxGeometry(w - 0.24, 0.06, d - 0.24), blockLawnMat);
    grass.position.set(cx, 0.28, cz);
    complexGroup.add(grass);
    // Lage haag in het midden van de strook (0,7 m breed), doorlopend tot de hoek
    const along = w > d;
    const hedge = createOutlinedMesh(new THREE.BoxGeometry(along ? w - 0.3 : 0.7, 0.5, along ? 0.7 : d - 0.3), hedgeMat, 0.025, false);
    hedge.position.set(cx, 0.55, cz);
    complexGroup.add(hedge);
  });
  // Bomen: overal dezelfde regelmaat (~5,5 m), niet op de plek van een lantaarn
  const treeSpots = [
    [-16.0, 1.6], [-16.0, 9.6], [-16.0, 17.0],
    [-13.0, 18.9], [-8.6, 18.9],
    [8.6, 18.9], [13.0, 18.9],
    [16.0, 1.6], [16.0, 17.0],
    [20.4, 18.9], [25.9, 18.9], [31.4, 18.9],
    [35.7, 1.6], [35.7, 9.6], [35.7, 17.0]
  ];
  treeSpots.forEach(([tx, tz]) => {
    const wp = rl(tx, tz, yaw);
    const tree = createParkTree();
    const ty = surfaceY + 0.3;
    tree.position.set(baseX + wp.x, ty, baseZ + wp.z);
    tree.scale.setScalar(1.15);
    scene.add(tree);
    registerDestructible(tree, baseX + wp.x, ty, baseZ + wp.z, 0.7, 'tree', 15, 'Parking lot tree');
    markLastPlanted();
  });
  // Lantaarns: op alle drie de lange stroken op dezelfde hoogtes (z = 4,3 en 14,5)
  [[-16.0, 4.3], [-16.0, 14.5], [16.0, 4.3], [16.0, 14.5], [35.7, 4.3], [35.7, 14.5]].forEach(([lx, lz]) => {
    const wp = rl(lx, lz, yaw);
    createSmashableStreetLampAt(baseX + wp.x, surfaceY + 0.3, baseZ + wp.z);
  });

  const promY = surfaceY + 0.16;
  [-15.8, -5.4, 5.4, 15.8, 26.2, 35.6].forEach((lx) => {
    const wp = rl(lx, -0.5, yaw);
    createSmashableStreetLampAt(baseX + wp.x, promY, baseZ + wp.z);
  });

  [-7.8, 7.8].forEach((lx) => {
    const wp = rl(lx, -1.5, yaw);
    createBenchAt(baseX + wp.x, promY, baseZ + wp.z, yaw);
  });

  [-13.0, -1.9, 13.0].forEach((lx) => {
    const wp = rl(lx, -0.6, yaw);
    createTrashBinAt(baseX + wp.x, promY, baseZ + wp.z);
  });
}
buildGeneralStore();

// =========================================================
// FASTFOOD-DINER LANGS DE STRANDBOULEVARD: hoge reclamezuil, rood-witte luifel,
// reuzenburger op het dak, drive-thru en een handvol parkeervakken
// =========================================================
function makeDinerSignTexture() {
  return makeBurgerLogoTexture();
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


function createDinerPylon() {
  const g = new THREE.Group();
  [-1.6, 1.6].forEach((px) => {
    const pole = createOutlinedMesh(new THREE.BoxGeometry(0.45, 9.0, 0.45), dinerRedMat, 0.035);
    pole.position.set(px, 4.5, 0);
    g.add(pole);
  });
  const signMat = new THREE.MeshBasicMaterial({ map: makeDinerSignTexture(), ...SIGN_MAT_OPTS });
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
  const toWorld = (lx, lz) => {
    const w = rotateLocal(lx, lz, yaw);
    return { x: baseX + w.x, z: baseZ + w.z };
  };
  const collide = (lx, lz, r) => {
    const p = toWorld(lx, lz);
    hardColliders.push({ x: p.x, z: p.z, r });
  };

  // ---- Groot asfaltplein tot aan de weg ----
  const roadEdgeLZ = lot.dist - 4.6;
  const slabH = 3.2;
  const padMinLZ = -17;
  // Plein stopt voor de weg; de oprit verbindt het met de weg. Krap rond restaurant, drive-thru en terras.
  const padFrontLZ = 14.6;
  const padDepth = padFrontLZ - padMinLZ;
  const padX0 = -29.8;
  const padX1 = 10.0;
  const pad = tagMap(new THREE.Mesh(new THREE.BoxGeometry(padX1 - padX0, slabH, padDepth), storeAsphaltMat), 'paved');
  pad.position.set((padX0 + padX1) * 0.5, -slabH * 0.5, padMinLZ + padDepth * 0.5);
  pad.receiveShadow = true;
  g.add(pad);
  const plinth = createOutlinedMesh(new THREE.BoxGeometry(17, slabH + 0.16, 11), sidewalkMat, 0.04, false, true);
  plinth.position.set(-6, -slabH * 0.5 + 0.08, -6.5);
  g.add(plinth);

  // ---- PINE BURGER restaurant ----
  const restaurant = createBurgerRestaurant();
  restaurant.position.set(-6, 0.16, -6.5);
  g.add(restaurant);
  // Botsranden die de muren strak volgen (zodat de drive-thru-baan vrij blijft)
  [-11.5, -8.5, -5.5, -1.7].forEach((cx) => [-8.5, -4.5].forEach((cz) => collide(cx, cz, 3.2)));

  // ---- Drive-thru baan om het restaurant (donkerder asfalt, witte randlijnen en pijlen) ----
  const laneMat = makeToonMat(0x2f2d33, { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const lanes = [
    [5.6, -7.5, 3.6, 17.0],   // rechts, van voren naar achter
    [-10.4, -14.6, 35.6, 3.6], // achterlangs
    [-26.4, -7.7, 3.6, 17.4]   // links (voorbij het terras), terug naar voren
  ];
  lanes.forEach(([cx, cz, w, d]) => {
    const lane = new THREE.Mesh(new THREE.BoxGeometry(w, 0.04, d), laneMat);
    lane.position.set(cx, 0.02, cz);
    g.add(lane);
  });
  const arrowGeo = new THREE.ConeGeometry(0.55, 1.2, 3);
  arrowGeo.rotateX(-Math.PI / 2);
  [[5.6, -2, 0], [5.6, -10, 0], [-3, -14.6, Math.PI / 2], [-12, -14.6, Math.PI / 2], [-21, -14.6, Math.PI / 2], [-26.4, -10, Math.PI], [-26.4, -2, Math.PI]].forEach(([ax, az, rot]) => {
    const arrow = new THREE.Mesh(arrowGeo, storeLineMat);
    arrow.scale.y = 0.05;
    arrow.position.set(ax, 0.06, az);
    arrow.rotation.y = rot;
    g.add(arrow);
  });
  const driveText = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.9), new THREE.MeshBasicMaterial({ map: getShopSignTexture({ label: 'DRIVE THRU', bg: '#2f2d33', fg: '#ffffff' }), ...SIGN_MAT_OPTS }));
  driveText.rotation.x = -Math.PI / 2;
  driveText.rotation.z = Math.PI / 2;
  driveText.position.set(5.6, 0.07, 0.5);
  g.add(driveText);

  // Menubord met overkapping + speakerpaal langs de baan
  const menuBoard = createDriveThruMenu();
  menuBoard.scale.setScalar(1.5);
  menuBoard.position.set(8.4, 0, -6.5);
  menuBoard.rotation.y = -Math.PI * 0.5;
  g.add(menuBoard);
  collide(8.4, -6.5, 0.8);
  const canopy = createOutlinedMesh(new THREE.BoxGeometry(2.6, 0.18, 2.0), dinerRedMat, 0.025, false);
  canopy.position.set(8.4, 3.9, -6.5);
  g.add(canopy);
  const speaker = createOutlinedMesh(new THREE.BoxGeometry(0.3, 1.2, 0.3), dinerYellowMat, 0.02, false);
  speaker.position.set(8.0, 0.6, -9.6);
  g.add(speaker);


  // ---- Eenvoudig terras tegen de zijgevel: tegelvloer, tafeltjes met parasols, haagje en één lichtslinger ----
  {
    const x0 = -24.0;
    const x1 = -14.7;
    const z0 = -12.4;
    const z1 = 2.4;
    const floor = createOutlinedMesh(new THREE.BoxGeometry(x1 - x0, 0.16, z1 - z0), makeToonMat(0xe2d6c2), 0.02, false, true);
    floor.position.set((x0 + x1) * 0.5, 0.08, (z0 + z1) * 0.5);
    g.add(floor);
    // Lage haag langs de buitenkant (tegen de drive-thru), met een opening aan de voorkant
    const hedgeMat = registerSeasonalMat(0x3f6e3c, 0xe8eff4);
    const hedge = createOutlinedMesh(new THREE.BoxGeometry(0.7, 0.8, z1 - z0 - 0.4), hedgeMat, 0.025, false);
    hedge.position.set(x0 + 0.45, 0.56, (z0 + z1) * 0.5);
    g.add(hedge);
    const hedgeBack = createOutlinedMesh(new THREE.BoxGeometry(x1 - x0 - 1.0, 0.8, 0.7), hedgeMat, 0.025, false);
    hedgeBack.position.set((x0 + x1) * 0.5 + 0.3, 0.56, z0 + 0.45);
    g.add(hedgeBack);
    for (let z = z0 + 0.5; z <= z1 - 0.4; z += 2.0) collide(x0 + 0.45, z, 0.5);
    for (let x = x0 + 1.5; x <= x1 - 0.6; x += 2.0) collide(x, z0 + 0.45, 0.5);
    // Tafeltjes met parasols (los, omrijdbaar)
    const placeTable = (lx, lz, hex) => {
      const t = new THREE.Group();
      const top = createOutlinedMesh(new THREE.CylinderGeometry(0.6, 0.6, 0.08, 12), makeToonMat(0xf6f2ea), 0.015, false);
      top.position.y = 0.78;
      t.add(top);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 6), streetPostMat);
      leg.position.y = 1.2;
      t.add(leg);
      const umb = createOutlinedMesh(new THREE.ConeGeometry(1.4, 0.55, 8), makeToonMat(hex), 0.025, false);
      umb.position.y = 2.45;
      t.add(umb);
      [-0.85, 0.85].forEach((sx) => {
        const stool = createOutlinedMesh(new THREE.CylinderGeometry(0.22, 0.22, 0.45, 8), makeToonMat(hex), 0.015, false);
        stool.position.set(sx, 0.23, 0);
        t.add(stool);
      });
      const w = toWorld(lx, lz);
      t.position.set(w.x, surfaceY + 0.16, w.z);
      t.rotation.y = yaw;
      scene.add(t);
      registerDestructible(t, w.x, surfaceY + 0.16, w.z, 0.9, 'small', 8, 'Patio table');
    };
    [[-20.8, -8.6, 0xd62839], [-17.4, -8.6, 0xffd23f], [-20.8, -4.0, 0xffd23f], [-17.4, -4.0, 0xd62839], [-20.8, 0.4, 0xd62839], [-17.4, 0.4, 0xffd23f]]
      .forEach(([lx, lz, c]) => placeTable(lx, lz, c));
    // Eén lichtslinger in de lengte van het terras
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe08a });
    const bulbGeo = new THREE.SphereGeometry(0.09, 6, 5);
    [z0 + 1.0, z1 - 0.6].forEach((pz) => {
      const pole = createOutlinedMesh(new THREE.CylinderGeometry(0.06, 0.07, 3.6, 6), makeToonMat(0x3a3a3a), 0.015, false);
      pole.position.set(x0 + 1.2, 1.9, pz);
      g.add(pole);
    });
    for (let k = 0; k <= 14; k++) {
      const f = k / 14;
      const bulb = new THREE.Mesh(bulbGeo, bulbMat);
      bulb.position.set(x0 + 1.2, 3.6 - Math.sin(f * Math.PI) * 0.6, THREE.MathUtils.lerp(z0 + 1.0, z1 - 0.6, f));
      g.add(bulb);
    }
  }

  // ---- Parkeervakken (twee rijen voor het restaurant) ----
  const bayW = 2.5;
  const bayD = 4.0;
  const stripeGeo = new THREE.PlaneGeometry(0.16, bayD);
  const stopGeo = new THREE.BoxGeometry(1.55, 0.1, 0.22);
  // Nieuwe indeling: rij A voor de pui (naast het terras), rij B langs de voorkant;
  // daartussen een rijbaan van ~5 m die de uitgang van de drive-thru (linksvoor) verbindt met de inrit,
  // en rechts van de inrit een vrije strook naar het begin van de drive-thru.
  // stop: -1 = stootrand aan de kant van het restaurant (rij A, je rijdt erin richting de pui),
  //       +1 = stootrand aan de wegkant/zeekant (rij B en C, je rijdt erin richting de weg)
  const rows = [
    { z: 2.5, x0: -13.5, n: 5, stop: -1 },  // rij A: x -13,5 .. -1
    { z: 11.7, x0: -24.0, n: 8, stop: 1 },  // rij B: x -24 .. -4
    { z: 11.7, x0: 4.8, n: 2, stop: 1 }     // rij C: twee vakken rechts van de inrit
  ];
  rows.forEach(({ z: rowZ, x0, n, stop: stopSide }) => {
    for (let k = 0; k <= n; k++) {
      const lx = x0 + k * bayW;
      const stripe = new THREE.Mesh(stripeGeo, storeLineMat);
      stripe.rotation.x = -Math.PI * 0.5;
      stripe.position.set(lx, 0.02, rowZ);
      g.add(stripe);
      if (k < n) {
        const stop = new THREE.Mesh(stopGeo, wheelStopMat);
        stop.position.set(lx + bayW * 0.5, 0.05, rowZ + stopSide * (bayD * 0.5 - 0.35));
        g.add(stop);
      }
    }
  });
  // Pijlen op de rijbaan: van de drive-thru-uitgang naar de inrit
  [[-22, 7.1], [-12, 7.1], [-3, 7.1]].forEach(([ax, az]) => {
    const arrow = new THREE.Mesh(arrowGeo, storeLineMat);
    arrow.scale.y = 0.05;
    arrow.position.set(ax, 0.06, az);
    arrow.rotation.y = -Math.PI / 2;
    g.add(arrow);
  });

  // ---- Reclamezuilen aan de weg ----
  const pylon = createDinerPylon();
  pylon.scale.setScalar(1.25);
  pylon.position.set(-27.6, 0, roadEdgeLZ - 5.2);
  pylon.rotation.y = Math.PI * 0.5;
  g.add(pylon);
  collide(-27.6, roadEdgeLZ - 5.2, 2.3);

  g.updateMatrixWorld(true);
  addRoofStringLights(restaurant, restaurant.userData.lightSpecs.width, restaurant.userData.lightSpecs.yPos, restaurant.userData.lightSpecs.zFront);

  // Nachtgloed van de borden
  [toWorld(-27.6, roadEdgeLZ - 5.2), toWorld(-6, 0)].forEach((p, i) => {
    const glow = new THREE.PointLight(0xff6a4a, 0, 30, 1.6);
    glow.position.set(p.x, surfaceY + (i === 0 ? 9 : 4.5), p.z);
    scene.add(glow);
    dinerNightLights.push(glow);
  });
}

// ---- Bouwstenen voor het fastfoodplein ----
function makeBurgerLogoTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#d62839';
  ctx.fillRect(0, 0, 512, 256);
  // Burgericoon
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath();
  ctx.arc(110, 128, 86, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e0a04a';
  ctx.beginPath();
  ctx.ellipse(110, 108, 56, 30, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = '#6cc04a';
  ctx.fillRect(54, 112, 112, 10);
  ctx.fillStyle = '#5a3220';
  ctx.fillRect(56, 122, 108, 16);
  ctx.fillStyle = '#e0a04a';
  ctx.fillRect(58, 140, 104, 16);
  // Naam
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = '900 64px system-ui, sans-serif';
  ctx.fillText('PINE', 216, 96);
  ctx.fillText('BURGER', 216, 160);
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillText('DRIVE THRU · 24/7', 218, 216);
  const tex = Object.assign(new THREE.CanvasTexture(canvas), { colorSpace: THREE.SRGBColorSpace });
  tex.needsUpdate = true;
  return tex;
}

function makeCoffeeLogoTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f6f2ea';
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = '#1f6b45';
  ctx.beginPath();
  ctx.arc(128, 128, 120, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(84, 88, 70, 72);
  ctx.beginPath();
  ctx.arc(164, 120, 18, -Math.PI / 2, Math.PI / 2);
  ctx.lineWidth = 9;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.font = '900 30px system-ui, sans-serif';
  ctx.fillText('PINE COFFEE', 128, 200);
  const tex = Object.assign(new THREE.CanvasTexture(canvas), { colorSpace: THREE.SRGBColorSpace });
  tex.needsUpdate = true;
  return tex;
}

function createBurgerRestaurant__build() {
  const g = new THREE.Group();
  const w = 15.0, h = 4.8, d = 9.0;
  const body = createOutlinedMesh(new THREE.BoxGeometry(w, h, d), makeToonMat(0xfdf6ec), 0.055);
  body.position.y = h * 0.5;
  g.add(body);
  const base = createOutlinedMesh(new THREE.BoxGeometry(w + 0.12, 1.0, d + 0.12), dinerRedMat, 0.04, false);
  base.position.y = 0.5;
  g.add(base);
  // Brede rode dakrand met gele streep en het logo
  const roofBand = createOutlinedMesh(new THREE.BoxGeometry(w + 0.8, 1.5, d + 0.8), dinerRedMat, 0.05);
  roofBand.position.y = h + 0.6;
  g.add(roofBand);
  const yellowStripe = new THREE.Mesh(new THREE.BoxGeometry(w + 0.84, 0.22, d + 0.84), dinerYellowMat);
  yellowStripe.position.y = h - 0.05;
  g.add(yellowStripe);
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 2.6), new THREE.MeshBasicMaterial({ map: makeBurgerLogoTexture(), ...SIGN_MAT_OPTS }));
  logo.position.set(0, h + 0.9, d * 0.5 + 0.46);
  g.add(logo);
  // Grote glazen pui met gele kozijnen en de entree
  [-5.2, -1.9, 1.9, 5.2].forEach((wx) => {
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.6), warmWindowMat);
    glass.position.set(wx, 2.2, d * 0.5 + 0.06);
    g.add(glass);
    houseWindows.push({ mesh: glass, timer: Math.random() * 10 });
  });
  const entrance = createOutlinedMesh(new THREE.BoxGeometry(1.6, 3.2, 0.2), dinerYellowMat, 0.03, false);
  entrance.position.set(0, 1.6, d * 0.5 + 0.1);
  g.add(entrance);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 2.7), warmWindowMat);
  door.position.set(0, 1.4, d * 0.5 + 0.22);
  g.add(door);
  // Opvallende gele vin met het logo-icoon boven de entree (eigen merkteken)
  const fin = createOutlinedMesh(new THREE.BoxGeometry(0.5, 3.4, 1.6), dinerYellowMat, 0.04);
  fin.position.set(w * 0.5 - 1.4, h + 2.6, d * 0.5 - 0.6);
  g.add(fin);
  const finDisc = createOutlinedMesh(new THREE.CylinderGeometry(0.9, 0.9, 0.6, 16), dinerRedMat, 0.03, false);
  finDisc.rotation.z = Math.PI / 2;
  finDisc.position.set(w * 0.5 - 1.4, h + 4.0, d * 0.5 - 0.6);
  g.add(finDisc);
  // Afhaalloket achterop met gele luifel
  const pickup = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.2), warmWindowMat);
  pickup.position.set(4.0, 1.8, -d * 0.5 - 0.06);
  pickup.rotation.y = Math.PI;
  g.add(pickup);
  const pickAwn = createOutlinedMesh(new THREE.BoxGeometry(2.6, 0.15, 1.2), dinerYellowMat, 0.025, false);
  pickAwn.position.set(4.0, 2.75, -d * 0.5 - 0.6);
  g.add(pickAwn);
  // De reuzenburger blijft het herkenningspunt op het dak
  const burger = new THREE.Group();
  const bottomBun = createOutlinedMesh(new THREE.CylinderGeometry(1.5, 1.4, 0.5, 14), bunMat, 0.04);
  bottomBun.position.y = 0.25;
  burger.add(bottomBun);
  const patty = createOutlinedMesh(new THREE.CylinderGeometry(1.62, 1.62, 0.42, 14), pattyMat, 0.04);
  patty.position.y = 0.71;
  burger.add(patty);
  const lettuce = createOutlinedMesh(new THREE.CylinderGeometry(1.75, 1.7, 0.16, 14), lettuceMat, 0.03, false);
  lettuce.position.y = 1.0;
  burger.add(lettuce);
  const topBun = createOutlinedMesh(new THREE.SphereGeometry(1.55, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), bunMat, 0.045);
  topBun.position.y = 1.08;
  topBun.scale.y = 0.85;
  burger.add(topBun);
  burger.position.set(-4.5, h + 1.35, -0.8);
  g.add(burger);
  g.userData.lightSpecs = { width: w * 0.94, yPos: h - 0.2, zFront: d * 0.5 + 0.5 };
  return g;
}

function createCoffeeKiosk__build() {
  const g = new THREE.Group();
  const greenMat = makeToonMat(0x1f6b45);
  const body = createOutlinedMesh(new THREE.BoxGeometry(6.4, 3.4, 4.6), makeToonMat(0xf6f2ea), 0.045);
  body.position.y = 1.7;
  g.add(body);
  const lower = createOutlinedMesh(new THREE.BoxGeometry(6.5, 1.1, 4.7), greenMat, 0.03, false);
  lower.position.y = 0.55;
  g.add(lower);
  const roof = createOutlinedMesh(new THREE.BoxGeometry(7.2, 0.35, 5.4), greenMat, 0.04);
  roof.position.y = 3.6;
  g.add(roof);
  for (let k = 0; k < 8; k++) {
    const stripe = createOutlinedMesh(new THREE.BoxGeometry(0.78, 0.12, 1.2), k % 2 ? makeToonMat(0xf6f2ea) : greenMat, 0.015, false);
    stripe.position.set(-2.75 + k * 0.78, 2.7, 2.85);
    stripe.rotation.x = 0.3;
    g.add(stripe);
  }
  const win = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 1.3), warmWindowMat);
  win.position.set(0, 1.9, 2.32);
  g.add(win);
  houseWindows.push({ mesh: win, timer: Math.random() * 10 });
  // Drive-thru loket aan de zijkant
  const side = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.1), warmWindowMat);
  side.position.set(3.22, 1.9, 0);
  side.rotation.y = Math.PI / 2;
  g.add(side);
  // Rond logobord op het dak
  const logo = new THREE.Mesh(new THREE.CircleGeometry(1.25, 24), new THREE.MeshBasicMaterial({ map: makeCoffeeLogoTexture(), ...SIGN_MAT_OPTS }));
  logo.position.set(0, 4.95, 0.3);
  g.add(logo);
  const logoBack = createOutlinedMesh(new THREE.CylinderGeometry(1.35, 1.35, 0.25, 24), greenMat, 0.03, false);
  logoBack.rotation.x = Math.PI / 2;
  logoBack.position.set(0, 4.95, 0.12);
  g.add(logoBack);
  return g;
}

function createCoffeePylon() {
  const g = new THREE.Group();
  const pole = createOutlinedMesh(new THREE.BoxGeometry(0.35, 5.5, 0.35), makeToonMat(0x1f6b45), 0.03);
  pole.position.y = 2.75;
  g.add(pole);
  const tex = makeCoffeeLogoTexture();
  [1, -1].forEach((side) => {
    const face = new THREE.Mesh(new THREE.CircleGeometry(1.3, 24), new THREE.MeshBasicMaterial({ map: tex, ...SIGN_MAT_OPTS }));
    face.position.set(0, 6.4, side * 0.2);
    if (side < 0) face.rotation.y = Math.PI;
    g.add(face);
  });
  const ring = createOutlinedMesh(new THREE.CylinderGeometry(1.42, 1.42, 0.3, 24), makeToonMat(0x1f6b45), 0.03, false);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 6.4;
  g.add(ring);
  return g;
}


export const dinerNightLights = [];
buildRoadsideDiner();

// PINE COFFEE: losse drive-thru koffiekiosk aan de Prairie Road bij Moose Lake
function buildCoffeeStop() {
  const lot = ruralLots.find((l) => l.type === 'coffee');
  if (!lot) return;
  const { x: baseX, z: baseZ, yaw } = lot;
  const surfaceY = lot.roadY - 0.02;
  const g = new THREE.Group();
  g.position.set(baseX, surfaceY, baseZ);
  g.rotation.y = yaw;
  scene.add(g);
  const toWorld = (lx, lz) => {
    const w = rotateLocal(lx, lz, yaw);
    return { x: baseX + w.x, z: baseZ + w.z };
  };
  const collide = (lx, lz, r) => {
    const p = toWorld(lx, lz);
    hardColliders.push({ x: p.x, z: p.z, r });
  };
  const roadEdgeLZ = lot.dist - 4.6;
  const slabH = 3.2;
  const padMinLZ = -8;
  // Het plein stopt een stuk voor de weg; een oprit (asfalt-inrit) verbindt het met de weg
  const padFrontLZ = 8.0;
  const padDepth = padFrontLZ - padMinLZ;
  const pad = tagMap(new THREE.Mesh(new THREE.BoxGeometry(16, slabH, padDepth), storeAsphaltMat), 'paved');
  pad.position.set(-1, -slabH * 0.5, padMinLZ + padDepth * 0.5);
  pad.receiveShadow = true;
  g.add(pad);

  const kiosk = createCoffeeKiosk();
  kiosk.position.set(-2, 0.16, -4);
  g.add(kiosk);
  collide(-2, -4, 3.4);

  // Groen-wit terrasje (omrijdbaar), met uitzicht richting het meer
  const placeTable = (lx, lz, hex) => {
    const t = new THREE.Group();
    const top = createOutlinedMesh(new THREE.CylinderGeometry(0.6, 0.6, 0.08, 12), makeToonMat(0xf6f2ea), 0.015, false);
    top.position.y = 0.78;
    t.add(top);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 6), streetPostMat);
    leg.position.y = 1.2;
    t.add(leg);
    const umb = createOutlinedMesh(new THREE.ConeGeometry(1.4, 0.55, 8), makeToonMat(hex), 0.025, false);
    umb.position.y = 2.45;
    t.add(umb);
    [-0.85, 0.85].forEach((sx) => {
      const stool = createOutlinedMesh(new THREE.CylinderGeometry(0.22, 0.22, 0.45, 8), makeToonMat(hex), 0.015, false);
      stool.position.set(sx, 0.23, 0);
      t.add(stool);
    });
    const w = toWorld(lx, lz);
    t.position.set(w.x, surfaceY, w.z);
    t.rotation.y = yaw;
    scene.add(t);
    registerDestructible(t, w.x, surfaceY, w.z, 0.9, 'small', 8, 'Patio table');
  };
  [[-7.2, -5.5, 0x2f7a4e], [-7.2, -1.5, 0xf6f2ea]].forEach(([lx, lz, c]) => placeTable(lx, lz, c));

  // Drie parkeervakjes
  const stripeGeo = new THREE.PlaneGeometry(0.16, 4.0);
  for (let k = 0; k <= 3; k++) {
    const stripe = new THREE.Mesh(stripeGeo, storeLineMat);
    stripe.rotation.x = -Math.PI * 0.5;
    stripe.position.set(-7.5 + k * 2.5, 0.02, 4.5);
    g.add(stripe);
  }

  // Ronde koffiezuil aan de weg
  const coffeePylon = createCoffeePylon();
  coffeePylon.position.set(-11, 0, roadEdgeLZ - 2.2);
  coffeePylon.rotation.y = Math.PI * 0.5;
  g.add(coffeePylon);
  collide(-11, roadEdgeLZ - 2.2, 0.8);



  const p = toWorld(-2, 0);
  const glow = new THREE.PointLight(0x7fe0a0, 0, 26, 1.6);
  glow.position.set(p.x, surfaceY + 4.5, p.z);
  scene.add(glow);
  dinerNightLights.push(glow);
}
buildCoffeeStop();

// =========================================================
// PINEWOOD CINEMA: art-deco filmtheater met luifel vol lampjes,
// verticaal CINEMA-bord, filmposters, kassahokje en parkeerplaats
// =========================================================
function makeMarqueeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff6dc';
  ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = '#8c2335';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillText('NOW SHOWING', 256, 24);
  ctx.font = '900 44px system-ui, sans-serif';
  ctx.fillText('DRIFT KINGS', 256, 66);
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.fillText('& PINEWOOD NIGHTS', 256, 104);
  const tex = Object.assign(new THREE.CanvasTexture(canvas), { colorSpace: THREE.SRGBColorSpace });
  tex.needsUpdate = true;
  return tex;
}

function makeBladeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f4b41a';
  ctx.fillRect(0, 0, 96, 512);
  ctx.fillStyle = '#8c2335';
  ctx.fillRect(8, 8, 80, 496);
  ctx.fillStyle = '#fff6dc';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '900 62px system-ui, sans-serif';
  'CINEMA'.split('').forEach((ch, i) => ctx.fillText(ch, 48, 52 + i * 82));
  const tex = Object.assign(new THREE.CanvasTexture(canvas), { colorSpace: THREE.SRGBColorSpace });
  tex.needsUpdate = true;
  return tex;
}

function makePosterTexture(bg, fg, title) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 192;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 128, 192);
  ctx.fillStyle = fg;
  ctx.beginPath();
  ctx.arc(64, 78, 36, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff6dc';
  ctx.textAlign = 'center';
  ctx.font = '900 20px system-ui, sans-serif';
  ctx.fillText(title, 64, 160);
  const tex = Object.assign(new THREE.CanvasTexture(canvas), { colorSpace: THREE.SRGBColorSpace });
  tex.needsUpdate = true;
  return tex;
}

const cinemaWallMat = makeToonMat(0x8c2335);
const cinemaTrimMat = makeToonMat(0xf3e3c3);
const cinemaGoldMat = makeToonMat(0xf4b41a);
const cinemaRoofMat = registerSeasonalMat(0x4a3340, 0xf2f6fb);
const marqueeBulbMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
const marqueeBulbGeo = new THREE.SphereGeometry(0.09, 6, 5);

function createCinemaBuilding__build() {
  const g = new THREE.Group();
  const w = 18.0, h = 8.5, d = 11.0;

  const body = createOutlinedMesh(new THREE.BoxGeometry(w, h, d), cinemaWallMat, 0.06);
  body.position.y = h * 0.5;
  g.add(body);
  // Getrapte art-deco bovenrand en verticale pilasters
  [[w + 0.3, 0.5, h + 0.25], [w * 0.55, 0.9, h + 0.95], [w * 0.25, 0.9, h + 1.85]].forEach(([bw, bh, by]) => {
    const step = createOutlinedMesh(new THREE.BoxGeometry(bw, bh, d * 0.6), cinemaTrimMat, 0.04, false);
    step.position.set(0, by, d * 0.2);
    g.add(step);
  });
  const roof = createOutlinedMesh(new THREE.BoxGeometry(w + 0.4, 0.3, d + 0.4), cinemaRoofMat, 0.04, false);
  roof.position.y = h + 0.05;
  g.add(roof);
  [-8.2, -5.2, 5.2, 8.2].forEach((px) => {
    const pil = createOutlinedMesh(new THREE.BoxGeometry(0.6, h, 0.3), cinemaTrimMat, 0.03, false);
    pil.position.set(px, h * 0.5, d * 0.5 + 0.12);
    g.add(pil);
  });
  const base = createOutlinedMesh(new THREE.BoxGeometry(w + 0.2, 0.9, d + 0.2), cinemaTrimMat, 0.035, false);
  base.position.y = 0.45;
  g.add(base);

  // Glazen deuren onder de luifel
  [-2.4, 0, 2.4].forEach((dx) => {
    const door = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 2.6), warmWindowMat);
    door.position.set(dx, 1.45, d * 0.5 + 0.06);
    g.add(door);
    houseWindows.push({ mesh: door, timer: Math.random() * 10 });
    const frame = createOutlinedMesh(new THREE.BoxGeometry(2.1, 2.85, 0.1), cinemaGoldMat, 0.02, false);
    frame.position.set(dx, 1.45, d * 0.5 + 0.02);
    g.add(frame);
  });

  // Luifel met lampjesrand en "NOW SHOWING"-bord
  const marquee = createOutlinedMesh(new THREE.BoxGeometry(12.5, 1.9, 3.2), cinemaTrimMat, 0.045);
  marquee.position.set(0, 3.9, d * 0.5 + 1.6);
  g.add(marquee);
  const mTex = makeMarqueeTexture();
  const mFace = new THREE.Mesh(new THREE.PlaneGeometry(11.6, 1.5), new THREE.MeshBasicMaterial({ map: mTex, ...SIGN_MAT_OPTS }));
  mFace.position.set(0, 3.9, d * 0.5 + 3.25);
  g.add(mFace);
  for (let k = 0; k <= 40; k++) {
    const t = k / 40;
    [4.92, 2.88].forEach((by) => {
      const bulb = new THREE.Mesh(marqueeBulbGeo, marqueeBulbMat);
      bulb.position.set(-6.1 + t * 12.2, by, d * 0.5 + 3.24);
      g.add(bulb);
    });
  }

  // Verticaal CINEMA-bord boven de luifel
  const blade = createOutlinedMesh(new THREE.BoxGeometry(0.5, 6.0, 1.6), cinemaGoldMat, 0.04, false);
  blade.position.set(0, 7.6, d * 0.5 + 1.0);
  g.add(blade);
  const bTex = makeBladeTexture();
  [1, -1].forEach((side) => {
    const face = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 5.7), new THREE.MeshBasicMaterial({ map: bTex, ...SIGN_MAT_OPTS }));
    face.position.set(side * 0.27, 7.6, d * 0.5 + 1.0);
    face.rotation.y = side * Math.PI * 0.5;
    g.add(face);
  });

  // Filmposters naast de deuren
  [[-6.7, '#2d4a7a', '#f4b41a', 'DRIFT KINGS'], [6.7, '#3f6b4a', '#d95d30', 'MOOSE LAKE']].forEach(([px, bg, fg, title]) => {
    const frame = createOutlinedMesh(new THREE.BoxGeometry(1.6, 2.3, 0.12), cinemaGoldMat, 0.025, false);
    frame.position.set(px, 1.9, d * 0.5 + 0.08);
    g.add(frame);
    const poster = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 2.05), new THREE.MeshBasicMaterial({ map: makePosterTexture(bg, fg, title), ...SIGN_MAT_OPTS }));
    poster.position.set(px, 1.9, d * 0.5 + 0.15);
    g.add(poster);
  });

  g.userData.lightSpecs = { width: w * 0.94, yPos: h + 0.45, zFront: d * 0.5 + 0.3 };
  return g;
}

function createTicketBooth() {
  const g = new THREE.Group();
  const body = createOutlinedMesh(new THREE.CylinderGeometry(0.9, 0.95, 2.3, 10), cinemaTrimMat, 0.035);
  body.position.y = 1.15;
  g.add(body);
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 0.92, 0.9, 10, 1, true, -0.8, 1.6), warmWindowMat);
  glass.position.y = 1.55;
  g.add(glass);
  const roof = createOutlinedMesh(new THREE.ConeGeometry(1.15, 0.8, 10), cinemaWallMat, 0.03, false);
  roof.position.y = 2.7;
  g.add(roof);
  const ball = createOutlinedMesh(new THREE.SphereGeometry(0.18, 8, 6), cinemaGoldMat, 0.02, false);
  ball.position.y = 3.2;
  g.add(ball);
  return g;
}

function buildCinema() {
  const lot = ruralLots.find((l) => l.type === 'cinema');
  if (!lot) return;
  const { x: baseX, z: baseZ, yaw } = lot;
  const surfaceY = lot.roadY - 0.02;
  const g = new THREE.Group();
  g.position.set(baseX, surfaceY, baseZ);
  g.rotation.y = yaw;
  scene.add(g);

  // Parkeerplaats (lz -1 .. 15) en stoep voor het gebouw
  const slabH = 3.2;
  const pad = tagMap(new THREE.Mesh(new THREE.BoxGeometry(29, slabH, 16.5), storeAsphaltMat), 'paved');
  pad.position.set(0, -slabH * 0.5, 6.75);
  pad.receiveShadow = true;
  g.add(pad);
  const plinth = createOutlinedMesh(new THREE.BoxGeometry(24, slabH + 0.16, 14.5), sidewalkMat, 0.04, false, true);
  plinth.position.set(0, -slabH * 0.5 + 0.08, -8.0);
  g.add(plinth);

  const building = createCinemaBuilding();
  building.position.set(0, 0.16, -9.0);
  g.add(building);

  const booth = createTicketBooth();
  booth.position.set(-9.5, 0.16, -1.2);
  g.add(booth);

  // Parkeervakken aan weerszijden van de inrit
  const stripeGeo = new THREE.PlaneGeometry(0.16, 4.2);
  const stopGeo = new THREE.BoxGeometry(1.55, 0.1, 0.22);
  [[-13.5, -4.5], [4.5, 13.5]].forEach(([x0, x1]) => {
    for (let lx = x0; lx <= x1 + 0.01; lx += 2.25) {
      [4.0, 11.0].forEach((rowZ) => {
        const stripe = new THREE.Mesh(stripeGeo, storeLineMat);
        stripe.rotation.x = -Math.PI * 0.5;
        stripe.position.set(lx, 0.02, rowZ);
        g.add(stripe);
        if (lx < x1 - 0.1) {
          const stop = new THREE.Mesh(stopGeo, wheelStopMat);
          stop.position.set(lx + 1.125, 0.05, rowZ - 1.75);
          g.add(stop);
        }
      });
    }
  });

  g.updateMatrixWorld(true);
  addRoofStringLights(building, building.userData.lightSpecs.width, building.userData.lightSpecs.yPos, building.userData.lightSpecs.zFront);

  const toWorld = (lx, lz) => {
    const w = rotateLocal(lx, lz, yaw);
    return { x: baseX + w.x, z: baseZ + w.z };
  };
  [-6, 0, 6].forEach((cx) => {
    const p = toWorld(cx, -9.0);
    hardColliders.push({ x: p.x, z: p.z, r: 5.4 });
  });
  const bp = toWorld(-9.5, -1.2);
  hardColliders.push({ x: bp.x, z: bp.z, r: 1.0 });

  // Warme gloed onder de luifel 's avonds
  const glowPos = toWorld(0, -1.0);
  const glow = new THREE.PointLight(0xffc870, 0, 28, 1.5);
  glow.position.set(glowPos.x, surfaceY + 4.5, glowPos.z);
  scene.add(glow);
  dinerNightLights.push(glow);
}
buildCinema();



// =========================================================
// LANDELIJKE KAVELS BUITEN HET DORP
// =========================================================
function createLogCabin__build() {
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

function createAFrameCabin__build() {
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

function createVilla__build() {
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

  // Dakkapellen aan de voorkant
  [-3.4, 3.4].forEach((dx) => {
    const dorm = createOutlinedMesh(new THREE.BoxGeometry(1.5, 1.2, 1.4), villaWallMat, 0.03, false);
    dorm.position.set(dx, mainH + 1.15, mainD * 0.5 - 1.1);
    g.add(dorm);
    const dRoof = hipRoof(1.7, 1.6, 0.7, villaRoofMat);
    dRoof.position.set(dx, mainH + 1.75, mainD * 0.5 - 1.1);
    g.add(dRoof);
    const dGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.75), warmWindowMat);
    dGlass.position.set(dx, mainH + 1.15, mainD * 0.5 - 0.39);
    g.add(dGlass);
    houseWindows.push({ mesh: dGlass, timer: Math.random() * 10 });
  });
  // Lantaarns naast de voordeur
  const lampGlow = new THREE.MeshBasicMaterial({ color: 0xffe08a });
  [-1.25, 1.25].forEach((lx) => {
    const lamp = createOutlinedMesh(new THREE.BoxGeometry(0.22, 0.34, 0.22), lampGlow, 0.015, false);
    lamp.position.set(lx, 2.75, mainD * 0.5 + 0.18);
    g.add(lamp);
  });

  // Achtertuin: terras aan de achtergevel, zwembad met stenen rand, ligbedden, parasol en een lage haag
  const backZ = -mainD * 0.5;
  const patio = createOutlinedMesh(new THREE.BoxGeometry(mainW + 2, 0.3, 3.4), poolDeckMat, 0.03, false, true);
  patio.position.set(0, 0.3, backZ - 1.7);
  g.add(patio);
  const deck = createOutlinedMesh(new THREE.BoxGeometry(15.0, 0.3, 9.0), poolDeckMat, 0.035, false, true);
  deck.position.set(0, 0.28, backZ - 7.9);
  g.add(deck);
  const poolZ = backZ - 8.6;
  const rim = createOutlinedMesh(new THREE.BoxGeometry(9.8, 0.16, 5.0), stoneMat, 0.02, false);
  rim.position.set(0, 0.5, poolZ);
  g.add(rim);
  const pool = new THREE.Mesh(new THREE.BoxGeometry(9.0, 0.08, 4.2), poolWaterMat);
  pool.position.set(0, 0.56, poolZ);
  g.add(pool);
  [-1, 1].forEach((side) => {
    const ladder = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.6, 0.06), trimWhiteMat);
    ladder.position.set(4.0, 0.8, poolZ + side * 0.35);
    g.add(ladder);
  });
  // (ligbedden en parasol staan los in de wereld, zodat je ze kunt omrijden: zie buildVilla)
  // Cabana: witte pergola met doeken naast het zwembad
  {
    const cx = 5.6;
    const cz = backZ - 11.2;
    [[-1.3, -1.0], [1.3, -1.0], [-1.3, 1.0], [1.3, 1.0]].forEach(([px, pz]) => {
      const post = createOutlinedMesh(new THREE.BoxGeometry(0.16, 2.6, 0.16), trimWhiteMat, 0.015, false);
      post.position.set(cx + px, 1.75, cz + pz);
      g.add(post);
    });
    const top = createOutlinedMesh(new THREE.BoxGeometry(3.0, 0.14, 2.4), trimWhiteMat, 0.02, false);
    top.position.set(cx, 3.05, cz);
    g.add(top);
    const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.2, 2.0), makeToonMat(0xf4efe4));
    cloth.position.set(cx + 1.32, 1.85, cz);
    g.add(cloth);
    const bed = createOutlinedMesh(new THREE.BoxGeometry(2.0, 0.35, 1.6), makeToonMat(0xe9e2d4), 0.02, false);
    bed.position.set(cx - 0.2, 0.65, cz);
    g.add(bed);
    const pillow = createOutlinedMesh(new THREE.BoxGeometry(0.5, 0.2, 1.3), makeToonMat(0x2f4a6b), 0.015, false);
    pillow.position.set(cx - 0.95, 0.92, cz);
    g.add(pillow);
  }
  // Hagen sluiten aan elkaar aan; achter een doorgang van 1,6 m
  const hedgeTop = 0.75;
  [[-7.8, backZ - 8.3, 0.8, 9.4], [7.8, backZ - 8.3, 0.8, 9.4], [-4.5, backZ - 12.6, 7.4, 0.8], [4.5, backZ - 12.6, 7.4, 0.8]].forEach(([hx, hz, hw, hd]) => {
    const hedge = createOutlinedMesh(new THREE.BoxGeometry(hw, 0.9, hd), hedgeMat, 0.03, false);
    hedge.position.set(hx, hedgeTop, hz);
    g.add(hedge);
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
  [[-9.5, -0.4], [-3.5, 0], [3.5, 0], [9.5, -0.4]].forEach(([lx, lz]) => {
    const p = rotateLocal(lx, lz, lot.yaw);
    hardColliders.push({ x: vx + p.x, z: vz + p.z, r: 4.2 });
  });
  // Zwembad met haag: botsranden zodat je er niet in rijdt
  [[-3, -12.85], [3, -12.85], [-7.8, -9.5], [-7.8, -14.8], [7.8, -9.5], [7.8, -14.8], [-4.5, -16.85], [4.5, -16.85]].forEach(([lx, lz]) => {
    const p = rotateLocal(lx, lz, lot.yaw);
    hardColliders.push({ x: vx + p.x, z: vz + p.z, r: 2.1 });
  });
  // Tuinbomen rondom en tuinlantaarns langs de oprijlaan
  const gy = getTerrainHeight(lot.x, lot.z);
  // Gevarieerde tuin: slanke cipressen langs de oprijlaan, sierbomen en een bloeiende boom achter
  const garden = [
    ['round', -27.5, -4], ['round', 17, -3], ['blossom', -15.5, -15], ['round', 15.5, -16],
    ['tall', -11, -22], ['blossom', 11, -22], ['tall', 0, -24], ['cypress', -27, 6], ['cypress', 18.5, 7.5]
  ];
  garden.forEach(([kind, lx, lz]) => {
    const p = rotateLocal(lx, lz, lot.yaw);
    const tx = vx + p.x;
    const tz = vz + p.z;
    const ty = getTerrainHeight(tx, tz);
    const tree = createGardenTree(kind);
    tree.position.set(tx, ty, tz);
    tree.rotation.y = Math.random() * Math.PI * 2;
    scene.add(tree);
    registerDestructible(tree, tx, ty, tz, kind === 'cypress' ? 0.45 : 0.7, 'tree', 15, 'Garden tree');
    markLastPlanted();
  });
  // Voortuin: poort aan het begin van de oprijlaan (ruim van de weg), lage haagjes langs de oprijlaan,
  // klassieke lantaarnpalen en grote stenen bakken met boompjes (los en omrijdbaar)
  {
    const pillarMat = makeToonMat(0xd9cdb8);
    const ironMat = makeToonMat(0x23262b);
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe08a });
    const at = (lx, lz) => {
      const p = rotateLocal(lx, lz, lot.yaw);
      const x = vx + p.x;
      const z = vz + p.z;
      return { x, z, y: getTerrainHeight(x, z) };
    };
    // Poort (villa-lokaal z 23 = 13,5 m van het kavelmidden; de weg ligt ~17 m van het midden)
    [-1, 1].forEach((side) => {
      const p = at(side * 3.9, 23.0);
      const pillar = createOutlinedMesh(new THREE.BoxGeometry(0.9, 2.4, 0.9), pillarMat, 0.03, false);
      pillar.position.set(p.x, p.y + 1.2, p.z);
      scene.add(pillar);
      const cap = createOutlinedMesh(new THREE.BoxGeometry(1.1, 0.2, 1.1), pillarMat, 0.02, false);
      cap.position.set(p.x, p.y + 2.5, p.z);
      scene.add(cap);
      const lamp = createOutlinedMesh(new THREE.BoxGeometry(0.35, 0.45, 0.35), lampMat, 0.015, false);
      lamp.position.set(p.x, p.y + 2.85, p.z);
      scene.add(lamp);
      hardColliders.push({ x: p.x, z: p.z, r: 0.6 });
      // Open hekdeur langs de binnenkant van de oprijlaan
      const gate = new THREE.Group();
      for (let k = 0; k < 7; k++) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.8, 0.05), ironMat);
        bar.position.set(0, 0.95, -k * 0.3);
        gate.add(bar);
      }
      [0.25, 1.75].forEach((by) => {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 1.9), ironMat);
        rail.position.set(0, by, -0.9);
        gate.add(rail);
      });
      const q = at(side * 3.35, 22.5);
      gate.position.set(q.x, q.y, q.z);
      gate.rotation.y = lot.yaw - side * 0.12;
      scene.add(gate);
      // Laag muurtje van de pilaar opzij
      const wall = createOutlinedMesh(new THREE.BoxGeometry(5.0, 0.8, 0.5), pillarMat, 0.025, false);
      const wp = at(side * 6.9, 23.0);
      wall.position.set(wp.x, wp.y + 0.4, wp.z);
      wall.rotation.y = lot.yaw;
      scene.add(wall);
      [5.0, 7.0, 8.8].forEach((wx) => {
        const cp = at(side * wx, 23.0);
        hardColliders.push({ x: cp.x, z: cp.z, r: 0.6 });
      });
    });
    // Lage buxushaagjes langs de oprijlaan tussen poort en voorplein
    [-1, 1].forEach((side) => {
      const h = createOutlinedMesh(new THREE.BoxGeometry(0.55, 0.55, 5.6), hedgeMat, 0.02, false);
      const p = at(side * 3.7, 19.2);
      h.position.set(p.x, p.y + 0.28, p.z);
      h.rotation.y = lot.yaw;
      scene.add(h);
    });
    // Klassieke lantaarnpalen bij het voorplein
    [[-7.6, 17.4], [7.6, 17.4], [-7.6, 7.2], [7.6, 7.2]].forEach(([lx, lz]) => {
      const p = at(lx, lz);
      const lampPost = new THREE.Group();
      const pole = createOutlinedMesh(new THREE.CylinderGeometry(0.07, 0.1, 2.6, 8), ironMat, 0.015, false);
      pole.position.y = 1.3;
      lampPost.add(pole);
      const head = createOutlinedMesh(new THREE.BoxGeometry(0.34, 0.42, 0.34), lampMat, 0.015, false);
      head.position.y = 2.75;
      lampPost.add(head);
      const roofCap = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.22, 4), ironMat);
      roofCap.position.y = 3.06;
      roofCap.rotation.y = Math.PI / 4;
      lampPost.add(roofCap);
      lampPost.position.set(p.x, p.y, p.z);
      scene.add(lampPost);
      registerDestructible(lampPost, p.x, p.y, p.z, 0.35, 'small', 4, 'Garden lantern');
    });
    // Grote stenen bakken met boompjes aan weerszijden van het voorplein
    [[-8.4, 12.6], [8.4, 12.6], [-8.4, 15.4], [8.4, 15.4]].forEach(([lx, lz]) => {
      const p = at(lx, lz);
      const planter = new THREE.Group();
      const box = createOutlinedMesh(new THREE.BoxGeometry(1.3, 0.75, 1.3), pillarMat, 0.025, false);
      box.position.y = 0.38;
      planter.add(box);
      const soil = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.05, 1.1), makeToonMat(0x4a3424));
      soil.position.y = 0.77;
      planter.add(soil);
      const tree = createGardenTree('round');
      tree.scale.setScalar(0.55);
      tree.position.y = 0.75;
      planter.add(tree);
      planter.position.set(p.x, p.y, p.z);
      planter.rotation.y = lot.yaw;
      scene.add(planter);
      registerDestructible(planter, p.x, p.y, p.z, 0.75, 'small', 6, 'Tree planter');
    });
  }

  // Losse garage links naast de villa, met een geplaveide oprit naar het voorplein
  {
    const gp = rotateLocal(-20.5, 0, lot.yaw);
    const gx = vx + gp.x;
    const gz = vz + gp.z;
    const garage = tagMap(createVillaGarage(), 'home');
    garage.position.set(gx, getTerrainHeight(lot.x, lot.z) + 0.05, gz);
    garage.rotation.y = lot.yaw;
    scene.add(garage);
    const baseY = getTerrainHeight(lot.x, lot.z);
    [[-20.5, 7.1, 7.4, 7.0], [-12.1, 9.6, 10.2, 3.0]].forEach(([cx, cz, w, d]) => {
      const apron = createOutlinedMesh(new THREE.BoxGeometry(w, 0.3, d), poolDeckMat, 0.03, false, true);
      const ap = rotateLocal(cx, cz, lot.yaw);
      apron.position.set(vx + ap.x, baseY + 0.12, vz + ap.z);
      apron.rotation.y = lot.yaw;
      scene.add(apron);
    });
    // Botsranden: achterwand, zijwanden en de dichte rechterdeur (het linker vak blijft open voor de auto)
    [[-22.4, -3.0, 0.9], [-18.6, -3.0, 0.9], [-24.75, 0.5, 0.45], [-16.25, 0.5, 0.45], [-18.5, 0.8, 1.8]].forEach(([lx, lz, r]) => {
      const p = rotateLocal(lx, lz, lot.yaw);
      hardColliders.push({ x: vx + p.x, z: vz + p.z, r });
    });
  }
  const lanternGlow = new THREE.MeshBasicMaterial({ color: 0xffe08a });
  // Kleine spullen in de tuin: los en omrijdbaar (ligbedden, parasol, tuinlantaarns)
  const placeSmall = (obj, lx, lz, yOff, r, label, rotY = 0) => {
    const p = rotateLocal(lx, lz, lot.yaw);
    const wx = vx + p.x;
    const wz = vz + p.z;
    const wy = gy + yOff;
    obj.position.set(wx, wy, wz);
    obj.rotation.y = lot.yaw + rotY;
    scene.add(obj);
    registerDestructible(obj, wx, wy, wz, r, 'small', 4, label);
  };
  const deckY = 0.43; // bovenkant van het zwembaddek
  [-4.5, -2.5, 2.5, 4.5].forEach((lx) => {
    const l = new THREE.Group();
    const bed = createOutlinedMesh(new THREE.BoxGeometry(0.7, 0.25, 1.9), trimWhiteMat, 0.02, false);
    bed.position.y = 0.17;
    bed.rotation.x = -0.12;
    l.add(bed);
    placeSmall(l, lx, -4.25 - 4.6, deckY, 0.7, 'Sun lounger');
  });
  {
    const par = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 6), trimWhiteMat);
    pole.position.y = 1.2;
    par.add(pole);
    const umb = createOutlinedMesh(new THREE.ConeGeometry(1.5, 0.5, 8), makeToonMat(0xf4f1ea), 0.025, false);
    umb.position.y = 2.45;
    par.add(umb);
    placeSmall(par, 6.2, -4.25 - 5.2, deckY, 0.5, 'Parasol');
  }
  [[-7.6, -4.6], [7.6, -4.6]].forEach(([lx, lz]) => {
    const lan = new THREE.Group();
    const post = createOutlinedMesh(new THREE.CylinderGeometry(0.05, 0.07, 1.1, 6), streetPostMat, 0.015, false);
    post.position.y = 0.55;
    lan.add(post);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), lanternGlow);
    glow.position.y = 1.2;
    lan.add(glow);
    placeSmall(lan, lx, lz, 0.3, 0.4, 'Garden lantern');
  });
  const f = rotateLocal(0, 12.25, lot.yaw);
  hardColliders.push({ x: vx + f.x, z: vz + f.z, r: 2.2 });
}

ruralLots.forEach((lot) => {
  if (lot.type === 'farm' || lot.type === 'store' || lot.type === 'diner' || lot.type === 'motel' || lot.type === 'sawmill' || lot.type === 'fair' || lot.type === 'cinema' || lot.type === 'airfield' || lot.type === 'coffee' || lot.type === 'police') return;
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
// Kaart: gebouwen krijgen hun soort mee (zie map-tags.js)
function createAttachedShop(...args) { return tagMap(createAttachedShop__build(...args), 'shop'); }
function createRowTownHouse(...args) { return tagMap(createRowTownHouse__build(...args), 'home'); }
function createDetachedRuralHouse(...args) { return tagMap(createDetachedRuralHouse__build(...args), 'home'); }
function createGemeentehuis(...args) { return tagMap(createGemeentehuis__build(...args), 'civic'); }
function createNamedShop(...args) { return tagMap(createNamedShop__build(...args), 'shop'); }
function createApartmentBuilding(...args) { return tagMap(createApartmentBuilding__build(...args), 'home'); }
function createSupermarketWing(...args) { return tagMap(createSupermarketWing__build(...args), 'shop'); }
function createMallAtriumCenter(...args) { return tagMap(createMallAtriumCenter__build(...args), 'shop'); }
function createMallRetailWing(...args) { return tagMap(createMallRetailWing__build(...args), 'shop'); }
function createHardwareStore(...args) { return tagMap(createHardwareStore__build(...args), 'shop'); }
function createMallCafe(...args) { return tagMap(createMallCafe__build(...args), 'shop'); }
function createBurgerRestaurant(...args) { return tagMap(createBurgerRestaurant__build(...args), 'shop'); }
function createCoffeeKiosk(...args) { return tagMap(createCoffeeKiosk__build(...args), 'shop'); }
function createCinemaBuilding(...args) { return tagMap(createCinemaBuilding__build(...args), 'leisure'); }
export function createLogCabin(...args) { return tagMap(createLogCabin__build(...args), 'home'); }
function createAFrameCabin(...args) { return tagMap(createAFrameCabin__build(...args), 'home'); }
function createVilla(...args) { return tagMap(createVilla__build(...args), 'home'); }

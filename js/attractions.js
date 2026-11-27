import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { scene, makeToonMat, registerSeasonalMat, createOutlinedMesh } from './scene-setup.js';
import { ruralLots } from './water-lots.js';
import { hardColliders, registerDestructible } from './demolition.js';
import { getTerrainHeight } from './terrain.js';
import { houseWindows, warmWindowMat } from './town.js';
import { createRoadSign } from './scenery.js';
import { buildPickupTruckMesh, parkedCars } from './vehicles.js';
import { createPineFast, createDeciduousTreeFast, createShrubFast } from './props.js';

// =========================================================
// NIEUWE PLEKKEN: STRANDCAMPING, ZAGERIJ & HERFSTKERMIS
// Lokale assen per kavel: lx langs de weg, lz richting de weg (+). De oprit loopt over lx = 0.
// =========================================================
const logWallMat = registerSeasonalMat(0x8a5a33, 0x9a7a62);
const darkWoodMat = makeToonMat(0x5a3520);
const lightWoodMat = registerSeasonalMat(0xd9b07a, 0xe8dccb);
const roofGreenMat = registerSeasonalMat(0x3f6b4a, 0xf2f6fb);
const roofRedMat = registerSeasonalMat(0xa8402f, 0xf2f6fb);
const gravelMat = registerSeasonalMat(0xc2ab88, 0xe8eff6);
const stoneGreyMat = makeToonMat(0x8d8379);
const whiteMat = makeToonMat(0xf6f2ea);
const steelMat = makeToonMat(0x7a838c);
const sawBladeMat = makeToonMat(0xc9d2da);
const bulbMats = [0xffd23f, 0xff6a4a, 0x5ef2d6, 0xf7f7f7].map((c) => new THREE.MeshBasicMaterial({ color: c }));
const bulbGeo = new THREE.SphereGeometry(0.11, 6, 5);

const nightLights = [];
const fireFlames = [];
let ferrisWheel = null;
const ferrisGondolas = [];
let carousel = null;
const carouselHorses = [];

function lotFrame(lot) {
  const c = Math.cos(lot.yaw);
  const s = Math.sin(lot.yaw);
  const toWorld = (lx, lz) => ({ x: lot.x + lx * c + lz * s, z: lot.z - lx * s + lz * c });
  const g = new THREE.Group();
  g.position.set(lot.x, lot.roadY - 0.16, lot.z);
  g.rotation.y = lot.yaw;
  scene.add(g);
  const collide = (lx, lz, r) => {
    const w = toWorld(lx, lz);
    hardColliders.push({ x: w.x, z: w.z, r });
  };
  return { g, toWorld, collide };
}

function entranceSign(lot, lines) {
  const ax = Math.cos(lot.yaw);
  const az = -Math.sin(lot.yaw);
  const tx = lot.x - lot.roadX;
  const tz = lot.z - lot.roadZ;
  const tl = Math.hypot(tx, tz) || 1;
  const sx = lot.roadX + ax * 6.5 + (tx / tl) * 3.5;
  const sz = lot.roadZ + az * 6.5 + (tz / tl) * 3.5;
  createRoadSign(sx, sz, getTerrainHeight(sx, sz), lot.yaw, lines);
}

function smallCabin(w, h, d, wallMat, roofMat) {
  const g = new THREE.Group();
  const body = createOutlinedMesh(new THREE.BoxGeometry(w, h, d), wallMat, 0.045);
  body.position.y = h * 0.5 + 0.1;
  g.add(body);
  const shape = new THREE.Shape();
  shape.moveTo(-(w * 0.5 + 0.35), 0);
  shape.lineTo(0, 1.5);
  shape.lineTo(w * 0.5 + 0.35, 0);
  shape.closePath();
  const rGeo = new THREE.ExtrudeGeometry(shape, { depth: d + 0.6, bevelEnabled: false });
  rGeo.translate(0, 0, -(d + 0.6) * 0.5);
  const roof = createOutlinedMesh(rGeo, roofMat, 0.05);
  roof.position.y = h + 0.1;
  g.add(roof);
  const door = createOutlinedMesh(new THREE.BoxGeometry(0.9, 1.9, 0.1), darkWoodMat, 0.025, false);
  door.position.set(-w * 0.22, 1.05, d * 0.5 + 0.04);
  g.add(door);
  const win = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.8), warmWindowMat);
  win.position.set(w * 0.22, 1.6, d * 0.5 + 0.06);
  g.add(win);
  houseWindows.push({ mesh: win, timer: Math.random() * 10 });
  return g;
}

function picnicTable(mat) {
  const g = new THREE.Group();
  const top = createOutlinedMesh(new THREE.BoxGeometry(1.8, 0.12, 0.9), mat, 0.025, false);
  top.position.y = 0.78;
  g.add(top);
  [-0.65, 0.65].forEach((bz) => {
    const bench = createOutlinedMesh(new THREE.BoxGeometry(1.8, 0.1, 0.32), mat, 0.02, false);
    bench.position.set(0, 0.45, bz);
    g.add(bench);
  });
  const leg = createOutlinedMesh(new THREE.BoxGeometry(0.14, 0.76, 0.6), darkWoodMat, 0.02, false);
  leg.position.y = 0.38;
  g.add(leg);
  return g;
}

// ---------------------------------------------------------
// STRANDCAMPING
// ---------------------------------------------------------
function createTent(colorHex) {
  const g = new THREE.Group();
  const shape = new THREE.Shape();
  shape.moveTo(-1.4, 0);
  shape.lineTo(0, 1.7);
  shape.lineTo(1.4, 0);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 2.8, bevelEnabled: false });
  geo.translate(0, 0, -1.4);
  const tent = createOutlinedMesh(geo, registerSeasonalMat(colorHex, 0xf2f6fb), 0.04);
  g.add(tent);
  const flap = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.1), makeToonMat(0x2b2b2b));
  flap.position.set(0, 0.55, 1.42);
  g.add(flap);
  return g;
}

function createCaravan(stripeHex) {
  const g = new THREE.Group();
  const body = createOutlinedMesh(new THREE.CapsuleGeometry(1.15, 3.0, 4, 10), whiteMat, 0.045);
  body.rotation.z = Math.PI * 0.5;
  body.scale.set(1, 1, 0.95);
  body.position.y = 1.55;
  g.add(body);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.3, 2.22), makeToonMat(stripeHex));
  stripe.position.y = 1.25;
  g.add(stripe);
  const win = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.6), warmWindowMat);
  win.position.set(0.9, 1.85, 1.1);
  g.add(win);
  houseWindows.push({ mesh: win, timer: Math.random() * 10 });
  const door = createOutlinedMesh(new THREE.BoxGeometry(0.7, 1.5, 0.08), makeToonMat(stripeHex), 0.02, false);
  door.position.set(-0.8, 1.3, 1.08);
  g.add(door);
  [-1, 1].forEach((side) => {
    const wheel = createOutlinedMesh(new THREE.CylinderGeometry(0.4, 0.4, 0.3, 10), makeToonMat(0x2b2b2b), 0.02, false);
    wheel.rotation.x = Math.PI * 0.5;
    wheel.position.set(0.3, 0.4, side * 1.0);
    g.add(wheel);
  });
  const hitch = createOutlinedMesh(new THREE.BoxGeometry(1.2, 0.12, 0.12), steelMat, 0.015, false);
  hitch.position.set(2.7, 0.5, 0);
  g.add(hitch);
  return g;
}

function createCampfire() {
  const g = new THREE.Group();
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2;
    const stone = createOutlinedMesh(new THREE.DodecahedronGeometry(0.22, 0), stoneGreyMat, 0.02, false);
    stone.position.set(Math.cos(a) * 0.9, 0.15, Math.sin(a) * 0.9);
    g.add(stone);
  }
  [0, Math.PI / 2].forEach((rot) => {
    const log = createOutlinedMesh(new THREE.CylinderGeometry(0.12, 0.12, 1.3, 6), darkWoodMat, 0.02, false);
    log.rotation.z = Math.PI * 0.5;
    log.rotation.y = rot;
    log.position.y = 0.18;
    g.add(log);
  });
  [[0xff8a2a, 0.45, 1.1], [0xffd23f, 0.28, 0.8]].forEach(([hex, r, h]) => {
    const flame = new THREE.Mesh(new THREE.ConeGeometry(r, h, 6), new THREE.MeshBasicMaterial({ color: hex }));
    flame.position.y = 0.25 + h * 0.5;
    g.add(flame);
    fireFlames.push({ mesh: flame, baseH: h });
  });
  const light = new THREE.PointLight(0xff8a3a, 0, 22, 1.6);
  light.position.y = 1.2;
  g.add(light);
  nightLights.push({ light, day: 0, night: 3.0 });
  return g;
}

function buildCamping(lot) {
  const { g, collide, toWorld } = lotFrame(lot);
  const fb = lot.flatBox;

  const ground = createOutlinedMesh(new THREE.BoxGeometry(34, 0.3, 26), gravelMat, 0.03, false, true);
  ground.position.set(0, 0.05, -6);
  g.add(ground);

  const office = smallCabin(5.2, 3.0, 4.0, logWallMat, roofGreenMat);
  office.position.set(9.5, 0.1, 16.5);
  g.add(office);
  collide(9.5, 16.5, 3.0);

  [[-15, -14, 0xe8742a, 0.3], [-8, -16.5, 0x4c8a4a, -0.2], [13.5, -15, 0x3f78a8, 0.5], [17, -4, 0xf2c23a, 1.6], [-17, -3, 0xc94a38, -1.4]].forEach(([lx, lz, col, rot]) => {
    const tent = createTent(col);
    tent.position.set(lx, 0.12, lz);
    tent.rotation.y = rot;
    g.add(tent);
    collide(lx, lz, 1.6);
  });

  [[-14, 10, 0x3f9fb8, 0.15], [14, 6, 0xe0762f, -0.2]].forEach(([lx, lz, col, rot]) => {
    const car = createCaravan(col);
    car.position.set(lx, 0.12, lz);
    car.rotation.y = rot;
    g.add(car);
    collide(lx - 1.2, lz, 1.5);
    collide(lx + 1.2, lz, 1.5);
  });

  const fire = createCampfire();
  fire.position.set(0, 0.15, -7);
  g.add(fire);
  collide(0, -7, 1.1);
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + 0.4;
    const bench = createOutlinedMesh(new THREE.CylinderGeometry(0.28, 0.28, 2.0, 8), logWallMat, 0.025, false);
    bench.rotation.z = Math.PI * 0.5;
    bench.rotation.y = a + Math.PI * 0.5;
    bench.position.set(Math.cos(a) * 3.0, 0.42, -7 + Math.sin(a) * 3.0);
    g.add(bench);
  }

  // Picknicktafels (los in de wereld zodat je ze kunt aanrijden)
  [[8, -2], [-7, 2]].forEach(([lx, lz]) => {
    const w = toWorld(lx, lz);
    const y = lot.roadY - 0.16 + 0.12;
    const t = picnicTable(lightWoodMat);
    t.position.set(w.x, y, w.z);
    t.rotation.y = lot.yaw;
    scene.add(t);
    registerDestructible(t, w.x, y, w.z, 1.1, 'small', 10, 'Picknicktafel');
  });

  // Gezellig groen: boompjes rond het terrein en tussen de tenten, struiken langs de oprit
  const groundY = lot.roadY - 0.16 + 0.1;
  [[-21, -18, 'd'], [-21, 5, 'p'], [21.5, -18, 'p'], [21, 12, 'd'], [-20, 16, 'd'], [4, -20.5, 'd'],
    [-11.5, -9.5, 'd'], [9.5, -10, 'd'], [6, 10.5, 'p'], [-6.5, 11.5, 'd'], [18.5, 18, 'p']].forEach(([lx, lz, kind]) => {
    const w = toWorld(lx, lz);
    const sc = 0.62 + Math.random() * 0.25;
    const tree = kind === 'p' ? createPineFast(sc) : createDeciduousTreeFast(sc);
    tree.position.set(w.x, groundY, w.z);
    tree.rotation.y = Math.random() * Math.PI * 2;
    scene.add(tree);
    registerDestructible(tree, w.x, groundY, w.z, 0.85 * sc, 'tree', 15, kind === 'p' ? 'Dennenboom' : 'Loofboom');
  });
  const shrubSpots = [[6, 14], [13, 19.5], [-3.6, 9], [3.6, 13], [-3.6, 18], [3.6, 22], [-3.6, 25],
    [-18.5, -10], [19.5, -9], [-12, -19], [16, -19.5], [-3, -15.5], [3.5, -14.5], [-17, 13], [17, 1.5], [-9.5, -1]];
  shrubSpots.forEach(([lx, lz]) => {
    const w = toWorld(lx, lz);
    const big = Math.random() < 0.45;
    const sc = big ? 1.0 + Math.random() * 0.5 : 0.5 + Math.random() * 0.3;
    const shrub = createShrubFast(sc);
    shrub.position.set(w.x, groundY, w.z);
    shrub.rotation.y = Math.random() * Math.PI * 2;
    scene.add(shrub);
    registerDestructible(shrub, w.x, groundY, w.z, Math.max(0.6, 0.85 * sc), 'shrub', 3, big ? 'Grote struik' : 'Struik');
  });

  // Lantaarnpaaltjes met lichtslingers rond het kampvuur
  const ringR = 6.2;
  const postCount = 6;
  const warmBulbMat = new THREE.MeshBasicMaterial({ color: 0xffd98a });
  const postTops = [];
  for (let k = 0; k < postCount; k++) {
    const a = (k / postCount) * Math.PI * 2 + 0.25;
    const px = Math.cos(a) * ringR;
    const pz = -7 + Math.sin(a) * ringR;
    const post = createOutlinedMesh(new THREE.CylinderGeometry(0.07, 0.09, 2.8, 6), darkWoodMat, 0.02, false);
    post.position.set(px, 1.5, pz);
    g.add(post);
    const lantern = createOutlinedMesh(new THREE.BoxGeometry(0.26, 0.34, 0.26), warmBulbMat, 0.02, false);
    lantern.position.set(px, 3.0, pz);
    g.add(lantern);
    postTops.push(new THREE.Vector3(px, 2.75, pz));
  }
  for (let k = 0; k < postCount; k++) {
    const p0 = postTops[k];
    const p1 = postTops[(k + 1) % postCount];
    for (let b = 1; b < 7; b++) {
      const t = b / 7;
      const bulb = new THREE.Mesh(bulbGeo, b % 2 ? warmBulbMat : bulbMats[k % bulbMats.length]);
      bulb.position.lerpVectors(p0, p1, t);
      bulb.position.y -= Math.sin(t * Math.PI) * 0.45;
      g.add(bulb);
    }
  }

  // Stapel brandhout bij het kampvuur
  const firewood = logStack(3, 1.6, 0.18, logWallMat);
  firewood.position.set(4.6, 0.15, -11.2);
  g.add(firewood);


  // Kano's bij het strand
  [[-5, fb.minLZ + 1.5, 0xd9452f], [-1.5, fb.minLZ + 2.0, 0x2f9fd0]].forEach(([lx, lz, col]) => {
    const canoe = createOutlinedMesh(new THREE.CapsuleGeometry(0.4, 3.2, 3, 8), makeToonMat(col), 0.035);
    canoe.rotation.z = Math.PI * 0.5;
    canoe.scale.set(1, 1, 0.55);
    canoe.position.set(lx, 0.35, lz);
    g.add(canoe);
  });

  entranceSign(lot, ['CAMPING', 'North Beach']);
}

// ---------------------------------------------------------
// ZAGERIJ
// ---------------------------------------------------------
function logStack(rows, length, radius, mat) {
  const geos = [];
  for (let r = 0; r < rows; r++) {
    const count = rows - r;
    for (let k = 0; k < count; k++) {
      const geo = new THREE.CylinderGeometry(radius, radius, length, 8);
      geo.rotateZ(Math.PI * 0.5);
      geo.translate(0, radius + r * radius * 1.72, (k - (count - 1) * 0.5) * radius * 2.02);
      geos.push(geo);
    }
  }
  const merged = BufferGeometryUtils.mergeGeometries(geos);
  return createOutlinedMesh(merged, mat, 0.035);
}

function buildSawmill(lot) {
  const { g, collide } = lotFrame(lot);

  const yard = createOutlinedMesh(new THREE.BoxGeometry(32, 0.3, 30), gravelMat, 0.03, false, true);
  yard.position.set(0, 0.05, 2);
  g.add(yard);

  // Open zaagloods met cirkelzaag
  const shed = new THREE.Group();
  const len = 16;
  const depth = 8;
  const h = 4.6;
  const back = createOutlinedMesh(new THREE.BoxGeometry(len, h, 0.3), logWallMat, 0.045);
  back.position.set(0, h * 0.5, -depth * 0.5);
  shed.add(back);
  for (let px = -len * 0.5; px <= len * 0.5 + 0.01; px += len / 4) {
    const post = createOutlinedMesh(new THREE.BoxGeometry(0.35, h + 0.6, 0.35), darkWoodMat, 0.03, false);
    post.position.set(px, (h + 0.6) * 0.5, depth * 0.5);
    shed.add(post);
  }
  const roof = createOutlinedMesh(new THREE.BoxGeometry(len + 1.2, 0.3, depth + 2.0), roofRedMat, 0.05);
  roof.position.set(0, h + 0.7, 0.2);
  roof.rotation.x = -0.12;
  shed.add(roof);
  const table = createOutlinedMesh(new THREE.BoxGeometry(12, 0.9, 1.6), darkWoodMat, 0.035);
  table.position.set(0, 0.6, 0);
  shed.add(table);
  const log = createOutlinedMesh(new THREE.CylinderGeometry(0.55, 0.55, 7, 10), lightWoodMat, 0.035);
  log.rotation.z = Math.PI * 0.5;
  log.position.set(-2, 1.6, 0);
  shed.add(log);
  const blade = createOutlinedMesh(new THREE.CylinderGeometry(1.3, 1.3, 0.08, 24), sawBladeMat, 0.03, false);
  blade.rotation.x = Math.PI * 0.5;
  blade.position.set(3, 1.5, 0);
  shed.add(blade);
  sawBlades.push(blade);
  shed.position.set(-3, 0.15, -8);
  g.add(shed);
  [-10, -3, 4].forEach((lx) => collide(lx, -10.5, 2.8));

  // Boomstammenstapels en plankenstapels
  const logs1 = logStack(4, 8, 0.45, logWallMat);
  logs1.position.set(11, 0.15, -6);
  logs1.rotation.y = Math.PI * 0.5;
  g.add(logs1);
  collide(11, -6, 3.8);
  const logs2 = logStack(3, 7, 0.4, logWallMat);
  logs2.position.set(12.5, 0.15, 5);
  logs2.rotation.y = Math.PI * 0.5;
  g.add(logs2);
  collide(12.5, 5, 3.0);

  [[-12, 8], [-6.5, 10]].forEach(([lx, lz]) => {
    const stack = new THREE.Group();
    for (let k = 0; k < 6; k++) {
      const plank = createOutlinedMesh(new THREE.BoxGeometry(4.2, 0.18, 1.6), lightWoodMat, 0.02, false);
      plank.position.y = 0.25 + k * 0.22;
      plank.rotation.y = (k % 2) * 0.05;
      stack.add(plank);
    }
    stack.position.set(lx, 0.15, lz);
    g.add(stack);
    collide(lx, lz, 2.2);
  });

  const sawdust = createOutlinedMesh(new THREE.ConeGeometry(3.0, 2.2, 9), lightWoodMat, 0.035);
  sawdust.position.set(-14, 1.2, -6);
  g.add(sawdust);
  collide(-14, -6, 2.8);

  const office = smallCabin(4.8, 3.0, 4.0, logWallMat, roofRedMat);
  office.position.set(10.5, 0.15, 14);
  office.rotation.y = -Math.PI * 0.5;
  g.add(office);
  collide(10.5, 14, 2.9);

  // Geparkeerde pickup bij het kantoor
  const truck = buildPickupTruckMesh(0x7a3a2a, 'Zagerij Pickup');
  const tc = Math.cos(lot.yaw);
  const ts = Math.sin(lot.yaw);
  const [plx, plz] = [5.5, 12.5];
  truck.root.position.set(lot.x + plx * tc + plz * ts, lot.roadY, lot.z - plx * ts + plz * tc);
  truck.root.rotation.y = lot.yaw + Math.PI;
  scene.add(truck.root);
  parkedCars.push(truck);

  entranceSign(lot, ['TIMBER MILL', 'Zagerij']);
}
const sawBlades = [];

// ---------------------------------------------------------
// HERFSTKERMIS
// ---------------------------------------------------------
function makeFairSignTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#c62e3f';
  ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = '#ffd23f';
  for (let k = 0; k < 16; k++) ctx.fillRect(k * 32, 0, 16, 10);
  ctx.fillStyle = '#fffaf0';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '900 64px system-ui, sans-serif';
  ctx.fillText('PINEWOOD FAIR', 256, 72);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function createFerrisWheel() {
  const g = new THREE.Group();
  const R = 7.0;
  const hubY = 8.4;
  [-1.4, 1.4].forEach((z) => {
    [-1, 1].forEach((side) => {
      const leg = createOutlinedMesh(new THREE.BoxGeometry(0.4, hubY + 0.6, 0.4), steelMat, 0.03);
      leg.position.set(side * 2.4, hubY * 0.5, z);
      leg.rotation.z = side * -0.28;
      g.add(leg);
    });
  });
  const axle = createOutlinedMesh(new THREE.CylinderGeometry(0.3, 0.3, 3.4, 10), steelMat, 0.03, false);
  axle.rotation.x = Math.PI * 0.5;
  axle.position.y = hubY;
  g.add(axle);

  const wheel = new THREE.Group();
  wheel.position.y = hubY;
  [-0.9, 0.9].forEach((z) => {
    const ring = createOutlinedMesh(new THREE.TorusGeometry(R, 0.14, 6, 40), makeToonMat(0xd94e3a), 0.03, false);
    ring.position.z = z;
    wheel.add(ring);
  });
  const gondolaCount = 10;
  for (let k = 0; k < gondolaCount; k++) {
    const a = (k / gondolaCount) * Math.PI * 2;
    const spoke = createOutlinedMesh(new THREE.BoxGeometry(0.12, R, 0.12), whiteMat, 0.015, false);
    spoke.position.set(Math.cos(a) * R * 0.5, Math.sin(a) * R * 0.5, 0);
    spoke.rotation.z = a - Math.PI * 0.5;
    wheel.add(spoke);
    for (let b = 0; b < 3; b++) {
      const bulb = new THREE.Mesh(bulbGeo, bulbMats[(k + b) % bulbMats.length]);
      const ba = a + (b / 3) * ((Math.PI * 2) / gondolaCount);
      bulb.position.set(Math.cos(ba) * R, Math.sin(ba) * R, 1.05);
      wheel.add(bulb);
    }
    const gondola = new THREE.Group();
    const cab = createOutlinedMesh(new THREE.BoxGeometry(1.3, 1.0, 1.3), makeToonMat([0xffd23f, 0x3f9fb8, 0x6cc04a, 0xe0762f, 0xc94a8a][k % 5]), 0.03);
    cab.position.y = -0.75;
    gondola.add(cab);
    const canopy = createOutlinedMesh(new THREE.BoxGeometry(1.5, 0.14, 1.5), whiteMat, 0.02, false);
    canopy.position.y = -0.12;
    gondola.add(canopy);
    gondola.position.set(Math.cos(a) * R, Math.sin(a) * R, 0);
    wheel.add(gondola);
    ferrisGondolas.push(gondola);
  }
  g.add(wheel);
  ferrisWheel = wheel;
  const light = new THREE.PointLight(0xffc870, 0, 34, 1.5);
  light.position.set(0, hubY, 3);
  g.add(light);
  nightLights.push({ light, day: 0, night: 3.6 });
  return g;
}

function createCarousel() {
  const g = new THREE.Group();
  const base = createOutlinedMesh(new THREE.CylinderGeometry(5.2, 5.4, 0.6, 20), makeToonMat(0xf1e4c8), 0.04);
  base.position.y = 0.3;
  g.add(base);
  const pole = createOutlinedMesh(new THREE.CylinderGeometry(0.5, 0.5, 4.6, 12), makeToonMat(0xd94e3a), 0.035);
  pole.position.y = 2.9;
  g.add(pole);
  // Gestreept dak: afwisselend rode en witte segmenten
  for (let k = 0; k < 12; k++) {
    const seg = new THREE.Mesh(new THREE.ConeGeometry(5.8, 2.0, 12, 1, false, (k / 12) * Math.PI * 2, (Math.PI * 2) / 12), k % 2 ? whiteMat : makeToonMat(0xd94e3a));
    seg.position.y = 6.0;
    g.add(seg);
  }
  const roofOutline = createOutlinedMesh(new THREE.ConeGeometry(5.8, 2.0, 12), new THREE.MeshBasicMaterial({ visible: false }), 0.05, false);
  roofOutline.position.y = 6.0;
  g.add(roofOutline);
  const topper = createOutlinedMesh(new THREE.SphereGeometry(0.45, 10, 8), makeToonMat(0xffd23f), 0.03, false);
  topper.position.y = 7.2;
  g.add(topper);

  const ride = new THREE.Group();
  const horseColors = [0xf6f2ea, 0x8a5a33, 0x3a2a22, 0xe8c38a];
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const horse = new THREE.Group();
    const body = createOutlinedMesh(new THREE.BoxGeometry(0.55, 0.7, 1.5), makeToonMat(horseColors[k % 4]), 0.03);
    horse.add(body);
    const head = createOutlinedMesh(new THREE.BoxGeometry(0.4, 0.75, 0.45), makeToonMat(horseColors[k % 4]), 0.025, false);
    head.position.set(0, 0.5, 0.75);
    head.rotation.x = -0.35;
    horse.add(head);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 4.0, 6), makeToonMat(0xffd23f));
    rod.position.y = 0.8;
    horse.add(rod);
    horse.position.set(Math.cos(a) * 3.8, 1.8, Math.sin(a) * 3.8);
    horse.rotation.y = -a;
    ride.add(horse);
    carouselHorses.push({ horse, phase: k * 0.8 });
  }
  g.add(ride);
  carousel = ride;
  return g;
}

function createFairBooth(stripeHex) {
  const g = new THREE.Group();
  const counter = createOutlinedMesh(new THREE.BoxGeometry(3.6, 1.1, 2.0), lightWoodMat, 0.035);
  counter.position.y = 0.55;
  g.add(counter);
  [-1.7, 1.7].forEach((px) => {
    const post = createOutlinedMesh(new THREE.BoxGeometry(0.14, 2.6, 0.14), whiteMat, 0.02, false);
    post.position.set(px, 1.3, 0.9);
    g.add(post);
  });
  for (let k = 0; k < 6; k++) {
    const stripe = createOutlinedMesh(new THREE.BoxGeometry(0.62, 0.14, 2.4), k % 2 ? whiteMat : makeToonMat(stripeHex), 0.02, false);
    stripe.position.set(-1.55 + k * 0.62, 2.7, 0.3);
    stripe.rotation.x = 0.25;
    g.add(stripe);
  }
  const back = createOutlinedMesh(new THREE.BoxGeometry(3.6, 2.6, 0.15), makeToonMat(stripeHex), 0.03, false);
  back.position.set(0, 1.3, -1.0);
  g.add(back);
  return g;
}

function buildFair(lot) {
  const { g, collide, toWorld } = lotFrame(lot);
  const fb = lot.flatBox;

  const ground = createOutlinedMesh(new THREE.BoxGeometry(48, 0.3, 46), gravelMat, 0.03, false, true);
  ground.position.set(0, 0.05, 0);
  g.add(ground);

  const wheel = createFerrisWheel();
  wheel.position.set(-12, 0.15, -12);
  wheel.rotation.y = 0.35;
  g.add(wheel);
  collide(-12, -12, 3.4);

  const car = createCarousel();
  car.position.set(12, 0.15, -10);
  g.add(car);
  collide(12, -10, 5.6);

  [[-9, 6, 0xd94e3a, Math.PI * 0.5], [-9, 13, 0x3f78a8, Math.PI * 0.5], [9, 6, 0x4c8a4a, -Math.PI * 0.5], [9, 13, 0xe0a030, -Math.PI * 0.5]].forEach(([lx, lz, col, rot]) => {
    const booth = createFairBooth(col);
    booth.position.set(lx, 0.15, lz);
    booth.rotation.y = rot;
    g.add(booth);
    collide(lx, lz, 2.0);
  });

  // Toegangspoort over de oprit
  const archZ = 22;
  [-4.2, 4.2].forEach((px) => {
    const post = createOutlinedMesh(new THREE.BoxGeometry(0.6, 6.0, 0.6), makeToonMat(0xd94e3a), 0.035);
    post.position.set(px, 3.0, archZ);
    g.add(post);
    collide(px, archZ, 0.6);
  });
  const signMat = new THREE.MeshBasicMaterial({ map: makeFairSignTexture() });
  const board = createOutlinedMesh(new THREE.BoxGeometry(9.2, 2.0, 0.3), makeToonMat(0xc62e3f), 0.04, false);
  board.position.set(0, 6.0, archZ);
  g.add(board);
  [1, -1].forEach((side) => {
    const face = new THREE.Mesh(new THREE.PlaneGeometry(8.9, 1.8), signMat);
    face.position.set(0, 6.0, archZ + side * 0.16);
    if (side < 0) face.rotation.y = Math.PI;
    g.add(face);
  });

  // Lichtslingers langs het middenpad
  [-5.5, 5.5].forEach((px) => {
    for (let lz = -16; lz <= 18; lz += 0.9) {
      const bulb = new THREE.Mesh(bulbGeo, bulbMats[Math.abs(Math.round(lz * 3)) % bulbMats.length]);
      bulb.position.set(px, 3.2 - Math.abs(Math.sin(lz * 0.35)) * 0.6, lz);
      g.add(bulb);
    }
    [-16, -4, 8, 18].forEach((lz) => {
      const post = createOutlinedMesh(new THREE.CylinderGeometry(0.08, 0.1, 3.4, 6), darkWoodMat, 0.02, false);
      post.position.set(px, 1.7, lz);
      g.add(post);
    });
  });

  // Hooibalen als decor
  const hayMat = makeToonMat(0xd9ac4e);
  [[-20, 14], [-19, 16], [20, 14], [21, 12]].forEach(([lx, lz]) => {
    const bale = createOutlinedMesh(new THREE.BoxGeometry(1.6, 0.9, 1.0), hayMat, 0.03);
    const w = toWorld(lx, lz);
    const y = lot.roadY - 0.16 + 0.6;
    bale.position.set(w.x, y, w.z);
    bale.rotation.y = lot.yaw;
    scene.add(bale);
    registerDestructible(bale, w.x, y, w.z, 0.8, 'small', 8, 'Hooibaal');
  });

  entranceSign(lot, ['PINEWOOD FAIR', 'Kermis']);
  void fb;
}

ruralLots.forEach((lot) => {
  if (lot.type === 'camping') buildCamping(lot);
  else if (lot.type === 'sawmill') buildSawmill(lot);
  else if (lot.type === 'fair') buildFair(lot);
});

// =========================================================
// ANIMATIES (aangeroepen vanuit de game-loop)
// =========================================================
export function updateAttractions(elapsed, dt, isNight) {
  if (ferrisWheel) {
    ferrisWheel.rotation.z = elapsed * 0.18;
    // Gondels blijven rechtop hangen
    ferrisGondolas.forEach((gd) => { gd.rotation.z = -ferrisWheel.rotation.z; });
  }
  if (carousel) {
    carousel.rotation.y = elapsed * 0.5;
    carouselHorses.forEach((h) => { h.horse.position.y = 1.8 + Math.sin(elapsed * 2.4 + h.phase) * 0.35; });
  }
  sawBlades.forEach((b) => { b.rotation.y = elapsed * 14; });
  fireFlames.forEach((f, i) => {
    const flicker = 0.85 + Math.sin(elapsed * 11 + i * 2.1) * 0.12 + Math.sin(elapsed * 23 + i) * 0.05;
    f.mesh.scale.set(1, flicker, 1);
  });
  nightLights.forEach((n) => {
    const target = isNight ? n.night : n.day;
    n.light.intensity += (target - n.light.intensity) * Math.min(1, dt * 2);
  });
}

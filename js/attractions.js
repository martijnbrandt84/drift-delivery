import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { scene, makeToonMat, registerSeasonalMat, createOutlinedMesh } from './scene-setup.js';
import { ruralLots } from './water-lots.js';
import { hardColliders, registerDestructible, markLastPlanted } from './demolition.js';
import { getTerrainHeight } from './terrain.js';
import { houseWindows, warmWindowMat } from './town.js';
import { createRoadSign } from './scenery.js';
import { buildPickupTruckMesh, parkedCars } from './vehicles.js';
import { createPineFast, createDeciduousTreeFast, createShrubFast } from './props.js';

// Tekst op borden: altijd net vóór het bord tekenen (geen flikkeren/wegvallen op afstand)
// Borden: echte sRGB-kleuren en geen filmische tonemapping, zodat rood rood blijft en tekst scherp is
const SIGN_MAT_OPTS = { polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, toneMapped: false };
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
const fairFlags = [];
const redCanvasMat = makeToonMat(0xd62839);
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
    [-11.5, -9.5, 'd'], [9.5, -10, 'd'], [6, 10.5, 'p'], [-6.5, 11.5, 'd'], [18.5, 18, 'p'],
    [-21, -8, 'p'], [-21.5, 14, 'p'], [21.5, -7, 'd'], [21.5, 3, 'p'], [-16, -19.5, 'p'], [12, -20.5, 'p'],
    [-3, -19.5, 'p'], [19.5, -14, 'd'], [-5, 4.5, 'd'], [-17.5, 21, 'p'], [14.5, 22.5, 'd'], [-9, 18, 'p'],
    [-4.5, 21.5, 'd'], [5.5, 18.5, 'p'], [16, -1, 'd']].forEach(([lx, lz, kind]) => {
    const w = toWorld(lx, lz);
    const sc = 0.62 + Math.random() * 0.25;
    const tree = kind === 'p' ? createPineFast(sc) : createDeciduousTreeFast(sc);
    tree.position.set(w.x, groundY, w.z);
    tree.rotation.y = Math.random() * Math.PI * 2;
    scene.add(tree);
    registerDestructible(tree, w.x, groundY, w.z, 0.85 * sc, 'tree', 15, kind === 'p' ? 'Dennenboom' : 'Loofboom');
    markLastPlanted();
  });
  const shrubSpots = [[6, 14], [13, 19.5], [-3.6, 9], [3.6, 13], [-3.6, 18], [3.6, 22], [-3.6, 25],
    [-18.5, -10], [19.5, -9], [-12, -19], [16, -19.5], [-3, -15.5], [3.5, -14.5], [-17, 13], [17, 1.5], [-9.5, -1],
    [-20, 0], [20.5, 8], [-13, 17], [11, 14.5], [-7.5, -12], [7, -13.5], [-19.5, -15], [19.5, -17.5], [0.5, -19],
    [-11, 6], [11.5, 1.5], [-15.5, 7.5], [15, 15], [8.5, 7.5], [-2.5, -11.5], [21, 17], [-21, 9]];
  shrubSpots.forEach(([lx, lz]) => {
    const w = toWorld(lx, lz);
    const big = Math.random() < 0.45;
    const sc = big ? 1.0 + Math.random() * 0.5 : 0.5 + Math.random() * 0.3;
    const shrub = createShrubFast(sc);
    shrub.position.set(w.x, groundY, w.z);
    shrub.rotation.y = Math.random() * Math.PI * 2;
    scene.add(shrub);
    registerDestructible(shrub, w.x, groundY, w.z, Math.max(0.6, 0.85 * sc), 'shrub', 3, big ? 'Grote struik' : 'Struik');
    markLastPlanted();
  });

  // Gezelligheid: klapstoeltjes rond het kampvuur, een hangmat, bloembakken bij de caravans
  const chairCols = [0xd94e3a, 0x3f78a8, 0xf4b41a, 0x6cc04a, 0xe07ab8];
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 + 1.0;
    const chair = new THREE.Group();
    const seat = createOutlinedMesh(new THREE.BoxGeometry(0.55, 0.08, 0.5), makeToonMat(chairCols[k]), 0.015, false);
    seat.position.y = 0.42;
    chair.add(seat);
    const back = createOutlinedMesh(new THREE.BoxGeometry(0.55, 0.55, 0.08), makeToonMat(chairCols[k]), 0.015, false);
    back.position.set(0, 0.7, -0.24);
    back.rotation.x = -0.25;
    chair.add(back);
    [[-0.24, 0.2], [0.24, 0.2], [-0.24, -0.2], [0.24, -0.2]].forEach(([lx2, lz2]) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.42, 0.04), steelMat);
      leg.position.set(lx2, 0.21, lz2);
      chair.add(leg);
    });
    const cw = toWorld(Math.cos(a) * 4.4, -7 + Math.sin(a) * 4.4);
    chair.position.set(cw.x, groundY, cw.z);
    chair.rotation.y = lot.yaw + Math.atan2(-Math.cos(a), -Math.sin(a));
    scene.add(chair);
    registerDestructible(chair, cw.x, groundY, cw.z, 0.45, 'small', 4, 'Klapstoel');
  }
  {
    // Hangmat tussen twee boompaaltjes
    const hm = new THREE.Group();
    [-1.8, 1.8].forEach((px2) => {
      const post = createOutlinedMesh(new THREE.CylinderGeometry(0.1, 0.12, 1.8, 6), darkWoodMat, 0.02, false);
      post.position.set(px2, 0.9, 0);
      hm.add(post);
    });
    const net = createOutlinedMesh(new THREE.BoxGeometry(3.0, 0.08, 0.9), makeToonMat(0xe8c46a), 0.015, false);
    net.position.y = 0.95;
    net.scale.y = 1;
    hm.add(net);
    const pillow = createOutlinedMesh(new THREE.BoxGeometry(0.5, 0.18, 0.6), makeToonMat(0xd94e3a), 0.015, false);
    pillow.position.set(1.15, 1.08, 0);
    hm.add(pillow);
    hm.position.set(12, 0.15, -6);
    hm.rotation.y = 0.4;
    g.add(hm);
  }
  [[-14, 10], [14, 6]].forEach(([cx2, cz2]) => {
    [-1.2, 1.2].forEach((ox) => {
      const pot = createOutlinedMesh(new THREE.CylinderGeometry(0.28, 0.22, 0.4, 8), makeToonMat(0xb8643a), 0.015, false);
      pot.position.set(cx2 + ox, 0.35, cz2 + 1.6);
      g.add(pot);
      [0xe07ab8, 0xffd23f, 0xffffff].forEach((c, k) => {
        const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 5), makeToonMat(c));
        bloom.position.set(cx2 + ox - 0.1 + k * 0.1, 0.65, cz2 + 1.6 + (k % 2) * 0.08);
        g.add(bloom);
      });
    });
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
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#b8243a';
  ctx.fillRect(0, 0, 1024, 256);
  ctx.strokeStyle = '#ffd23f';
  ctx.lineWidth = 16;
  ctx.strokeRect(12, 12, 1000, 232);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '900 128px system-ui, sans-serif';
  ctx.lineWidth = 14;
  ctx.strokeStyle = '#5a0f1c';
  ctx.strokeText('PINEWOOD FAIR', 512, 122);
  ctx.fillStyle = '#fffaf0';
  ctx.fillText('PINEWOOD FAIR', 512, 122);
  ctx.font = 'bold 34px system-ui, sans-serif';
  ctx.fillStyle = '#ffd23f';
  ctx.fillText('★ RIDES · GAMES · FOOD ★', 512, 214);
  const tex = Object.assign(new THREE.CanvasTexture(canvas), { colorSpace: THREE.SRGBColorSpace });
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

function makeStandSignTexture(text, bg, fg) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '900 38px system-ui, sans-serif';
  ctx.fillText(text, 128, 34);
  const tex = Object.assign(new THREE.CanvasTexture(canvas), { colorSpace: THREE.SRGBColorSpace });
  tex.needsUpdate = true;
  return tex;
}

// Grote rood-witte circustent
function createBigTop() {
  const g = new THREE.Group();
  const R = 5.6;
  const wallH = 3.0;
  for (let k = 0; k < 16; k++) {
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(R, R, wallH, 16, 1, true, (k / 16) * Math.PI * 2, (Math.PI * 2) / 16), k % 2 ? whiteMat : redCanvasMat);
    seg.material.side = THREE.DoubleSide;
    seg.position.y = wallH * 0.5;
    g.add(seg);
    const roofSeg = new THREE.Mesh(new THREE.ConeGeometry(R + 0.6, 4.2, 16, 1, false, (k / 16) * Math.PI * 2, (Math.PI * 2) / 16), k % 2 ? redCanvasMat : whiteMat);
    roofSeg.position.y = wallH + 2.1;
    g.add(roofSeg);
  }
  const outlineShell = createOutlinedMesh(new THREE.ConeGeometry(R + 0.6, 4.2, 16), new THREE.MeshBasicMaterial({ visible: false }), 0.06, false);
  outlineShell.position.y = wallH + 2.1;
  g.add(outlineShell);
  const pole = createOutlinedMesh(new THREE.CylinderGeometry(0.08, 0.08, 1.6, 6), darkWoodMat, 0.02, false);
  pole.position.y = wallH + 4.9;
  g.add(pole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.6), new THREE.MeshBasicMaterial({ color: 0xffd23f, side: THREE.DoubleSide }));
  flag.position.set(0.55, wallH + 5.4, 0);
  g.add(flag);
  fairFlags.push(flag);
  const entrance = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.4), makeToonMat(0x3a1a12));
  entrance.position.set(0, 1.2, R + 0.02);
  g.add(entrance);
  return g;
}

// Botsautohal met dak en een paar gekleurde botsautootjes
function createBumperCars() {
  const g = new THREE.Group();
  const floor = createOutlinedMesh(new THREE.BoxGeometry(10, 0.3, 8), makeToonMat(0x5a5f68), 0.03, false, true);
  floor.position.y = 0.15;
  g.add(floor);
  [[-4.7, -3.7], [4.7, -3.7], [-4.7, 3.7], [4.7, 3.7]].forEach(([px, pz]) => {
    const post = createOutlinedMesh(new THREE.BoxGeometry(0.3, 3.6, 0.3), whiteMat, 0.025, false);
    post.position.set(px, 1.9, pz);
    g.add(post);
  });
  const roof = createOutlinedMesh(new THREE.BoxGeometry(10.6, 0.5, 8.6), makeToonMat(0xd94e3a), 0.04);
  roof.position.y = 3.9;
  g.add(roof);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 1.1), new THREE.MeshBasicMaterial({ map: makeStandSignTexture('BUMPER CARS', '#ffd23f', '#b8243a'), ...SIGN_MAT_OPTS }));
  sign.position.set(0, 4.7, 4.32);
  g.add(sign);
  const signBack = createOutlinedMesh(new THREE.BoxGeometry(5.8, 1.3, 0.15), makeToonMat(0xffd23f), 0.025, false);
  signBack.position.set(0, 4.7, 4.22);
  g.add(signBack);
  [[-2.5, -1.5, 0xc94a8a, 0.4], [1.8, -2.2, 0x3f9fb8, 2.1], [2.6, 1.6, 0x6cc04a, -1.0], [-1.2, 2.0, 0xffd23f, 2.8]].forEach(([cx, cz, col, rot]) => {
    const car = new THREE.Group();
    const body = createOutlinedMesh(new THREE.BoxGeometry(1.2, 0.5, 1.6), makeToonMat(col), 0.03);
    body.position.y = 0.55;
    car.add(body);
    const bumper = createOutlinedMesh(new THREE.TorusGeometry(0.8, 0.12, 5, 14), makeToonMat(0x2b2b2b), 0.015, false);
    bumper.rotation.x = Math.PI * 0.5;
    bumper.scale.set(0.85, 1.1, 1);
    bumper.position.y = 0.4;
    car.add(bumper);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 3.0, 4), steelMat);
    pole.position.set(0, 2.3, -0.6);
    car.add(pole);
    car.position.set(cx, 0.15, cz);
    car.rotation.y = rot;
    g.add(car);
  });
  return g;
}

// Eetkraam met een groot "product" op het dak
function createFoodStand(kind, colorOverride = null) {
  const cfg = {
    popcorn: { col: 0xd94e3a, label: 'POPCORN' },
    candy: { col: 0xe07ab8, label: 'COTTON CANDY' },
    hotdog: { col: 0xe0a030, label: 'HOT DOGS' }
  }[kind];
  const g = createFairBooth(colorOverride ?? cfg.col);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.8), new THREE.MeshBasicMaterial({ map: makeStandSignTexture(cfg.label, '#fffaf0', '#b8243a'), ...SIGN_MAT_OPTS }));
  sign.position.set(0, 3.35, 1.26);
  g.add(sign);
  const prop = new THREE.Group();
  if (kind === 'popcorn') {
    const bucket = createOutlinedMesh(new THREE.CylinderGeometry(0.75, 0.55, 1.2, 12), redCanvasMat, 0.03);
    prop.add(bucket);
    for (let k = 0; k < 9; k++) {
      const kernel = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 5), makeToonMat(0xfff3c8));
      kernel.position.set((Math.random() - 0.5) * 0.9, 0.7 + Math.random() * 0.25, (Math.random() - 0.5) * 0.9);
      prop.add(kernel);
    }
  } else if (kind === 'candy') {
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.2, 5), whiteMat);
    prop.add(stick);
    const fluff = createOutlinedMesh(new THREE.SphereGeometry(0.75, 10, 8), makeToonMat(0xf7a6d8), 0.03);
    fluff.position.y = 0.9;
    fluff.scale.set(1, 1.15, 1);
    prop.add(fluff);
  } else {
    const bun = createOutlinedMesh(new THREE.CapsuleGeometry(0.35, 1.4, 4, 8), makeToonMat(0xe0a04a), 0.03);
    bun.rotation.z = Math.PI * 0.5;
    prop.add(bun);
    const sausage = createOutlinedMesh(new THREE.CapsuleGeometry(0.2, 1.8, 4, 8), makeToonMat(0xb8432f), 0.02, false);
    sausage.rotation.z = Math.PI * 0.5;
    sausage.position.y = 0.25;
    prop.add(sausage);
  }
  prop.position.y = 3.9;
  g.add(prop);
  return g;
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
  const groundY = lot.roadY - 0.16 + 0.15;

  // Losse, omrijdbare objecten staan direct in de wereld (niet in de gedraaide groep)
  const placeLoose = (obj, lx, lz, rotOff, r, pts, label, yOff = 0) => {
    const w = toWorld(lx, lz);
    const y = groundY + yOff;
    obj.position.set(w.x, y, w.z);
    obj.rotation.y = lot.yaw + rotOff;
    scene.add(obj);
    registerDestructible(obj, w.x, y, w.z, r, 'small', pts, label);
  };

  const ground = createOutlinedMesh(new THREE.BoxGeometry(48, 0.3, 46), gravelMat, 0.03, false, true);
  ground.position.set(0, 0.05, 0);
  g.add(ground);

  // ---- Achterin: circustent in het midden, reuzenrad links, draaimolen rechts ----
  const bigTop = createBigTop();
  bigTop.position.set(0, 0.15, -15.5);
  g.add(bigTop);
  collide(0, -15.5, 5.8);

  const wheel = createFerrisWheel();
  wheel.position.set(-15, 0.15, -12);
  wheel.rotation.y = 0.35;
  g.add(wheel);
  collide(-15, -12, 3.4);

  const car = createCarousel();
  car.position.set(15, 0.15, -11);
  g.add(car);
  collide(15, -11, 5.6);

  // ---- Langs het middenpad: eten links, spelletjes + popcorn rechts ----
  [[-9, 3, 'hotdog'], [-9, 11, 'candy']].forEach(([lx, lz, kind]) => {
    const stand = createFoodStand(kind);
    stand.position.set(lx, 0.15, lz);
    stand.rotation.y = Math.PI * 0.5;
    g.add(stand);
    collide(lx, lz, 2.0);
  });
  // De blauwe kraam is nu de popcornkraam
  const popcorn = createFoodStand('popcorn', 0x3f78a8);
  popcorn.position.set(9, 0.15, 11);
  popcorn.rotation.y = -Math.PI * 0.5;
  g.add(popcorn);
  collide(9, 11, 2.0);
  const ringToss = createGameStand();
  ringToss.position.set(9, 0.15, 3);
  ringToss.rotation.y = -Math.PI * 0.5;
  g.add(ringToss);
  collide(9, 3, 2.0);

  // ---- Rechts: botsautohal ----
  const bumper = createBumperCars();
  bumper.position.set(19, 0.15, 8);
  bumper.rotation.y = -Math.PI * 0.5;
  g.add(bumper);
  collide(19, 5, 3.2);
  collide(19, 11, 3.2);

  // ---- Links: picknickhoek met tafels en hooibalen (alles omrijdbaar) ----
  [[-19, 5, 0.2], [-18.5, 12, -0.15]].forEach(([lx, lz, rot]) => {
    placeLoose(picnicTable(makeToonMat(0xd94e3a)), lx, lz, rot, 1.1, 10, 'Picknicktafel', -0.03);
  });
  const hayMat = makeToonMat(0xd9ac4e);
  [[-21.5, 0], [-20, -1.2], [-16, 17], [16, 17.5], [21, 1.5]].forEach(([lx, lz]) => {
    const bale = createOutlinedMesh(new THREE.BoxGeometry(1.6, 0.9, 1.0), hayMat, 0.03);
    placeLoose(bale, lx, lz, Math.random() * 0.6, 0.8, 8, 'Hooibaal', 0.45);
  });

  // ---- Toegangspoort: palen ruim naast het bord zodat de naam vrij leesbaar is ----
  const archZ = 22;
  [-7.7, 7.7].forEach((px) => {
    for (let k = 0; k < 4; k++) {
      const band = createOutlinedMesh(new THREE.BoxGeometry(0.8, 1.9, 0.8), k % 2 ? whiteMat : redCanvasMat, 0.035, false);
      band.position.set(px, 0.95 + k * 1.9, archZ);
      g.add(band);
    }
    const ball = createOutlinedMesh(new THREE.SphereGeometry(0.55, 10, 8), makeToonMat(0xffd23f), 0.03, false);
    ball.position.set(px, 8.2, archZ);
    g.add(ball);
    collide(px, archZ, 0.75);
  });
  const signMat = new THREE.MeshBasicMaterial({ map: makeFairSignTexture(), ...SIGN_MAT_OPTS });
  const board = createOutlinedMesh(new THREE.BoxGeometry(13.4, 3.4, 0.4), makeToonMat(0xb8243a), 0.05, false);
  board.position.set(0, 7.0, archZ);
  g.add(board);
  [1, -1].forEach((side) => {
    const face = new THREE.Mesh(new THREE.PlaneGeometry(13.0, 3.25), signMat);
    face.position.set(0, 7.0, archZ + side * 0.27);
    if (side < 0) face.rotation.y = Math.PI;
    g.add(face);
  });
  // Ophangbalk tussen de palen, boven het bord
  const beam = createOutlinedMesh(new THREE.BoxGeometry(15.4, 0.35, 0.35), whiteMat, 0.025, false);
  beam.position.set(0, 9.0, archZ);
  g.add(beam);
  for (let k = 0; k <= 28; k++) {
    const bulb = new THREE.Mesh(bulbGeo, bulbMats[k % bulbMats.length]);
    bulb.position.set(-6.6 + (k / 28) * 13.2, 8.85, archZ + 0.3);
    g.add(bulb);
  }

  // ---- Omrijdbaar hekje met vlaggetjes rondom (per stuk van ~2.4m) ----
  const bunting = [0xd94e3a, 0xffd23f, 0x3f78a8, 0x6cc04a, 0xe07ab8].map((c) => new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }));
  const flagGeo = new THREE.BufferGeometry();
  flagGeo.setAttribute('position', new THREE.Float32BufferAttribute([-0.3, 0, 0, 0.3, 0, 0, 0, -0.5, 0], 3));
  flagGeo.computeVertexNormals();
  const railGeo = new THREE.BoxGeometry(2.4, 0.1, 0.08);
  const postGeo = new THREE.BoxGeometry(0.12, 1.1, 0.12);
  let flagIdx = 0;
  const edges = [[[-24, -23], [24, -23]], [[24, -23], [24, 23]], [[-24, -23], [-24, 23]], [[-24, 23], [-9.2, 23]], [[9.2, 23], [24, 23]]];
  edges.forEach(([[x0, z0], [x1, z1]]) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(1, Math.round(len / 2.4));
    const segLen = len / n;
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n;
      const section = new THREE.Group();
      [0.45, 0.85].forEach((ry) => {
        const rail = createOutlinedMesh(railGeo, whiteMat, 0.015, false);
        rail.position.y = ry;
        rail.scale.x = segLen / 2.4;
        section.add(rail);
      });
      const post = createOutlinedMesh(postGeo, whiteMat, 0.015, false);
      post.position.set(-segLen * 0.5, 0.55, 0);
      section.add(post);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.8, 4), darkWoodMat);
      pole.position.set(-segLen * 0.5, 1.4, 0);
      section.add(pole);
      const flag = new THREE.Mesh(flagGeo, bunting[flagIdx++ % bunting.length]);
      flag.position.set(0, 1.75, 0);
      section.add(flag);
      const line = new THREE.Mesh(new THREE.BoxGeometry(segLen, 0.02, 0.02), darkWoodMat);
      line.position.y = 1.78;
      section.add(line);
      placeLoose(section, x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, -Math.atan2(z1 - z0, x1 - x0), 1.1, 5, 'Kermishek');
    }
  });

  // ---- Ballonnen, prullenbakken en lantaarnpaaltjes (omrijdbaar) ----
  [[-11.5, archZ - 2], [11.5, archZ - 2.5], [4, -4]].forEach(([lx, lz], i) => {
    const bunch = new THREE.Group();
    [0xd94e3a, 0xffd23f, 0x3f9fb8, 0xe07ab8, 0x6cc04a].forEach((c, k) => {
      const a = (k / 5) * Math.PI * 2 + i;
      const balloon = createOutlinedMesh(new THREE.SphereGeometry(0.4, 10, 8), makeToonMat(c), 0.025, false);
      balloon.scale.set(1, 1.2, 1);
      balloon.position.set(Math.cos(a) * 0.5, 3.0 + (k % 3) * 0.35, Math.sin(a) * 0.5);
      bunch.add(balloon);
    });
    const weight = createOutlinedMesh(new THREE.CylinderGeometry(0.2, 0.25, 0.3, 8), darkWoodMat, 0.02, false);
    weight.position.y = 0.15;
    bunch.add(weight);
    const string = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 2.8, 3), whiteMat);
    string.position.y = 1.55;
    bunch.add(string);
    placeLoose(bunch, lx, lz, 0, 0.6, 6, 'Ballonnen');
  });
  const binMat = makeToonMat(0x3f6b4a);
  [[-4.2, 16], [4.2, 16], [-4.2, -2], [4.2, -6]].forEach(([lx, lz]) => {
    const bin = new THREE.Group();
    const body = createOutlinedMesh(new THREE.CylinderGeometry(0.35, 0.3, 0.9, 10), binMat, 0.025);
    body.position.y = 0.45;
    bin.add(body);
    const lid = createOutlinedMesh(new THREE.CylinderGeometry(0.38, 0.38, 0.08, 10), whiteMat, 0.015, false);
    lid.position.y = 0.93;
    bin.add(lid);
    placeLoose(bin, lx, lz, 0, 0.45, 6, 'Prullenbak');
  });

  // Lichtslingers boven het middenpad (decor boven je hoofd)
  [-5.5, 5.5].forEach((px) => {
    for (let lz = -8; lz <= 19; lz += 0.9) {
      const bulb = new THREE.Mesh(bulbGeo, bulbMats[Math.abs(Math.round(lz * 3)) % bulbMats.length]);
      bulb.position.set(px, 3.8 - Math.abs(Math.sin(lz * 0.35)) * 0.5, lz);
      g.add(bulb);
    }
    [-8, 4, 19].forEach((lz) => {
      const post = createOutlinedMesh(new THREE.CylinderGeometry(0.08, 0.1, 4.0, 6), darkWoodMat, 0.02, false);
      post.position.set(px, 2.0, lz);
      g.add(post);
      collide(px, lz, 0.3);
    });
  });
  for (let k = 0; k < 3; k++) {
    const z0 = -6 + k * 9;
    for (let b = 0; b <= 14; b++) {
      const t = b / 14;
      const bulb = new THREE.Mesh(bulbGeo, bulbMats[(b + k) % bulbMats.length]);
      bulb.position.set(-5.5 + t * 11, 3.8 - Math.sin(t * Math.PI) * 0.6, z0 + t * 4.5);
      g.add(bulb);
    }
  }

  entranceSign(lot, ['PINEWOOD FAIR', 'Kermis']);
}

// Spelletjeskraam: ringwerpen met flessen op de toonbank
function createGameStand() {
  const g = createFairBooth(0xd94e3a);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.8), new THREE.MeshBasicMaterial({ map: makeStandSignTexture('RING TOSS', '#fffaf0', '#b8243a'), ...SIGN_MAT_OPTS }));
  sign.position.set(0, 3.35, 1.26);
  g.add(sign);
  const bottleMat = makeToonMat(0x3f9f6a);
  for (let k = 0; k < 6; k++) {
    const bottle = createOutlinedMesh(new THREE.CylinderGeometry(0.09, 0.12, 0.45, 8), bottleMat, 0.012, false);
    bottle.position.set(-1.2 + k * 0.48, 1.33, 0.2);
    g.add(bottle);
  }
  const prize = createOutlinedMesh(new THREE.SphereGeometry(0.35, 10, 8), makeToonMat(0xe07ab8), 0.02, false);
  prize.position.set(1.2, 2.2, -0.7);
  g.add(prize);
  return g;
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
  fairFlags.forEach((f, i) => { f.rotation.y = Math.sin(elapsed * 3 + i) * 0.35; });
  fireFlames.forEach((f, i) => {
    const flicker = 0.85 + Math.sin(elapsed * 11 + i * 2.1) * 0.12 + Math.sin(elapsed * 23 + i) * 0.05;
    f.mesh.scale.set(1, flicker, 1);
  });
  nightLights.forEach((n) => {
    const target = isNight ? n.night : n.day;
    n.light.intensity += (target - n.light.intensity) * Math.min(1, dt * 2);
  });
}

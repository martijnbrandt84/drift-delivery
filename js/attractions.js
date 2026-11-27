import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { scene, makeToonMat, registerSeasonalMat, createOutlinedMesh } from './scene-setup.js';
import { ruralLots } from './water-lots.js';
import { hardColliders, registerDestructible, markLastPlanted, destructibles, syncInstancedDestructible } from './demolition.js';
import { LOOKOUT_HILL } from './landscape.js';
import { clearVegetationAround } from './vegetation.js';
import { getClosestNetworkRoad } from './roads.js';
import { getTerrainHeight, getLocalSlope } from './terrain.js';
import { houseWindows, warmWindowMat, createLogCabin } from './town.js';
import { createRoadSign } from './scenery.js';
import { buildPickupTruckMesh, parkedCars } from './vehicles.js';
import { createPineFast, createDeciduousTreeFast, createShrubFast, plantNaturalGrove } from './props.js';
import { tagMap } from './map-tags.js';

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
function createTent__build(colorHex) {
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

function createCaravan__build(stripeHex) {
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

// ---------- Wegmotel (vervangt de camping) ----------
function motelSignTexture(lines, bg = '#1d2733', border = '#f4c430', w = 512, h = 256) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = border;
  ctx.lineWidth = Math.round(h * 0.05);
  ctx.strokeRect(ctx.lineWidth, ctx.lineWidth, w - ctx.lineWidth * 2, h - ctx.lineWidth * 2);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach(([text, color, size, y]) => {
    ctx.fillStyle = color;
    ctx.font = `900 ${size}px system-ui, sans-serif`;
    ctx.fillText(text, w / 2, y);
  });
  const tex = Object.assign(new THREE.CanvasTexture(c), { colorSpace: THREE.SRGBColorSpace });
  tex.needsUpdate = true;
  return tex;
}

function buildMotel(lot) {
  const { g, collide, toWorld } = lotFrame(lot);
  // Klassiek motelpalet: crèmewit, steenrood en mintgroene deuren
  const wallMat = makeToonMat(0xf6f1e7);
  const trimMat = makeToonMat(0xb8412f);
  const doorMint = makeToonMat(0x7fc8b8);
  const doorMats = [doorMint, doorMint, doorMint];
  const asphalt = makeToonMat(0x4a474c);
  const lineMat = makeToonMat(0xf2ede4);
  const roofMat = registerSeasonalMat(0x3f444c, 0xf2f6fb);

  // Parkeerterrein voor de kamers
  const pad = tagMap(new THREE.Mesh(new THREE.BoxGeometry(30, 0.3, 16.5), asphalt), 'paved');
  pad.position.set(0, 0.0, 1.75);
  g.add(pad);

  // L-vormig gebouw: lange rij kamers achteraan en een korte vleugel links, kantoor rechts
  const building = tagMap(new THREE.Group(), 'shop');
  g.add(building);
  const roomRow = (x0, z0, len, alongX, firstNo) => {
    const depth = 6.0;
    const h = 3.3;
    const cx = alongX ? x0 + len / 2 : x0 - depth / 2;
    const cz = alongX ? z0 - depth / 2 : z0 + len / 2;
    const w = alongX ? len : depth;
    const d = alongX ? depth : len;
    const body = createOutlinedMesh(new THREE.BoxGeometry(w, h, d), wallMat, 0.05);
    body.position.set(cx, h / 2 + 0.15, cz);
    building.add(body);
    const roof = createOutlinedMesh(new THREE.BoxGeometry(w + 0.6, 0.35, d + 0.6), roofMat, 0.04);
    roof.position.set(cx, h + 0.32, cz);
    building.add(roof);
    // Overdekte galerij langs de kamerdeuren
    const canopy = createOutlinedMesh(new THREE.BoxGeometry(alongX ? len : 2.2, 0.2, alongX ? 2.2 : len), trimMat, 0.03, false);
    canopy.position.set(alongX ? cx : x0 + 1.1, h + 0.05, alongX ? z0 + 1.1 : cz);
    building.add(canopy);
    const walk = createOutlinedMesh(new THREE.BoxGeometry(alongX ? len : 2.2, 0.2, alongX ? 2.2 : len), makeToonMat(0xd8d2c4), 0.02, false, true);
    walk.position.set(alongX ? cx : x0 + 1.1, 0.2, alongX ? z0 + 1.1 : cz);
    building.add(walk);
    const rooms = Math.floor(len / 3.4);
    for (let k = 0; k < rooms; k++) {
      const t = (k + 0.5) * (len / rooms);
      const px = alongX ? x0 + t : x0;
      const pz = alongX ? z0 : z0 + t;
      const door = createOutlinedMesh(new THREE.BoxGeometry(alongX ? 0.95 : 0.08, 2.1, alongX ? 0.08 : 0.95), doorMats[k % 3], 0.015, false);
      door.position.set(px - (alongX ? 0.8 : -0.04), 1.2, pz + (alongX ? 0.04 : 0.8));
      building.add(door);
      const win = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.9), warmWindowMat);
      win.position.set(px + (alongX ? 0.7 : 0.05), 1.6, pz + (alongX ? 0.05 : -0.7));
      if (!alongX) win.rotation.y = Math.PI / 2;
      building.add(win);
      houseWindows.push({ mesh: win, timer: Math.random() * 10 });
      // Kamernummer
      const tex = motelSignTexture([[String(firstNo + k), '#3a2a12', 170, 135]], '#d8b65a', '#8a6a2a');
      const num = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.25), new THREE.MeshBasicMaterial({ map: tex, ...SIGN_MAT_OPTS }));
      num.position.set(door.position.x + (alongX ? 0 : 0.06), 2.5, door.position.z + (alongX ? 0.06 : 0));
      if (!alongX) num.rotation.y = Math.PI / 2;
      building.add(num);
      // Posten van de galerij
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, h - 0.1, 0.14), trimMat);
      post.position.set(alongX ? x0 + (k + 1) * (len / rooms) - 0.1 : x0 + 2.1, h / 2 + 0.1, alongX ? z0 + 2.1 : z0 + (k + 1) * (len / rooms) - 0.1);
      building.add(post);
    }
    for (let k = 0; k <= Math.round(len / 3); k++) {
      const pc = toWorld(alongX ? x0 + k * 3 : x0 - depth / 2, alongX ? z0 - depth / 2 : z0 + k * 3);
      hardColliders.push({ x: pc.x, z: pc.z, r: 3.1 });
    }
  };
  roomRow(-14, -6.5, 22, true, 1);       // rij achteraan: kamers 1-6
  roomRow(-8.0, -6.5, 10.5, false, 7);   // vleugel links: kamers 7-9

  // Kantoor met glazen pui en bord
  {
    const office = createOutlinedMesh(new THREE.BoxGeometry(6.5, 4.2, 6.5), wallMat, 0.05);
    office.position.set(11.5, 2.25, -9.5);
    building.add(office);
    const oRoof = createOutlinedMesh(new THREE.BoxGeometry(7.3, 0.4, 7.3), trimMat, 0.04);
    oRoof.position.set(11.5, 4.5, -9.5);
    building.add(oRoof);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 2.4), warmWindowMat);
    glass.position.set(11.5, 1.7, -6.22);
    building.add(glass);
    houseWindows.push({ mesh: glass, timer: Math.random() * 10 });
    const boardBack = createOutlinedMesh(new THREE.BoxGeometry(4.4, 0.95, 0.14), makeToonMat(0xfdf8ee), 0.02, false);
    boardBack.position.set(11.5, 3.75, -6.18);
    building.add(boardBack);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 0.8), new THREE.MeshBasicMaterial({ map: motelSignTexture([['OFFICE', '#b8412f', 88, 66]], '#fdf8ee', '#b8412f', 640, 128), ...SIGN_MAT_OPTS }));
    board.position.set(11.5, 3.75, -6.09);
    building.add(board);
    for (let k = 0; k < 7; k++) {
      const stripe = createOutlinedMesh(new THREE.BoxGeometry(0.78, 0.1, 1.1), k % 2 ? makeToonMat(0xf6f1e7) : trimMat, 0.012, false);
      stripe.position.set(9.15 + k * 0.78, 3.05, -5.7);
      stripe.rotation.x = 0.3;
      building.add(stripe);
    }
    [[9.1, 1.6, 0xdfe8ee, 'Ice machine'], [14.0, 1.9, 0xd62839, 'Vending machine']].forEach(([lx, hgt, col, name]) => {
      const box = new THREE.Group();
      const body = createOutlinedMesh(new THREE.BoxGeometry(1.0, hgt, 0.8), makeToonMat(col), 0.02, false);
      body.position.y = hgt / 2;
      box.add(body);
      const w = toWorld(lx, -5.6);
      const by = lot.roadY - 0.16 + 0.2;
      box.position.set(w.x, by, w.z);
      box.rotation.y = lot.yaw;
      scene.add(box);
      registerDestructible(box, w.x, by, w.z, 0.6, 'small', 6, name);
    });
    [[11.5, -9.5]].forEach(([lx, lz]) => {
      const p = toWorld(lx, lz);
      hardColliders.push({ x: p.x, z: p.z, r: 4.4 });
    });
  }

  // Belijning van de parkeervakken voor de kamers
  for (let k = 0; k <= 5; k++) {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 4.6), lineMat);
    line.rotation.x = -Math.PI / 2;
    line.position.set(-5.0 + k * 2.6, 0.16, -2.0);
    g.add(line);
  }

  // Klein omheind zwembad rechtsvoor
  {
    const deck = createOutlinedMesh(new THREE.BoxGeometry(8.5, 0.2, 6.5), makeToonMat(0xe2d2b4), 0.02, false, true);
    deck.position.set(10.0, 0.2, 5.5);
    g.add(deck);
    const water = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.06, 3.6), new THREE.MeshBasicMaterial({ color: 0x5fd0e6 }));
    water.position.set(10.0, 0.32, 5.5);
    g.add(water);
    const fenceMat = makeToonMat(0xf6f2ea);
    [[10.0, 2.25, 8.5, 0.08], [10.0, 8.75, 8.5, 0.08], [5.75, 5.5, 0.08, 6.5], [14.25, 5.5, 0.08, 6.5]].forEach(([fx, fz, fw, fd]) => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(fw, 0.08, fd), fenceMat);
      rail.position.set(fx, 1.1, fz);
      g.add(rail);
    });
    for (let a = 0; a < 14; a++) {
      const t = a / 14;
      const per = [[5.75 + t * 8.5, 2.25], [5.75 + t * 8.5, 8.75], [5.75, 2.25 + t * 6.5], [14.25, 2.25 + t * 6.5]];
      per.forEach(([px, pz]) => {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.1, 0.08), fenceMat);
        post.position.set(px, 0.6, pz);
        g.add(post);
      });
    }
    const p = toWorld(10.0, 5.5);
    hardColliders.push({ x: p.x, z: p.z, r: 4.6 });
  }

  // Neonzuil aan de weg: MOTEL + VACANCY (gloeit 's nachts)
  {
    // Dwars op de weg gedraaid, zodat het verkeer uit beide richtingen het bord ziet aankomen
    const pyl = new THREE.Group();
    pyl.position.set(-12.5, 0, 15.5);
    pyl.rotation.y = Math.PI / 2;
    g.add(pyl);
    const pole = createOutlinedMesh(new THREE.BoxGeometry(0.45, 7.5, 0.45), trimMat, 0.03);
    pole.position.set(0, 3.75, 0);
    pyl.add(pole);
    const tex = motelSignTexture([['MOTEL', '#c8321f', 150, 105], ['VACANCY', '#1f8a4c', 58, 202]], '#fdf8ee', '#b8412f');
    [1, -1].forEach((side) => {
      const face = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.1), new THREE.MeshBasicMaterial({ map: tex, ...SIGN_MAT_OPTS }));
      face.position.set(0, 7.4, side * 0.2);
      if (side < 0) face.rotation.y = Math.PI;
      pyl.add(face);
    });
    const frame = createOutlinedMesh(new THREE.BoxGeometry(4.5, 2.4, 0.3), trimMat, 0.03);
    frame.position.set(0, 7.4, 0);
    pyl.add(frame);
    const glow = new THREE.PointLight(0xff5a5a, 0, 22, 1.6);
    glow.position.set(0, 7.4, 1.0);
    pyl.add(glow);
    nightLights.push({ light: glow, day: 0, night: 2.6 });
    const p = toWorld(-12.5, 15.5);
    hardColliders.push({ x: p.x, z: p.z, r: 0.6 });
  }

  // Twee geparkeerde pickups bij de kamers
  [[-3.7, -2.0, 0x3f78a8, 'Motel Pickup'], [4.1, -2.0, 0x8a5a3c, 'Brown Pickup']].forEach(([lx, lz, col, name]) => {
    const truck = buildPickupTruckMesh(col, name);
    const p = toWorld(lx, lz);
    truck.root.position.set(p.x, lot.roadY - 0.16 + 0.22, p.z);
    truck.root.rotation.y = lot.yaw + Math.PI;
    scene.add(truck.root);
    parkedCars.push(truck);
  });

  // Bos rondom (achter en opzij), open aan de wegkant
  // Natuurlijk bos: een paar plukjes achter en naast het motel die aansluiten op het bos aan de oostkant,
  // naar de zeekant toe dunner; niet op het terrein, de oprit, bij het bord of op de klif
  plantNaturalGrove({
    toWorld,
    refY: lot.roadY - 0.16,
    maxDY: 2.2,
    maxSlope: 0.45,
    clusters: [
      [16, -24, 12, 13, 0.65, 0.75], // achter rechts: dicht, richting het bos
      [29, -6, 10, 8, 0.55, 1.0],    // rechts, sluit aan op het bestaande bos
      [-6, -23, 8, 5, 0.7, 1.3],     // achter midden-links: luchtiger
      [-24, -12, 6, 3, 0.4, 1.0],    // los groepje links
      [-27, 8, 5, 2, 0.2, 2.2]       // een paar verspreide bomen richting zee
    ],
    allowed: (lx, lz) => {
      if (lx > -18 && lx < 18 && lz > -15 && lz < 14) return false;
      if (Math.abs(lx) < 7 && lz > 8) return false;
      if (Math.hypot(lx + 12.5, lz - 15.5) < 4) return false;
      return lz < 15;
    }
  });
  [[-18, 11], [18.5, 9.5], [-19.5, -3], [19, 2.5], [-9.5, 14.5], [9.5, 14.8]].forEach(([lx, lz]) => {
    const w = toWorld(lx, lz);
    const shrub = createShrubFast(0.8 + Math.random() * 0.4);
    const groundY = getTerrainHeight(w.x, w.z);
    shrub.position.set(w.x, groundY, w.z);
    scene.add(shrub);
    registerDestructible(shrub, w.x, groundY, w.z, 0.7, 'shrub', 3, 'Shrub');
    markLastPlanted();
  });

  entranceSign(lot, ['MOTEL', 'North Beach']);
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

  const yard = tagMap(createOutlinedMesh(new THREE.BoxGeometry(32, 0.3, 30), gravelMat, 0.03, false, true), 'yard');
  yard.position.set(0, 0.05, 2);
  g.add(yard);

  // Open zaagloods met cirkelzaag
  const shed = tagMap(new THREE.Group(), 'industry');
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
  const truck = buildPickupTruckMesh(0x7a3a2a, 'Sawmill Pickup');
  const tc = Math.cos(lot.yaw);
  const ts = Math.sin(lot.yaw);
  const [plx, plz] = [5.5, 12.5];
  truck.root.position.set(lot.x + plx * tc + plz * ts, lot.roadY, lot.z - plx * ts + plz * tc);
  truck.root.rotation.y = lot.yaw + Math.PI;
  scene.add(truck.root);
  parkedCars.push(truck);

  entranceSign(lot, ['TIMBER MILL', 'Sawmill']);
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
function createBigTop__build() {
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
function createBumperCars__build() {
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
function createFoodStand__build(kind, colorOverride = null) {
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

function createFerrisWheel__build() {
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

function createCarousel__build() {
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

function createFairBooth__build(stripeHex) {
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
    placeLoose(picnicTable(makeToonMat(0xd94e3a)), lx, lz, rot, 1.1, 10, 'Picnic table', -0.03);
  });
  const hayMat = makeToonMat(0xd9ac4e);
  [[-21.5, 0], [-20, -1.2], [-16, 17], [16, 17.5], [21, 1.5]].forEach(([lx, lz]) => {
    const bale = createOutlinedMesh(new THREE.BoxGeometry(1.6, 0.9, 1.0), hayMat, 0.03);
    placeLoose(bale, lx, lz, Math.random() * 0.6, 0.8, 8, 'Hay bale', 0.45);
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
    placeLoose(bin, lx, lz, 0, 0.45, 6, 'Trash can');
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

  entranceSign(lot, ['PINEWOOD FAIR', 'Funfair']);
}

// Spelletjeskraam: ringwerpen met flessen op de toonbank
function createGameStand__build() {
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
  if (lot.type === 'motel') buildMotel(lot);
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

// Kaart: gebouwen krijgen hun soort mee (zie map-tags.js)
function createTent(...args) { return tagMap(createTent__build(...args), 'leisure'); }
function createCaravan(...args) { return tagMap(createCaravan__build(...args), 'leisure'); }
function createBigTop(...args) { return tagMap(createBigTop__build(...args), 'leisure'); }
function createBumperCars(...args) { return tagMap(createBumperCars__build(...args), 'leisure'); }
function createFoodStand(...args) { return tagMap(createFoodStand__build(...args), 'leisure'); }
function createFerrisWheel(...args) { return tagMap(createFerrisWheel__build(...args), 'leisure'); }
function createCarousel(...args) { return tagMap(createCarousel__build(...args), 'leisure'); }
function createFairBooth(...args) { return tagMap(createFairBooth__build(...args), 'leisure'); }
function createGameStand(...args) { return tagMap(createGameStand__build(...args), 'leisure'); }

// =========================================================
// KAMPVUUR IN HET BOS BIJ DE UITKIJKTOREN
// =========================================================
// Bosje in de driehoek tussen de twee wegen bij de villa (niet vol, wel beschut)
function plantVillaJunctionGrove(lot) {
  const c = Math.cos(lot.yaw);
  const s = Math.sin(lot.yaw);
  plantNaturalGrove({
    toWorld: (lx, lz) => ({ x: lot.x + lx * c + lz * s, z: lot.z - lx * s + lz * c }),
    roadGap: 4.5,
    clusters: [
      [-38, 2, 8, 8, 0.55, 0.8],
      [-33, -10, 6, 3, 0.6, 1.5],
      [-45, 11, 4, 2, 0.3, 1.2]
    ],
    // binnen de driehoek: rechts van de schuine weg (die loopt ongeveer via lx = -50 - 0,6·lz) en vrij van garage en tuin
    allowed: (lx, lz) => lx > -50 - 0.6 * lz + 6 && !(lx > -29 && lz < 15) && lz < 16
  });
}
{
  const villaLot = ruralLots.find((l) => l.type === 'villa');
  if (villaLot) plantVillaJunctionGrove(villaLot);
}

export function buildLookoutCampfire() {
  const tx = LOOKOUT_HILL.x;
  const tz = LOOKOUT_HILL.z;
  // Zoek een vlak plekje op 10-16 m van de toren, niet op de weg
  let spot = null;
  let best = Infinity;
  for (let a = 0; a < 48; a++) {
    for (const r of [10, 12, 14, 16]) {
      const ang = (a / 48) * Math.PI * 2;
      const x = tx + Math.cos(ang) * r;
      const z = tz + Math.sin(ang) * r;
      if (getClosestNetworkRoad(x, z).marginDist < 7) continue;
      let maxDiff = 0;
      const h0 = getTerrainHeight(x, z);
      for (let k = 0; k < 8; k++) {
        const kx = x + Math.cos(k * 0.785) * 4;
        const kz = z + Math.sin(k * 0.785) * 4;
        maxDiff = Math.max(maxDiff, Math.abs(getTerrainHeight(kx, kz) - h0));
      }
      if (maxDiff < best) { best = maxDiff; spot = { x, z, ang }; }
    }
  }
  if (!spot) return;
  // Bomen die precies op de kampvuurplek staan weghalen (de rest van het bos blijft)
  for (let i = destructibles.length - 1; i >= 0; i--) {
    const d = destructibles[i];
    const wild = d.kind === 'tree' || d.kind === 'shrub' || (d.kind === 'small' && d.instRefs); // incl. stammen en stronken
    if (!wild || Math.hypot(d.x - spot.x, d.z - spot.z) > 6.5) continue;
    if (d.instRefs) {
      d.mesh.scale.setScalar(0);
      syncInstancedDestructible(d);
    } else if (d.mesh && d.mesh.parent) {
      d.mesh.parent.remove(d.mesh);
    }
    destructibles.splice(i, 1);
  }
  clearVegetationAround(spot.x, spot.z, 6.5);
  const y = getTerrainHeight(spot.x, spot.z);
  const g = new THREE.Group();
  g.position.set(spot.x, y, spot.z);
  g.rotation.y = -spot.ang;
  // Extra bos rondom de open plek (de kant van de toren blijft open)
  {
    const cl = [[-1.1, 13, 6, 5, 0.7, 0.75], [0.15, 14, 7, 4, 0.65, 1.4], [1.3, 12, 5, 3, 0.6, 1.0]].map(([da, dist, r, n, ps, dn]) => {
      const a = spot.ang + da;
      return [Math.cos(a) * dist, Math.sin(a) * dist, r, n, ps, dn];
    });
    plantNaturalGrove({
      toWorld: (lx, lz) => ({ x: spot.x + lx, z: spot.z + lz }),
      clusters: cl,
      allowed: (lx, lz) => Math.hypot(lx, lz) > 7.5
    });
  }
  scene.add(g);
  const fire = createCampfire();
  g.add(fire);
  hardColliders.push({ x: spot.x, z: spot.z, r: 1.1 });
  // Drie boomstambanken rond het vuur
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + 0.5;
    const bench = createOutlinedMesh(new THREE.CylinderGeometry(0.28, 0.3, 2.0, 8), logWallMat, 0.025, false);
    bench.rotation.z = Math.PI * 0.5;
    bench.rotation.y = a + Math.PI * 0.5;
    bench.position.set(Math.cos(a) * 2.8, 0.3, Math.sin(a) * 2.8);
    g.add(bench);
  }
  // Klein tentje en een stapel brandhout
  const tent = createTent(0xe8742a);
  tent.position.set(-4.2, 0.05, 1.5);
  tent.rotation.y = 0.9;
  g.add(tent);
  const wood = logStack(3, 1.4, 0.16, logWallMat);
  wood.position.set(3.4, 0.05, -1.8);
  g.add(wood);
}


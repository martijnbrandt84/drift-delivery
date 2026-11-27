import * as THREE from 'three';
import { scene, createOutlinedMesh, makeToonMat, setAlignedTransform } from './scene-setup.js';
import {
  valleyCurve, getValleyBaseElev, getValleyBridgeAtU, lakeCurve, getLakeLoopBaseElev, getLakeBridgeAtU,
  ringCurve, getRingBaseElev, getRingBridgeAtU
} from './roads.js';
import { ruralLots } from './water-lots.js';
import { hardColliders } from './demolition.js';
import { getDriveHeightAndWaterState } from './drive-surface.js';
import { houseWindows, warmWindowMat } from './town.js';
import { createRoadSign } from './scenery.js';
import { tagMap } from './map-tags.js';
import { setVehicleLights } from './vehicles.js';
import { createPineFast, createDeciduousTreeFast, createShrubFast } from './props.js';
import { registerDestructible, markLastPlanted } from './demolition.js';
import { getTerrainHeight } from './terrain.js';

// =========================================================
// POLITIEBUREAU + 4 ECHTE POLITIEAUTO'S
// Ze patrouilleren over vaste rondes, komen vanaf hun eigen plek achter je aan
// en rijden na afloop terug. Er wordt niemand meer naast de speler neergezet.
// =========================================================
const lot = ruralLots.find((l) => l.type === 'police');

const rotLocal = (lx, lz) => {
  const c = Math.cos(lot.yaw);
  const s = Math.sin(lot.yaw);
  return { x: lot.x + lx * c + lz * s, z: lot.z - lx * s + lz * c };
};

// ---------- Het bureau ----------
function makeSheriffTexture() {
  const c = document.createElement('canvas');
  c.width = 768;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#23262b';
  ctx.fillRect(0, 0, 768, 128);
  // Gouden ster
  ctx.fillStyle = '#f4c430';
  ctx.beginPath();
  for (let k = 0; k < 10; k++) {
    const r = k % 2 ? 22 : 50;
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    ctx.lineTo(70 + Math.cos(a) * r, 64 + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 62px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText("SHERIFF'S OFFICE", 140, 68);
  const tex = Object.assign(new THREE.CanvasTexture(c), { colorSpace: THREE.SRGBColorSpace });
  tex.needsUpdate = true;
  return tex;
}
const SIGN_OPTS = { polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, toneMapped: false };

export const garageSpots = [];
const lightBars = [];

function buildStation() {
  if (!lot) return;
  const surfaceY = lot.roadY - 0.02;
  const g = new THREE.Group();
  g.position.set(lot.x, surfaceY, lot.z);
  g.rotation.y = lot.yaw;
  scene.add(g);

  // Compact terrein: kantoor achteraan, parkeervakken ervoor tot aan de weg
  // Plein met een stoeprand rondom; een oprit verbindt het met de weg (het plein raakt de weg niet)
  const slabH = 3.2;
  const padMinLZ = -10.5;
  const padFrontLZ = 9.5;
  const padW = 24;
  const padDepth = padFrontLZ - padMinLZ;
  const pad = tagMap(new THREE.Mesh(new THREE.BoxGeometry(padW, slabH, padDepth), makeToonMat(0x4a474c)), 'paved');
  pad.position.set(0, -slabH * 0.5, padMinLZ + padDepth * 0.5);
  pad.receiveShadow = true;
  g.add(pad);
  const kerbMat = makeToonMat(0xbdb6aa);
  const kerbs = [
    [-padW / 2 + 0.2, padMinLZ + padDepth / 2, 0.4, padDepth],
    [padW / 2 - 0.2, padMinLZ + padDepth / 2, 0.4, padDepth],
    [0, padMinLZ + 0.2, padW, 0.4],
    [-(padW / 2 + 3.8) / 2, padFrontLZ - 0.2, padW / 2 - 3.8, 0.4],
    [(padW / 2 + 3.8) / 2, padFrontLZ - 0.2, padW / 2 - 3.8, 0.4]
  ];
  kerbs.forEach(([kx, kz, kw, kd]) => {
    const kerb = createOutlinedMesh(new THREE.BoxGeometry(kw, 0.22, kd), kerbMat, 0.02, false, true);
    kerb.position.set(kx, 0.11, kz);
    g.add(kerb);
  });

  // Zwart-wit, net als de politieauto's, met een gouden ster
  const whiteMat = makeToonMat(0xf5f7fa);
  const blackMat = makeToonMat(0x23262b);
  const lineMat = makeToonMat(0xf2ede4);

  const office = tagMap(new THREE.Group(), 'civic');
  office.position.set(0, 0.02, -5);
  g.add(office);
  const w = 13, h = 4.8, d = 8;
  const plinth = createOutlinedMesh(new THREE.BoxGeometry(w + 0.5, 0.3, d + 0.5), makeToonMat(0x9a958d), 0.03, false, true);
  plinth.position.y = 0.15;
  office.add(plinth);
  const body = createOutlinedMesh(new THREE.BoxGeometry(w, h, d), whiteMat, 0.055);
  body.position.y = h * 0.5 + 0.3;
  office.add(body);
  const base = new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, 1.1, d + 0.04), blackMat);
  base.position.y = 0.85;
  office.add(base);
  const roofEdge = createOutlinedMesh(new THREE.BoxGeometry(w + 0.4, 0.45, d + 0.4), blackMat, 0.04, false);
  roofEdge.position.y = h + 0.5;
  office.add(roofEdge);
  const board = createOutlinedMesh(new THREE.BoxGeometry(9.6, 1.3, 0.2), blackMat, 0.03, false);
  board.position.set(0, h - 0.5, d * 0.5 + 0.12);
  office.add(board);
  const text = new THREE.Mesh(new THREE.PlaneGeometry(9.3, 1.16), new THREE.MeshBasicMaterial({ map: makeSheriffTexture(), ...SIGN_OPTS }));
  text.position.set(0, h - 0.5, d * 0.5 + 0.26);
  office.add(text);
  [-4.6, -2.4, 2.4, 4.6].forEach((wx) => {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.3), warmWindowMat);
    win.position.set(wx, 2.3, d * 0.5 + 0.03);
    office.add(win);
    houseWindows.push({ mesh: win, timer: Math.random() * 10 });
  });
  const door = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 2.3), warmWindowMat);
  door.position.set(0, 1.5, d * 0.5 + 0.03);
  office.add(door);
  const doorFrame = createOutlinedMesh(new THREE.BoxGeometry(2.2, 2.6, 0.12), blackMat, 0.02, false);
  doorFrame.position.set(0, 1.55, d * 0.5 - 0.02);
  office.add(doorFrame);
  const awning = createOutlinedMesh(new THREE.BoxGeometry(3.2, 0.18, 1.3), blackMat, 0.03, false);
  awning.position.set(0, 2.95, d * 0.5 + 0.6);
  awning.rotation.x = 0.2;
  office.add(awning);
  [-3.2, 3.2].forEach((x) => {
    const p = rotLocal(x, -5);
    hardColliders.push({ x: p.x, z: p.z, r: 4.2 });
  });

  // Vlaggenmast naast de ingang
  {
    const pole = createOutlinedMesh(new THREE.CylinderGeometry(0.07, 0.1, 7, 6), makeToonMat(0xd8dadd), 0.02, false);
    pole.position.set(-9.8, 3.5, -6.5);
    g.add(pole);
    const flag = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.0, 1.6), blackMat);
    flag.position.set(-9.8, 6.4, -5.65);
    g.add(flag);
    const star = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.38, 0.38), makeToonMat(0xf4c430));
    star.position.set(-9.8, 6.4, -6.0);
    g.add(star);
    const p = rotLocal(-9.8, -6.5);
    hardColliders.push({ x: p.x, z: p.z, r: 0.3 });
  }

  // Vier politievakken (met 'POLITIE'-streep) en twee bezoekersvakken
  const bayW = 3.0;
  const bayZ = 3.2;
  for (let k = 0; k <= 4; k++) {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 4.6), lineMat);
    line.rotation.x = -Math.PI / 2;
    line.position.set(-6 + k * bayW, 0.02, bayZ);
    g.add(line);
  }
  for (let k = 0; k < 4; k++) {
    const bx = -4.5 + k * bayW;
    const mark = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.35), makeToonMat(0x2a6aff));
    mark.rotation.x = -Math.PI / 2;
    mark.position.set(bx, 0.025, bayZ - 2.0);
    g.add(mark);
    const lp = rotLocal(bx, bayZ);
    garageSpots.push({ x: lp.x, z: lp.z, yaw: lot.yaw, taken: false });
  }
  [-11.4, -8.7, 8.7, 11.4].forEach((x) => {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 4.6), lineMat);
    line.rotation.x = -Math.PI / 2;
    line.position.set(x, 0.02, bayZ);
    g.add(line);
  });

  // Bomen rondom: links, rechts en achter het bureau
  [[-15, -11, 'p'], [-16.5, -6, 'd'], [-15.5, -1, 'p'], [-17, 4, 'p'], [-15.5, 9, 'd'], [-19, -9, 'p'], [-19.5, 1, 'd'],
    [15, -11, 'p'], [16.5, -5, 'd'], [15.5, 1, 'p'], [17, 7, 'd'], [19.5, -8, 'p'],
    [-9, -14.5, 'p'], [-3, -15, 'd'], [3, -14.5, 'p'], [9, -15, 'p'], [0, -18.5, 'p'], [-12.5, -17, 'd'], [12.5, -17.5, 'p'],
    [-13.5, 6.5, 's'], [13.5, 4.5, 's'], [-13.5, -4, 's'], [13.5, -8.5, 's']].forEach(([lx, lz, kind]) => {
    const p = rotLocal(lx, lz);
    const y = getTerrainHeight(p.x, p.z);
    let obj;
    if (kind === 's') {
      const sc = 0.7 + Math.random() * 0.5;
      obj = createShrubFast(sc);
      obj.position.set(p.x, y, p.z);
      scene.add(obj);
      registerDestructible(obj, p.x, y, p.z, Math.max(0.6, 0.85 * sc), 'shrub', 3, 'Struik');
    } else {
      const sc = 0.75 + Math.random() * 0.4;
      obj = kind === 'p' ? createPineFast(sc) : createDeciduousTreeFast(sc);
      obj.position.set(p.x, y, p.z);
      obj.rotation.y = Math.random() * Math.PI * 2;
      scene.add(obj);
      registerDestructible(obj, p.x, y, p.z, 0.85 * sc, 'tree', 15, kind === 'p' ? 'Dennenboom' : 'Loofboom');
    }
    markLastPlanted();
  });

  const sp = rotLocal(-7.5, padFrontLZ + 2.0);
  createRoadSign(sp.x, sp.z, surfaceY, lot.yaw, ['SHERIFF', 'Politiebureau']);
}
buildStation();

// ---------- Patrouilleroutes ----------
function makeRoute(curve, elevFn, bridgeFn, closed) {
  const N = 500;
  const pts = [];
  for (let i = 0; i < N; i++) {
    const p = curve.getPointAt(i / N);
    pts.push({ x: p.x, z: p.z, u: i / N });
  }
  return { curve, elevFn, bridgeFn, closed, pts, len: curve.getLength() };
}
const ROUTES = [
  makeRoute(valleyCurve, getValleyBaseElev, getValleyBridgeAtU, false),
  makeRoute(lakeCurve, getLakeLoopBaseElev, getLakeBridgeAtU, true),
  makeRoute(ringCurve, getRingBaseElev, getRingBridgeAtU, true)
];

function nearestOnRoute(route, x, z) {
  let best = null;
  let bd = Infinity;
  for (const p of route.pts) {
    const d = (p.x - x) ** 2 + (p.z - z) ** 2;
    if (d < bd) { bd = d; best = p; }
  }
  return { p: best, dist: Math.sqrt(bd) };
}
function nearestRoute(x, z) {
  let best = null;
  ROUTES.forEach((r, idx) => {
    const n = nearestOnRoute(r, x, z);
    if (!best || n.dist < best.dist) best = { ...n, idx };
  });
  return best;
}

function placeOnRoute(unit, dt) {
  const r = ROUTES[unit.routeIdx];
  const pt = r.curve.getPointAt(unit.u);
  const tan = r.curve.getTangentAt(unit.u);
  const l2 = Math.hypot(tan.x, tan.z) || 1;
  const ctx = tan.x / l2;
  const ctz = tan.z / l2;
  const tx = ctx * unit.dir;
  const tz = ctz * unit.dir;
  // Rijstrook vloeiend wisselen (bij keren aan het eind van een route)
  const laneTarget = 2.2 * unit.dir;
  if (unit.laneOff === undefined || dt === 0) unit.laneOff = laneTarget;
  unit.laneOff += THREE.MathUtils.clamp(laneTarget - unit.laneOff, -3 * dt, 3 * dt);
  const x = pt.x - ctz * unit.laneOff;
  const z = pt.z + ctx * unit.laneOff;
  const y = r.elevFn(unit.u) + r.bridgeFn(unit.u).archY + 0.1;
  const lookU = r.closed ? (unit.u + 0.006 * unit.dir + 1) % 1 : THREE.MathUtils.clamp(unit.u + 0.006 * unit.dir, 0, 1);
  const yA = r.elevFn(lookU) + r.bridgeFn(lookU).archY + 0.1;
  const wantAngle = Math.atan2(tx, tz);
  if (dt === 0 || unit.angle === undefined) unit.angle = wantAngle;
  else {
    let diff = wantAngle - unit.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    unit.angle += THREE.MathUtils.clamp(diff, -2.2 * dt, 2.2 * dt);
  }
  setAlignedTransform(unit.veh.root, x, y, z, unit.angle, -Math.atan2(yA - y, r.len * 0.006));
  unit.vx = tx * unit.patrolSpeed;
  unit.vz = tz * unit.patrolSpeed;
  unit.veh.wheels.forEach((w) => { w.rotation.x += (unit.patrolSpeed * dt) / 0.46; });
}

function sirensOff(unit) {
  unit.veh.redBar.scale.setScalar(1);
  unit.veh.blueBar.scale.setScalar(1);
  unit.veh.sirenLight.intensity = 0;
}

function parkInGarage(unit) {
  const spot = garageSpots.find((s) => !s.taken) || garageSpots[0];
  if (!spot) return;
  spot.taken = true;
  unit.garageSpot = spot;
  const h = getDriveHeightAndWaterState(spot.x, spot.z).height;
  unit.angle = spot.yaw;
  unit.vx = 0;
  unit.vz = 0;
  setAlignedTransform(unit.veh.root, spot.x, h, spot.z, spot.yaw, 0);
  unit.veh.root.visible = true;
  unit.state = 'garage';
  setVehicleLights(unit.veh, false);
}
function leaveGarage(unit) {
  setVehicleLights(unit.veh, true);
  if (unit.garageSpot) unit.garageSpot.taken = false;
  unit.garageSpot = null;
}

// ---------- Start: drie op patrouille, één in reserve in de garage ----------
export function initPoliceUnits(pool) {
  const starts = [0.5, 0.3, 0.62];
  pool.forEach((unit, i) => {
    unit.active = false;
    unit.patrolSpeed = 14 + i;
    unit.veh.root.visible = true;
    sirensOff(unit);
    if (i < 3) {
      unit.routeIdx = i;
      unit.u = starts[i];
      unit.dir = i === 1 ? -1 : 1;
      unit.state = 'patrol';
      placeOnRoute(unit, 0);
    } else {
      unit.routeIdx = 0;
      unit.u = 0;
      unit.dir = 1;
      parkInGarage(unit);
      unit.garageTimer = Infinity; // reserve: rukt alleen uit bij een achtervolging
    }
  });
}

// Wie gaat er achter de speler aan? De dichtstbijzijnde beschikbare eenheden.
export function pickPursuers(pool, n, px, pz) {
  return pool
    .filter((u) => !u.active && (u.state === 'patrol' || u.state === 'return' || u.state === 'garage'))
    .sort((a, b) => Math.hypot(a.veh.root.position.x - px, a.veh.root.position.z - pz) - Math.hypot(b.veh.root.position.x - px, b.veh.root.position.z - pz))
    .slice(0, n);
}
export function startPursuit(unit) {
  if (unit.state === 'garage') leaveGarage(unit);
  unit.active = true;
  unit.state = 'pursuit';
}

// Achtervolging voorbij: terug naar de dichtstbijzijnde route
export function releaseFromPursuit(unit) {
  unit.active = false;
  sirensOff(unit);
  const n = nearestRoute(unit.veh.root.position.x, unit.veh.root.position.z);
  unit.routeIdx = n.idx;
  unit.state = 'return';
}

// Gestolen: de politie is deze auto echt kwijt (er komt geen nieuwe voor terug)
export function markUnitLost(unit) {
  if (unit.state === 'garage') leaveGarage(unit);
  unit.active = false;
  unit.state = 'lost';
}

export function updatePolicePatrol(dt, elapsed, px, pz, playerVeh, carState) {
  // Zwaailicht op het bureau knippert altijd een beetje
  const flash = Math.floor(elapsed * 3) % 2 === 0;
  lightBars.forEach((b) => {
    b.red.visible = flash;
    b.blue.visible = !flash;
  });

  for (const unit of policePoolRef) {
    if (unit.active) continue;
    if (unit.state === 'respawn') {
      unit.respawnTimer -= dt;
      if (unit.respawnTimer <= 0) {
        parkInGarage(unit);
        unit.garageTimer = 6;
        unit.routeIdx = 0;
      }
      continue;
    }
    if (unit.state === 'garage') {
      unit.garageTimer -= dt;
      if (unit.garageTimer <= 0) {
        leaveGarage(unit);
        unit.routeIdx = 0;
        unit.state = 'return';
      }
      continue;
    }
    if (unit.state === 'patrol') {
      const r = ROUTES[unit.routeIdx];
      // Afremmen als de speler vlak voor de patrouillewagen staat
      const dx = px - unit.veh.root.position.x;
      const dz = pz - unit.veh.root.position.z;
      const dist = Math.hypot(dx, dz);
      const ahead = dist > 0.01 ? (dx * Math.sin(unit.angle) + dz * Math.cos(unit.angle)) / dist : 0;
      const target = dist < 12 && ahead > 0.5 ? 0 : 14 + (unit.routeIdx === 2 ? 4 : 0);
      unit.patrolSpeed = THREE.MathUtils.lerp(unit.patrolSpeed, target, 4 * dt);
      unit.u += ((unit.patrolSpeed * dt) / r.len) * unit.dir;
      if (r.closed) unit.u = ((unit.u % 1) + 1) % 1;
      else if (unit.u > 0.97) { unit.u = 0.97; unit.dir = -1; } else if (unit.u < 0.03) { unit.u = 0.03; unit.dir = 1; }
      placeOnRoute(unit, dt);
      sirensOff(unit);
      // Duwen bij een aanrijding (net als gewoon verkeer)
      const minD = playerVeh.radius + unit.veh.radius;
      if (dist < minD && dist > 0.001) {
        const push = minD - dist;
        playerVeh.root.position.x += (dx / dist) * push;
        playerVeh.root.position.z += (dz / dist) * push;
        carState.vx = (dx / dist) * 8;
        carState.vz = (dz / dist) * 8;
        if (!unit.bumpCooldown || elapsed > unit.bumpCooldown) {
          unit.bumpCooldown = elapsed + 2;
          unit.onBump && unit.onBump();
        }
      }
      continue;
    }
    if (unit.state === 'return') {
      // Rij naar het dichtstbijzijnde punt van de eigen route en sluit daar aan
      const r = ROUTES[unit.routeIdx];
      const pos = unit.veh.root.position;
      const n = nearestOnRoute(r, pos.x, pos.z);
      if (n.dist < 4) {
        unit.u = n.p.u;
        const tan = r.curve.getTangentAt(unit.u);
        unit.dir = Math.sin(unit.angle) * tan.x + Math.cos(unit.angle) * tan.z >= 0 ? 1 : -1;
        unit.patrolSpeed = 12;
        unit.laneOff = 0;
        unit.state = 'patrol';
        continue;
      }
      const want = Math.atan2(n.p.x - pos.x, n.p.z - pos.z);
      let diff = want - unit.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      unit.angle += THREE.MathUtils.clamp(diff, -2.5 * dt, 2.5 * dt);
      const spd = Math.min(20, 6 + n.dist * 0.6);
      let nx = pos.x + Math.sin(unit.angle) * spd * dt;
      let nz = pos.z + Math.cos(unit.angle) * spd * dt;
      for (let i = 0; i < hardColliders.length; i++) {
        const col = hardColliders[i];
        const ddx = nx - col.x;
        const ddz = nz - col.z;
        const minR = 1.6 + col.r;
        if (ddx * ddx + ddz * ddz < minR * minR) {
          const d = Math.hypot(ddx, ddz) || 0.001;
          nx += (ddx / d) * (minR - d);
          nz += (ddz / d) * (minR - d);
          unit.angle += 0.8 * dt;
        }
      }
      const surf = getDriveHeightAndWaterState(nx, nz, pos.y);
      if (surf.inDeepWater) {
        unit.angle += Math.PI * 0.5 * dt * 4;
        continue;
      }
      setAlignedTransform(unit.veh.root, nx, surf.height, nz, unit.angle, 0);
      unit.vx = Math.sin(unit.angle) * spd;
      unit.vz = Math.cos(unit.angle) * spd;
      unit.veh.wheels.forEach((w) => { w.rotation.x += (spd * dt) / 0.46; });
      sirensOff(unit);
    }
  }
}

let policePoolRef = [];
export function bindPolicePool(pool) {
  policePoolRef = pool;
  initPoliceUnits(pool);
}

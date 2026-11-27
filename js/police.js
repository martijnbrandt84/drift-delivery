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
  ctx.fillStyle = '#1f3a6b';
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

  const roadEdgeLZ = lot.dist - 4.6;
  const slabH = 3.2;
  const padMinLZ = -13;
  const padDepth = roadEdgeLZ - padMinLZ;
  const pad = tagMap(new THREE.Mesh(new THREE.BoxGeometry(32, slabH, padDepth), makeToonMat(0x4a474c)), 'paved');
  pad.position.set(0, -slabH * 0.5, padMinLZ + padDepth * 0.5);
  pad.receiveShadow = true;
  g.add(pad);

  const wallMat = makeToonMat(0xe9e4da);
  const blueMat = makeToonMat(0x1f3a6b);
  const darkMat = makeToonMat(0x2f3638);
  const lineMat = makeToonMat(0xf2ede4);

  // Kantoor: wit met blauwe band, plat dak met zwaailicht
  const office = tagMap(new THREE.Group(), 'civic');
  office.position.set(-7.5, 0.02, -6.5);
  g.add(office);
  {
    const w = 13, h = 5.2, d = 9;
    const plinth = createOutlinedMesh(new THREE.BoxGeometry(w + 0.6, 0.3, d + 0.6), makeToonMat(0xb9b2a6), 0.03, false, true);
    plinth.position.y = 0.15;
    office.add(plinth);
    const body = createOutlinedMesh(new THREE.BoxGeometry(w, h, d), wallMat, 0.055);
    body.position.y = h * 0.5 + 0.3;
    office.add(body);
    const band = new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, 0.5, d + 0.04), blueMat);
    band.position.y = 1.0;
    office.add(band);
    const roofEdge = createOutlinedMesh(new THREE.BoxGeometry(w + 0.5, 0.45, d + 0.5), blueMat, 0.04, false);
    roofEdge.position.y = h + 0.5;
    office.add(roofEdge);
    // Bord met ster
    const board = createOutlinedMesh(new THREE.BoxGeometry(9.6, 1.4, 0.2), blueMat, 0.03, false);
    board.position.set(0, h - 0.6, d * 0.5 + 0.12);
    office.add(board);
    const text = new THREE.Mesh(new THREE.PlaneGeometry(9.3, 1.25), new THREE.MeshBasicMaterial({ map: makeSheriffTexture(), ...SIGN_OPTS }));
    text.position.set(0, h - 0.6, d * 0.5 + 0.26);
    office.add(text);
    // Ramen en dubbele deur met luifel
    [-4.4, -2.2, 2.2, 4.4].forEach((wx) => {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.4), warmWindowMat);
      win.position.set(wx, 2.4, d * 0.5 + 0.03);
      office.add(win);
      houseWindows.push({ mesh: win, timer: Math.random() * 10 });
    });
    const door = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 2.4), warmWindowMat);
    door.position.set(0, 1.5, d * 0.5 + 0.03);
    office.add(door);
    const doorFrame = createOutlinedMesh(new THREE.BoxGeometry(2.2, 2.7, 0.12), blueMat, 0.02, false);
    doorFrame.position.set(0, 1.55, d * 0.5 - 0.02);
    office.add(doorFrame);
    const awning = createOutlinedMesh(new THREE.BoxGeometry(3.2, 0.18, 1.4), blueMat, 0.03, false);
    awning.position.set(0, 3.05, d * 0.5 + 0.65);
    awning.rotation.x = 0.2;
    office.add(awning);
    // Zwaailicht op het dak
    const barBase = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.25, 0.5), darkMat);
    barBase.position.set(0, h + 0.85, 1.5);
    office.add(barBase);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.3, 0.45), new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
    red.position.set(-0.4, h + 1.1, 1.5);
    office.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.3, 0.45), new THREE.MeshBasicMaterial({ color: 0x2a6aff }));
    blue.position.set(0.4, h + 1.1, 1.5);
    office.add(blue);
    lightBars.push({ red, blue });
    // Antennemast
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 4, 5), darkMat);
    mast.position.set(-5, h + 2.6, -3);
    office.add(mast);
  }

  // Garage met vier open vakken
  const garage = tagMap(new THREE.Group(), 'civic');
  garage.position.set(8, 0.02, -7);
  g.add(garage);
  {
    const w = 15.2, h = 4.4, d = 9;
    const back = createOutlinedMesh(new THREE.BoxGeometry(w, h, 0.35), wallMat, 0.045);
    back.position.set(0, h * 0.5, -d * 0.5);
    garage.add(back);
    for (let k = 0; k <= 4; k++) {
      const x = -w * 0.5 + k * (w / 4);
      const wall = createOutlinedMesh(new THREE.BoxGeometry(k === 0 || k === 4 ? 0.35 : 0.25, h, d), wallMat, 0.04);
      wall.position.set(x, h * 0.5, 0);
      garage.add(wall);
    }
    const roof = createOutlinedMesh(new THREE.BoxGeometry(w + 0.6, 0.4, d + 0.8), blueMat, 0.045);
    roof.position.set(0, h + 0.2, 0.2);
    garage.add(roof);
    for (let k = 0; k < 4; k++) {
      const bx = -w * 0.5 + (k + 0.5) * (w / 4);
      // Opgerolde deur boven elk vak + nummer-streep
      const door = createOutlinedMesh(new THREE.BoxGeometry(w / 4 - 0.4, 0.7, 0.2), makeToonMat(0xc9ccd2), 0.02, false);
      door.position.set(bx, h - 0.4, d * 0.5 - 0.1);
      garage.add(door);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(w / 4 - 0.6, 0.12, 0.05), blueMat);
      stripe.position.set(bx, h - 0.4, d * 0.5 + 0.02);
      garage.add(stripe);
      const floor = new THREE.Mesh(new THREE.BoxGeometry(w / 4 - 0.5, 0.03, d - 0.5), makeToonMat(0x8f8b85));
      floor.position.set(bx, 0.02, 0);
      garage.add(floor);
      const lp = rotLocal(8 + bx, -7.2);
      garageSpots.push({ x: lp.x, z: lp.z, yaw: lot.yaw, taken: false });
    }
    // Botsranden: achterwand en zijwanden, de vakken blijven vrij
    for (let x = -7; x <= 7; x += 2.3) {
      const p = rotLocal(8 + x, -11.4);
      hardColliders.push({ x: p.x, z: p.z, r: 0.9 });
    }
    [-7.6, 7.6].forEach((x) => {
      [-10, -7, -4].forEach((z) => {
        const p = rotLocal(8 + x, z);
        hardColliders.push({ x: p.x, z: p.z, r: 0.7 });
      });
    });
  }
  [-11, -4].forEach((x) => {
    const p = rotLocal(x, -6.5);
    hardColliders.push({ x: p.x, z: p.z, r: 4.6 });
  });

  // Vlaggenmast met een blauw-witte vlag
  {
    const pole = createOutlinedMesh(new THREE.CylinderGeometry(0.07, 0.1, 8, 6), makeToonMat(0xd8dadd), 0.02, false);
    pole.position.set(-14.5, 4, 2);
    g.add(pole);
    const flag = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.1, 1.8), blueMat);
    flag.position.set(-14.5, 7.3, 2.95);
    g.add(flag);
    const star = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.4, 0.4), makeToonMat(0xf4c430));
    star.position.set(-14.5, 7.3, 2.5);
    g.add(star);
    const p = rotLocal(-14.5, 2);
    hardColliders.push({ x: p.x, z: p.z, r: 0.3 });
  }

  // Belijning voor de garage en bezoekersvakken bij het kantoor
  for (let k = 0; k <= 4; k++) {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 5), lineMat);
    line.rotation.x = -Math.PI / 2;
    line.position.set(0.4 + k * 3.8, 0.02, -0.4);
    g.add(line);
  }
  for (let k = 0; k <= 4; k++) {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 4), lineMat);
    line.rotation.x = -Math.PI / 2;
    line.position.set(-14 + k * 2.6, 0.02, 3.5);
    g.add(line);
  }

  const sp = rotLocal(-13, lot.dist - 2.5);
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
}
function leaveGarage(unit) {
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

// Gestolen of kapot: na een tijdje staat er een nieuwe auto in de garage, die daarna weer op patrouille gaat
export function sendUnitToStation(unit) {
  unit.active = false;
  unit.state = 'respawn';
  unit.respawnTimer = 25;
  unit.veh.root.visible = false;
  sirensOff(unit);
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

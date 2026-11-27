import * as THREE from 'three';
import { scene, makeToonMat, registerSeasonalMat, createOutlinedMesh } from './scene-setup.js';
import { WATER_LEVEL } from './roads.js';
import { ruralLots } from './water-lots.js';
import { hardColliders, registerDestructible, markLastPlanted } from './demolition.js';
import { createPineFast, createDeciduousTreeFast, createShrubFast } from './props.js';
import { getClosestNetworkRoad, getDistToRivers } from './roads.js';
import { getTerrainHeight } from './terrain.js';
import { createRoadSign } from './scenery.js';
import { spawnParticle } from './effects.js';
import { showToast } from './ui-controls.js';

// =========================================================
// PINEWOOD AIRFIELD + BESTUURBAAR VLIEGTUIGJE
// Lokale assen van het vliegveld: lx dwars op de baan, lz richting de weg (+).
// De startbaan loopt van het platform naar -lz (pal naar het westen).
// =========================================================
// Borden: echte sRGB-kleuren en geen filmische tonemapping, zodat rood rood blijft en tekst scherp is
const SIGN_MAT_OPTS = { polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, toneMapped: false };
const lot = ruralLots.find((l) => l.type === 'airfield');

const concreteMat = registerSeasonalMat(0xb8b4ac, 0xe8eff6);
const runwayMat = makeToonMat(0x3f3d42);
const markWhiteMat = new THREE.MeshBasicMaterial({ color: 0xf4f1ea, ...SIGN_MAT_OPTS });
const edgeLightMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
const hangarWallMat = makeToonMat(0x8a9aa8);
const hangarRoofMat = registerSeasonalMat(0x6a7a88, 0xf2f6fb);
const towerMat = makeToonMat(0xf2ece0);
const glassMat = new THREE.MeshBasicMaterial({ color: 0x9fd4e6 });
const orangeMat = makeToonMat(0xf07a24);
const whiteMat = makeToonMat(0xf8f6f0);
const darkMat = makeToonMat(0x2b2b2b);

export const airfieldLights = [];
let windsock = null;
let groundY = 0;
let toWorld = (lx, lz) => ({ x: lx, z: lz });
let runwayYaw = 0;

function makeNumberTexture(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#3f3d42';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#f4f1ea';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '900 92px system-ui, sans-serif';
  ctx.fillText(text, 64, 68);
  const tex = Object.assign(new THREE.CanvasTexture(canvas), { colorSpace: THREE.SRGBColorSpace });
  tex.needsUpdate = true;
  return tex;
}

function buildAirfield() {
  if (!lot) return;
  const c = Math.cos(lot.yaw);
  const s = Math.sin(lot.yaw);
  toWorld = (lx, lz) => ({ x: lot.x + lx * c + lz * s, z: lot.z - lx * s + lz * c });
  groundY = lot.roadY - 0.16;
  runwayYaw = lot.yaw + Math.PI; // vliegrichting bij het opstijgen: naar -lz

  const g = new THREE.Group();
  g.position.set(lot.x, groundY, lot.z);
  g.rotation.y = lot.yaw;
  scene.add(g);
  const collide = (lx, lz, r) => {
    const w = toWorld(lx, lz);
    hardColliders.push({ x: w.x, z: w.z, r });
  };

  // Platform en startbaan
  const apron = createOutlinedMesh(new THREE.BoxGeometry(32, 0.3, 24), concreteMat, 0.03, false, true);
  apron.position.set(0, 0.05, -2);
  g.add(apron);
  const runwayLen = 118;
  const runwayStart = -14;
  const runway = createOutlinedMesh(new THREE.BoxGeometry(12, 0.3, runwayLen), runwayMat, 0.03, false, true);
  runway.position.set(-6, 0.08, runwayStart - runwayLen * 0.5);
  g.add(runway);
  const markY = 0.25;
  // Middenstreep
  for (let lz = runwayStart - 12; lz > runwayStart - runwayLen + 12; lz -= 7) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 3.5), markWhiteMat);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(-6, markY, lz);
    g.add(dash);
  }
  // Zijlijnen
  [-11.6, -0.4].forEach((lx) => {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(0.25, runwayLen - 2), markWhiteMat);
    line.rotation.x = -Math.PI / 2;
    line.position.set(lx, markY, runwayStart - runwayLen * 0.5);
    g.add(line);
  });
  // Drempelstrepen en baannummers aan beide kanten
  [[runwayStart - 3, '27', 0], [runwayStart - runwayLen + 3, '09', Math.PI]].forEach(([lz, num, rot]) => {
    for (let k = 0; k < 8; k++) {
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 3.0), markWhiteMat);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(-10.5 + k * 1.3 + (k >= 4 ? 1.8 : 0), markY, lz - (rot ? -1.5 : 1.5));
      g.add(stripe);
    }
    const label = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), new THREE.MeshBasicMaterial({ map: makeNumberTexture(num), ...SIGN_MAT_OPTS }));
    label.rotation.x = -Math.PI / 2;
    label.rotation.z = rot;
    label.position.set(-6, markY, lz - (rot ? -6 : 6));
    g.add(label);
  });
  // Randlichtjes (branden 's nachts)
  for (let lz = runwayStart - 2; lz > runwayStart - runwayLen; lz -= 10) {
    [-12.4, 0.4].forEach((lx) => {
      const light = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.3, 0.25), edgeLightMat);
      light.position.set(lx, 0.35, lz);
      g.add(light);
      airfieldLights.push(light);
    });
  }

  // Hangar met rond dak, open richting het platform
  const hangar = new THREE.Group();
  const roof = createOutlinedMesh(new THREE.CylinderGeometry(5.2, 5.2, 11, 16, 1, false, 0, Math.PI), hangarRoofMat, 0.05);
  roof.rotation.z = Math.PI / 2;
  roof.rotation.y = Math.PI / 2;
  roof.position.y = 2.6;
  hangar.add(roof);
  [-5.3, 5.3].forEach((side) => {
    const wall = createOutlinedMesh(new THREE.BoxGeometry(0.3, 2.8, 11), hangarWallMat, 0.035);
    wall.position.set(side, 1.4, 0);
    hangar.add(wall);
  });
  const back = createOutlinedMesh(new THREE.BoxGeometry(10.6, 2.8, 0.3), hangarWallMat, 0.035);
  back.position.set(0, 1.4, -5.4);
  hangar.add(back);
  const backTop = createOutlinedMesh(new THREE.CylinderGeometry(5.2, 5.2, 0.3, 16, 1, false, 0, Math.PI), hangarWallMat, 0.03, false);
  backTop.rotation.z = Math.PI / 2;
  backTop.rotation.y = Math.PI / 2;
  backTop.position.set(0, 2.6, -5.35);
  hangar.add(backTop);
  hangar.position.set(9.5, 0.2, -6);
  hangar.rotation.y = -Math.PI / 2; // opening naar -lx (platform)
  g.add(hangar);
  collide(9.5, -1, 2.6);
  collide(9.5, -6, 2.6);
  collide(9.5, -11, 2.6);
  collide(14.5, -6, 2.6);

  // Verkeerstorentje
  const tower = new THREE.Group();
  const base = createOutlinedMesh(new THREE.BoxGeometry(3, 5, 3), towerMat, 0.04);
  base.position.y = 2.5;
  tower.add(base);
  const cab = createOutlinedMesh(new THREE.BoxGeometry(3.8, 1.8, 3.8), towerMat, 0.04);
  cab.position.y = 5.9;
  tower.add(cab);
  [0, 1, 2, 3].forEach((k) => {
    const a = (k * Math.PI) / 2;
    const win = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.1), glassMat);
    win.position.set(Math.sin(a) * 1.92, 6.0, Math.cos(a) * 1.92);
    win.rotation.y = a;
    tower.add(win);
  });
  const tRoof = createOutlinedMesh(new THREE.BoxGeometry(4.4, 0.3, 4.4), darkMat, 0.03, false);
  tRoof.position.y = 6.95;
  tower.add(tRoof);
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 4), darkMat);
  antenna.position.y = 8.2;
  tower.add(antenna);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 5), new THREE.MeshBasicMaterial({ color: 0xff3a2a }));
  beacon.position.y = 9.3;
  tower.add(beacon);
  tower.position.set(12, 0.2, 7);
  g.add(tower);
  collide(12, 7, 2.2);

  // Windzak
  const pole = createOutlinedMesh(new THREE.CylinderGeometry(0.06, 0.08, 5, 6), whiteMat, 0.015, false);
  pole.position.set(-15, 2.5, -12);
  g.add(pole);
  windsock = new THREE.Group();
  for (let k = 0; k < 4; k++) {
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.45 - k * 0.08, 0.37 - k * 0.08, 0.7, 10, 1, true), k % 2 ? whiteMat : orangeMat);
    seg.material.side = THREE.DoubleSide;
    seg.rotation.z = Math.PI / 2;
    seg.position.x = 0.4 + k * 0.7;
    windsock.add(seg);
  }
  windsock.position.set(-15, 4.8, -12);
  g.add(windsock);
  collide(-15, -12, 0.3);

  // Brandstoftank
  const tank = createOutlinedMesh(new THREE.CapsuleGeometry(0.9, 2.6, 4, 10), whiteMat, 0.035);
  tank.rotation.z = Math.PI / 2;
  tank.position.set(13.5, 1.4, -15);
  g.add(tank);
  const tankStripe = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 0.92, 0.3, 12), orangeMat);
  tankStripe.rotation.z = Math.PI / 2;
  tankStripe.position.set(13.5, 1.4, -15);
  g.add(tankStripe);
  collide(13.5, -15, 1.6);

  // Bord bij de inrit
  const tx = lot.x - lot.roadX;
  const tz = lot.z - lot.roadZ;
  const tl = Math.hypot(tx, tz) || 1;
  const sx = lot.roadX + c * 6 + (tx / tl) * 3.5;
  const sz = lot.roadZ - s * 6 + (tz / tl) * 3.5;
  createRoadSign(sx, sz, getTerrainHeight(sx, sz), lot.yaw, ['AIRFIELD', 'Rondvluchten']);

  // Bomenrijen langs beide lange zijden van het vliegveld en groepjes bij het platform
  // (het eind van de baan blijft vrij voor het aanvliegen)
  const plant = (lx, lz, kind) => {
    const w = toWorld(lx, lz);
    if (getClosestNetworkRoad(w.x, w.z).marginDist < 3.5 || getDistToRivers(w.x, w.z) < 3) return;
    const y = getTerrainHeight(w.x, w.z);
    if (y < WATER_LEVEL + 0.4) return;
    let obj;
    if (kind === 's') {
      const sc = 0.6 + Math.random() * 0.6;
      obj = createShrubFast(sc);
      obj.position.set(w.x, y, w.z);
      scene.add(obj);
      registerDestructible(obj, w.x, y, w.z, Math.max(0.6, 0.85 * sc), 'shrub', 3, 'Struik');
    } else {
      const sc = 0.75 + Math.random() * 0.45;
      obj = kind === 'p' ? createPineFast(sc) : createDeciduousTreeFast(sc);
      obj.position.set(w.x, y, w.z);
      obj.rotation.y = Math.random() * Math.PI * 2;
      scene.add(obj);
      registerDestructible(obj, w.x, y, w.z, 0.85 * sc, 'tree', 15, kind === 'p' ? 'Dennenboom' : 'Loofboom');
    }
    markLastPlanted();
  };
  for (let lz = 6; lz > -128; lz -= 6.5) {
    [-1, 1].forEach((side) => {
      const lx = side * (22 + Math.random() * 3) + (side > 0 && lz > -20 ? 3 : 0);
      plant(lx, lz + (Math.random() - 0.5) * 2, Math.random() < 0.55 ? 'p' : 'd');
      if (Math.random() < 0.6) plant(lx + side * (4 + Math.random() * 3), lz + 3, Math.random() < 0.6 ? 'p' : 'd');
      if (Math.random() < 0.5) plant(lx - side * 2.5, lz + 1.5, 's');
    });
  }
  [[-20, 9, 'd'], [-23, 4, 'p'], [-21, 13, 's'], [19, 13, 's'], [21, -18, 'd'], [17, -21, 's']].forEach(([lx, lz, k]) => plant(lx, lz, k));
}
buildAirfield();

// =========================================================
// HET VLIEGTUIGJE
// =========================================================
function createPlane() {
  const g = new THREE.Group();
  const bodyMat = makeToonMat(0xf8f6f0);
  const redMat = makeToonMat(0xd62839);
  const fuselage = createOutlinedMesh(new THREE.BoxGeometry(1.1, 1.15, 4.6), bodyMat, 0.045);
  fuselage.position.y = 0.2;
  g.add(fuselage);
  const tailCone = createOutlinedMesh(new THREE.CylinderGeometry(0.2, 0.55, 2.2, 8), bodyMat, 0.035);
  tailCone.rotation.x = Math.PI / 2;
  tailCone.position.set(0, 0.35, -3.3);
  g.add(tailCone);
  const nose = createOutlinedMesh(new THREE.CylinderGeometry(0.5, 0.35, 0.7, 10), redMat, 0.035);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 0.15, 2.6);
  g.add(nose);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.13, 0.18, 4.4), redMat);
  stripe.position.y = 0.05;
  g.add(stripe);
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.5, 0.05), glassMat);
  windshield.position.set(0, 0.62, 1.2);
  windshield.rotation.x = -0.5;
  g.add(windshield);
  [-1, 1].forEach((side) => {
    const sideWin = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.45), glassMat);
    sideWin.position.set(side * 0.56, 0.55, 0.5);
    sideWin.rotation.y = side * Math.PI / 2;
    g.add(sideWin);
  });
  // Hoge vleugel met steunen
  const wing = createOutlinedMesh(new THREE.BoxGeometry(9.4, 0.16, 1.35), bodyMat, 0.04);
  wing.position.set(0, 0.95, 0.4);
  g.add(wing);
  [-4.2, 4.2].forEach((wx) => {
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, 1.37), redMat);
    tip.position.set(wx, 0.95, 0.4);
    g.add(tip);
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.3, 4), darkMat);
    strut.position.set(wx * 0.38, 0.4, 0.4);
    strut.rotation.z = Math.sign(wx) * 1.05;
    g.add(strut);
  });
  // Staart
  const fin = createOutlinedMesh(new THREE.BoxGeometry(0.12, 1.2, 1.0), redMat, 0.03);
  fin.position.set(0, 1.0, -4.0);
  g.add(fin);
  const stab = createOutlinedMesh(new THREE.BoxGeometry(3.0, 0.1, 0.8), bodyMat, 0.03);
  stab.position.set(0, 0.45, -4.0);
  g.add(stab);
  // Propeller
  const prop = new THREE.Group();
  prop.position.set(0, 0.15, 3.0);
  [0, Math.PI / 2].forEach((rot) => {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.9, 0.05), darkMat);
    blade.rotation.z = rot;
    prop.add(blade);
  });
  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.35, 8), redMat);
  spinner.rotation.x = Math.PI / 2;
  spinner.position.z = 0.15;
  prop.add(spinner);
  g.add(prop);
  g.userData.prop = prop;
  // Landingsgestel
  [[-0.9, 0.6], [0.9, 0.6], [0, 2.1]].forEach(([wx, wz]) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.6, 0.08), darkMat);
    leg.position.set(wx, -0.55, wz);
    g.add(leg);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.18, 10), darkMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, -0.85, wz);
    g.add(wheel);
  });
  return g;
}

const GEAR_H = 1.13; // hoogte van het midden boven de grond als hij op zijn wielen staat
const plane = createPlane();
scene.add(plane);

export const flight = {
  active: false,
  x: 0, y: 0, z: 0,
  heading: 0, pitch: 0, roll: 0,
  speed: 0, throttle: 0, vy: 0,
  airborne: false,
  crashTimer: 0
};
const input = { up: false, down: false, left: false, right: false, climb: false, dive: false, brake: false };
const parkSpot = { lx: -6, lz: -8 };

function parkPlane() {
  const w = toWorld(parkSpot.lx, parkSpot.lz);
  flight.x = w.x;
  flight.z = w.z;
  flight.y = groundY + 0.2 + GEAR_H;
  flight.heading = runwayYaw;
  flight.pitch = 0;
  flight.roll = 0;
  flight.speed = 0;
  flight.throttle = 0;
  flight.vy = 0;
  flight.airborne = false;
  applyPlaneTransform();
}

function applyPlaneTransform() {
  plane.position.set(flight.x, flight.y, flight.z);
  plane.rotation.order = 'YXZ';
  plane.rotation.set(-flight.pitch, flight.heading, -flight.roll);
}
if (lot) parkPlane();

export function planeIsNear(px, pz) {
  return !flight.active && flight.crashTimer <= 0 && Math.hypot(px - flight.x, pz - flight.z) < 7;
}

export function canExitPlane() {
  return flight.active && !flight.airborne && flight.speed < 3;
}

export function enterPlane() {
  flight.active = true;
  Object.keys(input).forEach((k) => { input[k] = false; });
  showToast('Vliegtuig: W/S gas · A/D sturen · ↑ klimmen · ↓ dalen · F uitstappen');
}

// Geeft een plek naast het vliegtuig terug om de auto neer te zetten
export function exitPlane() {
  flight.active = false;
  flight.throttle = 0;
  const rx = Math.cos(flight.heading);
  const rz = -Math.sin(flight.heading);
  return { x: flight.x + rx * 5, z: flight.z + rz * 5, angle: flight.heading };
}

const FLIGHT_KEYS = {
  KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right',
  ArrowUp: 'climb', ArrowDown: 'dive', ArrowLeft: 'left', ArrowRight: 'right', Space: 'brake'
};
export function setFlightKey(code, down) {
  const k = FLIGHT_KEYS[code];
  if (!k) return false;
  input[k] = down;
  return true;
}

const tmpPos = new THREE.Vector3();
function crash(reason) {
  flight.crashTimer = 2.2;
  flight.speed = 0;
  flight.throttle = 0;
  for (let k = 0; k < 14; k++) {
    tmpPos.set(flight.x + (Math.random() - 0.5) * 3, flight.y, flight.z + (Math.random() - 0.5) * 3);
    spawnParticle(tmpPos, k % 2 ? 'smoke' : 'chip', 1.4);
  }
  showToast(reason);
}

export function updateFlight(dt, elapsed) {
  if (!lot) return;
  if (windsock) windsock.rotation.y = Math.sin(elapsed * 0.3) * 0.6 + 0.4;
  plane.userData.prop.rotation.z += dt * (6 + flight.throttle * 60);

  if (flight.crashTimer > 0) {
    flight.crashTimer -= dt;
    if (flight.crashTimer <= 0) {
      parkPlane();
      if (flight.active) showToast('Het vliegtuig staat weer klaar op het platform');
    }
    return;
  }
  if (!flight.active) return;

  // Gas
  if (input.up) flight.throttle = Math.min(1, flight.throttle + dt * 0.9);
  if (input.down) flight.throttle = Math.max(0, flight.throttle - dt * 0.8);
  const targetSpeed = flight.throttle * 58;
  const accel = flight.speed < targetSpeed ? 9.5 : 4;
  flight.speed += Math.sign(targetSpeed - flight.speed) * Math.min(Math.abs(targetSpeed - flight.speed), accel * dt);
  if (input.brake && !flight.airborne) flight.speed = Math.max(0, flight.speed - 14 * dt);

  const steer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  const ground = Math.max(getTerrainHeight(flight.x, flight.z), WATER_LEVEL);

  if (!flight.airborne) {
    // Taxiën en opstijgen
    flight.heading += steer * Math.min(1, flight.speed / 6) * 0.9 * dt;
    flight.roll *= Math.max(0, 1 - 6 * dt);
    const wantsUp = input.climb && flight.speed > 16.5;
    flight.pitch = THREE.MathUtils.lerp(flight.pitch, wantsUp ? 0.25 : 0, 4 * dt);
    flight.y = ground + GEAR_H;
    if (wantsUp && flight.pitch > 0.12) {
      flight.airborne = true;
      flight.vy = 2;
      showToast('Opgestegen! Kijk eens naar Pinewood Island van boven');
    }
  } else {
    // In de lucht: hellen = draaien, neus omhoog/omlaag
    flight.roll = THREE.MathUtils.lerp(flight.roll, steer * 0.75, 2.5 * dt);
    flight.heading += Math.sin(flight.roll) * (0.35 + flight.speed * 0.012) * dt;
    const pitchInput = (input.climb ? 1 : 0) - (input.dive ? 1 : 0);
    flight.pitch += pitchInput * 0.8 * dt;
    flight.pitch *= Math.max(0, 1 - (pitchInput ? 0 : 0.9) * dt);
    flight.pitch = THREE.MathUtils.clamp(flight.pitch, -0.45, 0.42);
    // Overtrekken bij te lage snelheid: neus zakt
    if (flight.speed < 16) flight.pitch = Math.max(-0.6, flight.pitch - (16 - flight.speed) * 0.05 * dt);
    const lift = flight.speed < 16 ? -6.0 * (1 - flight.speed / 16) : 0;
    flight.vy = THREE.MathUtils.lerp(flight.vy, Math.sin(flight.pitch) * flight.speed * 0.55 + lift, 3 * dt);
    flight.y += flight.vy * dt;
    if (flight.y > ground + 120) { flight.y = ground + 120; flight.vy = Math.min(0, flight.vy); }

    // Contact met de grond: landen of crashen
    if (flight.y <= ground + GEAR_H) {
      const overWater = getTerrainHeight(flight.x, flight.z) < WATER_LEVEL - 0.1;
      if (overWater) crash('Plons! Het vliegtuig ligt in het water');
      else if (flight.vy < -8.5 || Math.abs(flight.roll) > 0.5 || flight.pitch < -0.35) crash('Crash! Te hard of te scheef geland');
      else {
        flight.airborne = false;
        flight.y = ground + GEAR_H;
        flight.vy = 0;
        showToast('Mooie landing!');
      }
    }
  }

  // Vooruit bewegen
  const fx = Math.sin(flight.heading) * Math.cos(flight.pitch);
  const fz = Math.cos(flight.heading) * Math.cos(flight.pitch);
  flight.x += fx * flight.speed * dt;
  flight.z += fz * flight.speed * dt;
  // Binnen de wereld blijven: zachtjes terugsturen
  const r = Math.hypot(flight.x, flight.z - 30);
  if (r > 520) {
    const back = Math.atan2(-flight.x, 30 - flight.z);
    let diff = back - flight.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    flight.heading += diff * dt * 0.8;
  }
  applyPlaneTransform();
}

export function setAirfieldNight(isNight) {
  edgeLightMat.color.setHex(isNight ? 0xffe9a8 : 0xd8d0b8);
}

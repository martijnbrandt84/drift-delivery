import * as THREE from 'three';
import { scene, createOutlinedMesh, makeToonMat } from './scene-setup.js';
import { WATER_LEVEL, getClosestNetworkRoad } from './roads.js';
import { getTerrainHeight } from './terrain.js';
import { isInsideTownFootprint } from './props.js';
import { MOOSE_LAKE, ISLAND_CENTER, getIslandPolar, getCoastRadius } from './landscape.js';
import { hardColliders, destructibles } from './demolition.js';
import { sound } from './audio.js';
import { turkeys, deerList, foxes, ducks, foxDarkMat, beakYellowMat, darkHoofMat } from './wildlife.js';

// =========================================================
// DIEREN-GEDRAG: lopende poten, wegen/gebouwen/water mijden,
// schrikken van de auto en de toeter, herten die oversteken,
// beren die grommen — plus elanden, eekhoorns en arenden.
// =========================================================

// ---------- Botsrand-raster (gebouwen, hekken, palen) ----------
let colliderGrid = null;
function buildColliderGrid() {
  colliderGrid = new Map();
  hardColliders.forEach((c) => {
    if (c.r < 0.3) return;
    const cx0 = Math.floor((c.x - c.r) / 8);
    const cx1 = Math.floor((c.x + c.r) / 8);
    const cz0 = Math.floor((c.z - c.r) / 8);
    const cz1 = Math.floor((c.z + c.r) / 8);
    for (let cx = cx0; cx <= cx1; cx++) for (let cz = cz0; cz <= cz1; cz++) {
      const k = cx * 100003 + cz;
      if (!colliderGrid.has(k)) colliderGrid.set(k, []);
      colliderGrid.get(k).push(c);
    }
  });
}
function hitsCollider(x, z, r) {
  const arr = colliderGrid.get(Math.floor(x / 8) * 100003 + Math.floor(z / 8));
  if (!arr) return false;
  for (let i = 0; i < arr.length; i++) {
    const c = arr[i];
    if ((x - c.x) ** 2 + (z - c.z) ** 2 < (c.r + r) ** 2) return true;
  }
  return false;
}

// Mag het dier op (x,z) staan? Geeft de hoogte terug of null
function standHeight(a, x, z, allowRoad) {
  const y = getTerrainHeight(x, z);
  if (a.wader) {
    if (y < WATER_LEVEL - 0.75) return null;
  } else if (y < WATER_LEVEL + 0.3) {
    return null;
  }
  if (!allowRoad) {
    const m = getClosestNetworkRoad(x, z).marginDist;
    if (m < 1.2) {
      // Staat het dier al op de weg, dan mag het altijd een stap van de weg af zetten
      const cur = getClosestNetworkRoad(a.root.position.x, a.root.position.z).marginDist;
      if (!(cur < 1.2 && m > cur)) return null;
    }
  }
  if (!a.townOk && isInsideTownFootprint(x, z, 1)) return null;
  if (hitsCollider(x, z, a.bodyR)) return null;
  return y;
}

// Probeer een stap; bij een obstakel draait het dier af
function step(a, speed, dt, allowRoad = false) {
  const nx = a.root.position.x + Math.sin(a.angle) * speed * dt;
  const nz = a.root.position.z + Math.cos(a.angle) * speed * dt;
  let y = standHeight(a, nx, nz, allowRoad);
  if (y === null && a.stuck > 1.5) {
    // Vastgelopen (bijv. gespawnd op een lastige plek): toch even doorlopen, behalve het water in
    const gy = getTerrainHeight(nx, nz);
    if (gy > WATER_LEVEL + 0.2 || a.wader) y = gy;
  }
  if (y === null) {
    a.stuck += dt;
    a.angle += (a.turnDir || 1) * (1.2 + Math.random() * 1.2);
    a.turnDir = Math.random() < 0.5 ? -1 : 1;
    return false;
  }
  a.stuck = 0;
  a.root.position.set(nx, y, nz);
  return true;
}

// Op een helling: het lijf kantelt mee (voor/achter en links/rechts), zodat geen poot in de grond verdwijnt
function alignToGround(a) {
  const p = a.root.position;
  const half = (a.bodyR || 0.6) * 1.3;
  const side = (a.bodyR || 0.6) * 0.6;
  const yaw = a.root.rotation.y;
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  const hF = getTerrainHeight(p.x + fx * half, p.z + fz * half);
  const hB = getTerrainHeight(p.x - fx * half, p.z - fz * half);
  const hR = getTerrainHeight(p.x + fz * side, p.z - fx * side);
  const hL = getTerrainHeight(p.x - fz * side, p.z + fx * side);
  const hC = getTerrainHeight(p.x, p.z);
  if (a.wader && hC < WATER_LEVEL) return; // in het water: zwemmend, niet kantelen
  p.y = Math.max(hC, (hF + hB + hL + hR) * 0.25);
  a.root.rotation.order = 'YXZ';
  const pitch = THREE.MathUtils.clamp(-Math.atan2(hF - hB, 2 * half), -0.45, 0.45);
  const roll = THREE.MathUtils.clamp(Math.atan2(hR - hL, 2 * side), -0.35, 0.35);
  a.root.rotation.x += (pitch - a.root.rotation.x) * 0.35;
  a.root.rotation.z += (roll - a.root.rotation.z) * 0.35;
}

// Poten laten lopen
function animateGait(a, speed, dt, elapsed, stride) {
  a.cycle = (a.cycle || 0) + speed * dt * stride;
  const amp = Math.min(0.75, speed * 0.16);
  if (a.legs) a.legs.forEach((l) => { l.pivot.rotation.x = Math.sin(a.cycle) * amp * l.sign; });
  if (a.bodyGroup) a.bodyGroup.position.y = Math.abs(Math.sin(a.cycle)) * Math.min(0.2, speed * 0.03) * a.bobScale;
}

const angleTo = (fx, fz, tx, tz) => Math.atan2(tx - fx, tz - fz);
function turnTowards(cur, target, rate) {
  let d = target - cur;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return cur + THREE.MathUtils.clamp(d, -rate, rate);
}

// ---------- Toeter ----------
let hornAt = null;
export function notifyHorn(x, z) {
  hornAt = { x, z, t: 0.15 };
}

// =========================================================
// NIEUWE DIEREN
// =========================================================
const mooseFurMat = makeToonMat(0x4a3222);
const mooseDarkMat = makeToonMat(0x2e2016);
const mooseAntlerMat = makeToonMat(0xd8c49a);

function createMoose() {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);
  const torso = createOutlinedMesh(new THREE.SphereGeometry(0.75, 10, 8), mooseFurMat, 0.04, true, false);
  torso.scale.set(0.85, 0.9, 1.6);
  torso.position.y = 1.95;
  bodyGroup.add(torso);
  const hump = createOutlinedMesh(new THREE.SphereGeometry(0.55, 9, 7), mooseFurMat, 0.035, false, false);
  hump.position.set(0, 2.35, 0.55);
  bodyGroup.add(hump);
  const neckPivot = new THREE.Group();
  neckPivot.position.set(0, 2.25, 1.05);
  bodyGroup.add(neckPivot);
  const neck = createOutlinedMesh(new THREE.CylinderGeometry(0.28, 0.38, 0.7, 8), mooseFurMat, 0.03, false, false);
  neck.position.set(0, 0.1, 0.2);
  neck.rotation.x = 1.0;
  neckPivot.add(neck);
  const head = createOutlinedMesh(new THREE.BoxGeometry(0.42, 0.45, 0.95), mooseFurMat, 0.03, false, false);
  head.position.set(0, 0.15, 0.75);
  head.rotation.x = 0.35;
  neckPivot.add(head);
  const muzzle = createOutlinedMesh(new THREE.SphereGeometry(0.26, 8, 6), mooseDarkMat, 0.025, false, false);
  muzzle.scale.set(1, 0.9, 1.2);
  muzzle.position.set(0, -0.05, 1.18);
  neckPivot.add(muzzle);
  const bell = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.45, 6), mooseDarkMat);
  bell.position.set(0, -0.32, 0.55);
  bell.rotation.x = Math.PI;
  neckPivot.add(bell);
  [-0.22, 0.22].forEach((ex) => {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.3, 5), mooseFurMat);
    ear.position.set(ex, 0.45, 0.45);
    ear.rotation.z = ex < 0 ? 1.0 : -1.0;
    neckPivot.add(ear);
  });
  // Brede schoffelvormige geweien
  [-1, 1].forEach((side) => {
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.5, 5), mooseAntlerMat);
    beam.position.set(side * 0.35, 0.5, 0.5);
    beam.rotation.z = -side * 1.2;
    neckPivot.add(beam);
    const palm = createOutlinedMesh(new THREE.BoxGeometry(0.85, 0.08, 0.55), mooseAntlerMat, 0.02, false, false);
    palm.position.set(side * 0.85, 0.72, 0.45);
    palm.rotation.z = side * 0.35;
    neckPivot.add(palm);
    for (let k = 0; k < 4; k++) {
      const tine = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.3, 4), mooseAntlerMat);
      tine.position.set(side * (0.6 + k * 0.17), 0.9 + k * 0.05, 0.3 + (k % 2) * 0.25);
      tine.rotation.z = -side * 0.3;
      neckPivot.add(tine);
    }
  });
  const legs = [];
  [[-0.32, 0.75], [0.32, 0.75], [-0.32, -0.75], [0.32, -0.75]].forEach(([lx, lz], k) => {
    const pivot = new THREE.Group();
    pivot.position.set(lx, 1.55, lz);
    bodyGroup.add(pivot);
    const leg = createOutlinedMesh(new THREE.CylinderGeometry(0.11, 0.08, 1.5, 6), mooseFurMat, 0.025, false, false);
    leg.position.y = -0.75;
    pivot.add(leg);
    const hoof = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.12, 6), darkHoofMat);
    hoof.position.y = -1.5;
    pivot.add(hoof);
    legs.push({ pivot, sign: k === 0 || k === 3 ? 1 : -1 });
  });
  return { root, bodyGroup, neckPivot, legs, species: 'moose' };
}

const squirrelMat = makeToonMat(0xb5602c);
const squirrelBellyMat = makeToonMat(0xf2dcc0);
function createSquirrel() {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);
  const body = createOutlinedMesh(new THREE.SphereGeometry(0.13, 8, 6), squirrelMat, 0.015, false, false);
  body.scale.set(0.85, 0.9, 1.3);
  body.position.y = 0.14;
  bodyGroup.add(body);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5), squirrelBellyMat);
  belly.position.set(0, 0.11, 0.06);
  bodyGroup.add(belly);
  const head = createOutlinedMesh(new THREE.SphereGeometry(0.09, 7, 6), squirrelMat, 0.013, false, false);
  head.position.set(0, 0.24, 0.15);
  bodyGroup.add(head);
  [-0.05, 0.05].forEach((ex) => {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.07, 4), squirrelMat);
    ear.position.set(ex, 0.33, 0.13);
    bodyGroup.add(ear);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.015, 4, 4), foxDarkMat);
    eye.position.set(ex * 0.9, 0.26, 0.23);
    bodyGroup.add(eye);
  });
  // Grote pluimstaart
  const tail = new THREE.Group();
  tail.position.set(0, 0.16, -0.14);
  bodyGroup.add(tail);
  const t1 = createOutlinedMesh(new THREE.SphereGeometry(0.1, 7, 6), squirrelMat, 0.014, false, false);
  t1.scale.set(0.9, 1.4, 0.9);
  t1.position.set(0, 0.1, -0.06);
  tail.add(t1);
  const t2 = createOutlinedMesh(new THREE.SphereGeometry(0.1, 7, 6), squirrelMat, 0.014, false, false);
  t2.scale.set(0.9, 1.1, 1.0);
  t2.position.set(0, 0.3, 0.02);
  tail.add(t2);
  return { root, bodyGroup, tail, species: 'squirrel' };
}

const eagleBrownMat = makeToonMat(0x4a3424);
const eagleWhiteMat = makeToonMat(0xf8f4ea);
function createEagle() {
  const root = new THREE.Group();
  const body = createOutlinedMesh(new THREE.SphereGeometry(0.35, 8, 7), eagleBrownMat, 0.03, false, false);
  body.scale.set(0.8, 0.7, 1.7);
  root.add(body);
  const head = createOutlinedMesh(new THREE.SphereGeometry(0.22, 8, 7), eagleWhiteMat, 0.025, false, false);
  head.position.set(0, 0.12, 0.62);
  root.add(head);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.24, 5), beakYellowMat);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.08, 0.86);
  root.add(beak);
  const tail = createOutlinedMesh(new THREE.BoxGeometry(0.5, 0.06, 0.45), eagleWhiteMat, 0.02, false, false);
  tail.position.set(0, 0, -0.75);
  root.add(tail);
  const wings = [];
  [-1, 1].forEach((side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.2, 0.08, 0.05);
    root.add(pivot);
    const wing = createOutlinedMesh(new THREE.BoxGeometry(1.9, 0.07, 0.75), eagleBrownMat, 0.025, false, false);
    wing.position.set(side * 0.95, 0, 0);
    pivot.add(wing);
    const tip = createOutlinedMesh(new THREE.BoxGeometry(0.6, 0.06, 0.5), mooseDarkMat, 0.02, false, false);
    tip.position.set(side * 2.1, 0, -0.08);
    pivot.add(tip);
    wings.push({ pivot, side });
  });
  root.scale.setScalar(1.5);
  return { root, wings };
}

// ---------- Plaatsen ----------
const moose = [];
for (let i = 0; i < 4; i++) {
  for (let t = 0; t < 80; t++) {
    const ang = Math.random() * Math.PI * 2;
    const rr = MOOSE_LAKE.r * (0.75 + Math.random() * 0.45);
    const x = MOOSE_LAKE.x + Math.cos(ang) * rr;
    const z = MOOSE_LAKE.z + Math.sin(ang) * rr;
    const y = getTerrainHeight(x, z);
    if (y < WATER_LEVEL - 0.6 || y > WATER_LEVEL + 3) continue;
    if (getClosestNetworkRoad(x, z).marginDist < 4) continue;
    const m = createMoose();
    m.root.position.set(x, y, z);
    m.root.rotation.y = Math.random() * Math.PI * 2;
    scene.add(m.root);
    moose.push(m);
    break;
  }
}

// Eekhoorns bij losse bomen in de kern van het eiland
const squirrels = [];
{
  const candidates = destructibles.filter((d) => d.kind === 'tree' && !d.instRefs && d.mesh && d.mesh.parent);
  for (let i = 0; i < 16 && candidates.length; i++) {
    const tree = candidates[Math.floor(Math.random() * candidates.length)];
    const sq = createSquirrel();
    const a = Math.random() * Math.PI * 2;
    const x = tree.x + Math.cos(a) * 2;
    const z = tree.z + Math.sin(a) * 2;
    sq.root.position.set(x, getTerrainHeight(x, z), z);
    scene.add(sq.root);
    squirrels.push(sq);
    Object.assign(sq, { tree, state: 'ground', timer: Math.random() * 3, angle: a, climbH: 0, trunkAng: a });
  }
}

const eagles = [];
for (let i = 0; i < 2; i++) {
  const e = createEagle();
  scene.add(e.root);
  eagles.push(Object.assign(e, {
    cx: ISLAND_CENTER.x + (i ? 120 : -90),
    cz: ISLAND_CENTER.z + (i ? -60 : 110),
    radius: 75 + i * 30,
    alt: 58 + i * 10,
    ang: Math.random() * Math.PI * 2,
    dir: i ? -1 : 1,
    speed: 13 + i * 2,
    flapTimer: 0,
    driftAng: Math.random() * Math.PI * 2
  }));
}

// ---------- Init van alle landdieren ----------
const landAnimals = [];
function initAnimal(a, opts) {
  Object.assign(a, {
    homeX: a.homeX ?? a.root.position.x,
    homeZ: a.homeZ ?? a.root.position.z,
    angle: a.angle ?? a.root.rotation.y,
    timer: a.timer ?? Math.random() * 3,
    stuck: 0,
    fear: 0,
    walking: a.walking ?? false,
    cycle: Math.random() * 6,
    bobScale: 1,
    ...opts
  });
  a.townOk = isInsideTownFootprint(a.homeX, a.homeZ, 2);
  landAnimals.push(a);
}
const SPEC = {
  turkey: { walk: 1.15, run: 6.2, bodyR: 0.4, roam: 11, stride: 9, flee: 15 },
  deer: { walk: 1.9, run: 7.5, bodyR: 0.6, roam: 16, stride: 4.2, flee: 16 },
  bear: { walk: 1.4, run: 4.5, bodyR: 0.9, roam: 18, stride: 3.2, flee: 0 },
  fox: { walk: 2.8, run: 7.0, bodyR: 0.4, roam: 14, stride: 8, flee: 13 },
  raccoon: { walk: 1.8, run: 5.0, bodyR: 0.35, roam: 10, stride: 10, flee: 11 },
  beaver: { walk: 1.1, run: 3.5, bodyR: 0.4, roam: 8, stride: 10, flee: 10, wader: true },
  moose: { walk: 1.2, run: 4.2, bodyR: 1.0, roam: 12, stride: 2.4, flee: 12, wader: true }
};
turkeys.forEach((a) => initAnimal(a, { ...SPEC.turkey, spec: SPEC.turkey }));
deerList.forEach((a) => initAnimal(a, { ...SPEC[a.species], spec: SPEC[a.species], crossTimer: 20 + Math.random() * 60 }));
foxes.forEach((a) => initAnimal(a, { ...SPEC[a.species], spec: SPEC[a.species] }));
moose.forEach((a) => initAnimal(a, { ...SPEC.moose, spec: SPEC.moose, walking: false, bobScale: 0.5 }));

// ---------- Herten steken in een groepje de weg over ----------
function tryStartCrossing(d, px, pz) {
  const p = d.root.position;
  const distPlayer = Math.hypot(p.x - px, p.z - pz);
  if (distPlayer < 35 || distPlayer > 150) return;
  const road = getClosestNetworkRoad(p.x, p.z);
  if (!road || road.marginDist > 22 || road.marginDist < 1) return;
  // Richting: dwars over de weg naar de overkant
  const rx = road.sample?.x;
  const rz = road.sample?.z;
  if (rx === undefined) return;
  const dx = rx - p.x;
  const dz = rz - p.z;
  const len = Math.hypot(dx, dz) || 1;
  const tx = rx + (dx / len) * 12;
  const tz = rz + (dz / len) * 12;
  if (getTerrainHeight(tx, tz) < WATER_LEVEL + 0.4) return;
  const group = deerList.filter((o) => o.species === 'deer' && Math.hypot(o.root.position.x - p.x, o.root.position.z - p.z) < 14);
  group.forEach((o, k) => {
    o.crossing = { x: tx + (Math.random() - 0.5) * 4, z: tz + (Math.random() - 0.5) * 4, delay: k * 0.7 };
    o.crossTimer = 60 + Math.random() * 60;
  });
}

// =========================================================
// UPDATE
// =========================================================
export function updateWildlife(dt, elapsed, px, pz, playerSpeed) {
  if (!colliderGrid) buildColliderGrid();
  let horn = null;
  if (hornAt) {
    horn = hornAt;
    hornAt.t -= dt;
    if (hornAt.t <= 0) hornAt = null;
  }
  const fleeBoost = Math.min(14, playerSpeed * 0.35);

  for (let i = 0; i < landAnimals.length; i++) {
    const a = landAnimals[i];
    const p = a.root.position;
    const dist = Math.hypot(p.x - px, p.z - pz);
    if (dist > 175) continue;
    a.timer -= dt;

    // --- Beren: omdraaien en grommen ---
    if (a.species === 'bear') {
      const close = dist < 14 + fleeBoost * 0.5 || (horn && Math.hypot(p.x - horn.x, p.z - horn.z) < 40);
      if (close) {
        a.angle = turnTowards(a.angle, angleTo(p.x, p.z, px, pz), 4 * dt);
        a.root.rotation.y = a.angle;
        if (a.neckPivot) a.neckPivot.rotation.x = THREE.MathUtils.lerp(a.neckPivot.rotation.x, -0.35, 6 * dt);
        if (a.bodyGroup) a.bodyGroup.rotation.x = THREE.MathUtils.lerp(a.bodyGroup.rotation.x, -0.12, 6 * dt);
        if (!a.growled || elapsed - a.growled > 5) {
          a.growled = elapsed;
          sound.playGrowl();
        }
        // Rijd je er hard op af, dan springt hij toch opzij
        if (dist < 6 && playerSpeed > 6) {
          a.angle += Math.PI / 2;
          step(a, a.run, dt);
        }
        animateGait(a, 0, dt, elapsed, a.stride);
        continue;
      }
      if (a.bodyGroup) a.bodyGroup.rotation.x *= 1 - 4 * dt;
    }

    // --- Schrikken van auto en toeter ---
    const fleeR = a.flee + fleeBoost;
    if (a.flee > 0 && (dist < fleeR || (horn && Math.hypot(p.x - horn.x, p.z - horn.z) < 38))) {
      if (a.fear <= 0 && a.species === 'turkey') sound.playTurkeyGobble();
      a.fear = 1.6 + Math.random();
      const src = dist < fleeR || !horn ? { x: px, z: pz } : horn;
      a.angle = angleTo(src.x, src.z, p.x, p.z) + (Math.random() - 0.5) * 0.6;
      a.crossing = null;
    }

    let speed = 0;
    let allowRoad = false;
    if (a.fear > 0) {
      a.fear -= dt;
      speed = a.run;
      allowRoad = true; // vluchten mag over de weg, liever van de weg af dan blijven staan
      if (!step(a, speed, dt, true)) speed = 0;
      // Spring-effect als de auto vlakbij is
      if (dist < 7 && a.bodyGroup && (a.species === 'deer' || a.species === 'fox')) a.bodyGroup.position.y = 0.4;
    } else if (a.crossing) {
      a.crossing.delay -= dt;
      if (a.crossing.delay <= 0) {
        a.angle = turnTowards(a.angle, angleTo(p.x, p.z, a.crossing.x, a.crossing.z), 3 * dt);
        speed = 2.6;
        allowRoad = true;
        step(a, speed, dt, true);
        if (Math.hypot(p.x - a.crossing.x, p.z - a.crossing.z) < 2.5) {
          a.homeX = a.crossing.x;
          a.homeZ = a.crossing.z;
          a.crossing = null;
          a.walking = false;
          a.timer = 3;
        }
      }
    } else {
      if (a.timer <= 0 && getClosestNetworkRoad(p.x, p.z).marginDist < 1.2) {
        // Op de weg beland (na vluchten): loop er recht vanaf
        const rs = getClosestNetworkRoad(p.x, p.z).sample;
        if (rs) a.angle = angleTo(rs.x, rs.z, p.x, p.z);
        a.walking = true;
        a.timer = 1.5;
      } else if (a.timer <= 0) {
        a.walking = !a.walking || a.species === 'fox' || a.species === 'turkey';
        a.timer = a.walking ? 1.8 + Math.random() * 3 : 2 + Math.random() * 3.5;
        const dHome = Math.hypot(a.homeX - p.x, a.homeZ - p.z);
        a.angle = dHome > a.roam ? angleTo(p.x, p.z, a.homeX, a.homeZ) : a.angle + (Math.random() - 0.5) * 2.2;
      }
      if (a.walking) {
        speed = a.walk;
        if (!step(a, speed, dt, false)) speed = 0;
      }
      if (a.species === 'deer') {
        a.crossTimer -= dt;
        if (a.crossTimer <= 0) {
          a.crossTimer = 25 + Math.random() * 40;
          tryStartCrossing(a, px, pz);
        }
      }
    }

    a.root.rotation.y = turnTowards(a.root.rotation.y, a.angle, 8 * dt);
    alignToGround(a);
    animateGait(a, speed, dt, elapsed, a.stride);

    // Kop: grazen bij stilstand, omhoog bij schrik
    if (a.neckPivot && a.species !== 'bear') {
      const target = a.fear > 0 ? -0.15 : speed === 0 ? (a.species === 'moose' ? 0.9 : 0.72) : 0;
      a.neckPivot.rotation.x = THREE.MathUtils.lerp(a.neckPivot.rotation.x, target, 4 * dt);
    }
    if (a.species === 'turkey') {
      a.headPivot.rotation.x = speed > 0 && a.fear <= 0 ? Math.max(0, Math.sin(elapsed * 5 + a.cycle)) * 0.55 : 0;
      const flap = a.fear > 0 ? Math.sin(elapsed * 28) * 0.7 : 0;
      a.leftWing.rotation.z = flap;
      a.rightWing.rotation.z = -flap;
    }
    if (a.tail) a.tail.rotation.y = Math.sin(elapsed * (speed > 0 ? 9 : 3) + a.cycle) * (speed > 3 ? 0.15 : 0.35);
  }

  // --- Eenden en zwanen (dobberen rond hun plekje) ---
  for (let i = 0; i < ducks.length; i++) {
    const dk = ducks[i];
    const distSq = (dk.root.position.x - px) ** 2 + (dk.root.position.z - pz) ** 2;
    if (distSq > 170 * 170) continue;
    if (horn && Math.hypot(dk.root.position.x - horn.x, dk.root.position.z - horn.z) < 30) dk.scared = 2.5;
    const spd = dk.scared > 0 ? 4 : 1;
    if (dk.scared > 0) dk.scared -= dt;
    dk.orbitAng = (dk.orbitAng ?? dk.phase) + dt * dk.orbitSpeed * spd;
    const ang = dk.orbitAng;
    dk.root.position.set(dk.centerX + Math.cos(ang) * dk.orbitR, WATER_LEVEL + 0.06 + Math.sin(elapsed * 2.2 + dk.bobPhase) * 0.025, dk.centerZ + Math.sin(ang) * dk.orbitR);
    dk.root.rotation.y = -ang + Math.PI / 2;
    dk.bodyGroup.position.y = Math.abs(Math.sin(elapsed * 6 + dk.bobPhase)) * 0.03;
  }

  // --- Eekhoorns: scharrelen bij hun boom, vluchten de stam in ---
  for (let i = 0; i < squirrels.length; i++) {
    const s = squirrels[i];
    const p = s.root.position;
    const dist = Math.hypot(p.x - px, p.z - pz);
    if (dist > 140) continue;
    if (!s.tree.intact || !s.tree.mesh.parent) {
      // Boom omgereden: zoek een nieuwe boom in de buurt
      const near = destructibles.find((d) => d.kind === 'tree' && d.intact && !d.instRefs && d.mesh.parent && Math.hypot(d.x - p.x, d.z - p.z) < 40);
      if (near) s.tree = near;
      s.state = 'ground';
      s.climbH = 0;
      s.root.rotation.set(0, s.angle, 0);
    }
    const tr = s.tree;
    const trunkR = 0.42 * (tr.mesh.scale?.x || 1);
    const groundY = getTerrainHeight(tr.x, tr.z);
    s.timer -= dt;
    const scared = dist < 16 || (horn && Math.hypot(p.x - horn.x, p.z - horn.z) < 30);
    if (s.state === 'ground') {
      if (scared) {
        s.state = 'run';
      } else {
        if (s.timer <= 0) {
          s.timer = 0.4 + Math.random() * 1.6;
          s.moving = !s.moving;
          s.angle += (Math.random() - 0.5) * 2.5;
          if (Math.hypot(p.x - tr.x, p.z - tr.z) > 4) s.angle = angleTo(p.x, p.z, tr.x, tr.z);
          if (Math.random() < 0.15) s.state = 'run';
        }
        if (s.moving) {
          const nx = p.x + Math.sin(s.angle) * 2.6 * dt;
          const nz = p.z + Math.cos(s.angle) * 2.6 * dt;
          p.set(nx, getTerrainHeight(nx, nz) + Math.abs(Math.sin(elapsed * 16 + i)) * 0.1, nz);
        }
        s.root.rotation.set(0, s.angle, 0);
        s.root.rotation.order = 'YXZ';
        s.tail.rotation.x = Math.sin(elapsed * 6 + i) * 0.2;
      }
    }
    if (s.state === 'run') {
      // Naar de stam rennen
      s.trunkAng = Math.atan2(p.x - tr.x, p.z - tr.z);
      const tx = tr.x + Math.sin(s.trunkAng) * trunkR;
      const tz = tr.z + Math.cos(s.trunkAng) * trunkR;
      s.angle = angleTo(p.x, p.z, tx, tz);
      const nx = p.x + Math.sin(s.angle) * 5 * dt;
      const nz = p.z + Math.cos(s.angle) * 5 * dt;
      p.set(nx, getTerrainHeight(nx, nz) + Math.abs(Math.sin(elapsed * 20 + i)) * 0.12, nz);
      s.root.rotation.set(0, s.angle, 0);
      if (Math.hypot(nx - tx, nz - tz) < 0.3) {
        s.state = 'up';
        s.timer = 4 + Math.random() * 4;
      }
    } else if (s.state === 'up' || s.state === 'top' || s.state === 'down') {
      if (s.state === 'up') {
        s.climbH = Math.min(2.6, s.climbH + 3.2 * dt);
        if (s.climbH >= 2.6) s.state = 'top';
      } else if (s.state === 'top') {
        if (!scared) s.timer -= dt;
        if (s.timer <= 0) s.state = 'down';
      } else {
        s.climbH = Math.max(0, s.climbH - 2.4 * dt);
        if (s.climbH <= 0) {
          s.state = 'ground';
          s.timer = 1;
          s.angle = s.trunkAng;
          p.set(tr.x + Math.sin(s.trunkAng) * (trunkR + 0.5), groundY, tr.z + Math.cos(s.trunkAng) * (trunkR + 0.5));
        }
      }
      if (s.state !== 'ground') {
        // Op de stam: buik naar de boom, kop omhoog (of omlaag bij het afdalen); draait een beetje rond
        s.trunkAng += dt * (s.state === 'top' ? 0.2 : 1.0);
        const ox = Math.sin(s.trunkAng) * (trunkR + 0.12);
        const oz = Math.cos(s.trunkAng) * (trunkR + 0.12);
        p.set(tr.x + ox, groundY + 0.3 + s.climbH, tr.z + oz);
        s.root.rotation.order = 'YXZ';
        const yaw = Math.atan2(-ox, -oz);
        s.root.rotation.set(s.state === 'down' ? Math.PI / 2 : -Math.PI / 2, yaw, 0);
        s.tail.rotation.x = Math.sin(elapsed * 10 + i) * 0.3;
      }
    }
  }

  // --- Arenden: cirkelen hoog boven het eiland ---
  for (let i = 0; i < eagles.length; i++) {
    const e = eagles[i];
    e.ang += (e.speed / e.radius) * dt * e.dir;
    // Het cirkelcentrum drijft langzaam over het eiland
    e.driftAng += dt * 0.02;
    const cx = e.cx + Math.cos(e.driftAng) * 60;
    const cz = e.cz + Math.sin(e.driftAng * 0.7) * 60;
    const x = cx + Math.cos(e.ang) * e.radius;
    const z = cz + Math.sin(e.ang) * e.radius;
    const pol = getIslandPolar(x, z);
    const coastR = getCoastRadius(pol.theta);
    const ground = pol.r < coastR ? Math.max(getTerrainHeight(x, z), WATER_LEVEL) : WATER_LEVEL;
    const y = Math.max(ground + 30, e.alt + Math.sin(elapsed * 0.3 + i) * 6);
    e.root.position.set(x, y, z);
    // Richting = raaklijn aan de cirkel, met een schuine bocht
    const heading = Math.atan2(-Math.sin(e.ang) * e.dir, Math.cos(e.ang) * e.dir);
    e.root.rotation.order = 'YXZ';
    e.root.rotation.set(0, heading, 0.35 * e.dir);
    // Af en toe een paar vleugelslagen, verder zweven
    e.flapTimer -= dt;
    let flap = 0;
    if (e.flapTimer < 0) {
      if (e.flapTimer < -1.6) e.flapTimer = 4 + Math.random() * 5;
      flap = Math.sin(elapsed * 9) * 0.45;
    }
    e.wings.forEach((w) => { w.pivot.rotation.z = w.side * (0.08 + flap); });
  }
}

export const wildlifeDebug = { moose, squirrels, eagles };

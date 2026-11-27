import * as THREE from 'three';
import { scene, createOutlinedMesh, makeToonMat, setAlignedTransform } from './scene-setup.js';
import { ringCurve, getRingBaseElev, getRingBridgeAtU, MAIN_HALF_WIDTH } from './roads.js';
import { ruralLots } from './water-lots.js';
import { hardColliders } from './demolition.js';
import { getDriveHeightAndWaterState } from './drive-surface.js';
import { buildSportsCarMesh } from './vehicles.js';
import { showToast } from './ui-controls.js';

// =========================================================
// RONDE VAN PINEWOOD — race tegen een rivaal over de kustweg rond het eiland
// =========================================================
export const RACE_NAME = 'Ronde van Pinewood';
const N = 1600;
const L = ringCurve.getLength();
const DS = L / N;
const pts = [];
const tans = [];
for (let i = 0; i < N; i++) {
  const u = i / N;
  const p = ringCurve.getPointAt(u);
  const t = ringCurve.getTangentAt(u);
  const tl = Math.hypot(t.x, t.z) || 1;
  pts.push({ x: p.x, z: p.z });
  tans.push({ x: t.x / tl, z: t.z / tl });
}
const wrap = (i) => ((i % N) + N) % N;

function nearestIdx(x, z, from = 0, span = N) {
  let best = -1;
  let bestD = Infinity;
  for (let k = 0; k < span; k++) {
    const i = wrap(from + k);
    const d = (pts[i].x - x) ** 2 + (pts[i].z - z) ** 2;
    if (d < bestD) { bestD = d; best = i; }
  }
  return { idx: best, dist: Math.sqrt(bestD) };
}

// Snelheidsprofiel voor de rivaal: langzamer in bochten, op tijd remmen
const RIVAL_VMAX = 56;
const RIVAL_LAT = 18;
const RIVAL_DECEL = 16;
const speedProfile = new Float32Array(N);
{
  const look = Math.max(2, Math.round(14 / DS));
  for (let i = 0; i < N; i++) {
    const a = tans[wrap(i - look)];
    const b = tans[wrap(i + look)];
    const ang = Math.acos(THREE.MathUtils.clamp(a.x * b.x + a.z * b.z, -1, 1));
    const k = ang / (2 * look * DS);
    speedProfile[i] = Math.min(RIVAL_VMAX, k > 1e-4 ? Math.sqrt(RIVAL_LAT / k) : RIVAL_VMAX);
  }
  for (let pass = 0; pass < 2; pass++) {
    for (let i = N - 1; i >= 0; i--) {
      const next = speedProfile[wrap(i + 1)];
      speedProfile[i] = Math.min(speedProfile[i], Math.sqrt(next * next + 2 * RIVAL_DECEL * DS));
    }
  }
}

// Start/finish: een stukje voorbij de inrit van Pine Burger
const burgerLot = ruralLots.find((l) => l.type === 'diner');
const START_IDX = wrap(nearestIdx(burgerLot ? burgerLot.x : 0, burgerLot ? burgerLot.z : 0).idx + Math.round(120 / DS));
const GRID_BACK = Math.round(9 / DS);
const uOf = (i) => wrap(i) / N;

function frameAt(i) {
  const p = pts[wrap(i)];
  const t = tans[wrap(i)];
  return { x: p.x, z: p.z, tx: t.x, tz: t.z, rx: -t.z, rz: t.x };
}

// ---- Start/finishboog ----
function makeBannerTexture() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 160;
  const ctx = c.getContext('2d');
  const sq = 20;
  for (let y = 0; y < 160; y += sq) {
    for (let x = 0; x < 1024; x += sq) {
      ctx.fillStyle = ((x + y) / sq) % 2 === 0 ? '#1d1d1d' : '#ffffff';
      ctx.fillRect(x, y, sq, sq);
    }
  }
  ctx.fillStyle = '#d62839';
  ctx.fillRect(120, 22, 784, 116);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 6;
  ctx.strokeRect(120, 22, 784, 116);
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 62px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('START · FINISH', 512, 66);
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 30px system-ui, sans-serif';
  ctx.fillText(RACE_NAME.toUpperCase(), 512, 116);
  const tex = Object.assign(new THREE.CanvasTexture(c), { colorSpace: THREE.SRGBColorSpace });
  tex.needsUpdate = true;
  return tex;
}

{
  const f = frameAt(START_IDX);
  const y = getRingBaseElev(uOf(START_IDX)) + getRingBridgeAtU(uOf(START_IDX)).archY;
  const g = new THREE.Group();
  g.position.set(f.x, y, f.z);
  g.rotation.y = Math.atan2(f.tx, f.tz);
  scene.add(g);
  const half = MAIN_HALF_WIDTH + 1.6;
  const postMat = makeToonMat(0xf6f2ea);
  [-half, half].forEach((lx) => {
    const post = createOutlinedMesh(new THREE.BoxGeometry(0.5, 7.0, 0.5), postMat, 0.03);
    post.position.set(lx, 3.5, 0);
    g.add(post);
    const foot = createOutlinedMesh(new THREE.BoxGeometry(0.9, 0.5, 0.9), makeToonMat(0xd62839), 0.03, false);
    foot.position.set(lx, 0.25, 0);
    g.add(foot);
    const wp = { x: f.x + f.rx * -lx, z: f.z + f.rz * -lx };
    hardColliders.push({ x: wp.x, z: wp.z, r: 0.45 });
  });
  const tex = makeBannerTexture();
  const beam = createOutlinedMesh(new THREE.BoxGeometry(half * 2 + 0.5, 1.6, 0.3), makeToonMat(0x1d1d1d), 0.04);
  beam.position.y = 6.6;
  g.add(beam);
  [1, -1].forEach((side) => {
    const face = new THREE.Mesh(new THREE.PlaneGeometry(half * 2 + 0.3, 1.45), new THREE.MeshBasicMaterial({ map: tex, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, toneMapped: false }));
    face.position.set(0, 6.6, side * 0.2);
    if (side < 0) face.rotation.y = Math.PI;
    g.add(face);
  });
  // Geblokte lijn op het asfalt
  const lineTex = makeBannerTexture();
  lineTex.repeat.set(1, 1);
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 32;
  const ctx = c.getContext('2d');
  for (let x = 0; x < 256; x += 16) {
    for (let yy = 0; yy < 32; yy += 16) {
      ctx.fillStyle = ((x + yy) / 16) % 2 === 0 ? '#1d1d1d' : '#ffffff';
      ctx.fillRect(x, yy, 16, 16);
    }
  }
  const checker = new THREE.Mesh(
    new THREE.PlaneGeometry(MAIN_HALF_WIDTH * 2 - 0.4, 1.1),
    new THREE.MeshBasicMaterial({ map: Object.assign(new THREE.CanvasTexture(c), { colorSpace: THREE.SRGBColorSpace }), polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, toneMapped: false })
  );
  checker.rotation.x = -Math.PI / 2;
  checker.position.y = 0.06;
  g.add(checker);
}

// ---- Rivaal ----
const rival = buildSportsCarMesh(0x2a6fdb, 'Rivaal Stingray', 11);
rival.root.visible = false;
scene.add(rival.root);

// ---- HUD ----
const hud = document.createElement('div');
hud.id = 'race-hud';
hud.hidden = true;
document.body.appendChild(hud);
const countEl = document.createElement('div');
countEl.id = 'race-count';
document.body.appendChild(countEl);

let bestTime = null;
try {
  const v = parseFloat(localStorage.getItem('pinewood-race-best'));
  if (Number.isFinite(v)) bestTime = v;
} catch (e) { /* geen opslag beschikbaar */ }

const fmt = (t) => {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`;
};

export const race = {
  state: 'idle', // idle | countdown | racing | done
  veh: null,
  timer: 0,
  countdown: 0,
  playerIdx: 0,      // ongewrapte voortgang in samples
  rivalDist: 0,      // afgelegde meters van de rivaal
  rivalSpeed: 0,
  rivalFinish: null,
  offCourseTimer: 0,
  cooldown: 0,
  doneTimer: 0,
  shortcutWarn: 0
};

function showCount(text, cls = '') {
  countEl.textContent = text;
  countEl.className = `show ${cls}`;
}
function hideCount() {
  countEl.className = '';
}

function placeOnGrid(veh, carState, laneOffset) {
  const i = START_IDX - GRID_BACK;
  const f = frameAt(i);
  const x = f.x + f.rx * laneOffset;
  const z = f.z + f.rz * laneOffset;
  const h = getDriveHeightAndWaterState(x, z).height;
  veh.root.position.set(x, h + 0.1, z);
  if (carState) {
    carState.angle = Math.atan2(f.tx, f.tz);
    carState.vx = 0;
    carState.vz = 0;
  }
}

export function startRace(veh, carState) {
  race.state = 'countdown';
  race.veh = veh;
  race.countdown = 3.4;
  race.timer = 0;
  race.playerIdx = -GRID_BACK;
  race.rivalDist = -GRID_BACK * DS;
  race.rivalSpeed = 0;
  race.rivalFinish = null;
  race.offCourseTimer = 0;
  race.doneTimer = 0;
  placeOnGrid(veh, carState, 2.3);
  rival.root.visible = true;
  hud.hidden = false;
  showToast(`${RACE_NAME}: één ronde over de kustweg om het eiland. Afsnijden telt niet!`);
}

export function cancelRace(reason) {
  if (race.state === 'idle') return;
  race.state = 'idle';
  race.cooldown = 4;
  rival.root.visible = false;
  hud.hidden = true;
  hideCount();
  if (reason) showToast(reason);
}

export function raceIsBlockingInput() {
  return race.state === 'countdown';
}

function positionRival(dt) {
  const idxF = race.rivalDist / DS + START_IDX;
  const i = Math.floor(idxF);
  const fr = idxF - i;
  const a = pts[wrap(i)];
  const b = pts[wrap(i + 1)];
  const t = tans[wrap(i)];
  const x = a.x + (b.x - a.x) * fr - t.z * -2.3;
  const z = a.z + (b.z - a.z) * fr + t.x * -2.3;
  const u = uOf(i);
  const y = getRingBaseElev(u) + getRingBridgeAtU(u).archY + 0.1;
  const uA = uOf(i + 3);
  const yA = getRingBaseElev(uA) + getRingBridgeAtU(uA).archY + 0.1;
  setAlignedTransform(rival.root, x, y, z, Math.atan2(t.x, t.z), -Math.atan2(yA - y, 3 * DS));
  rival.wheels.forEach((w) => { w.rotation.x += (race.rivalSpeed * dt) / 0.42; });
}

// Wordt elke frame aangeroepen na de rijfysica
export function updateRace(dt, playerVeh, carState) {
  if (race.cooldown > 0) race.cooldown -= dt;
  if (race.shortcutWarn > 0) race.shortcutWarn -= dt;

  // Opnieuw starten: met de raceauto langzaam onder de boog door
  if (race.state === 'idle') {
    if (playerVeh.isRaceCar && race.cooldown <= 0) {
      const f = frameAt(START_IDX);
      const p = playerVeh.root.position;
      const sp = Math.hypot(carState.vx, carState.vz);
      if (Math.hypot(p.x - f.x, p.z - f.z) < 9 && sp < 6) startRace(playerVeh, carState);
    }
    return;
  }

  if (playerVeh !== race.veh) {
    cancelRace(`${RACE_NAME} afgebroken — je bent uitgestapt`);
    return;
  }

  if (race.state === 'countdown') {
    race.countdown -= dt;
    placeOnGrid(playerVeh, carState, 2.3);
    positionRival(dt);
    const n = Math.ceil(race.countdown - 0.4);
    if (n >= 1) showCount(String(n));
    else showCount('GO!', 'go');
    if (race.countdown <= 0.4) {
      race.state = 'racing';
      carState.throttleHold = Math.max(carState.throttleHold, 0.3);
    }
    hud.textContent = `${RACE_NAME} · klaar voor de start`;
    return;
  }

  if (race.state === 'racing' || race.state === 'done') {
    if (race.countdown > -1.2) {
      race.countdown -= dt;
      if (race.countdown <= -0.6) hideCount();
    }
  }

  // ---- Rivaal rijdt ----
  const rivalIdx = Math.floor(race.rivalDist / DS) + START_IDX;
  if (race.rivalFinish === null || race.state === 'racing') {
    const gap = race.rivalDist - race.playerIdx * DS; // + = rivaal voor
    const band = THREE.MathUtils.clamp(1 - gap / 600, 0.88, 1.12);
    const target = race.rivalFinish !== null ? 14 : speedProfile[wrap(rivalIdx + 4)] * band;
    const acc = race.rivalSpeed < target ? 15 : -RIVAL_DECEL;
    race.rivalSpeed = race.rivalSpeed < target ? Math.min(target, race.rivalSpeed + acc * dt) : Math.max(target, race.rivalSpeed + acc * dt);
    race.rivalDist += race.rivalSpeed * dt;
    if (race.rivalFinish === null && race.rivalDist >= L) race.rivalFinish = race.timer;
    positionRival(dt);

    // Botsing speler-rivaal
    const dx = playerVeh.root.position.x - rival.root.position.x;
    const dz = playerVeh.root.position.z - rival.root.position.z;
    const d = Math.hypot(dx, dz);
    const minD = playerVeh.radius + rival.radius;
    if (d < minD && d > 0.001) {
      const push = minD - d;
      playerVeh.root.position.x += (dx / d) * push;
      playerVeh.root.position.z += (dz / d) * push;
      carState.vx *= 0.85;
      carState.vz *= 0.85;
      race.rivalSpeed *= 0.97;
    }
  }

  if (race.state === 'done') {
    race.doneTimer -= dt;
    if (race.doneTimer <= 0) cancelRace(null);
    return;
  }

  // ---- Voortgang speler ----
  race.timer += dt;
  const p = playerVeh.root.position;
  const cur = wrap(race.playerIdx + START_IDX);
  const win = Math.round(30 / DS);
  const local = nearestIdx(p.x, p.z, cur - win, win * 2);
  let accepted = null;
  if (local.dist < 22) {
    accepted = local.idx;
  } else {
    const glob = nearestIdx(p.x, p.z);
    if (glob.dist < 14) {
      let delta = wrap(glob.idx - cur);
      if (delta > N / 2) delta -= N;
      if (delta <= Math.round(60 / DS)) accepted = glob.idx;
      else if (race.shortcutWarn <= 0) {
        race.shortcutWarn = 5;
        showToast('Afsnijden telt niet! Rij terug naar waar je de kustweg verliet');
      }
    }
  }
  if (accepted !== null) {
    let delta = wrap(accepted - cur);
    if (delta > N / 2) delta -= N;
    race.playerIdx += delta;
    race.offCourseTimer = 0;
  } else {
    race.offCourseTimer += dt;
    if (race.offCourseTimer > 6 && race.shortcutWarn <= 0) {
      race.shortcutWarn = 6;
      showToast('Terug naar de kustweg! (R zet je terug op de weg)');
    }
  }

  const progress = THREE.MathUtils.clamp(race.playerIdx / N, 0, 1);
  const ahead = race.playerIdx * DS >= race.rivalDist || (race.rivalFinish === null && race.playerIdx >= N);
  const pos = race.rivalFinish !== null ? 2 : ahead ? 1 : 2;
  hud.innerHTML = `<b>${RACE_NAME}</b><span>${fmt(race.timer)}</span><span class="pos p${pos}">P${pos}/2</span><span>${Math.round(progress * 100)}%</span>`;

  if (race.playerIdx >= N) {
    const won = race.rivalFinish === null;
    let record = '';
    if (bestTime === null || race.timer < bestTime) {
      bestTime = race.timer;
      record = ' · NIEUW RECORD!';
      try { localStorage.setItem('pinewood-race-best', String(bestTime)); } catch (e) { /* niet opslaan */ }
    }
    showCount(won ? 'GEWONNEN!' : 'VERLOREN', won ? 'go' : 'lost');
    race.countdown = 2.5;
    hud.innerHTML = `<b>${won ? '🏆 Gewonnen' : 'Tweede'}</b><span>${fmt(race.timer)}</span><span>Beste ${fmt(bestTime)}${record}</span>`;
    showToast(won
      ? `Gewonnen in ${fmt(race.timer)}${record}`
      : `De rivaal was ${fmt(race.timer - race.rivalFinish)} sneller${record}. Stop onder de boog voor een revanche`);
    race.state = 'done';
    race.doneTimer = 6;
  }
}

// Laat de countdown na afloop netjes verdwijnen
export function updateRaceBanner(dt) {
  if (race.state === 'done' && race.countdown > 0) {
    race.countdown -= dt;
    if (race.countdown <= 0) hideCount();
  }
}

export function getRaceStartInfo() {
  const f = frameAt(START_IDX);
  return { x: f.x, z: f.z };
}

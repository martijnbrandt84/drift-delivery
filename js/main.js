import * as THREE from 'three';
import { sound } from './audio.js';
import {
  starsRowEl, scoreEl, vehicleBadgeEl, gearBadgeEl, speedValEl, rpmBarEl, hijackPromptEl, bustedBannerEl,
  nightBtnEl, driftBtnEl, soundBtnEl, weatherBtnEl, xmasBtnEl, policeBtnEl, clearBtnEl, resetBtnEl
} from './dom.js';
import { scene, camera, renderer, setAlignedTransform, playerHeadlight, sunLight, nightSkyGroup } from './scene-setup.js';
import { WORLD_LIMIT, TOWN_ELEV, WATER_LEVEL, findNearestRoadAnywhere } from './roads.js';
import { getTerrainHeight, waterMesh, updateWaterWaves } from './terrain.js';
import { getDriveHeightAndWaterState } from './drive-surface.js';
import { ruralLots } from './water-lots.js';
import { hardColliders, destructibles } from './demolition.js';
import { dropTireMark, spawnParticle, particlePool, PARTICLE_POOL_SIZE, updateFireflies, updateFallingLeaves } from './effects.js';
import {
  buildWoodyWagonMesh, buildYellowTaxiMesh, buildPickupTruckMesh, buildPoliceCruiserMesh,
  beamConeGeo, trafficVehicles, parkedCars, policePool
} from './vehicles.js';
import { chimneySmokes, giantStarMesh, houseWindows } from './town.js';
import { turkeys, deerList, foxes, ducks } from './wildlife.js';
import { lighthouseBeamPivot, lighthouseBeamMat } from './scenery.js';
import { updateMinimap } from './minimap.js';
import {
  isNightMode, weatherIndex, isChristmasMode, driftModeIdx, DRIFT_MODES, weatherSystem, WEATHER_COUNT,
  showToast, toggleNightMode, toggleWeather, toggleChristmasLandscape, cycleDriftMode
} from './ui-controls.js';

// Side-effect only modules: bouwen de scene op bij import (wegen/bruggen, stadje, bomen/struiken/rotsen, boerderij).
import './road-meshes.js';
import './props.js';
import './farm.js';

// =========================================================
// OPRUIMING VAN WILDE BOSBOMEN, STRUIKEN & ROTSEN OP BEBOUWDE ZONES
// =========================================================
function isInClearedDevelopmentZone(x, z) {
  if (x >= -45.5 && x <= 45.5 && z >= 82.0 && z <= 137.5) return true;

  const storeLot = ruralLots.find((l) => l.type === 'store');
  if (storeLot) {
    const dx = x - storeLot.x;
    const dz = z - storeLot.z;
    const c = Math.cos(storeLot.yaw);
    const s = Math.sin(storeLot.yaw);
    const lx = dx * c - dz * s;
    const lz = dx * s + dz * c;
    if (lx >= -21.0 && lx <= 21.0 && lz >= -15.0 && lz <= 20.0) return true;
  }

  const farmLot = ruralLots.find((l) => l.type === 'farm');
  if (farmLot) {
    const dx = x - farmLot.x;
    const dz = z - farmLot.z;
    const c = Math.cos(farmLot.yaw);
    const s = Math.sin(farmLot.yaw);
    const lx = dx * c - dz * s;
    const lz = dx * s + dz * c;
    if (lx >= -32.0 && lx <= 32.0 && lz >= -33.0 && lz <= 34.0) return true;
  }

  return false;
}

function purgeObstructingWildProps() {
  for (let i = destructibles.length - 1; i >= 0; i--) {
    const d = destructibles[i];
    if ((d.kind === 'tree' || d.kind === 'shrub') && isInClearedDevelopmentZone(d.x, d.z)) {
      if (d.mesh && d.mesh.parent) d.mesh.parent.remove(d.mesh);
      destructibles.splice(i, 1);
    }
  }

  const storeLot = ruralLots.find((l) => l.type === 'store');
  const farmLot = ruralLots.find((l) => l.type === 'farm');

  function isOnParkingOrCornField(x, z) {
    if (storeLot) {
      const dx = x - storeLot.x;
      const dz = z - storeLot.z;
      const c = Math.cos(storeLot.yaw);
      const s = Math.sin(storeLot.yaw);
      const lx = dx * c - dz * s;
      const lz = dx * s + dz * c;
      if (Math.abs(lx) < 18.0 && lz > 0.5 && lz < 18.0) return true;
    }
    if (farmLot) {
      const dx = x - farmLot.x;
      const dz = z - farmLot.z;
      const c = Math.cos(farmLot.yaw);
      const s = Math.sin(farmLot.yaw);
      const lx = dx * c - dz * s;
      const lz = dx * s + dz * c;
      if ((lz > 2.5 && lz < 32.0 && Math.abs(lx) < 30.0) || (lz < -15.5 && lz > -31.5 && Math.abs(lx) < 25.0)) {
        return true;
      }
    }
    return false;
  }

  for (let i = hardColliders.length - 1; i >= 0; i--) {
    const col = hardColliders[i];
    if (col.r !== 0.95 && isOnParkingOrCornField(col.x, col.z)) {
      for (let cIdx = scene.children.length - 1; cIdx >= 0; cIdx--) {
        const obj = scene.children[cIdx];
        if (Math.hypot(obj.position.x - col.x, obj.position.z - col.z) < 0.35) {
          scene.remove(obj);
          break;
        }
      }
      hardColliders.splice(i, 1);
    }
  }
}
purgeObstructingWildProps();

// =========================================================
// WANTED-STERREN, POLITIE-AI, HIJACKING & SLOOP-IMPACTS
// =========================================================
let playerVeh = buildWoodyWagonMesh();
scene.add(playerVeh.root);

let wantedHeat = 0;
let wantedStars = 0;
let bustedTimer = 0;
let chaosScore = 0;
let escapeCooldown = 0;

function updateWantedHUD(flashPhase = false) {
  wantedStars = Math.min(5, Math.floor(wantedHeat / 95));
  let html = '';
  for (let i = 1; i <= 5; i++) {
    html += `<span class="${i <= wantedStars ? (flashPhase ? 'star-flash' : 'star-on') : 'star-off'}">★</span>`;
  }
  starsRowEl.innerHTML = html;
  scoreEl.textContent = `${Math.floor(chaosScore)} PTS`;
}

function spawnPoliceUnitNearPlayer(unit) {
  const spawnAngle = Math.random() * Math.PI * 2;
  const testX = playerVeh.root.position.x + Math.cos(spawnAngle) * 68;
  const testZ = playerVeh.root.position.z + Math.sin(spawnAngle) * 68;
  const rs = findNearestRoadAnywhere(testX, testZ);

  const sx = rs.x;
  const sz = rs.z;
  const sy = getDriveHeightAndWaterState(sx, sz).height;

  unit.veh.root.position.set(sx, sy, sz);
  unit.angle = Math.atan2(playerVeh.root.position.x - sx, playerVeh.root.position.z - sz);
  unit.vx = 0;
  unit.vz = 0;
  unit.active = true;
  unit.veh.root.visible = true;
}

function syncPoliceUnitsWithStars() {
  const desiredCops = wantedStars === 0 ? 0 : Math.min(policePool.length, Math.ceil(wantedStars * 0.85));
  let activeCount = policePool.filter((c) => c.active).length;

  if (desiredCops === 0) {
    policePool.forEach((c) => {
      c.active = false;
      c.veh.root.visible = false;
      c.veh.sirenLight.intensity = 0;
    });
    return;
  }

  for (const unit of policePool) {
    if (activeCount < desiredCops && !unit.active) {
      spawnPoliceUnitNearPlayer(unit);
      activeCount++;
    }
  }
}

function addCrimeHeat(amount, reasonText) {
  const prevStars = wantedStars;
  wantedHeat = Math.min(500, wantedHeat + amount);
  chaosScore += amount * 4;
  escapeCooldown = 7.0;
  updateWantedHUD();
  syncPoliceUnitsWithStars();

  if (wantedStars > prevStars) showToast(`WANTED ★${wantedStars} — ${reasonText}`);
  else if (amount >= 15) showToast(`${reasonText} (+${amount * 4} PTS)`);
}

function clearWantedStars() {
  sound.init();
  wantedHeat = 0;
  wantedStars = 0;
  syncPoliceUnitsWithStars();
  updateWantedHUD();
  showToast('Wanted-sterren gewist — Sheriff trekt zich terug');
}

function findHijackCandidate() {
  const px = playerVeh.root.position.x;
  const pz = playerVeh.root.position.z;
  let best = null;
  let bestDist = 9.5;

  trafficVehicles.forEach((tv, index) => {
    const d = Math.hypot(px - tv.veh.root.position.x, pz - tv.veh.root.position.z);
    if (d < bestDist) {
      bestDist = d;
      best = { source: 'traffic', index, veh: tv.veh, yaw: tv.veh.root.rotation.y };
    }
  });

  policePool.forEach((cop, index) => {
    if (!cop.active) return;
    const d = Math.hypot(px - cop.veh.root.position.x, pz - cop.veh.root.position.z);
    if (d < bestDist) {
      bestDist = d;
      best = { source: 'police', index, veh: cop.veh, yaw: cop.angle };
    }
  });

  parkedCars.forEach((pVeh, index) => {
    const d = Math.hypot(px - pVeh.root.position.x, pz - pVeh.root.position.z);
    if (d < bestDist) {
      bestDist = d;
      best = { source: 'parked', index, veh: pVeh, yaw: pVeh.root.rotation.y };
    }
  });

  return best;
}

function tryHijackNearbyVehicle() {
  sound.init();
  const target = findHijackCandidate();
  if (!target) {
    showToast('Rijd eerst vlak naast een andere auto om over te stappen');
    return;
  }

  const oldVeh = playerVeh;
  oldVeh.body.rotation.set(0, 0, 0);
  oldVeh.frontPivots.forEach((p) => { p.rotation.y = 0; });
  if (oldVeh.sirenLight) oldVeh.sirenLight.intensity = 0;
  parkedCars.push(oldVeh);

  if (target.source === 'traffic') {
    const tvSlot = trafficVehicles[target.index];
    playerVeh = tvSlot.veh;
    const replacement = Math.random() < 0.5 ? buildYellowTaxiMesh() : buildPickupTruckMesh(0x5b83a1, 'Lake Pickup');
    replacement.body.traverse((ch) => { if (ch.geometry === beamConeGeo) ch.visible = isNightMode; });
    scene.add(replacement.root);
    tvSlot.veh = replacement;
    tvSlot.u = (tvSlot.u + 0.45) % 1;
    addCrimeHeat(85, `${playerVeh.name} overgenomen`);
  } else if (target.source === 'police') {
    const copSlot = policePool[target.index];
    playerVeh = copSlot.veh;
    playerVeh.playerSirenOn = true;
    const freshCop = buildPoliceCruiserMesh();
    freshCop.body.traverse((ch) => { if (ch.geometry === beamConeGeo) ch.visible = isNightMode; });
    freshCop.root.visible = false;
    scene.add(freshCop.root);
    copSlot.veh = freshCop;
    copSlot.active = false;
    addCrimeHeat(135, 'Sheriff Interceptor gestolen');
  } else if (target.source === 'parked') {
    parkedCars.splice(target.index, 1);
    playerVeh = target.veh;
    if (playerVeh.isPoliceModel) {
      playerVeh.playerSirenOn = true;
      addCrimeHeat(95, 'Sheriff Cruiser meegenomen');
    } else {
      showToast(`Ingestapt in ${playerVeh.name}`);
    }
  }

  sound.playImpact('small');
  carState.angle = target.yaw;
  carState.throttleHold = 0.35;
  carState.vx = Math.sin(target.yaw) * 10.0;
  carState.vz = Math.cos(target.yaw) * 10.0;
  vehicleBadgeEl.textContent = playerVeh.name;
}

const honkRings = [];
function triggerHornOrSiren() {
  sound.init();
  if (playerVeh.isPoliceModel) {
    playerVeh.playerSirenOn = !playerVeh.playerSirenOn;
    showToast(playerVeh.playerSirenOn ? 'Sirene & Zwaailichten AAN' : 'Sirene UIT');
  } else {
    sound.playHorn();
  }
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.6, 0.95, 20),
    new THREE.MeshBasicMaterial({ color: 0xffd23f, side: THREE.DoubleSide, transparent: true, opacity: 0.95 })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.copy(playerVeh.root.position).add(new THREE.Vector3(0, 2.4, 0));
  scene.add(ring);
  honkRings.push({ mesh: ring, age: 0 });
}

function handleDestructibleImpacts(moverX, moverZ, moverRadius, velX, velZ, vehicleMass = 1.0, isPlayer = false) {
  const speed = Math.hypot(velX, velZ);
  const maxCheckSq = (moverRadius + 2.2) ** 2;

  for (let i = 0; i < destructibles.length; i++) {
    const d = destructibles[i];
    if (!d.intact) continue;

    const dx = moverX - d.x;
    const dz = moverZ - d.z;
    const dSq = dx * dx + dz * dz;
    if (dSq > maxCheckSq) continue;

    const dist = Math.sqrt(dSq);
    if (dist >= moverRadius + d.r) continue;

    if (d.kind === 'shrub') {
      if (speed > 0.6) {
        d.intact = false;
        d.activeAnim = false;
        d.respawnTimer = 28.0;
        d.mesh.scale.set(d.origScale.x * 1.32, d.origScale.y * 0.15, d.origScale.z * 1.32);
        for (let k = 0; k < 3; k++) spawnParticle(new THREE.Vector3(d.x, d.y + 0.4, d.z), 'leaf', 0.9);
        if (isPlayer) {
          chaosScore += 12;
          sound.playImpact('shrub');
        }
      }
      continue;
    }

    if (d.kind === 'tree') {
      if (speed > 3.2) {
        d.intact = false;
        d.activeAnim = true;
        d.respawnTimer = 32.0;

        const pushX = speed > 1 ? velX : (d.x - moverX);
        const pushZ = speed > 1 ? velZ : (d.z - moverZ);
        const pLen = Math.hypot(pushX, pushZ) || 1;
        d.fallAxis.set(pushZ / pLen, 0, -pushX / pLen).normalize();
        d.fallAngle = 0.06;
        d.fallVel = Math.min(4.2, 1.4 + speed * 0.08);

        for (let k = 0; k < 4; k++) spawnParticle(new THREE.Vector3(d.x, d.y + 1.2, d.z), 'chip', 1.1);

        if (isPlayer) {
          sound.playImpact('tree');
          addCrimeHeat(d.crimePts, `${d.label} omgelegd`);
          const slowFactor = THREE.MathUtils.clamp(1 - 0.11 / vehicleMass, 0.85, 0.97);
          carState.vx *= slowFactor;
          carState.vz *= slowFactor;
        }
      } else if (isPlayer && dist > 0.001) {
        const push = moverRadius + d.r - dist;
        playerVeh.root.position.x += (dx / dist) * push;
        playerVeh.root.position.z += (dz / dist) * push;
      }
      continue;
    }

    if (d.kind === 'small') {
      if (speed > 2.0) {
        d.intact = false;
        d.activeAnim = true;
        d.respawnTimer = 25.0;

        const launchSpeed = Math.max(11.5, speed * 1.30);
        const dirLen = Math.hypot(velX, velZ) || 1;
        d.vx = (velX / dirLen) * launchSpeed + (Math.random() - 0.5) * 5.0;
        d.vz = (velZ / dirLen) * launchSpeed + (Math.random() - 0.5) * 5.0;
        d.vy = 6.2 + Math.min(9.0, speed * 0.30);
        d.spinX = (Math.random() - 0.5) * 11.0 + 5.0;
        d.spinZ = (Math.random() - 0.5) * 11.0;

        for (let k = 0; k < 3; k++) spawnParticle(new THREE.Vector3(d.x, d.y + 0.8, d.z), 'chip', 0.95);

        if (isPlayer) {
          sound.playImpact('small');
          addCrimeHeat(d.crimePts, d.label);
          carState.vx *= 0.96;
          carState.vz *= 0.96;
        }
      } else if (isPlayer && dist > 0.001) {
        const push = moverRadius + d.r - dist;
        playerVeh.root.position.x += (dx / dist) * push;
        playerVeh.root.position.z += (dz / dist) * push;
      }
    }
  }
}

// =========================================================
// INPUT & SOEPELE 60FPS GAME LOOP
// =========================================================
const keys = { forward: false, backward: false, left: false, right: false, handbrake: false };
const carState = {
  vx: 0,
  vz: 0,
  angle: -Math.PI / 2,
  throttleHold: 0,
  steerVisual: 0,
  puffTimer: 0,
  skidTimer: 0,
  splashTimer: 0
};

function teleportToTown() {
  sound.init();
  playerVeh.root.position.set(32, TOWN_ELEV + 0.10, 78.4);
  carState.angle = -Math.PI / 2;
  carState.vx = 0;
  carState.vz = 0;
  carState.throttleHold = 0;
}

function resetToClosestRoad() {
  sound.init();
  const rs = findNearestRoadAnywhere(playerVeh.root.position.x, playerVeh.root.position.z);
  playerVeh.root.position.set(rs.x + rs.nx * 1.4, rs.y + 0.10, rs.z + rs.nz * 1.4);
  carState.angle = Math.atan2(rs.tx, rs.tz);
  carState.vx = 0;
  carState.vz = 0;
  carState.throttleHold = 0;
}

teleportToTown();
window.addEventListener('pointerdown', () => sound.init(), { once: true });

nightBtnEl.addEventListener('click', toggleNightMode);
driftBtnEl.addEventListener('click', cycleDriftMode);
soundBtnEl.addEventListener('click', () => {
  const active = sound.toggleMute();
  soundBtnEl.classList.toggle('active-mode', active);
  soundBtnEl.innerHTML = `<span>Geluid: ${active ? 'AAN' : 'UIT'}</span><span class="kbd-hint">M</span>`;
});
weatherBtnEl.addEventListener('click', toggleWeather);
xmasBtnEl.addEventListener('click', toggleChristmasLandscape);
policeBtnEl.addEventListener('click', () => {
  sound.init();
  addCrimeHeat(105, 'Sheriff opgeroepen');
});
clearBtnEl.addEventListener('click', clearWantedStars);
resetBtnEl.addEventListener('click', resetToClosestRoad);

window.addEventListener('keydown', (e) => {
  sound.init();
  switch (e.code) {
    case 'KeyW':
    case 'ArrowUp': keys.forward = true; break;
    case 'KeyS':
    case 'ArrowDown': keys.backward = true; break;
    case 'KeyA':
    case 'ArrowLeft': keys.left = true; break;
    case 'KeyD':
    case 'ArrowRight': keys.right = true; break;
    case 'Space': keys.handbrake = true; break;
    case 'KeyF': tryHijackNearbyVehicle(); break;
    case 'KeyN': toggleNightMode(); break;
    case 'KeyV': cycleDriftMode(); break;
    case 'KeyM': soundBtnEl.click(); break;
    case 'KeyR': resetToClosestRoad(); break;
    case 'KeyT': teleportToTown(); break;
    case 'KeyC': toggleWeather(); break;
    case 'KeyX': toggleChristmasLandscape(); break;
    case 'KeyH': triggerHornOrSiren(); break;
    case 'KeyP': addCrimeHeat(105, 'Sheriff opgeroepen'); break;
    case 'KeyO': clearWantedStars(); break;
  }
});

window.addEventListener('keyup', (e) => {
  switch (e.code) {
    case 'KeyW':
    case 'ArrowUp': keys.forward = false; break;
    case 'KeyS':
    case 'ArrowDown': keys.backward = false; break;
    case 'KeyA':
    case 'ArrowLeft': keys.left = false; break;
    case 'KeyD':
    case 'ArrowRight': keys.right = false; break;
    case 'Space': keys.handbrake = false; break;
  }
});

const clock = new THREE.Clock();
const camOffset = new THREE.Vector3(0, 11.8, -20.5);
const currentCamPos = playerVeh.root.position.clone().add(
  camOffset.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), carState.angle)
);
const currentLookAt = playerVeh.root.position.clone();
const tempQuat = new THREE.Quaternion();
const tempVec = new THREE.Vector3();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.045);
  const elapsed = clock.getElapsedTime();

  // --- 1. Progressief Gaspedaal & Drift-Fysica ---
  const vStats = playerVeh.stats;
  const dMode = DRIFT_MODES[driftModeIdx];
  const curY = playerVeh.root.position.y;
  const surfNow = getDriveHeightAndWaterState(playerVeh.root.position.x, playerVeh.root.position.z, curY);

  const forwardX = Math.sin(carState.angle);
  const forwardZ = Math.cos(carState.angle);
  const rightX = Math.cos(carState.angle);
  const rightZ = -Math.sin(carState.angle);

  let fwdSpeed = carState.vx * forwardX + carState.vz * forwardZ;
  let sideSpeed = carState.vx * rightX + carState.vz * rightZ;

  if (keys.forward) {
    carState.throttleHold = Math.min(1.0, carState.throttleHold + 0.44 * dt);
  } else {
    carState.throttleHold = Math.max(0.0, carState.throttleHold - 1.35 * dt);
  }

  const powerCurve = carState.throttleHold * carState.throttleHold;
  const waterSlow = surfNow.inDeepWater ? 0.32 : surfNow.inShallowWater ? 0.62 : 1.0;
  const waterAccelSlow = surfNow.inDeepWater ? 0.4 : surfNow.inShallowWater ? 0.72 : 1.0;
  const currentTopSpeed = THREE.MathUtils.lerp(vStats.baseSpeed, vStats.maxSpeed, powerCurve) * waterSlow;
  const currentAccel = THREE.MathUtils.lerp(vStats.baseAccel, vStats.peakAccel, carState.throttleHold) * waterAccelSlow;

  if (keys.forward) fwdSpeed += currentAccel * dt;
  else if (keys.backward) fwdSpeed -= vStats.baseAccel * 0.85 * dt;
  else fwdSpeed *= Math.max(0, 1 - 1.35 * dt);

  if (keys.handbrake) fwdSpeed *= Math.max(0, 1 - 1.75 * dt);
  if (surfNow.inShallowWater) fwdSpeed *= Math.max(0, 1 - 1.65 * dt);
  if (surfNow.inDeepWater) fwdSpeed *= Math.max(0, 1 - 3.4 * dt);

  fwdSpeed = THREE.MathUtils.clamp(fwdSpeed, -16, currentTopSpeed);

  const steerInput = (keys.left ? 1 : 0) - (keys.right ? 1 : 0);
  carState.steerVisual = THREE.MathUtils.lerp(carState.steerVisual, steerInput * 0.52, 12 * dt);
  playerVeh.frontPivots.forEach((p) => { p.rotation.y = carState.steerVisual; });

  const totalSpeed = Math.hypot(fwdSpeed, sideSpeed);
  speedValEl.textContent = Math.round(totalSpeed * 3.4);

  if (totalSpeed > 0.4) {
    const dirSign = fwdSpeed >= -0.3 ? 1 : -1;
    const speedFactor = Math.min(1, totalSpeed / 6.5);
    const hbMult = keys.handbrake ? 1.36 : 1.0;
    const highSpeedStab = THREE.MathUtils.lerp(1.0, 0.78, Math.min(1, totalSpeed / 58));
    carState.angle += steerInput * vStats.turnRate * dMode.turnBoost * hbMult * highSpeedStab * speedFactor * dirSign * dt;
  }

  let latGrip = dMode.lateralGrip * vStats.driftGripMod;
  if (isChristmasMode || weatherIndex === 2) latGrip *= 0.68;
  else if (weatherIndex === 1) latGrip *= 0.82;
  else if (!surfNow.onAsphalt) latGrip *= 0.78;
  if (keys.handbrake) latGrip = dMode.handbrakeGrip * vStats.driftGripMod;

  sideSpeed *= Math.max(0, 1 - latGrip * dt);

  if (keys.forward && Math.abs(steerInput) > 0 && totalSpeed > 14 && driftModeIdx > 0) {
    sideSpeed -= steerInput * (driftModeIdx === 2 ? 8.2 : 4.2) * (0.5 + carState.throttleHold * 0.5) * dt;
  }

  const newFx = Math.sin(carState.angle);
  const newFz = Math.cos(carState.angle);
  const newRx = Math.cos(carState.angle);
  const newRz = -Math.sin(carState.angle);

  carState.vx = newFx * fwdSpeed + newRx * sideSpeed;
  carState.vz = newFz * fwdSpeed + newRz * sideSpeed;

  let nextX = THREE.MathUtils.clamp(playerVeh.root.position.x + carState.vx * dt, -WORLD_LIMIT, WORLD_LIMIT);
  let nextZ = THREE.MathUtils.clamp(playerVeh.root.position.z + carState.vz * dt, -WORLD_LIMIT, WORLD_LIMIT);

  handleDestructibleImpacts(nextX, nextZ, playerVeh.radius, carState.vx, carState.vz, vStats.mass, true);

  for (let i = 0; i < hardColliders.length; i++) {
    const col = hardColliders[i];
    const dx = nextX - col.x;
    const dz = nextZ - col.z;
    const minDist = playerVeh.radius + col.r;
    if (dx * dx + dz * dz < minDist * minDist) {
      const dist = Math.hypot(dx, dz) || 0.001;
      const push = minDist - dist;
      nextX += (dx / dist) * push;
      nextZ += (dz / dist) * push;
      if (totalSpeed > 6) sound.playImpact('small');
      carState.vx *= 0.55;
      carState.vz *= 0.55;
    }
  }

  for (const pCar of parkedCars) {
    const dx = nextX - pCar.root.position.x;
    const dz = nextZ - pCar.root.position.z;
    const dist = Math.hypot(dx, dz);
    const minDist = playerVeh.radius + pCar.radius;
    if (dist < minDist && dist > 0.001) {
      const push = minDist - dist;
      nextX += (dx / dist) * push * 0.5;
      nextZ += (dz / dist) * push * 0.5;
      pCar.root.position.x -= (dx / dist) * push * 0.5;
      pCar.root.position.z -= (dz / dist) * push * 0.5;
      pCar.root.position.y = getDriveHeightAndWaterState(pCar.root.position.x, pCar.root.position.z, pCar.root.position.y).height;
    }
  }

  const nextSurf = getDriveHeightAndWaterState(nextX, nextZ, curY);
  if (nextSurf.inDeepWater && nextSurf.waterDepth > 3.2) {
    carState.vx *= -0.35;
    carState.vz *= -0.35;
    nextX = playerVeh.root.position.x;
    nextZ = playerVeh.root.position.z;
  }

  const finalSurface = getDriveHeightAndWaterState(nextX, nextZ, curY);
  const aheadSurface = getDriveHeightAndWaterState(nextX + newFx * 2.2, nextZ + newFz * 2.2);
  const slopePitch = -Math.atan2(aheadSurface.height - finalSurface.height, 2.2);

  setAlignedTransform(playerVeh.root, nextX, finalSurface.height, nextZ, carState.angle, slopePitch);

  if (isNightMode) {
    playerHeadlight.position.set(nextX + newFx * 1.6, finalSurface.height + 1.15, nextZ + newFz * 1.6);
    playerHeadlight.target.position.set(nextX + newFx * 24, aheadSurface.height - 0.5, nextZ + newFz * 24);
  }
  sunLight.position.set(nextX + 55, finalSurface.height + 78, nextZ + 42);
  sunLight.target.position.set(nextX, finalSurface.height, nextZ);

  const isDrifting = !finalSurface.inShallowWater && totalSpeed > 6.5 && (Math.abs(sideSpeed) > 2.6 || (keys.handbrake && totalSpeed > 7.0));
  const driftRoll = THREE.MathUtils.clamp(-sideSpeed * 0.017 - steerInput * 0.07, -0.22, 0.22);
  const accelPitch = keys.forward ? -0.02 - carState.throttleHold * 0.035 : keys.handbrake ? 0.045 : 0;

  playerVeh.body.rotation.z = THREE.MathUtils.lerp(playerVeh.body.rotation.z, driftRoll, 9 * dt);
  playerVeh.body.rotation.x = THREE.MathUtils.lerp(playerVeh.body.rotation.x, accelPitch, 10 * dt);
  playerVeh.wheels.forEach((w) => { w.rotation.x += (fwdSpeed * dt) / 0.46; });

  if (playerVeh.isPoliceModel) {
    if (playerVeh.playerSirenOn) {
      const fRed = Math.floor(elapsed * 9.5) % 2 === 0;
      playerVeh.redBar.scale.setScalar(fRed ? 1.25 : 0.9);
      playerVeh.blueBar.scale.setScalar(!fRed ? 1.25 : 0.9);
      playerVeh.sirenLight.color.setHex(fRed ? 0xff2222 : 0x2288ff);
      playerVeh.sirenLight.intensity = isNightMode ? 4.5 : 2.8;
    } else {
      playerVeh.sirenLight.intensity = 0;
    }
  }

  if (isDrifting) {
    chaosScore += (Math.abs(sideSpeed) + 2) * dt * 4.0;
    carState.skidTimer += dt;
    if (carState.skidTimer > 0.024) {
      carState.skidTimer = 0;
      const travelHeading = Math.atan2(carState.vx, carState.vz);

      [-playerVeh.trackHalfW, playerVeh.trackHalfW].forEach((wheelX) => {
        tempVec.set(wheelX, 0, playerVeh.rearAxleZ).applyAxisAngle(new THREE.Vector3(0, 1, 0), carState.angle).add(playerVeh.root.position);
        const wH = getDriveHeightAndWaterState(tempVec.x, tempVec.z, tempVec.y).height;
        dropTireMark(tempVec.x, wH, tempVec.z, travelHeading, slopePitch);
        if (Math.random() < 0.45) {
          spawnParticle(tempVec.setY(wH + 0.25), 'drift', 0.95);
        }
      });
    }
  }

  if (finalSurface.inShallowWater && totalSpeed > 1.8) {
    carState.splashTimer += dt * totalSpeed * 1.4;
    if (carState.splashTimer > 0.18) {
      carState.splashTimer = 0;
      sound.playImpact('splash');
      [-playerVeh.trackHalfW, playerVeh.trackHalfW].forEach((sideX) => {
        tempVec.set(sideX, WATER_LEVEL - finalSurface.height + 0.15, 0.5).applyAxisAngle(new THREE.Vector3(0, 1, 0), carState.angle).add(playerVeh.root.position);
        spawnParticle(tempVec, 'splash', 1.0);
      });
    }
  }

  const hijackCand = findHijackCandidate();
  if (hijackCand) {
    hijackPromptEl.textContent = `[F] Stap over in ${hijackCand.veh.name}`;
    hijackPromptEl.classList.add('visible');
  } else {
    hijackPromptEl.classList.remove('visible');
  }

  // --- 2. Dieren AI: Wilde Kalkoenen, Herten & Vossen ---
  const px = playerVeh.root.position.x;
  const pz = playerVeh.root.position.z;

  for (let i = 0; i < turkeys.length; i++) {
    const tk = turkeys[i];
    const distSq = (tk.root.position.x - px) ** 2 + (tk.root.position.z - pz) ** 2;
    if (distSq > 165 * 165) continue;

    if (distSq < 15 * 15) {
      if (tk.panicked <= 0) sound.playTurkeyGobble();
      tk.panicked = 1.8;
      tk.angle = Math.atan2(tk.root.position.x - px, tk.root.position.z - pz);
    }

    if (tk.panicked > 0) {
      tk.panicked -= dt;
      const runSpd = 6.2;
      const nx = tk.root.position.x + Math.sin(tk.angle) * runSpd * dt;
      const nz = tk.root.position.z + Math.cos(tk.angle) * runSpd * dt;
      const ny = getTerrainHeight(nx, nz);
      if (ny > 0.5) tk.root.position.set(nx, ny, nz);
      tk.root.rotation.y = tk.angle;

      tk.bodyGrp.position.y = Math.abs(Math.sin(elapsed * 18 + tk.phase)) * 0.35;
      const flap = Math.sin(elapsed * 28 + tk.phase) * 0.7;
      tk.leftWing.rotation.z = flap;
      tk.rightWing.rotation.z = -flap;
    } else {
      tk.timer -= dt;
      if (tk.timer <= 0) {
        tk.timer = 1.5 + Math.random() * 2.5;
        const dHome = Math.hypot(tk.homeX - tk.root.position.x, tk.homeZ - tk.root.position.z);
        tk.angle = dHome > 11 ? Math.atan2(tk.homeX - tk.root.position.x, tk.homeZ - tk.root.position.z) : tk.angle + (Math.random() - 0.5) * 2.4;
      }
      const nx = tk.root.position.x + Math.sin(tk.angle) * 1.15 * dt;
      const nz = tk.root.position.z + Math.cos(tk.angle) * 1.15 * dt;
      const ny = getTerrainHeight(nx, nz);
      if (ny > 0.5) tk.root.position.set(nx, ny, nz);
      tk.root.rotation.y = tk.angle;

      tk.bodyGrp.position.y = Math.abs(Math.sin(elapsed * 8 + tk.phase)) * 0.06;
      tk.headPivot.rotation.x = Math.max(0, Math.sin(elapsed * 5 + tk.phase)) * 0.55;
      tk.leftWing.rotation.z = 0;
      tk.rightWing.rotation.z = 0;
    }
  }

  for (let i = 0; i < deerList.length; i++) {
    const d = deerList[i];
    const distSq = (d.root.position.x - px) ** 2 + (d.root.position.z - pz) ** 2;
    if (distSq > 170 * 170) continue;

    d.timer -= dt;
    if (distSq < 13 * 13) {
      d.walking = true;
      d.angle = Math.atan2(d.root.position.x - px, d.root.position.z - pz);
      d.timer = 2.2;
    } else if (d.timer <= 0) {
      d.walking = !d.walking;
      d.timer = 2.5 + Math.random() * 3.0;
      const dHome = Math.hypot(d.homeX - d.root.position.x, d.homeZ - d.root.position.z);
      if (d.walking) d.angle = dHome > 16 ? Math.atan2(d.homeX - d.root.position.x, d.homeZ - d.root.position.z) : d.angle + (Math.random() - 0.5) * 2.0;
    }

    if (d.walking) {
      const spd = distSq < 13 * 13 ? 5.8 : 1.9;
      const nx = d.root.position.x + Math.sin(d.angle) * spd * dt;
      const nz = d.root.position.z + Math.cos(d.angle) * spd * dt;
      const ny = getTerrainHeight(nx, nz);
      if (ny > 0.6) d.root.position.set(nx, ny, nz);
      d.root.rotation.y = d.angle;
      d.bodyGroup.position.y = Math.abs(Math.sin(elapsed * 8 + d.phase)) * 0.18;
      d.neckPivot.rotation.x = 0;
    } else {
      d.bodyGroup.position.y = 0;
      d.neckPivot.rotation.x = 0.72;
    }
  }

  for (let i = 0; i < foxes.length; i++) {
    const f = foxes[i];
    const distSq = (f.root.position.x - px) ** 2 + (f.root.position.z - pz) ** 2;
    if (distSq > 160 * 160) continue;

    f.timer -= dt;
    if (f.timer <= 0) {
      f.timer = 1.8 + Math.random() * 2.2;
      const dHome = Math.hypot(f.homeX - f.root.position.x, f.homeZ - f.root.position.z);
      f.angle = dHome > 14 ? Math.atan2(f.homeX - f.root.position.x, f.homeZ - f.root.position.z) : f.angle + (Math.random() - 0.5) * 2.4;
    }
    const nx = f.root.position.x + Math.sin(f.angle) * 2.8 * dt;
    const nz = f.root.position.z + Math.cos(f.angle) * 2.8 * dt;
    const ny = getTerrainHeight(nx, nz);
    if (ny > 0.55) f.root.position.set(nx, ny, nz);
    f.root.rotation.y = f.angle;
    f.bodyGroup.position.y = Math.abs(Math.sin(elapsed * 12 + f.phase)) * 0.14;
  }

  for (let i = 0; i < ducks.length; i++) {
    const dk = ducks[i];
    const distSq = (dk.root.position.x - px) ** 2 + (dk.root.position.z - pz) ** 2;
    if (distSq > 170 * 170) continue;

    const ang = dk.phase + elapsed * dk.orbitSpeed;
    const nx = dk.centerX + Math.cos(ang) * dk.orbitR;
    const nz = dk.centerZ + Math.sin(ang) * dk.orbitR;
    dk.root.position.set(nx, WATER_LEVEL + 0.06 + Math.sin(elapsed * 2.2 + dk.bobPhase) * 0.025, nz);
    dk.root.rotation.y = -ang + Math.PI / 2;
    dk.bodyGroup.position.y = Math.abs(Math.sin(elapsed * 6 + dk.bobPhase)) * 0.03;
  }

  // --- 3. Burgerverkeer ---
  trafficVehicles.forEach((tv) => {
    if (tv.hitCooldown > 0) tv.hitCooldown -= dt;

    const distToPlayer = Math.hypot(px - tv.veh.root.position.x, pz - tv.veh.root.position.z);
    const forwardVecX = Math.sin(tv.veh.root.rotation.y);
    const forwardVecZ = Math.cos(tv.veh.root.rotation.y);
    const dotFront = distToPlayer > 0.01 ? ((px - tv.veh.root.position.x) * forwardVecX + (pz - tv.veh.root.position.z) * forwardVecZ) / distToPlayer : 0;

    const shouldYield = distToPlayer < 11.5 && dotFront > 0.45 && wantedStars === 0;
    tv.currentSpeed = THREE.MathUtils.lerp(tv.currentSpeed, shouldYield ? 0 : tv.cruiseSpeed, 6 * dt);

    tv.u += ((tv.currentSpeed * dt) / tv.curveLength) * tv.dir;
    if (tv.isClosed) {
      tv.u = ((tv.u % 1) + 1) % 1;
    } else {
      if (tv.u >= 0.96) { tv.u = 0.96; tv.dir = -1; tv.laneOffset = -Math.abs(tv.laneOffset); }
      else if (tv.u <= 0.04) { tv.u = 0.04; tv.dir = 1; tv.laneOffset = Math.abs(tv.laneOffset); }
    }

    const pt = tv.curve.getPointAt(tv.u);
    const tan = tv.curve.getTangentAt(tv.u);
    const len2D = Math.hypot(tan.x, tan.z) || 1;
    const tx = (tan.x / len2D) * tv.dir;
    const tz = (tan.z / len2D) * tv.dir;
    const rX = -tz;
    const rZ = tx;
    const laneDist = Math.abs(tv.laneOffset);

    const bInf = tv.bridgeFn(tv.u);
    const yPos = tv.elevFn(tv.u) + bInf.archY + 0.10;
    const lookU = THREE.MathUtils.clamp(tv.u + 0.006 * tv.dir, 0, 1);
    const yAhead = tv.elevFn(lookU) + tv.bridgeFn(lookU).archY + 0.10;

    setAlignedTransform(tv.veh.root, pt.x + rX * laneDist, yPos, pt.z + rZ * laneDist, Math.atan2(tx, tz), -Math.atan2(yAhead - yPos, tv.curveLength * 0.006));
    tv.veh.wheels.forEach((w) => { w.rotation.x += (tv.currentSpeed * dt) / 0.46; });

    const dx = px - tv.veh.root.position.x;
    const dz = pz - tv.veh.root.position.z;
    const dist = Math.hypot(dx, dz);
    const minDist = playerVeh.radius + tv.veh.radius;
    if (dist < minDist && dist > 0.001) {
      const push = minDist - dist;
      playerVeh.root.position.x += (dx / dist) * push;
      playerVeh.root.position.z += (dz / dist) * push;
      carState.vx = (dx / dist) * Math.max(9, totalSpeed * 0.55);
      carState.vz = (dz / dist) * Math.max(9, totalSpeed * 0.55);

      if (tv.hitCooldown <= 0 && totalSpeed > 5.0) {
        tv.hitCooldown = 1.6;
        sound.playImpact('small');
        addCrimeHeat(55, `Botsing met ${tv.veh.name}`);
      }
    }
  });

  // --- 4. GTA Politie-Achtervolging AI ---
  let anyCopClose = false;
  let closestCopDist = Infinity;
  const sirenToggle = Math.floor(elapsed * 8.5) % 2 === 0;
  updateWantedHUD(wantedStars > 0 && sirenToggle);

  policePool.forEach((cop, idx) => {
    if (!cop.active) return;

    const flashRed = (Math.floor(elapsed * 9 + idx) % 2) === 0;
    cop.veh.redBar.scale.setScalar(flashRed ? 1.25 : 0.9);
    cop.veh.blueBar.scale.setScalar(!flashRed ? 1.25 : 0.9);
    cop.veh.sirenLight.color.setHex(flashRed ? 0xff2222 : 0x2288ff);
    cop.veh.sirenLight.intensity = isNightMode ? 4.8 : 2.8;

    const leadX = px + carState.vx * 0.30;
    const leadZ = pz + carState.vz * 0.30;
    const toTargetX = leadX - cop.veh.root.position.x;
    const toTargetZ = leadZ - cop.veh.root.position.z;
    const distToPlayer = Math.hypot(px - cop.veh.root.position.x, pz - cop.veh.root.position.z);

    if (distToPlayer < closestCopDist) closestCopDist = distToPlayer;
    if (distToPlayer < 55) anyCopClose = true;
    if (distToPlayer > 165) {
      spawnPoliceUnitNearPlayer(cop);
      return;
    }

    const desiredAngle = Math.atan2(toTargetX, toTargetZ);
    let angDiff = desiredAngle - cop.angle;
    while (angDiff > Math.PI) angDiff -= Math.PI * 2;
    while (angDiff < -Math.PI) angDiff += Math.PI * 2;
    cop.angle += THREE.MathUtils.clamp(angDiff, -3.2 * dt, 3.2 * dt);

    const copMaxSpeed = 37.0 + wantedStars * 3.4;
    const cFx = Math.sin(cop.angle);
    const cFz = Math.cos(cop.angle);
    cop.vx = THREE.MathUtils.lerp(cop.vx, cFx * copMaxSpeed, 3.8 * dt);
    cop.vz = THREE.MathUtils.lerp(cop.vz, cFz * copMaxSpeed, 3.8 * dt);

    let cNextX = cop.veh.root.position.x + cop.vx * dt;
    let cNextZ = cop.veh.root.position.z + cop.vz * dt;

    handleDestructibleImpacts(cNextX, cNextZ, cop.veh.radius, cop.vx, cop.vz, 1.3, false);

    for (let i = 0; i < hardColliders.length; i++) {
      const col = hardColliders[i];
      const dx = cNextX - col.x;
      const dz = cNextZ - col.z;
      const minR = 1.7 + col.r;
      if (dx * dx + dz * dz < minR * minR) {
        const d = Math.hypot(dx, dz) || 0.001;
        cNextX += (dx / d) * (minR - d);
        cNextZ += (dz / d) * (minR - d);
        cop.angle += 0.7 * dt;
      }
    }

    const copCurY = cop.veh.root.position.y;
    const copSurf = getDriveHeightAndWaterState(cNextX, cNextZ, copCurY);
    if (copSurf.inDeepWater) {
      cNextX = cop.veh.root.position.x;
      cNextZ = cop.veh.root.position.z;
      cop.angle += Math.PI * 0.6;
    }

    const finalCopSurf = getDriveHeightAndWaterState(cNextX, cNextZ, copCurY);
    const copAheadSurf = getDriveHeightAndWaterState(cNextX + cFx * 2.0, cNextZ + cFz * 2.0);
    const copPitch = -Math.atan2(copAheadSurf.height - finalCopSurf.height, 2.0);

    setAlignedTransform(cop.veh.root, cNextX, finalCopSurf.height, cNextZ, cop.angle, copPitch);
    cop.veh.wheels.forEach((w) => { w.rotation.x += (Math.hypot(cop.vx, cop.vz) * dt) / 0.46; });

    if (Math.abs(angDiff) > 0.4 && !finalCopSurf.inShallowWater) {
      cop.skidTimer += dt;
      if (cop.skidTimer > 0.045) {
        cop.skidTimer = 0;
        dropTireMark(cNextX, finalCopSurf.height, cNextZ, Math.atan2(cop.vx, cop.vz), copPitch);
      }
    }

    const pDx = px - cNextX;
    const pDz = pz - cNextZ;
    const pDist = Math.hypot(pDx, pDz);
    const minHit = playerVeh.radius + cop.veh.radius;

    if (pDist < minHit && pDist > 0.001) {
      const push = minHit - pDist;
      playerVeh.root.position.x += (pDx / pDist) * push * 0.6;
      playerVeh.root.position.z += (pDz / pDist) * push * 0.6;
      cop.veh.root.position.x -= (pDx / pDist) * push * 0.4;
      cop.veh.root.position.z -= (pDz / pDist) * push * 0.4;

      sound.playImpact('small');
      carState.vx += cop.vx * (0.45 / vStats.mass);
      carState.vz += cop.vz * (0.45 / vStats.mass);
      cop.vx *= -0.35;
      cop.vz *= -0.35;
    }

    if (pDist < 4.8 && totalSpeed < 2.8) {
      bustedTimer += dt;
      if (bustedTimer > 2.0) {
        bustedTimer = 0;
        bustedBannerEl.classList.add('show');
        setTimeout(() => bustedBannerEl.classList.remove('show'), 2600);
        clearWantedStars();
        teleportToTown();
      }
    }
  });

  if (wantedHeat > 0) {
    if (escapeCooldown > 0) escapeCooldown -= dt;
    else if (!anyCopClose) {
      wantedHeat = Math.max(0, wantedHeat - 20 * dt);
      const newStars = Math.min(5, Math.floor(wantedHeat / 95));
      if (newStars < wantedStars) {
        wantedStars = newStars;
        syncPoliceUnitsWithStars();
        if (wantedStars === 0) showToast('Ontsnapt — De Sheriff is je kwijtgeraakt!');
      }
    }
  }
  if (!anyCopClose || totalSpeed >= 2.8) bustedTimer = Math.max(0, bustedTimer - dt * 1.5);

  const playerSirenFactor = playerVeh.isPoliceModel && playerVeh.playerSirenOn ? 0.85 : 0;
  const copSirenFactor = closestCopDist < 95 ? 1 - closestCopDist / 95 : 0;
  const dashInfo = sound.updateContinuous(
    totalSpeed, vStats.maxSpeed, carState.throttleHold, isDrifting, finalSurface.onAsphalt,
    Math.max(playerSirenFactor, copSirenFactor), elapsed
  );
  if (dashInfo) {
    gearBadgeEl.textContent = fwdSpeed < -0.5 ? 'R' : dashInfo.gear;
    rpmBarEl.style.width = `${dashInfo.rpmPct}%`;
  } else {
    const fallbackRpm = Math.min(100, Math.round((totalSpeed / vStats.maxSpeed) * 70 + carState.throttleHold * 30));
    gearBadgeEl.textContent = totalSpeed < 0.6 ? 'N' : `${Math.min(5, Math.floor((totalSpeed / vStats.maxSpeed) * 5) + 1)}`;
    rpmBarEl.style.width = `${fallbackRpm}%`;
  }

  // --- 5. Omvallende Bomen & Vliegende Paaltjes ---
  for (let i = 0; i < destructibles.length; i++) {
    const d = destructibles[i];
    if (d.intact) continue;

    if (d.activeAnim) {
      if (d.kind === 'tree') {
        d.fallVel += (5.2 + Math.sin(d.fallAngle) * 9.5) * dt;
        d.fallAngle += d.fallVel * dt;

        const maxTilt = Math.PI * 0.47;
        if (d.fallAngle >= maxTilt) {
          d.fallAngle = maxTilt;
          if (d.fallVel > 1.8) d.fallVel = -d.fallVel * 0.22;
          else d.activeAnim = false;
        }

        tempQuat.setFromAxisAngle(d.fallAxis, d.fallAngle);
        d.mesh.quaternion.copy(tempQuat).multiply(d.origQuat);
      } else if (d.kind === 'small') {
        d.vy -= 22.0 * dt;
        d.mesh.position.x += d.vx * dt;
        d.mesh.position.y += d.vy * dt;
        d.mesh.position.z += d.vz * dt;
        d.mesh.rotation.x += d.spinX * dt;
        d.mesh.rotation.z += d.spinZ * dt;

        const floorY = Math.max(WATER_LEVEL, getTerrainHeight(d.mesh.position.x, d.mesh.position.z));
        if (d.mesh.position.y <= floorY + 0.22 && d.vy < 0) {
          if (Math.abs(d.vy) > 4.5) {
            d.vy *= -0.34;
            d.vx *= 0.55;
            d.vz *= 0.55;
          } else {
            d.activeAnim = false;
            d.mesh.position.y = floorY + 0.2;
          }
        }
      }
    } else {
      d.respawnTimer -= dt;
      if (d.respawnTimer <= 0) {
        if ((px - d.origX) ** 2 + (pz - d.origZ) ** 2 > 196) {
          d.intact = true;
          d.x = d.origX; d.y = d.origY; d.z = d.origZ;
          d.mesh.position.set(d.origX, d.origY, d.origZ);
          d.mesh.quaternion.copy(d.origQuat);
          d.mesh.scale.copy(d.origScale);
        } else {
          d.respawnTimer = 5.0;
        }
      }
    }
  }

  // --- 6. Weer, Vuurtorenstraal & Gepoolde Deeltjes ---
  if (lighthouseBeamPivot) {
    lighthouseBeamPivot.rotation.y = elapsed * 0.65;
    if (lighthouseBeamMat) {
      lighthouseBeamMat.opacity = isNightMode ? 0.22 : 0.08;
    }
  }
  if (giantStarMesh && isChristmasMode) giantStarMesh.rotation.y = elapsed * 1.4;
  if (isNightMode) nightSkyGroup.position.set(px, 0, pz);

  if (weatherSystem.visible) {
    const posArr = weatherSystem.geometry.attributes.position.array;
    const isRain = weatherIndex === 1;
    const fallSpeed = isRain ? 28.0 : 5.2;

    for (let i = 0; i < WEATHER_COUNT; i++) {
      const idx = i * 3;
      posArr[idx + 1] -= fallSpeed * dt;
      if (!isRain) posArr[idx] += Math.sin(elapsed * 1.8 + i) * 1.4 * dt;

      if (posArr[idx + 1] < playerVeh.root.position.y - 4) {
        posArr[idx] = px + (Math.random() - 0.5) * 90;
        posArr[idx + 1] = playerVeh.root.position.y + 26 + Math.random() * 10;
        posArr[idx + 2] = pz + (Math.random() - 0.5) * 90;
      }
    }
    weatherSystem.geometry.attributes.position.needsUpdate = true;
  }

  carState.puffTimer += dt * (0.5 + totalSpeed * 0.28);
  if (carState.puffTimer > 0.36) {
    carState.puffTimer = 0;
    tempVec.set(-0.6, 0.48, playerVeh.rearAxleZ - 0.8).applyAxisAngle(new THREE.Vector3(0, 1, 0), carState.angle).add(playerVeh.root.position);
    spawnParticle(tempVec, 'smoke', 0.85);
  }

  chimneySmokes.forEach((cs) => {
    cs.timer += dt;
    if (cs.timer > 1.1) {
      cs.timer = 0;
      if ((px - cs.origin.x) ** 2 + (pz - cs.origin.z) ** 2 < 140 * 140) {
        spawnParticle(cs.origin, 'smoke', 1.25);
      }
    }
  });

  if (isNightMode) {
    houseWindows.forEach((w) => {
      w.timer -= dt;
      if (w.timer <= 0) {
        w.mesh.visible = Math.random() > 0.3;
        w.timer = 6 + Math.random() * 16;
      }
    });
  }

  updateFireflies(dt, elapsed, px, pz, isNightMode);
  updateFallingLeaves(dt, elapsed, px, playerVeh.root.position.y, pz, isChristmasMode);

  for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
    const p = particlePool[i];
    if (!p.active) continue;
    p.age += dt;
    if (p.age >= p.maxAge) {
      p.active = false;
      p.mesh.visible = false;
    } else {
      const t = p.age / p.maxAge;
      p.vy -= p.gravity * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.z += p.vz * dt;
      p.mesh.scale.setScalar(Math.max(0.01, p.baseScale * (0.85 + t * 1.25) * (1 - t * 0.72)));
    }
  }

  for (let i = honkRings.length - 1; i >= 0; i--) {
    const hr = honkRings[i];
    hr.age += dt;
    if (hr.age > 0.65) {
      scene.remove(hr.mesh);
      honkRings.splice(i, 1);
    } else {
      hr.mesh.scale.setScalar(1 + hr.age * 7.5);
      hr.mesh.material.opacity = 1 - hr.age / 0.65;
    }
  }

  waterMesh.position.y = WATER_LEVEL + Math.sin(elapsed * 1.6) * 0.04;
  updateWaterWaves(elapsed);

  // --- 7. Volgcamera ---
  const targetFov = 50 + Math.min(14, (totalSpeed / 60) * 14);
  if (Math.abs(camera.fov - targetFov) > 0.08) {
    camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, 5 * dt);
    camera.updateProjectionMatrix();
  }

  const speedZoom = Math.min(5.5, totalSpeed * 0.10);
  tempVec.set(0, 11.4 + speedZoom * 0.35, -19.5 - speedZoom).applyAxisAngle(new THREE.Vector3(0, 1, 0), carState.angle).add(playerVeh.root.position);
  const camGround = getTerrainHeight(tempVec.x, tempVec.z);
  tempVec.y = Math.max(tempVec.y, Math.max(camGround, WATER_LEVEL) + 4.2);

  currentCamPos.lerp(tempVec, 7.2 * dt);
  camera.position.copy(currentCamPos);

  tempVec.set(px + carState.vx * 0.12, playerVeh.root.position.y + 1.85, pz + carState.vz * 0.12);
  currentLookAt.lerp(tempVec, 12.0 * dt);
  camera.lookAt(currentLookAt);

  updateMinimap(px, pz, carState.angle, policePool.filter((c) => c.active).map((c) => c.veh.root.position));

  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
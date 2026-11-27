import * as THREE from 'three';
import { sound } from './audio.js';
import { nightBtnEl, driftBtnEl, weatherBtnEl, xmasBtnEl, collapseBtnEl, cardBodyEl, toastEl } from './dom.js';
import {
  scene, skyColors, nightSkyGroup, sunDisc, playerHeadlight, townNightGlow, hemiLight, sunLight,
  xmasTreeLight, seasonalSwaps, christmasGroup, deciduousFoliageObjects, pineSnowCapObjects
} from './scene-setup.js';
import { waterMat, groundColorAttr, autumnVertexColors, winterVertexColors } from './terrain.js';
import { iceState } from './drive-surface.js';
import { skidMat } from './effects.js';
import { nightLampHalos, houseWindows, warmWindowMat, dinerNightLights } from './town.js';
import { allVehicleNightBeams, vehicleLightState } from './vehicles.js';
import { lighthouseBeacon, lighthouseBeamPivot, lighthouseLanternMat } from './scenery.js';

// =========================================================
// NACHTMODUS, WEER, WINTER & UI CONTROLS
// =========================================================
export let isNightMode = false;
export let weatherIndex = 0;
const weatherNames = ['Zonnig', 'Regen', 'Sneeuw', 'Mist'];
export let isChristmasMode = false;
export let driftModeIdx = 1;
export const DRIFT_MODES = [
  { name: 'Grip', lateralGrip: 6.4, handbrakeGrip: 1.85, turnBoost: 1.0 },
  { name: 'Sport', lateralGrip: 4.0, handbrakeGrip: 1.15, turnBoost: 1.18 },
  { name: 'Pro', lateralGrip: 2.2, handbrakeGrip: 0.72, turnBoost: 1.35 }
];

export function showToast(msg) {
  toastEl.textContent = msg;
}

collapseBtnEl.addEventListener('click', () => {
  cardBodyEl.classList.toggle('collapsed');
  collapseBtnEl.textContent = cardBodyEl.classList.contains('collapsed') ? 'Menu' : 'Inklappen';
});

export const WEATHER_COUNT = 650;
const weatherPositions = new Float32Array(WEATHER_COUNT * 3);
for (let i = 0; i < WEATHER_COUNT; i++) {
  weatherPositions[i * 3] = (Math.random() - 0.5) * 90;
  weatherPositions[i * 3 + 1] = Math.random() * 36;
  weatherPositions[i * 3 + 2] = (Math.random() - 0.5) * 90;
}
const weatherGeo = new THREE.BufferGeometry();
weatherGeo.setAttribute('position', new THREE.BufferAttribute(weatherPositions, 3));
const weatherMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.42, transparent: true, opacity: 0.88 });
export const weatherSystem = new THREE.Points(weatherGeo, weatherMat);
weatherSystem.visible = false;
weatherSystem.frustumCulled = false;
scene.add(weatherSystem);

export function applyAtmosphereSettings() {
  const activeSnow = weatherIndex === 2 || isChristmasMode;

  // Zet koplampen, straatlantaarn-kegels en sterrenhemel aan/uit op basis van Nachtmodus!
  playerHeadlight.intensity = isNightMode ? 5.2 : 0;
  townNightGlow.intensity = isNightMode ? 3.2 : 0;
  if (lighthouseBeacon) lighthouseBeacon.intensity = isNightMode ? 4.2 : 0;
  // Vuurtoren brandt alleen 's nachts: lichtbundel en gloeiende lantaarn uit overdag
  if (lighthouseBeamPivot) lighthouseBeamPivot.visible = isNightMode;
  lighthouseLanternMat.color.setHex(isNightMode ? 0xfff4c4 : 0x9fc8d9);
  nightLampHalos.forEach((h) => { h.visible = isNightMode; });
  dinerNightLights.forEach((l) => { l.intensity = isNightMode ? 3.2 : 0; });
  vehicleLightState.night = isNightMode;
  allVehicleNightBeams.forEach((b) => { b.visible = isNightMode && b.userData.lightsOn !== false; });

  // Kleuren van lucht, mist, zon en water worden elke frame vloeiend bijgewerkt in updateEnvironment()
  warmWindowMat.color.setHex(isNightMode ? 0xffe38c : 0x9fc8d9);

  if (weatherIndex === 1) {
    weatherSystem.visible = true;
    weatherMat.color.setHex(0xb8dcf5);
    weatherMat.size = 0.28;
  } else if (activeSnow) {
    weatherSystem.visible = true;
    weatherMat.color.setHex(0xffffff);
    weatherMat.size = 0.52;
  } else {
    weatherSystem.visible = false;
  }

  weatherBtnEl.innerHTML = `<span>${weatherNames[weatherIndex]}</span><span class="kbd-hint">C</span>`;
  nightBtnEl.classList.toggle('night-active', isNightMode);
  updateClockLabel(true);
  xmasTreeLight.intensity = isChristmasMode ? (isNightMode ? 4.5 : 2.8) : 0;
}

function setNightMode(night) {
  if (night === isNightMode) return;
  isNightMode = night;
  if (!isNightMode) houseWindows.forEach((w) => { w.mesh.visible = true; });
  applyAtmosphereSettings();
}

// N: spring naar de volgende schemering (dag -> avond, nacht -> ochtend)
export function toggleNightMode() {
  sound.init();
  if (isNightMode) {
    timeOfDay = 6.6;
    showToast('De zon komt op boven Pinewood Island');
  } else {
    timeOfDay = 18.0;
    showToast('De avond valt — koplampen, sterren en dorpslichten gaan aan');
  }
  updateEnvironment(0, true);
}

function setWeather(idx, announce = true) {
  weatherIndex = idx;
  applyAtmosphereSettings();
  if (announce) {
    const msg = ['De zon breekt door', 'Het begint te regenen — pas op, de weg is glad!', 'Het begint te sneeuwen', 'Er trekt dichte mist over het eiland'];
    showToast(msg[idx]);
  }
}

// C: zelf het weer kiezen (het automatische weer pakt het daarna weer op)
export function toggleWeather() {
  sound.init();
  const order = isChristmasMode ? [2, 0, 3] : [0, 1, 3];
  const pos = order.indexOf(weatherIndex);
  setWeather(order[(pos + 1) % order.length], false);
  weatherTimer = 150;
  showToast(`Weer gewisseld naar ${weatherNames[weatherIndex]}`);
}

// =========================================================
// AUTOMATISCH DAG/NACHT-RITME & WEER (vloeiende overgangen)
// =========================================================
const DAY_SECONDS = 14 * 60; // een volledige dag duurt ~14 minuten (de nacht gaat 2x zo snel)
export let timeOfDay = 10.0;
export const sunDirection = new THREE.Vector3(0.45, 0.8, 0.4).normalize();
let weatherTimer = 120;

const PAL_DAY = {
  0: { bg: 0xffcfa1, sun: 0xffb96e, sunI: 1.95, sky: 0xffe7bf, ground: 0x8f5d3b, hemiI: 1.14, fog: 0.0020, water: 0x43adc4 },
  1: { bg: 0x9ab0c2, sun: 0xdce8f5, sunI: 1.15, sky: 0xc8d8e8, ground: 0x6b7885, hemiI: 0.95, fog: 0.0026, water: 0x3a8ea3 },
  2: { bg: 0xdce8f2, sun: 0xfff0d8, sunI: 1.55, sky: 0xe8f2ff, ground: 0x9ab0c4, hemiI: 1.1, fog: 0.0024, water: 0x6aa9bd },
  3: { bg: 0xcfc8bc, sun: 0xeadfca, sunI: 1.0, sky: 0xdcd5ca, ground: 0x7a7064, hemiI: 1.05, fog: 0.0085, water: 0x5f9aa8 }
};
const PAL_DUSK = { bg: 0xf0946a, sun: 0xff8a4a, sky: 0xffc59a, ground: 0x7a4a35 };
const PAL_NIGHT = { bg: 0x101829, sun: 0x88a8ff, sunI: 0.72, sky: 0x3a5282, ground: 0x182030, hemiI: 0.68, fog: 0.0032, water: 0x1f5270 };

const cur = {
  bg: new THREE.Color(0xffcfa1), sun: new THREE.Color(0xffb96e), sky: new THREE.Color(0xffe7bf),
  ground: new THREE.Color(0x8f5d3b), water: new THREE.Color(0x43adc4), sunI: 1.95, hemiI: 1.14, fog: 0.002
};
const tgt = { bg: new THREE.Color(), sun: new THREE.Color(), sky: new THREE.Color(), ground: new THREE.Color(), water: new THREE.Color() };
const tmpA = new THREE.Color();
const tmpB = new THREE.Color();
let clockLabelKey = -1;

function updateClockLabel(force = false) {
  const h = Math.floor(timeOfDay);
  const m5 = Math.floor(((timeOfDay - h) * 60) / 5) * 5;
  const key = h * 60 + m5;
  if (!force && key === clockLabelKey) return;
  clockLabelKey = key;
  nightBtnEl.classList.toggle('night-active', isNightMode);
  nightBtnEl.innerHTML = `<span>Tijd: ${String(h).padStart(2, '0')}:${String(m5).padStart(2, '0')}</span><span class="kbd-hint">N</span>`;
}

function pickAutoWeather() {
  const r = Math.random();
  if (isChristmasMode) return r < 0.55 ? 2 : r < 0.8 ? 0 : 3;
  // Najaar: vaak zonnig, soms regen, af en toe mist
  return r < 0.55 ? 0 : r < 0.8 ? 1 : 3;
}

export function updateEnvironment(dt, snap = false) {
  // 1. Klok
  const sunAngle0 = ((timeOfDay - 6) / 24) * Math.PI * 2;
  const speed = Math.sin(sunAngle0) < -0.15 ? 2.0 : 1.0;
  timeOfDay = (timeOfDay + dt * speed * (24 / DAY_SECONDS)) % 24;
  const sunAngle = ((timeOfDay - 6) / 24) * Math.PI * 2;
  const sunHeight = Math.sin(sunAngle);
  updateClockLabel();

  // 2. Dag-factor met schemering, golden hour en ochtendmist
  const dayFactor = THREE.MathUtils.smoothstep(sunHeight, -0.14, 0.2);
  const golden = dayFactor * (1 - THREE.MathUtils.smoothstep(sunHeight, 0.04, 0.42));
  const morningMist = timeOfDay > 4.5 && timeOfDay < 9 ? Math.sin(((timeOfDay - 4.5) / 4.5) * Math.PI) : 0;

  if (!isNightMode && dayFactor < 0.38) setNightMode(true);
  else if (isNightMode && dayFactor > 0.48) setNightMode(false);

  // 3. Automatisch weer
  weatherTimer -= dt;
  if (weatherTimer <= 0) {
    weatherTimer = 110 + Math.random() * 120;
    const next = pickAutoWeather();
    if (next !== weatherIndex) setWeather(next);
  }

  // 4. Doelkleuren: dag (per weer) -> golden hour -> nacht
  const day = PAL_DAY[weatherIndex] ?? PAL_DAY[0];
  const goldenAmt = golden * (weatherIndex === 0 ? 0.75 : 0.25);
  const nightBg = isChristmasMode ? 0x162238 : PAL_NIGHT.bg;
  ['bg', 'sun', 'sky', 'ground'].forEach((key) => {
    tmpA.setHex(day[key]).lerp(tmpB.setHex(PAL_DUSK[key]), goldenAmt);
    tgt[key].setHex(key === 'bg' ? nightBg : PAL_NIGHT[key]).lerp(tmpA, dayFactor);
  });
  tgt.water.setHex(PAL_NIGHT.water).lerp(tmpA.setHex(day.water), dayFactor);
  const tSunI = THREE.MathUtils.lerp(PAL_NIGHT.sunI, day.sunI * (1 - golden * 0.25), dayFactor);
  const tHemiI = THREE.MathUtils.lerp(PAL_NIGHT.hemiI, day.hemiI, dayFactor);
  let tFog = THREE.MathUtils.lerp(weatherIndex === 3 ? 0.007 : PAL_NIGHT.fog, day.fog, dayFactor);
  if (weatherIndex === 0) tFog += morningMist * 0.0032;

  // 5. Vloeiend naar het doel bewegen (weerwissels duren een paar seconden)
  const k = snap ? 1 : Math.min(1, dt * 0.9);
  ['bg', 'sun', 'sky', 'ground', 'water'].forEach((key) => cur[key].lerp(tgt[key], k));
  cur.sunI += (tSunI - cur.sunI) * k;
  cur.hemiI += (tHemiI - cur.hemiI) * k;
  cur.fog += (tFog - cur.fog) * k;

  scene.background.copy(cur.bg);
  scene.fog.color.copy(cur.bg);
  scene.fog.density = cur.fog;
  sunLight.color.copy(cur.sun);
  sunLight.intensity = cur.sunI;
  hemiLight.color.copy(cur.sky);
  hemiLight.groundColor.copy(cur.ground);
  hemiLight.intensity = cur.hemiI;
  waterMat.color.copy(cur.water);

  // 6. Zonnestand van oost naar west; schaduwen draaien mee (nooit te laag voor nette schaduwen)
  if (sunHeight > -0.05) sunDirection.set(Math.cos(sunAngle) * 0.8, Math.max(0.38, sunHeight), -0.45).normalize();
  else sunDirection.set(-0.45, 0.85, -0.3).normalize(); // maanlicht
  sunDisc.visible = sunHeight > -0.08 && weatherIndex !== 1 && weatherIndex !== 3;
  sunDisc.material.color.setHex(golden > 0.4 ? 0xffb07a : 0xfff0c4);
  nightSkyGroup.visible = dayFactor < 0.35 && weatherIndex !== 1 && weatherIndex !== 3;
  sunDiscHeight = sunHeight;
}
export let sunDiscHeight = 0.8;

export function toggleChristmasLandscape() {
  sound.init();
  isChristmasMode = !isChristmasMode;
  groundColorAttr.array.set(isChristmasMode ? winterVertexColors : autumnVertexColors);
  groundColorAttr.needsUpdate = true;
  skidMat.color.setHex(isChristmasMode ? 0x556270 : 0x1c1614);

  seasonalSwaps.forEach((sw) => sw.mat.color.copy(isChristmasMode ? sw.winterColor : sw.autumnColor));
  deciduousFoliageObjects.forEach((fol) => { fol.visible = !isChristmasMode; });
  pineSnowCapObjects.forEach((cap) => { cap.visible = isChristmasMode; });

  christmasGroup.visible = isChristmasMode;
  iceState.frozen = isChristmasMode;

  if (isChristmasMode) {
    weatherIndex = 2;
    weatherTimer = 150;
    xmasBtnEl.classList.add('active-mode');
    xmasBtnEl.innerHTML = `<span>Winter: AAN</span><span class="kbd-hint">X</span>`;
    showToast('Winter & Kerst actief — Probeer dit ook samen met Nachtmodus (N)!');
  } else {
    weatherIndex = 0;
    weatherTimer = 150;
    xmasBtnEl.classList.remove('active-mode');
    xmasBtnEl.innerHTML = `<span>Winter: UIT</span><span class="kbd-hint">X</span>`;
    showToast('Terug naar het warme najaar');
  }
  applyAtmosphereSettings();
}

export function cycleDriftMode() {
  sound.init();
  driftModeIdx = (driftModeIdx + 1) % DRIFT_MODES.length;
  const dm = DRIFT_MODES[driftModeIdx];
  driftBtnEl.innerHTML = `<span>Drift: ${dm.name}</span><span class="kbd-hint">V</span>`;
  showToast(`Rijstijl ingesteld op: ${dm.name}`);
}

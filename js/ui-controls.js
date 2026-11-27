import * as THREE from 'three';
import { sound } from './audio.js';
import { nightBtnEl, driftBtnEl, weatherBtnEl, xmasBtnEl, collapseBtnEl, cardBodyEl, toastEl } from './dom.js';
import {
  scene, skyColors, nightSkyGroup, sunDisc, playerHeadlight, townNightGlow, hemiLight, sunLight,
  xmasTreeLight, seasonalSwaps, christmasGroup, deciduousFoliageObjects, pineSnowCapObjects
} from './scene-setup.js';
import { waterMat, groundColorAttr, autumnVertexColors, winterVertexColors } from './terrain.js';
import { skidMat } from './effects.js';
import { nightLampHalos, houseWindows, warmWindowMat, dinerNightLights } from './town.js';
import { allVehicleNightBeams } from './vehicles.js';
import { lighthouseBeacon } from './scenery.js';

// =========================================================
// NACHTMODUS, WEER, WINTER & UI CONTROLS
// =========================================================
export let isNightMode = false;
export let weatherIndex = 0;
const weatherNames = ['Zonnig', 'Regen', 'Sneeuw'];
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
  nightSkyGroup.visible = isNightMode && weatherIndex !== 1;
  sunDisc.visible = !isNightMode && weatherIndex !== 1;
  playerHeadlight.intensity = isNightMode ? 5.2 : 0;
  townNightGlow.intensity = isNightMode ? 3.2 : 0;
  if (lighthouseBeacon) lighthouseBeacon.intensity = isNightMode ? 4.2 : 0;
  nightLampHalos.forEach((h) => { h.visible = isNightMode; });
  dinerNightLights.forEach((l) => { l.intensity = isNightMode ? 3.2 : 0; });
  allVehicleNightBeams.forEach((b) => { b.visible = isNightMode; });

  if (isNightMode) {
    const bgCol = isChristmasMode ? skyColors.nightWinter : skyColors.night;
    scene.background.copy(bgCol);
    scene.fog.color.copy(bgCol);
    scene.fog.density = 0.0032;

    // Koel zilverblauw maanlicht zodat de Toon-cell-shading óók 's nachts duidelijk leesbaar blijft!
    sunLight.color.setHex(0x88a8ff);
    sunLight.intensity = 0.72;
    hemiLight.color.setHex(0x3a5282);
    hemiLight.groundColor.setHex(0x182030);
    hemiLight.intensity = 0.68;
    waterMat.color.setHex(0x1f5270);
    warmWindowMat.color.setHex(0xffe38c); // 's nachts gloeien de vensters warm geel
  } else {
    scene.fog.density = 0.0020;
    waterMat.color.setHex(0x43adc4);
    warmWindowMat.color.setHex(0x9fc8d9); // overdag gewoon rustig glas, geen gloeiend "wit vlak"

    if (weatherIndex === 1) {
      scene.background.copy(skyColors.rain);
      scene.fog.color.copy(skyColors.rain);
      sunLight.intensity = 1.15;
      sunLight.color.setHex(0xdce8f5);
      hemiLight.color.setHex(0xc8d8e8);
      hemiLight.groundColor.setHex(0x6b7885);
      hemiLight.intensity = 0.95;
    } else if (activeSnow) {
      const col = isChristmasMode ? skyColors.xmas : skyColors.snow;
      scene.background.copy(col);
      scene.fog.color.copy(col);
      sunLight.intensity = 1.55;
      sunLight.color.setHex(0xfff0d8);
      hemiLight.color.setHex(0xe8f2ff);
      hemiLight.groundColor.setHex(0x9ab0c4);
      hemiLight.intensity = 1.1;
    } else {
      scene.background.copy(skyColors.sunny);
      scene.fog.color.copy(skyColors.sunny);
      sunLight.intensity = 1.95;
      sunLight.color.setHex(0xffb96e);
      hemiLight.color.setHex(0xffe7bf);
      hemiLight.groundColor.setHex(0x8f5d3b);
      hemiLight.intensity = 1.14;
    }
  }

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
  nightBtnEl.innerHTML = `<span>Tijd: ${isNightMode ? 'Nacht' : 'Dag'}</span><span class="kbd-hint">N</span>`;
  xmasTreeLight.intensity = isChristmasMode ? (isNightMode ? 4.5 : 2.8) : 0;
}

export function toggleNightMode() {
  sound.init();
  isNightMode = !isNightMode;
  if (!isNightMode) houseWindows.forEach((w) => { w.mesh.visible = true; });
  applyAtmosphereSettings();
  showToast(isNightMode ? 'Nachtmodus AAN — Koplampen, sterrenhemel & dorpslichten actief!' : 'Dagmodus AAN — Golden Hour zonlicht');
}

export function toggleWeather() {
  sound.init();
  weatherIndex = (weatherIndex + 1) % 3;
  applyAtmosphereSettings();
  showToast(`Weer gewisseld naar ${weatherNames[weatherIndex]}`);
}

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

  if (isChristmasMode) {
    weatherIndex = 2;
    xmasBtnEl.classList.add('active-mode');
    xmasBtnEl.innerHTML = `<span>Winter: AAN</span><span class="kbd-hint">X</span>`;
    showToast('Winter & Kerst actief — Probeer dit ook samen met Nachtmodus (N)!');
  } else {
    weatherIndex = 0;
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

// =========================================================
// OOGST-MINIGAME: stap in de tractor op Pinewood Farm en maai alle akkers van de boerderij leeg.
// Alles binnen = geld. Na afloop groeien de gewassen weer aan als je weg bent, zodat je opnieuw kunt oogsten.
// =========================================================
import { harvestAround, getHarvestProgress, harvestRemaining, regrowFarm } from './farm.js';
import { ruralLots } from './water-lots.js';
import { addCash } from './wallet.js';
import { showToast } from './ui-controls.js';

const REWARD = 1200;
const COMPLETE_AT = 0.985; // de allerlaatste losse halmen gaan vanzelf mee

const hud = document.createElement('div');
hud.id = 'harvest-hud';
hud.hidden = true;
document.body.appendChild(hud);

export const harvest = {
  state: 'idle', // idle | active | done
  farm: null,
  regrowTimer: 0,
  lastPct: -1
};

function farmLotOf(name) {
  return ruralLots.find((l) => l.type === 'farm' && l.name === name);
}

function renderHud(text) {
  hud.innerHTML = text;
}

// Elke frame na de rijfysica aangeroepen
export function updateHarvest(dt, playerVeh, carState) {
  const inTractor = !!(playerVeh && playerVeh.isTractor && playerVeh.harvestFarm);

  // Na een volledige oogst: als je weg bent groeit alles weer aan
  if (harvest.state === 'done' && !inTractor) {
    harvest.regrowTimer -= dt;
    const lot = farmLotOf(harvest.farm);
    const p = playerVeh.root.position;
    if (harvest.regrowTimer <= 0 && lot && Math.hypot(p.x - lot.x, p.z - lot.z) > 120) {
      regrowFarm(harvest.farm);
      harvest.state = 'idle';
    }
  }

  if (!inTractor) {
    hud.hidden = true;
    return;
  }

  const farm = playerVeh.harvestFarm;
  const name = farm.charAt(0) + farm.slice(1).toLowerCase().replace(/ (\w)/g, (m, c) => ` ${c.toUpperCase()}`);
  if (harvest.state === 'idle' || harvest.farm !== farm) {
    harvest.farm = farm;
    harvest.state = 'active';
    harvest.lastPct = -1;
    showToast(`Harvest time! Mow every field of ${name} with the tractor — a full harvest pays $${REWARD}`);
  }
  hud.hidden = false;

  const { total, done } = getHarvestProgress(farm);
  if (harvest.state === 'done') {
    renderHud(`<b>🚜 ${name}</b><span>Harvest complete</span><span class="ok">+$${REWARD}</span>`);
    return;
  }

  // Maaibord voor de tractor: alles binnen de breedte van het bord gaat eraf
  const speed = Math.hypot(carState.vx, carState.vz);
  if (speed > 0.6) {
    const fx = Math.sin(carState.angle);
    const fz = Math.cos(carState.angle);
    const rx = Math.cos(carState.angle);
    const rz = -Math.sin(carState.angle);
    const p = playerVeh.root.position;
    const hx = p.x + fx * playerVeh.headerOffset;
    const hz = p.z + fz * playerVeh.headerOffset;
    const r = playerVeh.headerHalfW * 0.55;
    // drie overlappende cirkels over de breedte van het bord
    [-1, 0, 1].forEach((k) => {
      harvestAround(farm, hx + rx * k * r * 1.15, hz + rz * k * r * 1.15, r);
    });
  }

  const pct = total ? done / total : 0;
  if (total && pct >= COMPLETE_AT) {
    harvestRemaining(farm);
    harvest.state = 'done';
    harvest.regrowTimer = 60;
    addCash(REWARD, `${name}: all fields harvested!`);
    renderHud(`<b>🚜 ${name}</b><span>Harvest complete</span><span class="ok">+$${REWARD}</span>`);
    return;
  }
  const shown = Math.floor(pct * 100);
  if (shown !== harvest.lastPct) {
    harvest.lastPct = shown;
    renderHud(`<b>🚜 Harvest</b><span>${name}</span><span class="pct">${shown}%</span><span>${total - done} plants left</span>`);
  }
}

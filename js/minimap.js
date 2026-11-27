import { allRoadNetworks, TOWN_BOUNDS, WORLD_LIMIT, WATER_LEVEL, riverCurves } from './roads.js';
import { SANDBAR_ISLAND, ruralLots } from './water-lots.js';
import { LOOKOUT_HILL, MOOSE_LAKE } from './landscape.js';
import { getTerrainHeight } from './terrain.js';
import { minimapCanvas, fullmapCanvas, fullmapOverlayEl, minimapCardEl } from './dom.js';

// =========================================================
// MINIMAP: wegennet/meer/landmarks 1x gebakken naar een offscreen canvas, elk frame alleen uitgeknipt (goedkoop!)
// =========================================================
const MAP_WORLD_HALF = WORLD_LIMIT + 20;
const BAKE_PX = 1320;
const SCALE = BAKE_PX / (MAP_WORLD_HALF * 2);

function worldToBake(x, z) {
  return { px: (x + MAP_WORLD_HALF) * SCALE, py: (z + MAP_WORLD_HALF) * SCALE };
}

const bakeCanvas = document.createElement('canvas');
bakeCanvas.width = BAKE_PX;
bakeCanvas.height = BAKE_PX;
const bctx = bakeCanvas.getContext('2d');

function drawRoadPath(samples, closed) {
  bctx.beginPath();
  samples.forEach((s, i) => {
    const { px, py } = worldToBake(s.x, s.z);
    if (i === 0) bctx.moveTo(px, py);
    else bctx.lineTo(px, py);
  });
  if (closed) bctx.closePath();
  bctx.stroke();
}

function heightToMapColor(h) {
  if (h < -3.0) return [47, 127, 158];
  if (h < WATER_LEVEL + 0.05) return [74, 167, 196];
  if (h < 0.5) return [226, 200, 142];
  if (h > 45) return [242, 245, 248];
  if (h > 32) return [154, 143, 132];
  const t = Math.min(1, Math.max(0, (h - 1) / 22));
  return [Math.round(154 - t * 38), Math.round(176 - t * 30), Math.round(106 - t * 26)];
}

function bakeStaticMap() {
  // Terrein (oceaan, fjord, meren, rivieren, bergen) uit het echte hoogteraster
  const GRID = 440;
  const terrainCanvas = document.createElement('canvas');
  terrainCanvas.width = GRID;
  terrainCanvas.height = GRID;
  const tctx = terrainCanvas.getContext('2d');
  const img = tctx.createImageData(GRID, GRID);
  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      const x = -MAP_WORLD_HALF + ((gx + 0.5) / GRID) * MAP_WORLD_HALF * 2;
      const z = -MAP_WORLD_HALF + ((gy + 0.5) / GRID) * MAP_WORLD_HALF * 2;
      const [r, g, b] = heightToMapColor(getTerrainHeight(x, z));
      const o = (gy * GRID + gx) * 4;
      img.data[o] = r;
      img.data[o + 1] = g;
      img.data[o + 2] = b;
      img.data[o + 3] = 255;
    }
  }
  tctx.putImageData(img, 0, 0);
  bctx.imageSmoothingEnabled = true;
  bctx.drawImage(terrainCanvas, 0, 0, BAKE_PX, BAKE_PX);

  bctx.lineJoin = 'round';
  bctx.lineCap = 'round';
  bctx.strokeStyle = '#3d3830';
  bctx.lineWidth = 8;
  allRoadNetworks.forEach((net) => drawRoadPath(net.samples, net.isClosed));
  bctx.strokeStyle = '#6a6258';
  bctx.lineWidth = 5;
  allRoadNetworks.forEach((net) => drawRoadPath(net.samples, net.isClosed));

  // Dorpsgebied
  bctx.fillStyle = 'rgba(230, 218, 200, 0.6)';
  const tl = worldToBake(TOWN_BOUNDS.minX, TOWN_BOUNDS.minZ);
  const br = worldToBake(TOWN_BOUNDS.maxX, TOWN_BOUNDS.maxZ);
  bctx.fillRect(tl.px, tl.py, br.px - tl.px, br.py - tl.py);

  // Boerderij
  ruralLots.filter((l) => l.type === 'farm').forEach((farmLot) => {
    const { px, py } = worldToBake(farmLot.x, farmLot.z);
    bctx.fillStyle = '#a23327';
    bctx.fillRect(px - 7, py - 7, 14, 14);
  });

  // Diner (rood-geel rondje)
  ruralLots.filter((l) => l.type === 'diner').forEach((lot) => {
    const { px, py } = worldToBake(lot.x, lot.z);
    bctx.fillStyle = '#ffd23f';
    bctx.beginPath();
    bctx.arc(px, py, 8, 0, Math.PI * 2);
    bctx.fill();
    bctx.fillStyle = '#d62839';
    bctx.beginPath();
    bctx.arc(px, py, 5, 0, Math.PI * 2);
    bctx.fill();
  });

  // Vuurtoren op het zandeiland
  const lh = worldToBake(SANDBAR_ISLAND.x, SANDBAR_ISLAND.z);
  bctx.fillStyle = '#d43b3b';
  bctx.beginPath();
  bctx.arc(lh.px, lh.py, 6, 0, Math.PI * 2);
  bctx.fill();

  // Uitkijktoren op de bosheuvel
  const ep = worldToBake(LOOKOUT_HILL.x, LOOKOUT_HILL.z);
  bctx.fillStyle = '#8a4a22';
  bctx.beginPath();
  bctx.moveTo(ep.px, ep.py - 9);
  bctx.lineTo(ep.px - 7, ep.py + 6);
  bctx.lineTo(ep.px + 7, ep.py + 6);
  bctx.closePath();
  bctx.fill();

  // Hutten en huizen
  bctx.fillStyle = '#7a4a2a';
  ruralLots.forEach((lot) => {
    if (lot.type === 'farm' || lot.type === 'store' || lot.type === 'diner' || lot.type === 'camping' || lot.type === 'sawmill' || lot.type === 'fair') return;
    if (lot.type === 'villa') {
      const v = worldToBake(lot.x, lot.z);
      bctx.fillStyle = '#f6f0e4';
      bctx.fillRect(v.px - 6, v.py - 4, 12, 8);
      return;
    }
    const { px, py } = worldToBake(lot.x, lot.z);
    bctx.fillRect(px - 3, py - 3, 6, 6);
  });
}
bakeStaticMap();

const VIEW_RANGE = 130; // zichtbare wereldstraal op de minimap
const viewCtx = minimapCanvas.getContext('2d');
const outSize = minimapCanvas.width;

export function updateMinimap(px, pz, angle, copPositions = []) {
  const center = worldToBake(px, pz);
  const srcHalf = VIEW_RANGE * SCALE;

  viewCtx.clearRect(0, 0, outSize, outSize);
  viewCtx.save();
  viewCtx.beginPath();
  viewCtx.arc(outSize / 2, outSize / 2, outSize / 2, 0, Math.PI * 2);
  viewCtx.clip();
  viewCtx.drawImage(
    bakeCanvas,
    center.px - srcHalf, center.py - srcHalf, srcHalf * 2, srcHalf * 2,
    0, 0, outSize, outSize
  );
  viewCtx.restore();

  viewCtx.fillStyle = '#2288ff';
  copPositions.forEach((c) => {
    const cx = outSize / 2 + ((c.x - px) / VIEW_RANGE) * (outSize / 2);
    const cy = outSize / 2 + ((c.z - pz) / VIEW_RANGE) * (outSize / 2);
    if (cx > 2 && cx < outSize - 2 && cy > 2 && cy < outSize - 2) {
      viewCtx.beginPath();
      viewCtx.arc(cx, cy, 3.5, 0, Math.PI * 2);
      viewCtx.fill();
    }
  });

  // Speler-pijl blijft altijd gecentreerd, roteert met de rijrichting mee
  viewCtx.save();
  viewCtx.translate(outSize / 2, outSize / 2);
  viewCtx.rotate(-angle);
  viewCtx.fillStyle = '#d95d30';
  viewCtx.strokeStyle = '#2a1810';
  viewCtx.lineWidth = 1.5;
  viewCtx.beginPath();
  viewCtx.moveTo(0, 9);
  viewCtx.lineTo(-6, -7);
  viewCtx.lineTo(0, -3);
  viewCtx.lineTo(6, -7);
  viewCtx.closePath();
  viewCtx.fill();
  viewCtx.stroke();
  viewCtx.restore();
}

// =========================================================
// GROTE KAART VAN HET HELE EILAND (toets K of klik op de minimap)
// =========================================================
const fullCtx = fullmapCanvas.getContext('2d');
const FULL = fullmapCanvas.width;
// Uitsnede rond het eiland (de oceaanrand laten we grotendeels weg)
const FULL_HALF = 400;
const FULL_CX = 0;
const FULL_CZ = 30;

function fullToPx(x, z) {
  return {
    px: ((x - (FULL_CX - FULL_HALF)) / (FULL_HALF * 2)) * FULL,
    py: ((z - (FULL_CZ - FULL_HALF)) / (FULL_HALF * 2)) * FULL
  };
}

const placeLabels = [];
function addLabel(text, x, z, kind = 'place') {
  placeLabels.push({ text, x, z, kind });
}
addLabel('Pinewood', 0, 104, 'town');
addLabel('Pinewood Lake', 0, -30, 'water');
addLabel('Moose Lake', MOOSE_LAKE.x, MOOSE_LAKE.z, 'water');
addLabel('Uitkijktoren', LOOKOUT_HILL.x, LOOKOUT_HILL.z - 14);
{
  const rp = riverCurves[0].sampled[Math.round(riverCurves[0].sampled.length * 0.5)];
  addLabel('Pine River', rp.x + 34, rp.z, 'water');
}
ruralLots.forEach((lot) => {
  if (lot.type === 'store') addLabel('Pinewood Mall', lot.x, lot.z - 16);
  if (lot.type === 'diner') addLabel('Diner', lot.x, lot.z - 14);
  if (lot.type === 'farm') addLabel(lot.name ? lot.name.charAt(0) + lot.name.slice(1).toLowerCase().replace(/ (\w)/g, (m, c) => ' ' + c.toUpperCase()) : 'Boerderij', lot.x, lot.z - 36);
  if (lot.type === 'villa') addLabel('Villa', lot.x, lot.z - 16);
  if (lot.type === 'camping') addLabel('Camping', lot.x, lot.z + 4);
  if (lot.type === 'sawmill') addLabel('Zagerij', lot.x, lot.z - 14);
  if (lot.type === 'fair') addLabel('Kermis', lot.x, lot.z);
});
addLabel('Strand', 0, 352, 'water');

let fullOpen = false;
export function isFullMapOpen() {
  return fullOpen;
}
export function toggleFullMap(force) {
  fullOpen = force ?? !fullOpen;
  fullmapOverlayEl.hidden = !fullOpen;
}
minimapCardEl.addEventListener('click', () => toggleFullMap(true));
fullmapOverlayEl.addEventListener('click', () => toggleFullMap(false));

export function updateFullMap(px, pz, angle, copPositions = []) {
  if (!fullOpen) return;
  // Achtergrond: dezelfde gebakken kaart, uitgesneden rond het eiland
  const s0 = worldToBake(FULL_CX - FULL_HALF, FULL_CZ - FULL_HALF);
  const s1 = worldToBake(FULL_CX + FULL_HALF, FULL_CZ + FULL_HALF);
  fullCtx.clearRect(0, 0, FULL, FULL);
  fullCtx.drawImage(bakeCanvas, s0.px, s0.py, s1.px - s0.px, s1.py - s0.py, 0, 0, FULL, FULL);

  // Plaatsnamen met een lichte halo voor leesbaarheid
  fullCtx.textAlign = 'center';
  fullCtx.textBaseline = 'middle';
  placeLabels.forEach((lb) => {
    const p = fullToPx(lb.x, lb.z);
    fullCtx.font = lb.kind === 'town' ? '900 26px system-ui, sans-serif' : lb.kind === 'water' ? 'italic 700 17px system-ui, sans-serif' : '800 16px system-ui, sans-serif';
    fullCtx.lineWidth = 5;
    fullCtx.strokeStyle = lb.kind === 'water' ? 'rgba(20, 60, 80, 0.55)' : 'rgba(255, 248, 238, 0.92)';
    fullCtx.fillStyle = lb.kind === 'water' ? '#eaf8ff' : '#2a1810';
    fullCtx.strokeText(lb.text, p.px, p.py);
    fullCtx.fillText(lb.text, p.px, p.py);
  });

  // Sheriffs
  fullCtx.fillStyle = '#2288ff';
  copPositions.forEach((c) => {
    const p = fullToPx(c.x, c.z);
    fullCtx.beginPath();
    fullCtx.arc(p.px, p.py, 6, 0, Math.PI * 2);
    fullCtx.fill();
  });

  // Speler
  const pp = fullToPx(px, pz);
  fullCtx.save();
  fullCtx.translate(pp.px, pp.py);
  fullCtx.rotate(-angle);
  fullCtx.fillStyle = '#d95d30';
  fullCtx.strokeStyle = '#2a1810';
  fullCtx.lineWidth = 2.5;
  fullCtx.beginPath();
  fullCtx.moveTo(0, 15);
  fullCtx.lineTo(-10, -11);
  fullCtx.lineTo(0, -5);
  fullCtx.lineTo(10, -11);
  fullCtx.closePath();
  fullCtx.fill();
  fullCtx.stroke();
  fullCtx.restore();
}

import { allRoadNetworks, TOWN_BOUNDS, WORLD_LIMIT, WATER_LEVEL } from './roads.js';
import { SANDBAR_ISLAND, ruralLots } from './water-lots.js';
import { EAGLE_PEAK } from './landscape.js';
import { getTerrainHeight } from './terrain.js';
import { minimapCanvas } from './dom.js';

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
  if (h > 31) return [242, 245, 248];
  if (h > 18) return [154, 143, 132];
  const t = Math.min(1, Math.max(0, (h - 1) / 14));
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
  const farmLot = ruralLots.find((l) => l.type === 'farm');
  if (farmLot) {
    const { px, py } = worldToBake(farmLot.x, farmLot.z);
    bctx.fillStyle = '#a23327';
    bctx.fillRect(px - 6, py - 6, 12, 12);
  }

  // Vuurtoren op het zandeiland
  const lh = worldToBake(SANDBAR_ISLAND.x, SANDBAR_ISLAND.z);
  bctx.fillStyle = '#d43b3b';
  bctx.beginPath();
  bctx.arc(lh.px, lh.py, 6, 0, Math.PI * 2);
  bctx.fill();

  // Uitkijktoren op Eagle Peak
  const ep = worldToBake(EAGLE_PEAK.x, EAGLE_PEAK.z);
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
    if (lot.type === 'farm' || lot.type === 'store') return;
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

import { lakeSamples, valleySamples, streetSampleSets, TOWN_BOUNDS, WORLD_LIMIT } from './roads.js';
import { getLakeShoreRadius, SANDBAR_ISLAND, ruralLots } from './water-lots.js';
import { minimapCanvas } from './dom.js';

// =========================================================
// MINIMAP: wegennet/meer/landmarks 1x gebakken naar een offscreen canvas, elk frame alleen uitgeknipt (goedkoop!)
// =========================================================
const MAP_WORLD_HALF = WORLD_LIMIT + 40;
const BAKE_PX = 900;
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

function bakeStaticMap() {
  bctx.fillStyle = '#9ab06a';
  bctx.fillRect(0, 0, BAKE_PX, BAKE_PX);

  // Meer, via de echte oeverradius-functie als gevulde polygon
  bctx.fillStyle = '#4aa7c4';
  bctx.beginPath();
  const steps = 72;
  for (let i = 0; i <= steps; i++) {
    const theta = (i / steps) * Math.PI * 2;
    const r = getLakeShoreRadius(theta);
    const { px, py } = worldToBake(Math.cos(theta) * r, Math.sin(theta) * r);
    if (i === 0) bctx.moveTo(px, py);
    else bctx.lineTo(px, py);
  }
  bctx.closePath();
  bctx.fill();

  bctx.strokeStyle = '#5a5248';
  bctx.lineWidth = 5;
  drawRoadPath(lakeSamples, true);
  drawRoadPath(valleySamples, false);
  streetSampleSets.forEach((s) => drawRoadPath(s.samples, false));

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
}
bakeStaticMap();

const VIEW_RANGE = 110; // zichtbare wereldstraal op de minimap
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

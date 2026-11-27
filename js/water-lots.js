import * as THREE from 'three';
import { lakeSamples, valleySamples, LAKE_BRIDGES, VALLEY_BRIDGE } from './roads.js';

// =========================================================
// WATERLOPEN & KAVELS (MET EXACTE RECHTHOEKIGE VLAKTE-ZONES)
// =========================================================
export function getLakeShoreRadius(theta) {
  return 47 + Math.sin(theta * 2 - 0.4) * 6.0 + Math.cos(theta * 3 + 1.1) * 4.5 + Math.sin(theta * 5) * 1.8;
}

export const SANDBAR_ISLAND = { x: 24, z: 6, r: 8.5 };

function createRiverFromBridgeSample(centerS, halfWidth, flowsIntoLake = true, bendSign = 1) {
  const dotToCenter = (-centerS.x) * centerS.nx + (-centerS.z) * centerS.nz;
  const inSign = dotToCenter >= 0 ? 1 : -1;
  const inX = centerS.nx * inSign;
  const inZ = centerS.nz * inSign;
  const outX = -inX;
  const outZ = -inZ;
  const sideX = centerS.tx;
  const sideZ = centerS.tz;

  const pts = flowsIntoLake
    ? [
        new THREE.Vector3(centerS.x + inX * 48, 0, centerS.z + inZ * 48),
        new THREE.Vector3(centerS.x + inX * 24 + sideX * 5 * bendSign, 0, centerS.z + inZ * 24 + sideZ * 5 * bendSign),
        new THREE.Vector3(centerS.x + inX * 11, 0, centerS.z + inZ * 11),
        new THREE.Vector3(centerS.x, 0, centerS.z),
        new THREE.Vector3(centerS.x + outX * 11, 0, centerS.z + outZ * 11),
        new THREE.Vector3(centerS.x + outX * 44 - sideX * 12 * bendSign, 0, centerS.z + outZ * 44 - sideZ * 12 * bendSign),
        new THREE.Vector3(centerS.x + outX * 95 + sideX * 16 * bendSign, 0, centerS.z + outZ * 95 + sideZ * 16 * bendSign),
        new THREE.Vector3(centerS.x + outX * 155, 0, centerS.z + outZ * 155)
      ]
    : [
        new THREE.Vector3(centerS.x + inX * 36 + sideX * 8, 0, centerS.z + inZ * 36 + sideZ * 8),
        new THREE.Vector3(centerS.x + inX * 18, 0, centerS.z + inZ * 18),
        new THREE.Vector3(centerS.x + inX * 10, 0, centerS.z + inZ * 10),
        new THREE.Vector3(centerS.x, 0, centerS.z),
        new THREE.Vector3(centerS.x + outX * 10, 0, centerS.z + outZ * 10),
        new THREE.Vector3(centerS.x + outX * 38 - sideX * 10, 0, centerS.z + outZ * 38 - sideZ * 10),
        new THREE.Vector3(centerS.x + outX * 85 + sideX * 12, 0, centerS.z + outZ * 85 + sideZ * 12)
      ];

  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.5);
  const sampled = [];
  for (let k = 0; k <= 70; k++) {
    const p = curve.getPointAt(k / 70);
    sampled.push({ x: p.x, z: p.z });
  }
  return { sampled, halfWidth, pondCenter: flowsIntoLake ? null : pts[0] };
}

const lakeBridge0Sample = lakeSamples[0];
const lakeBridge1Sample = lakeSamples[Math.round(LAKE_BRIDGES[1].uCenter * lakeSamples.length)];
const valleyBridgeSample = valleySamples[Math.round(VALLEY_BRIDGE.uCenter * (valleySamples.length - 1))];

export const riverCurves = [
  createRiverFromBridgeSample(lakeBridge0Sample, 7.4, true, 1),
  createRiverFromBridgeSample(lakeBridge1Sample, 7.2, true, -1),
  createRiverFromBridgeSample(valleyBridgeSample, 6.2, false, 1)
];

export const VALLEY_POND = { x: riverCurves[2].pondCenter.x, z: riverCurves[2].pondCenter.z, r: 14.5 };

export function getDistToRivers(x, z) {
  let minEffective = Infinity;
  for (const riv of riverCurves) {
    for (let i = 0; i < riv.sampled.length; i++) {
      const p = riv.sampled[i];
      const d = Math.hypot(x - p.x, z - p.z) - riv.halfWidth;
      if (d < minEffective) minEffective = d;
    }
  }
  const dPond = Math.hypot(x - VALLEY_POND.x, z - VALLEY_POND.z) - VALLEY_POND.r;
  return Math.min(minEffective, dPond);
}

export const ruralLots = [
  { netSamples: lakeSamples, u: 0.145, outward: true, dist: 18.5, type: 'aframe', yawOff: -0.1 },
  { netSamples: lakeSamples, u: 0.255, outward: true, dist: 17.5, type: 'house_blue', yawOff: 0.05 },
  { netSamples: lakeSamples, u: 0.825, outward: true, dist: 17.5, type: 'cabin', yawOff: -0.1 },
  { netSamples: lakeSamples, u: 0.895, outward: true, dist: 18.0, type: 'aframe', yawOff: 0.1 },
  { netSamples: valleySamples, u: 0.16, outward: true, dist: 18.0, type: 'cabin', yawOff: 0.05 },
  { netSamples: valleySamples, u: 0.28, outward: false, dist: 17.5, type: 'house_red', yawOff: -0.08 },
  { netSamples: valleySamples, u: 0.36, outward: true, dist: 17.5, type: 'aframe', yawOff: 0.1 },
  { netSamples: valleySamples, u: 0.83, outward: false, dist: 17.5, type: 'cabin', yawOff: 0.12 },
  { netSamples: valleySamples, u: 0.91, outward: true, dist: 17.5, type: 'house_yellow', yawOff: -0.06 },

  // Supermarkt & Pinewood Mall op het vlakke noordoostelijke stuk van de meerweg (u=0.055, vlakke weg!).
  // flatBox legt het hele winkelcentrum én de hele parkeerplaats tot aan de wegrand 100% waterpas.
  {
    netSamples: lakeSamples,
    u: 0.055,
    outward: true,
    dist: 20.5,
    type: 'store',
    yawOff: 0,
    noDriveway: true,
    flatElevOffset: -0.06,
    flatBox: { minLX: -19.5, maxLX: 19.5, minLZ: -14.0, maxLZ: 14.5, blend: 12.0 }
  },

  // Grote Amerikaanse Boerderij op het brede, vlakke zuidwestelijke vallei-plateau (u=0.70, ver afgelegen van het dorp!).
  // flatBox legt zowel de schuur, silo's, het boerenhuis als alle 3 de maisvelden 100% waterpas.
  {
    netSamples: valleySamples,
    u: 0.70,
    outward: true,
    dist: 36.0,
    type: 'farm',
    yawOff: 0,
    flatElevOffset: -0.04,
    flatBox: { minLX: -30.5, maxLX: 30.5, minLZ: -30.0, maxLZ: 27.5, blend: 15.0 }
  }
];

export const driveways = [];

ruralLots.forEach((lot) => {
  const idx = Math.min(lot.netSamples.length - 1, Math.round(lot.u * (lot.netSamples.length - 1)));
  const rs = lot.netSamples[idx];
  const dotOut = rs.x * rs.nx + rs.z * rs.nz;
  const outSign = dotOut >= 0 ? 1 : -1;
  const side = lot.outward ? outSign : -outSign;

  lot.roadX = rs.x + rs.nx * side * (rs.halfWidth - 0.35);
  lot.roadZ = rs.z + rs.nz * side * (rs.halfWidth - 0.35);
  lot.roadY = rs.y;
  lot.x = rs.x + rs.nx * side * lot.dist;
  lot.z = rs.z + rs.nz * side * lot.dist;
  lot.y = Math.max(1.15, rs.y + (lot.flatElevOffset ?? 0.15));
  lot.yaw = Math.atan2(-rs.nx * side, -rs.nz * side) + lot.yawOff;

  if (!lot.noDriveway) {
    driveways.push({
      x1: lot.roadX,
      y1: lot.roadY,
      z1: lot.roadZ,
      x2: lot.x,
      y2: lot.y,
      z2: lot.z,
      halfWidth: lot.type === 'farm' ? 3.2 : 2.5
    });
  }
});

// Hulpfunctie: afstand van wereldpunt (x, z) tot een meegedraaide flatBox van een kavel (0 = binnen het vlakke plateau)
export function getLotFlatBoxDist(x, z, lot) {
  if (!lot.flatBox) return Infinity;
  const dx = x - lot.x;
  const dz = z - lot.z;
  const s = Math.sin(lot.yaw);
  const c = Math.cos(lot.yaw);
  const lx = dx * c - dz * s;
  const lz = dx * s + dz * c;

  const fb = lot.flatBox;
  const outX = lx < fb.minLX ? fb.minLX - lx : lx > fb.maxLX ? lx - fb.maxLX : 0;
  const outZ = lz < fb.minLZ ? fb.minLZ - lz : lz > fb.maxLZ ? lz - fb.maxLZ : 0;
  return Math.hypot(outX, outZ);
}
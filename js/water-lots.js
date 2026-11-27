import * as THREE from 'three';
import { lakeSamples, valleySamples, ringSamples, outerRoadDefs, streetSampleSets, riverCurves, VALLEY_POND, getDistToRivers } from './roads.js';

const timberTrailSamples = outerRoadDefs.find((d) => d.id === 'timber_trail').samples;
const foxRoadSamples = outerRoadDefs.find((d) => d.id === 'fox_lake_road').samples;
const westAveSamples = streetSampleSets.find((s) => s.def.id === 'west_ave').samples;
const eastAveSamples = streetSampleSets.find((s) => s.def.id === 'east_ave').samples;



// =========================================================
// WATERLOPEN & KAVELS (MET EXACTE RECHTHOEKIGE VLAKTE-ZONES)
// =========================================================
export function getLakeShoreRadius(theta) {
  // Noordelijke helft flink groter (daar ligt de meerweg ver genoeg weg); zuidkant bij het dorp blijft gelijk
  const northGrow = Math.pow(Math.max(0, -Math.sin(theta)), 0.8) * 14;
  return 47 + Math.sin(theta * 2 - 0.4) * 6.0 + Math.cos(theta * 3 + 1.1) * 4.5 + Math.sin(theta * 5) * 1.8 + northGrow;
}

export const SANDBAR_ISLAND = { x: 24, z: 6, r: 12 };

// Rivieren worden nu in roads.js gedefinieerd (nodig om bruggen op de nieuwe wegen automatisch te plaatsen)
export { riverCurves, VALLEY_POND, getDistToRivers };

export const ruralLots = [
  { netSamples: lakeSamples, u: 0.825, outward: true, dist: 17.5, type: 'cabin', yawOff: -0.1 },
  { netSamples: lakeSamples, u: 0.895, outward: true, dist: 18.0, type: 'house_red', yawOff: 0.1 },
  { netSamples: valleySamples, u: 0.16, outward: true, dist: 18.0, type: 'cabin', yawOff: 0.05 },
  { netSamples: valleySamples, u: 0.28, outward: false, dist: 17.5, type: 'house_red', yawOff: -0.08 },
  { netSamples: valleySamples, u: 0.36, outward: true, dist: 17.5, type: 'house_yellow', yawOff: 0.1 },

  // Supermarkt & Pinewood Mall op het vlakke noordoostelijke stuk van de meerweg (u=0.055, vlakke weg!).
  // flatBox legt het hele winkelcentrum én de hele parkeerplaats tot aan de wegrand 100% waterpas.
  {
    netSamples: lakeSamples,
    u: 0.055,
    outward: true,
    dist: 31.0,
    type: 'store',
    yawOff: 0,
    // Brede geasfalteerde inrit van de weg tot aan de rand van de parkeerplaats (lz = 19.6)
    drivewayStopShort: 24.3,
    flatElevOffset: -0.06,
    flatBox: { minLX: -22.5, maxLX: 22.5, minLZ: -18.0, maxLZ: 26.0, blend: 12.0 }
  },

  // Huizen en hutten langs de kustweg en het bospad (near = wereldpunt, u wordt opgezocht)
  { netSamples: ringSamples, near: [-257, -118], outward: true, dist: 18.0, type: 'cabin', yawOff: 0.05 },
  { netSamples: ringSamples, near: [-190, -224], outward: false, dist: 18.0, type: 'cabin', yawOff: -0.08 },
  { netSamples: ringSamples, near: [40, -262], outward: true, dist: 18.0, type: 'house_blue', yawOff: 0.06 },
  { netSamples: ringSamples, near: [302, 95], outward: false, dist: 17.5, type: 'house_yellow', yawOff: -0.05 },
  { netSamples: ringSamples, near: [262, 125], outward: true, dist: 17.0, type: 'cabin', yawOff: 0.0, tag: 'moose_lodge' },
  // Vrijstaande huizen met voortuin langs de doorgetrokken dorpslanen (overgang dorp -> platteland)
  { netSamples: westAveSamples, near: [-28, 145], outward: true, dist: 13.5, type: 'house_blue', yawOff: 0, flatElevOffset: -0.22, padRadius: 9.5 },
  { netSamples: westAveSamples, near: [-28, 145], outward: false, dist: 13.5, type: 'house_yellow', yawOff: 0, flatElevOffset: -0.22, padRadius: 9.5 },
  { netSamples: westAveSamples, near: [-28, 157], outward: true, dist: 13.5, type: 'cabin', yawOff: 0, flatElevOffset: -0.22, padRadius: 9.5 },
  { netSamples: eastAveSamples, near: [28, 145], outward: true, dist: 13.5, type: 'house_red', yawOff: 0, flatElevOffset: -0.22, padRadius: 9.5 },
  { netSamples: eastAveSamples, near: [28, 145], outward: false, dist: 13.5, type: 'house_blue', yawOff: 0, flatElevOffset: -0.22, padRadius: 9.5 },
  { netSamples: eastAveSamples, near: [28, 151], outward: true, dist: 13.5, type: 'house_yellow', yawOff: 0, flatElevOffset: -0.22, padRadius: 9.5 },

  // Huizen langs de nieuwe Fox Lake Road
  { netSamples: foxRoadSamples, near: [140, -27], outward: true, dist: 17.5, type: 'house_blue', yawOff: 0.05 },
  { netSamples: foxRoadSamples, near: [192, -45], outward: true, dist: 17.5, type: 'cabin', yawOff: -0.05 },

  // Grote villa aan Moose Lake (met zwembad en oprijlaan)
  { netSamples: ringSamples, near: [200, 240], outward: false, dist: 22.0, type: 'villa', yawOff: 0.0, padRadius: 24, blendRadius: 36 },
  { netSamples: ringSamples, near: [-55, 320], outward: false, dist: 18.0, type: 'house_red', yawOff: -0.06 },
  { netSamples: ringSamples, near: [-130, 303], outward: false, dist: 18.0, type: 'cabin', yawOff: 0.08 },

  // Fastfood-diner langs de strandboulevard (parkeerplaats sluit direct aan op de weg)
  {
    netSamples: ringSamples,
    near: [30, 321],
    outward: false,
    dist: 22.0,
    type: 'diner',
    yawOff: 0,
    noDriveway: true,
    flatElevOffset: -0.06,
    flatBox: { minLX: -31, maxLX: 19, minLZ: -18, maxLZ: 18.5, blend: 12 }
  },

  // Bioscoop net ten oosten van het stadje, aan de meerweg
  {
    netSamples: lakeSamples,
    u: 0.392,
    outward: true,
    dist: 31.0,
    type: 'cinema',
    name: 'PINEWOOD CINEMA',
    yawOff: 0,
    drivewayStopShort: 16.5,
    flatElevOffset: -0.05,
    flatBox: { minLX: -15, maxLX: 15, minLZ: -14, maxLZ: 16, blend: 12 }
  },

  // PINE COFFEE: losse drive-thru koffiekiosk aan de Prairie Road, met uitzicht op Moose Lake
  {
    netSamples: outerRoadDefs.find((d) => d.id === 'prairie_road').samples,
    near: [170, 130],
    outward: false,
    dist: 17.0,
    type: 'coffee',
    name: 'PINE COFFEE',
    yawOff: 0,
    drivewayStopShort: 10.5,
    flatElevOffset: -0.05,
    flatBox: { minLX: -13, maxLX: 13, minLZ: -11, maxLZ: 11, blend: 12 }
  },

  // Klein vliegveld met startbaan naar het westen, aan de zuidelijke verbindingsweg
  {
    netSamples: outerRoadDefs.find((d) => d.id === 'south_link').samples,
    near: [84, 222],
    outward: true,
    dist: 22.0,
    type: 'airfield',
    name: 'PINEWOOD AIRFIELD',
    yawOff: -0.5,
    drivewayStopShort: 10.0,
    flatElevOffset: -0.05,
    flatBox: { minLX: -18, maxLX: 18, minLZ: -134, maxLZ: 14, blend: 16 }
  },

  // Strandcamping aan de noordkust (tussen kustweg en strand)
  {
    netSamples: ringSamples,
    near: [-112, -270],
    outward: true,
    dist: 30.0,
    type: 'camping',
    name: 'NORTH BEACH CAMPING',
    yawOff: 0,
    flatElevOffset: -0.05,
    flatBox: { minLX: -22, maxLX: 22, minLZ: -20, maxLZ: 24, blend: 12 }
  },

  // Zagerij langs het Timber Trail
  {
    netSamples: timberTrailSamples,
    near: [-196, -64],
    outward: false,
    dist: 26.0,
    type: 'sawmill',
    name: 'TIMBER MILL',
    yawOff: 0,
    flatElevOffset: -0.05,
    flatBox: { minLX: -18, maxLX: 18, minLZ: -16, maxLZ: 20, blend: 12 }
  },

  // Herfstkermis naast de valleiweg
  {
    netSamples: valleySamples,
    u: 0.085,
    outward: true,
    dist: 40.0,
    type: 'fair',
    name: 'PINEWOOD FAIR',
    yawOff: 0,
    flatElevOffset: -0.05,
    flatBox: { minLX: -26, maxLX: 26, minLZ: -24, maxLZ: 34, blend: 14 }
  },

  // Tweede boerderij (Sunny Acres) op de oostelijke vlakte
  {
    netSamples: ringSamples,
    near: [292, -14],
    outward: false,
    dist: 52.0,
    type: 'farm',
    name: 'SUNNY ACRES',
    variant: 'wheat',
    yawOff: 0,
    flatElevOffset: -0.04,
    flatBox: { minLX: -40, maxLX: 40, minLZ: -42, maxLZ: 40, blend: 16 }
  },

  // Grote Amerikaanse Boerderij op het brede, vlakke zuidwestelijke vallei-plateau (u=0.70, ver afgelegen van het dorp!).
  // flatBox legt zowel de schuur, silo's, het boerenhuis als alle 3 de maisvelden 100% waterpas.
  {
    netSamples: valleySamples,
    u: 0.70,
    outward: true,
    dist: 44.0,
    type: 'farm',
    name: 'PINEWOOD FARM',
    variant: 'corn',
    yawOff: 0,
    flatElevOffset: -0.04,
    flatBox: { minLX: -40, maxLX: 40, minLZ: -40, maxLZ: 36, blend: 15.0 }
  }
];

export const driveways = [];

ruralLots.forEach((lot) => {
  if (lot.near) {
    let best = 0;
    let bestD = Infinity;
    lot.netSamples.forEach((smp, i) => {
      const d = (smp.x - lot.near[0]) ** 2 + (smp.z - lot.near[1]) ** 2;
      if (d < bestD) { bestD = d; best = i; }
    });
    lot.u = best / (lot.netSamples.length - 1);
  }
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
      x2: rs.x + rs.nx * side * (lot.dist - (lot.drivewayStopShort ?? 0)),
      y2: lot.y,
      z2: rs.z + rs.nz * side * (lot.dist - (lot.drivewayStopShort ?? 0)),
      halfWidth: lot.type === 'farm' ? 3.2 : lot.type === 'store' ? 4.4 : lot.type === 'cinema' ? 3.4 : lot.type === 'villa' ? 2.8 : 2.5,
      asphalt: lot.type === 'store' || lot.type === 'cinema' || lot.type === 'airfield' || lot.type === 'coffee'
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
import * as THREE from 'three';
import { lakeSamples, valleySamples, ringSamples, outerRoadDefs, streetSampleSets, riverCurves, VALLEY_POND, getDistToRivers } from './roads.js';
import { getNaturalGroundBase } from './landscape.js';

const timberTrailSamples = outerRoadDefs.find((d) => d.id === 'timber_trail').samples;
const foxRoadSamples = outerRoadDefs.find((d) => d.id === 'fox_lake_road').samples;
const westAveSamples = streetSampleSets.find((s) => s.def.id === 'west_ave').samples;
const eastAveSamples = streetSampleSets.find((s) => s.def.id === 'east_ave').samples;



// =========================================================
// WATERLOPEN & KAVELS (MET EXACTE RECHTHOEKIGE VLAKTE-ZONES)
// =========================================================
// Extra groei van Pinewood Lake per 10 graden (0 = oost, 90 = zuid/dorp), afgestemd op de vrije ruimte
// tot de meerweg: overal blijft minstens ~16 m oever over. Bij het dorp en in het zuidwesten blijft het gelijk.
const LAKE_GROW = [
  19, 16, 14, 15, 16, 15, 10, 2, 0, 0, 0, 6, 15, 20, 20, 20, 20, 20,
  20, 18, 11, 4, 0, 0, 0, 0, 0, 0, 3, 5, 7, 9, 12, 16, 18, 17
];
function lakeGrowAt(theta) {
  const n = LAKE_GROW.length;
  let t = (theta / (Math.PI * 2)) * n;
  t = ((t % n) + n) % n;
  const i1 = Math.floor(t);
  const f = t - i1;
  const p0 = LAKE_GROW[(i1 - 1 + n) % n];
  const p1 = LAKE_GROW[i1];
  const p2 = LAKE_GROW[(i1 + 1) % n];
  const p3 = LAKE_GROW[(i1 + 2) % n];
  // Catmull-Rom: vloeiende oeverlijn zonder knikken
  const v = 0.5 * ((2 * p1) + (-p0 + p2) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f * f + (-p0 + 3 * p1 - 3 * p2 + p3) * f * f * f);
  return Math.max(0, v);
}

export function getLakeShoreRadius(theta) {
  // Noordelijke helft flink groter (daar ligt de meerweg ver genoeg weg); zuidkant bij het dorp blijft gelijk
  const northGrow = Math.pow(Math.max(0, -Math.sin(theta)), 0.8) * 14;
  return 47 + Math.sin(theta * 2 - 0.4) * 6.0 + Math.cos(theta * 3 + 1.1) * 4.5 + Math.sin(theta * 5) * 1.8 + northGrow + lakeGrowAt(theta);
}

// Vuurtoreneiland: wat verder het (grotere) meer in, met vrij water rondom
export const SANDBAR_ISLAND = { x: 30, z: 2, r: 12 };

// Rivieren worden nu in roads.js gedefinieerd (nodig om bruggen op de nieuwe wegen automatisch te plaatsen)
export { riverCurves, VALLEY_POND, getDistToRivers };

export const ruralLots = [
  { netSamples: lakeSamples, u: 0.825, outward: true, dist: 17.5, type: 'cabin', yawOff: -0.1 },
  { netSamples: lakeSamples, u: 0.895, outward: true, dist: 18.0, type: 'house_red', yawOff: 0.1 },
  { netSamples: valleySamples, u: 0.16, outward: true, dist: 18.0, type: 'cabin', yawOff: 0.05 },
  { netSamples: valleySamples, u: 0.28, outward: false, dist: 17.5, type: 'house_red', yawOff: -0.08 },
  // Politiebureau (Sheriff's Office) tussen het dorp en het vliegveld
  {
    netSamples: valleySamples, u: 0.36, outward: true, dist: 19.0, type: 'police', yawOff: 0,
    drivewayStopShort: 8.9, flatElevOffset: -0.12,
    flatBox: { minLX: -14.5, maxLX: 14.5, minLZ: -13, maxLZ: 12, blend: 10 }
  },

  // Supermarkt & Pinewood Mall op het vlakke noordoostelijke stuk van de meerweg (u=0.055, vlakke weg!).
  // flatBox legt het hele winkelcentrum én de hele parkeerplaats tot aan de wegrand 100% waterpas.
  {
    netSamples: lakeSamples,
    u: 0.055,
    outward: true,
    dist: 35.0, // 4 m verder van de weg: ruimte voor de reclamezuil voor de parkeerplaats
    type: 'store',
    yawOff: 0,
    // Brede geasfalteerde inrit van de weg tot aan de rand van de parkeerplaats (lz = 23.1)
    drivewayStopShort: 22.6,
    flatElevOffset: -0.06,
    flatBox: { minLX: -19.5, maxLX: 37.5, minLZ: -14.0, maxLZ: 26.0, blend: 12.0 }
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
  { netSamples: ringSamples, near: [200, 240], outward: false, dist: 22.0, type: 'villa', yawOff: 0.0, padRadius: 28, blendRadius: 40, frontLine: 13.6,
    // In- en uitrit: twee inritten van de weg naar de twee poorten (kavel-lokaal lx, lz van de poort)
    gateDriveways: [[-20.5, 6.5], [11.0, 13.5]] }, // links ligt de weg lager: die inrit loopt verder door (flauwe helling)
  { netSamples: ringSamples, near: [-55, 320], outward: false, dist: 18.0, type: 'house_red', yawOff: -0.06 },
  { netSamples: ringSamples, near: [-130, 303], outward: false, dist: 18.0, type: 'cabin', yawOff: 0.08 },

  // Fastfood-diner langs de strandboulevard (parkeerplaats sluit direct aan op de weg)
  {
    netSamples: ringSamples,
    near: [30, 321],
    outward: false,
    dist: 22.0,
    type: 'diner',
    drivewayStopShort: 14.0,
    yawOff: 0,
    flatElevOffset: -0.06,
    flatBox: { minLX: -32, maxLX: 12.5, minLZ: -19, maxLZ: 18.5, blend: 12 }
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
    drivewayStopShort: 14.4,
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
    drivewayStopShort: 7.4,
    flatElevOffset: -0.1,
    flatBox: { minLX: -13, maxLX: 12, minLZ: -11, maxLZ: 11, blend: 12 }
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
    type: 'motel',
    name: 'NORTH BEACH MOTEL',
    drivewayStopShort: 9.4,
    yawOff: 0,
    flatElevOffset: -0.05,
    flatBox: { minLX: -16, maxLX: 16, minLZ: -16, maxLZ: 20, blend: 12 }
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
    // Het erf ligt op de hoogte van het natuurlijke land (de weg ligt hier op een rug, veel hoger);
    // de akkers volgen het land en lopen af van de weg naar de boerderij
    yardFromNatural: true,
    raiseYard: true,
    blendOuter: 30,
    terrainBox: { minLX: -40, maxLX: 40, minLZ: -42, maxLZ: 0 },
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
    flatElevOffset: 0.9,
    raiseYard: true,
    blendOuter: 36,
    // Alleen het erf met de gebouwen wordt vlak gemaakt; de akkers ervoor volgen de natuurlijke glooiing
    terrainBox: { minLX: -40, maxLX: 40, minLZ: -40, maxLZ: 2 },
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
  if (lot.yardFromNatural && lot.terrainBox) {
    // Erfhoogte = gemiddelde natuurlijke hoogte onder het erf (niet de weghoogte)
    const tb = lot.terrainBox;
    const yaw0 = Math.atan2(-rs.nx * side, -rs.nz * side) + lot.yawOff;
    const cx = rs.x + rs.nx * side * lot.dist;
    const cz = rs.z + rs.nz * side * lot.dist;
    const c = Math.cos(yaw0);
    const s = Math.sin(yaw0);
    let sum = 0;
    let n = 0;
    for (let lx = tb.minLX; lx <= tb.maxLX; lx += 4) {
      for (let lz = tb.minLZ; lz <= tb.maxLZ; lz += 4) {
        sum += getNaturalGroundBase(cx + lx * c + lz * s, cz - lx * s + lz * c);
        n++;
      }
    }
    lot.y = Math.max(1.6, sum / n + 0.3);
  }
  lot.yaw = Math.atan2(-rs.nx * side, -rs.nz * side) + lot.yawOff;

  if (lot.gateDriveways) {
    // Meerdere inritten: van het dichtstbijzijnde wegpunt (wegrand) recht naar elke poort
    const cy = Math.cos(lot.yaw);
    const sy = Math.sin(lot.yaw);
    lot.gateDriveways.forEach(([glx, glz]) => {
      const gx = lot.x + glx * cy + glz * sy;
      const gz = lot.z - glx * sy + glz * cy;
      let best = null;
      let bestD = Infinity;
      lot.netSamples.forEach((smp) => {
        const d = (smp.x - gx) ** 2 + (smp.z - gz) ** 2;
        if (d < bestD) { bestD = d; best = smp; }
      });
      const sgn = (gx - best.x) * best.nx + (gz - best.z) * best.nz >= 0 ? 1 : -1;
      driveways.push({
        x1: best.x + best.nx * sgn * (best.halfWidth - 0.35),
        y1: best.y,
        z1: best.z + best.nz * sgn * (best.halfWidth - 0.35),
        x2: gx,
        y2: lot.y,
        z2: gz,
        halfWidth: 2.6,
        asphalt: false
      });
    });
  } else if (!lot.noDriveway) {
    driveways.push({
      x1: lot.roadX,
      y1: lot.roadY,
      z1: lot.roadZ,
      x2: rs.x + rs.nx * side * (lot.dist - (lot.drivewayStopShort ?? 0)),
      y2: lot.y,
      z2: rs.z + rs.nz * side * (lot.dist - (lot.drivewayStopShort ?? 0)),
      halfWidth: lot.type === 'farm' ? 3.2 : lot.type === 'store' ? 4.4 : ['cinema', 'diner', 'coffee', 'police', 'motel'].includes(lot.type) ? 3.4 : lot.type === 'villa' ? 2.8 : 2.5,
      asphalt: lot.type === 'store' || lot.type === 'cinema' || lot.type === 'airfield' || lot.type === 'coffee' || lot.type === 'police' || lot.type === 'diner' || lot.type === 'motel'
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
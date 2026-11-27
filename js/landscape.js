import * as THREE from 'three';

// =========================================================
// EILANDVORM, KUST, FJORD, BERGEN & MOOSE LAKE
// Pure functies (alleen THREE-math) zodat wegen én terrein dezelfde "natuurlijke" grond kennen.
// =========================================================
export const ISLAND_CENTER = { x: 0, z: 30 };
export const OCEAN_FLOOR = -7.0;

function angDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function bump(theta, center, sigma) {
  return Math.exp(-((angDiff(theta, center) / sigma) ** 2));
}

export function getIslandPolar(x, z) {
  const dx = x - ISLAND_CENTER.x;
  const dz = z - ISLAND_CENTER.z;
  return { r: Math.hypot(dx, dz), theta: Math.atan2(dz, dx) };
}

// Kustlijn-straal rondom het eilandcentrum (NW bolt uit voor het bergmassief)
export function getCoastRadius(theta) {
  return (
    335 +
    Math.sin(theta * 3 + 0.7) * 18 +
    Math.cos(theta * 5 - 0.3) * 10 +
    Math.sin(theta * 11 + 1.3) * 5 +
    bump(theta, -2.15, 0.5) * 85
  );
}

// 0 = zandstrand, 1 = steile rotskliffen
export function getCliffiness(theta) {
  const n = Math.sin(theta * 2 + 1.2) * 0.8 + Math.sin(theta * 5 - 0.4) * 0.4 + bump(theta, -2.15, 0.6) * 0.9;
  return THREE.MathUtils.smoothstep(n, -0.1, 0.45);
}

// Ringweg-straal (de kustweg) — iets naar binnen in het NW zodat het bergmassief erbuiten past
export function getRingRadius(theta) {
  return (
    246 +
    Math.sin(theta * 3 + 2.0) * 8 +
    Math.sin(theta * 7) * 4 -
    bump(theta, -2.15, 0.55) * 30 +
    bump(theta, 2.45, 0.35) * 12
  );
}

// Fjord in het noordoosten: een brede zee-inham die de kustweg met een hangbrug oversteekt
const FJORD_THETA = -0.72;
const fjordPts = [];
for (let k = 0; k <= 12; k++) {
  const t = k / 12;
  const r = THREE.MathUtils.lerp(172, 440, t);
  const th = FJORD_THETA + Math.sin(t * Math.PI * 1.4) * 0.05;
  fjordPts.push({
    x: ISLAND_CENTER.x + Math.cos(th) * r,
    z: ISLAND_CENTER.z + Math.sin(th) * r,
    hw: THREE.MathUtils.lerp(13, 34, t)
  });
}
export const FJORD = { theta: FJORD_THETA, points: fjordPts };

function getFjordSignedDist(x, z) {
  let best = Infinity;
  for (let i = 0; i < fjordPts.length - 1; i++) {
    const a = fjordPts[i];
    const b = fjordPts[i + 1];
    const abx = b.x - a.x;
    const abz = b.z - a.z;
    const t = THREE.MathUtils.clamp(((x - a.x) * abx + (z - a.z) * abz) / (abx * abx + abz * abz), 0, 1);
    const d = Math.hypot(x - (a.x + abx * t), z - (a.z + abz * t)) - THREE.MathUtils.lerp(a.hw, b.hw, t);
    if (d < best) best = d;
  }
  return best;
}

// Bergen: Mount Frost (besneeuwd), Eagle Peak (spiraalweg naar de top) en North Crag
function polarPoint(theta, r) {
  return { x: ISLAND_CENTER.x + Math.cos(theta) * r, z: ISLAND_CENTER.z + Math.sin(theta) * r };
}
const frostPos = polarPoint(-2.48, 350);
const eaglePos = polarPoint(-2.05, 312);
const cragPos = polarPoint(-1.76, 318);

export const MOUNTAINS = [
  { id: 'frost', name: 'Mount Frost', x: frostPos.x, z: frostPos.z, h: 74, s: 52, sharp: true },
  { id: 'eagle', name: 'Eagle Peak', x: eaglePos.x, z: eaglePos.z, h: 34, s: 40 },
  { id: 'crag', name: 'North Crag', x: cragPos.x, z: cragPos.z, h: 32, s: 30, sharp: true },
  { id: 'ridge', name: 'Frost Ridge', x: (frostPos.x + eaglePos.x) * 0.5 - 30, z: (frostPos.z + eaglePos.z) * 0.5 - 25, h: 30, s: 34, sharp: true }
];
export const EAGLE_PEAK = MOUNTAINS[1];

// Tweede meer in het zuidoosten met een lodge
const moosePos = polarPoint(0.62, 192);
export const MOOSE_LAKE = { x: moosePos.x, z: moosePos.z, r: 20 };

export function getNaturalGroundBase(x, z) {
  const r = Math.hypot(x, z - 25);
  const theta = Math.atan2(z - 25, x);

  const broadHills =
    Math.sin(x * 0.021 + 0.5) * Math.cos(z * 0.019 - 0.2) * 5.4 +
    Math.sin((x - z) * 0.016 + 1.1) * 3.5 +
    Math.cos(x * 0.038 + z * 0.035) * 1.25;

  const hillEast = Math.exp(-(((x - 54) ** 2 + (z - 124) ** 2) / (33 ** 2))) * 8.8;
  const hillWest = Math.exp(-(((x + 56) ** 2 + (z - 118) ** 2) / (35 ** 2))) * 8.2;

  // Glooiende hooglanden rondom de oude vallei (vervangt de oude bergmuur rond r=156)
  const uplandBlend = THREE.MathUtils.smoothstep(r, 135, 190);
  const uplands = uplandBlend * (2.6 + Math.sin(theta * 5 + 0.4) * 1.8 + Math.cos(theta * 8 - 0.6) * 1.2);

  let h = 3.5 + broadHills + hillEast + hillWest + uplands;

  // Buitengebied nooit onder water laten zakken (geen toevallige plassen op het land)
  const minOuter = THREE.MathUtils.lerp(-99, 1.3, THREE.MathUtils.smoothstep(r, 92, 125));
  h = Math.max(h, minOuter);

  for (const m of MOUNTAINS) {
    const d2 = (x - m.x) ** 2 + (z - m.z) ** 2;
    let g = Math.exp(-d2 / (m.s * m.s));
    // Spitse toppen: mix van een brede voet (gauss) en een scherpe piek (exponentieel)
    if (m.sharp) g = g * 0.45 + Math.exp(-Math.sqrt(d2) / (m.s * 0.5)) * 0.55;
    if (g > 0.002) {
      const crag = 1 + Math.sin(x * 0.17 + m.x) * Math.cos(z * 0.15 - m.z) * 0.12;
      h += m.h * g * crag;
    }
  }

  // Moose Lake (komvormig)
  const dMoose = Math.hypot(x - MOOSE_LAKE.x, z - MOOSE_LAKE.z);
  if (dMoose < MOOSE_LAKE.r + 16) {
    if (dMoose > MOOSE_LAKE.r - 6) {
      const t = THREE.MathUtils.smoothstep(dMoose, MOOSE_LAKE.r - 6, MOOSE_LAKE.r + 16);
      h = Math.min(h, THREE.MathUtils.lerp(-0.74, h, t));
    } else {
      const t = THREE.MathUtils.smoothstep(dMoose, MOOSE_LAKE.r - 14, MOOSE_LAKE.r - 6);
      h = Math.min(h, THREE.MathUtils.lerp(-2.6, -0.74, t));
    }
  }

  // Kust: strand of klif, daarna de oceaan
  const pol = getIslandPolar(x, z);
  const coastR = getCoastRadius(pol.theta);
  const inland = coastR - pol.r;
  if (inland < 45) {
    const cliff = getCliffiness(pol.theta);
    let beachH;
    if (inland >= 0) beachH = THREE.MathUtils.lerp(0.34, h, THREE.MathUtils.smoothstep(inland, 9, 38));
    else beachH = THREE.MathUtils.lerp(0.34, OCEAN_FLOOR, THREE.MathUtils.smoothstep(-inland, 0, 28));

    let cliffH;
    const cliffTop = Math.max(h, 6.5 + Math.sin(pol.theta * 13) * 1.6);
    if (inland >= 0) cliffH = THREE.MathUtils.lerp(cliffTop, h, THREE.MathUtils.smoothstep(inland, 6, 40));
    else cliffH = THREE.MathUtils.lerp(cliffTop, OCEAN_FLOOR, THREE.MathUtils.smoothstep(-inland, 0, 6));

    h = THREE.MathUtils.lerp(beachH, cliffH, cliff);
  }

  // Fjord met steile wanden
  const dFjord = getFjordSignedDist(x, z);
  if (dFjord < 10) {
    h = Math.min(h, THREE.MathUtils.lerp(OCEAN_FLOOR, h, THREE.MathUtils.smoothstep(dFjord, 0, 10)));
  }

  return h;
}

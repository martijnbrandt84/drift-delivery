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
    bump(theta, -2.15, 0.5) * 35
  );
}

// 0 = zandstrand, 1 = steile rotskliffen
export function getCliffiness(theta) {
  const n = Math.sin(theta * 2 + 1.2) * 0.8 + Math.sin(theta * 5 - 0.4) * 0.4 + bump(theta, -2.15, 0.6) * 0.5;
  return THREE.MathUtils.smoothstep(n, -0.1, 0.45);
}

// Beboste heuvels (geen bergen meer): glooiend bos in het noordwesten en wat heuvels in het oosten
export const FOREST_HILLS = [
  { x: -195, z: -95, h: 8.5, s: 34 },
  { x: -135, z: -160, h: 10.5, s: 40 },
  { x: -230, z: -175, h: 9.0, s: 42 },
  { x: -70, z: -228, h: 7.5, s: 34 },
  { x: -170, z: -235, h: 8.0, s: 36 },
  { x: 45, z: -205, h: 6.0, s: 30 },
  { x: 255, z: -55, h: 6.5, s: 38 },
  { x: -225, z: 15, h: 5.5, s: 30 }
];
// Uitkijktoren op de hoogste bosheuvel
export const LOOKOUT_HILL = FOREST_HILLS[1];

// Moose Lake: groter bosmeer in het zuidoosten met lodge
export const MOOSE_LAKE = { x: 212, z: 172, r: 31 };
// Fox Lake: tweede meertje aan de oostkant (waar vroeger het fjord lag)
export const FOX_LAKE = { x: 168, z: -66, r: 23 };
const INLAND_LAKES = [MOOSE_LAKE, FOX_LAKE];

export function getNaturalGroundBase(x, z) {
  // Snelle uitweg voor open zee (ruim de helft van het terreinraster)
  const pol0 = getIslandPolar(x, z);
  if (getCoastRadius(pol0.theta) - pol0.r < -32) return OCEAN_FLOOR;

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
  h += uplandBlend * (Math.sin(x * 0.045 + 0.7) * Math.cos(z * 0.05 - 1.1) * 1.6);

  // Buitengebied nooit onder water laten zakken (geen toevallige plassen op het land)
  const minOuter = THREE.MathUtils.lerp(-99, 1.3, THREE.MathUtils.smoothstep(r, 92, 125));
  h = Math.max(h, minOuter);

  // Bosheuvels + fijne golving in het buitengebied (leuk op-en-neer rijden)
  for (const m of FOREST_HILLS) {
    const g = Math.exp(-((x - m.x) ** 2 + (z - m.z) ** 2) / (m.s * m.s));
    if (g > 0.003) h += m.h * g;
  }

  // Moose Lake & Fox Lake (komvormig)
  for (const lake of INLAND_LAKES) {
    const dLake = Math.hypot(x - lake.x, z - lake.z);
    if (dLake >= lake.r + 16) continue;
    if (dLake > lake.r - 6) {
      const t = THREE.MathUtils.smoothstep(dLake, lake.r - 6, lake.r + 16);
      h = Math.min(h, THREE.MathUtils.lerp(-0.74, h, t));
    } else {
      const t = THREE.MathUtils.smoothstep(dLake, lake.r - 14, lake.r - 6);
      h = Math.min(h, THREE.MathUtils.lerp(-2.6, -0.74, t));
    }
  }

  // Kust: strand of klif, daarna de oceaan
  const pol = getIslandPolar(x, z);
  const coastR = getCoastRadius(pol.theta);
  const inland = coastR - pol.r;

  // Lage kustvlakte in het zuiden: de strandboulevard ligt hier vlak boven het strand
  const southPlain = bump(pol.theta, 1.5, 0.62) * (1 - THREE.MathUtils.smoothstep(inland, 45, 120));
  if (southPlain > 0.001) h = THREE.MathUtils.lerp(h, 2.0 + Math.sin(x * 0.03) * 0.4, southPlain * 0.9);
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


  return h;
}

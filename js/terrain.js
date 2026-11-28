import * as THREE from 'three';
import { scene, toonGradient } from './scene-setup.js';
import { TOWN_ELEV, WATER_LEVEL, getClosestNetworkRoad } from './roads.js';
import { getLakeShoreRadius, SANDBAR_ISLAND, getDistToRivers, ruralLots, driveways } from './water-lots.js';
import { getNaturalGroundBase, OCEAN_FLOOR, ISLAND_CENTER, getIslandPolar, getCoastRadius, MOOSE_LAKE, FOX_LAKE } from './landscape.js';

function getOrientedBoxDist(x, z, lot, minLX, maxLX, minLZ, maxLZ) {
  const dx = x - lot.x;
  const dz = z - lot.z;
  const c = Math.cos(lot.yaw);
  const s = Math.sin(lot.yaw);
  const lx = dx * c - dz * s;
  const lz = dx * s + dz * c;

  const overX = lx < minLX ? minLX - lx : lx > maxLX ? lx - maxLX : 0;
  const overZ = lz < minLZ ? minLZ - lz : lz > maxLZ ? lz - maxLZ : 0;
  return Math.hypot(overX, overZ);
}

// Snelle afstandsfilters zodat het terrein (170k punten) niet elke kavel/oprit hoeft door te rekenen
ruralLots.forEach((lot) => {
  const fb = lot.flatBox;
  lot.terrainReach = fb
    ? Math.hypot(Math.max(-fb.minLX, fb.maxLX), Math.max(-fb.minLZ, fb.maxLZ)) + 40
    : (lot.blendRadius ?? 18.0) + 1;
});
driveways.forEach((d) => {
  const m = d.halfWidth + 8;
  d.bbox = { minX: Math.min(d.x1, d.x2) - m, maxX: Math.max(d.x1, d.x2) + m, minZ: Math.min(d.z1, d.z2) - m, maxZ: Math.max(d.z1, d.z2) + m };
});

function getRawTerrainHeight(x, z) {
  let h = getNaturalGroundBase(x, z);
  // Open zee ver buiten de kust: niets anders te doen (rivieren eindigen ~30m buiten de kustlijn)
  if (h <= OCEAN_FLOOR && Math.hypot(x - ISLAND_CENTER.x, z - ISLAND_CENTER.z) > 300) return h;

  const dxTown = Math.max(0, Math.abs(x) - 45.5);
  const dzTown = z < 73 ? 73 - z : z > 138 ? z - 138 : 0;
  const distTownBox = Math.hypot(dxTown, dzTown);
  if (distTownBox < 24.0) {
    h = THREE.MathUtils.lerp(TOWN_ELEV - 0.20, h, THREE.MathUtils.smoothstep(distTownBox, 0.0, 24.0));
  }

  let specialFlatBlend = 1.0;
  let frontBeyond = -1; // afstand voorbij de voorgrens van een perceel met een muur langs de weg (villa)

  for (const lot of ruralLots) {
    if (Math.abs(x - lot.x) > lot.terrainReach || Math.abs(z - lot.z) > lot.terrainReach) continue;
    if (lot.type === 'store') {
      const dBox = getOrientedBoxDist(x, z, lot, -20.5, 38.3, -15.0, 23.6);
      if (dBox < 18.0) {
        const t = THREE.MathUtils.smoothstep(dBox, 0.0, 18.0);
        const targetY = lot.roadY - 0.16;
        h = THREE.MathUtils.lerp(targetY, h, t);
        specialFlatBlend = Math.min(specialFlatBlend, t);
      }
    } else if (lot.flatBox && lot.type !== 'farm') {
      const fb = lot.flatBox;
      const dBox = getOrientedBoxDist(x, z, lot, fb.minLX - 1, fb.maxLX + 1, fb.minLZ - 1, fb.maxLZ + 1);
      if (dBox < 16.0) {
        const t = THREE.MathUtils.smoothstep(dBox, 0.0, 16.0);
        h = THREE.MathUtils.lerp(lot.roadY - 0.16, h, t);
        specialFlatBlend = Math.min(specialFlatBlend, t);
      }
    } else if (lot.type === 'farm') {
      const fb = lot.terrainBox ?? lot.flatBox;
      const targetY = lot.raiseYard ? lot.y - 0.08 : Math.min(lot.y - 0.08, lot.roadY - 0.18);
      // Akkers tussen erf en weg (terrainBox): een glooiing die van het erf geleidelijk naar de weg afloopt.
      // Alleen bulten die hoger liggen dan die glooiing worden weggegraven; lager land (bijv. bij de rivier) blijft.
      if (lot.terrainBox) {
        const ffb = lot.flatBox;
        const dField = getOrientedBoxDist(x, z, lot, ffb.minLX, ffb.maxLX, fb.maxLZ, ffb.maxLZ + 4);
        const outerF = lot.blendOuter ?? 22.0;
        if (dField < outerF) {
          const c = Math.cos(lot.yaw);
          const s = Math.sin(lot.yaw);
          const lz = (x - lot.x) * s + (z - lot.z) * c;
          const roadLZ = lot.dist - 5.0;
          const f = THREE.MathUtils.clamp((lz - fb.maxLZ) / (roadLZ - fb.maxLZ), 0, 1);
          const rampY = THREE.MathUtils.lerp(targetY, lot.roadY - 0.22, f);
          const tF = THREE.MathUtils.smoothstep(dField, 0.0, outerF);
          h = THREE.MathUtils.lerp(Math.min(h, rampY), h, tF);
        }
      }
      const dBox = getOrientedBoxDist(x, z, lot, fb.minLX - 1, fb.maxLX + 1, fb.minLZ - 2, fb.maxLZ + 1.5);
      // Afgraven (land hoger dan het erf): lange, flauwe helling. Ophogen (lager land): kort talud, zodat
      // het erf geen grote aarden wal de omgeving (of een rivieroever) in duwt
      const outer = h > targetY ? (lot.blendOuter ?? 22.0) : 14.0;
      if (dBox < outer) {
        const t = THREE.MathUtils.smoothstep(dBox, 0.0, outer);
        h = THREE.MathUtils.lerp(targetY, h, t);
        specialFlatBlend = Math.min(specialFlatBlend, t);
      }
    } else {
      const dLot = Math.hypot(x - lot.x, z - lot.z);
      const padR = lot.padRadius ?? 8.8;
      const blendR = lot.blendRadius ?? 18.0;
      if (dLot < blendR) {
        const t = THREE.MathUtils.smoothstep(dLot, padR, blendR);
        h = THREE.MathUtils.lerp(lot.y, h, t);
        // Het huisperceel blijft vlak, ook vlak naast een (oplopende) weg
        specialFlatBlend = Math.min(specialFlatBlend, t);
        if (lot.frontLine != null) {
          const lzF = (x - lot.x) * Math.sin(lot.yaw) + (z - lot.z) * Math.cos(lot.yaw);
          if (lzF > lot.frontLine) frontBeyond = lzF - lot.frontLine;
        }
      }
    }
  }

  let nearDriveway = false;
  let gravelTarget = 0;
  let gravelW = 0; // grindinrit zonder plaat: het terrein is zelf de rijbaan, ook vlak bij de wegrand
  for (const d of driveways) {
    if (x < d.bbox.minX || x > d.bbox.maxX || z < d.bbox.minZ || z > d.bbox.maxZ) continue;
    const l2 = (d.x2 - d.x1) ** 2 + (d.z2 - d.z1) ** 2;
    if (l2 > 0) {
      const proj = THREE.MathUtils.clamp(((x - d.x1) * (d.x2 - d.x1) + (z - d.z1) * (d.z2 - d.z1)) / l2, 0, 1);
      const px = d.x1 + proj * (d.x2 - d.x1);
      const pz = d.z1 + proj * (d.z2 - d.z1);
      const dDrv = Math.hypot(x - px, z - pz);
      if (dDrv < d.halfWidth + 1.5) nearDriveway = true;
      if (dDrv < d.halfWidth + 7.5) {
        // (een grindinrit zonder eigen plaat ligt op het terrein zelf: dan geen verlaging voor de plaat)
        const drvTargetY = THREE.MathUtils.lerp(d.y1, d.y2, proj) - (d.noMesh ? 0.02 : 0.22);
        const w = THREE.MathUtils.smoothstep(dDrv, d.halfWidth + 1.2, d.halfWidth + 7.5);
        // De oprit zelf en een smalle berm ernaast altijd volledig vlak (anders groeit een heuvel over de oprit heen)
        const onDriveway = 1 - THREE.MathUtils.smoothstep(dDrv, d.halfWidth + 1.2, d.halfWidth + 4.0);
        const allowFactor = Math.max(specialFlatBlend, 1 - proj, onDriveway);
        if (d.noMesh && onDriveway > gravelW) { gravelW = onDriveway; gravelTarget = drvTargetY; }
        h = THREE.MathUtils.lerp(h, THREE.MathUtils.lerp(drvTargetY, h, w), allowFactor);
      }
    }
  }

  const { sample: rs, marginDist } = getClosestNetworkRoad(x, z);
  const riverSignedDist = getDistToRivers(x, z);

  if (rs && rs.onBridge && marginDist < 3.5) {
    // Houd het terrein onder een brug altijd ruim onder het brugdek zodat er geen groen vlak doorheen prikt
    h = Math.min(h, rs.y - 0.75);
  } else if (rs && !rs.onBridge && marginDist < 30.5) {
    // Ligt de weg hoger dan het land (aanloop naar een brug), dan loopt het talud breder en flauwer uit:
    // geen losse dijken in het landschap
    const raise = rs.y - 0.24 - h;
    const outer = raise > 0.5 ? 16.5 + Math.min(8.0, raise * 2.0) : 16.5;
    if (marginDist < outer) {
      const roadBlend = THREE.MathUtils.smoothstep(marginDist, 2.2, outer);
      const roadAdjustedH = THREE.MathUtils.lerp(rs.y - 0.24, h, roadBlend);
      // Op een oprit bepaalt de oprit zelf de hoogte (behalve direct aan de wegrand)
      let keepPlateau = marginDist <= 2.4 ? 1.0 : nearDriveway ? 0.0 : specialFlatBlend;
      // Berm tussen een voortuinmuur en de weg: één vloeiende helling van de muur naar de wegrand (geen trede)
      if (frontBeyond >= 0 && marginDist > 2.4 && !nearDriveway) {
        const f = frontBeyond / Math.max(0.3, frontBeyond + (marginDist - 2.4));
        keepPlateau = Math.max(keepPlateau, THREE.MathUtils.smoothstep(f, 0, 1));
      }
      h = THREE.MathUtils.lerp(h, roadAdjustedH, keepPlateau);
      if (marginDist <= 0.6) h = Math.min(h, rs.y - 0.26);
      if (gravelW > 0 && marginDist > 0) h = THREE.MathUtils.lerp(h, gravelTarget, gravelW * THREE.MathUtils.smoothstep(marginDist, 0, 1.0));
    }
  } else if (rs && rs.onBridge && marginDist < 12.0) {
    // Naast een brug: alleen terrein dat door/tegen het brugdek zou steken gaat omlaag, verder blijft de natuur
    h = Math.min(h, rs.y - 0.75 + Math.max(0, marginDist - 3.5) * 0.8);
  }

  const rLake = Math.hypot(x, z);
  const thetaLake = Math.atan2(z, x);
  const shoreR = getLakeShoreRadius(thetaLake);
  if (rLake < shoreR + 18.0) {
    if (rLake > shoreR - 7.5) {
      const tShallow = THREE.MathUtils.smoothstep(rLake, shoreR - 7.5, shoreR + 18.0);
      h = Math.min(h, THREE.MathUtils.lerp(-0.74, h, tShallow));
    } else {
      const tDeep = THREE.MathUtils.smoothstep(rLake, shoreR - 15.0, shoreR - 7.5);
      h = Math.min(h, THREE.MathUtils.lerp(-2.6, -0.74, tDeep));
    }
  }

  // Geen onnatuurlijk diepe gaten in het centrale meer/rivierdal (gaf een donker vierkant onder de westbrug)
  if (rLake < 150) h = Math.max(h, -2.8);

  const dIsland = Math.hypot(x - SANDBAR_ISLAND.x, z - SANDBAR_ISLAND.z);
  if (dIsland < SANDBAR_ISLAND.r + 9.0) {
    const islandH = THREE.MathUtils.lerp(1.15, -0.62, THREE.MathUtils.smoothstep(dIsland, SANDBAR_ISLAND.r * 0.45, SANDBAR_ISLAND.r + 9.0));
    h = Math.max(h, islandH);
  }
  const FORD = getFord();
  const fordProj = THREE.MathUtils.clamp(((x - FORD.ax) * FORD.dx + (z - FORD.az) * FORD.dz) / FORD.len2, 0, 1);
  const fordDist = Math.hypot(x - (FORD.ax + fordProj * FORD.dx), z - (FORD.az + fordProj * FORD.dz));
  if (fordDist < 7.5) {
    h = Math.max(h, THREE.MathUtils.lerp(-0.56, -1.5, THREE.MathUtils.smoothstep(fordDist, 3.5, 7.5)));
  }

  // Samenvloeiing Pond Creek / Bear River: laag zandig puntje tussen de twee monden
  {
    if (!CONFLUENCE_SPIT) CONFLUENCE_SPIT = { x: -106.5, z: 42.5 };
    const dSpit = Math.hypot(x - CONFLUENCE_SPIT.x, z - CONFLUENCE_SPIT.z);
    if (dSpit < 10) h = Math.min(h, THREE.MathUtils.lerp(0.15, h, THREE.MathUtils.smoothstep(dSpit, 3.5, 10)));
  }

  if (riverSignedDist < 8.5) {
    const isSouthCreek = z > 115;
    const bedDepth = isSouthCreek ? -0.68 : -1.95;
    h = Math.min(h, THREE.MathUtils.lerp(bedDepth, h, THREE.MathUtils.smoothstep(riverSignedDist, -2.0, 8.5)));
  }

  // Verdwaalde plassen opvullen: water dat niet bij een rivier, meer of de zee hoort (bijv. waar het
  // natuurlijke land laag lag en alleen de wegtaluds zijn opgehoogd) wordt een lage, natuurlijke oeverzone.
  // De oever loopt geleidelijk op vanaf het water (rivieren, meren): van net onder het waterpeil naar
  // ~0,8 m erboven over ~9 m. Zo valt de waterlijn op een echte helling en loopt hij glad, in plaats van
  // trapjes langs het terreinraster op een vrijwel vlakke rand.
  if (h < 0.8) {
    const pol = getIslandPolar(x, z);
    const awayFromSea = pol.r < getCoastRadius(pol.theta) - 10;
    if (awayFromSea) {
      const wetDist = Math.min(
        riverSignedDist,
        rLake - shoreR,
        Math.hypot(x - MOOSE_LAKE.x, z - MOOSE_LAKE.z) - MOOSE_LAKE.r,
        Math.hypot(x - FOX_LAKE.x, z - FOX_LAKE.z) - FOX_LAKE.r
      );
      if (wetDist > 0) {
        const floor = THREE.MathUtils.lerp(WATER_LEVEL - 0.7, 0.8, THREE.MathUtils.smoothstep(wetDist, -1.0, 9.0));
        h = Math.max(h, floor);
      }
    }
  }

  // Laatste stap: onder een weg en zijn berm komt het terrein nooit lager dan de weg
  // (geen zwevende aanloop naar een brug, wat oevers, plassen of zandbanken eerder ook deden)
  if (rs && !rs.onBridge && marginDist < 2.4 && !nearDriveway) h = Math.max(h, rs.y - 0.3);

  return h;
}

// =========================================================
// GEBAKKEN TERREIN + O(1) DRIVESURFACE GRID VOOR 60FPS!
// =========================================================
export const TERRAIN_SIZE = 880;
const TERRAIN_SEGMENTS = 410;
const groundGeo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, TERRAIN_SEGMENTS, TERRAIN_SEGMENTS);
groundGeo.rotateX(-Math.PI / 2);

const gPos = groundGeo.attributes.position;
const stride = TERRAIN_SEGMENTS + 1;
const heightGrid = new Float32Array(stride * stride);
export const autumnVertexColors = new Float32Array(gPos.count * 3);
export const winterVertexColors = new Float32Array(gPos.count * 3);

const cMeadow = new THREE.Color(0x7fa650);
const cHighHillGrass = new THREE.Color(0xa6b54c);
const cTownLawn = new THREE.Color(0x88b359);
const cForestFloor = new THREE.Color(0x668c44);
const cSand = new THREE.Color(0xe6c284);
const cShallowSand = new THREE.Color(0xd9b373);
const cCliffRock = new THREE.Color(0x9a8978);

const cSnowPure = new THREE.Color(0xf4f8fc);
const cSnowWarm = new THREE.Color(0xe4edf7);
const cSnowShore = new THREE.Color(0xdce4ec);
const cSnowRock = new THREE.Color(0xb0b8c2);

for (let i = 0; i < gPos.count; i++) {
  const vy = getRawTerrainHeight(gPos.getX(i), gPos.getZ(i));
  gPos.setY(i, vy);
  heightGrid[i] = vy;
}

const cellSize = TERRAIN_SIZE / TERRAIN_SEGMENTS;
const cSnowCap = new THREE.Color(0xf7fbff);
const cAlpineRock = new THREE.Color(0x8a8079);
const cDeepSea = new THREE.Color(0x3d7f8f);
const tmpColA = new THREE.Color();
const tmpColW = new THREE.Color();

for (let i = 0; i < gPos.count; i++) {
  const vx = gPos.getX(i);
  const vz = gPos.getZ(i);
  const vy = heightGrid[i];

  // Helling uit het hoogteraster (voor kliffen en rotswanden)
  const ix = i % stride;
  const iz = Math.floor(i / stride);
  const hL = heightGrid[iz * stride + Math.max(0, ix - 1)];
  const hR = heightGrid[iz * stride + Math.min(stride - 1, ix + 1)];
  const hU = heightGrid[Math.max(0, iz - 1) * stride + ix];
  const hD = heightGrid[Math.min(stride - 1, iz + 1) * stride + ix];
  const slope = Math.hypot(hR - hL, hD - hU) / (2 * cellSize);

  const colA = tmpColA;
  const colW = tmpColW;
  const inTownArea = vx > -45 && vx < 45 && vz > 75 && vz < 137;
  const snowLine = 31 + Math.sin(vx * 0.07) * Math.cos(vz * 0.06) * 3.5;

  if (vy > snowLine && vy > 2) {
    colA.copy(slope > 1.25 ? cSnowRock : cSnowCap);
    colW.copy(slope > 1.25 ? cSnowRock : cSnowPure);
  } else if (slope > 0.85 || (vy > 13.0 && slope > 0.62)) {
    colA.copy(cCliffRock);
    colW.copy(cSnowRock);
  } else if (inTownArea) {
    colA.copy(cTownLawn);
    colW.copy(cSnowPure);
  } else {
    const n1 = (Math.sin(vx * 0.04 + vz * 0.035) + 1) * 0.5;
    const hillTint = THREE.MathUtils.clamp((vy - 3.5) / 8.0, 0, 1);
    colA.lerpColors(cForestFloor, cMeadow, n1);
    colA.lerp(cHighHillGrass, hillTint * 0.55);
    // Zachte overgang naar kliffen
    colA.lerp(cCliffRock, THREE.MathUtils.smoothstep(slope, 0.55, 0.85) * 0.6);
    colW.lerpColors(cSnowWarm, cSnowPure, n1 * 0.6 + hillTint * 0.4);
  }
  // Oevers: geleidelijke overgangen gras -> zand -> ondiep -> diep water (geen harde kleurgrens per
  // rasterpunt, want die geeft een zigzag-rand van 'haaientanden' langs de waterlijn)
  if (!inTownArea) {
    const sandF = (1 - THREE.MathUtils.smoothstep(vy, 0.2, 0.85)) * (1 - THREE.MathUtils.smoothstep(slope, 0.45, 0.75));
    colA.lerp(cSand, sandF);
    colW.lerp(cSnowShore, sandF);
  }
  const wetF = 1 - THREE.MathUtils.smoothstep(vy, -0.4, 0.0);
  colA.lerp(cShallowSand, wetF);
  colW.lerp(cSnowShore, wetF);
  const deepF = 1 - THREE.MathUtils.smoothstep(vy, -3.6, -2.6);
  colA.lerp(cDeepSea, deepF);
  colW.lerp(cDeepSea, deepF);

  autumnVertexColors[i * 3] = colA.r;
  autumnVertexColors[i * 3 + 1] = colA.g;
  autumnVertexColors[i * 3 + 2] = colA.b;

  winterVertexColors[i * 3] = colW.r;
  winterVertexColors[i * 3 + 1] = colW.g;
  winterVertexColors[i * 3 + 2] = colW.b;
}

export const groundColorAttr = new THREE.BufferAttribute(autumnVertexColors.slice(), 3);
groundGeo.setAttribute('color', groundColorAttr);
groundGeo.computeVertexNormals();

const terrainMesh = new THREE.Mesh(groundGeo, new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonGradient }));
terrainMesh.receiveShadow = true;
scene.add(terrainMesh);

// Ondiepe doorwaadplaats: van het vuurtoreneiland recht naar de oostoever van het meer
// (lui berekend: het terrein wordt al bij het laden van modules gebakken)
var CONFLUENCE_SPIT;
var fordCache;
function getFord() {
  if (fordCache) return fordCache;
  const ang = Math.atan2(SANDBAR_ISLAND.z, SANDBAR_ISLAND.x);
  const shore = getLakeShoreRadius(ang) + 1.5;
  const dx = Math.cos(ang) * shore - SANDBAR_ISLAND.x;
  const dz = Math.sin(ang) * shore - SANDBAR_ISLAND.z;
  fordCache = { ax: SANDBAR_ISLAND.x, az: SANDBAR_ISLAND.z, dx, dz, len2: dx * dx + dz * dz };
  return fordCache;
}

export function getTerrainHeight(x, z) {
  const half = TERRAIN_SIZE * 0.5;
  const gx = THREE.MathUtils.clamp(((x + half) / TERRAIN_SIZE) * TERRAIN_SEGMENTS, 0, TERRAIN_SEGMENTS - 0.001);
  const gz = THREE.MathUtils.clamp(((z + half) / TERRAIN_SIZE) * TERRAIN_SEGMENTS, 0, TERRAIN_SEGMENTS - 0.001);

  const ix = Math.floor(gx);
  const iz = Math.floor(gz);
  const fx = gx - ix;
  const fz = gz - iz;

  const h00 = heightGrid[iz * stride + ix];
  const h10 = heightGrid[iz * stride + ix + 1];
  const h01 = heightGrid[(iz + 1) * stride + ix];
  const h11 = heightGrid[(iz + 1) * stride + ix + 1];

  const h0 = h00 + (h10 - h00) * fx;
  const h1 = h01 + (h11 - h01) * fx;
  return h0 + (h1 - h0) * fz;
}

export function getLocalSlope(x, z, sampleDist = 1.2) {
  const dzSlope = (getTerrainHeight(x, z + sampleDist) - getTerrainHeight(x, z - sampleDist)) / (2 * sampleDist);
  const dxSlope = (getTerrainHeight(x + sampleDist, z) - getTerrainHeight(x - sampleDist, z)) / (2 * sampleDist);
  return Math.hypot(dxSlope, dzSlope);
}

// Diepe oceaanbodem onder en rondom het eiland (zodat de horizon overal zee is)
const seaFloor = new THREE.Mesh(
  new THREE.PlaneGeometry(4200, 4200, 1, 1).rotateX(-Math.PI / 2),
  new THREE.MeshToonMaterial({ color: 0x2f6f82, gradientMap: toonGradient })
);
seaFloor.position.y = OCEAN_FLOOR - 0.3;
scene.add(seaFloor);

export const waterGeo = new THREE.PlaneGeometry(4200, 4200, 70, 70);
waterGeo.rotateX(-Math.PI / 2);
export const waterMat = new THREE.MeshToonMaterial({
  color: 0x43adc4,
  gradientMap: toonGradient,
  transparent: true,
  opacity: 0.78
});
export const waterMesh = new THREE.Mesh(waterGeo, waterMat);
waterMesh.position.y = WATER_LEVEL;
scene.add(waterMesh);

const waterBaseXZ = waterGeo.attributes.position.array.slice();
export function updateWaterWaves(elapsed) {
  const posAttr = waterGeo.attributes.position;
  const arr = posAttr.array;
  for (let i = 0; i < arr.length; i += 3) {
    const x = waterBaseXZ[i];
    const z = waterBaseXZ[i + 2];
    arr[i + 1] = Math.sin(x * 0.12 + elapsed * 1.4) * 0.09 + Math.cos(z * 0.09 - elapsed * 1.1) * 0.07;
  }
  posAttr.needsUpdate = true;
  waterGeo.computeVertexNormals();
}
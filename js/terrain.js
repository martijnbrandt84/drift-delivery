import * as THREE from 'three';
import { scene, toonGradient } from './scene-setup.js';
import { TOWN_ELEV, WATER_LEVEL, getClosestNetworkRoad } from './roads.js';
import { getLakeShoreRadius, SANDBAR_ISLAND, getDistToRivers, ruralLots, driveways } from './water-lots.js';

function getNaturalGroundBase(x, z) {
  const r = Math.hypot(x, z - 25);
  const theta = Math.atan2(z - 25, x);

  const outerMountains = Math.max(0, (r - 156) * 0.38);
  const mountainPeaks = Math.max(0, r - 135) * (Math.sin(theta * 5 + 0.4) * 0.14 + Math.cos(theta * 8 - 0.6) * 0.09);

  const broadHills =
    Math.sin(x * 0.021 + 0.5) * Math.cos(z * 0.019 - 0.2) * 5.4 +
    Math.sin((x - z) * 0.016 + 1.1) * 3.5 +
    Math.cos(x * 0.038 + z * 0.035) * 1.25;

  const hillEast = Math.exp(-(((x - 54) ** 2 + (z - 124) ** 2) / (33 ** 2))) * 8.8;
  const hillWest = Math.exp(-(((x + 56) ** 2 + (z - 118) ** 2) / (35 ** 2))) * 8.2;

  return 3.5 + broadHills + hillEast + hillWest + outerMountains + mountainPeaks;
}

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

function getRawTerrainHeight(x, z) {
  let h = getNaturalGroundBase(x, z);

  const dxTown = Math.max(0, Math.abs(x) - 45.5);
  const dzTown = z < 73 ? 73 - z : z > 138 ? z - 138 : 0;
  const distTownBox = Math.hypot(dxTown, dzTown);
  if (distTownBox < 24.0) {
    h = THREE.MathUtils.lerp(TOWN_ELEV - 0.20, h, THREE.MathUtils.smoothstep(distTownBox, 0.0, 24.0));
  }

  let specialFlatBlend = 1.0;

  for (const lot of ruralLots) {
    if (lot.type === 'store') {
      const dBox = getOrientedBoxDist(x, z, lot, -20.5, 20.5, -15.0, 19.5);
      if (dBox < 18.0) {
        const t = THREE.MathUtils.smoothstep(dBox, 0.0, 18.0);
        const targetY = lot.roadY - 0.16;
        h = THREE.MathUtils.lerp(targetY, h, t);
        specialFlatBlend = Math.min(specialFlatBlend, t);
      }
    } else if (lot.type === 'farm') {
      const dBox = getOrientedBoxDist(x, z, lot, -31.5, 31.5, -32.0, 29.0);
      if (dBox < 22.0) {
        const t = THREE.MathUtils.smoothstep(dBox, 0.0, 22.0);
        const targetY = Math.min(lot.y - 0.08, lot.roadY - 0.18);
        h = THREE.MathUtils.lerp(targetY, h, t);
        specialFlatBlend = Math.min(specialFlatBlend, t);
      }
    } else {
      const dLot = Math.hypot(x - lot.x, z - lot.z);
      const padR = lot.padRadius ?? 8.8;
      const blendR = lot.blendRadius ?? 18.0;
      if (dLot < blendR) {
        h = THREE.MathUtils.lerp(lot.y, h, THREE.MathUtils.smoothstep(dLot, padR, blendR));
      }
    }
  }

  for (const d of driveways) {
    const l2 = (d.x2 - d.x1) ** 2 + (d.z2 - d.z1) ** 2;
    if (l2 > 0) {
      const proj = THREE.MathUtils.clamp(((x - d.x1) * (d.x2 - d.x1) + (z - d.z1) * (d.z2 - d.z1)) / l2, 0, 1);
      const px = d.x1 + proj * (d.x2 - d.x1);
      const pz = d.z1 + proj * (d.z2 - d.z1);
      const dDrv = Math.hypot(x - px, z - pz);
      if (dDrv < d.halfWidth + 7.5) {
        const drvTargetY = THREE.MathUtils.lerp(d.y1, d.y2, proj) - 0.22;
        const w = THREE.MathUtils.smoothstep(dDrv, d.halfWidth + 1.2, d.halfWidth + 7.5);
        const allowFactor = Math.max(specialFlatBlend, 1 - proj);
        h = THREE.MathUtils.lerp(h, THREE.MathUtils.lerp(drvTargetY, h, w), allowFactor);
      }
    }
  }

  const { sample: rs, marginDist } = getClosestNetworkRoad(x, z);
  const riverSignedDist = getDistToRivers(x, z);

  if (rs && rs.onBridge && marginDist < 3.5) {
    // Houd het terrein onder een brug altijd ruim onder het brugdek zodat er geen groen vlak doorheen prikt
    h = Math.min(h, rs.y - 0.75);
  } else if (rs && !rs.onBridge && marginDist < 16.5) {
    const roadBlend = THREE.MathUtils.smoothstep(marginDist, 2.2, 16.5);
    const roadAdjustedH = THREE.MathUtils.lerp(rs.y - 0.24, h, roadBlend);
    const keepPlateau = marginDist <= 2.4 ? 1.0 : specialFlatBlend;
    h = THREE.MathUtils.lerp(h, roadAdjustedH, keepPlateau);
    if (marginDist <= 0.6) h = Math.min(h, rs.y - 0.26);
  } else if (rs && rs.onBridge && Math.abs(rs.bridgeNorm) > 0.76 && marginDist < 8.0) {
    h = Math.min(h, rs.baseElev - 0.45);
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

  const dIsland = Math.hypot(x - SANDBAR_ISLAND.x, z - SANDBAR_ISLAND.z);
  if (dIsland < SANDBAR_ISLAND.r + 9.0) {
    const islandH = THREE.MathUtils.lerp(0.65, -0.62, THREE.MathUtils.smoothstep(dIsland, SANDBAR_ISLAND.r * 0.45, SANDBAR_ISLAND.r + 9.0));
    h = Math.max(h, islandH);
  }
  const fordProj = THREE.MathUtils.clamp(((x - 24) * 24 + (z - 6) * 4) / (24 * 24 + 16), 0, 1);
  const fordDist = Math.hypot(x - (24 + fordProj * 24), z - (6 + fordProj * 4));
  if (fordDist < 7.5) {
    h = Math.max(h, THREE.MathUtils.lerp(-0.56, -1.5, THREE.MathUtils.smoothstep(fordDist, 3.5, 7.5)));
  }

  if (riverSignedDist < 8.5) {
    const isSouthCreek = z > 115;
    const bedDepth = isSouthCreek ? -0.68 : -1.95;
    h = Math.min(h, THREE.MathUtils.lerp(bedDepth, h, THREE.MathUtils.smoothstep(riverSignedDist, -2.0, 8.5)));
  }

  return h;
}

// =========================================================
// GEBAKKEN TERREIN + O(1) DRIVESURFACE GRID VOOR 60FPS!
// =========================================================
export const TERRAIN_SIZE = 540;
const TERRAIN_SEGMENTS = 260;
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
  const vx = gPos.getX(i);
  const vz = gPos.getZ(i);
  const vy = getRawTerrainHeight(vx, vz);
  gPos.setY(i, vy);
  heightGrid[i] = vy;

  const colA = new THREE.Color();
  const colW = new THREE.Color();
  const inTownArea = vx > -45 && vx < 45 && vz > 75 && vz < 137;

  if (vy < -0.05) {
    colA.copy(cShallowSand);
    colW.copy(cShallowSand);
  } else if (vy < 0.48) {
    colA.copy(cSand);
    colW.copy(cSnowShore);
  } else if (vy > 13.0) {
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
    colW.lerpColors(cSnowWarm, cSnowPure, n1 * 0.6 + hillTint * 0.4);
  }

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

export const waterGeo = new THREE.PlaneGeometry(540, 540, 24, 24);
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
import * as THREE from 'three';
import { scene, createOutlinedMesh, makeToonMat, registerSeasonalMat } from './scene-setup.js';
import {
  WATER_LEVEL, getClosestNetworkRoad, lakeCurve, getLakeLoopBaseElev, getLakeBridgeAtU, valleyCurve, getValleyBaseElev, getValleyBridgeAtU
} from './roads.js';
import { getLakeShoreRadius, SANDBAR_ISLAND, getDistToRivers, ruralLots } from './water-lots.js';
import { hardColliders, registerDestructible } from './demolition.js';
import { createPineFast, createShrubFast } from './props.js';
import { getTerrainHeight } from './terrain.js';
import { tagMap } from './map-tags.js';

// Tekst op borden: altijd net vóór het bord tekenen (geen flikkeren/wegvallen op afstand)
// Borden: echte sRGB-kleuren en geen filmische tonemapping, zodat rood rood blijft en tekst scherp is
const SIGN_MAT_OPTS = { polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, toneMapped: false };
// =========================================================
// GROENE WEGBORDEN, STEIGER, VUURTOREN, LICHTSTRAAL & RIET
// =========================================================
function sampleCurvePoint(curve, elevFn, bridgeFn, u) {
  const pt = curve.getPointAt(u);
  const tan = curve.getTangentAt(u);
  const len2D = Math.hypot(tan.x, tan.z) || 1;
  const tx = tan.x / len2D;
  const tz = tan.z / len2D;
  const bInfo = bridgeFn ? bridgeFn(u) : { archY: 0 };
  return { x: pt.x, y: elevFn(u) + (bInfo.archY || 0), z: pt.z, tx, tz, nx: -tz, nz: tx };
}

function makeSignCanvasTexture(lines) {
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#1f6b3a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lineHeight = canvas.height / (lines.length + 1);
  lines.forEach((line, i) => {
    ctx.font = `bold ${i === 0 ? 38 : 28}px system-ui, sans-serif`;
    ctx.fillText(line, canvas.width / 2, lineHeight * (i + 1));
  });
  const tex = Object.assign(new THREE.CanvasTexture(canvas), { colorSpace: THREE.SRGBColorSpace });
  tex.needsUpdate = true;
  return tex;
}

const signPostMat = makeToonMat(0x3a3f33);
const signBackingMat = makeToonMat(0x1f6b3a);

export function createRoadSign(x, z, baseY, yaw, lines) {
  // Staat het bord te dicht bij (of op) de weg, schuif het dan de berm in
  {
    const rs = getClosestNetworkRoad(x, z);
    if (rs.sample && rs.marginDist < 1.8) {
      let dx = x - rs.sample.x;
      let dz = z - rs.sample.z;
      const l = Math.hypot(dx, dz) || 1;
      dx /= l;
      dz /= l;
      const shift = 1.8 - rs.marginDist;
      x += dx * shift;
      z += dz * shift;
      baseY = Math.max(baseY, getTerrainHeight(x, z));
    }
  }
  const g = new THREE.Group();
  const tex = makeSignCanvasTexture(lines);
  const panelW = 2.0;
  const panelH = 1.0;
  const panelMat = new THREE.MeshBasicMaterial({ map: tex, ...SIGN_MAT_OPTS });

  const panelBack = createOutlinedMesh(new THREE.BoxGeometry(panelW, panelH, 0.06), signBackingMat, 0.025, false);
  panelBack.position.set(0, 2.1, 0.02);
  g.add(panelBack);

  const frontFace = new THREE.Mesh(new THREE.PlaneGeometry(panelW - 0.12, panelH - 0.12), panelMat);
  frontFace.position.set(0, 2.1, 0.052);
  g.add(frontFace);

  const backFace = new THREE.Mesh(new THREE.PlaneGeometry(panelW - 0.12, panelH - 0.12), panelMat);
  backFace.position.set(0, 2.1, -0.012);
  backFace.rotation.y = Math.PI;
  g.add(backFace);

  const post = createOutlinedMesh(new THREE.CylinderGeometry(0.065, 0.085, 2.35, 6), signPostMat, 0.02, false);
  post.position.set(0, 1.175, -0.065);
  g.add(post);

  g.position.set(x, baseY, z);
  g.rotation.y = yaw;
  scene.add(g);
  registerDestructible(g, x, baseY, z, 0.55, 'small', 15, 'Wegwijzer');
}

function buildRoadSigns() {
  const entering = sampleCurvePoint(lakeCurve, getLakeLoopBaseElev, getLakeBridgeAtU, 0.415);
  const enterOutSign = entering.x * entering.nx + entering.z * entering.nz >= 0 ? 1 : -1;
  createRoadSign(
    entering.x + entering.nx * enterOutSign * 6.8,
    entering.z + entering.nz * enterOutSign * 6.8,
    getTerrainHeight(entering.x + entering.nx * enterOutSign * 6.8, entering.z + entering.nz * enterOutSign * 6.8),
    Math.atan2(entering.tx, entering.tz),
    ['PINEWOOD CREEK', 'Welkom!']
  );

  const leaving = sampleCurvePoint(lakeCurve, getLakeLoopBaseElev, getLakeBridgeAtU, 0.585);
  const leaveOutSign = leaving.x * leaving.nx + leaving.z * leaving.nz >= 0 ? 1 : -1;
  createRoadSign(
    leaving.x + leaving.nx * leaveOutSign * 6.8,
    leaving.z + leaving.nz * leaveOutSign * 6.8,
    getTerrainHeight(leaving.x + leaving.nx * leaveOutSign * 6.8, leaving.z + leaving.nz * leaveOutSign * 6.8),
    Math.atan2(-leaving.tx, -leaving.tz),
    ['TOT ZIENS', 'Pinewood Creek']
  );

  const valleyStart = sampleCurvePoint(valleyCurve, getValleyBaseElev, getValleyBridgeAtU, 0.095);
  const vOutSign = valleyStart.x * valleyStart.nx + valleyStart.z * valleyStart.nz >= 0 ? 1 : -1;
  createRoadSign(
    valleyStart.x + valleyStart.nx * vOutSign * 6.8,
    valleyStart.z + valleyStart.nz * vOutSign * 6.8,
    getTerrainHeight(valleyStart.x + valleyStart.nx * vOutSign * 6.8, valleyStart.z + valleyStart.nz * vOutSign * 6.8),
    Math.atan2(valleyStart.tx, valleyStart.tz),
    ['VALLEY ROAD']
  );

  ruralLots.filter((l) => l.type === 'farm').forEach((farmLot) => {
    // Bord naast de oprit, ~9m vanaf de weg
    const t = Math.min(0.35, 9 / Math.hypot(farmLot.x - farmLot.roadX, farmLot.z - farmLot.roadZ));
    const signX = farmLot.roadX + (farmLot.x - farmLot.roadX) * t - Math.cos(farmLot.yaw) * 4.2;
    const signZ = farmLot.roadZ + (farmLot.z - farmLot.roadZ) * t + Math.sin(farmLot.yaw) * 4.2;
    createRoadSign(signX, signZ, getTerrainHeight(signX, signZ), farmLot.yaw, [farmLot.name ?? 'FARM']);
  });
}
buildRoadSigns();

// =========================================================
// HOUTEN STEIGER AAN HET MEER
// =========================================================
const PIER_THETA = -1.9;

function buildLakePier() {
  const theta = PIER_THETA;
  const shoreR = getLakeShoreRadius(theta);
  const innerR = shoreR - 1.0;
  const outerR = shoreR + 9.0;
  const ct = Math.cos(theta);
  const st = Math.sin(theta);
  const x1 = ct * innerR;
  const z1 = st * innerR;
  const x2 = ct * outerR;
  const z2 = st * outerR;

  const dx = x2 - x1;
  const dz = z2 - z1;
  const length = Math.hypot(dx, dz);
  const tx = dx / length;
  const tz = dz / length;
  const nx = -tz;
  const nz = tx;
  const yaw = Math.atan2(tx, tz);
  const baseY = WATER_LEVEL + 0.32;

  const plankMat = makeToonMat(0x8a6a44);
  const postMat = makeToonMat(0x5c432b);

  const deck = createOutlinedMesh(new THREE.BoxGeometry(2.0, 0.22, length), plankMat, 0.035, false, true);
  deck.position.set((x1 + x2) * 0.5, baseY, (z1 + z2) * 0.5);
  deck.rotation.y = yaw;
  scene.add(deck);

  for (let i = 0; i <= 5; i++) {
    const t = i / 5;
    const px = THREE.MathUtils.lerp(x1, x2, t);
    const pz = THREE.MathUtils.lerp(z1, z2, t);
    [-0.85, 0.85].forEach((side) => {
      const pile = createOutlinedMesh(new THREE.CylinderGeometry(0.1, 0.13, 1.6, 6), postMat, 0.02, false);
      pile.position.set(px + nx * side, baseY - 0.75, pz + nz * side);
      scene.add(pile);
    });
  }

  [-0.95, 0.95].forEach((side) => {
    const post = createOutlinedMesh(new THREE.CylinderGeometry(0.08, 0.1, 1.0, 6), postMat, 0.025, false);
    post.position.set(x2 + nx * side, baseY + 0.42, z2 + nz * side);
    scene.add(post);
  });

  hardColliders.push({ x: x1, z: z1, r: 1.2 });
}
buildLakePier();

// =========================================================
// RIET LANGS WATERKANT & STEIGER
// =========================================================
const reedBladeMat = registerSeasonalMat(0x5d8a3c, 0xc8d4c2);
const reedSeedMat = makeToonMat(0x8c6239);
const reedDummy = new THREE.Object3D();

function isNearTownArea(x, z, pad = 4) {
  return x >= -45 - pad && x <= 45 + pad && z >= 82 - pad && z <= 138 + pad;
}

function isNearLakePier(x, z) {
  const shoreR = getLakeShoreRadius(PIER_THETA);
  const px = Math.cos(PIER_THETA) * (shoreR + 4.0);
  const pz = Math.sin(PIER_THETA) * (shoreR + 4.0);
  return Math.hypot(x - px, z - pz) < 7.5;
}

function buildWaterReeds() {
  const reedSpots = [];

  const pierShoreR = getLakeShoreRadius(PIER_THETA);
  const pierDirX = Math.cos(PIER_THETA);
  const pierDirZ = Math.sin(PIER_THETA);
  const pierSideX = -pierDirZ;
  const pierSideZ = pierDirX;

  for (let i = 0; i < 18; i++) {
    const along = pierShoreR - 1.5 + Math.random() * 7.5;
    const side = (Math.random() < 0.5 ? -1 : 1) * (1.8 + Math.random() * 4.5);
    const rx = pierDirX * along + pierSideX * side;
    const rz = pierDirZ * along + pierSideZ * side;
    const ry = getTerrainHeight(rx, rz);
    if (ry > WATER_LEVEL - 0.55 && ry < WATER_LEVEL + 0.45) {
      reedSpots.push({ x: rx, z: rz, y: Math.max(ry, WATER_LEVEL - 0.15) });
    }
  }

  for (let step = 0; step < 95; step++) {
    const theta = (step / 95) * Math.PI * 2 + (Math.random() - 0.5) * 0.04;
    if (Math.abs(theta - PIER_THETA) < 0.07) continue;

    const shoreR = getLakeShoreRadius(theta);
    const r = shoreR + (Math.random() - 0.55) * 3.2;
    const rx = Math.cos(theta) * r;
    const rz = Math.sin(theta) * r;

    if (isNearTownArea(rx, rz, 6) || getDistToRivers(rx, rz) < 4.5) continue;
    const { marginDist } = getClosestNetworkRoad(rx, rz);
    if (marginDist < 3.0) continue;

    const ry = getTerrainHeight(rx, rz);
    if (ry < WATER_LEVEL - 0.65 || ry > WATER_LEVEL + 0.55) continue;

    reedSpots.push({ x: rx, z: rz, y: Math.max(ry, WATER_LEVEL - 0.15) });
  }

  for (let step = 0; step < 65; step++) {
    const x = (Math.random() - 0.5) * 280;
    const z = (Math.random() - 0.5) * 280;
    if (isNearTownArea(x, z, 6) || isNearLakePier(x, z)) continue;

    const riverDist = getDistToRivers(x, z);
    if (riverDist > -2.2 && riverDist < 1.8) {
      const { marginDist } = getClosestNetworkRoad(x, z);
      if (marginDist < 3.5) continue;
      const ry = getTerrainHeight(x, z);
      if (ry > WATER_LEVEL - 0.6 && ry < WATER_LEVEL + 0.7) {
        reedSpots.push({ x, z, y: Math.max(ry, WATER_LEVEL - 0.15) });
      }
    }
  }

  const stalksPerClump = 7;
  const totalStalks = reedSpots.length * stalksPerClump;
  if (totalStalks === 0) return;

  const stalkGeo = new THREE.ConeGeometry(0.045, 1.35, 4);
  stalkGeo.translate(0, 0.675, 0);

  const seedGeo = new THREE.CylinderGeometry(0.055, 0.045, 0.28, 5);
  seedGeo.translate(0, 1.25, 0);

  const stalkInst = new THREE.InstancedMesh(stalkGeo, reedBladeMat, totalStalks);
  const seedInst = new THREE.InstancedMesh(seedGeo, reedSeedMat, totalStalks);
  stalkInst.receiveShadow = true;

  let idx = 0;
  for (const spot of reedSpots) {
    for (let k = 0; k < stalksPerClump; k++) {
      const ang = (k / stalksPerClump) * Math.PI * 2 + Math.random() * 0.5;
      const rad = 0.08 + Math.random() * 0.42;
      const sx = spot.x + Math.cos(ang) * rad;
      const sz = spot.z + Math.sin(ang) * rad;
      const scaleY = 0.75 + Math.random() * 0.55;

      reedDummy.position.set(sx, spot.y - 0.05, sz);
      reedDummy.rotation.set((Math.random() - 0.5) * 0.24, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.24);
      reedDummy.scale.set(1, scaleY, 1);
      reedDummy.updateMatrix();

      stalkInst.setMatrixAt(idx, reedDummy.matrix);
      seedInst.setMatrixAt(idx, reedDummy.matrix);
      idx++;
    }
  }

  stalkInst.instanceMatrix.needsUpdate = true;
  seedInst.instanceMatrix.needsUpdate = true;
  scene.add(stalkInst);
  scene.add(seedInst);
}
buildWaterReeds();

// =========================================================
// VUURTOREN OP HET ZANDEILAND + DRAAIENDE LICHTSTRAAL
// =========================================================
export let lighthouseBeacon = null;
export let lighthouseBeamPivot = null;
export let lighthouseBeamMat = null;
// Lantaarnglas: overdag gewoon glas, 's nachts brandend (zie ui-controls.js)
export const lighthouseLanternMat = new THREE.MeshBasicMaterial({ color: 0x9fc8d9 });

function buildLighthouse() {
  const x = SANDBAR_ISLAND.x;
  const z = SANDBAR_ISLAND.z;
  const baseY = getTerrainHeight(x, z);
  const g = tagMap(new THREE.Group(), 'civic');

  const base = createOutlinedMesh(new THREE.CylinderGeometry(1.5, 1.7, 0.6, 12), makeToonMat(0x8d8379), 0.045, false);
  base.position.y = 0.3;
  g.add(base);

  const towerWhiteMat = makeToonMat(0xf5f1e6);
  const towerRedMat = makeToonMat(0xc63b3b);
  const bands = [
    { y: 1.6, h: 2.0, rBot: 1.25, rTop: 1.05, mat: towerWhiteMat },
    { y: 3.6, h: 2.0, rBot: 1.05, rTop: 0.85, mat: towerRedMat },
    { y: 5.6, h: 2.0, rBot: 0.85, rTop: 0.65, mat: towerWhiteMat }
  ];
  bands.forEach((b) => {
    const seg = createOutlinedMesh(new THREE.CylinderGeometry(b.rTop, b.rBot, b.h, 12), b.mat, 0.045, true);
    seg.position.y = b.y;
    g.add(seg);
  });

  const galleryMat = makeToonMat(0x2f3638);
  const gallery = createOutlinedMesh(new THREE.CylinderGeometry(0.85, 0.85, 0.22, 12), galleryMat, 0.03, false);
  gallery.position.y = 6.7;
  g.add(gallery);

  const lanternRoom = createOutlinedMesh(new THREE.CylinderGeometry(0.55, 0.6, 1.1, 10), lighthouseLanternMat, 0.035, false);
  lanternRoom.position.y = 7.35;
  g.add(lanternRoom);

  const roofCone = createOutlinedMesh(new THREE.ConeGeometry(0.72, 0.9, 10), galleryMat, 0.03, false);
  roofCone.position.y = 8.3;
  g.add(roofCone);

  const beaconLight = new THREE.PointLight(0xfff0b0, 0, 60, 1.3);
  beaconLight.position.y = 7.4;
  g.add(beaconLight);
  lighthouseBeacon = beaconLight;

  const beamPivot = new THREE.Group();
  beamPivot.position.set(0, 7.4, 0);

  const beamLength = 34;
  const beamRadius = 5.2;
  const beamGeo = new THREE.ConeGeometry(beamRadius, beamLength, 16, 1, true);
  // Punt van de kegel naar +Z draaien en het hele lichaam naar voren schuiven:
  // de smalle punt ligt nu op z = 0 (bij de vuurtoren) en het brede eind op z = beamLength.
  beamGeo.rotateX(-Math.PI / 2);
  beamGeo.translate(0, 0, beamLength * 0.5);

  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xfff1b8,
    transparent: true,
    opacity: 0.16,
    side: THREE.DoubleSide,
    depthWrite: false
  });

  const beamMesh = new THREE.Mesh(beamGeo, beamMat);
  beamPivot.add(beamMesh);
  g.add(beamPivot);
  beamPivot.visible = false; // alleen 's nachts aan
  lighthouseBeamPivot = beamPivot;
  lighthouseBeamMat = beamMat;

  // Flink groter: een echte vuurtoren die boven het meer uitsteekt
  g.scale.setScalar(1.75);
  g.position.set(x, baseY, z);
  scene.add(g);
  hardColliders.push({ x, z, r: 3.4 });
}

buildLighthouse();

// Groen op het vuurtoreneiland: struiken, een paar dennetjes en rotsen langs de rand
{
  const ix = SANDBAR_ISLAND.x;
  const iz = SANDBAR_ISLAND.z;
  const greenSpots = [
    [5.2, 0.3, 's'], [6.0, 1.2, 's'], [5.6, 2.2, 'p'], [6.4, 3.0, 's'], [5.0, 3.9, 's'],
    [6.2, 4.7, 'p'], [5.4, 5.5, 's'], [7.0, 0.8, 's'], [7.2, 5.9, 's'], [4.8, 2.7, 's']
  ];
  greenSpots.forEach(([rr, ang, kind]) => {
    const px = ix + Math.cos(ang) * rr;
    const pz = iz + Math.sin(ang) * rr;
    const py = getTerrainHeight(px, pz);
    if (py < WATER_LEVEL + 0.2) return;
    if (kind === 'p') {
      const sc = 0.55 + Math.random() * 0.2;
      const pine = createPineFast(sc);
      pine.position.set(px, py, pz);
      pine.rotation.y = Math.random() * Math.PI * 2;
      scene.add(pine);
      registerDestructible(pine, px, py, pz, 0.85 * sc, 'tree', 15, 'Dennenboom');
    } else {
      const sc = 0.6 + Math.random() * 0.6;
      const shrub = createShrubFast(sc);
      shrub.position.set(px, py, pz);
      shrub.rotation.y = Math.random() * Math.PI * 2;
      scene.add(shrub);
      registerDestructible(shrub, px, py, pz, Math.max(0.6, 0.85 * sc), 'shrub', 3, 'Struik');
    }
  });
  const rockMat = makeToonMat(0x8d8379);
  [[8.6, 0.0], [9.0, 2.6], [8.4, 4.4], [9.2, 5.4]].forEach(([rr, ang]) => {
    const px = ix + Math.cos(ang) * rr;
    const pz = iz + Math.sin(ang) * rr;
    const rock = createOutlinedMesh(new THREE.DodecahedronGeometry(0.7 + Math.random() * 0.5, 0), rockMat, 0.04, false);
    rock.position.set(px, Math.max(getTerrainHeight(px, pz), WATER_LEVEL - 0.3) + 0.2, pz);
    rock.rotation.set(Math.random(), Math.random() * 3, 0);
    rock.scale.y = 0.6;
    scene.add(rock);
  });
}
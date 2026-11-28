import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import {
  scene, createOutlinedMesh, makeToonMat, registerSeasonalMat, createMergedToonProp, outlineMat
} from './scene-setup.js';
import { ruralLots } from './water-lots.js';
import { hardColliders, registerDestructible } from './demolition.js';
import { plantNaturalGrove } from './props.js';
import { getTerrainHeight } from './terrain.js';
import { spawnParticle } from './effects.js';
import { tagMap } from './map-tags.js';

// =========================================================
// GROTE AFGELEGEN BOERDERIJ: SCHUUR, DUBBELE SILO, BOERENHUIS,
// WINDMOLEN, HEKWERK, HOOIBALEN & UITGESTREKTE MAISVELDEN
// =========================================================
const barnRedMat = makeToonMat(0xa23327);
const barnTrimMat = makeToonMat(0xf5ead3);
const barnRoofMat = registerSeasonalMat(0x362d2a, 0xeef4fa);
const barnDoorMat = makeToonMat(0x4a2e1f);
const stoneFoundMat = makeToonMat(0x8d8379);
const farmHouseWallMat = makeToonMat(0xfaf2e1);
const farmHouseRoofMat = registerSeasonalMat(0x4a5866, 0xeef4fa);
const farmWinMat = new THREE.MeshBasicMaterial({ color: 0xffe29a });

const siloBodyMat = makeToonMat(0xd3d6da);
const siloCapMat = makeToonMat(0x8d939c);
const siloBandMat = makeToonMat(0x5b6268);
const steelMat = makeToonMat(0x6c757d);

const hayMat = makeToonMat(0xd9ac4e);
const hayStrapMat = makeToonMat(0x7a5c3a);
const fenceWoodMat = makeToonMat(0x8c623d);
const yardGravelMat = registerSeasonalMat(0xb8a386, 0xe8eff6);
const dirtFieldMat = registerSeasonalMat(0x6e4f33, 0xe4ecf4);
const furrowMat = registerSeasonalMat(0x593e26, 0xd8e3ee);
const stubbleFieldMat = registerSeasonalMat(0x9c7a3e, 0xe4ecf4);
const cornStalkMat = makeToonMat(0x5f8c42);
const cornCobMat = makeToonMat(0xe8c23c);

// Lokale offset (rechts=lx, richting weg/oprit=lz) roteren naar wereldcoördinaten.
// Belangrijk: de oprit vanuit water-lots.js loopt exact langs lx = 0 van lz = 0 naar lz = +34 (de weg)!
function localToWorld(lx, lz, yaw) {
  const s = Math.sin(yaw);
  const c = Math.cos(yaw);
  return { x: lx * c + lz * s, z: -lx * s + lz * c };
}

function createGrandBarn__build(pal = PAL_CLASSIC) {
  const g = new THREE.Group();
  const w = 12.2;
  const h = 6.2;
  const d = 10.4;

  const plinth = createOutlinedMesh(new THREE.BoxGeometry(w + 0.4, 0.5, d + 0.4), stoneFoundMat, 0.045, false);
  plinth.position.y = 0.08;
  g.add(plinth);

  const body = createOutlinedMesh(new THREE.BoxGeometry(w, h, d), pal.wall, 0.065);
  body.position.y = h * 0.5 + 0.25;
  g.add(body);

  // Zij-aanbouw (werktuigenloods / lean-to) aan de linkerkant van de schuur
  const leanW = 3.6;
  const leanH = 3.5;
  const leanBody = createOutlinedMesh(new THREE.BoxGeometry(leanW, leanH, d - 1.2), pal.wall, 0.05);
  leanBody.position.set(-(w * 0.5 + leanW * 0.5 - 0.1), leanH * 0.5 + 0.25, 0);
  g.add(leanBody);

  const leanRoof = createOutlinedMesh(new THREE.BoxGeometry(leanW + 0.6, 0.26, d - 0.6), pal.roof, 0.045, false);
  leanRoof.position.set(-(w * 0.5 + leanW * 0.5), leanH + 0.55, 0);
  leanRoof.rotation.z = 0.26;
  g.add(leanRoof);

  // Steil gambrel-dak met dakkapel/ventilatietorentje (cupola)
  const rShape = new THREE.Shape();
  rShape.moveTo(-(w * 0.5 + 0.5), 0);
  rShape.lineTo(-w * 0.31, 2.1);
  rShape.lineTo(0, 3.65);
  rShape.lineTo(w * 0.31, 2.1);
  rShape.lineTo(w * 0.5 + 0.5, 0);
  rShape.closePath();
  const rGeo = new THREE.ExtrudeGeometry(rShape, { depth: d + 0.9, bevelEnabled: false });
  rGeo.translate(0, 0, -(d + 0.9) * 0.5);
  const roof = createOutlinedMesh(rGeo, pal.roof, 0.07);
  roof.position.y = h + 0.25;
  g.add(roof);

  // Cupola op de nok van de schuur
  const cupola = createOutlinedMesh(new THREE.BoxGeometry(1.9, 1.5, 1.9), pal.wall, 0.04, false);
  cupola.position.set(0, h + 4.2, 0);
  g.add(cupola);
  const cupolaCap = createOutlinedMesh(new THREE.ConeGeometry(1.55, 1.2, 4), pal.roof, 0.04, false);
  cupolaCap.position.set(0, h + 5.5, 0);
  cupolaCap.rotation.y = Math.PI * 0.25;
  g.add(cupolaCap);

  // Hooizolder-luik met hijsbalk bovenin
  const loftDoor = createOutlinedMesh(new THREE.BoxGeometry(1.7, 1.8, 0.16), pal.door, 0.03, false);
  loftDoor.position.set(0, h + 1.35, d * 0.5 + 0.08);
  g.add(loftDoor);
  const loftTrim = createOutlinedMesh(new THREE.BoxGeometry(2.0, 2.05, 0.1), pal.trim, 0.02, false);
  loftTrim.position.set(0, h + 1.35, d * 0.5 + 0.03);
  g.add(loftTrim);
  const hoistBeam = createOutlinedMesh(new THREE.BoxGeometry(0.22, 0.22, 1.3), pal.trim, 0.02, false);
  hoistBeam.position.set(0, h + 2.6, d * 0.5 + 0.55);
  g.add(hoistBeam);

  // Grote dubbele schuurdeuren met witte kruisbalken (X-bracing)
  [-1.65, 1.65].forEach((dx) => {
    const door = createOutlinedMesh(new THREE.BoxGeometry(3.0, 3.8, 0.16), pal.door, 0.03, false);
    door.position.set(dx, 2.15, d * 0.5 + 0.08);
    g.add(door);

    [0.52, -0.52].forEach((ang) => {
      const brace = new THREE.Mesh(new THREE.BoxGeometry(4.1, 0.16, 0.06), pal.trim);
      brace.position.set(dx, 2.15, d * 0.5 + 0.18);
      brace.rotation.z = ang;
      g.add(brace);
    });

    const frameTop = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.18, 0.18), pal.trim);
    frameTop.position.set(dx, 4.02, d * 0.5 + 0.12);
    g.add(frameTop);
  });

  // Witte hoekpilasters en zijramen
  [-w * 0.5, w * 0.5].forEach((cx) => {
    [-d * 0.5, d * 0.5].forEach((cz) => {
      const trim = createOutlinedMesh(new THREE.BoxGeometry(0.26, h, 0.26), pal.trim, 0.02, false);
      trim.position.set(cx, h * 0.5 + 0.25, cz);
      g.add(trim);
    });
  });

  [-2.8, 0, 2.8].forEach((wz) => {
    const winFrame = createOutlinedMesh(new THREE.BoxGeometry(0.14, 1.2, 1.1), pal.trim, 0.02, false);
    winFrame.position.set(w * 0.5 + 0.04, 3.4, wz);
    g.add(winFrame);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.0), farmWinMat);
    glass.rotation.y = Math.PI * 0.5;
    glass.position.set(w * 0.5 + 0.12, 3.4, wz);
    g.add(glass);
  });

  return g;
}

function createFarmHouse__build(pal = PAL_CLASSIC) {
  const g = new THREE.Group();
  const w = 7.8, h = 4.6, d = 6.4;

  const plinth = createOutlinedMesh(new THREE.BoxGeometry(w + 0.3, 0.48, d + 0.3), stoneFoundMat, 0.04, false);
  plinth.position.y = 0.1;
  g.add(plinth);

  const body = createOutlinedMesh(new THREE.BoxGeometry(w, h, d), pal.houseWall, 0.055);
  body.position.y = h * 0.5 + 0.24;
  g.add(body);

  const rShape = new THREE.Shape();
  rShape.moveTo(-(w * 0.5 + 0.4), 0);
  rShape.lineTo(0, 2.35);
  rShape.lineTo(w * 0.5 + 0.4, 0);
  rShape.closePath();
  const rGeo = new THREE.ExtrudeGeometry(rShape, { depth: d + 0.7, bevelEnabled: false });
  rGeo.translate(0, 0, -(d + 0.7) * 0.5);
  const roof = createOutlinedMesh(rGeo, pal.houseRoof, 0.058);
  roof.position.y = h + 0.2;
  g.add(roof);

  // Brede veranda aan de erfzijde
  const porch = createOutlinedMesh(new THREE.BoxGeometry(w * 0.94, 0.44, 2.1), stoneFoundMat, 0.038, false);
  porch.position.set(0, 0.14, d * 0.5 + 1.02);
  g.add(porch);

  const pRoof = createOutlinedMesh(new THREE.BoxGeometry(w * 0.98, 0.22, 2.35), pal.houseRoof, 0.04, false);
  pRoof.position.set(0, 2.75, d * 0.5 + 1.02);
  pRoof.rotation.x = 0.18;
  g.add(pRoof);

  [-w * 0.4, -w * 0.14, w * 0.14, w * 0.4].forEach((px) => {
    const post = createOutlinedMesh(new THREE.BoxGeometry(0.2, 2.35, 0.2), pal.trim, 0.025, false);
    post.position.set(px, 1.48, d * 0.5 + 1.9);
    g.add(post);
  });

  const door = createOutlinedMesh(new THREE.BoxGeometry(1.05, 2.1, 0.14), pal.houseDoor, 0.03, false);
  door.position.set(0, 1.42, d * 0.5 + 0.06);
  g.add(door);

  [-2.2, 2.2].forEach((wx) => {
    [1.7, 3.65].forEach((wy) => {
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 0.95), farmWinMat);
      glass.position.set(wx, wy, d * 0.5 + 0.08);
      g.add(glass);
    });
  });

  const chim = createOutlinedMesh(new THREE.BoxGeometry(0.95, h + 1.9, 0.95), pal.houseDoor, 0.045, false);
  chim.position.set(w * 0.46, (h + 1.9) * 0.5 + 0.15, -0.6);
  g.add(chim);

  return g;
}

function createGrainSilo__build(radius = 2.0, height = 8.8, pal = PAL_CLASSIC) {
  const g = new THREE.Group();

  const body = createOutlinedMesh(new THREE.CylinderGeometry(radius, radius, height, 14), pal.siloBody, 0.045, true);
  body.position.y = height * 0.5 + 0.1;
  g.add(body);

  const cap = createOutlinedMesh(new THREE.SphereGeometry(radius + 0.06, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), pal.siloCap, 0.04, false);
  cap.position.y = height + 0.1;
  g.add(cap);

  [0.25, 0.5, 0.75, 0.98].forEach((t) => {
    const band = new THREE.Mesh(new THREE.TorusGeometry(radius + 0.04, 0.06, 6, 16), pal.siloBand);
    band.rotation.x = Math.PI / 2;
    band.position.y = 0.1 + height * t;
    g.add(band);
  });

  // Buitenste inspectiekooi / stortkoker langs de silo
  const chute = createOutlinedMesh(new THREE.BoxGeometry(0.55, height * 0.92, 0.55), pal.siloCap, 0.025, false);
  chute.position.set(0, height * 0.48, radius + 0.22);
  g.add(chute);

  return g;
}

function createWindmill__build() {
  const g = new THREE.Group();
  const h = 10.2;

  // 4 schuine stalen poten van de windmolenmast
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    const leg = createOutlinedMesh(new THREE.CylinderGeometry(0.08, 0.14, h + 0.3, 6), steelMat, 0.025, false);
    leg.position.set(sx * 0.65, h * 0.5, sz * 0.65);
    leg.rotation.z = sx * 0.11;
    leg.rotation.x = -sz * 0.11;
    g.add(leg);
  });

  [2.8, 5.6, 8.2].forEach((py, idx) => {
    const w = 2.1 - idx * 0.48;
    const brace = createOutlinedMesh(new THREE.BoxGeometry(w, 0.12, w), steelMat, 0.02, false);
    brace.position.y = py;
    g.add(brace);
  });

  // Schoepenrad en windvaan bovenop
  const hub = createOutlinedMesh(new THREE.CylinderGeometry(0.32, 0.32, 0.8, 8), barnRedMat, 0.025, false);
  hub.rotation.x = Math.PI * 0.5;
  hub.position.set(0, h + 0.3, 0.25);
  g.add(hub);

  const rim = createOutlinedMesh(new THREE.TorusGeometry(1.85, 0.08, 6, 16), steelMat, 0.025, false);
  rim.position.set(0, h + 0.3, 0.62);
  g.add(rim);

  for (let i = 0; i < 10; i++) {
    const ang = (i / 10) * Math.PI * 2;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.32, 1.65, 0.05), siloBodyMat);
    blade.position.set(Math.cos(ang) * 0.95, h + 0.3 + Math.sin(ang) * 0.95, 0.62);
    blade.rotation.z = ang + Math.PI * 0.5;
    blade.rotation.y = 0.32;
    g.add(blade);
  }

  const vane = createOutlinedMesh(new THREE.BoxGeometry(0.1, 0.95, 1.5), barnRedMat, 0.025, false);
  vane.position.set(0, h + 0.55, -0.95);
  g.add(vane);

  return g;
}

function createWoodenFenceSection(length = 4.2) {
  const g = new THREE.Group();
  [-length * 0.5, length * 0.5].forEach((px) => {
    const post = createOutlinedMesh(new THREE.BoxGeometry(0.22, 1.15, 0.22), fenceWoodMat, 0.025, false);
    post.position.set(px, 0.57, 0);
    g.add(post);
  });
  [0.42, 0.86].forEach((ry) => {
    const rail = createOutlinedMesh(new THREE.BoxGeometry(length, 0.12, 0.09), fenceWoodMat, 0.02, false);
    rail.position.y = ry;
    g.add(rail);
  });
  return g;
}

const hayBaleGeo = new THREE.CylinderGeometry(0.66, 0.66, 1.25, 10);
hayBaleGeo.rotateZ(Math.PI / 2);
function createHayBale() {
  const g = createOutlinedMesh(hayBaleGeo, hayMat, 0.03, true, false);
  [-0.42, 0, 0.42].forEach((sx) => {
    const strap = new THREE.Mesh(new THREE.TorusGeometry(0.675, 0.035, 5, 12), hayStrapMat);
    strap.rotation.y = Math.PI / 2;
    strap.position.x = sx;
    g.add(strap);
  });
  return g;
}

// Gebakken maisplant-template; de velden worden als InstancedMesh geplaatst (honderden planten = 3 draw calls)
const cornStalkParts = [
  { geo: new THREE.CylinderGeometry(0.05, 0.075, 2.05, 5), matrix: new THREE.Matrix4().makeTranslation(0, 1.02, 0) }
];
[0.38, 1.08, 1.62].forEach((y, idx) => {
  const leafM = new THREE.Matrix4()
    .makeRotationY(idx * 2.1)
    .multiply(new THREE.Matrix4().makeTranslation(0.34, y, 0))
    .multiply(new THREE.Matrix4().makeRotationZ(-0.65));
  cornStalkParts.push({ geo: new THREE.BoxGeometry(0.64, 0.08, 0.17), matrix: leafM });
});
const bakedCornStalk = createMergedToonProp(cornStalkParts, cornStalkMat, 0.022, false);
const cornCobGeo = new THREE.CylinderGeometry(0.095, 0.075, 0.36, 6);
cornCobGeo.rotateZ(0.3);
cornCobGeo.translate(0.14, 1.35, 0.05);

// Tarwe: bosje gouden halmen met aar
const wheatMat = registerSeasonalMat(0xe3b94a, 0xeef2f6);
const wheatHeadMat = makeToonMat(0xc98f2c);
const wheatParts = [];
for (let k = 0; k < 5; k++) {
  const a = (k / 5) * Math.PI * 2;
  const m = new THREE.Matrix4()
    .makeTranslation(Math.cos(a) * 0.14, 0, Math.sin(a) * 0.14)
    .multiply(new THREE.Matrix4().makeRotationZ(Math.cos(a) * 0.12))
    .multiply(new THREE.Matrix4().makeTranslation(0, 0.5, 0));
  wheatParts.push({ geo: new THREE.CylinderGeometry(0.025, 0.035, 1.0, 4), matrix: m });
}
const bakedWheatStalks = createMergedToonProp(wheatParts, wheatMat, 0.015, false);
const wheatHeadParts = [];
for (let k = 0; k < 5; k++) {
  const a = (k / 5) * Math.PI * 2;
  wheatHeadParts.push({
    geo: new THREE.CylinderGeometry(0.06, 0.04, 0.3, 5),
    matrix: new THREE.Matrix4().makeTranslation(Math.cos(a) * 0.2, 1.08, Math.sin(a) * 0.2)
  });
}
const bakedWheatHeads = createMergedToonProp(wheatHeadParts, wheatHeadMat, 0.015, false);

function addInstanced(geo, mat, matrices, castShadow = false) {
  if (!matrices.length) return null;
  const inst = new THREE.InstancedMesh(geo, mat, matrices.length);
  matrices.forEach((m, i) => inst.setMatrixAt(i, m));
  inst.instanceMatrix.needsUpdate = true;
  inst.castShadow = castShadow;
  inst.computeBoundingSphere();
  scene.add(inst);
  return inst;
}

// =========================================================
// PLATRIJDEN VAN MAIS EN TARWE
// Elke plant onthoudt zijn plek; rij je erdoorheen dan klapt hij om in je rijrichting
// en staat hij na een tijdje weer recht (als je uit de buurt bent).
// =========================================================
const CROP_CELL = 3;
export const cropFields = [];
const cropDummy = new THREE.Object3D();
const cropParticlePos = new THREE.Vector3();

function registerCropField(plants, meshes, crop = 'corn', farm = '') {
  if (!plants.length) return;
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  const grid = new Map();
  plants.forEach((p, i) => {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
    const key = Math.floor(p.x / CROP_CELL) * 100000 + Math.floor(p.z / CROP_CELL);
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(i);
  });
  cropFields.push({
    plants, meshes, grid, minX, maxX, minZ, maxZ, crop, farm,
    flatTimer: new Float32Array(plants.length),
    harvested: new Uint8Array(plants.length),
    harvestedCount: 0,
    flattened: []
  });
}

function setPlantMatrix(field, i, flatYaw) {
  const p = field.plants[i];
  cropDummy.position.set(p.x, p.y, p.z);
  cropDummy.rotation.order = 'YXZ';
  if (flatYaw === 'stubble') {
    // geoogst: alleen een kort stoppeltje blijft staan
    cropDummy.rotation.set(0, p.rot, 0);
    cropDummy.scale.set(p.scale, p.scale * 0.09, p.scale);
  } else if (flatYaw === null) {
    cropDummy.rotation.set(0, p.rot, 0);
    cropDummy.scale.setScalar(p.scale);
  } else {
    cropDummy.rotation.set(1.32 + Math.random() * 0.15, flatYaw + (Math.random() - 0.5) * 0.5, 0);
    cropDummy.scale.set(p.scale, p.scale * 0.85, p.scale);
  }
  cropDummy.updateMatrix();
  field.meshes.forEach((m) => {
    m.setMatrixAt(i, cropDummy.matrix);
    m.instanceMatrix.needsUpdate = true;
  });
}

export function updateCrops(px, pz, vx, vz, dt) {
  const speed = Math.hypot(vx, vz);
  const heading = Math.atan2(vx, vz);
  for (const field of cropFields) {
    // Rechtop zetten wat lang genoeg plat ligt en ver genoeg weg is
    if (field.flattened.length) {
      for (let k = field.flattened.length - 1; k >= 0; k--) {
        const i = field.flattened[k];
        field.flatTimer[i] -= dt;
        if (field.harvested[i]) {
          field.flattened.splice(k, 1);
          continue;
        }
        if (field.flatTimer[i] <= 0) {
          const p = field.plants[i];
          if ((p.x - px) ** 2 + (p.z - pz) ** 2 > 400) {
            setPlantMatrix(field, i, null);
            field.flattened.splice(k, 1);
          } else {
            field.flatTimer[i] = 3;
          }
        }
      }
    }
    if (speed < 1.2) continue;
    if (px < field.minX - 3 || px > field.maxX + 3 || pz < field.minZ - 3 || pz > field.maxZ + 3) continue;
    const cx = Math.floor(px / CROP_CELL);
    const cz = Math.floor(pz / CROP_CELL);
    let flattenedNow = 0;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const bucket = field.grid.get((cx + dx) * 100000 + (cz + dz));
        if (!bucket) continue;
        for (const i of bucket) {
          if (field.flatTimer[i] > 0 || field.harvested[i]) continue;
          const p = field.plants[i];
          if ((p.x - px) ** 2 + (p.z - pz) ** 2 > 2.0 * 2.0) continue;
          setPlantMatrix(field, i, heading);
          field.flatTimer[i] = 40 + Math.random() * 15;
          field.flattened.push(i);
          flattenedNow++;
        }
      }
    }
    if (flattenedNow > 0 && Math.random() < 0.6) {
      cropParticlePos.set(px, field.plants[0].y + 0.8, pz);
      spawnParticle(cropParticlePos, 'leaf', 0.8);
    }
  }
}

// =========================================================
// OOGSTEN MET DE TRACTOR (minigame): maait alles binnen het maaibord weg tot een stoppelveld
// =========================================================
export function harvestAround(farm, x, z, r) {
  let n = 0;
  const r2 = r * r;
  const span = Math.ceil(r / CROP_CELL);
  for (const field of cropFields) {
    if (field.farm !== farm) continue;
    if (x < field.minX - r || x > field.maxX + r || z < field.minZ - r || z > field.maxZ + r) continue;
    const cx = Math.floor(x / CROP_CELL);
    const cz = Math.floor(z / CROP_CELL);
    for (let dx = -span; dx <= span; dx++) {
      for (let dz = -span; dz <= span; dz++) {
        const bucket = field.grid.get((cx + dx) * 100000 + (cz + dz));
        if (!bucket) continue;
        for (const i of bucket) {
          if (field.harvested[i]) continue;
          const p = field.plants[i];
          if ((p.x - x) ** 2 + (p.z - z) ** 2 > r2) continue;
          field.harvested[i] = 1;
          field.harvestedCount++;
          setPlantMatrix(field, i, 'stubble');
          n++;
        }
      }
    }
  }
  if (n > 0 && Math.random() < 0.7) {
    cropParticlePos.set(x, getTerrainHeight(x, z) + 1.0, z);
    spawnParticle(cropParticlePos, 'leaf', 1.0);
  }
  return n;
}

export function getHarvestProgress(farm) {
  let total = 0;
  let done = 0;
  for (const field of cropFields) {
    if (field.farm !== farm) continue;
    total += field.plants.length;
    done += field.harvestedCount;
  }
  return { total, done };
}

// Rest in één keer oogsten (de laatste losse halmen), of alles weer laten groeien
export function harvestRemaining(farm) {
  for (const field of cropFields) {
    if (field.farm !== farm) continue;
    for (let i = 0; i < field.plants.length; i++) {
      if (field.harvested[i]) continue;
      field.harvested[i] = 1;
      setPlantMatrix(field, i, 'stubble');
    }
    field.harvestedCount = field.plants.length;
  }
}
export function regrowFarm(farm) {
  for (const field of cropFields) {
    if (field.farm !== farm) continue;
    for (let i = 0; i < field.plants.length; i++) {
      field.harvested[i] = 0;
      field.flatTimer[i] = 0;
      setPlantMatrix(field, i, null);
    }
    field.flattened.length = 0;
    field.harvestedCount = 0;
  }
}

// Plaatst een omgeploegd akkerveld (mais of tarwe) dat de terreinhoogte volgt en de oprit vrijlaat
function buildCropField(baseX, baseY, baseZ, yaw, centerLX, centerLZ, width, depth, crop = 'corn', farm = '') {
  const spacing = crop === 'corn' ? 1.62 : 1.05;
  const cols = Math.max(2, Math.floor(width / spacing));
  const rows = Math.max(2, Math.floor(depth / spacing));
  const fieldWidth = cols * spacing;
  const fieldDepth = rows * spacing;
  const centerOff = localToWorld(centerLX, centerLZ, yaw);
  const patchCenterX = baseX + centerOff.x;
  const patchCenterZ = baseZ + centerOff.z;
  const patchY = Math.max(baseY - 0.15, getTerrainHeight(patchCenterX, patchCenterZ));

  // Akkergrond als een kleed over het terrein: volgt de glooiing, zweeft nergens en wordt nergens doorgestoken
  const drape = (w, d, segW, segD, lift, offLX = 0) => {
    const geo = new THREE.PlaneGeometry(w, d, segW, segD);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const lx = centerLX + offLX + pos.getX(i);
      const lz = centerLZ + pos.getZ(i);
      const o = localToWorld(lx, lz, yaw);
      const wx = baseX + o.x;
      const wz = baseZ + o.z;
      pos.setXYZ(i, wx, getTerrainHeight(wx, wz) + lift, wz);
    }
    geo.computeVertexNormals();
    return geo;
  };
  const soil = new THREE.Mesh(
    drape(fieldWidth + 2.6, fieldDepth + 2.6, Math.ceil((fieldWidth + 2.6) / 2), Math.ceil((fieldDepth + 2.6) / 2), 0.07),
    crop === 'corn' ? dirtFieldMat : stubbleFieldMat
  );
  soil.receiveShadow = true;
  scene.add(soil);

  // Ploegvoren (samengevoegd tot 1 mesh), ook over het terrein gedrapeerd
  const furrowGeos = [];
  for (let c = 0; c < cols; c += crop === 'corn' ? 1 : 2) {
    const relX = (c - (cols - 1) * 0.5) * spacing;
    furrowGeos.push(drape(0.38, fieldDepth + 1.4, 1, Math.ceil((fieldDepth + 1.4) / 2), 0.11, relX));
  }
  if (furrowGeos.length) scene.add(new THREE.Mesh(BufferGeometryUtils.mergeGeometries(furrowGeos), furrowMat));

  const matrices = [];
  const plants = [];
  const dummy = new THREE.Object3D();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lx = centerLX + (c - (cols - 1) * 0.5) * spacing + (Math.random() - 0.5) * 0.14;
      const lz = centerLZ + (r - (rows - 1) * 0.5) * spacing + (Math.random() - 0.5) * 0.14;
      // De oprit (lx = 0) altijd ruim vrijhouden
      if (Math.abs(lx) < 5.5 && lz > -2.0) continue;
      const off = localToWorld(lx, lz, yaw);
      const wx = baseX + off.x;
      const wz = baseZ + off.z;
      const wy = getTerrainHeight(wx, wz) + 0.07;
      const rot = yaw + (Math.random() - 0.5) * 0.65;
      const sc = 0.88 + Math.random() * 0.34;
      dummy.position.set(wx, wy, wz);
      dummy.rotation.set(0, rot, 0);
      dummy.scale.setScalar(sc);
      dummy.updateMatrix();
      matrices.push(dummy.matrix.clone());
      plants.push({ x: wx, y: wy, z: wz, rot, scale: sc });
    }
  }
  const meshes = crop === 'corn'
    ? [
        addInstanced(bakedCornStalk.mergedMain, cornStalkMat, matrices),
        addInstanced(bakedCornStalk.mergedOut, outlineMat, matrices),
        addInstanced(cornCobGeo, cornCobMat, matrices)
      ]
    : [
        addInstanced(bakedWheatStalks.mergedMain, wheatMat, matrices),
        addInstanced(bakedWheatStalks.mergedOut, outlineMat, matrices),
        addInstanced(bakedWheatHeads.mergedMain, wheatHeadMat, matrices)
      ];
  registerCropField(plants, meshes.filter(Boolean), crop, farm);
}

// =========================================================
// KLEURPALETTEN: elke boerderij krijgt een eigen uitstraling
// =========================================================
const PAL_CLASSIC = {
  wall: barnRedMat, roof: barnRoofMat, trim: barnTrimMat, door: barnDoorMat,
  houseWall: farmHouseWallMat, houseRoof: farmHouseRoofMat, houseDoor: barnRedMat,
  siloBody: siloBodyMat, siloCap: siloCapMat, siloBand: siloBandMat
};
const PAL_DAIRY = {
  wall: makeToonMat(0xeee7d6),
  roof: registerSeasonalMat(0x3f6b4a, 0xeef4fa),
  trim: makeToonMat(0x8b2f2a),
  door: makeToonMat(0x3f6b4a),
  houseWall: makeToonMat(0xf2d27a),
  houseRoof: registerSeasonalMat(0x3d4b5c, 0xeef4fa),
  houseDoor: makeToonMat(0x3f6b4a),
  siloBody: makeToonMat(0x2c4a7a),
  siloCap: makeToonMat(0xc9ced4),
  siloBand: makeToonMat(0x1d2f4f)
};

// Open werktuigenloods / koeienstal: palen, achterwand en een schuin dak
function createOpenShed__build(len, depth, pal) {
  const g = new THREE.Group();
  const h = 3.4;
  const back = createOutlinedMesh(new THREE.BoxGeometry(len, h, 0.3), pal.wall, 0.04);
  back.position.set(0, h * 0.5 + 0.1, -depth * 0.5);
  g.add(back);
  [-1, 1].forEach((side) => {
    const sideWall = createOutlinedMesh(new THREE.BoxGeometry(0.3, h, depth), pal.wall, 0.035);
    sideWall.position.set(side * len * 0.5, h * 0.5 + 0.1, 0);
    g.add(sideWall);
  });
  for (let px = -len * 0.5 + 3; px < len * 0.5 - 1; px += 3.2) {
    const post = createOutlinedMesh(new THREE.BoxGeometry(0.24, h + 0.5, 0.24), pal.trim, 0.025, false);
    post.position.set(px, (h + 0.5) * 0.5, depth * 0.5);
    g.add(post);
  }
  const roof = createOutlinedMesh(new THREE.BoxGeometry(len + 0.8, 0.24, depth + 1.4), pal.roof, 0.045);
  roof.position.set(0, h + 0.55, 0.2);
  roof.rotation.x = -0.14;
  g.add(roof);
  const floor = createOutlinedMesh(new THREE.BoxGeometry(len, 0.2, depth), yardGravelMat, 0.02, false, true);
  floor.position.y = 0.05;
  g.add(floor);
  return g;
}

// Eenvoudige low-poly koe (zwart-wit) voor de wei van Sunny Acres
const cowWhiteMat = makeToonMat(0xf4f1ea);
const cowBlackMat = makeToonMat(0x2b2b2b);
const cowPinkMat = makeToonMat(0xe8a0a0);
const cowHornMat = makeToonMat(0xe8dcc0);
function createCow() {
  const g = new THREE.Group();
  const body = createOutlinedMesh(new THREE.BoxGeometry(0.95, 0.85, 1.75), cowWhiteMat, 0.035);
  body.position.y = 1.05;
  g.add(body);
  [[0.48, 1.15, 0.3, 0.5, 0.6], [-0.48, 0.95, -0.4, 0.55, 0.5], [0.2, 1.48, -0.2, 0.7, 0.5]].forEach(([px, py, pz, sw, sd]) => {
    const spot = new THREE.Mesh(new THREE.BoxGeometry(px === 0.2 ? sw : 0.04, px === 0.2 ? 0.04 : 0.5, sd), cowBlackMat);
    spot.position.set(px === 0.2 ? px : px + Math.sign(px) * 0.01, py, pz);
    g.add(spot);
  });
  const head = createOutlinedMesh(new THREE.BoxGeometry(0.55, 0.55, 0.6), cowWhiteMat, 0.03);
  head.position.set(0, 1.35, 1.1);
  g.add(head);
  const snout = createOutlinedMesh(new THREE.BoxGeometry(0.5, 0.28, 0.2), cowPinkMat, 0.02, false);
  snout.position.set(0, 1.2, 1.45);
  g.add(snout);
  [-0.22, 0.22].forEach((hx) => {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.25, 5), cowHornMat);
    horn.position.set(hx, 1.7, 1.05);
    g.add(horn);
  });
  const legs = [];
  [[-0.32, 0.6], [0.32, 0.6], [-0.32, -0.6], [0.32, -0.6]].forEach(([lx, lz]) => {
    // Pivot bovenaan de poot zodat hij kan zwaaien tijdens het lopen
    const pivot = new THREE.Group();
    pivot.position.set(lx, 0.7, lz);
    const leg = createOutlinedMesh(new THREE.BoxGeometry(0.2, 0.7, 0.2), cowWhiteMat, 0.02, false);
    leg.position.y = -0.35;
    pivot.add(leg);
    g.add(pivot);
    legs.push(pivot);
  });
  g.userData.legs = legs;
  g.userData.head = head;
  return g;
}

function createWaterTrough() {
  const g = new THREE.Group();
  const tub = createOutlinedMesh(new THREE.BoxGeometry(2.4, 0.6, 0.9), steelMat, 0.03);
  tub.position.y = 0.3;
  g.add(tub);
  const water = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.05, 0.7), new THREE.MeshBasicMaterial({ color: 0x5fb6cf }));
  water.position.y = 0.55;
  g.add(water);
  return g;
}

// =========================================================
// BOERDERIJ-INDELINGEN (lokaal: lx langs de weg, lz richting weg = +; de oprit loopt over lx = 0)
// Elke boerderij heeft een eigen karakter:
//  - Pinewood Farm (akkerbouw): twee grote maisvelden aan weerszijden van de oprit, rechts naast het woonhuis
//    een pompoenveld met de windmolen, en achter de silo's natuurlijk bos. Hier staat de oogsttractor.
//  - Sunny Acres (melkvee): de koeienwei ligt vooraan langs de weg (je ziet ze grazen als je langsrijdt),
//    tarwe aan de andere kant, achter de stal een hooiland met balen en de windmolen, en mais achter het woonhuis.
//    Aan de weg staat een boerderijkraampje met melk en kaas.
// Rechthoeken: [x0, x1, z0, z1]
// =========================================================
const FARM_LAYOUTS = {
  corn: {
    pal: PAL_CLASSIC,
    barn: [-15, -15, 0],
    silos: [[-2.5, -23, 2.05, 9.2], [2.6, -23.6, 1.75, 7.8]],
    house: [18, -8, -Math.PI * 0.5],
    shed: [-32, -5, 0, 9, 6],
    windmill: [34.5, -12.5],
    fields: [
      ['corn', -38.5, -7.5, 4.0, 34.0],
      ['corn', 7.5, 38.5, 4.0, 34.0]
    ],
    // achter de silo's: natuurlijk bos dat doorloopt richting het tuincentrum
    backForest: true,
    pastures: [],
    noDriveFence: [],
    pumpkinPatch: [23.5, 37.5, -25.5, -17.0], // rechts naast het woonhuis, voor de tarweakker
    scarecrows: [[-22, 20], [22, 16]],
    hay: [
      [-7, 1.2, 0], [-5.5, 1.8, 0], [-6.2, 1.5, 1.18], [-9.5, -1.5, 0],
      [30.0, -12.0, 0], [31.4, -11.4, 0], [30.7, -11.7, 1.18],
      [-27.6, -10.2, 0], [-30.4, -10.2, 0], [-33.2, -10.2, 0], [-29.0, -10.2, 1.18], [-31.8, -10.2, 1.18]
    ]
  },
  wheat: {
    pal: PAL_DAIRY,
    barn: [15, -15, 0],
    silos: [[1.5, -24, 2.5, 11.0], [-4.2, -23.2, 1.5, 6.8]],
    house: [-18, -8, Math.PI * 0.5],
    shed: [30, -4, 0, 14, 6],
    windmill: [23.5, -33.5],
    fields: [
      ['wheat', -38.5, -7.5, 4.0, 38.0],
      ['corn', -38.5, -9.0, -40.0, -27.0]
    ],
    // kraampje aan de weg, links naast de oprit, met een grindstrook om even te stoppen
    farmStand: { at: [-15.5, 39.8], pull: [-23.0, -8.0, 41.0, 45.4] },
    pastures: [{ rect: [6.5, 38.5, 5.0, 37.0], cows: 8, trough: [22.5, 8.0] }],
    noDriveFence: [1], // de wei grenst zelf aan de oprit
    pumpkinPatch: null,
    scarecrows: [[-23, 22], [-24, -33]],
    // hooiland achter de stal: balen in losse rijen rond de windmolen
    hay: [
      [7, 1.2, 0], [5.5, 1.8, 0], [6.2, 1.5, 1.18], [-9.5, -1.5, 0],
      [11, -30, 0], [16, -30.5, 0], [31, -30, 0], [35.5, -29.5, 0],
      [12, -36.5, 0], [17.5, -37, 0], [30, -37, 0], [35, -36.5, 0],
      [23.5, -28.5, 0], [24.9, -28.0, 0], [24.2, -28.25, 1.18]
    ]
  }
};

// Per boerderij: waar de vogelverschrikkers en het pompoenveld komen (gebruikt door autumn.js)
export const farmDecor = {};

function buildFarm(farmLot) {
  const { x: baseX, y: baseY, z: baseZ, yaw } = farmLot;
  const fb = farmLot.flatBox;
  const L = FARM_LAYOUTS[farmLot.variant] ?? FARM_LAYOUTS.corn;
  const pal = L.pal;
  const toWorld = (lx, lz) => {
    const off = localToWorld(lx, lz, yaw);
    return { x: baseX + off.x, z: baseZ + off.z };
  };
  const place = (obj, lx, lz, rotOff = 0, y = baseY) => {
    const p = toWorld(lx, lz);
    obj.position.set(p.x, y, p.z);
    obj.rotation.y = yaw + rotOff;
    scene.add(obj);
    return p;
  };

  // 1. Ruim grinterf aan het eind van de oprit
  const yardPad = createOutlinedMesh(new THREE.BoxGeometry(36.0, 0.42, 20.0), yardGravelMat, 0.035, false, true);
  place(yardPad, 0, -7.0, 0, baseY - 0.16);

  // 2. Schuur, silo's, woonhuis, loods en losse windmolen
  let p = place(createGrandBarn(pal), L.barn[0], L.barn[1], L.barn[2]);
  hardColliders.push({ x: p.x, z: p.z, r: 6.6 });
  L.silos.forEach(([lx, lz, r, h]) => {
    p = place(createGrainSilo(r, h, pal), lx, lz);
    hardColliders.push({ x: p.x, z: p.z, r: r + 0.3 });
  });
  p = place(createFarmHouse(pal), L.house[0], L.house[1], L.house[2]);
  hardColliders.push({ x: p.x, z: p.z, r: 4.4 });
  const [sx, sz, sRot, sLen, sDepth] = L.shed;
  place(createOpenShed(sLen, sDepth, pal), sx, sz, sRot);
  for (let k = -1; k <= 1; k++) {
    const c = toWorld(sx + k * sLen * 0.33, sz);
    hardColliders.push({ x: c.x, z: c.z, r: sDepth * 0.5 });
  }
  p = place(createWindmill(), L.windmill[0], L.windmill[1], 0.35, getTerrainHeight(toWorld(L.windmill[0], L.windmill[1]).x, toWorld(L.windmill[0], L.windmill[1]).z));
  hardColliders.push({ x: p.x, z: p.z, r: 1.5 });

  farmDecor[farmLot.name] = { lot: farmLot, scarecrows: L.scarecrows, pumpkinPatch: L.pumpkinPatch };

  // 3. Sloopbare hekken langs de oprit (niet waar een wei zelf aan de oprit grenst)
  const drivewayLen = farmLot.dist - 5.0;
  for (let fz = 8.5; fz < drivewayLen - 2; fz += 5.0) {
    [-1, 1].forEach((side) => {
      if (L.noDriveFence.includes(side)) return;
      const w = toWorld(side * 5.2, fz);
      const wy = getTerrainHeight(w.x, w.z);
      const fence = createWoodenFenceSection(4.4);
      fence.position.set(w.x, wy, w.z);
      fence.rotation.y = yaw + Math.PI * 0.5;
      scene.add(fence);
      registerDestructible(fence, w.x, wy + 0.5, w.z, 1.4, 'small', 12, 'Farm gate');
    });
  }

  // 4. Sloopbare hooibalen
  L.hay.forEach(([lx, lz, extraY]) => {
    const w = toWorld(lx, lz);
    const bale = createHayBale();
    const wy = getTerrainHeight(w.x, w.z) + 0.64 + extraY;
    bale.position.set(w.x, wy, w.z);
    bale.rotation.y = yaw + (Math.random() - 0.5) * 0.35;
    scene.add(bale);
    registerDestructible(bale, w.x, wy, w.z, 0.8, 'small', 8, 'Hay bale');
  });

  // 5. Akkers
  L.fields.forEach(([crop, x0, x1, z0, z1]) => {
    buildCropField(baseX, baseY, baseZ, yaw, (x0 + x1) * 0.5, (z0 + z1) * 0.5, x1 - x0, z1 - z0, crop, farmLot.name);
  });

  // 6. Omheinde weides met koeien en een drinkbak
  const fenceAlong = (x1, z1, x2, z2) => {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const n = Math.max(1, Math.round(len / 4.4));
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n;
      const lx = x1 + (x2 - x1) * t;
      const lz = z1 + (z2 - z1) * t;
      const w = toWorld(lx, lz);
      const wy = getTerrainHeight(w.x, w.z);
      const fence = createWoodenFenceSection(len / n);
      fence.position.set(w.x, wy, w.z);
      fence.rotation.y = yaw + Math.atan2(-(z2 - z1), x2 - x1);
      scene.add(fence);
      registerDestructible(fence, w.x, wy + 0.5, w.z, 1.4, 'small', 12, 'Pasture fence');
    }
  };
  L.pastures.forEach(({ rect: [pMinX, pMaxX, pMinZ, pMaxZ], cows: nCows, trough: [tx, tz] }) => {
    fenceAlong(pMinX, pMaxZ, pMaxX, pMaxZ);
    fenceAlong(pMinX, pMinZ, pMaxX, pMinZ);
    fenceAlong(pMinX, pMinZ, pMinX, pMaxZ);
    fenceAlong(pMaxX, pMinZ, pMaxX, pMaxZ);
    for (let c = 0; c < nCows; c++) {
      const lx = THREE.MathUtils.lerp(pMinX + 3, pMaxX - 3, (c + 0.5) / nCows) + (Math.random() - 0.5) * 2;
      const lz = THREE.MathUtils.lerp(pMinZ + 3, pMaxZ - 3, Math.random());
      const w = toWorld(lx, lz);
      const cow = createCow();
      cow.position.set(w.x, getTerrainHeight(w.x, w.z), w.z);
      cow.rotation.y = Math.random() * Math.PI * 2;
      scene.add(cow);
      const collider = { x: w.x, z: w.z, r: 1.1 };
      hardColliders.push(collider);
      cows.push({
        mesh: cow, collider, lx, lz, tx: lx, tz: lz, toWorld, yaw,
        bounds: { minX: pMinX + 2.5, maxX: pMaxX - 2.5, minZ: pMinZ + 2.5, maxZ: pMaxZ - 2.5 },
        avoid: { x: tx, z: tz }, // om de drinkbak heen
        idle: Math.random() * 4, phase: Math.random() * 10, speed: 0
      });
    }
    const tr = toWorld(tx, tz);
    const trough = createWaterTrough();
    trough.position.set(tr.x, getTerrainHeight(tr.x, tr.z), tr.z);
    trough.rotation.y = yaw;
    scene.add(trough);
    hardColliders.push({ x: tr.x, z: tr.z, r: 1.2 });
  });

  // 7. Natuurlijk bos achter de boerderij (Pinewood): plukjes met wisselende dichtheid, die doorlopen
  //    richting het tuincentrum; niet op een ander perceel
  if (L.backForest) {
    const insideOther = (x, z, margin) => ruralLots.some((o) => {
      if (o === farmLot || !o.flatBox) return false;
      const oc = Math.cos(o.yaw);
      const os = Math.sin(o.yaw);
      const dx = x - o.x;
      const dz = z - o.z;
      const lx = dx * oc - dz * os;
      const lz = dx * os + dz * oc;
      const ob = o.flatBox;
      return lx > ob.minLX - margin && lx < ob.maxLX + margin && lz > ob.minLZ - margin && lz < ob.maxLZ + margin;
    });
    plantNaturalGrove({
      toWorld: (lx, lz) => toWorld(lx, lz),
      roadGap: 5,
      maxSlope: 0.55,
      clusters: [
        [-26, -34, 9, 10, 0.55, 1.0],
        [-4, -33, 7, 6, 0.6, 0.75],
        [18, -35, 9, 9, 0.5, 0.9],
        [34, -38, 6, 5, 0.6, 1.1],
        [-14, -50, 12, 14, 0.6, 0.85],
        [12, -54, 11, 10, 0.65, 0.75],
        [-34, -60, 9, 7, 0.55, 0.9],
        [-22, -66, 8, 6, 0.6, 0.6]
      ],
      allowed: (lx, lz, x, z) => lz < -28.5 && !(Math.abs(lx) < 6 && lz > -30) && !insideOther(x, z, 6)
    });
  }
  // 8. Boerderijkraampje aan de weg
  if (L.farmStand) buildFarmStand(L.farmStand, toWorld, yaw, L.pal);
}

// Een laag die het terrein volgt (grindpad, stopstrook), van x0..x1 en z0..z1 in lokale coördinaten
function drapeStrip(toWorld, x0, x1, z0, z1, mat, lift = 0.05) {
  const nx = Math.max(1, Math.ceil((x1 - x0) / 1.5));
  const nz = Math.max(1, Math.ceil((z1 - z0) / 1.5));
  const pos = [];
  const idx = [];
  for (let j = 0; j <= nz; j++) {
    for (let i = 0; i <= nx; i++) {
      const p = toWorld(x0 + ((x1 - x0) * i) / nx, z0 + ((z1 - z0) * j) / nz);
      pos.push(p.x, getTerrainHeight(p.x, p.z) + lift, p.z);
    }
  }
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i;
      const b = a + nx + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  // zorg dat de bovenkant naar boven wijst (de draairichting hangt af van de stand van het perceel)
  if (geo.attributes.normal.getY(0) < 0) {
    for (let k = 0; k < idx.length; k += 3) [idx[k + 1], idx[k + 2]] = [idx[k + 2], idx[k + 1]];
    geo.setIndex(idx);
    geo.computeVertexNormals();
  }
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function makeFarmSignTexture(text, bg, fg) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = fg;
  ctx.font = '900 58px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 68);
  const tex = Object.assign(new THREE.CanvasTexture(c), { colorSpace: THREE.SRGBColorSpace });
  tex.needsUpdate = true;
  return tex;
}

// Houten kraampje met afdak aan de weg, met melkbussen en kaas.
function buildFarmStand({ at: [sx, sz], pull }, toWorld, yaw, pal) {
  drapeStrip(toWorld, pull[0], pull[1], pull[2], pull[3], yardGravelMat, 0.06);
  // houten stootbalken langs de achterkant van de stopstrook
  const beamMat = makeToonMat(0x8a5a36);
  for (let x = pull[0] + 1.6; x < pull[1] - 1.0; x += 3.0) {
    const p = toWorld(x, pull[2] + 0.5);
    const beam = createOutlinedMesh(new THREE.BoxGeometry(1.8, 0.16, 0.22), beamMat, 0.012, false);
    beam.position.set(p.x, getTerrainHeight(p.x, p.z) + 0.12, p.z);
    beam.rotation.y = yaw;
    scene.add(beam);
  }
  const base = toWorld(sx, sz);
  const by = getTerrainHeight(base.x, base.z);
  const stand = new THREE.Group();
  stand.position.set(base.x, by, base.z);
  stand.rotation.y = yaw; // de voorkant (+z) kijkt naar de weg
  scene.add(stand);
  const wood = makeToonMat(0x9a6a3e);
  const counter = createOutlinedMesh(new THREE.BoxGeometry(4.2, 1.0, 1.2), wood, 0.03);
  counter.position.set(0, 0.5, 0.4);
  stand.add(counter);
  const backWall = createOutlinedMesh(new THREE.BoxGeometry(4.2, 2.4, 0.15), wood, 0.03);
  backWall.position.set(0, 1.2, -0.6);
  stand.add(backWall);
  [-2.0, 2.0].forEach((px) => {
    const post = createOutlinedMesh(new THREE.BoxGeometry(0.14, 2.6, 0.14), wood, 0.015, false);
    post.position.set(px, 1.3, 0.95);
    stand.add(post);
  });
  const roof = createOutlinedMesh(new THREE.BoxGeometry(4.8, 0.14, 2.3), pal.roof, 0.03);
  roof.position.set(0, 2.7, 0.2);
  roof.rotation.x = -0.18;
  stand.add(roof);
  hardColliders.push({ x: base.x, z: base.z, r: 2.0 });

  // melkbussen en kaaswielen + bord
  const autumn = new THREE.Group();
  stand.add(autumn);
  const steel = makeToonMat(0xc9ced4);
  [[-1.4, 0.6], [-0.9, 0.7], [1.3, 1.45]].forEach(([px, pz]) => {
    const churn = createOutlinedMesh(new THREE.CylinderGeometry(0.22, 0.26, 0.7, 10), steel, 0.015, false);
    churn.position.set(px, pz > 1 ? 0.35 : 1.35, pz > 1 ? pz : 0.4);
    autumn.add(churn);
  });
  const cheese = makeToonMat(0xf2c230);
  [[0.2, 0.3], [0.8, 0.5], [0.5, 0.15]].forEach(([px, pz], k) => {
    const wheel = createOutlinedMesh(new THREE.CylinderGeometry(0.28, 0.28, 0.16, 12), cheese, 0.012, false);
    wheel.position.set(px, 1.08 + (k === 2 ? 0.16 : 0), pz);
    autumn.add(wheel);
  });
  const milkSign = new THREE.Mesh(
    new THREE.PlaneGeometry(3.6, 0.8),
    new THREE.MeshBasicMaterial({ map: makeFarmSignTexture('FRESH MILK · CHEESE', '#3f6b4a', '#ffffff'), polygonOffset: true, polygonOffsetFactor: -4 })
  );
  milkSign.position.set(0, 2.15, -0.5);
  autumn.add(milkSign);
}

const cows = [];
// Koe op een helling: hoogte uit het midden onder het lijf en meekantelen (voor/achter en links/rechts)
function alignCow(c) {
  const p = c.mesh.position;
  const yaw = c.mesh.rotation.y;
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  const hF = getTerrainHeight(p.x + fx * 0.85, p.z + fz * 0.85);
  const hB = getTerrainHeight(p.x - fx * 0.85, p.z - fz * 0.85);
  const hR = getTerrainHeight(p.x + fz * 0.35, p.z - fx * 0.35);
  const hL = getTerrainHeight(p.x - fz * 0.35, p.z + fx * 0.35);
  p.y = (hF + hB + hL + hR) * 0.25;
  c.mesh.rotation.order = 'YXZ';
  c.mesh.rotation.x = THREE.MathUtils.clamp(-Math.atan2(hF - hB, 1.7), -0.4, 0.4);
  c.mesh.rotation.z = THREE.MathUtils.clamp(Math.atan2(hR - hL, 0.7), -0.3, 0.3);
}
ruralLots.filter((l) => l.type === 'farm').forEach(buildFarm);
cows.forEach(alignCow);

// Koeien grazen, lopen rustig rond in hun wei en lopen weg als je te dichtbij komt
export function updateCows(px, pz, dt, elapsed) {
  for (const c of cows) {
    const pos = c.mesh.position;
    const distPlayer = Math.hypot(px - pos.x, pz - pos.z);
    if (distPlayer > 160) continue;
    const b = c.bounds;
    if (distPlayer < 10 && c.speed < 2) {
      // Schrikken: doel aan de andere kant van de wei kiezen
      const away = Math.atan2(pos.x - px, pos.z - pz) - c.yaw;
      c.tx = THREE.MathUtils.clamp(c.lx + Math.sin(away) * 9, b.minX, b.maxX);
      c.tz = THREE.MathUtils.clamp(c.lz + Math.cos(away) * 9, b.minZ, b.maxZ);
      c.idle = 0;
      c.speed = 2.6;
    }
    const dx = c.tx - c.lx;
    const dz = c.tz - c.lz;
    const d = Math.hypot(dx, dz);
    if (d < 0.3) {
      c.speed = 0;
      c.idle -= dt;
      // Grazen: kop gaat op en neer
      c.mesh.userData.head.position.y = 1.35 - (Math.sin(elapsed * 1.4 + c.phase) * 0.5 + 0.5) * 0.45;
      if (c.idle <= 0) {
        for (let tries = 0; tries < 6; tries++) {
          const nx = THREE.MathUtils.lerp(b.minX, b.maxX, Math.random());
          const nz = THREE.MathUtils.lerp(b.minZ, b.maxZ, Math.random());
          if (Math.hypot(nx - c.avoid.x, nz - c.avoid.z) < 4) continue;
          c.tx = nx;
          c.tz = nz;
          break;
        }
        c.speed = 0.9;
        c.idle = 3 + Math.random() * 6;
      }
    } else {
      const step = Math.min(d, (c.speed || 0.9) * dt);
      c.lx += (dx / d) * step;
      c.lz += (dz / d) * step;
      const w = c.toWorld(c.lx, c.lz);
      pos.set(w.x, getTerrainHeight(w.x, w.z), w.z);
      // Lopen in de richting van het doel (lokale assen -> wereldhoek)
      const targetRot = c.yaw + Math.atan2(dx, dz);
      let diff = targetRot - c.mesh.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      c.mesh.rotation.y += diff * Math.min(1, dt * 3);
      const swing = Math.sin(elapsed * (c.speed > 1.5 ? 11 : 6) + c.phase) * 0.45;
      c.mesh.userData.legs.forEach((leg, i) => { leg.rotation.x = i % 3 === 0 ? swing : -swing; });
      c.mesh.userData.head.position.y = 1.35;
      c.collider.x = w.x;
      c.collider.z = w.z;
      alignCow(c);
      if (c.speed > 1.5 && d < 1) c.speed = 0.9;
    }
  }
}

// Kaart: gebouwen krijgen hun soort mee (zie map-tags.js)
function createGrandBarn(...args) { return tagMap(createGrandBarn__build(...args), 'farm'); }
function createFarmHouse(...args) { return tagMap(createFarmHouse__build(...args), 'home'); }
function createGrainSilo(...args) { return tagMap(createGrainSilo__build(...args), 'farm'); }
function createWindmill(...args) { return tagMap(createWindmill__build(...args), 'farm'); }
function createOpenShed(...args) { return tagMap(createOpenShed__build(...args), 'farm'); }

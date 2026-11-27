import * as THREE from 'three';
import { scene, makeToonMat } from './scene-setup.js';

// =========================================================
// BANDENSPOREN & GEOPTIMALISEERDE PARTICLE POOL (0 GC LAG!)
// =========================================================
const MAX_SKID_MARKS = 1100;
const skidDummy = new THREE.Object3D();
const skidGeo = new THREE.PlaneGeometry(0.42, 1.15);
skidGeo.rotateX(-Math.PI / 2);

export const skidMat = new THREE.MeshBasicMaterial({
  color: 0x1c1614,
  transparent: true,
  opacity: 0.58,
  depthWrite: false,
  polygonOffset: true,
  polygonOffsetFactor: -5,
  polygonOffsetUnits: -5
});

const skidInstancedMesh = new THREE.InstancedMesh(skidGeo, skidMat, MAX_SKID_MARKS);
skidInstancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
skidInstancedMesh.frustumCulled = false;
for (let i = 0; i < MAX_SKID_MARKS; i++) {
  skidDummy.position.set(0, -999, 0);
  skidDummy.updateMatrix();
  skidInstancedMesh.setMatrixAt(i, skidDummy.matrix);
}
scene.add(skidInstancedMesh);

let skidCursor = 0;
export function dropTireMark(x, y, z, travelAngle, slopePitch = 0) {
  skidDummy.position.set(x, y + 0.045, z);
  skidDummy.rotation.order = 'YXZ';
  skidDummy.rotation.set(slopePitch, travelAngle, 0);
  skidDummy.updateMatrix();
  skidInstancedMesh.setMatrixAt(skidCursor, skidDummy.matrix);
  skidCursor = (skidCursor + 1) % MAX_SKID_MARKS;
  skidInstancedMesh.instanceMatrix.needsUpdate = true;
}

// Herbruikbare Object-Pool voor Rook, Waterspetters & Houtsplinters (voorkomt scene.add/remove stotteren!)
export const PARTICLE_POOL_SIZE = 90;
export const particlePool = [];
const sharedPuffGeo = new THREE.DodecahedronGeometry(0.26, 0);
const pMats = {
  smoke: makeToonMat(0xfffaf2),
  drift: makeToonMat(0xe8e4dc),
  splash: makeToonMat(0x9be7ff),
  chip: makeToonMat(0xc78846),
  leaf: makeToonMat(0x6e9e48)
};

for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
  const m = new THREE.Mesh(sharedPuffGeo, pMats.smoke);
  m.visible = false;
  scene.add(m);
  particlePool.push({ mesh: m, active: false, age: 0, maxAge: 0.7, vx: 0, vy: 0, vz: 0, gravity: 0, baseScale: 1 });
}
let poolPtr = 0;

export function spawnParticle(pos, mode = 'smoke', scaleMult = 1) {
  const p = particlePool[poolPtr];
  poolPtr = (poolPtr + 1) % PARTICLE_POOL_SIZE;

  const isPhys = mode === 'splash' || mode === 'chip' || mode === 'leaf';
  p.mesh.material = pMats[mode] || pMats.smoke;
  p.mesh.position.copy(pos);
  p.mesh.scale.setScalar(scaleMult);
  p.mesh.visible = true;
  p.active = true;
  p.age = 0;
  p.maxAge = isPhys ? 0.55 : 0.72;
  p.vy = isPhys ? 4.2 + Math.random() * 3.0 : 1.35;
  p.vx = (Math.random() - 0.5) * (isPhys ? 5.0 : 0.65);
  p.vz = (Math.random() - 0.5) * (isPhys ? 5.0 : 0.65);
  p.gravity = isPhys ? 15.0 : 0;
  p.baseScale = scaleMult;
}

// =========================================================
// VUURVLIEGJES ('s NACHTS) — 1 gedeelde Points-mesh, rondzwermend bij de speler
// =========================================================
const FIREFLY_COUNT = 90;
const fireflyGeo = new THREE.BufferGeometry();
const fireflyPos = new Float32Array(FIREFLY_COUNT * 3);
const fireflyBase = new Float32Array(FIREFLY_COUNT * 3);
const fireflyPhase = new Float32Array(FIREFLY_COUNT);
for (let i = 0; i < FIREFLY_COUNT; i++) {
  fireflyBase[i * 3] = (Math.random() - 0.5) * 90;
  fireflyBase[i * 3 + 1] = 0.4 + Math.random() * 1.6;
  fireflyBase[i * 3 + 2] = (Math.random() - 0.5) * 90;
  fireflyPhase[i] = Math.random() * Math.PI * 2;
}
fireflyGeo.setAttribute('position', new THREE.BufferAttribute(fireflyPos, 3));
const fireflyColors = new Float32Array(FIREFLY_COUNT * 3);
fireflyGeo.setAttribute('color', new THREE.BufferAttribute(fireflyColors, 3));
const fireflyMat = new THREE.PointsMaterial({
  size: 0.13,
  vertexColors: true,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending
});
export const fireflySystem = new THREE.Points(fireflyGeo, fireflyMat);
fireflySystem.visible = false;
fireflySystem.frustumCulled = false;
scene.add(fireflySystem);

export function updateFireflies(dt, elapsed, px, pz, isNightMode) {
  fireflySystem.visible = isNightMode;
  if (!isNightMode) return;

  const posAttr = fireflyGeo.attributes.position;
  const colAttr = fireflyGeo.attributes.color;
  for (let i = 0; i < FIREFLY_COUNT; i++) {
    const idx = i * 3;
    let bx = fireflyBase[idx];
    let bz = fireflyBase[idx + 2];
    if ((bx - px) ** 2 + (bz - pz) ** 2 > 70 * 70) {
      bx = px + (Math.random() - 0.5) * 90;
      bz = pz + (Math.random() - 0.5) * 90;
      fireflyBase[idx] = bx;
      fireflyBase[idx + 2] = bz;
    }
    const t = elapsed * 0.6 + fireflyPhase[i];
    posAttr.array[idx] = bx + Math.sin(t) * 1.4;
    posAttr.array[idx + 1] = fireflyBase[idx + 1] + Math.sin(t * 1.7) * 0.35;
    posAttr.array[idx + 2] = bz + Math.cos(t * 0.8) * 1.4;

    const glow = 0.4 + 0.6 * Math.max(0, Math.sin(t * 2.2 + i));
    colAttr.array[idx] = glow;
    colAttr.array[idx + 1] = glow * 0.95;
    colAttr.array[idx + 2] = glow * 0.5;
  }
  posAttr.needsUpdate = true;
  colAttr.needsUpdate = true;
}

// =========================================================
// VALLENDE HERFSTBLADEREN — kleine pool bladerplaatjes, dwarrelend rond de speler
// =========================================================
const LEAF_COUNT = 70;
const fallingLeafGeo = new THREE.PlaneGeometry(0.22, 0.16);
const fallingLeafMats = [0xd97b2b, 0xc94a38, 0xe0a83a, 0x8a9e3a].map(
  (c) => new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide, transparent: true, opacity: 0.92 })
);
export const fallingLeavesGroup = new THREE.Group();
scene.add(fallingLeavesGroup);

const fallingLeaves = [];
for (let i = 0; i < LEAF_COUNT; i++) {
  const mesh = new THREE.Mesh(fallingLeafGeo, fallingLeafMats[i % fallingLeafMats.length]);
  mesh.visible = false;
  fallingLeavesGroup.add(mesh);
  fallingLeaves.push({
    mesh,
    inited: false,
    phase: Math.random() * 10,
    fallSpeed: 0.45 + Math.random() * 0.5,
    swayFreq: 0.6 + Math.random() * 0.8
  });
}

export function updateFallingLeaves(dt, elapsed, px, py, pz, isChristmasMode) {
  const active = !isChristmasMode;
  fallingLeavesGroup.visible = active;
  if (!active) return;

  fallingLeaves.forEach((lf) => {
    const m = lf.mesh;
    if (!lf.inited) {
      m.position.set(px + (Math.random() - 0.5) * 70, py + 4 + Math.random() * 14, pz + (Math.random() - 0.5) * 70);
      lf.inited = true;
    }
    m.position.y -= lf.fallSpeed * dt;
    m.position.x += Math.sin(elapsed * lf.swayFreq + lf.phase) * 0.35 * dt;
    m.rotation.z += dt * 0.8;
    m.rotation.x = Math.sin(elapsed * 1.3 + lf.phase) * 0.6;

    const outOfRange = (m.position.x - px) ** 2 + (m.position.z - pz) ** 2 > 80 * 80;
    if (m.position.y < py - 1.5 || outOfRange) {
      m.position.set(px + (Math.random() - 0.5) * 70, py + 10 + Math.random() * 8, pz + (Math.random() - 0.5) * 70);
    }
    m.visible = true;
  });
}

import * as THREE from 'three';
import { scene, makeToonMat, createOutlinedMesh } from './scene-setup.js';
import { WATER_LEVEL } from './roads.js';
import { ISLAND_CENTER, getCoastRadius } from './landscape.js';
import { spawnParticle } from './effects.js';

// =========================================================
// ORKA'S: zwemmen rond het eiland, laten hun rugvin zien
// en springen af en toe hoog uit het water.
// =========================================================
const orcaBlackMat = makeToonMat(0x1d1f24);
const orcaWhiteMat = makeToonMat(0xf4f4f0);

function createOrca() {
  const g = new THREE.Group();
  // Lijf: gestrekte bol, neus naar +z
  const body = createOutlinedMesh(new THREE.SphereGeometry(1, 14, 10), orcaBlackMat, 0.05);
  body.scale.set(1.15, 1.05, 3.6);
  g.add(body);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), orcaWhiteMat);
  belly.scale.set(0.95, 0.7, 2.8);
  belly.position.set(0, -0.38, 0.5);
  g.add(belly);
  // Witte oogvlekken
  [-1, 1].forEach((side) => {
    const patch = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), orcaWhiteMat);
    patch.scale.set(0.4, 0.55, 1.2);
    patch.position.set(side * 0.82, 0.38, 2.3);
    g.add(patch);
  });
  // Hoge rugvin (het herkenbare silhouet boven water)
  const finShape = new THREE.Shape();
  finShape.moveTo(-0.9, 0);
  finShape.lineTo(0.25, 2.1);
  finShape.lineTo(0.75, 0);
  finShape.closePath();
  const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.2, bevelEnabled: false });
  finGeo.translate(0, 0, -0.1);
  finGeo.rotateY(-Math.PI * 0.5);
  const fin = createOutlinedMesh(finGeo, orcaBlackMat, 0.04);
  fin.position.set(0, 0.85, -0.2);
  g.add(fin);
  // Borstvinnen
  [-1, 1].forEach((side) => {
    const flipper = createOutlinedMesh(new THREE.BoxGeometry(1.3, 0.12, 0.7), orcaBlackMat, 0.025, false);
    flipper.position.set(side * 1.25, -0.45, 1.0);
    flipper.rotation.z = side * -0.4;
    g.add(flipper);
  });
  // Staart met horizontale vinnen
  const tailGroup = new THREE.Group();
  tailGroup.position.set(0, 0.05, -3.4);
  const flukes = createOutlinedMesh(new THREE.BoxGeometry(2.6, 0.12, 0.8), orcaBlackMat, 0.03, false);
  flukes.position.z = -0.4;
  tailGroup.add(flukes);
  g.add(tailGroup);
  g.userData.tail = tailGroup;
  return g;
}

// Zwemroutes: banen rond het eiland op een vaste afstand buiten de kust
function makeOrca(theta0, offset, speed, dir, scale) {
  const mesh = createOrca();
  mesh.scale.setScalar(scale);
  scene.add(mesh);
  return {
    mesh, theta: theta0, offset, speed, dir, scale,
    phase: Math.random() * 10,
    breachTimer: 12 + Math.random() * 30,
    breachT: -1,
    lastY: 0
  };
}

const orcas = [
  // Een groepje van drie dicht bij elkaar, plus twee losse orka's elders
  makeOrca(1.2, 42, 5.5, 1, 1.0),
  makeOrca(1.17, 50, 5.5, 1, 0.85),
  makeOrca(1.23, 38, 5.5, 1, 0.7),
  makeOrca(-0.4, 60, 6.5, -1, 1.05),
  makeOrca(2.9, 48, 5.0, -1, 0.95)
];

const tmpPos = new THREE.Vector3();

function posOnRoute(o, theta) {
  const r = getCoastRadius(theta) + o.offset;
  return { x: ISLAND_CENTER.x + Math.cos(theta) * r, z: ISLAND_CENTER.z + Math.sin(theta) * r };
}

export function updateOrcas(elapsed, dt, px, pz) {
  for (let i = 0; i < orcas.length; i++) {
    const o = orcas[i];
    const r0 = getCoastRadius(o.theta) + o.offset;
    o.theta += ((o.speed * dt) / r0) * o.dir;
    const p = posOnRoute(o, o.theta);
    const ahead = posOnRoute(o, o.theta + 0.01 * o.dir);
    const yaw = Math.atan2(ahead.x - p.x, ahead.z - p.z);

    // Normaal zwemmen: rustig op en neer — de rugvin snijdt regelmatig door het water
    const swim = Math.sin(elapsed * 0.55 + o.phase);
    let y = WATER_LEVEL - 1.05 * o.scale + swim * 0.75 * o.scale - (swim < -0.4 ? 1.2 : 0);
    let pitch = -Math.cos(elapsed * 0.55 + o.phase) * 0.12;

    // Af en toe een sprong
    o.breachTimer -= dt;
    if (o.breachT < 0 && o.breachTimer <= 0) {
      o.breachT = 0;
      o.breachTimer = 20 + Math.random() * 40;
    }
    if (o.breachT >= 0) {
      o.breachT += dt / 2.2;
      const t = o.breachT;
      if (t >= 1) {
        o.breachT = -1;
      } else {
        y = WATER_LEVEL - 1.6 + Math.sin(t * Math.PI) * 6.2 * o.scale;
        pitch = THREE.MathUtils.lerp(-0.9, 1.0, t);
        const wasUnder = o.lastY < WATER_LEVEL;
        const isUnder = y < WATER_LEVEL;
        // Plons bij het uitspringen en weer neerkomen (alleen als de speler in de buurt is)
        if (wasUnder !== isUnder && Math.hypot(px - p.x, pz - p.z) < 160) {
          for (let k = 0; k < 10; k++) {
            tmpPos.set(p.x + (Math.random() - 0.5) * 3, WATER_LEVEL + 0.2, p.z + (Math.random() - 0.5) * 3);
            spawnParticle(tmpPos, 'splash', 1.6);
          }
        }
      }
    }

    o.mesh.position.set(p.x, y, p.z);
    o.mesh.rotation.order = 'YXZ';
    o.mesh.rotation.set(pitch, yaw, Math.sin(elapsed * 0.8 + o.phase) * 0.06);
    o.mesh.userData.tail.rotation.x = Math.sin(elapsed * 2.6 + o.phase) * 0.35;
    o.lastY = y;
  }
}

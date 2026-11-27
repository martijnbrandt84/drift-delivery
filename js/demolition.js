import * as THREE from 'three';

// =========================================================
// SLOOPFYSICA LIJSTEN
// =========================================================
export const hardColliders = [];
export const destructibles = [];

export function registerDestructible(mesh, x, y, z, r, kind, crimePts = 15, label = 'Object') {
  destructibles.push({
    mesh,
    kind,
    origX: x,
    origY: y,
    origZ: z,
    origQuat: mesh.quaternion.clone(),
    origScale: mesh.scale.clone(),
    x,
    y,
    z,
    r,
    intact: true,
    activeAnim: false,
    vx: 0,
    vy: 0,
    vz: 0,
    spinX: 0,
    spinZ: 0,
    fallAxis: new THREE.Vector3(1, 0, 0),
    fallAngle: 0,
    fallVel: 0,
    respawnTimer: 0,
    crimePts,
    label
  });
}

// =========================================================
// INSTANCED SLOOPBARE OBJECTEN (bossen buiten de kern):
// een onzichtbare proxy wordt geanimeerd, de instance-matrices volgen hem.
// =========================================================
// Bewust geplaatst groen (camping, parkeerplaats, vliegveld) wordt niet als 'wilde' begroeiing opgeruimd
export function markLastPlanted() {
  destructibles[destructibles.length - 1].planted = true;
}

export function registerInstancedDestructible(instRefs, x, y, z, rotY, scale, r, kind, crimePts, label) {
  const proxy = new THREE.Object3D();
  proxy.position.set(x, y, z);
  proxy.rotation.set(0, rotY, 0);
  proxy.scale.setScalar(scale);
  proxy.updateMatrix();
  registerDestructible(proxy, x, y, z, r, kind, crimePts, label);
  destructibles[destructibles.length - 1].instRefs = instRefs;
}

export function syncInstancedDestructible(d) {
  d.mesh.updateMatrix();
  for (let i = 0; i < d.instRefs.length; i++) {
    const ref = d.instRefs[i];
    ref.mesh.setMatrixAt(ref.index, d.mesh.matrix);
    ref.mesh.instanceMatrix.needsUpdate = true;
  }
}

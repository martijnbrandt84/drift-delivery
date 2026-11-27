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

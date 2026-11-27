import * as THREE from 'three';
import { scene, createOutlinedMesh, makeToonMat } from './scene-setup.js';
import { getClosestNetworkRoad, WATER_LEVEL } from './roads.js';
import { getDistToRivers, getLakeShoreRadius } from './water-lots.js';
import { getTerrainHeight } from './terrain.js';
import { isInsideTownFootprint } from './props.js';
import { MOOSE_LAKE } from './landscape.js';

// =========================================================
// DIEREN IN HET WILD: KALKOENEN, HERTEN, VOSSEN,
// BEREN, WASBEREN, BEVERS, EENDEN & ZWANEN
// =========================================================
export const turkeys = [];
export const deerList = [];
export const foxes = [];
export const ducks = [];

const turkeyFeatherMat = makeToonMat(0x593724);
const turkeyTailMat = makeToonMat(0x8c512d);
const turkeyHeadBlueMat = makeToonMat(0x4c749c);
const wattleRedMat = makeToonMat(0xe62e2e);
export const beakYellowMat = makeToonMat(0xf4a226);

const deerFurMat = makeToonMat(0xb57242);
const deerBellyMat = makeToonMat(0xf2e4cf);
const antlerMat = makeToonMat(0xe8d4b4);
export const darkHoofMat = makeToonMat(0x2e2621);

const foxMat = makeToonMat(0xe0632b);
const foxWhite = makeToonMat(0xfff6eb);
export const foxDarkMat = makeToonMat(0x362a24);

const bearFurMat = makeToonMat(0x5c3a24);
const bearSnoutMat = makeToonMat(0x8c6244);
const bearNoseMat = makeToonMat(0x241812);

const raccoonFurMat = makeToonMat(0x7d766e);
const raccoonMaskMat = makeToonMat(0x2b2725);
const raccoonLightMat = makeToonMat(0xb5aea4);

const beaverFurMat = makeToonMat(0x6e472b);
const beaverTailMat = makeToonMat(0x3d2c22);
const beaverToothMat = makeToonMat(0xfff7e6);

const duckBodyMat = makeToonMat(0x3d3f33);
const duckWhiteMat = makeToonMat(0xf2ead8);
const duckBeakMat = makeToonMat(0xf4a226);
const swanWhiteMat = makeToonMat(0xfaf8f2);

function createWildTurkey() {
  const root = new THREE.Group();
  const bodyGrp = new THREE.Group();
  root.add(bodyGrp);

  const plumpBody = createOutlinedMesh(new THREE.SphereGeometry(0.45, 10, 9), turkeyFeatherMat, 0.03, true, false);
  plumpBody.scale.set(0.95, 0.92, 1.2);
  plumpBody.position.y = 0.58;
  bodyGrp.add(plumpBody);

  const fanGeo = new THREE.CylinderGeometry(0.72, 0.2, 0.11, 11, 1, false, 0, Math.PI);
  const fanTail = createOutlinedMesh(fanGeo, turkeyTailMat, 0.028, false, false);
  fanTail.rotation.x = Math.PI * 0.42;
  fanTail.rotation.y = Math.PI * 0.5;
  fanTail.position.set(0, 0.84, -0.46);
  bodyGrp.add(fanTail);

  const tailTipBand = new THREE.Mesh(
    new THREE.CylinderGeometry(0.73, 0.66, 0.12, 11, 1, true, 0, Math.PI),
    turkeyFeatherMat
  );
  tailTipBand.rotation.x = Math.PI * 0.42;
  tailTipBand.rotation.y = Math.PI * 0.5;
  tailTipBand.position.set(0, 0.85, -0.47);
  bodyGrp.add(tailTipBand);

  const headPivot = new THREE.Group();
  headPivot.position.set(0, 0.78, 0.36);
  bodyGrp.add(headPivot);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.15, 0.36, 7), turkeyHeadBlueMat);
  neck.position.set(0, 0.16, 0.05);
  headPivot.add(neck);

  const head = createOutlinedMesh(new THREE.SphereGeometry(0.16, 8, 8), turkeyHeadBlueMat, 0.02, false, false);
  head.position.set(0, 0.35, 0.11);
  headPivot.add(head);

  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.058, 0.21, 6), beakYellowMat);
  beak.rotation.x = Math.PI * 0.5;
  beak.position.set(0, 0.35, 0.27);
  headPivot.add(beak);

  const wattle = new THREE.Mesh(new THREE.SphereGeometry(0.075, 6, 6), wattleRedMat);
  wattle.scale.set(0.65, 1.9, 0.7);
  wattle.position.set(0, 0.22, 0.22);
  headPivot.add(wattle);

  const leftWing = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.34, 0.52), turkeyTailMat);
  leftWing.position.set(-0.43, 0.6, 0);
  bodyGrp.add(leftWing);

  const rightWing = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.34, 0.52), turkeyTailMat);
  rightWing.position.set(0.43, 0.6, 0);
  bodyGrp.add(rightWing);

  const legs = [];
  [-0.14, 0.14].forEach((lx, k) => {
    const pivot = new THREE.Group();
    pivot.position.set(lx, 0.36, 0);
    bodyGrp.add(pivot);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.36, 5), beakYellowMat);
    leg.position.y = -0.18;
    pivot.add(leg);
    legs.push({ pivot, sign: k === 0 ? 1 : -1 });
  });

  return { root, bodyGrp, bodyGroup: bodyGrp, headPivot, fanTail, leftWing, rightWing, legs, species: 'turkey' };
}

function createCartoonDeer(hasAntlers) {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const torso = createOutlinedMesh(new THREE.SphereGeometry(0.46, 9, 8), deerFurMat, 0.032, true, false);
  torso.scale.set(0.82, 0.85, 1.65);
  torso.position.y = 1.04;
  bodyGroup.add(torso);

  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.36, 8, 7), deerBellyMat);
  belly.scale.set(0.75, 0.65, 1.35);
  belly.position.set(0, 0.9, 0.05);
  bodyGroup.add(belly);

  const tail = new THREE.Mesh(new THREE.SphereGeometry(0.11, 6, 6), deerBellyMat);
  tail.position.set(0, 1.18, -0.76);
  tail.rotation.x = 0.5;
  bodyGroup.add(tail);

  const neckPivot = new THREE.Group();
  neckPivot.position.set(0, 1.22, 0.52);
  bodyGroup.add(neckPivot);

  const neck = createOutlinedMesh(new THREE.CylinderGeometry(0.14, 0.21, 0.48, 7), deerFurMat, 0.025, false, false);
  neck.position.set(0, 0.2, 0.08);
  neck.rotation.x = 0.35;
  neckPivot.add(neck);

  const head = createOutlinedMesh(new THREE.BoxGeometry(0.34, 0.34, 0.56), deerFurMat, 0.028, false, false);
  head.position.set(0, 0.44, 0.26);
  neckPivot.add(head);

  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), foxDarkMat);
  nose.position.set(0, 0.41, 0.55);
  neckPivot.add(nose);

  [-0.18, 0.18].forEach((ex) => {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.24, 5), deerFurMat);
    ear.position.set(ex, 0.64, 0.18);
    ear.rotation.z = ex < 0 ? 0.75 : -0.75;
    neckPivot.add(ear);
  });

  if (hasAntlers) {
    [-0.14, 0.14].forEach((ax) => {
      const sign = ax < 0 ? -1 : 1;
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.038, 0.52, 5), antlerMat);
      beam.position.set(ax, 0.82, 0.16);
      beam.rotation.z = -sign * 0.28;
      beam.rotation.x = -0.15;
      neckPivot.add(beam);

      const tine = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.028, 0.24, 5), antlerMat);
      tine.position.set(ax + sign * 0.12, 0.88, 0.22);
      tine.rotation.z = -sign * 0.85;
      neckPivot.add(tine);
    });
  }

  const legs = [];
  [[-0.2, 0.45], [0.2, 0.45], [-0.2, -0.45], [0.2, -0.45]].forEach(([lx, lz], k) => {
    const pivot = new THREE.Group();
    pivot.position.set(lx, 0.76, lz);
    bodyGroup.add(pivot);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.74, 6), deerFurMat);
    leg.position.y = -0.37;
    pivot.add(leg);

    const hoof = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.065, 0.08, 6), darkHoofMat);
    hoof.position.y = -0.72;
    pivot.add(hoof);
    legs.push({ pivot, sign: k === 0 || k === 3 ? 1 : -1 });
  });

  return { root, bodyGroup, neckPivot, legs, species: 'deer' };
}

function createForestBear() {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const torso = createOutlinedMesh(new THREE.SphereGeometry(0.68, 10, 9), bearFurMat, 0.038, true, false);
  torso.scale.set(0.95, 0.92, 1.48);
  torso.position.y = 1.05;
  bodyGroup.add(torso);

  const shoulder = createOutlinedMesh(new THREE.SphereGeometry(0.56, 9, 8), bearFurMat, 0.034, false, false);
  shoulder.scale.set(1.0, 0.96, 1.05);
  shoulder.position.set(0, 1.24, 0.42);
  bodyGroup.add(shoulder);

  const tail = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), bearFurMat);
  tail.position.set(0, 1.05, -0.96);
  bodyGroup.add(tail);

  const neckPivot = new THREE.Group();
  neckPivot.position.set(0, 1.24, 0.78);
  bodyGroup.add(neckPivot);

  const head = createOutlinedMesh(new THREE.SphereGeometry(0.36, 9, 8), bearFurMat, 0.032, false, false);
  head.scale.set(1.02, 0.92, 1.12);
  head.position.set(0, 0.1, 0.24);
  neckPivot.add(head);

  const snout = createOutlinedMesh(new THREE.BoxGeometry(0.28, 0.22, 0.34), bearSnoutMat, 0.024, false, false);
  snout.position.set(0, 0.04, 0.52);
  neckPivot.add(snout);

  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.065, 6, 6), bearNoseMat);
  nose.position.set(0, 0.11, 0.69);
  neckPivot.add(nose);

  [-0.26, 0.26].forEach((ex) => {
    const ear = createOutlinedMesh(new THREE.SphereGeometry(0.11, 7, 7), bearFurMat, 0.022, false, false);
    ear.position.set(ex, 0.38, 0.18);
    neckPivot.add(ear);
  });

  const legs = [];
  [[-0.36, 0.56], [0.36, 0.56], [-0.36, -0.56], [0.36, -0.56]].forEach(([lx, lz], k) => {
    const pivot = new THREE.Group();
    pivot.position.set(lx, 0.68, lz);
    bodyGroup.add(pivot);
    const leg = createOutlinedMesh(new THREE.CylinderGeometry(0.14, 0.16, 0.68, 7), bearFurMat, 0.028, false, false);
    leg.position.y = -0.34;
    pivot.add(leg);

    const paw = new THREE.Mesh(new THREE.SphereGeometry(0.17, 7, 6), bearNoseMat);
    paw.scale.set(1.0, 0.45, 1.25);
    paw.position.set(0, -0.62, 0.04);
    pivot.add(paw);
    legs.push({ pivot, sign: k === 0 || k === 3 ? 1 : -1 });
  });

  return { root, bodyGroup, neckPivot, legs, species: 'bear' };
}

function createCartoonFox() {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const torso = createOutlinedMesh(new THREE.SphereGeometry(0.28, 8, 7), foxMat, 0.026, true, false);
  torso.scale.set(0.85, 0.85, 1.55);
  torso.position.y = 0.46;
  bodyGroup.add(torso);

  const head = createOutlinedMesh(new THREE.BoxGeometry(0.34, 0.3, 0.34), foxMat, 0.024, false, false);
  head.position.set(0, 0.66, 0.42);
  bodyGroup.add(head);

  const snout = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.24, 5), foxWhite);
  snout.rotation.x = Math.PI * 0.5;
  snout.position.set(0, 0.63, 0.64);
  bodyGroup.add(snout);

  const noseTip = new THREE.Mesh(new THREE.SphereGeometry(0.04, 5, 5), foxDarkMat);
  noseTip.position.set(0, 0.63, 0.76);
  bodyGroup.add(noseTip);

  [-0.12, 0.12].forEach((ex) => {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 5), foxMat);
    ear.position.set(ex, 0.88, 0.38);
    ear.rotation.z = ex < 0 ? 0.15 : -0.15;
    bodyGroup.add(ear);
  });

  // Staart aan een scharnier, zodat hij kan kwispelen
  const tail = new THREE.Group();
  tail.position.set(0, 0.47, -0.36);
  bodyGroup.add(tail);
  const tailBase = createOutlinedMesh(new THREE.ConeGeometry(0.14, 0.52, 6), foxMat, 0.024, false, false);
  tailBase.rotation.x = -Math.PI * 0.38;
  tailBase.position.set(0, 0.03, -0.22);
  tail.add(tailBase);

  const tailTip = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.22, 6), foxWhite);
  tailTip.rotation.x = -Math.PI * 0.38;
  tailTip.position.set(0, 0.11, -0.42);
  tail.add(tailTip);

  const legs = [];
  [[-0.12, 0.26], [0.12, 0.26], [-0.12, -0.26], [0.12, -0.26]].forEach(([lx, lz], k) => {
    const pivot = new THREE.Group();
    pivot.position.set(lx, 0.34, lz);
    bodyGroup.add(pivot);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.038, 0.34, 5), foxDarkMat);
    leg.position.y = -0.17;
    pivot.add(leg);
    legs.push({ pivot, sign: k === 0 || k === 3 ? 1 : -1 });
  });

  return { root, bodyGroup, tail, legs, species: 'fox' };
}

function createRaccoon() {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const torso = createOutlinedMesh(new THREE.SphereGeometry(0.25, 8, 7), raccoonFurMat, 0.024, true, false);
  torso.scale.set(0.95, 0.85, 1.45);
  torso.position.y = 0.34;
  bodyGroup.add(torso);

  const head = createOutlinedMesh(new THREE.SphereGeometry(0.19, 8, 7), raccoonLightMat, 0.022, false, false);
  head.scale.set(1.05, 0.9, 1.15);
  head.position.set(0, 0.48, 0.32);
  bodyGroup.add(head);

  const mask = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.11, 0.18), raccoonMaskMat);
  mask.position.set(0, 0.5, 0.42);
  bodyGroup.add(mask);

  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.035, 5, 5), foxDarkMat);
  nose.position.set(0, 0.46, 0.54);
  bodyGroup.add(nose);

  [-0.12, 0.12].forEach((ex) => {
    const ear = createOutlinedMesh(new THREE.ConeGeometry(0.065, 0.16, 5), raccoonFurMat, 0.018, false, false);
    ear.position.set(ex, 0.68, 0.28);
    ear.rotation.z = ex < 0 ? 0.2 : -0.2;
    bodyGroup.add(ear);
  });

  for (let r = 0; r < 4; r++) {
    const ringMat = r % 2 === 0 ? raccoonMaskMat : raccoonLightMat;
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.085 - r * 0.01, 0.095 - r * 0.01, 0.12, 7), ringMat);
    ring.rotation.x = Math.PI * 0.42;
    ring.position.set(0, 0.34 + r * 0.03, -0.38 - r * 0.1);
    bodyGroup.add(ring);
  }

  const legs = [];
  [[-0.11, 0.22], [0.11, 0.22], [-0.11, -0.22], [0.11, -0.22]].forEach(([lx, lz], k) => {
    const pivot = new THREE.Group();
    pivot.position.set(lx, 0.22, lz);
    bodyGroup.add(pivot);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.22, 5), raccoonMaskMat);
    leg.position.y = -0.11;
    pivot.add(leg);
    legs.push({ pivot, sign: k === 0 || k === 3 ? 1 : -1 });
  });

  return { root, bodyGroup, legs, species: 'raccoon' };
}

function createBeaver() {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const torso = createOutlinedMesh(new THREE.SphereGeometry(0.32, 9, 8), beaverFurMat, 0.028, true, false);
  torso.scale.set(1.0, 0.82, 1.55);
  torso.position.y = 0.34;
  bodyGroup.add(torso);

  const head = createOutlinedMesh(new THREE.SphereGeometry(0.21, 8, 7), beaverFurMat, 0.024, false, false);
  head.scale.set(1.05, 0.92, 1.15);
  head.position.set(0, 0.44, 0.42);
  bodyGroup.add(head);

  [-0.04, 0.04].forEach((tx) => {
    const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.09, 0.04), beaverToothMat);
    tooth.position.set(tx, 0.35, 0.62);
    bodyGroup.add(tooth);
  });

  [-0.14, 0.14].forEach((ex) => {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), beaverFurMat);
    ear.position.set(ex, 0.61, 0.36);
    bodyGroup.add(ear);
  });

  const flatTail = createOutlinedMesh(new THREE.BoxGeometry(0.34, 0.06, 0.56), beaverTailMat, 0.024, false, false);
  flatTail.position.set(0, 0.22, -0.68);
  flatTail.rotation.x = -0.14;
  bodyGroup.add(flatTail);

  const legs = [];
  [[-0.14, 0.26], [0.14, 0.26], [-0.14, -0.26], [0.14, -0.26]].forEach(([lx, lz], k) => {
    const pivot = new THREE.Group();
    pivot.position.set(lx, 0.2, lz);
    bodyGroup.add(pivot);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.2, 6), beaverTailMat);
    leg.position.y = -0.1;
    pivot.add(leg);
    legs.push({ pivot, sign: k === 0 || k === 3 ? 1 : -1 });
  });

  return { root, bodyGroup, legs, species: 'beaver' };
}

function createDuck() {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const body = createOutlinedMesh(new THREE.SphereGeometry(0.22, 8, 7), duckBodyMat, 0.02, true, false);
  body.scale.set(1.0, 0.85, 1.5);
  body.position.y = 0.18;
  bodyGroup.add(body);

  const neckRing = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 6), duckWhiteMat);
  neckRing.position.set(0, 0.3, 0.26);
  bodyGroup.add(neckRing);

  const head = createOutlinedMesh(new THREE.SphereGeometry(0.13, 7, 7), duckBodyMat, 0.015, false, false);
  head.position.set(0, 0.42, 0.32);
  bodyGroup.add(head);

  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 5), duckBeakMat);
  beak.rotation.x = Math.PI * 0.5;
  beak.position.set(0, 0.41, 0.46);
  bodyGroup.add(beak);

  return { root, bodyGroup };
}

function createSwan() {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const body = createOutlinedMesh(new THREE.SphereGeometry(0.28, 9, 8), swanWhiteMat, 0.022, true, false);
  body.scale.set(0.95, 0.84, 1.65);
  body.position.y = 0.22;
  bodyGroup.add(body);

  const lowerNeck = createOutlinedMesh(new THREE.CylinderGeometry(0.06, 0.095, 0.32, 6), swanWhiteMat, 0.018, false, false);
  lowerNeck.position.set(0, 0.38, 0.32);
  lowerNeck.rotation.x = 0.35;
  bodyGroup.add(lowerNeck);

  const upperNeck = createOutlinedMesh(new THREE.CylinderGeometry(0.055, 0.06, 0.28, 6), swanWhiteMat, 0.018, false, false);
  upperNeck.position.set(0, 0.58, 0.41);
  upperNeck.rotation.x = -0.15;
  bodyGroup.add(upperNeck);

  const head = createOutlinedMesh(new THREE.SphereGeometry(0.1, 7, 7), swanWhiteMat, 0.015, false, false);
  head.position.set(0, 0.72, 0.44);
  bodyGroup.add(head);

  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.048, 0.18, 5), beakYellowMat);
  beak.rotation.x = Math.PI * 0.54;
  beak.position.set(0, 0.7, 0.56);
  bodyGroup.add(beak);

  const billBase = new THREE.Mesh(new THREE.SphereGeometry(0.045, 5, 5), bearNoseMat);
  billBase.position.set(0, 0.71, 0.49);
  bodyGroup.add(billBase);

  return { root, bodyGroup };
}

function findSafeWildlifeSpot(nearTownAllowed = false, minY = 0.7, maxY = 9.0) {
  for (let t = 0; t < 260; t++) {
    // Het hele eiland (kust ligt op ~300-400m van het midden)
    const x = (Math.random() - 0.5) * 600;
    const z = 30 + (Math.random() - 0.5) * 600;
    if (!nearTownAllowed && isInsideTownFootprint(x, z, 8)) continue;
    const y = getTerrainHeight(x, z);
    if (y < minY || y > maxY) continue;
    const { marginDist } = getClosestNetworkRoad(x, z);
    if (marginDist < 3.8 || getDistToRivers(x, z) < 4.5) continue;
    return { x, y, z };
  }
  return { x: 46, y: getTerrainHeight(46, 68), z: 68 };
}

function findWaterBankSpot() {
  for (let t = 0; t < 160; t++) {
    const theta = Math.random() * Math.PI * 2;
    const shoreR = getLakeShoreRadius(theta) + 2.5 + Math.random() * 6.5;
    const x = Math.cos(theta) * shoreR;
    const z = Math.sin(theta) * shoreR;
    if (isInsideTownFootprint(x, z, 10)) continue;
    const y = getTerrainHeight(x, z);
    if (y < 0.25 || y > 2.4) continue;
    const { marginDist } = getClosestNetworkRoad(x, z);
    if (marginDist < 4.0) continue;
    return { x, y, z };
  }
  return { x: -48, y: getTerrainHeight(-48, 10), z: 10 };
}

// 1. Wilde kalkoenen (12 — vrij algemeen)
const turkeyFlockCenters = [
  { x: 42, z: 66 },
  { x: -46, z: 68 },
  { x: 64, z: -25 }
];

turkeyFlockCenters.forEach((fc) => {
  for (let k = 0; k < 4; k++) {
    const tx = fc.x + (Math.random() - 0.5) * 9;
    const tz = fc.z + (Math.random() - 0.5) * 9;
    const ty = getTerrainHeight(tx, tz);
    const tk = createWildTurkey();
    tk.root.position.set(tx, ty, tz);
    const ang = Math.random() * Math.PI * 2;
    tk.root.rotation.y = ang;
    scene.add(tk.root);

    turkeys.push({
      ...tk,
      homeX: fc.x,
      homeZ: fc.z,
      angle: ang,
      timer: 1 + Math.random() * 3,
      panicked: 0,
      phase: Math.random() * 10
    });
  }
});

// 2. Herten (9)
for (let i = 0; i < 16; i++) {
  const sp = findSafeWildlifeSpot(false, 0.8, 12.0);
  const deer = createCartoonDeer(i % 2 === 0);
  deer.root.position.set(sp.x, sp.y, sp.z);
  const ang = Math.random() * Math.PI * 2;
  deer.root.rotation.y = ang;
  scene.add(deer.root);
  deerList.push({
    ...deer,
    homeX: sp.x,
    homeZ: sp.z,
    angle: ang,
    timer: 2 + Math.random() * 3,
    walking: i % 2 === 0,
    phase: i
  });
}

// 3. Bosberen (2 — zeldzamer)
for (let i = 0; i < 4; i++) {
  const sp = findSafeWildlifeSpot(false, 1.5, 20.0);
  const bear = createForestBear();
  bear.root.position.set(sp.x, sp.y, sp.z);
  const ang = Math.random() * Math.PI * 2;
  bear.root.rotation.y = ang;
  scene.add(bear.root);
  deerList.push({
    ...bear,
    homeX: sp.x,
    homeZ: sp.z,
    angle: ang,
    timer: 2 + Math.random() * 3.5,
    walking: i === 1,
    phase: i * 1.9
  });
}

// 4. Vossen (5), Wasberen (3 — schaarser) & Bevers (2 — schaarser)
for (let i = 0; i < 8; i++) {
  const sp = findSafeWildlifeSpot(false, 0.7, 12.0);
  const fox = createCartoonFox();
  fox.root.position.set(sp.x, sp.y, sp.z);
  const ang = Math.random() * Math.PI * 2;
  fox.root.rotation.y = ang;
  scene.add(fox.root);
  foxes.push({
    ...fox,
    homeX: sp.x,
    homeZ: sp.z,
    angle: ang,
    timer: 1.5 + Math.random() * 3,
    phase: i * 1.7
  });
}

for (let i = 0; i < 3; i++) {
  const sp = i < 2 ? findWaterBankSpot() : findSafeWildlifeSpot(false, 0.5, 7.5);
  const raccoon = createRaccoon();
  raccoon.root.position.set(sp.x, sp.y, sp.z);
  const ang = Math.random() * Math.PI * 2;
  raccoon.root.rotation.y = ang;
  scene.add(raccoon.root);
  foxes.push({
    ...raccoon,
    homeX: sp.x,
    homeZ: sp.z,
    angle: ang,
    timer: 1.4 + Math.random() * 2.8,
    phase: i * 2.1
  });
}

for (let i = 0; i < 2; i++) {
  const sp = findWaterBankSpot();
  const beaver = createBeaver();
  beaver.root.position.set(sp.x, sp.y, sp.z);
  const ang = Math.random() * Math.PI * 2;
  beaver.root.rotation.y = ang;
  scene.add(beaver.root);
  foxes.push({
    ...beaver,
    homeX: sp.x,
    homeZ: sp.z,
    angle: ang,
    timer: 1.6 + Math.random() * 3.0,
    phase: i * 2.6
  });
}

// 5. Eenden (8) & Zwanen (2 — zeldzamer) op het meer
function findDuckSpot() {
  for (let t = 0; t < 120; t++) {
    const theta = Math.random() * Math.PI * 2;
    const shoreR = getLakeShoreRadius(theta);
    const r = shoreR * (0.25 + Math.random() * 0.45);
    const x = Math.cos(theta) * r;
    const z = Math.sin(theta) * r;
    if (getDistToRivers(x, z) < 6.0) continue;
    return { x, z };
  }
  return { x: 0, z: 0 };
}

for (let i = 0; i < 8; i++) {
  const sp = findDuckSpot();
  const duck = createDuck();
  duck.root.position.set(sp.x, WATER_LEVEL + 0.06, sp.z);
  scene.add(duck.root);
  ducks.push({
    ...duck,
    centerX: sp.x,
    centerZ: sp.z,
    orbitR: 2.0 + Math.random() * 3.0,
    orbitSpeed: 0.15 + Math.random() * 0.15,
    phase: Math.random() * Math.PI * 2,
    bobPhase: Math.random() * 10
  });
}

// Een paar eenden op Moose Lake bij de lodge
for (let i = 0; i < 4; i++) {
  const ang = Math.random() * Math.PI * 2;
  const rr = MOOSE_LAKE.r * (0.2 + Math.random() * 0.45);
  const cx = MOOSE_LAKE.x + Math.cos(ang) * rr;
  const cz = MOOSE_LAKE.z + Math.sin(ang) * rr;
  const duck = createDuck();
  duck.root.position.set(cx, WATER_LEVEL + 0.06, cz);
  scene.add(duck.root);
  ducks.push({
    ...duck,
    centerX: cx,
    centerZ: cz,
    orbitR: 1.5 + Math.random() * 2.5,
    orbitSpeed: 0.15 + Math.random() * 0.15,
    phase: Math.random() * Math.PI * 2,
    bobPhase: Math.random() * 10
  });
}

for (let i = 0; i < 2; i++) {
  const sp = findDuckSpot();
  const swan = createSwan();
  swan.root.position.set(sp.x, WATER_LEVEL + 0.07, sp.z);
  scene.add(swan.root);
  ducks.push({
    ...swan,
    centerX: sp.x,
    centerZ: sp.z,
    orbitR: 2.5 + Math.random() * 3.5,
    orbitSpeed: 0.11 + Math.random() * 0.1,
    phase: Math.random() * Math.PI * 2,
    bobPhase: Math.random() * 10
  });
}
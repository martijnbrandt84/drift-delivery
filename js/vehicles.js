import * as THREE from 'three';
import { scene, createOutlinedMesh, makeToonMat, pineSnowCapObjects } from './scene-setup.js';
import {
  TOWN_ELEV, lakeCurve, getLakeLoopBaseElev, getLakeBridgeAtU, valleyCurve, getValleyBaseElev, getValleyBridgeAtU,
  ringCurve, getRingBaseElev, getRingBridgeAtU, timberTrail, connectorRoads, branchRoads
} from './roads.js';
import { ruralLots } from './water-lots.js';
import { warmWindowMat } from './town.js';

// =========================================================
// VOERTUIG-FABRIEK (MET ZICHTBARE NACHT-KOPLAMPKEGELS!)
// =========================================================
const tireMat = makeToonMat(0x302622);
const hubMat = makeToonMat(0xf5d48e);
const winBlueMat = makeToonMat(0x7ec4cf);
const chromeMat = makeToonMat(0xe8e0d5);
const headLightGlow = new THREE.MeshBasicMaterial({ color: 0xfff3b0 });
const redFlashMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
const blueFlashMat = new THREE.MeshBasicMaterial({ color: 0x2288ff });
const amberFlashMat = new THREE.MeshBasicMaterial({ color: 0xffb703 });
const darkPushbarMat = makeToonMat(0x222024);

export const beamConeGeo = new THREE.ConeGeometry(1.85, 8.5, 12, 1, true);
beamConeGeo.rotateX(-Math.PI / 2);
beamConeGeo.translate(0, -0.25, 4.6);
const beamConeMat = new THREE.MeshBasicMaterial({
  color: 0xfff2ba,
  transparent: true,
  opacity: 0.16,
  side: THREE.DoubleSide,
  depthWrite: false
});
export const allVehicleNightBeams = [];
export const vehicleLightState = { night: false };

function attachHeadlightBeams(bodyGroup, frontZ, lateralOffset = 0.68) {
  [-lateralOffset, lateralOffset].forEach((lx) => {
    const beam = new THREE.Mesh(beamConeGeo, beamConeMat);
    beam.position.set(lx, 0.78, frontZ);
    beam.scale.x = 0.55;
    beam.visible = false;
    bodyGroup.add(beam);
    allVehicleNightBeams.push(beam);
  });
}

const headlightBulbGeo = new THREE.SphereGeometry(0.2, 8, 8);
function attachHeadlightBulbs(bodyGroup, y, z, lateralOffset = 0.68) {
  [-lateralOffset, lateralOffset].forEach((lx) => {
    const hl = new THREE.Mesh(headlightBulbGeo, headLightGlow);
    hl.position.set(lx, y, z);
    bodyGroup.add(hl);
  });
}

const tailLightGlow = new THREE.MeshBasicMaterial({ color: 0xd81f1f });
const tailLightGeo = new THREE.SphereGeometry(0.15, 7, 7);
function attachTailLights(bodyGroup, y, z, lateralOffset = 0.68) {
  [-lateralOffset, lateralOffset].forEach((lx) => {
    const tl = new THREE.Mesh(tailLightGeo, tailLightGlow);
    tl.position.set(lx, y, z);
    bodyGroup.add(tl);
  });
}

// Lichten aan/uit per auto: geparkeerde auto's hebben in het donker hun lichten uit
const headLightOffMat = makeToonMat(0xd9d3bd);
const tailLightOffMat = makeToonMat(0x6e1d1d);
export function setVehicleLights(veh, on) {
  if (!veh || !veh.body) return;
  veh.lightsOn = on;
  veh.body.traverse((ch) => {
    if (ch.geometry === beamConeGeo) {
      ch.userData.lightsOn = on;
      ch.visible = on && vehicleLightState.night;
    } else if (ch.geometry === headlightBulbGeo) {
      ch.material = on ? headLightGlow : headLightOffMat;
    } else if (ch.geometry === tailLightGeo) {
      ch.material = on ? tailLightGlow : tailLightOffMat;
    }
  });
}

const sharedWheelGeo = new THREE.CylinderGeometry(0.46, 0.46, 0.42, 10);
sharedWheelGeo.rotateZ(Math.PI / 2);
const sharedHubGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.45, 8);
sharedHubGeo.rotateZ(Math.PI / 2);

function buildSteerableWheels(parentGroup, specs) {
  const wheels = [];
  const frontPivots = [];
  specs.forEach((ws) => {
    const piv = new THREE.Group();
    piv.position.set(ws.x, ws.y, ws.z);
    const spin = new THREE.Group();
    spin.add(createOutlinedMesh(sharedWheelGeo, tireMat, 0.04, false));
    spin.add(new THREE.Mesh(sharedHubGeo, hubMat));
    piv.add(spin);
    parentGroup.add(piv);
    wheels.push(spin);
    if (ws.front) frontPivots.push(piv);
  });
  return { wheels, frontPivots };
}

export function buildWoodyWagonMesh() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const chassis = createOutlinedMesh(new THREE.BoxGeometry(2.15, 0.86, 3.85), makeToonMat(0xd95136), 0.055);
  chassis.position.y = 0.84;
  body.add(chassis);

  const woodySide = new THREE.Mesh(new THREE.BoxGeometry(2.21, 0.36, 2.55), makeToonMat(0xba7c45));
  woodySide.position.set(0, 0.84, -0.2);
  body.add(woodySide);

  const cabin = createOutlinedMesh(new THREE.BoxGeometry(1.8, 0.84, 2.0), makeToonMat(0xfff3de), 0.055);
  cabin.position.set(0, 1.65, 0.02);
  body.add(cabin);

  const winFB = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.56, 2.06), winBlueMat);
  winFB.position.set(0, 1.63, 0.02);
  body.add(winFB);
  const winLR = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.54, 1.52), winBlueMat);
  winLR.position.set(0, 1.63, 0.02);
  body.add(winLR);

  const roofXmasTree = new THREE.Group();
  const rTreeCone = createOutlinedMesh(new THREE.ConeGeometry(0.68, 2.1, 7), makeToonMat(0x25633d), 0.035, false);
  rTreeCone.rotation.x = -Math.PI / 2;
  rTreeCone.position.set(0, 2.38, -0.1);
  roofXmasTree.add(rTreeCone);
  roofXmasTree.visible = false;
  body.add(roofXmasTree);
  pineSnowCapObjects.push(roofXmasTree);

  [-0.68, 0.68].forEach((lx) => {
    const hl = new THREE.Mesh(headlightBulbGeo, headLightGlow);
    hl.position.set(lx, 0.88, 1.93);
    body.add(hl);
  });
  attachHeadlightBeams(body, 1.9, 0.68);
  attachTailLights(body, 0.88, -1.85, 0.68);

  const { wheels, frontPivots } = buildSteerableWheels(root, [
    { x: -1.08, y: 0.48, z: 1.22, front: true },
    { x: 1.08, y: 0.48, z: 1.22, front: true },
    { x: -1.08, y: 0.48, z: -1.22, front: false },
    { x: 1.08, y: 0.48, z: -1.22, front: false }
  ]);

  return {
    root, body, wheels, frontPivots,
    name: 'Woody Wagon',
    radius: 1.45, rearAxleZ: -1.22, trackHalfW: 0.98,
    stats: { baseSpeed: 34, maxSpeed: 55, baseAccel: 38, peakAccel: 70, turnRate: 2.65, driftGripMod: 1.0, mass: 1.0 }
  };
}

export function buildYellowTaxiMesh() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const taxiYellow = makeToonMat(0xffbe19);

  const lower = createOutlinedMesh(new THREE.BoxGeometry(2.05, 0.78, 3.85), taxiYellow, 0.05);
  lower.position.y = 0.78;
  body.add(lower);

  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.16, 2.9), makeToonMat(0x26211e));
  stripe.position.set(0, 0.82, 0);
  body.add(stripe);

  const cabin = createOutlinedMesh(new THREE.BoxGeometry(1.75, 0.76, 1.95), taxiYellow, 0.05);
  cabin.position.set(0, 1.5, -0.05);
  body.add(cabin);

  const winFB = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.5, 2.02), winBlueMat);
  winFB.position.set(0, 1.48, -0.05);
  body.add(winFB);

  const sign = createOutlinedMesh(new THREE.BoxGeometry(0.75, 0.28, 0.34), headLightGlow, 0.03, false, false);
  sign.position.set(0, 2.02, 0.1);
  body.add(sign);

  attachHeadlightBulbs(body, 0.78, 1.93, 0.62);
  attachHeadlightBeams(body, 1.9, 0.62);
  attachTailLights(body, 0.78, -1.85, 0.62);

  const { wheels, frontPivots } = buildSteerableWheels(root, [
    { x: -1.02, y: 0.46, z: 1.2, front: true },
    { x: 1.02, y: 0.46, z: 1.2, front: true },
    { x: -1.02, y: 0.46, z: -1.2, front: false },
    { x: 1.02, y: 0.46, z: -1.2, front: false }
  ]);

  return {
    root, body, wheels, frontPivots,
    name: 'Yellow Cab Taxi',
    radius: 1.45, rearAxleZ: -1.2, trackHalfW: 0.96,
    stats: { baseSpeed: 37, maxSpeed: 59, baseAccel: 42, peakAccel: 78, turnRate: 2.95, driftGripMod: 0.82, mass: 0.95 }
  };
}

export function buildPickupTruckMesh(paintHex = 0x3f78a8, label = 'V8 Pickup') {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const truckMat = makeToonMat(paintHex);

  const chassis = createOutlinedMesh(new THREE.BoxGeometry(2.2, 0.85, 4.35), truckMat, 0.055);
  chassis.position.y = 0.86;
  body.add(chassis);

  const cab = createOutlinedMesh(new THREE.BoxGeometry(1.9, 0.95, 1.55), truckMat, 0.055);
  cab.position.set(0, 1.72, 0.45);
  body.add(cab);

  const winFB = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.62, 1.62), winBlueMat);
  winFB.position.set(0, 1.72, 0.45);
  body.add(winFB);

  attachHeadlightBulbs(body, 0.80, 2.15, 0.72);
  attachHeadlightBeams(body, 2.15, 0.72);
  attachTailLights(body, 0.85, -2.05, 0.72);

  const { wheels, frontPivots } = buildSteerableWheels(root, [
    { x: -1.08, y: 0.48, z: 1.35, front: true },
    { x: 1.08, y: 0.48, z: 1.35, front: true },
    { x: -1.08, y: 0.48, z: -1.35, front: false },
    { x: 1.08, y: 0.48, z: -1.35, front: false }
  ]);

  return {
    root, body, wheels, frontPivots,
    name: label,
    radius: 1.6, rearAxleZ: -1.35, trackHalfW: 1.02,
    stats: { baseSpeed: 35, maxSpeed: 57, baseAccel: 40, peakAccel: 74, turnRate: 2.55, driftGripMod: 0.9, mass: 1.35 }
  };
}

export function buildSchoolBusMesh() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const busYellow = makeToonMat(0xf5a618);

  const nose = createOutlinedMesh(new THREE.BoxGeometry(2.15, 1.15, 1.45), busYellow, 0.055);
  nose.position.set(0, 1.05, 2.55);
  body.add(nose);

  const coach = createOutlinedMesh(new THREE.BoxGeometry(2.45, 2.05, 5.2), busYellow, 0.06);
  coach.position.set(0, 1.55, -0.65);
  body.add(coach);

  const frontWin = new THREE.Mesh(new THREE.PlaneGeometry(1.95, 0.72), warmWindowMat);
  frontWin.position.set(0, 2.02, 1.98);
  body.add(frontWin);

  const sideWins = new THREE.Mesh(new THREE.BoxGeometry(2.50, 0.58, 4.2), warmWindowMat);
  sideWins.position.set(0, 1.95, -0.65);
  body.add(sideWins);

  attachHeadlightBulbs(body, 0.95, 3.2, 0.78);
  attachHeadlightBeams(body, 3.2, 0.78);
  attachTailLights(body, 1.0, -3.15, 0.78);

  const { wheels, frontPivots } = buildSteerableWheels(root, [
    { x: -1.16, y: 0.5, z: 2.1, front: true },
    { x: 1.16, y: 0.5, z: 2.1, front: true },
    { x: -1.16, y: 0.5, z: -1.95, front: false },
    { x: 1.16, y: 0.5, z: -1.95, front: false }
  ]);

  return {
    root, body, wheels, frontPivots,
    name: 'US School Bus',
    radius: 2.15, rearAxleZ: -1.95, trackHalfW: 1.12,
    stats: { baseSpeed: 30, maxSpeed: 49, baseAccel: 32, peakAccel: 60, turnRate: 2.15, driftGripMod: 0.85, mass: 2.4 }
  };
}

export function buildCargoTruckMesh(cabHex = 0x3a6ea5, trailerHex = 0xf2ece1, label = 'Vrachtwagen') {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const cabMat = makeToonMat(cabHex);
  const trailerMat = makeToonMat(trailerHex);
  const trimMat = makeToonMat(0xc95432);

  const bumper = createOutlinedMesh(new THREE.BoxGeometry(2.42, 0.45, 0.35), chromeMat, 0.04, false);
  bumper.position.set(0, 0.62, 3.35);
  body.add(bumper);

  const cabLower = createOutlinedMesh(new THREE.BoxGeometry(2.36, 1.15, 1.9), cabMat, 0.055);
  cabLower.position.set(0, 1.18, 2.35);
  body.add(cabLower);

  const cabUpper = createOutlinedMesh(new THREE.BoxGeometry(2.24, 1.05, 1.65), cabMat, 0.055);
  cabUpper.position.set(0, 2.22, 2.25);
  body.add(cabUpper);

  const windshield = new THREE.Mesh(new THREE.PlaneGeometry(1.95, 0.68), winBlueMat);
  windshield.position.set(0, 2.26, 3.09);
  body.add(windshield);

  [-1.24, 1.24].forEach((px) => {
    const stack = createOutlinedMesh(new THREE.CylinderGeometry(0.08, 0.09, 2.35, 7), chromeMat, 0.025, false);
    stack.position.set(px, 1.75, 1.25);
    body.add(stack);
  });

  const cargoBox = createOutlinedMesh(new THREE.BoxGeometry(2.52, 2.35, 4.7), trailerMat, 0.06);
  cargoBox.position.set(0, 1.85, -1.05);
  body.add(cargoBox);

  const sideStripe = new THREE.Mesh(new THREE.BoxGeometry(2.56, 0.24, 4.5), trimMat);
  sideStripe.position.set(0, 1.35, -1.05);
  body.add(sideStripe);

  attachHeadlightBulbs(body, 0.98, 3.22, 0.82);
  attachHeadlightBeams(body, 3.22, 0.82);
  attachTailLights(body, 1.02, -3.42, 0.88);

  const { wheels, frontPivots } = buildSteerableWheels(root, [
    { x: -1.22, y: 0.48, z: 2.55, front: true },
    { x: 1.22, y: 0.48, z: 2.55, front: true },
    { x: -1.22, y: 0.48, z: -0.35, front: false },
    { x: 1.22, y: 0.48, z: -0.35, front: false },
    { x: -1.22, y: 0.48, z: -2.25, front: false },
    { x: 1.22, y: 0.48, z: -2.25, front: false }
  ]);

  return {
    root, body, wheels, frontPivots,
    name: label,
    radius: 2.3, rearAxleZ: -2.25, trackHalfW: 1.18,
    stats: { baseSpeed: 28, maxSpeed: 46, baseAccel: 28, peakAccel: 54, turnRate: 2.0, driftGripMod: 0.82, mass: 2.9 }
  };
}

export function buildSnowplowMesh() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const plowOrange = makeToonMat(0xe8641c);
  const bladeSteel = makeToonMat(0x525b66);
  const edgeMat = makeToonMat(0x23262b);

  const chassis = createOutlinedMesh(new THREE.BoxGeometry(2.3, 1.05, 4.4), plowOrange, 0.055);
  chassis.position.set(0, 0.98, 0.25);
  body.add(chassis);

  const cab = createOutlinedMesh(new THREE.BoxGeometry(2.05, 1.05, 1.85), plowOrange, 0.055);
  cab.position.set(0, 1.98, 0.55);
  body.add(cab);

  const winFB = new THREE.Mesh(new THREE.PlaneGeometry(1.72, 0.65), winBlueMat);
  winFB.position.set(0, 2.02, 1.49);
  body.add(winFB);

  const spreader = createOutlinedMesh(new THREE.BoxGeometry(2.15, 0.95, 1.85), bladeSteel, 0.045, false);
  spreader.position.set(0, 1.85, -1.15);
  body.add(spreader);

  const beaconBar = createOutlinedMesh(new THREE.BoxGeometry(1.1, 0.24, 0.32), amberFlashMat, 0.03, false, false);
  beaconBar.position.set(0, 2.62, 0.55);
  body.add(beaconBar);

  const mountArm = createOutlinedMesh(new THREE.BoxGeometry(1.4, 0.32, 0.95), edgeMat, 0.03, false);
  mountArm.position.set(0, 0.58, 2.68);
  body.add(mountArm);

  const plowBlade = createOutlinedMesh(new THREE.BoxGeometry(3.25, 0.98, 0.26), bladeSteel, 0.05, false);
  plowBlade.position.set(0, 0.66, 3.18);
  plowBlade.rotation.y = -0.22;
  body.add(plowBlade);

  const cuttingEdge = new THREE.Mesh(new THREE.BoxGeometry(3.28, 0.14, 0.3), edgeMat);
  cuttingEdge.position.set(0, 0.2, 3.18);
  cuttingEdge.rotation.y = -0.22;
  body.add(cuttingEdge);

  attachHeadlightBulbs(body, 1.15, 2.42, 0.78);
  attachHeadlightBeams(body, 3.25, 0.78);
  attachTailLights(body, 0.95, -2.0, 0.8);

  const { wheels, frontPivots } = buildSteerableWheels(root, [
    { x: -1.16, y: 0.48, z: 1.45, front: true },
    { x: 1.16, y: 0.48, z: 1.45, front: true },
    { x: -1.16, y: 0.48, z: -1.35, front: false },
    { x: 1.16, y: 0.48, z: -1.35, front: false }
  ]);

  return {
    root, body, wheels, frontPivots,
    name: 'Sneeuwruimer',
    radius: 1.95, rearAxleZ: -1.35, trackHalfW: 1.12,
    stats: { baseSpeed: 31, maxSpeed: 50, baseAccel: 35, peakAccel: 65, turnRate: 2.35, driftGripMod: 1.12, mass: 2.2 }
  };
}

export function buildIceCreamTruckMesh() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const creamWhite = makeToonMat(0xfffaf0);
  const pastelMint = makeToonMat(0x78c6b8);
  const berryPink = makeToonMat(0xf07197);
  const coneTan = makeToonMat(0xd99b52);

  const lowerBody = createOutlinedMesh(new THREE.BoxGeometry(2.22, 0.92, 4.35), creamWhite, 0.055);
  lowerBody.position.y = 0.88;
  body.add(lowerBody);

  const mintBand = new THREE.Mesh(new THREE.BoxGeometry(2.27, 0.26, 4.25), pastelMint);
  mintBand.position.set(0, 0.92, 0);
  body.add(mintBand);

  const upperBody = createOutlinedMesh(new THREE.BoxGeometry(2.14, 1.38, 3.65), creamWhite, 0.055);
  upperBody.position.set(0, 1.98, -0.25);
  body.add(upperBody);

  const roofCap = createOutlinedMesh(new THREE.BoxGeometry(2.2, 0.2, 3.75), pastelMint, 0.045, false);
  roofCap.position.set(0, 2.72, -0.25);
  body.add(roofCap);

  const frontGlass = new THREE.Mesh(new THREE.PlaneGeometry(1.75, 0.72), winBlueMat);
  frontGlass.position.set(0, 2.02, 1.59);
  body.add(frontGlass);

  const serviceWindow = new THREE.Mesh(new THREE.PlaneGeometry(1.85, 0.76), warmWindowMat);
  serviceWindow.rotation.y = Math.PI * 0.5;
  serviceWindow.position.set(1.09, 1.92, -0.25);
  body.add(serviceWindow);

  const awning = createOutlinedMesh(new THREE.BoxGeometry(0.95, 0.14, 2.15), berryPink, 0.035, false);
  awning.position.set(1.48, 2.28, -0.25);
  awning.rotation.z = -0.26;
  body.add(awning);

  const iceCone = createOutlinedMesh(new THREE.ConeGeometry(0.24, 0.52, 8), coneTan, 0.025, false);
  iceCone.rotation.x = Math.PI;
  iceCone.position.set(0, 3.04, 0.25);
  body.add(iceCone);

  const scoop = createOutlinedMesh(new THREE.SphereGeometry(0.26, 8, 8), berryPink, 0.025, false, false);
  scoop.position.set(0, 3.42, 0.25);
  body.add(scoop);

  attachHeadlightBulbs(body, 0.92, 2.18, 0.72);
  attachHeadlightBeams(body, 2.18, 0.72);
  attachTailLights(body, 0.94, -2.38, 0.72);

  const { wheels, frontPivots } = buildSteerableWheels(root, [
    { x: -1.1, y: 0.46, z: 1.38, front: true },
    { x: 1.1, y: 0.46, z: 1.38, front: true },
    { x: -1.1, y: 0.46, z: -1.42, front: false },
    { x: 1.1, y: 0.46, z: -1.42, front: false }
  ]);

  return {
    root, body, wheels, frontPivots,
    name: 'IJscowagen',
    radius: 1.7, rearAxleZ: -1.42, trackHalfW: 1.04,
    stats: { baseSpeed: 31, maxSpeed: 48, baseAccel: 34, peakAccel: 62, turnRate: 2.55, driftGripMod: 0.92, mass: 1.55 }
  };
}

export function buildPoliceCruiserMesh() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const copBlack = makeToonMat(0x23262b);
  const copWhite = makeToonMat(0xf5f7fa);

  const chassis = createOutlinedMesh(new THREE.BoxGeometry(2.15, 0.82, 4.15), copBlack, 0.052);
  chassis.position.y = 0.82;
  body.add(chassis);

  const whiteDoors = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.78, 1.85), copWhite);
  whiteDoors.position.set(0, 0.83, 0.05);
  body.add(whiteDoors);

  const cabin = createOutlinedMesh(new THREE.BoxGeometry(1.8, 0.78, 2.0), copWhite, 0.05);
  cabin.position.set(0, 1.56, -0.05);
  body.add(cabin);

  const bullbar = createOutlinedMesh(new THREE.BoxGeometry(1.55, 0.65, 0.35), darkPushbarMat, 0.04, false);
  bullbar.position.set(0, 0.72, 2.18);
  body.add(bullbar);

  const redBar = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.24, 0.34), redFlashMat);
  redBar.position.set(-0.36, 2.06, 0.05);
  body.add(redBar);

  const blueBar = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.24, 0.34), blueFlashMat);
  blueBar.position.set(0.36, 2.06, 0.05);
  body.add(blueBar);

  const sirenLight = new THREE.PointLight(0xff2222, 0, 22);
  sirenLight.position.set(0, 2.6, 0);
  root.add(sirenLight);

  attachHeadlightBulbs(body, 0.78, 2.1, 0.66);
  attachHeadlightBeams(body, 2.1, 0.66);
  attachTailLights(body, 0.82, -2.0, 0.66);

  const { wheels, frontPivots } = buildSteerableWheels(root, [
    { x: -1.06, y: 0.46, z: 1.3, front: true },
    { x: 1.06, y: 0.46, z: 1.3, front: true },
    { x: -1.06, y: 0.46, z: -1.3, front: false },
    { x: 1.06, y: 0.46, z: -1.3, front: false }
  ]);

  return {
    root, body, wheels, frontPivots, redBar, blueBar, sirenLight,
    isPoliceModel: true, playerSirenOn: true,
    name: 'Sheriff Interceptor',
    radius: 1.55, rearAxleZ: -1.3, trackHalfW: 1.0,
    stats: { baseSpeed: 39, maxSpeed: 63, baseAccel: 45, peakAccel: 85, turnRate: 2.85, driftGripMod: 0.88, mass: 1.25 }
  };
}

// Gestroomlijnde sportwagen (raceauto voor de Ronde van Pinewood):
// zijprofiel als vorm, in de breedte geëxtrudeerd met afgeronde randen
function extrudeProfile(points, width, bevel = 0.08) {
  const shape = new THREE.Shape();
  points.forEach(([z, y], i) => (i ? shape.lineTo(z, y) : shape.moveTo(z, y)));
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: width - bevel * 2, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 4
  });
  // vorm-x = lengte (auto-z), extrusie = breedte (auto-x), gecentreerd
  geo.rotateY(-Math.PI / 2);
  geo.translate((width - bevel * 2) * 0.5, 0, 0);
  return geo;
}

export function buildSportsCarMesh(paintHex = 0xd62839, label = 'Pine Racer GT', number = 7) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const paint = makeToonMat(paintHex);
  const white = makeToonMat(0xf6f2ea, { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const dark = makeToonMat(0x1d1d22);
  const chrome = makeToonMat(0xc8ccd2);
  const glassMat = makeToonMat(0x3a5a78);

  // Carrosserie: lage neus, glooiende motorkap, brede heupen en een kort opgewipt staartje
  const bodyProfile = [
    [2.35, 0.34], [2.42, 0.52], [2.2, 0.68], [1.6, 0.82], [0.8, 0.92],
    [-0.2, 0.96], [-1.2, 0.98], [-1.9, 0.98], [-2.25, 1.04], [-2.36, 0.86], [-2.3, 0.34]
  ];
  const shell = createOutlinedMesh(extrudeProfile(bodyProfile, 2.08), paint, 0.05);
  body.add(shell);

  // Glazen koepel met een gelakt dak erop
  const cabinProfile = [[0.85, 0.9], [0.05, 1.4], [-0.85, 1.44], [-1.45, 1.22], [-1.75, 0.96]];
  const cabin = createOutlinedMesh(extrudeProfile(cabinProfile, 1.62, 0.1), glassMat, 0.045);
  body.add(cabin);
  const roofProfile = [[0.0, 1.44], [-0.85, 1.48], [-1.35, 1.32], [-1.3, 1.26], [-0.85, 1.42], [0.02, 1.38]];
  const roof = new THREE.Mesh(extrudeProfile(roofProfile, 1.5, 0.04), paint);
  body.add(roof);

  // Twee witte racestrepen over motorkap, dak en achterdek (lichtjes boven de lak)
  [-0.3, 0.3].forEach((sx) => {
    const stripeHood = new THREE.Mesh(extrudeProfile(bodyProfile, 0.24, 0), white);
    stripeHood.scale.set(1, 1.012, 1.004);
    stripeHood.position.x = sx;
    body.add(stripeHood);
    const stripeRoof = new THREE.Mesh(extrudeProfile(roofProfile, 0.24, 0), white);
    stripeRoof.scale.set(1, 1.01, 1);
    stripeRoof.position.x = sx;
    body.add(stripeRoof);
  });

  // Zwarte dorpels, grille met luchthappers, diffuser en uitlaten
  [-1, 1].forEach((side) => {
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 2.4), dark);
    skirt.position.set(side * 1.06, 0.38, 0);
    body.add(skirt);
    const intake = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, 0.5), dark);
    intake.position.set(side * 1.05, 0.66, -0.95);
    body.add(intake);
    const mirror = createOutlinedMesh(new THREE.BoxGeometry(0.22, 0.12, 0.16), paint, 0.015, false);
    mirror.position.set(side * 0.92, 1.05, 0.62);
    body.add(mirror);
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.22, 8), chrome);
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(side * 0.45, 0.42, -2.36);
    body.add(pipe);
  });
  const grille = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.16, 0.08), dark);
  grille.position.set(0, 0.48, 2.42);
  body.add(grille);
  const splitter = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.06, 0.3), dark);
  splitter.position.set(0, 0.3, 2.38);
  body.add(splitter);
  const diffuser = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.14, 0.12), dark);
  diffuser.position.set(0, 0.36, -2.34);
  body.add(diffuser);

  // Startnummer op de deuren
  const numCanvas = document.createElement('canvas');
  numCanvas.width = 128;
  numCanvas.height = 128;
  const nctx = numCanvas.getContext('2d');
  nctx.fillStyle = '#ffffff';
  nctx.beginPath();
  nctx.arc(64, 64, 60, 0, Math.PI * 2);
  nctx.fill();
  nctx.fillStyle = '#1d1d22';
  nctx.font = '900 76px system-ui, sans-serif';
  nctx.textAlign = 'center';
  nctx.textBaseline = 'middle';
  nctx.fillText(String(number), 64, 70);
  const numMat = new THREE.MeshBasicMaterial({ map: Object.assign(new THREE.CanvasTexture(numCanvas), { colorSpace: THREE.SRGBColorSpace }), transparent: true, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, toneMapped: false });
  [-1, 1].forEach((side) => {
    const disc = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), numMat);
    disc.position.set(side * 1.1, 0.66, 0.15);
    disc.rotation.y = side * Math.PI / 2;
    body.add(disc);
  });

  // Achtervleugel op twee steunen
  const wing = createOutlinedMesh(new THREE.BoxGeometry(2.05, 0.07, 0.5), dark, 0.03, false);
  wing.position.set(0, 1.45, -2.05);
  wing.rotation.x = -0.08;
  body.add(wing);
  [-1, 1].forEach((side) => {
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.28, 0.55), paint);
    plate.position.set(side * 1.04, 1.42, -2.05);
    body.add(plate);
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.48, 0.16), dark);
    strut.position.set(side * 0.62, 1.2, -2.0);
    body.add(strut);
  });

  attachHeadlightBulbs(body, 0.66, 2.36, 0.68);
  attachHeadlightBeams(body, 2.4, 0.68);
  attachTailLights(body, 0.82, -2.34, 0.72);

  const { wheels, frontPivots } = buildSteerableWheels(root, [
    { x: -1.04, y: 0.42, z: 1.45, front: true },
    { x: 1.04, y: 0.42, z: 1.45, front: true },
    { x: -1.04, y: 0.42, z: -1.45, front: false },
    { x: 1.04, y: 0.42, z: -1.45, front: false }
  ]);

  return {
    root, body, wheels, frontPivots,
    name: label,
    isRaceCar: true,
    radius: 1.5, rearAxleZ: -1.45, trackHalfW: 0.98,
    stats: { baseSpeed: 44, maxSpeed: 74, baseAccel: 52, peakAccel: 100, turnRate: 3.05, driftGripMod: 0.86, mass: 1.0 }
  };
}

export const parkedCars = [];
export const trafficVehicles = [];

function spawnTrafficVehicle(vehData, curve, elevFn, bridgeFn, startU, dir, cruiseSpeed, laneOffset, isClosed) {
  scene.add(vehData.root);
  trafficVehicles.push({
    veh: vehData, curve, elevFn, bridgeFn,
    u: startU, dir, cruiseSpeed, currentSpeed: cruiseSpeed, laneOffset, isClosed,
    curveLength: curve.getLength(), hitCooldown: 0
  });
}

spawnTrafficVehicle(buildSchoolBusMesh(), lakeCurve, getLakeLoopBaseElev, getLakeBridgeAtU, 0.47, -1, 13.0, -2.2, true);
spawnTrafficVehicle(buildYellowTaxiMesh(), lakeCurve, getLakeLoopBaseElev, getLakeBridgeAtU, 0.53, 1, 17.5, 2.2, true);
spawnTrafficVehicle(buildPickupTruckMesh(0x3f78a8, 'Blauwe V8 Pickup'), lakeCurve, getLakeLoopBaseElev, getLakeBridgeAtU, 0.22, -1, 16.0, -2.2, true);
spawnTrafficVehicle(buildPickupTruckMesh(0x4b8252, 'Ranger Pickup'), lakeCurve, getLakeLoopBaseElev, getLakeBridgeAtU, 0.82, 1, 15.5, 2.2, true);
spawnTrafficVehicle(buildCargoTruckMesh(0x3a6ea5, 0xf2ece1, 'Blauwe Vrachtwagen'), lakeCurve, getLakeLoopBaseElev, getLakeBridgeAtU, 0.12, 1, 12.5, 2.2, true);
spawnTrafficVehicle(buildSnowplowMesh(), lakeCurve, getLakeLoopBaseElev, getLakeBridgeAtU, 0.62, -1, 13.5, -2.2, true);
spawnTrafficVehicle(buildIceCreamTruckMesh(), lakeCurve, getLakeLoopBaseElev, getLakeBridgeAtU, 0.38, 1, 12.0, 2.2, true);

spawnTrafficVehicle(buildYellowTaxiMesh(), valleyCurve, getValleyBaseElev, getValleyBridgeAtU, 0.28, 1, 16.5, 2.15, false);
spawnTrafficVehicle(buildPickupTruckMesh(0xc96b38, 'Canyon Pickup'), valleyCurve, getValleyBaseElev, getValleyBridgeAtU, 0.70, -1, 15.5, -2.15, false);
spawnTrafficVehicle(buildCargoTruckMesh(0xa8382b, 0xede6d6, 'Rode Vrachtwagen'), valleyCurve, getValleyBaseElev, getValleyBridgeAtU, 0.42, 1, 12.0, 2.15, false);

// Verkeer op de nieuwe kustweg rond het eiland
spawnTrafficVehicle(buildCargoTruckMesh(0x2f7d6d, 0xf2ece1, 'Kust Vrachtwagen'), ringCurve, getRingBaseElev, getRingBridgeAtU, 0.08, 1, 15.0, 2.2, true);
spawnTrafficVehicle(buildYellowTaxiMesh(), ringCurve, getRingBaseElev, getRingBridgeAtU, 0.33, -1, 20.0, -2.2, true);
spawnTrafficVehicle(buildPickupTruckMesh(0x8a5a3c, 'Kustwacht Pickup'), ringCurve, getRingBaseElev, getRingBridgeAtU, 0.52, 1, 18.5, 2.2, true);
spawnTrafficVehicle(buildSchoolBusMesh(), ringCurve, getRingBaseElev, getRingBridgeAtU, 0.71, -1, 14.0, -2.2, true);
spawnTrafficVehicle(buildPickupTruckMesh(0xd9b23a, 'Gele Strand Pickup'), ringCurve, getRingBaseElev, getRingBridgeAtU, 0.90, 1, 17.0, 2.2, true);

{
  const fox = connectorRoads.find((c) => c.id === 'fox_lake_road');
  if (fox) spawnTrafficVehicle(buildYellowTaxiMesh(), fox.curve, fox.elevFn, fox.bridgeFn, 0.5, 1, 14.0, 2.15, false);
}
branchRoads.forEach((road, i) => {
  spawnTrafficVehicle(
    i === 0 ? buildPickupTruckMesh(0x4a6a8a, 'Rivier Pickup') : buildCargoTruckMesh(0xc9a227, 0xf2ece1, 'Prairie Vrachtwagen'),
    road.curve, road.elevFn, road.bridgeFn, 0.4, 1, i === 0 ? 13.0 : 15.0, 2.15, false
  );
});
spawnTrafficVehicle(buildPickupTruckMesh(0x5b7a3a, 'Houthakkers Pickup'), timberTrail.curve, timberTrail.elevFn, timberTrail.bridgeFn, 0.3, 1, 13.0, 2.15, false);

// Geparkeerde auto's bij de diner
const dinerLot = ruralLots.find((l) => l.type === 'diner');
if (dinerLot) {
  const c = Math.cos(dinerLot.yaw);
  const s = Math.sin(dinerLot.yaw);
  [[-7.75, 3.6, buildYellowTaxiMesh()], [-10.25, 11.6, buildPickupTruckMesh(0xc94a38, 'Rode Diner Pickup')]].forEach(([lx, lz, veh]) => {
    veh.root.position.set(dinerLot.x + lx * c + lz * s, dinerLot.roadY + 0.08, dinerLot.z - lx * s + lz * c);
    veh.root.rotation.y = dinerLot.yaw + Math.PI;
    scene.add(veh.root);
    parkedCars.push(veh);
  });
  const racer = buildSportsCarMesh(0xd62839, 'Pine Racer GT', 7);
  const rlx = -5.25;
  const rlz = 11.6;
  racer.root.position.set(dinerLot.x + rlx * c + rlz * s, dinerLot.roadY + 0.08, dinerLot.z - rlx * s + rlz * c);
  racer.root.rotation.y = dinerLot.yaw;
  scene.add(racer.root);
  parkedCars.push(racer);
}

const townParkedCop = buildPoliceCruiserMesh();
townParkedCop.root.position.set(23.5, TOWN_ELEV + 0.10, 82.8);
townParkedCop.root.rotation.y = -Math.PI / 2;
scene.add(townParkedCop.root);
parkedCars.push(townParkedCop);

const townParkedIceCream = buildIceCreamTruckMesh();
townParkedIceCream.root.position.set(-18.5, TOWN_ELEV + 0.10, 82.8);
townParkedIceCream.root.rotation.y = Math.PI / 2;
scene.add(townParkedIceCream.root);
parkedCars.push(townParkedIceCream);

export const policePool = [];
for (let i = 0; i < 4; i++) {
  const copMesh = buildPoliceCruiserMesh();
  copMesh.root.visible = false;
  scene.add(copMesh.root);
  policePool.push({ veh: copMesh, active: false, vx: 0, vz: 0, angle: 0, skidTimer: 0 });
}

// Geparkeerde auto's: lichten uit
parkedCars.forEach((v) => setVehicleLights(v, false));

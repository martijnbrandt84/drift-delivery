import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import {
  scene, OUTLINE_HEX, registerSeasonalMat, makeToonMat, createOutlinedMesh,
  instantiateBakedProp, createMergedToonProp, setAlignedTransform
} from './scene-setup.js';
import {
  MAIN_HALF_WIDTH, lakeSamples, valleySamples, streetSampleSets, INTERSECTIONS,
  isInsideIntersection, LAKE_BRIDGES, lakeCurve, getLakeLoopBaseElev, getLakeBridgeAtU,
  valleyCurve, VALLEY_BRIDGES, getValleyBaseElev, getValleyBridgeAtU, outerRoadDefs
} from './roads.js';
import { driveways } from './water-lots.js';
import { hardColliders, registerDestructible } from './demolition.js';
import { getTerrainHeight } from './terrain.js';

// =========================================================
// WEGENNET, HOUTEN BRUGGEN & GOLDEN GATE-BRUG BIJ BOERDERIJ
// =========================================================
const outlineRoadMat = new THREE.MeshBasicMaterial({ color: OUTLINE_HEX, side: THREE.DoubleSide });
const curbShoulderMat = registerSeasonalMat(0xd9c2a3, 0xe8eff5, {
  side: THREE.DoubleSide,
  polygonOffset: true,
  polygonOffsetFactor: -1,
  polygonOffsetUnits: -1
});
const asphaltMat = makeToonMat(0x464349, {
  side: THREE.DoubleSide,
  polygonOffset: true,
  polygonOffsetFactor: -2,
  polygonOffsetUnits: -2
});
const whiteEdgeMat = new THREE.MeshBasicMaterial({
  color: 0xfff8eb,
  side: THREE.DoubleSide,
  polygonOffset: true,
  polygonOffsetFactor: -3,
  polygonOffsetUnits: -3
});
const yellowStripeMat = new THREE.MeshBasicMaterial({
  color: 0xffca28,
  side: THREE.DoubleSide,
  polygonOffset: true,
  polygonOffsetFactor: -4,
  polygonOffsetUnits: -4
});

function createUpwardStripGeometry(sampleArray, indices, halfW, yOffset, lateralCenter = 0) {
  const positions = [];
  const idx = [];
  for (let k = 0; k < indices.length; k++) {
    const s = sampleArray[indices[k]];
    const cx = s.x + s.nx * lateralCenter;
    const cz = s.z + s.nz * lateralCenter;
    positions.push(
      cx - s.nx * halfW, s.y + yOffset, cz - s.nz * halfW,
      cx + s.nx * halfW, s.y + yOffset, cz + s.nz * halfW
    );
    if (k < indices.length - 1) {
      const b = k * 2;
      const n = (k + 1) * 2;
      idx.push(b, b + 1, n + 1, b, n + 1, n);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

function create3DRoadBodyGeometry(sampleArray, indices, halfW, topYOffset, dropHeight) {
  const positions = [];
  const idx = [];
  for (let k = 0; k < indices.length; k++) {
    const s = sampleArray[indices[k]];
    const yTop = s.y + topYOffset;
    const yBot = yTop - dropHeight;
    positions.push(
      s.x - s.nx * (halfW + 0.30), yBot, s.z - s.nz * (halfW + 0.30),
      s.x - s.nx * halfW, yTop, s.z - s.nz * halfW,
      s.x + s.nx * halfW, yTop, s.z + s.nz * halfW,
      s.x + s.nx * (halfW + 0.30), yBot, s.z + s.nz * (halfW + 0.30)
    );
    if (k < indices.length - 1) {
      const b = k * 4;
      const n = (k + 1) * 4;
      idx.push(b + 0, b + 1, n + 1, b + 0, n + 1, n + 0);
      idx.push(b + 1, b + 2, n + 2, b + 1, n + 2, n + 1);
      idx.push(b + 2, b + 3, n + 3, b + 2, n + 3, n + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

const allWhiteLineGeos = [];
const allYellowDashGeos = [];
const allDashOutlineGeos = [];

function renderRoadSampleRuns(sampleArray, isClosed, halfW, showYellowCenter = true) {
  const runs = [];
  let currentRun = [];
  const total = sampleArray.length;

  if (isClosed) {
    const startIdx = sampleArray.findIndex((s) => s.onBridge);
    const safeStart = startIdx >= 0 ? startIdx : 0;
    for (let step = 0; step <= total; step++) {
      const idx = (safeStart + step) % total;
      if (!sampleArray[idx].onBridge) {
        if (currentRun.length === 0) currentRun.push((idx - 1 + total) % total);
        currentRun.push(idx);
      } else if (currentRun.length > 0) {
        currentRun.push(idx);
        runs.push(currentRun);
        currentRun = [];
      }
    }
  } else {
    for (let idx = 0; idx < total; idx++) {
      if (!sampleArray[idx].onBridge) {
        if (currentRun.length === 0 && idx > 0) currentRun.push(idx - 1);
        currentRun.push(idx);
      } else if (currentRun.length > 0) {
        currentRun.push(idx);
        runs.push(currentRun);
        currentRun = [];
      }
    }
  }
  if (currentRun.length > 1) runs.push(currentRun);

  runs.forEach((run) => {
    scene.add(new THREE.Mesh(create3DRoadBodyGeometry(sampleArray, run, halfW + 0.46, 0.03, 0.55), outlineRoadMat));
    const curbMesh = new THREE.Mesh(create3DRoadBodyGeometry(sampleArray, run, halfW + 0.15, 0.055, 0.50), curbShoulderMat);
    curbMesh.receiveShadow = true;
    scene.add(curbMesh);

    const asphaltMesh = new THREE.Mesh(create3DRoadBodyGeometry(sampleArray, run, halfW - 0.10, 0.085, 0.42), asphaltMat);
    asphaltMesh.receiveShadow = true;
    scene.add(asphaltMesh);

    let edgeSub = [];
    const flushEdge = () => {
      if (edgeSub.length >= 2) {
        [-halfW + 0.58, halfW - 0.58].forEach((sideOff) => {
          allWhiteLineGeos.push(createUpwardStripGeometry(sampleArray, edgeSub, 0.18, 0.105, sideOff).toNonIndexed());
        });
      }
      edgeSub = [];
    };

    for (let k = 0; k < run.length; k++) {
      const s = sampleArray[run[k]];
      if (isInsideIntersection(s.x, s.z, -0.4)) flushEdge();
      else edgeSub.push(run[k]);
    }
    flushEdge();

    if (showYellowCenter) {
      for (let k = 2; k < run.length - 3; k += 4) {
        const sMid = sampleArray[run[k + 1]];
        if (isInsideIntersection(sMid.x, sMid.z, 1.2)) continue;
        const subRun = [run[k], run[k + 1], run[k + 2]];
        [-0.26, 0.26].forEach((centerOff) => {
          allDashOutlineGeos.push(createUpwardStripGeometry(sampleArray, subRun, 0.17, 0.102, centerOff).toNonIndexed());
          allYellowDashGeos.push(createUpwardStripGeometry(sampleArray, subRun, 0.12, 0.112, centerOff).toNonIndexed());
        });
      }
    }
  });
}

const drivewayMat = registerSeasonalMat(0xd6a772, 0xdce6f0);

function buildCompleteRoadSystem() {
  renderRoadSampleRuns(lakeSamples, true, MAIN_HALF_WIDTH, true);
  renderRoadSampleRuns(valleySamples, false, MAIN_HALF_WIDTH, true);
  streetSampleSets.forEach((st) => renderRoadSampleRuns(st.samples, false, st.def.halfWidth, st.def.dashedCenter));
  outerRoadDefs.forEach((def) => renderRoadSampleRuns(def.samples, def.isClosed, MAIN_HALF_WIDTH, true));

  INTERSECTIONS.forEach((inter) => {
    const radius = inter.r * 0.78;
    const dOut = new THREE.Mesh(new THREE.CylinderGeometry(radius + 0.48, radius + 0.58, 0.36, 24), outlineRoadMat);
    dOut.position.set(inter.x, inter.y - 0.15, inter.z);
    scene.add(dOut);

    const dCurb = new THREE.Mesh(new THREE.CylinderGeometry(radius + 0.16, radius + 0.24, 0.36, 24), curbShoulderMat);
    dCurb.position.set(inter.x, inter.y - 0.125, inter.z);
    dCurb.receiveShadow = true;
    scene.add(dCurb);

    const dAsph = new THREE.Mesh(new THREE.CylinderGeometry(radius - 0.08, radius, 0.28, 24), asphaltMat);
    dAsph.position.set(inter.x, inter.y - 0.055, inter.z);
    dAsph.receiveShadow = true;
    scene.add(dAsph);
  });

  if (allWhiteLineGeos.length) scene.add(new THREE.Mesh(BufferGeometryUtils.mergeGeometries(allWhiteLineGeos), whiteEdgeMat));
  if (allDashOutlineGeos.length) scene.add(new THREE.Mesh(BufferGeometryUtils.mergeGeometries(allDashOutlineGeos), outlineRoadMat));
  if (allYellowDashGeos.length) scene.add(new THREE.Mesh(BufferGeometryUtils.mergeGeometries(allYellowDashGeos), yellowStripeMat));

  driveways.forEach((d) => {
    const dx = d.x2 - d.x1;
    const dz = d.z2 - d.z1;
    const horizLen = Math.hypot(dx, dz);
    const totalLen = Math.hypot(horizLen, d.y2 - d.y1);
    const drvHolder = new THREE.Group();
    setAlignedTransform(drvHolder, (d.x1 + d.x2) * 0.5, (d.y1 + d.y2) * 0.5 - 0.06, (d.z1 + d.z2) * 0.5, Math.atan2(dx, dz), -Math.atan2(d.y2 - d.y1, horizLen));
    drvHolder.add(createOutlinedMesh(new THREE.BoxGeometry(d.halfWidth * 2, 0.34, totalLen + 0.4), d.asphalt ? asphaltMat : drivewayMat, 0.05, false, true));
    scene.add(drvHolder);
  });

  const bollardBaked = createMergedToonProp(
    [{ geo: new THREE.BoxGeometry(0.26, 1.08, 0.26), matrix: new THREE.Matrix4().makeTranslation(0, 0.54, 0) }],
    makeToonMat(0x824f2b),
    0.03,
    false
  );
  const reflGeo = new THREE.BoxGeometry(0.3, 0.16, 0.3);
  const reflectorOrange = new THREE.MeshBasicMaterial({ color: 0xff9f1c });

  const placeRoadBollards = (samplesArr, step) => {
    for (let i = 6; i < samplesArr.length - 6; i += step) {
      const s = samplesArr[i];
      if (s.onBridge || isInsideIntersection(s.x, s.z, 5.5)) continue;
      if (s.x > -39 && s.x < 39 && s.z > 74 && s.z < 125) continue;

      [-1, 1].forEach((side) => {
        if (Math.random() < 0.48) return;
        const bx = s.x + s.nx * side * (s.halfWidth + 1.05);
        const bz = s.z + s.nz * side * (s.halfWidth + 1.05);
        for (const d of driveways) {
          if (Math.hypot(bx - d.x1, bz - d.z1) < 5.0) return;
        }

        const postGrp = instantiateBakedProp(bollardBaked);
        const refl = new THREE.Mesh(reflGeo, reflectorOrange);
        refl.position.y = 0.84;
        postGrp.add(refl);

        const by = getTerrainHeight(bx, bz);
        postGrp.position.set(bx, by, bz);
        postGrp.rotation.y = Math.atan2(s.tx, s.tz);
        scene.add(postGrp);
        registerDestructible(postGrp, bx, by, bz, 0.55, 'small', 8, 'Bermpaaltje');
      });
    }
  };

  placeRoadBollards(lakeSamples, 18);
  placeRoadBollards(valleySamples, 18);
  outerRoadDefs.forEach((def) => placeRoadBollards(def.samples, def.id === 'timber_trail' ? 12 : 22));
}
buildCompleteRoadSystem();

function buildSingleBridgeFromCurve(curve, isClosed, uCenter, uHalfSpan, elevFn, bridgeInfoFn, halfWidth) {
  const plankLightMat = registerSeasonalMat(0xc47d46, 0xd8c3b0);
  const plankAltMat = registerSeasonalMat(0xb36c38, 0xc7b09d);
  const beamDarkMat = makeToonMat(0x78411f);
  const stonePierMat = makeToonMat(0x8c8177);
  const stoneCapMat = registerSeasonalMat(0xaba095, 0xf0f6fc);
  const lanternMat = new THREE.MeshBasicMaterial({ color: 0xffe899 });

  const bridgeGroup = new THREE.Group();
  const numPlanks = 20;
  const bSamples = [];

  for (let s = 0; s <= numPlanks; s++) {
    let u = uCenter - uHalfSpan + (s / numPlanks) * (uHalfSpan * 2);
    if (isClosed) u = ((u % 1) + 1) % 1;
    const pt = curve.getPointAt(u);
    const tan = curve.getTangentAt(u);
    const len2D = Math.hypot(tan.x, tan.z) || 1;
    const tx = tan.x / len2D;
    const tz = tan.z / len2D;
    const nx = -tz;
    const nz = tx;
    const bInf = bridgeInfoFn(u);
    const baseY = elevFn(u);
    bSamples.push({ x: pt.x, y: baseY + bInf.archY, z: pt.z, tx, tz, nx, nz });
  }

  [bSamples[0], bSamples[bSamples.length - 1]].forEach((endS) => {
    const abut = new THREE.Group();
    setAlignedTransform(abut, endS.x, endS.y, endS.z, Math.atan2(endS.tx, endS.tz), 0);

    const wall = createOutlinedMesh(new THREE.BoxGeometry((halfWidth + 0.85) * 2, 3.4, 1.6), stonePierMat, 0.055, false, true);
    wall.position.y = -1.64;
    abut.add(wall);

    [-halfWidth - 0.55, halfWidth + 0.55].forEach((sideX) => {
      const pil = createOutlinedMesh(new THREE.BoxGeometry(1.1, 1.45, 1.4), stonePierMat, 0.05);
      pil.position.set(sideX, 0.72, 0);
      abut.add(pil);
      const cap = createOutlinedMesh(new THREE.BoxGeometry(1.3, 0.26, 1.6), stoneCapMat, 0.045, false);
      cap.position.set(sideX, 1.52, 0);
      abut.add(cap);
      hardColliders.push({ x: endS.x + endS.nx * sideX, z: endS.z + endS.nz * sideX, r: 0.7 });
    });

    bridgeGroup.add(abut);
  });

  for (let i = 0; i < numPlanks; i++) {
    const s0 = bSamples[i];
    const s1 = bSamples[i + 1];
    const dx = s1.x - s0.x;
    const dz = s1.z - s0.z;
    const dy = s1.y - s0.y;
    const horizLen = Math.hypot(dx, dz);
    const spanLen = Math.hypot(horizLen, dy);

    const segHolder = new THREE.Group();
    setAlignedTransform(segHolder, (s0.x + s1.x) * 0.5, (s0.y + s1.y) * 0.5 + 0.09, (s0.z + s1.z) * 0.5, Math.atan2(dx, dz), -Math.atan2(dy, horizLen));

    const plank = createOutlinedMesh(new THREE.BoxGeometry((halfWidth + 0.45) * 2, 0.28, spanLen * 1.04), i % 2 === 0 ? plankLightMat : plankAltMat, 0.04, false, true);
    plank.position.y = -0.14;
    segHolder.add(plank);
    bridgeGroup.add(segHolder);
  }

  const postSteps = [3, 7, 10, 13, 17];
  [-halfWidth - 0.22, halfWidth + 0.22].forEach((railSide) => {
    for (let p = 0; p < postSteps.length; p++) {
      const ps = bSamples[postSteps[p]];
      const px = ps.x + ps.nx * railSide;
      const pz = ps.z + ps.nz * railSide;

      const postHolder = new THREE.Group();
      setAlignedTransform(postHolder, px, ps.y + 0.09, pz, Math.atan2(ps.tx, ps.tz), 0);

      const post = createOutlinedMesh(new THREE.BoxGeometry(0.42, 1.85, 0.42), beamDarkMat, 0.045);
      post.position.y = 0.88;
      postHolder.add(post);

      if (p === 2) {
        const lantern = createOutlinedMesh(new THREE.BoxGeometry(0.42, 0.48, 0.42), lanternMat, 0.035, false, false);
        lantern.position.y = 2.05;
        postHolder.add(lantern);
      }

      bridgeGroup.add(postHolder);
      hardColliders.push({ x: px, z: pz, r: 0.45 });

      if (p === 1 || p === 3) {
        // Pijler reikt altijd tot onder de rivierbedding, ook bij hogere brugdekken
        const pierLen = Math.max(5.4, ps.y + 3.2);
        const pier = createOutlinedMesh(new THREE.CylinderGeometry(0.85, 1.2, pierLen, 8), stonePierMat, 0.05, false);
        pier.position.set(px - Math.sign(railSide) * ps.nx * 0.75, ps.y - 0.05 - pierLen * 0.5, pz - Math.sign(railSide) * ps.nz * 0.75);
        bridgeGroup.add(pier);
      }

      if (p < postSteps.length - 1) {
        const ns = bSamples[postSteps[p + 1]];
        const nxPos = ns.x + ns.nx * railSide;
        const nzPos = ns.z + ns.nz * railSide;
        const dx = nxPos - px;
        const dz = nzPos - pz;
        const dy = ns.y - ps.y;
        const hDist = Math.hypot(dx, dz);
        const totalSpan = Math.hypot(hDist, dy);

        [1.62, 0.85].forEach((barH) => {
          const barHolder = new THREE.Group();
          setAlignedTransform(barHolder, (px + nxPos) * 0.5, (ps.y + ns.y) * 0.5 + barH, (pz + nzPos) * 0.5, Math.atan2(dx, dz), -Math.atan2(dy, hDist));
          barHolder.add(createOutlinedMesh(new THREE.BoxGeometry(0.24, 0.22, totalSpan), beamDarkMat, 0.038, false));
          bridgeGroup.add(barHolder);
        });
      }
    }
  });

  scene.add(bridgeGroup);
}

function buildSuspensionBridge(curve, isClosed, uCenter, uHalfSpan, elevFn, bridgeInfoFn, opts = {}) {
  const halfWidth = MAIN_HALF_WIDTH;
  const deckMat = makeToonMat(0x464349);
  const edgeStripeMat = new THREE.MeshBasicMaterial({ color: 0xfff8eb });
  const goldenRedMat = registerSeasonalMat(0xc83e2b, 0xd94e3a);
  const cableMat = makeToonMat(0xd94e3a);
  const stoneBaseMat = makeToonMat(0x857b72);
  const lanternMat = new THREE.MeshBasicMaterial({ color: 0xffe899 });

  const bridgeGroup = new THREE.Group();
  const numSegs = opts.numSegs ?? 24;
  const bSamples = [];

  for (let s = 0; s <= numSegs; s++) {
    let u = uCenter - uHalfSpan + (s / numSegs) * (uHalfSpan * 2);
    if (isClosed) u = ((u % 1) + 1) % 1;
    const pt = curve.getPointAt(u);
    const tan = curve.getTangentAt(u);
    const len2D = Math.hypot(tan.x, tan.z) || 1;
    const tx = tan.x / len2D;
    const tz = tan.z / len2D;
    const nx = -tz;
    const nz = tx;
    const bInf = bridgeInfoFn(u);
    const baseY = elevFn(u);
    bSamples.push({ x: pt.x, y: baseY + bInf.archY, z: pt.z, tx, tz, nx, nz });
  }

  [bSamples[0], bSamples[bSamples.length - 1]].forEach((endS) => {
    const abut = new THREE.Group();
    setAlignedTransform(abut, endS.x, endS.y, endS.z, Math.atan2(endS.tx, endS.tz), 0);

    const wallH = Math.max(5.2, endS.y + 8.0);
    const wall = createOutlinedMesh(new THREE.BoxGeometry((halfWidth + 0.9) * 2, wallH, 1.8), stoneBaseMat, 0.05, false, true);
    wall.position.y = 0.02 - wallH * 0.5;
    abut.add(wall);

    [-halfWidth - 0.55, halfWidth + 0.55].forEach((sideX) => {
      const pil = createOutlinedMesh(new THREE.BoxGeometry(1.0, 1.35, 1.3), goldenRedMat, 0.045);
      pil.position.set(sideX, 0.68, 0);
      abut.add(pil);
      hardColliders.push({ x: endS.x + endS.nx * sideX, z: endS.z + endS.nz * sideX, r: 0.65 });
    });

    bridgeGroup.add(abut);
  });

  for (let i = 0; i < numSegs; i++) {
    const s0 = bSamples[i];
    const s1 = bSamples[i + 1];
    const dx = s1.x - s0.x;
    const dz = s1.z - s0.z;
    const dy = s1.y - s0.y;
    const horizLen = Math.hypot(dx, dz);
    const spanLen = Math.hypot(horizLen, dy);

    const segHolder = new THREE.Group();
    setAlignedTransform(segHolder, (s0.x + s1.x) * 0.5, (s0.y + s1.y) * 0.5 + 0.08, (s0.z + s1.z) * 0.5, Math.atan2(dx, dz), -Math.atan2(dy, horizLen));

    const deck = createOutlinedMesh(new THREE.BoxGeometry((halfWidth + 0.35) * 2, 0.34, spanLen * 1.05), deckMat, 0.04, false, true);
    deck.position.y = -0.17;
    segHolder.add(deck);

    [-halfWidth + 0.45, halfWidth - 0.45].forEach((lx) => {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, spanLen * 0.98), edgeStripeMat);
      stripe.position.set(lx, 0.02, 0);
      segHolder.add(stripe);
    });

    bridgeGroup.add(segHolder);
  }

  const tA = Math.round(numSegs * 0.25);
  const tB = numSegs - tA;
  const towerIndices = [tA, tB];
  const towerHeight = opts.towerHeight ?? 9.0;
  const mid = numSegs * 0.5;
  const cableHeightAt = (i) =>
    i <= tA
      ? THREE.MathUtils.lerp(1.1, towerHeight, i / tA)
      : i >= tB
      ? THREE.MathUtils.lerp(towerHeight, 1.1, (i - tB) / tA)
      : 1.35 + ((i - mid) / (mid - tA)) ** 2 * (towerHeight - 1.35);

  towerIndices.forEach((tIdx) => {
    const ts = bSamples[tIdx];
    const yaw = Math.atan2(ts.tx, ts.tz);

    [-halfWidth - 0.45, halfWidth + 0.45].forEach((sideX) => {
      const px = ts.x + ts.nx * sideX;
      const pz = ts.z + ts.nz * sideX;

      const towerGrp = new THREE.Group();
      setAlignedTransform(towerGrp, px, ts.y, pz, yaw, 0);

      // Torenpoten lopen door tot op de zeebodem / rivierbedding
      const legDepth = Math.max(5.0, ts.y + 8.0);
      const leg = createOutlinedMesh(new THREE.BoxGeometry(0.58, towerHeight + legDepth, 0.68), goldenRedMat, 0.045);
      leg.position.y = (towerHeight - legDepth) * 0.5 + 0.1;
      towerGrp.add(leg);

      const topBeam = createOutlinedMesh(new THREE.BoxGeometry(0.5, 0.55, 1.1), goldenRedMat, 0.04, false);
      topBeam.position.y = towerHeight;
      towerGrp.add(topBeam);

      const lantern = createOutlinedMesh(new THREE.BoxGeometry(0.36, 0.42, 0.36), lanternMat, 0.03, false, false);
      lantern.position.y = towerHeight + 0.48;
      towerGrp.add(lantern);

      bridgeGroup.add(towerGrp);
      hardColliders.push({ x: px, z: pz, r: 0.55 });
    });

    const crossBar = new THREE.Group();
    setAlignedTransform(crossBar, ts.x, ts.y + towerHeight, ts.z, yaw, 0);
    crossBar.add(createOutlinedMesh(new THREE.BoxGeometry((halfWidth + 0.45) * 2 + 0.6, 0.48, 0.52), goldenRedMat, 0.04, false));
    bridgeGroup.add(crossBar);
  });

  [-halfWidth - 0.45, halfWidth + 0.45].forEach((railSide) => {
    for (let i = 0; i < numSegs; i++) {
      const s0 = bSamples[i];
      const s1 = bSamples[i + 1];
      const x0 = s0.x + s0.nx * railSide;
      const z0 = s0.z + s0.nz * railSide;
      const x1 = s1.x + s1.nx * railSide;
      const z1 = s1.z + s1.nz * railSide;

      const dx = x1 - x0;
      const dz = z1 - z0;
      const hDist = Math.hypot(dx, dz);
      const yaw = Math.atan2(dx, dz);

      const dyDeck = s1.y - s0.y;
      const deckSpan = Math.hypot(hDist, dyDeck);
      const deckBar = new THREE.Group();
      setAlignedTransform(deckBar, (x0 + x1) * 0.5, (s0.y + s1.y) * 0.5 + 0.15, (z0 + z1) * 0.5, yaw, -Math.atan2(dyDeck, hDist));
      deckBar.add(createOutlinedMesh(new THREE.BoxGeometry(0.28, 0.52, deckSpan * 1.03), goldenRedMat, 0.035, false));
      bridgeGroup.add(deckBar);

      const cableH0 = cableHeightAt(i);
      const cableH1 = cableHeightAt(i + 1);

      const yC0 = s0.y + cableH0;
      const yC1 = s1.y + cableH1;
      const dyC = yC1 - yC0;
      const cSpan = Math.hypot(hDist, dyC);

      const cableSeg = new THREE.Group();
      setAlignedTransform(cableSeg, (x0 + x1) * 0.5, (yC0 + yC1) * 0.5, (z0 + z1) * 0.5, yaw, -Math.atan2(dyC, hDist));
      cableSeg.add(createOutlinedMesh(new THREE.BoxGeometry(0.18, 0.18, cSpan * 1.03), cableMat, 0.025, false));
      bridgeGroup.add(cableSeg);

      if (cableH0 > 0.65 && i > 0 && i < numSegs) {
        const hanger = new THREE.Group();
        setAlignedTransform(hanger, x0, s0.y + cableH0 * 0.5, z0, yaw, 0);
        hanger.add(createOutlinedMesh(new THREE.BoxGeometry(0.1, cableH0, 0.1), goldenRedMat, 0.02, false));
        bridgeGroup.add(hanger);
      }
    }
  });

  scene.add(bridgeGroup);
}

LAKE_BRIDGES.forEach((b) => buildSingleBridgeFromCurve(lakeCurve, true, b.uCenter, b.uHalfSpan, getLakeLoopBaseElev, getLakeBridgeAtU, MAIN_HALF_WIDTH));
VALLEY_BRIDGES.forEach((b) => buildSingleBridgeFromCurve(valleyCurve, false, b.uCenter, b.uHalfSpan, getValleyBaseElev, getValleyBridgeAtU, MAIN_HALF_WIDTH));

// Bruggen op de nieuwe kustweg en verbindingswegen (automatisch gevonden boven rivieren en de fjord)
outerRoadDefs.forEach((def) => {
  def.bridges.forEach((b) => {
    if (b.type === 'suspension') {
      const spanM = b.uHalfSpan * 2 * def.curve.getLength();
      buildSuspensionBridge(def.curve, def.isClosed, b.uCenter, b.uHalfSpan, def.elevFn, def.bridgeFn, {
        numSegs: Math.max(24, Math.round(spanM / 2.6 / 2) * 2),
        towerHeight: 13.5
      });
    } else {
      buildSingleBridgeFromCurve(def.curve, def.isClosed, b.uCenter, b.uHalfSpan, def.elevFn, def.bridgeFn, MAIN_HALF_WIDTH);
    }
  });
});
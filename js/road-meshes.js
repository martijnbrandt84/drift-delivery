import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import {
  scene, OUTLINE_HEX, registerSeasonalMat, makeToonMat, createOutlinedMesh,
  instantiateBakedProp, createMergedToonProp, setAlignedTransform
} from './scene-setup.js';
import {
  MAIN_HALF_WIDTH, lakeSamples, valleySamples, streetSampleSets, INTERSECTIONS,
  isInsideIntersection, allRoadNetworks, LAKE_BRIDGES, lakeCurve, getLakeLoopBaseElev, getLakeBridgeAtU,
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

// =========================================================
// KRUISPUNTANALYSE: per splitsing bepalen welke weg doorloopt en welke er eindigt,
// zodat de markering bij T-splitsingen netjes doorloopt (met stopstreep op de zijweg).
// =========================================================
const junctionInfo = INTERSECTIONS.map((inter) => {
  const roads = [];
  allRoadNetworks.forEach((net) => {
    let best = -1;
    let bestD = Infinity;
    net.samples.forEach((s, i) => {
      const d = Math.hypot(s.x - inter.x, s.z - inter.z);
      if (d < bestD) { bestD = d; best = i; }
    });
    if (bestD > inter.r) return;
    const n = net.samples.length;
    const isEnd = !net.isClosed && (best < 18 || best > n - 19);
    roads.push({ id: net.id, net, idx: best, isEnd, halfWidth: net.halfWidth });
  });
  const through = roads.filter((r) => !r.isEnd);
  const branches = roads.filter((r) => r.isEnd);
  const info = { inter, kind: 'other', through: null, branches: [] };
  if (through.length === 1 && branches.length >= 1) {
    info.kind = 't';
    const t = through[0];
    const c = t.net.samples[t.idx];
    info.through = { id: t.id, cx: c.x, cz: c.z, tx: c.tx, tz: c.tz, nx: c.nx, nz: c.nz, halfWidth: t.halfWidth, y: c.y };
    branches.forEach((b) => {
      // Richting van de zijweg, weg van het kruispunt
      const n = b.net.samples.length;
      const farIdx = b.idx < n / 2 ? Math.min(n - 1, b.idx + 14) : Math.max(0, b.idx - 14);
      const far = b.net.samples[farIdx];
      let ax = far.x - c.x;
      let az = far.z - c.z;
      const al = Math.hypot(ax, az) || 1;
      ax /= al;
      az /= al;
      const side = Math.sign(ax * c.nx + az * c.nz) || 1;
      info.branches.push({ id: b.id, ax, az, side, halfWidth: b.halfWidth });
    });
  }
  return info;
});

// Mag er op dit punt van deze weg markering liggen?
// kind: 'edge' (met sideOff = zijde t.o.v. de weg-normaal) of 'center'
function markingAllowed(s, kind, sideOff = 0) {
  for (let k = 0; k < junctionInfo.length; k++) {
    const j = junctionInfo[k];
    const dx = s.x - j.inter.x;
    const dz = s.z - j.inter.z;
    if (dx * dx + dz * dz > (j.inter.r + 6) * (j.inter.r + 6)) continue;
    if (j.kind !== 't') {
      // Kruising of hoek: zoals voorheen, markering stopt rond het middelpunt
      const pad = kind === 'center' ? 1.2 : -0.4;
      if (Math.hypot(dx, dz) < j.inter.r + pad) return false;
      continue;
    }
    const t = j.through;
    const ox = s.x - t.cx;
    const oz = s.z - t.cz;
    if (s.roadId === t.id) {
      if (kind === 'center') continue; // middenstreep loopt door
      // Zijlijn alleen onderbreken in de monding van een zijweg aan die kant
      const sideSign = Math.sign(sideOff) * Math.sign(s.nx * t.nx + s.nz * t.nz || 1);
      const along = Math.abs(ox * t.tx + oz * t.tz);
      for (const b of j.branches) {
        if (b.side === sideSign && along < b.halfWidth + 1.4) return false;
      }
      continue;
    }
    if (j.branches.some((b) => b.id === s.roadId)) {
      // Zijweg: markering stopt aan de rand van de hoofdweg (middenstreep iets eerder, vóór de stopstreep)
      const perp = Math.abs(ox * t.nx + oz * t.nz);
      const limit = t.halfWidth + (kind === 'center' ? 2.0 : 0.3);
      if (perp < limit) return false;
    }
  }
  return true;
}

// Witte stopstreep over de aankomende rijstrook van elke zijweg
const stopLineGeos = [];
junctionInfo.forEach((j) => {
  if (j.kind !== 't') return;
  const t = j.through;
  j.branches.forEach((b) => {
    const dist = t.halfWidth + 1.0;
    const px = t.cx + b.ax * dist;
    const pz = t.cz + b.az * dist;
    // Aankomstrichting = naar het kruispunt toe; rijstrookzijde zoals het verkeer rijdt
    const dirX = -b.ax;
    const dirZ = -b.az;
    const laneX = -dirZ;
    const laneZ = dirX;
    const w = b.halfWidth - 0.75;
    const geo = new THREE.PlaneGeometry(w, 0.5);
    geo.rotateX(-Math.PI / 2);
    const yaw = Math.atan2(laneX, laneZ) - Math.PI / 2;
    geo.rotateY(yaw);
    geo.translate(px + laneX * (w * 0.5 + 0.2), j.inter.y + 0.108, pz + laneZ * (w * 0.5 + 0.2));
    const flat = geo.toNonIndexed();
    flat.deleteAttribute('uv');
    stopLineGeos.push(flat);
  });
});

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

  });

  // Markering (witte zijlijnen + gele middenstreep) over de héle weg, ook over bruggen,
  // zodat de strepen gewoon doorlopen over de hangbrug en de stenen bruggen.
  const all = [];
  for (let i = 0; i < total; i++) all.push(i);
  if (isClosed) all.push(0);

  // Linker- en rechterzijlijn apart, zodat bij een T-splitsing alleen de kant van de zijweg onderbroken wordt
  [-halfW + 0.58, halfW - 0.58].forEach((sideOff) => {
    let sub = [];
    const flush = () => {
      if (sub.length >= 2) allWhiteLineGeos.push(createUpwardStripGeometry(sampleArray, sub, 0.18, 0.105, sideOff).toNonIndexed());
      sub = [];
    };
    for (let k = 0; k < all.length; k++) {
      const s = sampleArray[all[k]];
      if (!markingAllowed(s, 'edge', sideOff)) flush();
      else sub.push(all[k]);
    }
    flush();
  });

  if (showYellowCenter) {
    for (let k = 2; k < all.length - 3; k += 4) {
      const sMid = sampleArray[all[k + 1]];
      if (!markingAllowed(sMid, 'center')) continue;
      const subRun = [all[k], all[k + 1], all[k + 2]];
      [-0.26, 0.26].forEach((centerOff) => {
        allDashOutlineGeos.push(createUpwardStripGeometry(sampleArray, subRun, 0.17, 0.102, centerOff).toNonIndexed());
        allYellowDashGeos.push(createUpwardStripGeometry(sampleArray, subRun, 0.12, 0.112, centerOff).toNonIndexed());
      });
    }
  }
}

const drivewayMat = registerSeasonalMat(0xd6a772, 0xdce6f0);

function buildCompleteRoadSystem() {
  renderRoadSampleRuns(lakeSamples, true, MAIN_HALF_WIDTH, true);
  renderRoadSampleRuns(valleySamples, false, MAIN_HALF_WIDTH, true);
  streetSampleSets.forEach((st) => renderRoadSampleRuns(st.samples, false, st.def.halfWidth, st.def.dashedCenter));
  outerRoadDefs.forEach((def) => renderRoadSampleRuns(def.samples, def.isClosed, MAIN_HALF_WIDTH, true));

  INTERSECTIONS.forEach((inter, ii) => {
    // Bij een T-splitsing blijft de asfaltschijf binnen de hoofdweg (geen ronde vlek over de berm)
    const isT = junctionInfo[ii].kind === 't';
    const radius = isT ? junctionInfo[ii].through.halfWidth - 0.15 : inter.r * 0.78;
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

  stopLineGeos.forEach((geo) => allWhiteLineGeos.push(geo));
  if (allWhiteLineGeos.length) scene.add(new THREE.Mesh(BufferGeometryUtils.mergeGeometries(allWhiteLineGeos), whiteEdgeMat));
  if (allDashOutlineGeos.length) scene.add(new THREE.Mesh(BufferGeometryUtils.mergeGeometries(allDashOutlineGeos), outlineRoadMat));
  if (allYellowDashGeos.length) scene.add(new THREE.Mesh(BufferGeometryUtils.mergeGeometries(allYellowDashGeos), yellowStripeMat));

  driveways.forEach((d) => {
    if (d.noMesh) return;
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
        registerDestructible(postGrp, bx, by, bz, 0.55, 'small', 8, 'Roadside post');
      });
    }
  };

  placeRoadBollards(lakeSamples, 18);
  placeRoadBollards(valleySamples, 18);
  outerRoadDefs.forEach((def) => placeRoadBollards(def.samples, def.id === 'timber_trail' ? 12 : 22));
}
buildCompleteRoadSystem();

// Stenen boogbrug: natuurstenen dek met asfalt erop (de wegmarkering loopt automatisch door),
// lage stenen borstweringen met lichtere afdekstenen, lantaarns en echte bogen tussen de pijlers.
const bridgeStoneMat = registerSeasonalMat(0xa39686, 0xc9c4bd);
const bridgeStoneDarkMat = makeToonMat(0x857868);
const bridgeCapMat = registerSeasonalMat(0xcfc4b4, 0xf2f6fb);
const bridgeLanternMat = new THREE.MeshBasicMaterial({ color: 0xffe899 });

function buildSingleBridgeFromCurve(curve, isClosed, uCenter, uHalfSpan, elevFn, bridgeInfoFn, halfWidth) {
  const bridgeGroup = new THREE.Group();
  const numSegs = 20;
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

  // Landhoofden
  [bSamples[0], bSamples[bSamples.length - 1]].forEach((endS) => {
    const abut = new THREE.Group();
    setAlignedTransform(abut, endS.x, endS.y, endS.z, Math.atan2(endS.tx, endS.tz), 0);
    const wallH = Math.max(3.4, endS.y + 3.2);
    const wall = createOutlinedMesh(new THREE.BoxGeometry((halfWidth + 1.0) * 2, wallH, 2.0), bridgeStoneDarkMat, 0.055, false, true);
    wall.position.y = -wallH * 0.5 + 0.02;
    abut.add(wall);
    [-halfWidth - 0.65, halfWidth + 0.65].forEach((sideX) => {
      const pil = createOutlinedMesh(new THREE.BoxGeometry(1.0, 1.4, 1.2), bridgeStoneMat, 0.045);
      pil.position.set(sideX, 0.7, 0);
      abut.add(pil);
      const cap = createOutlinedMesh(new THREE.BoxGeometry(1.25, 0.24, 1.45), bridgeCapMat, 0.035, false);
      cap.position.set(sideX, 1.5, 0);
      abut.add(cap);
      const lamp = createOutlinedMesh(new THREE.BoxGeometry(0.36, 0.44, 0.36), bridgeLanternMat, 0.03, false, false);
      lamp.position.set(sideX, 1.88, 0);
      abut.add(lamp);
      hardColliders.push({ x: endS.x + endS.nx * sideX, z: endS.z + endS.nz * sideX, r: 0.7 });
    });
    bridgeGroup.add(abut);
  });

  // Dek (steen + asfalt) en borstweringen per segment
  for (let i = 0; i < numSegs; i++) {
    const s0 = bSamples[i];
    const s1 = bSamples[i + 1];
    const dx = s1.x - s0.x;
    const dz = s1.z - s0.z;
    const dy = s1.y - s0.y;
    const horizLen = Math.hypot(dx, dz);
    const spanLen = Math.hypot(horizLen, dy);

    const seg = new THREE.Group();
    setAlignedTransform(seg, (s0.x + s1.x) * 0.5, (s0.y + s1.y) * 0.5, (s0.z + s1.z) * 0.5, Math.atan2(dx, dz), -Math.atan2(dy, horizLen));

    const deck = createOutlinedMesh(new THREE.BoxGeometry((halfWidth + 0.75) * 2, 0.7, spanLen * 1.03), bridgeStoneMat, 0.04, false, true);
    deck.position.y = 0.055 - 0.35;
    seg.add(deck);
    const asphalt = new THREE.Mesh(new THREE.BoxGeometry((halfWidth - 0.1) * 2, 0.06, spanLen * 1.04), asphaltMat);
    asphalt.position.y = 0.06;
    asphalt.receiveShadow = true;
    seg.add(asphalt);

    [-1, 1].forEach((side) => {
      const wall = createOutlinedMesh(new THREE.BoxGeometry(0.55, 0.85, spanLen * 1.02), bridgeStoneMat, 0.035, false);
      wall.position.set(side * (halfWidth + 0.45), 0.48, 0);
      seg.add(wall);
      const cap = createOutlinedMesh(new THREE.BoxGeometry(0.7, 0.16, spanLen * 1.03), bridgeCapMat, 0.025, false);
      cap.position.set(side * (halfWidth + 0.45), 0.98, 0);
      seg.add(cap);
    });
    bridgeGroup.add(seg);

    // Borstwering ook als botsrand, zodat je niet zomaar van de brug af rijdt
    if (i % 3 === 1) {
      const mx = (s0.x + s1.x) * 0.5;
      const mz = (s0.z + s1.z) * 0.5;
      [-1, 1].forEach((side) => {
        hardColliders.push({ x: mx + s0.nx * side * (halfWidth + 0.55), z: mz + s0.nz * side * (halfWidth + 0.55), r: 0.55 });
      });
    }
  }

  // Twee pijlers in het water en stenen bogen aan beide zijkanten
  const pierIdx = [Math.round(numSegs / 3), Math.round((numSegs * 2) / 3)];
  pierIdx.forEach((pi) => {
    const ps = bSamples[pi];
    const pierLen = Math.max(4.0, ps.y + 3.2);
    const pier = new THREE.Group();
    setAlignedTransform(pier, ps.x, ps.y - 0.3 - pierLen * 0.5, ps.z, Math.atan2(ps.tx, ps.tz), 0);
    pier.add(createOutlinedMesh(new THREE.BoxGeometry((halfWidth + 0.6) * 2, pierLen, 1.6), bridgeStoneDarkMat, 0.05, false));
    // Puntige ijsbreker richting stroming
    [-1, 1].forEach((side) => {
      const nose = createOutlinedMesh(new THREE.CylinderGeometry(0.8, 0.8, pierLen, 3), bridgeStoneDarkMat, 0.04, false);
      nose.position.set(side * (halfWidth + 0.9), 0, 0);
      nose.rotation.y = side > 0 ? Math.PI / 6 : -Math.PI / 6;
      pier.add(nose);
    });
    bridgeGroup.add(pier);
  });

  // Bogen: halve ringen tussen landhoofd/pijlers, zichtbaar aan beide kanten van de brug
  const archPoints = [0, pierIdx[0], pierIdx[1], numSegs];
  for (let k = 0; k < archPoints.length - 1; k++) {
    const a0 = bSamples[archPoints[k]];
    const a1 = bSamples[archPoints[k + 1]];
    const mx = (a0.x + a1.x) * 0.5;
    const mz = (a0.z + a1.z) * 0.5;
    const span = Math.hypot(a1.x - a0.x, a1.z - a0.z);
    const topY = Math.min(a0.y, a1.y) - 0.35;
    const radius = span * 0.5;
    [-1, 1].forEach((side) => {
      const arch = new THREE.Group();
      setAlignedTransform(arch, mx + a0.nx * side * (halfWidth + 0.5), topY - radius * 0.55, mz + a0.nz * side * (halfWidth + 0.5), Math.atan2(a1.x - a0.x, a1.z - a0.z) + Math.PI * 0.5, 0);
      const ring = createOutlinedMesh(new THREE.TorusGeometry(radius, 0.42, 6, 18, Math.PI), bridgeStoneMat, 0.035, false);
      ring.scale.y = 0.55;
      arch.add(ring);
      bridgeGroup.add(arch);
    });
  }

  scene.add(bridgeGroup);
}

function buildSuspensionBridge(curve, isClosed, uCenter, uHalfSpan, elevFn, bridgeInfoFn, opts = {}) {
  const halfWidth = MAIN_HALF_WIDTH;
  const deckMat = makeToonMat(0x464349);
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

    // (wegmarkering wordt door het wegennet zelf over het dek doorgetrokken)

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
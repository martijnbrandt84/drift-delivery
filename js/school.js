import * as THREE from 'three';
import { scene, createOutlinedMesh, makeToonMat, registerSeasonalMat } from './scene-setup.js';
import { ruralLots } from './water-lots.js';
import { hardColliders, registerDestructible, markLastPlanted } from './demolition.js';
import { houseWindows, warmWindowMat, PARK_BAY_W, PARK_BAY_D, createParkTree } from './town.js';
import { createRoadSign } from './scenery.js';
import { tagMap } from './map-tags.js';
import { buildSchoolBusMesh, parkedCars, setVehicleLights } from './vehicles.js';
import { getTerrainHeight } from './terrain.js';

// =========================================================
// PINEWOOD SCHOOL: klein bakstenen schooltje naast het politiebureau, met een basketbalveld,
// vier parkeervakken en de gele schoolbus voor de deur.
// Lokaal: lx langs de weg, lz richting de weg (+). De inrit komt binnen op lx = 0.
//   gebouw        x -17,5 .. -2,5   z -15,5 .. -7
//   parkeerplein  x -18,5 .. 2,6    z -5 .. 13,5   (vier vakken tegen de stoep, bus langs de voorkant)
//   basketbalveld x 3,5 .. 18,5     z -14 .. 12
// =========================================================
const lot = ruralLots.find((l) => l.type === 'school');

function makeSignTexture(text, bg, fg) {
  const c = document.createElement('canvas');
  c.width = 768;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 768, 128);
  ctx.fillStyle = fg;
  ctx.font = '900 66px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 384, 68);
  const tex = Object.assign(new THREE.CanvasTexture(c), { colorSpace: THREE.SRGBColorSpace });
  tex.needsUpdate = true;
  return tex;
}
const SIGN_OPTS = { polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, toneMapped: false };

function buildSchool() {
  if (!lot) return;
  const surfaceY = lot.roadY - 0.02;
  const g = new THREE.Group();
  g.position.set(lot.x, surfaceY, lot.z);
  g.rotation.y = lot.yaw;
  scene.add(g);
  const c = Math.cos(lot.yaw);
  const s = Math.sin(lot.yaw);
  const toWorld = (lx, lz) => ({ x: lot.x + lx * c + lz * s, z: lot.z - lx * s + lz * c });
  const collide = (lx, lz, r) => {
    const p = toWorld(lx, lz);
    hardColliders.push({ x: p.x, z: p.z, r });
  };

  const slabH = 3.2;
  const asphaltMat = makeToonMat(0x4a474c);
  const lineMat = makeToonMat(0xf2ede4);
  const paveMat = registerSeasonalMat(0xd8cfc0, 0xeef4fa);
  const brickMat = makeToonMat(0xa8432f);
  const trimMat = makeToonMat(0xf4efe4);
  const roofMat = registerSeasonalMat(0x3d4a44, 0xf2f6fb);

  // ---- Parkeerplein ----
  const PAD_X0 = -18.5;
  const PAD_X1 = 2.6;
  const PAD_Z0 = -5.0;
  const PAD_Z1 = 13.5;
  const pad = tagMap(new THREE.Mesh(new THREE.BoxGeometry(PAD_X1 - PAD_X0, slabH, PAD_Z1 - PAD_Z0), asphaltMat), 'paved');
  pad.position.set((PAD_X0 + PAD_X1) / 2, -slabH / 2, (PAD_Z0 + PAD_Z1) / 2);
  pad.receiveShadow = true;
  g.add(pad);
  // Stoep langs de gevel, met een sokkel onder het gebouw
  const walk = createOutlinedMesh(new THREE.BoxGeometry(17.0, slabH + 0.16, 10.8), paveMat, 0.03, false, true);
  walk.position.set(-10.0, -slabH / 2 + 0.08, -10.6);
  g.add(walk);

  // ---- Schoolgebouw ----
  const school = tagMap(new THREE.Group(), 'civic');
  school.position.set(-10.0, 0.16, -11.25);
  g.add(school);
  const W = 15.0;
  const D = 8.5;
  const H = 4.2;
  const body = createOutlinedMesh(new THREE.BoxGeometry(W, H, D), brickMat, 0.055);
  body.position.y = H / 2;
  school.add(body);
  const band = new THREE.Mesh(new THREE.BoxGeometry(W + 0.06, 0.25, D + 0.06), trimMat);
  band.position.y = 0.4;
  school.add(band);
  const cornice = createOutlinedMesh(new THREE.BoxGeometry(W + 0.5, 0.4, D + 0.5), trimMat, 0.035, false);
  cornice.position.y = H + 0.2;
  school.add(cornice);
  const roof = createOutlinedMesh(new THREE.BoxGeometry(W - 0.2, 0.2, D - 0.2), roofMat, 0.03, false);
  roof.position.y = H + 0.45;
  school.add(roof);
  // Klokkentorentje midden op het dak
  const cupola = createOutlinedMesh(new THREE.BoxGeometry(1.6, 1.4, 1.6), trimMat, 0.035);
  cupola.position.y = H + 1.25;
  school.add(cupola);
  const bellOpening = new THREE.Mesh(new THREE.BoxGeometry(1.64, 0.7, 0.9), makeToonMat(0x2b2b2b));
  bellOpening.position.y = H + 1.35;
  school.add(bellOpening);
  const spire = createOutlinedMesh(new THREE.ConeGeometry(1.25, 1.5, 4), roofMat, 0.035);
  spire.position.y = H + 2.7;
  spire.rotation.y = Math.PI / 4;
  school.add(spire);
  // Entree met een wit portiek
  const front = D / 2;
  const portico = createOutlinedMesh(new THREE.BoxGeometry(4.2, 0.3, 1.8), trimMat, 0.03, false);
  portico.position.set(0, 3.1, front + 0.9);
  school.add(portico);
  [-1.8, 1.8].forEach((px) => {
    const col = createOutlinedMesh(new THREE.CylinderGeometry(0.16, 0.18, 2.95, 8), trimMat, 0.025, false);
    col.position.set(px, 1.48, front + 1.6);
    school.add(col);
  });
  const door = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 2.4), warmWindowMat);
  door.position.set(0, 1.25, front + 0.03);
  school.add(door);
  const doorFrame = createOutlinedMesh(new THREE.BoxGeometry(2.2, 2.7, 0.12), trimMat, 0.02, false);
  doorFrame.position.set(0, 1.35, front - 0.02);
  school.add(doorFrame);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(6.6, 1.1), new THREE.MeshBasicMaterial({ map: makeSignTexture('PINEWOOD SCHOOL', '#1f4e3d', '#f4efe4'), ...SIGN_OPTS }));
  sign.position.set(0, H - 0.55, front + 0.04);
  school.add(sign);
  // Ramen: voorgevel links en rechts van de entree, en aan de zijkanten
  [-6.0, -4.3, 4.3, 6.0].forEach((wx) => {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.6), warmWindowMat);
    win.position.set(wx, 2.0, front + 0.03);
    school.add(win);
    houseWindows.push({ mesh: win, timer: Math.random() * 10 });
    const sill = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 0.16), trimMat);
    sill.position.set(wx, 1.13, front + 0.08);
    school.add(sill);
  });
  [-1, 1].forEach((side) => {
    [-2.0, 2.0].forEach((wz) => {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.6), warmWindowMat);
      win.position.set(side * (W / 2 + 0.03), 2.0, wz);
      win.rotation.y = side * Math.PI / 2;
      school.add(win);
      houseWindows.push({ mesh: win, timer: Math.random() * 10 });
    });
  });
  [-14.2, -10.0, -5.8].forEach((lx) => collide(lx, -11.25, 4.1));
  collide(-11.8, -5.3, 0.3);
  collide(-8.2, -5.3, 0.3);

  // Vlaggenmast naast de entree
  {
    const FX = -3.8;
    const FZ = -6.0;
    const pole = createOutlinedMesh(new THREE.CylinderGeometry(0.07, 0.1, 7, 6), makeToonMat(0xd8dadd), 0.02, false);
    pole.position.set(FX, 3.6, FZ);
    g.add(pole);
    const flag = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.0, 1.6), makeToonMat(0xc63b3b));
    flag.position.set(FX, 6.5, FZ + 0.85);
    g.add(flag);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.3, 1.6), makeToonMat(0xf4efe4));
    stripe.position.set(FX, 6.5, FZ + 0.85);
    g.add(stripe);
    const canton = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.6), makeToonMat(0x2a4a8a));
    canton.position.set(FX, 6.75, FZ + 0.35);
    g.add(canton);
    collide(FX, FZ, 0.35);
  }

  // ---- Vier parkeervakken tegen de stoep (neus naar de school), met een looppad naar de deur ----
  const stopMat = makeToonMat(0xcfc8be);
  const bayMidZ = PAD_Z0 + PARK_BAY_D / 2;
  [[-18.0, 2], [-7.2, 2]].forEach(([x0, n]) => {
    for (let k = 0; k <= n; k++) {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(0.16, PARK_BAY_D), lineMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(x0 + k * PARK_BAY_W, 0.02, bayMidZ);
      g.add(line);
      if (k < n) {
        const stop = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.1, 0.22), stopMat);
        stop.position.set(x0 + (k + 0.5) * PARK_BAY_W, 0.05, PAD_Z0 + 0.45);
        g.add(stop);
      }
    }
  });
  // Bushalte-vak langs de voorkant van het plein (gele strepen)
  const busLineMat = makeToonMat(0xf4c430);
  [[-11.0, 7.95, 9.0, 0.16], [-11.0, 11.05, 9.0, 0.16], [-15.5, 9.5, 0.16, 3.1], [-6.5, 9.5, 0.16, 3.1]].forEach(([bx, bz, bw, bd]) => {
    const l = new THREE.Mesh(new THREE.PlaneGeometry(bw, bd), busLineMat);
    l.rotation.x = -Math.PI / 2;
    l.position.set(bx, 0.02, bz);
    g.add(l);
  });

  // ---- Basketbalveld ----
  const CX0 = 3.5;
  const CX1 = 18.5;
  const CZ0 = -14.0;
  const CZ1 = 12.0;
  const ccx = (CX0 + CX1) / 2;
  const ccz = (CZ0 + CZ1) / 2;
  const apron = tagMap(new THREE.Mesh(new THREE.BoxGeometry(CX1 - CX0 + 2.0, slabH, CZ1 - CZ0 + 3.0), makeToonMat(0x2f6f5e)), 'paved');
  apron.position.set(ccx, -slabH / 2 + 0.06, ccz);
  apron.receiveShadow = true;
  g.add(apron);
  const courtTop = 0.1;
  const court = new THREE.Mesh(new THREE.BoxGeometry(CX1 - CX0, 0.08, CZ1 - CZ0), makeToonMat(0xb5533c));
  court.position.set(ccx, courtTop - 0.04, ccz);
  court.receiveShadow = true;
  g.add(court);
  const courtLineMat = new THREE.MeshBasicMaterial({ color: 0xfaf6ee });
  const ly = courtTop + 0.006;
  const lineBox = (x0, z0, x1, z1) => {
    const l = new THREE.Mesh(new THREE.PlaneGeometry(Math.max(0.09, Math.abs(x1 - x0)), Math.max(0.09, Math.abs(z1 - z0))), courtLineMat);
    l.rotation.x = -Math.PI / 2;
    l.position.set((x0 + x1) / 2, ly, (z0 + z1) / 2);
    g.add(l);
  };
  const arc = (cx, cz, r, a0, a1) => {
    const ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.045, r + 0.045, 40, 1, a0, a1 - a0), courtLineMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(cx, ly, cz);
    g.add(ring);
  };
  // Buitenlijnen, middenlijn en middencirkel
  lineBox(CX0, CZ0, CX1, CZ0);
  lineBox(CX0, CZ1, CX1, CZ1);
  lineBox(CX0, CZ0, CX0, CZ1);
  lineBox(CX1, CZ0, CX1, CZ1);
  lineBox(CX0, ccz, CX1, ccz);
  arc(ccx, ccz, 1.8, 0, Math.PI * 2);
  // Per helft: de 'key', vrijworpcirkel en driepuntsboog (RingGeometry ligt na het kantelen met hoek 0 langs +x
  // en met hoek +90° richting -z)
  [[CZ0, 1], [CZ1, -1]].forEach(([bz, dir]) => {
    const keyEnd = bz + dir * 5.8;
    lineBox(ccx - 2.45, bz, ccx - 2.45, keyEnd);
    lineBox(ccx + 2.45, bz, ccx + 2.45, keyEnd);
    lineBox(ccx - 2.45, keyEnd, ccx + 2.45, keyEnd);
    // vrijworpcirkel: alleen de helft buiten de key
    if (dir > 0) arc(ccx, keyEnd, 1.8, Math.PI, Math.PI * 2);
    else arc(ccx, keyEnd, 1.8, 0, Math.PI);
    const hoopZ = bz + dir * 1.6;
    if (dir > 0) arc(ccx, hoopZ, 6.75, Math.PI, Math.PI * 2);
    else arc(ccx, hoopZ, 6.75, 0, Math.PI);
  });
  // Baskets: paal achter de achterlijn, arm, wit bord, oranje ring met netje
  const poleMat = makeToonMat(0x3a3f45);
  const boardMat = makeToonMat(0xf8f6f0);
  const rimMat = makeToonMat(0xe8661c);
  const netMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75 });
  [[CZ0, 1], [CZ1, -1]].forEach(([bz, dir]) => {
    const hoop = new THREE.Group();
    const pole = createOutlinedMesh(new THREE.CylinderGeometry(0.12, 0.14, 3.6, 8), poleMat, 0.02, false);
    pole.position.set(0, 1.8, -1.0);
    hoop.add(pole);
    const arm = createOutlinedMesh(new THREE.BoxGeometry(0.14, 0.14, 1.3), poleMat, 0.015, false);
    arm.position.set(0, 3.35, -0.4);
    hoop.add(arm);
    const board = createOutlinedMesh(new THREE.BoxGeometry(1.8, 1.05, 0.06), boardMat, 0.02, false);
    board.position.set(0, 3.45, 0.25);
    hoop.add(board);
    const square = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.45, 0.02), rimMat);
    square.position.set(0, 3.3, 0.29);
    hoop.add(square);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.025, 6, 16), rimMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.set(0, 3.05, 0.55);
    hoop.add(rim);
    const net = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.15, 0.4, 10, 1, true), netMat);
    net.position.set(0, 2.83, 0.55);
    hoop.add(net);
    hoop.position.set(ccx, courtTop, bz + dir * 1.0); // ring 1,6 m binnen de achterlijn, paal op de lijn
    hoop.rotation.y = dir > 0 ? 0 : Math.PI;
    g.add(hoop);
    collide(ccx, bz, 0.35);
  });
  // Een paar basketballen (los, omrijdbaar)
  const ballMat = makeToonMat(0xe8661c);
  [[ccx + 1.6, CZ0 + 3.2], [ccx - 3.0, ccz + 1.0], [CX1 + 0.6, CZ1 - 2.0]].forEach(([bx, bz]) => {
    const ball = createOutlinedMesh(new THREE.SphereGeometry(0.13, 10, 8), ballMat, 0.012, false);
    const p = toWorld(bx, bz);
    const by = surfaceY + courtTop + 0.13;
    ball.position.set(p.x, by, p.z);
    scene.add(ball);
    registerDestructible(ball, p.x, by, p.z, 0.3, 'small', 2, 'Basketball');
  });
  // Bankjes langs de zijlijn (los, omrijdbaar)
  const benchMat = makeToonMat(0x8a5a36);
  [ccz - 6.0, ccz + 6.0].forEach((bz) => {
    const bench = new THREE.Group();
    const seat = createOutlinedMesh(new THREE.BoxGeometry(0.45, 0.08, 2.2), benchMat, 0.015, false);
    seat.position.y = 0.45;
    bench.add(seat);
    [-0.9, 0.9].forEach((oz) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.45, 0.08), makeToonMat(0x3a3f45));
      leg.position.set(0, 0.22, oz);
      bench.add(leg);
    });
    const p = toWorld(CX0 - 0.55, bz);
    bench.position.set(p.x, surfaceY + 0.06, p.z);
    bench.rotation.y = lot.yaw;
    scene.add(bench);
    registerDestructible(bench, p.x, surfaceY + 0.06, p.z, 0.8, 'small', 6, 'Bench');
  });

  // ---- Bomen achter en naast de school ----
  [[-19.5, -16.5], [-19.8, -7.0], [-1.0, -17.0], [19.8, -16.5], [20.0, 2.0]].forEach(([tx, tz]) => {
    const p = toWorld(tx, tz);
    const y = getTerrainHeight(p.x, p.z);
    const tree = createParkTree();
    tree.scale.setScalar(1.1 + Math.random() * 0.25);
    tree.position.set(p.x, y, p.z);
    tree.rotation.y = Math.random() * Math.PI * 2;
    scene.add(tree);
    registerDestructible(tree, p.x, y, p.z, 0.7, 'tree', 15, 'Tree');
    markLastPlanted();
  });

  // ---- De gele schoolbus in het busvak ----
  const bus = buildSchoolBusMesh();
  const bp = toWorld(-11.0, 9.5);
  bus.root.position.set(bp.x, surfaceY + 0.08, bp.z);
  bus.root.rotation.y = lot.yaw + Math.PI / 2; // met de neus richting de inrit (+lx)
  scene.add(bus.root);
  parkedCars.push(bus);
  setVehicleLights(bus, false);

  // ---- Bord aan de weg ----
  const sp = toWorld(-12.0, PAD_Z1 + 2.5);
  createRoadSign(sp.x, sp.z, surfaceY, lot.yaw, ['PINEWOOD', 'School']);
}
buildSchool();

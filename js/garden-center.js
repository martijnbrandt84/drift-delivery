import * as THREE from 'three';
import {
  scene, createOutlinedMesh, makeToonMat, registerSeasonalMat, christmasGroup, deciduousFoliageObjects
} from './scene-setup.js';
import { ruralLots } from './water-lots.js';
import { hardColliders, registerDestructible, markLastPlanted } from './demolition.js';
import { houseWindows, warmWindowMat, PARK_BAY_W, PARK_BAY_D, createParkTree } from './town.js';
import { createRoadSign } from './scenery.js';
import { tagMap } from './map-tags.js';
import { getTerrainHeight } from './terrain.js';

// =========================================================
// PINEWOOD GARDEN CENTER aan de kustweg in het zuidwesten
// Houten winkel met daarachter een grote kas (met café "The Potting Shed" in de hoek en een terras),
// een omheinde buitenafdeling met plantentafels, twee rijen parkeervakken en een seizoensplein:
// in de herfst pompoenen op hooibalen, in de winter een kerstbomenverkoop met lichtjes.
// Lokaal: lx langs de weg, lz richting de weg (+). De inrit komt binnen op lx = 0.
// =========================================================
const lot = ruralLots.find((l) => l.type === 'garden');

function makeSignTexture(lines, bg, fg) {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 160;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1024, 160);
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (lines.length === 1) {
    ctx.font = '900 76px system-ui, sans-serif';
    ctx.fillText(lines[0], 512, 86);
  } else {
    ctx.font = '900 64px system-ui, sans-serif';
    ctx.fillText(lines[0], 512, 58);
    ctx.font = '600 40px system-ui, sans-serif';
    ctx.fillText(lines[1], 512, 122);
  }
  const tex = Object.assign(new THREE.CanvasTexture(c), { colorSpace: THREE.SRGBColorSpace });
  tex.needsUpdate = true;
  return tex;
}
const SIGN_OPTS = { polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, toneMapped: false };

function buildGardenCenter() {
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
  const slab = (x0, x1, z0, z1, mat, tag = 'paved', lift = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, slabH, z1 - z0), mat);
    m.position.set((x0 + x1) / 2, -slabH / 2 + lift, (z0 + z1) / 2);
    m.receiveShadow = true;
    if (tag) tagMap(m, tag);
    g.add(m);
    return m;
  };

  const asphaltMat = makeToonMat(0x4a474c);
  const lineMat = makeToonMat(0xf2ede4);
  const paveMat = registerSeasonalMat(0xd8cfc0, 0xeef4fa);
  const gravelMat = registerSeasonalMat(0xcdb894, 0xe8eff6);
  const woodMat = makeToonMat(0x8f5530);
  const woodDarkMat = makeToonMat(0x5e3a22);
  const trimMat = makeToonMat(0xf4efe4);
  const roofMat = registerSeasonalMat(0x2f5e3f, 0xf2f6fb);
  const glassMat = new THREE.MeshToonMaterial({ color: 0xbfe3ea, transparent: true, opacity: 0.38, depthWrite: false });
  const frameMat = makeToonMat(0xf6f4ee);
  const plantMats = [makeToonMat(0x4f8a3c), makeToonMat(0x6a9a40), makeToonMat(0x3f6e3c)];
  const flowerMats = [makeToonMat(0xe45a7a), makeToonMat(0xf2c230), makeToonMat(0xf6f2ea), makeToonMat(0x8a5ac8)];
  const potMat = makeToonMat(0xb8643a);
  const tableMat = makeToonMat(0x6b6f74);

  // ---- Ondergrond: parkeerplaats (asfalt), voorplein en terras (tegels), buitenafdeling en seizoensplein (grind) ----
  slab(-16, 12, -3.8, 14.6, asphaltMat);
  slab(-16, 25, -8, -3.8, paveMat);
  slab(-31, -16, -21, -4, gravelMat);
  slab(14, 34, -1, 14, gravelMat);
  slab(-16.5, 23.5, -21.5, -7.6, paveMat, null, 0.08); // sokkel onder winkel en kas

  // ---- Houten winkel ----
  const shop = tagMap(new THREE.Group(), 'shop');
  shop.position.set(-8.5, 0.16, -13);
  g.add(shop);
  const SW = 15;
  const SD = 10;
  const SH = 4.2;
  const shopBody = createOutlinedMesh(new THREE.BoxGeometry(SW, SH, SD), woodMat, 0.055);
  shopBody.position.y = SH / 2;
  shop.add(shopBody);
  // planken: donkere horizontale strepen
  for (let y = 0.7; y < SH; y += 0.7) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(SW + 0.04, 0.05, SD + 0.04), woodDarkMat);
    plank.position.y = y;
    shop.add(plank);
  }
  // zadeldak (nok langs de lengte), twee schuine vlakken met overstek
  {
    const rRise = 1.9;
    const rHalf = SD / 2 + 0.6;
    const rLen = Math.hypot(rHalf, rRise);
    const rAng = Math.atan2(rRise, rHalf);
    [-1, 1].forEach((side) => {
      const pane = createOutlinedMesh(new THREE.BoxGeometry(SW + 0.9, 0.22, rLen), roofMat, 0.04);
      pane.position.set(0, SH + rRise / 2, side * rHalf / 2);
      pane.rotation.x = side * rAng;
      shop.add(pane);
    });
    [-1, 1].forEach((side) => {
      const gable = new THREE.Mesh(new THREE.BufferGeometry(), woodMat);
      gable.geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, SH, -SD / 2, 0, SH + rRise * (SD / 2) / rHalf, 0, 0, SH, SD / 2], 3));
      gable.geometry.computeVertexNormals();
      gable.material = woodMat.clone();
      gable.material.side = THREE.DoubleSide;
      gable.position.x = side * SW / 2;
      shop.add(gable);
    });
  }
  const fz = SD / 2;
  const doors = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.6), warmWindowMat);
  doors.position.set(0, 1.35, fz + 0.03);
  shop.add(doors);
  const doorFrame = createOutlinedMesh(new THREE.BoxGeometry(3.6, 2.9, 0.14), trimMat, 0.02, false);
  doorFrame.position.set(0, 1.45, fz - 0.02);
  shop.add(doorFrame);
  [-5.0, -3.0, 3.0, 5.0].forEach((wx) => {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), warmWindowMat);
    win.position.set(wx, 2.0, fz + 0.03);
    shop.add(win);
    houseWindows.push({ mesh: win, timer: Math.random() * 10 });
  });
  const awning = createOutlinedMesh(new THREE.BoxGeometry(SW - 1, 0.16, 1.8), roofMat, 0.03, false);
  awning.position.set(0, 3.05, fz + 0.85);
  awning.rotation.x = 0.18;
  shop.add(awning);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(9.0, 1.4),
    new THREE.MeshBasicMaterial({ map: makeSignTexture(['PINEWOOD', 'GARDEN CENTER'], '#2f5e3f', '#f6f2ea'), ...SIGN_OPTS })
  );
  sign.position.set(0, SH - 0.5, fz + 0.05);
  shop.add(sign);
  [-12.5, -8.5, -4.5].forEach((lx) => collide(lx, -13, 4.4));

  // ---- Kas met café-hoek ----
  const GX0 = -1;
  const GX1 = 23;
  const GZ0 = -21;
  const GZ1 = -7.6;
  const gcx = (GX0 + GX1) / 2;
  const gcz = (GZ0 + GZ1) / 2;
  const GW = GX1 - GX0;
  const GD = GZ1 - GZ0;
  const GH = 3.4;
  const gh = tagMap(new THREE.Group(), 'shop');
  gh.position.set(gcx, 0.16, gcz);
  g.add(gh);
  const knee = createOutlinedMesh(new THREE.BoxGeometry(GW, 0.7, GD), trimMat, 0.035);
  knee.position.y = 0.35;
  gh.add(knee);
  const glassWalls = new THREE.Mesh(new THREE.BoxGeometry(GW - 0.1, GH - 0.7, GD - 0.1), glassMat);
  glassWalls.position.y = 0.7 + (GH - 0.7) / 2;
  gh.add(glassWalls);
  // glazen zadeldak
  const rise = 2.2;
  const half = GD / 2;
  const slope = Math.hypot(half, rise);
  const ang = Math.atan2(rise, half);
  [-1, 1].forEach((side) => {
    const pane = new THREE.Mesh(new THREE.BoxGeometry(GW, 0.05, slope), glassMat);
    pane.position.set(0, GH + rise / 2, side * half / 2);
    pane.rotation.x = side * ang;
    gh.add(pane);
  });
  // witte spanten (wanden + dak) en nok
  for (let x = -GW / 2; x <= GW / 2 + 0.01; x += 2.4) {
    [-1, 1].forEach((side) => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, GH, 0.12), frameMat);
      post.position.set(x, GH / 2, side * half);
      gh.add(post);
      const rafter = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, slope), frameMat);
      rafter.position.set(x, GH + rise / 2, side * half / 2);
      rafter.rotation.x = side * ang;
      gh.add(rafter);
    });
  }
  [-1, 1].forEach((side) => {
    for (let z = -half; z <= half + 0.01; z += 2.2) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, GH, 0.12), frameMat);
      post.position.set(side * GW / 2, GH / 2, z);
      gh.add(post);
    }
    const gable = new THREE.Mesh(new THREE.BufferGeometry(), glassMat);
    gable.geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, GH, -half, 0, GH + rise, 0, 0, GH, half], 3));
    gable.geometry.computeVertexNormals();
    gable.material = glassMat.clone();
    gable.material.side = THREE.DoubleSide;
    gable.position.x = side * GW / 2;
    gh.add(gable);
  });
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(GW + 0.2, 0.16, 0.16), frameMat);
  ridge.position.y = GH + rise;
  gh.add(ridge);
  // binnen: lange plantentafels vol groen (door het glas zichtbaar)
  for (let z = -half + 1.6; z < half - 1.0; z += 2.6) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(14, 0.8, 1.2), tableMat);
    t.position.set(-4.5, 0.4, z);
    gh.add(t);
    for (let x = -11; x <= 2; x += 1.0) {
      const pl = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 0), plantMats[Math.floor(Math.random() * 3)]);
      pl.position.set(x + (Math.random() - 0.5) * 0.2, 1.15, z + (Math.random() - 0.5) * 0.3);
      gh.add(pl);
    }
  }
  // café "The Potting Shed" in de hoek (rechtsvoor in de kas)
  const counter = createOutlinedMesh(new THREE.BoxGeometry(4.0, 1.1, 0.9), woodMat, 0.025, false);
  counter.position.set(GW / 2 - 4.2, 0.55, -1.2);
  gh.add(counter);
  [[GW / 2 - 6.5, 2.2], [GW / 2 - 3.5, 2.2], [GW / 2 - 2.0, 4.6]].forEach(([tx, tz]) => {
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.06, 10), trimMat);
    top.position.set(tx, 0.82, tz);
    gh.add(top);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.8, 6), tableMat);
    leg.position.set(tx, 0.4, tz);
    gh.add(leg);
  });
  const cafeSign = new THREE.Mesh(
    new THREE.PlaneGeometry(4.6, 0.72),
    new THREE.MeshBasicMaterial({ map: makeSignTexture(['THE POTTING SHED · CAFÉ'], '#5e3a22', '#f6f2ea'), ...SIGN_OPTS })
  );
  cafeSign.position.set(GW / 2 - 4.2, 2.9, half + 0.12);
  gh.add(cafeSign);
  const cafeGlow = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 1.6), warmWindowMat);
  cafeGlow.position.set(GW / 2 - 4.2, 1.6, half + 0.08);
  gh.add(cafeGlow);
  houseWindows.push({ mesh: cafeGlow, timer: Math.random() * 10 });
  for (let x = GX0 + 3; x <= GX1 - 2.5; x += 4.6) [gcz - 2.6, gcz + 2.6].forEach((z) => collide(x, z, 4.0));
  collide(GX1 - 2.5, gcz - 3.5, 3.0);

  // ---- Terras van het café (los meubilair, omrijdbaar) ----
  [[15.5, -5.5, 0x2f5e3f], [19.0, -5.5, 0xf2c230], [22.5, -5.5, 0x2f5e3f]].forEach(([tx, tz, hex]) => {
    const t = new THREE.Group();
    const top = createOutlinedMesh(new THREE.CylinderGeometry(0.55, 0.55, 0.06, 10), makeToonMat(0xf6f2ea), 0.012, false);
    top.position.y = 0.78;
    t.add(top);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.3, 6), tableMat);
    leg.position.y = 1.15;
    t.add(leg);
    const umb = createOutlinedMesh(new THREE.ConeGeometry(1.3, 0.45, 8), makeToonMat(hex), 0.02, false);
    umb.position.y = 2.4;
    t.add(umb);
    [-0.85, 0.85].forEach((sx) => {
      const chair = createOutlinedMesh(new THREE.BoxGeometry(0.45, 0.45, 0.45), woodMat, 0.012, false);
      chair.position.set(sx, 0.23, 0);
      t.add(chair);
    });
    const p = toWorld(tx, tz);
    t.position.set(p.x, surfaceY, p.z);
    t.rotation.y = lot.yaw;
    scene.add(t);
    registerDestructible(t, p.x, surfaceY, p.z, 0.9, 'small', 8, 'Patio table');
  });

  // ---- Buitenafdeling: omheind, met plantentafels, boompjes in potten, potgrond en brandhout ----
  const fenceMat = makeToonMat(0xa8794c);
  const fenceRun = (x1, z1, x2, z2) => {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const ang2 = Math.atan2(z2 - z1, x2 - x1);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.1, 0.08), fenceMat);
    rail.position.set((x1 + x2) / 2, 0.95, (z1 + z2) / 2);
    rail.rotation.y = -ang2;
    g.add(rail);
    const rail2 = rail.clone();
    rail2.position.y = 0.5;
    g.add(rail2);
    for (let k = 0; k <= Math.round(len / 2); k++) {
      const t = k / Math.round(len / 2);
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.15, 0.12), fenceMat);
      post.position.set(x1 + (x2 - x1) * t, 0.58, z1 + (z2 - z1) * t);
      g.add(post);
      collide(x1 + (x2 - x1) * t, z1 + (z2 - z1) * t, 0.3);
    }
  };
  fenceRun(-31, -21, -16.5, -21);
  fenceRun(-31, -21, -31, -4);
  fenceRun(-31, -4, -21, -4); // opening naar het voorplein tussen x -21 en -16
  for (let z = -19.2; z < -6; z += 3.0) {
    const t = createOutlinedMesh(new THREE.BoxGeometry(10.5, 0.75, 1.3), tableMat, 0.02, false);
    t.position.set(-24.5, 0.38, z);
    g.add(t);
    for (let x = -29.3; x <= -19.8; x += 0.8) {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.17, 0.3, 7), potMat);
      pot.position.set(x, 0.9, z);
      g.add(pot);
      const isFlower = Math.random() < 0.45;
      const pl = new THREE.Mesh(
        new THREE.IcosahedronGeometry(isFlower ? 0.26 : 0.32, 0),
        isFlower ? flowerMats[Math.floor(Math.random() * 4)] : plantMats[Math.floor(Math.random() * 3)]
      );
      pl.position.set(x, 1.2, z);
      g.add(pl);
    }
    collide(-27, z, 0.8);
    collide(-22, z, 0.8);
  }
  // jonge boompjes in grote potten langs het voorplein
  [[-14.5, -6.0], [-11.5, -6.0], [9.5, -6.0], [12.0, -6.0]].forEach(([tx, tz]) => {
    const pot = createOutlinedMesh(new THREE.CylinderGeometry(0.55, 0.42, 0.7, 10), potMat, 0.02, false);
    pot.position.set(tx, 0.35, tz);
    g.add(pot);
    const tree = createParkTree();
    tree.scale.setScalar(0.6);
    tree.position.set(tx, 0.6, tz);
    g.add(tree);
    collide(tx, tz, 0.6);
  });
  // pallets met zakken potgrond en een stapel brandhout tegen de zijgevel van de winkel
  const bagMat = makeToonMat(0x3f6e3c);
  [[-2.5, -5.4], [5.0, -5.4]].forEach(([px, pz]) => {
    const pallet = createOutlinedMesh(new THREE.BoxGeometry(2.0, 0.18, 1.2), makeToonMat(0xc9a06a), 0.02, false);
    pallet.position.set(px, 0.25, pz);
    g.add(pallet);
    for (let k = 0; k < 6; k++) {
      const bag = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.22, 0.5), bagMat);
      bag.position.set(px - 0.45 + (k % 2) * 0.9, 0.45 + Math.floor(k / 2) * 0.22, pz);
      g.add(bag);
    }
    collide(px, pz, 1.0);
  });
  {
    const logMat = makeToonMat(0x8a5a36);
    for (let r = 0; r < 4; r++) {
      for (let k = 0; k < 6 - r; k++) {
        const log = createOutlinedMesh(new THREE.CylinderGeometry(0.17, 0.17, 1.2, 7), logMat, 0.012, false);
        log.position.set(-17.2, 0.33 + r * 0.31, -16.5 + k * 0.36 + r * 0.18);
        log.rotation.set(0, 0, Math.PI / 2);
        g.add(log);
      }
    }
    collide(-17.2, -15.6, 1.3);
  }

  // ---- Twee rijen parkeervakken (standaardmaat): rij A met de neus naar de winkel, rij B naar de weg ----
  const stopMat = makeToonMat(0xcfc8be);
  const row = (x0, n, z0, stopTop) => {
    for (let k = 0; k <= n; k++) {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(0.16, PARK_BAY_D), lineMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(x0 + k * PARK_BAY_W, 0.02, z0 + PARK_BAY_D / 2);
      g.add(line);
      if (k < n) {
        const stop = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.1, 0.22), stopMat);
        stop.position.set(x0 + (k + 0.5) * PARK_BAY_W, 0.05, stopTop ? z0 + 0.45 : z0 + PARK_BAY_D - 0.45);
        g.add(stop);
      }
    }
  };
  row(-14.4, 5, -3.8, true);
  row(1.6, 4, -3.8, true);
  row(-14.4, 4, 10.0, false);
  row(4.2, 3, 10.0, false);
  // een paar losse winkelwagens/plantenkarren op het voorplein
  // (de karren uit de mall verhuizen niet; hier staat een plantenkar)
  {
    const cart = new THREE.Group();
    const bed = createOutlinedMesh(new THREE.BoxGeometry(1.0, 0.1, 1.8), tableMat, 0.015, false);
    bed.position.y = 0.55;
    cart.add(bed);
    for (let k = 0; k < 4; k++) {
      const pl = new THREE.Mesh(new THREE.IcosahedronGeometry(0.25, 0), flowerMats[k % 4]);
      pl.position.set(k % 2 ? 0.25 : -0.25, 0.8, -0.5 + Math.floor(k / 2) * 0.9);
      cart.add(pl);
    }
    const p = toWorld(1.5, -5.6);
    cart.position.set(p.x, surfaceY, p.z);
    cart.rotation.y = lot.yaw + 0.4;
    scene.add(cart);
    registerDestructible(cart, p.x, surfaceY, p.z, 0.7, 'small', 4, 'Plant cart');
  }

  // ---- Seizoensplein (rechts van de parkeerplaats) ----
  // Herfst (de gewone stand): pompoenen op hooibalen en een vogelverschrikker; verdwijnt in de winter
  const autumnStall = new THREE.Group();
  g.add(autumnStall);
  deciduousFoliageObjects.push(autumnStall);
  const hayMat = makeToonMat(0xd9ac4e);
  const pumpkinMats = [makeToonMat(0xf08a24), makeToonMat(0xe8741c), makeToonMat(0xf2a33a)];
  const pumpkinGeo = new THREE.SphereGeometry(0.4, 9, 6);
  pumpkinGeo.scale(1.15, 0.78, 1.15);
  const pumpkinPile = (x0, z0, w, d) => {
    const bale = createOutlinedMesh(new THREE.BoxGeometry(w, 0.55, d), hayMat, 0.025, false);
    bale.position.set(x0 + w / 2, 0.28, z0 + d / 2);
    autumnStall.add(bale);
    for (let i = 0; i < Math.floor(w / 0.95); i++) {
      for (let j = 0; j < Math.floor(d / 0.95); j++) {
        const pk = new THREE.Mesh(pumpkinGeo, pumpkinMats[(i + j) % 3]);
        pk.position.set(x0 + 0.5 + i * 0.95, 0.8, z0 + 0.5 + j * 0.95);
        pk.rotation.y = Math.random() * Math.PI;
        autumnStall.add(pk);
      }
    }
  };
  pumpkinPile(16.5, 1.0, 7.5, 3.8);
  pumpkinPile(25.5, 1.0, 6.0, 3.0);
  pumpkinPile(17.5, 7.0, 5.0, 2.9);
  {
    // vogelverschrikker
    const sc = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.2, 6), woodDarkMat);
    pole.position.y = 1.1;
    sc.add(pole);
    const arms = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.08), woodDarkMat);
    arms.position.y = 1.6;
    sc.add(arms);
    const shirt = createOutlinedMesh(new THREE.BoxGeometry(0.7, 0.8, 0.35), makeToonMat(0xc63b3b), 0.02, false);
    shirt.position.y = 1.45;
    sc.add(shirt);
    const head = createOutlinedMesh(new THREE.SphereGeometry(0.26, 8, 6), makeToonMat(0xe0b75a), 0.02, false);
    head.position.y = 2.1;
    sc.add(head);
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.32, 8), makeToonMat(0xb8893a));
    hat.position.y = 2.4;
    sc.add(hat);
    sc.position.set(29, 0, 8.6);
    autumnStall.add(sc);
  }
  const pumpkinSign = new THREE.Mesh(
    new THREE.PlaneGeometry(4.2, 0.75),
    new THREE.MeshBasicMaterial({ map: makeSignTexture(['PUMPKINS'], '#e8741c', '#ffffff'), ...SIGN_OPTS, side: THREE.DoubleSide })
  );
  pumpkinSign.position.set(24, 1.6, 13.2);
  autumnStall.add(pumpkinSign);
  [21.9, 26.1].forEach((px) => {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.6, 0.12), woodDarkMat);
    post.position.set(px, 0.8, 13.2);
    autumnStall.add(post);
  });

  // Winter: kerstbomenverkoop met rijen bomen in standaards, lichtslingers, een kassahuisje en een bord
  const winterLot = new THREE.Group();
  winterLot.position.copy(g.position);
  winterLot.rotation.copy(g.rotation);
  christmasGroup.add(winterLot);
  const pineMat = makeToonMat(0x2f5e3a);
  const pineDarkMat = makeToonMat(0x244b2f);
  const standMat = makeToonMat(0x8a5a36);
  for (let r = 0; r < 3; r++) {
    for (let k = 0; k < 7; k++) {
      const h = 1.6 + Math.random() * 0.9;
      const tree = createOutlinedMesh(new THREE.ConeGeometry(0.55 + h * 0.12, h, 7), (r + k) % 2 ? pineMat : pineDarkMat, 0.02, false);
      tree.position.set(16.5 + k * 2.4, 0.2 + h / 2, 1.6 + r * 3.4);
      winterLot.add(tree);
      const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.2, 6), standMat);
      stand.position.set(16.5 + k * 2.4, 0.1, 1.6 + r * 3.4);
      winterLot.add(stand);
    }
  }
  // lichtslinger rondom de verkoop (gekleurde lampjes op paaltjes)
  const bulbMats = [0xff5a5a, 0xffd75e, 0x6ad1ff, 0x7bea7b].map((col) => new THREE.MeshBasicMaterial({ color: col }));
  const ring = [[14.6, -0.4], [33.4, -0.4], [33.4, 11.4], [14.6, 11.4], [14.6, -0.4]];
  for (let i = 0; i < ring.length - 1; i++) {
    const [ax, az] = ring[i];
    const [bx, bz] = ring[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    const n = Math.round(len / 0.7);
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 5, 4), bulbMats[k % 4]);
      bulb.position.set(ax + (bx - ax) * t, 2.0 - Math.sin(t * Math.PI * Math.max(1, Math.round(len / 4))) ** 2 * 0.25, az + (bz - az) * t);
      winterLot.add(bulb);
    }
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.1, 0.1), standMat);
    post.position.set(ax, 1.05, az);
    winterLot.add(post);
  }
  const hut = createOutlinedMesh(new THREE.BoxGeometry(3.2, 2.4, 2.0), makeToonMat(0xb23a2c), 0.03);
  hut.position.set(31.4, 1.2, 11.9);
  winterLot.add(hut);
  const hutRoof = createOutlinedMesh(new THREE.BoxGeometry(3.6, 0.2, 2.5), makeToonMat(0xf2f6fb), 0.02, false);
  hutRoof.position.set(31.4, 2.5, 11.9);
  winterLot.add(hutRoof);
  const treeSign = new THREE.Mesh(
    new THREE.PlaneGeometry(5.6, 0.85),
    new THREE.MeshBasicMaterial({ map: makeSignTexture(['FRESH CHRISTMAS TREES'], '#b23a2c', '#ffffff'), ...SIGN_OPTS, side: THREE.DoubleSide })
  );
  treeSign.position.set(22.0, 2.6, 13.4);
  winterLot.add(treeSign);
  [19.4, 24.6].forEach((px) => {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.6, 0.12), standMat);
    post.position.set(px, 1.3, 13.4);
    winterLot.add(post);
  });

  // ---- Bomen om het terrein ----
  [[-33, -23], [-33, 0], [-33, 12], [35, -22], [35, -14], [28, -23], [-20, 14], [36, 6]].forEach(([tx, tz]) => {
    const p = toWorld(tx, tz);
    const y = getTerrainHeight(p.x, p.z);
    const tree = createParkTree();
    tree.scale.setScalar(1.2 + Math.random() * 0.3);
    tree.position.set(p.x, y, p.z);
    tree.rotation.y = Math.random() * Math.PI * 2;
    scene.add(tree);
    registerDestructible(tree, p.x, y, p.z, 0.7, 'tree', 15, 'Tree');
    markLastPlanted();
  });

  // ---- Bord aan de weg ----
  const sp = toWorld(-9.0, 18.0);
  createRoadSign(sp.x, sp.z, surfaceY, lot.yaw, ['GARDEN CENTER', 'Café · Plants']);
}
buildGardenCenter();

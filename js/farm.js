import * as THREE from 'three';
import {
  scene, createOutlinedMesh, makeToonMat, registerSeasonalMat, createMergedToonProp, instantiateBakedProp
} from './scene-setup.js';
import { ruralLots } from './water-lots.js';
import { hardColliders, registerDestructible } from './demolition.js';
import { getTerrainHeight } from './terrain.js';

// =========================================================
// GROTE AFGELEGEN BOERDERIJ: SCHUUR, DUBBELE SILO, BOERENHUIS,
// WINDMOLEN, HEKWERK, HOOIBALEN & UITGESTREKTE MAISVELDEN
// =========================================================
const barnRedMat = makeToonMat(0xa23327);
const barnTrimMat = makeToonMat(0xf5ead3);
const barnRoofMat = registerSeasonalMat(0x362d2a, 0xeef4fa);
const barnDoorMat = makeToonMat(0x4a2e1f);
const stoneFoundMat = makeToonMat(0x8d8379);
const farmHouseWallMat = makeToonMat(0xfaf2e1);
const farmHouseRoofMat = registerSeasonalMat(0x4a5866, 0xeef4fa);
const farmWinMat = new THREE.MeshBasicMaterial({ color: 0xffe29a });

const siloBodyMat = makeToonMat(0xd3d6da);
const siloCapMat = makeToonMat(0x8d939c);
const siloBandMat = makeToonMat(0x5b6268);
const steelMat = makeToonMat(0x6c757d);

const hayMat = makeToonMat(0xd9ac4e);
const hayStrapMat = makeToonMat(0x7a5c3a);
const fenceWoodMat = makeToonMat(0x8c623d);
const yardGravelMat = registerSeasonalMat(0xb8a386, 0xe8eff6);
const dirtFieldMat = registerSeasonalMat(0x6e4f33, 0xe4ecf4);
const furrowMat = registerSeasonalMat(0x593e26, 0xd8e3ee);
const cornStalkMat = makeToonMat(0x5f8c42);
const cornCobMat = makeToonMat(0xe8c23c);

// Lokale offset (rechts=lx, richting weg/oprit=lz) roteren naar wereldcoördinaten.
// Belangrijk: de oprit vanuit water-lots.js loopt exact langs lx = 0 van lz = 0 naar lz = +34 (de weg)!
function localToWorld(lx, lz, yaw) {
  const s = Math.sin(yaw);
  const c = Math.cos(yaw);
  return { x: lx * c + lz * s, z: -lx * s + lz * c };
}

function createGrandBarn() {
  const g = new THREE.Group();
  const w = 12.2;
  const h = 6.2;
  const d = 10.4;

  const plinth = createOutlinedMesh(new THREE.BoxGeometry(w + 0.4, 0.5, d + 0.4), stoneFoundMat, 0.045, false);
  plinth.position.y = 0.08;
  g.add(plinth);

  const body = createOutlinedMesh(new THREE.BoxGeometry(w, h, d), barnRedMat, 0.065);
  body.position.y = h * 0.5 + 0.25;
  g.add(body);

  // Zij-aanbouw (werktuigenloods / lean-to) aan de linkerkant van de schuur
  const leanW = 3.6;
  const leanH = 3.5;
  const leanBody = createOutlinedMesh(new THREE.BoxGeometry(leanW, leanH, d - 1.2), barnRedMat, 0.05);
  leanBody.position.set(-(w * 0.5 + leanW * 0.5 - 0.1), leanH * 0.5 + 0.25, 0);
  g.add(leanBody);

  const leanRoof = createOutlinedMesh(new THREE.BoxGeometry(leanW + 0.6, 0.26, d - 0.6), barnRoofMat, 0.045, false);
  leanRoof.position.set(-(w * 0.5 + leanW * 0.5), leanH + 0.55, 0);
  leanRoof.rotation.z = 0.26;
  g.add(leanRoof);

  // Steil gambrel-dak met dakkapel/ventilatietorentje (cupola)
  const rShape = new THREE.Shape();
  rShape.moveTo(-(w * 0.5 + 0.5), 0);
  rShape.lineTo(-w * 0.31, 2.1);
  rShape.lineTo(0, 3.65);
  rShape.lineTo(w * 0.31, 2.1);
  rShape.lineTo(w * 0.5 + 0.5, 0);
  rShape.closePath();
  const rGeo = new THREE.ExtrudeGeometry(rShape, { depth: d + 0.9, bevelEnabled: false });
  rGeo.translate(0, 0, -(d + 0.9) * 0.5);
  const roof = createOutlinedMesh(rGeo, barnRoofMat, 0.07);
  roof.position.y = h + 0.25;
  g.add(roof);

  // Cupola op de nok van de schuur
  const cupola = createOutlinedMesh(new THREE.BoxGeometry(1.9, 1.5, 1.9), barnRedMat, 0.04, false);
  cupola.position.set(0, h + 4.2, 0);
  g.add(cupola);
  const cupolaCap = createOutlinedMesh(new THREE.ConeGeometry(1.55, 1.2, 4), barnRoofMat, 0.04, false);
  cupolaCap.position.set(0, h + 5.5, 0);
  cupolaCap.rotation.y = Math.PI * 0.25;
  g.add(cupolaCap);

  // Hooizolder-luik met hijsbalk bovenin
  const loftDoor = createOutlinedMesh(new THREE.BoxGeometry(1.7, 1.8, 0.16), barnDoorMat, 0.03, false);
  loftDoor.position.set(0, h + 1.35, d * 0.5 + 0.08);
  g.add(loftDoor);
  const loftTrim = createOutlinedMesh(new THREE.BoxGeometry(2.0, 2.05, 0.1), barnTrimMat, 0.02, false);
  loftTrim.position.set(0, h + 1.35, d * 0.5 + 0.03);
  g.add(loftTrim);
  const hoistBeam = createOutlinedMesh(new THREE.BoxGeometry(0.22, 0.22, 1.3), barnTrimMat, 0.02, false);
  hoistBeam.position.set(0, h + 2.6, d * 0.5 + 0.55);
  g.add(hoistBeam);

  // Grote dubbele schuurdeuren met witte kruisbalken (X-bracing)
  [-1.65, 1.65].forEach((dx) => {
    const door = createOutlinedMesh(new THREE.BoxGeometry(3.0, 3.8, 0.16), barnDoorMat, 0.03, false);
    door.position.set(dx, 2.15, d * 0.5 + 0.08);
    g.add(door);

    [0.52, -0.52].forEach((ang) => {
      const brace = new THREE.Mesh(new THREE.BoxGeometry(4.1, 0.16, 0.06), barnTrimMat);
      brace.position.set(dx, 2.15, d * 0.5 + 0.18);
      brace.rotation.z = ang;
      g.add(brace);
    });

    const frameTop = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.18, 0.18), barnTrimMat);
    frameTop.position.set(dx, 4.02, d * 0.5 + 0.12);
    g.add(frameTop);
  });

  // Witte hoekpilasters en zijramen
  [-w * 0.5, w * 0.5].forEach((cx) => {
    [-d * 0.5, d * 0.5].forEach((cz) => {
      const trim = createOutlinedMesh(new THREE.BoxGeometry(0.26, h, 0.26), barnTrimMat, 0.02, false);
      trim.position.set(cx, h * 0.5 + 0.25, cz);
      g.add(trim);
    });
  });

  [-2.8, 0, 2.8].forEach((wz) => {
    const winFrame = createOutlinedMesh(new THREE.BoxGeometry(0.14, 1.2, 1.1), barnTrimMat, 0.02, false);
    winFrame.position.set(w * 0.5 + 0.04, 3.4, wz);
    g.add(winFrame);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.0), farmWinMat);
    glass.rotation.y = Math.PI * 0.5;
    glass.position.set(w * 0.5 + 0.12, 3.4, wz);
    g.add(glass);
  });

  return g;
}

function createFarmHouse() {
  const g = new THREE.Group();
  const w = 7.8, h = 4.6, d = 6.4;

  const plinth = createOutlinedMesh(new THREE.BoxGeometry(w + 0.3, 0.48, d + 0.3), stoneFoundMat, 0.04, false);
  plinth.position.y = 0.1;
  g.add(plinth);

  const body = createOutlinedMesh(new THREE.BoxGeometry(w, h, d), farmHouseWallMat, 0.055);
  body.position.y = h * 0.5 + 0.24;
  g.add(body);

  const rShape = new THREE.Shape();
  rShape.moveTo(-(w * 0.5 + 0.4), 0);
  rShape.lineTo(0, 2.35);
  rShape.lineTo(w * 0.5 + 0.4, 0);
  rShape.closePath();
  const rGeo = new THREE.ExtrudeGeometry(rShape, { depth: d + 0.7, bevelEnabled: false });
  rGeo.translate(0, 0, -(d + 0.7) * 0.5);
  const roof = createOutlinedMesh(rGeo, farmHouseRoofMat, 0.058);
  roof.position.y = h + 0.2;
  g.add(roof);

  // Brede veranda aan de erfzijde
  const porch = createOutlinedMesh(new THREE.BoxGeometry(w * 0.94, 0.44, 2.1), stoneFoundMat, 0.038, false);
  porch.position.set(0, 0.14, d * 0.5 + 1.02);
  g.add(porch);

  const pRoof = createOutlinedMesh(new THREE.BoxGeometry(w * 0.98, 0.22, 2.35), farmHouseRoofMat, 0.04, false);
  pRoof.position.set(0, 2.75, d * 0.5 + 1.02);
  pRoof.rotation.x = 0.18;
  g.add(pRoof);

  [-w * 0.4, -w * 0.14, w * 0.14, w * 0.4].forEach((px) => {
    const post = createOutlinedMesh(new THREE.BoxGeometry(0.2, 2.35, 0.2), barnTrimMat, 0.025, false);
    post.position.set(px, 1.48, d * 0.5 + 1.9);
    g.add(post);
  });

  const door = createOutlinedMesh(new THREE.BoxGeometry(1.05, 2.1, 0.14), barnRedMat, 0.03, false);
  door.position.set(0, 1.42, d * 0.5 + 0.06);
  g.add(door);

  [-2.2, 2.2].forEach((wx) => {
    [1.7, 3.65].forEach((wy) => {
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 0.95), farmWinMat);
      glass.position.set(wx, wy, d * 0.5 + 0.08);
      g.add(glass);
    });
  });

  const chim = createOutlinedMesh(new THREE.BoxGeometry(0.95, h + 1.9, 0.95), barnRedMat, 0.045, false);
  chim.position.set(w * 0.46, (h + 1.9) * 0.5 + 0.15, -0.6);
  g.add(chim);

  return g;
}

function createGrainSilo(radius = 2.0, height = 8.8) {
  const g = new THREE.Group();

  const body = createOutlinedMesh(new THREE.CylinderGeometry(radius, radius, height, 14), siloBodyMat, 0.045, true);
  body.position.y = height * 0.5 + 0.1;
  g.add(body);

  const cap = createOutlinedMesh(new THREE.SphereGeometry(radius + 0.06, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), siloCapMat, 0.04, false);
  cap.position.y = height + 0.1;
  g.add(cap);

  [0.25, 0.5, 0.75, 0.98].forEach((t) => {
    const band = new THREE.Mesh(new THREE.TorusGeometry(radius + 0.04, 0.06, 6, 16), siloBandMat);
    band.rotation.x = Math.PI / 2;
    band.position.y = 0.1 + height * t;
    g.add(band);
  });

  // Buitenste inspectiekooi / stortkoker langs de silo
  const chute = createOutlinedMesh(new THREE.BoxGeometry(0.55, height * 0.92, 0.55), siloCapMat, 0.025, false);
  chute.position.set(0, height * 0.48, radius + 0.22);
  g.add(chute);

  return g;
}

function createWindmill() {
  const g = new THREE.Group();
  const h = 10.2;

  // 4 schuine stalen poten van de windmolenmast
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    const leg = createOutlinedMesh(new THREE.CylinderGeometry(0.08, 0.14, h + 0.3, 6), steelMat, 0.025, false);
    leg.position.set(sx * 0.65, h * 0.5, sz * 0.65);
    leg.rotation.z = sx * 0.11;
    leg.rotation.x = -sz * 0.11;
    g.add(leg);
  });

  [2.8, 5.6, 8.2].forEach((py, idx) => {
    const w = 2.1 - idx * 0.48;
    const brace = createOutlinedMesh(new THREE.BoxGeometry(w, 0.12, w), steelMat, 0.02, false);
    brace.position.y = py;
    g.add(brace);
  });

  // Schoepenrad en windvaan bovenop
  const hub = createOutlinedMesh(new THREE.CylinderGeometry(0.32, 0.32, 0.8, 8), barnRedMat, 0.025, false);
  hub.rotation.x = Math.PI * 0.5;
  hub.position.set(0, h + 0.3, 0.25);
  g.add(hub);

  const rim = createOutlinedMesh(new THREE.TorusGeometry(1.85, 0.08, 6, 16), steelMat, 0.025, false);
  rim.position.set(0, h + 0.3, 0.62);
  g.add(rim);

  for (let i = 0; i < 10; i++) {
    const ang = (i / 10) * Math.PI * 2;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.32, 1.65, 0.05), siloBodyMat);
    blade.position.set(Math.cos(ang) * 0.95, h + 0.3 + Math.sin(ang) * 0.95, 0.62);
    blade.rotation.z = ang + Math.PI * 0.5;
    blade.rotation.y = 0.32;
    g.add(blade);
  }

  const vane = createOutlinedMesh(new THREE.BoxGeometry(0.1, 0.95, 1.5), barnRedMat, 0.025, false);
  vane.position.set(0, h + 0.55, -0.95);
  g.add(vane);

  return g;
}

function createWoodenFenceSection(length = 4.2) {
  const g = new THREE.Group();
  [-length * 0.5, length * 0.5].forEach((px) => {
    const post = createOutlinedMesh(new THREE.BoxGeometry(0.22, 1.15, 0.22), fenceWoodMat, 0.025, false);
    post.position.set(px, 0.57, 0);
    g.add(post);
  });
  [0.42, 0.86].forEach((ry) => {
    const rail = createOutlinedMesh(new THREE.BoxGeometry(length, 0.12, 0.09), fenceWoodMat, 0.02, false);
    rail.position.y = ry;
    g.add(rail);
  });
  return g;
}

const hayBaleGeo = new THREE.CylinderGeometry(0.66, 0.66, 1.25, 10);
hayBaleGeo.rotateZ(Math.PI / 2);
function createHayBale() {
  const g = createOutlinedMesh(hayBaleGeo, hayMat, 0.03, true, false);
  [-0.42, 0, 0.42].forEach((sx) => {
    const strap = new THREE.Mesh(new THREE.TorusGeometry(0.675, 0.035, 5, 12), hayStrapMat);
    strap.rotation.y = Math.PI / 2;
    strap.position.x = sx;
    g.add(strap);
  });
  return g;
}

// Gebakken maisplant-template voor razendsnelle 60FPS plaatsing van honderden maisstengels
const cornStalkParts = [
  { geo: new THREE.CylinderGeometry(0.05, 0.075, 2.05, 5), matrix: new THREE.Matrix4().makeTranslation(0, 1.02, 0) }
];
[0.38, 1.08, 1.62].forEach((y, idx) => {
  const leafM = new THREE.Matrix4()
    .makeRotationY(idx * 2.1)
    .multiply(new THREE.Matrix4().makeTranslation(0.34, y, 0))
    .multiply(new THREE.Matrix4().makeRotationZ(-0.65));
  cornStalkParts.push({ geo: new THREE.BoxGeometry(0.64, 0.08, 0.17), matrix: leafM });
});
const bakedCornStalk = createMergedToonProp(cornStalkParts, cornStalkMat, 0.022, false);
const cornCobGeo = new THREE.CylinderGeometry(0.095, 0.075, 0.36, 6);

function createCornPlant() {
  const g = instantiateBakedProp(bakedCornStalk);
  const cob = new THREE.Mesh(cornCobGeo, cornCobMat);
  cob.position.set(0.14, 1.35, 0.05);
  cob.rotation.z = 0.3;
  g.add(cob);
  return g;
}

// Plaatst een omploegd akkerveld dat automatisch de terreinhoogte volgt en ver buiten de oprit blijft
function buildCornFieldPatch(baseX, baseY, baseZ, yaw, centerLX, centerLZ, cols, rows, spacing = 1.62) {
  const fieldWidth = cols * spacing;
  const fieldDepth = rows * spacing;
  const centerOff = localToWorld(centerLX, centerLZ, yaw);
  const patchCenterX = baseX + centerOff.x;
  const patchCenterZ = baseZ + centerOff.z;
  const patchY = Math.max(baseY - 0.15, getTerrainHeight(patchCenterX, patchCenterZ));

  // Donkere akkerplaat met lichte fundering zodat de akker nooit zweeft aan de randen
  const soilSlab = createOutlinedMesh(
    new THREE.BoxGeometry(fieldWidth + 2.6, 0.55, fieldDepth + 2.6),
    dirtFieldMat,
    0.03,
    false,
    true
  );
  soilSlab.position.set(patchCenterX, patchY - 0.22, patchCenterZ);
  soilSlab.rotation.y = yaw;
  scene.add(soilSlab);

  // Ploegvoren voor een echte akker-uitstraling
  const furrowGeo = new THREE.BoxGeometry(0.38, 0.06, fieldDepth + 1.4);
  for (let c = 0; c < cols; c++) {
    const relX = (c - (cols - 1) * 0.5) * spacing;
    const fOff = localToWorld(centerLX + relX, centerLZ, yaw);
    const furrow = new THREE.Mesh(furrowGeo, furrowMat);
    furrow.position.set(baseX + fOff.x, patchY + 0.06, baseZ + fOff.z);
    furrow.rotation.y = yaw;
    scene.add(furrow);
  }

  // Rijen maisplanten
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lx = centerLX + (c - (cols - 1) * 0.5) * spacing + (Math.random() - 0.5) * 0.14;
      const lz = centerLZ + (r - (rows - 1) * 0.5) * spacing + (Math.random() - 0.5) * 0.14;

      // Extra veiligheidsmarge: nooit binnen |lx| < 5.5m als lz > -2m (zodat de oprit 100% vrij blijft!)
      if (lz > -2.0 && Math.abs(lx) < 5.5) continue;

      const off = localToWorld(lx, lz, yaw);
      const wx = baseX + off.x;
      const wz = baseZ + off.z;
      const wy = Math.max(patchY + 0.04, getTerrainHeight(wx, wz));

      const plant = createCornPlant();
      plant.position.set(wx, wy, wz);
      plant.rotation.y = yaw + (Math.random() - 0.5) * 0.65;
      plant.scale.setScalar(0.88 + Math.random() * 0.34);
      scene.add(plant);
    }
  }
}

function buildFarm() {
  const farmLot = ruralLots.find((l) => l.type === 'farm');
  if (!farmLot) return;

  const { x: baseX, y: baseY, z: baseZ, yaw } = farmLot;

  // 1. Verhard grinterf aan het eind van de oprit (oprit komt binnen langs lx = 0 vanaf lz = +34 tot lz = 0)
  const yardOff = localToWorld(0, -2.5, yaw);
  const yardPad = createOutlinedMesh(new THREE.BoxGeometry(24.0, 0.42, 13.0), yardGravelMat, 0.035, false, true);
  yardPad.position.set(baseX + yardOff.x, baseY - 0.16, baseZ + yardOff.z);
  yardPad.rotation.y = yaw;
  scene.add(yardPad);

  // 2. Grote Amerikaanse hoofdschuur linksachter aan het erf (kijkt schuin/recht op het erf uit)
  const barnOff = localToWorld(-9.5, -8.8, yaw);
  const barn = createGrandBarn();
  barn.position.set(baseX + barnOff.x, baseY, baseZ + barnOff.z);
  barn.rotation.y = yaw;
  scene.add(barn);
  hardColliders.push({ x: baseX + barnOff.x, z: baseZ + barnOff.z, r: 6.4 });

  // 3. Twee gekoppelde hoge graansilo's naast de schuur
  const silo1Off = localToWorld(-1.2, -10.2, yaw);
  const silo1 = createGrainSilo(2.05, 9.2);
  silo1.position.set(baseX + silo1Off.x, baseY, baseZ + silo1Off.z);
  silo1.rotation.y = yaw;
  scene.add(silo1);
  hardColliders.push({ x: baseX + silo1Off.x, z: baseZ + silo1Off.z, r: 2.3 });

  const silo2Off = localToWorld(3.1, -10.8, yaw);
  const silo2 = createGrainSilo(1.75, 7.8);
  silo2.position.set(baseX + silo2Off.x, baseY, baseZ + silo2Off.z);
  silo2.rotation.y = yaw;
  scene.add(silo2);
  hardColliders.push({ x: baseX + silo2Off.x, z: baseZ + silo2Off.z, r: 2.0 });

  // 4. Statig wit boerenwoonhuis aan de rechterkant van het erf (gericht naar de oprit/erf)
  const houseOff = localToWorld(10.8, -4.2, yaw);
  const farmHouse = createFarmHouse();
  farmHouse.position.set(baseX + houseOff.x, baseY, baseZ + houseOff.z);
  farmHouse.rotation.y = yaw - Math.PI * 0.5;
  scene.add(farmHouse);
  hardColliders.push({ x: baseX + houseOff.x, z: baseZ + houseOff.z, r: 4.4 });

  // 5. Klassieke Amerikaanse windmolen bij het erf
  const millOff = localToWorld(6.8, -12.4, yaw);
  const windmill = createWindmill();
  windmill.position.set(baseX + millOff.x, baseY, baseZ + millOff.z);
  windmill.rotation.y = yaw + 0.35;
  scene.add(windmill);
  hardColliders.push({ x: baseX + millOff.x, z: baseZ + millOff.z, r: 1.5 });

  // 6. Sloopbare houten hekken langs weerszijden van de oprit (op lx = -5.2 en +5.2, dus ruim naast de oprit!)
  [8.5, 13.5, 18.5, 23.5].forEach((fz) => {
    [-5.2, 5.2].forEach((fx) => {
      const fOff = localToWorld(fx, fz, yaw);
      const wx = baseX + fOff.x;
      const wz = baseZ + fOff.z;
      const wy = getTerrainHeight(wx, wz);
      const fence = createWoodenFenceSection(4.4);
      fence.position.set(wx, wy, wz);
      fence.rotation.y = yaw + Math.PI * 0.5;
      scene.add(fence);
      registerDestructible(fence, wx, wy + 0.5, wz, 1.4, 'small', 12, 'Boerderijhek');
    });
  });

  // 7. Sloopbare hooibalen (inclusief gestapelde hooibalen op het erf en bij de velden)
  const haySpots = [
    [-14.5, -1.2, 0],
    [-13.0, -0.4, 0],
    [-13.8, -0.8, 1.18], // Bovenop gestapeld!
    [-7.6, 2.2, 0],
    [-6.1, 2.8, 0],
    [7.4, 2.5, 0],
    [8.9, 2.0, 0]
  ];
  haySpots.forEach(([lx, lz, extraY]) => {
    const off = localToWorld(lx, lz, yaw);
    const bale = createHayBale();
    const wx = baseX + off.x;
    const wz = baseZ + off.z;
    const wy = getTerrainHeight(wx, wz) + 0.64 + extraY;
    bale.position.set(wx, wy, wz);
    bale.rotation.y = yaw + Math.random() * Math.PI;
    scene.add(bale);
    registerDestructible(bale, wx, wy, wz, 0.8, 'small', 8, 'Hooibaal');
  });

  // 8. DRIE GROTE MAISVELDEN ROND DE BOERDERIJ (nul overlap met de oprit op lx = 0!)
  // - Linker maisveld naast de oprit en voor de schuur (lx: -26.5 .. -7.5, lz: +4 .. +25)
  buildCornFieldPatch(baseX, baseY, baseZ, yaw, -17.0, 14.5, 12, 13, 1.62);

  // - Rechter maisveld naast de oprit en voor het boerenhuis (lx: +7.5 .. +26.5, lz: +4 .. +25)
  buildCornFieldPatch(baseX, baseY, baseZ, yaw, 17.0, 14.5, 12, 13, 1.62);

  // - Groot achterste maisveld achter de schuur, silo's en windmolen (lx: -19 .. +19, lz: -28.5 .. -16.5)
  buildCornFieldPatch(baseX, baseY, baseZ, yaw, 0.0, -22.5, 22, 8, 1.68);
}
buildFarm();
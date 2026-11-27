import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

// =========================================================
// GEOPTIMALISEERDE RENDERER & SCENE
// =========================================================
export const scene = new THREE.Scene();
export const skyColors = {
  sunny: new THREE.Color(0xffcfa1),
  rain: new THREE.Color(0x9ab0c2),
  snow: new THREE.Color(0xdce8f2),
  xmas: new THREE.Color(0xc8dcf0),
  night: new THREE.Color(0x101829),
  nightWinter: new THREE.Color(0x162238)
};

scene.background = skyColors.sunny.clone();
scene.fog = new THREE.FogExp2(0xffcfa1, 0.0020);

export const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.2, 620);

// Performance optimalisatie: powerPreference high-performance & gecapte pixelRatio (1.5)
export const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap; // Veel sneller dan PCFSoftShadowMap, én strakker voor Toon-stijl!
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;
document.body.appendChild(renderer.domElement);

// =========================================================
// TOON SHADING, MERGED OUTLINES (VOOR 60FPS!) & HELPERS
// =========================================================
export const OUTLINE_HEX = 0x2b1810;

function createToonGradient() {
  const steps = new Uint8Array([84, 152, 216, 255]);
  const tex = new THREE.DataTexture(steps, steps.length, 1, THREE.RedFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
}

export const toonGradient = createToonGradient();

export function makeToonMat(colorHex, extra = {}) {
  return new THREE.MeshToonMaterial({
    color: colorHex,
    gradientMap: toonGradient,
    ...extra
  });
}

export const outlineMat = new THREE.MeshBasicMaterial({
  color: OUTLINE_HEX,
  side: THREE.BackSide
});

function buildInflatedOutlineGeo(geometry, thickness) {
  const outGeo = geometry.clone();
  const pos = outGeo.attributes.position;
  const norm = outGeo.attributes.normal;
  if (pos && norm) {
    for (let i = 0; i < pos.count; i++) {
      pos.setXYZ(
        i,
        pos.getX(i) + norm.getX(i) * thickness,
        pos.getY(i) + norm.getY(i) * thickness,
        pos.getZ(i) + norm.getZ(i) * thickness
      );
    }
  }
  return outGeo;
}

export function createOutlinedMesh(geometry, material, thickness = 0.05, castShadow = true, receiveShadow = false) {
  const group = new THREE.Group();
  const main = new THREE.Mesh(geometry, material);
  main.castShadow = castShadow;
  main.receiveShadow = receiveShadow;
  group.add(main);

  if (thickness > 0) {
    const outline = new THREE.Mesh(buildInflatedOutlineGeo(geometry, thickness), outlineMat);
    group.add(outline);
  }
  return group;
}

/**
 * PERFORMANCE BOOST: Voegt een array van sub-geometrieën samen tot 1 enkel BufferGeometry
 * én bakt alle outlines samen tot 1 enkele outline-mesh!
 */
export function createMergedToonProp(parts, material, outlineThickness = 0.048, castShadow = true) {
  const mainGeos = [];
  const outGeos = [];

  parts.forEach(({ geo, matrix }) => {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.applyMatrix4(matrix);
    g.computeVertexNormals();
    mainGeos.push(g);

    if (outlineThickness > 0) {
      outGeos.push(buildInflatedOutlineGeo(g, outlineThickness));
    }
  });

  const mergedMain = BufferGeometryUtils.mergeGeometries(mainGeos, false);
  const mergedOut = outlineThickness > 0 ? BufferGeometryUtils.mergeGeometries(outGeos, false) : null;

  return { mergedMain, mergedOut, material, castShadow };
}

export function instantiateBakedProp(baked) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(baked.mergedMain, baked.material);
  m.castShadow = baked.castShadow;
  g.add(m);
  if (baked.mergedOut) {
    g.add(new THREE.Mesh(baked.mergedOut, outlineMat));
  }
  return g;
}

export function setAlignedTransform(obj, x, y, z, yaw, pitch = 0) {
  obj.position.set(x, y, z);
  obj.rotation.order = 'YXZ';
  obj.rotation.set(pitch, yaw, 0);
}

export const christmasGroup = new THREE.Group();
christmasGroup.visible = false;
scene.add(christmasGroup);

export const seasonalSwaps = [];
export function registerSeasonalMat(autumnHex, winterHex, extra = {}) {
  const mat = makeToonMat(autumnHex, extra);
  seasonalSwaps.push({
    mat,
    autumnColor: new THREE.Color(autumnHex),
    winterColor: new THREE.Color(winterHex)
  });
  return mat;
}

export const deciduousFoliageObjects = [];
export const pineSnowCapObjects = [];

// =========================================================
// DAG & NACHT BELICHTING + STERRENHEMEL + MAAN
// =========================================================
export const hemiLight = new THREE.HemisphereLight(0xffe7bf, 0x8f5d3b, 1.14);
scene.add(hemiLight);

// Zon/Maan licht volgt de speler strak met een 1024px shadowmap (supersnel én scherp rond je auto!)
export const sunLight = new THREE.DirectionalLight(0xffb96e, 1.95);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 1024;
sunLight.shadow.mapSize.height = 1024;
sunLight.shadow.camera.near = 10;
sunLight.shadow.camera.far = 260;
const sBound = 92;
sunLight.shadow.camera.left = -sBound;
sunLight.shadow.camera.right = sBound;
sunLight.shadow.camera.top = sBound;
sunLight.shadow.camera.bottom = -sBound;
sunLight.shadow.bias = -0.0008;
scene.add(sunLight);
scene.add(sunLight.target);

export const sunDisc = new THREE.Mesh(
  new THREE.SphereGeometry(24, 20, 20),
  new THREE.MeshBasicMaterial({ color: 0xfff0c4, fog: false })
);
sunDisc.position.set(220, 92, -240);
scene.add(sunDisc);

// Sterrenhemel + Heldere Maan voor Nachtmodus!
export const nightSkyGroup = new THREE.Group();
nightSkyGroup.visible = false;
scene.add(nightSkyGroup);

export const moonDisc = new THREE.Mesh(
  new THREE.SphereGeometry(18, 20, 20),
  new THREE.MeshBasicMaterial({ color: 0xf4f8ff, fog: false })
);
moonDisc.position.set(-180, 115, -210);
nightSkyGroup.add(moonDisc);

const starCoords = new Float32Array(650 * 3);
for (let i = 0; i < 650; i++) {
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.random() * Math.PI * 0.44;
  const rad = 420;
  starCoords[i * 3] = Math.cos(theta) * Math.sin(phi) * rad;
  starCoords[i * 3 + 1] = Math.cos(phi) * rad + 25;
  starCoords[i * 3 + 2] = Math.sin(theta) * Math.sin(phi) * rad;
}
const starGeo = new THREE.BufferGeometry();
starGeo.setAttribute('position', new THREE.BufferAttribute(starCoords, 3));
export const starPoints = new THREE.Points(
  starGeo,
  new THREE.PointsMaterial({ color: 0xfff9e6, size: 2.2, fog: false })
);
nightSkyGroup.add(starPoints);

// Warme dorpsgloed in het stadje tijdens de nacht (1 enkel gedeeld PointLight i.p.v. 10 zware losse lampen -> 0 lag!)
export const townNightGlow = new THREE.PointLight(0xffb85c, 0, 85, 1.4);
townNightGlow.position.set(0, 8.5, 92);
scene.add(townNightGlow);

export const xmasTreeLight = new THREE.PointLight(0xffbe55, 0, 42);
xmasTreeLight.position.set(0, 6.5, 70);
scene.add(xmasTreeLight);

// Echte koplamp-bundel voor de auto van de speler in het donker!
export const playerHeadlight = new THREE.SpotLight(0xfff1c2, 0, 72, Math.PI * 0.24, 0.45, 1.1);
playerHeadlight.castShadow = false;
scene.add(playerHeadlight);
scene.add(playerHeadlight.target);

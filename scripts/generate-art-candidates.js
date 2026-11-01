/**
 * 3D Mascot Candidate Generator for MIRARI Art Evaluation
 * Generates three visually distinct high-quality 3D candidate models:
 * 
 * Candidate A: 忠實還原原始第三款星種精靈 (Faithful Star-seed Sprite with 3D Glass Flask)
 * Candidate B: 更簡約、更重視輪廓與比例的日系角色 (Minimalist Japanese Chibi Silhouette)
 * Candidate C: 更有原創辨識度的新方向 (Celestial Astrolabe & Prism Sprite)
 * 
 * Assets are saved independently to public/models/candidates/ without touching production public/models/mirari.glb.
 */

import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import fs from 'fs';
import path from 'path';

// Node polyfills
if (typeof window === 'undefined') global.window = {};
if (typeof document === 'undefined') {
  global.document = { createElement: () => ({ getContext: () => null }) };
}
globalThis.FileReader = class FileReader {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((buf) => {
      this.result = buf;
      if (this.onloadend) this.onloadend();
      if (this.onload) this.onload();
    });
  }
};

const CANDIDATES_DIR = path.resolve('public/models/candidates');
if (!fs.existsSync(CANDIDATES_DIR)) {
  fs.mkdirSync(CANDIDATES_DIR, { recursive: true });
}

function exportSceneToGLB(scene, filename) {
  const exporter = new GLTFExporter();
  const outputPath = path.join(CANDIDATES_DIR, filename);

  return new Promise((resolve, reject) => {
    exporter.parse(
      scene,
      (gltf) => {
        try {
          fs.writeFileSync(outputPath, Buffer.from(gltf));
          const size = fs.statSync(outputPath).size;
          console.log(`✓ Exported ${filename} (${size} bytes)`);
          resolve(outputPath);
        } catch (err) {
          reject(err);
        }
      },
      (err) => reject(err),
      { binary: true }
    );
  });
}

// ─────────────────────────────────────────────────────────────
// CANDIDATE A: 忠實還原原始第三款星種精靈 (Faithful Star-seed Sprite)
// ─────────────────────────────────────────────────────────────
function buildCandidateA() {
  const scene = new THREE.Scene();
  scene.name = 'CandidateA_StarseedSprite';

  // Materials
  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xfffcf7,
    roughness: 0.36,
    metalness: 0.04,
  });

  const blushMat = new THREE.MeshStandardMaterial({
    color: 0xffadad,
    roughness: 0.5,
    transparent: true,
    opacity: 0.8,
  });

  const sproutMat1 = new THREE.MeshStandardMaterial({
    color: 0x9ec768,
    roughness: 0.32,
    metalness: 0.06,
  });

  const sproutMat2 = new THREE.MeshStandardMaterial({
    color: 0xb5d878,
    roughness: 0.35,
    metalness: 0.05,
  });

  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xf5ca68,
    roughness: 0.22,
    metalness: 0.75,
  });

  const capeMat = new THREE.MeshStandardMaterial({
    color: 0x1b234d,
    roughness: 0.40,
    metalness: 0.1,
    side: THREE.DoubleSide,
  });

  const violetHemMat = new THREE.MeshStandardMaterial({
    color: 0x5a4d8c,
    roughness: 0.44,
    metalness: 0.08,
  });

  const gemMat = new THREE.MeshStandardMaterial({
    color: 0x8ed0ff,
    emissive: 0x5ab2f6,
    emissiveIntensity: 0.85,
    roughness: 0.12,
    metalness: 0.15,
  });

  const eyeBaseMat = new THREE.MeshStandardMaterial({
    color: 0x16102a,
    roughness: 0.1,
  });

  const eyeIrisMat = new THREE.MeshStandardMaterial({
    color: 0x7642a8,
    roughness: 0.12,
  });

  const eyeLowerMat = new THREE.MeshStandardMaterial({
    color: 0xba8bd4,
    roughness: 0.15,
  });

  const catchlightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const mouthMat = new THREE.MeshStandardMaterial({ color: 0xaa3344, roughness: 0.35 });

  // 3D Glass Flask Physical Material
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xe8f0fe,
    roughness: 0.12,
    metalness: 0.1,
    transparent: true,
    opacity: 0.28,
    side: THREE.DoubleSide,
  });

  const root = new THREE.Group();
  scene.add(root);

  // 1. Genuine 3D Borosilicate Laboratory Round-Bottom Flask
  const flaskGroup = new THREE.Group();
  root.add(flaskGroup);

  // Flask Spherical Lower Body
  const flaskBulbGeo = new THREE.SphereGeometry(1.22, 36, 28);
  const flaskBulbMesh = new THREE.Mesh(flaskBulbGeo, glassMat);
  flaskBulbMesh.position.set(0, 0.08, 0);
  flaskGroup.add(flaskBulbMesh);

  // Flask Cylindrical Neck
  const flaskNeckGeo = new THREE.CylinderGeometry(0.42, 0.44, 0.65, 32, 1, true);
  const flaskNeckMesh = new THREE.Mesh(flaskNeckGeo, glassMat);
  flaskNeckMesh.position.set(0, 1.32, 0);
  flaskGroup.add(flaskNeckMesh);

  // Flask Flared Lip Rim Ring
  const lipGeo = new THREE.TorusGeometry(0.44, 0.04, 16, 32);
  const lipMesh = new THREE.Mesh(lipGeo, glassMat);
  lipMesh.position.set(0, 1.64, 0);
  lipMesh.rotation.x = Math.PI / 2;
  flaskGroup.add(lipMesh);

  // 2. Character Body (Chubby Head & Pear Belly)
  const bodyGroup = new THREE.Group();
  bodyGroup.position.set(0, -0.05, 0);
  root.add(bodyGroup);

  // Head with Chubby Cheeks
  const headGeo = new THREE.SphereGeometry(0.58, 32, 28);
  headGeo.scale(1.18, 0.94, 0.96);
  const headMesh = new THREE.Mesh(headGeo, skinMat);
  headMesh.position.set(0, 0.38, 0);
  bodyGroup.add(headMesh);

  // Pear Belly
  const bellyGeo = new THREE.SphereGeometry(0.62, 32, 28);
  bellyGeo.scale(1.04, 1.15, 0.98);
  const bellyMesh = new THREE.Mesh(bellyGeo, skinMat);
  bellyMesh.position.set(0, -0.22, -0.04);
  bodyGroup.add(bellyMesh);

  // Eyes
  function createEye(isLeft) {
    const eyeAnchor = new THREE.Group();
    eyeAnchor.position.set(isLeft ? -0.26 : 0.26, 0.38, 0.52);
    eyeAnchor.rotation.set(-0.05, isLeft ? -0.34 : 0.34, isLeft ? 0.08 : -0.08);

    const baseGeo = new THREE.SphereGeometry(0.13, 24, 20);
    baseGeo.scale(0.92, 1.38, 0.26);
    eyeAnchor.add(new THREE.Mesh(baseGeo, eyeBaseMat));

    const irisGeo = new THREE.SphereGeometry(0.11, 20, 16);
    irisGeo.scale(0.88, 1.22, 0.24);
    const iris = new THREE.Mesh(irisGeo, eyeIrisMat);
    iris.position.set(0, -0.02, 0.015);
    eyeAnchor.add(iris);

    const lowerGeo = new THREE.SphereGeometry(0.08, 16, 12);
    lowerGeo.scale(0.82, 0.68, 0.22);
    const lower = new THREE.Mesh(lowerGeo, eyeLowerMat);
    lower.position.set(0, -0.06, 0.026);
    eyeAnchor.add(lower);

    const c1Geo = new THREE.SphereGeometry(0.04, 16, 12);
    c1Geo.scale(0.85, 1.2, 0.18);
    const c1 = new THREE.Mesh(c1Geo, catchlightMat);
    c1.position.set(isLeft ? 0.026 : -0.026, 0.058, 0.04);
    eyeAnchor.add(c1);

    const c2Geo = new THREE.SphereGeometry(0.022, 12, 10);
    const c2 = new THREE.Mesh(c2Geo, catchlightMat);
    c2.position.set(isLeft ? -0.034 : 0.034, -0.05, 0.038);
    eyeAnchor.add(c2);

    return eyeAnchor;
  }
  bodyGroup.add(createEye(true));
  bodyGroup.add(createEye(false));

  // Blush
  const blushGeo = new THREE.SphereGeometry(0.095, 20, 16);
  blushGeo.scale(1.2, 0.65, 0.12);
  const leftBlush = new THREE.Mesh(blushGeo, blushMat);
  leftBlush.position.set(-0.39, 0.26, 0.46);
  leftBlush.rotation.set(0.18, -0.55, -0.15);
  bodyGroup.add(leftBlush);
  const rightBlush = new THREE.Mesh(blushGeo, blushMat);
  rightBlush.position.set(0.39, 0.26, 0.46);
  rightBlush.rotation.set(0.18, 0.55, 0.15);
  bodyGroup.add(rightBlush);

  // Sweet Smile Mouth
  const mouthCurve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(-0.06, 0.018, 0),
    new THREE.Vector3(0, -0.028, 0.01),
    new THREE.Vector3(0.06, 0.018, 0)
  );
  const mouthMesh = new THREE.Mesh(new THREE.TubeGeometry(mouthCurve, 16, 0.011, 8, false), mouthMat);
  mouthMesh.position.set(0, 0.25, 0.55);
  mouthMesh.rotation.x = 0.2;
  bodyGroup.add(mouthMesh);

  // Sprout with 5-Petal Star Collar
  const sproutGroup = new THREE.Group();
  sproutGroup.position.set(0, 0.90, 0);
  bodyGroup.add(sproutGroup);

  for (let p = 0; p < 5; p++) {
    const angle = (p / 5) * Math.PI * 2;
    const petalGeo = new THREE.ConeGeometry(0.045, 0.12, 8);
    petalGeo.scale(1.2, 0.5, 0.7);
    const petal = new THREE.Mesh(petalGeo, goldMat);
    petal.position.set(Math.cos(angle) * 0.07, -0.01, Math.sin(angle) * 0.07);
    petal.rotation.set(0, -angle, Math.PI / 2.3);
    sproutGroup.add(petal);
  }

  const leaf1Geo = new THREE.SphereGeometry(0.22, 20, 16);
  leaf1Geo.scale(0.85, 1.45, 0.18);
  const leaf1 = new THREE.Mesh(leaf1Geo, sproutMat1);
  leaf1.position.set(0.16, 0.32, 0.04);
  leaf1.rotation.set(-0.25, 0.2, -0.45);
  sproutGroup.add(leaf1);

  const leaf2Geo = new THREE.SphereGeometry(0.15, 16, 12);
  leaf2Geo.scale(0.8, 1.35, 0.18);
  const leaf2 = new THREE.Mesh(leaf2Geo, sproutMat2);
  leaf2.position.set(-0.13, 0.24, 0.02);
  leaf2.rotation.set(-0.2, -0.3, 0.58);
  sproutGroup.add(leaf2);

  // Droop Wing Ears
  function createWingEar(isLeft) {
    const ear = new THREE.Group();
    ear.position.set(isLeft ? -0.52 : 0.52, 0.40, 0.04);
    ear.rotation.set(0, isLeft ? -0.25 : 0.25, isLeft ? 0.38 : -0.38);

    const f1 = new THREE.Mesh(new THREE.SphereGeometry(0.24, 20, 16).scale(0.65, 1.45, 0.22), skinMat);
    f1.position.set(isLeft ? -0.13 : 0.13, -0.16, 0);
    f1.rotation.z = isLeft ? 0.45 : -0.45;
    ear.add(f1);

    const f2 = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 12).scale(0.6, 1.3, 0.2), violetHemMat);
    f2.position.set(isLeft ? -0.24 : 0.24, -0.30, 0.02);
    f2.rotation.z = isLeft ? 0.55 : -0.55;
    ear.add(f2);

    return ear;
  }
  bodyGroup.add(createWingEar(true));
  bodyGroup.add(createWingEar(false));

  // Cape & Brooch
  const collarGeo = new THREE.TorusGeometry(0.48, 0.02, 12, 32);
  collarGeo.scale(1.10, 0.96, 0.94);
  const collar = new THREE.Mesh(collarGeo, goldMat);
  collar.position.set(0, 0.09, 0.04);
  collar.rotation.x = Math.PI / 2.12;
  bodyGroup.add(collar);

  const backCape = new THREE.Mesh(new THREE.SphereGeometry(0.44, 24, 20).scale(1.35, 1.6, 0.2), capeMat);
  backCape.position.set(0, -0.25, -0.52);
  backCape.rotation.set(0.28, 0, 0);
  bodyGroup.add(backCape);

  // Brooch
  const brooch = new THREE.Group();
  brooch.position.set(0, 0.06, 0.54);
  for (let b = 0; b < 4; b++) {
    const angle = (b / 4) * Math.PI * 2;
    const starCone = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.10, 8), goldMat);
    starCone.position.set(Math.cos(angle) * 0.068, Math.sin(angle) * 0.068, -0.01);
    starCone.rotation.z = angle - Math.PI / 2;
    brooch.add(starCone);
  }
  brooch.add(new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.016, 12, 24), goldMat));
  const crystal = new THREE.Mesh(new THREE.SphereGeometry(0.065, 24, 20), gemMat);
  crystal.position.set(0, 0, 0.02);
  brooch.add(crystal);
  bodyGroup.add(brooch);

  // Paws
  const pawGeo = new THREE.SphereGeometry(0.10, 16, 14).scale(0.85, 0.95, 1.35);
  const lp = new THREE.Mesh(pawGeo, skinMat);
  lp.position.set(-0.19, -0.11, 0.53);
  lp.rotation.set(0.48, 0.32, -0.22);
  bodyGroup.add(lp);
  const rp = new THREE.Mesh(pawGeo, skinMat);
  rp.position.set(0.19, -0.11, 0.53);
  rp.rotation.set(0.48, -0.32, 0.22);
  bodyGroup.add(rp);

  return scene;
}

// ─────────────────────────────────────────────────────────────
// CANDIDATE B: 更簡約、重視輪廓與黃金比例的日系角色 (Minimalist Japanese Chibi)
// ─────────────────────────────────────────────────────────────
function buildCandidateB() {
  const scene = new THREE.Scene();
  scene.name = 'CandidateB_MinimalistJapanese';

  // Materials: Ultra-clean smooth matte porcelain aesthetic
  const porcelainSkin = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.28,
    metalness: 0.02,
  });

  const deepNavyMat = new THREE.MeshStandardMaterial({
    color: 0x141b3d,
    roughness: 0.35,
    metalness: 0.08,
    side: THREE.DoubleSide,
  });

  const cleanGoldMat = new THREE.MeshStandardMaterial({
    color: 0xf6c855,
    roughness: 0.18,
    metalness: 0.85,
  });

  const leafMat = new THREE.MeshStandardMaterial({
    color: 0x8ec954,
    roughness: 0.25,
    metalness: 0.05,
  });

  const eyeGlossMat = new THREE.MeshStandardMaterial({
    color: 0x120d24,
    roughness: 0.05,
    metalness: 0.1,
  });

  const starlightCatchlight = new THREE.MeshBasicMaterial({ color: 0xffffff });

  const blushPink = new THREE.MeshStandardMaterial({
    color: 0xff9ebb,
    roughness: 0.45,
    transparent: true,
    opacity: 0.75,
  });

  // Minimalist Pure Crystal Glass Capsule
  const crystalDomeMat = new THREE.MeshStandardMaterial({
    color: 0xf0f5ff,
    roughness: 0.08,
    metalness: 0.12,
    transparent: true,
    opacity: 0.24,
    side: THREE.DoubleSide,
  });

  const root = new THREE.Group();
  scene.add(root);

  // 1. Sleek Minimalist Scientific Observation Flask / Sphere
  const sphereGeo = new THREE.SphereGeometry(1.18, 36, 28);
  const capsule = new THREE.Mesh(sphereGeo, crystalDomeMat);
  root.add(capsule);

  // Minimalist Top Glass Aperture Collar
  const collarRing = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.035, 16, 32), crystalDomeMat);
  collarRing.position.set(0, 1.16, 0);
  collarRing.rotation.x = Math.PI / 2;
  root.add(collarRing);

  // 2. Pure Aerodynamic Teardrop Seedling Body
  const charGroup = new THREE.Group();
  charGroup.position.set(0, -0.08, 0);
  root.add(charGroup);

  // Seamless Japanese Chibi Head & Torso Lathe Curve
  const points = [];
  const segments = 32;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const y = (t - 0.45) * 1.75;
    let r = 0;
    if (t < 0.1) {
      r = Math.sin((t / 0.1) * (Math.PI / 2)) * 0.58;
    } else if (t < 0.45) {
      const p = (t - 0.1) / 0.35;
      r = 0.58 + Math.sin(p * Math.PI) * 0.14;
    } else if (t < 0.85) {
      const p = (t - 0.45) / 0.40;
      r = 0.54 + Math.sin(p * Math.PI) * 0.18; // Chubby cute cheek silhouette
    } else {
      const p = (t - 0.85) / 0.15;
      r = Math.cos(p * (Math.PI / 2)) * 0.60;
    }
    points.push(new THREE.Vector2(Math.max(0.001, r), y));
  }
  const bodyMesh = new THREE.Mesh(new THREE.LatheGeometry(points, 40), porcelainSkin);
  charGroup.add(bodyMesh);

  // Distinct Japanese Anime Graphic Eyes (Clean, striking vertical ellipses)
  function createMinimalEye(isLeft) {
    const eyeAnchor = new THREE.Group();
    eyeAnchor.position.set(isLeft ? -0.24 : 0.24, 0.32, 0.54);
    eyeAnchor.rotation.set(-0.04, isLeft ? -0.32 : 0.32, isLeft ? 0.06 : -0.06);

    // Deep Glossy Pupil
    const eyeGeo = new THREE.SphereGeometry(0.12, 24, 20).scale(0.85, 1.4, 0.22);
    eyeAnchor.add(new THREE.Mesh(eyeGeo, eyeGlossMat));

    // Crisp Starlight Catchlight (Upper-Inner)
    const glint = new THREE.Mesh(new THREE.SphereGeometry(0.042, 16, 12).scale(0.9, 1.25, 0.2), starlightCatchlight);
    glint.position.set(isLeft ? 0.024 : -0.024, 0.06, 0.035);
    eyeAnchor.add(glint);

    // Crisp Secondary Catchlight (Lower-Outer)
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.02, 12, 10), starlightCatchlight);
    dot.position.set(isLeft ? -0.03 : 0.03, -0.05, 0.032);
    eyeAnchor.add(dot);

    return eyeAnchor;
  }
  charGroup.add(createMinimalEye(true));
  charGroup.add(createMinimalEye(false));

  // Minimalist Soft Peach Blush
  const blushGeo = new THREE.SphereGeometry(0.08, 16, 12).scale(1.2, 0.6, 0.1);
  const lb = new THREE.Mesh(blushGeo, blushPink);
  lb.position.set(-0.35, 0.20, 0.48);
  lb.rotation.set(0.15, -0.5, 0);
  charGroup.add(lb);
  const rb = new THREE.Mesh(blushGeo, blushPink);
  rb.position.set(0.35, 0.20, 0.48);
  rb.rotation.set(0.15, 0.5, 0);
  charGroup.add(rb);

  // Minimalist Japanese Seedling Twin Leaves (Refined single-stem bifurcation)
  const sprout = new THREE.Group();
  sprout.position.set(0, 0.85, 0);
  charGroup.add(sprout);

  const leafMain = new THREE.Mesh(new THREE.SphereGeometry(0.20, 20, 16).scale(0.85, 1.45, 0.15), leafMat);
  leafMain.position.set(0.14, 0.28, 0.02);
  leafMain.rotation.set(-0.2, 0.15, -0.42);
  sprout.add(leafMain);

  const leafSmall = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12).scale(0.8, 1.35, 0.15), leafMat);
  leafSmall.position.set(-0.11, 0.20, 0.01);
  leafSmall.rotation.set(-0.18, -0.25, 0.52);
  sprout.add(leafSmall);

  // Minimalist Streamlined Wing-Ears
  function createMinimalWing(isLeft) {
    const wing = new THREE.Mesh(
      new THREE.SphereGeometry(0.26, 20, 16).scale(0.55, 1.5, 0.18),
      porcelainSkin
    );
    wing.position.set(isLeft ? -0.48 : 0.48, 0.32, 0);
    wing.rotation.set(-0.1, isLeft ? -0.3 : 0.3, isLeft ? 0.42 : -0.42);
    return wing;
  }
  charGroup.add(createMinimalWing(true));
  charGroup.add(createMinimalWing(false));

  // Sleek Aerodynamic Indigo Cloak with Pure Geometric Gold Star Pin
  const cloak = new THREE.Mesh(
    new THREE.SphereGeometry(0.46, 24, 20).scale(1.28, 1.55, 0.18),
    deepNavyMat
  );
  cloak.position.set(0, -0.18, -0.42);
  cloak.rotation.set(0.25, 0, 0);
  charGroup.add(cloak);

  // Pure Minimal Gold Star Pin at Chest
  const pin = new THREE.Mesh(new THREE.SphereGeometry(0.065, 20, 16).scale(1, 1, 0.3), cleanGoldMat);
  pin.position.set(0, 0.04, 0.58);
  charGroup.add(pin);

  // Minimalist Paws
  const mpawGeo = new THREE.SphereGeometry(0.09, 16, 12).scale(0.85, 0.9, 1.2);
  const mlp = new THREE.Mesh(mpawGeo, porcelainSkin);
  mlp.position.set(-0.18, -0.12, 0.54);
  mlp.rotation.set(0.45, 0.3, -0.2);
  charGroup.add(mlp);
  const mrp = new THREE.Mesh(mpawGeo, porcelainSkin);
  mrp.position.set(0.18, -0.12, 0.54);
  mrp.rotation.set(0.45, -0.3, 0.2);
  charGroup.add(mrp);

  return scene;
}

// ─────────────────────────────────────────────────────────────
// CANDIDATE C: 原創天體儀／稜鏡探索精靈 (Celestial Astrolabe & Prism Sprite)
// ─────────────────────────────────────────────────────────────
function buildCandidateC() {
  const scene = new THREE.Scene();
  scene.name = 'CandidateC_CelestialAstrolabe';

  // Materials: Scholarly instruments & glowing starlight core
  const celestialPearlSkin = new THREE.MeshStandardMaterial({
    color: 0xf5f8ff,
    roughness: 0.25,
    metalness: 0.12,
  });

  const opticPrismMat = new THREE.MeshStandardMaterial({
    color: 0xd6e8ff,
    roughness: 0.08,
    metalness: 0.2,
    transparent: true,
    opacity: 0.85,
  });

  const astrolabeBrassMat = new THREE.MeshStandardMaterial({
    color: 0xdeb852,
    roughness: 0.24,
    metalness: 0.88,
  });

  const midnightCapeMat = new THREE.MeshStandardMaterial({
    color: 0x111638,
    roughness: 0.38,
    metalness: 0.1,
    side: THREE.DoubleSide,
  });

  const glowingCoreMat = new THREE.MeshStandardMaterial({
    color: 0x93c5fd,
    emissive: 0x60a5fa,
    emissiveIntensity: 0.9,
    roughness: 0.15,
  });

  const root = new THREE.Group();
  scene.add(root);

  // 1. Concentric Gyroscopic Astrolabe Rings (3D Scientific Instrument)
  const astrolabeGroup = new THREE.Group();
  root.add(astrolabeGroup);

  // Outer Celestial Equator Ring
  const ring1 = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.024, 16, 64), astrolabeBrassMat);
  ring1.rotation.set(0.4, 0.3, 0.1);
  astrolabeGroup.add(ring1);

  // Mid Meridian Ring
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(1.18, 0.02, 16, 64), astrolabeBrassMat);
  ring2.rotation.set(-0.5, 0.6, 0.3);
  astrolabeGroup.add(ring2);

  // Graduation Ticks on outer ring
  for (let t = 0; t < 12; t++) {
    const angle = (t / 12) * Math.PI * 2;
    const tick = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.05, 0.015), astrolabeBrassMat);
    tick.position.set(Math.cos(angle) * 1.25, Math.sin(angle) * 1.25, 0);
    tick.rotation.z = angle;
    ring1.add(tick);
  }

  // 2. Central Celestial Sprite
  const spriteGroup = new THREE.Group();
  spriteGroup.position.set(0, -0.06, 0);
  root.add(spriteGroup);

  // Chubby Spherical Head
  const headGeo = new THREE.SphereGeometry(0.56, 32, 28);
  headGeo.scale(1.15, 0.96, 0.98);
  const head = new THREE.Mesh(headGeo, celestialPearlSkin);
  head.position.set(0, 0.36, 0);
  spriteGroup.add(head);

  // Pear Body
  const bodyGeo = new THREE.SphereGeometry(0.60, 32, 28);
  bodyGeo.scale(1.02, 1.12, 0.96);
  const body = new THREE.Mesh(bodyGeo, celestialPearlSkin);
  body.position.set(0, -0.22, -0.02);
  spriteGroup.add(body);

  // 3. Optic Prism Sprout on Crown (Replaces plant with optical dispersion crystal sprout)
  const prismSprout = new THREE.Group();
  prismSprout.position.set(0, 0.92, 0);
  spriteGroup.add(prismSprout);

  // Triangular Optical Prism Leaf 1
  const prism1 = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.45, 3), opticPrismMat);
  prism1.position.set(0.12, 0.22, 0.02);
  prism1.rotation.set(-0.2, 0.3, -0.38);
  prismSprout.add(prism1);

  // Secondary Prism Crystal Leaf 2
  const prism2 = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.36, 3), opticPrismMat);
  prism2.position.set(-0.10, 0.16, 0.01);
  prism2.rotation.set(-0.15, -0.4, 0.48);
  prismSprout.add(prism2);

  // Brass Crown Setting Base
  const setting = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.06, 6), astrolabeBrassMat);
  setting.position.set(0, 0.02, 0);
  prismSprout.add(setting);

  // 4. Starlight Anime Eyes
  function createStarlightEye(isLeft) {
    const eyeAnchor = new THREE.Group();
    eyeAnchor.position.set(isLeft ? -0.25 : 0.25, 0.36, 0.52);
    eyeAnchor.rotation.set(-0.04, isLeft ? -0.32 : 0.32, isLeft ? 0.06 : -0.06);

    const base = new THREE.Mesh(
      new THREE.SphereGeometry(0.125, 24, 20).scale(0.88, 1.35, 0.24),
      new THREE.MeshStandardMaterial({ color: 0x111025, roughness: 0.1 })
    );
    eyeAnchor.add(base);

    const iris = new THREE.Mesh(
      new THREE.SphereGeometry(0.105, 20, 16).scale(0.85, 1.18, 0.22),
      new THREE.MeshStandardMaterial({ color: 0x5b3fb0, roughness: 0.12 })
    );
    iris.position.set(0, -0.015, 0.015);
    eyeAnchor.add(iris);

    // Diamond catchlight
    const c1 = new THREE.Mesh(
      new THREE.SphereGeometry(0.04, 16, 12).scale(0.85, 1.2, 0.18),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    c1.position.set(isLeft ? 0.025 : -0.025, 0.055, 0.04);
    eyeAnchor.add(c1);

    return eyeAnchor;
  }
  spriteGroup.add(createStarlightEye(true));
  spriteGroup.add(createStarlightEye(false));

  // 5. Feather Ears with Astronomical Glyphs
  function createAstrolabeEar(isLeft) {
    const ear = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 20, 16).scale(0.6, 1.45, 0.2),
      celestialPearlSkin
    );
    ear.position.set(isLeft ? -0.52 : 0.52, 0.38, 0.02);
    ear.rotation.set(0, isLeft ? -0.25 : 0.25, isLeft ? 0.4 : -0.4);
    return ear;
  }
  spriteGroup.add(createAstrolabeEar(true));
  spriteGroup.add(createAstrolabeEar(false));

  // 6. Astrolabe Chest Compass Brooch
  const compassGroup = new THREE.Group();
  compassGroup.position.set(0, 0.06, 0.54);
  spriteGroup.add(compassGroup);

  const compassRing = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.016, 12, 24), astrolabeBrassMat);
  compassGroup.add(compassRing);

  const coreOrb = new THREE.Mesh(new THREE.SphereGeometry(0.065, 24, 20), glowingCoreMat);
  coreOrb.position.set(0, 0, 0.01);
  compassGroup.add(coreOrb);

  // 7. Midnight Mantle
  const mantle = new THREE.Mesh(
    new THREE.SphereGeometry(0.44, 24, 20).scale(1.32, 1.55, 0.2),
    midnightCapeMat
  );
  mantle.position.set(0, -0.22, -0.48);
  mantle.rotation.set(0.26, 0, 0);
  spriteGroup.add(mantle);

  return scene;
}

async function run() {
  console.log('Generating 3D Mascot Candidate Models...');
  await exportSceneToGLB(buildCandidateA(), 'candidate-a.glb');
  await exportSceneToGLB(buildCandidateB(), 'candidate-b.glb');
  await exportSceneToGLB(buildCandidateC(), 'candidate-c.glb');
  console.log('All 3 candidate GLB assets created successfully in public/models/candidates/');
}

run().catch((err) => {
  console.error('Candidate generation failed:', err);
  process.exit(1);
});

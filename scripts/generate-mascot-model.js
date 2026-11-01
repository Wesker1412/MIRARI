/**
 * Procedural 3D Model Generator for MIRARI Mascot: Star-seed Sprite ("星種精靈")
 * Based strictly on concept art: media_1793553265342_8af20d6c.jpg
 * 
 * Artistic Features:
 * 1. Soft milky-white chibi pear-shaped body: distinct head with chubby cheeks + chubby belly.
 * 2. Twin-leaf tender green sprout with golden 5-petal star-flower collar on crown.
 * 3. Drooping celestial wing-shaped ears with dual-tone midnight-to-indigo gradient.
 * 4. Flowing midnight-navy starry cape with golden embroidered border, constellation stars & lines.
 * 5. Center chest brooch with gold 4-point star bezel and glowing celestial crystal orb.
 * 6. Large expressive cosmic anime eyes with violet/amethyst iris and dual starlight highlights.
 * 7. Chubby stubby front paws and tiny seated feet.
 */

import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import fs from 'fs';
import path from 'path';

// Polyfills for Node.js environment
if (typeof window === 'undefined') {
  global.window = {};
}
if (typeof document === 'undefined') {
  global.document = {
    createElement: () => ({
      getContext: () => null,
    }),
  };
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

async function generateStarseedModel() {
  console.log('Generating "星種精靈" 3D Mascot Model from concept art...');

  const scene = new THREE.Scene();
  scene.name = 'MirariStarseedMascotScene';

  // ─── Materials ────────────────────────────────────────────────
  // 1. Soft Milky-White Velvet Skin (Warm pearl white #FFFDF8)
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0xfffdf7,
    roughness: 0.38,
    metalness: 0.04,
    name: 'BodyMat',
  });

  // 2. Rosy Peach Blush for Cheeks
  const blushMaterial = new THREE.MeshStandardMaterial({
    color: 0xffb3b3,
    roughness: 0.5,
    metalness: 0.02,
    transparent: true,
    opacity: 0.85,
    name: 'BlushMat',
  });

  // 3. Sprout Tender Green (Fresh spring sprout #9cc265)
  const sproutMaterial = new THREE.MeshStandardMaterial({
    color: 0x9ec768,
    roughness: 0.35,
    metalness: 0.05,
    name: 'SproutMat',
  });

  // 4. Sprout Companion Leaf (Soft yellow-green #b8d977)
  const sproutLeaf2Material = new THREE.MeshStandardMaterial({
    color: 0xb5d878,
    roughness: 0.38,
    metalness: 0.04,
    name: 'SproutLeaf2Mat',
  });

  // 5. Star Flower Collar & Brooch Accents (Warm scientific gold #f5ca68)
  const goldMaterial = new THREE.MeshStandardMaterial({
    color: 0xf5ca68,
    roughness: 0.25,
    metalness: 0.72,
    name: 'GoldAccentMat',
  });

  // 6. Midnight Celestial Starry Cape (Deep royal indigo-navy #1a224a)
  const capeMaterial = new THREE.MeshStandardMaterial({
    color: 0x1d2654,
    roughness: 0.42,
    metalness: 0.1,
    side: THREE.DoubleSide,
    name: 'CapeMat',
  });

  // 7. Cape Hem & Ear Wing Feathers (Amethyst violet #5a4b8c)
  const violetWingMaterial = new THREE.MeshStandardMaterial({
    color: 0x544782,
    roughness: 0.44,
    metalness: 0.08,
    name: 'VioletWingMat',
  });

  // 8. Glowing Brooch Celestial Crystal Gem
  const gemMaterial = new THREE.MeshStandardMaterial({
    color: 0x8ed0ff,
    emissive: 0x64b5f6,
    emissiveIntensity: 0.85,
    roughness: 0.12,
    metalness: 0.15,
    name: 'GemCrystalMat',
  });

  // 9. Eye Materials (Layered Cosmic Violet Anime Aesthetic)
  const eyeBaseMaterial = new THREE.MeshStandardMaterial({
    color: 0x18112e, // Deep midnight purple-black
    roughness: 0.1,
    metalness: 0.1,
    name: 'EyeBaseMat',
  });

  const eyeIrisMaterial = new THREE.MeshStandardMaterial({
    color: 0x7642a8, // Vibrant amethyst iris
    roughness: 0.12,
    metalness: 0.05,
    name: 'EyeIrisMat',
  });

  const eyeLowerMaterial = new THREE.MeshStandardMaterial({
    color: 0xba8bd4, // Soft radiant lavender lower crescent
    roughness: 0.15,
    metalness: 0.05,
    name: 'EyeLowerMat',
  });

  const catchlightMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    name: 'CatchlightMat',
  });

  const mouthMaterial = new THREE.MeshStandardMaterial({
    color: 0xaa4455,
    roughness: 0.35,
    metalness: 0.05,
    name: 'MouthMat',
  });

  // ─── Character Root Group ─────────────────────────────────────
  const characterRoot = new THREE.Group();
  characterRoot.name = 'MirariCharacter';
  scene.add(characterRoot);

  const bodyGroup = new THREE.Group();
  bodyGroup.name = 'BodyGroup';
  characterRoot.add(bodyGroup);

  // ─── 1. Sculpted Head & Torso Geometry ────────────────────────
  // A. Chubby Head with round cheeks
  const headGeo = new THREE.SphereGeometry(0.64, 32, 28);
  headGeo.scale(1.16, 0.94, 0.96); // Cute wide chibi head
  const headMesh = new THREE.Mesh(headGeo, bodyMaterial);
  headMesh.name = 'HeadMesh';
  headMesh.position.set(0, 0.40, 0);
  headMesh.castShadow = true;
  bodyGroup.add(headMesh);

  // B. Chubby Belly / Torso
  const bellyGeo = new THREE.SphereGeometry(0.68, 32, 28);
  bellyGeo.scale(1.04, 1.14, 0.98);
  const bellyMesh = new THREE.Mesh(bellyGeo, bodyMaterial);
  bellyMesh.name = 'BellyMesh';
  bellyMesh.position.set(0, -0.24, -0.04);
  bellyMesh.castShadow = true;
  bodyGroup.add(bellyMesh);

  // ─── 2. Facial Features (Eyes, Blush, Mouth) ──────────────────
  const faceGroup = new THREE.Group();
  faceGroup.name = 'FaceGroup';
  bodyGroup.add(faceGroup);

  // Large expressive cosmic anime eye builder
  function createCosmicEye(isLeft = true) {
    const eyeAnchor = new THREE.Group();
    eyeAnchor.name = isLeft ? 'LeftEyeAnchor' : 'RightEyeAnchor';

    // Positioned directly on head surface at y = 0.40, x = ±0.28, z = 0.58
    eyeAnchor.position.set(isLeft ? -0.27 : 0.27, 0.41, 0.58);
    eyeAnchor.rotation.y = isLeft ? -0.36 : 0.36; // Tangent to curved head
    eyeAnchor.rotation.z = isLeft ? 0.08 : -0.08; // Sweet anime tilt
    eyeAnchor.rotation.x = -0.05;

    // 1. Base Dark Oval (Midnight Indigo)
    const baseGeo = new THREE.SphereGeometry(0.14, 24, 20);
    baseGeo.scale(0.92, 1.38, 0.26);
    const baseMesh = new THREE.Mesh(baseGeo, eyeBaseMaterial);
    baseMesh.name = isLeft ? 'LeftEyeMesh' : 'RightEyeMesh';
    eyeAnchor.add(baseMesh);

    // 2. Glowing Amethyst Iris (Middle-Lower)
    const irisGeo = new THREE.SphereGeometry(0.12, 20, 16);
    irisGeo.scale(0.88, 1.22, 0.24);
    const irisMesh = new THREE.Mesh(irisGeo, eyeIrisMaterial);
    irisMesh.position.set(0, -0.02, 0.015);
    eyeAnchor.add(irisMesh);

    // 3. Lower Lavender Reflection Crescent
    const lowerGeo = new THREE.SphereGeometry(0.09, 16, 12);
    lowerGeo.scale(0.82, 0.68, 0.22);
    const lowerMesh = new THREE.Mesh(lowerGeo, eyeLowerMaterial);
    lowerMesh.position.set(0, -0.065, 0.026);
    eyeAnchor.add(lowerMesh);

    // 4. Primary Starlight Diamond Catchlight (Upper-Inner)
    const c1Geo = new THREE.SphereGeometry(0.044, 16, 12);
    c1Geo.scale(0.85, 1.2, 0.18);
    const c1Mesh = new THREE.Mesh(c1Geo, catchlightMaterial);
    c1Mesh.position.set(isLeft ? 0.028 : -0.028, 0.062, 0.042);
    eyeAnchor.add(c1Mesh);

    // 5. Secondary Starlight Dot Catchlight (Lower-Outer)
    const c2Geo = new THREE.SphereGeometry(0.024, 12, 10);
    const c2Mesh = new THREE.Mesh(c2Geo, catchlightMaterial);
    c2Mesh.position.set(isLeft ? -0.036 : 0.036, -0.054, 0.04);
    eyeAnchor.add(c2Mesh);

    // 6. Eyelid for Blinking Animation
    const eyelidGeo = new THREE.SphereGeometry(0.155, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.52);
    eyelidGeo.scale(0.96, 1.42, 0.32);
    const eyelidMesh = new THREE.Mesh(eyelidGeo, bodyMaterial);
    eyelidMesh.name = isLeft ? 'LeftEyelid' : 'RightEyelid';
    eyelidMesh.position.set(0, 0.01, 0.01);
    eyelidMesh.rotation.x = -Math.PI * 0.52; // Hidden above eye when open
    eyeAnchor.add(eyelidMesh);

    return eyeAnchor;
  }

  const leftEye = createCosmicEye(true);
  faceGroup.add(leftEye);

  const rightEye = createCosmicEye(false);
  faceGroup.add(rightEye);

  // Rosy Peach Blush Cheeks (Soft oval blush below eyes)
  const blushGeo = new THREE.SphereGeometry(0.105, 20, 16);
  blushGeo.scale(1.25, 0.65, 0.12);

  const leftBlush = new THREE.Mesh(blushGeo, blushMaterial);
  leftBlush.name = 'LeftCheek';
  leftBlush.position.set(-0.42, 0.27, 0.51);
  leftBlush.rotation.set(0.18, -0.55, -0.15);
  faceGroup.add(leftBlush);

  const rightBlush = new THREE.Mesh(blushGeo, blushMaterial);
  rightBlush.name = 'RightCheek';
  rightBlush.position.set(0.42, 0.27, 0.51);
  rightBlush.rotation.set(0.18, 0.55, 0.15);
  faceGroup.add(rightBlush);

  // Sweet Chibi Open Smile (Curved happy mouth from concept art)
  const mouthAnchor = new THREE.Group();
  mouthAnchor.position.set(0, 0.26, 0.61);
  mouthAnchor.rotation.x = 0.2;
  faceGroup.add(mouthAnchor);

  // Outer mouth smile line
  const mouthCurve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(-0.065, 0.02, 0),
    new THREE.Vector3(0, -0.032, 0.01),
    new THREE.Vector3(0.065, 0.02, 0)
  );
  const mouthGeo = new THREE.TubeGeometry(mouthCurve, 16, 0.012, 8, false);
  const mouthMesh = new THREE.Mesh(mouthGeo, mouthMaterial);
  mouthMesh.name = 'MouthMesh';
  mouthAnchor.add(mouthMesh);

  // Cute warm pink mouth interior (open happy chibi smile)
  const mouthInteriorGeo = new THREE.SphereGeometry(0.048, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.6);
  mouthInteriorGeo.scale(1.1, 0.75, 0.2);
  const mouthInteriorMesh = new THREE.Mesh(
    mouthInteriorGeo,
    new THREE.MeshStandardMaterial({ color: 0x992d3b, roughness: 0.3 })
  );
  mouthInteriorMesh.position.set(0, -0.012, -0.01);
  mouthAnchor.add(mouthInteriorMesh);

  // ─── 3. Crown Twin-Leaf Sprout & 5-Petal Star Collar ──────────
  const sproutGroup = new THREE.Group();
  sproutGroup.name = 'SproutGroup';
  sproutGroup.position.set(0, 0.98, 0); // Crown peak
  bodyGroup.add(sproutGroup);

  // 5-Petal Golden Star-Flower Collar at crown base
  const starCollar = new THREE.Group();
  starCollar.name = 'StarCollar';
  for (let p = 0; p < 5; p++) {
    const angle = (p / 5) * Math.PI * 2;
    const petalGeo = new THREE.ConeGeometry(0.048, 0.13, 8);
    petalGeo.scale(1.2, 0.5, 0.7);
    const petalMesh = new THREE.Mesh(petalGeo, goldMaterial);
    petalMesh.position.set(Math.cos(angle) * 0.075, -0.01, Math.sin(angle) * 0.075);
    petalMesh.rotation.y = -angle;
    petalMesh.rotation.z = Math.PI / 2.3;
    starCollar.add(petalMesh);
  }
  sproutGroup.add(starCollar);

  // Tender sprout central stem
  const stemCurve = new THREE.CubicBezierCurve3(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0.08, 0.01),
    new THREE.Vector3(0.01, 0.15, 0.02),
    new THREE.Vector3(0.02, 0.22, 0.02)
  );
  const stemGeo = new THREE.TubeGeometry(stemCurve, 12, 0.022, 8, false);
  const stemMesh = new THREE.Mesh(stemGeo, sproutMaterial);
  sproutGroup.add(stemMesh);

  // Leaf 1: Large gracefully curving tender leaf
  const leaf1Geo = new THREE.SphereGeometry(0.24, 20, 16);
  leaf1Geo.scale(0.85, 1.45, 0.18);
  const leaf1Mesh = new THREE.Mesh(leaf1Geo, sproutMaterial);
  leaf1Mesh.name = 'Leaf1Mesh';
  leaf1Mesh.position.set(0.18, 0.36, 0.04);
  leaf1Mesh.rotation.set(-0.25, 0.2, -0.45);
  leaf1Mesh.castShadow = true;
  sproutGroup.add(leaf1Mesh);

  // Leaf 2: Companion seedling leaf
  const leaf2Geo = new THREE.SphereGeometry(0.165, 16, 12);
  leaf2Geo.scale(0.8, 1.35, 0.18);
  const leaf2Mesh = new THREE.Mesh(leaf2Geo, sproutLeaf2Material);
  leaf2Mesh.name = 'Leaf2Mesh';
  leaf2Mesh.position.set(-0.14, 0.26, 0.02);
  leaf2Mesh.rotation.set(-0.2, -0.3, 0.58);
  leaf2Mesh.castShadow = true;
  sproutGroup.add(leaf2Mesh);

  // ─── 4. Drooping Wing Ears ────────────────────────────────────
  function createWingEar(isLeft = true) {
    const earGroup = new THREE.Group();
    earGroup.name = isLeft ? 'LeftEarGroup' : 'RightEarGroup';
    earGroup.position.set(isLeft ? -0.58 : 0.58, 0.44, 0.04);
    earGroup.rotation.z = isLeft ? 0.38 : -0.38;
    earGroup.rotation.y = isLeft ? -0.25 : 0.25;

    // 3 Layered feather wings (milky white top, violet-indigo tips)
    // Feather 1 (Top / Main body)
    const f1Geo = new THREE.SphereGeometry(0.26, 20, 16);
    f1Geo.scale(0.65, 1.45, 0.22);
    const f1Mesh = new THREE.Mesh(f1Geo, bodyMaterial);
    f1Mesh.position.set(isLeft ? -0.15 : 0.15, -0.18, 0);
    f1Mesh.rotation.z = isLeft ? 0.45 : -0.45;
    earGroup.add(f1Mesh);

    // Feather 2 (Middle wing with violet gradient tone)
    const f2Geo = new THREE.SphereGeometry(0.20, 16, 12);
    f2Geo.scale(0.6, 1.3, 0.2);
    const f2Mesh = new THREE.Mesh(f2Geo, violetWingMaterial);
    f2Mesh.position.set(isLeft ? -0.28 : 0.28, -0.34, 0.02);
    f2Mesh.rotation.z = isLeft ? 0.55 : -0.55;
    earGroup.add(f2Mesh);

    // Feather 3 (Drooping tip)
    const f3Geo = new THREE.SphereGeometry(0.15, 14, 10);
    f3Geo.scale(0.55, 1.1, 0.18);
    const f3Mesh = new THREE.Mesh(f3Geo, violetWingMaterial);
    f3Mesh.position.set(isLeft ? -0.36 : 0.36, -0.48, 0.03);
    f3Mesh.rotation.z = isLeft ? 0.65 : -0.65;
    earGroup.add(f3Mesh);

    return earGroup;
  }

  const leftEar = createWingEar(true);
  bodyGroup.add(leftEar);

  const rightEar = createWingEar(false);
  bodyGroup.add(rightEar);

  // ─── 5. Midnight Starry Cape & Glowing Brooch ─────────────────
  const capeGroup = new THREE.Group();
  capeGroup.name = 'CapeGroup';
  bodyGroup.add(capeGroup);

  // A. Neck Collar Trim Band (Refined gold trim framing neckline)
  const collarGeo = new THREE.TorusGeometry(0.53, 0.022, 12, 32);
  collarGeo.scale(1.10, 0.96, 0.94);
  const collarMesh = new THREE.Mesh(collarGeo, goldMaterial);
  collarMesh.position.set(0, 0.11, 0.04);
  collarMesh.rotation.x = Math.PI / 2.12;
  capeGroup.add(collarMesh);

  // B. Flowing Cape Panels (Shoulder mantle wrapping around back)
  // Left shoulder drape
  const slGeo = new THREE.SphereGeometry(0.34, 20, 16);
  slGeo.scale(0.88, 1.35, 0.16);
  const slMesh = new THREE.Mesh(slGeo, capeMaterial);
  slMesh.position.set(-0.44, -0.10, 0.16);
  slMesh.rotation.set(-0.15, 0.45, -0.22);
  capeGroup.add(slMesh);

  // Right shoulder drape
  const srGeo = new THREE.SphereGeometry(0.34, 20, 16);
  srGeo.scale(0.88, 1.35, 0.16);
  const srMesh = new THREE.Mesh(srGeo, capeMaterial);
  srMesh.position.set(0.44, -0.10, 0.16);
  srMesh.rotation.set(-0.15, -0.45, 0.22);
  capeGroup.add(srMesh);

  // Back main drape
  const backGeo = new THREE.SphereGeometry(0.48, 24, 20);
  backGeo.scale(1.35, 1.6, 0.2);
  const backMesh = new THREE.Mesh(backGeo, capeMaterial);
  backMesh.position.set(0, -0.28, -0.58);
  backMesh.rotation.set(0.28, 0, 0);
  capeGroup.add(backMesh);

  // Back-Left flap
  const blGeo = new THREE.SphereGeometry(0.36, 18, 14);
  blGeo.scale(1.0, 1.4, 0.18);
  const blMesh = new THREE.Mesh(blGeo, capeMaterial);
  blMesh.position.set(-0.48, -0.22, -0.38);
  blMesh.rotation.set(0.22, -0.6, 0.35);
  capeGroup.add(blMesh);

  // Back-Right flap
  const brGeo = new THREE.SphereGeometry(0.36, 18, 14);
  brGeo.scale(1.0, 1.4, 0.18);
  const brMesh = new THREE.Mesh(brGeo, capeMaterial);
  brMesh.position.set(0.48, -0.22, -0.38);
  brMesh.rotation.set(0.22, 0.6, -0.35);
  capeGroup.add(brMesh);

  // Scalloped Violet Cape Hem Trims
  const hemGeo = new THREE.SphereGeometry(0.50, 20, 16);
  hemGeo.scale(1.32, 0.45, 0.22);
  const hemMesh = new THREE.Mesh(hemGeo, violetWingMaterial);
  hemMesh.position.set(0, -0.52, -0.56);
  hemMesh.rotation.set(0.28, 0, 0);
  capeGroup.add(hemMesh);

  // Gold Hem Rim Trim
  const trimGeo = new THREE.TorusGeometry(0.44, 0.016, 8, 32, Math.PI * 0.95);
  const trimMesh = new THREE.Mesh(trimGeo, goldMaterial);
  trimMesh.position.set(0, -0.62, -0.52);
  trimMesh.rotation.set(0.28, 0, 0);
  capeGroup.add(trimMesh);

  // Golden Constellation Star Studs on Cape
  const starCoords = [
    [-0.38, -0.06, 0.22], // shoulder left
    [0.38, -0.06, 0.22],  // shoulder right
    [-0.32, -0.22, -0.55],
    [-0.14, -0.36, -0.65],
    [0.0, -0.18, -0.68],
    [0.15, -0.34, -0.64],
    [0.34, -0.20, -0.54],
  ];

  starCoords.forEach(([sx, sy, sz]) => {
    const starGeo = new THREE.SphereGeometry(0.026, 12, 10);
    const starMesh = new THREE.Mesh(starGeo, goldMaterial);
    starMesh.position.set(sx, sy, sz);
    capeGroup.add(starMesh);
  });

  // Constellation Connective Lines on Back Cape
  for (let c = 2; c < 6; c++) {
    const p1 = new THREE.Vector3(...starCoords[c]);
    const p2 = new THREE.Vector3(...starCoords[c + 1]);
    const lineCurve = new THREE.LineCurve3(p1, p2);
    const lineGeo = new THREE.TubeGeometry(lineCurve, 8, 0.005, 6, false);
    const lineMesh = new THREE.Mesh(lineGeo, goldMaterial);
    capeGroup.add(lineMesh);
  }

  // C. Front Center Chest Brooch (Gold Star Bezel + Glowing Crystal)
  const broochGroup = new THREE.Group();
  broochGroup.name = 'BroochGroup';
  broochGroup.position.set(0, 0.07, 0.60); // Centered proudly at collar notch
  capeGroup.add(broochGroup);

  // 4-Point Gold Star Bezel
  for (let b = 0; b < 4; b++) {
    const bAngle = (b / 4) * Math.PI * 2;
    const bGeo = new THREE.ConeGeometry(0.038, 0.11, 8);
    const bMesh = new THREE.Mesh(bGeo, goldMaterial);
    bMesh.position.set(Math.cos(bAngle) * 0.075, Math.sin(bAngle) * 0.075, -0.01);
    bMesh.rotation.z = bAngle - Math.PI / 2;
    broochGroup.add(bMesh);
  }

  // Gold Bezel Ring
  const bezelGeo = new THREE.TorusGeometry(0.08, 0.018, 12, 24);
  const bezelMesh = new THREE.Mesh(bezelGeo, goldMaterial);
  broochGroup.add(bezelMesh);

  // Glowing Celestial Gem Orb
  const gemGeo = new THREE.SphereGeometry(0.072, 24, 20);
  const gemMesh = new THREE.Mesh(gemGeo, gemMaterial);
  gemMesh.name = 'BroochCrystal';
  gemMesh.position.set(0, 0, 0.02);
  broochGroup.add(gemMesh);

  // ─── 6. Front Paws & Seated Feet ──────────────────────────────
  // Front Left Paw (Raised slightly forward and inward)
  const leftPawGroup = new THREE.Group();
  leftPawGroup.name = 'LeftPawGroup';
  const pawGeo = new THREE.SphereGeometry(0.115, 16, 14);
  pawGeo.scale(0.85, 0.95, 1.35);
  const lpMesh = new THREE.Mesh(pawGeo, bodyMaterial);
  leftPawGroup.add(lpMesh);
  leftPawGroup.position.set(-0.21, -0.12, 0.59);
  leftPawGroup.rotation.set(0.48, 0.32, -0.22);
  bodyGroup.add(leftPawGroup);

  // Front Right Paw (Raised slightly forward and inward)
  const rightPawGroup = new THREE.Group();
  rightPawGroup.name = 'RightPawGroup';
  const rpMesh = new THREE.Mesh(pawGeo, bodyMaterial);
  rightPawGroup.add(rpMesh);
  rightPawGroup.position.set(0.21, -0.12, 0.59);
  rightPawGroup.rotation.set(0.48, -0.32, 0.22);
  bodyGroup.add(rightPawGroup);

  // Seated Feet
  const footGeo = new THREE.SphereGeometry(0.13, 16, 12);
  footGeo.scale(0.9, 0.7, 1.4);

  const leftFoot = new THREE.Mesh(footGeo, bodyMaterial);
  leftFoot.name = 'LeftFootGroup';
  leftFoot.position.set(-0.26, -0.74, 0.24);
  leftFoot.rotation.set(-0.15, 0.2, 0);
  bodyGroup.add(leftFoot);

  const rightFoot = new THREE.Mesh(footGeo, bodyMaterial);
  rightFoot.name = 'RightFootGroup';
  rightFoot.position.set(0.26, -0.74, 0.24);
  rightFoot.rotation.set(-0.15, -0.2, 0);
  bodyGroup.add(rightFoot);

  // ─── Export to Binary GLB ─────────────────────────────────────
  const exporter = new GLTFExporter();
  const outputPath = path.resolve('public/models/mirari.glb');

  return new Promise((resolve, reject) => {
    exporter.parse(
      scene,
      (gltf) => {
        try {
          fs.writeFileSync(outputPath, Buffer.from(gltf));
          const stats = fs.statSync(outputPath);
          console.log(`Successfully generated candidate MIRARI "星種精靈" GLB asset at: ${outputPath} (${stats.size} bytes)`);
          resolve(outputPath);
        } catch (err) {
          reject(err);
        }
      },
      (error) => {
        console.error('An error occurred while exporting GLTF:', error);
        reject(error);
      },
      { binary: true }
    );
  });
}

generateStarseedModel()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Model generation failed:', err);
    process.exit(1);
  });

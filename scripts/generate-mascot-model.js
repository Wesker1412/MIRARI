/**
 * MIRARI Mascot 3D Asset Generator
 * 
 * Generates an original Japanese-style cute organic character (GLB format).
 * Features an organic pear-shaped soft body, curved spirit plume ears,
 * glossy obsidian eyes with eyelids for blinking, soft blush cheeks,
 * stubby front paws, and a curved spirit tail.
 * 
 * Outputs to public/models/mirari.glb
 */

import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import fs from 'fs';
import path from 'path';

// Polyfill FileReader for Node.js environment
globalThis.FileReader = class FileReader {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((buf) => {
      this.result = buf;
      if (this.onloadend) this.onloadend();
      if (this.onload) this.onload();
    });
  }
};

function createMascotModel() {
  const root = new THREE.Group();
  root.name = 'MirariCharacter';

  // ─── Materials ────────────────────────────────────────────────
  // Velvety soft ivory body material
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0xfcfbf9,
    roughness: 0.38,
    metalness: 0.04,
    name: 'BodyMat',
  });

  // Soft peach inner ear / accents
  const peachMaterial = new THREE.MeshStandardMaterial({
    color: 0xfed7aa,
    roughness: 0.5,
    metalness: 0.0,
    name: 'PeachMat',
  });

  // Deep obsidian glossy eyes
  const eyeMaterial = new THREE.MeshStandardMaterial({
    color: 0x0a0e1a,
    roughness: 0.06,
    metalness: 0.1,
    name: 'EyeMat',
  });

  // Catchlight (eye sparkle)
  const catchlightMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    name: 'CatchlightMat',
  });

  // Soft rosy cheeks
  const cheekMaterial = new THREE.MeshStandardMaterial({
    color: 0xfda4af,
    roughness: 0.6,
    metalness: 0.0,
    transparent: true,
    opacity: 0.7,
    name: 'CheekMat',
  });

  // Delicate mouth
  const mouthMaterial = new THREE.MeshBasicMaterial({
    color: 0xd97706,
    name: 'MouthMat',
  });

  // ─── 1. Main Torso & Head (Organic Pear Shape) ────────────────
  // Create an organic lathe geometry with non-linear profile
  const bodyGroup = new THREE.Group();
  bodyGroup.name = 'BodyGroup';
  root.add(bodyGroup);

  const points = [];
  const segments = 48;
  const height = 2.4;
  
  // Custom curve: plump squishy lower belly, gentle waist, rounded cute head
  for (let i = 0; i <= segments; i++) {
    const t = i / segments; // 0 (bottom) to 1 (top)
    const y = (t - 0.5) * height;
    
    // Radii calculation: base radius ~0.95 at belly, tapering to ~0.75 at head, 0 at poles
    let r = 0;
    if (t < 0.08) {
      // Rounded bottom base
      r = Math.sin((t / 0.08) * (Math.PI / 2)) * 0.85;
    } else if (t < 0.45) {
      // Plump lower belly
      const p = (t - 0.08) / (0.45 - 0.08);
      r = 0.85 + Math.sin(p * Math.PI) * 0.22;
    } else if (t < 0.85) {
      // Gentle cute head
      const p = (t - 0.45) / (0.85 - 0.45);
      r = 0.88 + Math.sin(p * Math.PI) * 0.12;
    } else {
      // Rounded top crown
      const p = (t - 0.85) / 0.15;
      r = Math.cos(p * (Math.PI / 2)) * 0.88;
    }
    points.push(new THREE.Vector2(Math.max(0.001, r), y));
  }

  const bodyGeo = new THREE.LatheGeometry(points, 48);
  bodyGeo.computeVertexNormals();
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyMaterial);
  bodyMesh.name = 'TorsoMesh';
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  bodyGroup.add(bodyMesh);

  // ─── 2. Spirit Plume Ears (Curved Soft Horns) ──────────────────
  function createEar(isLeft = true) {
    const earGroup = new THREE.Group();
    earGroup.name = isLeft ? 'LeftEarGroup' : 'RightEarGroup';

    // Organic tapered curved ear path
    const curvePoints = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(isLeft ? -0.2 : 0.2, 0.4, -0.05),
      new THREE.Vector3(isLeft ? -0.45 : 0.45, 0.85, -0.15),
      new THREE.Vector3(isLeft ? -0.65 : 0.65, 1.25, -0.25),
    ];
    const curve = new THREE.CatmullRomCurve3(curvePoints);

    // Tube with custom tapering
    const earGeo = new THREE.TubeGeometry(curve, 24, 0.18, 16, false);
    // Taper vertices along length
    const pos = earGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vy = pos.getY(i);
      const factor = Math.max(0.15, 1.0 - (vy / 1.35) * 0.85);
      pos.setX(i, pos.getX(i) * factor);
      pos.setZ(i, pos.getZ(i) * factor);
    }
    earGeo.computeVertexNormals();

    const earMesh = new THREE.Mesh(earGeo, bodyMaterial);
    earMesh.name = isLeft ? 'LeftEarMesh' : 'RightEarMesh';
    earMesh.castShadow = true;
    earGroup.add(earMesh);

    // Inner ear warm peach patch
    const innerEarGeo = new THREE.SphereGeometry(0.12, 16, 16);
    innerEarGeo.scale(0.8, 2.2, 0.4);
    const innerEarMesh = new THREE.Mesh(innerEarGeo, peachMaterial);
    innerEarMesh.position.set(isLeft ? -0.32 : 0.32, 0.65, 0.05);
    innerEarMesh.rotation.z = isLeft ? 0.35 : -0.35;
    earGroup.add(innerEarMesh);

    return earGroup;
  }

  const leftEar = createEar(true);
  leftEar.position.set(-0.55, 0.82, 0.0);
  leftEar.rotation.z = 0.2;
  leftEar.rotation.x = -0.1;
  bodyGroup.add(leftEar);

  const rightEar = createEar(false);
  rightEar.position.set(0.55, 0.82, 0.0);
  rightEar.rotation.z = -0.2;
  rightEar.rotation.x = -0.1;
  bodyGroup.add(rightEar);

  // ─── 3. Facial Features (Golden Ratio Cute Placement) ─────────
  const faceGroup = new THREE.Group();
  faceGroup.name = 'FaceGroup';
  faceGroup.position.set(0, 0.35, 0.78); // Lower third of head
  bodyGroup.add(faceGroup);

  function createEye(isLeft = true) {
    const eyeAnchor = new THREE.Group();
    eyeAnchor.name = isLeft ? 'LeftEyeAnchor' : 'RightEyeAnchor';
    eyeAnchor.position.set(isLeft ? -0.34 : 0.34, 0, 0);

    // Eye globe (slightly flattened glossy oval)
    const eyeGeo = new THREE.SphereGeometry(0.13, 24, 24);
    eyeGeo.scale(1.0, 1.25, 0.6);
    const eyeMesh = new THREE.Mesh(eyeGeo, eyeMaterial);
    eyeMesh.name = isLeft ? 'LeftEyeMesh' : 'RightEyeMesh';
    eyeAnchor.add(eyeMesh);

    // Primary bright catchlight
    const c1Geo = new THREE.SphereGeometry(0.04, 12, 12);
    const c1Mesh = new THREE.Mesh(c1Geo, catchlightMaterial);
    c1Mesh.position.set(isLeft ? -0.03 : 0.04, 0.05, 0.08);
    eyeAnchor.add(c1Mesh);

    // Secondary soft catchlight
    const c2Geo = new THREE.SphereGeometry(0.022, 12, 12);
    const c2Mesh = new THREE.Mesh(c2Geo, catchlightMaterial);
    c2Mesh.position.set(isLeft ? 0.04 : -0.03, -0.05, 0.07);
    eyeAnchor.add(c2Mesh);

    // Eyelid for organic blinking animation
    const eyelidGeo = new THREE.SphereGeometry(0.145, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.55);
    eyelidGeo.scale(1.02, 1.26, 0.62);
    const eyelidMesh = new THREE.Mesh(eyelidGeo, bodyMaterial);
    eyelidMesh.name = isLeft ? 'LeftEyelid' : 'RightEyelid';
    eyelidMesh.position.set(0, 0.02, 0.01);
    eyelidMesh.rotation.x = -Math.PI * 0.52; // Hidden above eye when open
    eyeAnchor.add(eyelidMesh);

    return eyeAnchor;
  }

  const leftEye = createEye(true);
  faceGroup.add(leftEye);

  const rightEye = createEye(false);
  faceGroup.add(rightEye);

  // Rosy Cheeks
  const cheekGeo = new THREE.CircleGeometry(0.09, 24);
  const leftCheek = new THREE.Mesh(cheekGeo, cheekMaterial);
  leftCheek.name = 'LeftCheek';
  leftCheek.position.set(-0.46, -0.16, -0.05);
  leftCheek.rotation.y = -0.3;
  faceGroup.add(leftCheek);

  const rightCheek = new THREE.Mesh(cheekGeo, cheekMaterial);
  rightCheek.name = 'RightCheek';
  rightCheek.position.set(0.46, -0.16, -0.05);
  rightCheek.rotation.y = 0.3;
  faceGroup.add(rightCheek);

  // Cute minimal mouth (gentle curve)
  const mouthCurve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(-0.05, -0.12, 0.05),
    new THREE.Vector3(0.0, -0.16, 0.06),
    new THREE.Vector3(0.05, -0.12, 0.05)
  );
  const mouthGeo = new THREE.TubeGeometry(mouthCurve, 16, 0.016, 8, false);
  const mouthMesh = new THREE.Mesh(mouthGeo, mouthMaterial);
  mouthMesh.name = 'MouthMesh';
  faceGroup.add(mouthMesh);

  // ─── 4. Stubby Cute Paws (Forearms) ───────────────────────────
  function createPaw(isLeft = true) {
    const pawGroup = new THREE.Group();
    pawGroup.name = isLeft ? 'LeftPawGroup' : 'RightPawGroup';

    const pawGeo = new THREE.SphereGeometry(0.18, 20, 20);
    pawGeo.scale(0.85, 1.25, 1.6);
    const pawMesh = new THREE.Mesh(pawGeo, bodyMaterial);
    pawMesh.name = isLeft ? 'LeftPawMesh' : 'RightPawMesh';
    pawMesh.castShadow = true;
    pawGroup.add(pawMesh);

    return pawGroup;
  }

  const leftPaw = createPaw(true);
  leftPaw.position.set(-0.42, -0.42, 0.72);
  leftPaw.rotation.set(0.5, 0.35, -0.3);
  bodyGroup.add(leftPaw);

  const rightPaw = createPaw(false);
  rightPaw.position.set(0.42, -0.42, 0.72);
  rightPaw.rotation.set(0.5, -0.35, 0.3);
  bodyGroup.add(rightPaw);

  // ─── 5. Soft Spirit Tail (Curved upward at back) ──────────────
  const tailGroup = new THREE.Group();
  tailGroup.name = 'TailGroup';
  tailGroup.position.set(0, -0.75, -0.75);

  const tailCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, -0.1, -0.35),
    new THREE.Vector3(0, 0.25, -0.65),
    new THREE.Vector3(0, 0.55, -0.55),
  ]);
  const tailGeo = new THREE.TubeGeometry(tailCurve, 20, 0.16, 12, false);
  // Taper tail tip
  const tailPos = tailGeo.attributes.position;
  for (let i = 0; i < tailPos.count; i++) {
    const vz = tailPos.getZ(i);
    const progress = Math.min(1.0, Math.max(0.0, (-vz) / 0.65));
    const factor = Math.max(0.2, 1.0 - progress * 0.75);
    tailPos.setX(i, tailPos.getX(i) * factor);
    tailPos.setY(i, tailPos.getY(i) * factor);
  }
  tailGeo.computeVertexNormals();

  const tailMesh = new THREE.Mesh(tailGeo, bodyMaterial);
  tailMesh.name = 'TailMesh';
  tailMesh.castShadow = true;
  tailGroup.add(tailMesh);
  bodyGroup.add(tailGroup);

  return root;
}

// ─── Export to GLB ──────────────────────────────────────────────
async function exportGLB() {
  const model = createMascotModel();
  const exporter = new GLTFExporter();

  const outDir = path.resolve('public/models');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  const outPath = path.join(outDir, 'mirari.glb');

  return new Promise((resolve, reject) => {
    exporter.parse(
      model,
      (glb) => {
        fs.writeFileSync(outPath, Buffer.from(glb));
        console.log(`Successfully generated original MIRARI mascot GLB asset at: ${outPath} (${glb.byteLength} bytes)`);
        resolve(outPath);
      },
      (err) => {
        console.error('Failed to export GLB:', err);
        reject(err);
      },
      { binary: true }
    );
  });
}

exportGLB().catch(console.error);

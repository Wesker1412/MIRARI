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

const scene = new THREE.Scene();

function group(name, parent, x = 0, y = 0, z = 0) {
  const node = new THREE.Group();
  node.name = name;
  node.position.set(x, y, z);
  parent.add(node);
  return node;
}

function material(color, roughness = 0.8) {
  return new THREE.MeshStandardMaterial({ color, roughness, side: THREE.DoubleSide });
}

function mesh(parent, geometry, surface) {
  const object = new THREE.Mesh(geometry, surface);
  parent.add(object);
  return object;
}

function oval(parent, surface, x, y, z, sx, sy, sz) {
  const object = mesh(parent, new THREE.SphereGeometry(1, 24, 16).scale(sx, sy, sz), surface);
  object.position.set(x, y, z);
  return object;
}

const ivory = material(0xe4d3b6);
const navy = material(0x243248);
const olive = material(0x626938);
const ink = material(0x211d19);
const amber = material(0xb67828, 0.55);

const body = group('BodyGroup', scene);
const profile = new THREE.SplineCurve([
  [0, -0.94], [0.44, -0.91], [0.73, -0.67], [0.76, -0.34],
  [0.66, 0.04], [0.44, 0.37], [0.19, 0.64], [0, 0.84],
].map(([x, y]) => new THREE.Vector2(x, y)));
const seed = new THREE.LatheGeometry(profile.getPoints(42), 48);
seed.scale(1, 1, 0.83);
mesh(body, seed, ivory);

const sprout = group('SproutGroup', body, 0, 0.76);
oval(sprout, olive, 0.29, 0.25, 0, 0.40, 0.108, 0.048).rotation.z = 0.57;
oval(sprout, olive, 0.29, 0.11, 0.075, 0.27, 0.078, 0.043).rotation.z = 0.04;

for (const [name, x] of [['LeftEye', -0.18], ['RightEye', 0.18]]) {
  const eye = group(name, body, x, 0.03, 0.537);
  oval(eye, ink, 0, 0, 0, 0.043, 0.062, 0.018);
}
const mouth = group('Mouth', body, 0, -0.11, 0.584);
oval(mouth, ink, 0, 0, 0, 0.044, 0.014, 0.012);
const smile = group('Smile', mouth);
const smileCurve = new THREE.QuadraticBezierCurve3(
  new THREE.Vector3(-0.068, 0.017, 0.009),
  new THREE.Vector3(0, -0.068, 0.023),
  new THREE.Vector3(0.068, 0.017, 0.009),
);
mesh(smile, new THREE.TubeGeometry(smileCurve, 16, 0.012, 8), ink);

const cape = group('CapeGroup', body, 0, -0.36);
const vertices = [];
const indices = [];
const segments = 64;
for (let column = 0; column <= segments; column++) {
  const angle = column / segments * Math.PI * 2;
  const front = Math.max(0, Math.cos(angle));
  const top = -0.27 - 0.09 * front;
  const hem = -0.83 + 0.43 * front ** 9 + 0.045 * Math.sin(angle);
  for (let row = 0; row <= 12; row++) {
    const t = row / 12;
    const radius = 0.774 + 0.016 * Math.sin(Math.PI * t) - 0.09 * t ** 3;
    vertices.push(radius * Math.sin(angle), THREE.MathUtils.lerp(top, hem, t) + 0.36,
      radius * 0.86 * Math.cos(angle));
    if (column && row) {
      const index = column * 13 + row;
      indices.push(index, index - 13, index - 14, index, index - 14, index - 1);
    }
  }
}
const capeGeometry = new THREE.BufferGeometry();
capeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
capeGeometry.setIndex(indices);
capeGeometry.computeVertexNormals();
mesh(cape, capeGeometry, navy);
oval(cape, amber, 0.035, -0.014, 0.67, 0.049, 0.049, 0.025);

const glb = await new GLTFExporter().parseAsync(scene, { binary: true });
fs.writeFileSync(path.resolve('public/models/seed.glb'), Buffer.from(glb));

import * as THREE from 'three';
import {
  at,
  capsule,
  cylinder,
  group,
  makeArm,
  makeFace,
  makeLeg,
  mat,
  mesh,
  smoothstep,
  sphere,
} from './kit.js';

const HIP = 0.5;

/**
 * Shared rig: root (on the ground) → hips with legs, and a body group that bounces, leans
 * and squashes, carrying the food shape, the face and the arms.
 */
function rig({ body, face, faceAt, shoulders, limbColor, glove, shoe, bodyLift, hipX = 0.16 }) {
  const root = new THREE.Group();
  const bodyPivot = new THREE.Group();
  bodyPivot.position.y = HIP;
  body.position.y = bodyLift;
  bodyPivot.add(body);
  face.group.position.copy(faceAt);
  body.add(face.group);
  const arms = [-1, 1].map((side) => {
    const arm = makeArm(limbColor, glove);
    arm.position.set(side * shoulders.x, shoulders.y, shoulders.z ?? 0);
    body.add(arm);
    return arm;
  });
  const legs = [-1, 1].map((side) => {
    const leg = makeLeg(limbColor, shoe);
    leg.position.set(side * hipX, HIP, 0);
    root.add(leg);
    return leg;
  });
  root.add(bodyPivot);
  return { root, bodyPivot, body, face, arms, legs };
}

function pizza() {
  const shape = new THREE.Shape();
  shape.moveTo(-0.6, 0.45);
  shape.lineTo(0.6, 0.45);
  shape.quadraticCurveTo(0.08, -0.55, 0, -0.78);
  shape.quadraticCurveTo(-0.08, -0.55, -0.6, 0.45);
  const slice = mesh(
    new THREE.ExtrudeGeometry(shape, {
      depth: 0.16,
      bevelEnabled: true,
      bevelThickness: 0.07,
      bevelSize: 0.07,
      bevelSegments: 6,
      curveSegments: 24,
    }),
    mat(0xffc84a, 0.5),
  );
  slice.position.z = -0.08;
  const crust = capsule(0.15, 1.15, mat(0xd98a3d, 0.65));
  crust.rotation.z = Math.PI / 2;
  crust.position.set(0, 0.5, 0.02);
  const pepperoni = mat(0xd2382f, 0.5);
  const dots = [
    [-0.38, 0.28, 0.1],
    [0.4, 0.27, 0.1],
    [0.0, -0.42, 0.08],
    [-0.14, -0.18, 0.06],
  ].map(([x, y, r]) => {
    const d = cylinder(r, r, 0.04, pepperoni);
    d.rotation.x = Math.PI / 2;
    return at(d, x, y, 0.17);
  });
  const hat = group(
    at(cylinder(0.17, 0.19, 0.2, mat(0xffffff, 0.7)), 0, 0.72, 0),
    at(sphere(0.24, mat(0xffffff, 0.75)), 0, 0.9, 0),
  );
  hat.rotation.z = -0.2;
  hat.position.x = 0.18;
  const body = group(slice, crust, ...dots, hat);
  const face = makeFace(0.5, 0x7a3a12);
  return rig({
    body,
    face,
    faceAt: new THREE.Vector3(0, 0.02, 0.2),
    shoulders: { x: 0.36, y: 0.1, z: 0 },
    limbColor: 0x8a4a22,
    glove: 0xffffff,
    shoe: 0xd2382f,
    bodyLift: 0.62,
    hipX: 0.1,
  });
}

function banana() {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.12, -0.72, 0),
    new THREE.Vector3(-0.08, -0.35, 0.05),
    new THREE.Vector3(-0.12, 0.15, 0.06),
    new THREE.Vector3(0.02, 0.6, 0.02),
    new THREE.Vector3(0.2, 0.86, 0),
  ]);
  const peel = mat(0xffd93d, 0.45);
  // A tube along the curve whose radius swells in the middle and tapers to the tips.
  const segments = 64;
  const radial = 32;
  const tube = new THREE.TubeGeometry(curve, segments, 1, radial, false);
  const position = tube.attributes.position;
  const vertex = new THREE.Vector3();
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const r = 0.05 + 0.27 * Math.sin(Math.PI * t) ** 0.65;
    const center = curve.getPointAt(t);
    for (let j = 0; j <= radial; j++) {
      const index = i * (radial + 1) + j;
      vertex.fromBufferAttribute(position, index).sub(center).multiplyScalar(r).add(center);
      position.setXYZ(index, vertex.x, vertex.y, vertex.z);
    }
  }
  tube.computeVertexNormals();
  const body = group(mesh(tube, peel));
  body.add(at(sphere(0.05, peel, 16), ...curve.getPointAt(0).toArray()));
  body.add(at(sphere(0.05, peel, 16), ...curve.getPointAt(1).toArray()));
  const tipColor = mat(0x6b4a26, 0.7);
  body.add(at(sphere(0.06, tipColor, 12), 0.13, -0.76, 0));
  const stem = cylinder(0.05, 0.07, 0.18, mat(0x8a9a3a, 0.6));
  stem.rotation.z = -0.6;
  body.add(at(stem, 0.27, 0.95, 0));
  const petal = mat(0xff6fa8, 0.5);
  const flower = new THREE.Group();
  for (let k = 0; k < 5; k++) {
    const p = sphere(0.08, petal, 16);
    const a = (k / 5) * Math.PI * 2;
    p.scale.set(1, 0.6, 0.4);
    p.position.set(Math.cos(a) * 0.08, Math.sin(a) * 0.08, 0);
    p.rotation.z = a;
    flower.add(p);
  }
  flower.add(sphere(0.045, mat(0xffe066, 0.5), 12));
  flower.position.set(-0.22, 0.55, 0.18);
  body.add(flower);
  const face = makeFace(0.5, 0x6b4a26);
  return rig({
    body,
    face,
    faceAt: new THREE.Vector3(-0.1, 0.1, 0.36),
    shoulders: { x: 0.27, y: -0.12, z: 0 },
    limbColor: 0x6b4a26,
    glove: 0xffffff,
    shoe: 0x3fb6d8,
    bodyLift: 0.66,
    hipX: 0.11,
  });
}

function carrot() {
  const profile = [];
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    const y = -0.8 + t * 1.45;
    const r =
      t > 0.92
        ? 0.36 * Math.sqrt(Math.max(0, 1 - ((t - 0.92) / 0.08) ** 2))
        : 0.03 + 0.33 * t ** 0.8;
    profile.push(new THREE.Vector2(Math.max(0.001, r), y));
  }
  const orange = mat(0xf28a2e, 0.55);
  const root = mesh(new THREE.LatheGeometry(profile, 40), orange);
  const ridge = mat(0xc9631a, 0.7);
  const ridges = [-0.45, -0.15, 0.2].map((y, i) => {
    const r = 0.03 + 0.33 * ((y + 0.8) / 1.45) ** 0.8;
    const ring = mesh(new THREE.TorusGeometry(r, 0.012, 6, 32, Math.PI * 0.7), ridge);
    ring.rotation.set(Math.PI / 2, 0, Math.PI * (0.15 + i * 0.1));
    ring.position.y = y;
    return ring;
  });
  const leaf = mat(0x4caf3c, 0.55);
  const leaves = [-0.75, -0.45, -0.15, 0.15, 0.45, 0.75].map((a, i) => {
    const l = sphere(0.11, i % 2 ? leaf : mat(0x6cc34a, 0.55), 16);
    l.scale.set(0.75, 3.6, 0.55);
    l.position.set(Math.sin(a) * 0.38, 0.62 + Math.cos(a) * 0.4, (i % 3) * 0.04 - 0.04);
    l.rotation.z = -a;
    return l;
  });
  const scarf = mesh(new THREE.TorusGeometry(0.2, 0.05, 10, 32), mat(0xe8433a, 0.6));
  scarf.rotation.x = Math.PI / 2;
  scarf.position.y = -0.16;
  const tail = capsule(0.045, 0.14, mat(0xe8433a, 0.6));
  tail.position.set(0.14, -0.25, 0.15);
  tail.rotation.z = 0.4;
  const body = group(root, ...ridges, ...leaves, scarf, tail);
  const face = makeFace(0.5, 0x8a3a10);
  return rig({
    body,
    face,
    faceAt: new THREE.Vector3(0, 0.15, 0.3),
    shoulders: { x: 0.3, y: 0.0, z: 0 },
    limbColor: 0x3f8a2f,
    glove: 0xffffff,
    shoe: 0x3a6fd8,
    bodyLift: 0.7,
    hipX: 0.07,
  });
}

function broccoli() {
  const stem = cylinder(0.27, 0.32, 0.8, mat(0xa6d86e, 0.55));
  stem.position.y = -0.2;
  const floret = mat(0x3f9a3a, 0.75);
  const light = mat(0x5cb84a, 0.75);
  const crown = [
    [0, 0.55, 0, 0.36],
    [-0.32, 0.42, 0.05, 0.27],
    [0.33, 0.43, 0.04, 0.28],
    [-0.2, 0.72, -0.05, 0.27],
    [0.22, 0.73, -0.04, 0.27],
    [0, 0.82, 0.12, 0.25],
    [-0.42, 0.62, -0.1, 0.2],
    [0.43, 0.62, -0.1, 0.2],
  ].map(([x, y, z, r], i) => at(sphere(r, i % 3 === 0 ? light : floret), x, y, z));
  const bumps = [];
  for (let k = 0; k < 18; k++) {
    const a = (k / 18) * Math.PI * 2;
    bumps.push(
      at(
        sphere(0.08, light, 12),
        Math.cos(a) * 0.38,
        0.7 + Math.sin(a * 3) * 0.12,
        Math.sin(a) * 0.3 + 0.08,
      ),
    );
  }
  const band = mesh(new THREE.TorusGeometry(0.3, 0.06, 10, 32), mat(0xe8433a, 0.6));
  band.rotation.x = Math.PI / 2;
  band.position.y = 0.2;
  const body = group(stem, ...crown, ...bumps, band);
  const face = makeFace(0.46, 0x2f6a24);
  return rig({
    body,
    face,
    faceAt: new THREE.Vector3(0, -0.12, 0.3),
    shoulders: { x: 0.31, y: -0.25, z: 0 },
    limbColor: 0x6aa84a,
    glove: 0xffffff,
    shoe: 0xf2a33a,
    bodyLift: 0.58,
  });
}

export const BUILDERS = { pizza, banana, carrot, broccoli };

/**
 * Poses a character for one frame. `move` picks the dance: 'idle', 'dance', 'wave', 'hop',
 * 'bend', 'flex', 'spin', 'march', 'cheer'. `beat` is the song position in beats.
 */
export function pose(
  c,
  { beat, move = 'dance', energy = 1, open = 0, blink = 0, lookX = 0, joy = 0.6, seed = 0 },
) {
  const phase = beat - Math.floor(beat);
  const bounce = Math.abs(Math.sin(Math.PI * phase));
  const side = Math.floor(beat) % 2 === 0 ? 1 : -1;
  const sway = Math.sin(Math.PI * (beat + seed) * 0.5);
  c.root.position.y = 0;
  c.root.rotation.y = 0;
  c.bodyPivot.rotation.set(0, 0, sway * 0.08 * energy);
  c.bodyPivot.position.y = HIP + bounce * 0.06 * energy;
  const squash = 1 - (1 - bounce) * 0.06 * energy;
  c.body.scale.set(1 + (1 - squash) * 0.6, squash, 1 + (1 - squash) * 0.6);
  const [left, right] = c.arms;
  const [legL, legR] = c.legs;
  left.rotation.set(0, 0, -0.4 - bounce * 0.25 * energy);
  right.rotation.set(0, 0, 0.4 + bounce * 0.25 * energy);
  legL.rotation.set(Math.sin(Math.PI * beat) * 0.25 * energy, 0, 0.05);
  legR.rotation.set(-Math.sin(Math.PI * beat) * 0.25 * energy, 0, -0.05);

  switch (move) {
    case 'idle':
      c.bodyPivot.position.y = HIP + Math.sin(beat * 0.8) * 0.01;
      left.rotation.z = -0.3;
      right.rotation.z = 0.3;
      legL.rotation.x = 0;
      legR.rotation.x = 0;
      c.body.scale.set(1, 1, 1);
      break;
    case 'wave':
      right.rotation.set(0, 0, 2.5 + Math.sin(beat * Math.PI * 2) * 0.35);
      break;
    case 'cheer': {
      const up = 2.4 + bounce * 0.3;
      left.rotation.z = -up;
      right.rotation.z = up;
      break;
    }
    case 'hop': {
      c.root.position.y = Math.sin(Math.PI * phase) * 0.35 * energy;
      legL.rotation.x = -0.4 * bounce;
      legR.rotation.x = -0.4 * bounce;
      left.rotation.z = -1.2;
      right.rotation.z = 1.2;
      break;
    }
    case 'bend': {
      const lean = Math.sin((Math.PI * beat) / 2);
      c.bodyPivot.rotation.z = lean * 0.4;
      left.rotation.z = -0.6 + lean * 0.8;
      right.rotation.z = 0.6 + lean * 0.8;
      break;
    }
    case 'flex': {
      const pump = 0.5 + 0.5 * Math.sin(Math.PI * 2 * phase);
      left.rotation.set(0, 0, -2.2 - pump * 0.3);
      right.rotation.set(0, 0, 2.2 + pump * 0.3);
      c.body.scale.multiplyScalar(1 + pump * 0.03);
      break;
    }
    case 'spin': {
      // One easy turn every two bars, not a dizzy spin.
      const turn = smoothstep(0, 1, ((beat % 8) - 4) / 4);
      c.root.rotation.y = turn * Math.PI * 2;
      left.rotation.z = -1.3;
      right.rotation.z = 1.3;
      break;
    }
    case 'march':
      left.rotation.x = Math.sin(Math.PI * beat) * 0.6;
      right.rotation.x = -Math.sin(Math.PI * beat) * 0.6;
      legL.rotation.x = -Math.sin(Math.PI * beat) * 0.5;
      legR.rotation.x = Math.sin(Math.PI * beat) * 0.5;
      break;
    default: {
      const pump = side * bounce;
      left.rotation.z = -0.9 - Math.max(0, pump) * 1.2;
      right.rotation.z = 0.9 + Math.max(0, -pump) * 1.2;
    }
  }
  c.face.set({ open, blink, lookX, lookY: 0.1, joy });
}

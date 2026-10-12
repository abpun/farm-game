import * as THREE from 'three';

/** Soft, slightly glossy toy-like material. */
export const mat = (color, roughness = 0.55, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, ...extra });

export const sphere = (r, material, seg = 32) =>
  mesh(new THREE.SphereGeometry(r, seg, Math.round(seg * 0.75)), material);
export const capsule = (r, length, material) =>
  mesh(new THREE.CapsuleGeometry(r, length, 8, 16), material);
export const cylinder = (rTop, rBottom, h, material, seg = 32) =>
  mesh(new THREE.CylinderGeometry(rTop, rBottom, h, seg), material);

export function mesh(geometry, material) {
  const m = new THREE.Mesh(geometry, material);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function group(...children) {
  const g = new THREE.Group();
  children.forEach((c) => g.add(c));
  return g;
}

export const at = (object, x, y, z) => {
  object.position.set(x, y, z);
  return object;
};

const EYE_WHITE = mat(0xffffff, 0.25);
const PUPIL = mat(0x1d1a2b, 0.2);
const SHINE = new THREE.MeshBasicMaterial({ color: 0xffffff });
const MOUTH = mat(0x5a1424, 0.6);
const TONGUE = mat(0xff6f86, 0.6);
const BROW_ARC = 1.5;
const CHEEK = mat(0xff8fa8, 0.8, { transparent: true, opacity: 0.75 });

/**
 * Big friendly face: eyes with pupils and shines, lids for blinking, brows, a mouth that
 * opens while singing and rosy cheeks. Faces +z; `size` scales everything.
 */
export function makeFace(size, browColor = 0x3b2a1a) {
  const face = new THREE.Group();
  const eyes = [];
  for (const side of [-1, 1]) {
    const eye = new THREE.Group();
    const white = sphere(0.24 * size, EYE_WHITE);
    white.scale.set(1, 1.18, 0.6);
    const pupil = sphere(0.13 * size, PUPIL);
    pupil.scale.set(1, 1.15, 0.6);
    pupil.position.set(0, -0.02 * size, 0.1 * size);
    const shine = sphere(0.045 * size, SHINE, 12);
    shine.position.set(-0.05 * size, 0.05 * size, 0.2 * size);
    const shine2 = sphere(0.022 * size, SHINE, 8);
    shine2.position.set(0.05 * size, -0.07 * size, 0.2 * size);
    eye.add(white, pupil, shine, shine2);
    eye.position.set(side * 0.28 * size, 0.18 * size, 0);
    // Brows are little arches (∩), which read as happy and curious.
    const brow = mesh(
      new THREE.TorusGeometry(0.13 * size, 0.032 * size, 8, 20, BROW_ARC),
      mat(browColor, 0.7),
    );
    brow.rotation.z = (Math.PI - BROW_ARC) / 2;
    brow.position.set(side * 0.28 * size, 0.42 * size, 0.04 * size);
    face.add(eye, brow);
    eyes.push({ eye, pupil, brow, side });
  }
  const mouth = new THREE.Group();
  const cavity = sphere(0.17 * size, MOUTH);
  cavity.scale.set(1.2, 0.6, 0.35);
  const tongue = sphere(0.1 * size, TONGUE);
  tongue.scale.set(1.2, 0.5, 0.4);
  tongue.position.set(0, -0.06 * size, 0.03 * size);
  mouth.add(cavity, tongue);
  mouth.position.set(0, -0.22 * size, 0.02 * size);
  const smile = mesh(new THREE.TorusGeometry(0.15 * size, 0.03 * size, 8, 24, Math.PI), MOUTH);
  smile.rotation.z = Math.PI;
  smile.position.set(0, -0.15 * size, 0.04 * size);
  for (const side of [-1, 1]) {
    const cheek = sphere(0.09 * size, CHEEK, 16);
    cheek.scale.set(1.3, 0.8, 0.3);
    cheek.position.set(side * 0.45 * size, -0.12 * size, 0.0);
    face.add(cheek);
  }
  face.add(mouth, smile);
  return {
    group: face,
    /** open 0..1 (singing), blink 0..1, look x/y in -1..1, joy 0..1 lifts the brows. */
    set({ open = 0, blink = 0, lookX = 0, lookY = 0, joy = 0.5 }) {
      const lid = 1 - 0.92 * blink;
      for (const { eye, pupil, brow, side } of eyes) {
        eye.scale.y = lid;
        pupil.position.x = lookX * 0.06 * size;
        pupil.position.y = -0.02 * size + lookY * 0.05 * size;
        brow.position.y = (0.4 + 0.07 * joy) * size;
        brow.rotation.z = (Math.PI - BROW_ARC) / 2 - side * 0.12 * joy;
      }
      const o = Math.max(0, Math.min(1, open));
      mouth.visible = o > 0.05;
      smile.visible = o <= 0.05;
      mouth.scale.set(0.85 + 0.25 * o, 0.25 + 1.1 * o, 1);
    },
  };
}

/** Arm from the shoulder (origin) down along -y, ending in a round glove. */
export function makeArm(color, gloveColor = 0xffffff, length = 0.55) {
  const pivot = new THREE.Group();
  const upper = capsule(0.055, length, mat(color, 0.6));
  upper.position.y = -length / 2;
  const glove = sphere(0.12, mat(gloveColor, 0.45));
  glove.position.y = -length - 0.08;
  glove.scale.set(1, 1.05, 0.85);
  const thumb = sphere(0.05, mat(gloveColor, 0.45), 12);
  thumb.position.set(0.09, -length - 0.02, 0.04);
  pivot.add(upper, glove, thumb);
  return pivot;
}

/** Leg from the hip (origin) down along -y, ending in a rounded shoe. */
export function makeLeg(color, shoeColor, length = 0.42) {
  const pivot = new THREE.Group();
  const leg = capsule(0.06, length, mat(color, 0.6));
  leg.position.y = -length / 2;
  const shoe = sphere(0.14, mat(shoeColor, 0.4));
  shoe.scale.set(1, 0.6, 1.5);
  shoe.position.set(0, -length - 0.06, 0.07);
  pivot.add(leg, shoe);
  return pivot;
}

export const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
export const lerp = (a, b, t) => a + (b - a) * t;
export const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

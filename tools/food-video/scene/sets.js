import * as THREE from 'three';
import { at, capsule, cylinder, group, mat, mesh, sphere } from './kit.js';

function gradient(top, bottom) {
  const c = document.createElement('canvas');
  c.width = 2;
  c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 2, 256);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function checker(a, b, repeat) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  for (let y = 0; y < 2; y++)
    for (let x = 0; x < 2; x++) {
      ctx.fillStyle = (x + y) % 2 ? a : b;
      ctx.fillRect(x * 32, y * 32, 32, 32);
    }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function floor(material, radius = 9) {
  const f = mesh(new THREE.CircleGeometry(radius, 64), material);
  f.rotation.x = -Math.PI / 2;
  f.castShadow = false;
  return f;
}

function wall(color, width = 22, height = 9, z = -4) {
  const w = mesh(new THREE.PlaneGeometry(width, height), mat(color, 0.9));
  w.position.set(0, height / 2 - 0.5, z);
  w.castShadow = false;
  return w;
}

function balloon(color, x, y, z) {
  const b = sphere(0.32, mat(color, 0.3), 24);
  b.scale.set(1, 1.2, 1);
  const knot = at(sphere(0.05, mat(color, 0.4), 8), 0, -0.4, 0);
  const string = at(cylinder(0.006, 0.006, 1.4, mat(0xffffff, 0.8), 6), 0, -1.1, 0);
  return at(group(b, knot, string), x, y, z);
}

function bunting(colors, width, y, z) {
  const g = new THREE.Group();
  const n = 13;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const x = (t - 0.5) * width;
    const sag = Math.sin(Math.PI * t) * 0.5;
    const flag = mesh(new THREE.ConeGeometry(0.2, 0.38, 3), mat(colors[i % colors.length], 0.6));
    flag.rotation.z = Math.PI;
    flag.position.set(x, y - sag, z);
    g.add(flag);
  }
  return g;
}

function star(color, size) {
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? size * 0.45 : size;
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    const p = [Math.cos(a) * r, Math.sin(a) * r];
    if (i === 0) shape.moveTo(...p);
    else shape.lineTo(...p);
  }
  const s = mesh(
    new THREE.ExtrudeGeometry(shape, {
      depth: size * 0.25,
      bevelEnabled: true,
      bevelSize: size * 0.08,
      bevelThickness: size * 0.08,
      bevelSegments: 3,
    }),
    mat(color, 0.35, { emissive: color, emissiveIntensity: 0.25 }),
  );
  return s;
}

function roundTree(x, z, scale, leaf = 0x5cb84a) {
  return at(
    group(
      at(cylinder(0.12 * scale, 0.16 * scale, 1 * scale, mat(0x8a5a32, 0.8)), 0, 0.5 * scale, 0),
      at(sphere(0.6 * scale, mat(leaf, 0.8)), 0, 1.3 * scale, 0),
      at(sphere(0.45 * scale, mat(leaf, 0.8)), 0.4 * scale, 1.1 * scale, 0.1),
      at(sphere(0.42 * scale, mat(leaf, 0.8)), -0.4 * scale, 1.15 * scale, 0),
    ),
    x,
    0,
    z,
  );
}

function cloud(x, y, z) {
  const white = mat(0xffffff, 0.9);
  return at(
    group(
      sphere(0.5, white),
      at(sphere(0.38, white), 0.5, -0.1, 0),
      at(sphere(0.35, white), -0.5, -0.12, 0),
    ),
    x,
    y,
    z,
  );
}

function sun(x, y, z) {
  const s = sphere(0.8, new THREE.MeshBasicMaterial({ color: 0xfff1a0 }));
  return at(s, x, y, z);
}

/** Each set: objects, sky gradient, fog colour and an update for gentle motion. */
export const SETS = {
  kitchen() {
    const g = group(
      floor(mat(0xffffff, 0.8, { map: checker('#ff8fa8', '#fff4f4', 18) })),
      wall(0xbfe6ff),
    );
    const table = at(cylinder(1.6, 1.6, 0.15, mat(0xf2b766, 0.6)), 0, 0.75, 0);
    const leg = at(cylinder(0.15, 0.2, 0.75, mat(0xd9893b, 0.6)), 0, 0.37, 0);
    const plate = at(cylinder(0.85, 0.7, 0.06, mat(0xffffff, 0.3)), 0, 0.86, 0);
    const dome = mesh(
      new THREE.SphereGeometry(0.7, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2),
      mat(0xdfe8f2, 0.18, { metalness: 0.6 }),
    );
    dome.position.y = 0.88;
    const knob = at(sphere(0.1, mat(0xdfe8f2, 0.2, { metalness: 0.6 })), 0, 1.62, 0);
    const cloche = group(dome, knob);
    const window = at(
      mesh(new THREE.PlaneGeometry(2.4, 1.6), mat(0xffffff, 0.9)),
      -2.6,
      2.6,
      -3.95,
    );
    const pane = at(mesh(new THREE.PlaneGeometry(2.1, 1.3), mat(0x8fd3ff, 0.4)), -2.6, 2.6, -3.94);
    g.add(table, leg, plate, cloche, window, pane);
    return {
      group: g,
      sky: gradient('#bfe6ff', '#fff6e0'),
      fog: 0xfff6e0,
      update(t, beat) {
        cloche.rotation.z = Math.sin(beat * Math.PI) * 0.05;
        cloche.position.y = Math.abs(Math.sin(beat * Math.PI)) * 0.04;
      },
    };
  },

  party() {
    const g = group(floor(mat(0xffe3b8, 0.8)), wall(0xffb7c9));
    g.add(bunting([0xff5d73, 0xffd23f, 0x3fc1c9, 0x8e7dff], 9, 3.4, -3.5));
    const balloons = [
      balloon(0xff5d73, -3, 2.6, -2.5),
      balloon(0xffd23f, -2.3, 2.9, -3),
      balloon(0x3fc1c9, 2.6, 2.7, -2.6),
      balloon(0x8e7dff, 3.2, 2.4, -2),
    ];
    const gifts = [
      [-2.2, 0.3, 0xff5d73, 0xffd23f],
      [2.3, 0.35, 0x3fc1c9, 0xffffff],
    ].map(([x, s, a, b]) =>
      group(
        at(mesh(new THREE.BoxGeometry(s * 2, s * 2, s * 2), mat(a, 0.5)), x, s, -1),
        at(mesh(new THREE.BoxGeometry(s * 2.05, s * 0.4, s * 2.05), mat(b, 0.5)), x, s, -1),
      ),
    );
    g.add(...balloons, ...gifts);
    return {
      group: g,
      sky: gradient('#ffd1dc', '#fff0d6'),
      fog: 0xfff0d6,
      update(t) {
        balloons.forEach((b, i) => {
          b.userData.y ??= b.position.y;
          b.position.y = b.userData.y + Math.sin(t * 1.3 + i) * 0.08;
        });
      },
    };
  },

  beach() {
    const g = group(floor(mat(0xffe08a, 0.9)));
    const sea = at(mesh(new THREE.PlaneGeometry(40, 6), mat(0x3fc1d9, 0.3)), 0, 0.01, -6);
    sea.rotation.x = -Math.PI / 2;
    const palm = group(
      ...Array.from({ length: 7 }, (_, i) =>
        at(
          cylinder(0.13, 0.15, 0.45, mat(i % 2 ? 0xa0703f : 0x8a5a32, 0.8)),
          Math.sin(i * 0.25) * 0.3,
          0.22 + i * 0.42,
          0,
        ),
      ),
    );
    for (let k = 0; k < 6; k++) {
      const frond = capsule(0.12, 1.4, mat(0x4caf50, 0.6));
      frond.scale.set(1, 1, 0.35);
      const a = (k / 6) * Math.PI * 2;
      frond.position.set(0.5 + Math.cos(a) * 0.6, 3.05, Math.sin(a) * 0.6);
      frond.rotation.set(Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1);
      palm.add(frond);
    }
    palm.position.set(-3, 0, -2);
    const ball = group(
      at(sphere(0.35, mat(0xff5d73, 0.4)), 0, 0.35, 0),
      at(sphere(0.352, mat(0xffffff, 0.4), 16), 0, 0.35, 0),
    );
    ball.children[1].scale.set(1, 1, 0.3);
    ball.position.set(2.4, 0, -0.6);
    const umbrella = group(
      at(cylinder(0.04, 0.04, 2.2, mat(0xffffff, 0.6)), 0, 1.1, 0),
      at(mesh(new THREE.ConeGeometry(1.2, 0.5, 16), mat(0xffd23f, 0.6)), 0, 2.3, 0),
    );
    umbrella.position.set(3, 0, -2.5);
    g.add(sea, palm, ball, umbrella, sun(4, 4.5, -8), cloud(-2, 4, -7));
    return {
      group: g,
      sky: gradient('#5fd0f2', '#d9f6ff'),
      fog: 0xd9f6ff,
      update(t) {
        ball.rotation.y = t * 0.6;
      },
    };
  },

  garden() {
    const g = group(floor(mat(0x8ed16f, 0.9)));
    for (const z of [-1.4, -2.4]) {
      const row = mesh(new THREE.BoxGeometry(7, 0.18, 0.55), mat(0x8a5a32, 0.9));
      row.position.set(0, 0.06, z);
      g.add(row);
      for (let x = -3; x <= 3; x += 0.8) {
        const tops = group(
          ...[-0.3, 0, 0.3].map((a) => {
            const leaf = sphere(0.06, mat(0x4caf3c, 0.6), 10);
            leaf.scale.set(0.8, 3, 0.5);
            leaf.rotation.z = a;
            leaf.position.set(Math.sin(a) * 0.08, 0.3, 0);
            return leaf;
          }),
        );
        tops.position.set(x, 0, z);
        g.add(tops);
      }
    }
    const white = mat(0xffffff, 0.6);
    for (let x = -5; x <= 5; x += 0.5)
      g.add(at(mesh(new THREE.BoxGeometry(0.18, 0.9, 0.06), white), x, 0.45, -3.4));
    g.add(at(mesh(new THREE.BoxGeometry(10.5, 0.1, 0.05), white), 0, 0.65, -3.38));
    g.add(sun(-4, 4.4, -8), cloud(2.5, 3.8, -7), cloud(-1, 4.4, -9));
    const can = group(
      at(cylinder(0.25, 0.28, 0.45, mat(0x3fa9f5, 0.4)), 0, 0.23, 0),
      at(cylinder(0.03, 0.05, 0.5, mat(0x3fa9f5, 0.4)), 0.35, 0.4, 0),
    );
    can.children[1].rotation.z = -0.9;
    can.position.set(2.4, 0, -0.5);
    g.add(can);
    return { group: g, sky: gradient('#7fd3ff', '#e8fbff'), fog: 0xe8fbff, update() {} };
  },

  park() {
    const g = group(floor(mat(0x9be27a, 0.9)));
    const hills = [
      [-5, -6, 3, 0x7bc95a],
      [4, -7, 3.6, 0x86d463],
      [0, -9, 4, 0x6fbf55],
    ].map(([x, z, r, c]) => {
      const h = sphere(r, mat(c, 0.95));
      h.scale.set(1.4, 0.45, 1);
      return at(h, x, 0, z);
    });
    g.add(
      ...hills,
      roundTree(-3.2, -2.5, 1.1),
      roundTree(3.4, -2.8, 1.25, 0x4caf3c),
      roundTree(-1.8, -4.5, 0.9),
    );
    const flowers = [];
    for (let i = 0; i < 14; i++) {
      const x = -4 + ((i * 0.63) % 8);
      const z = -0.5 - (i % 3) * 0.6;
      const f = group(
        at(cylinder(0.015, 0.015, 0.25, mat(0x3f8a2f, 0.7), 6), 0, 0.12, 0),
        at(sphere(0.07, mat([0xff6fa8, 0xffd23f, 0xffffff][i % 3], 0.5), 10), 0, 0.27, 0),
      );
      f.position.set(x, 0, z - 1.2);
      flowers.push(f);
    }
    g.add(...flowers, sun(3.5, 4.6, -9), cloud(-3, 4.2, -8));
    return { group: g, sky: gradient('#8fd8ff', '#f1fff0'), fog: 0xf1fff0, update() {} };
  },

  stage() {
    const g = group(floor(mat(0x6a4fc9, 0.5)), wall(0x3b2a7a, 24, 10, -5));
    const platform = at(cylinder(3.2, 3.4, 0.25, mat(0xff8fd0, 0.35)), 0, 0.12, 0);
    platform.receiveShadow = true;
    const rim = mesh(
      new THREE.TorusGeometry(3.3, 0.06, 8, 64),
      mat(0xffe066, 0.3, { emissive: 0xffe066, emissiveIntensity: 0.6 }),
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.25;
    const stars = [
      [-3.6, 3.2, -4.6, 0.45, 0xffe066],
      [3.8, 3.6, -4.6, 0.55, 0xff8fd0],
      [-1.8, 4.2, -4.7, 0.3, 0x7fe0ff],
      [1.6, 4.4, -4.7, 0.35, 0xffe066],
      [0, 3.4, -4.7, 0.25, 0xffffff],
    ].map(([x, y, z, s, c]) => at(star(c, s), x, y, z));
    const curtains = [-1, 1].map((side) => {
      const c = mesh(
        new THREE.CylinderGeometry(0.9, 1.2, 9, 24, 1, true, 0, Math.PI),
        mat(0xd23a5a, 0.7, { side: THREE.DoubleSide }),
      );
      c.position.set(side * 6, 4, -3.5);
      return c;
    });
    g.add(platform, rim, ...stars, ...curtains);
    return {
      group: g,
      sky: gradient('#2a1d5c', '#6a4fc9'),
      fog: 0x3b2a7a,
      update(t) {
        stars.forEach((s, i) => (s.rotation.y = Math.sin(t * 0.8 + i) * 0.5));
      },
      platformTop: 0.25,
    };
  },

  finale() {
    const base = SETS.stage();
    const g = base.group;
    g.add(bunting([0xff5d73, 0xffd23f, 0x3fc1c9, 0x8e7dff, 0xffffff], 10, 4.2, -3));
    g.add(
      balloon(0xff5d73, -4, 2.8, -2),
      balloon(0xffd23f, -3.3, 3.2, -2.6),
      balloon(0x3fc1c9, 3.6, 3, -2.2),
      balloon(0x8e7dff, 4.2, 2.6, -1.8),
    );
    const confetti = [];
    const colors = [0xff5d73, 0xffd23f, 0x3fc1c9, 0x8e7dff, 0xffffff, 0x7bd96a];
    for (let i = 0; i < 160; i++) {
      const piece = new THREE.Mesh(
        new THREE.PlaneGeometry(0.07, 0.11),
        new THREE.MeshBasicMaterial({ color: colors[i % colors.length], side: THREE.DoubleSide }),
      );
      piece.userData = {
        x: (((i * 37) % 100) / 100) * 9 - 4.5,
        z: (((i * 53) % 100) / 100) * 4 - 2.5,
        speed: 0.5 + ((i * 17) % 10) / 20,
        phase: (i * 0.37) % 6,
      };
      confetti.push(piece);
      g.add(piece);
    }
    return {
      ...base,
      update(t, beat) {
        base.update(t, beat);
        for (const p of confetti) {
          const { x, z, speed, phase } = p.userData;
          const fall = (t * speed + phase) % 5.5;
          p.position.set(x + Math.sin(t * 2 + phase) * 0.2, 5 - fall, z);
          p.rotation.set(t * 3 + phase, t * 2 + phase, 0);
        }
      },
    };
  },
};

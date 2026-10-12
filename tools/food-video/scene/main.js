import * as THREE from 'three';
import { BUILDERS, pose } from './characters.js';
import { easeInOut, lerp, smoothstep } from './kit.js';
import { SETS } from './sets.js';

const W = 1920;
const H = 1080;
const WIPE = 0.45;
const END_IRIS = 1.2;
const POP = { start: 2.5, length: 0.7 };
const NAMES = {
  pizza: 'Pizza Pete',
  banana: 'Bella Banana',
  carrot: 'Carlo Carrot',
  broccoli: 'Bobby Broccoli',
};
const SET_FOR = { pizza: 'party', banana: 'beach', carrot: 'garden', broccoli: 'park' };
const SPECIAL = { pizza: 'spin', banana: 'bend', carrot: 'hop', broccoli: 'flex' };
const SPACING = 1.8;
const HEAD = 1.25;

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, W / H, 0.1, 100);
scene.add(new THREE.HemisphereLight(0xfff4e6, 0x8a7a9a, 1.2));
const key = new THREE.DirectionalLight(0xffffff, 2.2);
key.position.set(-3, 6, 5);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 0.5, far: 25 });
key.shadow.radius = 4;
key.shadow.bias = -0.0005;
scene.add(key);
const fill = new THREE.DirectionalLight(0xcfe3ff, 0.6);
fill.position.set(4, 3, 4);
scene.add(fill);
const rim = new THREE.DirectionalLight(0xffe2f0, 0.8);
rim.position.set(0, 4, -6);
scene.add(rim);

const sets = Object.fromEntries(
  Object.entries(SETS).map(([name, build]) => {
    const set = build();
    set.group.visible = false;
    scene.add(set.group);
    return [name, set];
  }),
);
const cast = Object.fromEntries(
  Object.entries(BUILDERS).map(([name, build]) => {
    const c = build();
    c.root.visible = false;
    scene.add(c.root);
    return [name, c];
  }),
);

// Where each face sits relative to its character's feet when standing still.
const restFace = Object.fromEntries(
  Object.entries(cast).map(([name, c]) => {
    pose(c, { beat: 0, move: 'idle' });
    c.root.updateMatrixWorld(true);
    return [name, c.face.group.getWorldPosition(new THREE.Vector3()).sub(c.root.position)];
  }),
);

const out = document.createElement('canvas');
out.width = W;
out.height = H;
document.body.appendChild(out);
const ctx = out.getContext('2d');

let timeline = null;
let plan = [];

const setOf = (s) => {
  if (s.kind === 'intro') return 'kitchen';
  if (s.kind === 'reveal' || s.kind === 'verse') return SET_FOR[s.cast[0]];
  if (s.name.startsWith('finale') || s.kind === 'outro') return 'finale';
  return 'stage';
};

/** Called once with the song timeline before any frame is rendered. */
window.init = (data) => {
  timeline = data;
  for (const food of Object.keys(timeline.sung)) timeline.sung[food].sort((a, b) => a[0] - b[0]);
  plan = timeline.sections.map((s, i, all) => {
    const set = setOf(s);
    const prev = all[i - 1];
    const next = all[i + 1];
    const wipeShape = (to) => (to === 'stage' || to === 'finale' ? 'star' : 'circle');
    return {
      ...s,
      set,
      wipeIn: !prev || setOf(prev) !== set ? wipeShape(set) : null,
      wipeOut: next && setOf(next) !== set ? wipeShape(setOf(next)) : null,
    };
  });
  return timeline.duration;
};

// ------------------------------------------------------------------ shots

const view = (pos, target, fov = 35) => ({
  pos: new THREE.Vector3(...pos),
  target: new THREE.Vector3(...target),
  fov,
});

/** Camera for a section at local time `lt` (seconds), plus the move each dancer does. */
function shot(section, lt, bar) {
  const b = lt / bar;
  const shotIndex = Math.floor(b / 2);
  const k = (b % 2) / 2;
  const n = section.cast.length;
  const span = ((n - 1) / 2) * SPACING;
  const lift = section.set === 'stage' || section.set === 'finale' ? 0.25 : 0;
  const y = HEAD + lift;
  const focus = section.cast[0];
  switch (section.kind) {
    case 'intro': {
      const t = easeInOut(lt / (section.end - section.start));
      return {
        cam: [view([0, 2.4, 7.5], [0, 1.1, 0]), view([0, 1.6, 3.4], [0, 1.15, 0])],
        k: t,
        move: 'idle',
      };
    }
    case 'reveal':
      return {
        cam: [view([0, 1.5, 7.4], [0, 1.0, 0]), view([0, 1.35, 5.4], [0, 1.05, 0])],
        k: easeInOut(b / 2),
        move: 'wave',
      };
    case 'verse': {
      const shots = [
        {
          cam: [view([0.4, 1.4, 3.9], [0, y - 0.05, 0]), view([0.15, 1.35, 3.1], [0, y, 0])],
          move: 'dance',
        },
        {
          track: focus,
          offsets: [
            [-0.35, 0.05, 1.95],
            [0.25, 0.05, 1.8],
          ],
          move: 'dance',
          energy: 0.6,
        },
        {
          cam: [view([-1.4, 1.2, 5.2], [-0.2, 0.95, 0]), view([1.2, 1.25, 5.0], [0.2, 0.95, 0])],
          move: SPECIAL[focus],
        },
        {
          cam: [view([1.0, 1.6, 4.4], [0, 1.05, 0]), view([-0.6, 1.5, 4.0], [0, 1.1, 0])],
          move: b >= 7 ? 'wave' : 'cheer',
        },
      ];
      return { ...shots[Math.min(3, shotIndex)], k: easeInOut(k) };
    }
    case 'chorus': {
      const wide = 6.2 + span * 1.2;
      const shots = [
        {
          cam: [
            view([0, 2.2, wide + 1.2], [0, 1.1 + lift, 0]),
            view([0, 1.9, wide], [0, 1.15 + lift, 0]),
          ],
          move: 'dance',
        },
        {
          cam: [
            view([-span - 0.8, 1.6, 3.6], [-span, y - 0.1, 0]),
            view([span + 0.8, 1.6, 3.6], [span, y - 0.1, 0]),
          ],
          move: 'dance',
        },
        {
          cam: [
            view([0, 1.4, wide - 0.4], [0, 1.15 + lift, 0]),
            view([0.5, 1.6, wide - 0.8], [0, 1.2 + lift, 0]),
          ],
          move: 'hop',
        },
        {
          cam: [
            view([-0.6, 1.8, wide - 1], [0, 1.15 + lift, 0]),
            view([0.6, 1.7, wide - 1.6], [0, 1.2 + lift, 0]),
          ],
          move: 'cheer',
        },
      ];
      if (section.name === 'finale-2') {
        if (b < 4) {
          const who = section.cast[Math.floor(b)];
          return {
            track: who,
            offsets: [
              [-0.2, 0.1, 2.15],
              [0.2, 0.1, 2.0],
            ],
            k: b % 1,
            move: 'dance',
          };
        }
        if (b < 6) return { ...shots[0], k: easeInOut((b - 4) / 2), move: 'spin' };
      }
      return { ...shots[Math.min(3, shotIndex)], k: easeInOut(k) };
    }
    default: {
      const t = easeInOut(lt / (section.end - section.start));
      return {
        cam: [
          view([0, 1.9, 6.4 + span], [0, 1.2 + lift, 0]),
          view([0, 2.3, 8.6 + span], [0, 1.2 + lift, 0]),
        ],
        k: t,
        move: 'wave',
      };
    }
  }
}

// ------------------------------------------------------------------ singing

function mouth(food, t) {
  const events = timeline.sung[food];
  let lo = 0;
  let hi = events.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (events[mid][0] <= t) lo = mid;
    else hi = mid - 1;
  }
  let open = 0;
  for (let i = Math.max(0, lo - 1); i <= Math.min(events.length - 1, lo + 1); i++) {
    const [start, end, note] = events[i];
    if (t < start - 0.05 || t > end + 0.08) continue;
    const env =
      smoothstep(start - 0.05, start + 0.03, t) * (1 - smoothstep(end - 0.02, end + 0.08, t));
    const size = 0.55 + 0.4 * Math.min(1, Math.max(0, (note - 60) / 12));
    open = Math.max(open, env * size * (0.85 + 0.15 * Math.sin(t * 23)));
  }
  return open;
}

const blinkOf = (t, seed) => {
  const p = (t + seed * 1.37) % 3.9;
  return p < 0.14 ? Math.sin((p / 0.14) * Math.PI) : 0;
};

// ------------------------------------------------------------------ overlays

const FONT = '"Fredoka", "Liberation Sans", sans-serif';

function title(text, alpha, y = H * 0.2, size = 120) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `700 ${size}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const scale = 0.85 + 0.15 * alpha;
  ctx.translate(W / 2, y);
  ctx.scale(scale, scale);
  ctx.lineJoin = 'round';
  ctx.lineWidth = size * 0.16;
  ctx.strokeStyle = '#5a2a6a';
  ctx.strokeText(text, 0, 0);
  const g = ctx.createLinearGradient(0, -size / 2, 0, size / 2);
  g.addColorStop(0, '#ffe066');
  g.addColorStop(1, '#ff8a3d');
  ctx.fillStyle = g;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

function nameCard(text, alpha) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `700 64px ${FONT}`;
  const w = ctx.measureText(text).width + 80;
  const x = W / 2 - w / 2;
  const y = H - 170 + (1 - alpha) * 30;
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, 100, 50);
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#ff8a3d';
  ctx.stroke();
  ctx.fillStyle = '#5a2a6a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, W / 2, y + 52);
  ctx.restore();
}

function starPath(cx, cy, r) {
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * 0.48 : r;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/** Covers the frame except an opening of `open` (0 closed .. 1 fully open). */
function wipe(shape, open) {
  if (open >= 1) return;
  const r = Math.hypot(W, H) * (shape === 'star' ? 0.95 : 0.6) * open;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  if (shape === 'star') starPath(W / 2, H / 2, r);
  else ctx.arc(W / 2, H / 2, Math.max(0.1, r), 0, Math.PI * 2, true);
  ctx.fillStyle = shape === 'star' ? '#ff8fd0' : '#ffd23f';
  ctx.fill('evenodd');
  ctx.lineWidth = 18;
  ctx.strokeStyle = '#ffffff';
  ctx.beginPath();
  if (shape === 'star') starPath(W / 2, H / 2, r);
  else ctx.arc(W / 2, H / 2, Math.max(0.1, r), 0, Math.PI * 2);
  if (open > 0) ctx.stroke();
  ctx.restore();
}

function sparkles(x, y, progress) {
  if (progress <= 0 || progress >= 1) return;
  ctx.save();
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const d = 60 + progress * 260 * (0.7 + 0.3 * ((i * 7) % 3));
    ctx.globalAlpha = 1 - progress;
    ctx.fillStyle = ['#ffe066', '#ffffff', '#ff8fd0', '#7fe0ff'][i % 4];
    ctx.beginPath();
    starPath(x + Math.cos(a) * d, y + Math.sin(a) * d, 18 * (1 - progress * 0.5));
    ctx.fill();
  }
  ctx.restore();
}

const project = (v) => {
  const p = v.clone().project(camera);
  return { x: (p.x * 0.5 + 0.5) * W, y: (-p.y * 0.5 + 0.5) * H };
};

// ------------------------------------------------------------------ frame

/** Renders the frame at song time t (seconds) into the output canvas. */
window.renderAt = (t) => {
  const section = plan.find((s) => t >= s.start && t < s.end) ?? plan[plan.length - 1];
  const lt = t - section.start;
  const beat = t / timeline.beat;
  for (const [name, set] of Object.entries(sets)) set.group.visible = name === section.set;
  const set = sets[section.set];
  set.update(t, beat);
  scene.background = set.sky;
  scene.fog = new THREE.Fog(set.fog, 14, 30);

  const s = shot(section, lt, timeline.bar);
  const lift = section.set === 'stage' || section.set === 'finale' ? 0.25 : 0;
  const present = section.kind === 'intro' ? [] : section.cast;
  let popAt = null;
  Object.entries(cast).forEach(([name, c], seed) => {
    const index = present.indexOf(name);
    c.root.visible = index >= 0;
    if (index < 0) return;
    const n = present.length;
    let move = s.move;
    let scale = 1;
    if (section.kind === 'reveal') {
      const p = (lt - POP.start) / POP.length;
      if (p < 0) {
        c.root.visible = false;
        return;
      }
      scale = p < 1 ? Math.sin(Math.min(1, p) * Math.PI * 0.75) / Math.sin(Math.PI * 0.75) : 1;
      if (p < 1) popAt = new THREE.Vector3(0, 1.2, 0);
    }
    if (section.name === 'finale-2' && lt / timeline.bar < 4) move = 'dance';
    pose(c, {
      beat: beat + seed * 0.12 * (move === 'dance' ? 1 : 0),
      move,
      energy: s.energy ?? 1,
      open: mouth(name, t),
      blink: blinkOf(t, seed),
      lookX: Math.sin(t * 0.7 + seed) * 0.25,
      joy: 0.5 + 0.4 * Math.abs(Math.sin(beat * Math.PI * 0.25)),
      seed,
    });
    c.root.position.x = (index - (n - 1) / 2) * SPACING;
    c.root.position.z = 0;
    c.root.position.y += lift;
    c.root.scale.setScalar(scale);
  });

  if (s.track) {
    // Close-ups frame the face where it rests, so the camera does not bob with the dance.
    const c = cast[s.track];
    const face = new THREE.Vector3(c.root.position.x, lift, 0).add(restFace[s.track]);
    const [from, to] = s.offsets.map((o) => face.clone().add(new THREE.Vector3(...o)));
    s.cam = [
      { pos: from, target: face, fov: 35 },
      { pos: to, target: face, fov: 35 },
    ];
  }
  const [a, b] = s.cam;
  camera.position.lerpVectors(a.pos, b.pos, s.k);
  const target = new THREE.Vector3().lerpVectors(a.target, b.target, s.k);
  camera.fov = lerp(a.fov, b.fov, s.k);
  camera.updateProjectionMatrix();
  camera.lookAt(target);

  renderer.render(scene, camera);
  ctx.drawImage(renderer.domElement, 0, 0);

  if (section.kind === 'intro') {
    title(
      'If Food Could Talk!',
      smoothstep(0.6, 1.6, lt) * (1 - smoothstep(6.6, 7.4, lt)),
      H * 0.22,
      140,
    );
  }
  if (section.kind === 'reveal' || section.kind === 'verse') {
    const food = section.cast[0];
    const shown =
      section.kind === 'reveal'
        ? smoothstep(POP.start + 0.2, POP.start + 0.6, lt)
        : 1 - smoothstep(1.4, 1.9, lt);
    nameCard(NAMES[food], shown);
  }
  if (popAt) {
    const p = project(popAt);
    sparkles(p.x, p.y, (lt - POP.start) / (POP.length + 0.6));
  }
  if (section.kind === 'outro') {
    title('Bye-bye!', smoothstep(4.5, 5.2, lt), H * 0.2, 130);
  }
  const length = section.end - section.start;
  if (section.wipeIn && lt < WIPE) wipe(section.wipeIn, easeInOut(lt / WIPE));
  if (section.wipeOut && lt > length - WIPE) wipe(section.wipeOut, easeInOut((length - lt) / WIPE));
  // The song rings out after the last bar; the goodbye stays up, then a slow iris closes.
  const ending = timeline.duration - t;
  if (ending < END_IRIS) wipe('circle', easeInOut(Math.max(0, ending) / END_IRIS));
  return true;
};

window.frameJpeg = (quality = 0.92) => out.toDataURL('image/jpeg', quality);
window.ready = document.fonts.load(`700 64px ${FONT}`).then(() => true);

import type { IconName } from './uiTextures';

// Smooth, anti-aliased vector icons drawn on a 100×100 canvas and baked to a high-res
// texture, so the UI reads as clean flat art instead of upscaled pixel masks. Every shape
// is filled then given a dark rounded outline for a consistent cozy look.

const O = '#3a2112';

const C = {
  gold: '#f6c544',
  goldL: '#ffe59a',
  goldD: '#d08a1e',
  wood: '#c47a3a',
  woodL: '#e8a35c',
  woodD: '#8a4f22',
  green: '#5e9a34',
  greenL: '#9ccb4f',
  greenD: '#3f7a1e',
  red: '#d1492b',
  redL: '#e67a52',
  blue: '#3b7fc4',
  blueL: '#8fc0e8',
  glass: '#bfe0e8',
  white: '#fff4df',
  cream: '#ffeccb',
  paper: '#f6e3b8',
  pink: '#f3a9c0',
  pinkL: '#ffd4e0',
  soil: '#6e4626',
  steel: '#cdddea',
  gray: '#9b8a78',
  grayD: '#7a6f60',
  orange: '#e07b2a',
  darkHide: '#5a3a22',
} as const;

type Ctx = CanvasRenderingContext2D;

function fillStroke(ctx: Ctx, color: string, lw = 6): void {
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = lw;
  ctx.strokeStyle = O;
  ctx.stroke();
}

function strokeOnly(ctx: Ctx, color: string, lw: number): void {
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = lw;
  ctx.strokeStyle = color;
  ctx.stroke();
}

/** Strokes the current path with a dark outline, then the fill colour on top. */
function outlined(ctx: Ctx, color: string, lw: number): void {
  strokeOnly(ctx, O, lw + 6);
  strokeOnly(ctx, color, lw);
}

function circle(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.closePath();
}

function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.closePath();
}

function rrect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.closePath();
}

function poly(ctx: Ctx, pts: Array<[number, number]>, close = true): void {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  if (close) ctx.closePath();
}

function starPath(
  ctx: Ctx,
  cx: number,
  cy: number,
  outer: number,
  inner: number,
  points = 5,
  rot = -Math.PI / 2,
): void {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = rot + (i * Math.PI) / points;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.closePath();
}

function cog(
  ctx: Ctx,
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  color: string,
): void {
  for (let i = 0; i < 8; i++) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((i * Math.PI) / 4);
    rrect(ctx, -8, -rOuter, 16, rOuter - rInner + 8, 3);
    fillStroke(ctx, color);
    ctx.restore();
  }
  circle(ctx, cx, cy, rInner);
  fillStroke(ctx, color);
  circle(ctx, cx, cy, rInner * 0.42);
  fillStroke(ctx, C.cream);
}

function speaker(ctx: Ctx): void {
  poly(ctx, [
    [24, 42],
    [38, 42],
    [52, 28],
    [52, 72],
    [38, 58],
    [24, 58],
  ]);
  fillStroke(ctx, C.woodL);
}

function fruitTree(ctx: Ctx): void {
  rrect(ctx, 45, 52, 10, 30, 3);
  fillStroke(ctx, C.woodD);
  circle(ctx, 50, 38, 25);
  fillStroke(ctx, C.green);
  for (const [x, y] of [
    [40, 36],
    [60, 34],
    [50, 48],
    [58, 46],
  ] as const) {
    circle(ctx, x, y, 4);
    fillStroke(ctx, C.red, 4);
  }
}

const DRAW: Record<IconName, (ctx: Ctx) => void> = {
  coin: (ctx) => {
    circle(ctx, 50, 50, 36);
    fillStroke(ctx, C.gold);
    circle(ctx, 50, 50, 25);
    fillStroke(ctx, C.goldL, 4);
    starPath(ctx, 50, 50, 14, 6);
    fillStroke(ctx, C.goldD, 4);
  },
  clock: (ctx) => {
    circle(ctx, 50, 50, 34);
    fillStroke(ctx, C.white);
    circle(ctx, 50, 50, 34);
    strokeOnly(ctx, C.goldD, 3);
    poly(
      ctx,
      [
        [50, 50],
        [50, 28],
      ],
      false,
    );
    outlined(ctx, C.woodD, 5);
    poly(
      ctx,
      [
        [50, 50],
        [66, 56],
      ],
      false,
    );
    outlined(ctx, C.woodD, 5);
    circle(ctx, 50, 50, 4);
    fillStroke(ctx, C.woodD, 3);
  },
  seed: (ctx) => {
    ctx.beginPath();
    ctx.moveTo(50, 20);
    ctx.bezierCurveTo(72, 40, 66, 70, 50, 74);
    ctx.bezierCurveTo(34, 70, 28, 40, 50, 20);
    ctx.closePath();
    fillStroke(ctx, C.woodL);
    poly(
      ctx,
      [
        [50, 30],
        [50, 64],
      ],
      false,
    );
    strokeOnly(ctx, C.woodD, 4);
  },
  barn: (ctx) => {
    poly(ctx, [
      [18, 48],
      [50, 24],
      [82, 48],
    ]);
    fillStroke(ctx, '#9e3420');
    rrect(ctx, 26, 48, 48, 34, 2);
    fillStroke(ctx, C.red);
    rrect(ctx, 40, 58, 20, 24, 2);
    fillStroke(ctx, C.cream);
    poly(
      ctx,
      [
        [50, 58],
        [50, 82],
      ],
      false,
    );
    strokeOnly(ctx, C.woodD, 3);
    poly(
      ctx,
      [
        [40, 70],
        [60, 70],
      ],
      false,
    );
    strokeOnly(ctx, C.woodD, 3);
  },
  menu: (ctx) => {
    for (const y of [32, 47, 62]) {
      rrect(ctx, 24, y, 52, 9, 4);
      fillStroke(ctx, C.woodL);
    }
  },
  close: (ctx) => {
    poly(
      ctx,
      [
        [32, 32],
        [68, 68],
      ],
      false,
    );
    outlined(ctx, C.red, 10);
    poly(
      ctx,
      [
        [68, 32],
        [32, 68],
      ],
      false,
    );
    outlined(ctx, C.red, 10);
  },
  save: (ctx) => {
    rrect(ctx, 24, 24, 52, 52, 5);
    fillStroke(ctx, C.blue);
    rrect(ctx, 36, 24, 28, 16, 1);
    fillStroke(ctx, C.white, 4);
    rrect(ctx, 56, 26, 6, 12, 1);
    fillStroke(ctx, C.woodD, 3);
    rrect(ctx, 34, 48, 32, 24, 2);
    fillStroke(ctx, C.blueL, 4);
  },
  export: (ctx) => {
    rrect(ctx, 22, 64, 56, 16, 4);
    fillStroke(ctx, C.woodL);
    poly(ctx, [
      [36, 42],
      [50, 22],
      [64, 42],
    ]);
    fillStroke(ctx, C.green);
    rrect(ctx, 44, 40, 12, 22, 2);
    fillStroke(ctx, C.green);
  },
  import: (ctx) => {
    rrect(ctx, 22, 64, 56, 16, 4);
    fillStroke(ctx, C.woodL);
    poly(ctx, [
      [36, 44],
      [50, 62],
      [64, 44],
    ]);
    fillStroke(ctx, C.blue);
    rrect(ctx, 44, 24, 12, 22, 2);
    fillStroke(ctx, C.blue);
  },
  build: (ctx) => {
    rrect(ctx, 24, 32, 52, 42, 3);
    fillStroke(ctx, C.redL);
    for (const y of [46, 60]) {
      poly(
        ctx,
        [
          [24, y],
          [76, y],
        ],
        false,
      );
      strokeOnly(ctx, C.cream, 4);
    }
    poly(
      ctx,
      [
        [42, 32],
        [42, 46],
      ],
      false,
    );
    strokeOnly(ctx, C.cream, 4);
    poly(
      ctx,
      [
        [58, 46],
        [58, 60],
      ],
      false,
    );
    strokeOnly(ctx, C.cream, 4);
    poly(
      ctx,
      [
        [42, 60],
        [42, 74],
      ],
      false,
    );
    strokeOnly(ctx, C.cream, 4);
  },
  plants: (ctx) => {
    poly(ctx, [
      [38, 60],
      [62, 60],
      [58, 80],
      [42, 80],
    ]);
    fillStroke(ctx, C.wood);
    rrect(ctx, 34, 54, 32, 9, 3);
    fillStroke(ctx, C.woodL);
    poly(
      ctx,
      [
        [50, 56],
        [50, 34],
      ],
      false,
    );
    strokeOnly(ctx, C.greenD, 4);
    ellipse(ctx, 40, 42, 10, 7);
    fillStroke(ctx, C.green, 4);
    ellipse(ctx, 60, 40, 10, 7);
    fillStroke(ctx, C.greenL, 4);
  },
  chicken: (ctx) => {
    poly(ctx, [
      [34, 52],
      [20, 44],
      [30, 58],
    ]);
    fillStroke(ctx, C.white);
    ellipse(ctx, 52, 56, 20, 16);
    fillStroke(ctx, C.white);
    circle(ctx, 66, 44, 11);
    fillStroke(ctx, C.white);
    for (const [x, y] of [
      [62, 34],
      [67, 32],
      [72, 35],
    ] as const) {
      circle(ctx, x, y, 4);
      fillStroke(ctx, C.red, 3);
    }
    poly(ctx, [
      [76, 44],
      [85, 46],
      [76, 50],
    ]);
    fillStroke(ctx, C.goldD, 3);
    circle(ctx, 68, 44, 2.4);
    ctx.fillStyle = O;
    ctx.fill();
    for (const x of [48, 58]) {
      poly(
        ctx,
        [
          [x, 70],
          [x, 80],
        ],
        false,
      );
      strokeOnly(ctx, C.goldD, 4);
    }
  },
  cow: (ctx) => {
    ellipse(ctx, 30, 40, 9, 12);
    fillStroke(ctx, C.white);
    ellipse(ctx, 70, 40, 9, 12);
    fillStroke(ctx, C.white);
    rrect(ctx, 28, 30, 44, 40, 16);
    fillStroke(ctx, C.white);
    ellipse(ctx, 40, 40, 8, 6);
    fillStroke(ctx, C.darkHide, 3);
    rrect(ctx, 38, 52, 24, 16, 8);
    fillStroke(ctx, C.pink);
    for (const x of [45, 55]) {
      circle(ctx, x, 60, 2.6);
      ctx.fillStyle = O;
      ctx.fill();
    }
    for (const x of [42, 60]) {
      circle(ctx, x, 42, 2.6);
      ctx.fillStyle = O;
      ctx.fill();
    }
  },
  decor: (ctx) => {
    starPath(ctx, 50, 48, 26, 9, 4);
    fillStroke(ctx, C.gold);
    starPath(ctx, 74, 26, 11, 4, 4);
    fillStroke(ctx, C.goldL, 4);
    starPath(ctx, 26, 72, 9, 3.5, 4);
    fillStroke(ctx, C.goldL, 4);
  },
  lock: (ctx) => {
    ctx.beginPath();
    ctx.arc(50, 44, 15, Math.PI, 0, false);
    ctx.arc(50, 44, 8, 0, Math.PI, true);
    ctx.closePath();
    fillStroke(ctx, C.steel);
    rrect(ctx, 32, 46, 36, 32, 5);
    fillStroke(ctx, C.gold);
    circle(ctx, 50, 60, 4);
    fillStroke(ctx, C.goldD, 3);
    rrect(ctx, 48, 60, 4, 10, 2);
    fillStroke(ctx, C.goldD, 2);
  },
  market: (ctx) => {
    rrect(ctx, 24, 44, 6, 38, 2);
    fillStroke(ctx, C.wood);
    rrect(ctx, 70, 44, 6, 38, 2);
    fillStroke(ctx, C.wood);
    rrect(ctx, 20, 70, 60, 12, 2);
    fillStroke(ctx, C.woodL);
    rrect(ctx, 18, 28, 64, 16, 3);
    fillStroke(ctx, C.red);
    ctx.save();
    rrect(ctx, 18, 28, 64, 16, 3);
    ctx.clip();
    for (let x = 26; x < 82; x += 16) {
      rrect(ctx, x, 26, 8, 20, 0);
      ctx.fillStyle = C.cream;
      ctx.fill();
    }
    ctx.restore();
  },
  crafting: (ctx) => {
    poly(ctx, [
      [20, 44],
      [26, 38],
      [26, 50],
    ]);
    fillStroke(ctx, C.grayD);
    rrect(ctx, 24, 38, 52, 12, 2);
    fillStroke(ctx, C.gray);
    rrect(ctx, 44, 50, 12, 8, 1);
    fillStroke(ctx, C.grayD);
    rrect(ctx, 32, 58, 36, 12, 3);
    fillStroke(ctx, C.gray);
  },
  orders: (ctx) => {
    rrect(ctx, 26, 22, 48, 62, 4);
    fillStroke(ctx, C.cream);
    rrect(ctx, 40, 15, 20, 12, 3);
    fillStroke(ctx, C.woodL);
    for (const y of [40, 52, 64]) {
      poly(
        ctx,
        [
          [36, y],
          [64, y],
        ],
        false,
      );
      strokeOnly(ctx, C.woodD, 4);
    }
  },
  fishing: (ctx) => {
    ellipse(ctx, 46, 50, 22, 13);
    fillStroke(ctx, C.blue);
    poly(ctx, [
      [66, 50],
      [84, 40],
      [80, 50],
      [84, 60],
    ]);
    fillStroke(ctx, C.blue);
    poly(ctx, [
      [42, 38],
      [54, 30],
      [56, 40],
    ]);
    fillStroke(ctx, C.blueL, 4);
    circle(ctx, 34, 47, 4);
    fillStroke(ctx, C.white, 3);
    circle(ctx, 34, 47, 1.6);
    ctx.fillStyle = O;
    ctx.fill();
  },
  quests: (ctx) => {
    poly(ctx, [
      [28, 20],
      [72, 20],
      [72, 82],
      [50, 70],
      [28, 82],
    ]);
    fillStroke(ctx, C.red);
    starPath(ctx, 50, 42, 15, 6);
    fillStroke(ctx, C.gold, 4);
  },
  achievements: (ctx) => {
    ctx.beginPath();
    ctx.moveTo(30, 26);
    ctx.lineTo(70, 26);
    ctx.quadraticCurveTo(66, 56, 50, 60);
    ctx.quadraticCurveTo(34, 56, 30, 26);
    ctx.closePath();
    fillStroke(ctx, C.gold);
    ctx.beginPath();
    ctx.arc(30, 32, 8, Math.PI * 0.5, Math.PI * 1.5, true);
    strokeOnly(ctx, O, 4);
    ctx.beginPath();
    ctx.arc(70, 32, 8, Math.PI * 1.5, Math.PI * 0.5, true);
    strokeOnly(ctx, O, 4);
    rrect(ctx, 46, 60, 8, 10, 1);
    fillStroke(ctx, C.goldD, 3);
    rrect(ctx, 36, 72, 28, 8, 2);
    fillStroke(ctx, C.goldD);
  },
  farmhands: (ctx) => {
    poly(ctx, [
      [30, 82],
      [36, 62],
      [64, 62],
      [70, 82],
    ]);
    fillStroke(ctx, C.green);
    circle(ctx, 50, 46, 12);
    fillStroke(ctx, C.cream);
    ellipse(ctx, 50, 34, 22, 6);
    fillStroke(ctx, C.wood);
    rrect(ctx, 40, 22, 20, 12, 4);
    fillStroke(ctx, C.woodL);
  },
  friends: (ctx) => {
    poly(ctx, [
      [22, 80],
      [26, 58],
      [48, 58],
      [52, 80],
    ]);
    fillStroke(ctx, C.blue);
    circle(ctx, 37, 42, 10);
    fillStroke(ctx, C.cream);
    poly(ctx, [
      [48, 80],
      [52, 58],
      [74, 58],
      [78, 80],
    ]);
    fillStroke(ctx, C.green);
    circle(ctx, 63, 42, 10);
    fillStroke(ctx, C.cream);
  },
  mail: (ctx) => {
    rrect(ctx, 20, 30, 60, 40, 4);
    fillStroke(ctx, C.cream);
    poly(
      ctx,
      [
        [22, 33],
        [50, 54],
        [78, 33],
      ],
      false,
    );
    strokeOnly(ctx, C.woodD, 4);
  },
  spring: (ctx) => {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ellipse(ctx, 50 + Math.cos(a) * 18, 50 + Math.sin(a) * 18, 11, 9);
      fillStroke(ctx, C.pink);
    }
    circle(ctx, 50, 50, 11);
    fillStroke(ctx, C.gold);
  },
  summer: (ctx) => {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      poly(
        ctx,
        [
          [50 + Math.cos(a) * 24, 50 + Math.sin(a) * 24],
          [50 + Math.cos(a) * 38, 50 + Math.sin(a) * 38],
        ],
        false,
      );
      outlined(ctx, C.goldD, 5);
    }
    circle(ctx, 50, 50, 20);
    fillStroke(ctx, C.gold);
  },
  autumn: (ctx) => {
    poly(ctx, [
      [50, 18],
      [60, 36],
      [74, 34],
      [64, 50],
      [78, 54],
      [58, 62],
      [50, 82],
      [42, 62],
      [22, 54],
      [36, 50],
      [26, 34],
      [40, 36],
    ]);
    fillStroke(ctx, C.orange);
    poly(
      ctx,
      [
        [50, 30],
        [50, 78],
      ],
      false,
    );
    strokeOnly(ctx, '#b85a1c', 3);
  },
  winter: (ctx) => {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const dx = Math.cos(a);
      const dy = Math.sin(a);
      ctx.moveTo(50, 50);
      ctx.lineTo(50 + dx * 30, 50 + dy * 30);
      const bx = 50 + dx * 20;
      const by = 50 + dy * 20;
      const px = -dy;
      const py = dx;
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + px * 8 + dx * 6, by + py * 8 + dy * 6);
      ctx.moveTo(bx, by);
      ctx.lineTo(bx - px * 8 + dx * 6, by - py * 8 + dy * 6);
    }
    outlined(ctx, C.steel, 5);
  },
  reset: (ctx) => {
    ctx.beginPath();
    ctx.arc(50, 50, 24, Math.PI * 0.6, Math.PI * 2.1);
    outlined(ctx, C.red, 7);
    const a = Math.PI * 0.6;
    const hx = 50 + Math.cos(a) * 24;
    const hy = 50 + Math.sin(a) * 24;
    poly(ctx, [
      [hx - 10, hy - 2],
      [hx + 6, hy - 8],
      [hx + 4, hy + 10],
    ]);
    fillStroke(ctx, C.red, 4);
  },
  move: (ctx) => {
    poly(
      ctx,
      [
        [50, 16],
        [50, 84],
      ],
      false,
    );
    outlined(ctx, C.woodL, 7);
    poly(
      ctx,
      [
        [16, 50],
        [84, 50],
      ],
      false,
    );
    outlined(ctx, C.woodL, 7);
    for (const [dx, dy] of [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
    ] as const) {
      const tx = 50 + dx * 34;
      const ty = 50 + dy * 34;
      poly(ctx, [
        [tx - dx * 12 - dy * 9, ty - dy * 12 - dx * 9],
        [tx, ty],
        [tx - dx * 12 + dy * 9, ty - dy * 12 + dx * 9],
      ]);
      fillStroke(ctx, C.woodL, 4);
    }
  },
  rotate: (ctx) => {
    ctx.beginPath();
    ctx.arc(50, 52, 24, Math.PI * 1.15, Math.PI * 2.7);
    outlined(ctx, C.gold, 7);
    const a = Math.PI * 1.15;
    const hx = 50 + Math.cos(a) * 24;
    const hy = 52 + Math.sin(a) * 24;
    poly(ctx, [
      [hx - 11, hy - 3],
      [hx + 4, hy - 11],
      [hx + 7, hy + 7],
    ]);
    fillStroke(ctx, C.gold, 4);
  },
  star: (ctx) => {
    starPath(ctx, 50, 52, 34, 15);
    fillStroke(ctx, C.gold);
  },
  heart: (ctx) => {
    ctx.beginPath();
    ctx.moveTo(50, 80);
    ctx.bezierCurveTo(8, 52, 24, 18, 50, 40);
    ctx.bezierCurveTo(76, 18, 92, 52, 50, 80);
    ctx.closePath();
    fillStroke(ctx, C.red);
  },
  water: (ctx) => {
    ctx.beginPath();
    ctx.moveTo(50, 16);
    ctx.bezierCurveTo(80, 50, 74, 84, 50, 84);
    ctx.bezierCurveTo(26, 84, 20, 50, 50, 16);
    ctx.closePath();
    fillStroke(ctx, C.blue);
    ellipse(ctx, 40, 58, 6, 10);
    fillStroke(ctx, C.blueL, 3);
  },
  hammer: (ctx) => {
    rrect(ctx, 46, 34, 8, 46, 3);
    fillStroke(ctx, C.wood);
    rrect(ctx, 28, 22, 44, 16, 4);
    fillStroke(ctx, C.steel);
  },
  check: (ctx) => {
    poly(
      ctx,
      [
        [26, 52],
        [43, 70],
        [78, 30],
      ],
      false,
    );
    outlined(ctx, C.green, 11);
  },
  left: (ctx) => {
    poly(
      ctx,
      [
        [60, 24],
        [38, 50],
        [60, 76],
      ],
      false,
    );
    outlined(ctx, C.woodL, 10);
  },
  right: (ctx) => {
    poly(
      ctx,
      [
        [40, 24],
        [62, 50],
        [40, 76],
      ],
      false,
    );
    outlined(ctx, C.woodL, 10);
  },
  plus: (ctx) => {
    poly(ctx, [
      [39, 20],
      [61, 20],
      [61, 39],
      [80, 39],
      [80, 61],
      [61, 61],
      [61, 80],
      [39, 80],
      [39, 61],
      [20, 61],
      [20, 39],
      [39, 39],
    ]);
    fillStroke(ctx, C.green);
  },
  minus: (ctx) => {
    rrect(ctx, 20, 42, 60, 16, 8);
    fillStroke(ctx, C.red);
  },
  orchard: fruitTree,
  supplies: (ctx) => {
    rrect(ctx, 30, 42, 40, 40, 14);
    fillStroke(ctx, C.woodL);
    poly(ctx, [
      [34, 44],
      [42, 30],
      [58, 30],
      [66, 44],
    ]);
    fillStroke(ctx, C.wood);
    poly(
      ctx,
      [
        [42, 30],
        [58, 30],
      ],
      false,
    );
    strokeOnly(ctx, C.woodD, 4);
  },
  production: (ctx) => {
    rrect(ctx, 34, 26, 32, 12, 3);
    fillStroke(ctx, C.red);
    rrect(ctx, 32, 36, 36, 46, 8);
    fillStroke(ctx, C.glass);
    for (const [x, y] of [
      [44, 58],
      [56, 54],
      [50, 68],
    ] as const) {
      circle(ctx, x, y, 6);
      fillStroke(ctx, C.orange, 3);
    }
  },
  sheep: (ctx) => {
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      circle(ctx, 48 + Math.cos(a) * 20, 52 + Math.sin(a) * 18, 11);
      fillStroke(ctx, C.white);
    }
    circle(ctx, 48, 52, 20);
    ctx.fillStyle = C.white;
    ctx.fill();
    circle(ctx, 70, 48, 11);
    fillStroke(ctx, C.darkHide);
    for (const x of [58, 68]) {
      poly(
        ctx,
        [
          [x, 70],
          [x, 80],
        ],
        false,
      );
      strokeOnly(ctx, C.darkHide, 4);
    }
  },
  goat: (ctx) => {
    poly(ctx, [
      [42, 42],
      [30, 22],
      [40, 40],
    ]);
    fillStroke(ctx, C.woodL);
    poly(ctx, [
      [58, 42],
      [70, 22],
      [60, 40],
    ]);
    fillStroke(ctx, C.woodL);
    rrect(ctx, 38, 40, 24, 30, 11);
    fillStroke(ctx, C.cream);
    poly(ctx, [
      [44, 68],
      [50, 84],
      [56, 68],
    ]);
    fillStroke(ctx, C.cream);
    for (const x of [46, 54]) {
      circle(ctx, x, 52, 2.4);
      ctx.fillStyle = O;
      ctx.fill();
    }
  },
  pig: (ctx) => {
    poly(ctx, [
      [32, 30],
      [28, 46],
      [44, 38],
    ]);
    fillStroke(ctx, C.pink);
    poly(ctx, [
      [68, 30],
      [72, 46],
      [56, 38],
    ]);
    fillStroke(ctx, C.pink);
    circle(ctx, 50, 52, 26);
    fillStroke(ctx, C.pink);
    ellipse(ctx, 50, 58, 14, 10);
    fillStroke(ctx, C.pinkL);
    for (const x of [46, 54]) {
      circle(ctx, x, 58, 2.6);
      ctx.fillStyle = O;
      ctx.fill();
      circle(ctx, x - 8, 44, 2.6);
      ctx.fillStyle = O;
      ctx.fill();
    }
  },
  ribbon: (ctx) => {
    poly(ctx, [
      [40, 56],
      [50, 70],
      [60, 56],
      [58, 88],
      [50, 80],
      [42, 88],
    ]);
    fillStroke(ctx, C.red);
    circle(ctx, 50, 40, 22);
    fillStroke(ctx, C.gold);
    circle(ctx, 50, 40, 12);
    fillStroke(ctx, C.goldL, 4);
  },
  land: (ctx) => {
    poly(ctx, [
      [50, 36],
      [82, 54],
      [50, 72],
      [18, 54],
    ]);
    fillStroke(ctx, C.green);
    poly(
      ctx,
      [
        [58, 20],
        [58, 48],
      ],
      false,
    );
    strokeOnly(ctx, C.woodD, 4);
    poly(ctx, [
      [58, 22],
      [72, 27],
      [58, 32],
    ]);
    fillStroke(ctx, C.red, 4);
  },
  basket: (ctx) => {
    ctx.beginPath();
    ctx.arc(50, 46, 20, Math.PI, 0, true);
    strokeOnly(ctx, C.woodD, 6);
    poly(ctx, [
      [26, 48],
      [74, 48],
      [68, 80],
      [32, 80],
    ]);
    fillStroke(ctx, C.woodL);
    rrect(ctx, 22, 44, 56, 9, 3);
    fillStroke(ctx, C.wood);
    for (const x of [40, 50, 60]) {
      poly(
        ctx,
        [
          [x, 53],
          [x, 80],
        ],
        false,
      );
      strokeOnly(ctx, C.woodD, 3);
    }
  },
  sound: (ctx) => {
    speaker(ctx);
    for (const r of [10, 18]) {
      ctx.beginPath();
      ctx.arc(56, 50, r, -Math.PI / 3, Math.PI / 3);
      strokeOnly(ctx, O, 7);
      ctx.beginPath();
      ctx.arc(56, 50, r, -Math.PI / 3, Math.PI / 3);
      strokeOnly(ctx, C.green, 4);
    }
  },
  mute: (ctx) => {
    speaker(ctx);
    poly(
      ctx,
      [
        [62, 40],
        [80, 60],
      ],
      false,
    );
    outlined(ctx, C.red, 6);
    poly(
      ctx,
      [
        [80, 40],
        [62, 60],
      ],
      false,
    );
    outlined(ctx, C.red, 6);
  },
  boat: (ctx) => {
    poly(ctx, [
      [20, 56],
      [80, 56],
      [70, 76],
      [30, 76],
    ]);
    fillStroke(ctx, C.wood);
    poly(
      ctx,
      [
        [50, 18],
        [50, 52],
      ],
      false,
    );
    strokeOnly(ctx, C.woodD, 4);
    poly(ctx, [
      [52, 22],
      [74, 50],
      [52, 50],
    ]);
    fillStroke(ctx, C.white);
  },
  compass: (ctx) => {
    circle(ctx, 50, 50, 34);
    fillStroke(ctx, C.cream);
    poly(ctx, [
      [50, 22],
      [58, 50],
      [50, 44],
      [42, 50],
    ]);
    fillStroke(ctx, C.red, 4);
    poly(ctx, [
      [50, 78],
      [58, 50],
      [50, 56],
      [42, 50],
    ]);
    fillStroke(ctx, C.white, 4);
    circle(ctx, 50, 50, 4);
    fillStroke(ctx, C.woodD, 2);
  },
  pickaxe: (ctx) => {
    rrect(ctx, 46, 30, 8, 50, 3);
    fillStroke(ctx, C.wood);
    ctx.beginPath();
    ctx.moveTo(22, 40);
    ctx.quadraticCurveTo(50, 24, 78, 40);
    ctx.quadraticCurveTo(50, 32, 22, 40);
    ctx.closePath();
    fillStroke(ctx, C.steel);
  },
  chest: (ctx) => {
    rrect(ctx, 24, 48, 52, 30, 3);
    fillStroke(ctx, C.wood);
    ctx.beginPath();
    ctx.moveTo(24, 48);
    ctx.lineTo(24, 42);
    ctx.quadraticCurveTo(50, 28, 76, 42);
    ctx.lineTo(76, 48);
    ctx.closePath();
    fillStroke(ctx, C.woodL);
    rrect(ctx, 46, 40, 8, 38, 1);
    fillStroke(ctx, C.gold);
    rrect(ctx, 45, 56, 10, 9, 2);
    fillStroke(ctx, C.goldD, 3);
  },
  gear: (ctx) => cog(ctx, 50, 50, 36, 24, C.gray),
};

/** Draws the smooth vector icon for `name` into a 100×100 coordinate space. */
export function drawIcon(ctx: Ctx, name: IconName): void {
  DRAW[name](ctx);
}

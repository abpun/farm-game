// Writes the starting art PNGs from the procedural painters: terrain tilesets
// (public/assets/tiles/terrain-<season>.png) and crop sheets (public/assets/crops/<crop>.png).
// Edit the PNGs freely afterwards; rerunning this overwrites them (pass "tiles" or "crops"
// to bake only one kind).
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { createServer } from 'vite';

const TILES_DIR = 'public/assets/tiles';
const CROPS_DIR = 'public/assets/crops';
const only = process.argv[2];

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  if (only !== 'crops') {
    const { paintSheet } = await server.ssrLoadModule('/src/phaser/art/terrain/tileSheet.ts');
    const { SEASON_LOOKS } = await server.ssrLoadModule('/src/phaser/art/seasonLooks.ts');
    for (const seasonId of Object.keys(SEASON_LOOKS)) {
      write(TILES_DIR, `terrain-${seasonId}.png`, paintSheet(seasonId));
    }
  }
  if (only !== 'tiles') {
    const { paintCropSheet } = await server.ssrLoadModule('/src/phaser/art/crops/cropSheet.ts');
    const { default: cropData } = await server.ssrLoadModule('/src/data/crops.json');
    for (const crop of cropData.crops) write(CROPS_DIR, `${crop.id}.png`, paintCropSheet(crop));
  }
} finally {
  await server.close();
}

function write(dir, name, image) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/${name}`, encodePng(image.width, image.height, image.data));
  console.log(`wrote ${dir}/${name} (${image.width}×${image.height})`);
}

function encodePng(width, height, rgba) {
  const rows = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    rows[y * (width * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4).copy(
      rows,
      y * (width * 4 + 1) + 1,
    );
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function crc32(bytes) {
  let crc = ~0;
  for (const byte of bytes) {
    crc ^= byte;
    for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

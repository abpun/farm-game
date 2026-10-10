// Writes the starting terrain tilesets to public/assets/tiles/terrain-<season>.png from the
// procedural painter. Edit the PNGs freely afterwards; rerunning this overwrites them.
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { createServer } from 'vite';

const OUT_DIR = 'public/assets/tiles';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const { paintSheet } = await server.ssrLoadModule('/src/phaser/art/terrain/tileSheet.ts');
  const { SEASON_LOOKS } = await server.ssrLoadModule('/src/phaser/art/seasonLooks.ts');
  mkdirSync(OUT_DIR, { recursive: true });
  for (const seasonId of Object.keys(SEASON_LOOKS)) {
    const sheet = paintSheet(seasonId);
    const file = `${OUT_DIR}/terrain-${seasonId}.png`;
    writeFileSync(file, encodePng(sheet.width, sheet.height, sheet.data));
    console.log(`wrote ${file} (${sheet.width}×${sheet.height})`);
  }
} finally {
  await server.close();
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

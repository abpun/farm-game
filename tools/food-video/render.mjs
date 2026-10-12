// Renders the animation frame by frame in headless Chromium and writes JPEGs.
// usage: node render.mjs <timeline.json> <framesDir> [fps] [worker] [workers] [only=t1,t2,...]
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import { fileURLToPath, URL } from 'node:url';
import { createServer } from 'vite';

const [timelinePath, framesDir, fpsArg = '24', workerArg = '0', workersArg = '1', only] =
  process.argv.slice(2);
const fps = Number(fpsArg);
const worker = Number(workerArg);
const workers = Number(workersArg);
const timeline = JSON.parse(readFileSync(timelinePath, 'utf8'));
mkdirSync(framesDir, { recursive: true });

const server = await createServer({
  root: fileURLToPath(new URL('../..', import.meta.url)),
  // No watching or hot reload: a file saved mid-render must not reload the page.
  server: { port: 5300 + worker, strictPort: true, hmr: false, watch: { ignored: ['**/*'] } },
  logLevel: 'error',
});
await server.listen();
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('pageerror', (e) => console.error('pageerror', e.message));
await page.goto(`http://localhost:${5300 + worker}/tools/food-video/scene/index.html`);
await page.waitForFunction(() => typeof window.renderAt === 'function');
const duration = await page.evaluate((data) => window.init(data), timeline);
await page.evaluate(() => window.ready);

const times = only
  ? only.split(',').map(Number)
  : Array.from({ length: Math.ceil(duration * fps) }, (_, i) => i / fps);
const started = Date.now();
let done = 0;
for (let i = worker; i < times.length; i += workers) {
  const file = only
    ? `${framesDir}/still-${times[i]}.jpg`
    : `${framesDir}/f${String(i).padStart(5, '0')}.jpg`;
  if (!only && existsSync(file)) continue;
  const data = await page.evaluate((t) => {
    window.renderAt(t);
    return window.frameJpeg(0.93);
  }, times[i]);
  writeFileSync(file, Buffer.from(data.split(',')[1], 'base64'));
  done++;
  if (done % 50 === 0) {
    const rate = (Date.now() - started) / done;
    console.log(`worker ${worker}: ${done} frames, ${(rate / 1000).toFixed(2)} s/frame`);
  }
}
await browser.close();
await server.close();
console.log(`worker ${worker} finished ${done} frames`);

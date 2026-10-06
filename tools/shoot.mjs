// Offline snapshots of each scene for the gallery windows.
// usage: node gal/shoot.mjs <file.html> <sceneId> <hours comma> <WxH> [hash]
import { chromium } from 'playwright';
import fs from 'fs'; import path from 'path';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const V = path.resolve(ROOT, '../vendor');
const [file, sceneId, hoursArg, size = '1440x960', hash = ''] = process.argv.slice(2);
const [W, H] = size.split('x').map(Number);
const html = fs.readFileSync(file, 'utf8');
const page_html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>[hidden]{display:none!important}</style></head><body>${html}</body></html>`;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-unsafe-webgpu', '--use-webgpu-adapter=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader'] });
const p = await b.newPage({ viewport: { width: W, height: H } });
p.on('pageerror', (e) => console.log('PAGEERROR: ' + e.message));
p.on('console', (m) => { if (m.type() === 'error') console.log('error: ' + m.text().slice(0, 300)); });
await p.route('**/*', async (r) => { const u = r.request().url();
  if (u.startsWith('https://test/audio/')) { const f = path.resolve(ROOT, 'audio/out', decodeURIComponent(u.slice(19).split('?')[0])); return fs.existsSync(f) ? r.fulfill({ path: f }) : r.fulfill({ status: 404, body: '' }); }
  if (u.startsWith('https://test/')) return r.fulfill({ body: page_html, contentType: 'text/html' });
  let m = u.match(/three@0\.170\.0\/(.*)$/); if (m) return r.fulfill({ path: V + '/three-0.170.0/' + m[1], contentType: 'application/javascript' });
  m = u.match(/tone@15\.0\.4\/(.*)$/); if (m) return r.fulfill({ path: V + '/tone-15.0.4/' + m[1], contentType: 'application/javascript' });
  return r.abort(); });
p.setDefaultTimeout(180000);
const wait = (ms) => p.waitForTimeout(ms);
await p.goto('https://test/' + hash); await wait(4000);
await p.addStyleTag({ content: '#title,#controls,#holdcue,#gallery,#threshold,#loading,#restlight{display:none!important}' });
console.log('backend', await p.evaluate(() => __halcyon.backend));
await p.evaluate(() => { __halcyon.quality('high'); __halcyon.gallery(); });
await wait(500);
await p.evaluate((id) => __halcyon.open(id), sceneId);
for (let i = 0; i < 120 && (await p.evaluate(() => __halcyon.state())) !== 'scene'; i++) await wait(500);
await p.evaluate(() => __halcyon.holdBleed(1)); await wait(3000);
for (const [n, h] of hoursArg.split(',').entries()) {
  await p.evaluate((h) => __halcyon.setHour(+h), h);
  await wait(6000);
  const out = path.join(ROOT, 'gal/raw', `${sceneId}-${n}.png`);
  await p.screenshot({ path: out });
  console.log('shot', out, h);
}
await b.close();

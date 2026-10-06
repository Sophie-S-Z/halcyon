// Full visit test with real input: threshold breath -> gallery -> window -> scene -> touches -> back.
// usage: node flow.mjs <file.html> <sceneId> <outPrefix> [hash e.g. #webgl] [WxH] [hour]
import { chromium } from 'playwright';
import fs from 'fs'; import path from 'path';
const [file = 'halcyon3.html', sceneId = 'lake', out = 'f', hash = '', size = '640x360', hourArg] = process.argv.slice(2);
const [W, H] = size.split('x').map(Number);
const V = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../vendor');
const html = fs.readFileSync(file, 'utf8');
const page_html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>[hidden]{display:none!important}</style></head><body>${html}</body></html>`;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', ignoreDefaultArgs: ['--mute-audio'],
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-unsafe-webgpu', '--use-webgpu-adapter=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--autoplay-policy=user-gesture-required'] });
const p = await b.newPage({ viewport: { width: W, height: H }, hasTouch: false });
let errors = 0;
p.on('pageerror', (e) => { errors++; console.log('PAGEERROR: ' + e.message); });
p.on('console', (m) => { const t = m.text(); if (/AudioContext|ERR_FAILED|Tone.js v|status of 404/.test(t)) return; if (m.type() === 'error' || m.type() === 'warning') errors += m.type() === 'error'; console.log(m.type() + ': ' + t.slice(0, 500)); });
await p.addInitScript(() => { addEventListener('unhandledrejection', (e) => console.error('UNHANDLED ' + (e.reason && e.reason.stack || e.reason))); });
await p.route('**/*', async (r) => { const u = r.request().url();
  if (u.startsWith('https://test/audio/')) { const f = path.resolve(path.dirname(new URL(import.meta.url).pathname), 'audio/out', decodeURIComponent(u.slice(19).split('?')[0])); return fs.existsSync(f) ? r.fulfill({ path: f, contentType: f.endsWith('.json') ? 'application/json' : 'audio/mpeg' }) : r.fulfill({ status: 404, body: '' }); }
  if (u.startsWith('https://test/art/')) { const f = path.resolve(path.dirname(new URL(import.meta.url).pathname), 'art/out', decodeURIComponent(u.slice(17).split('?')[0])); return fs.existsSync(f) ? r.fulfill({ path: f, contentType: 'image/webp' }) : r.fulfill({ status: 404, body: '' }); }
  if (u.startsWith('https://test/')) return r.fulfill({ body: page_html, contentType: 'text/html' });
  let m = u.match(/three@0\.170\.0\/(.*)$/); if (m) return r.fulfill({ path: V + '/three-0.170.0/' + m[1], contentType: 'application/javascript' });
  m = u.match(/tone@15\.0\.4\/(.*)$/); if (m) return r.fulfill({ path: V + '/tone-15.0.4/' + m[1], contentType: 'application/javascript' });
  return r.abort(); });
const wait = (ms) => p.waitForTimeout(ms);
const ev = (f, a) => p.evaluate(f, a);
await p.goto('https://test/' + hash); await wait(5000);
console.log('backend', await ev(() => window.__halcyon && __halcyon.backend));
// threshold: hold one breath with the mouse
await p.mouse.move(W / 2, H / 2); await p.mouse.down(); await wait(6000); await p.mouse.up();
await wait(9000);
console.log('after threshold:', await ev(() => __halcyon.state() + ' ctx=' + Tone.getContext().state));
await p.screenshot({ path: out + '-gallery.png' });
// meter on the destination
await ev(() => { window.__m = new Tone.Meter({ normalRange: true, smoothing: 0.5 }); Tone.getDestination().connect(window.__m); window.__pk = 0; setInterval(() => { window.__pk = Math.max(window.__pk, __m.getValue()); }, 50); });
await wait(2000);
console.log('gallery level', await ev(() => __m.getValue().toFixed(4)));
// click the scene's window
const box = await ev((id) => { const e = document.querySelector(`.win[data-id="${id}"]`); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, sceneId);
await p.mouse.move(box.x, box.y); await wait(1200); await p.mouse.down(); await wait(80); await p.mouse.up();
await wait(1500); await p.screenshot({ path: out + '-bleed.png' });
await wait(9000);
console.log('in scene:', await ev(() => __halcyon.state() + ' ' + __halcyon.scene()));
if (hourArg) { await ev((h) => __halcyon.setHour(+h), hourArg); await wait(3000); }
await p.screenshot({ path: out + '-scene.png' });
await ev(() => { window.__pk = 0; });
await wait(4000);
console.log('scene level now/peak', await ev(() => __m.getValue().toFixed(4) + ' / ' + __pk.toFixed(4)));
// touches: taps across the frame, a drag, a hold
await ev(() => { window.__pk = 0; });
for (const [fx, fy] of [[0.3, 0.7], [0.5, 0.55], [0.7, 0.8], [0.5, 0.3], [0.2, 0.9]]) { await p.mouse.move(W * fx, H * fy); await p.mouse.down(); await wait(120); await p.mouse.up(); await wait(900); }
await p.mouse.move(W * 0.1, H * 0.85); await p.mouse.down();
for (let i = 0; i <= 12; i++) { await p.mouse.move(W * (0.1 + i * 0.065), H * 0.85); await wait(60); }
await p.mouse.up(); await wait(600);
await p.mouse.move(W * 0.5, H * 0.92); await p.mouse.down(); await wait(2600); await p.mouse.up();
await wait(1500);
console.log('touch peak level', await ev(() => __pk.toFixed(4)));
await p.screenshot({ path: out + '-touch.png' });
// back to the gallery
await ev(() => __halcyon.back()); await wait(5000);
console.log('after back:', await ev(() => __halcyon.state()));
await p.screenshot({ path: out + '-back.png' });
console.log('ERRORS', errors);
await b.close();

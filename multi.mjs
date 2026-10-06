import { chromium } from 'playwright';
import fs from 'fs'; import path from 'path';
const V = path.resolve('../vendor');
const [file='halcyon.html', hash='', size='640x360', out='m'] = process.argv.slice(2); const [W,H]=size.split('x').map(Number);
const html = fs.readFileSync(file,'utf8');
const page_html = `<!doctype html><html><head><meta charset="utf-8"><style>[hidden]{display:none!important}</style></head><body>${html}</body></html>`;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', ignoreDefaultArgs:['--mute-audio'], args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-unsafe-webgpu','--use-webgpu-adapter=swiftshader','--enable-features=Vulkan','--use-vulkan=swiftshader'] });
const p = await b.newPage({ viewport:{width:W,height:H} });
let errors=0;
p.on('pageerror', e=>{errors++;console.log('PAGEERROR: '+e.message);}); p.on('console', m=>{ const t=m.text(); if(/AudioContext|ERR_FAILED|Tone.js v/.test(t)) return; if(m.type()==='error'){errors++;} if(m.type()==='error'||m.type()==='warning') console.log(m.type()+': '+t.slice(0,300)); });
await p.addInitScript(()=>{ addEventListener('unhandledrejection', e=>console.error('UNHANDLED '+(e.reason&&e.reason.stack||e.reason))); });
await p.route('**/*', async (r) => { const u = r.request().url();
  if (u.startsWith('https://test/art/')) { const f = path.resolve('art/out', decodeURIComponent(u.slice(17).split('?')[0])); return fs.existsSync(f) ? r.fulfill({ path: f, contentType: 'image/webp' }) : r.fulfill({ status: 404, body: '' }); }
  if (u.startsWith('https://test/')) return r.fulfill({ body: page_html, contentType:'text/html' });
  let m = u.match(/three@0\.170\.0\/(.*)$/); if (m) return r.fulfill({ path: V+'/three-0.170.0/'+m[1], contentType:'application/javascript' });
  m = u.match(/tone@15\.0\.4\/(.*)$/); if (m) return r.fulfill({ path: V+'/tone-15.0.4/'+m[1], contentType:'application/javascript' });
  return r.abort(); });
const wait=(ms)=>p.waitForTimeout(ms);
const waitState=async(s,max=60000)=>{ const t0=Date.now(); while(Date.now()-t0<max){ if(await p.evaluate(()=>__halcyon.state())===s) return true; await wait(500);} return false; };
await p.goto('https://test/'+hash); await wait(5000);
await p.mouse.move(W/2,H/2); await p.mouse.down(); await wait(6000); await p.mouse.up();
await waitState('gallery'); await wait(2000);
await p.screenshot({path:out+'-gallery.png'});
await p.evaluate(()=>{ window.__m=new Tone.Meter({normalRange:true}); Tone.getDestination().connect(__m); });
for (const id of ['lake','rain','fire','lake']) {
  const box = await p.evaluate((id)=>{ const r=document.querySelector(`.win[data-id="${id}"]`).getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; }, id);
  await p.mouse.move(box.x,box.y); await wait(800); await p.mouse.down(); await wait(80); await p.mouse.up();
  const ok = await waitState('scene', 90000); await wait(3000);
  await p.mouse.move(W*0.5,H*0.7); await p.mouse.down(); await wait(100); await p.mouse.up(); await wait(1500);
  console.log(id, 'reached scene', ok, 'scene', await p.evaluate(()=>__halcyon.scene()), 'level', await p.evaluate(()=>__m.getValue().toFixed(3)));
  await p.screenshot({path:`${out}-${id}.png`});
  await p.keyboard.press('Escape'); await wait(300); await p.keyboard.press('Escape');
  console.log(' back ->', await waitState('gallery', 60000));
  await wait(1500);
}
console.log('ERRORS', errors);
await b.close();

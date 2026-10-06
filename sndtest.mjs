// open a scene and report audio state + meter
import { chromium } from 'playwright';
import fs from 'fs'; import path from 'path';
const [file, id='lake', secs='25'] = process.argv.slice(2);
const H = path.dirname(new URL(import.meta.url).pathname), V = path.resolve(H, '../vendor');
const page_html = `<!doctype html><html><head><meta charset="utf-8"></head><body>${fs.readFileSync(file,'utf8')}</body></html>`;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', ignoreDefaultArgs:['--mute-audio'], args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport:{width:480,height:270} });
p.on('pageerror', e=>console.log('PAGEERROR '+e.message)); p.on('console', m=>{ const t=m.text(); if(m.type()==='error' && !/404|ERR_FAILED/.test(t)) console.log('error: '+t.slice(0,300)); });
await p.route('**/*', async (r) => { const u = r.request().url();
  if (u.startsWith('https://test/audio/')) { const f = path.resolve(H,'audio/out',decodeURIComponent(u.slice(19))); return fs.existsSync(f)? r.fulfill({path:f, contentType: f.endsWith('.json')?'application/json':'audio/mpeg'}) : r.fulfill({status:404,body:''}); }
  if (u.startsWith('https://test/')) return r.fulfill({ body: page_html, contentType:'text/html' });
  let m = u.match(/three@0\.170\.0\/(.*)$/); if (m) return r.fulfill({ path: V+'/three-0.170.0/'+m[1], contentType:'application/javascript' });
  m = u.match(/tone@15\.0\.4\/(.*)$/); if (m) return r.fulfill({ path: V+'/tone-15.0.4/'+m[1], contentType:'application/javascript' });
  return r.abort(); });
await p.goto('https://test/#webgl'); await p.waitForTimeout(4000);
await p.mouse.move(240,135); await p.mouse.down(); await p.waitForTimeout(5500); await p.mouse.up(); await p.waitForTimeout(6000);
await p.evaluate(()=>{ window.__m=new Tone.Meter({normalRange:true}); Tone.getDestination().connect(__m); window.__pk=0; setInterval(()=>{__pk=Math.max(__pk,__m.getValue());},50); });
await p.waitForTimeout(2000); console.log('gallery', await p.evaluate(()=>__m.getValue().toFixed(3)));
await p.evaluate((id)=>__halcyon.open(id), id);
for (let i=0;i<+secs/5;i++){ await p.waitForTimeout(5000); console.log('t', (i+1)*5, await p.evaluate(()=>{ const s=__halcyon.sound; return 'lvl '+__m.getValue().toFixed(3)+' pk '+__pk.toFixed(3)+' sampled '+!!s.sampled+' layers '+s.sceneLayers.map(l=>l.isLoop?'L':'n').join(''); })); await p.evaluate(()=>{__pk=0;}); }
await p.evaluate(()=>{ __halcyon.sound.play('note', null, 1, {index: 6}); }); await p.waitForTimeout(1000);
console.log('after note pk', await p.evaluate(()=>__pk.toFixed(3)));
await b.close();

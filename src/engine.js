import * as THREE from 'three/webgpu';
import * as TSL from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { dof } from 'three/addons/tsl/display/DepthOfFieldNode.js';

/* =====================================================================
   Halcyon engine. Shared by every scene.
   three.js WebGPURenderer + TSL (automatic WebGL 2 fallback), Tone.js sound.
   Values come from halcyon-design-spec.md. Search "SPEC" for each one.
   A scene is a module that calls E.defineScene({...}). See SCENE API below.
   ===================================================================== */

const {
  Fn, uniform, float, vec2, vec3, vec4, screenUV, pass, renderOutput,
  mix, smoothstep, pow, exp, max, min, clamp, step, floor, fract, sin, asin, atan2,
  length, normalize, dot, positionWorld, cameraPosition, uv, attribute
} = TSL;

const $ = (id) => document.getElementById(id);
const clamp1 = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp1((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const easeIO = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const rand = (a, b) => a + Math.random() * (b - a);
const seeded = (seed) => { let s = seed; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; };
const DEG = Math.PI / 180;

/* ---------- device storage (settings only, SPEC: privacy by default) ---------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem('halcyon.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('halcyon.' + k, JSON.stringify(v)); } catch (e) {} }
};
const reduceMotionQuery = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
const settings = {
  volume: store.get('volume', 0.8),
  haptics: store.get('haptics', true),
  still: store.get('still', reduceMotionQuery.matches)
};

/* =====================================================================
   Renderer, camera, shared TSL noise
   ===================================================================== */
const renderer = new THREE.WebGPURenderer({ antialias: true, powerPreference: 'high-performance', forceWebGL: location.hash === '#webgl' });
try { await renderer.init(); } catch (e) { $('loading').textContent = 'this browser cannot draw the scenes'; throw e; }
const BACKEND = renderer.backend && renderer.backend.isWebGPUBackend ? 'webgpu' : 'webgl2';
document.documentElement.dataset.backend = BACKEND;
renderer.setClearColor(0x1a1410, 1);
renderer.toneMapping = THREE.NoToneMapping;
$('stage').appendChild(renderer.domElement);
const canvas = renderer.domElement;
canvas.setAttribute('role', 'img');
canvas.setAttribute('aria-label', 'halcyon');
canvas.tabIndex = -1;

const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 1200);
camera.rotation.order = 'YXZ';
const CAM = { x: 0, y: 0.55, z: 6, pitch: -1.2 * DEG };

const hash12 = Fn(([p]) => {
  const p3 = fract(vec3(p.x, p.y, p.x).mul(0.1031)).toVar();
  p3.addAssign(dot(p3, p3.yzx.add(33.33)));
  return fract(p3.x.add(p3.y).mul(p3.z));
}).setLayout({ name: 'hash12', type: 'float', inputs: [{ name: 'p', type: 'vec2' }] });
const vnoise = Fn(([p]) => {
  const i = floor(p), f = fract(p);
  const u = f.mul(f).mul(f.mul(-2).add(3));
  const a = hash12(i), b = hash12(i.add(vec2(1, 0))), c = hash12(i.add(vec2(0, 1))), d = hash12(i.add(vec2(1, 1)));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}).setLayout({ name: 'vnoise', type: 'float', inputs: [{ name: 'p', type: 'vec2' }] });
const fbm = Fn(([p0]) => {
  const p = vec2(p0).toVar(), s = float(0).toVar();
  let a = 0.5;
  for (let k = 0; k < 4; k++) { s.addAssign(vnoise(p).mul(a)); p.assign(p.mul(2.03).add(vec2(1.7, 9.2))); a *= 0.5; }
  return s;
}).setLayout({ name: 'fbm', type: 'float', inputs: [{ name: 'p', type: 'vec2' }] });
const uTime = uniform(0);

/* =====================================================================
   Hour palettes. A scene gives stops; makeEnv() blends them and feeds uniforms.
   Stop fields: t, top, hor, glow, sun, cloudCol, fog, sunEl, sunAz, moonEl, moonAz,
   star, cloud, mist, light, sunVis, plus any extra colour or number the scene wants.
   ===================================================================== */
function makeEnv(stops) {
  const colorKeys = [], numKeys = [];
  for (const k of Object.keys(stops[0])) { if (k === 't') continue; (typeof stops[0][k] === 'string' ? colorKeys : numKeys).push(k); }
  for (const s of stops) for (const k of colorKeys) s[k] = new THREE.Color(s[k]);
  const env = { sunDir: new THREE.Vector3(), moonDir: new THREE.Vector3(), moon: 0, night: 0 };
  for (const k of colorKeys) env[k] = new THREE.Color();
  const U = {};
  for (const k of colorKeys) U[k] = uniform(env[k]);
  for (const k of numKeys) U[k] = uniform(0);
  U.sunDir = uniform(env.sunDir); U.moonDir = uniform(env.moonDir); U.moon = uniform(0); U.night = uniform(0);
  const dirFrom = (az, el, out) => out.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
  function sample(h) {
    let i = 0; while (i < stops.length - 2 && h > stops[i + 1].t) i++;
    const a = stops[i], b = stops[i + 1];
    const t = easeIO(clamp1((h - a.t) / (b.t - a.t), 0, 1));
    for (const k of colorKeys) env[k].copy(a[k]).lerp(b[k], t);
    for (const k of numKeys) { env[k] = lerp(a[k], b[k], t); U[k].value = env[k]; }
    dirFrom((env.sunAz ?? 0.24), (env.sunEl ?? 10) * DEG, env.sunDir);
    dirFrom((env.moonAz ?? -0.16), (env.moonEl ?? -20) * DEG, env.moonDir);
    env.moon = smooth(-2, 4, env.moonEl ?? -20); U.moon.value = env.moon;
    env.night = smooth(0.66, 0.84, h); U.night.value = env.night;
    return env;
  }
  sample(stops[0].t);
  return { env, U, sample };
}

/* Painted sky dome. Needs U from makeEnv with: top, hor, glow, sun, cloudCol, fog, sunVis, star, cloud, mist. */
function makeSky(U, opts = {}) {
  const starScale = opts.starScale ?? 62, starDensity = opts.starDensity ?? 0.968;
  const mat = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide, depthWrite: false });
  mat.fog = false;
  mat.colorNode = Fn(() => {
    const d = normalize(positionWorld.sub(cameraPosition));
    const el = d.y;
    const az = atan2(d.x, d.z.negate());
    const col = mix(U.hor, U.top, pow(smoothstep(-0.02, 0.42, el), 0.7)).toVar();
    const sd = max(dot(d, U.sunDir), 0);
    col.addAssign(U.glow.mul(pow(sd, 16).mul(0.32).add(pow(sd, 220).mul(0.55))).mul(U.sunVis));
    const above = smoothstep(-0.004, 0.006, el);
    col.assign(mix(col, U.sun.mul(2.4), smoothstep(0.99955, 0.99975, sd).mul(above).mul(U.sunVis)));
    const md = max(dot(d, U.moonDir), 0);
    col.addAssign(vec3(0.55, 0.62, 0.62).mul(pow(md, 30).mul(0.18).add(pow(md, 400).mul(0.25))).mul(U.moon));
    col.assign(mix(col, vec3(1.7, 1.75, 1.7), smoothstep(0.99985, 0.99992, md).mul(above).mul(U.moon)));
    const sc = vec2(az, asin(clamp(el, -1, 1))).mul(starScale);
    const cell = floor(sc);
    const h = hash12(cell);
    const off = vec2(hash12(cell.add(3.1)), hash12(cell.add(7.7))).mul(0.6).add(0.2);
    const sdist = length(fract(sc).sub(off));
    const tw = sin(uTime.mul(h.mul(0.5).add(0.25)).add(h.mul(40))).mul(0.45).add(0.55);
    const star = step(starDensity, h).mul(smoothstep(0.09, 0.0, sdist)).mul(tw).mul(smoothstep(0.02, 0.2, el));
    col.addAssign(vec3(0.95, 0.9, 0.8).mul(star).mul(U.star).mul(h.mul(2).add(0.6)));
    if (opts.milkyWay) {   // a faint band of stars across the sky
      const band = exp(d.y.sub(d.x.mul(0.55)).sub(0.32).mul(d.y.sub(d.x.mul(0.55)).sub(0.32)).mul(-26));
      const mw = fbm(vec2(az.mul(7), el.mul(9)).add(3.3)).mul(band).mul(smoothstep(0.05, 0.3, el));
      col.addAssign(vec3(0.42, 0.44, 0.46).mul(mw).mul(U.star).mul(0.35));
    }
    const band2 = smoothstep(0.01, 0.07, el).mul(smoothstep(0.34, 0.1, el));
    const c = smoothstep(0.52, 0.82, fbm(vec2(az.mul(2.4).add(uTime.mul(0.002)), el.mul(22))));
    col.assign(mix(col, U.cloudCol.mul(pow(sd, 4).mul(0.6).add(1)), c.mul(band2).mul(U.cloud).mul(0.55)));
    col.assign(mix(col, U.fog, U.mist.mul(exp(max(el, 0).mul(-14))).mul(0.75)));
    return col;
  })();
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(500, 48, 24), mat);
  mesh.frustumCulled = false; mesh.renderOrder = -10;
  mesh.onBeforeRender = (r, s, cam) => { mesh.position.copy(cam.position); mesh.updateMatrixWorld(); };
  return mesh;
}

/* A far ridge as a flat silhouette strip. */
function ridge(scene, fn, z, x0, x1, n, mat, bottom = -0.6) {
  const pos = [], idx = [];
  for (let i = 0; i <= n; i++) { const x = lerp(x0, x1, i / n); pos.push(x, fn(x), z, x, bottom, z); }
  for (let i = 0; i < n; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  const m = new THREE.Mesh(g, mat); scene.add(m); return m;
}

function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,240,200,1)'); gr.addColorStop(0.25, 'rgba(240,201,122,0.55)'); gr.addColorStop(1, 'rgba(201,163,91,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const GLOW = glowTexture();

/* Particles as instanced billboards (WebGPU has no point size).
   pool.add({x,y,z, age:0, life, ...}); the scene's step(p, i, dt, t) moves p and returns alpha. */
class Pool {
  constructor(scene, max, { additive = false, size = 0.05, color = 0xEFE3CF, gain = 1, step }) {
    this.max = max; this.items = []; this.step = step;
    const plane = new THREE.PlaneGeometry(1, 1);
    const g = new THREE.InstancedBufferGeometry();
    g.index = plane.index; g.setAttribute('position', plane.attributes.position); g.setAttribute('uv', plane.attributes.uv);
    this.pos = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.alpha = new THREE.InstancedBufferAttribute(new Float32Array(max), 1).setUsage(THREE.DynamicDrawUsage);
    this.size = new THREE.InstancedBufferAttribute(new Float32Array(max).fill(1), 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aPos', this.pos); g.setAttribute('aAlpha', this.alpha); g.setAttribute('aSize', this.size);
    g.instanceCount = max;
    const m = new THREE.SpriteNodeMaterial({ transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
    m.fog = false;
    m.positionNode = attribute('aPos', 'vec3');
    m.scaleNode = attribute('aSize', 'float').mul(size);
    const tint = new THREE.Color(color).multiplyScalar(gain);
    this.tint = uniform(tint);
    m.colorNode = this.tint;
    m.opacityNode = Fn(() => { const d = length(uv().sub(0.5)); const a = smoothstep(0.5, 0.0, d); return a.mul(a).mul(attribute('aAlpha', 'float')); })();
    this.mesh = new THREE.Mesh(g, m); this.mesh.frustumCulled = false; scene.add(this.mesh);
  }
  add(p) { if (this.items.length >= this.max) this.items.shift(); p.age = p.age || 0; this.items.push(p); }
  update(dt, t) {
    this.items = this.items.filter((p) => (p.age += dt) < p.life);
    const P = this.pos.array, A = this.alpha.array, S = this.size.array;
    this.items.forEach((p, i) => {
      A[i] = this.step(p, dt, t);
      P[i * 3] = p.x; P[i * 3 + 1] = p.y; P[i * 3 + 2] = p.z; S[i] = p.s ?? 1;
    });
    for (let i = this.items.length; i < this.max; i++) { A[i] = 0; P[i * 3 + 1] = -50; }
    this.pos.needsUpdate = true; this.alpha.needsUpdate = true; this.size.needsUpdate = true;
  }
}

/* =====================================================================
   Film pipeline: bloom, depth of field, film look, ink bleed (TSL)
   SPEC: grain 4 % at 24 updates a second, vignette 25 %, soft bloom, slow focus shift.
   ===================================================================== */
const F = {
  focus: uniform(12), aperture: uniform(0.00016), maxblur: uniform(0.005),
  aspect: uniform(1), grainT: uniform(0), bleed: uniform(0), center: uniform(new THREE.Vector2(0.5, 0.5)),
  cross: uniform(0), dim: uniform(0), ink: vec3(26 / 255, 20 / 255, 16 / 255)
};
const filmLook = Fn(([src]) => {
  const c = vec3(src.rgb).toVar();
  const q = screenUV.sub(0.5).mul(vec2(F.aspect, 1));
  c.mulAssign(smoothstep(0.2, 0.9, length(q).mul(1.15)).mul(0.25).oneMinus());
  const g = hash12(floor(screenUV.mul(vec2(1600, float(1600).div(F.aspect)))).add(F.grainT.mul(vec2(113.1, 71.7)))).sub(0.5);
  c.addAssign(g.mul(0.04));
  const st = screenUV.mul(vec2(F.aspect, 1));
  const r = length(screenUV.sub(F.center).mul(vec2(F.aspect, 1)));
  const n1 = fbm(st.mul(2.6).add(7.3)).sub(0.5);
  const n2 = fbm(st.mul(11).add(1.9)).sub(0.5);
  const R = F.bleed.mul(1.9);
  const e = R.sub(r.add(n1.mul(0.55).mul(min(R, 0.55))).add(n2.mul(0.07)));
  const mB = smoothstep(-0.004, 0.028, e);
  const settle = smoothstep(0.8, 1, F.bleed).oneMinus();
  const ex = e.sub(0.012).div(0.03);
  const rim = exp(ex.mul(ex).negate()).mul(settle);
  const wetEdge = F.cross.oneMinus();
  c.mulAssign(rim.mul(0.42).mul(wetEdge).oneMinus());
  const paper = vnoise(st.mul(260)).mul(0.6).add(vnoise(st.mul(70)).mul(0.4));
  c.mulAssign(mix(float(1), paper.mul(0.3).add(0.82), settle.mul(0.7).mul(wetEdge)));
  c.assign(mix(F.ink, c, mix(mB, F.bleed, F.cross)));
  c.assign(mix(c, F.ink, F.dim));
  return vec4(c, 1);
});
const emptyScene = new THREE.Scene();
const post = new THREE.PostProcessing(renderer);
post.outputColorTransform = false;
const scenePass = pass(emptyScene, camera);
const sceneColor = scenePass.getTextureNode('output');
const bloomNode = bloom(sceneColor, 0.42, 0.5, 0.9);
const dofNode = dof(sceneColor, scenePass.getViewZNode(), F.focus, F.aperture, F.maxblur);
function buildPost(tierName) {
  let c;
  if (tierName === 'high') c = dofNode.add(bloomNode);           // SPEC quality tiers: depth of field on High only
  else if (tierName === 'medium') c = sceneColor.add(bloomNode);
  else c = sceneColor;                                           // Low: no bloom
  post.outputNode = filmLook(renderOutput(c, THREE.NoToneMapping, THREE.SRGBColorSpace));
  post.needsUpdate = true;
}
buildPost('high');

/* =====================================================================
   Sound. Tone.js. HRTF panners in scene space, the listener on the camera.
   SPEC: the bed fades in over 4 s; score: one note every 4 to 12 s, pad chord every 30 to 60 s;
   touch sounds use the scene's pentatonic scale; crowded touches get quieter.
   ===================================================================== */
/* Recorded sounds (CC0 / CC-BY field recordings and piano notes, credits in audio/CREDITS.md).
   They load in the background from audio/manifest.json next to the page. Until a file is ready,
   the engine uses its synthesized stand-in, so the page works with no files at all. */
const AUDIO = { base: 'audio/', manifest: null, buffers: {}, pianoReady: false };
async function loadAudio() {
  if (typeof Tone === 'undefined') return;
  try {
    const r = await fetch(AUDIO.base + 'manifest.json'); if (!r.ok) return;
    const m = AUDIO.manifest = await r.json();
    const raw = Tone.getContext().rawContext;
    const load = async (key, file) => {
      const ab = await (await fetch(AUDIO.base + file)).arrayBuffer();
      AUDIO.buffers[key] = await new Promise((ok, no) => { const p = raw.decodeAudioData(ab, ok, no); if (p && p.then) p.then(ok, no); });
    };
    await Promise.all(Object.entries(m.piano || {}).map(([n, f]) => load('piano:' + n, f).catch(() => {})));
    AUDIO.pianoReady = Object.keys(AUDIO.buffers).some((k) => k.startsWith('piano:'));
    if (sound.ready) sound.buildPiano();
    for (const [k, v] of Object.entries(m.loops || {})) await load('loop:' + k, v.file || v).catch(() => {});
    for (const [k, v] of Object.entries(m.sfx || {})) await load('sfx:' + k, v.file || v).catch(() => {});
    if (sound.ready) sound.upgradeLayers();
  } catch (e) {}
}
loadAudio();

const sound = {
  ready: false, on: false, muted: false, recent: [], pools: {}, lastListener: 0, key: null, sceneLayers: [],
  unlock() {                                   // call inside any user gesture: wakes the audio on every browser
    if (typeof Tone === 'undefined') return;
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}   // iPhone: play even with the ringer switch on silent
    try {
      const ctx = Tone.getContext().rawContext;
      if (ctx.state !== 'running') { ctx.resume(); Tone.start(); }
      if (!this.primed) {                       // a one-sample silent buffer started inside the gesture unlocks old Safari
        const b = ctx.createBuffer(1, 1, 22050), s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start(0); this.primed = true;
      }
    } catch (e) {}
  },
  running() { try { return Tone.getContext().state === 'running'; } catch (e) { return false; } },
  async start() {
    if (typeof Tone === 'undefined') return;
    this.unlock();
    try { await Tone.start(); } catch (e) {}
    if (!this.ready) this.build();
    this.on = true;
    this.fadeTo(1, 4);
    this.setVolume(settings.volume);
    this.loops();
  },
  panner(pos) {
    return new Tone.Panner3D({ panningModel: 'HRTF', distanceModel: 'inverse', refDistance: 3, rolloffFactor: 0.35, maxDistance: 200,
      positionX: pos ? pos.x : 0, positionY: pos ? pos.y : 0, positionZ: pos ? pos.z : 0 });
  },
  build() {
    const T = Tone;
    this.master = new T.Gain(0).toDestination();
    const lim = new T.Limiter(-1.5).connect(this.master);
    this.makeup = new T.Gain(3.2).connect(lim);              // the mix sits near -23 LUFS after the makeup gain
    const warm = new T.Filter({ type: 'highshelf', frequency: 3200, gain: -5 }).connect(this.makeup);   // a soft, warm top end on the whole mix
    const comp = new T.Compressor({ threshold: -26, ratio: 2.5, attack: 0.12, release: 0.6 }).connect(warm);
    this.bus = comp;
    const verb = new T.Reverb({ decay: 7.5, preDelay: 0.06, wet: 1 }).connect(comp);
    this.send = new T.Gain(0.45).connect(verb);
    this.fm = { harmonicity: 2, modulationIndex: 1.1, oscillator: { type: 'sine' }, modulation: { type: 'triangle' },
      envelope: { attack: 0.006, decay: 3.2, sustain: 0, release: 2.4 }, modulationEnvelope: { attack: 0.002, decay: 0.35, sustain: 0, release: 0.3 } };
    this.piano = new T.PolySynth(T.FMSynth, this.fm); this.piano.maxPolyphony = 10; this.piano.volume.value = -12;
    const pf = new T.Filter({ type: 'lowpass', frequency: 1700, Q: 0.3 }); this.pianoPan = new T.Panner(0);
    this.piano.chain(pf, this.pianoPan); this.pianoPan.connect(comp); this.pianoPan.connect(this.send);
    this.pad = new T.PolySynth(T.Synth, { oscillator: { type: 'fattriangle', count: 3, spread: 16 }, envelope: { attack: 6, decay: 2, sustain: 0.75, release: 9 } });
    this.pad.volume.value = -29;
    const padF = new T.Filter({ type: 'lowpass', frequency: 760, Q: 0.2 });
    this.pad.chain(padF); padF.connect(comp); padF.connect(this.send);
    const pool = (name, n, make, filter, vol, wet = 0.35) => {
      this.pools[name] = { i: 0, voices: Array.from({ length: n }, () => {
        const synth = make(); synth.volume.value = vol;
        const fl = filter(); const pan = this.panner();
        synth.chain(fl, pan); pan.connect(comp);
        const s = new T.Gain(wet).connect(this.send); pan.connect(s);
        return { synth, pan };
      }) };
    };
    const noise = (type, a, d) => () => new T.NoiseSynth({ noise: { type }, envelope: { attack: a, decay: d, sustain: 0 } });
    pool('note', 3, () => { const p = new T.PolySynth(T.FMSynth, this.fm); p.maxPolyphony = 6; return p; }, () => new T.Filter(1900, 'lowpass'), -6, 0.45);
    pool('drip', 3, () => new T.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.01, decay: 0.16, sustain: 0, release: 0.12 } }), () => new T.Filter(1500, 'lowpass'), -17, 0.55);
    pool('chime', 3, () => new T.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.03, decay: 2, sustain: 0, release: 1.6 } }), () => new T.Filter(2600, 'lowpass'), -23, 0.65);
    pool('tap', 3, noise('pink', 0.004, 0.05), () => new T.Filter({ type: 'bandpass', frequency: 1300, Q: 0.9 }), -19);
    pool('splash', 2, noise('pink', 0.03, 0.55), () => new T.Filter(850, 'lowpass'), -14);
    pool('rustle', 3, noise('pink', 0.1, 0.45), () => new T.Filter({ type: 'bandpass', frequency: 2400, Q: 0.6 }), -21, 0.15);
    pool('wetRustle', 3, noise('pink', 0.09, 0.55), () => new T.Filter({ type: 'bandpass', frequency: 1300, Q: 0.5 }), -19, 0.2);
    pool('paper', 2, noise('brown', 0.22, 0.8), () => new T.Filter(1100, 'highpass'), -3, 0.2);
    pool('scratch', 2, noise('pink', 0.015, 0.08), () => new T.Filter({ type: 'bandpass', frequency: 3800, Q: 1.5 }), -31, 0.1);
    pool('crackle', 4, noise('pink', 0.002, 0.03), () => new T.Filter({ type: 'bandpass', frequency: 1700, Q: 0.8 }), -20, 0.25);
    pool('rush', 2, noise('pink', 0.4, 1.6), () => new T.Filter({ type: 'bandpass', frequency: 750, Q: 0.5 }), -16, 0.3);
    pool('wash', 2, noise('pink', 1.6, 3), () => new T.Filter(700, 'lowpass'), -9, 0.35);
    pool('thump', 2, () => new T.MembraneSynth({ pitchDecay: 0.08, octaves: 2, envelope: { attack: 0.02, decay: 0.6, sustain: 0, release: 0.4 } }), () => new T.Filter(320, 'lowpass'), -16, 0.25);
    pool('call', 1, () => new T.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.02, decay: 0.09, sustain: 0, release: 0.06 } }), () => new T.Filter(4200, 'lowpass'), -26, 0.35);
    this.listener = T.getListener ? T.getListener() : T.Listener;
    this.ready = true;
    this.buildPiano();
  },
  /* the sampled piano: one sampler for the music, a few placed samplers for touch notes */
  buildPiano() {
    if (!this.ready || !AUDIO.pianoReady || this.sampled) return;
    const T = Tone, urls = {};
    for (const [k, b] of Object.entries(AUDIO.buffers)) if (k.startsWith('piano:')) urls[k.slice(6).replace('s', '#')] = b;
    const felt = () => new T.Filter({ type: 'lowpass', frequency: 1900, Q: 0.2, rolloff: -12 });   // a soft, felt-like top end
    this.music = new T.Sampler({ urls, release: 2.6, attack: 0.008 }); this.music.volume.value = -12;
    const mf = felt(); this.musicPan = new T.Panner(0);
    this.music.chain(mf, this.musicPan); this.musicPan.connect(this.bus); this.musicPan.connect(this.send);
    this.pools.pnote = { i: 0, voices: Array.from({ length: 3 }, () => {
      const synth = new T.Sampler({ urls, release: 2.2, attack: 0.006 }); synth.volume.value = -7;
      const pan = this.panner(); synth.chain(felt(), pan); pan.connect(this.bus);
      const sg = new T.Gain(0.45).connect(this.send); pan.connect(sg);
      return { synth, pan };
    }) };
    this.sampled = true;
  },
  /* swap the scene's synthesized stand-in layers for the recordings once they arrive */
  upgradeLayers() {
    for (const L of this.sceneLayers.slice()) {
      if (!L.want || L.isLoop || !AUDIO.buffers['loop:' + L.want.name]) continue;
      const n = this.loop(L.want.name, L.want, true);
      if (!n.isLoop) continue;
      const oldGain = L.gain, oldDispose = L.dispose;
      oldGain.gain.rampTo(0, 3); setTimeout(oldDispose, 3500);
      this.sceneLayers.splice(this.sceneLayers.indexOf(n), 1);
      Object.assign(L, { isLoop: true, gain: n.gain, filter: n.filter, player: n.player, dispose: () => { oldDispose(); n.dispose(); } });   // the scene keeps its handle
    }
  },
  voice(name, pos) {
    const P = this.pools[name]; const v = P.voices[P.i]; P.i = (P.i + 1) % P.voices.length;
    const t = Tone.now(), p = pos || camera.position;
    v.pan.positionX.setValueAtTime(p.x, t); v.pan.positionY.setValueAtTime(p.y, t); v.pan.positionZ.setValueAtTime(p.z, t);
    return v.synth;
  },
  updateListener() {
    if (!this.ready || !this.listener) return;
    const now = performance.now(); if (now - this.lastListener < 50) return; this.lastListener = now;
    const L = this.listener, t = Tone.now() + 0.06, f = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    camera.getWorldDirection(f);
    L.positionX.linearRampToValueAtTime(camera.position.x, t); L.positionY.linearRampToValueAtTime(camera.position.y, t); L.positionZ.linearRampToValueAtTime(camera.position.z, t);
    L.forwardX.linearRampToValueAtTime(f.x, t); L.forwardY.linearRampToValueAtTime(f.y, t); L.forwardZ.linearRampToValueAtTime(f.z, t);
    L.upX.linearRampToValueAtTime(up.x, t); L.upY.linearRampToValueAtTime(up.y, t); L.upZ.linearRampToValueAtTime(up.z, t);
  },
  noteName(i) { const k = this.key || DEFAULT_KEY; const sc = k.scale; return sc[((i % 5) + 5) % 5] + (k.octave + Math.floor(i / 5)); },
  loops() {
    if (this.looping) return; this.looping = true;
    const note = () => {
      if (this.on && !resting && current && state === 'scene') {
        if (this.sampled) { setTimeout(note, this.phrase() * 1000 + rand(5000, 14000)); return; }
        const i = Math.floor(rand(0, 10)); this.pianoPan.pan.rampTo(rand(-0.4, 0.4), 0.05);
        this.piano.triggerAttackRelease(this.noteName(i), 3, Tone.now() + 0.02, rand(0.2, 0.34));
        if (Math.random() < 0.25) this.piano.triggerAttackRelease(this.noteName(i - 5), 3, Tone.now() + 0.5, 0.16);
      }
      setTimeout(note, rand(4000, 12000));
    };
    const chord = () => {
      if (this.on && current && state === 'scene') {
        const k = this.key || DEFAULT_KEY;
        const set = (current.env && current.env.night > 0.5) ? k.night : k.day;
        this.pad.releaseAll(Tone.now());
        this.pad.triggerAttack(set[Math.floor(rand(0, set.length))], Tone.now() + 0.5, 0.5);
      }
      setTimeout(chord, rand(30000, 60000));
    };
    const detail = () => {
      if (this.on && !resting && current && state === 'scene' && current.detail) current.detail();
      setTimeout(detail, rand(8000, 40000));
    };
    setTimeout(note, 2500); setTimeout(chord, 1500); setTimeout(detail, 9000);
  },
  /* A short, quiet piano phrase in the scene's key: a broken chord in the left hand, a slow
     stepwise melody in the right, gentle rubato. Returns its length in seconds. SPEC: felt piano, long pauses. */
  phrase() {
    const k = this.key || DEFAULT_KEY, night = current && current.env && current.env.night > 0.5;
    const chords = night ? k.night : k.day, beat = rand(1.05, 1.3), t0 = Tone.now() + 0.1;
    const bars = Math.random() < 0.6 ? 2 : 3;
    let t = 0, mel = Math.floor(rand(5, 9));
    this.musicPan.pan.rampTo(rand(-0.25, 0.25), 2);
    for (let b = 0; b < bars; b++) {
      const ch = chords[Math.floor(rand(0, chords.length))];
      const lh = [ch[0], ch[1], ch[2], ch[1]];
      lh.forEach((n, i) => {                                             // left hand: low, soft, a little uneven
        this.music.triggerAttackRelease(n, beat * 2.4, t0 + t + i * beat + rand(-0.03, 0.05), (i ? 0.13 : 0.18) * rand(0.85, 1.1));
      });
      let rt = t + beat * rand(0.4, 1.0);
      while (rt < t + beat * 3.6) {                                      // right hand: a few notes that move by step
        mel = clamp1(mel + [-2, -1, -1, 1, 1, 2, 0][Math.floor(rand(0, 7))], 4, 12);
        const dur = beat * [1, 1, 1.5, 2][Math.floor(rand(0, 4))];
        this.music.triggerAttackRelease(this.noteName(mel), dur * 1.6, t0 + rt + rand(-0.02, 0.04), rand(0.15, 0.26));
        rt += dur;
      }
      t += beat * 4 * rand(1.0, 1.12);                                    // rubato between bars
    }
    this.music.triggerAttackRelease(this.noteName(mel > 8 ? 7 : 5), beat * 4, t0 + t, 0.14);   // settle on a resting note
    return t + beat * 3;
  },
  crowd() { const now = performance.now(); this.recent = this.recent.filter((t) => now - t < 1500); this.recent.push(now); return 1 / Math.sqrt(this.recent.length); },
  ok() { return this.ready && this.on; },
  /* One-shot sounds for scenes. pos is a THREE.Vector3 in scene space. v is 0..1. */
  play(kind, pos, v = 1, opts = {}) {
    if (!this.ok()) return;
    if (kind === 'note' && this.sampled) kind = 'pnote';            // the real piano, once its notes have loaded
    if (kind.startsWith('rec:')) return this.sample(kind.slice(4), pos, v, opts);
    if (kind === 'ripple') return this.ripple(pos, v);
    let t = Tone.now() + 0.01; const c = this.crowd();
    const s = this.voice(kind, pos);
    if (s._t != null && t <= s._t) t = s._t + 0.006;                 // one voice can not start twice at the same instant
    s._t = kind === 'call' ? t + 0.16 : t;
    switch (kind) {
      case 'drip': { const f = (opts.freq || 1250) * 0.7; s.triggerAttackRelease(f * 1.3, 0.12, t, 0.8 * v * c); s.frequency.exponentialRampToValueAtTime(f, t + 0.08); break; }
      case 'chime': s.triggerAttackRelease(opts.note || this.noteName(opts.index ?? 8), 1.4, t, v * c); break;
      case 'call': for (const k of [0, 0.16]) { s.triggerAttackRelease(3700, 0.08, t + k, 0.6 * v); s.frequency.setValueAtTime(3700, t + k); s.frequency.linearRampToValueAtTime(4300, t + k + 0.08); } break;
      case 'thump': s.triggerAttackRelease(opts.note || 'A1', 0.5, t, v * c); break;
      case 'note': s.triggerAttackRelease(opts.note || this.noteName(opts.index ?? 3), opts.dur || 2.5, t + (opts.delay || 0), 0.34 * v * c); break;
      case 'pnote': s.triggerAttackRelease(opts.note || this.noteName(opts.index ?? 3), opts.dur || 3, t + (opts.delay || 0), 0.36 * v * c); break;
      default: s.triggerAttackRelease(opts.dur || 0.3, t, v * c);
    }
  },
  note(pos, index, v = 1) { this.play('note', pos, v, { index }); },
  low(pos, v = 1) { const k = this.key || DEFAULT_KEY; this.play('note', pos, v * 1.1, { note: k.scale[0] + (k.octave - 1), dur: 3.5 }); },
  swell(notes) { if (!this.ok()) return; this.pad.triggerAttackRelease(notes, 3, Tone.now() + 0.4, 0.55); },
  /* A continuous bed layer for the current scene: filtered noise, placed (pos) or wide (no pos).
     Returns { gain } so the scene can ramp it. Layers fade out and are disposed when the scene closes. */
  layer({ type = 'pink', filter = 'lowpass', freq = 600, Q = 0.4, gain = 0.1, pos = null, lfo = null }) {
    if (!this.ready) return { gain: { gain: { rampTo() {}, value: 0 } } };
    const T = Tone;
    const n = new T.Noise(type); const f = new T.Filter({ type: filter, frequency: freq, Q }); const g = new T.Gain(0);
    const out = pos ? this.panner(pos) : null;
    n.chain(f, g); if (out) { g.connect(out); out.connect(this.sceneBus); } else g.connect(this.sceneBus);
    let l = null; if (lfo) { l = new T.LFO({ frequency: lfo.freq || 0.04, min: lfo.min, max: lfo.max }).connect(f.frequency).start(); }
    n.start(); g.gain.rampTo(gain, 4);
    const L = { gain: g, filter: f, dispose: () => { try { n.stop(); n.dispose(); f.dispose(); g.dispose(); out && out.dispose(); l && l.dispose(); } catch (e) {} } };
    this.sceneLayers.push(L);
    return L;
  },
  /* a looping recording for the current scene. opts: gain, pos (placed in 3D) or none (wide), rate,
     filter/freq (optional tone shaping), fallback (a layer() spec used until the file loads) */
  loop(name, opts = {}, upgrading = false) {
    const buf = AUDIO.buffers['loop:' + name];
    if (!this.ready || !buf || !this.sceneBus) {
      if (upgrading) return {};
      const L = this.layer(opts.fallback || { type: 'pink', freq: 500, gain: 0.0001 });
      L.want = Object.assign({ name }, opts); return L;
    }
    const T = Tone;
    const p = new T.Player(buf); p.loop = true; p.playbackRate = opts.rate || 1; p.fadeIn = 0.05;
    const g = new T.Gain(0); const f = opts.freq ? new T.Filter({ type: opts.filter || 'lowpass', frequency: opts.freq, Q: 0.3 }) : null;
    const out = opts.pos ? this.panner(opts.pos) : null;
    let node = p; if (f) { p.connect(f); node = f; }
    node.connect(g); if (out) { g.connect(out); out.connect(this.sceneBus); } else g.connect(this.sceneBus);
    p.start(Tone.now() + 0.02, rand(0, Math.max(0.1, buf.duration - 1)));
    g.gain.rampTo(opts.gain ?? 0.4, 4);
    const L = { isLoop: true, gain: g, filter: f, player: p, dispose: () => { try { p.stop(); p.dispose(); g.dispose(); f && f.dispose(); out && out.dispose(); } catch (e) {} } };
    this.sceneLayers.push(L);
    return L;
  },
  sample(name, pos, v = 1, opts = {}) {                               // a recorded one-shot, placed in 3D
    const buf = AUDIO.buffers['sfx:' + name]; if (!buf || !this.sceneBus) return false;
    const p = new Tone.Player(buf); p.playbackRate = opts.rate || rand(0.92, 1.08);
    const g = new Tone.Gain(v * this.crowd()); const out = pos ? this.panner(pos) : null;
    p.connect(g); if (out) { g.connect(out); out.connect(this.sceneBus); out.connect(this.send); } else g.connect(this.sceneBus);
    p.start(); p.onstop = () => setTimeout(() => { try { p.dispose(); g.dispose(); out && out.dispose(); } catch (e) {} }, 200);
    return true;
  },
  /* a soft water ripple: a short, faded grain of a recorded stream, placed in 3D. Falls back to a soft filtered swish. */
  ripple(pos, v = 1) {
    if (!this.ok() || !this.sceneBus) return;
    const buf = AUDIO.buffers['sfx:water'];
    if (!buf) { this.play('splash', pos, v * 0.5, { dur: 0.25 }); return; }
    const dur = rand(0.55, 1.1), off = rand(0, buf.duration - dur - 0.05), t = Tone.now() + 0.02;
    const p = new Tone.Player(buf); p.playbackRate = rand(0.78, 0.98); p.fadeIn = 0.09; p.fadeOut = dur * 0.55;
    const f = new Tone.Filter({ type: 'lowpass', frequency: rand(900, 1400), Q: 0.3 });
    const g = new Tone.Gain(0.7 * v * this.crowd()); const out = pos ? this.panner(pos) : null;
    p.chain(f, g); if (out) { g.connect(out); out.connect(this.sceneBus); out.connect(this.send); } else g.connect(this.sceneBus);
    p.start(t, off, dur);
    setTimeout(() => { try { p.dispose(); f.dispose(); g.dispose(); out && out.dispose(); } catch (e) {} }, (dur / p.playbackRate + 0.6) * 1000);
  },
  has(name) { return !!AUDIO.buffers[name]; },
  openScene(S, level = 1) {
    this.key = S.key || DEFAULT_KEY;
    if (!this.ready) return;
    this.sceneBus = new Tone.Gain(0).connect(this.bus);
    this.sceneBus.gain.rampTo(level, 3);                        // SPEC: a scene change cross-fades over 3 s
    this.sceneLayers = [];
    try { S.bed && S.bed(); } catch (e) { console.error(e); }
  },
  sceneLevel(level, sec) { if (this.sceneBus) this.sceneBus.gain.rampTo(level, sec); },
  closeScene(sec = 2.5) {
    if (!this.ready || !this.sceneBus) return;
    const bus = this.sceneBus, layers = this.sceneLayers;
    bus.gain.rampTo(0, sec);
    setTimeout(() => { layers.forEach((l) => l.dispose()); try { bus.dispose(); } catch (e) {} }, sec * 1000 + 400);
    this.sceneBus = null; this.sceneLayers = [];
  },
  setVolume(v) {
    if (!this.ready) return;
    Tone.Destination.mute = this.muted || v <= 0.001;
    if (v > 0.001) Tone.Destination.volume.rampTo(20 * Math.log10(v), 0.3);
  },
  fadeTo(level, sec) { if (!this.ready) return; this.master.gain.cancelScheduledValues(Tone.now()); this.master.gain.rampTo(level, sec); }
};
const DEFAULT_KEY = { scale: ['D', 'E', 'F#', 'A', 'B'], octave: 4, day: [['D3', 'A3', 'E4']], night: [['B2', 'F#3', 'D4']] };

/* SPEC: soft phone pulses of 8 to 15 ms, at most one every 400 ms. */
let lastBuzz = 0;
function haptic(ms) {
  if (!settings.haptics) return;
  const now = performance.now(); if (now - lastBuzz < 400) return; lastBuzz = now;
  try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {}
}

/* =====================================================================
   Helpers for scenes: screen projection, ray casts, focus
   ===================================================================== */
let clock = 0;
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const projV = new THREE.Vector3();
function rayAt(cx, cy) { ndc.set(cx / innerWidth * 2 - 1, -(cy / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera); return ray.ray; }
function hitPlaneY(cx, cy, y = 0) {
  const r = rayAt(cx, cy); const p = new THREE.Vector3();
  if (Math.abs(r.direction.y) < 1e-4) return null;
  return r.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -y), p);
}
function toScreen(v) { projV.copy(v).project(camera); return { x: (projV.x + 1) / 2 * innerWidth, y: (1 - projV.y) / 2 * innerHeight, front: projV.z < 1 && projV.z > -1 }; }
function nearScreen(v, x, y, r) { const s = toScreen(v); return s.front && Math.hypot(s.x - x, s.y - y) < r; }

/* Focus shift. SPEC: between a near object and the far view every 20 to 40 s, each move 6 s; a touch pulls focus to it. */
const focus = { from: 12, to: 12, t0: 0, dur: 6, next: 0, near: true };
const viewSpace = new THREE.Vector3();
function depthOf(v) { viewSpace.copy(v).applyMatrix4(camera.matrixWorldInverse); return Math.max(0.5, -viewSpace.z); }
function focusTo(d, dur) { focus.from = F.focus.value; focus.to = d; focus.t0 = clock; focus.dur = dur; }
function focusOn(v, dur = 2.5) { if (settings.still) return; focusTo(depthOf(v), dur); focus.next = clock + rand(20, 40); }
function updateFocus() {
  const mid = current && current.focusMid || 12;
  if (settings.still) { F.focus.value += (mid - F.focus.value) * 0.02; return; }   // SPEC: still mode keeps focus on the middle distance
  if (clock > focus.next && current) {
    focus.near = !focus.near;
    const near = (current.focusNear && current.focusNear()) || [];
    const pick = near.length ? depthOf(near[Math.floor(Math.random() * near.length)]) : 2.5;
    focusTo(focus.near ? pick : (current.focusFar || rand(30, 45)), 6);
    focus.next = clock + rand(20, 40);
  }
  F.focus.value = lerp(focus.from, focus.to, easeIO(clamp1((clock - focus.t0) / focus.dur, 0, 1)));
}

/* =====================================================================
   SCENE API
   E.defineScene({
     id, title, describe(hourName) -> screen reader text, defaultHour (0 dawn .. 1 deep night),
     hourMin, hourMax (optional limits for the arc), key: { scale:[5 notes], octave, day:[[chord]...], night:[[chord]...] },
     camera: { x, y, z, pitch },
     windowArt: () => '<svg ...>' (gallery window, 300x200 viewBox, animated with CSS classes),
     build(): called once, returns nothing; must set this.scene (THREE.Scene) and this.env (from makeEnv)
     applyHour(h): set colours for the hour (call this.envSample(h) inside)
     resize(VW, aspect): VW = view width per unit depth
     update(dt, t, info): info = { still: seconds with no input, hour }
     pointerDown(p) -> gesture or null; p = { x, y, id, type }
     pointerMove(g, p, prev); pointerUp(g, p); tick(g) each frame while a pointer is down
     skyBody() -> world direction of the sun or moon that the visitor may drag, or null
     focusNear() -> [Vector3...]; focusFar (number); focusMid (number); aperture, maxblur (optional depth of field)
     enter(): each time the scene opens; leave(): each time the visitor goes back
     hourName(h) -> 'dawn' | 'golden hour' ...; describe(h) -> 'resting waters, a lake at golden hour'
     Main also gives: E.look {yaw,pitch}, E.hour, E.state, E.holdCue.at(x,y)/show(f 0..1)/hide()
     update info: { active (true once the ink bleed ends), still (seconds with no input), resting, hour }
     bed(): start sound layers with E.sound.layer(...); detail(): one random near sound
   })
   ===================================================================== */
const SCENES = {};
const ORDER = [];
let current = null;
function defineScene(def) { SCENES[def.id] = def; ORDER.push(def.id); def.built = false; return def; }

const E = {
  THREE, TSL, bloom, dof, renderer, camera, CAM, DEG, F, uTime,
  clamp1, lerp, smooth, easeIO, easeOut, rand, seeded, store, settings,
  hash12, vnoise, fbm, makeEnv, makeSky, ridge, GLOW, Pool,
  sound, AUDIO, haptic, rayAt, hitPlaneY, toScreen, nearScreen, focusOn, depthOf,
  defineScene, SCENES,
  get clock() { return clock; },
  get hourTarget() { return hourTarget; },
  setHourTarget: (h) => setHourTarget(h),
  showControls: () => showControls()
};
window.__E = E;

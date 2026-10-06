/* =====================================================================
   Main: the visit. Threshold, gallery, ink bleed, scene, return, rest.
   This block runs in the same module as the engine, after every scene file.
   ===================================================================== */
let state = 'threshold';     // threshold | gallery | opening | scene | leaving
let resting = false;
let hour = 0.5, hourTarget = 0.5;
const look = { yaw: 0, pitch: 0, ty: 0, tp: 0 };
E.look = look;
Object.defineProperty(E, 'hour', { get: () => hour });
Object.defineProperty(E, 'state', { get: () => state });
let lastTouch = 0, lastStill = 0, bleedFrom = 0, bleedTo = 0, bleedDur = 3, bleedStart = 0;
let titleStart = -99, timerEnd = 0, dim = 0, dimFrom = 0, dimTo = 0, dimStart = 0, dimDur = 1;
let VW = 0.73, ASPECT = 1;
let openWin = null;
let keyboardUser = false;      // focus moves into the gallery only for visitors who use the keyboard
addEventListener('keydown', (e) => { if (e.key === 'Tab' || e.key === 'Enter' || e.key === ' ') keyboardUser = true; }, true);
addEventListener('pointerdown', () => { keyboardUser = false; }, true);          // the window the current scene opened from

/* ---------- the threshold breath ---------- */
const tword = document.querySelector('#threshold .word');
const thr = $('threshold'), tlight = $('tlight'), thalo = $('thalo'), tcore = $('tcore');
const breath = { holding: false, b: 0, opening: false, t0: 0 };
function holdStart(e) {
  if (state !== 'threshold' || breath.opening) return;
  if (e) e.preventDefault();
  sound.unlock();                                   // wake the audio inside the first touch
  breath.holding = true;
}
function holdEnd() {
  if (!breath.holding) return;
  breath.holding = false;
  if (breath.b >= 0.999) openThreshold();          // SPEC: a full breath in, then let go
}
thr.addEventListener('pointerdown', (e) => { thr.setPointerCapture?.(e.pointerId); holdStart(e); });
thr.addEventListener('pointerup', holdEnd);
thr.addEventListener('pointercancel', holdEnd);
thr.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) holdStart(e); });
thr.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') holdEnd(); });
thr.addEventListener('contextmenu', (e) => e.preventDefault());

function tickThreshold(dt) {
  if (breath.opening) {
    const f = clamp1((clock - breath.t0) / 5, 0, 1);  // SPEC: the light opens over 5 s, like a breath out
    const g = easeIO(f);
    tlight.style.transform = `scale(${lerp(3.2, 26, g)})`;
    thalo.style.opacity = String(lerp(1, 0, smooth(0.35, 1, f)));
    tcore.style.opacity = String(1 - smooth(0, 0.4, f));
    tword.style.opacity = String(1 - smooth(0, 0.3, f));
    if (f > 0.55 && state === 'threshold') showGallery();
    if (f >= 1) { breath.opening = false; thr.hidden = true; }
    return;
  }
  if (state !== 'threshold') return;
  if (breath.holding) breath.b = Math.min(1, breath.b + dt / 4);    // SPEC: grows for 4 s
  else breath.b = Math.max(0, breath.b - dt / 1.6);                 // early release: shrink back softly
  const e = easeIO(breath.b);
  tlight.style.transform = `scale(${1 + e * 2.2})`;
  thalo.style.opacity = String(0.8 + e * 0.2);
}
function openThreshold() {
  breath.opening = true; breath.t0 = clock;
  thr.classList.add('open');
  sound.start().then(() => gallerySound(true));   // SPEC: sound starts when the visitor lets go
}

/* ---------- gallery sound: a soft room tone, and a whisper of a window's scene ---------- */
let galleryBus = null, galleryLayers = [];
function gallerySound(on) {
  if (!sound.ready) return;
  if (on && !galleryBus) {
    galleryBus = new Tone.Gain(0).connect(sound.bus);
    const buf = AUDIO.buffers['loop:gallery-air'];
    if (buf) {                                        // a soft recorded wind, very low
      const pl = new Tone.Player(buf); pl.loop = true; const g = new Tone.Gain(0.3);
      pl.chain(g, galleryBus); pl.start(Tone.now() + 0.02, rand(0, buf.duration - 1));
      galleryLayers = [pl, g];
    } else {
      const n = new Tone.Noise('pink'), f = new Tone.Filter({ type: 'lowpass', frequency: 320, Q: 0.2 }), g = new Tone.Gain(0.09);
      n.chain(f, g, galleryBus); n.start();
      galleryLayers = [n, f, g];
    }
    galleryBus.gain.rampTo(1, 3);
    sound.pad.triggerAttackRelease(['D3', 'A3', 'E4'], 8, Tone.now() + 0.6, 0.45);
  } else if (!on && galleryBus) {
    const bus = galleryBus, layers = galleryLayers; galleryBus = null; galleryLayers = [];
    bus.gain.rampTo(0, 3);                            // SPEC: the gallery sound fades as the scene sound rises
    setTimeout(() => { layers.forEach((x) => { try { x.stop && x.stop(); x.dispose(); } catch (e) {} }); try { bus.dispose(); } catch (e) {} }, 3400);
  }
}
let whisper = null, whisperTimer = 0;
function whisperOn(S) {                             // SPEC: the window's ambience rises to a whisper
  clearTimeout(whisperTimer);
  whisperTimer = setTimeout(() => {
    if (state !== 'gallery' || !sound.ready || whisper === S) return;
    whisperOff();
    whisper = S; sound.openScene(S, 0.22);
  }, 350);
}
function whisperOff() {
  clearTimeout(whisperTimer);
  if (whisper && state === 'gallery') { sound.closeScene(1.5); whisper = null; }
}

/* ---------- gallery: windows adrift in a dark abyss ---------- */
const gallery = $('gallery'), field = $('field'), deep = $('deep');
const LATER = ['cherry blossoms', 'bakery at dawn', 'park at sunrise', 'aurora'];   // SPEC: later scenes sit unlit
// Each window shows a still of its own scene (rendered offline at the high tier), the one nearest the hour
// the visitor left it at. glow: the light the still spills onto the dark. The SVG windowArt() stays beneath as the fallback.
const ART = {
  lake: { hours: [0.25, 0.58, 0.72, 0.92], glow: ['189,188,170', '192,151,115', '175,127,105', '134,145,146'] },
  rain: { hours: [0.22, 0.5, 0.7, 0.9], glow: ['158,153,123', '155,152,126', '181,134,99', '146,154,127'] },
  fire: { hours: [0.3, 0.58, 0.74, 0.9], glow: ['177,173,155', '198,145,103', '182,131,98', '163,141,118'] }
};
const GAL_P = 1000;                                   // CSS perspective of #gallery, in px
const drift = { on: false, px: 0, py: 0, tx: 0, ty: 0 };
const wins = [], motes = [];
function setWindowArt(w, h) {
  const S = SCENES[w.id], a = ART[w.id];
  if (w.hn) w.hn.textContent = S.hourName ? S.hourName(h) : '';
  if (!a || !w.img) return;
  let i = 0; a.hours.forEach((x, k) => { if (Math.abs(x - h) < Math.abs(a.hours[i] - h)) i = k; });
  w.el.style.setProperty('--glow', a.glow[i]);
  const src = `art/${w.id}-${i}.webp`;
  if (w.src === src) return;
  w.src = src;
  const pre = new Image();                            // load first, then swap, so the window never flashes empty
  pre.decoding = 'async';
  pre.onload = () => { if (w.src === src && w.img) { w.img.src = src; w.img.classList.add('ready'); } };
  pre.onerror = () => { if (w.src === src && w.img && !w.img.classList.contains('ready')) { w.img.remove(); w.img = null; } };   // the SVG art shows instead
  pre.src = src;
}
function buildGallery() {
  field.innerHTML = '';
  wins.length = 0;
  ORDER.forEach((id, i) => {
    const S = SCENES[id];
    const h = store.get('hour.' + id, S.defaultHour);
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'win'; b.dataset.id = id;
    b.setAttribute('aria-label', S.describe(h));
    b.style.setProperty('--glow', '201,163,91');
    b.innerHTML = `<div class="glow" aria-hidden="true"></div><div class="frame" aria-hidden="true"><div class="art"><div class="kb">${S.windowArt()}<img alt="" draggable="false"><i class="fx fx-${id}"></i></div><i class="veil"></i></div></div><div class="wt" aria-hidden="true">${S.title}<span class="hn"></span></div>`;
    b.style.setProperty('--kb-dur', (38 + i * 9) + 's'); b.style.setProperty('--kb-delay', (-i * 13) + 's');
    field.appendChild(b);
    const w = { el: b, id, lit: true, img: b.querySelector('img'), veil: b.querySelector('.veil'), hn: b.querySelector('.hn'),
      hover: false, focus: false, lift: 0, t: 0, seed: 1.3 + i * 2.71, dim: -1 };
    wins.push(w);
    setWindowArt(w, h);
    b.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { w.hover = true; whisperOn(S); } });
    b.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') { w.hover = false; whisperOff(); } b.classList.remove('lit'); });
    b.addEventListener('focus', () => { if (b.matches(':focus-visible')) { w.focus = true; whisperOn(S); } });
    b.addEventListener('blur', () => { w.focus = false; whisperOff(); });
    b.addEventListener('pointerdown', () => { b.classList.add('lit'); });
    b.addEventListener('click', (e) => {
      if (state !== 'gallery') return;
      const r = b.getBoundingClientRect();
      const x = e.detail === 0 ? r.left + r.width / 2 : e.clientX, y = e.detail === 0 ? r.top + r.height / 2 : e.clientY;
      openScene(id, x, y, b);
    });
  });
  LATER.forEach((name, i) => {
    const b = document.createElement('div');
    b.className = 'win unlit'; b.setAttribute('aria-hidden', 'true');
    b.innerHTML = '<div class="frame"></div>';
    field.appendChild(b); wins.push({ el: b, id: name, lit: false, lift: 0, t: 0, seed: 9.7 + i * 3.37 });
  });
  deep.innerHTML = ''; motes.length = 0;                // a few faint motes drifting in the deep
  const r = seeded(11);
  for (let i = 0; i < 22; i++) {
    const m = document.createElement('i'), d = r();
    m.className = 'mote';
    m.style.setProperty('--s', (1.6 + d * 2.6).toFixed(1) + 'px'); m.style.opacity = (0.1 + d * 0.32).toFixed(2);
    deep.appendChild(m);
    motes.push({ el: m, u: r(), v: r(), d, a: r() * 6.283, sp: 0.006 + r() * 0.008 });
  }
  layoutGallery();
}
function layoutGallery() {
  const vw = innerWidth, vh = innerHeight, portrait = vw < vh * 0.9;
  // the size a window reads at on screen; it floats a little behind the glass, so its box is a little larger
  const Wt = portrait ? Math.min(vw * 0.58, vh * 0.17 * 1.5, 320) : clamp1(Math.min(vw * 0.23, vh * 0.4 * 1.5), 120, 400);
  const W = Wt * 1.12, H = W * 2 / 3;
  // home of each window: x and y as parts of the viewport, z in px (negative is deeper). Lit windows near, unlit ones far behind.
  const lit = portrait ? [[-0.07, -0.31, -110], [0.08, -0.02, -50], [-0.05, 0.27, -160]] : [[-0.33, -0.11, -120], [0.0, 0.09, -50], [0.33, -0.07, -170]];
  const dark = [[-0.44, -0.36, -700], [0.03, -0.41, -760], [0.45, 0.37, -680], [-0.41, 0.4, -640]];   // far corners; a phone has no room for them
  let li = 0, di = 0;
  for (const w of wins) {
    const [u, v, z] = w.lit ? lit[li++ % lit.length] : dark[di++ % dark.length];
    const ww = w.lit ? W : W * 0.72;
    if (!w.lit) w.el.hidden = portrait;
    const k = (GAL_P - z) / GAL_P;                    // place by where it lands on screen, not where it sits in depth
    w.bx = u * vw * k; w.by = v * vh * k; w.bz = z; w.W = ww; w.H = ww * 2 / 3;
    // drift reach: small enough that neighbours never cross, large enough to feel adrift
    w.ax = portrait ? vw * 0.025 : Math.min(vw * 0.02, 26); w.ay = portrait ? vh * 0.014 : vh * 0.03; w.az = w.lit ? 45 : 80;
    w.el.style.setProperty('--w', ww.toFixed(1) + 'px');
  }
  drift.vw = vw; drift.vh = vh; drift.m = portrait ? 8 : 12;
  if (drift.on || state === 'gallery') tickGallery(0);
}
// a slow parallax from the pointer, or from a finger on a phone
const aim = (e) => { if (state !== 'gallery') return; drift.tx = clamp1(e.clientX / innerWidth * 2 - 1, -1, 1); drift.ty = clamp1(e.clientY / innerHeight * 2 - 1, -1, 1); };
gallery.addEventListener('pointerdown', (e) => { if (state !== 'gallery') return; sound.unlock(); aim(e); });
gallery.addEventListener('pointermove', aim);
const pressEnd = () => { wins.forEach((w) => { if (!w.el.matches(':hover')) w.el.classList.remove('lit'); }); };
gallery.addEventListener('pointerup', pressEnd);
gallery.addEventListener('pointercancel', pressEnd);
const f1 = (n) => n.toFixed(1), f2 = (n) => n.toFixed(2);
function tickGallery(dt) {
  if (!drift.on || !drift.vw) return;                 // the loop rests while the gallery is hidden
  const still = settings.still || reduceMotionQuery.matches;   // SPEC: reduced motion: no drift, still images
  const vw2 = drift.vw / 2, vh2 = drift.vh / 2, m = drift.m;
  const kp = 1 - Math.exp(-dt / 2.2);
  drift.px += (drift.tx - drift.px) * kp; drift.py += (drift.ty - drift.py) * kp;
  const px = still ? 0 : drift.px, py = still ? 0 : drift.py;
  for (const w of wins) {
    const hot = w.lit && (w.hover || w.focus || w.el.classList.contains('lit'));
    w.lift += ((hot ? 1 : 0) - w.lift) * (1 - Math.exp(-dt / (still ? 0.2 : 0.8)));
    if (!still) w.t += dt * (1 - 0.8 * w.lift);       // a lit window almost holds still under the hand
    const t = w.t, s0 = w.seed;
    let x = w.bx, y = w.by, z = w.bz, rx = 0, ry = 0;
    if (!still) {                                     // sums of sines with unrelated periods: a path that never repeats
      x += w.ax * (0.62 * Math.sin(t * 0.0711 + s0) + 0.38 * Math.sin(t * 0.1173 + s0 * 1.7));
      y += w.ay * (0.6 * Math.sin(t * 0.0617 + s0 * 2.3) + 0.4 * Math.sin(t * 0.1291 + s0 * 0.6));
      z += w.az * (0.7 * Math.sin(t * 0.0493 + s0 * 3.1) + 0.3 * Math.sin(t * 0.0839 + s0 * 1.1));
      rx = 2.6 * Math.sin(t * 0.0831 + s0 * 1.3) + 1.2 * Math.sin(t * 0.137 + s0);
      ry = 3.6 * Math.sin(t * 0.0571 + s0 * 2.9) + 1.4 * Math.sin(t * 0.1033 + s0 * 0.4);
    }
    const near = clamp1((z + 800) / 800, 0, 1);       // the near windows move more under the parallax
    x -= px * 22 * near; y -= py * 14 * near; ry += px * 3 * near; rx -= py * 2 * near;
    z += w.lift * 95; rx *= 1 - 0.75 * w.lift; ry *= 1 - 0.75 * w.lift;
    // keep the whole window, and its title, inside the screen
    const s = GAL_P / (GAL_P - z), hw = s * w.W / 2, hh = s * w.H / 2, below = w.lit ? s * (w.H / 2 + 14 + w.W * 0.2) : hh;
    const mx = Math.max(0, vw2 - m - hw) / s;
    x = clamp1(x, -mx, mx);
    y = clamp1(y, Math.min(0, -vh2 + m + hh) / s, Math.max(0, vh2 - m - below) / s);
    w.el.style.transform = `translate3d(${f1(x)}px,${f1(y)}px,${f1(z)}px) rotateX(${f2(rx)}deg) rotateY(${f2(ry)}deg)`;
    if (w.veil) {                                     // farther is dimmer; a lit window comes up into the light
      const dim = clamp1(-z / 900, 0, 0.5) * 0.6 + (1 - w.lift) * 0.14;
      if (Math.abs(dim - w.dim) > 0.003) { w.dim = dim; w.veil.style.opacity = dim.toFixed(3); }
    }
  }
  if (still) return;
  const T = clock, W2 = drift.vw + 40, H2 = drift.vh + 40;
  for (const p of motes) {
    const x = ((p.u * W2 + Math.sin(T * 0.05 + p.a) * 30 - px * 30 * p.d) % W2 + W2) % W2 - 20;
    const y = (((p.v - T * p.sp * (0.4 + p.d)) * H2 + Math.sin(T * 0.07 + p.a * 2) * 16 - py * 20 * p.d) % H2 + H2) % H2 - 20;
    p.el.style.transform = `translate3d(${f1(x)}px,${f1(y)}px,0)`;
  }
}
function startDrift() {
  gallery.classList.toggle('still', settings.still);
  drift.on = true; tickGallery(0);
}
function showGallery() {
  state = 'gallery';
  gallery.hidden = false;
  startDrift();
  requestAnimationFrame(() => gallery.classList.add('on'));
  wins.forEach((w) => w.el.classList.remove('lit'));
  const first = wins.find((w) => w.id === (current && current.id)) || wins[0];
  setTimeout(() => { if (state === 'gallery' && first && keyboardUser) first.el.focus({ preventScroll: true }); }, 1300);
}
function hideGallery() {
  gallery.classList.remove('on');
  setTimeout(() => { if (state !== 'gallery') { gallery.hidden = true; drift.on = false; } }, 1300);
}

/* ---------- open a scene from its window ---------- */
let pixelCap = Math.min(devicePixelRatio || 1, 2);
function setScene(S) {
  if (!S.built) { S.build(); S.built = true; S.resize(VW, ASPECT); }
  current = S;
  Object.assign(CAM, S.camera || { x: 0, y: 0.55, z: 6, pitch: -1.2 * DEG });
  F.aperture.value = S.aperture ?? 0.00016; F.maxblur.value = S.maxblur ?? 0.005;   // a scene can ask for a shallower or deeper focus
  const lo = S.hourMin ?? 0, hi = S.hourMax ?? 1;
  hour = hourTarget = clamp1(store.get('hour.' + S.id, S.defaultHour), lo, hi);
  S.applyHour(hour);
  canvas.setAttribute('aria-label', S.describe(hour));
  $('title').textContent = S.title;
  drawArc();
}
function openScene(id, x, y, winEl) {
  const S = SCENES[id];
  state = 'opening';
  openWin = { x: x / innerWidth, y: y / innerHeight, el: winEl };
  F.center.value.set(openWin.x, openWin.y);           // screenUV runs top-down on both backends
  F.bleed.value = 0;
  sound.unlock();
  setScene(S);
  look.yaw = look.pitch = look.ty = look.tp = 0;
  focus.next = clock + rand(14, 24); focus.from = focus.to = S.focusMid || 12; F.focus.value = focus.to;
  // SPEC: the scene spreads from the tap point over 3 s; the gallery sound fades as the scene sound rises
  if (whisper === S) { sound.sceneLevel(1, 3); whisper = null; }
  else { if (whisper) { sound.closeScene(1.5); whisper = null; } sound.openScene(S); }
  gallerySound(false);
  hideGallery();
  try { post.render(); } catch (e) { console.error(e); }   // compile the scene behind the ink, before the bleed starts
  bleedStartAt(0, 1, 3, 0.25);
  titleStart = clock + 3.4;                          // SPEC: the title fades in after the scene opens
  $('title').style.transition = '';
  S.enter && S.enter();
  markActivity(true);
}
function bleedStartAt(from, to, dur, delay = 0) { bleedFrom = from; bleedTo = to; bleedDur = dur; bleedStart = clock + delay; }

function goBack() {
  if (state !== 'scene') return;
  state = 'leaving'; hideControls(true);
  $('title').style.transition = 'opacity 1.2s'; titleStart = -99;   // a title still showing fades with the scene, not over the gallery
  if (resting) wake();
  bleedStartAt(1, 0, 2.5);                           // SPEC: return draws back into its window over 2.5 s
  sound.closeScene(2.5);
  current.leave && current.leave();
  setTimeout(() => {
    state = 'gallery';
    gallery.hidden = false; startDrift(); requestAnimationFrame(() => gallery.classList.add('on'));
    gallerySound(true);
    wins.forEach((w) => w.el.classList.remove('lit'));
    const w = wins.find((v) => v.id === current.id);
    if (w) { w.el.setAttribute('aria-label', current.describe(hour)); setWindowArt(w, hourTarget); }   // the window now shows the hour it was left at
    if (w && keyboardUser) w.el.focus({ preventScroll: true });
  }, 2600);
}

/* ---------- rest: timer end and sleep fade. SPEC: 60 s for the timer, 3 min after 30 min with no touch ---------- */
function startRest(sec) {
  if (resting) return; resting = true;
  dimFrom = dim; dimTo = 1; dimStart = clock; dimDur = sec;
  sound.fadeTo(0, sec);
  $('restlight').classList.add('on');
  hideControls(true);
}
function wake() {
  if (!resting) return; resting = false;
  dimFrom = dim; dimTo = 0; dimStart = clock; dimDur = 4;
  sound.unlock(); sound.fadeTo(1, 4);
  $('restlight').classList.remove('on');
  setTimer(0);
}

/* ---------- controls: back, hour, rest ---------- */
const controls = $('controls'), arc = $('arc'), panel = $('panel');
let ctlHideAt = 0, overControls = false;
function showControls() {
  if (state !== 'scene' || resting) return;
  controls.classList.add('show'); ctlHideAt = clock + 3;    // SPEC: fade out after 3 s with no movement
}
function keyFocusInControls() { const a = document.activeElement; try { return controls.contains(a) && a.matches(':focus-visible'); } catch (e) { return false; } }
function hideControls(force) {
  controls.classList.remove('show');
  if (force) { arc.hidden = true; panel.hidden = true; $('b-hour').setAttribute('aria-expanded', 'false'); $('b-rest').setAttribute('aria-expanded', 'false'); }
}
controls.addEventListener('pointerenter', () => { overControls = true; });
controls.addEventListener('pointerleave', () => { overControls = false; });
controls.addEventListener('focusin', showControls);
$('b-back').addEventListener('click', goBack);
$('b-hour').addEventListener('click', () => {
  const open = arc.hidden; arc.hidden = !open; panel.hidden = true;
  $('b-hour').setAttribute('aria-expanded', String(open)); $('b-rest').setAttribute('aria-expanded', 'false');
  showControls();
});
$('b-rest').addEventListener('click', () => {
  const open = panel.hidden; panel.hidden = !open; arc.hidden = true;
  $('b-rest').setAttribute('aria-expanded', String(open)); $('b-hour').setAttribute('aria-expanded', 'false');
  showControls();
});

const ARC = { cx: 260, cy: 104, rx: 240, ry: 84 };
const arcPoint = (s) => { const a = Math.PI * (1 - s); return { x: ARC.cx + ARC.rx * Math.cos(a), y: ARC.cy - ARC.ry * Math.sin(a) }; };
function drawArcTrack() {
  const lo = current ? current.hourMin ?? 0 : 0, hi = current ? current.hourMax ?? 1 : 1;
  let d = ''; for (let i = 0; i <= 80; i++) { const p = arcPoint(lerp(lo, hi, i / 80)); d += (i ? 'L' : 'M') + p.x.toFixed(1) + ' ' + p.y.toFixed(1); }
  $('arctrack').setAttribute('d', d); $('archit').setAttribute('d', d);
}
function drawArc() {
  drawArcTrack();
  const p = arcPoint(hourTarget);
  for (const id of ['arcdot', 'arcglow']) { $(id).setAttribute('cx', p.x.toFixed(1)); $(id).setAttribute('cy', p.y.toFixed(1)); }
  const svg = $('arcsvg'); svg.setAttribute('aria-valuenow', String(Math.round(hourTarget * 100)));
  svg.setAttribute('aria-valuetext', current && current.hourName ? current.hourName(hourTarget) : '');
}
function setHourTarget(h) {
  const lo = current ? current.hourMin ?? 0 : 0, hi = current ? current.hourMax ?? 1 : 1;
  hourTarget = clamp1(h, lo, hi); drawArc();
  if (current) store.set('hour.' + current.id, hourTarget);    // SPEC: each scene keeps its own hour
}
const arcsvg = $('arcsvg');
let arcDrag = false;
function arcFromEvent(e) {
  const r = arcsvg.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width * 520, y = (e.clientY - r.top) / r.height * 112;
  let best = 0, bd = 1e9; for (let i = 0; i <= 200; i++) { const p = arcPoint(i / 200); const d = (p.x - x) ** 2 + (p.y - y) ** 2; if (d < bd) { bd = d; best = i / 200; } }
  setHourTarget(best);
}
arcsvg.addEventListener('pointerdown', (e) => { arcDrag = true; arcsvg.setPointerCapture(e.pointerId); arcFromEvent(e); showControls(); });
arcsvg.addEventListener('pointermove', (e) => { if (arcDrag) { arcFromEvent(e); showControls(); } });
arcsvg.addEventListener('pointerup', () => { arcDrag = false; });
arcsvg.addEventListener('keydown', (e) => {                 // SPEC: arrow keys move the hour dot
  const st = e.shiftKey ? 0.1 : 0.03;
  if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { setHourTarget(hourTarget - st); e.preventDefault(); }
  if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { setHourTarget(hourTarget + st); e.preventDefault(); }
  if (e.key === 'Home') setHourTarget(0);
  if (e.key === 'End') setHourTarget(1);
  showControls();
});

const vol = $('volume'); vol.value = settings.volume;
vol.addEventListener('input', () => { settings.volume = +vol.value; store.set('volume', settings.volume); sound.setVolume(settings.volume); showControls(); });
let timerLen = 0, timerShown = -1;
const tglass = $('timerglass'), tglassT = tglass.querySelector('.tt'), tglassP = tglass.querySelector('.tp');
function updateTimerGlass() {                                  // the glass countdown shows while a timer runs in a scene
  const on = !!timerEnd && state === 'scene' && !resting;
  tglass.classList.toggle('on', on);
  if (!on) return;
  const left = Math.max(0, Math.ceil(timerEnd - clock));
  if (left === timerShown) return;
  timerShown = left;
  tglassT.textContent = Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0');
  tglassP.style.strokeDashoffset = String(100 - (100 * left) / timerLen);
}
tglass.addEventListener('click', () => {                       // open the rest panel, where the timer can change
  if (state !== 'scene') return;
  arc.hidden = true; panel.hidden = false;
  $('b-rest').setAttribute('aria-expanded', 'true'); $('b-hour').setAttribute('aria-expanded', 'false');
  showControls();
});
function setTimer(min) {
  timerEnd = min ? clock + min * 60 : 0; timerLen = min * 60; timerShown = -1;
  document.querySelectorAll('#timer button').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.min === min)));
}
document.querySelectorAll('#timer button').forEach((b) => b.addEventListener('click', () => { setTimer(+b.dataset.min); showControls(); }));
function syncSwitches() {
  const h = $('sw-haptics'), s = $('sw-still');
  h.setAttribute('aria-pressed', String(settings.haptics)); h.textContent = settings.haptics ? 'on' : 'off';
  s.setAttribute('aria-pressed', String(settings.still)); s.textContent = settings.still ? 'on' : 'off';
  F.cross.value = settings.still ? 1 : 0;           // SPEC: the ink bleed becomes a slow cross-fade
}
$('sw-haptics').addEventListener('click', () => { settings.haptics = !settings.haptics; store.set('haptics', settings.haptics); syncSwitches(); haptic(10); showControls(); });
$('sw-still').addEventListener('click', () => { settings.still = !settings.still; store.set('still', settings.still); syncSwitches(); showControls(); });
syncSwitches();
$('b-credits').addEventListener('click', () => { const c = $('credits'); c.hidden = !c.hidden; $('b-credits').setAttribute('aria-expanded', String(!c.hidden)); showControls(); });

addEventListener('keydown', (e) => {                // SPEC: M mutes, Esc goes back to the gallery
  if (e.key === 'm' || e.key === 'M') { sound.muted = !sound.muted; sound.setVolume(settings.volume); }
  if (state !== 'scene') return;
  markActivity(true);
  if (resting) { wake(); return; }
  if (e.key === 'Escape') { if (!arc.hidden || !panel.hidden) hideControls(true); else goBack(); }
  if (e.key === 'Tab') showControls();
});

/* ---------- pointer gestures on the scene ---------- */
const pointers = new Map();
let gesture = null;
const holdcue = $('holdcue');
E.holdCue = {
  at(x, y) { holdcue.style.left = x + 'px'; holdcue.style.top = y + 'px'; },
  show(f) { holdcue.style.opacity = String(0.85 * f); holdcue.style.transform = `scale(${0.3 + f * 0.7})`; },
  hide() { holdcue.style.opacity = '0'; holdcue.style.transform = 'scale(0.2)'; }
};
function markActivity(touch) { lastStill = clock; if (touch) lastTouch = clock; }
const skyV = new THREE.Vector3();
canvas.addEventListener('pointerdown', (e) => {
  if (state !== 'scene') return;
  if (!sound.running()) sound.unlock();               // a browser can suspend the audio; every touch tries to wake it
  canvas.setPointerCapture?.(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  markActivity(true);
  if (resting) { wake(); gesture = { type: 'none' }; return; }
  if (e.pointerType !== 'mouse') showControls();
  if (pointers.size === 2) { E.holdCue.hide(); gesture = { type: 'look' }; return; }   // SPEC: two-finger drag turns the view on phones
  if (pointers.size > 2) return;
  const p = { x: e.clientX, y: e.clientY, id: e.pointerId, type: e.pointerType };
  const body = current.skyBody && current.skyBody();
  if (body && nearScreen(skyV.copy(camera.position).addScaledVector(body, 100), p.x, p.y, 70)) {   // SPEC: drag the sun or moon
    gesture = { type: 'sky', x0: p.x, h0: hourTarget }; return;
  }
  try { gesture = current.pointerDown(p) || { type: 'none' }; } catch (err) { console.error(err); gesture = { type: 'none' }; }
});
canvas.addEventListener('pointermove', (e) => {
  const x = e.clientX, y = e.clientY;
  if (e.pointerType === 'mouse') {
    const arcY = settings.still ? 4 : 8, arcP = settings.still ? 2 : 4;   // SPEC: 8 degrees left and right, 4 up and down; 4 in still mode
    look.ty = -(x / innerWidth * 2 - 1) * arcY * DEG;
    look.tp = -(y / innerHeight * 2 - 1) * arcP * DEG;
    if (state === 'scene') { showControls(); if (!pointers.size) lastStill = clock; }
  }
  if (!pointers.has(e.pointerId) || state !== 'scene') return;
  const prev = pointers.get(e.pointerId);
  pointers.set(e.pointerId, { x, y });
  markActivity(false);
  if (!gesture || gesture.type === 'none') return;
  if (gesture.type === 'look') {
    const arcY = (settings.still ? 4 : 8) * DEG, arcP = (settings.still ? 2 : 4) * DEG;
    look.ty = clamp1(look.ty - (x - prev.x) / innerWidth * 0.5, -arcY, arcY);
    look.tp = clamp1(look.tp - (y - prev.y) / innerHeight * 0.5, -arcP, arcP);
    return;
  }
  if (gesture.type === 'sky') { setHourTarget(gesture.h0 + (x - gesture.x0) / innerWidth * 0.9); return; }
  try { current.pointerMove && current.pointerMove(gesture, { x, y, id: e.pointerId, type: e.pointerType }, prev); } catch (err) { console.error(err); }
});
function pointerEnd(e) {
  if (!pointers.has(e.pointerId)) return;
  pointers.delete(e.pointerId);
  const g = gesture;
  if (pointers.size === 0) gesture = null;
  E.holdCue.hide();
  if (!g || g.type === 'none' || g.type === 'look' || g.type === 'sky' || state !== 'scene') return;
  try { current.pointerUp && current.pointerUp(g, { x: e.clientX, y: e.clientY, id: e.pointerId, type: e.pointerType }); } catch (err) { console.error(err); }
}
canvas.addEventListener('pointerup', pointerEnd);
canvas.addEventListener('pointercancel', pointerEnd);
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

/* ---------- sizing and quality ---------- */
function resize() {
  const w = innerWidth, h = innerHeight, aspect = w / h;
  const vfov = clamp1(2 * Math.atan(Math.tan(36 * DEG) / aspect), 45 * DEG, 70 * DEG);
  camera.fov = vfov / DEG; camera.aspect = aspect; camera.updateProjectionMatrix();
  VW = Math.tan(vfov / 2) * aspect; ASPECT = aspect;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, pixelCap));
  renderer.setSize(w, h, false);
  F.aspect.value = aspect;
  for (const id of ORDER) { const S = SCENES[id]; if (S.built) S.resize(VW, aspect); }
  layoutGallery();
}
addEventListener('resize', resize);

// SPEC: measure frame time for the first 3 s of a scene, then pick a tier and keep it.
const tier = { measuring: false, start: 0, frames: 0, done: false, name: 'high' };
function measureTier() {
  if (tier.done || state !== 'scene') return;
  if (!tier.measuring) { tier.measuring = true; tier.start = performance.now(); tier.frames = 0; return; }
  tier.frames++;
  const el = performance.now() - tier.start;
  if (el > 3000) {
    const ms = el / tier.frames; tier.done = true;
    tier.name = ms > 24 ? 'low' : ms > 17.5 ? 'medium' : 'high';
    const cap = tier.name === 'low' ? 1 : tier.name === 'medium' ? 1.5 : 2;
    buildPost(tier.name);
    if (cap < pixelCap) { pixelCap = cap; resize(); }
  }
}

/* ---------- the frame loop ---------- */
let last = performance.now();
let frameSkip = false;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  // SPEC battery rule: after 20 s with no touch, drop to 30 fps
  if (state === 'scene' && clock - lastTouch > 20 && !resting) { frameSkip = !frameSkip; if (frameSkip) return; }
  last = now; clock += dt;

  tickThreshold(dt);
  tickGallery(dt);
  if (!current || state === 'threshold' || state === 'gallery' || state === 'gallery-wait') return;   // nothing to draw behind the threshold and the gallery

  hour += (hourTarget - hour) * (1 - Math.exp(-dt / 1.3));    // SPEC: the light catches up over at least 4 s
  current.applyHour(hour);
  $('title').classList.toggle('night', current.env.night > 0.5);

  const bf = clamp1((clock - bleedStart) / bleedDur, 0, 1);
  F.bleed.value = lerp(bleedFrom, bleedTo, settings.still ? bf : easeIO(bf));
  if (state === 'opening' && clock - bleedStart >= bleedDur) { state = 'scene'; markActivity(true); }

  // camera. SPEC: breathing drift on a 10 s cycle, about 3 cm and 0.3 degrees; cursor turn with a soft lag
  const k = 1 - Math.exp(-dt / 0.5);
  look.yaw += (look.ty - look.yaw) * k; look.pitch += (look.tp - look.pitch) * k;
  const br = settings.still ? 0 : Math.sin(clock * Math.PI * 2 / 10);
  camera.position.set(CAM.x, CAM.y + br * 0.03, CAM.z);
  camera.rotation.set(CAM.pitch + look.pitch + br * 0.3 * DEG, look.yaw, 0);
  camera.updateMatrixWorld();

  const tt = clock - titleStart;                              // SPEC: the title fades in and out over 6 s
  $('title').style.opacity = String(tt < 0 || tt > 6 ? 0 : smooth(0, 2.2, tt) * (1 - smooth(3.8, 6, tt)));

  if (controls.classList.contains('show') && clock > ctlHideAt && !overControls && !arcDrag && !keyFocusInControls()) hideControls(true);

  if (state === 'scene') {
    if (timerEnd && clock > timerEnd) { timerEnd = 0; startRest(60); }
    updateTimerGlass();
    if (!resting && clock - lastTouch > 30 * 60) startRest(180);
    measureTier();
  }
  if (state !== 'scene' && tglass.classList.contains('on')) updateTimerGlass();
  dim = lerp(dimFrom, dimTo, clamp1((clock - dimStart) / dimDur, 0, 1));
  F.dim.value = dim;

  try {
    if (gesture && gesture.type !== 'none' && gesture.type !== 'look' && gesture.type !== 'sky' && current.tick) current.tick(gesture);
    current.update(dt, clock, { active: state === 'scene', still: clock - lastStill, resting, hour });
  } catch (err) { console.error(err); }
  updateFocus();
  sound.updateListener();

  uTime.value = clock;
  F.grainT.value = Math.floor(clock * 24) / 24;               // SPEC: grain updates 24 times a second
  scenePass.scene = current.scene;
  post.render();
  if (state === 'leaving' && F.bleed.value <= 0.0001) state = 'gallery-wait';   // the scene is fully drawn back; stop drawing
}

/* SPEC: when the tab is hidden, rendering stops and the sound fades out over 2 s. */
document.addEventListener('visibilitychange', () => {
  if (document.hidden) sound.fadeTo(0, 2);
  else { last = performance.now(); if (state !== 'threshold' && !resting) { sound.unlock(); sound.fadeTo(1, 3); } }
});

buildGallery();
resize();
$('loading').hidden = true;
renderer.setAnimationLoop(frame);
window.__halcyon = {
  backend: BACKEND, E,
  state: () => state, scene: () => current && current.id, focus: () => F.focus.value, sound,
  enter() { breath.b = 1; openThreshold(); },
  gallery() { breath.opening = false; thr.hidden = true; if (state === 'threshold') showGallery(); },
  open(id) { const w = wins.find((v) => v.id === id); const r = w.el.getBoundingClientRect(); openScene(id, r.left + r.width / 2, r.top + r.height / 2, w.el); },
  back: () => goBack(),
  holdBleed(v) { bleedFrom = bleedTo = v; },
  setHour(h) { setHourTarget(h); hour = hourTarget; },
  quality(name) { tier.done = true; tier.name = name; buildPost(name); }   // offline snapshots: hold a fixed quality tier
};

/* =====================================================================
   Scene: resting waters. A lake at golden hour, seen from low among the reeds.
   This block is the model for every scene: it uses only E (the engine) and calls E.defineScene().
   Layers, far to near: painted sky with soft clouds, a far range, hills, two lines of tree crowns
   with birches, the meadow strip, the reflecting water, the near bank with grass, sedge and reeds,
   a willow that leans in over the top of the frame.
   ===================================================================== */
{
  const { THREE, TSL, DEG, clamp1, lerp, smooth, easeIO, easeOut, rand, seeded, makeEnv, GLOW, Pool, sound, haptic, hitPlaneY, toScreen, nearScreen, focusOn, uTime, vnoise, fbm, hash12 } = E;
  const { Fn, Loop, uniform, uniformArray, attribute, float, vec2, vec3, positionWorld, positionGeometry, cameraPosition, reflector, normalWorld,
    mix, smoothstep, pow, exp, max, min, clamp, step, sin, cos, abs, length, normalize, dot, reflect, atan2, asin, floor, fract } = TSL;

  /* Hour stops. Extra keys for this scene: deep (water), hill, tree, meadow, land (bank), grass, leaf (willow, pads), far (distant range). */
  const STOPS = [
    { t: 0.00, top: '#7A8584', hor: '#D9CDB8', glow: '#EBD8BC', sun: '#F3E6CF', sunEl: 1.2, moonEl: -12, sunAz: 0.24, moonAz: 0.12, star: 0, cloud: .3, cloudCol: '#CFC4B1', deep: '#56625F', fog: '#CDC6B6', hill: '#8E9089', tree: '#4E504A', meadow: '#7F7D6A', land: '#3B372E', grass: '#545646', leaf: '#5C6152', far: '#A9AAA0', mist: 1.0, light: .62, sunVis: .55 },
    { t: 0.25, top: '#7F9898', hor: '#E6DCC6', glow: '#F2E6CF', sun: '#FFF4DE', sunEl: 36, moonEl: -20, sunAz: 0.24, moonAz: 0.12, star: 0, cloud: .42, cloudCol: '#F1E8D6', deep: '#4A6667', fog: '#D9D2C0', hill: '#8E907A', tree: '#4A4C3A', meadow: '#A39A5C', land: '#4A3F30', grass: '#6E6A40', leaf: '#6F7046', far: '#B4B5A6', mist: .06, light: 1.0, sunVis: 1 },
    { t: 0.45, top: '#788B8A', hor: '#EAD3AE', glow: '#F2DDB6', sun: '#FBEBCB', sunEl: 15, moonEl: -20, sunAz: 0.24, moonAz: 0.12, star: 0, cloud: .38, cloudCol: '#EDD9B9', deep: '#465A5B', fog: '#DCC9A8', hill: '#94876E', tree: '#4A4033', meadow: '#A08A5E', land: '#45372B', grass: '#6A5F3C', leaf: '#6C6440', far: '#C2B49A', mist: .06, light: .92, sunVis: 1 },
    { t: 0.58, top: '#4A3528', hor: '#EBC9A0', glow: '#D9A383', sun: '#F6E8CC', sunEl: 4, moonEl: -16, sunAz: 0.24, moonAz: 0.12, star: 0, cloud: .45, cloudCol: '#D9A383', deep: '#33403F', fog: '#C99A7A', hill: '#8A6450', tree: '#3B2A20', meadow: '#8E6A4C', land: '#2E2219', grass: '#4A3826', leaf: '#4E3E28', far: '#B88D73', mist: .14, light: .76, sunVis: 1 },
    { t: 0.72, top: '#2B2530', hor: '#B9805F', glow: '#B9805F', sun: '#E8B48A', sunEl: -2.5, moonEl: 1, sunAz: 0.24, moonAz: 0.12, star: .22, cloud: .4, cloudCol: '#8A5A48', deep: '#222A29', fog: '#7A5546', hill: '#4E3A33', tree: '#231A15', meadow: '#4A3529', land: '#1B1410', grass: '#22190F', leaf: '#1F1812', far: '#6E4E44', mist: .3, light: .42, sunVis: .45 },
    { t: 0.86, top: '#0E1416', hor: '#1F2C30', glow: '#2A3A3C', sun: '#3A3A3A', sunEl: -14, moonEl: 9, sunAz: 0.24, moonAz: 0.12, star: .8, cloud: .2, cloudCol: '#2A3536', deep: '#0F1516', fog: '#1C2629', hill: '#1A2224', tree: '#0E1213', meadow: '#161C1C', land: '#0B0E0E', grass: '#0D1111', leaf: '#0B0F0F', far: '#1E2829', mist: .22, light: .24, sunVis: 0 },
    { t: 1.00, top: '#07090A', hor: '#15201F', glow: '#1E2A2B', sun: '#222222', sunEl: -22, moonEl: 19, sunAz: 0.24, moonAz: 0.12, star: 1, cloud: .16, cloudCol: '#1E2627', deep: '#0A0E0F', fog: '#141C1E', hill: '#121819', tree: '#0A0D0E', meadow: '#0F1313', land: '#08090A', grass: '#090B0B', leaf: '#08090A', far: '#161E1F', mist: .2, light: .17, sunVis: 0 }
  ];
  const hourName = (h) => h < 0.12 ? 'dawn' : h < 0.38 ? 'midday' : h < 0.52 ? 'afternoon' : h < 0.65 ? 'golden hour' : h < 0.79 ? 'dusk' : 'night';

  // module state, filled by build()
  let scene, env, U, sample, VW = 0.73, EDGE0 = 4.1, ASPECT = 1.78;
  let postMesh, postMat, bladeAttr, headMesh, headMat, fireflies, fluff, motes, bird, willow, padMesh, pebbleMesh;
  const blades = [], lanterns = [], stones = [];
  const POST = { x: 1.4, z: -0.3, top: 0.74 };
  const MAX_RIPPLES = 24;
  const ripples = Array.from({ length: MAX_RIPPLES }, () => new THREE.Vector4(0, 0, -99, 0));
  let rippleIdx = 0, rippleArr, ringU, rimU, moteNext = 0;
  const uVW = uniform(0.73), uEdge0 = uniform(4.1);
  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpV = new THREE.Vector3(), tmpS = new THREE.Vector3(1, 1, 1), tmpE = new THREE.Euler();
  const edgeZ = (x) => EDGE0 - 0.75 * smooth(0.45, 1.2, Math.abs(x) / (VW * 1.9)) + 0.12 * Math.sin(x * 2.3 + 0.7) + 0.07 * Math.sin(x * 5.9) + 0.03 * Math.sin(x * 13.1 + 1.0);
  // the same shoreline in TSL, for the shallows and the lapping line on the water
  const edgeT = (x) => uEdge0.sub(smoothstep(0.45, 1.2, abs(x).div(uVW.mul(1.9))).mul(0.75)).add(sin(x.mul(2.3).add(0.7)).mul(0.12)).add(sin(x.mul(5.9)).mul(0.07)).add(sin(x.mul(13.1).add(1.0)).mul(0.03));
  const ripple = (x, z, amp = 1) => { ripples[rippleIdx].set(x, z, E.clock, amp); rippleIdx = (rippleIdx + 1) % MAX_RIPPLES; };
  function hitWater(cx, cy) {
    const p = hitPlaneY(cx, cy, 0);
    if (!p || p.z < -54 || p.z > E.camera.position.z) return null;
    p.shore = p.z > edgeZ(p.x);
    return p;
  }

  /* ---------- star field, shared by the sky and the water (stars show in the lake at night) ---------- */
  const starField = (d) => {
    const az = atan2(d.x, d.z.negate());
    const sc = vec2(az, asin(clamp(d.y, -1, 1))).mul(62);
    const cell = floor(sc);
    const h = hash12(cell);
    const off = vec2(hash12(cell.add(3.1)), hash12(cell.add(7.7))).mul(0.6).add(0.2);
    const sd = length(fract(sc).sub(off));
    const tw = sin(uTime.mul(h.mul(0.5).add(0.25)).add(h.mul(40))).mul(0.4).add(0.6);
    return step(0.966, h).mul(smoothstep(0.1, 0.0, sd)).mul(tw).mul(h.mul(2).add(0.6));
  };

  /* ---------- painted sky: gradient, aureole, soft clouds in perspective, sun, moon, stars, low haze ---------- */
  function lakeSky() {
    const mat = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide, depthWrite: false }); mat.fog = false;
    mat.colorNode = Fn(() => {
      const d = normalize(positionWorld.sub(cameraPosition));
      const el = d.y;
      const col = mix(U.hor, U.top, pow(smoothstep(-0.02, 0.55, el), 0.62)).toVar();
      col.assign(mix(col, U.glow, exp(max(el, 0).mul(-26)).mul(0.22)));                 // a warm band lying on the horizon
      const sd = max(dot(d, U.sunDir), 0), md = max(dot(d, U.moonDir), 0);
      col.addAssign(U.glow.mul(pow(sd, 3).mul(0.1)).mul(U.sunVis));                       // wide aureole
      // clouds: projected on a high plane so they shrink toward the horizon, slowly drifting
      const ce = max(el, 0.0);
      const q = d.xz.div(ce.add(0.07)).mul(0.36).toVar();
      const w = uTime.mul(0.005);
      q.addAssign(vec2(w, w.mul(0.35)));
      const warp = vec2(vnoise(q.mul(0.55).add(4.7)), vnoise(q.mul(0.55).add(vec2(9.1, 2.3)))).sub(0.5).mul(1.7);
      const n = fbm(q.mul(vec2(0.8, 1.5)).add(warp));
      const cov = mix(float(0.7), float(0.47), clamp(U.cloud.mul(2.2), 0, 1));
      const dens = smoothstep(cov, cov.add(0.2), n).mul(smoothstep(0.015, 0.14, el)).toVar();
      const thick = smoothstep(cov.add(0.1), cov.add(0.38), n);
      const lit = U.cloudCol.mul(pow(sd, 5).mul(0.42).add(0.92)).add(U.sun.mul(pow(sd, 30)).mul(U.sunVis).mul(0.28));
      const shade = mix(U.top, U.cloudCol, mix(float(0.5), float(0.66), U.light)).mul(0.9);
      const cc = mix(lit, shade, thick.mul(0.62)).toVar();
      cc.addAssign(U.glow.mul(dens.oneMinus().mul(dens).mul(3.2)).mul(pow(sd, 6)).mul(U.sunVis).mul(0.7));   // bright rims on clouds near the sun
      cc.addAssign(vec3(0.42, 0.48, 0.5).mul(pow(md, 5)).mul(U.moon).mul(0.3));                             // moonlit edges at night
      col.assign(mix(col, cc, dens.mul(0.9)));
      const occl = dens.mul(0.8).oneMinus();
      // sun
      const above = smoothstep(-0.004, 0.006, el);
      col.addAssign(U.glow.mul(pow(sd, 16).mul(0.32).add(pow(sd, 220).mul(0.55))).mul(U.sunVis).mul(occl.mul(0.5).add(0.5)));
      col.assign(mix(col, U.sun.mul(2.4), smoothstep(0.99955, 0.99975, sd).mul(above).mul(U.sunVis).mul(occl)));
      // moon: halo, then a disc with faint markings
      col.addAssign(vec3(0.55, 0.62, 0.62).mul(pow(md, 30).mul(0.2).add(pow(md, 400).mul(0.28)).add(pow(md, 6).mul(0.05))).mul(U.moon));
      const mare = vnoise(d.xy.mul(110)).mul(0.5).add(vnoise(d.zy.mul(260)).mul(0.5));
      col.assign(mix(col, vec3(1.7, 1.75, 1.7).mul(mare.mul(0.22).add(0.86)), smoothstep(0.99985, 0.99992, md).mul(above).mul(U.moon).mul(occl)));
      // stars and a faint milky way
      col.addAssign(vec3(0.95, 0.9, 0.8).mul(starField(d)).mul(U.star).mul(smoothstep(0.02, 0.2, el)).mul(dens.oneMinus()));
      const bd = d.y.sub(d.x.mul(0.55)).sub(0.32);
      const mw = fbm(vec2(atan2(d.x, d.z.negate()).mul(7), el.mul(9)).add(3.3)).mul(exp(bd.mul(bd).mul(-26))).mul(smoothstep(0.05, 0.3, el));
      col.addAssign(vec3(0.42, 0.44, 0.46).mul(mw).mul(U.star).mul(0.3).mul(dens.oneMinus()));
      col.assign(mix(col, U.fog, U.mist.mul(exp(max(el, 0).mul(-14))).mul(0.75)));
      return col;
    })();
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(500, 40, 20), mat);
    mesh.frustumCulled = false; mesh.renderOrder = -10;
    mesh.onBeforeRender = (r, s, cam) => { mesh.position.copy(cam.position); mesh.updateMatrixWorld(); };
    return mesh;
  }

  /* ---------- far shore: land in layers that fade into the haze ---------- */
  const hazeCol = () => mix(U.fog, U.hor, 0.4);
  function landMat(base, haze, opts = {}) {
    const m = new THREE.MeshBasicNodeMaterial(); m.fog = false;
    m.colorNode = Fn(() => {
      const y = positionWorld.y, x = positionWorld.x;
      const col = vec3(base()).toVar();
      if (opts.forest) col.assign(mix(col, U.tree.mul(1.2), smoothstep(0.42, 0.68, fbm(vec2(x.mul(0.05), y.mul(0.22)))).mul(opts.forest)));
      if (opts.ridgeLight) col.addAssign(U.glow.mul(smoothstep(opts.ridgeLight[0], opts.ridgeLight[1], y)).mul(0.12).mul(U.light).mul(U.night.oneMinus()));
      const hz = clamp(float(haze).add(smoothstep(opts.low ?? 2.5, -0.2, y).mul(opts.lowHaze ?? 0.4)).add(U.mist.mul(0.35)), 0, 1);
      return mix(col, hazeCol(), hz);
    })();
    return m;
  }
  /* A band of separate tree crowns (round broadleaf, a few pointed conifers, birches with pale trunks),
     in one mesh. aLoc is the position inside each crown (-1..1), aTone = (tone, kind). */
  function treeBand({ z, x0, x1, gap, hMin, hMax, base, seed, birch = 0.12, conifer = 0.14, lobed = true }) {
    const r = seeded(seed), P = [], L = [], T = [], I = [];
    const n = Math.ceil((x1 - x0) / 0.6);
    for (let i = 0; i <= n; i++) { const x = lerp(x0, x1, i / n); P.push(x, base(x), z, x, -0.6, z); L.push(0, 0.1, 0, -1); T.push(0.5, 0, 0.5, 0); }
    for (let i = 0; i < n; i++) { const a = i * 2; I.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    let v = (n + 1) * 2;
    const vert = (x, y, zz, lx, ly, tone, kind) => { P.push(x, y, zz, ); L.push(lx, ly); T.push(tone, kind); return v++; };
    const fan = (cx, cy, rx, ry, zz, tone, kind, segs) => {
      const c = vert(cx, cy, zz, 0, 0, tone, kind), first = v;
      for (let k = 0; k < segs; k++) {
        const a = (k + r() * 0.4) / segs * Math.PI * 2, j = 0.78 + r() * 0.36;
        vert(cx + Math.cos(a) * rx * j, cy + Math.sin(a) * ry * j, zz, Math.cos(a) * j, Math.sin(a) * j, tone, kind);
      }
      for (let k = 0; k < segs; k++) I.push(c, first + k, first + (k + 1) % segs);
    };
    for (let x = x0; x < x1; x += gap * (0.55 + r() * 0.9)) {
      const b = base(x), grove = 0.78 + 0.44 * (0.5 + 0.5 * Math.sin(x * 0.09 + seed) * Math.sin(x * 0.031 + 1.7));
      const h = b + (lerp(hMin, hMax, Math.pow(r(), 0.9)) - b) * grove;
      const zz = z - 0.06 - r() * 2.2, tone = r(), k = r();
      if (k < birch) {                                    // birch: pale trunk, light airy crown
        const top = b + (h - b) * 1.1 + 0.2, tw = 0.04 + r() * 0.03, tb = b - 0.2;
        const a = vert(x - tw, tb, zz, -1, -1, tone, 2), bb = vert(x + tw, tb, zz, 1, -1, tone, 2);
        const c = vert(x + tw * 0.6, top * 0.86, zz, 1, 1, tone, 2), d = vert(x - tw * 0.6, top * 0.86, zz, -1, 1, tone, 2);
        I.push(a, bb, c, a, c, d);
        const ry = (top - b) * 0.36 + 0.1;                                // slender weeping crown over the upper trunk
        fan(x + (r() - 0.5) * 0.12, top - ry, ry * (0.32 + r() * 0.14), ry, zz - 0.03, tone, 3, 8);
      } else if (k < birch + conifer) {                   // conifer: stacked tiers
        const H = (h - b) * 1.15 + 0.3, wdt = H * (0.17 + r() * 0.06);
        for (let t = 0; t < 3; t++) {
          const yt = b + H * (1 - t * 0.27), yb = b + H * (0.42 - t * 0.21), ww = wdt * (0.55 + t * 0.32);
          const a = vert(x, yt, zz, 0, 1, tone, 1), l = vert(x - ww, yb, zz, -1, -0.6, tone, 1), rr = vert(x + ww, yb, zz, 1, -0.6, tone, 1);
          I.push(a, l, rr);
        }
      } else {                                            // broadleaf: a main crown with two or three smaller lobes, so the canopy reads as foliage, not domes
        const ry = (h - b) * 0.5 + 0.25, rx = ry * (0.95 + r() * 0.5);
        fan(x, h - ry * 1.05, rx, ry * 0.95, zz, tone, 0, lobed ? 11 : 9);
        const lobes = lobed ? 2 + Math.floor(r() * 2) : 0;
        for (let q = 0; q < lobes; q++) {
          const s = 0.38 + r() * 0.3, ang = 0.35 + r() * 2.45;
          fan(x + Math.cos(ang) * rx * 0.62, h - ry * 1.05 + Math.sin(ang) * ry * 0.6, rx * s, ry * s * (0.8 + r() * 0.3), zz - 0.03 - q * 0.03, tone, 0, 8);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('aLoc', new THREE.Float32BufferAttribute(L, 2));
    g.setAttribute('aTone', new THREE.Float32BufferAttribute(T, 2));
    g.setIndex(I);
    return g;
  }
  function treeMat(haze) {
    const m = new THREE.MeshBasicNodeMaterial(); m.fog = false;
    m.colorNode = Fn(() => {
      const loc = attribute('aLoc', 'vec2'), tt = attribute('aTone', 'vec2');
      const tone = tt.x, kind = tt.y;
      const isCon = step(0.5, kind).mul(step(kind, 1.5)), isTrunk = step(1.5, kind).mul(step(kind, 2.5)), isBirch = step(2.5, kind);
      const base = U.tree.mul(tone.mul(0.2).add(0.9)).toVar();
      base.assign(mix(base, base.mul(0.78), isCon));
      base.assign(mix(base, mix(U.tree, U.meadow, 0.3).mul(tone.mul(0.15).add(0.95)), isBirch));
      const bark = mix(U.fog, vec3(0.93, 0.89, 0.8), 0.6).mul(U.light.mul(U.light).mul(0.9).add(0.05));
      base.assign(mix(base, mix(base, bark, 0.45), isTrunk));
      const leafy = vnoise(positionWorld.xy.mul(vec2(2.6, 3.4))).mul(0.6).add(vnoise(positionWorld.xy.mul(7)).mul(0.4));
      const col = base.mul(mix(float(0.84), float(1.06), loc.y.mul(0.5).add(0.5))).mul(mix(float(1), leafy.mul(0.34).add(0.83), isTrunk.oneMinus())).toVar();
      // back light: a warm rim on the edge of each crown that faces the sun
      const r = length(loc).add(0.0001);
      const sx = clamp(U.sunDir.x.mul(2.5), -1, 1);
      const rimDir = normalize(vec2(sx, U.sunDir.y.mul(2).add(0.7)));
      const rim = smoothstep(0.6, 1.0, r).mul(max(dot(loc.div(r), rimDir), 0)).mul(isTrunk.oneMinus());
      col.addAssign(U.glow.mul(rim).mul(0.2).mul(U.sunVis).mul(U.light).mul(U.night.oneMinus()));
      const y = positionWorld.y;
      const hz = clamp(float(haze).add(smoothstep(1.2, -0.4, y).mul(0.22)).add(U.mist.mul(0.3)), 0, 1);
      return mix(col, hazeCol(), hz);
    })();
    return m;
  }

  /* ---------- build: sky, far shore, water, shore, reeds, living things ---------- */
  function build() {
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xC99A7A, 10, 130);                         // for the plain materials (lanterns, bird); the node materials do their own haze
    ({ env, U, sample } = makeEnv(STOPS));
    S.env = env; S.scene = scene;
    scene.add(lakeSky());

    // far range, hills, two tree lines, meadow strip
    const farFn = (x) => 11 + 5.5 * Math.sin(x * 0.017 + 0.6) + 3.2 * Math.sin(x * 0.043 + 2.0) + 1.4 * Math.abs(Math.sin(x * 0.11 + 0.3)) + 0.5 * Math.sin(x * 0.29);
    const hillFn = (x) => 4.6 + 2.6 * Math.sin(x * 0.029 + 1.0) + 1.3 * Math.sin(x * 0.071 + 2.3) + 0.5 * Math.sin(x * 0.19 + 0.4) + 0.18 * Math.sin(x * 0.53 + 1.2);
    E.ridge(scene, farFn, -200, -420, 420, 420, landMat(() => mix(U.far, U.hor, 0.25), 0.45, { low: 9, lowHaze: 0.35, ridgeLight: [8, 18] }));
    E.ridge(scene, hillFn, -112, -260, 260, 520, landMat(() => U.hill, 0.12, { forest: 0.55, low: 4, lowHaze: 0.45 }));
    const farBand = new THREE.Mesh(treeBand({ z: -80, x0: -110, x1: 110, gap: 1.0, hMin: 1.6, hMax: 3.0, base: (x) => 0.9 + 0.3 * Math.sin(x * 0.07), seed: 3, birch: 0.05, conifer: 0.2, lobed: false }), treeMat(0.36));
    const nearBand = new THREE.Mesh(treeBand({ z: -56, x0: -84, x1: 84, gap: 0.62, hMin: 1.5, hMax: 3.3, base: (x) => 0.75 + 0.18 * Math.sin(x * 0.21 + 0.5) - 0.3 * (1 - smooth(3, 12, Math.abs(x - 8))), seed: 7, birch: 0.16, conifer: 0.12 }), treeMat(0.0));
    scene.add(farBand, nearBand);
    { const side = E.ridge(scene, (x) => 1.0 + 0.25 * Math.sin(x * 0.09), -57.5, -170, 170, 200, treeMat(0.05)), nv = side.geometry.attributes.position.count;   // low filler behind the crowns, out to wide screens
      side.geometry.setAttribute('aLoc', new THREE.Float32BufferAttribute(new Float32Array(nv * 2), 2));
      side.geometry.setAttribute('aTone', new THREE.Float32BufferAttribute(new Float32Array(nv * 2).map((v, i) => i % 2 ? 0 : 0.5), 2)); }
    const meadowMat = landMat(() => U.meadow.mul(vnoise(positionWorld.xz.mul(vec2(0.4, 2))).mul(0.25).add(0.85)), 0.05, { low: 0.3, lowHaze: 0.1 });
    const meadow = new THREE.Mesh(new THREE.PlaneGeometry(340, 4), meadowMat);
    meadow.rotation.x = -Math.PI / 2; meadow.position.set(0, 0.02, -54); scene.add(meadow);

    /* water: TSL reflector, slow wind texture with cat's-paw patches, touch rings */
    rippleArr = uniformArray(ripples, 'vec4');
    ringU = uniform(0.3);
    const waveH = Fn(([p, lod]) => {
      const t = uTime;
      const h = vnoise(vec2(p.x.mul(0.32), p.y.mul(1.05)).add(vec2(t.mul(0.035), t.mul(0.06)))).mul(0.5).toVar();
      h.addAssign(vnoise(vec2(p.x.mul(0.85), p.y.mul(2.5)).sub(vec2(t.mul(0.05), t.mul(0.085)))).mul(0.25));
      h.addAssign(vnoise(vec2(p.x.mul(2.1), p.y.mul(5.8)).add(vec2(t.mul(0.09), t.mul(-0.05)))).mul(0.12).mul(lod));
      h.addAssign(vnoise(vec2(p.x.mul(5.3), p.y.mul(12.5)).add(vec2(t.mul(-0.12), t.mul(0.1)))).mul(0.045).mul(lod));
      return h.mul(0.085);
    }).setLayout({ name: 'lakeWaveH', type: 'float', inputs: [{ name: 'p', type: 'vec2' }, { name: 'lod', type: 'float' }] });
    const surf = Fn(() => {
      const p = positionWorld.xz;
      const lod = clamp(length(positionWorld.sub(cameraPosition)).div(45).oneMinus(), 0, 1);
      const e = 0.025, h0 = waveH(p, lod);
      // breeze patches: some stretches of water are ruffled, others lie glassy
      const wind = smoothstep(0.38, 0.72, vnoise(p.mul(vec2(0.05, 0.16)).add(vec2(uTime.mul(0.011), uTime.mul(0.006)))).mul(0.65).add(vnoise(p.mul(vec2(0.13, 0.4)).sub(uTime.mul(0.01))).mul(0.35)));
      const amp = mix(float(0.45), float(1.55), wind);
      const gx = waveH(p.add(vec2(e, 0)), lod).sub(h0).div(e).mul(amp);
      const gz = waveH(p.add(vec2(0, e)), lod).sub(h0).div(e).mul(amp);
      const rg = vec2(0).toVar(), line = float(0).toVar();
      Loop(MAX_RIPPLES, ({ i }) => {
        const r = rippleArr.element(i);
        const age = uTime.sub(r.z);
        const alive = step(0, age).mul(step(age, 4.5)).mul(step(0.0001, r.w));
        const dv = p.sub(r.xy);
        const rr = length(dv).add(0.0001);
        const x = rr.sub(age.mul(0.5).add(0.1));
        const fade = clamp(age.div(4.5).oneMinus(), 0, 1);
        const en = exp(x.mul(x).div(-0.05)).mul(fade.mul(fade)).mul(r.w).div(rr.mul(0.6).add(1)).mul(alive);
        rg.addAssign(dv.div(rr).mul(cos(x.mul(14))).mul(en).mul(0.16));
        line.addAssign(en.mul(pow(max(sin(x.mul(14)), 0), 8)));
      });
      return vec3(gx.add(rg.x), gz.add(rg.y), line);
    })();
    const waterN = normalize(vec3(surf.x.negate(), 1, surf.y.negate()));
    const waterDist = length(positionWorld.sub(cameraPosition));
    const reflection = reflector({ resolution: 0.5, bounces: false });
    reflection.target.rotateX(-Math.PI / 2);
    scene.add(reflection.target);
    reflection.uvNode = reflection.uvNode.add(waterN.xz.mul(float(0.55).div(waterDist.add(2)).add(0.004)).mul(0.5));
    const waterMat = new THREE.MeshBasicNodeMaterial(); waterMat.fog = false;
    waterMat.colorNode = Fn(() => {
      const N = waterN, V = normalize(cameraPosition.sub(positionWorld));
      const fres = pow(max(dot(N, V), 0).oneMinus(), 4).mul(0.8).add(0.16);
      const x = positionWorld.x;
      const toEdge = edgeT(x).sub(positionWorld.z);                         // > 0 on the water, 0 at the shoreline
      const shallow = smoothstep(1.1, 0.0, toEdge);
      const body = mix(U.deep, U.land.mul(1.25).add(U.deep.mul(0.25)), shallow.mul(0.6));
      const col = mix(body, reflection.rgb, fres.mul(shallow.mul(0.3).oneMinus())).toVar();
      const Rv = reflect(V.negate(), N);
      // the path of light: a bright core, a softer lobe and slow glints scattered along it
      const glint = smoothstep(0.6, 0.93, vnoise(positionWorld.xz.mul(vec2(6, 21)).add(vec2(uTime.mul(0.13), uTime.mul(-0.09)))));
      const lod = smoothstep(40, 6, waterDist);
      const sp = max(dot(Rv, U.sunDir), 0);
      col.addAssign(U.sun.mul(pow(sp, 700).mul(2.6).add(pow(sp, 70).mul(0.22)).add(pow(sp, 34).mul(glint).mul(lod.mul(0.8).add(0.2)).mul(0.7))).mul(U.sunVis).mul(smoothstep(-0.06, 0.02, U.sunDir.y)));
      const mp = max(dot(Rv, U.moonDir), 0);
      col.addAssign(vec3(0.75, 0.82, 0.82).mul(pow(mp, 600).mul(2.2).add(pow(mp, 60).mul(0.12)).add(pow(mp, 70).mul(glint).mul(0.4))).mul(U.moon).mul(smoothstep(0.05, 0.1, U.moonDir.y)));   // no path while the moon is still behind the hills
      col.addAssign(vec3(0.92, 0.9, 0.82).mul(starField(Rv)).mul(U.star).mul(fres).mul(0.9));   // stars in the water
      col.addAssign(vec3(0.95, 0.9, 0.82).mul(surf.z).mul(ringU));
      // a thin wet line where the water laps the bank, breathing slowly
      const lx = toEdge.sub(0.04).sub(sin(uTime.mul(0.7).add(x.mul(2.1))).mul(0.018));
      col.addAssign(mix(U.hor, U.glow, 0.5).mul(exp(lx.mul(lx).div(-0.0007))).mul(U.light.mul(0.2).add(0.05)));
      col.assign(mix(col, U.fog, smoothstep(14, 70, waterDist).mul(0.2)));
      col.assign(mix(col, U.fog, U.mist.mul(smoothstep(5, 40, waterDist)).mul(0.55)));
      return col;
    })();
    const water = new THREE.Mesh(new THREE.PlaneGeometry(420, 70, 1, 1), waterMat);
    water.rotation.x = -Math.PI / 2; water.position.set(0, 0, -25); scene.add(water);

    /* low mist that lies on the water at dawn */
    const mistMat = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false }); mistMat.fog = false;
    mistMat.colorNode = U.fog.mul(1.05);
    mistMat.opacityNode = Fn(() => {
      const d = length(positionWorld.sub(cameraPosition));
      const n = fbm(positionWorld.xz.mul(vec2(0.05, 0.12)).add(vec2(uTime.mul(0.012), uTime.mul(0.004))));
      return smoothstep(0.35, 0.8, n).mul(U.mist).mul(smoothstep(2, 9, d)).mul(smoothstep(40, 60, d).oneMinus()).mul(0.55);
    })();
    [0.07, 0.2, 0.36].forEach((y, i) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(260, 70), mistMat); m.rotation.x = -Math.PI / 2; m.position.set(i * 9, y, -24); scene.add(m); });

    /* near bank: soil and grass in patches, pebbles and a dark wet band at the water, shade toward the camera */
    const shoreMat = new THREE.MeshBasicNodeMaterial(); shoreMat.fog = false;
    shoreMat.colorNode = Fn(() => {
      const p = positionWorld.xz, edge = attribute('aEdge', 'float');
      const n = fbm(p.mul(vec2(3, 5)));
      const soil = U.land.mul(n.mul(0.5).add(0.75));
      const patch = smoothstep(0.4, 0.62, vnoise(p.mul(vec2(1.6, 2.6))).mul(0.7).add(n.mul(0.3)));
      const c = mix(soil, U.grass.mul(n.mul(0.4).add(0.72)), patch.mul(smoothstep(0.05, 0.5, edge)).mul(0.75)).toVar();
      const peb = smoothstep(0.74, 0.82, vnoise(p.mul(vec2(30, 46))));
      c.assign(mix(c, mix(U.land, U.fog, 0.3).mul(1.35), peb.mul(smoothstep(0.55, 0.06, edge)).mul(0.55)));
      const wet = smoothstep(0, 0.16, edge).oneMinus();
      c.assign(mix(c, U.land.mul(0.5).add(U.hor.mul(0.07).mul(U.light)), wet));
      return c.mul(mix(float(1), float(0.72), smoothstep(5.0, 6.4, positionWorld.z)));
    })();
    S.shore = new THREE.Mesh(new THREE.BufferGeometry(), shoreMat); scene.add(S.shore);

    /* reeds, sedge, grass and a few pale flowers, bent in the vertex stage.
       kind: 0 grass, 1 reed, 2 sedge leaf, 3 flower stem */
    { const r = seeded(11);
      for (let i = 0; i < 96; i++) { const side = i % 2 ? 1 : -1; blades.push({ u: side * (0.62 + Math.pow(r(), 0.9) * 0.7), d: 1.3 + r() * 1.5, off: -0.35 + r() * 0.75, h: 0.4 + Math.pow(r(), 1.2) * 0.62, w: 0.012 + r() * 0.008, ph: r() * 6.28, head: r() > 0.86, reed: true, kind: 1, lean: (r() - 0.5) * 0.08 }); }
      for (let i = 0; i < 80; i++) { const side = i % 2 ? 1 : -1; const lean = (0.12 + r() * 0.22) * (r() < 0.5 ? -1 : 1); blades.push({ u: side * (0.58 + Math.pow(r(), 0.8) * 0.75), d: 1.2 + r() * 1.5, off: -0.25 + r() * 0.55, h: 0.14 + r() * 0.26, w: 0.024 + r() * 0.016, ph: r() * 6.28, head: false, reed: true, kind: 2, lean }); }
      for (let i = 0; i < 1400; i++) blades.push({ u: (r() * 2 - 1) * 1.4, d: 0.9 + r() * 1.5, off: 0.02 + Math.pow(r(), 1.3) * 1.1, h: 0.05 + Math.pow(r(), 1.4) * 0.2, w: 0.006 + r() * 0.005, ph: r() * 6.28, head: false, reed: false, kind: 0, lean: (r() - 0.5) * 0.12 });
      for (let i = 0; i < 46; i++) blades.push({ u: (r() * 2 - 1) * 1.3, d: 0.9 + r() * 1.4, off: 0.08 + Math.pow(r(), 1.2) * 0.8, h: 0.12 + r() * 0.16, w: 0.009 + r() * 0.004, ph: r() * 6.28, head: false, reed: false, kind: 3, lean: (r() - 0.5) * 0.08 });
      for (const b of blades) { b.x = 0; b.z = 0; b.bend = 0; b.vel = 0; b.sway = 0; b.tone = r(); } }
    /* two instanced meshes share one material: reeds and sedge stand in the water and show in the reflection;
       the bank grass is on layer 1, which the reflection camera does not draw (it would be hidden by the bank anyway) */
    const split = blades.findIndex((b) => !b.reed);
    bladeAttr = [[0, split, 5, 0], [split, blades.length, 4, 1]].map(([from, to, seg, layer]) => {
      const g = new THREE.InstancedBufferGeometry(), n = to - from, pos = [], idx = [];
      for (let i = 0; i <= seg; i++) { const t = i / seg; pos.push(-0.5, t, 0, 0.5, t, 0); }
      for (let i = 0; i < seg; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
      const A = { from, to, layer, g,
        base: new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3),
        shape: new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3),
        tone: new THREE.InstancedBufferAttribute(new Float32Array(n * 2), 2),
        bend: new THREE.InstancedBufferAttribute(new Float32Array(n), 1).setUsage(THREE.DynamicDrawUsage) };
      for (let i = from; i < to; i++) { const b = blades[i]; b.A = A; b.k = i - from; A.shape.setXYZ(b.k, b.h, b.w, b.ph); A.tone.setXY(b.k, b.tone, b.kind); }
      g.setAttribute('aBase', A.base); g.setAttribute('aShape', A.shape); g.setAttribute('aBend', A.bend); g.setAttribute('aTone', A.tone);
      g.instanceCount = n;
      return A;
    });
    E.camera.layers.enable(1);
    rimU = uniform(0.1);
    const bladeMat = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide }); bladeMat.fog = false;
    bladeMat.positionNode = Fn(() => {
      const base = attribute('aBase', 'vec3'), shape = attribute('aShape', 'vec3'), bend = attribute('aBend', 'float');
      const t = positionGeometry.y, b = bend.mul(t).mul(t);
      const flower = step(2.5, attribute('aTone', 'vec2').y);
      const wid = t.mul(mix(float(0.8), float(0.55), flower)).oneMinus();     // seed grass tapers less, to a soft pale head
      return base.add(vec3(positionGeometry.x.mul(shape.y).mul(wid).add(b), t.mul(shape.x).mul(abs(bend).mul(0.12).oneMinus()), b.mul(0.25)));
    })();
    bladeMat.colorNode = Fn(() => {
      const t = positionGeometry.y, tt = attribute('aTone', 'vec2'), tone = tt.x, kind = tt.y;
      const isReed = step(0.5, kind).mul(step(kind, 1.5)), isSedge = step(1.5, kind).mul(step(kind, 2.5)), isFlower = step(2.5, kind);
      const mid = U.grass.mul(tone.mul(0.5).add(0.7)).toVar();
      mid.assign(mix(mid, mix(U.grass, U.land, 0.45).mul(tone.mul(0.3).add(0.85)), isReed));
      mid.assign(mix(mid, mix(U.grass, U.leaf, 0.5).mul(tone.mul(0.25).add(0.8)), isSedge));
      const tip = mix(mid, U.meadow.mul(0.95), isSedge.oneMinus().mul(0.45));
      const col = mix(U.land.mul(0.32), mid, smoothstep(0.0, 0.4, t)).toVar();     // dark at the root, like a soft contact shadow
      col.assign(mix(col, tip, smoothstep(0.45, 1.0, t)));
      col.addAssign(U.glow.mul(rimU).mul(t.mul(t).mul(t)).mul(isSedge.mul(-0.5).add(1.3)));   // back-lit tips
      const petal = mix(U.meadow, U.hor, 0.35).mul(1.05);
      col.assign(mix(col, petal, isFlower.mul(smoothstep(0.78, 0.96, t)).mul(0.6)));
      return col;
    })();
    for (const A of bladeAttr) { const m = new THREE.Mesh(A.g, bladeMat); m.frustumCulled = false; m.layers.set(A.layer); scene.add(m); }
    const headIdx = blades.map((b, i) => b.head ? i : -1).filter((i) => i >= 0);
    headMat = new THREE.MeshBasicNodeMaterial(); headMat.fog = false;        // cattail heads: velvet brown, a warm rim when the sun is low
    headMat.colorNode = Fn(() => mix(U.land, U.grass, 0.35).mul(1.25).mul(vnoise(positionGeometry.xy.mul(vec2(300, 120))).mul(0.3).add(0.8)).add(U.glow.mul(rimU).mul(smoothstep(0.0, 0.05, positionGeometry.y)).mul(1.2)))();
    headMesh = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.016, 0.085, 3, 7), headMat, headIdx.length);
    headMesh.userData.idx = headIdx; headMesh.frustumCulled = false; scene.add(headMesh);

    /* the post: weathered wood, darker and wet at the water line */
    postMat = new THREE.MeshBasicNodeMaterial(); postMat.fog = false;
    postMat.colorNode = Fn(() => {
      const pg = positionGeometry;
      const grain = vnoise(vec2(atan2(pg.x, pg.z).mul(3), pg.y.mul(7))).mul(0.6).add(vnoise(vec2(atan2(pg.x, pg.z).mul(9), pg.y.mul(30))).mul(0.4));
      const y = positionWorld.y;
      const col = U.land.mul(grain.mul(0.45).add(0.75)).add(U.hor.mul(0.04).mul(U.light)).toVar();
      col.mulAssign(mix(float(0.55), float(1), smoothstep(0.02, 0.14, y)));
      col.addAssign(U.glow.mul(rimU).mul(smoothstep(0.55, 0.74, y)).mul(1.5));
      return col;
    })();
    postMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.038, 1.0, 9), postMat);
    scene.add(postMesh);

    /* lily pads in the shallows and pebbles at the water's edge */
    { const padGeo = new THREE.CircleGeometry(1, 14, 0.3, Math.PI * 2 - 0.55); padGeo.rotateX(-Math.PI / 2);
      const padMat = new THREE.MeshBasicNodeMaterial(); padMat.fog = false;
      padMat.colorNode = Fn(() => {
        const n = vnoise(positionWorld.xz.mul(26));
        return mix(U.leaf, U.grass, n).mul(n.mul(0.3).add(0.7)).add(U.hor.mul(0.1).mul(U.light)).add(U.glow.mul(rimU).mul(0.5));
      })();
      padMesh = new THREE.InstancedMesh(padGeo, padMat, 11); padMesh.frustumCulled = false; scene.add(padMesh);
      const pebGeo = new THREE.IcosahedronGeometry(1, 1);
      const pebMat = new THREE.MeshBasicNodeMaterial(); pebMat.fog = false;
      pebMat.colorNode = Fn(() => {
        const nw = normalWorld;
        const lightK = clamp(nw.y.mul(0.6).add(0.4).add(nw.x.mul(U.sunDir.x).mul(0.4)), 0, 1);
        const base = mix(U.land.mul(1.6), U.fog.mul(0.5), 0.25).mul(vnoise(positionWorld.xz.mul(40)).mul(0.3).add(0.8));
        return base.mul(lightK.mul(0.75).add(0.35)).add(U.glow.mul(rimU).mul(smoothstep(0.5, 1, nw.y)));
      })();
      pebbleMesh = new THREE.InstancedMesh(pebGeo, pebMat, 9); pebbleMesh.frustumCulled = false; scene.add(pebbleMesh); }

    /* a willow leaning in over the top of the frame: hanging strands of narrow leaves, swaying slowly */
    buildWillow();

    /* fireflies, seed fluff, and motes of dust that float in the sunlight */
    fireflies = new Pool(scene, 90, { additive: true, size: 0.07, color: 0xE8D27A, gain: 2.2, step: (p, dt, t) => {
      const f = p.age / p.life, settle = smooth(0.65, 1, f);          // SPEC: each blink rises and fades over at least 0.5 s
      p.x += Math.sin(t * 0.4 + p.ph) * 0.03 * dt; p.z += Math.cos(t * 0.33 + p.ph) * 0.03 * dt;
      p.y = Math.max(0.03, p.y + lerp(p.rise, -0.05, settle) * dt);
      return smooth(0.15, 0.9, 0.5 + 0.5 * Math.sin(t * p.rate + p.ph)) * smooth(0, 0.08, f) * (1 - smooth(0.85, 1, f));
    } });
    fluff = new Pool(scene, 70, { size: 0.028, color: 0xEFE3CF, gain: 0.9, step: (p, dt, t) => {
      const f = p.age / p.life;
      p.y += 0.07 * dt; p.x += (0.06 + Math.sin(t * 0.7 + p.ph) * 0.04) * dt; p.z -= 0.02 * dt;
      return 0.75 * smooth(0, 0.1, f) * (1 - smooth(0.6, 1, f));
    } });
    motes = new Pool(scene, 40, { additive: true, size: 0.012, color: 0xF3DDB8, gain: 1.4, step: (p, dt, t) => {
      const f = p.age / p.life;
      p.x += (0.025 + Math.sin(t * 0.3 + p.ph) * 0.03) * dt; p.y += Math.sin(t * 0.21 + p.ph * 2) * 0.012 * dt; p.z += Math.cos(t * 0.17 + p.ph) * 0.015 * dt;
      return S.moteK * smooth(0, 0.25, f) * (1 - smooth(0.7, 1, f)) * (0.7 + 0.3 * Math.sin(t * 0.9 + p.ph));
    } });

    buildBird();
  }

  /* ---------- willow ---------- */
  const strands = [];
  function buildWillow() {
    const r = seeded(23), leaves = [];
    for (let i = 0; i < 34; i++) {
      const st = { u: -1.16 + Math.pow(r(), 1.15) * 0.92, d: 3.0 + r() * 1.4, len: 0.3 + r() * 0.7, ph: r() * 6.28, curve: (r() - 0.35) * 0.25, ax: 0, ay: 0, az: 0 };
      st.len *= lerp(1, 0.35, (st.u + 1.16) / 0.92);                     // strands shorten toward the open sky
      strands.push(st);
      const n = Math.round(18 + st.len * 40);
      for (let k = 0; k < n; k++) {
        const s = k / n;
        leaves.push({ st: i, s, size: (0.075 + r() * 0.04) * (1 - s * 0.35), ph: st.ph + r() * 0.6, ang: (r() - 0.5) * 0.7, tone: r(), jx: (r() - 0.5) * 0.06 });
      }
      for (let k = 0; k < 14; k++) leaves.push({ st: i, s: -0.04 - r() * 0.12, size: 0.08 + r() * 0.04, ph: st.ph, ang: (r() - 0.5) * 2.6, tone: r() * 0.6, jx: (r() - 0.5) * 0.26 });   // the leafy canopy edge the strands hang from
    }
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0.32, -0.38, 0, 0, -1, 0, -0.32, -0.38, 0], 3)); g.setIndex([0, 3, 1, 1, 3, 2]);
    const A = { anchor: new THREE.InstancedBufferAttribute(new Float32Array(leaves.length * 3), 3), leaf: new THREE.InstancedBufferAttribute(new Float32Array(leaves.length * 4), 4), tone: new THREE.InstancedBufferAttribute(new Float32Array(leaves.length), 1) };
    leaves.forEach((l, i) => { A.leaf.setXYZW(i, l.s, l.size, l.ph, l.ang); A.tone.setX(i, l.tone); });
    g.setAttribute('aAnchor', A.anchor); g.setAttribute('aLeaf', A.leaf); g.setAttribute('aWTone', A.tone);
    g.instanceCount = leaves.length;
    const m = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide }); m.fog = false;
    m.positionNode = Fn(() => {
      const an = attribute('aAnchor', 'vec3'), lf = attribute('aLeaf', 'vec4');
      const s = lf.x, L = an.y;                                          // aAnchor.y is already the leaf's own height on its strand
      const sw = sin(uTime.mul(0.42).add(lf.z)).mul(0.05).add(sin(uTime.mul(1.05).add(lf.z.mul(2.3))).mul(0.012)).mul(s.mul(s).add(0.04));
      const a = lf.w.add(sin(uTime.mul(0.8).add(lf.z.mul(3))).mul(0.12));
      const gx = positionGeometry.x.mul(lf.y).mul(0.6), gy = positionGeometry.y.mul(lf.y);
      const c = cos(a), sn = sin(a);
      return vec3(an.x.add(sw).add(gx.mul(c).sub(gy.mul(sn))), L.add(gx.mul(sn)).add(gy.mul(c)), an.z.add(sw.mul(0.3)));
    })();
    m.colorNode = Fn(() => {
      const tone = attribute('aWTone', 'float');
      const col = U.leaf.mul(tone.mul(0.55).add(0.62)).toVar();
      col.addAssign(U.glow.mul(tone.mul(0.5).add(0.5)).mul(0.32).mul(U.sunVis).mul(U.light).mul(U.night.oneMinus()));   // light through the leaves
      return col;
    })();
    willow = new THREE.Mesh(g, m); willow.frustumCulled = false; willow.layers.set(1); willow.userData = { leaves, A }; scene.add(willow);
  }
  function layoutWillow() {
    const { leaves, A } = willow.userData;
    const tanV = VW / ASPECT, top = Math.atan(tanV) + S.camera.pitch + 2.5 * DEG;
    for (const st of strands) { st.ax = st.u * VW * st.d; st.az = 6 - st.d; st.ay = 0.55 + st.d * Math.tan(top); st.L = st.len * st.d * tanV * 0.62; }
    leaves.forEach((l, i) => {
      const st = strands[l.st];
      // y slot = the leaf's height (anchor minus its distance down the strand); x = anchor plus jitter
      A.anchor.setXYZ(i, st.ax + l.jx + st.curve * Math.max(l.s, 0) * l.s * st.L, st.ay - l.s * st.L, st.az);
      A.leaf.setX(i, l.s);
    });
    A.anchor.needsUpdate = true; A.leaf.needsUpdate = true;
  }

  /* ---------- shore and reeds layout (depends on the view width) ---------- */
  function buildShore() {
    const n = 220, pos = [], edge = [], idx = [];
    for (let i = 0; i <= n; i++) { const x = lerp(-14, 14, i / n), ez = edgeZ(x); pos.push(x, 0.006, ez, x, 0.006, ez + 0.5, x, 0.006, 10); edge.push(0, 0.5, 6); }
    for (let i = 0; i < n; i++) { const a = i * 3, b = a + 3; idx.push(a, a + 1, b, a + 1, b + 1, b, a + 1, a + 2, b + 1, a + 2, b + 2, b + 1); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aEdge', new THREE.Float32BufferAttribute(edge, 1)); g.setIndex(idx);
    S.shore.geometry.dispose(); S.shore.geometry = g;
  }
  function layoutBlades() {
    blades.forEach((b) => { b.x = b.u * VW * b.d; b.z = Math.min(edgeZ(b.x) + b.off, 5.5); b.A.base.setXYZ(b.k, b.x, b.reed && b.off < 0 ? -0.02 : 0.004, b.z); });
    for (const A of bladeAttr) A.base.needsUpdate = true;
  }
  function layoutShoreThings() {
    const r = seeded(31);
    for (let i = 0; i < padMesh.count; i++) {
      const left = i < 7, u = left ? -0.62 + r() * 0.3 : 0.42 + r() * 0.22, back = (left ? 0.3 + r() * 1.0 : 0.6 + r() * 0.9) * lerp(1, 1.6, 1 - smooth(0.6, 1.3, ASPECT));
      let x = u * VW * 3, z = edgeZ(x) - back; x = u * VW * (6 - z); z = edgeZ(x) - back;
      const s = (0.035 + r() * 0.045) * lerp(1, 0.75, 1 - smooth(0.6, 1.3, ASPECT));
      tmpE.set(0, r() * 6.28, 0); tmpQ.setFromEuler(tmpE); tmpS.set(s, 1, s * (0.9 + r() * 0.2));
      tmpM.compose(tmpV.set(x, 0.004, z), tmpQ, tmpS); padMesh.setMatrixAt(i, tmpM);
    }
    padMesh.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < pebbleMesh.count; i++) {
      const u = (i % 2 ? 1 : -1) * (0.15 + r() * 0.8), x = u * VW * 1.9, z = edgeZ(x) + 0.02 + r() * 0.3, s = 0.035 + r() * 0.05;
      tmpE.set(r() * 0.4, r() * 6.28, r() * 0.4); tmpQ.setFromEuler(tmpE); tmpS.set(s, s * (0.45 + r() * 0.2), s * (0.8 + r() * 0.3));
      tmpM.compose(tmpV.set(x, tmpS.y * 0.25, z), tmpQ, tmpS); pebbleMesh.setMatrixAt(i, tmpM);
    }
    tmpS.set(1, 1, 1);
    pebbleMesh.instanceMatrix.needsUpdate = true;
  }
  const bladeTip = (b, out) => { const bend = b.bend + b.sway + b.lean; return out.set(b.x + bend, b.h * (1 - 0.12 * Math.abs(bend)), b.z + bend * 0.25); };
  function pushBlades(x0, y0, x1, y1) {
    const dx = x1 - x0, dy = y1 - y0, len2 = dx * dx + dy * dy; if (len2 < 4) return null;
    const R = Math.max(36, innerWidth * 0.035);
    let hits = 0; const at = new THREE.Vector3();
    blades.forEach((b) => {
      tmpV.set(b.x, b.h * 0.55, b.z);
      const s = toScreen(tmpV); if (!s.front) return;
      const t = clamp1(((s.x - x0) * dx + (s.y - y0) * dy) / len2, 0, 1);
      const dist = Math.hypot(x0 + dx * t - s.x, y0 + dy * t - s.y);
      if (dist < R) {
        const k = (1 - dist / R) * clamp1(dx / 60, -1.2, 1.2) * (b.reed ? 1 : 1.6);
        b.vel += k * 1.5; hits++; at.add(tmpV);
        if (b.head && Math.abs(k) > 0.2 && Math.random() < 0.3) { bladeTip(b, tmpV); fluff.add({ x: tmpV.x, y: tmpV.y, z: tmpV.z, life: rand(6, 9), ph: rand(0, 6) }); }
      }
    });
    return hits ? { hits, at: at.multiplyScalar(1 / hits) } : null;
  }
  function updateBlades(dt, t) {
    const sdt = Math.min(dt, 1 / 30);
    for (let i = 0; i < blades.length; i++) {
      const b = blades[i];
      b.vel += (-6.5 * b.bend - 3.2 * b.vel) * sdt; b.bend = clamp1(b.bend + b.vel * sdt, -0.45, 0.45);   // SPEC: spring-back over about 2 s
      b.sway = (Math.sin(t * 0.55 + b.ph) * 0.022 + Math.sin(t * 1.25 + b.ph * 2) * 0.007) * b.h;
      b.A.bend.array[b.k] = b.bend + b.sway + b.lean;
    }
    for (const A of bladeAttr) A.bend.needsUpdate = true;
    const idx = headMesh.userData.idx;
    for (let k = 0; k < idx.length; k++) {
      const b = blades[idx[k]]; bladeTip(b, tmpV);
      tmpE.set(0, 0, -(b.bend + b.sway + b.lean) * 1.6); tmpQ.setFromEuler(tmpE);
      tmpM.compose(tmpV.setY(tmpV.y - 0.025), tmpQ, tmpS); headMesh.setMatrixAt(k, tmpM);
    }
    headMesh.instanceMatrix.needsUpdate = true;
  }
  /* dust motes drift in the low sun over the near water */
  function updateMotes(dt, t) {
    S.moteK = env.sunVis * env.light * (1 - env.night) * (1 - env.mist * 0.6);
    if (S.moteK > 0.25 && t > moteNext) {
      const z = rand(2.2, 4.6), d = 6 - z;
      motes.add({ x: rand(-0.9, 0.9) * VW * d, y: rand(0.12, 0.9), z, life: rand(9, 15), ph: rand(0, 6), s: rand(0.7, 1.4) });
      moteNext = t + rand(0.35, 0.8);
    }
    motes.update(dt, t);
  }


  /* ---------- paper lanterns. SPEC: hold 1.5 s on the shore; drift about 2 minutes; at most 7 ---------- */
  const lanternBodyGeo = new THREE.CylinderGeometry(0.04, 0.05, 0.07, 10);
  const lanternBaseGeo = new THREE.BoxGeometry(0.14, 0.012, 0.14);
  function spawnLantern(x, z) {
    if (lanterns.filter((l) => !l.leaving).length >= 7) { const o = lanterns.find((l) => !l.leaving); if (o) { o.leaving = true; o.fadeStart = E.clock; o.fadeDur = 5; } }
    const g = new THREE.Group();
    const body = new THREE.Mesh(lanternBodyGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(0xF0C97A).multiplyScalar(1.6), transparent: true })); body.position.y = 0.045;
    const base = new THREE.Mesh(lanternBaseGeo, new THREE.MeshBasicMaterial({ color: 0x3B2A20, transparent: true })); base.position.y = 0.006;
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: 0xF0C97A, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.position.y = 0.05; glow.scale.setScalar(0.55);
    g.add(base, body, glow); g.position.set(x, 0, z); g.rotation.y = rand(0, 6); scene.add(g);
    const L = { g, body, base, glow, born: E.clock, ph: rand(0, 6), drift: rand(-0.06, 0.1), leaving: false, fadeStart: 0, fadeDur: 10 };
    lanterns.push(L); return L;
  }
  function updateLanterns(dt, t) {
    for (let i = lanterns.length - 1; i >= 0; i--) {
      const L = lanterns[i], age = t - L.born, unfold = easeOut(clamp1(age / 2.5, 0, 1));
      L.body.scale.set(1, Math.max(0.02, unfold), 1);
      L.g.position.z -= 0.4 * smooth(1.5, 6, age) * dt;
      L.g.position.x += (L.drift + Math.sin(t * 0.07 + L.ph) * 0.05) * dt;
      L.g.position.y = Math.sin(t * 0.9 + L.ph) * 0.006; L.g.rotation.y += 0.04 * dt;
      if (!L.leaving && L.g.position.z < -40) { L.leaving = true; L.fadeStart = t; L.fadeDur = 12; }
      let a = unfold; if (L.leaving) a *= 1 - clamp1((t - L.fadeStart) / L.fadeDur, 0, 1);
      const flick = 0.88 + 0.12 * Math.sin(t * 1.3 + L.ph) * Math.sin(t * 0.7 + L.ph * 2);
      L.glow.material.opacity = a * flick * lerp(0.55, 1, 1 - env.light * 0.6);
      L.body.material.opacity = a; L.base.material.opacity = a;
      if (L.leaving && t - L.fadeStart > L.fadeDur) { scene.remove(L.g); L.body.material.dispose(); L.base.material.dispose(); L.glow.material.dispose(); lanterns.splice(i, 1); }
    }
  }

  /* ---------- stones. SPEC: 3 to 5 skips, each shorter, a ring at each touch, a low note on the last ---------- */
  const stoneGeo = new THREE.SphereGeometry(1, 10, 8), stoneMat = new THREE.MeshBasicMaterial({ color: 0x2A2420 });
  function skipStone(start, dir, power) {
    const n = Math.round(clamp1(3 + power * 2, 3, 5)), pts = [start.clone()];
    let len = 1.2 + power * 1.6, p = new THREE.Vector3(start.x, 0, start.z - 0.15);
    for (let i = 0; i < n; i++) { p = p.clone().addScaledVector(dir, len); pts.push(p); len *= 0.66; }
    const m = new THREE.Mesh(stoneGeo, stoneMat); m.scale.set(0.028, 0.012, 0.024); scene.add(m);
    stones.push({ m, pts, i: 0, t0: E.clock, n });
    focusOn(pts[Math.min(2, n)], 3);
  }
  function updateStones() {
    for (let s = stones.length - 1; s >= 0; s--) {
      const St = stones[s], a = St.pts[St.i], b = St.pts[St.i + 1];
      if (!b) { scene.remove(St.m); stones.splice(s, 1); continue; }
      const len = a.distanceTo(b), f = clamp1((E.clock - St.t0) / (0.22 + len * 0.12), 0, 1);
      St.m.position.lerpVectors(a, b, f); St.m.position.y = Math.max(a.y * (1 - f), 0) + Math.sin(f * Math.PI) * len * 0.09;
      St.m.rotation.y += 0.4;
      if (f >= 1) {
        St.i++; St.t0 = E.clock;
        const last = St.i === St.n;
        ripple(b.x, b.z, last ? 0.9 : 0.6);
        sound.play('ripple', b, last ? 0.5 : 0.8);
        if (last) { sound.low(b, 0.8); setTimeout(() => sound.play('ripple', b, 0.7), 60); }
        haptic(8);
        if (last) { scene.remove(St.m); stones.splice(s, 1); }
      }
    }
  }

  /* ---------- kingfisher. SPEC: arrives after 90 s of stillness; a touch near it makes it dive ---------- */
  const K = { state: 'away', t0: 0, from: new THREE.Vector3(), to: new THREE.Vector3(), c1: new THREE.Vector3(), c2: new THREE.Vector3(), dur: 1 };
  function buildBird() {
    bird = new THREE.Group();
    const teal = new THREE.MeshBasicMaterial({ color: 0x4F8C90 }), tealD = new THREE.MeshBasicMaterial({ color: 0x3E6E72 });
    const rust = new THREE.MeshBasicMaterial({ color: 0xC9804F }), dark = new THREE.MeshBasicMaterial({ color: 0x1A1410 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), teal); body.scale.set(0.06, 0.035, 0.034);
    const belly = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), rust); belly.scale.set(0.045, 0.026, 0.03); belly.position.set(-0.01, -0.012, 0);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.028, 12, 10), teal); head.position.set(-0.05, 0.025, 0);
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), rust); cheek.position.set(-0.058, 0.018, 0.02);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.06, 6), dark); beak.rotation.z = Math.PI / 2; beak.position.set(-0.105, 0.022, 0);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.006, 0.02), tealD); tail.position.set(0.075, -0.012, 0); tail.rotation.z = 0.35;
    const wingGeo = new THREE.BoxGeometry(0.06, 0.004, 0.07); wingGeo.translate(0, 0, 0.035);
    const wl = new THREE.Mesh(wingGeo, tealD); wl.position.set(0, 0.012, 0.01);
    const wr = new THREE.Mesh(wingGeo, tealD); wr.position.set(0, 0.012, -0.01); wr.rotation.y = Math.PI;
    bird.add(body, belly, head, cheek, beak, tail, wl, wr);
    bird.userData = { wl, wr, mats: [teal, tealD, rust], base: [new THREE.Color(0x4F8C90), new THREE.Color(0x3E6E72), new THREE.Color(0xC9804F)] };
    bird.scale.setScalar(1.25); bird.visible = false; scene.add(bird);
  }
  const perch = () => new THREE.Vector3(POST.x, POST.top + 0.045, POST.z);
  function bez(a, b, c, d, t, out) {
    const u = 1 - t, A = u * u * u, B = 3 * u * u * t, C = 3 * u * t * t, D = t * t * t;
    return out.set(A * a.x + B * b.x + C * c.x + D * d.x, A * a.y + B * b.y + C * c.y + D * d.y, A * a.z + B * b.z + C * c.z + D * d.z);
  }
  function kFly(state, from, c1, c2, to, dur) { K.state = state; K.t0 = E.clock; K.from.copy(from); K.c1.copy(c1); K.c2.copy(c2); K.to.copy(to); K.dur = dur; }
  function kingfisherArrive() {
    const p = perch(); bird.visible = true;
    kFly('arriving', new THREE.Vector3(p.x - 7, 1.7, p.z - 3), new THREE.Vector3(p.x - 3.5, 1.1, p.z + 0.6), new THREE.Vector3(p.x - 0.6, p.y + 0.35, p.z), p, 5.5);
    sound.play('call', p);
  }
  function kingfisherDive() {
    const p = perch(), w = new THREE.Vector3(p.x - 0.75, -0.05, p.z - 0.9);
    kFly('diving', p, new THREE.Vector3(p.x - 0.1, p.y + 0.12, p.z), new THREE.Vector3(w.x + 0.12, 0.25, w.z), w, 0.95);
    sound.play('call', p); focusOn(p, 2.5);
  }
  function updateKingfisher(dt, t) {
    const ud = bird.userData;
    ud.mats.forEach((m, i) => m.color.copy(ud.base[i]).multiplyScalar(lerp(0.1, 1, smooth(0.15, 0.8, env.light))));   // the bird darkens with the light like everything else
    if (K.state === 'away' || K.state === 'under') return;
    if (K.state === 'perched') {
      bird.position.copy(perch()); bird.position.y += Math.sin(t * 0.6) * 0.002;
      bird.rotation.z = Math.sin(t * 0.35) * 0.04; bird.scale.x = Math.abs(bird.scale.x);
      ud.wl.rotation.x = 0; ud.wr.rotation.x = 0; return;
    }
    const f = clamp1((t - K.t0) / K.dur, 0, 1), e = K.state === 'diving' ? f * f : easeIO(f), px = bird.position.x;
    bez(K.from, K.c1, K.c2, K.to, e, bird.position);
    const vx = bird.position.x - px;
    if (Math.abs(vx) > 1e-5) bird.scale.x = Math.abs(bird.scale.x) * (vx > 0 ? -1 : 1);
    const flap = K.state === 'diving' ? 0.15 : Math.sin(t * 52) * 0.9;
    ud.wl.rotation.x = flap; ud.wr.rotation.x = -flap;
    bird.visible = bird.position.y > -0.01;
    if (f >= 1) {
      if (K.state === 'diving') {
        ripple(K.to.x, K.to.z, 1.1); sound.play('splash', K.to, 0.6); haptic(10);
        const p = perch(), w = K.to.clone(); w.y = -0.05; K.state = 'under';
        setTimeout(() => { if (K.state === 'under') kFly('returning', w, new THREE.Vector3(w.x - 0.4, 0.5, w.z + 0.2), new THREE.Vector3(p.x - 0.5, p.y + 0.3, p.z), p, 1.8); }, 350);
      } else K.state = 'perched';
    }
  }

  let fishNext = 0, lapNext = 0;

  /* ---------- gallery window art: 300 x 200, slow CSS motion ---------- */
  const windowArt = () => `<svg viewBox="0 0 300 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs>
      <linearGradient id="lk-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4A3528"/><stop offset=".6" stop-color="#B9805F"/><stop offset="1" stop-color="#EBC9A0"/></linearGradient>
      <linearGradient id="lk-water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#A57A5F"/><stop offset=".35" stop-color="#5E7F80"/><stop offset="1" stop-color="#191512"/></linearGradient>
      <linearGradient id="lk-path" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F3DDB8" stop-opacity=".85"/><stop offset="1" stop-color="#D9A383" stop-opacity="0"/></linearGradient>
      <radialGradient id="lk-glow"><stop offset="0" stop-color="#F6E6C6" stop-opacity=".9"/><stop offset="1" stop-color="#D9A383" stop-opacity="0"/></radialGradient>
      <radialGradient id="lk-lg"><stop offset="0" stop-color="#F0C97A" stop-opacity=".8"/><stop offset="1" stop-color="#C9A35B" stop-opacity="0"/></radialGradient>
    </defs>
    <style>
      .lk-sh { animation: lk-sh 5s ease-in-out infinite alternate; }
      .lk-sh:nth-child(2n) { animation-duration: 7s; animation-delay: -2s; }
      .lk-sh:nth-child(3n) { animation-duration: 6s; animation-delay: -4s; }
      @keyframes lk-sh { from { opacity: .15; } to { opacity: .8; } }
      .lk-ring { transform-origin: 110px 160px; animation: lk-ring 6s ease-out infinite; }
      @keyframes lk-ring { from { transform: scale(.1); opacity: .7; } to { transform: scale(1); opacity: 0; } }
      .lk-lan { animation: lk-lan 30s linear infinite alternate; }
      @keyframes lk-lan { from { transform: translate(0, 0); } to { transform: translate(18px, -14px); } }
      .lk-reed { transform-origin: bottom; transform-box: fill-box; animation: lk-reed 6s ease-in-out infinite alternate; }
      @keyframes lk-reed { from { transform: rotate(-2deg); } to { transform: rotate(2.5deg); } }
      .lk-wil { transform-origin: top; transform-box: fill-box; animation: lk-wil 8s ease-in-out infinite alternate; }
      .lk-wil:nth-child(2n) { animation-duration: 10s; animation-delay: -3s; }
      @keyframes lk-wil { from { transform: rotate(-1.6deg); } to { transform: rotate(1.8deg); } }
      .lk-cl { animation: lk-cl 60s ease-in-out infinite alternate; }
      @keyframes lk-cl { from { transform: translateX(0); } to { transform: translateX(-16px); } }
      @media (prefers-reduced-motion: reduce) { .lk-sh, .lk-ring, .lk-lan, .lk-reed, .lk-wil, .lk-cl { animation: none; } }
    </style>
    <rect width="300" height="116" fill="url(#lk-sky)"/>
    <circle cx="200" cy="106" r="58" fill="url(#lk-glow)"/>
    <g class="lk-cl" fill="#D9A383"><ellipse cx="70" cy="62" rx="62" ry="5" opacity=".45"/><ellipse cx="120" cy="74" rx="80" ry="4" opacity=".35"/><ellipse cx="250" cy="52" rx="56" ry="6" opacity=".3"/><ellipse cx="236" cy="84" rx="44" ry="3" fill="#EBC9A0" opacity=".5"/></g>
    <circle cx="200" cy="106" r="11" fill="#F6E8CC"/>
    <path d="M0 102 C30 94 60 90 96 96 S170 88 210 95 S270 90 300 96 L300 116 L0 116Z" fill="#B88D73" opacity=".55"/>
    <path d="M0 108 C40 98 90 101 128 106 S220 96 300 104 L300 116 L0 116Z" fill="#8A6450" opacity=".75"/>
    <path d="M0 116 L0 106 Q0.9 99.3 4.4 99.3 Q7.9 99.3 8.7 102.0 Q9.8 98.3 14.1 98.3 Q18.3 98.3 19.4 101.7 Q19.9 98.5 22.0 98.5 Q24.0 98.5 24.6 101.6 Q25.5 95.7 29.0 95.7 Q32.6 95.7 33.5 103.7 Q34.2 98.9 37.4 98.9 Q40.5 98.9 41.3 102.6 Q42.1 100.1 45.5 100.1 Q48.9 100.1 49.7 103.5 Q50.4 94.2 53.1 94.2 Q55.7 94.2 56.4 102.1 Q57.0 94.9 59.4 94.9 Q61.8 94.9 62.4 103.7 Q63.2 99.4 66.7 99.4 Q70.2 99.4 71.1 104.0 Q72.1 99.1 76.2 99.1 Q80.3 99.1 81.3 103.5 Q82.4 96.0 86.7 96.0 Q91.1 96.0 92.2 103.3 Q93.3 98.8 97.6 98.8 Q101.9 98.8 102.9 102.3 Q103.6 98.4 106.1 98.4 Q108.6 98.4 109.2 102.3 Q110.3 98.2 114.6 98.2 Q118.9 98.2 120.0 103.3 Q120.7 100.3 123.6 100.3 Q126.4 100.3 127.1 103.6 Q127.7 99.2 129.8 99.2 Q132.0 99.2 132.5 102.5 Q133.0 96.7 135.0 96.7 Q137.1 96.7 137.6 103.2 Q138.2 95.5 141.0 95.5 Q143.7 95.5 144.4 102.8 Q145.1 97.2 147.9 97.2 Q150.6 97.2 151.3 102.2 Q151.8 93.8 154.0 93.8 Q156.1 93.8 156.7 103.9 Q157.6 94.6 161.4 94.6 Q165.2 94.6 166.2 104.0 Q167.1 97.8 171.0 97.8 Q174.9 97.8 175.9 102.6 Q176.4 100.1 178.4 100.1 Q180.4 100.1 180.9 103.5 Q182.0 99.4 186.3 99.4 Q190.6 99.4 191.7 102.1 Q192.7 96.3 197.0 96.3 Q201.2 96.3 202.2 103.1 Q203.0 99.3 205.8 99.3 Q208.7 99.3 209.4 102.1 Q209.9 99.3 212.2 99.3 Q214.5 99.3 215.0 102.0 Q216.0 101.5 220.1 101.5 Q224.2 101.5 225.2 101.6 Q225.7 99.4 227.9 99.4 Q230.2 99.4 230.7 102.5 Q231.8 99.0 236.0 99.0 Q240.2 99.0 241.2 101.7 Q242.1 98.6 245.4 98.6 Q248.7 98.6 249.5 103.2 Q250.1 99.7 252.5 99.7 Q255.0 99.7 255.6 103.6 Q256.5 93.7 260.1 93.7 Q263.8 93.7 264.7 103.6 Q265.2 93.7 267.3 93.7 Q269.5 93.7 270.0 102.7 Q270.7 98.6 273.7 98.6 Q276.7 98.6 277.4 102.5 Q278.4 97.5 282.4 97.5 Q286.4 97.5 287.4 102.9 Q287.9 95.4 290.1 95.4 Q292.2 95.4 292.7 103.9 Q293.5 96.4 296.7 96.4 Q299.9 96.4 300.7 103.7 L300 116Z" fill="#3B2A20"/>
    <rect y="115" width="300" height="85" fill="url(#lk-water)"/>
    <path d="M194 116 L206 116 L246 200 L156 200Z" fill="url(#lk-path)" opacity=".55"/>
    <g stroke="#F6E6C6" stroke-width="1" stroke-linecap="round">
      <line class="lk-sh" x1="188" y1="122" x2="212" y2="122"/><line class="lk-sh" x1="180" y1="131" x2="206" y2="131"/>
      <line class="lk-sh" x1="196" y1="140" x2="226" y2="140"/><line class="lk-sh" x1="176" y1="152" x2="204" y2="152"/>
      <line class="lk-sh" x1="200" y1="165" x2="236" y2="165"/><line class="lk-sh" x1="170" y1="180" x2="200" y2="180"/>
      <line class="lk-sh" x1="210" y1="190" x2="244" y2="190"/>
    </g>
    <ellipse class="lk-ring" cx="110" cy="160" rx="40" ry="8" fill="none" stroke="#EFE3CF" stroke-width=".8"/>
    <g class="lk-lan"><circle cx="150" cy="148" r="13" fill="url(#lk-lg)"/><rect x="147.5" y="144" width="5" height="5" rx="1" fill="#F0C97A"/></g>
    <rect x="232" y="146" width="3" height="54" fill="#1A1410"/>
    <g fill="none" stroke="#140F0C" stroke-width="1.6" stroke-linecap="round">
      <path class="lk-reed" d="M14 200 Q16 170 12 138"/><path class="lk-reed" d="M24 200 Q22 176 28 150"/><path class="lk-reed" d="M34 200 Q38 180 34 160"/>
      <path class="lk-reed" d="M272 200 Q270 170 276 140"/><path class="lk-reed" d="M284 200 Q288 176 282 152"/><path class="lk-reed" d="M262 200 Q260 184 266 166"/>
    </g>
    <g fill="#4A3424"><ellipse cx="12" cy="136" rx="2" ry="6"/><ellipse cx="276" cy="138" rx="2" ry="6"/><ellipse cx="28" cy="149" rx="1.8" ry="5"/></g>
    <g fill="#4E3E28" opacity=".9"><g class="lk-wil"><ellipse cx="44.0" cy="1.0" rx="0.9" ry="2.4" transform="rotate(18 44.0 1.0)"/><ellipse cx="43.9" cy="4.2" rx="0.9" ry="2.4" transform="rotate(0 43.9 4.2)"/><ellipse cx="44.3" cy="7.4" rx="0.9" ry="2.4" transform="rotate(-21 44.3 7.4)"/><ellipse cx="44.3" cy="10.6" rx="0.9" ry="2.4" transform="rotate(6 44.3 10.6)"/><ellipse cx="43.3" cy="13.8" rx="0.9" ry="2.4" transform="rotate(-6 43.3 13.8)"/><ellipse cx="45.4" cy="17.0" rx="0.9" ry="2.4" transform="rotate(-2 45.4 17.0)"/></g><g class="lk-wil"><ellipse cx="68.9" cy="1.0" rx="0.9" ry="2.4" transform="rotate(-19 68.9 1.0)"/><ellipse cx="69.0" cy="4.2" rx="0.9" ry="2.4" transform="rotate(21 69.0 4.2)"/><ellipse cx="69.4" cy="7.4" rx="0.9" ry="2.4" transform="rotate(14 69.4 7.4)"/></g><g class="lk-wil"><ellipse cx="36.4" cy="1.0" rx="0.9" ry="2.4" transform="rotate(-10 36.4 1.0)"/><ellipse cx="36.5" cy="4.2" rx="0.9" ry="2.4" transform="rotate(11 36.5 4.2)"/><ellipse cx="36.5" cy="7.4" rx="0.9" ry="2.4" transform="rotate(-21 36.5 7.4)"/><ellipse cx="36.4" cy="10.6" rx="0.9" ry="2.4" transform="rotate(-15 36.4 10.6)"/><ellipse cx="36.4" cy="13.8" rx="0.9" ry="2.4" transform="rotate(15 36.4 13.8)"/><ellipse cx="36.2" cy="17.0" rx="0.9" ry="2.4" transform="rotate(19 36.2 17.0)"/><ellipse cx="37.8" cy="20.2" rx="0.9" ry="2.4" transform="rotate(-22 37.8 20.2)"/><ellipse cx="36.6" cy="23.4" rx="0.9" ry="2.4" transform="rotate(-0 36.6 23.4)"/><ellipse cx="35.1" cy="26.6" rx="0.9" ry="2.4" transform="rotate(-4 35.1 26.6)"/></g><g class="lk-wil"><ellipse cx="86.1" cy="1.0" rx="0.9" ry="2.4" transform="rotate(-19 86.1 1.0)"/><ellipse cx="86.3" cy="4.2" rx="0.9" ry="2.4" transform="rotate(20 86.3 4.2)"/></g><g class="lk-wil"><ellipse cx="19.3" cy="1.0" rx="0.9" ry="2.4" transform="rotate(2 19.3 1.0)"/><ellipse cx="19.2" cy="4.2" rx="0.9" ry="2.4" transform="rotate(-21 19.2 4.2)"/><ellipse cx="19.5" cy="7.4" rx="0.9" ry="2.4" transform="rotate(21 19.5 7.4)"/><ellipse cx="19.5" cy="10.6" rx="0.9" ry="2.4" transform="rotate(-5 19.5 10.6)"/></g><g class="lk-wil"><ellipse cx="60.7" cy="1.0" rx="0.9" ry="2.4" transform="rotate(-16 60.7 1.0)"/><ellipse cx="60.8" cy="4.2" rx="0.9" ry="2.4" transform="rotate(23 60.8 4.2)"/><ellipse cx="60.2" cy="7.4" rx="0.9" ry="2.4" transform="rotate(3 60.2 7.4)"/></g><g class="lk-wil"><ellipse cx="57.6" cy="1.0" rx="0.9" ry="2.4" transform="rotate(25 57.6 1.0)"/><ellipse cx="57.8" cy="4.2" rx="0.9" ry="2.4" transform="rotate(-19 57.8 4.2)"/><ellipse cx="58.1" cy="7.4" rx="0.9" ry="2.4" transform="rotate(23 58.1 7.4)"/><ellipse cx="57.3" cy="10.6" rx="0.9" ry="2.4" transform="rotate(6 57.3 10.6)"/></g><g class="lk-wil"><ellipse cx="4.1" cy="1.0" rx="0.9" ry="2.4" transform="rotate(5 4.1 1.0)"/><ellipse cx="4.1" cy="4.2" rx="0.9" ry="2.4" transform="rotate(-21 4.1 4.2)"/><ellipse cx="4.1" cy="7.4" rx="0.9" ry="2.4" transform="rotate(18 4.1 7.4)"/><ellipse cx="4.3" cy="10.6" rx="0.9" ry="2.4" transform="rotate(-2 4.3 10.6)"/><ellipse cx="4.2" cy="13.8" rx="0.9" ry="2.4" transform="rotate(24 4.2 13.8)"/><ellipse cx="4.6" cy="17.0" rx="0.9" ry="2.4" transform="rotate(-24 4.6 17.0)"/><ellipse cx="5.4" cy="20.2" rx="0.9" ry="2.4" transform="rotate(-9 5.4 20.2)"/><ellipse cx="4.5" cy="23.4" rx="0.9" ry="2.4" transform="rotate(-14 4.5 23.4)"/></g><g class="lk-wil"><ellipse cx="42.2" cy="1.0" rx="0.9" ry="2.4" transform="rotate(6 42.2 1.0)"/><ellipse cx="42.1" cy="4.2" rx="0.9" ry="2.4" transform="rotate(14 42.1 4.2)"/><ellipse cx="42.0" cy="7.4" rx="0.9" ry="2.4" transform="rotate(14 42.0 7.4)"/><ellipse cx="42.9" cy="10.6" rx="0.9" ry="2.4" transform="rotate(-0 42.9 10.6)"/><ellipse cx="43.2" cy="13.8" rx="0.9" ry="2.4" transform="rotate(-13 43.2 13.8)"/><ellipse cx="43.8" cy="17.0" rx="0.9" ry="2.4" transform="rotate(-4 43.8 17.0)"/></g></g>
  </svg>`;

  const S = E.defineScene({
    id: 'lake', title: 'resting waters', defaultHour: 0.58,
    describe: (h) => 'resting waters, a lake at ' + hourName(h),
    hourName,
    key: { scale: ['D', 'E', 'F#', 'A', 'B'], octave: 4,                    // SPEC: D major pentatonic
      day: [['D3', 'A3', 'E4'], ['A2', 'E3', 'B3'], ['D3', 'F#3', 'B3'], ['E3', 'A3', 'D4']],
      night: [['B2', 'F#3', 'D4'], ['E3', 'B3', 'D4'], ['B2', 'E3', 'A3']] },
    camera: { x: 0, y: 0.55, z: 6, pitch: -1.2 * DEG },
    focusFar: 38, focusMid: 12,
    moteK: 0,
    windowArt,
    build,
    applyHour(h) {
      sample(h);
      ringU.value = lerp(0.12, 0.34, env.light);
      scene.fog.color.copy(env.fog);
      rimU.value = 0.1 * env.sunVis * (1 - env.night);
      motes.tint.value.copy(env.sun).multiplyScalar(1.3);
    },
    resize(vw, aspect) {
      VW = vw; ASPECT = aspect; uVW.value = vw;
      const port = 1 - smooth(0.6, 1.3, aspect);                           // 1 on a phone held upright
      EDGE0 = 4.1 + 1.0 * port; uEdge0.value = EDGE0;                     // phones in portrait: more water in the frame
      S.camera.pitch = lerp(-1.2, -7, port) * DEG;                         // and the view tips down a little, so the lake fills the tall frame
      for (const s of STOPS) { s.sunAz = lerp(0.24, 0.16, port); s.moonAz = lerp(0.12, 0.08, port); }
      buildShore(); layoutBlades(); layoutShoreThings(); layoutWillow();
      POST.x = clamp1(0.42 * VW * (6 - POST.z), 0.7, 1.8);
      postMesh.position.set(POST.x, POST.top - 0.5, POST.z);
    },
    enter() { fishNext = E.clock + rand(40, 80); },
    update(dt, t, info) {
      E.CAM.pitch = S.camera.pitch;
      if (info.active) {
        if (K.state === 'away' && info.still > 90 && !info.resting) kingfisherArrive();   // SPEC: stay still for 90 s
        if (t > fishNext && !info.resting) {                                               // SPEC: a fish rises every few minutes
          const fp = new THREE.Vector3(rand(-5, 6), 0, rand(-22, -3)); ripple(fp.x, fp.z, 0.7);
          sound.play('ripple', fp, 0.6);
          fishNext = t + rand(120, 300);
        }
      }
      if (t > lapNext && S.laps) { S.laps.forEach((l) => l.gain.gain.rampTo(rand(0.3, 1.8) * (l.isLoop ? 0.32 : 0.05), rand(1.2, 2.8)));
        if (S.nightBed && S.nightBed.isLoop) { const n = 0.0001 + 0.38 * env.night; if (Math.abs(n - S.nightLvl) > 0.01) { S.nightBed.gain.gain.rampTo(n, 3); S.nightLvl = n; } } lapNext = t + rand(1.5, 4); }
      updateBlades(dt, t); updateStones(); updateLanterns(dt, t);
      fireflies.update(dt, t); fluff.update(dt, t); updateMotes(dt, t);
      updateKingfisher(dt, t);
    },
    skyBody() {
      if (env.sunVis > 0.3 && env.sunEl > -1.5) return env.sunDir;
      if (env.moon > 0.3) return env.moonDir;
      return null;
    },
    focusNear() { return [new THREE.Vector3(POST.x, POST.top, POST.z), new THREE.Vector3(0, 0.1, 3.8)]; },
    pointerDown(p) {
      const { x, y } = p;
      if (K.state === 'perched' && nearScreen(bird.position, x, y, Math.max(60, innerWidth * 0.05))) { kingfisherDive(); return { type: 'none' }; }
      const hit = hitWater(x, y);
      if (hit && !hit.shore) {                                              // SPEC: tap the water: a ring and a soft note
        ripple(hit.x, hit.z, 1);
        sound.play('ripple', hit, 0.9);
        sound.note(hit, Math.round(clamp1(x / innerWidth, 0, 1) * 9), 0.7);
        haptic(10); focusOn(hit, 2.5);
        return { type: 'water' };
      }
      if (hit && hit.shore) { E.holdCue.at(x, y); return { type: 'shore', x0: x, y0: y, t0: E.clock, path: 0, hit, fired: false }; }
      return { type: 'empty' };
    },
    pointerMove(g, p, prev) {
      const pushed = pushBlades(prev.x, prev.y, p.x, p.y);
      if (pushed && (!g.lastRustle || E.clock - g.lastRustle > 0.18)) {
        g.lastRustle = E.clock; sound.play('rustle', pushed.at, clamp1(pushed.hits / 12, 0.3, 1));
        if (pushed.hits > 3) focusOn(pushed.at, 2.5);
      }
      if (g.type === 'shore') { g.path += Math.hypot(p.x - prev.x, p.y - prev.y); if (g.path > 16) E.holdCue.hide(); }
      if (env.night > 0.15 || E.hour > 0.64) {                              // SPEC: fireflies at dusk or night when dragging through the grass
        const h = hitWater(p.x, p.y);
        if (h && h.shore && Math.random() < 0.55) fireflies.add({ x: h.x + rand(-0.08, 0.08), y: 0.05, z: h.z + rand(-0.05, 0.05), life: rand(9, 14), rise: rand(0.06, 0.13), rate: rand(1.2, 2.2), ph: rand(0, 6) });
      }
    },
    pointerUp(g, p) {
      E.holdCue.hide();
      if (g.type !== 'shore' || g.fired) return;
      const dt = E.clock - g.t0, dx = p.x - g.x0, dy = p.y - g.y0;
      if (dt < 0.7 && dy < -30 && Math.hypot(dx, dy) > 45) {               // SPEC: a quick flick from the shore across the water
        const ang = clamp1(Math.atan2(dx, -dy), -0.7, 0.7);
        const speed = Math.hypot(dx, dy) / Math.max(dt, 0.05) / innerHeight;
        const dir = new THREE.Vector3(Math.sin(ang - E.look.yaw), 0, -Math.cos(ang)).normalize();
        skipStone(new THREE.Vector3(g.hit.x, 0.14, edgeZ(g.hit.x) + 0.05), dir, clamp1((speed - 0.6) / 2.5, 0, 1));
      }
    },
    tick(g) {
      if (g.type !== 'shore' || g.fired) return;
      const held = E.clock - g.t0;
      if (g.path < 16 && held > 0.25) E.holdCue.show(clamp1((held - 0.25) / 1.25, 0, 1));
      if (g.path < 16 && held >= 1.5) {                                     // SPEC: hold on the shore for 1.5 s
        g.fired = true; E.holdCue.hide();
        const L = spawnLantern(g.hit.x, edgeZ(g.hit.x) - 0.28);
        sound.play('paper', L.g.position, 0.9, { dur: 0.7 }); sound.swell(['A3', 'D4']);
        haptic(15); focusOn(L.g.position, 2.5);
      }
    },
    bed() {                                                                 // recorded lake air and shore lapping (stand-in noise until the files load)
      sound.loop('lake-air', { gain: 0.7, fallback: { type: 'pink', filter: 'lowpass', freq: 480, Q: 0.2, gain: 0.16, lfo: { freq: 0.035, min: 300, max: 720 } } });
      S.laps = [[-2.6, 0, 3.6], [2.6, 0, 3.6]].map((p) =>
        sound.loop('lake-lap', { gain: 0.3, pos: new THREE.Vector3(...p), fallback: { type: 'brown', filter: 'bandpass', freq: rand(330, 450), Q: 0.8, gain: 0.05, pos: new THREE.Vector3(...p) } }));
      S.nightBed = sound.loop('lake-night', { gain: 0.0001, freq: 6000, fallback: { type: 'pink', freq: 400, gain: 0.0001 } });
      S.nightLvl = -1;
    },
    detail() {                                                              // SPEC: one near detail every 8 to 40 s, at a random place
      const r = Math.random(), side = Math.random() < 0.5 ? -1 : 1;
      if (r < 0.45) sound.play('ripple', new THREE.Vector3(rand(-6, 6), 0, rand(-14, 1)), 0.7);
      else if (r < 0.75) sound.play('rustle', new THREE.Vector3(side * rand(1.2, 3), 0.5, rand(3.3, 4.4)), 0.5);
      else sound.play('ripple', new THREE.Vector3(side * rand(1, 3), 0.1, rand(3.4, 4.2)), 0.5);
    },
    // test hooks
    debug: { kingfisher: () => kingfisherArrive(), spawnLantern: (x, z) => spawnLantern(x, z), ripple, lanterns, get fireflies() { return fireflies; }, get motes() { return motes; }, env: () => env, parts: () => ({ headMesh, headMat, willow, padMesh, pebbleMesh, postMesh }) }
  });
}

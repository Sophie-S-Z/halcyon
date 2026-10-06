/* =====================================================================
   Scene: remembering rain. Rain on a meadow edge, seen from 20 cm above the wet ground.
   Uses only E (the engine) and calls E.defineScene(), like the lake.
   ===================================================================== */
{
  const { THREE, TSL, DEG, clamp1, lerp, smooth, easeIO, easeOut, rand, seeded, makeEnv, makeSky, ridge, GLOW, Pool, sound, haptic, toScreen, nearScreen, focusOn, uTime, hash12, vnoise, fbm } = E;
  const { Fn, Loop, uniform, uniformArray, attribute, float, vec2, vec3, positionWorld, positionGeometry, cameraPosition, normalWorld, uv,
    mix, smoothstep, pow, exp, max, min, clamp, step, sin, cos, abs, length, normalize, dot, reflect, cross, fract, floor, atan2, sqrt, select } = TSL;

  /* ---------- hours. Colours from the rain study (Rain.dc.html): moss #6E7448, straw #A39A5C ---------- */
  const STOPS = [
    { t: 0.00, top: '#596059', hor: '#9A9282', glow: '#C9A88A', sun: '#E9D9BE', cloudCol: '#6E6E66', fog: '#848072', sunEl: -2, moonEl: -20, star: 0, cloud: 1, mist: .9, sunVis: .14,
      moss: '#4E5438', straw: '#7C7650', lo: '#1E2018', earth: '#28241C', tree: '#545A50', hill: '#6E7068', rainCol: '#D2CCBC', beadCol: '#D9D2C0', rainA: .28, streak: 1, bead: .15, win: .12, light: .52, haze: .8 },
    { t: 0.22, top: '#9A9884', hor: '#C6C0A3', glow: '#E6D8B4', sun: '#F3E6CC', cloudCol: '#B2AC93', fog: '#B4AE93', sunEl: 14, moonEl: -20, star: 0, cloud: 1, mist: .75, sunVis: .26,
      moss: '#6E7448', straw: '#A39A5C', lo: '#2E3220', earth: '#3B3424', tree: '#888A72', hill: '#A3A08A', rainCol: '#F2EAD6', beadCol: '#F6EEDC', rainA: .34, streak: 1, bead: 0, win: 0, light: .9, haze: .82 },
    { t: 0.45, top: '#A2A494', hor: '#CFCBB4', glow: '#E8DEC4', sun: '#F6ECD6', cloudCol: '#BCB9A6', fog: '#BDB9A5', sunEl: 38, moonEl: -20, star: 0, cloud: 1, mist: .6, sunVis: .16,
      moss: '#727B4B', straw: '#A9A163', lo: '#2F3521', earth: '#3D3626', tree: '#8E907C', hill: '#A9A994', rainCol: '#F4EDDC', beadCol: '#F8F0E0', rainA: .32, streak: 1, bead: 0, win: 0, light: 1, haze: .82 },
    { t: 0.72, top: '#6A5244', hor: '#C48E68', glow: '#DDA47E', sun: '#F2CDA2', cloudCol: '#9A6E58', fog: '#A87A5E', sunEl: 3, moonEl: -20, star: 0, cloud: 1, mist: .55, sunVis: .55,
      moss: '#5C5836', straw: '#A47F50', lo: '#262418', earth: '#2E2418', tree: '#6A4E40', hill: '#8A6452', rainCol: '#F4CC9C', beadCol: '#F6D6AA', rainA: .5, streak: 1, bead: .35, win: .25, light: .66, haze: .8 },
    { t: 0.84, top: '#262C2E', hor: '#544C44', glow: '#7E5C4C', sun: '#8A6A58', cloudCol: '#2E3232', fog: '#3C3B36', sunEl: -6, moonEl: -20, star: 0, cloud: 1, mist: .55, sunVis: .08,
      moss: '#343A26', straw: '#504A32', lo: '#121410', earth: '#171611', tree: '#1C201E', hill: '#2A2D2A', rainCol: '#B0AAA0', beadCol: '#E3C08A', rainA: .34, streak: .85, bead: .45, win: .8, light: .32, haze: .8 },
    { t: 0.95, top: '#101718', hor: '#25302E', glow: '#2E2C26', sun: '#222222', cloudCol: '#1A2223', fog: '#1E2725', sunEl: -20, moonEl: -20, star: 0, cloud: 1, mist: .5, sunVis: 0,
      moss: '#29342A', straw: '#3A3C2A', lo: '#0B0E0A', earth: '#121512', tree: '#0D1312', hill: '#17201E', rainCol: '#9AA8A4', beadCol: '#E6BE7E', rainA: .3, streak: .75, bead: .6, win: 1, light: .21, haze: .8 },
    { t: 1.00, top: '#0B1011', hor: '#1C2524', glow: '#24231E', sun: '#1A1A1A', cloudCol: '#141B1C', fog: '#171F1E', sunEl: -24, moonEl: -20, star: 0, cloud: 1, mist: .45, sunVis: 0,
      moss: '#20291F', straw: '#2C3022', lo: '#080A07', earth: '#0E100D', tree: '#090E0D', hill: '#121918', rainCol: '#86928E', beadCol: '#E3B878', rainA: .26, streak: .75, bead: .6, win: 1, light: .17, haze: .8 }
  ];
  const hourName = (h) => h < 0.1 ? 'first light' : h < 0.4 ? 'soft morning' : h < 0.6 ? 'afternoon' : h < 0.8 ? 'dusk' : 'night';

  // module state, filled by build()
  let scene, env, U, sample, VW = 0.73, ASPECT = 1.6;
  let bladeGeo, bladeMat, bladeAttr, beadMesh, cloverMesh, ground, puddle, stone, leafPivot, leafMesh, beetle, snail, web, webMat, beam, house, houseWin, houseGlow;
  let houseMat;
  let fall, splash, spray, steam, bokeh, fAttr;
  const U2 = {};                                    // scene uniforms beyond the hour stops
  const C = (hex) => { const c = new THREE.Color(hex); return vec3(c.r, c.g, c.b); };   // an sRGB hex colour as a (linear) shader constant
  const WIND = 1;
  const camY = 0.2;

  /* layout in "u" (fraction of the half view width at that depth) and depth, so phones keep the same framing */
  const L = {
    puddle: { u: 0.1, d: 0.95, rx: 0.3, rz: 0.15, x: 0, z: 0 },
    leaf: { u: -0.5, d: 0.72, x: 0, z: 0, yaw: -0.35 },
    stone: { u: 0.52, d: 0.64, x: 0, z: 0 },
    clover: { u: -0.06, d: 0.52, x: 0, z: 0 },
    web: { u: -0.6, d: 1.32, y: 0.15, x: 0, z: 0 },
    house: { u: 0.36, z: -120, x: 0, y: 0 }
  };
  const placeX = (u, d) => u * VW * d;

  /* ---------- grass: one instanced mesh, bent in the vertex stage ---------- */
  const B = { n: 0, x: null, y: null, z: null, h: null, w: null, yaw: null, lean: null, ph: null, tint: null, u: null, d: null, kind: null, bend: null, vel: null };
  const near = [], push = [], tips = [], flowers = [], flowerType = [];   // indices: near blades, blades a drag can move, blades with a bead, stalks with a flower head
  let webStalks = [0, 0];
  function makeBlades() {
    const r = seeded(31), list = [];
    // near clumps, large and sharp, at both sides of the frame
    for (let i = 0; i < 230; i++) {
      const side = i % 2 ? 1 : -1, d = 0.3 + Math.pow(r(), 0.8) * 0.75;
      const u = side * (0.7 + Math.pow(r(), 0.7) * 0.75);
      list.push({ kind: 0, u, d, h: (0.16 + Math.pow(r(), 0.9) * 0.3) * (0.75 + 0.35 * smooth(0.7, 1.3, Math.abs(u))), w: 0.007 + r() * 0.006, yaw: r() * 6.28, lean: (r() - 0.5) * 0.7 - side * 0.12, tint: 0.3 + r() * 0.7 });
    }
    // a few short blades in the near ground, between the clover and the stone
    for (let i = 0; i < 110; i++) {
      const d = 0.22 + Math.pow(r(), 0.8) * 0.62, u = (r() * 2 - 1) * 0.8;
      list.push({ kind: 0, u, d, h: 0.035 + r() * 0.07, w: 0.004 + r() * 0.003, yaw: r() * 6.28, lean: (r() - 0.5) * 0.9, tint: 0.2 + r() * 0.6 });
    }
    // low tufts scattered over the near ground, so the foreground is never bare (tall phones see a lot of it)
    for (let i = 0; i < 40; i++) {
      const d0 = 0.24 + r() * 0.55, u0 = (r() * 2 - 1) * 1.25, n = 3 + Math.floor(r() * 3), fan = r() * 6.28;
      for (let j = 0; j < n; j++) list.push({ kind: 0, u: u0 + (r() - 0.5) * 0.03 / d0, d: d0 + (r() - 0.5) * 0.03, h: 0.03 + r() * 0.07, w: 0.004 + r() * 0.003, yaw: fan + j / n * 6.28, lean: 0.2 + r() * 0.5, tint: 0.2 + r() * 0.7 });
    }
    // the edge of the clearing on both sides
    for (let i = 0; i < 220; i++) {
      const side = i % 2 ? 1 : -1, d = 0.9 + r() * 0.7, u = side * (0.8 + r() * 0.65);
      list.push({ kind: 1, u, d, h: 0.1 + r() * 0.22, w: 0.006 + r() * 0.004, yaw: r() * 6.28, lean: (r() - 0.5) * 0.6, tint: 0.3 + r() * 0.7 });
    }
    // the meadow: tufts of three to six blades that fan out; they thin out and soften with distance
    for (let m = 0; m < 4400;) {
      const d0 = 1.5 + Math.pow(r(), 1.35) * 9.5, u0 = (r() * 2 - 1) * 1.45, n = 3 + Math.floor(r() * 4), hk = 0.7 + r() * 0.65, tk = r(), fan = r() * 6.28;
      for (let j = 0; j < n; j++, m++) {
        const d = d0 + (r() - 0.5) * 0.06, u = u0 + (r() - 0.5) * 0.05 / (0.73 * d0), a = fan + j / n * 6.28;
        list.push({ kind: 2, u, d, h: (0.07 + r() * 0.15 + 0.012 * d) * hk, w: 0.005 + 0.0016 * d + r() * 0.003, yaw: a, lean: 0.12 + r() * 0.4, tint: clamp1(tk + (r() - 0.5) * 0.35, 0, 1) });
      }
    }
    // tall stalks above the grass: seed heads, sorrel and a few wildflowers (flowers are drawn at their tips)
    for (let i = 0; i < 280; i++) {
      const near = i < 26, d = near ? 0.75 + r() * 0.9 : 1.7 + Math.pow(r(), 1.5) * 8, side = r() < 0.5 ? -1 : 1;
      const u = near ? side * (0.6 + r() * 0.75) : (r() * 2 - 1) * 1.45;
      list.push({ kind: 2, u, d, h: (near ? 0.11 + r() * 0.12 : 0.14 + r() * 0.15) + 0.008 * d, w: 0.0036 + 0.0008 * d, yaw: r() * 6.28, lean: (r() - 0.5) * 0.5, tint: 0.9, flower: 1 });
    }
    // white and red clover heads standing a little above the clover leaves
    for (let i = 0; i < 7; i++) list.push({ kind: 2, u: L.clover.u + (r() - 0.5) * 0.2, d: L.clover.d + (r() - 0.5) * 0.07, h: 0.035 + r() * 0.03, w: 0.0022, yaw: r() * 6.28, lean: (r() - 0.5) * 0.4, tint: 0.2, flower: 1, ftype: i < 5 ? 1 : 2 });
    // two dry stalks that hold the spider web
    webStalks = [list.length, list.length + 1];
    for (const s of [-1, 1]) list.push({ kind: 3, u: 0, d: L.web.d, h: 0.31, w: 0.0035, yaw: 0.3, lean: s * 0.05, tint: 1, stalk: s });
    B.n = list.length;
    for (const k of ['x', 'y', 'z', 'h', 'w', 'yaw', 'lean', 'ph', 'tint', 'u', 'd', 'bend', 'vel', 'fill']) B[k] = new Float32Array(B.n);
    B.kind = new Uint8Array(B.n); B.stalk = new Int8Array(B.n);
    list.forEach((b, i) => {
      B.u[i] = b.u; B.d[i] = b.d; B.h[i] = b.h; B.w[i] = b.w; B.yaw[i] = b.yaw; B.lean[i] = b.lean; B.ph[i] = r() * 6.28; B.tint[i] = b.tint; B.kind[i] = b.kind; B.stalk[i] = b.stalk || 0;
      if (b.kind === 0 && b.h > 0.12) near.push(i);
      if (b.d < 3.2) push.push(i);
      if (b.kind === 0 && b.h > 0.15 && r() > 0.45) { tips.push(i); B.fill[i] = 0.6 + r() * 0.4; }
      if (b.flower) { flowers.push(i); flowerType.push(b.ftype ?? -1); }
    });
  }
  const swayOf = (i, t) => (Math.sin(t * 0.6 + B.ph[i]) * 0.04 + Math.sin(t * 1.37 + B.ph[i] * 2.3) * 0.015) * WIND;
  function tipOf(i, tt, out) {                       // the same bend as the vertex shader, on the CPU
    const h = B.h[i], lean = B.lean[i], bx = B.bend[i] + swayOf(i, E.clock), t2 = tt * tt;
    const up = tt * h * (1 - 0.18 * (lean * lean + bx * bx));
    return out.set(B.x[i] + Math.sin(B.yaw[i]) * lean * t2 * h + bx * t2 * h, B.y[i] + up, B.z[i] + Math.cos(B.yaw[i]) * lean * t2 * h + bx * t2 * h * 0.2);
  }

  /* ---------- ripples on the puddle from touches and drops (rain rings are drawn procedurally) ---------- */
  const MAX_RIPPLES = 8;
  const ripples = Array.from({ length: MAX_RIPPLES }, () => new THREE.Vector4(0, 0, -99, 0));
  let rippleIdx = 0, rippleArr;
  const ripple = (x, z, amp = 1) => { ripples[rippleIdx].set(x, z, E.clock, amp); rippleIdx = (rippleIdx + 1) % MAX_RIPPLES; };
  const inPuddle = (x, z, k = 0.85) => { const dx = (x - L.puddle.x) / L.puddle.rx, dz = (z - L.puddle.z) / L.puddle.rz; return dx * dx + dz * dz < k * k; };

  const tmpC = new THREE.Color(), tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3(), tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpE = new THREE.Euler();

  /* ---------- build ---------- */
  function build() {
    scene = new THREE.Scene();
    ({ env, U, sample } = makeEnv(STOPS));
    S.env = env; S.scene = scene;
    scene.add(makeSky(U));
    Object.assign(U2, {
      rain: uniform(1), halfW: uniform(1), tanUp: uniform(0.4), pix: uniform(0.002), wind: uniform(0.07), brk: uniform(0),
      shine: uniform(0), tremble: uniform(0), winDir: uniform(new THREE.Vector3(0, 0, -1)), beam: uniform(0)
    });
    const haze = (col, d) => mix(col, U.fog, smoothstep(1.4, 18, d).mul(U.haze));
    S.dimN = pow(U.light, 1.6).mul(0.95).add(0.02);   // how much light falls on the near things

    /* heavy cloud: a painted overcast that thins where the sun is, and opens during the sunbreak */
    const cloudMat = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide, transparent: true, depthWrite: false }); cloudMat.fog = false;
    const cloudD = normalize(positionWorld.sub(cameraPosition));
    const cloudN = Fn(() => {
      const pr = cloudD.xz.div(cloudD.y.add(0.16)).mul(0.9).add(vec2(uTime.mul(0.006), uTime.mul(0.002)));
      return fbm(pr.mul(1.4)).mul(0.7).add(fbm(pr.mul(4.1).add(3.3)).mul(0.3));
    })();
    cloudMat.colorNode = Fn(() => {
      const sd = max(dot(cloudD, U.sunDir), 0);
      const c = mix(U.cloudCol.mul(0.8), U.cloudCol.mul(1.14), smoothstep(0.3, 0.75, cloudN)).toVar();
      // heavier, darker bellies overhead; lighter where the cloud thins toward the horizon
      c.mulAssign(smoothstep(0.05, 0.5, cloudD.y).mul(-0.12).add(1.04));
      c.addAssign(U.glow.mul(pow(sd, 5).mul(0.35).add(pow(sd, 40).mul(0.3))).mul(U.sunVis.add(U2.brk.mul(0.4))));
      // far rain curtains hanging from the cloud base
      const az = atan2(cloudD.x, cloudD.z.negate());
      const curtain = smoothstep(0.45, 0.8, vnoise(vec2(az.mul(9).add(uTime.mul(0.003)), 0.5))).mul(vnoise(vec2(az.mul(160), cloudD.y.mul(6))).mul(0.5).add(0.5));
      c.assign(mix(c, U.cloudCol.mul(0.8).add(U.fog.mul(0.15)), curtain.mul(smoothstep(0.2, 0.03, cloudD.y)).mul(0.35).mul(U2.rain)));
      // the far window lights the rain around it at night
      c.addAssign(C('#E0A868').mul(pow(max(dot(cloudD, U2.winDir), 0), 220).mul(0.22).add(pow(max(dot(cloudD, U2.winDir), 0), 30).mul(0.05))).mul(U.win));
      return mix(c, U.fog, exp(max(cloudD.y, 0).mul(-9)).mul(U.mist).mul(0.6));
    })();
    cloudMat.opacityNode = Fn(() => {
      const sd = max(dot(cloudD, U.sunDir), 0);
      const hole = smoothstep(0.55, 0.95, sd.add(cloudN.mul(0.25))).mul(U2.brk).mul(0.5);
      return U.cloud.mul(smoothstep(-0.03, 0.12, cloudD.y)).mul(cloudN.mul(0.5).add(0.55)).mul(hole.oneMinus()).min(1);
    })();
    const clouds = new THREE.Mesh(new THREE.SphereGeometry(420, 40, 20), cloudMat);
    clouds.frustumCulled = false; clouds.renderOrder = -9;
    clouds.onBeforeRender = (r, s, cam) => { clouds.position.copy(cam.position); clouds.updateMatrixWorld(); };
    scene.add(clouds);

    /* far: layered distance, painted in one mesh. Each layer is a tall quad whose top edge the shader draws:
       pale hills, a far wood, the tree line with single crowns and a few poplars, two swells of meadow.
       The layers fade toward the fog colour with distance and rise out of ground mist. */
    buildFar();
    /* the house: whitewashed wall, dark roof, chimney and a lean-to shed, one window (vertex shades x the hour colour) */
    houseMat = new THREE.MeshBasicMaterial({ color: 0x555555, vertexColors: true }); houseMat.fog = false;
    { const pos = [], col = [], quad = (pts, k, z) => { const [a, b, c, d] = pts; for (const p of [a, b, c, a, c, d]) { pos.push(p[0], p[1], z); col.push(k, k, k); } };
      const tri = (pts, k, z) => { for (const p of pts) { pos.push(p[0], p[1], z); col.push(k, k, k); } };
      quad([[-1.6, 0], [1.6, 0], [1.6, 2.05], [-1.6, 2.05]], 1.12, 0);                  // wall
      tri([[-1.6, 2.05], [1.6, 2.05], [0, 3.15]], 1.0, 0);                               // gable
      quad([[0.75, 2.5], [1.12, 2.5], [1.12, 3.75], [0.75, 3.75]], 0.62, -0.25);         // chimney
      quad([[-1.95, 1.9], [0, 3.62], [0, 3.95], [-2.05, 2.15]], 0.58, 0.2);            // roof, left slope
      quad([[0, 3.62], [1.95, 1.9], [2.05, 2.15], [0, 3.95]], 0.52, 0.2);              // roof, right slope
      quad([[-3.1, 0], [-1.6, 0], [-1.6, 1.35], [-3.1, 1.0]], 0.86, -0.3);             // shed
      quad([[-3.2, 0.92], [-1.6, 1.32], [-1.6, 1.5], [-3.25, 1.08]], 0.55, -0.15);      // shed roof
      quad([[-1.1, 0.0], [-0.5, 0.0], [-0.5, 1.25], [-1.1, 1.25]], 0.7, 0.12);          // door
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      house = new THREE.Mesh(g, houseMat); scene.add(house); }
    { const m = new THREE.MeshBasicNodeMaterial(); m.fog = false;       // a four-pane window: the panes glow, the cross stays dark
      S.winCol = uniform(new THREE.Color(0xF0C97A));
      m.colorNode = Fn(() => {
        const q = uv(), bar = max(smoothstep(0.07, 0.03, abs(q.x.sub(0.5))), smoothstep(0.06, 0.025, abs(q.y.sub(0.52))));
        const frame = max(smoothstep(0.1, 0.04, min(q.x, q.x.oneMinus())), smoothstep(0.1, 0.04, min(q.y, q.y.oneMinus())));
        const glow = smoothstep(0.75, 0.0, length(q.sub(vec2(0.5, 0.42)))).mul(0.35).add(0.8);
        return mix(S.winCol.mul(glow), S.winCol.mul(0.25), max(bar, frame).mul(0.8));
      })();
      houseWin = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.72), m); scene.add(houseWin); }
    houseGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: 0xF0C97A, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    houseGlow.material.fog = false; houseGlow.scale.setScalar(5); scene.add(houseGlow);

    /* the ground: wet earth and moss near, meadow far */
    const groundMat = new THREE.MeshBasicNodeMaterial(); groundMat.fog = false;
    U2.stoneP = uniform(new THREE.Vector2()); U2.leafP = uniform(new THREE.Vector2()); U2.cloverP = uniform(new THREE.Vector2());
    groundMat.colorNode = Fn(() => {
      const p = positionWorld.xz, d = length(positionWorld.sub(cameraPosition));
      const detail = smoothstep(4, 0.6, d);
      const n = fbm(p.mul(7)), n2 = vnoise(p.mul(70)), n3 = vnoise(p.mul(31).add(7.7)), grit = vnoise(p.mul(260));
      const moss = smoothstep(0.4, 0.66, fbm(p.mul(2.6).add(4.1)));
      const earth = U.earth.mul(n.mul(0.5).add(0.68)).mul(mix(vec3(1, 1, 1), vec3(1.1, 1.0, 0.86), n3));
      const mossC = U.moss.mul(0.66).mul(n.mul(0.45).add(0.72)).mul(mix(vec3(1, 1, 1), vec3(0.94, 1.04, 0.9), n2));
      const c = mix(earth, mossC, moss.mul(detail)).toVar();
      // stubble, fallen stems and grit in the near ground; it fades out before it can shimmer
      const fine = smoothstep(1.6, 0.3, d);
      c.mulAssign(mix(float(1), n2.mul(0.35).add(0.8).mul(n3.mul(0.3).add(0.85)), fine));
      c.assign(mix(c, U.moss.mul(0.55), smoothstep(0.6, 0.85, n3).mul(fine).mul(0.4)));
      c.mulAssign(mix(float(1), grit.mul(0.25).add(0.88), fine));
      // fallen straw: thin pale stems lying every which way
      const ang = vnoise(p.mul(3.3)).mul(9.0), dir = vec2(cos(ang), sin(ang));
      const sp = vec2(dot(p, dir), dot(p, vec2(dir.y.negate(), dir.x)));
      const straw = smoothstep(0.72, 0.92, vnoise(vec2(sp.x.mul(22), sp.y.mul(150)))).mul(smoothstep(1.3, 0.35, d));
      c.assign(mix(c, mix(U.straw, U.earth, 0.45).mul(0.75), straw.mul(0.35)));
      // small pebbles
      const pc = p.mul(38), pid = floor(pc), ph = hash12(pid);
      const pd = length(fract(pc).sub(vec2(hash12(pid.add(4.2)), hash12(pid.add(8.9))).mul(0.4).add(0.3)));
      const peb = step(0.94, ph).mul(smoothstep(0.2, 0.13, pd)).mul(smoothstep(1.1, 0.6, d)).mul(smoothstep(0.35, 0.55, d));
      c.assign(mix(c, mix(C('#4E4A42'), C('#7A7466'), ph.mul(12).fract()).mul(S.dimN).mul(smoothstep(0.2, 0.0, pd).mul(0.3).add(0.75)), peb.mul(0.85)));
      // the meadow floor beyond: shaded under the grass
      c.assign(mix(c, mix(mix(U.lo, U.moss, 0.55), U.straw.mul(0.55), fbm(p.mul(0.6)).mul(0.5)).mul(vnoise(p.mul(vec2(4, 2.5))).mul(0.3).add(0.75)), smoothstep(1.2, 4.0, d)));
      // soft contact shadows under the stone, the leaf and the clover
      const ds = p.sub(U2.stoneP).div(vec2(0.115, 0.085)), dl = p.sub(U2.leafP).div(vec2(0.085, 0.05)), dc = p.sub(U2.cloverP).div(vec2(0.13, 0.07));
      c.mulAssign(exp(dot(ds, ds).negate()).mul(0.55).oneMinus().mul(exp(dot(dl, dl).negate()).mul(0.4).oneMinus()).mul(exp(dot(dc, dc).negate()).mul(0.3).oneMinus()));
      // wet: patches of water film mirror the sky at a grazing angle
      const V = normalize(cameraPosition.sub(positionWorld));
      const wet = smoothstep(0.42, 0.72, fbm(p.mul(4.2).add(1.3))).mul(moss.mul(0.6).oneMinus());
      const sky = mix(U.hor, U.top, smoothstep(0.0, 0.4, V.y)).add(U.glow.mul(U.sunVis).mul(0.2));
      c.assign(mix(c, sky.mul(0.8), pow(V.y.oneMinus(), 5).mul(mix(0.12, 0.6, wet)).mul(smoothstep(0.2, 0.9, d)).mul(smoothstep(3.2, 1.4, d))));
      c.addAssign(U.hor.mul(pow(V.y.oneMinus(), 6).mul(0.08)).mul(smoothstep(0.3, 1.4, d)).mul(smoothstep(6, 2, d)));
      c.addAssign(U.glow.mul(U2.beam).mul(0.08));
      return haze(c, d);
    })();
    ground = new THREE.Mesh(new THREE.PlaneGeometry(160, 160, 1, 1), groundMat);
    ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, -60); scene.add(ground);

    /* the puddle: a mirror of the sky with rain rings */
    rippleArr = uniformArray(ripples, 'vec4');
    const ringField = Fn(([p, rainAmt]) => {     // procedural rain rings: one ring per cell per cycle, cells switch on with the rain
      const g = vec3(0).toVar();
      for (let k = 0; k < 2; k++) {
        const cell = 0.055 + k * 0.012;
        const q = p.div(cell).add(vec2(k * 0.5, k * 0.37));
        const id = floor(q), f = fract(q);
        const h = hash12(id.add(k * 17.0));
        const rate = h.mul(0.5).add(0.55);
        const cyc = uTime.mul(rate).add(h.mul(7));
        const ph = fract(cyc);
        const alive = step(hash12(id.add(floor(cyc).mul(1.37)).add(k * 5.0)), rainAmt);
        const c = vec2(hash12(id.add(3.7)), hash12(id.add(9.1))).mul(0.5).add(0.25);
        const dv = f.sub(c).mul(cell), rr = length(dv).add(0.0001);
        const x = rr.sub(ph.mul(0.026).add(0.001));
        const en = exp(x.mul(x).div(-0.000012)).mul(ph.oneMinus().mul(ph.oneMinus())).mul(alive);
        g.addAssign(vec3(dv.div(rr).mul(cos(x.mul(900))).mul(en), en));
      }
      return g;
    }).setLayout({ name: 'rainRingField', type: 'vec3', inputs: [{ name: 'p', type: 'vec2' }, { name: 'rainAmt', type: 'float' }] });
    const puddleMat = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false }); puddleMat.fog = false;
    const pud = Fn(() => {
      const p = positionWorld.xz;
      const g = ringField(p, U2.rain).toVar();
      Loop(MAX_RIPPLES, ({ i }) => {
        const r = rippleArr.element(i);
        const age = uTime.sub(r.z);
        const alive = step(0, age).mul(step(age, 3)).mul(step(0.0001, r.w));
        const dv = p.sub(r.xy), rr = length(dv).add(0.0001);
        const x = rr.sub(age.mul(0.07).add(0.004));
        const fade = clamp(age.div(3).oneMinus(), 0, 1);
        const en = exp(x.mul(x).div(-0.00006)).mul(fade.mul(fade)).mul(r.w).mul(alive);
        g.addAssign(vec3(dv.div(rr).mul(cos(x.mul(420))).mul(en), en));
      });
      return g;
    })();
    puddleMat.colorNode = Fn(() => {
      const N = normalize(vec3(pud.x.mul(-0.35), 1, pud.y.mul(-0.35)));
      const V = normalize(cameraPosition.sub(positionWorld));
      const R = reflect(V.negate(), N);
      const az = atan2(R.x, R.z.negate());
      const sky = mix(U.hor, U.top, pow(smoothstep(-0.02, 0.45, R.y), 0.7)).toVar();
      // the clouds, upside down
      const cn = fbm(R.xz.div(R.y.add(0.16)).mul(1.26).add(vec2(uTime.mul(0.006), uTime.mul(0.002))));
      sky.assign(mix(sky, mix(U.cloudCol.mul(0.78), U.cloudCol.mul(1.12), smoothstep(0.3, 0.75, cn)), smoothstep(0.03, 0.14, R.y).mul(U.cloud).mul(0.7)));
      sky.addAssign(U.glow.mul(pow(max(dot(R, U.sunDir), 0), 10).mul(0.4)).mul(U.sunVis.add(U2.brk.mul(0.5))));
      sky.addAssign(C('#F0C97A').mul(pow(max(dot(R, U2.winDir), 0), 40).mul(0.2)).mul(U.win));
      // the woods in the mist, then the meadow, seen upside down at the far edge of the reflection
      const woods = vnoise(vec2(az.mul(70), 4.5)).mul(0.012).add(vnoise(vec2(az.mul(16), 6.5)).mul(0.03)).add(0.03);
      sky.assign(mix(sky, mix(U.tree, U.fog, smoothstep(woods, 0.0, R.y).mul(0.5).add(0.25)), smoothstep(woods.add(0.003), woods.sub(0.003), R.y)));
      const grassTop = vnoise(vec2(az.mul(90), 0.5)).mul(0.03).add(vnoise(vec2(az.mul(13), 2.5)).mul(0.02)).add(0.012);
      const meadow = mix(U.moss.mul(0.5), U.straw.mul(0.5), vnoise(vec2(az.mul(40), 1.5)));
      sky.assign(mix(sky, mix(meadow, U.fog, U.haze.mul(0.4)), smoothstep(grassTop.add(0.004), grassTop.sub(0.004), R.y)));
      // the far window, a warm streak at night
      const wd = max(dot(R, U2.winDir), 0);
      sky.addAssign(vec3(0.95, 0.72, 0.4).mul(pow(wd, 900).mul(1.8).add(pow(wd, 60).mul(0.14))).mul(U.win));
      // Schlick: a puddle seen this low is half mirror, half dark water over mud
      const fres = pow(max(dot(N, V), 0).oneMinus(), 5).mul(0.9).add(0.1);
      const body = mix(U.earth.mul(0.75), U.lo.mul(0.9), 0.4).add(U.top.mul(0.04));
      sky.assign(mix(sky, sky.mul(C('#5E7F80')).mul(1.9), 0.3));                               // tide: the one cool colour gives the water its depth
      const col = mix(body, sky.mul(0.94), fres.mul(0.85).add(0.1).min(1)).toVar();
      col.addAssign(U.rainCol.mul(pud.z).mul(mix(0.35, 0.6, U.light)));
      return col;
    })();
    puddleMat.opacityNode = Fn(() => {
      const q = positionGeometry.xy, r = length(q), a = atan2(q.y, q.x);
      const edge = vnoise(vec2(a.mul(2.2).add(1.3), 0.5)).mul(0.16).add(vnoise(vec2(a.mul(6), 3.1)).mul(0.035));
      return smoothstep(1.0, 0.86, r.add(edge)).mul(0.95);
    })();
    puddle = new THREE.Mesh(new THREE.CircleGeometry(1, 56), puddleMat);
    puddle.rotation.x = -Math.PI / 2; puddle.renderOrder = 1; scene.add(puddle);
    // a darker wet rim around the puddle
    const rimMat = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false }); rimMat.fog = false;
    rimMat.colorNode = U.earth.mul(0.55);
    rimMat.opacityNode = Fn(() => { const r = length(positionGeometry.xy); return smoothstep(1.0, 0.6, r).mul(0.55); })();
    S.rim = new THREE.Mesh(new THREE.CircleGeometry(1, 40), rimMat); S.rim.rotation.x = -Math.PI / 2; S.rim.renderOrder = 0; scene.add(S.rim);

    /* blades */
    makeBlades();
    bladeGeo = new THREE.InstancedBufferGeometry();
    { const seg = 6, pos = [], idx = [];
      for (let i = 0; i <= seg; i++) { const t = i / seg; pos.push(-0.5, t, 0, 0.5, t, 0); }
      for (let i = 0; i < seg; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      bladeGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); bladeGeo.setIndex(idx); }
    bladeAttr = {
      base: new THREE.InstancedBufferAttribute(new Float32Array(B.n * 3), 3),
      shape: new THREE.InstancedBufferAttribute(new Float32Array(B.n * 4), 4),
      vary: new THREE.InstancedBufferAttribute(new Float32Array(B.n * 2), 2),
      bend: new THREE.InstancedBufferAttribute(new Float32Array(B.n), 1).setUsage(THREE.DynamicDrawUsage)
    };
    for (let i = 0; i < B.n; i++) { bladeAttr.shape.setXYZW(i, B.h[i], B.w[i], B.yaw[i], B.lean[i]); bladeAttr.vary.setXY(i, B.ph[i], B.tint[i]); }
    bladeGeo.setAttribute('aBase', bladeAttr.base); bladeGeo.setAttribute('aShape', bladeAttr.shape); bladeGeo.setAttribute('aVary', bladeAttr.vary); bladeGeo.setAttribute('aBend', bladeAttr.bend);
    bladeGeo.instanceCount = B.n;
    bladeMat = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide }); bladeMat.fog = false;
    bladeMat.positionNode = Fn(() => {
      const base = attribute('aBase', 'vec3'), sh = attribute('aShape', 'vec4'), vr = attribute('aVary', 'vec2'), bend = attribute('aBend', 'float');
      const t = positionGeometry.y, t2 = t.mul(t), h = sh.x;
      const sway = sin(uTime.mul(0.6).add(vr.x)).mul(0.04).add(sin(uTime.mul(1.37).add(vr.x.mul(2.3))).mul(0.015)).mul(WIND);
      const bx = bend.add(sway);
      const taper = t.oneMinus().mul(t.mul(0.5).add(0.75));
      const lx = positionGeometry.x.mul(sh.y).mul(taper);
      const side = vec3(cos(sh.z), 0, sin(sh.z).negate()), fwd = vec3(sin(sh.z), 0, cos(sh.z));
      const up = t.mul(h).mul(sh.w.mul(sh.w).add(bx.mul(bx)).mul(0.18).oneMinus());
      return base.add(side.mul(lx)).add(fwd.mul(sh.w.mul(t2).mul(h))).add(vec3(bx.mul(t2).mul(h), up, bx.mul(t2).mul(h).mul(0.2)));
    })();
    bladeMat.colorNode = Fn(() => {
      const vr = attribute('aVary', 'vec2'), t = positionGeometry.y, x = positionGeometry.x;
      const hv = fract(vr.x.mul(7.13)), hv2 = fract(vr.x.mul(3.71).add(0.3));   // per blade: hue and a few dry blades
      const c = mix(U.lo, U.moss, smoothstep(0.0, 0.6, t)).toVar();
      c.mulAssign(mix(vec3(0.9, 1.0, 1.04), vec3(1.07, 1.03, 0.86), hv2));     // cooler blue-green to warmer yellow-green
      c.assign(mix(c, U.straw, smoothstep(0.35, 1.0, t).mul(vr.y)));
      c.assign(mix(c, mix(U.straw, U.earth, 0.35).mul(1.05), step(0.9, hv).mul(smoothstep(0.05, 0.5, t)).mul(0.85)));   // bleached last-year blades
      c.mulAssign(mix(0.8, 1.06, step(0, x)));                                  // a folded blade: one half in shade
      c.mulAssign(smoothstep(0.0, 0.35, t).mul(0.32).add(0.68).max(smoothstep(1.4, 0.8, length(positionWorld.sub(cameraPosition)))));   // darker where the meadow crowds at the base
      c.addAssign(U.hor.mul(exp(x.mul(x).mul(-60))).mul(t).mul(0.07));          // wet midrib
      // wet sheen: a blade seen edge-on mirrors the bright sky
      const sh = attribute('aShape', 'vec4'), Vw = normalize(cameraPosition.sub(positionWorld));
      const fres = pow(abs(dot(vec3(sin(sh.z), 0, cos(sh.z)), Vw)).oneMinus(), 4);
      c.addAssign(mix(U.hor, U.beadCol, 0.3).mul(fres).mul(t.mul(0.6).add(0.4)).mul(0.16).mul(S.dimN.add(0.15)));
      c.addAssign(U.glow.mul(U2.beam).mul(t.mul(t)).mul(0.22));                   // sunbreak warmth on the tips
      const d = length(positionWorld.sub(cameraPosition));
      c.assign(mix(c, mix(U.moss, U.straw, 0.4).mul(0.85), smoothstep(1.6, 7, d).mul(0.45)));     // the far meadow melts into one soft green-gold
      return haze(c, d);
    })();
    const bladeMesh = new THREE.Mesh(bladeGeo, bladeMat); bladeMesh.frustumCulled = false; scene.add(bladeMesh);

    /* flower heads on the tall stalks: seed heads, rusty sorrel, buttercups, white campion, red clover.
       Small facing cards that ride the stalk tip with the same sway and bend as the blade shader. */
    { const n = flowers.length, fr = seeded(41), plane = new THREE.PlaneGeometry(2, 2), g = new THREE.InstancedBufferGeometry();
      g.index = plane.index; g.setAttribute('position', plane.attributes.position);
      const base = new Float32Array(n * 3), shape = new Float32Array(n * 4), vary = new Float32Array(n * 2), kindA = new Float32Array(n * 4);
      flowers.forEach((bi, k) => {
        shape.set([B.h[bi], B.w[bi], B.yaw[bi], B.lean[bi]], k * 4); vary.set([B.ph[bi], B.tint[bi]], k * 2);
        const p = fr(), far = B.d[bi] > 4.5, type = flowerType[k] >= 0 ? flowerType[k] : far ? (p < 0.7 ? 3 : p < 0.8 ? 4 : p < 0.9 ? 0 : 1) : p < 0.35 ? 3 : p < 0.5 ? (B.d[bi] < 2 ? 3 : 4) : p < 0.72 ? 0 : p < 0.88 ? 1 : 2;
        const s = flowerType[k] >= 0 ? 0.0046 : (type >= 3 ? 0.0075 : 0.011) * (0.8 + fr() * 0.45) * (B.d[bi] < 2 ? 0.85 : 1.25);
        kindA.set([type, s, type >= 3 ? 3.4 + fr() * 1.5 : 1, fr()], k * 4);
      });
      fAttr = { base: new THREE.InstancedBufferAttribute(base, 3), bend: new THREE.InstancedBufferAttribute(new Float32Array(n), 1).setUsage(THREE.DynamicDrawUsage) };
      g.setAttribute('aBase', fAttr.base); g.setAttribute('aShape', new THREE.InstancedBufferAttribute(shape, 4)); g.setAttribute('aVary', new THREE.InstancedBufferAttribute(vary, 2));
      g.setAttribute('aBend', fAttr.bend); g.setAttribute('aKind', new THREE.InstancedBufferAttribute(kindA, 4)); g.instanceCount = n;
      const m = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide }); m.fog = false; m.alphaTest = 0.5;
      const kd = attribute('aKind', 'vec4');
      m.positionNode = Fn(() => {
        const base = attribute('aBase', 'vec3'), sh = attribute('aShape', 'vec4'), vr = attribute('aVary', 'vec2'), bend = attribute('aBend', 'float'), h = sh.x;
        const sway = sin(uTime.mul(0.6).add(vr.x)).mul(0.04).add(sin(uTime.mul(1.37).add(vr.x.mul(2.3))).mul(0.015)).mul(WIND);
        const bx = bend.add(sway);
        const fwd = vec3(sin(sh.z), 0, cos(sh.z));
        const up = h.mul(sh.w.mul(sh.w).add(bx.mul(bx)).mul(0.18).oneMinus());
        const tip = base.add(fwd.mul(sh.w.mul(h))).add(vec3(bx.mul(h), up, bx.mul(h).mul(0.2)));
        const q = positionGeometry.xy;                                    // a card facing the camera, standing on the tip
        return tip.add(vec3(q.x.mul(kd.y), q.y.mul(kd.y).mul(kd.z).add(kd.y.mul(kd.z).mul(0.55)), 0));
      })();
      const fcol = Fn(() => {
        const q = positionGeometry.xy, r = length(q), ty = kd.x;
        const petals = r.lessThan(cos(atan2(q.y, q.x).mul(5).add(kd.w.mul(6))).mul(0.16).add(0.78));
        const fluffy = step(r, vnoise(q.mul(4.5).add(kd.w.mul(13))).mul(0.25).add(0.68));      // clover and campion heads: soft round tufts
        const round = select(ty.lessThan(0.5), select(petals, float(1), float(0)), fluffy);
        const grain = vnoise(q.mul(vec2(5, 11)).add(kd.w.mul(20)));
        const spike = step(length(q.mul(vec2(1.1, 1))).add(abs(q.y).mul(0.15)), 0.95).mul(step(0.32, grain));
        const isHead = step(2.5, ty);
        const a = mix(round, spike, isHead);
        const gold = C('#C9A35B'), white = C('#E6DCC6'), rose = C('#A86E6A'), rust = C('#7E5442');
        const seed = mix(U.straw.mul(0.95), mix(U.straw, U.earth, 0.5), grain);
        const head = select(ty.lessThan(0.5), gold, select(ty.lessThan(1.5), white, select(ty.lessThan(2.5), rose, select(ty.lessThan(3.5), seed, rust)))).toVar();
        head.assign(mix(head, mix(head, gold.mul(0.7), 0.6), smoothstep(0.32, 0.15, r).mul(step(ty, 0.5))));   // a darker heart in the buttercup
        head.mulAssign(grain.mul(0.25).add(0.85));
        const lit = head.mul(S.dimN.mul(0.85).add(0.02)).add(U.hor.mul(0.04)).add(U.glow.mul(U2.beam).mul(0.2));
        const d = length(positionWorld.sub(cameraPosition));
        return vec4(haze(mix(lit, mix(U.moss, U.straw, 0.4).mul(0.85), smoothstep(2.0, 8, d).mul(0.55)), d), a);
      })();
      m.colorNode = fcol.xyz; m.opacityNode = fcol.w;
      const fm = new THREE.Mesh(g, m); fm.frustumCulled = false; scene.add(fm); }

    /* water: beads on tips, caught drops, crowns. One shiny material for all of them */
    const beadMat = new THREE.MeshBasicNodeMaterial(); beadMat.fog = false;
    beadMat.colorNode = Fn(() => {
      const V = normalize(cameraPosition.sub(positionWorld)), N = normalize(normalWorld);
      const fr = pow(max(dot(N, V), 0).oneMinus(), 1.5);
      const sky = mix(U.hor, U.beadCol, 0.3).mul(smoothstep(0.6, -0.5, N.y).mul(0.5).add(0.55))  .mul(S.dimN.mul(0.8).add(0.12));   // the bright sky seen through the drop, upside down
      const c = mix(sky, U.lo.mul(0.8), fr.mul(0.75)).toVar();
      const R = reflect(V.negate(), N);
      c.addAssign(U.beadCol.mul(pow(max(dot(R, normalize(vec3(0.3, 1, 0.4))), 0), 40).mul(1.0)).mul(S.dimN.mul(0.8).add(0.1)));
      c.addAssign(C('#F0C97A').mul(pow(max(dot(R, U2.winDir), 0), 140).mul(0.28)).mul(U.bead));
      return c;
    })();
    S.beadMat = beadMat;
    const beadGeo = new THREE.SphereGeometry(1, 10, 8);
    beadMesh = new THREE.InstancedMesh(beadGeo, beadMat, tips.length); beadMesh.frustumCulled = false; scene.add(beadMesh);
    catches = Array.from({ length: 4 }, () => { const m = new THREE.Mesh(beadGeo, beadMat); m.visible = false; scene.add(m); return { m, state: 'idle', t0: 0, blade: 0, from: new THREE.Vector3(), land: new THREE.Vector3() }; });
    crowns = Array.from({ length: 4 }, () => {
      const mat = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide }); mat.fog = false;
      const op = uniform(0);
      mat.colorNode = Fn(() => mix(U.beadCol.mul(0.8), U.beadCol.mul(1.2), positionGeometry.y.add(0.5)))();
      mat.opacityNode = op.mul(positionGeometry.y.add(0.5).mul(0.6).add(0.4));
      const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 0.7, 1, 22, 1, true), mat); m.visible = false; m.renderOrder = 4; scene.add(m);
      return { m, op, t0: -9, on: false };
    });

    /* clover */
    { const s = new THREE.Shape();
      s.moveTo(0, 0); s.bezierCurveTo(0.004, -0.008, 0.013, -0.009, 0.0128, -0.0025); s.quadraticCurveTo(0.0126, 0, 0.0108, 0);
      s.quadraticCurveTo(0.0126, 0, 0.0128, 0.0025); s.bezierCurveTo(0.013, 0.009, 0.004, 0.008, 0, 0);
      const g = new THREE.ShapeGeometry(s, 6); g.rotateX(-Math.PI / 2);
      const cr = seeded(5), plants = [];
      for (let i = 0; i < 80; i++) { const a = cr() * 6.28, rr = Math.sqrt(cr()); plants.push({ dx: Math.cos(a) * rr, dz: Math.sin(a) * rr, h: 0.004 + cr() * 0.016, rot: cr() * 6.28, s: 0.62 + cr() * 0.45, tilt: 0.35 + cr() * 0.4, tint: cr() }); }
      S.clovers = plants;
      const tint = new Float32Array(plants.length * 3);
      plants.forEach((p, i) => { for (let k = 0; k < 3; k++) tint[i * 3 + k] = p.tint; });
      g.setAttribute('aTint', new THREE.InstancedBufferAttribute(tint, 1));
      const m = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide }); m.fog = false;
      m.colorNode = Fn(() => {
        const p = positionGeometry, tn = attribute('aTint', 'float');
        const c = mix(U.lo.mul(1.5), U.moss.mul(1.08), tn.mul(0.55).add(0.3)).mul(mix(vec3(0.94, 1.0, 1.04), vec3(1.04, 1.03, 0.9), tn)).toVar();
        const chev = exp(abs(abs(p.z).mul(1.3).sub(p.x.sub(0.0055))).div(0.0011).negate()).mul(step(0.003, p.x));
        c.assign(mix(c, U.straw.mul(1.05), chev.mul(0.25)));
        c.mulAssign(smoothstep(0.0, 0.012, length(p.xz)).mul(0.3).add(0.7));         // darker toward the stem
        c.addAssign(U.hor.mul(0.04).add(U.hor.mul(smoothstep(0.006, 0.012, p.x)).mul(0.04)));   // a wet sheen on the leaf tips
        return c;
      })();
      cloverMesh = new THREE.InstancedMesh(g, m, plants.length * 3); cloverMesh.frustumCulled = false; scene.add(cloverMesh);
    }

    /* a flat wet stone */
    { const g = new THREE.SphereGeometry(1, 28, 14), p = g.attributes.position, sr = seeded(9);
      const bumps = Array.from({ length: 5 }, () => [sr() * 6.28, sr() * 0.12]); stoneBumps = bumps;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x); let k = 1; for (const [o, s] of bumps) k += s * Math.sin(a * 2 + o); p.setXYZ(i, x * k, y > 0 ? y * (0.55 + 0.45 * Math.abs(y)) : y, z * k); }
      g.computeVertexNormals();
      const m = new THREE.MeshBasicNodeMaterial(); m.fog = false;
      m.colorNode = Fn(() => {
        const q = positionGeometry, n = fbm(q.xz.mul(3.2).add(q.y)), N = normalize(normalWorld), V = normalize(cameraPosition.sub(positionWorld));
        const c = mix(C('#3E3C36'), C('#68655A'), n).toVar();
        c.mulAssign(mix(vec3(1, 1, 1), vec3(0.95, 1.02, 0.94), vnoise(q.xz.mul(9))));
        // lichen: pale crusts and a little moss on top
        const li = smoothstep(0.62, 0.7, fbm(q.xz.mul(7).add(3.1))).mul(smoothstep(-0.1, 0.5, q.y));
        c.assign(mix(c, C('#8E8A74'), li.mul(0.3)));
        c.assign(mix(c, U.moss.mul(0.8), smoothstep(0.58, 0.72, fbm(q.xz.mul(5).add(9.3))).mul(smoothstep(0.2, 0.8, N.y)).mul(0.5)));
        c.mulAssign(smoothstep(-0.2, 0.8, N.y).mul(0.55).add(0.45).mul(smoothstep(-0.6, 0.0, q.y).mul(0.3).add(0.7)));
        c.mulAssign(S.dimN);
        // wet: a sky sheen across the top, stronger at a grazing angle
        const R = reflect(V.negate(), N), fr = pow(max(dot(N, V), 0).oneMinus(), 4).mul(0.6).add(0.06);
        c.addAssign(mix(U.hor, U.top, smoothstep(0, 0.5, R.y)).mul(fr).mul(smoothstep(-0.1, 0.6, N.y)).mul(li.mul(0.5).oneMinus()).mul(0.55));
        c.addAssign(C('#F0C97A').mul(pow(max(dot(R, U2.winDir), 0), 60).mul(0.25)).mul(U.win));
        return c;
      })();
      stone = new THREE.Mesh(g, m); stone.scale.set(0.08, 0.026, 0.058); scene.add(stone); }

    buildLeaf(); buildSnail(); buildWeb();

    /* the rain: fine streaks, all moved on the GPU */
    { const N = 1700, r = seeded(77), seeds = new Float32Array(N * 4);
      for (let i = 0; i < N * 4; i++) seeds[i] = r();
      const plane = new THREE.PlaneGeometry(1, 1), g = new THREE.InstancedBufferGeometry();
      g.index = plane.index; g.setAttribute('position', plane.attributes.position); g.setAttribute('uv', plane.attributes.uv);
      g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 4)); g.instanceCount = N;
      const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide }); m.fog = false;
      const sd = attribute('aSeed', 'vec4');
      const depth = sd.z.pow(1.25).mul(9.5).add(0.45);
      const H = depth.mul(U2.tanUp).add(0.35);
      const speed = sd.w.mul(0.6).add(2.3);
      const ph = fract(sd.w.mul(13.7).add(uTime.mul(speed).div(H)));
      const yy = H.mul(ph.oneMinus()).sub(0.02);
      const center = vec3(sd.x.mul(2).sub(1).mul(U2.halfW.mul(depth).add(0.15)).add(yy.mul(U2.wind)), yy, depth.negate());
      const on = step(sd.y, U2.rain);
      m.positionNode = Fn(() => {
        const dir = normalize(vec3(U2.wind.negate(), -1, 0));
        const toC = center.sub(cameraPosition), dist = length(toC);
        const side = normalize(cross(dir, toC.div(dist)));
        const len = speed.mul(0.034).mul(U.streak).mul(on);
        const wid = dist.mul(U2.pix).mul(1.7).mul(on);
        return center.add(dir.mul(positionGeometry.y.negate().mul(len))).add(side.mul(positionGeometry.x.mul(wid)));
      })();
      m.colorNode = Fn(() => {
        const toC = normalize(center.sub(cameraPosition));
        const warm = pow(max(dot(toC, U.sunDir), 0), 3).mul(U.sunVis);
        return U.rainCol.add(U.glow.mul(warm).mul(0.6));
      })();
      m.opacityNode = Fn(() => {
        const q = uv(), dist = length(center.sub(cameraPosition));
        const qy = q.y.oneMinus();
        const along = mix(pow(qy, 1.6), smoothstep(0.7, 0.98, qy).mul(1.4), U.bead);
        const across = q.x.mul(2).sub(1); const prof = across.mul(across).oneMinus();
        const fade = smoothstep(0.45, 0.9, dist).mul(smoothstep(10.5, 3, dist).mul(0.65).add(0.35));
        return along.mul(prof).mul(fade).mul(U.rainA).mul(step(0.0, center.y));
      })();
      const rainMesh = new THREE.Mesh(g, m); rainMesh.frustumCulled = false; rainMesh.renderOrder = 3; scene.add(rainMesh);
    }

    /* the sunbeam of the hidden sunbreak */
    { const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }); m.fog = false;
      m.colorNode = U.glow.mul(0.9);
      m.opacityNode = Fn(() => {
        const q = positionGeometry.xy;
        const c = q.x.mul(0.9).sub(q.y.mul(0.55));
        const shafts = smoothstep(0.3, 0.85, vnoise(vec2(c.mul(2.6).add(uTime.mul(0.012)), 0.4))).mul(0.75).add(0.25);
        const band = smoothstep(-2.6, 0.2, c).mul(smoothstep(2.6, 0.6, c));
        return shafts.mul(band).mul(smoothstep(-1.6, 0.4, q.y)).mul(U2.beam).mul(0.34);
      })();
      beam = new THREE.Mesh(new THREE.PlaneGeometry(7, 3.2), m); beam.position.set(0.6, 1.4, -3.6); beam.renderOrder = 5; scene.add(beam); }

    /* particles: drops from tips, splashes on the ground, crown spray, steam, out-of-focus drops near the lens */
    fall = new Pool(scene, 80, { size: 0.0042, color: 0xF2EAD6, gain: 1.1, step: (p, dt) => {
      p.vy -= 2.6 * dt; p.y += p.vy * dt; p.x += p.vx * dt;
      if (p.y < 0.003 && !p.done) { p.done = true; p.age = p.life - 0.12; if (inPuddle(p.x, p.z)) ripple(p.x, p.z, 0.5); else spray.add({ x: p.x, y: 0.004, z: p.z, vx: 0, vy: 0.08, vz: 0, life: 0.55, s: 0.8 }); }
      return 0.85 * smooth(0, 0.12, p.age) * (p.done ? 1 - smooth(p.life - 0.12, p.life, p.age) : 1);
    } });
    splash = new Pool(scene, 70, { size: 0.006, color: 0xF2EAD6, gain: 1, step: (p, dt) => {
      const f = p.age / p.life; p.y += 0.03 * dt; p.s = 0.6 + f * 0.9;
      return 0.28 * Math.sin(Math.PI * f);
    } });
    spray = new Pool(scene, 90, { size: 0.0032, color: 0xF6EEDC, gain: 1.15, step: (p, dt) => {
      const f = p.age / p.life; p.vy -= 1.1 * dt; p.x += p.vx * dt; p.y = Math.max(0.002, p.y + p.vy * dt); p.z += p.vz * dt;
      return 0.9 * smooth(0, 0.12, f) * (1 - smooth(0.55, 1, f));
    } });
    steam = new Pool(scene, 60, { size: 0.22, color: 0xEFE3CF, gain: 0.95, step: (p, dt, t) => {
      const f = p.age / p.life; p.y += 0.035 * dt; p.x += Math.sin(t * 0.3 + p.ph) * 0.012 * dt; p.s = 0.6 + f * 1.4;
      return 0.2 * Math.sin(Math.PI * f) * p.k;
    } });
    bokeh = new Pool(scene, 10, { size: 0.03, color: 0xEFE3CF, gain: 1, step: (p, dt, t) => {
      const f = p.age / p.life; p.y -= 0.0025 * dt;
      return p.a * Math.sin(Math.PI * f) * (0.4 + 0.6 * S._rainEff) * (0.3 + 0.7 * env.light);
    } });
  }
  let catches = [], crowns = [];

  /* ---------- far layers and mist banks ---------- */
  const hillTop = (x, hx) => 6.2 + 2.2 * Math.sin(x * 0.021 + 0.6) + 1.1 * Math.sin(x * 0.067 + 2.1) + 0.5 * Math.sin(x * 0.17) + 1.6 * Math.exp(-((x - hx) ** 2) / 300);
  function quadGeo(layers, attrs) {                  // one quad per layer, far to near, so blending inside one draw is in order
    const pos = [], idx = [], A = attrs.map(() => []);
    layers.forEach((l, n) => {
      const hw = Math.abs(l.z) * 2.6, v = n * 4;
      for (const [x, y] of [[-hw, l.y0 ?? -1], [hw, l.y0 ?? -1], [hw, l.y1], [-hw, l.y1]]) { pos.push(x, y, l.z); attrs.forEach((k, j) => A[j].push(...l[k])); }
      idx.push(v, v + 1, v + 2, v, v + 2, v + 3);
    });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    attrs.forEach((k, j) => g.setAttribute(k, new THREE.Float32BufferAttribute(A[j], 4))); g.setIndex(idx);
    return g;
  }
  function buildFar() {
    U2.houseX = uniform(0); U2.houseU = uniform(0);
    // a: kind (0 hills, 1 trees, 2 meadow), seed, crown width, tree height;  b: base, amplitude, haze, mist height
    const layers = [
      { z: -120, y1: 13, a: [0, 0, 0, 0], b: [0, 0, 0.42, 2.6] },
      { z: -70, y1: 9, a: [1, 3, 3.1, 4.6], b: [2.2, 1.6, 0.34, 2.2] },
      { z: -46, y1: 7, a: [1, 11, 2.2, 3.3], b: [0.6, 0.7, 0.2, 1.6] },
      { z: -30, y1: 6, a: [1, 7, 1.55, 2.5], b: [0.25, 0.5, 0.06, 1.1] },
      { z: -19, y1: 1.2, a: [2, 5, 0, 0], b: [0.16, 0.3, 0.5, 0.5] },
      { z: -13.5, y1: 1.0, a: [2, 9, 0, 0], b: [0.12, 0.26, 0.42, 0.4] }
    ];
    const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false }); m.fog = false;
    const crownTop = Fn(([x, seed, cw, th, dip]) => {        // the highest crown over x: round crowns, some tall and narrow, a few gaps
      const q = x.div(cw), c = floor(q), top = float(-9).toVar();
      for (let k = -2; k <= 2; k++) {                        // soft round crowns: a bell over each tree, wide enough to merge with its neighbours
        const id = c.add(k);
        const h1 = hash12(vec2(id, seed)), h2 = hash12(vec2(id.add(0.37), seed.add(1.3))), h3 = hash12(vec2(id.add(0.71), seed.add(2.9)));
        const poplar = step(0.84, h3);
        const r = mix(h2.mul(0.35).add(0.58), float(0.32), poplar);
        const dx = q.sub(id.add(0.5).add(h1.sub(0.5).mul(0.6))).div(r);
        const ry = r.mul(cw).mul(mix(float(0.78), float(2.2), poplar));
        const hc = th.mul(h3.fract().mul(0.3).add(h2.mul(0.1)).add(0.7)).mul(mix(float(0.55), float(1), step(0.1, h1))).mul(dip).sub(ry.mul(0.25));
        const circ = sqrt(max(dx.mul(dx).oneMinus(), 0.0)), tail = exp(max(abs(dx).sub(1), 0.0).mul(-3)).sub(1).mul(0.6);
        top.assign(max(top, hc.add(ry.mul(circ.add(tail)))));   // a round crown, with the shoulders curving down into the next
      }
      return top;
    }).setLayout({ name: 'rainCrownTop', type: 'float', inputs: [{ name: 'x', type: 'float' }, { name: 'seed', type: 'float' }, { name: 'cw', type: 'float' }, { name: 'th', type: 'float' }, { name: 'dip', type: 'float' }] });
    const farCol = Fn(() => {
      const a = attribute('a', 'vec4'), b = attribute('b', 'vec4');
      const x = positionWorld.x, y = positionWorld.y, dz = positionWorld.z.negate();
      const cw = max(a.z, 0.1), kind = a.x, isHill = step(kind, 0.5), isTree = step(0.5, kind).mul(step(kind, 1.5)), isMeadow = step(1.5, kind);
      // the dip in the woods where the house stands, so the window can be seen
      const dip = smoothstep(0.016, 0.06, abs(x.div(dz).sub(U2.houseU))).mul(0.8).add(0.2);
      const hill = sin(x.mul(0.021).add(0.6)).mul(2.2).add(6.2).add(sin(x.mul(0.067).add(2.1)).mul(1.1)).add(sin(x.mul(0.17)).mul(0.5))
        .add(exp(x.sub(U2.houseX).mul(x.sub(U2.houseX)).div(-300)).mul(1.6)).add(vnoise(vec2(x.mul(0.6), 1.5)).mul(0.25));
      const under = b.x.add(b.y.mul(vnoise(vec2(x.div(cw).mul(0.7), a.y)))).add(vnoise(vec2(x.mul(3).div(cw), a.y.add(4))).mul(cw).mul(0.18)).mul(dip);
      const leafy = vnoise(vec2(x.mul(7).div(cw), a.y.add(2))).sub(0.5).mul(cw).mul(0.2).add(vnoise(vec2(x.mul(23).div(cw), a.y)).sub(0.5).mul(cw).mul(0.05));
      const trees = max(crownTop(x, a.y, cw, a.w, dip).add(b.x), under).add(leafy);
      const meadow = b.x.add(b.y.mul(vnoise(vec2(x.mul(0.8), a.y)).mul(0.45).add(vnoise(vec2(x.mul(6.5), a.y.add(1))).mul(0.3)).add(vnoise(vec2(x.mul(48), a.y.add(2))).mul(0.25))));
      const top = hill.mul(isHill).add(trees.mul(isTree)).add(meadow.mul(isMeadow));
      const soft = dz.mul(mix(float(0.0016), float(0.004), isHill));
      const alpha = smoothstep(top.add(soft), top.sub(soft), y);
      // colour: hills with faint field patches, woods lit from above and mottled, meadow with seed-head streaks and a few flower specks
      const below = top.sub(y);
      const hillC = mix(U.hill, U.hill.mul(0.86).add(U.tree.mul(0.1)), smoothstep(0.45, 0.7, fbm(vec2(x.mul(0.05), y.mul(0.35)))));
      const crown = smoothstep(cw.mul(0.9), 0, below);
      const treeC = U.tree.mul(crown.mul(0.32).add(0.82)).mul(fbm(vec2(x.mul(1.4), y.mul(1.4)).div(cw)).mul(0.3).add(0.85));
      const st = vnoise(vec2(x.mul(140), y.mul(9)));
      const meadowC = mix(U.moss.mul(0.8), U.straw.mul(0.85), vnoise(vec2(x.mul(0.4), a.y)).mul(0.6).add(st.mul(0.4))).mul(smoothstep(0.35, 0.0, below).mul(0.25).add(0.85)).toVar();
      const fc = vec2(x.mul(30), y.mul(30)), fh = hash12(floor(fc));
      const speck = step(0.965, fh).mul(smoothstep(0.42, 0.1, length(fract(fc).sub(0.5)))).mul(smoothstep(0.02, 0.12, y));
      meadowC.assign(mix(meadowC, mix(C('#C9A35B'), C('#E6DCC6'), step(0.985, fh)).mul(S.dimN.mul(0.9).add(0.1)), speck.mul(0.7)));
      const col = hillC.mul(isHill).add(treeC.mul(isTree)).add(meadowC.mul(isMeadow)).toVar();
      col.assign(mix(col, U.fog, b.z.mul(U.haze).mul(1.25).min(1)));
      // ground mist: the woods rise out of it
      col.assign(mix(col, U.fog.mul(1.03), exp(max(y, 0.0).div(b.w).negate()).mul(U.mist).mul(0.85)));
      // light scattered in the wet air toward the sun (strongest at dusk and in the sunbreak)
      const sd = max(dot(normalize(positionWorld.sub(cameraPosition)), U.sunDir), 0.0);
      col.assign(mix(col, U.glow.mul(1.05), pow(sd, 6).mul(U.sunVis).mul(b.z.mul(0.8).add(0.25)).min(0.6)));
      col.addAssign(U.glow.mul(U2.beam).mul(0.12));
      return vec4(col, alpha);
    })();
    m.colorNode = farCol.xyz; m.opacityNode = farCol.w;
    const far = new THREE.Mesh(quadGeo(layers, ['a', 'b']), m); far.frustumCulled = false; far.renderOrder = -5; scene.add(far);

    /* soft mist banks drifting across the meadow and at the foot of the woods */
    const mm = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false }); mm.fog = false;
    const mist = [
      { z: -27, y1: 3.2, y0: -0.5, a: [1.7, 0.035, 0.6, 1] },
      { z: -15, y1: 2.2, y0: -0.5, a: [0.9, 0.05, 0.5, 2] },
      { z: -7.5, y1: 1.2, y0: -0.3, a: [0.42, 0.08, 0.38, 3] }
    ];
    mm.colorNode = Fn(() => {
      const d = normalize(positionWorld.sub(cameraPosition));
      const sd = max(dot(d, U.sunDir), 0);
      return U.fog.mul(1.04).add(U.glow.mul(pow(sd, 6).mul(0.3)).mul(U.sunVis.add(U2.beam.mul(0.5)))).add(C('#F0C97A').mul(pow(max(dot(d, U2.winDir), 0), 300).mul(0.25)).mul(U.win));
    })();
    mm.opacityNode = Fn(() => {
      const a = attribute('a', 'vec4'), p = positionWorld;
      const n = fbm(vec2(p.x.mul(a.y).add(uTime.mul(0.012)).add(a.w.mul(7)), p.y.mul(0.9).div(a.x).sub(uTime.mul(0.004))));
      const band = exp(max(p.y, 0.0).div(a.x).negate());
      return smoothstep(0.3, 0.75, n).mul(0.6).add(0.4).mul(band).mul(a.z).mul(U.mist).mul(smoothstep(-0.25, 0.05, p.y));
    })();
    const mistMesh = new THREE.Mesh(quadGeo(mist, ['a']), mm); mistMesh.frustumCulled = false; mistMesh.renderOrder = -4; scene.add(mistMesh);
  }

  /* ---------- the fallen leaf and its beetle ---------- */
  function buildLeaf() {
    const s = new THREE.Shape(), len = 0.12, w = 0.038;
    s.moveTo(-len / 2 - 0.016, -0.0012); s.lineTo(-len / 2, -0.0012);                     // the stem
    s.bezierCurveTo(-len * 0.42, -w * 1.25, len * 0.12, -w * 1.15, len / 2, 0);            // one side, wide near the stem
    s.bezierCurveTo(len * 0.1, w * 0.95, -len * 0.4, w * 1.2, -len / 2, 0.0012);
    s.lineTo(-len / 2 - 0.016, 0.0012); s.lineTo(-len / 2 - 0.016, -0.0012);
    const g = new THREE.ShapeGeometry(s, 16), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i), x = p.getX(i); p.setZ(i, 0.05 * (y * y) / w + 0.004 * Math.sin(x * 40)); }   // the edges curl up
    g.rotateX(-Math.PI / 2);
    const m = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide }); m.fog = false;
    m.colorNode = Fn(() => {
      const p = positionGeometry;                                     // x along the leaf, z across
      const c = mix(C('#B08050'), C('#8A5C40'), fbm(p.xz.mul(70))).toVar();
      c.assign(mix(c, C('#C9A35B'), smoothstep(0.55, 0.8, fbm(p.xz.mul(30).add(2.0))).mul(0.45)));   // a yellowing patch
      c.assign(mix(c, C('#6B4E3D'), smoothstep(0.55, 1.0, abs(p.z).div(0.038)).mul(0.6)));   // darker, wetter edges
      const rib = exp(abs(p.z).div(0.0011).negate());
      const vein = exp(abs(fract(p.x.sub(abs(p.z).mul(1.1)).mul(70)).sub(0.5)).div(0.06).negate()).mul(smoothstep(0.004, 0.012, abs(p.z)));
      c.assign(mix(c, C('#D9A383'), rib.mul(0.5)));
      c.assign(mix(c, C('#8A5C40'), vein.mul(0.4)));
      return c.mul(S.dimN).add(U.hor.mul(0.025));
    })();
    leafMesh = new THREE.Mesh(g, m); leafMesh.position.set(len / 2, 0, 0); S.leafLen = len;
    leafPivot = new THREE.Group(); leafPivot.rotation.order = 'YXZ'; leafPivot.add(leafMesh); scene.add(leafPivot);
    // beetle: a small dark shell with a bronze sheen, six legs
    beetle = new THREE.Group();
    const shellM = new THREE.MeshBasicNodeMaterial(); shellM.fog = false;
    shellM.colorNode = Fn(() => {
      const V = normalize(cameraPosition.sub(positionWorld)), N = normalize(normalWorld);
      const fr = pow(max(dot(N, V), 0).oneMinus(), 2);
      return mix(C('#1A1610'), C('#4E5A34'), fr).add(U.hor.mul(pow(max(N.y, 0), 8).mul(0.18)))     .mul(S.dimN.add(0.08));
    })();
    const legM = new THREE.MeshBasicMaterial({ color: 0x14100C });
    const body = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), shellM); body.scale.set(0.0075, 0.0042, 0.0055); body.position.y = 0.0045;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.0026, 10, 8), legM); head.position.set(0.0078, 0.0035, 0);
    beetle.add(body, head);
    const legs = [];
    for (let i = 0; i < 6; i++) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.0008, 0.0008, 0.007), legM); l.position.set(-0.004 + (i % 3) * 0.004, 0.002, (i < 3 ? 1 : -1) * 0.004); beetle.add(l); legs.push(l); }
    beetle.userData.legs = legs; beetle.visible = false; beetle.scale.setScalar(1.4); scene.add(beetle);
  }
  const LF = { state: 'rest', t0: 0, lift: 0, from: new THREE.Vector3(), to: new THREE.Vector3() };
  function touchLeaf() {
    if (LF.state !== 'rest') return;
    LF.state = 'lift'; LF.t0 = E.clock;
    sound.play('scratch', tmpV.set(L.leaf.x, 0, L.leaf.z), 0.6);
    focusOn(tmpV.set(L.leaf.x, 0, L.leaf.z), 2.5);
  }
  function updateLeaf(dt, t) {
    const e = t - LF.t0;
    // the timeline: lift 1 s, walk out 2.6 s, rest 1.6 s, walk back 2.6 s, lower 1.2 s
    let lift = 0, walk = 0;
    if (LF.state === 'rest') lift = 0;
    else if (e < 1) lift = easeIO(e);
    else if (e < 8.2) lift = 1;
    else if (e < 9.4) lift = 1 - easeIO((e - 8.2) / 1.2);
    else LF.state = 'rest';
    if (LF.state !== 'rest') {
      if (e < 1) walk = 0;
      else if (e < 3.6) walk = easeIO((e - 1) / 2.6);
      else if (e < 5.2) walk = 1;
      else if (e < 7.8) walk = 1 - easeIO((e - 5.2) / 2.6);
      if (e > 6.6 && LF.state === 'lift' && !LF.scr2) { LF.scr2 = true; sound.play('scratch', tmpV.set(L.leaf.x, 0, L.leaf.z), 0.35); }
      if (e < 1) LF.scr2 = false;
    }
    leafPivot.rotation.z = 0.32 * lift + Math.sin(t * 0.5) * 0.004;      // the far end lifts like a lid
    leafPivot.rotation.x = 0.16;
    beetle.visible = LF.state !== 'rest' && e > 0.8 && e < 8.2;
    if (beetle.visible) {
      const w = walk;
      tmpV.lerpVectors(LF.from, LF.to, w);
      tmpV.x += Math.sin(w * Math.PI) * 0.012;
      const moving = (e > 1 && e < 3.6) || (e > 5.2 && e < 7.8);
      beetle.position.copy(tmpV);
      const dx = LF.to.x - LF.from.x, dz = LF.to.z - LF.from.z, out = e < 5.2;
      beetle.rotation.y = Math.atan2(-(out ? dz : -dz), out ? dx : -dx) + Math.cos(w * Math.PI) * 0.3;
      beetle.userData.legs.forEach((l, i) => { l.rotation.y = moving ? Math.sin(t * 22 + i * 2.1) * 0.5 : 0; });
    }
  }

  /* ---------- the snail on the stone ----------
     One body mesh bent in the vertex stage (stretch, foot wave, head lift / turn / nibble, sliding into the shell),
     the shell, two eye stalks and two short feelers. It wanders over the stone (and now and then down onto the wet
     ground in front), leaves a glistening slime trail that dries over a minute or so, withdraws on a tap, and crawls
     toward a finger held still near it. All positions are kept relative to the stone, so a resize keeps it on top. */
  const SNS = 1.25;                                    // model scale
  const SN_HEAD = 0.021 * SNS;                         // centre to the head, world units
  const TRAIL_N = 240, TRAIL_STEP = 0.0016;
  let stoneBumps = [], SNU = null, snShell = null, snFeelers = [], trail = null, trailBorn = null, trailIdx = 0;
  const snA = new THREE.Vector3(), snB = new THREE.Vector3(), snQ = new THREE.Quaternion(), snE = new THREE.Euler(0, 0, 0, 'YZX'), snM = new THREE.Matrix4(), snS = new THREE.Vector3();
  const snRay = new THREE.Raycaster(), snNdc = new THREE.Vector2(), snPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), snHit = new THREE.Vector3();
  const wrapA = (a) => { while (a > Math.PI) a -= 6.2832; while (a < -Math.PI) a += 6.2832; return a; };
  // the stone's surface, from the same shape as its geometry (relative to the stone's centre)
  function stoneRho(rx, rz) {
    const nx = rx / 0.08, nz = rz / 0.058, a = Math.atan2(nz, nx); let k = 1;
    for (let i = 0; i < stoneBumps.length; i++) k += stoneBumps[i][1] * Math.sin(a * 2 + stoneBumps[i][0]);
    return Math.hypot(nx, nz) / k;
  }
  function surfH(rx, rz) { const r = stoneRho(rx, rz); if (r >= 1) return 0; const yy = Math.sqrt(1 - r * r); return 0.004 + 0.026 * yy * (0.55 + 0.45 * yy); }
  // height and tilt of a snail standing at (rx, rz) facing th; writes the orientation into q, returns the height
  function poseAt(rx, rz, th, q, wob = 0) {
    const ch = Math.cos(th), sh = -Math.sin(th), HL = 0.019, W = 0.006;
    const hF = surfH(rx + ch * HL, rz + sh * HL), hB = surfH(rx - ch * HL, rz - sh * HL), hM = surfH(rx, rz);
    const hP = surfH(rx + Math.sin(th) * W, rz + Math.cos(th) * W), hN = surfH(rx - Math.sin(th) * W, rz - Math.cos(th) * W);
    SN.pitchT = Math.atan2(hF - hB, 2 * HL); SN.rollT = Math.atan2(hN - hP, 2 * W);
    if (q) { snE.set(SN.rollT + wob, th, SN.pitchT, 'YZX'); q.setFromEuler(snE); }
    return Math.max(hM, (hF + hB) / 2);
  }
  // the body bend, on the CPU (same as the vertex shader), for placing the stalks on the head
  function bendBody(px, py, pz, out) {
    const u = px, r = lerp(0.3, 1, smooth(-0.0235, -0.004, u)) * lerp(1, 0.8, smooth(0.014, 0.0235, u));
    let y = py * r; const z0 = pz * r, lower = smooth(0.0003, -0.0025, y);
    y = y < 0 ? y * 0.55 : y * 0.95;
    const s = smooth(0.003, 0.0235, u), s2 = s * s;
    let x = u * SNU.str.value; y += 0.0036 + s2 * (SNU.lift.value * 0.0085 - SNU.nib.value * 0.0055); let z = z0 * (0.92 + lower * 0.22) + s2 * SNU.yaw.value * 0.014;
    const ex = SNU.ext.value, xs = Math.max(x - (1 - ex) * 0.029, lerp(-0.03, -0.012, 1 - ex)), ins = smooth(0.009, -0.002, xs) * (1 - ex), sq = 1 - 0.55 * ins;
    return out.set(xs, 0.011 + (y - 0.011) * sq, z * sq);
  }
  function buildSnail() {
    snail = new THREE.Group(); snail.rotation.order = 'YZX';
    SNU = { ext: uniform(1), go: uniform(0), phase: uniform(0), lift: uniform(0.55), nib: uniform(0), yaw: uniform(0), str: uniform(1) };
    // wet skin: grey-brown, finely tuberculate, a paler foot fringe, a warm translucent edge and a sky sheen
    const skinCol = (body) => Fn(() => {
      const N = normalize(normalWorld), V = normalize(cameraPosition.sub(positionWorld)), p = positionGeometry;
      const c = mix(C('#3A362C'), C('#867C68'), smoothstep(-0.4, 0.9, N.y)).toVar();
      c.mulAssign(vnoise(p.xz.mul(vec2(1300, 1900)).add(p.y.mul(900))).mul(0.4).add(0.78));
      if (body) c.assign(mix(c, C('#A89C84'), smoothstep(-0.0008, -0.0042, p.y).mul(0.5)));
      c.mulAssign(S.dimN);
      const fr = pow(max(dot(N, V), 0).oneMinus(), 2.2);
      c.addAssign(C('#BCA27E').mul(fr).mul(0.22).mul(S.dimN.add(0.1)));
      const R = reflect(V.negate(), N);
      c.addAssign(mix(U.hor, U.top, smoothstep(0, 0.5, R.y)).mul(pow(max(dot(N, V), 0).oneMinus(), 3.5)).mul(smoothstep(-0.3, 0.6, N.y)).mul(0.5).mul(S.dimN.mul(0.6).add(0.4)));
      c.addAssign(U.beadCol.mul(pow(max(dot(R, normalize(vec3(0.3, 1, 0.4))), 0), 60)).mul(0.45).mul(S.dimN.mul(0.8).add(0.12)));
      c.addAssign(C('#F0C97A').mul(pow(max(dot(R, U2.winDir), 0), 50).mul(0.25)).mul(U.win));
      return c;
    })();
    const bodyM = new THREE.MeshBasicNodeMaterial(); bodyM.fog = false;
    bodyM.positionNode = Fn(() => {
      const p = positionGeometry, u = p.x;
      const r = mix(0.3, 1, smoothstep(-0.0235, -0.004, u)).mul(mix(1, 0.8, smoothstep(0.014, 0.0235, u)));
      const y0 = p.y.mul(r), lower = smoothstep(0.0003, -0.0025, y0);
      const y = select(y0.lessThan(0), y0.mul(0.55), y0.mul(0.95)).toVar();
      y.addAssign(sin(u.mul(720).sub(SNU.phase)).mul(0.00024).mul(SNU.go).mul(lower));              // pedal waves along the foot
      const s = smoothstep(0.003, 0.0235, u), s2 = s.mul(s);
      y.addAssign(s2.mul(SNU.lift.mul(0.0085).sub(SNU.nib.mul(0.0055))).add(0.0036));
      const z = p.z.mul(r).mul(lower.mul(0.22).add(0.92)).add(s2.mul(SNU.yaw).mul(0.014));
      const ex = SNU.ext, xs = max(u.mul(SNU.str).sub(ex.oneMinus().mul(0.029)), mix(float(-0.03), float(-0.012), ex.oneMinus()));
      const sq = smoothstep(0.009, -0.002, xs).mul(ex.oneMinus()).mul(-0.55).add(1);                 // squeezed as it slides into the shell
      return vec3(xs, y.sub(0.011).mul(sq).add(0.011), z.mul(sq));
    })();
    bodyM.colorNode = skinCol(true);
    const bg = new THREE.CapsuleGeometry(0.0066, 0.034, 6, 16); bg.rotateZ(Math.PI / 2);
    const body = new THREE.Mesh(bg, bodyM);
    const shellM = new THREE.MeshBasicNodeMaterial(); shellM.fog = false;
    shellM.colorNode = Fn(() => {
      const p = positionGeometry, r = length(p.xy), a = atan2(p.y, p.x);
      const sp = fract(a.div(6.2832).add(TSL.log(r.add(0.08)).mul(1.7)));
      const band = smoothstep(0.05, 0.15, sp).mul(smoothstep(0.62, 0.5, sp));
      const c = mix(C('#4E3626'), C('#9A7450'), band).toVar();
      c.mulAssign(vnoise(vec2(a.mul(60), r.mul(24))).mul(0.22).add(0.86));                          // growth lines
      c.assign(mix(c, mix(c, C('#B39A72'), 0.35), smoothstep(0.75, 0.95, vnoise(vec2(a.mul(9), r.mul(5)))).mul(0.6)));   // pale flecks
      c.assign(mix(c, C('#33251C'), smoothstep(0.35, 0.05, r)));
      const N = normalize(normalWorld), V = normalize(cameraPosition.sub(positionWorld)), R = reflect(V.negate(), N);
      c.mulAssign(smoothstep(-0.7, 0.9, N.y).mul(0.5).add(0.58).mul(pow(max(dot(N, V), 0), 0.35).mul(0.35).add(0.65)));   // rounded: lit from the sky above, darker at the rim
      c.mulAssign(S.dimN);
      c.addAssign(U.hor.mul(pow(max(dot(R, vec3(0, 1, 0)), 0), 8).mul(0.12)).mul(S.dimN.mul(0.6).add(0.4)));
      c.addAssign(U.beadCol.mul(pow(max(dot(R, normalize(vec3(0.3, 1, 0.4))), 0), 40)).mul(0.35).mul(S.dimN.mul(0.8).add(0.12)));
      return c;
    })();
    snShell = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), shellM);
    snShell.scale.set(0.0138, 0.0138, 0.0102); snShell.position.set(-0.004, 0.0158, 0);
    snail.add(body, snShell);
    const stalkM = new THREE.MeshBasicNodeMaterial(); stalkM.fog = false; stalkM.colorNode = skinCol(false);
    const eyeM = new THREE.MeshBasicMaterial({ color: 0x15110D });
    const stalks = [];
    for (const s of [-1, 1]) {
      const g = new THREE.Group();
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.00048, 0.0008, 0.013, 6), stalkM); st.position.y = 0.0065;
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.00085, 8, 6), stalkM); bulb.position.y = 0.0131;
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.00055, 6, 5), eyeM); eye.position.set(0.0004, 0.0134, 0);
      g.add(st, bulb, eye); g.userData.s = s; snail.add(g); stalks.push(g);
      const f = new THREE.Group(), fm = new THREE.Mesh(new THREE.CylinderGeometry(0.00035, 0.0006, 0.0042, 5), stalkM); fm.position.y = 0.0021;
      f.add(fm); f.userData.s = s; snail.add(f); snFeelers.push(f);
    }
    snail.userData.stalks = stalks; snail.scale.setScalar(SNS); scene.add(snail);
    // the slime trail: soft flat stamps laid along the path, glistening while wet, drying away over about a minute
    const tg = new THREE.PlaneGeometry(1, 1); tg.rotateX(-Math.PI / 2);
    trailBorn = new THREE.InstancedBufferAttribute(new Float32Array(TRAIL_N).fill(-9999), 1); tg.setAttribute('aBorn', trailBorn);
    const tm = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false }); tm.fog = false;
    const age = uTime.sub(attribute('aBorn', 'float')), wet = smoothstep(70, 4, age);
    tm.colorNode = Fn(() => {
      const V = normalize(cameraPosition.sub(positionWorld));
      const glint = pow(vnoise(positionWorld.xz.mul(1900).add(V.xz.mul(70))), 8).mul(2.2).mul(wet);
      const sky = mix(U.hor, U.beadCol, 0.35).mul(S.dimN.mul(0.75).add(0.2));
      return sky.mul(glint.add(0.75)).add(C('#F0C97A').mul(pow(max(dot(reflect(V.negate(), vec3(0, 1, 0)), U2.winDir), 0), 30).mul(0.3)).mul(U.win));
    })();
    tm.opacityNode = Fn(() => {
      const q = uv(), along = abs(q.x.mul(2).sub(1)).oneMinus(), across = smoothstep(0.5, 0.15, abs(q.y.sub(0.5)));
      return along.mul(across).mul(smoothstep(0, 1.5, age)).mul(smoothstep(150, 20, age)).mul(wet.mul(0.6).add(0.4)).mul(0.2);
    })();
    trail = new THREE.InstancedMesh(tg, tm, TRAIL_N); trail.frustumCulled = false; trail.renderOrder = 1;
    tmpM.makeScale(0, 0, 0); for (let i = 0; i < TRAIL_N; i++) trail.setMatrixAt(i, tmpM);
    scene.add(trail);
  }
  const SN = { state: 'out', t0: -99, mode: 'pause', mt0: 0, dur: 2, nibble: false, k: 1, ext: 1, from: 1, fromE: 1, hide: 5, peeked: true,
    x: 0.014, z: 0.004, th: 3.0, tx: 0, tz: 0, go: 0, phase: 0, lift: 0.55, nib: 0, hy: 0, tw: 0, y: 0.03, pitch: 0, roll: 0, pitchT: 0, rollT: 0,
    lureT: -99, lx: 0, lz: 0, focusT: -99, sniff: false, sniffT: 0, dropNext: 9, lastX: 0.014, lastZ: 0.004, seeded: false, stoneX: null, stoneZ: 0, wob: 0 };
  function setMode(m, t, dur = 0, nibble = false) { SN.mode = m; SN.mt0 = t; SN.dur = dur; SN.nibble = nibble; SN.sniff = false; }
  function touchSnail(kind = 'tap') {
    if (SN.state === 'in') return;
    SN.state = 'in'; SN.t0 = E.clock; SN.from = SN.k; SN.fromE = SN.ext;
    SN.hide = kind === 'shy' ? rand(3, 3.8) : rand(4.4, 5.4);
    sound.play('wetRustle', snail.position, kind === 'shy' ? 0.16 : 0.22);
    if (kind === 'tap') haptic(6);
    focusOn(snail.position, 2.5);
  }
  function pickTarget() {
    const onGround = stoneRho(SN.x, SN.z) > 1;
    for (let i = 0; i < 10; i++) {
      let rx, rz;
      if (!onGround && Math.random() < 0.22) {                         // now and then down onto the wet ground in front of the stone
        const a = rand(0.18, 0.82) * Math.PI, r = rand(1.12, 1.3);
        rx = Math.cos(a) * r * 0.08; rz = Math.sin(a) * r * 0.058;
        if (stoneRho(rx, rz) < 1.06) continue;
      } else { const a = rand(0, 6.28), r = Math.sqrt(Math.random()) * 0.6; rx = Math.cos(a) * r * 0.08; rz = Math.sin(a) * r * 0.058; }
      if (Math.hypot(rx - SN.x, rz - SN.z) < 0.022) continue;
      const s = toScreen(snA.set(L.stone.x + rx, surfH(rx, rz), L.stone.z + rz));
      if (!s.front || s.x < innerWidth * 0.08 || s.x > innerWidth * 0.92 || s.y < innerHeight * 0.1 || s.y > innerHeight * 0.9) continue;
      SN.tx = rx; SN.tz = rz; return;
    }
    SN.tx = rand(-0.02, 0.02); SN.tz = rand(-0.008, 0.008);
  }
  function stampTrail(born, wx, y, wz, q) {
    tmpS.set(TRAIL_STEP * 2.1, 1, 0.0095);
    snM.compose(snB.set(wx, y + 0.0004, wz), q, tmpS);
    trail.setMatrixAt(trailIdx, snM); trailBorn.array[trailIdx] = born;
    trailIdx = (trailIdx + 1) % TRAIL_N;
    trail.instanceMatrix.needsUpdate = true; trailBorn.needsUpdate = true;
  }
  function seedTrail() {                                               // a faint trail behind it, as if it had been crawling a while
    let x = SN.x, z = SN.z, th = SN.th;
    for (let i = 1; i <= 80; i++) {
      th += 0.02 * Math.sin(i * 0.06 + 0.5);
      x -= Math.cos(th) * TRAIL_STEP; z += Math.sin(th) * TRAIL_STEP;
      if (stoneRho(x, z) > 0.78) break;
      const y = poseAt(x, z, th, snQ);
      stampTrail(E.clock - i * 0.62, L.stone.x + x, y, L.stone.z + z, snQ);
    }
  }
  function snailMoved() {                                              // the stone moved (resize): carry the trail with it
    if (SN.stoneX === null) { SN.stoneX = L.stone.x; SN.stoneZ = L.stone.z; return; }
    const dx = L.stone.x - SN.stoneX, dz = L.stone.z - SN.stoneZ; SN.stoneX = L.stone.x; SN.stoneZ = L.stone.z;
    if (!dx && !dz) return;
    const a = trail.instanceMatrix.array;
    for (let i = 0; i < TRAIL_N; i++) { a[i * 16 + 12] += dx; a[i * 16 + 14] += dz; }
    trail.instanceMatrix.needsUpdate = true;
  }
  // the pointer as a point on the stone's plane, relative to the stone (no allocation)
  function lureAt(x, y) {
    snNdc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1);
    snRay.setFromCamera(snNdc, E.camera);
    let rx = 0, rz = 0, h = 0;
    for (let i = 0; i < 3; i++) {                                      // the ground, or the top of the stone under the finger
      snPlane.constant = -h;
      if (!snRay.ray.intersectPlane(snPlane, snHit)) return false;
      rx = snHit.x - L.stone.x; rz = snHit.z - L.stone.z; h = surfH(rx, rz);
    }
    const n = Math.hypot(rx / 0.08, rz / 0.058); if (n > 2.1) { rx *= 2.1 / n; rz *= 2.1 / n; }
    SN.lx = rx; SN.lz = rz; SN.lureT = E.clock;
    return true;
  }
  const snailR = () => clamp1(innerWidth * 0.07, 44, 60);              // generous tap radius, in pixels
  function snailScreenDist(x, y) { const s = toScreen(snA.copy(snail.position).setY(snail.position.y + 0.013 * SNS)); return s.front ? Math.hypot(s.x - x, s.y - y) : 1e9; }
  function updateSnail(dt, t) {
    const e = t - SN.t0;
    if (!SN.seeded) { SN.seeded = true; seedTrail(); }
    let goT = 0, liftT = 0.55, nibT = 0, yawT = 0, spd = 0.0028, turn = 0.35, tx = SN.tx, tz = SN.tz, steer = false;
    SN.wob = 0;
    if (SN.state === 'in') {                                           // stalks first, then the body slides in; the shell settles with a tiny wobble
      SN.k = lerp(SN.from, 0, easeIO(clamp1(e / 0.55, 0, 1)));
      SN.ext = lerp(SN.fromE, 0, easeIO(clamp1((e - 0.08) / 1.0, 0, 1)));
      const w = e - 0.95; if (w > 0) SN.wob = Math.sin(w * 10) * 0.07 * Math.exp(-w * 2.6);
      if (e > 1.1 + SN.hide) { SN.state = 'coming'; SN.t0 = t; SN.peeked = false; }
    } else if (SN.state === 'coming') {                                // the head first, then the stalks with a hesitation, then the body
      SN.ext = e < 3.9 ? 0.72 * easeIO(clamp1(e / 1.6, 0, 1)) : lerp(0.72, 1, easeIO(clamp1((e - 3.9) / 2.1, 0, 1)));
      SN.k = e < 0.9 ? 0 : e < 2.8 ? 0.55 * easeIO((e - 0.9) / 1.9) : e < 3.6 ? 0.55 : lerp(0.55, 1, easeIO(clamp1((e - 3.6) / 1.4, 0, 1)));
      yawT = e > 2.8 && e < 3.6 ? Math.sin((e - 2.8) * 4) * 0.4 : 0; liftT = 0.75;
      if (e > 0.9 && !SN.peeked) { SN.peeked = true; sound.play('drip', snail.position, 0.15, { freq: 990 }); }
      if (e > 6) { SN.state = 'out'; setMode('pause', t, 2); }
    } else {
      const lured = t - SN.lureT < 0.3, me = t - SN.mt0;
      if (lured && SN.mode !== 'lured') { setMode('lured', t); if (t - SN.focusT > 5) { SN.focusT = t; focusOn(snail.position, 2.5); } }
      else if (!lured && SN.mode === 'lured') setMode('pause', t, rand(2, 3.5));
      if (SN.mode === 'crawl') {
        goT = 1; steer = true;
        if (Math.hypot(tx - SN.x, tz - SN.z) < 0.006) setMode('pause', t, rand(3, 7), Math.random() < 0.5);
      } else if (SN.mode === 'pause') {
        yawT = Math.sin(t * 0.45 + 1.3) * 0.6 * smooth(0.5, 2, me);   // looks about
        if (SN.nibble && me > 1 && me < SN.dur - 0.8) { nibT = 0.85 + Math.sin(t * 3.1) * 0.15; liftT = 0.1; yawT *= 0.3; }   // grazes the lichen
        if (me > SN.dur) { pickTarget(); setMode('crawl', t); }
      } else if (SN.mode === 'lured') {                               // it noticed the finger: turns toward it, then crawls over
        tx = SN.lx; tz = SN.lz; spd = 0.015; turn = 0.75; liftT = 0.85; steer = true;
        const dh = Math.hypot(tx - SN.x - Math.cos(SN.th) * SN_HEAD, tz - SN.z + Math.sin(SN.th) * SN_HEAD);
        yawT = clamp1(wrapA(Math.atan2(-(tz - SN.z), tx - SN.x) - SN.th) * 0.8, -1, 1);
        if (SN.sniff ? dh > 0.016 : dh < 0.008) { SN.sniff = !SN.sniff; SN.sniffT = t + 2.2; }
        goT = me < 0.9 || SN.sniff ? 0 : 1;
        if (SN.sniff) { liftT = 1; if (t > SN.sniffT) { SN.tw = Math.max(SN.tw, 0.9); SN.sniffT = t + rand(4, 6); } }   // stalks touch the finger, flinch
      }
    }
    // glide
    const k1 = Math.min(1, dt * 0.9);
    SN.go += (goT - SN.go) * k1;
    if (steer) {
      const d = wrapA(Math.atan2(-(tz - SN.z), tx - SN.x) - SN.th);
      SN.th += clamp1(d, -turn * dt, turn * dt) * (0.25 + 0.75 * SN.go);
      if (SN.mode === 'crawl') SN.th += Math.sin(t * 0.21 + 2) * 0.05 * dt * SN.go;
      const v = spd * SN.go * (0.4 + 0.6 * Math.max(0, Math.cos(d))) * (1 + 0.12 * Math.sin(SN.phase * 0.35));
      SN.x += Math.cos(SN.th) * v * dt; SN.z -= Math.sin(SN.th) * v * dt;
      const lim = SN.mode === 'lured' ? 2.15 : 1.36, n = Math.hypot(SN.x / 0.08, SN.z / 0.058); if (n > lim) { SN.x *= lim / n; SN.z *= lim / n; }
    }
    SN.phase += dt * 6 * SN.go;
    SN.lift += (liftT - SN.lift) * Math.min(1, dt * 1.5);
    SN.nib += (nibT - SN.nib) * Math.min(1, dt * 2.5);
    SN.hy += (yawT - SN.hy) * Math.min(1, dt * 1.6);
    SN.tw *= Math.exp(-dt * 1.8);
    // a raindrop lands close by now and then: the stalks twitch
    if (t > SN.dropNext) {
      SN.dropNext = t + rand(6, 16) / Math.max(0.25, S._rainEff);
      if (SN.state !== 'in') {
        const a = rand(0, 6.28), r = rand(0.012, 0.022), hx = snail.position.x + Math.cos(SN.th) * SN_HEAD, hz = snail.position.z - Math.sin(SN.th) * SN_HEAD;
        splash.add({ x: hx + Math.cos(a) * r, y: snail.position.y + 0.003, z: hz + Math.sin(a) * r, life: 0.6, s: 0.8 });
        for (let i = 0; i < 3; i++) { const b = rand(0, 6.28); spray.add({ x: hx + Math.cos(a) * r, y: snail.position.y + 0.003, z: hz + Math.sin(a) * r, vx: Math.cos(b) * 0.05, vy: rand(0.12, 0.2), vz: Math.sin(b) * 0.05, life: 0.6 }); }
        SN.tw = Math.max(SN.tw, 0.55);
      }
    }
    // pose on the stone
    const y = poseAt(SN.x, SN.z, SN.th, null), kp = Math.min(1, dt * 4);
    SN.y += (y - SN.y) * kp; SN.pitch += (SN.pitchT - SN.pitch) * kp; SN.roll += (SN.rollT - SN.roll) * kp;
    snail.position.set(L.stone.x + SN.x, SN.y, L.stone.z + SN.z);
    snail.rotation.set(SN.roll + SN.wob, SN.th, SN.pitch + SN.wob * 0.3);
    SNU.ext.value = SN.ext; SNU.go.value = SN.go; SNU.phase.value = SN.phase; SNU.lift.value = SN.lift; SNU.nib.value = SN.nib; SNU.yaw.value = SN.hy;
    SNU.str.value = 1 + 0.05 * SN.go + 0.035 * Math.sin(SN.phase * 0.35) * SN.go;            // the body stretches a little with each glide
    snShell.position.y = 0.0158 - (1 - SN.ext) * 0.004;
    snShell.rotation.set(Math.sin(SN.phase * 0.35) * 0.025 * SN.go, 0, -0.12 + SN.wob * 0.5);
    // stalks and feelers on the head
    const kk = SN.k * (1 - 0.6 * SN.tw), vis = SN.ext > 0.12;
    for (let i = 0; i < 2; i++) {
      const g = snail.userData.stalks[i], s = g.userData.s;
      bendBody(0.0192, 0.0058, s * 0.0024, g.position);
      g.scale.set(1, Math.max(0.04, kk), 1); g.visible = vis;
      g.rotation.set(s * 0.3 + Math.sin(t * 0.9 + i * 2) * 0.06 * SN.k, SN.hy * 0.5, -0.5 - SN.lift * 0.15 + SN.nib * 0.35 + Math.sin(t * 0.7 + i) * 0.08 * SN.k);
    }
    for (let i = 0; i < 2; i++) {
      const f = snFeelers[i], s = f.userData.s;
      bendBody(0.0228, 0.0012, s * 0.0026, f.position);
      f.scale.set(1, Math.max(0.05, Math.min(1, SN.ext * 1.3 - 0.3) * (1 - 0.4 * SN.tw)), 1); f.visible = vis;
      f.rotation.set(s * 0.5, SN.hy * 0.4, -1.75 + SN.nib * 0.4 + Math.sin(t * 1.3 + i * 1.7) * 0.12 * SN.go);
    }
    // the slime trail
    if (SN.ext > 0.9 && Math.hypot(SN.x - SN.lastX, SN.z - SN.lastZ) > TRAIL_STEP) {
      SN.lastX = SN.x; SN.lastZ = SN.z;
      stampTrail(t, snail.position.x, SN.y, snail.position.z, snail.quaternion);
    }
  }

  /* ---------- the spider web between two dry stalks ---------- */
  function buildWeb() {
    webMat = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide }); webMat.fog = false;
    const R = 0.066;
    const seg = Fn(([p, a, b]) => {
      const pa = p.sub(a), ba = b.sub(a);
      const h = clamp(dot(pa, ba).div(dot(ba, ba)), 0, 1);
      return length(pa.sub(ba.mul(h)));
    }).setLayout({ name: 'rainSegDist', type: 'float', inputs: [{ name: 'p', type: 'vec2' }, { name: 'a', type: 'vec2' }, { name: 'b', type: 'vec2' }] });
    webMat.positionNode = Fn(() => {
      const p = positionGeometry, r = length(p.xy);
      const w = smoothstep(0.09, 0.0, r);
      const tr = sin(uTime.mul(19).add(r.mul(80))).mul(U2.tremble).mul(0.006).add(sin(uTime.mul(1.3).add(p.x.mul(30))).mul(0.0008));
      return p.add(vec3(0, tr.mul(0.4), tr).mul(w));
    })();
    const webField = Fn(() => {
      const p = positionGeometry.xy, r = length(p), a = atan2(p.y, p.x);
      const lw = 0.0011;
      const NS = 17;
      const ds = abs(fract(a.div(6.2832).mul(NS).add(0.5)).sub(0.5)).mul(6.2832 / NS).mul(r);
      const spokes = exp(ds.div(lw).pow(2).negate()).mul(step(r, R)).mul(smoothstep(0.003, 0.008, r)).mul(0.8);
      const sp = 0.0074;
      const rs = r.add(a.div(6.2832).mul(sp));
      const dr = abs(fract(rs.div(sp)).sub(0.5)).mul(sp);
      const rings = exp(dr.div(lw * 0.8).pow(2).negate()).mul(smoothstep(R, R - 0.004, r)).mul(smoothstep(0.011, 0.016, r)).mul(0.6);
      const hub = exp(abs(r.sub(0.009)).div(lw).pow(2).negate());
      const anc = min(min(seg(p, vec2(-0.058, 0.03), vec2(-0.09, 0.075)), seg(p, vec2(0.06, 0.026), vec2(0.09, 0.06))),
        min(seg(p, vec2(-0.05, -0.042), vec2(-0.09, -0.085)), min(seg(p, vec2(0.052, -0.04), vec2(0.09, -0.09)), seg(p, vec2(-0.02, 0.063), vec2(-0.09, 0.115)))));
      const anchors = exp(anc.div(lw).pow(2).negate());
      // beads along the spiral
      const k = floor(rs.div(sp));
      const M = k.mul(1.6).add(10).floor();
      const cellA = a.div(6.2832).mul(M);
      const id = floor(cellA);
      const hb = hash12(vec2(k, id));
      const da = abs(fract(cellA).sub(0.5)).mul(6.2832).div(M).mul(r);
      const bd = length(vec2(da, dr));
      const br = hb.mul(0.0012).add(0.0011);
      const beads = smoothstep(br, br.mul(0.35), bd).mul(step(0.62, hb)).mul(smoothstep(R, R - 0.004, r)).mul(smoothstep(0.012, 0.018, r));
      return vec2(max(max(spokes, rings), max(hub, anchors)), beads);
    })();
    webMat.colorNode = Fn(() => {
      const thread = U.beadCol.mul(U.light.mul(0.65).add(0.12));
      const bead = U.beadCol.mul(U.light.mul(0.75).add(0.1)).mul(U2.shine.mul(1.3).add(1.0)).add(C('#C9A35B').mul(U.bead).mul(0.06));
      return mix(thread, bead, webField.y);
    })();
    webMat.opacityNode = max(webField.x.mul(0.32), webField.y.mul(0.85)).mul(U.light.mul(0.45).add(0.55));
    web = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.23, 16, 16), webMat); web.renderOrder = 2; scene.add(web);
  }
  const WB = { t0: -99 };
  function touchWeb() {
    WB.t0 = E.clock;
    sound.play('chime', web.position, 0.5);
    focusOn(web.position, 2.5);
    for (let i = 0; i < 6; i++) {
      const a = rand(0, 6.28), r = rand(0.015, 0.06);
      fall.add({ x: web.position.x + Math.cos(a) * r, y: web.position.y + Math.sin(a) * r, z: web.position.z, vx: 0, vy: -rand(0, 0.05), life: 3, });
    }
  }
  function updateWeb(dt, t) {
    const e = t - WB.t0;
    U2.tremble.value = e < 0 ? 0 : Math.exp(-e * 1.4) * smooth(0, 0.08, e);
    U2.shine.value = e < 0 ? 0 : smooth(0, 0.6, e) * (1 - smooth(1.5, 3.5, e));           // shine rises and fades over seconds, never flashes
  }

  /* ---------- catch a drop: it gathers on the tip, swells, falls in slow motion, a crown rises ---------- */
  function catchDrop(bi) {
    const c = catches.find((k) => k.state === 'idle') || catches[0];
    c.state = 'gather'; c.t0 = E.clock; c.blade = bi; c.m.visible = true;
    const fillIdx = tips.indexOf(bi); if (fillIdx >= 0) B.fill[bi] = 0;
    tipOf(bi, 0.985, tmpV);
    sound.play('note', tmpV, 1, { index: 7 + Math.floor(rand(0, 3)) });   // SPEC: one clear high piano note
    haptic(10);
    focusOn(tmpV, 2.5);
  }
  function crownAt(p) {
    const cr = crowns.find((k) => !k.on) || crowns[0];
    cr.on = true; cr.t0 = E.clock; cr.m.position.copy(p); cr.m.visible = true;
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * 6.28 + rand(-0.2, 0.2), v = rand(0.05, 0.09);
      spray.add({ x: p.x + Math.cos(a) * 0.006, y: 0.006, z: p.z + Math.sin(a) * 0.006, vx: Math.cos(a) * v, vy: rand(0.2, 0.3), vz: Math.sin(a) * v, life: rand(0.75, 1.0) });
    }
    if (inPuddle(p.x, p.z, 1)) ripple(p.x, p.z, 1.2);
    sound.play('drip', p, 0.35, { freq: 1320 });
  }
  function updateCatches(dt, t) {
    for (const c of catches) {
      if (c.state === 'idle') continue;
      const e = t - c.t0;
      if (c.state === 'gather') {
        tipOf(c.blade, 0.985, c.from);
        const g = easeOut(clamp1(e / 1.4, 0, 1)), sw = smooth(1.4, 2.0, e);
        const r = 0.0015 + g * 0.0036 + sw * 0.0009;
        c.m.scale.set(r, r * (1 + sw * 0.35), r);
        c.m.position.copy(c.from); c.m.position.y -= r * (0.6 + sw * 0.5);
        if (e > 2.0) { c.state = 'fall'; c.t0 = t; c.from.copy(c.m.position); c.land.set(c.from.x, 0.003, c.from.z); }
      } else if (c.state === 'fall') {
        const T = 1.6, f = clamp1(e / T, 0, 1);                             // slow motion
        c.m.position.lerpVectors(c.from, c.land, f * f);
        const r = 0.0055; c.m.scale.set(r * 0.92, r * (1.15 + 0.15 * f), r * 0.92);
        if (f >= 1) { c.state = 'idle'; c.m.visible = false; crownAt(c.land); }
      }
    }
    for (const cr of crowns) {
      if (!cr.on) continue;
      const e = t - cr.t0, f = clamp1(e / 1.1, 0, 1);
      const rad = 0.003 + easeOut(f) * 0.015, h = Math.sin(Math.min(1, f * 1.6) * Math.PI) * 0.011;
      cr.m.scale.set(rad, Math.max(0.0005, h), rad); cr.m.position.y = h / 2;
      cr.op.value = 0.75 * smooth(0, 0.06, e) * (1 - smooth(0.35, 1, f));
      if (f >= 1) { cr.on = false; cr.m.visible = false; }
    }
  }

  /* ---------- layout (depends on the view width) ---------- */
  function layout() {
    for (let i = 0; i < B.n; i++) {
      let x = placeX(B.u[i], B.d[i]), z = -B.d[i];
      if (B.kind[i] === 3) { x = L.web.x + B.stalk[i] * 0.092; z = L.web.z - 0.004; }
      if (B.kind[i] === 0 || B.kind[i] === 1) {                   // keep the near blades from hiding the leaf, the stone and the web (in screen terms)
        let u = B.u[i]; const d = B.d[i];
        for (const [o, size] of [[L.leaf, 0.07], [L.stone, 0.085], [L.web, 0.1]]) {
          const Ru = Math.min(0.05 + size / (VW * o.d), 0.3);
          if (Math.abs(u - o.u) < Ru && d < o.d + 0.08 && (d > o.d - 0.45 || B.h[i] > 0.12)) u = o.u + (u >= 0 ? 1 : -1) * Ru * 1.02;
        }
        x = placeX(u, d);
        if (inPuddle(x, z, 1.1)) x = L.puddle.x + Math.sign(x - L.puddle.x || 1) * L.puddle.rx * 1.15;
      }
      if (B.kind[i] === 2 && inPuddle(x, z, 1.15)) z -= 0.4;
      B.x[i] = x; B.y[i] = 0; B.z[i] = z;
      bladeAttr.base.setXYZ(i, x, 0, z);
    }
    bladeAttr.base.needsUpdate = true;
    flowers.forEach((bi, k) => fAttr.base.setXYZ(k, B.x[bi], 0, B.z[bi])); fAttr.base.needsUpdate = true;
    // clover
    const c = S.clovers;
    c.forEach((p, i) => {
      const x = L.clover.x + p.dx * 0.1 * Math.min(1, VW / 0.6 + 0.25), z = L.clover.z + p.dz * 0.05;
      for (let k = 0; k < 3; k++) {
        tmpE.set(0, p.rot + k * 2.094, p.tilt, 'YZX');
        tmpQ.setFromEuler(tmpE); tmpS.setScalar(p.s);
        tmpM.compose(tmpV.set(x, p.h, z), tmpQ, tmpS); cloverMesh.setMatrixAt(i * 3 + k, tmpM);
      }
    });
    cloverMesh.instanceMatrix.needsUpdate = true;
  }
  function place() {
    for (const k of ['puddle', 'leaf', 'stone', 'clover', 'web']) { const o = L[k]; o.x = placeX(o.u, o.d); o.z = -o.d; }
    const pk = clamp1(VW / 0.74, 0.62, 1);
    L.puddle.rx = 0.3 * pk; L.puddle.rz = 0.15;
    puddle.position.set(L.puddle.x, 0.002, L.puddle.z); puddle.scale.set(L.puddle.rx, L.puddle.rz, 1);
    S.rim.position.set(L.puddle.x, 0.001, L.puddle.z); S.rim.scale.set(L.puddle.rx * 1.25, L.puddle.rz * 1.45, 1);
    stone.position.set(L.stone.x, 0.004, L.stone.z); snailMoved();
    U2.stoneP.value.set(L.stone.x, L.stone.z); U2.leafP.value.set(L.leaf.x, L.leaf.z); U2.cloverP.value.set(L.clover.x, L.clover.z);
    S.leafAt = new THREE.Vector3(L.leaf.x, 0.004, L.leaf.z);
    const ax = Math.cos(L.leaf.yaw), az = -Math.sin(L.leaf.yaw), hl = S.leafLen / 2;
    leafPivot.position.set(L.leaf.x - ax * hl, 0.008, L.leaf.z - az * hl); leafPivot.rotation.y = L.leaf.yaw;
    // the beetle walks out from under the lifted end, toward the viewer
    LF.from.set(L.leaf.x + ax * hl * 0.5, 0.001, L.leaf.z + az * hl * 0.5); LF.to.set(L.leaf.x + ax * hl * 1.25, 0.001, L.leaf.z + az * hl * 1.25 + 0.05);
    web.position.set(L.web.x, L.web.y, L.web.z); web.rotation.y = 0.12;
    // the far tree line dips where the house stands, so its window can be seen
    L.house.x = L.house.u * VW * -L.house.z;
    const hx = L.house.x;
    U2.houseX.value = hx; U2.houseU.value = hx / 120;
    L.house.y = hillTop(hx, hx) - 0.45;
    house.position.set(hx, L.house.y, -119.5);
    houseWin.position.set(hx + 0.62, L.house.y + 1.12, -119.2);
    houseGlow.position.copy(houseWin.position);
    U2.winDir.value.copy(houseWin.position).sub(new THREE.Vector3(0, camY, 0)).normalize();
  }

  /* ---------- grass under the finger ---------- */
  function pushBlades(x0, y0, x1, y1) {
    const dx = x1 - x0, dy = y1 - y0, len2 = dx * dx + dy * dy; if (len2 < 4) return null;
    const R = Math.max(38, innerWidth * 0.045);
    let hits = 0; const at = tmpV2.set(0, 0, 0);
    for (const i of push) {
      tmpV.set(B.x[i], B.h[i] * 0.6, B.z[i]);
      const s = toScreen(tmpV); if (!s.front) continue;
      const t = clamp1(((s.x - x0) * dx + (s.y - y0) * dy) / len2, 0, 1);
      const dist = Math.hypot(x0 + dx * t - s.x, y0 + dy * t - s.y);
      if (dist < R) {
        const k = (1 - dist / R) * clamp1(dx / 50, -1.2, 1.2) * (B.kind[i] === 0 ? 1 : 1.3);
        B.vel[i] += k * 1.6; hits++; at.add(tmpV);
        if (Math.abs(k) > 0.18) {                                       // SPEC: drops fall from the tips
          if (B.fill[i] > 0.5) { tipOf(i, 0.98, tmpV); B.fill[i] = 0; fall.add({ x: tmpV.x, y: tmpV.y, z: tmpV.z, vx: k * 0.05, vy: 0, life: 3 }); }
          else if (Math.random() < 0.12) { tipOf(i, 0.98, tmpV); fall.add({ x: tmpV.x, y: tmpV.y, z: tmpV.z, vx: k * 0.05, vy: 0, life: 3 }); }
        }
      }
    }
    return hits ? { hits, at: at.multiplyScalar(1 / hits) } : null;
  }
  let bladesMoving = true;
  function updateBlades(dt) {
    const sdt = Math.min(dt, 1 / 30), arr = bladeAttr.bend.array;
    let moving = false;
    for (const i of push) {
      if (B.vel[i] === 0 && B.bend[i] === 0) continue;
      B.vel[i] += (-6.5 * B.bend[i] - 3.2 * B.vel[i]) * sdt;          // SPEC: spring back over about 2 s
      B.bend[i] = clamp1(B.bend[i] + B.vel[i] * sdt, -0.6, 0.6);
      if (Math.abs(B.bend[i]) < 1e-4 && Math.abs(B.vel[i]) < 1e-4) { B.bend[i] = 0; B.vel[i] = 0; }
      arr[i] = B.bend[i]; moving = true;
    }
    if (moving || bladesMoving) { bladeAttr.bend.needsUpdate = true; const fb = fAttr.bend.array; for (let k = 0; k < flowers.length; k++) fb[k] = B.bend[flowers[k]]; fAttr.bend.needsUpdate = true; }
    bladesMoving = moving;
  }
  function updateBeads(dt) {
    const regrow = dt / 7 * (0.25 + 0.75 * S._rainEff);
    tips.forEach((bi, k) => {
      B.fill[bi] = Math.min(1, B.fill[bi] + regrow);
      const r = 0.0042 * Math.sqrt(Math.max(0.0001, B.fill[bi])) * (0.7 + 0.3 * B.tint[bi]);
      tipOf(bi, 0.975, tmpV); tmpV.y -= r * 0.7;
      tmpS.set(r, r * 1.12, r); tmpM.compose(tmpV, tmpQ.identity(), tmpS); beadMesh.setMatrixAt(k, tmpM);
    });
    beadMesh.instanceMatrix.needsUpdate = true;
  }
  function pickTip(x, y) {
    let best = -1, bd = Math.max(30, innerWidth * 0.035);
    for (const i of near) {
      tipOf(i, 0.985, tmpV); const s = toScreen(tmpV); if (!s.front) continue;
      const d = Math.hypot(s.x - x, s.y - y); if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  /* ---------- rain amount: hold to soften; the hidden sunbreak ---------- */
  const RN = { level: 1, target: 1, holding: false, from: 1, t0: 0, dur: 1 };
  function rainTo(v) { if (v === RN.target) return; RN.from = RN.level; RN.target = v; RN.t0 = E.clock; RN.dur = v < RN.level ? 4 : 6; }
  const BRK = { state: 'idle', t0: 0, v: 0, need: 180, swelled: false };
  function startBreak() { if (BRK.state !== 'idle') return; BRK.state = 'clearing'; BRK.t0 = E.clock; BRK.swelled = false; }
  function updateRain(dt, t, info) {
    // SPEC: thins to a drizzle over 4 s; returns over 6 s after release
    RN.level = lerp(RN.from, RN.target, easeIO(clamp1((t - RN.t0) / RN.dur, 0, 1)));
    if (info.active && !info.resting && BRK.state === 'idle' && info.still > BRK.need) startBreak();
    if (BRK.state === 'idle' && info.still < 1) BRK.need = 180;
    const e = t - BRK.t0;
    if (BRK.state === 'clearing') { BRK.v = smooth(0, 12, e); if (e > 12) { BRK.state = 'clear'; BRK.t0 = t; } }
    else if (BRK.state === 'clear') { BRK.v = 1; if (e > 32) { BRK.state = 'returning'; BRK.t0 = t; } }
    else if (BRK.state === 'returning') { BRK.v = 1 - smooth(0, 16, e); if (e > 16) { BRK.state = 'idle'; BRK.v = 0; BRK.need = info.still + 300; } }
    const eff = RN.level * (1 - BRK.v);
    S._rainEff = eff;
    U2.rain.value = 0.04 + 0.96 * eff;
    U2.brk.value = BRK.v;
    const beamUp = BRK.state === 'clear' ? smooth(0, 6, e) : BRK.state === 'returning' ? 1 - smooth(0, 9, e) : 0;
    U2.beam.value = beamUp * (1 - env.night * 0.75);
    if (beamUp > 0.6 && !BRK.swelled) { BRK.swelled = true; sound.swell(['A3', 'C#4', 'E4']); }
    // steam rises from the grass while the sun is out
    if (beamUp > 0.15 && Math.random() < dt * 5 * beamUp) {
      const d = rand(0.5, 3.2), u = rand(-1, 1);
      steam.add({ x: placeX(u, d), y: rand(0.01, 0.06), z: -d, life: rand(8, 12), ph: rand(0, 6), k: 1 - env.night * 0.6, s: 1 });
    }
    // tiny splashes on the near ground, as many as the rain
    S._spl = (S._spl || 0) + dt * 26 * eff;
    while (S._spl > 1) {
      S._spl -= 1;
      const d = rand(0.32, 2.6), u = rand(-1.1, 1.1), x = placeX(u, d), z = -d;
      if (!inPuddle(x, z, 1)) splash.add({ x, y: 0.004, z, life: rand(0.5, 0.7), s: 1 });
    }
  }

  /* ---------- sound: hiss, near patter, a low soft layer; single drips when the rain thins ---------- */
  let soundNext = 0, dripNext = 0;
  function updateSound(t, info) {
    if (t > soundNext && S.layers) {
      soundNext = t + 0.3;
      const eff = S._rainEff;
      try {
        S.layers.hiss.gain.gain.rampTo((S.layers.hiss.isLoop ? 0.55 : 0.15) * (0.12 + 0.88 * eff), 0.6);
        S.layers.patter.forEach((l) => l.gain.gain.rampTo(rand(0.03, 0.085) * (l.isLoop ? 5 : 1) * (0.1 + 0.9 * eff), rand(0.3, 0.9)));
      } catch (e) {}
    }
    if (info.active && !info.resting && S._rainEff < 0.62 && t > dripNext) {      // SPEC: single drips become clear
      const notes = [880, 988, 1109, 1319, 1480, 1760];
      const r = Math.random();
      if (r < 0.4) { const a = rand(0, 6.28), k = Math.sqrt(Math.random()) * 0.7; const x = L.puddle.x + Math.cos(a) * L.puddle.rx * k, z = L.puddle.z + Math.sin(a) * L.puddle.rz * k; ripple(x, z, 0.6); sound.play('drip', tmpV.set(x, 0, z), 0.5, { freq: notes[Math.floor(rand(0, notes.length))] }); }
      else { const d = rand(0.4, 1.4), u = rand(-1, 1); sound.play('drip', tmpV.set(placeX(u, d), 0.1, -d), 0.42, { freq: notes[Math.floor(rand(0, notes.length))] }); }
      dripNext = t + rand(0.7, 2.2) * (0.4 + S._rainEff);
    }
  }

  /* ---------- gallery window art: 300 x 200, slow CSS motion ---------- */
  let artCache = null;
  function windowArt() {
    if (artCache) return artCache;
    const r = seeded(23), f = (v) => v.toFixed(1);
    const blade = (x, base, tip, lean, w) => { const my = (base + tip) / 2; return `M${f(x)} ${base} Q${f(x + lean * 0.3)} ${f(my)} ${f(x + lean)} ${f(tip)} Q${f(x + w + lean * 0.3)} ${f(my)} ${f(x + w)} ${base}Z`; };
    let far = '', mid = '', nearB = '', drops = '', rain = '';
    for (let i = 0; i < 40; i++) { const x = r() * 310 - 5; far += `<path d="${blade(x, 150, 92 + r() * 30, (r() - 0.5) * 12, 2.5 + r() * 2)}"/>`; }
    for (let i = 0; i < 26; i++) { const x = r() * 310 - 5; mid += `<path d="${blade(x, 215, 112 + r() * 40, (r() - 0.5) * 22, 3 + r() * 2)}"/>`; }
    for (let i = 0; i < 18; i++) {
      const side = i % 2 ? 1 : -1, x = side > 0 ? 250 + r() * 60 : -10 + r() * 80, tip = 60 + r() * 90, lean = (r() - 0.5) * 50 - side * 8;
      nearB += `<path class="rn-blade" d="${blade(x, 205, tip, lean, 4 + r() * 4)}"/>`;
      if (r() > 0.5) drops += `<circle cx="${f(x + lean + 1)}" cy="${f(tip + 3)}" r="${f(1.3 + r() * 1.1)}"/>`;
    }
    for (let i = 0; i < 46; i++) { const x = r() * 330 - 10, y = r() * 200; for (const [ox, oy] of [[0, 0], [8, -200]]) rain += `<line x1="${f(x + ox)}" y1="${f(y + oy)}" x2="${f(x + ox - 1.2)}" y2="${f(y + oy + 9)}"/>`; }
    let woods = '', flw = '';
    for (let i = 0; i < 36; i++) { const x = i * 9 - 6 + r() * 5, rr = 4.5 + r() * 5, y = 85 - r() * 7 - (i % 7 === 3 ? 6 : 0); if (Math.abs(x - 214) > 12) woods += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(rr)}" ry="${f(rr * (i % 7 === 3 ? 1.7 : 0.9))}"/>`; }
    const fc = ['#C9A35B', '#E6DCC6', '#A86E6A', '#7E5442', '#C9A35B'];
    for (let i = 0; i < 22; i++) { const x = r() * 300, y = 104 + r() * 30; flw += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(0.9 + r() * 0.9)}" fill="${fc[i % 5]}"/>`; }
    artCache = `<svg viewBox="0 0 300 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs>
      <linearGradient id="rn-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9A9884"/><stop offset=".42" stop-color="#C2BC9F"/><stop offset=".5" stop-color="#8E8E6A"/><stop offset=".75" stop-color="#5A5C3C"/><stop offset="1" stop-color="#2A2618"/></linearGradient>
      <linearGradient id="rn-bl" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#2E3220"/><stop offset=".7" stop-color="#6E7448"/><stop offset="1" stop-color="#A39A5C"/></linearGradient>
      <filter id="rn-far"><feGaussianBlur stdDeviation="2.4"/></filter>
      <filter id="rn-mid"><feGaussianBlur stdDeviation="1"/></filter>
      <filter id="rn-bok"><feGaussianBlur stdDeviation="4"/></filter>
    </defs>
    <style>
      .rn-rain { animation: rn-fall 2.6s linear infinite; }
      @keyframes rn-fall { from { transform: translate(0, 0); } to { transform: translate(-8px, 200px); } }
      .rn-blade { transform-box: fill-box; transform-origin: 50% 100%; animation: rn-sway 7s ease-in-out infinite alternate; }
      .rn-blade:nth-child(2n) { animation-duration: 8.5s; animation-delay: -2.4s; }
      .rn-blade:nth-child(3n) { animation-delay: -4.1s; }
      @keyframes rn-sway { from { transform: rotate(-1.2deg); } to { transform: rotate(1.4deg); } }
      .rn-ring { transform-box: fill-box; transform-origin: center; animation: rn-ring 3.2s ease-out infinite; }
      .rn-ring:nth-child(2) { animation-delay: -1.1s; } .rn-ring:nth-child(3) { animation-delay: -2.3s; }
      @keyframes rn-ring { 0% { transform: scale(.1); opacity: 0; } 15% { opacity: .6; } 100% { transform: scale(1.5); opacity: 0; } }
      @media (prefers-reduced-motion: reduce) { .rn-rain, .rn-blade, .rn-ring { animation: none; } }
    </style>
    <rect width="300" height="200" fill="url(#rn-bg)"/>
    <g filter="url(#rn-bok)" fill="#EFE3CF" opacity=".16"><circle cx="40" cy="30" r="10"/><circle cx="120" cy="18" r="7"/><circle cx="250" cy="40" r="12"/><circle cx="190" cy="60" r="6"/></g>
    <path d="M0 80 C60 74 110 78 150 76 S240 70 300 78 L300 92 L0 92Z" fill="#A3A08A" opacity=".55" filter="url(#rn-far)"/>
    <g fill="#888A72" opacity=".6" filter="url(#rn-mid)">${woods}<rect x="0" y="84" width="300" height="10"/></g>
    <path d="M207 86 L207 79.5 L213 75.5 L219 79.5 L219 86Z" fill="#8E8B78" opacity=".75"/><rect x="214.5" y="80.5" width="2" height="2.2" fill="#6E6A5E"/>
    <rect x="0" y="86" width="300" height="12" fill="#B4AE93" opacity=".55" filter="url(#rn-far)"/>
    <g filter="url(#rn-far)" fill="#7A7C56" opacity=".8">${far}</g>
    <g filter="url(#rn-mid)" fill="#6A6E43" opacity=".9">${mid}</g>
    <g opacity=".8" filter="url(#rn-mid)">${flw}</g>
    <ellipse cx="175" cy="150" rx="62" ry="11" fill="#4A4F45" opacity=".8"/>
    <ellipse cx="175" cy="148" rx="50" ry="6" fill="#C6C0A3" opacity=".45"/>
    <g fill="none" stroke="#EFE3CF" stroke-width=".7"><ellipse class="rn-ring" cx="160" cy="149" rx="14" ry="2.6"/><ellipse class="rn-ring" cx="195" cy="151" rx="11" ry="2"/><ellipse class="rn-ring" cx="178" cy="146" rx="9" ry="1.7"/></g>
    <path d="M62 168 C76 156 104 154 122 162 C106 172 82 176 62 168Z" fill="#B9805F"/>
    <path d="M64 167 C86 162 104 160 120 162" fill="none" stroke="#8A5C40" stroke-width=".8"/>
    <ellipse cx="216" cy="174" rx="24" ry="6" fill="#5A574C"/>
    <path d="M208 170 C206 165 214 162 220 164 L226 169Z" fill="#9A8E7E"/>
    <circle cx="214" cy="164" r="5" fill="#8A5C40"/>
    <path d="M214 164 m-3 0 a3 3 0 1 1 3 3" fill="none" stroke="#D9A383" stroke-width=".6" opacity=".8"/>
    <path d="M225 168 L228 162 M227 169 L231 164" stroke="#9A8E7E" stroke-width=".8" stroke-linecap="round"/>
    <g fill="url(#rn-bl)">${nearB}</g>
    <g fill="#F2EAD6" opacity=".8">${drops}</g>
    <g class="rn-rain" stroke="#EFE3CF" stroke-width=".6" stroke-linecap="round" opacity=".42">${rain}</g>
  </svg>`;
    return artCache;
  }

  const S = E.defineScene({
    id: 'rain', title: 'remembering rain', defaultHour: 0.22,
    describe: (h) => 'remembering rain, rain on grass at ' + hourName(h),
    hourName,
    key: { scale: ['A', 'B', 'C#', 'E', 'F#'], octave: 4,                // SPEC: A major pentatonic
      day: [['A2', 'E3', 'B3'], ['F#2', 'C#3', 'A3'], ['E2', 'B2', 'F#3'], ['A2', 'C#3', 'E3']],
      night: [['F#2', 'C#3', 'A3'], ['B2', 'F#3', 'A3'], ['C#3', 'E3', 'B3']] },
    camera: { x: 0, y: camY, z: 0, pitch: -5 * DEG },
    aperture: 0.004, maxblur: 0.016,                                      // a shallow focus: near blades sharp, the meadow soft
    focusFar: 3.2, focusMid: 1.0,
    _rainEff: 1,
    windowArt,
    build,
    applyHour(h) {
      sample(h);
      houseMat.color.copy(env.hill).lerp(env.fog, 0.15);
      // the window: a dark pane by day, warm and clear at night
      S.winCol.value.copy(env.hill).multiplyScalar(0.55).lerp(tmpC.setHex(0xF4C67C).multiplyScalar(1.5), smooth(0.02, 0.6, env.win));
      houseGlow.material.opacity = env.win * 0.5;
      houseGlow.scale.setScalar(lerp(3, 6.5, env.win));
      // the sunbreak opens the sky a little
      const b = U2.brk ? U2.brk.value : 0;
      if (b > 0) { U.sunVis.value = lerp(env.sunVis, Math.max(env.sunVis, 0.62 * (1 - env.night)), b); U.mist.value = env.mist * (1 - 0.45 * b); U.haze.value = env.haze * (1 - 0.3 * b); }
      fall.tint.value.copy(env.beadCol).multiplyScalar(lerp(0.7, 1.1, env.light));
      spray.tint.value.copy(env.beadCol).multiplyScalar(1.1);
      splash.tint.value.copy(env.rainCol).multiplyScalar(lerp(0.8, 1.1, env.light));
      steam.tint.value.copy(env.hor).lerp(env.glow, 0.5).multiplyScalar(1.15);
      bokeh.tint.value.copy(env.hor).lerp(env.rainCol, 0.5).multiplyScalar(lerp(0.5, 1.15, env.light));
    },
    resize(vw, aspect) {
      VW = vw; ASPECT = aspect;
      const half = Math.atan(vw / aspect);
      U2.halfW.value = vw * 1.25;
      U2.tanUp.value = Math.tan(half + 9 * DEG);
      U2.pix.value = 2 * (vw / aspect) / Math.max(200, innerHeight);
      place(); layout();
    },
    enter() { RN.level = RN.target = RN.from = 1; RN.holding = false; BRK.state = 'idle'; BRK.v = 0; BRK.need = 180; },
    leave() { rainTo(1); },
    update(dt, t, info) {
      updateRain(dt, t, info);
      updateBlades(dt); updateBeads(dt);
      updateCatches(dt, t); updateLeaf(dt, t); updateSnail(dt, t); updateWeb(dt, t);
      if (bokeh.items.length < 7 && Math.random() < dt * 0.3) bokeh.add({ x: rand(-0.12, 0.12), y: camY + rand(0.0, 0.1), z: -rand(0.22, 0.32), life: rand(18, 30), a: rand(0.025, 0.055), s: rand(0.7, 1.3) });
      fall.update(dt, t); splash.update(dt, t); spray.update(dt, t); steam.update(dt, t); bokeh.update(dt, t);
      updateSound(t, info);
    },
    skyBody() {                                                             // heavy cloud: the sun shows only at dusk or in the sunbreak
      if ((env.sunVis > 0.3 || BRK.v > 0.5) && env.sunEl > -1.5 && env.night < 0.3) return env.sunDir;
      return null;
    },
    focusNear() { return [snail.position, S.leafAt, web.position, puddle.position]; },
    pointerDown(p) {
      const { x, y } = p, R = Math.max(40, innerWidth * 0.045), Rs = snailR(), sd = snailScreenDist(x, y);
      if (sd < Rs) { touchSnail('tap'); return { type: 'none' }; }
      if (nearScreen(tmpV.set(L.leaf.x, 0.004, L.leaf.z), x, y, R)) { touchLeaf(); return { type: 'none' }; }
      if (nearScreen(web.position, x, y, R * 1.1)) { touchWeb(); return { type: 'none' }; }
      const g = { type: 'field', x0: x, y0: y, t0: E.clock, path: 0, fired: false, lastRustle: 0, lure: sd < Rs * 2.7, sd, spd: 0, px: x, py: y, mt: performance.now() / 1000 };
      const tip = pickTip(x, y);
      if (tip >= 0) { catchDrop(tip); g.tip = true; }
      if (!g.lure) E.holdCue.at(x, y);                                     // a finger held near the snail calls it over instead of softening the rain
      return g;
    },
    pointerMove(g, p, prev) {
      const pushed = pushBlades(prev.x, prev.y, p.x, p.y);
      if (pushed && E.clock - g.lastRustle > 0.18) {
        g.lastRustle = E.clock; sound.play('wetRustle', pushed.at, clamp1(pushed.hits / 10, 0.35, 1));   // SPEC: wet rustle, no haptic
        if (pushed.hits > 3) focusOn(pushed.at, 2.5);
      }
      g.path += Math.hypot(p.x - prev.x, p.y - prev.y);
      if (g.path > 16 && !g.fired) E.holdCue.hide();
      // the snail: a slow finger near it is followed, a quick one (or one that jabs right at it) sends it into the shell
      const Rs = snailR(), sd = snailScreenDist(p.x, p.y), now = performance.now() / 1000, mdt = Math.max(1 / 120, now - g.mt), sp = Math.hypot(p.x - prev.x, p.y - prev.y) / mdt;
      g.spd = lerp(g.spd || 0, sp, 0.35); g.mt = now; SN.spd = g.spd; g.px = p.x; g.py = p.y;
      if (sd < Rs * 2.7) {
        if (!g.lure) { g.lure = true; E.holdCue.hide(); }
        if (SN.state !== 'in' && (g.spd > Math.max(520, innerWidth * 1.15) || Math.hypot(p.x - prev.x, p.y - prev.y) > Math.max(26, Rs * 0.6) || (sd < Rs * 0.55 && g.sd >= Rs * 0.55 && sp > 150))) touchSnail('shy');
      }
      g.sd = sd;
    },
    pointerUp(g) {
      E.holdCue.hide();
      if (g.fired) { rainTo(1); RN.holding = false; }                  // the rain returns over 6 s
    },
    tick(g) {
      if (g.type === 'field' && g.lure) { if (g.sd < snailR() * 2.7 && SN.state === 'out') lureAt(g.px, g.py); return; }
      if (g.type !== 'field' || g.fired || g.path > 16) return;
      const held = E.clock - g.t0;
      if (held > 0.3) E.holdCue.show(clamp1((held - 0.3) / 1.7, 0, 1));
      if (held >= 2) { g.fired = true; E.holdCue.hide(); rainTo(0.18); RN.holding = true; dripNext = E.clock + 1.2; }   // SPEC: hold 2 s
    },
    bed() {
      const hiss = sound.loop('rain-steady', { gain: 0.55, fallback: { type: 'pink', filter: 'bandpass', freq: 3200, Q: 0.35, gain: 0.15, lfo: { freq: 0.05, min: 2500, max: 3900 } } });   // recorded rain (noise until the file loads)
      const patter = [[-0.5, 0.05, -0.7], [0.55, 0.05, -0.9]].map((p) => sound.loop('rain-patter', { gain: 0.3, pos: new THREE.Vector3(...p), fallback: { type: 'white', filter: 'bandpass', freq: rand(1700, 2300), Q: 1.1, gain: 0.06, pos: new THREE.Vector3(...p) } }));
      const low = sound.layer({ type: 'brown', filter: 'lowpass', freq: 380, Q: 0.2, gain: 0.05 });
      S.layers = { hiss, patter, low };
    },
    detail() {                                                              // SPEC: one near detail every 8 to 40 s
      const r = Math.random(), side = Math.random() < 0.5 ? -1 : 1;
      if (r < 0.4) sound.play('drip', tmpV.set(L.leaf.x, 0.02, L.leaf.z), 0.45, { freq: 1480 });
      else if (r < 0.7) { const x = L.puddle.x + rand(-0.5, 0.5) * L.puddle.rx, z = L.puddle.z + rand(-0.4, 0.4) * L.puddle.rz; ripple(x, z, 0.8); sound.play('drip', tmpV.set(x, 0, z), 0.5, { freq: 1109 }); }
      else sound.play('wetRustle', tmpV.set(side * rand(0.3, 0.8), 0.15, -rand(0.4, 1.2)), 0.4);
    },
    // test hooks
    debug: {
      tapTip(i = 0) { const bi = near[i % near.length]; catchDrop(bi); return bi; },
      tipScreen(k = 0) {                                                    // screen position of a near blade tip that is inside the frame
        const list = near.map((i) => { tipOf(i, 0.985, tmpV); const s = toScreen(tmpV); return { i, x: s.x, y: s.y, ok: s.front && s.x > 20 && s.x < innerWidth - 20 && s.y > 20 && s.y < innerHeight - 20 }; }).filter((o) => o.ok);
        return list[k % Math.max(1, list.length)] || null;
      },
      snail: () => touchSnail(), leaf: () => touchLeaf(), web: () => touchWeb(), clearSky: () => startBreak(),
      sunbreakNow() { BRK.state = 'clear'; BRK.t0 = E.clock - 6; BRK.v = 1; },          // jump straight into the open sky (for screenshots)
      drizzle(on) { rainTo(on ? 0.18 : 1); },
      screen(name) { const o = { snail: snA.copy(snail.position).setY(snail.position.y + 0.013 * SNS), snailHead: snB.set(0.021, 0.009, 0).applyMatrix4(snail.matrixWorld), leaf: tmpV2.set(L.leaf.x, 0.004, L.leaf.z), web: web.position, puddle: puddle.position }[name]; return toScreen(o); },
      ripple,
      state: () => ({ rain: +RN.level.toFixed(3), eff: +S._rainEff.toFixed(3), brk: BRK.state, brkV: +BRK.v.toFixed(2), snail: SN.state, stalk: +SN.k.toFixed(2), snailMode: SN.mode, spd: Math.round(SN.spd || 0), ext: +SN.ext.toFixed(2), sx: +SN.x.toFixed(4), sz: +SN.z.toFixed(4), sniff: SN.sniff, trail: trailBorn.array.filter((b) => E.clock - b < 150).length, leaf: LF.state, beetle: beetle.visible,
        tremble: +U2.tremble.value.toFixed(2), catches: catches.map((c) => c.state).join(','), crowns: crowns.filter((c) => c.on).length, fall: fall.items.length, spray: spray.items.length, steam: steam.items.length,
        bend: Math.max(...push.map((i) => Math.abs(B.bend[i]))).toFixed(3), hiss: S.layers ? +S.layers.hiss.gain.gain.value.toFixed(3) : null })
    }
  });
}

/* =====================================================================
   Scene: salt, smoke, and stars. A small fire in a ring of stones on a wide beach at night.
   Seated near the fire, looking out to a calm sea. Driftwood to the right, dunes with tall grass to the left.
   Uses only E (the engine) and calls E.defineScene(), like the lake.
   ===================================================================== */
{
  const { THREE, TSL, DEG, clamp1, lerp, smooth, easeIO, easeOut, rand, seeded, makeEnv, makeSky, ridge, GLOW, Pool, sound, haptic, hitPlaneY, toScreen, nearScreen, focusOn, uTime, vnoise, fbm, hash12 } = E;
  const { Fn, uniform, uniformArray, attribute, float, vec2, vec3, vec4, uv, positionWorld, positionGeometry, cameraPosition, normalWorld, screenUV,
    viewportSharedTexture, instanceIndex, mix, smoothstep, pow, exp, max, min, clamp, step, sin, abs, length, normalize, dot, reflect } = TSL;

  /* ---------- hours. Colours from the mood board (Fire.dc.html hour strips) and the identity palette ---------- */
  const STOPS = [
    { t: 0.00, top: '#6F7A7C', hor: '#D9C7AE', glow: '#E6CFAE', sun: '#F3E2C6', cloudCol: '#CFC2AE', fog: '#C9C0B0', sunEl: 1, sunAz: 2.5, moonEl: -12, moonAz: 0.42, star: 0.06, cloud: 0.3, mist: 0.55, sunVis: 0.5, day: 0.6,
      sand: '#7E6A55', sea: '#55696C', dune: '#6E5E4B', grass: '#4A4536', wood: '#8C7F70', stone: '#5E544A', head: '#A9A595' },
    { t: 0.25, top: '#9FB0AC', hor: '#D8CDBB', glow: '#EFE3CF', sun: '#FFF4DE', cloudCol: '#EFE6D6', fog: '#D6CDBD', sunEl: 40, sunAz: 1.2, moonEl: -20, moonAz: 0.42, star: 0, cloud: 0.5, mist: 0.08, sunVis: 1, day: 1,
      sand: '#A88C6C', sea: '#5E7F80', dune: '#A08868', grass: '#6E6A4A', wood: '#B7A994', stone: '#7A6E62', head: '#B3B7AA' },
    { t: 0.45, top: '#8E9E9C', hor: '#E2CFB0', glow: '#F2DDB6', sun: '#FBEBCB', cloudCol: '#EBD6B4', fog: '#D8C6A8', sunEl: 18, sunAz: 0.75, moonEl: -20, moonAz: 0.42, star: 0, cloud: 0.42, mist: 0.08, sunVis: 1, day: 0.95,
      sand: '#A08266', sea: '#557273', dune: '#94795C', grass: '#66603F', wood: '#AE9E88', stone: '#74685C', head: '#AFAA98' },
    { t: 0.60, top: '#5B4B48', hor: '#E8B48A', glow: '#E0A070', sun: '#F6E2C0', cloudCol: '#D9A383', fog: '#C99A7A', sunEl: 5, sunAz: 0.42, moonEl: -16, moonAz: 0.42, star: 0, cloud: 0.45, mist: 0.15, sunVis: 1, day: 0.72,
      sand: '#8A6A50', sea: '#4A5556', dune: '#6E5040', grass: '#4A3A2C', wood: '#8E7562', stone: '#5A4A40', head: '#8E7466' },
    { t: 0.72, top: '#2E2C3E', hor: '#D99A70', glow: '#E8B48A', sun: '#F0C29A', cloudCol: '#8A5A48', fog: '#7A5848', sunEl: -1.5, sunAz: 0.3, moonEl: -6, moonAz: 0.42, star: 0.35, cloud: 0.4, mist: 0.12, sunVis: 0.7, day: 0.3,
      sand: '#4A3A2E', sea: '#2F3638', dune: '#3A2C24', grass: '#241B16', wood: '#4E4036', stone: '#33291F', head: '#6A4C40' },
    { t: 0.86, top: '#0C0D0E', hor: '#1E2729', glow: '#2B3739', sun: '#333333', cloudCol: '#1A2223', fog: '#151A1C', sunEl: -14, sunAz: 0.1, moonEl: 3, moonAz: 0.42, star: 0.85, cloud: 0.1, mist: 0.1, sunVis: 0, day: 0.04,
      sand: '#2A2119', sea: '#141C1E', dune: '#151110', grass: '#0E0B09', wood: '#2A231D', stone: '#1C1712', head: '#1B2224' },
    { t: 1.00, top: '#090808', hor: '#151A1C', glow: '#1F2B2D', sun: '#222222', cloudCol: '#141A1B', fog: '#121617', sunEl: -22, sunAz: 0, moonEl: 11, moonAz: 0.42, star: 1, cloud: 0.06, mist: 0.08, sunVis: 0, day: 0,
      sand: '#221B15', sea: '#0F1416', dune: '#110D0B', grass: '#0B0908', wood: '#231D18', stone: '#18130F', head: '#151B1C' }
  ];
  const hourName = (h) => h < 0.12 ? 'dawn' : h < 0.38 ? 'midday' : h < 0.52 ? 'afternoon' : h < 0.65 ? 'golden hour' : h < 0.8 ? 'dusk' : h < 0.93 ? 'night' : 'deep night';

  const CAMP = { x: 0, y: 0.8, z: 6, pitch: -3 * DEG };
  const FIRE = new THREE.Vector3(-0.15, 0, 2.6);           // the centre of the stone ring
  const FIRE_SND = new THREE.Vector3(-0.15, 0.3, 2.6);
  const SH0 = -2.6;                                         // the waterline at x = 0
  const shoreZ = (x) => SH0 + 0.35 * Math.sin(x * 0.23 + 0.6) + 0.12 * Math.sin(x * 0.71 + 2.0);
  const SEA_SND = new THREE.Vector3(0, 0, SH0 - 2.5);
  const col = (hex) => new THREE.Color(hex);
  const FIRECOL = col('#E0A456'), EMBER = col('#C2552A'), GOLD = col('#C9A35B'), PAPER = col('#EFE3CF'), TIDE = col('#5E7F80');
  const SMOKE_N = col('#25292B'), SMOKE_D = col('#A49E96');
  const NOTES_HI = ['F4', 'G4', 'A4', 'C5', 'D5', 'F5', 'G5', 'A5', 'C6'];   // F major pentatonic, rising (the engine's noteName wraps C and D low)

  // module state, filled by build()
  let scene, env, U, sample, VW = 0.73;
  let fireU, fireR, flameU, coalU, shimU, windU, glowU, headMat;
  let flame, glowSprite, shimmer, duneMesh, grassAttr, grassGeo, pileMesh, dragLog, sparks, smoke, stars, trail, lineGeo, lineBorn, linePos;
  const PILE = new THREE.Vector3(0.85, 0, 3.7);
  const burning = [];                                        // logs added to the fire
  const fire = { level: 1, target: 1, boost: 0, lastLog: 0, coalBoost: 0, sparkAcc: 0, smokeAcc: 0, crackles: [], nextCrackle: 0, nextHiss: 0 };
  const NW = 4;
  const waves = Array.from({ length: NW }, () => new THREE.Vector4(-999, 0, 0, 0));
  let waveIdx = 0, waveArr, nextAutoWave = 0;
  const pileSegV = Array.from({ length: 7 }, () => new THREE.Vector4(99, 99, 99, 99.1));
  let pileSegs, printsU;
  const pileCU = uniform(new THREE.Vector2(0.85, 3.7));
  const NFP = 14, printV = Array.from({ length: NFP }, () => new THREE.Vector4(99, 99, 0, 0));
  const STAR_N = 110, MAXSEG = 90;
  const starList = [];
  let segIdx = 0;
  const shoot = { on: false, t0: 0, dur: 2.8, a: new THREE.Vector3(), b: new THREE.Vector3(), armedAt: 90, done: false };
  const drag = { on: false, state: 'idle', target: new THREE.Vector3(), from: new THREE.Vector3(), t0: 0, over: false };
  const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3(), tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler(), tmpS = new THREE.Vector3();
  const dirAzEl = (az, el, out) => out.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
  const wind = (t) => 0.2 + 0.1 * Math.sin(t * 0.031) + 0.05 * Math.sin(t * 0.11 + 1.0);

  /* ---------- shared TSL pieces ---------- */
  const shoreFn = Fn(([x]) => float(SH0).add(sin(x.mul(0.23).add(0.6)).mul(0.35)).add(sin(x.mul(0.71).add(2.0)).mul(0.12)))
    .setLayout({ name: 'fireShore', type: 'float', inputs: [{ name: 'x', type: 'float' }] });
  // warm light from the fire on a surface at p with normal n. Inlined (no setLayout): a layout function cannot read uniforms in r170 WGSL.
  const fireLit = (p, n) => {
    const d = fireU.xyz.sub(p);
    const dist = length(d).max(0.05);
    const ndl = max(dot(n, d.div(dist)), 0).mul(0.75).add(0.25);
    const fall = fireU.w.div(dist.mul(dist).mul(fireR.y).add(1));
    return vec3(FIRECOL.r, FIRECOL.g, FIRECOL.b).mul(fall).mul(ndl);
  };
  const C3 = (c) => vec3(c.r, c.g, c.b);

  /* ---------- the sky: soft gradient, sun and moon light, perspective clouds, three layers of stars and a Milky Way ---------- */
  function makeFireSky() {
    // the Milky Way lies on a great circle that rises from the lower left (its bright, warm core near the horizon) to the upper right
    const mwA = dirAzEl(-40 * DEG, -2 * DEG, new THREE.Vector3()), mwB = dirAzEl(32 * DEG, 25 * DEG, new THREE.Vector3());
    const nB = new THREE.Vector3().crossVectors(mwA, mwB).normalize(), t2v = new THREE.Vector3().crossVectors(nB, mwA).normalize();
    const V3 = (v) => vec3(v.x, v.y, v.z);
    const NB = V3(nB), T1 = V3(mwA), T2 = V3(t2v);
    const mat = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide, depthWrite: false }); mat.fog = false;
    const starLayer = (sc, dens, rad, seed) => {
      const cell = TSL.floor(sc), h = hash12(cell.add(seed));
      const off = vec2(hash12(cell.add(seed + 3.1)), hash12(cell.add(seed + 7.7))).mul(0.6).add(0.2);
      const sd = length(TSL.fract(sc).sub(off));
      const tw = sin(uTime.mul(h.mul(0.6).add(0.3)).add(h.mul(40))).mul(0.3).add(0.7);   // slow: well under one cycle a second
      return vec2(smoothstep(dens, 1, h).mul(exp(sd.mul(sd).div(-rad * rad))).mul(tw), h);
    };
    mat.colorNode = Fn(() => {
      const d = normalize(positionWorld.sub(cameraPosition));
      const el = d.y, az = TSL.atan2(d.x, d.z.negate()), t = uTime;
      const col = mix(U.hor, U.top, pow(smoothstep(-0.02, 0.55, el), 0.62)).toVar();
      // sun: a wide warm haze, a tighter glow and the disc
      const sd = max(dot(d, U.sunDir), 0);
      col.addAssign(U.glow.mul(pow(sd, 5).mul(0.14).add(pow(sd, 24).mul(0.28)).add(pow(sd, 300).mul(0.6))).mul(U.sunVis));
      const above = smoothstep(-0.004, 0.006, el);
      col.assign(mix(col, U.sun.mul(2.4), smoothstep(0.99955, 0.99975, sd).mul(above).mul(U.sunVis)));
      // moon: a soft halo and a disc with faint grey seas
      const md = max(dot(d, U.moonDir), 0);
      const MC = vec3(0.6, 0.66, 0.67);
      col.addAssign(MC.mul(pow(md, 10).mul(0.028).add(pow(md, 80).mul(0.14)).add(pow(md, 1500).mul(0.35))).mul(U.moon));
      const mq = d.sub(U.moonDir).mul(64);
      const maria = smoothstep(0.42, 0.72, vnoise(mq.xy.mul(1.3).add(vec2(mq.z, 3.7)))).mul(0.22);
      col.assign(mix(col, vec3(1.7, 1.72, 1.64).mul(maria.oneMinus()), smoothstep(0.99985, 0.99991, md).mul(above).mul(U.moon)));
      // night sky: the Milky Way band, its dust lane, and star layers that thicken inside it
      TSL.If(U.star.greaterThan(0.004), () => {
        const vb = dot(d, NB), ub = TSL.atan2(dot(d, T2), dot(d, T1));
        const coreK = exp(ub.mul(ub).mul(-2.2));
        const wid = coreK.mul(0.08).add(0.12);
        const band = exp(vb.mul(vb).div(wid.mul(wid)).negate());
        const clumps = fbm(vec2(ub.mul(4.5), vb.mul(13)).add(1.3));
        const fineM = vnoise(vec2(ub.mul(26), vb.mul(60)).add(7.1));
        const laneC = vb.sub(fbm(vec2(ub.mul(2.6), 4.2)).sub(0.5).mul(0.07)).sub(0.012);
        const laneW = coreK.mul(0.016).add(0.013);
        const lane = exp(laneC.mul(laneC).div(laneW.mul(laneW)).negate()).mul(smoothstep(0.3, 0.6, fbm(vec2(ub.mul(7), vb.mul(20)).add(5.5))));
        const mw = band.mul(clumps.mul(1.1).add(0.2)).mul(fineM.mul(0.5).add(0.75)).mul(lane.mul(0.55).oneMinus()).mul(coreK.mul(1.1).add(0.55));
        const mwCol = mix(vec3(0.5, 0.56, 0.6), vec3(0.95, 0.8, 0.62), coreK.mul(0.8));
        const skyVis = smoothstep(0.0, 0.2, el).mul(U.star);
        col.addAssign(mwCol.mul(mw).mul(skyVis).mul(0.075));
        const sp = vec2(az, TSL.asin(clamp(el, -1, 1)));
        const s1 = starLayer(sp.mul(150), float(0.955).sub(band.mul(0.09)), 0.16, 0);
        const s0 = starLayer(sp.mul(260), float(0.99).sub(band.mul(0.2)), 0.2, 41);
        const s2 = starLayer(sp.mul(80), float(0.975), 0.13, 11);
        const s3 = starLayer(sp.mul(36), float(0.988), 0.075, 23);
        const tint = (h) => mix(vec3(1.0, 0.86, 0.7), vec3(0.82, 0.9, 1.0), h);
        const stars = tint(s0.y).mul(s0.x).mul(band).mul(0.45).add(tint(s1.y).mul(s1.x).mul(0.55)).add(tint(s2.y).mul(s2.x).mul(1.0)).add(tint(s3.y).mul(s3.x).mul(2.0));
        col.addAssign(stars.mul(skyVis).mul(smoothstep(0.02, 0.22, el)).mul(mw.mul(0.5).add(1)));
      });
      // clouds on a flat layer, seen in perspective (smaller and flatter toward the horizon), lit from the sun or the moon
      TSL.If(el.greaterThan(0.012).and(el.lessThan(0.85)).and(U.cloud.greaterThan(0.002)), () => {
        const cp = d.xz.div(max(el, 0.035)).mul(0.32).add(vec2(t.mul(0.004), t.mul(0.0012)));
        const warp = vnoise(cp.mul(0.45).add(9.1));
        const cn = fbm(cp.add(warp.mul(0.9)));
        const Ld = normalize(mix(U.sunDir, U.moonDir, U.night));
        const cn2 = fbm(cp.add(warp.mul(0.9)).add(Ld.xz.mul(0.22)));
        const cov = U.cloud;
        const dens = smoothstep(float(0.66).sub(cov.mul(0.38)), float(0.92).sub(cov.mul(0.3)), cn).mul(smoothstep(0.012, 0.1, el)).mul(smoothstep(0.85, 0.35, el));
        const lit = clamp(cn.sub(cn2).mul(5).add(0.5), 0, 1);
        const cShade = U.cloudCol.mul(0.72).add(U.hor.mul(0.12));
        const cLit = U.cloudCol.mul(1.12).add(U.glow.mul(pow(sd, 3).mul(0.55)).mul(U.sunVis)).add(MC.mul(pow(md, 4).mul(0.08)).mul(U.moon));
        col.assign(mix(col, mix(cShade, cLit, lit), dens.mul(0.88)));
      });
      // low sea haze on the horizon
      col.assign(mix(col, U.fog, U.mist.mul(exp(max(el, 0).mul(-14))).mul(0.75)));
      return col;
    })();
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(500, 48, 24), mat);
    mesh.frustumCulled = false; mesh.renderOrder = -10;
    mesh.onBeforeRender = (r, s, cam) => { mesh.position.copy(cam.position); mesh.updateMatrixWorld(); };
    return mesh;
  }
  // a far headland silhouette: the hour's headland colour, hazed toward the sky at its foot. k: how far (0..1 more haze)
  function headlandMat(k, far) {
    const m = new THREE.MeshBasicNodeMaterial(); m.fog = false;
    m.colorNode = Fn(() => {
      const h = positionWorld.y;
      const n = fbm(positionWorld.xy.mul(vec2(0.05, 0.3)).add(far * 7));
      const body = U.head.mul(n.mul(0.16).add(0.92));
      const haze = mix(U.hor, U.fog, 0.5);
      return mix(body, haze, smoothstep(far ? 3 : 8, -0.4, h).mul(0.55).add(k * 0.35).min(0.92));
    })();
    return m;
  }

  /* ---------- build ---------- */
  function build() {
    scene = new THREE.Scene();
    ({ env, U, sample } = makeEnv(STOPS));
    S.env = env; S.scene = scene;
    fireU = uniform(new THREE.Vector4(FIRE.x, 0.3, FIRE.z, 1));
    fireR = uniform(new THREE.Vector2(2, 0.5));               // x: pool radius on the sand, y: 1/r^2 falloff for objects
    flameU = uniform(new THREE.Vector2(1.6, 0));              // x: flame brightness, y: hover cue
    coalU = uniform(1); shimU = uniform(1); windU = uniform(0.2);
    scene.add(makeFireSky());

    /* a far headland on the left, barely above the sea, and a fainter low point far off to the right.
       Both fade toward the sky at their foot (sea haze), the far one more: two layers of distance. */
    headMat = headlandMat(0.42, 0);
    ridge(scene, (x) => 7.5 * Math.exp(-(((x + 150) / 70) ** 2)) + 2.2 * Math.exp(-(((x + 60) / 30) ** 2)) + 0.5 * Math.sin(x * 0.11) * Math.exp(-(((x + 120) / 80) ** 2))
      + 0.35 * Math.sin(x * 0.37 + 1) * Math.exp(-(((x + 150) / 60) ** 2)) - 0.4, -230, -420, 120, 320, headMat);
    ridge(scene, (x) => 2.6 * Math.exp(-(((x - 250) / 90) ** 2)) + 1.1 * Math.exp(-(((x - 150) / 40) ** 2)) + 0.25 * Math.sin(x * 0.21) * Math.exp(-(((x - 220) / 100) ** 2)) - 0.5, -330, 40, 480, 200, headlandMat(0.66, 1));

    buildGround();
    buildDune();
    buildFire();
    buildWood();
    buildPebbles();
    buildBirds();
    buildParticles();
    buildStars();
  }

  /* ---------- dry sand, shared by the beach and the dune so the two meet without a seam ----------
     Broad tonal patches, fine grain near the eye, wind ripples that catch grazing fire, sun and moon light,
     the warm pool of firelight (amber at its heart, clay at its edge), cool moonlit sand away from the fire,
     and soft contact shadows around the stone ring and under the driftwood pile. */
  const RIPDIR = new THREE.Vector2(1.7, 15).normalize();
  function drySand(P, dist, gate) {
    const x = P.x, z = P.z;
    const LC_CORE = C3(col('#E8A85A')), LC_EDGE = C3(col('#B9805F')), SANDALB = C3(col('#CDB396'));
    // the noise is skipped under open water, where the sand cannot be seen
    const nz = vec4(0.5, 0.5, 0.5, 0).toVar();
    TSL.If(gate, () => {
      nz.assign(vec4(fbm(P.xz.mul(0.21).add(vec2(4.1, 1.7))), fbm(P.xz.mul(vec2(2.2, 3.1))), fbm(P.xz.mul(0.55).add(2.2)), vnoise(P.xz.mul(37)).sub(0.5).mul(smoothstep(7, 1.5, dist))));
    });
    const big = nz.x, n1 = nz.y, fine = nz.w;
    const amb = U.sand.mul(n1.mul(0.26).add(0.86)).mul(big.mul(0.34).add(0.83)).mul(fine.mul(0.14).add(1)).toVar();
    // the warm pool of firelight
    const fd = length(P.xz.sub(fireU.xz));
    const fq = fd.div(fireR.x);
    const core = exp(fq.mul(fq).negate());
    const pool = core.mul(0.9).add(float(0.05).div(fd.mul(fd).mul(0.8).add(1))).mul(fireU.w);
    // contact shadows: the stone ring and the driftwood pile
    const ao = exp(fd.sub(0.47).div(0.075).pow(2).negate()).mul(0.5).toVar();
    TSL.If(length(P.xz.sub(pileCU)).lessThan(1.4), () => { for (let k = 0; k < PILE_LOGS.length; k++) {
      const sg = pileSegs.element(k);
      const pa = P.xz.sub(sg.xy), ba = sg.zw.sub(sg.xy);
      const hh = clamp(dot(pa, ba).div(dot(ba, ba)), 0, 1);
      const dd = length(pa.sub(ba.mul(hh)));
      ao.addAssign(exp(dd.mul(dd).div(-0.0045)).mul(0.42));
    } });
    const occ = ao.min(0.75).oneMinus();
    // wind ripples, in patches, faded with distance so they never shimmer
    const ph = z.mul(15).add(x.mul(1.7)).add(n1.mul(7));
    const rmask = smoothstep(0.3, 0.56, nz.z).mul(smoothstep(8.5, 2.0, dist));
    const rs = TSL.cos(ph).mul(rmask);
    const Lf = normalize(fireU.xz.sub(P.xz).add(vec2(0.0001, 0)));
    const fireRip = dot(vec2(RIPDIR.x, RIPDIR.y), Lf).mul(rs).mul(0.55).add(1);
    const Ls = normalize(U.sunDir.xz.add(vec2(0.0001, 0))), Lm = normalize(U.moonDir.xz.add(vec2(0.0001, 0)));
    const grazeS = U.sunDir.y.max(0).oneMinus().mul(U.sunVis).mul(U.day), grazeM = U.moon.mul(U.night);
    amb.mulAssign(dot(vec2(RIPDIR.x, RIPDIR.y), Ls).mul(rs).mul(grazeS).mul(0.3).add(dot(vec2(RIPDIR.x, RIPDIR.y), Lm).mul(rs).mul(grazeM).mul(0.3)).add(1));
    // night: the sand away from the fire takes the cool of the moon and the sea
    amb.mulAssign(mix(vec3(1, 1, 1), vec3(0.8, 0.95, 1.06), U.night.mul(core.oneMinus()).mul(0.7)));
    const lightC = mix(LC_EDGE, LC_CORE, core).mul(pool).mul(fireRip);
    return { amb, lightC, SANDALB, LC_CORE, core, pool, fd, occ, n1 };
  }

  /* ---------- the beach and the sea in one shader: waterline, waves, crests, foam, wet sand, wrack, firelight ---------- */
  function buildGround() {
    waveArr = uniformArray(waves, 'vec4');
    pileSegs = uniformArray(pileSegV, 'vec4');
    printsU = uniformArray(printV, 'vec4');
    const FC = C3(FIRECOL), PC = C3(PAPER), TC = C3(TIDE), WRACK = C3(col('#3B2A20')), WRACK2 = C3(col('#4A4536'));
    const mat = new THREE.MeshBasicNodeMaterial(); mat.fog = false;
    mat.colorNode = Fn(() => {
      const P = positionWorld, x = P.x, z = P.z, t = uTime;
      const Vv = cameraPosition.sub(P), dist = length(Vv), Vn = Vv.div(dist);
      const sh = shoreFn(x);
      const lap = sin(t.mul(0.42).add(x.mul(0.05))).mul(0.1).add(sin(t.mul(0.23).add(1.3)).mul(0.06));
      const front = sh.add(lap).toVar();
      const wet = float(0).toVar(), foam = float(0).toVar(), glowF = float(0).toVar(), act = float(0).toVar();
      for (let k = 0; k < NW; k++) {
        const w = waveArr.element(k);
        const a = t.sub(w.x);
        const live = step(0, a).mul(step(a, 70));
        const dx = x.sub(w.y);
        const gx = exp(dx.mul(dx).div(-60));
        const g = gx.mul(w.z).mul(live);
        front.addAssign(g.mul(smoothstep(0, 2.6, a)).mul(smoothstep(2.9, 9, a).oneMinus()));     // runs up, then pulls back
        act.addAssign(gx.mul(live).mul(smoothstep(0, 1, a)).mul(smoothstep(2.4, 6, a).oneMinus()));
        const reach = sh.add(g.mul(0.97)).add(0.04);
        const dl = z.sub(reach);
        const left = smoothstep(2.4, 3.6, a).mul(exp(a.sub(3.6).max(0).div(-18)));                  // the foam line it leaves
        foam.addAssign(exp(dl.mul(dl).div(-0.006)).mul(left).mul(step(0.06, g)).mul(1.2));
        wet.assign(max(wet, smoothstep(reach.add(0.1), reach.sub(0.15), z).mul(exp(a.div(-30))).mul(step(0.06, g)).mul(smoothstep(0.5, 2.0, a))));
        glowF.addAssign(w.w.mul(gx).mul(live).mul(smoothstep(0, 1.2, a)).mul(smoothstep(4, 12, a).oneMinus()));
      }
      const dw = front.sub(z);                               // how far into the water
      const water = smoothstep(-0.025, 0.025, dw);
      // sand
      const SD = drySand(P, dist, dw.lessThan(1.4));
      const { SANDALB, LC_CORE, pool, fd, occ } = SD;
      const damp = max(smoothstep(sh.add(1.0), sh.add(0.05), z).mul(0.75), wet);
      // the wrack line: dry seaweed and bits of shell at the last high tide, broken into clumps
      const zw = sh.add(0.78).add(sin(x.mul(0.37).add(1)).mul(0.16)).add(vnoise(vec2(x.mul(0.8), 2.3)).sub(0.5).mul(0.2));
      const wq = z.sub(zw).div(0.085);
      const clump = smoothstep(0.42, 0.62, vnoise(vec2(x.mul(2.6), z.mul(5))));
      const wrack = exp(wq.mul(wq).negate()).mul(clump).mul(smoothstep(0.3, 0.55, vnoise(vec2(x.mul(0.35), 7.7))).mul(0.6).add(0.4)).mul(smoothstep(30, 6, dist));
      // footprints, softened by the wind: someone walked up from the sea path to the pile, then to the fire
      const fpIn = float(0).toVar(), fpWall = float(0).toVar();
      const toF = normalize(fireU.xz.sub(P.xz).add(vec2(0.0001, 0)));
      const Lh = normalize(toF.mul(fireU.w.mul(SD.core.add(0.15))).add(normalize(U.sunDir.xz.add(vec2(0.0001, 0))).mul(U.day.mul(U.sunVis))).add(vec2(0.0001, 0)));
      TSL.If(dist.lessThan(9), () => { for (let k = 0; k < NFP; k++) {
        const fp = printsU.element(k);
        const dq = P.xz.sub(fp.xy);
        const ca = TSL.cos(fp.z), sa = sin(fp.z);
        const lq = vec2(dq.x.mul(ca).sub(dq.y.mul(sa)), dq.x.mul(sa).add(dq.y.mul(ca)));
        const e = length(lq.div(vec2(0.048, 0.11)));
        const inside = smoothstep(1.0, 0.65, e).mul(fp.w);
        fpIn.addAssign(inside);
        fpWall.addAssign(dot(normalize(dq.add(vec2(0.0001, 0))), Lh).negate().mul(smoothstep(0.45, 0.85, e)).mul(smoothstep(1.12, 0.92, e)).mul(fp.w));
      } });
      const fpK = smoothstep(9, 1.5, dist).mul(damp.oneMinus());
      const fpShade = fpIn.mul(-0.1).add(fpWall.mul(0.45)).mul(fpK).add(1);
      const sandBase = SD.amb.mul(mix(float(1), float(0.58), damp)).mul(occ).mul(fpShade);
      const sandC = mix(sandBase, mix(WRACK, WRACK2, SD.n1).mul(U.day.mul(0.55).add(0.25)), wrack.mul(0.8))
        .add(SANDALB.mul(SD.lightC).mul(mix(float(1), float(0.7), damp)).mul(occ).mul(fpShade).mul(wrack.mul(0.5).oneMinus())).toVar();
      // wet sand: glossy, catches the firelight and the sky
      const Lf = normalize(fireU.xyz.add(vec3(0, 0.25, 0)).sub(P));
      const Hf = normalize(Lf.add(Vn));
      const spec = pow(max(Hf.y, 0), 70).mul(fireU.w).mul(float(1.6).div(fd.mul(0.25).add(1)));
      sandC.addAssign(FC.mul(spec).mul(damp).mul(1.4));
      const fq2 = fd.div(fireR.x.mul(2.8));
      sandC.addAssign(LC_CORE.mul(exp(fq2.mul(fq2).negate())).mul(fireU.w).mul(wet.mul(0.5).add(damp.mul(0.12))));   // wet sand shines with firelight
      const Hs = normalize(U.sunDir.add(Vn)), Hm = normalize(U.moonDir.add(Vn));
      sandC.addAssign(U.glow.mul(pow(max(Hs.y, 0), 90)).mul(U.sunVis).mul(damp).mul(0.5));
      sandC.addAssign(vec3(0.6, 0.68, 0.7).mul(pow(max(Hm.y, 0), 120)).mul(U.moon).mul(damp).mul(0.35));
      sandC.addAssign(U.hor.mul(damp).mul(0.1));
      // sea: a slow swell running in to the shore, two octaves of wind ripple, fresnel sky
      const seaC = vec3(0, 0, 0).toVar(), crestAll = float(0).toVar(), crestSh = float(0).toVar();
      TSL.If(water.greaterThan(0.0005), () => {
        const lod = clamp(dist.div(70).oneMinus(), 0, 1), lodN = smoothstep(28, 5, dist);
        const p2 = P.xz;
        const tA = vec2(t.mul(0.03), t.mul(0.07)), tB = vec2(t.mul(-0.05), t.mul(0.11));
        const hA = vnoise(p2.mul(vec2(0.35, 1.1)).add(tA));
        const hB = vnoise(p2.add(vec2(0.07, 0)).mul(vec2(0.35, 1.1)).add(tA));
        const hC = vnoise(p2.add(vec2(0, 0.07)).mul(vec2(0.35, 1.1)).add(tA));
        const q2 = p2.mul(vec2(1.3, 3.4)).add(tB);
        const iA = vnoise(q2), iB = vnoise(q2.add(vec2(0.09, 0))), iC = vnoise(q2.add(vec2(0, 0.09)));
        const swPh = z.mul(1.25).add(x.mul(0.06)).sub(t.mul(0.5)).add(vnoise(vec2(x.mul(0.04), z.mul(0.05))).mul(5));
        const swell = TSL.cos(swPh).mul(0.07).mul(smoothstep(60, 10, dist)).mul(smoothstep(0.2, 2.5, dw)).mul(smoothstep(0.25, 0.75, vnoise(vec2(x.mul(0.09), z.mul(0.12).add(3.3)))));
        const swPh2 = z.mul(0.36).add(x.mul(0.02)).sub(t.mul(0.24));
        const swell2 = TSL.cos(swPh2).mul(0.035).mul(smoothstep(150, 40, dist)).mul(vnoise(vec2(x.mul(0.03), z.mul(0.02))));
        const N = normalize(vec3(hA.sub(hB).mul(0.9).mul(lod).add(iA.sub(iB).mul(0.35).mul(lodN)), 1,
          hA.sub(hC).mul(0.9).mul(lod).add(iA.sub(iC).mul(0.35).mul(lodN)).sub(swell).sub(swell2)));
        const fres = pow(max(dot(N, Vn), 0).oneMinus(), 4).mul(0.8).add(0.12);
        const R = reflect(Vn.negate(), N);
        const skyR = mix(U.hor, U.top, smoothstep(0.0, 0.35, R.y));
        seaC.assign(mix(U.sea, skyR, fres));
        const sp = max(dot(R, U.sunDir), 0);
        seaC.addAssign(U.sun.mul(pow(sp, 600).mul(2.4).add(pow(sp, 60).mul(0.2)).add(pow(sp, 8).mul(0.04))).mul(U.sunVis).mul(smoothstep(-0.06, 0.02, U.sunDir.y)));
        const mp = max(dot(R, U.moonDir), 0);
        seaC.addAssign(vec3(0.72, 0.8, 0.8).mul(pow(mp, 500).mul(2.0).add(pow(mp, 50).mul(0.12)).add(pow(mp, 7).mul(0.035))).mul(U.moon));
        seaC.addAssign(FC.mul(pool).mul(0.25));
        // two low crests that roll in and spill a thin line of foam before they reach the sand
        for (let k = 0; k < 2; k++) {
          const cph = TSL.fract(t.div(13).add(k * 0.5).add(vnoise(vec2(x.mul(0.05), k * 7.3)).mul(0.45)));
          const dc = mix(float(3.4), float(0.35), cph);
          const cw = mix(float(0.09), float(0.045), cph);
          const cq = dw.sub(dc).div(cw);
          const amp = sin(cph.mul(Math.PI)).mul(smoothstep(0.25, 0.6, vnoise(vec2(x.mul(0.45).add(k * 3.1), t.mul(0.02)))));
          crestAll.addAssign(exp(cq.mul(cq).negate()).mul(amp));
          const cs = dw.sub(dc).add(cw.mul(1.6)).div(cw.mul(1.4));
          crestSh.addAssign(exp(cs.mul(cs).negate()).mul(amp));
        }
      });
      // shallow water over the sand near the front
      const shallow = smoothstep(0.0, 1.1, dw);
      const waterC = mix(sandC.mul(0.7).add(U.hor.mul(0.12)), seaC, shallow.mul(0.85).add(0.15));
      const colr = mix(sandC, waterC, water).toVar();
      const crestLight = U.hor.mul(0.35).add(U.glow.mul(U.sunVis).mul(0.25)).add(vec3(0.5, 0.58, 0.6).mul(U.moon).mul(0.12)).add(FC.mul(pool).mul(0.5));
      colr.mulAssign(crestSh.mul(0.22).mul(water).oneMinus());
      colr.addAssign(crestLight.mul(crestAll).mul(water).mul(smoothstep(0.15, 0.6, dw)).mul(0.55));
      // foam at the moving edge and the lines left behind
      const fn = vnoise(vec2(x.mul(5), z.mul(3).add(t.mul(0.25))));
      const edge = exp(dw.mul(dw).div(-0.01)).mul(act.mul(1.6).add(0.14)).mul(fn.mul(fn).mul(1.2).add(0.25));
      const bubbles = smoothstep(0.62, 0.8, vnoise(vec2(x.mul(14), z.mul(9)))).mul(exp(dw.div(-0.35))).mul(water).mul(act).mul(0.5)
        .add(smoothstep(0.5, 0.74, vnoise(vec2(x.mul(7), z.mul(4).sub(t.mul(0.2))))).mul(exp(dw.div(-0.7))).mul(water).mul(act).mul(0.45));   // lace on the running sheet
      const crestFoam = crestAll.mul(smoothstep(0.45, 0.75, vnoise(vec2(x.mul(3.2), z.mul(2).add(t.mul(0.1)))))).mul(water).mul(0.5);
      const foamAll = edge.add(bubbles).add(foam.mul(fn.mul(0.6).add(0.5))).add(crestFoam);
      const foamC = PC.mul(U.day.mul(0.85).add(0.07)).add(SANDALB.mul(SD.lightC).mul(0.9)).add(vec3(0.5, 0.56, 0.58).mul(U.moon).mul(U.night).mul(0.1));
      colr.addAssign(foamC.mul(foamAll).mul(0.85));
      // SPEC hidden detail: some waves at night carry a faint blue glow in the foam, in the tide colour
      colr.addAssign(TC.mul(2.6).mul(glowF).mul(foamAll.sub(crestFoam).add(edge.mul(0.5))).mul(U.night));
      // distance haze
      colr.assign(mix(colr, U.fog, smoothstep(25, 260, dist).mul(0.35)));
      colr.assign(mix(colr, U.fog, U.mist.mul(smoothstep(6, 60, dist)).mul(0.5)));
      return colr;
    })();
    const g = new THREE.PlaneGeometry(900, 420, 1, 1); g.rotateX(-Math.PI / 2); g.translate(0, 0, 8 - 210);
    const m = new THREE.Mesh(g, mat); m.frustumCulled = false; scene.add(m);
  }

  /* ---------- dunes on the left, with tall marram grass that sways in the wind (on the GPU) ---------- */
  const duneEdge = (z) => -(0.5 * VW * (6.3 - z) + 0.25) + 0.22 * Math.sin(z * 1.3 + 0.4) + 0.08 * Math.sin(z * 3.1);
  const duneH = (v, z) => {
    const crest = (0.95 + 0.3 * Math.sin(z * 0.8 + 1) + 0.15 * Math.sin(z * 2.1 + 0.3)) * smooth(-4.5, -0.6, z);
    return crest * (smooth(0, 0.2, v) - 0.3 * smooth(0.45, 1, v)) - 0.04 + 0.025 * Math.sin(v * 40 + z * 3) * smooth(0, 0.12, v);
  };
  const duneX = (v, z) => duneEdge(z) + 0.35 - v * 10;
  const GRASS_N = 1500;
  function buildDune() {
    const mat = new THREE.MeshBasicNodeMaterial(); mat.fog = false;
    mat.colorNode = Fn(() => {
      const P = positionWorld, N = normalize(normalWorld);
      const dist = length(cameraPosition.sub(P));
      const SD = drySand(P, dist, P.y.greaterThan(-1));
      const up = smoothstep(0.0, 0.34, P.y);                // at the foot it is exactly the beach, so there is no seam
      // the dune's own colour and shape: slopes turned to the sun or moon lighter, the lee side in shade
      const slopeS = dot(N, U.sunDir).sub(U.sunDir.y).mul(U.sunVis).mul(U.day).mul(0.55);
      const slopeM = dot(N, U.moonDir).sub(U.moonDir.y).mul(U.moon).mul(U.night).mul(0.5);
      const sky = N.y.sub(1).mul(0.28).add(1);
      const amb = mix(SD.amb, SD.amb.mul(U.dune.div(U.sand.max(0.002))), up.mul(0.7)).mul(mix(float(1), sky.mul(slopeS.add(slopeM).add(1)), up)).mul(SD.occ);
      const rim = U.glow.mul(smoothstep(0.75, 0.97, N.y).mul(smoothstep(0.25, 0.6, P.y))).mul(U.sunVis).mul(U.day).mul(0.08);
      const fl = mix(SD.SANDALB.mul(SD.lightC), C3(col('#B8946E')).mul(fireLit(P, N)).mul(0.8), up);
      return amb.add(rim).add(fl);
    })();
    duneMesh = new THREE.Mesh(new THREE.BufferGeometry(), mat); duneMesh.frustumCulled = false; scene.add(duneMesh);

    grassGeo = new THREE.InstancedBufferGeometry();
    { const seg = 5, pos = [], idx = [];
      for (let i = 0; i <= seg; i++) { const t = i / seg; pos.push(-0.5, t, 0, 0.5, t, 0); }
      for (let i = 0; i < seg; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      grassGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); grassGeo.setIndex(idx); }
    grassAttr = { base: new THREE.InstancedBufferAttribute(new Float32Array(GRASS_N * 3), 3), shape: new THREE.InstancedBufferAttribute(new Float32Array(GRASS_N * 3), 3), lean: new THREE.InstancedBufferAttribute(new Float32Array(GRASS_N * 2), 2) };
    grassGeo.setAttribute('aBase', grassAttr.base); grassGeo.setAttribute('aShape', grassAttr.shape); grassGeo.setAttribute('aLean', grassAttr.lean);
    grassGeo.instanceCount = GRASS_N;
    const gm = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide }); gm.fog = false;
    gm.positionNode = Fn(() => {
      const base = attribute('aBase', 'vec3'), shape = attribute('aShape', 'vec3');
      const t = positionGeometry.y, h = shape.x, ph = shape.z;
      const sway = sin(uTime.mul(0.8).add(ph).add(base.x.mul(0.5))).mul(0.07).add(sin(uTime.mul(1.9).add(ph.mul(2))).mul(0.018)).add(windU.mul(0.35));
      const lean = attribute('aLean', 'vec2').mul(t).mul(t).mul(h).mul(3);
      const b = sway.mul(t).mul(t).mul(h);
      return base.add(vec3(positionGeometry.x.mul(shape.y).mul(t.mul(0.85).oneMinus()).add(b).add(lean.x), t.mul(h).mul(abs(sway).mul(0.15).add(length(lean).mul(0.5)).oneMinus()), b.mul(0.3).add(lean.y)));
    })();
    gm.colorNode = Fn(() => {
      const t = positionGeometry.y;
      const hI = hash12(vec2(float(instanceIndex), 1.7));
      const c = mix(U.grass, U.grass.mul(vec3(1.4, 1.28, 0.95)), hI.mul(0.7)).mul(t.mul(0.35).add(0.75)).toVar();
      c.assign(mix(c, U.dune.mul(1.05), t.mul(t).mul(step(0.55, hI)).mul(0.45)));     // some blades dry to straw at the tip
      const rim = U.glow.mul(t.mul(t)).mul(U.day).mul(U.sunVis).mul(0.18);
      return c.add(rim).add(C3(col('#9C8A5E')).mul(fireLit(positionWorld, vec3(0, 0.6, 0.8))).mul(0.55));
    })();
    const grass = new THREE.Mesh(grassGeo, gm); grass.frustumCulled = false; scene.add(grass);
  }
  function layoutDune() {
    const NU = 46, NV = 30, pos = [], idx = [];
    for (let i = 0; i <= NU; i++) {
      const z = lerp(6.8, -6, i / NU);
      for (let j = 0; j <= NV; j++) { const v = j / NV; pos.push(duneX(v, z), duneH(v, z), z); }
    }
    for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) {
      const a = i * (NV + 1) + j, b = a + NV + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    duneMesh.geometry.dispose(); duneMesh.geometry = g;
    const r = seeded(5);
    let i = 0;
    while (i < GRASS_N) {                                     // marram grows in tufts
      const z0 = lerp(-2.4, 5.5, r()), v0 = -0.01 + Math.pow(r(), 1.2) * 0.5, crest = smooth(0.03, 0.2, v0);
      const n = 6 + Math.floor(r() * 9), tall = (0.22 + r() * 0.3) * (0.55 + 0.6 * crest) * (z0 > -0.5 ? 1 : 0.85);
      for (let k = 0; k < n && i < GRASS_N; k++, i++) {
        const z = z0 + (r() - 0.5) * 0.12, v = v0 + (r() - 0.5) * 0.012, a = r() * 6.28, lean = 0.05 + r() * 0.12;
        grassAttr.base.setXYZ(i, duneX(v, z) + (r() - 0.5) * 0.08, duneH(v, z) - 0.01, z);
        grassAttr.shape.setXYZ(i, tall * (0.55 + r() * 0.6), 0.008 + r() * 0.007, r() * 6.28);
        grassAttr.lean.setXY(i, Math.cos(a) * lean, Math.sin(a) * lean);
      }
    }
    grassAttr.lean.needsUpdate = true;
    grassAttr.base.needsUpdate = true; grassAttr.shape.needsUpdate = true;
  }

  /* ---------- the fire: coals, a soft TSL flame, glow, heat shimmer ---------- */
  function buildFire() {
    const FC = C3(FIRECOL), EC = C3(EMBER), GC = C3(GOLD);
    // coals
    const coalMat = new THREE.MeshBasicNodeMaterial(); coalMat.fog = false;
    coalMat.colorNode = Fn(() => {
      const P = positionWorld, t = uTime;
      const q = P.xz.sub(fireU.xz);
      const r = length(q);
      const n = fbm(q.mul(9).add(vec2(t.mul(0.05), t.mul(-0.04))));
      const n2 = vnoise(q.mul(26).add(vec2(t.mul(-0.12), t.mul(0.09))));
      const hot = smoothstep(0.42, 0.72, n).mul(n2.mul(0.5).add(0.6)).mul(smoothstep(0.31, 0.08, r));
      // pale ash toward the rim, charcoal in the middle, warmed by the flame above
      const ashK = smoothstep(0.12, 0.3, r).mul(n.mul(0.6).add(0.5));
      const ash = mix(vec3(0.035, 0.028, 0.022), mix(U.sand, vec3(0.42, 0.4, 0.37), 0.5).mul(U.day.mul(0.6).add(0.35)), ashK).mul(n2.mul(0.3).add(0.85));
      const warm = C3(col('#E8A85A')).mul(fireU.w).mul(0.22).mul(ashK.add(0.3)).mul(hot.oneMinus());
      return ash.add(warm).add(EC.mul(hot).mul(coalU).mul(1.6)).add(GC.mul(pow(hot, 3)).mul(coalU).mul(2.2));
    })();
    const coals = new THREE.Mesh(new THREE.CircleGeometry(0.33, 28), coalMat);
    coals.rotation.x = -Math.PI / 2; coals.position.set(FIRE.x, 0.012, FIRE.z); scene.add(coals);

    // stones: one instanced ring of rounded, lumpy beach stones, lit from the inside; their inner faces hold the heat
    const stoneMat = new THREE.MeshBasicNodeMaterial(); stoneMat.fog = false;
    stoneMat.colorNode = Fn(() => {
      const P = positionWorld, N = normalize(normalWorld);
      const hI = hash12(vec2(float(instanceIndex), 3.1));
      const tone = hI.mul(0.34).add(0.8);
      const mott = vnoise(positionGeometry.xz.mul(5.5).add(positionGeometry.y.mul(3)).add(hI.mul(20))).mul(0.24).add(0.88);
      const tint = mix(vec3(1, 1, 1), vec3(1.08, 0.97, 0.88), step(0.6, hI));       // a few warmer, sandier stones
      const q = fireU.xz.sub(P.xz), fd = length(q);
      const inner = max(dot(N.xz, q.div(fd.max(0.01))), 0).mul(smoothstep(0.56, 0.36, fd)).mul(smoothstep(0.09, 0.0, P.y.sub(0.02)).mul(0.5).add(0.5));
      const heat = inner.mul(inner).mul(coalU).mul(vnoise(P.xz.mul(30).add(uTime.mul(0.08))).mul(0.5).add(0.6));
      const sky = N.y.mul(0.35).add(0.68);
      const moonL = max(dot(N, U.moonDir), 0).mul(U.moon).mul(U.night).mul(0.06);
      const sunL = max(dot(N, U.sunDir), 0).mul(U.sunVis).mul(U.day).mul(0.25);
      const base = U.stone.mul(tone).mul(mott).mul(tint).mul(sky.add(sunL)).add(vec3(0.5, 0.56, 0.58).mul(moonL));
      const foot = smoothstep(0.0, 0.035, P.y).mul(0.35).add(0.65);                 // darker where it sits in the sand
      return base.mul(foot).add(C3(col('#9A8878')).mul(fireLit(P, N)).mul(0.9)).add(C3(EMBER).mul(heat).mul(0.55)).add(C3(GOLD).mul(heat.mul(heat)).mul(0.25));
    })();
    const ringN_ = 12, stoneGeo = new THREE.IcosahedronGeometry(1, 2);
    { const p = stoneGeo.attributes.position, v = new THREE.Vector3();          // squash and dent a sphere into a beach stone
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i);
        const k = 1 + 0.09 * Math.sin(v.x * 3.1 + v.y * 1.7) + 0.06 * Math.sin(v.z * 4.3 - v.x * 2.2) + 0.04 * Math.sin(v.y * 6.1 + v.z * 3.3);
        v.multiplyScalar(k); if (v.y < -0.35) v.y = -0.35 + (v.y + 0.35) * 0.3;     // flatter underside
        p.setXYZ(i, v.x, v.y, v.z);
      }
      stoneGeo.computeVertexNormals(); }
    const stones = new THREE.InstancedMesh(stoneGeo, stoneMat, ringN_);
    { const r = seeded(19);
      for (let i = 0; i < ringN_; i++) {
        const a = i / ringN_ * Math.PI * 2 + r() * 0.2, rr = 0.41 + r() * 0.04;
        const big = 0.8 + r() * 0.45;
        tmpV.set(FIRE.x + Math.cos(a) * rr, 0.022 * big, FIRE.z + Math.sin(a) * rr * 0.92);
        tmpE.set(r() * 0.5 - 0.25, a + r() * 0.8, r() * 0.4 - 0.2); tmpQ.setFromEuler(tmpE);
        tmpS.set((0.075 + r() * 0.035) * big, (0.05 + r() * 0.025) * big, (0.06 + r() * 0.025) * big);
        tmpM.compose(tmpV, tmpQ, tmpS); stones.setMatrixAt(i, tmpM);
      } }
    scene.add(stones);

    // flame: one billboard drawn in layers: a dim outer veil, three tongues that lift and part at their own pace, and a hot core at the base
    const fmat = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }); fmat.fog = false;
    const CORE = C3(col('#F6E2B4')), MID = C3(col('#E0A456')), EDGE = C3(col('#B9805F')), DEEP = C3(col('#8A4A2A'));
    fmat.colorNode = Fn(() => {
      const u = uv(), t = uTime;
      const x = u.x.sub(0.5).mul(2.6), y = u.y;
      const n = fbm(vec2(x.mul(1.5).add(3.3), y.mul(1.9).sub(t.mul(1.15))));
      const n2 = vnoise(vec2(x.mul(4.4), y.mul(3.8).sub(t.mul(2.3))).add(5.1));
      const bend = n.sub(0.5).mul(y).mul(0.7).add(sin(t.mul(0.9)).mul(0.05).mul(y)).add(windU.mul(0.9).mul(y).mul(y));
      const xb = x.add(bend);
      // the veil
      const wO = mix(float(0.9), float(0.08), pow(y, 0.7));
      const veil = smoothstep(wO, wO.mul(0.1), abs(xb)).mul(smoothstep(0.0, 0.14, y)).mul(smoothstep(0.85, 0.25, y.add(n.sub(0.5).mul(0.5))));
      const i = veil.mul(0.4).toVar();
      // three tongues
      const TX = [-0.36, 0.02, 0.36], TH = [0.55, 0.82, 0.62], TW = [0.42, 0.56, 0.4];
      for (let k = 0; k < 3; k++) {
        const lift = vnoise(vec2(k * 3.1 + 0.5, t.mul(0.85 + 0.17 * k)));
        const hk = lift.mul(0.35).add(TH[k] - 0.15);
        const yy = y.div(hk);
        const cx = sin(t.mul(0.6 + 0.21 * k).add(k * 2.1)).mul(0.07).add(TX[k]).mul(yy.mul(0.75).oneMinus().max(0));
        const wk = mix(float(TW[k]), float(0.03), pow(yy.min(1), 0.85));
        const tongue = smoothstep(wk, wk.mul(0.12), abs(xb.sub(cx))).mul(smoothstep(1.05, 0.55, yy.add(n2.sub(0.5).mul(0.45)))).mul(smoothstep(0.0, 0.1, y));
        i.assign(max(i, tongue.mul(k === 1 ? 1 : 0.85)));
      }
      // licking edges: rising noise eats the upper flame, so tips part and vanish
      i.mulAssign(mix(float(1), smoothstep(0.28, 0.66, n2.mul(0.7).add(n.mul(0.6))), smoothstep(0.22, 0.85, y)));
      // a hot core that sits low and wide
      const cq = vec2(xb.mul(1.5), y.sub(0.17).mul(1.6));
      const core = smoothstep(0.5, 0.0, length(cq)).mul(n2.mul(0.3).add(0.75));
      const c = mix(DEEP, EDGE, smoothstep(0.02, 0.2, i)).toVar();
      c.assign(mix(c, MID, smoothstep(0.2, 0.5, i)));
      c.assign(mix(c, CORE, smoothstep(0.5, 0.95, i.add(core.mul(0.5)))));
      return c.mul(i.add(core.mul(0.45))).mul(flameU.x).mul(mix(vec3(1, 1, 1), vec3(1.0, 0.72, 0.42), U.day.mul(0.7)));
    })();
    const fg = new THREE.PlaneGeometry(0.8, 1.0); fg.translate(0, 0.5, 0);
    flame = new THREE.Mesh(fg, fmat); flame.position.set(FIRE.x, 0.03, FIRE.z + 0.02); flame.renderOrder = 3; scene.add(flame);

    // the glow of the fire in the air: soft all the way to its edge, no disc
    glowU = uniform(0.4);
    const gmat = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }); gmat.fog = false;
    gmat.colorNode = Fn(() => {
      const r = length(uv().sub(0.5)).mul(2);
      const a = exp(r.mul(r).mul(-5.5)).mul(0.55).add(float(0.06).div(r.mul(r).mul(18).add(0.06)).mul(0.08)).mul(smoothstep(1.0, 0.55, r));
      return C3(col('#E0A456')).mul(a).mul(glowU);
    })();
    glowSprite = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), gmat);
    glowSprite.position.set(FIRE.x, 0.35, FIRE.z); glowSprite.renderOrder = 2; scene.add(glowSprite);

    // SPEC hidden detail: heat shimmer above the fire bends the stars behind it (a small refraction strip)
    const smat = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false }); smat.fog = false;
    const su = uv();
    const smask = smoothstep(0.0, 0.3, su.y).mul(smoothstep(1.0, 0.45, su.y)).mul(smoothstep(0.5, 0.12, abs(su.x.sub(0.5))));
    const sn1 = vnoise(vec2(su.x.mul(7), su.y.mul(6).sub(uTime.mul(2.0)))).sub(0.5);
    const sn2 = vnoise(vec2(su.x.mul(6).add(4.2), su.y.mul(5).sub(uTime.mul(1.6)))).sub(0.5);
    const off = vec2(sn1, sn2.mul(0.5)).mul(0.012).mul(smask).mul(shimU);
    smat.colorNode = viewportSharedTexture(screenUV.add(off)).rgb;
    smat.opacityNode = smask.mul(min(shimU, 1));
    const sg = new THREE.PlaneGeometry(0.9, 1.7); sg.translate(0, 0.85, 0);
    shimmer = new THREE.Mesh(sg, smat); shimmer.position.set(FIRE.x, 0.75, FIRE.z); shimmer.renderOrder = 5; scene.add(shimmer);
  }

  /* ---------- wood: logs in the fire, the driftwood pile, the log being carried, logs that burn ---------- */
  // a weathered log: unit length along x, unit radius. Tapered, knotty ends, a slight bow and an uneven girth, baked once.
  const logGeo = (() => {
    const g = new THREE.CylinderGeometry(1, 1, 1, 12, 8); g.rotateZ(Math.PI / 2);
    const p = g.attributes.position, nrm = g.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), cap = Math.abs(nrm.getX(i)) > 0.9;
      const ang = Math.atan2(z, y), ax = Math.abs(x);
      let k = 1 + 0.09 * Math.sin(x * 9 + 1.3) + 0.06 * Math.sin(ang * 3 + x * 5) + 0.05 * Math.sin(ang * 5 - x * 13);
      k *= 1 - 0.28 * smooth(0.3, 0.5, ax) * (0.6 + 0.4 * Math.sin(ang * 2 + x * 3));   // worn, tapered ends
      if (cap) k *= 0.97;
      const bow = 0.55 * (0.25 - x * x);
      p.setXYZ(i, x, y * k + bow, z * k);
    }
    g.computeVertexNormals();
    return g;
  })();
  function woodMat(charNode, instanced) {
    const m = new THREE.MeshBasicNodeMaterial(); m.fog = false;
    const WA = C3(col('#B8A48C')), CH = C3(col('#16110D')), EC = C3(EMBER), GC = C3(GOLD), SILVER = C3(col('#C9C2B4'));
    m.colorNode = Fn(() => {
      const P = positionWorld, N = normalize(normalWorld), g = positionGeometry;
      const ang = TSL.atan2(g.z, g.y.sub(0.1));
      const cap = smoothstep(0.75, 0.95, abs(TSL.normalGeometry.x));
      // long splits and grain along the log, rings on the cut ends
      const streak = vnoise(vec2(g.x.mul(2.2), ang.mul(7))).mul(0.6).add(vnoise(vec2(g.x.mul(0.8), ang.mul(19))).mul(0.4));
      const crack = smoothstep(0.08, 0.0, abs(vnoise(vec2(g.x.mul(1.4), ang.mul(4.5)).add(3.7)).sub(0.5))).mul(0.55);
      const rr = length(g.yz);
      const rings = sin(rr.mul(38).add(vnoise(g.yz.mul(6)).mul(4))).mul(0.5).add(0.5);
      const grain = mix(streak.mul(0.45).add(0.75).mul(crack.oneMinus()), rings.mul(0.25).add(0.82), cap);
      const tone = instanced ? hash12(vec2(float(instanceIndex), 7.7)).mul(0.35).add(0.8) : float(1);
      const silv = instanced ? hash12(vec2(float(instanceIndex), 2.3)) : float(0.4);
      const ch = charNode;
      const wood = mix(U.wood.mul(tone), U.wood.mul(SILVER).mul(1.25), silv.mul(0.6).mul(U.day));      // sun-bleached grey on some
      const sky = N.y.mul(0.32).add(0.74);
      const sunL = max(dot(N, U.sunDir), 0).mul(U.sunVis).mul(U.day).mul(0.3);
      const moonL = max(dot(N, U.moonDir), 0).mul(U.moon).mul(U.night).mul(0.07);
      const base = mix(wood, CH, ch).mul(grain).mul(sky.add(sunL)).add(vec3(0.5, 0.56, 0.58).mul(moonL).mul(ch.oneMinus()));
      const under = smoothstep(-0.2, 0.25, N.y).mul(0.35).add(0.65);                 // the underside sits in its own shadow
      const lit = WA.mul(fireLit(P, N)).mul(mix(float(1), float(0.25), ch)).mul(grain);
      const em = smoothstep(0.64, 0.9, vnoise(P.xz.mul(11).add(vec2(uTime.mul(0.15), 0)))).mul(ch).mul(coalU).mul(smoothstep(0.6, -0.2, N.y))
        .add(crack.mul(ch).mul(coalU).mul(0.15));
      return base.mul(under).add(lit).add(EC.mul(em).mul(1.3)).add(GC.mul(em.mul(em)).mul(0.8));
    })();
    return m;
  }
  function buildWood() {
    // three charred logs crossing in the ring
    const inFire = new THREE.InstancedMesh(logGeo, woodMat(float(1), false), 3);
    [[0.25, 0.1, 0.055], [1.35, -0.12, 0.05], [2.4, 0.08, 0.045]].forEach(([ry, rz, r], i) => {
      tmpV.set(FIRE.x, r + 0.02 + i * 0.03, FIRE.z); tmpE.set(0, ry, rz); tmpQ.setFromEuler(tmpE); tmpS.set(0.62, r, r);
      tmpM.compose(tmpV, tmpQ, tmpS); inFire.setMatrixAt(i, tmpM);
    });
    scene.add(inFire);
    // driftwood pile (laid out in resize)
    pileMesh = new THREE.InstancedMesh(logGeo, woodMat(float(0), true), 7); pileMesh.frustumCulled = false; scene.add(pileMesh);
    // the log the visitor carries
    dragLog = new THREE.Mesh(logGeo, woodMat(float(0), false)); dragLog.scale.set(0.66, 0.034, 0.034); dragLog.visible = false; scene.add(dragLog);
    // logs that burn after being added (at most 3)
    for (let i = 0; i < 3; i++) {
      const ch = uniform(0);
      const m = new THREE.Mesh(logGeo, woodMat(ch, false)); m.visible = false; scene.add(m);
      burning.push({ m, ch, t0: -999, active: false, ry: 0 });
    }
  }
  // [dx, layer, dz, rotation y, length, radius]: a loose heap, not a stack
  const PILE_LOGS = [[0, 0, 0, 1.25, 0.78, 0.036], [0.12, 0, 0.1, 1.9, 0.62, 0.03], [-0.13, 0, -0.06, 0.95, 0.7, 0.032], [0.24, 0, -0.12, 2.3, 0.5, 0.026],
    [0.05, 1, 0.03, 1.6, 0.66, 0.03], [-0.05, 1, -0.02, 0.7, 0.55, 0.026], [0.32, 0, 0.22, 0.4, 0.42, 0.022]];
  function layoutPile() {
    PILE.set(clamp1(0.5 * VW * (6 - 3.7), 0.42, 1.25), 0, 3.7); pileCU.value.set(PILE.x + 0.05, PILE.z);
    PILE_LOGS.forEach(([dx, layer, dz, ry, len, r], i) => {
      tmpV.set(PILE.x + dx, r + layer * 0.05, PILE.z + dz); tmpE.set(0.05 * (i % 2 ? 1 : -1), ry, layer ? 0.12 * (i % 2 ? 1 : -1) : 0.02); tmpQ.setFromEuler(tmpE); tmpS.set(len, r, r);
      tmpM.compose(tmpV, tmpQ, tmpS); pileMesh.setMatrixAt(i, tmpM);
      const hx = Math.cos(ry) * len * 0.46, hz = -Math.sin(ry) * len * 0.46;
      pileSegV[i].set(tmpV.x - hx, tmpV.z - hz, tmpV.x + hx, tmpV.z + hz);
    });
    pileMesh.instanceMatrix.needsUpdate = true;
    // a line of footprints: up from the bottom right, past the pile, to the fire's side
    const path = [[PILE.x + 0.85, 5.9], [PILE.x + 0.42, PILE.z + 0.34], [FIRE.x + 0.62, FIRE.z + 0.3]];
    let seg = 0, along = 0.1, side = 1;
    for (let k = 0; k < NFP; k++) {
      let [ax, az] = path[seg], [bx, bz] = path[seg + 1], L = Math.hypot(bx - ax, bz - az);
      while (along > L && seg < path.length - 2) { along -= L; seg++; [ax, az] = path[seg]; [bx, bz] = path[seg + 1]; L = Math.hypot(bx - ax, bz - az); }
      if (along > L) { printV[k].set(99, 99, 0, 0); continue; }
      const dx = (bx - ax) / L, dz = (bz - az) / L, f = along / L;
      const px = ax + dx * along - dz * 0.075 * side, pz = az + dz * along + dx * 0.075 * side;
      printV[k].set(px, pz, Math.atan2(dx, dz), 0.55 + 0.45 * (k / NFP));
      along += 0.36; side = -side;
    }
  }

  /* ---------- pebbles and shells scattered on the sand, thicker along the wrack line; they catch the firelight ---------- */
  const PEB_N = 100;
  let pebbles;
  function buildPebbles() {
    const g = new THREE.IcosahedronGeometry(1, 1);
    { const p = g.attributes.position, v = new THREE.Vector3();
      for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); v.multiplyScalar(1 + 0.12 * Math.sin(v.x * 4 + v.z * 2.3) + 0.07 * Math.sin(v.y * 5.1)); if (v.y < 0) v.y *= 0.45; p.setXYZ(i, v.x, v.y, v.z); }
      g.computeVertexNormals(); }
    const m = new THREE.MeshBasicNodeMaterial(); m.fog = false;
    m.colorNode = Fn(() => {
      const P = positionWorld, N = normalize(normalWorld);
      const h = hash12(vec2(float(instanceIndex), 5.3)), h2 = hash12(vec2(float(instanceIndex), 9.1));
      const shell = step(0.7, h);
      const stoneC = U.stone.mul(h2.mul(0.6).add(0.75)).mul(mix(vec3(1, 1, 1), vec3(1.15, 1.0, 0.85), step(0.5, h2)));
      const shellC = mix(U.sand.mul(1.35), C3(PAPER).mul(U.day.mul(0.55).add(0.05)), 0.5);
      const ridge = sin(TSL.atan2(positionGeometry.z, positionGeometry.x).mul(14)).mul(0.08).mul(shell).add(1);
      const alb = mix(stoneC, shellC, shell).mul(ridge);
      const sky = N.y.mul(0.4).add(0.62);
      const sunL = max(dot(N, U.sunDir), 0).mul(U.sunVis).mul(U.day).mul(0.3);
      const moonL = max(dot(N, U.moonDir), 0).mul(U.moon).mul(U.night).mul(0.08);
      const Vn = normalize(cameraPosition.sub(P));
      const Lf = normalize(fireU.xyz.add(vec3(0, 0.25, 0)).sub(P));
      const glint = pow(max(dot(normalize(Lf.add(Vn)), N), 0), 24).mul(fireU.w).mul(float(1).div(length(P.xz.sub(fireU.xz)).mul(0.8).add(1)));
      return alb.mul(sky.add(sunL)).add(vec3(0.5, 0.56, 0.58).mul(moonL)).add(C3(col('#B8A48C')).mul(fireLit(P, N)).mul(mix(float(0.8), float(1.05), shell)))
        .add(C3(FIRECOL).mul(glint).mul(0.5));
    })();
    pebbles = new THREE.InstancedMesh(g, m, PEB_N); pebbles.frustumCulled = false; scene.add(pebbles);
  }
  function layoutPebbles() {
    const r = seeded(77);
    const clusters = [[-0.9, 1.4], [1.3 * VW / 0.73, 1.0], [-0.5 * VW / 0.73, 4.1], [0.35, 4.5], [-1.9, 0.6]];
    for (let i = 0; i < PEB_N; i++) {
      let x = 0, z = 0, tries = 0;
      do {
        if (i < 45) { x = lerp(-6, 6, r()); z = shoreZ(x) + 0.55 + r() * 0.5; }                 // along the wrack line
        else if (i < 80) { const c = clusters[i % 5]; z = c[1] + (r() - 0.5) * 0.7; x = c[0] + (r() - 0.5) * 0.9; }   // a few loose clusters
        else { z = lerp(0.2, 4.6, Math.pow(r(), 0.7)); const half = 0.5 * VW * (6 - z) + 0.3; x = lerp(-half, half, r()); }
        tries++;
      } while (tries < 8 && (Math.hypot(x - FIRE.x, z - FIRE.z) < 0.62 || Math.hypot(x - PILE.x, z - PILE.z) < 0.6 || x < duneEdge(z) + 0.15));
      const sz = (i < 45 ? 0.012 : 0.008) + Math.pow(r(), 3) * (i < 45 ? 0.03 : 0.018);
      tmpV.set(x, sz * 0.25, z); tmpE.set(r() * 0.3, r() * 6.28, r() * 0.3); tmpQ.setFromEuler(tmpE);
      tmpS.set(sz * (1 + r() * 0.4), sz * (0.55 + r() * 0.3), sz);
      tmpM.compose(tmpV, tmpQ, tmpS); pebbles.setMatrixAt(i, tmpM);
    }
    pebbles.instanceMatrix.needsUpdate = true;
  }

  /* ---------- a few gulls far out over the sea by day, gliding with a slow wing beat ---------- */
  function buildBirds() {
    const NBIRD = 5;
    const g = new THREE.InstancedBufferGeometry();
    // two thin wings: [forward, flap weight, side]
    const pos = [0.18, 0, 0, -0.14, 0, 0, 0.02, 1, 1, 0.18, 0, 0, 0.02, 1, -1, -0.14, 0, 0];
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const r = seeded(13), a = new Float32Array(NBIRD * 4);
    for (let i = 0; i < NBIRD; i++) a.set([r() * 140, 3.5 + r() * 5, -22 - r() * 26, r() * 6.28], i * 4);
    g.setAttribute('aBird', new THREE.InstancedBufferAttribute(a, 4)); g.instanceCount = NBIRD;
    const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide }); m.fog = false;
    m.positionNode = Fn(() => {
      const b = attribute('aBird', 'vec4'), pg = positionGeometry, t = uTime;
      const head = sin(b.w).mul(0.35);
      const fwd = vec3(TSL.cos(head), 0, sin(head)), side = vec3(sin(head).negate(), 0, TSL.cos(head));
      const x = TSL.mod(b.x.add(t.mul(b.w.mul(0.12).add(0.9))), 110).sub(55);
      const flap = sin(t.mul(2.6).add(b.w.mul(5))).mul(0.5).add(0.25).mul(smoothstep(0.3, 0.7, sin(t.mul(0.21).add(b.w)))).add(0.18);   // beat, then glide
      const c = vec3(x, b.y.add(sin(t.mul(0.3).add(b.w)).mul(0.6)), b.z);
      return c.add(fwd.mul(pg.x).mul(0.9)).add(side.mul(pg.z).mul(0.7)).add(vec3(0, pg.y.mul(flap).mul(0.6), 0));
    })();
    m.colorNode = mix(U.head.mul(0.7), U.hor, 0.35);
    m.opacityNode = smoothstep(0.55, 0.85, U.day).mul(0.8);
    const birds = new THREE.Mesh(g, m); birds.frustumCulled = false; scene.add(birds);
  }

  /* ---------- particles: sparks and embers, smoke, constellation stars, the shooting star's trail ---------- */
  function buildParticles() {
    sparks = new Pool(scene, 160, { additive: true, size: 0.03, color: 0xF0C97A, gain: 2.6, step: (p, dt, t) => {
      const f = p.age / p.life, w = wind(t);
      if (p.spiral) {                                         // stirred: a helix that widens as it rises
        p.ang += p.w * dt; p.rad += 0.07 * dt; p.vy *= Math.exp(-dt * 0.45);
        p.cy += p.vy * dt; p.cx += w * 0.25 * dt * smooth(0.3, 1.5, p.age);
        p.x = p.cx + Math.cos(p.ang) * p.rad; p.z = p.cz + Math.sin(p.ang) * p.rad * 0.8; p.y = p.cy;
      } else {
        p.vy *= Math.exp(-dt * 0.6);
        p.x += (w * 0.6 + Math.sin(t * 2.1 + p.ph) * 0.08) * dt; p.y += p.vy * dt; p.z += Math.cos(t * 1.7 + p.ph) * 0.05 * dt;
      }
      p.s = 1 - 0.5 * f;
      return smooth(0, 0.22, p.age) * (1 - smooth(0.45, 1, f)) * p.b;   // SPEC: each spark rises and fades over at least 0.5 s
    } });
    smoke = new Pool(scene, 80, { size: 0.3, color: 0xCFC6B8, gain: 1, step: (p, dt, t) => {
      const f = p.age / p.life, w = wind(t);
      p.x += (w * smooth(0, 3, p.age) + Math.sin(p.age * 0.7 + p.ph) * 0.06) * dt;
      p.y += p.vy * dt; p.vy = Math.max(0.2, p.vy * Math.exp(-dt * 0.05));
      p.z += Math.cos(p.age * 0.5 + p.ph) * 0.04 * dt - 0.03 * dt;
      p.s = 0.6 + p.age * 0.38;
      return smooth(0, 0.07, f) * (1 - smooth(0.3, 1, f)) * p.a * S.smokeA * (0.55 + 0.45 * smooth(0, 2, p.age));
    } });
    // smoke takes the firelight from below: warm near the flame, cooling to the sky colour as it rises
    { const aP = attribute('aPos', 'vec3');
      const hgt = aP.y.sub(0.3).max(0), fdx = length(aP.xz.sub(fireU.xz));
      const warm = exp(hgt.mul(-1.25)).mul(float(1).div(fdx.mul(fdx).mul(3).add(1))).mul(fireU.w);
      smoke.mesh.material.colorNode = smoke.tint.mul(0.85).add(U.glow.mul(U.sunVis).mul(U.day).mul(0.12)).add(C3(col('#E0A456')).mul(warm).mul(1.3)); }
    trail = new Pool(scene, 160, { additive: true, size: 2.4, color: 0xEFE3CF, gain: 2.2, step: (p) => {
      const f = p.age / p.life; p.s = 1 - 0.6 * f;
      return (1 - f) * (1 - f) * p.b;
    } });
  }

  function buildStars() {
    // brighter stars the visitor can join; fixed seeded directions in the part of the sky the view can reach
    stars = new Pool(scene, STAR_N, { additive: true, size: 2.6, color: 0xF3E8D2, gain: 1.6, step: (p, dt, t) => {
      const lit = p.lit > -1 ? 1 - smooth(45, 60, E.clock - p.lit) : 0;
      const tw = 0.82 + 0.18 * Math.sin(t * p.rate + p.ph);
      p.s = p.s0 * (1 + 0.35 * lit);
      return env.star * p.b * tw * (1 + 0.6 * lit);
    } });
    const r = seeded(29);
    for (let i = 0; i < STAR_N; i++) {
      const az = (r() * 2 - 1) * 48 * DEG, el = (2.5 + Math.pow(r(), 1.15) * 33) * DEG;
      const d = dirAzEl(az, el, new THREE.Vector3());
      const p = { x: CAMP.x + d.x * 300, y: CAMP.y + d.y * 300, z: CAMP.z + d.z * 300, life: Infinity, b: 0.35 + Math.pow(r(), 2.2) * 0.75, s0: 0.6 + r() * 0.7, ph: r() * 6.28, rate: 0.25 + r() * 0.5, lit: -1, el: el / DEG, i };
      p.s = p.s0; starList.push(p); stars.add(p);
    }
    // trace lines: one LineSegments buffer, each segment fades after 60 s
    lineGeo = new THREE.BufferGeometry();
    linePos = new THREE.Float32BufferAttribute(new Float32Array(MAXSEG * 6), 3).setUsage(THREE.DynamicDrawUsage);
    lineBorn = new THREE.Float32BufferAttribute(new Float32Array(MAXSEG * 2).fill(-1e4), 1).setUsage(THREE.DynamicDrawUsage);
    lineGeo.setAttribute('position', linePos); lineGeo.setAttribute('aBorn', lineBorn);
    const lm = new THREE.LineBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }); lm.fog = false;
    const GC = C3(GOLD);
    lm.colorNode = GC.mul(1.5);
    lm.opacityNode = Fn(() => {
      const age = uTime.sub(attribute('aBorn', 'float'));
      return smoothstep(0, 1.4, age).mul(smoothstep(60, 46, age)).mul(0.85);
    })();
    const lines = new THREE.LineSegments(lineGeo, lm); lines.frustumCulled = false; scene.add(lines);
  }

  /* ---------- interactions ---------- */
  function addSegment(a, b) {
    const i = segIdx; segIdx = (segIdx + 1) % MAXSEG;
    const k = 0.985;                                          // slightly in front of the star sprites
    linePos.setXYZ(i * 2, CAMP.x + (a.x - CAMP.x) * k, CAMP.y + (a.y - CAMP.y) * k, CAMP.z + (a.z - CAMP.z) * k);
    linePos.setXYZ(i * 2 + 1, CAMP.x + (b.x - CAMP.x) * k, CAMP.y + (b.y - CAMP.y) * k, CAMP.z + (b.z - CAMP.z) * k);
    lineBorn.setX(i * 2, E.clock); lineBorn.setX(i * 2 + 1, E.clock);
    linePos.needsUpdate = true; lineBorn.needsUpdate = true;
  }
  function nearestStar(x, y, R, skip) {
    let best = -1, bd = R;
    for (const p of starList) {
      if (p.i === skip) continue;
      tmpV.set(p.x, p.y, p.z); const s = toScreen(tmpV); if (!s.front) continue;
      const d = Math.hypot(s.x - x, s.y - y); if (d < bd) { bd = d; best = p.i; }
    }
    return best;
  }
  function joinStar(g, idx) {
    if (idx < 0 || idx === g.last) return;
    const p = starList[idx];
    if (g.last >= 0) addSegment(starList[g.last], p);
    p.lit = E.clock; g.last = idx; g.count++;
    tmpV.set(p.x, p.y, p.z).sub(E.camera.position).normalize().multiplyScalar(12).add(E.camera.position);
    const n = clamp1(Math.round((p.el - 2.5) / 33 * 6) + 2, 0, NOTES_HI.length - 1);
    sound.play('chime', tmpV, 0.5, { note: NOTES_HI[n] });   // SPEC: one soft high note per star, in key; no haptic
  }
  function traceAt(g, x, y) {
    const R = Math.max(30, innerWidth * 0.035);
    // sample along the path so a fast drag still joins the stars it crosses
    const px = g.px ?? x, py = g.py ?? y, steps = Math.max(1, Math.ceil(Math.hypot(x - px, y - py) / 14));
    for (let k = 1; k <= steps; k++) joinStar(g, nearestStar(px + (x - px) * k / steps, py + (y - py) * k / steps, R, g.last));
    g.px = x; g.py = y;
  }

  function stir() {                                          // SPEC: tap the coals: a spiral of sparks for 2 to 3 s
    const n = 54;
    for (let i = 0; i < n; i++) {
      sparks.add({ spiral: true, cx: FIRE.x, cz: FIRE.z, cy: 0.1 + rand(0, 0.15), ang: i * 0.47, rad: 0.04 + rand(0, 0.05), w: 2.4 + rand(-0.3, 0.3),
        vy: rand(0.7, 1.15), life: rand(2.0, 3.0), b: rand(0.6, 1), x: FIRE.x, y: 0.1, z: FIRE.z, age: -i * 0.012 });
    }
    fire.coalBoost = 1;
    sound.play('rush', FIRE_SND, 0.75);
    for (let k = 0; k < 5; k++) fire.crackles.push(E.clock + 0.05 + k * rand(0.08, 0.16));
    haptic(10); focusOn(FIRE_SND, 2.5);
  }

  function wave(x, amp, touched) {                           // SPEC: one wave runs up the sand, leaves a foam line, pulls back
    let k = 0, oldest = Infinity;
    for (let i = 0; i < NW; i++) if (waves[i].x < oldest) { oldest = waves[i].x; k = i; }
    const glow = env.night > 0.5 && Math.random() < (touched ? 0.45 : 0.3) ? 1 : 0;
    waves[k].set(E.clock, x, amp, glow);
    tmpV.set(x, 0, shoreZ(x));
    sound.play('wash', tmpV, touched ? 0.8 : 0.4);
    if (touched) { haptic(15); focusOn(tmpV, 3); }
  }

  function startDrag(p) {
    drag.on = true; drag.state = 'carry';
    dragLog.visible = true; dragLog.position.set(PILE.x, 0.2, PILE.z); dragLog.rotation.set(0, 1.5, 0);
    drag.target.copy(dragLog.position);
    sound.play('scratch', PILE, 0.6); sound.play('rustle', PILE, 0.4);
    focusOn(PILE, 2);
  }
  function moveDrag(x, y) {
    const h = hitPlaneY(x, y, 0.15);
    if (!h) return;
    h.x = clamp1(h.x, -3, 3); h.z = clamp1(h.z, -1, 5.4);
    drag.target.set(h.x, 0.24, h.z);
    drag.over = Math.hypot(h.x - FIRE.x, h.z - FIRE.z) < 0.8 || nearScreen(tmpV.set(FIRE.x, 0.2, FIRE.z), x, y, Math.max(60, innerWidth * 0.07));
  }
  function dropDrag() {
    if (drag.state !== 'carry') return;
    drag.from.copy(dragLog.position); drag.t0 = E.clock;
    if (drag.over) { drag.state = 'falling'; }
    else { drag.state = 'returning'; sound.play('thump', dragLog.position, 0.25, { note: 'C2' }); }
    drag.on = false; drag.over = false;
  }
  function feedLog(fromPos) {                               // the log lands in the fire
    let b = burning.find((x) => !x.active) || burning.reduce((a, c) => (c.t0 < a.t0 ? c : a));
    b.active = true; b.t0 = E.clock; b.ry = rand(0, Math.PI); b.m.visible = true; b.ch.value = 0;
    b.m.position.set(FIRE.x + rand(-0.04, 0.04), 0.1, FIRE.z + rand(-0.04, 0.04)); b.m.rotation.set(0, b.ry, rand(-0.1, 0.1)); b.m.scale.set(0.7, 0.048, 0.048);
    fire.boost = Math.min(fire.boost + 0.55, 0.85); fire.lastLog = E.clock;
    for (let k = 0; k < 14; k++) fire.crackles.push(E.clock + 0.15 + Math.pow(k / 14, 1.3) * 6 + rand(0, 0.2));   // more crackle over 6 s
    setTimeout(() => sound.play('thump', FIRE_SND, 0.6, { note: 'F1' }), 1300);                                    // then a low settle
    haptic(15);
    for (let i = 0; i < 22; i++) sparks.add({ x: FIRE.x + rand(-0.12, 0.12), y: 0.2, z: FIRE.z + rand(-0.1, 0.1), vy: rand(0.6, 1.4), life: rand(1.2, 2.4), b: rand(0.5, 1), ph: rand(0, 6) });
    focusOn(FIRE_SND, 2.5);
  }
  function updateDrag(dt, t) {
    if (drag.state === 'carry') {
      dragLog.position.lerp(drag.target, 1 - Math.exp(-dt * 12));
      dragLog.position.y = 0.22 + Math.sin(t * 2.2) * 0.012;
      dragLog.rotation.y += (1.4 + (dragLog.position.x - drag.target.x) * 0.8 - dragLog.rotation.y) * (1 - Math.exp(-dt * 6));
      flameU.value.y += ((drag.over ? 1 : 0) - flameU.value.y) * (1 - Math.exp(-dt * 4));
    } else flameU.value.y *= Math.exp(-dt * 4);
    if (drag.state === 'falling') {
      const f = clamp1((t - drag.t0) / 0.7, 0, 1), e = easeIO(f);
      dragLog.position.lerpVectors(drag.from, tmpV.set(FIRE.x, 0.1, FIRE.z), e); dragLog.position.y += Math.sin(f * Math.PI) * 0.12;
      if (f >= 1) { dragLog.visible = false; drag.state = 'idle'; feedLog(); }
    } else if (drag.state === 'returning') {
      const f = clamp1((t - drag.t0) / 0.8, 0, 1), e = easeIO(f);
      dragLog.position.lerpVectors(drag.from, tmpV.set(PILE.x, 0.18, PILE.z), e);
      if (f >= 1) { dragLog.visible = false; drag.state = 'idle'; }
    }
  }

  function shootingStar() {                                 // SPEC: stay still 60 to 120 s: one slow shooting star
    const side = Math.random() < 0.5 ? -1 : 1;
    const az0 = side * rand(6, 22) * DEG, el0 = rand(11, 17) * DEG;
    dirAzEl(az0, el0, shoot.a); dirAzEl(az0 - side * rand(16, 24) * DEG, el0 - rand(5, 8) * DEG, shoot.b);
    shoot.on = true; shoot.t0 = E.clock; shoot.dur = rand(2.6, 3.2); shoot.lastF = 0; shoot.tPrev = E.clock;
  }
  function updateShoot(t) {
    if (!shoot.on) return;
    const f = clamp1((t - shoot.t0) / shoot.dur, 0, 1);
    const env_ = smooth(0, 0.22, f) * (1 - smooth(0.72, 1, f)) * clamp1(env.star * 1.2, 0, 1);
    const n = clamp1(Math.ceil((f - shoot.lastF) / 0.004), 1, 12);   // fill the path between frames so the trail stays smooth
    for (let k = 1; k <= n; k++) {
      const ff = lerp(shoot.lastF, f, k / n), e = easeIO(ff) * 0.6 + ff * 0.4;
      tmpV.lerpVectors(shoot.a, shoot.b, e).normalize();
      trail.add({ x: CAMP.x + tmpV.x * 290, y: CAMP.y + tmpV.y * 290, z: CAMP.z + tmpV.z * 290, life: 0.9, b: env_, age: (1 - k / n) * Math.min(0.5, t - shoot.tPrev) });
    }
    shoot.lastF = f; shoot.tPrev = t;
    if (f >= 1) shoot.on = false;
  }

  /* ---------- the fire's life: growth, embers, sparks, smoke, crackle ---------- */
  function updateFire(dt, t, info) {
    const since = t - fire.lastLog;
    fire.boost *= Math.exp(-dt / 170);
    const base = lerp(1.0, 0.16, smooth(240, 600, since));   // SPEC: no log for 10 minutes: the fire sinks to glowing embers
    fire.target = Math.min(1.75, base + fire.boost * smooth(0, 0.6, base + 0.3));
    fire.level += (fire.target - fire.level) * (1 - Math.exp(-dt / 2));     // grows over about 6 s
    fire.coalBoost *= Math.exp(-dt / 1.2);
    const L = fire.level, day = env.day;
    // a slow, small flicker: well under 3 changes a second, so nothing flashes
    const flick = 1 + 0.045 * Math.sin(t * 5.3) * Math.sin(t * 1.7 + 0.4) + 0.03 * Math.sin(t * 7.9 + 1.3);
    const lightK = (1 - 0.82 * day) * flick;
    fireU.value.w = lerp(0.25, 1.0, smooth(0.1, 1, L)) * (0.75 + 0.35 * L) * lightK;
    fireR.value.x = 0.45 + 0.7 * L;
    fireR.value.y = 1 / (0.35 + 0.9 * L);
    flameU.value.x = lerp(1.9, 0.48, day) * (1 + 0.5 * flameU.value.y) * smooth(0.12, 0.5, L);
    coalU.value = (0.75 + 0.35 * Math.min(L, 1) + 0.9 * fire.coalBoost) * lerp(1, 0.45, day);
    shimU.value = smooth(0.2, 1, L) * (0.7 + 0.3 * L);
    flame.scale.set(0.7 + 0.42 * L, 0.38 + 0.58 * L, 1);
    flame.quaternion.copy(E.camera.quaternion);
    shimmer.quaternion.copy(E.camera.quaternion); shimmer.position.y = 0.2 + 0.7 * L; shimmer.scale.setScalar(0.7 + 0.35 * L);
    glowSprite.scale.setScalar((1.5 + 1.1 * L) * (1 + 0.03 * Math.sin(t * 1.3)));
    glowSprite.quaternion.copy(E.camera.quaternion);
    glowU.value = lerp(0.5, 0.06, day) * smooth(0.05, 0.7, L) * flick;
    windU.value = wind(t) - 0.2;

    // ambient sparks and embers
    fire.sparkAcc += dt * (0.6 + 2.6 * L * L);
    while (fire.sparkAcc > 1) { fire.sparkAcc -= 1;
      sparks.add({ x: FIRE.x + rand(-0.12, 0.12), y: 0.15 + 0.3 * L * Math.random(), z: FIRE.z + rand(-0.1, 0.1), vy: rand(0.35, 0.8) * (0.6 + 0.5 * L), life: rand(1.4, 3.0), b: rand(0.35, 0.9) * lerp(1, 0.5, day), ph: rand(0, 6) }); }
    // smoke
    fire.smokeAcc += dt * (3 + 2 * L);
    while (fire.smokeAcc > 1) { fire.smokeAcc -= 1;
      smoke.add({ x: FIRE.x + rand(-0.06, 0.06), y: 0.35 + 0.55 * L, z: FIRE.z + rand(-0.05, 0.05), vy: rand(0.26, 0.4), life: rand(7, 11), a: rand(0.6, 1), ph: rand(0, 6) }); }

    // burning logs char, then sink into the coals over a few minutes
    for (const b of burning) {
      if (!b.active) continue;
      const age = t - b.t0;
      b.ch.value = smooth(0, 8, age);
      const sink = smooth(60, 240, age);
      b.m.scale.set(0.7 * (1 - 0.4 * sink), 0.048 * (1 - 0.85 * sink), 0.048 * (1 - 0.85 * sink));
      b.m.position.y = 0.1 - 0.06 * sink;
      if (age > 240) { b.active = false; b.m.visible = false; }
    }

    // crackle: queued bursts plus random one-shots, more when the fire is big
    if (info.active && !info.resting) {
      while (fire.crackles.length && fire.crackles[0] <= t) { fire.crackles.shift(); sound.play('crackle', FIRE_SND, rand(0.45, 0.9), { dur: rand(0.02, 0.05) }); }
      if (t > fire.nextCrackle) { sound.play('crackle', FIRE_SND, rand(0.25, 0.6) * (0.5 + 0.5 * L), { dur: rand(0.015, 0.04) }); fire.nextCrackle = t + rand(0.7, 2.6) / (0.4 + 0.6 * L); }
    } else fire.crackles.length = 0;
    if (S.hiss && t > fire.nextHiss) {                       // a fizzing layer whose gain jumps in small steps
      const pop = Math.random() < 0.3;
      S.hiss.gain.gain.rampTo((pop ? rand(0.03, 0.07) : rand(0.004, 0.012)) * (0.5 + 0.5 * L) * (S.fireLow && S.fireLow.isLoop ? 0.4 : 1), 0.025);
      fire.nextHiss = t + rand(0.05, 0.16);
    }
    if (S.fireLow) S.fireLow.gain.gain.rampTo(S.fireLow.isLoop ? 0.7 + 0.9 * L : 0.05 + 0.05 * L, 0.5);
  }

  /* ---------- gallery window art: 300 x 200, slow CSS motion, adapted from the bonfire study ---------- */
  const windowArt = () => {
    const r = seeded(41); let st = '';
    for (let i = 0; i < 70; i++) { const big = r() > 0.9; st += `<circle class="fr-st" cx="${(r() * 300).toFixed(1)}" cy="${(Math.pow(r(), 1.2) * 110).toFixed(1)}" r="${(big ? 0.8 + r() * 0.5 : 0.3 + r() * 0.35).toFixed(2)}"/>`; }
    for (let i = 0; i < 40; i++) { const t = r(); st += `<circle cx="${(10 + t * 280).toFixed(1)}" cy="${(90 - t * 80 + (r() - 0.5) * 22).toFixed(1)}" r="${(0.25 + r() * 0.3).toFixed(2)}" opacity=".7"/>`; }
    let sp = '';
    for (let i = 0; i < 12; i++) sp += `<circle class="fr-sp" cx="${(146 + r() * 10).toFixed(1)}" cy="${(162 + r() * 10).toFixed(1)}" r="${(0.4 + r() * 0.6).toFixed(2)}"/>`;
    return `<svg viewBox="0 0 300 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs>
      <linearGradient id="fr-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#090808"/><stop offset=".65" stop-color="#151A1C"/><stop offset="1" stop-color="#2B3739"/></linearGradient>
      <linearGradient id="fr-sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1F2B2D"/><stop offset="1" stop-color="#0F1416"/></linearGradient>
      <linearGradient id="fr-sand" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2A2119"/><stop offset="1" stop-color="#140F0C"/></linearGradient>
      <radialGradient id="fr-light"><stop offset="0" stop-color="#E8A85A" stop-opacity=".75"/><stop offset=".45" stop-color="#B9805F" stop-opacity=".25"/><stop offset="1" stop-color="#B9805F" stop-opacity="0"/></radialGradient>
      <filter id="fr-band" x="-30%" y="-200%" width="160%" height="500%"><feGaussianBlur stdDeviation="10"/></filter>
      <filter id="fr-smoke-b" x="-100%" y="-50%" width="300%" height="200%"><feGaussianBlur stdDeviation="5"/></filter>
    </defs>
    <style>
      .fr-st { animation: fr-tw 6s ease-in-out infinite; }
      .fr-st:nth-child(3n) { animation-duration: 8s; animation-delay: -2s; }
      .fr-st:nth-child(4n+1) { animation-duration: 5s; animation-delay: -4s; }
      @keyframes fr-tw { 0%, 100% { opacity: .35; } 50% { opacity: 1; } }
      .fr-fl { transform-box: fill-box; transform-origin: 50% 100%; animation: fr-flick 1.8s ease-in-out infinite; }
      .fr-fl2 { transform-box: fill-box; transform-origin: 50% 100%; animation: fr-flick 2.3s ease-in-out infinite reverse; }
      @keyframes fr-flick { 0%, 100% { transform: scale(1, 1); } 25% { transform: scale(.96, 1.06); } 50% { transform: scale(1.03, .95); } 75% { transform: scale(.98, 1.04); } }
      .fr-sp { animation: fr-rise 4s ease-out infinite; }
      .fr-sp:nth-child(2n) { animation-duration: 5s; animation-delay: -1.3s; }
      .fr-sp:nth-child(3n) { animation-duration: 3.6s; animation-delay: -2.6s; }
      @keyframes fr-rise { 0% { transform: translate(0, 0); opacity: 0; } 15% { opacity: 1; } 100% { transform: translate(10px, -90px); opacity: 0; } }
      .fr-sm { animation: fr-sm 14s ease-in-out infinite alternate; }
      @keyframes fr-sm { from { transform: translate(0, 0); opacity: .14; } to { transform: translate(22px, -14px); opacity: .05; } }
      .fr-gl { animation: fr-gl 3s ease-in-out infinite; }
      @keyframes fr-gl { 0%, 100% { opacity: .55; } 50% { opacity: .7; } }
      .fr-wv { animation: fr-wv 9s ease-in-out infinite; }
      @keyframes fr-wv { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
      @media (prefers-reduced-motion: reduce) { .fr-st, .fr-fl, .fr-fl2, .fr-sp, .fr-sm, .fr-gl, .fr-wv { animation: none; } }
    </style>
    <rect width="300" height="120" fill="url(#fr-sky)"/>
    <ellipse cx="150" cy="58" rx="170" ry="13" transform="rotate(-16 150 58)" filter="url(#fr-band)" fill="#EFE3CF" opacity=".08"/>
    <ellipse cx="150" cy="58" rx="120" ry="5" transform="rotate(-16 150 58)" filter="url(#fr-band)" fill="#D9A383" opacity=".06"/>
    <g fill="#EFE3CF">${st}</g>
    <path d="M0 116 C30 108 60 104 92 112 L92 118 L0 118Z" fill="#141A1B"/>
    <rect y="116" width="300" height="24" fill="url(#fr-sea)"/>
    <g stroke="#5E7F80" stroke-width=".5" opacity=".35"><line x1="40" y1="121" x2="90" y2="121"/><line x1="130" y1="125" x2="200" y2="125"/><line x1="220" y1="120" x2="270" y2="120"/><line x1="70" y1="132" x2="150" y2="132"/></g>
    <rect y="138" width="300" height="62" fill="url(#fr-sand)"/>
    <g class="fr-wv">
      <path d="M0 140 C40 136 80 143 122 138 S210 136 300 141 L300 145 C210 140 150 144 108 143 S40 141 0 144Z" fill="#3A4846" opacity=".6"/>
      <path d="M0 140.6 C40 136.6 80 143.6 122 138.6 S210 136.6 300 141.6" fill="none" stroke="#EFE3CF" stroke-width=".5" opacity=".45"/>
    </g>
    <path d="M0 200 L0 122 C18 116 40 118 60 128 C78 137 92 158 104 200Z" fill="#120E0B"/>
    <g stroke="#120E0B" stroke-width=".8" stroke-linecap="round" fill="none"><path d="M6 121 Q5 112 2 104"/><path d="M12 119 Q14 110 18 103"/><path d="M20 118 Q19 109 15 101"/><path d="M30 119 Q33 111 36 105"/><path d="M38 121 Q37 113 34 106"/><path d="M47 124 Q50 116 54 111"/><path d="M55 127 Q54 120 51 114"/><path d="M64 131 Q67 124 71 120"/></g>
    <ellipse class="fr-gl" cx="150" cy="178" rx="130" ry="44" fill="url(#fr-light)"/>
    <g transform="translate(236 182) scale(.42) translate(-650 -664)">
      <g transform="rotate(-8 640 664)"><rect x="590" y="656" width="120" height="13" rx="6" fill="#4A3528"/></g>
      <g transform="rotate(12 660 676)"><rect x="606" y="670" width="104" height="11" rx="5" fill="#3B2A20"/></g>
      <g transform="rotate(-2 650 650)"><rect x="612" y="644" width="80" height="10" rx="5" fill="#6B4E3D"/></g>
    </g>
    <g transform="translate(150 182) scale(.4) translate(-422 -664)">
      <g fill="#2E241C"><ellipse cx="364" cy="664" rx="16" ry="9"/><ellipse cx="392" cy="672" rx="15" ry="9"/><ellipse cx="424" cy="676" rx="16" ry="9"/><ellipse cx="456" cy="672" rx="15" ry="9"/><ellipse cx="482" cy="662" rx="14" ry="8"/></g>
      <g fill="#5A4232"><ellipse cx="364" cy="660" rx="12" ry="4"/><ellipse cx="482" cy="658" rx="10" ry="3.5"/></g>
      <g transform="rotate(14 420 652)"><rect x="378" y="646" width="86" height="11" rx="5" fill="#3B2A20"/></g>
      <g transform="rotate(-16 420 652)"><rect x="380" y="646" width="84" height="11" rx="5" fill="#4A3528"/></g>
      <path class="fr-fl" d="M384 656 C376 616 404 600 400 560 C420 584 452 604 446 656Z" fill="#B9805F" opacity=".9"/>
      <path class="fr-fl2" d="M398 656 C394 626 414 612 416 580 C432 604 446 624 440 656Z" fill="#E0A456"/>
      <path class="fr-fl" d="M410 656 C408 638 420 628 422 612 C430 628 436 640 432 656Z" fill="#F6E2B4"/>
    </g>
    <g fill="#F0C97A">${sp}</g>
    <path class="fr-sm" d="M148 160 C138 128 162 104 151 74 C168 98 178 126 158 160Z" filter="url(#fr-smoke-b)" fill="#EFE3CF"/>
  </svg>`;
  };

  let wasStill = 0;
  const S = E.defineScene({
    id: 'fire', title: 'salt, smoke, and stars', defaultHour: 0.9,
    describe: (h) => 'salt, smoke, and stars, a beach fire at ' + hourName(h),
    hourName,
    key: { scale: ['F', 'G', 'A', 'C', 'D'], octave: 3,                   // SPEC: F major pentatonic, one octave lower
      day: [['F2', 'C3', 'G3'], ['C2', 'G2', 'D3'], ['F2', 'A2', 'D3'], ['D2', 'A2', 'G3']],
      night: [['D2', 'A2', 'C3'], ['G1', 'D2', 'A2'], ['D2', 'F2', 'C3'], ['A1', 'G2', 'C3']] },
    camera: CAMP,
    focusFar: 40, focusMid: 5, aperture: 0.0001, maxblur: 0.004,
    smokeA: 0.2,
    windowArt,
    build,
    applyHour(h) {
      sample(h);
      const day = env.day;
      S.smokeA = lerp(0.06, 0.5, smooth(0.05, 0.8, day));                 // by day the smoke is easy to see
      smoke.tint.value.copy(SMOKE_N).lerp(SMOKE_D, smooth(0.02, 0.7, day));
      sparks.tint.value.setHex(0xF0C97A).multiplyScalar(lerp(2.6, 1.4, day));
    },
    resize(vw) { VW = vw; layoutDune(); layoutPile(); layoutPebbles(); },
    enter() {
      fire.lastLog = E.clock; shoot.armedAt = rand(60, 120); shoot.done = false; nextAutoWave = E.clock + rand(10, 20);
    },
    leave() { drag.on = false; if (drag.state === 'carry') { drag.state = 'idle'; dragLog.visible = false; } },
    update(dt, t, info) {
      updateFire(dt, t, info);
      updateDrag(dt, t);
      if (info.active) {
        if (info.still < wasStill - 0.5) { shoot.done = false; shoot.armedAt = rand(60, 120); }   // any input re-arms it
        wasStill = info.still;
        if (!shoot.done && !shoot.on && info.still > shoot.armedAt && !info.resting) { shoot.done = true; if (env.star > 0.2) shootingStar(); }
        if (t > nextAutoWave && !info.resting) { wave(rand(-4, 4), rand(0.45, 0.85), false); nextAutoWave = t + rand(16, 34); }
      }
      updateShoot(t);
      sparks.update(dt, t); smoke.update(dt, t); stars.update(dt, t); trail.update(dt, t);
    },
    skyBody() {
      if (env.sunVis > 0.3 && env.sunEl > -1.5) return env.sunDir;
      if (env.moon > 0.3) return env.moonDir;
      return null;
    },
    focusNear() { return [FIRE_SND, PILE]; },
    pointerDown(p) {
      const { x, y } = p, R = Math.max(46, innerWidth * 0.06);
      if (nearScreen(tmpV.set(PILE.x, 0.1, PILE.z), x, y, R)) { startDrag(p); return { type: 'log' }; }
      if (nearScreen(tmpV.set(FIRE.x, 0.15, FIRE.z), x, y, R)) { stir(); return { type: 'stir' }; }
      const ray = E.rayAt(x, y);
      if (ray.direction.y > 0.003) {
        if (env.star < 0.12) return { type: 'empty' };
        const g = { type: 'trace', last: -1, count: 0 }; traceAt(g, x, y); return g;
      }
      const hit = hitPlaneY(x, y, 0);
      if (hit && hit.z < shoreZ(hit.x) + 1.4 && hit.z > -80) { wave(clamp1(hit.x, -12, 12), rand(1.75, 2.1), true); return { type: 'wave' }; }
      return { type: 'empty' };
    },
    pointerMove(g, p) {
      if (g.type === 'log') moveDrag(p.x, p.y);
      else if (g.type === 'trace') traceAt(g, p.x, p.y);
    },
    pointerUp(g) { if (g.type === 'log') dropDrag(); },
    bed() {                                                               // recorded fire, sea and wind (stand-in noise until the files load)
      S.fireLow = sound.loop('fire-crackle', { gain: 1.4, pos: FIRE_SND, fallback: { type: 'brown', filter: 'lowpass', freq: 420, Q: 0.3, gain: 0.09, pos: FIRE_SND } });
      S.hiss = sound.layer({ type: 'white', filter: 'bandpass', freq: 2600, Q: 0.7, gain: 0.01, pos: FIRE_SND });       // fizz and small pops
      sound.loop('fire-sea', { gain: 0.55, pos: SEA_SND, fallback: { type: 'pink', filter: 'lowpass', freq: 520, Q: 0.3, gain: 0.16, pos: SEA_SND, lfo: { freq: 0.07, min: 200, max: 1000 } } });
      sound.loop('fire-wind', { gain: 0.3, fallback: { type: 'pink', filter: 'bandpass', freq: 380, Q: 0.4, gain: 0.07, lfo: { freq: 0.021, min: 200, max: 560 } } });
    },
    detail() {                                                            // SPEC: one near detail every 8 to 40 s, at a placed position
      const r = Math.random();
      if (r < 0.4) {                                                      // a log settles
        sound.play('thump', FIRE_SND, 0.35, { note: 'F1' });
        fire.crackles.push(E.clock + 0.1, E.clock + 0.25, E.clock + 0.5);
        for (let i = 0; i < 8; i++) sparks.add({ x: FIRE.x + rand(-0.1, 0.1), y: 0.18, z: FIRE.z + rand(-0.1, 0.1), vy: rand(0.5, 1.1), life: rand(1.2, 2.2), b: rand(0.5, 0.9), ph: rand(0, 6) });
      } else if (r < 0.72) {                                             // a soft wave
        if (S.built) wave(rand(-5, 5), rand(0.45, 0.8), false);
        else sound.play('wash', tmpV.set(rand(-5, 5), 0, SH0), 0.35);
      } else sound.play('rustle', tmpV.set(duneEdge(rand(0, 4)) - 0.6, 0.6, rand(0, 4)), 0.55);   // dune grass
    },
    // test hooks
    debug: {
      addLog() { if (drag.state !== 'idle') return; dragLog.visible = true; dragLog.position.set(PILE.x, 0.22, PILE.z); drag.from.copy(dragLog.position); drag.t0 = E.clock; drag.state = 'falling'; },
      stir, wave: (x = 0, amp = 1.9, glow) => { wave(x, amp, true); if (glow !== undefined) waves.forEach((w) => { if (w.x === E.clock) w.w = glow; }); }, shootingStar,
      armShoot(sec) { shoot.done = false; shoot.armedAt = sec; }, get shooting() { return shoot.on; },
      trace(n = 6) { const g = { type: 'trace', last: -1, count: 0 }; const order = starList.filter((p) => p.el < 18 && Math.abs(Math.atan2(p.x, -(p.z - CAMP.z))) < 0.4).slice(0, n); order.forEach((p) => joinStar(g, p.i)); return g.count; },
      embers(sec = 600) { fire.lastLog = E.clock - sec; fire.boost = 0; },
      get fire() { return { level: fire.level, target: fire.target, boost: fire.boost }; },
      get waves() { return waves.map((w) => w.toArray()); },
      get stars() { return starList; }, get pile() { return PILE; }, get firePos() { return FIRE; }, get drag() { return drag.state; },
      shoreZ, get u() { return { fireU, fireR, flameU, coalU, shimU }; }, get glow() { return glowSprite; }, get shimmer() { return shimmer; }, get smoke() { return smoke; }
    }
  });
}

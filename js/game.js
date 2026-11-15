/* ZSurfers — jeu runner 3D (Three.js r128) */
(function () {
'use strict';
const $ = id => document.getElementById(id);
function fail(msg) { const e = $('err'); e.textContent = msg; e.classList.remove('hidden'); }
if (typeof THREE === 'undefined' || !THREE.GLTFLoader) {
  fail('Impossible de charger Three.js (connexion Internet requise pour la bibliothèque 3D). Vérifie ta connexion puis recharge la page.');
  return;
}

/* =====================  RÉGLAGES  ===================== */
const TEX_CATS = [
  { id: 'perso',   name: 'Personnage (skin)',  def: '#e8a33d' },
  { id: 'coin',    name: 'Pièces',             def: '#ffcc00' },
  { id: 'train',   name: 'Trains',             def: '#d9531e' },
  { id: 'taxi',    name: 'Taxi (bonus)',       def: '#ffc400' },
  { id: 'obst',    name: 'Barrières',          def: '#e63946' },
  { id: 'decor',   name: 'Décor de la map',    def: '#7a9e5a' },
  { id: 'ground',  name: 'Sol et rails',       def: '#6b6670' },
  { id: 'envmenu', name: 'Décor du menu',      def: '#9aa7c7' },
  { id: 'sky',     name: 'Ciel / fond',        def: '#8fc7ff', solidOnly: true },
];
const RES = [
  ['auto', 'Auto (taille de la fenêtre)'], ['3840x2160', '3840×2160 (4K)'], ['2560x1440', '2560×1440 (2K)'],
  ['1920x1080', '1920×1080 (Full HD)'], ['1600x900', '1600×900'], ['1280x720', '1280×720 (HD)'],
  ['960x540', '960×540'], ['854x480', '854×480'], ['640x360', '640×360 (pixelisé)'],
  ['1440x1080', '1440×1080 (4:3)'], ['1024x768', '1024×768 (4:3)'], ['800x600', '800×600 (4:3)'], ['640x480', '640×480 (4:3)'],
  ['1080x1080', '1080×1080 (1:1)'], ['custom', 'Personnalisée…'],
];
const DEFAULTS = {
  char: 0, speed: 'normal', flip: false, decor: true, tex: {},
  res: { preset: 'auto', w: 1920, h: 1080, stretch: true },
  chrono: { show: true, color: '#ffd23f', style: 'neon', size: 'm', pos: 'top', stop: 'coin' },
};
TEX_CATS.forEach(c => DEFAULTS.tex[c.id] = { mode: c.solidOnly ? 'solid' : 'orig', color: c.def });
let S;
try { S = JSON.parse(localStorage.getItem('zs_settings2') || 'null'); } catch (e) { S = null; }
S = Object.assign({}, DEFAULTS, S || {});
S.tex = Object.assign({}, DEFAULTS.tex, S.tex || {});
S.res = Object.assign({}, DEFAULTS.res, S.res || {});
S.chrono = Object.assign({}, DEFAULTS.chrono, S.chrono || {});
function save() { try { localStorage.setItem('zs_settings2', JSON.stringify(S)); } catch (e) {} }
let best = 0; try { best = +localStorage.getItem('zs_best') || 0; } catch (e) {}

/* =====================  RENDU  ===================== */
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.outputEncoding = THREE.sRGBEncoding;
const menuScene = new THREE.Scene(), gameScene = new THREE.Scene();
const menuCam = new THREE.PerspectiveCamera(55, 16 / 9, 0.1, 500);
const gameCam = new THREE.PerspectiveCamera(65, 16 / 9, 0.1, 400);
function applyResolution() {
  const ww = innerWidth, wh = innerHeight, r = S.res;
  let rw, rh;
  if (r.preset === 'auto') { const pr = Math.min(devicePixelRatio || 1, 2); rw = Math.round(ww * pr); rh = Math.round(wh * pr); }
  else if (r.preset === 'custom') { rw = Math.max(160, Math.min(7680, r.w | 0)); rh = Math.max(90, Math.min(4320, r.h | 0)); }
  else { const p = r.preset.split('x'); rw = +p[0]; rh = +p[1]; }
  renderer.setPixelRatio(1); renderer.setSize(rw, rh, false);
  let cw = ww, ch = wh, cl = 0, ct = 0;
  if (r.preset !== 'auto' && !r.stretch) {
    const k = Math.min(ww / rw, wh / rh); cw = rw * k; ch = rh * k; cl = (ww - cw) / 2; ct = (wh - ch) / 2;
  }
  Object.assign(canvas.style, { left: cl + 'px', top: ct + 'px', width: cw + 'px', height: ch + 'px' });
  menuCam.aspect = gameCam.aspect = rw / rh;
  menuCam.updateProjectionMatrix(); gameCam.updateProjectionMatrix();
  const inf = $('resInfo'); if (inf) inf.textContent = 'Rendu interne : ' + rw + '×' + rh + ' → affiché en ' + Math.round(cw) + '×' + Math.round(ch);
}
addEventListener('resize', applyResolution); applyResolution();
function addLights(sc) {
  sc.add(new THREE.HemisphereLight(0xffffff, 0x8a8a9a, 0.95));
  const d = new THREE.DirectionalLight(0xffffff, 0.75); d.position.set(-6, 14, 8); sc.add(d);
}
addLights(menuScene); addLights(gameScene);

/* =====================  MATÉRIAUX (textures / couleur unie)  ===================== */
const REG = {}; TEX_CATS.forEach(c => REG[c.id] = []);
function register(cat, mat) { mat.userData.orig = { map: mat.map || null, color: mat.color.clone() }; REG[cat].push(mat); applyMat(cat, mat); return mat; }
function applyMat(cat, mat) {
  const t = S.tex[cat], o = mat.userData.orig;
  if (t.mode === 'solid') { mat.map = null; mat.color.set(t.color); } else { mat.map = o.map; mat.color.copy(o.color); }
  mat.needsUpdate = true;
}
function applyCat(cat) { if (cat === 'sky') { applySky(); return; } REG[cat].forEach(m => applyMat(cat, m)); }
function applySky() {
  const c = new THREE.Color(S.tex.sky.color);
  menuScene.background = c; gameScene.background = c; gameScene.fog = new THREE.Fog(c, 45, 150);
}
function convMat(m, cat, basic) {
  if (m.userData.zsConv) return m.userData.zsConv;
  const opt = { map: m.map || null, color: m.color ? m.color.clone() : new THREE.Color(1, 1, 1), transparent: m.transparent, opacity: m.opacity, alphaTest: m.alphaTest, side: THREE.DoubleSide };
  const n = basic ? new THREE.MeshBasicMaterial(opt) : new THREE.MeshLambertMaterial(opt);
  m.userData.zsConv = n; return register(cat, n);
}
function convertTree(root, cat, basic) {
  root.traverse(o => {
    if (!o.isMesh) return;
    o.material = Array.isArray(o.material) ? o.material.map(m => convMat(m, cat, basic)) : convMat(o.material, cat, basic);
    if (o.isSkinnedMesh) o.frustumCulled = false;
  });
}

/* =====================  UTILITAIRES  ===================== */
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const smooth = (a, b, v) => { let t = (v - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };
const easeIO = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
function b64buf(b) { const s = atob(b), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }
function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Fichier introuvable : ' + src)); document.body.appendChild(s); }); }

/* =====================  PARTICULES  ===================== */
class Particles {
  constructor(scene, n) {
    this.n = n; this.p = []; this.ptr = 0;
    this.mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.5, 0), new THREE.MeshBasicMaterial({ color: 0xffffff }), n);
    this.mesh.frustumCulled = false; this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.m4 = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.v = new THREE.Vector3(); this.s = new THREE.Vector3(); this.c = new THREE.Color();
    for (let i = 0; i < n; i++) { this.p.push({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, size: 1, g: 0, st: 1, col: 0xffffff, rot: 0, sz0: 1, sz1: 1, drag: 0, grow: false }); this.mesh.setColorAt(i, this.c.set(0xffffff)); this.hide(i); }
    scene.add(this.mesh);
  }
  hide(i) { this.m4.makeScale(0, 0, 0); this.mesh.setMatrixAt(i, this.m4); }
  emit(o) {
    const p = this.p[this.ptr]; const i = this.ptr; this.ptr = (this.ptr + 1) % this.n;
    p.life = p.max = o.life || 0.6; p.x = o.x; p.y = o.y; p.z = o.z; p.vx = o.vx || 0; p.vy = o.vy || 0; p.vz = o.vz || 0;
    p.size = o.size || 0.2; p.sz0 = o.sz0 !== undefined ? o.sz0 : p.size; p.sz1 = o.sz1 !== undefined ? o.sz1 : p.sz0; p.drag = o.drag || 0; p.grow = !!o.grow; p.g = o.g === undefined ? 6 : o.g; p.st = o.st || 1; p.rot = rnd(0, 6.28);
    this.mesh.setColorAt(i, this.c.set(o.col === undefined ? 0xffffff : o.col)); this.mesh.instanceColor.needsUpdate = true;
  }
  burst(x, y, z, n, o) {
    for (let i = 0; i < n; i++) {
      const a = rnd(0, 6.283), sp = rnd(0.3, 1) * (o.speed || 4), up = rnd(0.2, 1);
      this.emit({ x, y, z, vx: Math.cos(a) * sp, vy: up * (o.up || 4), vz: Math.sin(a) * sp, life: rnd(0.4, 1) * (o.life || 0.8), size: rnd(0.6, 1) * (o.size || 0.2), g: o.g === undefined ? 9 : o.g, col: Array.isArray(o.col) ? pick(o.col) : o.col });
    }
  }
  update(dt) {
    for (let i = 0; i < this.n; i++) {
      const p = this.p[i]; if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) { this.hide(i); continue; }
      if (p.drag) { const dg = Math.exp(-p.drag * dt); p.vx *= dg; p.vy *= dg; p.vz *= dg; }
      p.vy -= p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.02 && p.g > 0 && !p.grow) { p.y = 0.02; p.vy *= -0.3; p.vx *= 0.8; p.vz *= 0.8; }
      const kk = p.life / p.max; let sz;
      if (p.grow) { const t = 1 - kk; sz = (p.sz0 + (p.sz1 - p.sz0) * Math.sqrt(t)) * Math.min(1, kk / 0.35); } else sz = p.size * Math.sqrt(kk);
      this.v.set(p.x, p.y, p.z); this.s.set(sz, sz, sz * p.st);
      this.q.setFromAxisAngle(this.v.set(0, 1, 0), p.rot + (p.grow ? (1 - kk) * 0.8 : 0)); this.v.set(p.x, p.y, p.z);
      this.m4.compose(this.v, this.q, this.s); this.mesh.setMatrixAt(i, this.m4);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
let gParts, mParts;

/* =====================  RIG / ANIMATION DES OS  ===================== */
const POSE_KEYS = ['hp', 'hr', 'hy', 'sp', 'sr', 'sy', 'dp', 'dr', 'dy', 'aLd', 'aLs', 'aLb', 'aRd', 'aRs', 'aRb', 'lLs', 'lLb', 'lRs', 'lRb'];
const newPose = () => { const o = {}; POSE_KEYS.forEach(k => o[k] = 0); return o; };
const aq = (axis, ang) => new THREE.Quaternion().setFromAxisAngle(axis, ang);

/* ----- Rig CPU : déformation des sommets par os (testé hors-ligne) ----- */
const CHAR_H = 1.8;
const _T1 = new THREE.Matrix4(), _T2 = new THREE.Matrix4(), _R = new THREE.Matrix4(), _Q = new THREE.Matrix4();
function rotM(out, ry, rz, rx) { out.makeRotationY(ry); out.multiply(_Q.makeRotationZ(rz)); out.multiply(_Q.makeRotationX(rx)); return out; }
function aboutM(out, pv, R) { _T1.makeTranslation(pv.x, pv.y, pv.z); _T2.makeTranslation(-pv.x, -pv.y, -pv.z); out.copy(_T1).multiply(R).multiply(_T2); return out; }
class CpuRig {
  // src : [{ pos, nrm, uv, idx, used, mat }] déjà normalisés (hauteur CHAR_H, pieds à y=0, centré x/z)
  constructor(src, flip) {
    const H = CHAR_H; this.group = new THREE.Group();
    const rest = src.map(s => { const pos = new Float32Array(s.pos), nrm = new Float32Array(s.nrm); if (flip) for (let i = 0; i < pos.length; i += 3) { pos[i] = -pos[i]; pos[i + 2] = -pos[i + 2]; nrm[i] = -nrm[i]; nrm[i + 2] = -nrm[i + 2]; } return { s, pos, nrm }; });
    // hauteur d’épaules : tranches où la largeur est maximale
    const nb = 23, ext = new Float32Array(nb); let g = 0;
    rest.forEach(r => { const u = r.s.used; for (let i = 0; i < u.length; i++) if (u[i]) { const y = r.pos[i * 3 + 1]; const k = Math.floor((y - 0.4 * H) / (0.025 * H)); if (k >= 0 && k < nb) { const ax = Math.abs(r.pos[i * 3]); if (ax > ext[k]) ext[k] = ax; } } });
    for (let k = 0; k < nb; k++) if (ext[k] > g) g = ext[k];
    let shY = 0.62 * H; if (g > 0.25 * H) { let sy = 0, c = 0; for (let k = 0; k < nb; k++) if (ext[k] > 0.7 * g) { sy += 0.4 * H + (k + 0.5) * 0.025 * H; c++; } shY = sy / c; }
    // largeur du torse (sous la bande des bras) et portée des bras
    const tws = [], bandX = [];
    rest.forEach(r => { const u = r.s.used; for (let i = 0; i < u.length; i++) if (u[i]) { const y = r.pos[i * 3 + 1], ax = Math.abs(r.pos[i * 3]); if (y > shY - 0.27 * H && y < shY - 0.13 * H) tws.push(ax); if (y > shY - 0.17 * H && y < shY + 0.17 * H) bandX.push(ax); } });
    tws.sort((a, b) => a - b);
    const tw = tws.length > 5 ? tws[Math.floor(tws.length * 0.8)] : 0.1 * H;
    const t0 = Math.min(Math.max(tw * 1.05, 0.14 * H), 0.5 * H);
    const maxX = bandX.length ? Math.max.apply(null, bandX) : 0.5 * H, elbow = t0 + 0.5 * Math.max(maxX - t0, 0.1 * H);
    const hipY = 0.42 * H, neckY = Math.max(0.68 * H, shY + 0.07 * H), kneeY = 0.22 * H;
    const V = (x, y) => new THREE.Vector3(x, y, 0);
    this.piv = { hips: V(0, hipY), spine: V(0, hipY), head: V(0, neckY), armL: V(-(t0 - 0.02 * H), shY), armR: V(t0 - 0.02 * H, shY), foreL: V(-elbow, shY), foreR: V(elbow, shY), legL: V(-0.06 * H, hipY), legR: V(0.06 * H, hipY), kneeL: V(-0.06 * H, kneeY), kneeR: V(0.06 * H, kneeY) };
    this.M = []; for (let i = 0; i < 11; i++) this.M.push(new THREE.Matrix4()); this.tmp = new THREE.Matrix4(); this.tmp2 = new THREE.Matrix4(); this.parts = [];
    const W = new Float32Array(11);
    rest.forEach(r => {
      const n = r.pos.length / 3, bi = new Uint8Array(n * 4), bw = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) {
        const x = r.pos[i * 3], y = r.pos[i * 3 + 1], ax = Math.abs(x);
        const wl = smooth(hipY + 0.05 * H, hipY - 0.05 * H, y), sL = smooth(0.03, -0.03, x);
        const band = smooth(shY - 0.17 * H, shY - 0.10 * H, y) * smooth(shY + 0.17 * H, shY + 0.10 * H, y);
        const wa = smooth(t0, t0 + 0.08 * H, ax) * band * (1 - wl), wf = smooth(elbow - 0.02 * H, elbow + 0.03 * H, ax);
        const wh = smooth(neckY - 0.03 * H, neckY + 0.04 * H, y) * (1 - wa) * (1 - wl), wsp = Math.max(0, 1 - wl - wa - wh), wk = smooth(kneeY + 0.04 * H, kneeY - 0.04 * H, y);
        const left = x < 0; W.fill(0);
        W[1] = wsp; W[2] = wh;
        if (left) { W[3] = wa * (1 - wf); W[5] = wa * wf; } else { W[4] = wa * (1 - wf); W[6] = wa * wf; }
        W[7] = wl * sL * (1 - wk); W[8] = wl * (1 - sL) * (1 - wk); W[9] = wl * sL * wk; W[10] = wl * (1 - sL) * wk;
        let tot = 0;
        for (let k = 0; k < 4; k++) { let bj = 0, bv = 0; for (let j = 0; j < 11; j++) if (W[j] > bv) { bv = W[j]; bj = j; } bi[i * 4 + k] = bj; bw[i * 4 + k] = bv; tot += bv; W[bj] = 0; }
        if (tot < 1e-6) { bw[i * 4] = 1; bi[i * 4] = 1; tot = 1; }
        for (let k = 0; k < 4; k++) bw[i * 4 + k] /= tot;
      }
      const geo = new THREE.BufferGeometry();
      const pa = new THREE.BufferAttribute(new Float32Array(r.pos), 3); pa.setUsage(THREE.DynamicDrawUsage);
      const na = new THREE.BufferAttribute(new Float32Array(r.nrm), 3); na.setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute('position', pa); geo.setAttribute('normal', na); if (r.s.uv) geo.setAttribute('uv', r.s.uv); geo.setIndex(r.s.idx);
      const mesh = new THREE.Mesh(geo, r.s.mat); mesh.frustumCulled = false; this.group.add(mesh);
      this.parts.push({ rest: r, bi, bw, pa, na });
    });
  }
  apply(p) {
    const P = this.piv, M = this.M, R = _R, t = this.tmp;
    aboutM(M[0], P.hips, rotM(R, p.hy, p.hr, p.hp));
    aboutM(t, P.spine, rotM(R, p.sy, p.sr, p.sp)); M[1].copy(M[0]).multiply(t);
    aboutM(t, P.head, rotM(R, p.dy, p.dr, p.dp)); M[2].copy(M[1]).multiply(t);
    aboutM(t, P.armL, R.makeRotationX(-p.aLs).multiply(_Q.makeRotationZ(p.aLd))); M[3].copy(M[1]).multiply(t);
    aboutM(t, P.armR, R.makeRotationX(-p.aRs).multiply(_Q.makeRotationZ(-p.aRd))); M[4].copy(M[1]).multiply(t);
    aboutM(t, P.foreL, R.makeRotationY(p.aLb)); M[5].copy(M[3]).multiply(t);
    aboutM(t, P.foreR, R.makeRotationY(-p.aRb)); M[6].copy(M[4]).multiply(t);
    aboutM(t, P.legL, R.makeRotationX(-p.lLs)); M[7].copy(M[0]).multiply(t);
    aboutM(t, P.legR, R.makeRotationX(-p.lRs)); M[8].copy(M[0]).multiply(t);
    aboutM(t, P.kneeL, R.makeRotationX(p.lLb)); M[9].copy(M[7]).multiply(t);
    aboutM(t, P.kneeR, R.makeRotationX(p.lRb)); M[10].copy(M[8]).multiply(t);
    const E = M.map(m => m.elements);
    for (const pt of this.parts) {
      const rp = pt.rest.pos, rn = pt.rest.nrm, op = pt.pa.array, on = pt.na.array, bi = pt.bi, bw = pt.bw, n = rp.length / 3;
      for (let i = 0; i < n; i++) {
        const x = rp[i * 3], y = rp[i * 3 + 1], z = rp[i * 3 + 2], nx = rn[i * 3], ny = rn[i * 3 + 1], nz = rn[i * 3 + 2];
        let X = 0, Y = 0, Z = 0, NX = 0, NY = 0, NZ = 0;
        for (let k = 0; k < 4; k++) {
          const w = bw[i * 4 + k]; if (w === 0) continue; const e = E[bi[i * 4 + k]];
          X += w * (e[0] * x + e[4] * y + e[8] * z + e[12]); Y += w * (e[1] * x + e[5] * y + e[9] * z + e[13]); Z += w * (e[2] * x + e[6] * y + e[10] * z + e[14]);
          NX += w * (e[0] * nx + e[4] * ny + e[8] * nz); NY += w * (e[1] * nx + e[5] * ny + e[9] * nz); NZ += w * (e[2] * nx + e[6] * ny + e[10] * nz);
        }
        op[i * 3] = X; op[i * 3 + 1] = Y; op[i * 3 + 2] = Z; on[i * 3] = NX; on[i * 3 + 1] = NY; on[i * 3 + 2] = NZ;
      }
      pt.pa.needsUpdate = true; pt.na.needsUpdate = true;
    }
  }
}

/* ----- Normalisation / chargement ----- */
const gltfLoader = new THREE.GLTFLoader(); const gcache = {};
async function getModel(key) {
  if (gcache[key]) return gcache[key];
  if (!window.ZS_MODELS || !window.ZS_MODELS[key]) await loadScript('js/models/' + key + '.js');
  const buf = b64buf(window.ZS_MODELS[key]).buffer; delete window.ZS_MODELS[key];
  return gcache[key] = await new Promise((res, rej) => gltfLoader.parse(buf, '', res, rej));
}
function objBox(obj) {
  const box = new THREE.Box3(), v = new THREE.Vector3(); obj.updateMatrixWorld(true);
  obj.traverse(o => {
    if (o.isSkinnedMesh) { o.skeleton.update(); const p = o.geometry.attributes.position; for (let i = 0; i < p.count; i += 2) { v.fromBufferAttribute(p, i); o.boneTransform(i, v); v.applyMatrix4(o.matrixWorld); box.expandByPoint(v); } }
    else if (o.isMesh) { o.geometry.computeBoundingBox(); box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld)); }
  });
  return box;
}
function normalize(obj, h) {
  const b = objBox(obj), size = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
  const k = h / (size.y || 1), g = new THREE.Group(), pivot = new THREE.Group();
  obj.position.set(-c.x, -b.min.y, -c.z); pivot.add(obj); pivot.scale.setScalar(k); g.add(pivot); return g;
}

const CHARS = []; // { name, make(flip) -> CpuRig }
let inspectorSrc = null, coinProto = null, jetProto = null, trainProto = null, taxiProto = null, taxiBox = null, decorProtos = [];
let envRoot = null, envMixer = null, groundY = 0; const envCenter = new THREE.Vector3(10.5, 0, 4);

function normalizeSource(items, h) {
  const mn = new THREE.Vector3(1e9, 1e9, 1e9), mx = new THREE.Vector3(-1e9, -1e9, -1e9);
  items.forEach(it => {
    it.used = new Uint8Array(it.pos.length / 3); for (let k = 0; k < it.idx.length; k++) it.used[it.idx[k]] = 1;
    for (let i = 0; i < it.used.length; i++) if (it.used[i]) { const x = it.pos[i * 3], y = it.pos[i * 3 + 1], z = it.pos[i * 3 + 2]; if (x < mn.x) mn.x = x; if (y < mn.y) mn.y = y; if (z < mn.z) mn.z = z; if (x > mx.x) mx.x = x; if (y > mx.y) mx.y = y; if (z > mx.z) mx.z = z; }
  });
  const k = h / (mx.y - mn.y), cx = (mn.x + mx.x) / 2, cz = (mn.z + mx.z) / 2;
  return items.map(it => {
    for (let i = 0; i < it.pos.length; i += 3) { it.pos[i] = (it.pos[i] - cx) * k; it.pos[i + 1] = (it.pos[i + 1] - mn.y) * k; it.pos[i + 2] = (it.pos[i + 2] - cz) * k; }
    const idxAttr = new THREE.BufferAttribute(new Uint32Array(it.idx), 1);
    if (!it.nrm) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(it.pos, 3)); g.setIndex(idxAttr); g.computeVertexNormals(); it.nrm = g.attributes.normal.array; }
    return { pos: it.pos, nrm: it.nrm, uv: it.uv, idx: idxAttr, used: it.used, mat: it.mat };
  });
}
// « Cuit » un modèle (même skinné) dans sa pose de repos : positions en espace monde
function bakeItems(root, filter) {
  root.updateMatrixWorld(true); const items = [], v = new THREE.Vector3();
  root.traverse(o => {
    if (!o.isMesh || (filter && !filter(o))) return;
    const g = o.geometry, p = g.attributes.position, n = p.count, pos = new Float32Array(n * 3);
    if (o.isSkinnedMesh) o.skeleton.update();
    for (let i = 0; i < n; i++) { v.fromBufferAttribute(p, i); if (o.isSkinnedMesh) o.boneTransform(i, v); v.applyMatrix4(o.matrixWorld); pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z; }
    let idx; if (g.index) idx = Array.from(g.index.array); else { idx = []; for (let i = 0; i < n; i++) idx.push(i); }
    items.push({ pos, nrm: null, uv: g.attributes.uv || null, idx, mat: Array.isArray(o.material) ? o.material[0] : o.material });
  });
  return items;
}
function prepareCharacters(gltf) {
  gltf.scene.updateMatrixWorld(true);
  const pieces = {}; gltf.scene.traverse(o => { if (o.isMesh && window.ZS_MASKS[o.name]) pieces[o.name] = o; });
  window.ZS_CHAR_ORDER.forEach(nm => {
    const o = pieces[nm]; if (!o) return;
    const g = o.geometry, mask = b64buf(window.ZS_MASKS[nm]), ia = g.index.array, out = [];
    for (let k = 0; k < ia.length; k += 3) if (mask[ia[k]] && mask[ia[k + 1]] && mask[ia[k + 2]]) out.push(ia[k], ia[k + 1], ia[k + 2]);
    const ng = new THREE.BufferGeometry(); ['position', 'normal'].forEach(a => { if (g.attributes[a]) ng.setAttribute(a, g.attributes[a].clone()); }); ng.applyMatrix4(o.matrixWorld);
    const mat = convMat(Array.isArray(o.material) ? o.material[0] : o.material, 'perso');
    const src = normalizeSource([{ pos: new Float32Array(ng.attributes.position.array), nrm: new Float32Array(ng.attributes.normal.array), uv: g.attributes.uv, idx: out, mat }], CHAR_H);
    CHARS.push({ name: 'Surfeur ' + (CHARS.length + 1), make: flip => new CpuRig(src, flip) });
  });
}
function addBakedChar(name, gltf, h, filter) {
  convertTree(gltf.scene, 'perso');
  let items = bakeItems(gltf.scene, filter); if (!items.length) items = bakeItems(gltf.scene, null);
  const src = normalizeSource(items, h);
  CHARS.push({ name, make: flip => new CpuRig(src, flip) });
}

/* =====================  ACTEUR (pose + lissage)  ===================== */
class Actor {
  constructor(idx) {
    this.rig = CHARS[idx % CHARS.length].make(S.flip); this.phi = 0;
    this.cur = newPose(); this.tgt = newPose(); this.group = new THREE.Group(); this.group.add(this.rig.group);
  }
  step(dt, k) {
    const a = 1 - Math.exp(-(k || 16) * dt);
    for (const key of POSE_KEYS) this.cur[key] += (this.tgt[key] - this.cur[key]) * a;
    this.rig.apply(this.cur);
  }
  snap() { for (const key of POSE_KEYS) this.cur[key] = this.tgt[key]; this.rig.apply(this.cur); }
}
// Poses cibles
function poseTarget(t, mode, o) {
  const p = newPose(), s = Math.sin, c = Math.cos;
  switch (mode) {
    case 'idle': {
      const br = s(o.t * 2.2), w = (o.t % 9) < 2.2 ? 1 : 0;
      p.hp = 0.03 + 0.015 * br; p.sp = 0.03 * br; p.dy = s(o.t * 0.7) * 0.55; p.dp = s(o.t * 0.5) * 0.12 - 0.03; p.hr = s(o.t * 0.8) * 0.03;
      p.aLd = 1.38 + 0.04 * br; p.aLs = s(o.t * 1.3) * 0.06; p.aLb = 0.25; p.aRd = 1.38 - 0.04 * br; p.aRs = -s(o.t * 1.3) * 0.06; p.aRb = 0.25;
      if (w) { p.aRd = -0.9 + s(o.t * 3) * 0.1; p.aRs = 0; p.aRb = 0.5 + s(o.t * 11) * 0.7; p.dr = -0.1; p.dy = 0.4; }
      p.lLs = 0.03; p.lRs = -0.03; break;
    }
    case 'run': {
      const ph = o.ph, sp = o.spd, sd = o.side || 0;
      for (const [k, off] of [['L', 0], ['R', Math.PI]]) {
        const f = ph + off, a2 = f + Math.PI;
        p['l' + k + 's'] = 0.30 + (0.80 + 0.2 * sp) * s(f);                       // cuisse
        p['l' + k + 'b'] = 0.25 + 1.25 * Math.pow(Math.max(0, s(f - 0.9)), 1.3);  // genou
        p['a' + k + 's'] = 0.15 + (0.95 + 0.15 * sp) * s(a2);                     // bras opposé à la jambe
        p['a' + k + 'd'] = 1.12; p['a' + k + 'b'] = 1.55 - 0.25 * s(a2);          // coude ~90°
      }
      p.hp = 0.30 + 0.08 * sp + 0.03 * c(2 * ph); p.sp = 0.10; p.dp = -0.34;
      p.hy = 0.12 * s(ph); p.sy = -0.26 * s(ph); p.hr = 0.05 * c(ph); p.sr = -0.06 * c(ph); p.dy = -0.12 * s(ph);
      p.hr += -sd * 0.28; p.sr += -sd * 0.2; p.dy += sd * 0.5; p.hy += sd * 0.35;
      p.aLd += Math.max(0, sd) * 0.7; p.aRd += Math.max(0, -sd) * 0.7; p.aLs += Math.max(0, sd) * 0.3; p.aRs += Math.max(0, -sd) * 0.3; p.lLs += Math.max(0, -sd) * 0.4; p.lRs += Math.max(0, sd) * 0.4;
      break;
    }
    case 'sit': { // assis au volant du taxi
      const st = o.steer || 0, im = o.impact || 0;
      p.lLs = 1.5; p.lRs = 1.5; p.lLb = 1.45; p.lRb = 1.45;
      p.aLd = 1.0 - st * 0.1; p.aRd = 1.0 + st * 0.1; p.aLs = 1.2 + st * 0.15; p.aRs = 1.2 - st * 0.15; p.aLb = 0.75; p.aRb = 0.75;
      p.sp = -0.05 - im * 0.25; p.dp = 0.03 + im * 0.35 + s(o.t * 3) * 0.02; p.dy = st * 0.5 + s(o.t * 0.9) * 0.08; p.dr = -st * 0.15;
      p.hr = st * 0.1; p.sr = st * 0.08 + s(o.t * 26) * 0.012; p.hp = 0.02;
      break;
    }
    case 'jump': {
      const up = o.vy > 0;
      p.aLd = up ? 0.55 : 0.9; p.aRd = p.aLd; p.aLs = up ? 2.4 : 1.3; p.aRs = p.aLs; p.aLb = 0.3; p.aRb = 0.3;
      p.lLs = up ? 1.1 : 0.5; p.lLb = up ? 1.7 : 0.9; p.lRs = up ? -0.35 : -0.4; p.lRb = up ? 0.8 : 0.5;
      p.hp = up ? 0.12 : 0.02; p.sp = up ? -0.1 : 0; p.dp = up ? -0.18 : -0.05; p.sy = s(o.t * 18) * 0.04;
      break;
    }
    case 'roll': { // somersault + crouch
      p.hp = 0.75; p.sp = 1.0; p.dp = 0.4; p.lLs = 1.9; p.lRs = 1.7; p.lLb = 2.2; p.lRb = 2.2; p.aLd = 1.3; p.aRd = 1.3; p.aLs = 1.2; p.aRs = 1.2; p.aLb = 1.7; p.aRb = 1.7; break;
    }
    case 'slide': {
      p.hp = 0.55; p.sp = 0.5; p.dp = -0.3; p.lLs = 1.3; p.lRs = 1.0; p.lLb = 1.7; p.lRb = 1.9; p.aLd = 0.9; p.aRd = 0.9; p.aLs = -0.9; p.aRs = -0.9; p.aLb = 0.9; p.aRb = 0.9; p.hr = s(o.t * 12) * 0.03; break;
    }
    case 'stumble': {
      const f = s(o.t * 28);
      p.hp = -0.32; p.sp = -0.25; p.dp = -0.5 - 0.15 * f; p.dr = f * 0.25; p.hr = f * 0.1;
      p.aLd = 0.35 + f * 0.25; p.aRd = 0.35 - f * 0.25; p.aLs = -0.9; p.aRs = -0.5; p.aLb = 0.4; p.aRb = 0.4;
      p.lLs = 0.7; p.lLb = 0.8; p.lRs = -0.5; p.lRb = 0.6; break;
    }
    case 'dead': {
      p.hp = -0.2; p.dp = -0.7; p.dr = s(o.t * 8) * 0.2; p.aLd = 0.15; p.aRd = 0.15; p.aLs = -0.4; p.aRs = 0.4; p.aLb = 0.1; p.aRb = 0.1; p.lLs = -0.3; p.lRs = 0.4; p.lLb = 0.2; p.lRb = 0.3; break;
    }
    case 'fly': {
      p.hp = 1.1; p.sp = -0.1; p.dp = -0.9; p.aLd = 1.3; p.aRd = 1.3; p.aLs = 2.9; p.aRs = 2.9; p.aLb = 0.1; p.aRb = 0.1;
      p.lLs = -0.25 + s(o.t * 9) * 0.1; p.lRs = -0.3 - s(o.t * 9) * 0.1; p.lLb = 0.5; p.lRb = 0.6; break;
    }
    case 'chase': { // inspecteur : course agressive
      const ph = o.ph, sn = s(ph), cs = c(ph);
      p.lLs = sn * 1.0; p.lRs = -sn * 1.0; p.lLb = 0.2 + 1.0 * Math.max(0, 0.4 - cs * 0.5); p.lRb = 0.2 + 1.0 * Math.max(0, 0.4 + cs * 0.5);
      p.aLd = 1.0; p.aRd = 1.0; p.aLs = -sn * 0.9 - 0.2; p.aRs = sn * 0.9 - 0.2; p.aLb = 1.1; p.aRb = 1.1;
      p.hp = 0.28; p.hy = sn * 0.12; p.sy = -sn * 0.18; p.dp = -0.25; p.hr = s(o.t * 1.3) * 0.05; break;
    }
  }
  Object.assign(t, p);
}

/* =====================  MENU 3D  ===================== */
let menuRun = false, menuPh = 0, menuActor = null, menuT = 0, menuPop = 1, menuPopV = 0, menuSpawn = 0;
const menuHolder = new THREE.Group();
function setupMenuScene() {
  menuScene.add(envRoot); envRoot.updateMatrixWorld(true);
  const meshes = []; envRoot.traverse(o => { if (o.isMesh && !o.isSkinnedMesh) meshes.push(o); });
  const rc = new THREE.Raycaster(new THREE.Vector3(envCenter.x, 60, envCenter.z), new THREE.Vector3(0, -1, 0));
  const hit = rc.intersectObjects(meshes, false);
  groundY = hit.length ? hit[0].point.y : 0;
  if (hit.length && hit[0].point.y > 4) { const lower = hit.filter(h => h.point.y < 2); if (lower.length) groundY = lower[0].point.y; }
  menuScene.add(menuHolder); menuHolder.position.set(envCenter.x, groundY, envCenter.z);
  mParts = new Particles(menuScene, 260);
  showMenuChar(true);
}
function showMenuChar(first) {
  menuRun = false;
  if (menuActor) menuHolder.remove(menuActor.group);
  menuActor = new Actor(S.char); menuHolder.add(menuActor.group);
  poseTarget(menuActor.tgt, 'idle', { t: 0 }); menuActor.snap();
  $('charName').textContent = CHARS[S.char].name;
  const el = $('charName'); el.classList.remove('swap'); void el.offsetWidth; el.classList.add('swap');
  menuPop = 0.3; menuPopV = 0; menuSpawn = 0.0;
  if (!first && mParts) {
    mParts.burst(envCenter.x, groundY + 0.1, envCenter.z, 40, { speed: 3.5, up: 5, size: 0.14, life: 1, col: [0xffd23f, 0xff7a1a, 0xffffff, 0x42d65c] });
    for (let i = 0; i < 28; i++) { const a = i / 28 * 6.283; mParts.emit({ x: envCenter.x + Math.cos(a) * 0.5, y: groundY + 0.05, z: envCenter.z + Math.sin(a) * 0.5, vx: Math.cos(a) * 3.5, vy: 0.4, vz: Math.sin(a) * 3.5, life: 0.6, size: 0.12, g: 0, col: 0xffd23f }); }
  }
}
function updateMenu(dt) {
  menuT += dt;
  if (envMixer) envMixer.update(dt);
  const th = Math.sin(menuT * 0.25) * 0.9 + 0.2, R = 5.0 + Math.sin(menuT * 0.4) * 0.5;
  menuCam.position.set(envCenter.x + Math.sin(th) * R, groundY + 1.5 + Math.sin(menuT * 0.33) * 0.35, envCenter.z + Math.cos(th) * R);
  menuCam.lookAt(envCenter.x, groundY + 1.0, envCenter.z);
  if (menuActor) {
    // rebond élastique à l’apparition
    menuPopV += (1 - menuPop) * 140 * dt; menuPopV *= Math.exp(-9 * dt); menuPop += menuPopV * dt;
    menuHolder.scale.set(menuPop, 2 - menuPop > 0 ? 1 + (1 - menuPop) * 0.6 : 1, menuPop);
    menuPh += dt * 16; poseTarget(menuActor.tgt, menuRun ? 'run' : 'idle', { t: menuT, ph: menuPh, spd: 0.4 }); menuActor.step(dt, menuRun ? 20 : 10);
    const cam = th + Math.sin(menuT * 0.9) * 0.18;
    menuActor.group.rotation.y = cam - menuActor.phi;
    menuActor.group.position.y = Math.abs(Math.sin(menuT * 2.2)) * 0.015;
  }
  mParts.update(dt);
  // ambiance : petites étincelles qui montent
  if (Math.random() < dt * 14) mParts.emit({ x: envCenter.x + rnd(-4, 4), y: groundY + 0.1, z: envCenter.z + rnd(-4, 4), vy: rnd(0.8, 2), vx: rnd(-0.2, 0.2), vz: rnd(-0.2, 0.2), life: rnd(1.5, 3), size: 0.07, g: -0.2, col: 0xffe27a });
}

/* =====================  JEU  ===================== */
const LANE = 2.0, SEG = 20, NSEG = 10, CHASE_T = 14;
const SPEEDS = { slow: { v0: 13, vmax: 22, acc: 0.12, name: 'LENT' }, normal: { v0: 20, vmax: 34, acc: 0.18, name: 'NORMAL' }, fast: { v0: 30, vmax: 52, acc: 0.25, name: 'RAPIDE' } };
const G = { run: false, paused: false, over: false };
let P = null, obstacles = [], coins = [], pickups = [], segs = [], nextRow = 0;
let playerGroup, flipGroup, charPivot, actor, shadow, jetOnBack, inspGroup, inspActor;
const mats = {}; const C = { t: 0, running: false, frozen: false };
let shake = 0, timeScale = 1;

function stripeTexture(c1, c2, diag) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d');
  x.fillStyle = c1; x.fillRect(0, 0, 128, 128); x.fillStyle = c2;
  for (let i = -128; i < 256; i += 64) { x.beginPath(); x.moveTo(i, 128); x.lineTo(i + 32, 128); x.lineTo(i + 96, 0); x.lineTo(i + 64, 0); x.fill(); }
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.encoding = THREE.sRGBEncoding; return t;
}
function signTexture() {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128; const x = cv.getContext('2d');
  x.fillStyle = '#ffd23f'; x.fillRect(0, 0, 256, 128); x.strokeStyle = '#111'; x.lineWidth = 10; x.strokeRect(5, 5, 246, 118);
  x.fillStyle = '#111'; x.beginPath(); x.moveTo(128, 18); x.lineTo(176, 96); x.lineTo(80, 96); x.closePath(); x.fill();
  x.fillStyle = '#ffd23f'; x.font = 'bold 56px Arial'; x.textAlign = 'center'; x.fillText('!', 128, 90);
  x.fillStyle = '#111'; x.font = 'bold 22px Arial'; x.fillText('TRAVAUX', 128, 118);
  const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; return t;
}
function makeMats() {
  mats.stripe = register('obst', new THREE.MeshLambertMaterial({ map: stripeTexture('#e63946', '#ffffff'), color: 0xffffff }));
  mats.stripeY = register('obst', new THREE.MeshLambertMaterial({ map: stripeTexture('#ffc400', '#1b1b1b'), color: 0xffffff }));
  mats.concrete = register('obst', new THREE.MeshLambertMaterial({ color: 0xb9b6b0 }));
  mats.pole = register('obst', new THREE.MeshLambertMaterial({ color: 0xcfd3da }));
  mats.dark = register('obst', new THREE.MeshLambertMaterial({ color: 0x33363d }));
  mats.sign = register('obst', new THREE.MeshLambertMaterial({ map: signTexture(), color: 0xffffff }));
  { const t = stripeTexture('#e63946', '#ffffff'); t.repeat.set(4, 1); mats.barStripe = register('obst', new THREE.MeshLambertMaterial({ map: t, color: 0xffffff })); }
  { const t = stripeTexture('#ffc400', '#1b1b1b'); t.repeat.set(1, 4); mats.postStripe = register('obst', new THREE.MeshLambertMaterial({ map: t, color: 0xffffff })); }
  mats.ramp = register('obst', new THREE.MeshLambertMaterial({ color: 0x5b606c })); makeTireMats();
  mats.orange = register('obst', new THREE.MeshLambertMaterial({ color: 0xff7a1a }));
  mats.signY = register('obst', new THREE.MeshLambertMaterial({ map: signTexture(), color: 0xffffff }));
  mats.curb = register('ground', new THREE.MeshLambertMaterial({ color: 0xf2c230 }));
  mats.post = register('decor', new THREE.MeshLambertMaterial({ color: 0x4a4f5a }));
  mats.lampW = new THREE.MeshBasicMaterial({ color: 0xfff1b0 });
  mats.lampR = new THREE.MeshBasicMaterial({ color: 0xff3030 }); mats.lampO = new THREE.MeshBasicMaterial({ color: 0xffa000 });
  mats.refl = new THREE.MeshBasicMaterial({ color: 0xffffff });
  mats.ground = register('ground', new THREE.MeshLambertMaterial({ color: 0x6b6670 }));
  mats.sleeper = register('ground', new THREE.MeshLambertMaterial({ color: 0x5b3a22 }));
  mats.rail = register('ground', new THREE.MeshLambertMaterial({ color: 0xb8bec9 }));
  mats.side = register('ground', new THREE.MeshLambertMaterial({ color: 0x8a8590 }));
  mats.shadow = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false });
}
/* ----- Modèles 3D de barrières (style Subway Surfers) ----- */
const box = (w, h, d, m, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); return b; };
const cyl = (r, h, m, x, y, z, seg) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg || 14), m); c.position.set(x, y, z); return c; };
function lamp(m, x, y, z, r) { const l = new THREE.Mesh(new THREE.SphereGeometry(r || 0.09, 12, 10), m); l.position.set(x, y, z); return l; }
function chevron(w, h) { // petit panneau jaune à chevrons noirs
  const g = new THREE.Group(); g.add(box(w, h, 0.04, mats.signY, 0, 0, 0)); g.add(box(w + 0.05, h + 0.05, 0.03, mats.dark, 0, 0, -0.01)); return g;
}
let jerseyGeo = null;
function getJerseyGeo() {
  if (jerseyGeo) return jerseyGeo;
  const sh = new THREE.Shape(); sh.moveTo(-0.3, 0); sh.lineTo(0.3, 0); sh.lineTo(0.22, 0.25); sh.lineTo(0.12, 0.66); sh.lineTo(0.12, 0.82); sh.lineTo(-0.12, 0.82); sh.lineTo(-0.12, 0.66); sh.lineTo(-0.22, 0.25); sh.closePath();
  jerseyGeo = new THREE.ExtrudeGeometry(sh, { depth: 1.7, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 });
  jerseyGeo.translate(0, 0, -0.85); jerseyGeo.rotateY(Math.PI / 2); return jerseyGeo;
}
// Barricade rayée rouge/blanc sur pieds oranges (à sauter)
function barrierBar() {
  const g = new THREE.Group();
  [-0.82, 0.82].forEach(x => {
    g.add(box(0.14, 0.12, 0.62, mats.orange, x, 0.06, 0));              // patin
    g.add(cyl(0.07, 1.0, mats.orange, x, 0.55, 0)); g.add(cyl(0.085, 0.06, mats.dark, x, 1.05, 0));
    g.add(box(0.1, 0.1, 0.1, mats.dark, x, 0.3, 0.07), box(0.1, 0.1, 0.1, mats.dark, x, 0.74, 0.07));
  });
  [0.3, 0.55, 0.8].forEach(y => { g.add(box(1.86, 0.2, 0.09, mats.barStripe, 0, y, 0)); g.add(box(1.9, 0.03, 0.12, mats.dark, 0, y + 0.1, 0), box(1.9, 0.03, 0.12, mats.dark, 0, y - 0.1, 0)); });
  const sg = chevron(0.5, 0.26); sg.position.set(0, 0.55, 0.07); g.add(sg);
  g.add(lamp(mats.lampO, -0.82, 1.14, 0, 0.1), lamp(mats.lampO, 0.82, 1.14, 0, 0.1));
  return g;
}
// Bloc béton avec bandeau rayé (à sauter)
function barrierBlock() {
  const g = new THREE.Group(); g.add(new THREE.Mesh(getJerseyGeo(), mats.concrete));
  g.add(box(1.76, 0.22, 0.3, mats.barStripe, 0, 0.62, 0)); g.add(box(1.76, 0.22, 0.3, mats.barStripe, 0, 0.62, 0));
  g.add(box(0.55, 0.1, 0.02, mats.refl, -0.5, 0.33, 0.235), box(0.55, 0.1, 0.02, mats.refl, 0.5, 0.33, 0.235), box(0.55, 0.1, 0.02, mats.refl, -0.5, 0.33, -0.235), box(0.55, 0.1, 0.02, mats.refl, 0.5, 0.33, -0.235));
  g.add(cyl(0.05, 0.14, mats.dark, 0, 0.9, 0)); g.add(lamp(mats.lampO, 0, 1.02, 0, 0.1));
  return g;
}
// Portique : barre rayée à hauteur de tête, à passer en glissant
function barrierGantry() {
  const g = new THREE.Group();
  [-0.92, 0.92].forEach(x => {
    g.add(box(0.5, 0.1, 0.55, mats.dark, x, 0.05, 0));
    g.add(cyl(0.11, 2.4, mats.postStripe, x, 1.25, 0)); g.add(cyl(0.14, 0.08, mats.dark, x, 2.46, 0)); g.add(cyl(0.14, 0.08, mats.dark, x, 0.14, 0));
    g.add(box(0.08, 0.5, 0.08, mats.dark, x * 1.0, 0.45, 0.2), box(0.08, 0.5, 0.08, mats.dark, x * 1.0, 0.45, -0.2));
  });
  g.add(box(2.1, 0.5, 0.26, mats.barStripe, 0, 1.55, 0)); g.add(box(2.14, 0.06, 0.3, mats.dark, 0, 1.82, 0), box(2.14, 0.06, 0.3, mats.dark, 0, 1.28, 0));
  [-0.5, 0.5].forEach(x => { g.add(box(0.03, 0.22, 0.03, mats.dark, x, 2.05, 0)); const sg = chevron(0.62, 0.3); sg.position.set(x, 1.92, 0.12); g.add(sg); });
  g.add(lamp(mats.lampR, -0.92, 2.58, 0, 0.13), lamp(mats.lampR, 0.92, 2.58, 0, 0.13));
  return g;
}
/* ----- Trains (wagons multiples + rampes), barrières, pièces, bonus ----- */
let trainDim = null;
function getTrainDim() {
  if (trainDim) return trainDim;
  const b = objBox(trainProto), sz = b.getSize(new THREE.Vector3()), k = 1.85 / sz.x;
  return trainDim = { k, L: sz.z * k, H: sz.y * k, box: b };
}
function makeWagon() {
  const d = getTrainDim(), c = trainProto.clone(), bb = d.box;
  c.position.set(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2);
  const p = new THREE.Group(); p.add(c); p.scale.setScalar(d.k); return p;
}
function makeRamp(H, RL) {
  const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(RL, 0); sh.lineTo(0, H); sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: 1.7, bevelEnabled: false });
  g.rotateY(-Math.PI / 2); g.translate(0.85, 0, 0);
  const grp = new THREE.Group(); grp.add(new THREE.Mesh(g, mats.ramp));
  const ang = Math.atan2(H, RL), len = Math.hypot(H, RL);
  [-0.82, 0.82].forEach(x => { const s = box(0.12, 0.05, len, mats.postStripe, x, H / 2 + 0.03, RL / 2); s.rotation.x = ang; grp.add(s); });
  return grp;
}
function addObstacle(kind, lane, z, opt) {
  opt = opt || {}; const x = lane * LANE; let mesh, o;
  if (kind === 'train') {
    const d = getTrainDim(), cars = opt.cars || 1, gap = 0.18, total = cars * d.L + (cars - 1) * gap, hl = total / 2;
    mesh = new THREE.Group();
    for (let i = 0; i < cars; i++) { const w = makeWagon(); w.position.z = -hl + d.L / 2 + i * (d.L + gap); mesh.add(w); }
    let ramp = 0; if (opt.ramp) { ramp = Math.max(3.4, d.H * 1.35); const r = makeRamp(d.H, ramp); r.position.z = hl; mesh.add(r); }
    o = { kind, x, z, hw: 0.93, hl, y0: 0, y1: d.H, ramp, cars };
  } else if (kind === 'low') { mesh = R() < 0.65 ? barrierBar() : barrierBlock(); o = { kind, x, z, hw: 0.95, hl: 0.3, y0: 0, y1: 0.95, ramp: 0 }; }
  else { mesh = barrierGantry(); o = { kind, x, z, hw: 0.95, hl: 0.25, y0: 1.2, y1: 2.45, ramp: 0 }; }
  mesh.position.set(x, 0, z); mesh.scale.setScalar(0.01); o.grow = 0; gameScene.add(mesh); o.mesh = mesh; obstacles.push(o); return o;
}
function addCoin(x, y, z) { const m = coinProto.clone(true); m.position.set(x, y - 0.27, z); m.userData.ph = Math.random() * 6; gameScene.add(m); coins.push({ mesh: m, x, y, z }); }
function makeTaxiBody(width, lift) {
  const b = taxiBox, k = width / (b.max.x - b.min.x), c = taxiProto.clone();
  c.position.set(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
  const p = new THREE.Group(); p.add(c); p.scale.setScalar(k); p.position.y = lift || 0;
  const g = new THREE.Group(); g.add(p); return g;
}
function addPickup(type, lane, z) {
  const g = new THREE.Group(), inner = new THREE.Group();
  if (type === 'taxi') { const t = makeTaxiBody(0.75, 0); t.rotation.y = Math.PI; inner.add(t); inner.scale.setScalar(1); }
  else inner.add(jetProto.clone(true));
  const col = type === 'taxi' ? 0xffd23f : 0x4fd2ff;
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.86, 36), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; g.add(ring);
  const ring2 = ring.clone(); ring2.scale.setScalar(1.3); ring2.material = ring.material.clone(); ring2.material.opacity = 0.35; g.add(ring2);
  g.add(inner); g.position.set(lane * LANE, 0, z); gameScene.add(g);
  pickups.push({ mesh: g, inner, ring, ring2, x: lane * LANE, z, y: 1.0, type });
}

/* ----- Segments de voie ----- */
function makeSegment() {
  const g = new THREE.Group();
  const ground = new THREE.Mesh(new THREE.BoxGeometry(LANE * 3 + 1.2, 0.4, SEG), mats.ground); ground.position.y = -0.2; g.add(ground);
  [-1, 1].forEach(s => { const w = new THREE.Mesh(new THREE.BoxGeometry(5, 0.9, SEG), mats.side); w.position.set(s * (LANE * 1.5 + 3.1), -0.05, 0); g.add(w); });
  const slp = new THREE.InstancedMesh(new THREE.BoxGeometry(1.5, 0.1, 0.35), mats.sleeper, 60), m4 = new THREE.Matrix4(); let n = 0;
  for (let l = -1; l <= 1; l++) for (let i = 0; i < 20; i++) { m4.setPosition(l * LANE, 0.04, -SEG / 2 + i + 0.5); slp.setMatrixAt(n++, m4); }
  g.add(slp);
  for (let l = -1; l <= 1; l++) [-0.55, 0.55].forEach(o => g.add(box(0.12, 0.14, SEG, mats.rail, l * LANE + o, 0.12, 0)));
  addProps(g);
  if (S.decor && decorProtos.length) addDecor(g);
  return g;
}
function addDecor(g) {
  [-1, 1].forEach(sd => {
    const d = pick(decorProtos).clone(true), b = objBox(d), sz = b.getSize(new THREE.Vector3()), k = 1.15 * SEG / sz.x, pivot = new THREE.Group();
    d.position.set(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
    pivot.add(d); pivot.scale.setScalar(k); pivot.rotation.y = sd * Math.PI / 2;
    pivot.position.set(sd * (4.2 + sz.z * k / 2), -0.4, 0); g.add(pivot);
  });
}
function addProps(g) {
  [-1, 1].forEach(sd => {
    g.add(box(0.28, 0.14, SEG, mats.curb, sd * 3.7, 0.07, 0));          // bordure jaune
    [-5, 5].forEach(z => {
      const x = sd * 4.0;
      g.add(cyl(0.07, 4.2, mats.post, x, 2.1, z)); g.add(box(0.7, 0.07, 0.07, mats.post, x - sd * 0.32, 4.2, z)); g.add(box(0.4, 0.07, 0.22, mats.lampW, x - sd * 0.62, 4.15, z));
    });
  });
}
function clearWorld() {
  [obstacles, coins, pickups].forEach(a => { a.forEach(o => gameScene.remove(o.mesh)); a.length = 0; });
  segs.forEach(s => gameScene.remove(s)); segs = [];
}
function rebuildSegments() {
  segs.forEach(s => gameScene.remove(s)); segs = [];
  for (let i = 0; i < NSEG; i++) { const s = makeSegment(); s.position.z = SEG - i * SEG; gameScene.add(s); segs.push(s); }
}

/* ----- Patterns de niveau : générateur à graine + validateur de faisabilité ----- */
let rng = Math.random;
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const R = () => rng();
const rr = (a, b) => a + R() * (b - a);
const ri = (a, b) => Math.floor(rr(a, b + 1));
const rpick = a => a[Math.floor(R() * a.length)];
const U = () => Math.max(1, P.speed * P.boost / 20);
const others = l => [-1, 0, 1].filter(q => q !== l);
const shuffle = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); const t = b[i]; b[i] = b[j]; b[j] = t; } return b; };

// --- collecteur : un pattern décrit ses objets, on valide, puis on les crée ---
let spec = null;
function SO(kind, lane, z, opt) {
  opt = opt || {}; let o;
  if (kind === 'train') { const d = getTrainDim(), cars = opt.cars || 1, tot = cars * d.L + (cars - 1) * 0.18; o = { kind, lane, z, hl: tot / 2, ramp: opt.ramp ? rampLen() : 0, y1: d.H, opt: { cars, ramp: !!opt.ramp } }; }
  else if (kind === 'low') o = { kind, lane, z, hl: 0.3, ramp: 0, y1: 0.95, opt: {} };
  else o = { kind, lane, z, hl: 0.25, ramp: 0, y1: 2.45, opt: {} };
  spec.obs.push(o); return o;
}
const SC = (x, y, z) => spec.coins.push({ x, y, z });
function coinsLine(l, z, n, y, step) { for (let i = 0; i < n; i++) SC(l * LANE, y || 1.0, z - i * (step || 1.6)); }
function arc(l, z, n, h) { for (let i = -n; i <= n; i++) SC(l * LANE, 0.9 + (1 - Math.pow(i / n, 2)) * (h || 1.5), z + i * 0.9); }
function trainFront(lane, zFront, cars, ramp) { const d = getTrainDim(), total = cars * d.L + (cars - 1) * 0.18; return SO('train', lane, zFront - total / 2, { cars, ramp }); }
const trainLen = cars => { const d = getTrainDim(); return cars * d.L + (cars - 1) * 0.18; };
const rampLen = () => Math.max(3.4, getTrainDim().H * 1.35);
function roofCoins(l, z, cars, n) {
  const d = getTrainDim(), RL = rampLen(), zf = z - RL; let c = 0;
  for (let zc = z - 0.6; c < n; zc -= 1.4, c++) { const h = zc > zf ? d.H * (1 - (zc - zf) / RL) : d.H; SC(l * LANE, h + 1.0, zc); }
}
const gapOf = () => Math.max(9, P.speed * P.boost * 0.5);

/* ----- Validateur : existe-t-il au moins un chemin sans dégât ? Supprime les pièces inatteignables ----- */
function validateSpec(sp, zStart, zEnd, v) {
  const CELL = 1.0, N = Math.ceil((zStart - zEnd) / CELL) + 1, hz = 0.3;
  const J = Math.ceil(0.71 * v / CELL), WLO = Math.floor(0.08 * v / CELL) + 2, WHI = Math.ceil(0.63 * v / CELL) - 1, SL = Math.ceil(0.75 * v / CELL), CD = Math.max(2, Math.ceil(0.16 * v));
  const M = 1 + J + SL, byLane = [[], [], []];
  sp.obs.forEach(o => byLane[o.lane + 1].push(o));
  const cellInfo = (lane, z) => {
    let low = false, high = false, body = false, ramp = false;
    for (const o of byLane[lane + 1]) {
      const front = o.z + o.hl, back = o.z - o.hl;
      if (z <= front + hz && z >= back - hz) { if (o.kind === 'low') low = true; else if (o.kind === 'high') high = true; else body = true; }
      if (o.kind === 'train' && o.ramp && z > front && z < front + o.ramp) ramp = true;
    }
    return { low, high, body, ramp };
  };
  const enc = (m, h, l, cd) => (((m * 2 + h) * 3 + l) * (CD + 1) + cd);
  const dec = k => { const cd = k % (CD + 1); k = (k - cd) / (CD + 1); const l = k % 3; k = (k - l) / 3; const h = k % 2; return [(k - h) / 2, h, l, cd]; };
  const step = (key, i) => {
    const [m, h, li, cd] = dec(key), l0 = li - 1, zNext = zStart - CELL * (i + 1), zPrev = zStart - CELL * i, res = [];
    let mAdv = m; if (m >= 1 && m <= J) mAdv = (m + 1 > J) ? 0 : m + 1; else if (m > J) mAdv = (m - J + 1 > SL) ? 0 : m + 1;
    const modes = [mAdv];
    if (m === 0 || m > J) modes.push(1);                 // sauter
    if (m <= J) modes.push(J + 1);                       // glisser (depuis la course ou en l’air)
    for (const m2 of modes) {
      for (const dl of [0, -1, 1]) {
        if (dl !== 0 && (cd > 0 || l0 + dl < -1 || l0 + dl > 1)) continue;
        const l = l0 + dl, cd2 = dl ? CD : Math.max(0, cd - 1), inf = cellInfo(l, zNext), air = m2 >= 1 && m2 <= J, slide = m2 > J;
        let h2 = h;
        if (inf.body) {
          if (h === 0) { const pr = cellInfo(l, zPrev); if (inf.ramp || pr.ramp) h2 = 1; else continue; }
        } else if (h === 1 && !(air)) h2 = 0;
        if (inf.low && !(air && h2 === 0 && m2 >= WLO && m2 <= WHI)) continue;
        if (inf.high && !slide) continue;
        res.push(enc(m2, h2, l + 1, cd2));
      }
    }
    return res;
  };
  const S = new Array(N); S[0] = new Set(); for (let l = 0; l < 3; l++) S[0].add(enc(0, 0, l, 0));
  for (let i = 0; i < N - 1; i++) { const nx = new Set(); for (const k of S[i]) for (const t of step(k, i)) nx.add(t); S[i + 1] = nx; if (nx.size === 0) return false; }
  const keep = new Array(N); keep[N - 1] = S[N - 1];
  for (let i = N - 2; i >= 0; i--) { const ks = new Set(); for (const k of S[i]) { for (const t of step(k, i)) if (keep[i + 1].has(t)) { ks.add(k); break; } } keep[i] = ks; if (ks.size === 0) return false; }
  // pièces : on garde seulement celles qu’on peut toucher sur un chemin valide
  const roofH = (sp.obs.find(o => o.kind === 'train') || { y1: 2.7 }).y1;
  sp.coins = sp.coins.filter(c => {
    const ci = Math.round((zStart - c.z) / CELL), lane = Math.round(c.x / LANE) + 1;
    for (let di = -1; di <= 1; di++) {
      const set = keep[ci + di]; if (!set) continue;
      for (const k of set) {
        const [m, h, l] = dec(k); if (l !== lane) continue;
        const air = m >= 1 && m <= J, slide = m > J, t = air ? m * CELL / v : 0, ya = (h ? roofH : 0) + (air ? Math.max(0, 13.5 * t - 19 * t * t) : 0), top = slide ? 0.9 : 1.8;
        if (c.y >= ya - 0.25 && c.y <= ya + top) return true;
      }
    }
    return false;
  });
  return true;
}
function commitSpec(sp) { sp.obs.forEach(o => addObstacle(o.kind, o.lane, o.z, o.opt)); sp.coins.forEach(c => addCoin(c.x, c.y, c.z)); }

/* ----- Patterns dessinés à la main ----- */
const PATTERNS = [
  { w: 3, min: 0, f(z) { const l = rpick([-1, 0, 1]), l2 = clamp(l + rpick([-1, 1]), -1, 1), n = ri(10, 14); for (let i = 0; i < n; i++) { const t = smooth(n * 0.4, n * 0.6, i); SC((l + (l2 - l) * t) * LANE, 1.0, z - i * 1.6); } return n * 1.6 + 2; } },
  { w: 2, min: 0, f(z) { const n = ri(14, 20), ph = rr(0, 6), amp = rr(0.8, 1.1); for (let i = 0; i < n; i++) SC(Math.sin(i * 0.5 + ph) * LANE * amp, 1.0, z - i * 1.7); return n * 1.7 + 2; } },
  { w: 4, min: 0, f(z) { // train à rampe : on monte dessus et on court sur le toit
    const l = rpick([-1, 0, 1]), cars = rpick([1, 2]), RL = rampLen(), tot = trainLen(cars);
    trainFront(l, z - RL, cars, true); roofCoins(l, z, cars, Math.floor((RL + tot) / 1.4));
    const o = shuffle(others(l)); if (R() < 0.7) SO('low', o[0], z - RL - ri(1, 6)); coinsLine(o[1], z, ri(4, 8));
    return RL + tot + 3; } },
  { w: 3, min: 0, f(z) { // haies de barrières basses
    let fl = rpick([-1, 0, 1]); const n = ri(2, 4), sp = Math.max(11, gapOf() * 1.2);
    for (let i = 0; i < n; i++) { const zz = z - i * sp; others(fl).forEach(l => { if (R() < 0.9) SO('low', l, zz); }); SC(fl * LANE, 1.0, zz); SC(fl * LANE, 1.0, zz - 1.6); fl = clamp(fl + rpick([-1, 0, 1]), -1, 1); }
    return n * sp + 3; } },
  { w: 3, min: 40, f(z) { // mur à sauter
    const rows = ri(1, 2), sp = Math.max(13, gapOf() * 1.4);
    for (let i = 0; i < rows; i++) { [-1, 0, 1].forEach(l => SO('low', l, z - i * sp)); arc(rpick([-1, 0, 1]), z - i * sp, 4, 1.5); }
    return rows * sp + 5; } },
  { w: 3, min: 80, f(z) { // barres hautes : on glisse
    const rows = ri(2, 3), sp = Math.max(12, gapOf() * 1.3);
    for (let i = 0; i < rows; i++) { const fl = R() < 0.4 ? rpick([-1, 0, 1]) : 9; [-1, 0, 1].filter(l => l !== fl).forEach(l => SO('high', l, z - i * sp)); coinsLine(rpick([-1, 0, 1]), z - i * sp + 3, 5, 0.9, 1.2); }
    return rows * sp + 4; } },
  { w: 4, min: 100, f(z) { // couloir de trains
    const cars = rpick([1, 2, 2]), fl = rpick([-1, 0, 1]), tot = trainLen(cars);
    others(fl).forEach(l => trainFront(l, z - 3, cars, R() < 0.3)); coinsLine(fl, z, Math.floor(tot / 1.5) + 2); if (R() < 0.7) SO('low', fl, z - 3 - tot * rr(0.4, 0.8));
    return tot + 8; } },
  { w: 3, min: 120, f(z) { // slalom de trains
    let l = rpick([-1, 0, 1]); const n = ri(3, 4), sp = Math.max(15, gapOf() * 1.5);
    for (let i = 0; i < n; i++) { const zz = z - i * sp; trainFront(l, zz - 3, ri(1, 2), R() < 0.3); others(l).forEach(ol => coinsLine(ol, zz, 4)); l = rpick(others(l)); }
    return n * sp + 3; } },
  { w: 4, min: 150, f(z) { // autoroute de toits : on saute d’un train à l’autre
    const a = rpick([-1, 0]), b = a + 1, RL = rampLen(), tot = trainLen(2), off = rr(3, 6), H = getTrainDim().H;
    trainFront(a, z - RL, 2, true); trainFront(b, z - RL - off, 2, false);
    roofCoins(a, z, 2, 8); for (let i = 0; i < 7; i++) SC((a + (b - a) * smooth(1, 5, i)) * LANE, H + 1.0, z - RL - 2 - i * 1.4);
    coinsLine([-1, 0, 1].find(l => l !== a && l !== b), z, 6);
    return RL + tot + off + 3; } },
  { w: 3, min: 160, f(z) { // triple choix : sauter / glisser / bloqué
    const ls = shuffle([-1, 0, 1]);
    SO('train', ls[0], z - 3, { cars: ri(1, 2) }); SO('low', ls[1], z); SO('high', ls[2], z);
    arc(ls[1], z, 3, 1.4); coinsLine(ls[2], z + 3, 6, 0.9, 1.2); return 16; } },
  { w: 3, min: 200, f(z) { // deux grands trains à rampes
    const RL = rampLen(), tot = trainLen(3);
    trainFront(-1, z - RL, 3, true); trainFront(1, z - RL - rr(4, 8), 3, true);
    roofCoins(-1, z, 3, 14); coinsLine(0, z, 12); SO('low', 0, z - RL - ri(6, 12));
    return RL + tot + 12; } },
  { w: 2, min: 220, f(z) { // combo bas puis haut
    const a = rpick([-1, 0, 1]), b = rpick([-1, 0, 1]), sp = Math.max(11, gapOf() * 1.2);
    others(a).forEach(l => SO('low', l, z)); others(b).forEach(l => SO('high', l, z - sp)); coinsLine(a, z, 3); coinsLine(b, z - sp, 3); return sp + 8; } },
  { w: 3, min: 60, f(z) { // slalom de barres hautes et basses en alternance
    let fl = rpick([-1, 0, 1]); const n = ri(3, 5), sp = Math.max(11, gapOf() * 1.15);
    for (let i = 0; i < n; i++) { const kind = i % 2 ? 'high' : 'low'; others(fl).forEach(l => SO(kind, l, z - i * sp)); coinsLine(fl, z - i * sp + 2, 3, kind === 'high' ? 0.9 : 1.0, 1.2); fl = clamp(fl + rpick([-1, 1]), -1, 1); }
    return n * sp + 3; } },
  { w: 2, min: 140, f(z) { // tunnel de toits : 3 trains alignés, on enchaîne les sauts
    const RL = rampLen(), H = getTrainDim().H, a = rpick([-1, 0, 1]);
    trainFront(a, z - RL, 3, true); roofCoins(a, z, 3, 16);
    const o = others(a); o.forEach(l => SO('low', l, z - RL - ri(3, 14)));
    return RL + trainLen(3) + 3; } },
];
/* ----- Patterns procéduraux : enchaînements aléatoires (le validateur garantit qu’ils sont jouables) ----- */
function procPattern(z) {
  const n = ri(3, 6), g = gapOf(); let zz = z, fl = rpick([-1, 0, 1]);
  for (let i = 0; i < n; i++) {
    const hard = P.dist > 250, t = rpick(hard ? ['low', 'low', 'high', 'train', 'train', 'wallL', 'wallH', 'mix', 'ramp', 'coins'] : ['low', 'high', 'train', 'ramp', 'coins', 'coins']);
    fl = clamp(fl + rpick([-1, 0, 0, 1]), -1, 1);
    if (t === 'low' || t === 'high') { const ls = R() < 0.35 ? others(fl) : [rpick(others(fl))]; ls.forEach(l => SO(t, l, zz)); coinsLine(fl, zz + 2, 3, t === 'high' ? 0.9 : 1.0, 1.4); zz -= g * rr(1.0, 1.6); }
    else if (t === 'wallL') { [-1, 0, 1].forEach(l => SO('low', l, zz)); arc(fl, zz, 3, 1.4); zz -= g * rr(1.3, 1.8); }
    else if (t === 'wallH') { [-1, 0, 1].forEach(l => SO('high', l, zz)); coinsLine(fl, zz + 2, 4, 0.9, 1.2); zz -= g * rr(1.3, 1.8); }
    else if (t === 'train') { const cars = ri(1, 3), ls = R() < 0.5 ? others(fl) : [rpick(others(fl))]; ls.forEach(l => trainFront(l, zz - 2, cars, false)); coinsLine(fl, zz, Math.floor(trainLen(cars) / 1.5)); zz -= trainLen(cars) + g * rr(0.8, 1.3); }
    else if (t === 'ramp') { const cars = ri(1, 3), RL = rampLen(), l = rpick([-1, 0, 1]); trainFront(l, zz - RL, cars, true); roofCoins(l, zz, cars, Math.floor((RL + trainLen(cars)) / 1.4)); zz -= RL + trainLen(cars) + g * rr(0.6, 1.1); }
    else if (t === 'mix') { const ls = shuffle([-1, 0, 1]); SO('low', ls[0], zz); SO('high', ls[1], zz - g * 0.5); coinsLine(ls[2], zz, 5); zz -= g * rr(1.6, 2.2); }
    else { const l = rpick([-1, 0, 1]); coinsLine(l, zz, ri(5, 9)); zz -= 12 + g * 0.3; }
  }
  return z - zz + 4;
}
let bag = [], lastPats = [];
function nextPatternIndex() {
  if (P.patN < 2) return P.patN === 0 ? 0 : 2;
  if (P.dist > 30 && R() < 0.42) return -1;             // pattern procédural
  if (!bag.length) bag = shuffle(PATTERNS.map((p, i) => i));
  for (let k = 0; k < bag.length; k++) { const i = bag[k]; if (PATTERNS[i].min <= P.dist && lastPats.indexOf(i) < 0) { bag.splice(k, 1); return i; } }
  return -1;
}
function spawnPattern(z) {
  const v = Math.max(P.speed * P.boost, 14), zStart = z + 4;
  for (let tries = 0; tries < 10; tries++) {
    const idx = tries < 6 ? nextPatternIndex() : -1;
    spec = { obs: [], coins: [] };
    const len = idx < 0 ? procPattern(z) : PATTERNS[idx].f(z);
    if (spec.obs.length && !validateSpec(spec, zStart, z - len - 2, v)) continue;
    P.patN++; if (idx >= 0) { lastPats.push(idx); if (lastPats.length > 4) lastPats.shift(); }
    commitSpec(spec); return len;
  }
  spec = { obs: [], coins: [] }; coinsLine(rpick([-1, 0, 1]), z, 10); commitSpec(spec); P.patN++; return 18;
}
function spawnPickup(z) {
  const type = P.pickN % 2 === 0 ? 'taxi' : 'jet', l = rpick([-1, 0, 1]);
  spec = { obs: [], coins: [] }; coinsLine(l, z, 5, 1.0, 1.6); coinsLine(l, z - 5 * 1.6 - 3, 4, 1.0, 1.6); commitSpec(spec);
  addPickup(type, l, z - 5 * 1.6 - 1); return 24;
}
function fillWorld() {
  if (P.jet > 0) return;
  while (nextRow > P.z - 150) {
    let len;
    if (P.dist >= P.nextPick && !pickups.length && P.patN >= 2) { len = spawnPickup(nextRow); P.nextPick = P.dist + rr(260, 380); P.pickN++; }
    else len = spawnPattern(nextRow);
    nextRow -= len + Math.max(13, P.speed * 0.65) + rr(0, 5);
  }
}

/* ----- Démarrage ----- */
let freeCars = [];
function startGame() {
  const sp = SPEEDS[S.speed];
  if (P && P.car) { gameScene.remove(P.car.root); gameScene.remove(P.car.sh); }
  freeCars.forEach(c => { gameScene.remove(c.root); gameScene.remove(c.sh); }); freeCars = [];
  clearWorld(); rebuildSegments();
  rng = mulberry32((Math.random() * 4294967296) >>> 0); lastPats = []; bag = [];
  P = { lane: 0, laneFrom: 0, x: 0, y: 0, vy: 0, z: 0, prevZ: 0, speed: sp.v0, boost: 1, sp, slide: 0, slideMax: 0.75, onGround: true, dist: 0, coins: 0, jet: 0, taxi: null, car: null, chase: 0, t: 0, ph: 0, stum: 0, bump: 0, dead: false, td: 0, sq: 1, sqv: 0, lean: 0, dust: 0, impact: 0, patN: 0, pickN: 0, nextPick: 90, gh: 0, flipT: 9, vz: 0 };
  nextRow = -30; shake = 0; timeScale = 1;
  if (playerGroup) gameScene.remove(playerGroup); if (shadow) gameScene.remove(shadow);
  actor = new Actor(S.char);
  playerGroup = new THREE.Group(); flipGroup = new THREE.Group(); charPivot = new THREE.Group();
  actor.group.rotation.y = Math.PI;
  charPivot.add(actor.group); flipGroup.add(charPivot); playerGroup.add(flipGroup); flipGroup.position.y = 0.9; charPivot.position.y = -0.9;
  poseTarget(actor.tgt, 'run', { t: 0, ph: 0.5, spd: 0 }); actor.snap();          // pas de T-pose au démarrage
  shadow = new THREE.Mesh(new THREE.CircleGeometry(0.55, 20), mats.shadow); shadow.rotation.x = -Math.PI / 2; gameScene.add(shadow);
  jetOnBack = jetProto.clone(true); jetOnBack.position.set(0, 0.8, 0.3); jetOnBack.visible = false; charPivot.add(jetOnBack);
  gameScene.add(playerGroup);
  if (inspGroup) gameScene.remove(inspGroup);
  inspActor = { rig: new CpuRig(inspectorSrc, false), cur: newPose(), tgt: newPose(), ph: 0, d: 25 };
  poseTarget(inspActor.tgt, 'chase', { t: 0, ph: 0.5 }); for (const k of POSE_KEYS) inspActor.cur[k] = inspActor.tgt[k]; inspActor.rig.apply(inspActor.cur);   // pas de T-pose
  inspGroup = new THREE.Group(); inspGroup.add(inspActor.rig.group); inspActor.rig.group.rotation.y = Math.PI; inspGroup.visible = false; gameScene.add(inspGroup);
  fillWorld();
  G.run = true; G.paused = false; G.over = false;
  C.t = 0; C.running = true; C.frozen = false; $('chrono').classList.remove('stopped'); renderChrono();
  $('modeTag').textContent = sp.name; $('boost').classList.add('hidden'); updateHud(true);
  flashFx(); countdownFx('GO !');
}

function updateHud(force) {
  const s = Math.floor(P.dist) + ' m', cn = '🪙 ' + P.coins;
  if (force || $('score').textContent !== s) $('score').textContent = s;
  if (force || $('coins').textContent !== cn) $('coins').textContent = cn;
}
function bumpEl(id) { const e = $(id); e.classList.remove('bump'); void e.offsetWidth; e.classList.add('bump'); }
function flashFx() { const f = $('flash'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); }
function hurtFx() { const f = $('hurt'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); }
function countdownFx(t) { const e = $('countdown'); e.textContent = t; e.classList.remove('go'); void e.offsetWidth; e.classList.add('go'); }

/* ----- Chrono ----- */
function renderChrono() {
  const t = C.t, m = Math.floor(t / 60), s = Math.floor(t % 60), c = Math.floor((t * 100) % 100);
  $('chM').textContent = String(m).padStart(2, '0'); $('chS').textContent = String(s).padStart(2, '0'); $('chC').textContent = String(c).padStart(2, '0');
}
function freezeChrono() { if (!C.running) return; C.running = false; C.frozen = true; $('chrono').classList.add('stopped'); renderChrono(); }
function applyChrono() {
  const c = S.chrono, e = $('chrono'); e.classList.toggle('off', !c.show);
  e.dataset.style = c.style; e.dataset.size = c.size; e.dataset.pos = c.pos;
  const h = c.color.replace('#', ''), r = parseInt(h.substr(0, 2), 16), g = parseInt(h.substr(2, 2), 16), b = parseInt(h.substr(4, 2), 16);
  e.style.setProperty('--cc', c.color); e.style.setProperty('--cg', 'rgba(' + r + ',' + g + ',' + b + ',.6)');
}

/* ----- Dégâts / mort ----- */
const invulnerable = () => !!P.taxi || P.jet > 0;
function hurt(dir) {
  if (P.dead) return;
  shake = Math.max(shake, 0.6); P.stum = 0.6; P.bump = (dir || 0) * 0.55; hurtFx();
  gParts.burst(P.x, 1.2, P.z, 18, { speed: 3, up: 3, size: 0.16, life: 0.8, col: [0xffd23f, 0xff7a1a, 0xffffff] });
  if (P.chase > 0) { die(false); return; }
  P.chase = CHASE_T; P.speed = Math.max(P.sp.v0 * 0.8, P.speed * 0.85);
}
function die(front) {
  if (P.dead) return;
  P.dead = true; P.td = 0; shake = 1; timeScale = 0.45; hurtFx(); flashFx(); P.deadFront = front;
  if (C.running) freezeChrono();
  gParts.burst(P.x, 1.0, P.z, 40, { speed: 5, up: 6, size: 0.2, life: 1.1, col: [0xffd23f, 0xff7a1a, 0xff3030, 0xffffff] });
  P.vz = 9; P.vy = 6;
}
function gameOver() {
  G.run = false; G.over = true;
  const m = Math.floor(P.dist); if (m > best) { best = m; try { localStorage.setItem('zs_best', best); } catch (e) {} }
  $('overScore').innerHTML = 'Distance : <b>' + m + ' m</b><br>Pièces : <b>' + P.coins + '</b><br>Temps : <b>' + $('chM').textContent + ':' + $('chS').textContent + '.' + $('chC').textContent + '</b><br>Record : <b>' + best + ' m</b>';
  $('hud').classList.add('hidden'); $('over').classList.remove('hidden'); timeScale = 1;
}

/* ----- Sol (rampes et toits de trains) ----- */
function groundAt(x, z, y) {
  let g = 0;
  for (const o of obstacles) {
    if (o.kind !== 'train' || o.flying || Math.abs(x - o.x) > 1.0) continue;
    const front = o.z + o.hl, back = o.z - o.hl;
    if (z <= front && z >= back) { if (y >= o.y1 - 0.35 && o.y1 > g) g = o.y1; }
    else if (o.ramp && z > front && z < front + o.ramp) { const h = o.y1 * (1 - (z - front) / o.ramp); if (h > g) g = h; }
  }
  return g;
}

/* ----- Collisions (balayage : impossible de traverser) ----- */
function collide() {
  if (invulnerable() || P.dead) return;
  const h = P.slide > 0 ? 0.8 : 1.7, hz = 0.3;
  for (const o of obstacles) {
    if (o.flying || o.mesh.scale.x < 0.9) continue;
    const front = o.z + o.hl, back = o.z - o.hl, lead = P.z - hz, trail = P.z + hz;
    const swept = P.prevZ - hz >= front && trail <= back;
    if (!swept && (lead > front || trail < back)) continue;
    if (Math.abs(P.x - o.x) > o.hw + 0.3) continue;
    if (o.kind === 'train') {
      if (P.y >= o.y1 - 0.3) continue;                       // on court sur le toit
      const frontal = P.prevZ - hz >= front - 0.08;
      if (frontal) { P.z = front + hz; P.prevZ = P.z; die(true); return; }
      const dir = Math.sign(P.x - o.x) || 1; P.lane = P.laneFrom; P.x = P.laneFrom * LANE; hurt(-dir); return;
    }
    if (!(P.y < o.y1 && P.y + h > o.y0)) continue;
    const frontal = P.prevZ - hz >= front - 0.08;
    if (frontal) P.z = Math.max(P.z, front + hz - 0.05);
    die(frontal); return;
  }
}

/* ----- Effets de poussière / débris ----- */
function dustCloud(x, y, z, n, s, spread) {
  for (let i = 0; i < n; i++) {
    const a = rnd(0, 6.283), r = rnd(0, spread || 0.8);
    gParts.emit({ x: x + Math.cos(a) * r, y: y + rnd(0, 0.6), z: z + Math.sin(a) * r, vx: Math.cos(a) * rnd(0.5, 2.6) * s, vy: rnd(0.6, 2.4), vz: Math.sin(a) * rnd(0.5, 2.6) * s + rnd(0, 2), sz0: 0.3 * s, sz1: rnd(1.0, 1.9) * s, life: rnd(0.9, 1.5), g: -0.4, drag: 1.6, grow: true, col: pick([0xe7e0d4, 0xd9d0c2, 0xcfc5b5, 0xbdb3a4]) });
  }
}
function debris(x, y, z, n, cols, power) {
  for (let i = 0; i < n; i++) gParts.emit({ x: x + rnd(-0.5, 0.5), y: y + rnd(0, 0.8), z: z + rnd(-0.5, 0.5), vx: rnd(-1, 1) * power, vy: rnd(0.4, 1.2) * power * 1.3, vz: rnd(-1.4, 0.4) * power, life: rnd(0.9, 1.6), size: rnd(0.1, 0.24), g: 16, col: pick(cols) });
}
/* ----- La voiture (taxi) ----- */
function buildCar() {
  const root = new THREE.Group(); root.rotation.order = 'YXZ';
  const body = new THREE.Group(); body.add(makeTaxiBody(1.9, 0.16)); root.add(body);
  const wheels = [];
  [[-0.86, 1.42], [0.86, 1.42], [-0.86, -1.3], [0.86, -1.3]].forEach(([x, z]) => {
    const w = new THREE.Group(), t = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.22, 20), mats.tire), h = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.24, 12), mats.hub);
    t.rotation.z = h.rotation.z = Math.PI / 2; w.add(t, h, box(0.25, 0.07, 0.07, mats.dark, 0, 0.17, 0), box(0.25, 0.07, 0.07, mats.dark, 0, -0.17, 0));
    w.position.set(x, 0.29, z); root.add(w); wheels.push(w);
  });
  const seat = new THREE.Group(); seat.position.set(0, 0.55, -0.35); root.add(seat);
  const wheel = new THREE.Group(); wheel.position.set(0, 0.92, 0.2); wheel.rotation.x = -0.95;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.028, 8, 20), mats.dark); wheel.add(ring, box(0.34, 0.03, 0.03, mats.dark, 0, 0, 0), cyl(0.04, 0.05, mats.hub, 0, 0, 0)); root.add(wheel);
  const beams = [];
  [-0.62, 0.62].forEach(x => {
    const g = new THREE.ConeGeometry(0.9, 6, 20, 1, true); g.translate(0, -3, 0); g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xfff1a0, transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    m.position.set(x, 0.62, 2.05); root.add(m); beams.push(m);
  });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 5.2), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.rotation.x = -Math.PI / 2; glow.position.y = 0.05; root.add(glow);
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 4.8), mats.shadow); sh.rotation.x = -Math.PI / 2; gameScene.add(sh);
  return { root, body, wheels, seat, wheel, beams, glow, sh, y: 9, vy: 0, sq: 1, sqv: 0, landed: false, free: false, ft: 0, vz: 0, kick: 0, kickV: 0, roll: 0 };
}
function startTaxi() {
  P.chase = 0; P.slide = 0; flashFx(); shake = Math.max(shake, 0.25);
  P.taxi = { state: 'drop', t: 0, seated: false, seatT: 0 };
  P.car = buildCar(); P.car.root.position.set(P.x, 9, P.z); gameScene.add(P.car.root);
  P.vy = 11.5; P.onGround = false; P.flipT = 9;
  $('boost').classList.remove('hidden'); $('boostIcon').textContent = '🚕'; $('boostFill').style.width = '100%';
}
function seatPlayer() {
  const T = P.taxi, car = P.car; T.seated = true; T.seatT = 0; T.state = 'drive'; T.t = 0;
  car.seat.position.y = 0.55 - actor.rig.piv.hips.y;
  car.seat.attach(actor.group); actor.group.userData.fromPos = actor.group.position.clone(); actor.group.userData.fromRot = actor.group.rotation.y; actor.group.userData.fromScale = actor.group.scale.x;
  playerGroup.visible = false; shadow.visible = false;
  P.y = 0; P.vy = 0; P.onGround = true; car.sqv = -4;
}
function ejectPlayer() {
  const T = P.taxi, car = P.car; T.state = 'eject'; T.t = 0; P.flipT = 0;
  charPivot.add(actor.group); actor.group.position.set(0, 0, 0); actor.group.rotation.set(0, Math.PI, 0); actor.group.scale.setScalar(1);
  playerGroup.visible = true; shadow.visible = true;
  P.y = 0.7; P.vy = 13; P.onGround = false; shake = Math.max(shake, 0.5); flashFx();
  dustCloud(P.x, 0.4, P.z, 10, 1.1, 0.8);
  gParts.burst(P.x, 0.9, P.z, 24, { speed: 4, up: 5, size: 0.14, life: 0.9, col: [0xffd23f, 0xffffff, 0xff7a1a] });
  car.free = true; car.ft = 0; car.z = P.z; car.vz = -P.speed * P.boost; car.x = P.x; freeCars.push(car); P.car = null;
}
function launch(o) {
  if (o.flying) return; o.flying = true; o.ft = 0;
  const heavy = o.kind === 'train', ev = P.speed * P.boost;
  o.v = { x: (o.x - P.x) * 1.9 + rnd(-2.5, 2.5), y: heavy ? rnd(9, 12) : rnd(11, 15), z: -(ev * 0.5) + rnd(-4, 2) };
  o.spin = { x: rnd(-1, 1) * (heavy ? 2.6 : 9), y: rnd(-1, 1) * (heavy ? 2 : 7), z: rnd(-1, 1) * (heavy ? 2.6 : 9) };
  dustCloud(o.x, 0.2, o.z, heavy ? 16 : 10, heavy ? 1.6 : 1.0, heavy ? 1.6 : 0.8);
  debris(o.x, 0.6, o.z, heavy ? 22 : 16, heavy ? [0xd9531e, 0x3d6a8a, 0xffd23f, 0xffffff] : [0xe63946, 0xffffff, 0xff7a1a, 0xffc400, 0x33363d], heavy ? 7 : 6);
  shake = Math.max(shake, heavy ? 0.7 : 0.45); P.impact = 1; if (P.car) P.car.kickV += heavy ? 6 : 4;
  if (heavy) coins.forEach(c => { if (!c.mag && c.y > 2.2 && Math.abs(c.x - o.x) < 1.2 && c.z < o.z + o.hl + (o.ramp || 0) + 1 && c.z > o.z - o.hl - 1) c.mag = true; });
  gameCam.fov += heavy ? 3.5 : 2; P.smashed = (P.smashed || 0) + 1;
}
function smash() {
  const T = P.taxi; if (!T) return;
  const drive = T.state === 'drive' || T.state === 'drop';
  const eject = T.state === 'eject' && T.t < 0.85;
  if (!drive && !eject) return;
  for (const o of obstacles) {
    if (o.flying || o.mesh.scale.x < 0.5) continue;
    const dx = Math.abs(o.x - P.x); if (dx > o.hw + (eject ? 1.4 : 1.15)) continue;
    const zf = o.z + o.hl;                                    // face avant
    if (drive && T.state === 'drive') { if (zf > P.z - 2.5 && o.z - o.hl < P.z + 2.6) launch(o); }
    else if (eject) { if (zf > P.z - 9 && o.z - o.hl < P.z + 3) launch(o); }
  }
}
function updateFlyers(rdt) {
  obstacles.forEach(o => {
    if (!o.flying) return;
    o.ft += rdt; o.v.y -= 26 * rdt; const m = o.mesh;
    m.position.x += o.v.x * rdt; m.position.y += o.v.y * rdt; m.position.z += o.v.z * rdt;
    m.rotation.x += o.spin.x * rdt; m.rotation.y += o.spin.y * rdt; m.rotation.z += o.spin.z * rdt;
    if (Math.random() < rdt * 30) gParts.emit({ x: m.position.x + rnd(-0.4, 0.4), y: m.position.y, z: m.position.z + rnd(-0.4, 0.4), vx: rnd(-0.5, 0.5), vy: rnd(-0.5, 0.5), vz: rnd(-0.5, 0.5), sz0: 0.2, sz1: 0.7, life: 0.8, g: 0, drag: 2, grow: true, col: 0xd9d0c2 });
    if (o.ft > 1.15) { const k = Math.max(0, 1 - (o.ft - 1.15) / 0.5); m.scale.setScalar(Math.max(0.001, k)); }
    if (o.ft > 1.7) o.dead = true;
  });
  obstacles = obstacles.filter(o => { if (o.dead) { gameScene.remove(o.mesh); return false; } return true; });
}
function updateCarCommon(car, dt, ev) {
  car.sqv += (1 - car.sq) * 230 * dt; car.sqv *= Math.exp(-10 * dt); car.sq += car.sqv * dt;
  car.kickV += -car.kick * 120 * dt; car.kickV *= Math.exp(-7 * dt); car.kick += car.kickV * dt;
  car.root.scale.set(1 / Math.sqrt(Math.max(0.3, car.sq)), car.sq, 1 / Math.sqrt(Math.max(0.3, car.sq)));
  car.wheels.forEach(w => w.rotation.x += dt * ev / 0.29);
  const fl = 0.11 + 0.04 * Math.sin(performance.now() * 0.03); car.beams.forEach(b => b.material.opacity = fl);
}
function animateCar(dt) {
  const car = P.car, T = P.taxi; if (!car) return;
  const ev = P.speed * P.boost, steer = clamp((P.lane * LANE - P.x) * 0.5, -1, 1);
  if (T.state === 'drop' && !car.landed) {
    car.vy -= 100 * dt; car.y += car.vy * dt;
    if (car.y <= 0) { car.y = 0; car.vy = 0; car.landed = true; car.sqv = -10; car.kickV += 5; shake = Math.max(shake, 0.9); dustCloud(P.x, 0.1, P.z, 22, 1.8, 1.8);
      for (let i = 0; i < 26; i++) { const a = i / 26 * 6.283; gParts.emit({ x: P.x + Math.cos(a) * 0.8, y: 0.1, z: P.z + Math.sin(a) * 1.6, vx: Math.cos(a) * 6, vy: 0.5, vz: Math.sin(a) * 6, life: 0.6, size: 0.14, g: 0, col: 0xffd23f }); }
      gParts.burst(P.x, 0.4, P.z, 20, { speed: 5, up: 4, size: 0.12, life: 0.8, col: [0xffd23f, 0xffffff] }); }
  }
  const drive = T.state === 'drive', bump = drive ? Math.sin(P.t * 26) * 0.012 + Math.sin(P.t * 11) * 0.01 : 0;
  car.root.position.set(P.x + P.bump * 0.3, car.y + bump, P.z);
  car.roll += (-steer * 0.16 - car.roll) * Math.min(1, dt * 10);
  car.root.rotation.set(car.kick * 0.05 - 0.03 + (car.landed ? 0 : -0.25 * Math.min(1, car.y / 9)), Math.PI - steer * 0.32, car.roll + car.kick * 0.01);
  car.wheel.rotation.z = -steer * 2.4;
  car.sh.position.set(P.x, 0.03, P.z); car.sh.scale.setScalar(car.y > 0.1 ? Math.max(0.3, 1 - car.y * 0.09) : 1);
  updateCarCommon(car, dt, drive ? ev : 0);
  if (drive) {
    if (Math.random() < dt * 55) gParts.emit({ x: P.x + rnd(-0.25, 0.25), y: 0.3, z: P.z + 2.3, vx: rnd(-0.4, 0.4), vy: rnd(0.3, 1.0), vz: rnd(3, 7), sz0: 0.12, sz1: 0.6, life: 0.75, g: -0.2, drag: 1.1, grow: true, col: pick([0xc9c9c9, 0xa9a9a9, 0xe2e2e2]) });
    if (Math.random() < dt * 40) [-0.86, 0.86].forEach(x => gParts.emit({ x: P.x + x, y: 0.08, z: P.z + 1.4, vx: rnd(-0.6, 0.6) + (steer * 2), vy: rnd(0.4, 1.2), vz: rnd(3, 6), sz0: 0.12, sz1: 0.55, life: 0.6, g: -0.3, drag: 1.5, grow: true, col: pick([0xd9d0c2, 0xcfc5b5]) }));
    if (Math.abs(steer) > 0.35 && Math.random() < dt * 60) gParts.emit({ x: P.x - steer * 0.5, y: 0.1, z: P.z + 1.2, vx: -steer * 3, vy: 0.8, vz: rnd(2, 5), sz0: 0.2, sz1: 0.9, life: 0.7, g: -0.2, drag: 1.4, grow: true, col: 0xe7e0d4 });
  }
}
function updateFreeCars(rdt) {
  freeCars = freeCars.filter(car => {
    car.ft += rdt; car.vz *= Math.exp(-2.1 * rdt); car.z += car.vz * rdt;
    car.root.position.set(car.x, 0, car.z); car.root.rotation.set(0.07 + car.kick * 0.04, Math.PI + Math.sin(car.ft * 5) * 0.06 * (1 - car.ft), 0);
    car.sh.position.set(car.x, 0.03, car.z);
    updateCarCommon(car, rdt, Math.abs(car.vz) * (car.ft < 0.35 ? 1 : 0.2));
    if (Math.random() < rdt * 70) gParts.emit({ x: car.x + rnd(-0.9, 0.9), y: 0.1, z: car.z + rnd(-1.5, 1.5), vx: rnd(-0.5, 0.5), vy: rnd(0.4, 1.2), vz: rnd(1, 3), sz0: 0.15, sz1: 0.8, life: 0.7, g: -0.3, drag: 1.4, grow: true, col: pick([0xd9d0c2, 0xcfc5b5, 0xe7e0d4]) });
    if (car.ft > 1.0 && !car.gone) { car.gone = true; dustCloud(car.x, 0.3, car.z, 18, 1.6, 1.4); debris(car.x, 0.6, car.z, 14, [0xffd23f, 0xffffff, 0xff7a1a], 5); }
    if (car.gone) { const k = Math.max(0, 1 - (car.ft - 1.0) / 0.25); car.root.scale.setScalar(Math.max(0.001, k)); }
    if (car.ft > 1.3) { gameScene.remove(car.root); gameScene.remove(car.sh); return false; }
    return true;
  });
}
function updateTaxi(dt) {
  const T = P.taxi; if (!T) return;
  T.t += dt;
  if (T.state === 'drop') { if (T.t >= 0.5) seatPlayer(); }
  else if (T.state === 'drive') {
    $('boostFill').style.width = Math.max(0, (1 - T.t / 5) * 100) + '%';
    if (T.t >= 5) ejectPlayer();
  } else if (T.state === 'eject') {
    $('boostFill').style.width = '0%';
    if (T.t >= 0.9) { P.taxi = null; $('boost').classList.add('hidden'); }
  }
}
function makeTireMats() {
  mats.tire = new THREE.MeshLambertMaterial({ color: 0x1b1b20 }); mats.hub = new THREE.MeshLambertMaterial({ color: 0xcfd3da });
}

/* ----- Boucle de jeu ----- */
function updateGame(rdt) {
  const dt = rdt * timeScale;
  P.t += dt; P.prevZ = P.z;
  if (P.dead) updateDeath(dt);
  else {
    const drv = !!(P.taxi && P.taxi.state === 'drive');
    P.boost += ((drv ? 1.38 : 1) - P.boost) * Math.min(1, dt * 3.5);
    P.speed = Math.min(P.sp.vmax, P.speed + P.sp.acc * dt);
    const ev = P.speed * P.boost;
    P.z -= ev * dt; P.dist += ev * dt / 2;
    P.x += (P.lane * LANE - P.x) * Math.min(1, dt * 14);
    if (C.running) { C.t += dt; renderChrono(); }
    const wasAir = !P.onGround;
    if (P.jet > 0) {
      P.jet -= dt; P.y += (5 - P.y) * Math.min(1, dt * 4); P.vy = 0; P.onGround = false;
      $('boostFill').style.width = Math.max(0, P.jet / 6 * 100) + '%';
      if (P.jet <= 0) { jetOnBack.visible = false; P.vy = -2; $('boost').classList.add('hidden'); }
      if (Math.random() < dt * 60) gParts.emit({ x: P.x + rnd(-0.2, 0.2), y: P.y + 0.6, z: P.z + 0.7, vy: -3, vz: 3, life: 0.5, size: 0.22, g: 0, col: pick([0xffa000, 0xff4d00, 0xffe27a]) });
    } else if (drv) { P.y = 0; P.vy = 0; P.onGround = true; P.gh = 0; }
    else {
      P.vy -= 38 * dt; P.y += P.vy * dt;
      const gh = groundAt(P.x, P.z, P.y); P.gh = gh;
      if (P.y <= gh && P.vy <= 0) { P.y = gh; P.vy = 0; P.onGround = true; } else P.onGround = false;
    }
    if (wasAir && P.onGround) { P.sqv = -7; gParts.burst(P.x, P.gh + 0.05, P.z, 10, { speed: 2.2, up: 1.2, size: 0.15, life: 0.5, g: 3, col: 0xcbb89a }); }
    if (P.slide > 0) P.slide -= dt;
    if (P.stum > 0) P.stum -= dt;
    if (P.chase > 0) P.chase -= dt;
    P.bump *= Math.exp(-9 * dt);
    updateTaxi(dt);
    fillWorld();
    if (P.taxi) smash(); else collide();
  }
  // monde
  while (segs[0] && segs[0].position.z - SEG / 2 > P.z + 30) { const f = segs.shift(); f.position.z = segs[segs.length - 1].position.z - SEG; segs.push(f); }
  obstacles = obstacles.filter(o => { if (o.z - P.z > 25 + o.hl + (o.ramp || 0)) { gameScene.remove(o.mesh); return false; } return true; });
  coins = coins.filter(c => { if (c.z - P.z > 25) { gameScene.remove(c.mesh); return false; } return true; });
  pickups = pickups.filter(c => { if (c.z - P.z > 25) { gameScene.remove(c.mesh); return false; } return true; });
  const blink = 0.5 + 0.5 * Math.sin(P.t * 12);
  mats.lampR.color.setRGB(1, 0.15 + 0.25 * blink, 0.15); mats.lampO.color.setRGB(1, 0.45 + 0.4 * blink, 0);
  for (const o of obstacles) { if (!o.flying && o.grow < 1 && P.z - o.z < 60) { o.grow = Math.min(1, o.grow + rdt * 4); const e = 1 - Math.pow(1 - o.grow, 3), ov = 1 + Math.sin(o.grow * Math.PI) * 0.12; o.mesh.scale.setScalar(o.grow >= 1 ? 1 : e * ov); } }
  updateFlyers(rdt); updateFreeCars(rdt);
  // pièces / objets
  const hh = P.slide > 0 ? 0.8 : 1.7, inCar = !!(P.taxi && (P.taxi.state === 'drive' || P.taxi.state === 'drop'));
  coins = coins.filter(c => {
    c.mesh.rotation.y += rdt * 4.5;
    let hit = false;
    if (c.mag) {                                              // pièces au-dessus d’un train éjecté : elles filent vers la voiture
      const k = Math.min(1, rdt * 8); c.x += (P.x - c.x) * k; c.y += (1.0 - c.y) * k; c.z += (P.z - c.z) * k;
      c.mesh.position.set(c.x, c.y - 0.27, c.z); hit = !P.dead && Math.hypot(c.x - P.x, c.z - P.z) < 0.9;
    } else {
      c.mesh.position.y = c.y - 0.27 + Math.sin(P.t * 5 + c.mesh.userData.ph) * 0.05;
      if (!P.dead) {
        // hitbox précise : la pièce (rayon 0.27) doit vraiment chevaucher le corps du joueur
        if (inCar) hit = Math.abs(c.x - P.x) < 1.0 && c.z > P.z - 2.1 && c.z < P.prevZ + 1.9 && c.y - 0.27 < 1.9 && c.y + 0.27 > 0.1;
        else hit = Math.abs(c.x - P.x) < 0.55 && c.z > P.z - 0.5 && c.z < P.prevZ + 0.5 && c.y + 0.27 > P.y + 0.05 && c.y - 0.27 < P.y + hh;
      }
    }
    if (hit) {
      P.coins++; bumpEl('coins'); gameScene.remove(c.mesh);
      gParts.burst(c.x, c.y, c.z, 8, { speed: 2.5, up: 2.5, size: 0.12, life: 0.5, g: 4, col: [0xffd23f, 0xffffff, 0xffa000] });
      if (S.chrono.stop === 'coin' && C.running) freezeChrono();
      return false;
    }
    return true;
  });
  pickups = pickups.filter(c => {
    c.inner.rotation.y += rdt * 2.6; c.inner.position.y = 1.0 + Math.sin(P.t * 4) * 0.15; c.ring.rotation.z += rdt * 2; c.ring2.scale.setScalar(1.3 + Math.sin(P.t * 5) * 0.18);
    if (Math.random() < rdt * 14) gParts.emit({ x: c.x + rnd(-0.5, 0.5), y: rnd(0.3, 1.6), z: c.z + rnd(-0.5, 0.5), vy: 1, life: 0.8, size: 0.09, g: -0.5, col: c.type === 'taxi' ? 0xffd23f : 0x4fd2ff });
    if (!P.dead && !P.taxi && P.jet <= 0 && Math.abs(c.x - P.x) < 1.1 && c.z > P.z - 1.3 && c.z < P.prevZ + 1.3) {
      if (c.type === 'taxi') startTaxi(); else startJet();
      gParts.burst(c.x, 1.0, c.z, 24, { speed: 4, up: 4, size: 0.14, life: 0.8, col: c.type === 'taxi' ? [0xffd23f, 0xffffff] : [0x4fd2ff, 0xffffff] });
      gameScene.remove(c.mesh); return false;
    }
    return true;
  });
  animatePlayer(dt, rdt);
  animateCar(dt);
  animateInspector(dt);
  gParts.update(rdt);
  const ev = P.speed * P.boost;
  if (ev > P.sp.v0 + 3 && !P.dead && Math.random() < rdt * (ev - P.sp.v0) * 1.2) gParts.emit({ x: P.x + rnd(-7, 7), y: rnd(0.4, 6), z: P.z - rnd(25, 55), life: 0.7, size: 0.05, g: 0, st: 55, col: 0xffffff });
  updateCamera(rdt);
  if (!P.dead) updateHud();
}
function updateDeath(dt) {
  P.td += dt;
  P.z += P.vz * dt; P.vz *= Math.exp(-2.6 * dt);
  P.vy -= 30 * dt; P.y += P.vy * dt; if (P.y < 0) { P.y = 0; P.vy = Math.abs(P.vy) * 0.35; if (P.vy < 1) P.vy = 0; }
  P.x += (P.lane * LANE - P.x) * Math.min(1, dt * 6);
  if (P.td > 0.8 && G.run) gameOver();
}
function startJet() {
  P.jet = 6; jetOnBack.visible = true; shake = 0.3; flashFx(); P.chase = 0;
  $('boost').classList.remove('hidden'); $('boostIcon').textContent = '🚀'; $('boostFill').style.width = '100%';
  obstacles.forEach(o => gameScene.remove(o.mesh)); obstacles.length = 0; coins.forEach(c => gameScene.remove(c.mesh)); coins.length = 0;
  const z0 = P.z - 8, n = Math.floor(P.speed * 6 / 1.8);
  for (let i = 0; i < n; i++) addCoin(Math.sin(i * 0.18) * LANE, 5.0, z0 - i * 1.8);
  nextRow = z0 - n * 1.8 - 30;
}
function animatePlayer(dt, rdt) {
  P.sqv += (1 - P.sq) * 220 * dt; P.sqv *= Math.exp(-11 * dt); P.sq += P.sqv * dt;
  const T = P.taxi, seated = !!(T && T.seated && T.state === 'drive'), ev = P.speed * P.boost;
  let mode = 'run';
  if (P.dead) mode = 'dead'; else if (seated) mode = 'sit'; else if (P.jet > 0) mode = 'fly';
  else if (P.slide > 0) mode = P.slideMax - P.slide < 0.4 ? 'roll' : 'slide';
  else if (!P.onGround) mode = 'jump'; else if (P.stum > 0) mode = 'stumble';
  const spd01 = clamp((ev - P.sp.v0) / (P.sp.vmax - P.sp.v0 + 1), 0, 1);
  P.ph += dt * (10 + ev * 0.17); if (P.flipT < 9) P.flipT += dt;
  const steer = clamp((P.lane * LANE - P.x) * 0.5, -1, 1);
  let flipX = 0, crouch = 1;
  if (P.flipT < 0.75 && !P.dead && !seated) { mode = 'roll'; flipX = -easeIO(clamp(P.flipT / 0.7, 0, 1)) * Math.PI * 2; crouch = 0.9; }   // salto à la sortie du taxi
  poseTarget(actor.tgt, mode, { t: P.t, ph: P.ph, spd: spd01, vy: P.vy, side: clamp((P.lane * LANE - P.x) / LANE, -1, 1), steer, impact: P.impact });
  P.impact *= Math.exp(-5 * dt);
  if (mode === 'sit') {
    actor.step(dt || 0.0001, 14);
    T.seatT = Math.min(1, T.seatT + dt * 7); const e = easeIO(T.seatT), g = actor.group, u = g.userData;
    g.position.copy(u.fromPos).multiplyScalar(1 - e); g.position.y += Math.sin(P.t * 26) * 0.012 * e + P.impact * 0.02;
    g.rotation.set(0, u.fromRot * (1 - e), 0); g.scale.setScalar(u.fromScale + (1 - u.fromScale) * e);
    return;
  }
  if (mode === 'roll' && P.flipT >= 0.75) { const r = (P.slideMax - P.slide) / 0.4; flipX = -easeIO(clamp(r, 0, 1)) * Math.PI * 2; crouch = 0.62; }
  else if (mode === 'slide') crouch = 0.58;
  else if (mode === 'dead') { flipX = (P.deadFront ? 1.25 : 1.0) * smooth(0, 0.35, P.td); }
  else if (mode === 'fly') flipX = -0.08;
  actor.step(dt || 0.0001, mode === 'jump' ? 22 : 18);
  const lat = clamp((P.lane * LANE - P.x) * 0.22, -0.4, 0.4) + P.bump * 0.5;
  P.lean += (lat - P.lean) * Math.min(1, dt * 12);
  const bob = mode === 'run' ? Math.abs(Math.cos(P.ph)) * (0.06 + 0.04 * spd01) : 0;
  flipGroup.rotation.set(flipX, -P.lean * 0.8, -P.lean);
  const sy = crouch * P.sq, sxz = 1 / Math.sqrt(Math.max(0.3, P.sq));
  charPivot.scale.set(sxz, sy, sxz); charPivot.position.y = -0.9 * sy + bob;
  flipGroup.position.y = mode === 'dead' ? 0.9 - 0.45 * smooth(0, 0.35, P.td) : 0.9 * (mode === 'roll' ? 0.75 : 1);
  playerGroup.position.set(P.x + P.bump * 0.6, P.y, P.z);
  shadow.position.set(P.x, P.gh + 0.03, P.z); shadow.scale.setScalar(Math.max(0.35, 1 - (P.y - P.gh) * 0.12));
  P.dust -= dt;
  if (!P.dead && P.onGround && P.jet <= 0 && P.dust <= 0) {
    P.dust = mode === 'run' ? 0.11 : 0.04;
    gParts.emit({ x: P.x + rnd(-0.25, 0.25), y: P.gh + 0.05, z: P.z + 0.3, vx: rnd(-0.5, 0.5), vy: rnd(0.5, 1.4), vz: rnd(1, 2.5), life: 0.5, size: mode === 'run' ? 0.12 : 0.2, g: -0.5, col: 0xcbb89a });
  }
  if (Math.abs(P.lane * LANE - P.x) > 0.6 && !P.dead) gParts.emit({ x: P.x, y: P.y + 0.9 + rnd(-0.5, 0.5), z: P.z + 0.4, life: 0.35, size: 0.1, g: 0, vz: 2, col: 0xffffff });
  playerGroup.visible = true;
}
function animateInspector(dt) {
  const I = inspActor, on = P.chase > 0 || (P.dead && P.deadFront === false);
  const tgt = P.dead ? 2.2 : (on ? 3.4 : 26);
  I.d += (tgt - I.d) * Math.min(1, dt * (on ? 3.5 : 1.6));
  inspGroup.visible = I.d < 20;
  I.ph += dt * (10 + P.speed * 0.17);
  poseTarget(I.tgt, 'chase', { t: P.t, ph: I.ph });
  { const a = 1 - Math.exp(-18 * dt); for (const k of POSE_KEYS) I.cur[k] += (I.tgt[k] - I.cur[k]) * a; I.rig.apply(I.cur); }
  const bob = Math.abs(Math.cos(I.ph)) * 0.08;
  inspGroup.position.set(P.x + Math.sin(P.t * 2.1) * 0.6 * (on ? 1 : 0), bob, P.z + I.d);
  inspGroup.rotation.z = Math.sin(P.t * 3) * 0.04;
  if (inspGroup.visible && I.d < 8 && Math.random() < dt * 20) gParts.emit({ x: inspGroup.position.x, y: 0.05, z: inspGroup.position.z + 0.2, vy: 0.8, vz: 2, life: 0.4, size: 0.13, g: -0.5, col: 0xcbb89a });
}
function updateCamera(rdt) {
  const ev = P.speed * P.boost, sp01 = clamp((ev - P.sp.v0) / (P.sp.vmax - P.sp.v0 + 1), 0, 1);
  const tgtTaxi = P.taxi ? (P.taxi.state === 'drive' ? 1 : 0.5) : 0; P.camTaxi = (P.camTaxi || 0) + (tgtTaxi - (P.camTaxi || 0)) * Math.min(1, rdt * 3);
  const intro = clamp(1 - P.t / 1.1, 0, 1), ie = intro * intro, ct = P.camTaxi;
  const fov = 62 + sp01 * 14 + (P.jet > 0 ? 6 : 0) + ct * 10 + (P.dead ? -10 * smooth(0, 0.6, P.td) : 0);
  gameCam.fov += (fov - gameCam.fov) * Math.min(1, rdt * 4); gameCam.updateProjectionMatrix();
  if (P.taxi && P.taxi.state === 'drive') shake = Math.max(shake, 0.1);
  shake *= Math.exp(-5 * rdt);
  const sx = (Math.random() - 0.5) * shake * 0.6, sy = (Math.random() - 0.5) * shake * 0.5;
  let cx = P.x * 0.6, cy = 3.1 + P.y * 0.6 + ct * 0.45, cz = P.z + 6.2 + ct * 1.7;
  if (P.dead) { cz -= 2.0 * smooth(0, 0.8, P.td); cy -= 0.5 * smooth(0, 0.8, P.td); }
  const ang = ie * 2.6;
  cx += Math.sin(ang) * 4.0 * ie; cz = (cz - P.z) * Math.cos(ang) + P.z; cy += ie * -1.2;
  gameCam.position.set(cx + sx, cy + sy, cz);
  gameCam.lookAt(P.x * 0.5, 1.3 + P.y * 0.5, P.z - 9 + ie * 9);
  gameCam.rotation.z += -P.lean * 0.05;
}

/* =====================  ENTRÉES  ===================== */
function act(a) {
  if (!G.run || G.paused || P.dead) return;
  if (a === 'left' || a === 'right') {
    const d = a === 'left' ? -1 : 1, nl = P.lane + d;
    if (nl < -1 || nl > 1) { // mur invisible : cognement
      gParts.burst(P.x + d * 1.1, 1.0, P.z, 10, { speed: 2, up: 2, size: 0.1, life: 0.4, col: 0xffffff });
      if (invulnerable()) { P.bump = d * 0.4; shake = Math.max(shake, 0.2); } else hurt(d);
      return;
    }
    P.laneFrom = P.lane; P.lane = nl;
    if (!invulnerable()) for (const o of obstacles) {   // un train à côté bloque le passage : cognement
      if (o.kind !== 'train' || o.flying || Math.abs(o.x - nl * LANE) > 0.1 || P.y >= o.y1 - 0.3) continue;
      if (P.z - 0.3 <= o.z + o.hl && P.z + 0.3 >= o.z - o.hl) { P.lane = P.laneFrom; hurt(d); return; }
    }
    P.sqv += 2; shake = Math.max(shake, 0.06);
  } else if (a === 'jump' && P.onGround && P.jet <= 0 && !(P.taxi && P.taxi.state === 'drive')) { P.vy = 13.5; P.slide = 0; P.sqv = 8; gParts.burst(P.x, P.gh + 0.05, P.z, 8, { speed: 2, up: 1, size: 0.13, life: 0.4, g: 3, col: 0xcbb89a }); }
  else if (a === 'slide' && P.jet <= 0 && !(P.taxi && P.taxi.state !== 'eject')) { P.slide = P.slideMax; if (!P.onGround) P.vy = -24; P.sqv = -3; }
}
addEventListener('keydown', e => {
  if (e.repeat) return;
  const k = e.key.toLowerCase();
  if (k === 'q' || k === 'a' || k === 'arrowleft') act('left');
  else if (k === 'd' || k === 'arrowright') act('right');
  else if (k === 'z' || k === 'w' || k === 'arrowup' || k === ' ') { act('jump'); if (k === ' ') e.preventDefault(); }
  else if (k === 's' || k === 'arrowdown') act('slide');
  else if (k === 'p' || k === 'escape') togglePause();
  if (k.startsWith('arrow')) e.preventDefault();
});
let tx = 0, ty = 0;
addEventListener('touchstart', e => { tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive: true });
addEventListener('touchend', e => {
  const t = e.changedTouches[0], dx = t.clientX - tx, dy = t.clientY - ty;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 25) return;
  if (Math.abs(dx) > Math.abs(dy)) act(dx > 0 ? 'right' : 'left'); else act(dy < 0 ? 'jump' : 'slide');
}, { passive: true });
function togglePause() { if (!G.run) return; G.paused = !G.paused; $('pause').classList.toggle('hidden', !G.paused); }

/* =====================  INTERFACE  ===================== */
function show(id) { ['menu', 'hud', 'pause', 'over'].forEach(i => $(i).classList.add('hidden')); if (id) $(id).classList.remove('hidden'); }
let mode = 'menu';
function toMenu() { G.run = false; G.over = false; mode = 'menu'; timeScale = 1; flashFx(); show('menu'); showMenuChar(false); }
function toGame() { mode = 'game'; show('hud'); startGame(); }
$('playBtn').onclick = () => { menuRun = true; if (mParts && menuActor) mParts.burst(envCenter.x, groundY + 1, envCenter.z, 30, { speed: 4, up: 4, size: 0.15, col: [0xffd23f, 0x42d65c, 0xffffff] }); flashFx(); setTimeout(toGame, 120); };
$('againBtn').onclick = toGame; $('menuBtn').onclick = toMenu; $('quitBtn').onclick = toMenu;
$('resumeBtn').onclick = togglePause; $('pauseBtn').onclick = togglePause;
$('prevChar').onclick = () => { S.char = (S.char - 1 + CHARS.length) % CHARS.length; save(); showMenuChar(false); };
$('nextChar').onclick = () => { S.char = (S.char + 1) % CHARS.length; save(); showMenuChar(false); };
function refreshSpeedUI() { document.querySelectorAll('#speedSeg button').forEach(b => b.classList.toggle('on', b.dataset.m === S.speed)); }
document.querySelectorAll('#speedSeg button').forEach(b => b.onclick = () => { S.speed = b.dataset.m; save(); refreshSpeedUI(); });

function buildTexUI() {
  const box = $('texRows'); box.innerHTML = '';
  TEX_CATS.forEach(c => {
    const row = document.createElement('div'); row.className = 'row';
    const n = document.createElement('div'); n.className = 'n'; n.textContent = c.name;
    const sel = document.createElement('select');
    sel.innerHTML = c.solidOnly ? '<option value="solid">Couleur unie</option>' : '<option value="orig">Texture d’origine</option><option value="solid">Couleur unie</option>';
    sel.value = S.tex[c.id].mode;
    const col = document.createElement('input'); col.type = 'color'; col.value = S.tex[c.id].color; col.disabled = sel.value !== 'solid';
    sel.onchange = () => { S.tex[c.id].mode = sel.value; col.disabled = sel.value !== 'solid'; applyCat(c.id); save(); };
    col.oninput = () => { S.tex[c.id].color = col.value; applyCat(c.id); save(); };
    row.append(n, sel, col); box.appendChild(row);
  });
  $('flipChk').checked = S.flip; $('decorChk').checked = S.decor;
  // affichage
  const rs = $('resSel'); rs.innerHTML = RES.map(r => '<option value="' + r[0] + '">' + r[1] + '</option>').join(''); rs.value = S.res.preset;
  $('resW').value = S.res.w; $('resH').value = S.res.h; $('stretchChk').checked = S.res.stretch;
  $('resCustom').style.display = S.res.preset === 'custom' ? '' : 'none'; applyResolution();
  // chrono
  const c = S.chrono; $('chShow').checked = c.show; $('chColor').value = c.color; $('chStyle').value = c.style; $('chSize').value = c.size; $('chPos').value = c.pos; $('chStop').value = c.stop;
}
$('texBtn').onclick = () => { buildTexUI(); $('texModal').classList.remove('hidden'); };
$('texClose').onclick = () => $('texModal').classList.add('hidden');
$('texReset').onclick = () => { S.tex = JSON.parse(JSON.stringify(DEFAULTS.tex)); S.res = Object.assign({}, DEFAULTS.res); S.chrono = Object.assign({}, DEFAULTS.chrono); S.flip = false; S.decor = true; TEX_CATS.forEach(c => applyCat(c.id)); applyResolution(); applyChrono(); save(); buildTexUI(); };
$('flipChk').onchange = e => { S.flip = e.target.checked; save(); showMenuChar(true); };
$('decorChk').onchange = e => { S.decor = e.target.checked; save(); };
document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => {
  document.querySelectorAll('.tabs button').forEach(x => x.classList.toggle('on', x === b));
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('hidden', t.id !== b.dataset.tab));
});
$('resSel').onchange = e => { S.res.preset = e.target.value; $('resCustom').style.display = S.res.preset === 'custom' ? '' : 'none'; applyResolution(); save(); };
$('resW').onchange = e => { S.res.w = +e.target.value || 1920; applyResolution(); save(); };
$('resH').onchange = e => { S.res.h = +e.target.value || 1080; applyResolution(); save(); };
$('stretchChk').onchange = e => { S.res.stretch = e.target.checked; applyResolution(); save(); };
$('chShow').onchange = e => { S.chrono.show = e.target.checked; applyChrono(); save(); };
$('chColor').oninput = e => { S.chrono.color = e.target.value; applyChrono(); save(); };
['Style:style', 'Size:size', 'Pos:pos', 'Stop:stop'].forEach(s => { const [id, key] = s.split(':'); $('ch' + id).onchange = e => { S.chrono[key] = e.target.value; applyChrono(); save(); }; });

/* =====================  CHARGEMENT  ===================== */
const LOAD_STEPS = [['chars', 'Personnages'], ['coin', 'Pièce'], ['jetpack', 'Jetpack'], ['boombot', 'Boombot'], ['frank', 'Frank'], ['inspector', 'Inspecteur'], ['train', 'Train'], ['map', 'Map'], ['env', 'Décor du menu'], ['taxi', 'Taxi']];
async function loadAll() {
  const step = async i => { $('loadtxt').textContent = 'Chargement : ' + LOAD_STEPS[i][1] + '…'; $('barfill').style.width = ((i / LOAD_STEPS.length) * 100) + '%'; await new Promise(r => setTimeout(r, 30)); return getModel(LOAD_STEPS[i][0]); };
  prepareCharacters(await step(0));
  let g = await step(1); coinProto = normalize(g.scene.clone(), 0.55); convertTree(coinProto, 'coin', true);
  g = await step(2); jetProto = normalize(g.scene.clone(), 0.8); convertTree(jetProto, 'perso');
  g = await step(3); addBakedChar('Boombot', g, 2.2, o => o.name === 'Object_2');
  g = await step(4); addBakedChar('Frank', g, CHAR_H, null);
  g = await step(5); inspectorSrc = normalizeSource(bakeItems(g.scene, null), 1.85); inspectorSrc.forEach(q => q.mat.side = THREE.DoubleSide);
  g = await step(6); trainProto = g.scene; convertTree(trainProto, 'train');
  g = await step(7); g.scene.updateMatrixWorld(true);
  ['Object_12', 'Object_13', 'Object_14'].forEach(nm => {
    let found = null; g.scene.traverse(o => { if (o.isMesh && o.name === nm) found = o; });
    if (!found) return;
    const m = found.clone(); m.geometry = found.geometry.clone(); m.geometry.applyMatrix4(found.matrixWorld);
    m.position.set(0, 0, 0); m.rotation.set(0, 0, 0); m.scale.set(1, 1, 1); m.updateMatrix();
    const grp = new THREE.Group(); grp.add(m); convertTree(grp, 'decor'); decorProtos.push(grp);
  });
  g = await step(8); envRoot = g.scene; convertTree(envRoot, 'envmenu');
  if (g.animations && g.animations.length) { envMixer = new THREE.AnimationMixer(envRoot); envMixer.clipAction(g.animations[0]).play(); }
  g = await step(9); taxiProto = g.scene; convertTree(taxiProto, 'taxi'); taxiBox = objBox(taxiProto);
  $('barfill').style.width = '100%';
}

const clock = new THREE.Clock();
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (mode === 'menu') { updateMenu(dt); renderer.render(menuScene, menuCam); }
  else { if (G.run && !G.paused) updateGame(dt); renderer.render(gameScene, gameCam); }
}
(async function init() {
  try {
    applySky(); applyChrono(); makeMats();
    gParts = new Particles(gameScene, 900);
    await loadAll();
    TEX_CATS.forEach(c => applyCat(c.id));
    if (S.char >= CHARS.length) S.char = 0;
    setupMenuScene(); refreshSpeedUI();
    $('loading').classList.add('hidden'); mode = 'menu'; show('menu'); loop();
  } catch (e) { console.error(e); fail('Erreur de chargement : ' + (e && e.message ? e.message : e)); }
})();
})();

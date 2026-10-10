// Streams the 3D world around the player: roads, markings, junctions, bridges, tunnels,
// signs, signals, buildings, trees, water. Geometry is merged per 500 m tile.
import * as THREE from '../lib/three.module.min.js';
import { T, F, C, headingOf } from './net.js';

const col = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
const PAL = {
  asphalt: [col('#3b3d42'), col('#3d3f44'), col('#414347'), col('#434549'), col('#46484b'), col('#484a4c'), col('#4b4c4e'), col('#5a5852'), col('#55554f')],
  sidewalk: col('#a8a7a0'), white: col('#e9e9e4'), yellow: col('#f0c419'), rail: col('#9a9da1'), bed: col('#5f5c56'),
  concrete: col('#8d8c86'), concreteDark: col('#6d6c68'), tunnel: col('#55565a'), pole: col('#70757a'), black: col('#17181a'),
  signBack: col('#8a8f94'), lamp: col('#fff3c4'), kerb: col('#c6c3bb'), earth: col('#7c8a6c'), mast: col('#4f555b'), wire: col('#2e3236'),
};
const FACADES = ['#e8e1d1', '#ded6c4', '#d9d2c7', '#cfc8ba', '#e6dcc0', '#d8c9a8', '#c9bfae', '#e3d3c5', '#d6cfc9', '#bfb9ad', '#e9e6df', '#c8b89c', '#d4c2b0', '#b9b2a5', '#e0d6ba'].map(col);
const TILES = ['#8a4b3a', '#7d4535', '#93523f', '#6b5a50', '#5d4a42', '#8b5a48', '#74483a'].map(col);
const GLASSY = ['#aebccb', '#c2ccd6', '#9db0c2', '#d0d6dc', '#b4bfc9'].map(col);
const ROOFS = ['#5b5650', '#6a625a', '#4d4b4a', '#7a5a4a', '#6e4f41', '#55585c', '#857f76'].map(col);

export const SIGN = { YIELD: 0, STOP: 1, PRIORITY: 2, ZONE30: 3, ZONE20: 4, S50: 5, S60: 6, S80: 7, S100: 8, S120: 9, NOENTRY: 10, ROUNDABOUT: 11, MOTORWAY: 12, PEDX: 13, S30: 14, S40: 15, TRAMSTOP: 16, NOLEFT: 17, NORIGHT: 18 };
const SPEED_SIGN = { 20: SIGN.ZONE20, 30: SIGN.ZONE30, 40: SIGN.S40, 50: SIGN.S50, 60: SIGN.S60, 80: SIGN.S80, 100: SIGN.S100, 120: SIGN.S120 };

class Batch {
  constructor(uv = false) { this.p = []; this.c = []; this.n = []; this.i = []; this.uv = uv ? [] : null; this.count = 0; }
  v(x, y, z, c, nx = 0, ny = 1, nz = 0, u = 0, w = 0) {
    this.p.push(x, y, z); this.c.push(c[0], c[1], c[2]); this.n.push(nx, ny, nz);
    if (this.uv) this.uv.push(u, w);
    return this.count++;
  }
  quad(a, b, c, d) { this.i.push(a, b, c, a, c, d); }
  tri(a, b, c) { this.i.push(a, b, c); }
  mesh(material) {
    if (!this.i.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    if (this.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.count > 65535 ? new THREE.Uint32BufferAttribute(this.i, 1) : new THREE.Uint16BufferAttribute(this.i, 1));
    const m = new THREE.Mesh(g, material);
    m.matrixAutoUpdate = false;
    return m;
  }
}

// ── polyline helpers ──
function prep(line) {
  if (line._nx) return;
  const { pts, n } = line;
  const nx = new Float32Array(n), nz = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let ax = 0, az = 0, bx = 0, bz = 0;
    if (i > 0) { ax = pts[i * 3] - pts[i * 3 - 3]; az = pts[i * 3 + 2] - pts[i * 3 - 1]; const l = Math.hypot(ax, az) || 1; ax /= l; az /= l; }
    if (i < n - 1) { bx = pts[i * 3 + 3] - pts[i * 3]; bz = pts[i * 3 + 5] - pts[i * 3 + 2]; const l = Math.hypot(bx, bz) || 1; bx /= l; bz /= l; }
    if (i === 0) { ax = bx; az = bz; }
    if (i === n - 1) { bx = ax; bz = az; }
    let tx = ax + bx, tz = az + bz;
    const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
    const m = 1 / Math.max(0.45, tx * ax + tz * az);
    nx[i] = -tz * m; nz[i] = tx * m;
  }
  line._nx = nx; line._nz = nz;
}

const _sec = { x: 0, y: 0, z: 0, nx: 0, nz: 0 };
function section(line, s) {
  const { cum, pts, n } = line;
  s = s < 0 ? 0 : s > line.len ? line.len : s;
  let lo = 0, hi = n - 2;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (cum[mid] <= s) lo = mid; else hi = mid - 1; }
  const i = lo * 3, t = (s - cum[lo]) / (cum[lo + 1] - cum[lo] || 1e-6);
  _sec.x = pts[i] + (pts[i + 3] - pts[i]) * t;
  _sec.y = pts[i + 1] + (pts[i + 4] - pts[i + 1]) * t;
  _sec.z = pts[i + 2] + (pts[i + 5] - pts[i + 2]) * t;
  _sec.nx = line._nx[lo] + (line._nx[lo + 1] - line._nx[lo]) * t;
  _sec.nz = line._nz[lo] + (line._nz[lo + 1] - line._nz[lo]) * t;
  return _sec;
}

/** Flat ribbon along a line between arc lengths s0..s1, from lateral offset oL to oR. */
function strip(b, line, s0, s1, oL, oR, dy, c) {
  if (s1 - s0 < 0.02) return;
  prep(line);
  let pl = -1, pr = -1;
  const put = (s) => {
    const q = section(line, s);
    const l = b.v(q.x + q.nx * oL, q.y + dy, q.z + q.nz * oL, c);
    const r = b.v(q.x + q.nx * oR, q.y + dy, q.z + q.nz * oR, c);
    if (pl >= 0) b.quad(pl, pr, r, l);
    pl = l; pr = r;
  };
  put(s0);
  for (let i = 1; i < line.n - 1; i++) { const s = line.cum[i]; if (s > s0 + 0.05 && s < s1 - 0.05) put(s); }
  put(s1);
}

function dashes(b, line, s0, s1, off, width, dash, gap, dy, c) {
  for (let s = s0; s < s1; s += dash + gap) strip(b, line, s, Math.min(s + dash, s1), off - width / 2, off + width / 2, dy, c);
}

/** Vertical wall following a line at lateral offset `off`, from y+y0 to y+y1. `face` = +1 normal to the right, -1 to the left. */
function wallAlong(b, line, s0, s1, off, y0, y1, c, face = 1, absBottom = null) {
  prep(line);
  let pa = -1, pb = -1;
  const put = (s) => {
    const q = section(line, s);
    const l = Math.hypot(q.nx, q.nz) || 1;
    const x = q.x + q.nx * off, z = q.z + q.nz * off;
    const lo = b.v(x, absBottom !== null ? absBottom : q.y + y0, z, c, (q.nx / l) * face, 0, (q.nz / l) * face);
    const hi = b.v(x, q.y + y1, z, c, (q.nx / l) * face, 0, (q.nz / l) * face);
    if (pa >= 0) { if (face > 0) b.quad(pa, lo, hi, pb); else b.quad(lo, pa, pb, hi); }
    pa = lo; pb = hi;
  };
  put(s0);
  for (let i = 1; i < line.n - 1; i++) { const s = line.cum[i]; if (s > s0 + 0.05 && s < s1 - 0.05) put(s); }
  put(s1);
}

function box(b, cx, y0, cz, sx, sy, sz, heading, c) {
  const cs = Math.cos(heading), sn = Math.sin(heading);
  // local axes: right = (cs, sn), forward = (sn, -cs)
  const P = (lx, ly, lz) => [cx + lx * cs + lz * sn, y0 + ly, cz + lx * sn - lz * cs];
  const N = (lx, lz) => [lx * cs + lz * sn, lx * sn - lz * cs];
  const hx = sx / 2, hz = sz / 2;
  const face = (p0, p1, p2, p3, nx, ny, nz) => {
    const ids = [p0, p1, p2, p3].map((p) => b.v(p[0], p[1], p[2], c, nx, ny, nz));
    b.quad(ids[0], ids[1], ids[2], ids[3]);
  };
  let n = N(0, 1); face(P(hx, 0, hz), P(-hx, 0, hz), P(-hx, sy, hz), P(hx, sy, hz), n[0], 0, n[1]);
  n = N(0, -1); face(P(-hx, 0, -hz), P(hx, 0, -hz), P(hx, sy, -hz), P(-hx, sy, -hz), n[0], 0, n[1]);
  n = N(1, 0); face(P(hx, 0, -hz), P(hx, 0, hz), P(hx, sy, hz), P(hx, sy, -hz), n[0], 0, n[1]);
  n = N(-1, 0); face(P(-hx, 0, hz), P(-hx, 0, -hz), P(-hx, sy, -hz), P(-hx, sy, hz), n[0], 0, n[1]);
  face(P(-hx, sy, -hz), P(hx, sy, -hz), P(hx, sy, hz), P(-hx, sy, hz), 0, 1, 0);
}

/** Triangulated flat polygon (ring = [x0,z0,x1,z1,…]) facing up. */
function fillPoly(b, ring, ox, oz, scale, y, c) {
  const n = ring.length / 2;
  if (n < 3) return;
  const contour = [];
  for (let i = 0; i < n; i++) contour.push(new THREE.Vector2(ox + ring[i * 2] * scale, oz + ring[i * 2 + 1] * scale));
  let tris;
  try { tris = THREE.ShapeUtils.triangulateShape(contour, []); } catch { return; }
  const base = b.count;
  for (const p of contour) b.v(p.x, y, p.y, c);
  for (const [i0, i1, i2] of tris) {
    const a = contour[i0], bb = contour[i1], cc = contour[i2];
    const up = (bb.x - a.x) * (cc.y - a.y) - (bb.y - a.y) * (cc.x - a.x) < 0;
    if (up) b.tri(base + i0, base + i1, base + i2); else b.tri(base + i0, base + i2, base + i1);
  }
}

function disc(b, x, y, z, r, c, seg = 14) {
  const ctr = b.v(x, y, z, c);
  let prev = -1, first = -1;
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    const id = b.v(x + Math.cos(a) * r, y, z + Math.sin(a) * r, c);
    if (prev >= 0) b.tri(ctr, id, prev); else first = id;
    prev = id;
  }
  b.tri(ctr, first, prev);
}

/** Background and text colour of a name plate. Well-known chains get the colours people recognise them by. */
function plateColours(name, kind) {
  const n = name.toLowerCase();
  const brands = [
    [/^coop|^interdiscount|^import parf/, '#f26a00', '#fff'], [/^migro|^micasa|^melectronics|^sportx/, '#f08a00', '#fff'], [/^denner/, '#d2001c', '#fff'],
    [/^aldi/, '#00286e', '#fff'], [/^lidl/, '#0050aa', '#ffe500'], [/^spar\b|^volg/, '#00713d', '#fff'], [/kiosk|^avec/, '#c8102e', '#fff'],
    [/mcdonald/, '#c8102e', '#ffc72c'], [/burger king/, '#d62300', '#fff'], [/starbucks/, '#00643c', '#fff'], [/^ubs/, '#111', '#fff'],
    [/kantonalbank|^zkb/, '#003c8f', '#fff'], [/raiffeisen/, '#c8102e', '#fff'], [/^post|die post/, '#ffcc00', '#111'], [/sprüngli/, '#0b2a5b', '#e6c56b'],
    [/^shell|^avia|^bp\b|^tamoil|^socar|^migrol|^agrola/, '#e3e3e0', '#c8102e'], [/ikea/, '#0051ba', '#ffda1a'], [/h&m|zara|c&a|manor|globus|jelmoli/, '#111', '#fff'],
  ];
  for (const [re, bg, fg] of brands) if (re.test(n)) return [bg, fg];
  return [['#1f2a36', '#2f3e2f', '#16365c', '#0a7a3d', '#4a2a36', '#223a5e', '#444', '#2b2b30', '#f4f4f0'][kind], kind === 8 ? '#111' : '#fff'];
}

function hash2(a, b) {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

function pointInRing(x, z, ring) {
  let inside = false;
  for (let i = 0, n = ring.length / 2, j = n - 1; i < n; j = i++) {
    const xi = ring[i * 2], zi = ring[i * 2 + 1], xj = ring[j * 2], zj = ring[j * 2 + 1];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

// ── textures ──
/** One repeating façade cell (about 3.4 m wide, one storey tall) per building style. White areas take the building's paint colour. */
function facadeTextures() {
  const make = (draw) => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 256;
    const g = cv.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, 256, 256);
    draw(g);
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  };
  const glass = (g, x, y, w, h, a = '#3d4d61', b = '#252f3d') => {
    const gr = g.createLinearGradient(0, y, 0, y + h);
    gr.addColorStop(0, a); gr.addColorStop(1, b);
    g.fillStyle = gr; g.fillRect(x, y, w, h);
    g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(x, y, w * 0.45, h * 0.5);
  };
  return {
    // rendered town house: window with shutters and a sill
    plaster: make((g) => {
      g.fillStyle = 'rgba(0,0,0,0.05)'; g.fillRect(0, 236, 256, 20);
      g.fillStyle = '#d9d5cc'; g.fillRect(76, 50, 104, 150);
      glass(g, 84, 58, 88, 134);
      g.fillStyle = '#d9d5cc'; g.fillRect(125, 58, 6, 134); g.fillRect(84, 118, 88, 5);
      g.fillStyle = '#5d6b58';                                   // shutters
      g.fillRect(48, 52, 26, 146); g.fillRect(182, 52, 26, 146);
      g.fillStyle = 'rgba(0,0,0,0.22)';
      for (let y = 60; y < 196; y += 12) { g.fillRect(50, y, 22, 2); g.fillRect(184, y, 22, 2); }
      g.fillStyle = '#b9b5ac'; g.fillRect(70, 200, 116, 9);
    }),
    // older stone building: tall windows with surrounds and a string course at every floor
    stone: make((g) => {
      g.fillStyle = 'rgba(0,0,0,0.10)'; g.fillRect(0, 0, 256, 10);
      g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(0, 10, 256, 5);
      g.fillStyle = 'rgba(0,0,0,0.035)';
      for (let y = 40; y < 256; y += 36) g.fillRect(0, y, 256, 2);
      g.fillStyle = '#e9e5dc'; g.fillRect(84, 44, 88, 176);
      g.fillStyle = '#cfcac0'; g.fillRect(78, 36, 100, 10); g.fillRect(80, 220, 96, 10);
      glass(g, 94, 54, 68, 158);
      g.fillStyle = '#e9e5dc'; g.fillRect(125, 54, 6, 158); g.fillRect(94, 104, 68, 5);
    }),
    // modern office: bands of glass between slim mullions
    modern: make((g) => {
      g.fillStyle = '#cdd3d9'; g.fillRect(0, 0, 256, 256);
      glass(g, 6, 30, 118, 190, '#5b7791', '#33475c');
      glass(g, 132, 30, 118, 190, '#557089', '#2f4255');
      g.fillStyle = '#8f979f'; g.fillRect(0, 222, 256, 34); g.fillRect(0, 0, 256, 28);
      g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(0, 26, 256, 3);
    }),
    // sheds and warehouses: ribbed cladding and a strip of small windows
    industrial: make((g) => {
      g.fillStyle = 'rgba(0,0,0,0.07)';
      for (let x = 0; x < 256; x += 16) g.fillRect(x, 0, 3, 256);
      glass(g, 40, 60, 176, 56, '#4b5a6a', '#34404d');
      g.fillStyle = '#d5d5d0';
      for (let x = 82; x < 216; x += 44) g.fillRect(x, 60, 5, 56);
    }),
    // ground floor of a shopping street: display window, door, fascia
    shop: make((g) => {
      g.fillStyle = '#2b2d31'; g.fillRect(0, 196, 256, 60);
      g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, 0, 256, 44);
      g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillRect(16, 12, 150, 18);
      glass(g, 12, 54, 150, 136, '#4a5a6c', '#1f2731');
      glass(g, 180, 54, 62, 202, '#3c4856', '#1b222b');
      g.fillStyle = '#c9c5bc'; g.fillRect(174, 48, 6, 208); g.fillRect(242, 48, 6, 208); g.fillRect(6, 48, 6, 148); g.fillRect(162, 48, 6, 148);
    }),
  };
}

function signAtlas() {
  const S = 128, cv = document.createElement('canvas');
  cv.width = S * 8; cv.height = S * 4;
  const g = cv.getContext('2d');
  const RED = '#d8111b', BLUE = '#0b5fb3', WHITE = '#fafafa', BLACK = '#111';
  const cell = (id, fn) => { g.save(); g.translate((id % 8) * S, Math.floor(id / 8) * S); fn(); g.restore(); };
  const text = (s, x, y, size, color = BLACK, weight = 800) => { g.fillStyle = color; g.font = `${weight} ${size}px Helvetica, Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(s, x, y); };
  const ring = (n) => () => {
    g.fillStyle = RED; g.beginPath(); g.arc(64, 64, 60, 0, 7); g.fill();
    g.fillStyle = WHITE; g.beginPath(); g.arc(64, 64, 46, 0, 7); g.fill();
    text(String(n), 64, 68, n >= 100 ? 46 : 56);
  };
  const zone = (n) => () => {
    g.fillStyle = WHITE; g.strokeStyle = BLACK; g.lineWidth = 3; g.beginPath(); g.roundRect(14, 4, 100, 120, 8); g.fill(); g.stroke();
    g.fillStyle = RED; g.beginPath(); g.arc(64, 50, 38, 0, 7); g.fill();
    g.fillStyle = WHITE; g.beginPath(); g.arc(64, 50, 28, 0, 7); g.fill();
    text(String(n), 64, 53, 34); text('ZONE', 64, 106, 22);
  };
  cell(SIGN.YIELD, () => {
    g.fillStyle = RED; g.beginPath(); g.moveTo(4, 10); g.lineTo(124, 10); g.lineTo(64, 122); g.closePath(); g.fill();
    g.fillStyle = WHITE; g.beginPath(); g.moveTo(30, 26); g.lineTo(98, 26); g.lineTo(64, 90); g.closePath(); g.fill();
  });
  cell(SIGN.STOP, () => {
    g.fillStyle = WHITE; g.beginPath();
    for (let i = 0; i < 8; i++) { const a = Math.PI / 8 + (i * Math.PI) / 4; g.lineTo(64 + Math.cos(a) * 62, 64 + Math.sin(a) * 62); }
    g.closePath(); g.fill();
    g.fillStyle = RED; g.beginPath();
    for (let i = 0; i < 8; i++) { const a = Math.PI / 8 + (i * Math.PI) / 4; g.lineTo(64 + Math.cos(a) * 56, 64 + Math.sin(a) * 56); }
    g.closePath(); g.fill();
    text('STOP', 64, 67, 38, WHITE);
  });
  cell(SIGN.PRIORITY, () => {
    const d = (r, c) => { g.fillStyle = c; g.beginPath(); g.moveTo(64, 64 - r); g.lineTo(64 + r, 64); g.lineTo(64, 64 + r); g.lineTo(64 - r, 64); g.closePath(); g.fill(); };
    d(62, BLACK); d(58, WHITE); d(42, '#f5c400');
  });
  cell(SIGN.ZONE30, zone(30));
  cell(SIGN.ZONE20, () => {
    g.fillStyle = BLUE; g.beginPath(); g.roundRect(8, 8, 112, 112, 10); g.fill();
    g.fillStyle = WHITE; g.beginPath(); g.arc(44, 46, 9, 0, 7); g.fill(); g.fillRect(36, 58, 16, 34);
    g.beginPath(); g.arc(78, 60, 6, 0, 7); g.fill(); g.fillRect(73, 68, 10, 24);
    g.fillStyle = RED; g.beginPath(); g.arc(98, 34, 17, 0, 7); g.fill();
    g.fillStyle = WHITE; g.beginPath(); g.arc(98, 34, 12, 0, 7); g.fill();
    text('20', 98, 35, 15);
  });
  cell(SIGN.S30, ring(30)); cell(SIGN.S40, ring(40)); cell(SIGN.S50, ring(50)); cell(SIGN.S60, ring(60));
  cell(SIGN.S80, ring(80)); cell(SIGN.S100, ring(100)); cell(SIGN.S120, ring(120));
  cell(SIGN.NOENTRY, () => {
    g.fillStyle = WHITE; g.beginPath(); g.arc(64, 64, 62, 0, 7); g.fill();
    g.fillStyle = RED; g.beginPath(); g.arc(64, 64, 58, 0, 7); g.fill();
    g.fillStyle = WHITE; g.fillRect(22, 52, 84, 24);
  });
  cell(SIGN.ROUNDABOUT, () => {
    g.fillStyle = WHITE; g.beginPath(); g.arc(64, 64, 62, 0, 7); g.fill();
    g.fillStyle = BLUE; g.beginPath(); g.arc(64, 64, 58, 0, 7); g.fill();
    g.strokeStyle = WHITE; g.lineWidth = 11; g.fillStyle = WHITE;
    for (let i = 0; i < 3; i++) {
      const a0 = (i * 2 * Math.PI) / 3 + 0.5;
      g.beginPath(); g.arc(64, 64, 30, a0, a0 - 1.25, true); g.stroke();   // anticlockwise flow
      const a1 = a0 - 1.45, tx = 64 + Math.cos(a1) * 30, ty = 64 + Math.sin(a1) * 30;
      g.save(); g.translate(tx, ty); g.rotate(a1 - Math.PI / 2);
      g.beginPath(); g.moveTo(0, -15); g.lineTo(13, 6); g.lineTo(-13, 6); g.closePath(); g.fill(); g.restore();
    }
  });
  cell(SIGN.MOTORWAY, () => {
    g.fillStyle = WHITE; g.beginPath(); g.roundRect(6, 6, 116, 116, 10); g.fill();
    g.fillStyle = '#0a7a3c'; g.beginPath(); g.roundRect(10, 10, 108, 108, 8); g.fill();
    g.fillStyle = WHITE;
    g.beginPath(); g.moveTo(44, 112); g.lineTo(58, 30); g.lineTo(60, 30); g.lineTo(54, 112); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(84, 112); g.lineTo(70, 30); g.lineTo(68, 30); g.lineTo(74, 112); g.closePath(); g.fill();
    g.fillRect(24, 40, 80, 9); g.fillRect(34, 49, 7, 16); g.fillRect(87, 49, 7, 16);
  });
  cell(SIGN.PEDX, () => {
    g.fillStyle = BLUE; g.beginPath(); g.roundRect(6, 6, 116, 116, 8); g.fill();
    g.fillStyle = WHITE; g.beginPath(); g.moveTo(64, 16); g.lineTo(114, 106); g.lineTo(14, 106); g.closePath(); g.fill();
    g.fillStyle = BLACK; g.beginPath(); g.arc(66, 48, 7, 0, 7); g.fill();
    g.lineWidth = 7; g.strokeStyle = BLACK; g.lineCap = 'round';
    g.beginPath(); g.moveTo(64, 58); g.lineTo(62, 78); g.lineTo(50, 98); g.moveTo(62, 78); g.lineTo(76, 98); g.moveTo(52, 70); g.lineTo(78, 66); g.stroke();
  });
  const noTurn = (sg) => () => {
    g.fillStyle = RED; g.beginPath(); g.arc(64, 64, 60, 0, 7); g.fill();
    g.fillStyle = WHITE; g.beginPath(); g.arc(64, 64, 47, 0, 7); g.fill();
    g.strokeStyle = BLACK; g.lineWidth = 11; g.lineCap = 'butt'; g.lineJoin = 'miter';
    g.beginPath(); g.moveTo(64 + sg * 14, 98); g.lineTo(64 + sg * 14, 58); g.lineTo(64 - sg * 14, 58); g.stroke();
    g.fillStyle = BLACK; g.beginPath(); g.moveTo(64 - sg * 34, 58); g.lineTo(64 - sg * 12, 40); g.lineTo(64 - sg * 12, 76); g.closePath(); g.fill();
    g.strokeStyle = RED; g.lineWidth = 10; g.beginPath(); g.moveTo(31, 31); g.lineTo(97, 97); g.stroke();
  };
  cell(SIGN.NOLEFT, noTurn(1)); cell(SIGN.NORIGHT, noTurn(-1));
  cell(SIGN.TRAMSTOP, () => {
    g.fillStyle = WHITE; g.beginPath(); g.roundRect(6, 6, 116, 116, 8); g.fill();
    g.fillStyle = BLUE; g.beginPath(); g.roundRect(12, 12, 104, 104, 6); g.fill();
    text('T', 64, 68, 84, WHITE);
  });
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

const LAYER = (k) => ({ polygonOffset: true, polygonOffsetFactor: -k, polygonOffsetUnits: -4 * k });
const HOLE = {};

export class World {
  constructor(scene, net, opts = {}) {
    this.scene = scene;
    this.net = net;
    this.viewDist = opts.viewDist || 850;
    this.tiles = new Map();
    this.queue = [];
    this.pending = 0;
    const L = THREE.MeshLambertMaterial;
    this.mat = {
      ground: new L({ color: '#7c8a6c', ...HOLE }),
      green: new L({ color: '#6c9a58', ...LAYER(1), ...HOLE }),
      forest: new L({ color: '#557f4b', ...LAYER(1), ...HOLE }),
      water: new THREE.MeshPhongMaterial({ color: '#3f7ea6', shininess: 90, specular: '#9fc4dd', ...LAYER(1.5), ...HOLE }),
      bed: new L({ vertexColors: true, ...LAYER(2), ...HOLE }),
      sidewalk: new L({ vertexColors: true, ...LAYER(2.5) }),
      road: new L({ vertexColors: true, ...LAYER(3) }),
      mark: new L({ vertexColors: true, ...LAYER(4) }),
      wall: null,
      roof: new L({ vertexColors: true }),
      prop: new L({ vertexColors: true }),
      propDouble: new L({ vertexColors: true, side: THREE.DoubleSide }),
      tunnel: new L({ vertexColors: true, side: THREE.DoubleSide, emissive: '#2a2b2e' }),
      glow: new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false }),
      sign: new L({ map: signAtlas(), alphaTest: 0.5, emissive: '#222' }),
      cap: new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, depthTest: false, stencilWrite: true, stencilRef: 1, stencilFunc: THREE.AlwaysStencilFunc, stencilZPass: THREE.ReplaceStencilOp, stencilZFail: THREE.ReplaceStencilOp }),
      trunk: new L({ color: '#5d4a3a' }),
      crown: new L({ color: '#ffffff' }),
    };
    const ft = facadeTextures();
    this.wallMats = {};
    for (const k of Object.keys(ft)) this.wallMats[k] = new L({ vertexColors: true, map: ft[k] });
    this.centre = net.toWorld(47.3697, 8.5389);          // Paradeplatz: buildings get grander towards it
    this.treeGeo = {
      trunk: new THREE.CylinderGeometry(0.16, 0.24, 2.6, 5).translate(0, 1.3, 0),
      crown: new THREE.IcosahedronGeometry(2.0, 0).scale(1, 1.25, 1).translate(0, 4.6, 0),
    };

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(14000, 14000).rotateX(-Math.PI / 2), this.mat.ground);
    ground.renderOrder = -5;
    scene.add(ground);
    this.ground = ground;

    // signal lamps (only the lit ones are drawn)
    const lampGeo = new THREE.CircleGeometry(0.115, 12);
    this.lamps = new THREE.InstancedMesh(lampGeo, new THREE.MeshBasicMaterial({ fog: false }), 512);
    this.lamps.frustumCulled = false;
    this.lamps.count = 0;
    scene.add(this.lamps);

    this._index();
    this.big = null;
  }

  _tk(x, z) { return `${Math.floor(x / this.net.tile)}_${Math.floor(z / this.net.tile)}`; }

  _index() {
    const net = this.net, home = (this.home = new Map());
    const slot = (k) => { let h = home.get(k); if (!h) home.set(k, (h = { edges: [], nodes: [], tram: [], forest: [], water: [], green: [] })); return h; };
    const tmp = {};
    for (const e of net.edges) { net.sample(e, e.len / 2, tmp); slot(this._tk(tmp.x, tmp.z)).edges.push(e); }
    for (const n of net.nodes) slot(this._tk(n.x, n.z)).nodes.push(n);
    for (const e of net.tram.edges) { const i = (e.n >> 1) * 3; slot(this._tk(e.pts[i], e.pts[i + 2])).tram.push(e); }
    this._slot = slot;
  }

  /** Lake, rivers, forests and large parks: kept as outlines and painted onto the terrain tile by tile. */
  async loadBig(url) {
    const big = await (await fetch(url)).json();
    const S = this.net.tile;
    this.forests = [];
    for (const kind of ['water', 'green', 'forest']) {
      for (const r of big[kind]) {
        const ring = new Float32Array(r.length);
        let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
        for (let i = 0; i < r.length; i += 2) {
          ring[i] = r[i] / 10; ring[i + 1] = r[i + 1] / 10;
          x0 = Math.min(x0, ring[i]); x1 = Math.max(x1, ring[i]); z0 = Math.min(z0, ring[i + 1]); z1 = Math.max(z1, ring[i + 1]);
        }
        const f = { ring, x0, x1, z0, z1 };
        for (let tx = Math.floor(x0 / S); tx <= Math.floor(x1 / S); tx++) for (let tz = Math.floor(z0 / S); tz <= Math.floor(z1 / S); tz++) this._slot(`${tx}_${tz}`)[kind].push(f);
      }
    }
  }

  // ── terrain ──
  /** Height of the ground (as drawn) at a point; falls back to the raw elevation where no tile is loaded. */
  heightAt(x, z) {
    const tile = this.tiles.get(this._tk(x, z));
    return tile && tile.h ? this._tileHeight(tile, x, z) : this.net.ground(x, z);
  }

  _tileHeight(tile, x, z) {
    const N = tile.hN, S = this.net.tile;
    let fx = ((x - tile.tx * S) / S) * N, fz = ((z - tile.tz * S) / S) * N;
    fx = fx < 0 ? 0 : fx > N - 0.001 ? N - 0.001 : fx; fz = fz < 0 ? 0 : fz > N - 0.001 ? N - 0.001 : fz;
    const i = fx | 0, j = fz | 0, ax = fx - i, az = fz - j, h = tile.h, n = N + 1;
    return (h[j * n + i] * (1 - ax) + h[j * n + i + 1] * ax) * (1 - az) + (h[(j + 1) * n + i] * (1 - ax) + h[(j + 1) * n + i + 1] * ax) * az;
  }

  /**
   * The ground for one tile: real elevation on a 10 m grid, levelled to meet every road, tram line and
   * railway that runs across it, left open where a tunnel comes to the surface, and painted with
   * forest, parks and water.
   */
  _buildTerrain(tile) {
    const net = this.net, S = net.tile, N = 50, step = S / N, ox = tile.tx * S, oz = tile.tz * S, n = N + 1;
    const FLAT = 14.5, FADE = 34, CELL = 34;
    // everything the ground has to meet, as line segments in a coarse grid
    const segs = [], cells = new Map();
    const addSeg = (ax, ay, az, bx, by, bz, half, tunnel) => {
      const id = segs.length / 8;
      segs.push(ax, ay, az, bx, by, bz, half, tunnel ? 1 : 0);
      const c0 = Math.floor((Math.min(ax, bx) - FADE - half) / CELL), c1 = Math.floor((Math.max(ax, bx) + FADE + half) / CELL);
      const d0 = Math.floor((Math.min(az, bz) - FADE - half) / CELL), d1 = Math.floor((Math.max(az, bz) + FADE + half) / CELL);
      for (let c = c0; c <= c1; c++) for (let d = d0; d <= d1; d++) { const k = c * 100003 + d; let a = cells.get(k); if (!a) cells.set(k, (a = [])); a.push(id); }
    };
    const addLine = (pts, cnt, half, tunnel) => { for (let i = 0; i < cnt - 1; i++) addSeg(pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2], pts[i * 3 + 3], pts[i * 3 + 4], pts[i * 3 + 5], half, tunnel); };
    net.forEdgesNear(ox + S / 2, oz + S / 2, S * 0.75 + 60, (e) => addLine(e.pts, e.n, Math.max(e.paveR, -e.paveL) + (e.sidewalk ? 2.2 : 0.4), e.tunnel));
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) { const h = this.home.get(`${tile.tx + dx}_${tile.tz + dz}`); if (h) for (const e of h.tram) addLine(e.pts, e.n, 1.4, false); }
    for (const r of tile.rails || []) addLine(r.pts, r.n, 2.0, false);

    const H = new Float32Array(n * n), cut = new Uint8Array(n * n);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = ox + i * step, z = oz + j * step, g = net.ground(x, z);
      let bo = 1e9, by = 0;
      const list = cells.get(Math.floor(x / CELL) * 100003 + Math.floor(z / CELL));
      if (list) for (const id of list) {
        const o = id * 8, ax = segs[o], az = segs[o + 2], dx = segs[o + 3] - ax, dz = segs[o + 5] - az;
        let t = ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1e-9);
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const px = ax + dx * t, pz = az + dz * t, out = Math.max(0, Math.hypot(x - px, z - pz) - segs[o + 6]);
        if (out > FADE) continue;
        const sy = segs[o + 1] + (segs[o + 4] - segs[o + 1]) * t, above = sy - net.ground(px, pz);
        if (segs[o + 7]) {                             // a tunnel: open the ground where it is close to the surface
          if (above > -8.5 && out < FLAT) cut[j * n + i] = 1;
          if (above < -3) continue;                    // deep underground: the hill above stays as it is
        } else if (above > 1.5) continue;             // a bridge: the ground stays below it
        if (out < bo) { bo = out; by = sy; }
      }
      let w = bo <= FLAT ? 1 : bo >= FADE ? 0 : 1 - (bo - FLAT) / (FADE - FLAT);
      w = w * w * (3 - 2 * w);
      H[j * n + i] = g + (by - 0.12 - g) * w;
    }
    tile.h = H; tile.hN = N;

    const pos = new Float32Array(n * n * 3), uv = new Float32Array(n * n * 2), idx = [];
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const k = j * n + i;
      pos[k * 3] = ox + i * step; pos[k * 3 + 1] = H[k]; pos[k * 3 + 2] = oz + j * step;
      uv[k * 2] = i / N; uv[k * 2 + 1] = 1 - j / N;
    }
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
      if (cut[a] || cut[b] || cut[c] || cut[d]) continue;
      idx.push(a, c, b, b, c, d);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();

    // land cover, painted at about 1 m per pixel
    const cv = document.createElement('canvas');
    cv.width = cv.height = 512;
    const g2 = cv.getContext('2d'), sc = 512 / S;
    g2.fillStyle = '#7c8a6c'; g2.fillRect(0, 0, 512, 512);
    g2.setTransform(sc, 0, 0, sc, -ox * sc, -oz * sc);
    const paint = (ring, scale, px, pz) => { g2.beginPath(); for (let i = 0; i < ring.length; i += 2) g2[i ? 'lineTo' : 'moveTo'](px + ring[i] * scale, pz + ring[i + 1] * scale); g2.closePath(); g2.fill(); };
    const slot = this.home.get(tile.k), d = tile.data || {};
    g2.fillStyle = '#6c9a58';
    if (slot) for (const f of slot.green) paint(f.ring, 1, 0, 0);
    for (const r of d.g || []) paint(r, 0.1, ox, oz);
    g2.fillStyle = '#557f4b';
    if (slot) for (const f of slot.forest) paint(f.ring, 1, 0, 0);
    g2.fillStyle = '#3f7ea6';
    if (slot) for (const f of slot.water) paint(f.ring, 1, 0, 0);
    for (const r of d.w || []) paint(r, 0.1, ox, oz);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex }));
    mesh.matrixAutoUpdate = false;
    mesh.userData.ownMaterial = true;
    this._add(tile, mesh, -5);
  }

  // ── streaming ──
  update(px, pz, budgetMs = 5) {
    const S = this.net.tile, R = this.viewDist;
    this.ground.position.set(Math.round(px / 200) * 200, this.net.ground(px, pz) - 60, Math.round(pz / 200) * 200);     // only a backdrop under the terrain
    const cx = Math.floor(px / S), cz = Math.floor(pz / S), span = Math.ceil(R / S);
    const rectDist = (tx, tz) => {
      const dx = Math.max(tx * S - px, 0, px - (tx + 1) * S), dz = Math.max(tz * S - pz, 0, pz - (tz + 1) * S);
      return Math.hypot(dx, dz);
    };
    for (let tx = cx - span; tx <= cx + span; tx++) for (let tz = cz - span; tz <= cz + span; tz++) {
      const k = `${tx}_${tz}`;
      if (this.tiles.has(k)) continue;
      const d = rectDist(tx, tz);
      if (d > R) continue;
      if (!this.home.has(k) && !this.net.tiles.has(k)) this._slot(k);       // open country still needs ground
      const tile = { k, tx, tz, group: new THREE.Group(), stage: 0, data: null, fetched: false, signals: [], blds: [], d };
      tile.group.matrixAutoUpdate = false;
      this.tiles.set(k, tile);
      this.scene.add(tile.group);
      this.queue.push(tile);
      if (this.net.tiles.has(k)) {
        fetch(new URL(`../data/tiles/${k}.json`, import.meta.url)).then((r) => (r.ok ? r.json() : {})).catch(() => ({}))
          .then((d2) => { tile.data = d2; tile.fetched = true; });
      } else { tile.data = {}; tile.fetched = true; }
    }
    for (const [k, tile] of this.tiles) {
      if (rectDist(tile.tx, tile.tz) > R + 350) {
        this.scene.remove(tile.group);
        tile.group.traverse((o) => { if (o.geometry && !o.userData.shared) o.geometry.dispose(); if (o.userData.ownMaterial) { o.material.map.dispose(); o.material.dispose(); } });
        tile.dead = true;
        this.tiles.delete(k);
      }
    }
    if (!this.queue.length) return;
    for (const t of this.queue) t.d = rectDist(t.tx, t.tz);
    this.queue.sort((a, b) => a.d - b.d);
    const t0 = performance.now();
    let i = 0;
    while (i < this.queue.length && performance.now() - t0 < budgetMs) {
      const t = this.queue[i];
      if (t.dead) { this.queue.splice(i, 1); continue; }
      if (t.stage === 0) { this._buildRoads(t); t.stage = 1; continue; }
      if (!t.fetched) { i++; continue; }
      if (t.stage === 1) { this._readRails(t); this._buildTerrain(t); t.stage = 1.5; continue; }
      if (t.stage === 1.5) { this._buildBuildings(t); t.stage = 2; continue; }
      if (t.stage === 2) { this._buildNature(t); t.stage = 3; }
      this.queue.splice(i, 1);
    }
  }

  get busy() { return this.queue.length; }

  /** Load everything around a point before play starts. */
  async prime(px, pz, onProgress) {
    this.update(px, pz, 0);
    const total = this.queue.length || 1;
    while (this.queue.length) {
      this.update(px, pz, 30);
      if (onProgress) onProgress(1 - this.queue.length / total);
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  _add(tile, mesh, order = 0, cast = false) {
    if (!mesh) return;
    mesh.renderOrder = order;
    mesh.receiveShadow = true;
    mesh.castShadow = cast;
    tile.group.add(mesh);
  }

  // ── roads ──
  _buildRoads(tile) {
    const net = this.net, h = this.home.get(tile.k);
    if (!h) return;
    const road = new Batch(), side = new Batch(), mark = new Batch(), prop = new Batch(), propD = new Batch(), tun = new Batch(), glow = new Batch(), cap = new Batch(), bed = new Batch();
    const signs = new Batch(true);
    const W = PAL.white, Y = PAL.yellow;
    this._kn = new Map();          // poles that can be knocked down, keyed by position

    for (const e of h.edges) {
      prep(e);
      const asph = PAL.asphalt[e.t];
      strip(road, e, 0, e.len, e.paveL, e.paveR, 0.05, asph);
      if (e.sidewalk) strip(side, e, 0, e.len, e.paveL - 2.2, e.paveR + 2.2, 0.02, PAL.sidewalk);
      const s0 = e.trimA, s1 = e.len - e.trimB;
      const mw = e.t <= T.TRUNK;
      if (s1 - s0 > 3) {
        const [dash, gap] = mw ? [6, 12] : [3, 6];
        if (!e.oneway && e.t <= T.UNCLASSIFIED && e.lw > 2.8) {
          if (e.nf + e.nb >= 3) strip(mark, e, s0, s1, -0.08, 0.08, 0.07, W);
          else dashes(mark, e, s0, s1, 0, 0.15, 3, 5, 0.07, W);
        }
        for (let i = 1; i < e.nf; i++) dashes(mark, e, s0, s1, (e.oneway ? e.offL : 0) + i * e.lw, 0.15, dash, gap, 0.07, W);
        for (let i = 1; i < e.nb; i++) dashes(mark, e, s0, s1, -i * e.lw, 0.15, dash, gap, 0.07, W);
        if (mw || e.t <= T.SECONDARY) {
          strip(mark, e, s0, s1, e.offR - 0.08, e.offR + 0.08, 0.07, W);
          strip(mark, e, s0, s1, e.offL - 0.08, e.offL + 0.08, 0.07, W);
        }
        if (e.cyR) dashes(mark, e, s0, s1, e.offR, 0.14, 1, 1, 0.075, Y);
        if (e.cyL) dashes(mark, e, s0, s1, e.offL, 0.14, 1, 1, 0.075, Y);
      }
      if (e.sidewalk && s1 - s0 > 3 && !e.tunnel) {
        strip(mark, e, s0, s1, e.paveR - 0.02, e.paveR + 0.2, 0.066, PAL.kerb);
        strip(mark, e, s0, s1, e.paveL - 0.2, e.paveL + 0.02, 0.066, PAL.kerb);
        // street lamps, alternating sides
        let k = (e.id * 7) % 2;
        for (let sl = s0 + 9 + ((e.id * 13) % 17); sl < s1 - 6; sl += 36, k++) {
          const q = section(e, sl), ql = Math.hypot(q.nx, q.nz) || 1, rx = q.nx / ql, rz = q.nz / ql;
          const sgn = k % 2 ? 1 : -1, off = sgn > 0 ? e.paveR + 1.3 : e.paveL - 1.3;
          const x = q.x + rx * off, z = q.z + rz * off;
          const m = net.locate(x, z, { y: q.y }, 8);
          if (m && m.outside < 0.6) continue;                  // would stand in another carriageway
          const hd = headingOf(-rx * sgn, -rz * sgn);           // facing the road
          box(prop, x, q.y, z, 0.14, 7.2, 0.14, hd, PAL.mast);
          box(prop, x - rx * sgn * 0.9, q.y + 7.1, z - rz * sgn * 0.9, 0.12, 0.1, 1.9, hd, PAL.mast);
          box(prop, x - rx * sgn * 1.75, q.y + 6.98, z - rz * sgn * 1.75, 0.34, 0.12, 0.6, hd, PAL.lamp);
        }
      }
      // stop / give-way lines
      for (const dir of [1, -1]) {
        if (dir < 0 && e.oneway) continue;
        const ctl = net.control(e, dir);
        if (ctl !== C.SIGNAL && ctl !== C.STOP && ctl !== C.YIELD) continue;
        if (e.merge && ctl === C.YIELD) continue;            // acceleration lane: no give-way line, you merge
        const d = net.stopDist(e, dir);
        const sLine = dir > 0 ? e.len - d : d;
        const lo = dir > 0 ? (e.oneway ? e.offL : 0) : e.offL, hi = dir > 0 ? e.offR : 0;
        if (ctl === C.YIELD) {
          const q = section(e, sLine);
          const tl = Math.hypot(q.nx, q.nz) || 1, rx = q.nx / tl, rz = q.nz / tl, fx = rz * dir, fz = -rx * dir;   // f = travel direction
          for (let o = lo + 0.35; o < hi - 0.3; o += 0.75) {
            const bx = q.x + rx * o, bz = q.z + rz * o, y = q.y + 0.075;
            const a = mark.v(bx - rx * 0.25, y, bz - rz * 0.25, W), b2 = mark.v(bx + rx * 0.25, y, bz + rz * 0.25, W), c2 = mark.v(bx - fx * 0.7, y, bz - fz * 0.7, W);
            if (dir > 0) mark.tri(b2, a, c2); else mark.tri(a, b2, c2);
          }
        } else {
          strip(mark, e, sLine - 0.25, sLine + 0.25, lo + 0.1, hi - 0.1, 0.075, W);
        }
        const pole = this._roadside(e, dir, e.len - d + (ctl === C.SIGNAL ? 2.2 : 0.5), 0.9);
        if (ctl === C.SIGNAL) {
          this._signalHead(tile, prop, pole, e, dir);
          if (net.lanes(e, dir) >= 2 || e.oneway) this._signalHead(tile, prop, this._roadside(e, dir, e.len - d + 2.2, 0.9, true), e, dir);
        } else {
          this._sign(signs, prop, pole, ctl === C.STOP ? SIGN.STOP : SIGN.YIELD, 2.55, 0.95);
          if (ctl === C.YIELD && net.nodes[net.endNode(e, dir)].ends.some((en) => net.edges[en.e].roundabout)) this._sign(signs, null, pole, SIGN.ROUNDABOUT, 1.7, 0.7);
        }
      }
      // signed turn bans
      for (const dir of [1, -1]) {
        const set = net.bans.get(e.id * 2 + (dir > 0 ? 1 : 0));
        if (!set || e.len < 20) continue;
        // a "no left turn" sign only where every way to the left is closed (likewise right)
        let left = null, right = null;
        for (const x of net.exits(net.endNode(e, dir), e.id)) {
          const a = net.turnAngle(e, dir, x.e, x.dir), ban = set.has(x.e.id);
          if (a < -0.5) left = (left === null ? true : left) && ban; else if (a > 0.5) right = (right === null ? true : right) && ban;
        }
        const sT = e.len - net.stopDist(e, dir) - 5;
        if (left) this._sign(signs, prop, this._roadside(e, dir, sT, 0.9, e.oneway), SIGN.NOLEFT, 2.5, 0.8);
        if (right) this._sign(signs, prop, this._roadside(e, dir, sT, 0.9), SIGN.NORIGHT, left && !e.oneway ? 1.65 : 2.5, 0.8);
      }
      // lane arrows where the approach is split into turning lanes
      for (const dir of [1, -1]) {
        const masks = net.turnsAt(e, dir);
        if (!masks) continue;
        for (const back of e.len > 90 ? [9, 38] : [9]) {
          const sT = e.len - net.stopDist(e, dir) - back;
          for (let lane = 0; lane < masks.length; lane++) if (masks[lane]) this._arrow(mark, e, dir, lane, sT, masks[lane]);
        }
      }
      // priority-road and speed signs, no-entry
      for (const dir of [1, -1]) {
        if (dir < 0 && e.oneway) continue;
        if (net.control(e, dir) === C.PRIORITY && !e.roundabout && e.len > 60 && e.t >= T.PRIMARY && e.t <= T.RESIDENTIAL) {
          this._sign(signs, prop, this._roadside(e, dir, e.len - net.trimEnd(e, dir) - 22, 0.9), SIGN.PRIORITY, 2.4, 0.75);
        }
        if (e.len > 45 && !e.roundabout) {
          const startNode = net.startNode(e, dir);
          let prevSpeed = -1, bestTurn = 1.0;
          for (const ap of net.approaches(startNode)) {
            if (ap.e === e) continue;
            const turn = Math.abs(net.turnAngle(ap.e, ap.dir, e, dir));
            if (turn < bestTurn) { bestTurn = turn; prevSpeed = ap.e.speed; }
          }
          const enteringMw = e.t === T.MOTORWAY && !e.link && net.approaches(startNode).some((ap) => ap.e !== e && (ap.e.link || ap.e.t !== T.MOTORWAY));
          if (prevSpeed !== e.speed && SPEED_SIGN[e.speed] !== undefined) {
            const p = this._roadside(e, dir, net.trimStart(e, dir) + 7, 0.9);
            this._sign(signs, prop, p, SPEED_SIGN[e.speed], 2.5, 0.85);
            if (enteringMw) this._sign(signs, null, p, SIGN.MOTORWAY, 1.6, 0.8);
          }
        }
      }
      if (e.oneway && net.nodes[e.b].ends.length >= 3 && e.t >= T.PRIMARY && !e.roundabout && !e.link && e.len > 12) {
        for (const left of [false, true]) {
          const p = this._roadside(e, 1, e.len - e.trimB - 1.5, 0.7, left);
          p.h += Math.PI;      // faces drivers who would enter the wrong way
          this._sign(signs, prop, p, SIGN.NOENTRY, 2.3, 0.8);
        }
      }
      // zebra crossings
      for (const c of e.crossings) {
        for (let o = e.offL - e.cyL + 0.25; o < e.offR + e.cyR - 0.3; o += 1.0) strip(mark, e, c.s - 1.8, c.s + 1.8, o, o + 0.5, 0.075, Y);
        if (c.own) {        // stand-alone pedestrian light: stop line and signal heads for both directions
          for (const dir of e.oneway ? [1] : [1, -1]) {
            const sT = (dir > 0 ? c.s : e.len - c.s) - 3.2;
            if (sT < 2) continue;
            const sLine = dir > 0 ? sT : e.len - sT;
            const lo = dir > 0 ? (e.oneway ? e.offL : 0) : e.offL, hi = dir > 0 ? e.offR : 0;
            strip(mark, e, sLine - 0.25, sLine + 0.25, lo + 0.1, hi - 0.1, 0.075, W);
            this._signalHead(tile, prop, this._roadside(e, dir, sT + 1.4, 0.9), e, dir, c);
          }
        }
        if (!c.sig && e.t <= T.TERTIARY) {
          for (const dir of e.oneway ? [1] : [1, -1]) {
            const sT = (dir > 0 ? c.s : e.len - c.s) - 1.5;
            if (sT > 3) this._sign(signs, prop, this._roadside(e, dir, sT, 1.0), SIGN.PEDX, 2.4, 0.7);
          }
        }
      }
      this._structures(e, prop, propD, tun, glow);
    }

    for (const n of h.nodes) {
      if (n.ends.length < 2) continue;
      let w = 0, t = 9, walk = false;
      for (const { e } of n.ends) { const ed = net.edges[e]; w = Math.max(w, ed.paveR, -ed.paveL); t = Math.min(t, ed.t); walk = walk || ed.sidewalk; }
      const r = n.ends.length >= 3 ? Math.max(w, n.r * 0.85) : w;
      disc(road, n.x, n.y + 0.05, n.z, r, PAL.asphalt[t]);
      if (walk) disc(side, n.x, n.y + 0.02, n.z, r + 2.2, PAL.sidewalk, 16);
    }

    for (const e of h.tram) {
      prep(e);
      let s0 = -1;
      const flush = (s1) => {
        if (s0 < 0) return;
        strip(bed, e, s0, s1, -1.25, 1.25, 0.03, PAL.bed);
        strip(mark, e, s0, s1, -0.57, -0.47, 0.08, PAL.rail);
        strip(mark, e, s0, s1, 0.47, 0.57, 0.08, PAL.rail);
        s0 = -1;
      };
      for (let i = 0; i < e.n; i++) {
        const under = e.rel[i] < -0.8;
        if (!under && s0 < 0) s0 = e.cum[i];
        if (under) flush(e.cum[i]);
      }
      flush(e.len);
      // contact wire, with a mast and bracket every forty metres where there is room for one
      let w0 = -1;
      const wire = (w1) => { if (w0 >= 0 && w1 - w0 > 1) strip(propD, e, w0, w1, -0.035, 0.035, 5.7, PAL.wire); w0 = -1; };
      for (let i = 0; i < e.n; i++) { const under = e.rel[i] < -0.8; if (!under && w0 < 0) w0 = e.cum[i]; if (under) wire(e.cum[i]); }
      wire(e.len);
      for (let sm = 12 + ((e.id * 11) % 23); sm < e.len - 4; sm += 40) {
        const q = section(e, sm), ql = Math.hypot(q.nx, q.nz) || 1, rx = q.nx / ql, rz = q.nz / ql;
        if (net.sample(e, sm, {}).rel < -0.5) continue;
        const x = q.x + rx * 3.1, z = q.z + rz * 3.1;
        const m = net.locate(x, z, { y: q.y }, 8);
        if (m && m.outside < 0.6) continue;
        const hd = headingOf(-rx, -rz);
        box(prop, x, q.y, z, 0.2, 6.4, 0.2, hd, PAL.mast);
        box(prop, x - rx * 1.55, q.y + 5.95, z - rz * 1.55, 0.09, 0.09, 3.2, hd, PAL.mast);
      }
      for (const st of e.stops) {
        const q = section(e, st.s), l = Math.hypot(q.nx, q.nz) || 1;
        if (net.sample(e, st.s, {}).rel < -0.5) continue;
        const hd = headingOf(q.nz / l, -q.nx / l);
        this._sign(signs, prop, { x: q.x + (q.nx / l) * 2.6, y: q.y, z: q.z + (q.nz / l) * 2.6, h: hd + Math.PI }, SIGN.TRAMSTOP, 2.6, 0.6);
      }
    }

    this._add(tile, bed.mesh(this.mat.bed), -3);
    this._add(tile, side.mesh(this.mat.sidewalk), -2);
    this._add(tile, road.mesh(this.mat.road), -1);
    this._add(tile, mark.mesh(this.mat.mark));
    const propMesh = prop.mesh(this.mat.prop), signMesh = signs.mesh(this.mat.sign);
    tile.knock = [...this._kn.values()];
    // a pole that the simplified road layout has left standing in a carriageway (medians, split roads) is not an obstacle
    for (const k of tile.knock) { const m = net.locate(k.x, k.z, { y: k.y }, 8); if (m && m.outside < 0.5) k.alive = false; }
    tile.kmesh = { prop: propMesh, signs: signMesh };
    this._add(tile, propMesh, 0, true);
    this._add(tile, propD.mesh(this.mat.propDouble), 0, true);
    this._add(tile, tun.mesh(this.mat.tunnel));
    this._add(tile, glow.mesh(this.mat.glow));
    this._add(tile, signMesh);
  }

  /** A spot beside the road: sTravel along (e,dir), `gap` metres outside the pavement on the right (or left). h = travel heading. */
  _roadside(e, dir, sTravel, gap, left = false) {
    const q = section(e, dir > 0 ? sTravel : e.len - sTravel), l = Math.hypot(q.nx, q.nz) || 1;
    const rx = q.nx / l, rz = q.nz / l;
    const rightSide = (dir > 0) !== left;      // which side of the a→b centreline
    const off = rightSide ? e.paveR + gap : e.paveL - gap;
    return { x: q.x + rx * off, y: q.y, z: q.z + rz * off, h: headingOf(rz * dir, -rx * dir) };
  }

  /** White lane arrow painted on the road. mask: 1 left, 2 straight on, 4 right. */
  _arrow(b, e, dir, lane, sTravel, mask) {
    const p = this.net.lanePoint(e, dir, lane, sTravel, {});
    const fx = p.tx, fz = p.tz, rx = -p.tz, rz = p.tx, y = p.y + 0.076, W = PAL.white;
    const P = (r, f) => [p.x + rx * r + fx * f, p.z + rz * r + fz * f];
    const tri = (A, B, C2) => {
      const up = (B[0] - A[0]) * (C2[1] - A[1]) - (B[1] - A[1]) * (C2[0] - A[0]) < 0;
      const i0 = b.v(A[0], y, A[1], W), i1 = b.v(B[0], y, B[1], W), i2 = b.v(C2[0], y, C2[1], W);
      if (up) b.tri(i0, i1, i2); else b.tri(i0, i2, i1);
    };
    const rect = (r0, f0, r1, f1) => { tri(P(r0, f0), P(r1, f0), P(r1, f1)); tri(P(r0, f0), P(r1, f1), P(r0, f1)); };
    const straight = mask & 2, top = straight ? 0.6 : -0.1;
    rect(-0.09, -2.4, 0.09, top);
    if (straight) tri(P(-0.38, 0.6), P(0.38, 0.6), P(0, 2.2));
    for (const [bit, sg] of [[1, -1], [4, 1]]) {
      if (!(mask & bit)) continue;
      const f0 = straight ? -1.1 : -0.1;
      rect(0, f0 - 0.09, sg * 0.75, f0 + 0.09);
      tri(P(sg * 0.7, f0 - 0.42), P(sg * 0.7, f0 + 0.42), P(sg * 1.55, f0));
    }
  }

  /** Sign plate facing oncoming traffic (i.e. against heading p.h). */
  _sign(b, prop, p, id, height, size) {
    const fh = p.h + Math.PI;                       // facing direction
    const fx = Math.sin(fh), fz = -Math.cos(fh);    // normal
    const rx = Math.cos(fh), rz = Math.sin(fh);     // plate's right as seen from the front is −r
    const u0 = (id % 8) / 8, v0 = 1 - (Math.floor(id / 8) + 1) / 4, du = 1 / 8, dv = 1 / 4, hs = size / 2;
    const cx = p.x + fx * 0.06, cz = p.z + fz * 0.06, cy = p.y + height;
    const c = [1, 1, 1];
    const a = b.v(cx + rx * hs, cy - hs, cz + rz * hs, c, fx, 0, fz, u0, v0);
    const b1 = b.v(cx - rx * hs, cy - hs, cz - rz * hs, c, fx, 0, fz, u0 + du, v0);
    const c1 = b.v(cx - rx * hs, cy + hs, cz - rz * hs, c, fx, 0, fz, u0 + du, v0 + dv);
    const d = b.v(cx + rx * hs, cy + hs, cz + rz * hs, c, fx, 0, fz, u0, v0 + dv);
    b.quad(a, b1, c1, d);
    const k = this._pole(p);
    k.ranges.push(['signs', d - 3, d + 1]);
    k.plates.push({ id, height, size });
    if (prop) { const v0 = prop.count; box(prop, p.x, p.y, p.z, 0.07, height + hs, 0.07, p.h, PAL.pole); k.ranges.push(['prop', v0, prop.count]); k.h = Math.max(k.h, height + hs); }
  }

  /** Record for a roadside pole, so it can be knocked down later. */
  _pole(p) {
    const key = `${Math.round(p.x * 10)}_${Math.round(p.z * 10)}`;
    let k = this._kn.get(key);
    if (!k) this._kn.set(key, (k = { x: p.x, y: p.y, z: p.z, face: p.h + Math.PI, h: 0, ranges: [], plates: [], sigs: [], alive: true }));
    return k;
  }

  _signalHead(tile, prop, p, e, dir, crossing = null) {
    const v0 = prop.count, k = this._pole(p);
    box(prop, p.x, p.y, p.z, 0.12, 2.5, 0.12, p.h, PAL.pole);
    box(prop, p.x, p.y + 2.5, p.z, 0.36, 1.0, 0.3, p.h, PAL.black);
    const fh = p.h + Math.PI;
    const sig = { x: p.x + Math.sin(fh) * 0.17, y: p.y + 3.0, z: p.z - Math.cos(fh) * 0.17, h: fh, e, dir, crossing };
    tile.signals.push(sig);
    k.ranges.push(['prop', v0, prop.count]); k.sigs.push(sig); k.h = Math.max(k.h, 2.5);
  }

  /** Bridge decks / barriers / pillars and tunnel boxes for one edge. */
  _structures(e, prop, propD, tun, glow) {
    const net = this.net;
    let maxRel = -1e9;
    for (let i = 0; i < e.n; i++) maxRel = Math.max(maxRel, e.rel[i]);
    const L = e.paveL - (e.sidewalk ? 2.2 : 1.0), R = e.paveR + (e.sidewalk ? 2.2 : 1.0);
    // side walls stop short of junctions so they never run across the mouth of a joining road
    const j0 = e.trimA ? e.trimA + 1.5 : 0, j1 = e.len - (e.trimB ? e.trimB + 1.5 : 0);
    const runs = (test, fn) => {
      let s0 = -1;
      for (let i = 0; i < e.n; i++) {
        const ok = test(e.rel[i]);
        if (ok && s0 < 0) s0 = e.cum[Math.max(0, i - 1)];
        if (!ok && s0 >= 0) { fn(s0, e.cum[i]); s0 = -1; }
      }
      if (s0 >= 0) fn(s0, e.len);
    };
    if (maxRel > 0.9 && !e.tunnel) {
      const deckAt = e.flags & F.BRIDGE ? 0.9 : 3;      // embankments stay earth; only real bridges and high ramps get a deck
      runs((rel) => rel > deckAt, (s0, s1) => {
        wallAlong(prop, e, s0, s1, R, -1.1, 0.06, PAL.concreteDark, 1);
        wallAlong(prop, e, s0, s1, L, -1.1, 0.06, PAL.concreteDark, -1);
        const b0 = Math.max(s0, j0), b1 = Math.min(s1, j1);
        if (b1 - b0 > 1) {
          wallAlong(propD, e, b0, b1, R, 0, 0.95, PAL.concrete, 1);
          wallAlong(propD, e, b0, b1, L, 0, 0.95, PAL.concrete, -1);
        }
        if (!e.sidewalk) strip(prop, e, s0, s1, L, R, 0.03, PAL.concreteDark);
        strip(propD, e, s0, s1, L, R, -1.1, PAL.concreteDark);
        for (let s = s0 + 12; s < s1 - 6; s += 26) {
          const q = section(e, s), px = q.x + q.nx * (L + R) / 2, pz = q.z + q.nz * (L + R) / 2, gy = net.ground(px, pz);
          if (q.y - gy < 3.2) continue;
          const hit = net.locate(px, pz, { y: gy }, 9);
          if (hit && Math.abs(hit.rel) < 1.5 && hit.outside < 2.5) continue;       // do not stand a pier in the road below
          const l = Math.hypot(q.nx, q.nz) || 1;
          box(prop, px, gy - 1, pz, Math.min(R - L - 2, 7), q.y - 1.05 - gy + 1, 1.3, headingOf(q.nz / l, -q.nx / l), PAL.concrete);
        }
      });
    }
    if (e.tunnel) {
      const H = 5.6, wl = e.paveL - 0.6, wr = e.paveR + 0.6;
      if (j1 - j0 > 1) {
        wallAlong(tun, e, j0, j1, wr, 0, H, PAL.tunnel, 1);
        wallAlong(tun, e, j0, j1, wl, 0, H, PAL.tunnel, -1);
      }
      strip(tun, e, 0, e.len, wl - 3, wr + 3, H, PAL.tunnel);
      strip(tun, e, 0, e.len, wl, e.paveL, 0.04, PAL.concreteDark);
      strip(tun, e, 0, e.len, e.paveR, wr, 0.04, PAL.concreteDark);
      for (let s = 6; s < e.len; s += 14) strip(glow, e, s, s + 2.2, -0.5, 0.5, H - 0.06, PAL.lamp);
      // near the surface the terrain is left open around the tunnel; earth lids close the gap beside and above it
      prep(e);
      let prev = null;
      for (let s = 0; ; s = Math.min(e.len, s + 8)) {
        const q = section(e, s), gy = net.ground(q.x, q.z), cover = gy - q.y;
        const cur = cover < 9.5 ? { x: q.x, z: q.z, nx: q.nx, nz: q.nz, y: Math.max(gy, q.y) + 0.02, top: cover > H + 0.2 } : null;
        if (cur && prev) {
          const span = (o0, o1) => {
            const a = prop.v(prev.x + prev.nx * o0, prev.y, prev.z + prev.nz * o0, PAL.earth), b2 = prop.v(prev.x + prev.nx * o1, prev.y, prev.z + prev.nz * o1, PAL.earth);
            const c2 = prop.v(cur.x + cur.nx * o1, cur.y, cur.z + cur.nz * o1, PAL.earth), d2 = prop.v(cur.x + cur.nx * o0, cur.y, cur.z + cur.nz * o0, PAL.earth);
            prop.quad(a, b2, c2, d2);
          };
          span(wl - 19, wl - 2.9); span(wr + 2.9, wr + 19);
          if (cur.top && prev.top) span(wl - 3, wr + 3);
        }
        prev = cur;
        if (s >= e.len) break;
      }
    }
  }

  // ── buildings ──
  _buildBuildings(tile) {
    const list = tile.data.b;
    if (!list) return;
    const S = this.net.tile, ox = tile.tx * S, oz = tile.tz * S;
    const walls = {};
    for (const k of Object.keys(this.wallMats)) walls[k] = new Batch(true);
    const roofs = new Batch();
    for (const bld of list) {
      const h = bld[0] / 10, n = (bld.length - 1) / 2;
      if (n < 3) continue;
      const raw = new Float32Array(n * 2);
      let area = 0, x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, cx = 0, cz = 0;
      for (let i = 0; i < n; i++) {
        const x = ox + bld[1 + i * 2] / 10, z = oz + bld[2 + i * 2] / 10;
        raw[i * 2] = x; raw[i * 2 + 1] = z; cx += x / n; cz += z / n;
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z);
      }
      for (let i = 0; i < n; i++) { const j = (i + 1) % n; area += raw[i * 2] * -raw[j * 2 + 1] - raw[j * 2] * -raw[i * 2 + 1]; }
      if (this._inLandmark(cx, cz) || (this.suppress && this.suppress.some((c) => h >= c.minH && Math.hypot(cx - c.x, cz - c.z) < c.r))) continue;      // a landmark stands here
      // wind the outline so the inside is always on the left
      const ring = new Float32Array(n * 2);
      for (let k = 0; k < n; k++) { const i = area > 0 ? k : n - 1 - k; ring[k * 2] = raw[i * 2]; ring[k * 2 + 1] = raw[i * 2 + 1]; }
      area = Math.abs(area) / 2;
      // on a slope the walls reach down to the lowest corner and the storeys are counted from the highest
      let g0 = 1e9, g1 = -1e9;
      for (let k = 0; k < n; k++) { const gy = this._tileHeight(tile, ring[k * 2], ring[k * 2 + 1]); g0 = Math.min(g0, gy); g1 = Math.max(g1, gy); }
      const top = g1 + h, low = g0 - 0.6;
      const rnd = hash2(bld[1] + tile.tx * 131, bld[2] + tile.tz * 71), rnd2 = (rnd * 7919) % 1;
      const central = Math.hypot(cx - this.centre.x, cz - this.centre.z);
      // what kind of building is this?
      let style = 'plaster';
      if (h < 5) style = 'plain';
      else if (area > 1400 && h < 15) style = 'industrial';
      else if (h > 26 || (area > 700 && h > 15 && rnd2 < 0.45)) style = 'modern';
      else if (central < 2600 && rnd2 < 0.62) style = 'stone';
      const shop = h > 7 && (style === 'stone' || style === 'modern' || (central < 3500 && rnd2 > 0.55));
      const fc = style === 'modern' ? GLASSY[Math.floor(rnd * GLASSY.length) % GLASSY.length] : FACADES[Math.floor(rnd * FACADES.length) % FACADES.length];
      const wb = walls[style === 'plain' ? 'plaster' : style];
      const windows = style !== 'plain';
      const floors = Math.max(1, Math.round(h / 3.1)), gf = 3.5;
      let u = 0;
      for (let k = 0; k < n; k++) {
        const j = (k + 1) % n;
        const ax = ring[k * 2], az = ring[k * 2 + 1], bx = ring[j * 2], bz = ring[j * 2 + 1];
        const len = Math.hypot(bx - ax, bz - az);
        if (len < 0.05) continue;
        const nx = -(bz - az) / len, nz = (bx - ax) / len;
        const cells = windows ? Math.max(1, Math.round(len / 3.4)) : 0;
        const quad = (b, y0, y1, ua, ub, va, vb) => {
          const p0 = b.v(ax, y0, az, fc, nx, 0, nz, ua, va), p1 = b.v(bx, y0, bz, fc, nx, 0, nz, ub, va);
          const p2 = b.v(bx, y1, bz, fc, nx, 0, nz, ub, vb), p3 = b.v(ax, y1, az, fc, nx, 0, nz, ua, vb);
          b.quad(p0, p1, p2, p3);
        };
        if (g1 - low > 0.7) quad(walls.plaster, low, g1, 0.02, 0.02, 0.02, 0.02);        // plinth down the slope
        if (!windows) quad(wb, g1, top, 0.02, 0.02, 0.02, 0.02);
        else if (shop && len > 4.5 && floors >= 2) {
          const bays = Math.max(1, Math.round(len / 5.2));
          quad(walls.shop, g1, g1 + gf, 0, bays, 0, 1);
          quad(wb, g1 + gf, top, u, u + cells, 1, floors);
        } else quad(wb, g1, top, u, u + cells, 0, floors);
        u += cells;
      }
      this._roof(roofs, ring, n, top, area, style, rnd);
      tile.blds.push({ ring, x0, x1, z0, z1, h, gy: g1 });
    }
    this._stadiums(tile, walls.plaster, roofs);
    for (const k of Object.keys(walls)) this._add(tile, walls[k].mesh(this.wallMats[k]), 0, true);
    this._add(tile, roofs.mesh(this.mat.roof), 0, true);
    this._placeNames(tile);
  }

  /** Stadiums: an outer wall, terraces stepping down inside, and the pitch in the middle. */
  _stadiums(tile, wallB, roofs) {
    const S = this.net.tile, ox = tile.tx * S, oz = tile.tz * S;
    for (const st of tile.data.s || []) {
      const n = st.p.length / 2, raw = new Float32Array(n * 2);
      let area = 0, x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, cx = 0, cz = 0;
      for (let i = 0; i < n; i++) { const x = ox + st.p[i * 2] / 10, z = oz + st.p[i * 2 + 1] / 10; raw[i * 2] = x; raw[i * 2 + 1] = z; cx += x / n; cz += z / n; x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
      for (let i = 0; i < n; i++) { const j = (i + 1) % n; area += raw[i * 2] * -raw[j * 2 + 1] - raw[j * 2] * -raw[i * 2 + 1]; }
      const ring = new Float32Array(n * 2);
      for (let k = 0; k < n; k++) { const i = area > 0 ? k : n - 1 - k; ring[k * 2] = raw[i * 2]; ring[k * 2 + 1] = raw[i * 2 + 1]; }
      const G = this._tileHeight(tile, cx, cz), H = 15, conc = col('#b9b7b0'), seat = col('#3f6ea8'), seat2 = col('#35608f'), grass = col('#4f9a4a');
      // rings shrinking towards the centre: rim walkway, two tiers of seats, pitch
      const shrink = (f) => { const r = new Float32Array(n * 2); for (let k = 0; k < n; k++) { r[k * 2] = cx + (ring[k * 2] - cx) * f; r[k * 2 + 1] = cz + (ring[k * 2 + 1] - cz) * f; } return r; };
      const track = col('#b5553c');
      const tiers = [[1, H, conc], [0.93, H, conc], [0.78, H * 0.5, seat], [0.64, 1.2, seat2], [0.5, 1.2, track]];
      for (let k = 0; k < n; k++) {
        const j = (k + 1) % n, ax = ring[k * 2], az = ring[k * 2 + 1], bx = ring[j * 2], bz = ring[j * 2 + 1], len = Math.hypot(bx - ax, bz - az) || 1;
        const nx = -(bz - az) / len, nz = (bx - ax) / len;
        const p0 = wallB.v(ax, G - 6, az, conc, nx, 0, nz, 0.02, 0.02), p1 = wallB.v(bx, G - 6, bz, conc, nx, 0, nz, 0.02, 0.02), p2 = wallB.v(bx, G + H, bz, conc, nx, 0, nz, 0.02, 0.02), p3 = wallB.v(ax, G + H, az, conc, nx, 0, nz, 0.02, 0.02);
        wallB.quad(p0, p1, p2, p3);
      }
      for (let t = 0; t < tiers.length - 1; t++) {
        const A = shrink(tiers[t][0]), B = shrink(tiers[t + 1][0]), ya = tiers[t][1], yb = tiers[t + 1][1], c = tiers[t + 1][2];
        for (let k = 0; k < n; k++) {
          const j = (k + 1) % n;
          const p0 = roofs.v(A[k * 2], G + ya, A[k * 2 + 1], c, 0, 1, 0), p1 = roofs.v(A[j * 2], G + ya, A[j * 2 + 1], c, 0, 1, 0);
          const p2 = roofs.v(B[j * 2], G + yb, B[j * 2 + 1], c, 0, 1, 0), p3 = roofs.v(B[k * 2], G + yb, B[k * 2 + 1], c, 0, 1, 0);
          roofs.quad(p0, p1, p2, p3);                 // faces up and inwards
        }
      }
      fillPoly(roofs, shrink(0.5), 0, 0, 1, G + 1.2, grass);
      tile.blds.push({ ring, x0, x1, z0, z1, h: H, name: st.n, gy: G });
      if (st.n) (tile.data.p || (tile.data.p = [])).push([Math.round((ring[0] - ox) * 10), Math.round((ring[1] - oz) * 10), 8, st.n]);
    }
  }

  /**
   * Real names on real buildings: each named shop, restaurant, bank or station from the map gets a
   * sign on the wall of its building that faces the nearest street.
   */
  _placeNames(tile) {
    const pois = tile.data.p;
    if (!pois || !pois.length || !tile.blds.length) return;
    const S = this.net.tile, ox = tile.tx * S, oz = tile.tz * S, net = this.net;
    // which wall does each place belong on?
    const walls = new Map();
    const order = [8, 0, 5, 6, 2, 3, 1, 4, 7];
    for (const poi of [...pois].sort((a, b) => order.indexOf(a[2]) - order.indexOf(b[2]))) {
      const x = ox + poi[0] / 10, z = oz + poi[1] / 10;
      let bld = null, bd = 9;
      for (const b of tile.blds) {
        if (x < b.x0 - 9 || x > b.x1 + 9 || z < b.z0 - 9 || z > b.z1 + 9) continue;
        if (pointInRing(x, z, b.ring)) { bld = b; break; }
        for (let k = 0, n = b.ring.length / 2; k < n; k++) { const d = Math.hypot(b.ring[k * 2] - x, b.ring[k * 2 + 1] - z); if (d < bd) { bd = d; bld = b; } }
      }
      if (!bld || bld.h < 3.6) continue;
      const road = net.locate(x, z, {}, 70);
      if (!road) continue;
      const q = net.sample(road.e, road.s, {});
      let best = -1, bs = 1e9;
      const n = bld.ring.length / 2;
      for (let k = 0; k < n; k++) {
        const j = (k + 1) % n, ax = bld.ring[k * 2], az = bld.ring[k * 2 + 1], bx = bld.ring[j * 2], bz = bld.ring[j * 2 + 1];
        const len = Math.hypot(bx - ax, bz - az);
        if (len < 3) continue;
        const nx = -(bz - az) / len, nz = (bx - ax) / len, mx = (ax + bx) / 2, mz = (az + bz) / 2;
        if ((q.x - mx) * nx + (q.z - mz) * nz < 0.5) continue;                 // wall must face the street
        const score = Math.hypot(q.x - mx, q.z - mz) + Math.hypot(x - mx, z - mz) * 0.6 - Math.min(len, 12) * 0.4;
        if (score < bs) { bs = score; best = k; }
      }
      if (best < 0) continue;
      const key = tile.blds.indexOf(bld) * 4096 + best;
      let w = walls.get(key);
      if (!w) walls.set(key, (w = { bld, k: best, list: [] }));
      w.list.push(poi);
    }
    if (!walls.size) return;
    // one texture per tile holds every name plate
    const CW = 256, CH = 40, COLS = 4, ROWS = 25;
    const cv = document.createElement('canvas');
    cv.width = CW * COLS; cv.height = CH * ROWS;
    const g = cv.getContext('2d');
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const b = new Batch(true), white = [1, 1, 1];
    let cell = 0;
    for (const w of walls.values()) {
      const n = w.bld.ring.length / 2, j = (w.k + 1) % n;
      const ax = w.bld.ring[w.k * 2], az = w.bld.ring[w.k * 2 + 1], bx = w.bld.ring[j * 2], bz = w.bld.ring[j * 2 + 1];
      const len = Math.hypot(bx - ax, bz - az), tx = (bx - ax) / len, tz = (bz - az) / len, nx = -tz, nz = tx;
      const fit = Math.max(1, Math.min(w.list.length, Math.floor(len / 4.2)));
      for (let i = 0; i < fit && cell < COLS * ROWS; i++, cell++) {
        const [, , kind, name] = w.list[i];
        const big = kind === 0 || kind === 5 || kind === 8;
        const [bg, fg] = plateColours(name, kind);
        const cxp = (cell % COLS) * CW, cyp = Math.floor(cell / COLS) * CH;
        let size = 27;
        g.font = `700 ${size}px Helvetica, Arial, sans-serif`;
        let tw = g.measureText(name).width;
        if (tw > CW - 22) { size = Math.max(13, Math.floor((size * (CW - 22)) / tw)); g.font = `700 ${size}px Helvetica, Arial, sans-serif`; tw = g.measureText(name).width; }
        const pw = Math.min(CW, tw + 26);
        g.fillStyle = bg; g.fillRect(cxp + (CW - pw) / 2, cyp + 2, pw, CH - 4);
        g.fillStyle = fg; g.fillText(name, cxp + CW / 2, cyp + CH / 2 + 1);
        // the plate on the wall
        const hgt = kind === 8 ? 3.2 : big ? 1.35 : 0.86, y0 = w.bld.gy + (kind === 8 ? 8 : big ? 3.5 : 2.78);
        const slot = len / fit, wid = Math.min(slot - 0.5, (pw / CH) * hgt), c = (i + 0.5) * slot;
        const sx = ax + tx * c + nx * 0.14, sz = az + tz * c + nz * 0.14;
        const u0 = (cxp + (CW - pw) / 2) / cv.width, u1 = (cxp + (CW + pw) / 2) / cv.width, v1 = 1 - (cyp + 2) / cv.height, v0 = 1 - (cyp + CH - 2) / cv.height;
        const p0 = b.v(sx - tx * wid / 2, y0, sz - tz * wid / 2, white, nx, 0, nz, u0, v0), p1 = b.v(sx + tx * wid / 2, y0, sz + tz * wid / 2, white, nx, 0, nz, u1, v0);
        const p2 = b.v(sx + tx * wid / 2, y0 + hgt, sz + tz * wid / 2, white, nx, 0, nz, u1, v1), p3 = b.v(sx - tx * wid / 2, y0 + hgt, sz - tz * wid / 2, white, nx, 0, nz, u0, v1);
        b.quad(p0, p1, p2, p3);
      }
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const mesh = b.mesh(new THREE.MeshLambertMaterial({ map: tex, emissive: '#3a3a3a', emissiveMap: tex, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -8 }));
    if (!mesh) { tex.dispose(); return; }
    mesh.userData.ownMaterial = true;
    this._add(tile, mesh);
  }

  /** Houses and older blocks get a tiled roof sloping in from every side; big modern and industrial buildings stay flat. */
  _roof(roofs, ring, n, h, area, style, rnd) {
    const flat = style === 'modern' || style === 'industrial' || area < 28 || area > 2600;
    const rc = flat ? ROOFS[Math.floor(rnd * 97) % ROOFS.length] : TILES[Math.floor(rnd * 53) % TILES.length];
    if (!flat) {
      const d = Math.min(2.4, Math.sqrt(area) / 4.5), rise = d * (style === 'plain' ? 0.6 : 0.95);
      const inner = new Float32Array(n * 2);
      let ok = true;
      for (let k = 0; k < n && ok; k++) {
        const i = (k + n - 1) % n, j = (k + 1) % n;
        let e1x = ring[k * 2] - ring[i * 2], e1z = ring[k * 2 + 1] - ring[i * 2 + 1], e2x = ring[j * 2] - ring[k * 2], e2z = ring[j * 2 + 1] - ring[k * 2 + 1];
        const l1 = Math.hypot(e1x, e1z) || 1, l2 = Math.hypot(e2x, e2z) || 1;
        e1x /= l1; e1z /= l1; e2x /= l2; e2z /= l2;
        // inward normals of the two edges meeting here, and their bisector
        let bx = e1z + e2z, bz = -e1x - e2x;
        const bl = Math.hypot(bx, bz);
        if (bl < 0.25) { ok = false; break; }
        bx /= bl; bz /= bl;
        const m = d / Math.max(0.5, bx * e1z + bz * -e1x);
        inner[k * 2] = ring[k * 2] + bx * m; inner[k * 2 + 1] = ring[k * 2 + 1] + bz * m;
      }
      if (ok) {            // the inset outline must still be a sensible, smaller copy of the footprint
        let ia = 0;
        for (let k = 0; k < n; k++) { const j = (k + 1) % n; ia += inner[k * 2] * -inner[j * 2 + 1] - inner[j * 2] * -inner[k * 2 + 1]; }
        ia /= 2;
        ok = ia > area * 0.2 && ia < area;
        for (let k = 0; k < n && ok; k++) {      // edges must not have flipped
          const j = (k + 1) % n;
          if ((inner[j * 2] - inner[k * 2]) * (ring[j * 2] - ring[k * 2]) + (inner[j * 2 + 1] - inner[k * 2 + 1]) * (ring[j * 2 + 1] - ring[k * 2 + 1]) <= 0) ok = false;
        }
      }
      if (ok) {
        const eave = [rc[0] * 0.82, rc[1] * 0.82, rc[2] * 0.82];
        for (let k = 0; k < n; k++) {
          const j = (k + 1) % n;
          const ax = ring[k * 2], az = ring[k * 2 + 1], bx = ring[j * 2], bz = ring[j * 2 + 1];
          const len = Math.hypot(bx - ax, bz - az) || 1;
          let nx = (-(bz - az) / len) * rise, ny = d, nz = ((bx - ax) / len) * rise;
          const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
          const p0 = roofs.v(ax, h, az, eave, nx, ny, nz), p1 = roofs.v(bx, h, bz, eave, nx, ny, nz);
          const p2 = roofs.v(inner[j * 2], h + rise, inner[j * 2 + 1], rc, nx, ny, nz), p3 = roofs.v(inner[k * 2], h + rise, inner[k * 2 + 1], rc, nx, ny, nz);
          roofs.quad(p0, p1, p2, p3);
        }
        fillPoly(roofs, inner, 0, 0, 1, h + rise, rc);
        return;
      }
    }
    fillPoly(roofs, ring, 0, 0, 1, h, rc);
  }

  // ── green, water, rails, trees ──
  /** Railway lines of a tile as polylines (needed before the terrain is shaped, so the ground can meet them). */
  _readRails(tile) {
    const S = this.net.tile, ox = tile.tx * S, oz = tile.tz * S, net = this.net;
    tile.rails = [];
    for (const r of (tile.data && tile.data.r) || []) {
      const n = r.length / 3, pts = new Float32Array(n * 3), cum = new Float32Array(n), rel = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        pts[i * 3] = ox + r[i * 3] / 10; pts[i * 3 + 1] = r[i * 3 + 2] / 10; pts[i * 3 + 2] = oz + r[i * 3 + 1] / 10;
        rel[i] = pts[i * 3 + 1] - net.ground(pts[i * 3], pts[i * 3 + 2]);
      }
      for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + Math.hypot(pts[i * 3] - pts[i * 3 - 3], pts[i * 3 + 2] - pts[i * 3 - 1]);
      if (cum[n - 1] >= 1) tile.rails.push({ pts, cum, n, len: cum[n - 1], rel });
    }
  }

  _buildNature(tile) {
    const d = tile.data, S = this.net.tile, ox = tile.tx * S, oz = tile.tz * S;
    if (tile.rails && tile.rails.length) {
      const bed = new Batch(), mark = new Batch(), prop = new Batch(), propD = new Batch();
      for (const line of tile.rails) {
        strip(bed, line, 0, line.len, -1.7, 1.7, 0.035, PAL.bed);
        strip(mark, line, 0, line.len, -0.8, -0.68, 0.09, PAL.rail);
        strip(mark, line, 0, line.len, 0.68, 0.8, 0.09, PAL.rail);
        let hi = 0;
        for (let i = 0; i < line.n; i++) hi = Math.max(hi, line.rel[i]);
        if (hi > 0.9) {
          wallAlong(prop, line, 0, line.len, 2.1, -1.2, 0.04, PAL.concreteDark, 1);
          wallAlong(prop, line, 0, line.len, -2.1, -1.2, 0.04, PAL.concreteDark, -1);
          strip(propD, line, 0, line.len, -2.1, 2.1, -1.2, PAL.concreteDark);
          strip(propD, line, 0, line.len, -2.1, 2.1, 0.02, PAL.bed);
          for (let s = 8; s < line.len - 4; s += 24) {
            const q = section(line, s), gy = this.net.ground(q.x, q.z);
            if (q.y - gy < 3.2) continue;
            const hit = this.net.locate(q.x, q.z, { y: gy }, 8);
            if (hit && Math.abs(hit.rel) < 1.5 && hit.outside < 2.5) continue;
            const l = Math.hypot(q.nx, q.nz) || 1;
            box(prop, q.x, gy - 1, q.z, 3.2, q.y - 1.15 - gy + 1, 1.6, headingOf(q.nz / l, -q.nx / l), PAL.concrete);
          }
        }
      }
      this._add(tile, bed.mesh(this.mat.bed), -3);
      this._add(tile, mark.mesh(this.mat.mark));
      this._add(tile, prop.mesh(this.mat.prop), 0, true);
      this._add(tile, propD.mesh(this.mat.propDouble), 0, true);
    }
    // trees: mapped street trees plus a scatter inside forests
    const spots = [];
    const net = this.net;
    const clear = (x, z, margin) => { const hit = net.locate(x, z, {}, 14); return !hit || hit.outside > margin || hit.rel < -4; };
    if (d.t) for (let i = 0; i < d.t.length; i += 2) { const x = ox + d.t[i] / 10, z = oz + d.t[i + 1] / 10; if (clear(x, z, 0.6)) spots.push(x, z, 0); }
    const forests = this.home.get(tile.k)?.forest;
    if (forests && forests.length) {
      const rand = rng((tile.tx * 73856093) ^ (tile.tz * 19349663));
      for (let i = 0; i < 520 && spots.length < 3 * 420; i++) {
        const x = ox + rand() * S, z = oz + rand() * S;
        for (const f of forests) {
          if (x < f.x0 || x > f.x1 || z < f.z0 || z > f.z1 || !pointInRing(x, z, f.ring)) continue;
          if (clear(x, z, 2.5)) spots.push(x, z, 1);
          break;
        }
      }
    }
    const count = spots.length / 3;
    if (!count) return;
    const list = [];
    const trunks = new THREE.InstancedMesh(this.treeGeo.trunk, this.mat.trunk, count);
    const crowns = new THREE.InstancedMesh(this.treeGeo.crown, this.mat.crown, count);
    trunks.userData.shared = crowns.userData.shared = true;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), sc = new THREE.Vector3(), pos = new THREE.Vector3(), c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const x = spots[i * 3], z = spots[i * 3 + 1], forest = spots[i * 3 + 2];
      const r = hash2(Math.round(x * 7), Math.round(z * 7));
      const s = (forest ? 1.2 : 0.8) + r * 0.7;
      q.setFromAxisAngle(up, r * 6.28);
      const ty = this._tileHeight(tile, x, z) - 0.1;
      pos.set(x, ty, z); sc.set(s, s * (forest ? 1.25 : 1), s);
      list.push({ i, x, y: ty, z, s, sy: s * (forest ? 1.25 : 1), alive: true });
      m.compose(pos, q, sc);
      trunks.setMatrixAt(i, m); crowns.setMatrixAt(i, m);
      c.setHSL(0.27 + r * 0.07, 0.38 + r * 0.15, (forest ? 0.25 : 0.31) + ((r * 13) % 1) * 0.08);
      crowns.setColorAt(i, c);
    }
    trunks.castShadow = crowns.castShadow = true;
    tile.group.add(trunks, crowns);
    tile.trees = { trunks, crowns, list };
  }

  // ── trees you can knock over ──
  /** A standing tree whose trunk is within `rad` of (x, z), or null. */
  treeAt(x, z, rad, y) {
    const tile = this.tiles.get(this._tk(x, z));
    if (!tile || !tile.trees) return null;
    for (const t of tile.trees.list) if (t.alive && Math.abs(t.y - y) < 4 && Math.hypot(t.x - x, t.z - z) < rad + 0.22 * t.s) return { tile, t };
    return null;
  }

  /** Uproot a tree. Slow knocks topple it where it stands; fast ones send it tumbling down the road. */
  flingTree(hit, vx, vz) {
    const { tile, t } = hit, tr = tile.trees, zero = new THREE.Matrix4().makeScale(0, 0, 0), col = new THREE.Color();
    t.alive = false;
    tr.crowns.getColorAt(t.i, col);
    tr.trunks.setMatrixAt(t.i, zero); tr.crowns.setMatrixAt(t.i, zero);
    tr.trunks.instanceMatrix.needsUpdate = tr.crowns.instanceMatrix.needsUpdate = true;
    const g = new THREE.Group(), crownMat = new THREE.MeshLambertMaterial({ color: col });
    g.add(new THREE.Mesh(this.treeGeo.trunk, this.mat.trunk), new THREE.Mesh(this.treeGeo.crown, crownMat));
    // a clod of earth and roots at the foot
    const roots = new THREE.Mesh(this._rootGeo || (this._rootGeo = new THREE.IcosahedronGeometry(0.55, 0).scale(1, 0.5, 1)), this._rootMat || (this._rootMat = new THREE.MeshLambertMaterial({ color: '#4a3a2a' })));
    roots.position.y = -0.05;
    g.add(roots);
    g.position.set(t.x, t.y + 0.2, t.z);
    g.scale.set(t.s, t.sy, t.s);
    this._fling(g, vx, vz, { floor: 0.55 * t.s, mats: [crownMat], heavy: 1.5 });
    // the hole it leaves behind
    const hole = new THREE.Mesh(this._holeGeo || (this._holeGeo = new THREE.CircleGeometry(0.75, 10).rotateX(-Math.PI / 2)), this._holeMat || (this._holeMat = new THREE.MeshLambertMaterial({ color: '#3d3024', polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -20 })));
    hole.position.set(t.x, t.y + 0.16, t.z);
    hole.scale.setScalar(t.s);
    this.scene.add(hole);
    (this.debris).push({ g: hole, static: true, t: 0, mats: [] });
  }

  /** A standing sign or signal pole within `rad` of (x, z), or null. */
  poleAt(x, z, rad, y) {
    const tile = this.tiles.get(this._tk(x, z));
    if (!tile || !tile.knock) return null;
    for (const k of tile.knock) if (k.alive && Math.abs(k.y - y) < 4 && Math.hypot(k.x - x, k.z - z) < rad + 0.1) return { tile, k };
    return null;
  }

  /** Snap a sign or traffic light off its base: the fixed copy disappears and loose pieces take its place. */
  flingPole(hit, vx, vz) {
    const { tile, k } = hit;
    k.alive = false;
    for (const [name, v0, v1] of k.ranges) {
      const mesh = tile.kmesh[name];
      if (!mesh) continue;
      const pos = mesh.geometry.attributes.position;
      for (let i = v0; i < v1; i++) pos.setXYZ(i, k.x, -60, k.z);
      pos.needsUpdate = true;
    }
    for (const sgn of k.sigs) sgn.broken = true;
    const L = THREE.MeshLambertMaterial;
    const poleMat = this._poleMat || (this._poleMat = new L({ color: '#70757a' })), black = this._blackMat || (this._blackMat = new L({ color: '#17181a' }));
    const plateMat = this._plateMat || (this._plateMat = new L({ map: this.mat.sign.map, alphaTest: 0.5, side: THREE.DoubleSide }));
    const sp = Math.hypot(vx, vz);
    // the pole itself, with any sign plates still bolted on
    const g = new THREE.Group();
    const w = k.sigs.length ? 0.12 : 0.07;
    g.add(new THREE.Mesh(new THREE.BoxGeometry(w, k.h, w).translate(0, k.h / 2, 0), poleMat));
    for (const pl of k.plates) {
      const geo = new THREE.PlaneGeometry(pl.size, pl.size), uv = geo.attributes.uv;
      const u0 = (pl.id % 8) / 8, v0 = 1 - (Math.floor(pl.id / 8) + 1) / 4;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) / 8, v0 + uv.getY(i) / 4);
      const m = new THREE.Mesh(geo, plateMat);
      m.position.set(0, pl.height, 0.05);
      g.add(m);
    }
    g.position.set(k.x, k.y + 0.05, k.z);
    g.rotation.y = Math.PI - k.face;
    this._fling(g, vx * 0.7, vz * 0.7, { floor: 0.08, own: true, heavy: 2.2, up: 1.5 + sp * 0.15 });
    // a traffic light head breaks off and flies further; its lenses scatter
    if (k.sigs.length) {
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 1.0, 0.3), black);
      head.position.set(k.x, k.y + 3.0, k.z);
      this._fling(head, vx * 1.1, vz * 1.1, { floor: 0.2, own: true, up: 2.5 + sp * 0.3 });
      const cols = ['#ff2a1f', '#ffc21a', '#2bff7a'];
      for (let i = 0; i < 6; i++) {
        const bit = new THREE.Mesh(this._bitGeo || (this._bitGeo = new THREE.BoxGeometry(0.1, 0.1, 0.03)), new THREE.MeshBasicMaterial({ color: cols[i % 3] }));
        bit.position.set(k.x, k.y + 2.7 + (i % 3) * 0.3, k.z);
        const a = Math.random() * 6.28, r = 1 + Math.random() * 3;
        this._fling(bit, vx * 0.8 + Math.cos(a) * r, vz * 0.8 + Math.sin(a) * r, { floor: 0.03, mats: [bit.material], up: 2 + Math.random() * 4, life: 6 });
      }
    }
  }

  /** Hand an object to the debris simulation. */
  _fling(g, vx, vz, o = {}) {
    if (!g.parent) this.scene.add(g);
    const sp = Math.hypot(vx, vz), heavy = o.heavy || 1;
    (this.debris || (this.debris = [])).push({
      g, mats: o.mats || [], own: !!o.own, floor: o.floor || 0.1, life: o.life || 12, t: 0,
      vx: vx * 0.85, vz: vz * 0.85, vy: o.up !== undefined ? o.up : 1.2 + sp * 0.45,
      // tip over in the direction of the blow
      wx: (vz / (sp || 1)) * (1.2 + sp * 0.3) / heavy * 1.6, wz: (-vx / (sp || 1)) * (1.2 + sp * 0.3) / heavy * 1.6,
    });
  }

  updateDebris(dt) {
    if (!this.debris || !this.debris.length) return;
    for (const d of this.debris) {
      d.t += dt;
      if (!d.static && !d.rest) {
        d.vy -= 16 * dt;
        d.g.position.x += d.vx * dt; d.g.position.y += d.vy * dt; d.g.position.z += d.vz * dt;
        d.g.rotation.x += d.wx * dt; d.g.rotation.z += d.wz * dt;
        // once tipped past horizontal and low, it is lying on the ground
        const lying = Math.abs(d.g.rotation.x) + Math.abs(d.g.rotation.z) > 1.35;
        const floor = this.heightAt(d.g.position.x, d.g.position.z) + d.floor;
        if (d.g.position.y < floor && d.vy < 0) {
          d.g.position.y = floor; d.vy = -d.vy * 0.3; d.vx *= 0.55; d.vz *= 0.55;
          if (lying) { d.wx *= 0.3; d.wz *= 0.3; }
          if (Math.abs(d.vy) < 1.4 && lying) d.rest = true;
          else if (Math.abs(d.vy) < 1.4) d.vy = 0;
        }
      }
      if (d.t > (d.static ? 40 : d.life + 28)) {
        this.scene.remove(d.g);
        for (const m of d.mats) m.dispose();
        if (d.own) d.g.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
        d.gone = true;
      }
    }
    this.debris = this.debris.filter((d) => !d.gone);
  }

  // ── runtime queries ──
  /** Does a point lie inside a building footprint? */
  /** Whether a point lies inside the footprint of a hand-built landmark. */
  _inLandmark(x, z) {
    for (const b of this.solids || []) {
      const dx = x - b.px, dz = z - b.pz, lx = (dx * b.c - dz * b.s - b.x) / b.hw, lz = (dx * b.s + dz * b.c - b.z) / b.hd;
      if (b.round ? lx * lx + lz * lz < 1 : Math.abs(lx) < 1 && Math.abs(lz) < 1) return true;
    }
    return false;
  }

  insideBuilding(x, z) {
    const t = this.tiles.get(this._tk(x, z));
    const check = (tile) => {
      if (!tile) return false;
      for (const b of tile.blds) if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1 && pointInRing(x, z, b.ring)) return true;
      return false;
    };
    if (check(t)) return true;
    if (this._inLandmark(x, z)) return true;
    const S = this.net.tile, fx = x / S - Math.floor(x / S), fz = z / S - Math.floor(z / S);
    const dx = fx < 0.12 ? -1 : fx > 0.88 ? 1 : 0, dz = fz < 0.12 ? -1 : fz > 0.88 ? 1 : 0;
    if (dx && check(this.tiles.get(this._tk(x + dx * S, z)))) return true;
    if (dz && check(this.tiles.get(this._tk(x, z + dz * S)))) return true;
    return false;
  }

  /** Draw the lit lamps of nearby signals. stateOf(head) → 'G' | 'Y' | 'R' | 'RY'. */
  updateLamps(px, pz, stateOf) {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), pos = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
    const RED = new THREE.Color('#ff2a1f'), YEL = new THREE.Color('#ffc21a'), GRN = new THREE.Color('#2bff7a');
    let k = 0;
    const put = (s, dy, c) => {
      if (k >= 512) return;
      q.setFromAxisAngle(up, -s.h + Math.PI);
      pos.set(s.x, s.y + dy, s.z);
      m.compose(pos, q, one);
      this.lamps.setMatrixAt(k, m);
      this.lamps.setColorAt(k, c);
      k++;
    };
    for (const tile of this.tiles.values()) {
      for (const s of tile.signals) {
        if (Math.abs(s.x - px) > 260 || Math.abs(s.z - pz) > 260) continue;
        if (s.broken) continue;
        const st = stateOf(s);
        if (st === 'R' || st === 'RY') put(s, 0.3, RED);
        if (st === 'Y' || st === 'RY') put(s, 0, YEL);
        if (st === 'G') put(s, -0.3, GRN);
      }
    }
    this.lamps.count = k;
    this.lamps.instanceMatrix.needsUpdate = true;
    if (this.lamps.instanceColor) this.lamps.instanceColor.needsUpdate = true;
  }
}

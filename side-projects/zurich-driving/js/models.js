// Low-poly vehicle and pedestrian geometry, built procedurally.
// Model frame: origin on the ground at the vehicle centre, forward = −z, right = +x.
import * as THREE from '../lib/three.module.min.js';

class GB {
  constructor() { this.p = []; this.n = []; this.c = []; this.i = []; this.count = 0; }
  /** Quad from four points; winding is fixed up so the face normal points along `hint`. */
  quad(P0, P1, P2, P3, color, hint) {
    const ux = P1[0] - P0[0], uy = P1[1] - P0[1], uz = P1[2] - P0[2];
    const vx = P3[0] - P0[0], vy = P3[1] - P0[1], vz = P3[2] - P0[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l; ny /= l; nz /= l;
    let pts = [P0, P1, P2, P3];
    if (hint && nx * hint[0] + ny * hint[1] + nz * hint[2] < 0) { pts = [P0, P3, P2, P1]; nx = -nx; ny = -ny; nz = -nz; }
    const b = this.count;
    for (const q of pts) { this.p.push(q[0], q[1], q[2]); this.n.push(nx, ny, nz); this.c.push(color.r, color.g, color.b); }
    this.count += 4;
    this.i.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  tri(P0, P1, P2, color, hint) {
    const ux = P1[0] - P0[0], uy = P1[1] - P0[1], uz = P1[2] - P0[2];
    const vx = P2[0] - P0[0], vy = P2[1] - P0[1], vz = P2[2] - P0[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l; ny /= l; nz /= l;
    let pts = [P0, P1, P2];
    if (hint && nx * hint[0] + ny * hint[1] + nz * hint[2] < 0) { pts = [P0, P2, P1]; nx = -nx; ny = -ny; nz = -nz; }
    const b = this.count;
    for (const q of pts) { this.p.push(q[0], q[1], q[2]); this.n.push(nx, ny, nz); this.c.push(color.r, color.g, color.b); }
    this.count += 3;
    this.i.push(b, b + 1, b + 2);
  }
  /** Axis-aligned box given min/max corners. */
  box(x0, y0, z0, x1, y1, z1, color, skipBottom = true) {
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], color, [0, 0, 1]);
    this.quad([x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], color, [0, 0, -1]);
    this.quad([x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], color, [1, 0, 0]);
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], color, [-1, 0, 0]);
    this.quad([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], color, [0, 1, 0]);
    if (!skipBottom) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], color, [0, -1, 0]);
  }
  /**
   * Extrude a side profile [[f, y], …] (f = forward) across the width.
   * halfW(y) gives the half width at a height, so cabins can taper inwards.
   */
  extrude(profile, halfW, color) {
    const n = profile.length;
    let cf = 0, cy = 0;
    for (const [f, y] of profile) { cf += f / n; cy += y / n; }
    for (let i = 0; i < n; i++) {
      const [f0, y0] = profile[i], [f1, y1] = profile[(i + 1) % n];
      const w0 = halfW(y0), w1 = halfW(y1);
      const mf = (f0 + f1) / 2 - cf, my = (y0 + y1) / 2 - cy;
      this.quad([w0, y0, -f0], [w1, y1, -f1], [-w1, y1, -f1], [-w0, y0, -f0], color, [0, my, -mf]);
    }
    const contour = profile.map(([f, y]) => new THREE.Vector2(f, y));
    for (const [a, b, c] of THREE.ShapeUtils.triangulateShape(contour, [])) {
      const A = profile[a], B = profile[b], C = profile[c];
      this.tri([halfW(A[1]), A[1], -A[0]], [halfW(B[1]), B[1], -B[0]], [halfW(C[1]), C[1], -C[0]], color, [1, 0, 0]);
      this.tri([-halfW(A[1]), A[1], -A[0]], [-halfW(B[1]), B[1], -B[0]], [-halfW(C[1]), C[1], -C[0]], color, [-1, 0, 0]);
    }
  }
  /** Wheel: a short cylinder lying along x. */
  wheel(x, y, z, r, w, color, seg = 10) {
    const x0 = x - w / 2, x1 = x + w / 2;
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
      const y0 = y + Math.cos(a0) * r, z0 = z + Math.sin(a0) * r, y1 = y + Math.cos(a1) * r, z1 = z + Math.sin(a1) * r;
      this.quad([x0, y0, z0], [x1, y0, z0], [x1, y1, z1], [x0, y1, z1], color, [0, Math.cos((a0 + a1) / 2), Math.sin((a0 + a1) / 2)]);
      this.tri([x1, y, z], [x1, y0, z0], [x1, y1, z1], color, [1, 0, 0]);
      this.tri([x0, y, z], [x0, y0, z0], [x0, y1, z1], color, [-1, 0, 0]);
    }
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setIndex(this.i);
    return g;
  }
}

const K = (hex) => new THREE.Color(hex);
const WHITE = K('#ffffff'), GLASS = K('#1d2733'), TYRE = K('#17181a'), TRIM = K('#26282b'), HEAD = K('#f4f1dc'), TAIL = K('#a3161b'), RIM = K('#b9bcc2'), SPOKE = K('#6d7076'), PLATE = K('#e9e9e2');

function wheels(d, half, zs, r = 0.32, w = 0.22) {
  for (const z of zs) for (const sx of [-1, 1]) {
    d.wheel(sx * (half - w / 2 + 0.02), r, z, r, w, TYRE);
    d.wheel(sx * (half + 0.022), r, z, r * 0.56, 0.02, RIM, 8);
  }
}

/**
 * Passenger cars are lofted: a list of cross-sections from tail to nose, skinned with smooth normals
 * so the bodywork catches the light like sheet metal instead of looking like folded card.
 * Per section: f (m forward of centre), yb underside, ys shoulder line, yt top, wb / ws / wt half-widths there.
 */
export const CAR_SPECS = [
  { id: 'tesla', label: 'Electric saloon', note: 'Tesla-style', axles: [-1.42, 1.44], wheel: 0.34, roof: [4, 6], deck: 3, cowl: 7,
    sec: [[-2.34, 0.46, 0.76, 0.8, 0.5, 0.62, 0.5], [-2.24, 0.3, 0.9, 0.98, 0.76, 0.84, 0.7], [-1.9, 0.26, 0.95, 1.06, 0.84, 0.9, 0.76], [-1.35, 0.24, 0.97, 1.12, 0.86, 0.925, 0.74],
      [-0.75, 0.22, 0.96, 1.36, 0.86, 0.925, 0.62], [0.0, 0.22, 0.95, 1.44, 0.86, 0.925, 0.64], [0.6, 0.22, 0.94, 1.38, 0.86, 0.92, 0.62], [1.25, 0.24, 0.92, 1.0, 0.85, 0.91, 0.74],
      [1.9, 0.27, 0.86, 0.9, 0.83, 0.89, 0.72], [2.25, 0.32, 0.74, 0.76, 0.74, 0.82, 0.64], [2.34, 0.46, 0.6, 0.62, 0.5, 0.6, 0.45]] },
  { id: 'bmw', label: 'Sports saloon', note: 'BMW-style', axles: [-1.4, 1.45], wheel: 0.34, roof: [4, 6], deck: 3, cowl: 7, grille: true,
    sec: [[-2.35, 0.48, 0.84, 0.9, 0.52, 0.66, 0.56], [-2.26, 0.32, 0.96, 1.04, 0.78, 0.86, 0.74], [-1.85, 0.27, 0.98, 1.07, 0.85, 0.91, 0.78], [-1.2, 0.25, 0.98, 1.1, 0.87, 0.92, 0.76],
      [-0.72, 0.24, 0.97, 1.4, 0.87, 0.92, 0.64], [-0.1, 0.24, 0.96, 1.43, 0.87, 0.92, 0.66], [0.45, 0.24, 0.95, 1.38, 0.87, 0.915, 0.64], [0.98, 0.25, 0.94, 1.02, 0.86, 0.91, 0.76],
      [1.8, 0.28, 0.9, 0.96, 0.84, 0.9, 0.76], [2.24, 0.33, 0.8, 0.84, 0.76, 0.84, 0.68], [2.35, 0.48, 0.66, 0.7, 0.54, 0.64, 0.52]] },
  { id: 'golf', label: 'Hatchback', note: 'VW-style', axles: [-1.3, 1.32], wheel: 0.32, roof: [3, 5], deck: 2, cowl: 6,
    sec: [[-2.14, 0.5, 0.86, 0.92, 0.56, 0.7, 0.6], [-2.06, 0.3, 0.98, 1.12, 0.78, 0.87, 0.72], [-1.78, 0.26, 1.0, 1.2, 0.84, 0.895, 0.7],
      [-1.3, 0.24, 1.0, 1.44, 0.85, 0.895, 0.64], [-0.4, 0.24, 0.99, 1.47, 0.85, 0.895, 0.66], [0.35, 0.24, 0.98, 1.42, 0.85, 0.89, 0.64], [0.95, 0.25, 0.96, 1.04, 0.84, 0.885, 0.75],
      [1.65, 0.28, 0.9, 0.95, 0.82, 0.875, 0.74], [2.05, 0.33, 0.78, 0.82, 0.74, 0.82, 0.66], [2.14, 0.48, 0.64, 0.68, 0.52, 0.62, 0.5]] },
  { id: 'rav', label: 'Compact SUV', note: 'Toyota-style', axles: [-1.34, 1.36], wheel: 0.37, roof: [3, 5], deck: 2, cowl: 6, grille: true,
    sec: [[-2.3, 0.58, 0.98, 1.05, 0.58, 0.72, 0.62], [-2.22, 0.38, 1.1, 1.26, 0.8, 0.9, 0.76], [-1.9, 0.33, 1.12, 1.36, 0.86, 0.925, 0.74],
      [-1.35, 0.31, 1.12, 1.66, 0.87, 0.93, 0.68], [-0.4, 0.31, 1.11, 1.69, 0.87, 0.93, 0.7], [0.4, 0.31, 1.1, 1.64, 0.87, 0.925, 0.68], [1.0, 0.32, 1.08, 1.18, 0.86, 0.92, 0.78],
      [1.72, 0.35, 1.04, 1.1, 0.85, 0.915, 0.78], [2.2, 0.4, 0.92, 0.97, 0.78, 0.87, 0.72], [2.3, 0.58, 0.76, 0.8, 0.56, 0.68, 0.56]] },
  { id: 'cinq', label: 'City car', note: 'Fiat-style', axles: [-1.1, 1.14], wheel: 0.3, roof: [3, 5], deck: 2, cowl: 6,
    sec: [[-1.8, 0.48, 0.84, 0.92, 0.54, 0.68, 0.58], [-1.73, 0.3, 0.96, 1.14, 0.74, 0.82, 0.68], [-1.5, 0.26, 0.98, 1.3, 0.79, 0.84, 0.66],
      [-1.05, 0.24, 0.98, 1.46, 0.8, 0.845, 0.6], [-0.3, 0.24, 0.97, 1.5, 0.8, 0.845, 0.62], [0.35, 0.24, 0.96, 1.44, 0.8, 0.84, 0.6], [0.85, 0.25, 0.95, 1.04, 0.79, 0.835, 0.7],
      [1.38, 0.28, 0.9, 0.96, 0.77, 0.82, 0.68], [1.72, 0.33, 0.78, 0.83, 0.7, 0.77, 0.6], [1.8, 0.48, 0.64, 0.68, 0.5, 0.6, 0.48]] },
];

/** Half cross-section of a car body at one station, bottom centre round to top centre. */
function ring(sec) {
  const [, yb, ys, yt, wb, ws, wt] = sec, cabin = yt - ys > 0.2;
  return [[0, yb], [wb * 0.9, yb], [ws * 0.985, yb + 0.15], [ws, (yb + ys) / 2 + 0.06], [ws * 0.975, ys], [wt, yt - (cabin ? 0.07 : 0.02)], [wt * 0.55, yt], [0, yt]];
}

function buildCar(spec) {
  const S = spec.sec, n = S.length, pos = [], idx = [];
  // body shell
  for (const sec of S) {
    const r = ring(sec), f = sec[0];
    for (let k = 0; k < 8; k++) pos.push(r[k][0], r[k][1], -f);
    for (let k = 6; k >= 1; k--) pos.push(-r[k][0], r[k][1], -f);
  }
  for (let i = 0; i < n - 1; i++) for (let k = 0; k < 14; k++) {
    const a = i * 14 + k, b = i * 14 + ((k + 1) % 14), c = (i + 1) * 14 + ((k + 1) % 14), d = (i + 1) * 14 + k;
    idx.push(a, d, c, a, c, b);
  }
  for (const [i, flip] of [[0, false], [n - 1, true]]) {              // close the tail and the nose
    const c = pos.length / 3, sec = S[i];
    pos.push(0, (sec[1] + sec[3]) / 2, -sec[0] + (flip ? -0.03 : 0.03));
    for (let k = 0; k < 14; k++) { const a = i * 14 + k, b = i * 14 + ((k + 1) % 14); if (flip) idx.push(c, b, a); else idx.push(c, a, b); }
  }
  const body = new THREE.BufferGeometry();
  body.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  body.setIndex(idx);
  body.computeVertexNormals();
  {                                    // make sure the shell faces outwards
    const nrm = body.attributes.normal, top = Math.floor(n / 2) * 14 + 7;
    if (nrm.getY(top) < 0) { for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; } body.setIndex(idx); body.computeVertexNormals(); }
  }
  body.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array((pos.length / 3) * 3).fill(1), 3));

  // glass, lights, wheels and trim
  const d = new GB(), e = 0.014;
  const P = (i, k, side = 1, out = e) => { const r = ring(S[i]); return [side * (r[k][0] + out), r[k][1], -S[i][0]]; };
  const mix = (A, B, t) => [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t];
  const [r0, r1] = spec.roof;
  for (const side of [1, -1]) {
    for (let i = spec.deck; i < spec.cowl; i++) {                       // side windows, with a body-colour pillar between panes
      const gap = i === r0 || i === r1 ? 0.05 : 0.012;
      const A4 = P(i, 4, side), A5 = P(i, 5, side), B4 = P(i + 1, 4, side), B5 = P(i + 1, 5, side);
      const lo0 = mix(A4, A5, 0.1), hi0 = mix(A4, A5, 0.9), lo1 = mix(B4, B5, 0.1), hi1 = mix(B4, B5, 0.9);
      const span = Math.abs(B4[2] - A4[2]) || 1, t0 = gap / span, t1 = 1 - gap / span;
      d.quad(mix(lo0, lo1, t0), mix(lo0, lo1, t1), mix(hi0, hi1, t1), mix(hi0, hi1, t0), GLASS, [side, 0.25, 0]);
    }
    // wrap-round lamps at the four corners
    d.quad(P(n - 2, 3, side, 0.012), P(n - 1, 3, side, 0.012), P(n - 1, 4, side, 0.012), P(n - 2, 4, side, 0.012), HEAD, [side, 0, -1]);
    d.quad(P(0, 3, side, 0.012), P(1, 3, side, 0.012), P(1, 4, side, 0.012), P(0, 4, side, 0.012), TAIL, [side, 0, 1]);
    // door mirror
    const m = S[spec.cowl];
    d.box(side > 0 ? m[5] : -m[5] - 0.15, m[2] + 0.02, -m[0] + 0.12, side > 0 ? m[5] + 0.15 : -m[5], m[2] + 0.12, -m[0] + 0.2, TRIM, false);
  }
  const screen = (iLow, iHigh, hint) => {                                // windscreen and rear window
    const lo = S[iLow], hi = S[iHigh], dy = 0.02;
    d.quad([lo[6] * 0.93, lo[3] + dy + 0.03, -lo[0]], [-lo[6] * 0.93, lo[3] + dy + 0.03, -lo[0]], [-hi[6] * 0.9, hi[3] - 0.045 + dy, -hi[0]], [hi[6] * 0.9, hi[3] - 0.045 + dy, -hi[0]], GLASS, hint);
  };
  screen(spec.cowl, r1, [0, 1, -0.6]);
  screen(spec.deck, r0, [0, 1, 0.6]);
  const nose = S[n - 1], tail = S[0];
  d.quad([-0.27, tail[1] + 0.1, -tail[0] + e + 0.03], [0.27, tail[1] + 0.1, -tail[0] + e + 0.03], [0.27, tail[1] + 0.22, -tail[0] + e + 0.03], [-0.27, tail[1] + 0.22, -tail[0] + e + 0.03], PLATE, [0, 0, 1]);
  d.quad([-tail[5] * 0.8, tail[2] - 0.05, -tail[0] + e + 0.02], [tail[5] * 0.8, tail[2] - 0.05, -tail[0] + e + 0.02], [tail[5] * 0.8, tail[2] + 0.01, -tail[0] + e + 0.02], [-tail[5] * 0.8, tail[2] + 0.01, -tail[0] + e + 0.02], TAIL, [0, 0, 1]);
  d.quad([-0.25, nose[1] + 0.05, -nose[0] - e - 0.03], [0.25, nose[1] + 0.05, -nose[0] - e - 0.03], [0.25, nose[1] + 0.16, -nose[0] - e - 0.03], [-0.25, nose[1] + 0.16, -nose[0] - e - 0.03], PLATE, [0, 0, -1]);
  if (spec.grille) for (const sx of [-1, 1]) d.quad([sx * 0.04, nose[2] - 0.12, -nose[0] - e - 0.03], [sx * 0.3, nose[2] - 0.12, -nose[0] - e - 0.03], [sx * 0.3, nose[2] + 0.02, -nose[0] - e - 0.03], [sx * 0.04, nose[2] + 0.02, -nose[0] - e - 0.03], TRIM, [0, 0, -1]);
  // wheels sit in dark arches
  let wMax = 0;
  for (const sec of S) wMax = Math.max(wMax, sec[5]);
  const R = spec.wheel;
  for (const f of spec.axles) for (const sx of [-1, 1]) {
    const x = sx * (wMax + 0.012);
    d.wheel(sx * (wMax - 0.1), R, -f, R, 0.24, TYRE, 16);
    disc(d, x - sx * 0.006, R + 0.02, -f, R + 0.085, TRIM, sx, 18, true);
    disc(d, x + sx * 0.012, R, -f, R * 0.66, RIM, sx, 14);
    disc(d, x + sx * 0.02, R, -f, R * 0.2, TRIM, sx, 8);
    for (let k = 0; k < 5; k++) {                                        // spokes
      const a = (k / 5) * Math.PI * 2, c = Math.cos(a), si = Math.sin(a), w = 0.035;
      d.quad([x + sx * 0.018, R + c * R * 0.2 - si * w, -f + si * R * 0.2 + c * w], [x + sx * 0.018, R + c * R * 0.2 + si * w, -f + si * R * 0.2 - c * w],
        [x + sx * 0.018, R + c * R * 0.64 + si * w, -f + si * R * 0.64 - c * w], [x + sx * 0.018, R + c * R * 0.64 - si * w, -f + si * R * 0.64 + c * w], SPOKE, [sx, 0, 0]);
    }
  }
  const len = nose[0] - tail[0];
  let hgt = 0;
  for (const sec of S) hgt = Math.max(hgt, sec[3]);
  return { len, wid: wMax * 2, hgt, body, detail: d.build(), tailY: tail[2] - 0.02, rear: -tail[0], label: spec.label, note: spec.note };
}

/** Flat disc facing along ±x; `upper` keeps only the top half (a wheel arch). */
function disc(d, x, y, z, r, color, sx, seg = 14, upper = false) {
  const n = upper ? seg / 2 : seg, a0 = upper ? -Math.PI / 2 : 0, span = upper ? Math.PI : Math.PI * 2;
  for (let i = 0; i < n; i++) {
    const a = a0 + (i / n) * span, b = a0 + ((i + 1) / n) * span;
    d.tri([x, y, z], [x, y + Math.cos(a) * r, z + Math.sin(a) * r], [x, y + Math.cos(b) * r, z + Math.sin(b) * r], color, [sx, 0, 0]);
  }
}

/**
 * Specs for every vehicle kind: { len, wid, hgt, body, detail }.
 * `body` is drawn in the vehicle's paint colour, `detail` keeps its own colours.
 */
export function buildVehicleGeometry() {
  const out = {};

  for (const spec of CAR_SPECS) out[spec.id] = buildCar(spec);
  out.car = out.tesla;

  // ── van ──
  {
    const b = new GB(), d = new GB(), hw = 1.0;
    b.extrude([[-2.6, 0.34], [2.5, 0.34], [2.6, 0.7], [2.45, 1.05], [1.75, 1.95], [-2.6, 1.95]], () => hw, WHITE);
    d.quad([0.86, 1.12, -2.42], [-0.86, 1.12, -2.42], [-0.84, 1.86, -1.84], [0.84, 1.86, -1.84], GLASS, [0, 0.5, -1]);
    for (const sx of [-1, 1]) {
      d.quad([sx * 1.012, 1.15, -1.9], [sx * 1.012, 1.15, -0.75], [sx * 1.012, 1.78, -0.75], [sx * 1.012, 1.78, -1.55], GLASS, [sx, 0, 0]);
      d.box(sx * 0.72 - 0.2, 0.72, -2.63, sx * 0.72 + 0.2, 0.88, -2.55, HEAD, false);
      d.box(sx * 0.86 - 0.1, 0.8, 2.58, sx * 0.86 + 0.1, 1.4, 2.62, TAIL, false);
    }
    d.box(-1.0, 0.34, -2.64, 1.0, 0.5, 2.62, TRIM, false);
    wheels(d, hw, [-1.6, 1.5], 0.35, 0.24);
    out.van = { len: 5.2, wid: 2.0, hgt: 1.95, body: b.build(), detail: d.build() };
  }

  // ── truck ──
  {
    const b = new GB(), d = new GB(), hw = 1.22, grey = K('#c9ccd0');
    b.extrude([[2.2, 0.5], [4.1, 0.5], [4.15, 1.2], [4.0, 2.75], [2.2, 2.75]], () => hw - 0.04, WHITE);   // cab
    d.box(-hw, 1.02, -2.05, hw, 3.45, 4.15, grey, false);                                                  // cargo box
    d.box(-hw + 0.1, 0.6, -2.0, hw - 0.1, 1.02, 4.1, TRIM, false);                                         // chassis
    d.quad([1.05, 1.7, -4.13], [-1.05, 1.7, -4.13], [-1.02, 2.55, -4.06], [1.02, 2.55, -4.06], GLASS, [0, 0, -1]);
    for (const sx of [-1, 1]) {
      d.quad([sx * 1.19, 1.75, -3.95], [sx * 1.19, 1.75, -3.0], [sx * 1.19, 2.5, -3.0], [sx * 1.19, 2.5, -3.9], GLASS, [sx, 0, 0]);
      d.box(sx * 0.85 - 0.2, 0.75, -4.19, sx * 0.85 + 0.2, 0.93, -4.12, HEAD, false);
      d.box(sx * 1.0 - 0.14, 0.72, 4.15, sx * 1.0 + 0.14, 0.92, 4.19, TAIL, false);
    }
    wheels(d, hw, [-3.2, 2.2, 3.3], 0.48, 0.3);
    out.truck = { len: 8.3, wid: 2.45, hgt: 3.45, body: b.build(), detail: d.build() };
  }

  // ── VBZ-style bus ──
  {
    const b = new GB(), d = new GB(), hw = 1.26, blue = K('#1763b3');
    b.extrude([[-6.0, 0.4], [5.9, 0.4], [6.0, 0.9], [5.95, 2.95], [-6.0, 2.95]], () => hw, WHITE);
    d.box(-hw - 0.012, 0.4, -6.0, hw + 0.012, 1.05, 6.0, blue, false);
    for (const sx of [-1, 1]) {
      d.quad([sx * (hw + 0.014), 1.35, -5.6], [sx * (hw + 0.014), 1.35, 5.7], [sx * (hw + 0.014), 2.5, 5.7], [sx * (hw + 0.014), 2.5, -5.6], GLASS, [sx, 0, 0]);
      d.box(sx * 0.9 - 0.2, 0.62, -6.04, sx * 0.9 + 0.2, 0.8, -5.98, HEAD, false);
      d.box(sx * 1.0 - 0.12, 0.7, 5.98, sx * 1.0 + 0.12, 1.0, 6.03, TAIL, false);
    }
    d.quad([1.14, 1.2, -6.03], [-1.14, 1.2, -6.03], [-1.14, 2.6, -5.99], [1.14, 2.6, -5.99], GLASS, [0, 0, -1]);
    d.quad([1.1, 1.5, 6.02], [-1.1, 1.5, 6.02], [-1.1, 2.5, 6.02], [1.1, 2.5, 6.02], GLASS, [0, 0, 1]);
    d.box(-0.7, 2.62, -6.035, 0.7, 2.86, -5.99, K('#151515'), false);
    wheels(d, hw, [-4.0, 3.4], 0.5, 0.3);
    out.bus = { len: 12.0, wid: 2.55, hgt: 2.95, body: b.build(), detail: d.build() };
  }

  // ── tram segment (blue and white, drawn several times per tram) ──
  {
    const d = new GB(), hw = 1.15, blue = K('#1d5fae'), white = K('#f2f3f1');
    d.box(-hw, 0.35, -4.5, hw, 1.25, 4.5, blue, false);
    d.box(-hw, 1.25, -4.5, hw, 3.3, 4.5, white, false);
    d.box(-hw + 0.2, 3.3, -3.8, hw - 0.2, 3.5, 3.8, K('#b8bbbd'), false);
    for (const sx of [-1, 1]) d.quad([sx * (hw + 0.012), 1.55, -4.2], [sx * (hw + 0.012), 1.55, 4.2], [sx * (hw + 0.012), 2.75, 4.2], [sx * (hw + 0.012), 2.75, -4.2], GLASS, [sx, 0, 0]);
    d.quad([0.95, 1.5, -4.512], [-0.95, 1.5, -4.512], [-0.95, 2.8, -4.512], [0.95, 2.8, -4.512], GLASS, [0, 0, -1]);
    d.quad([0.95, 1.5, 4.512], [-0.95, 1.5, 4.512], [-0.95, 2.8, 4.512], [0.95, 2.8, 4.512], GLASS, [0, 0, 1]);
    d.box(-0.8, 0.12, -3.4, 0.8, 0.35, -2.2, TRIM, false);
    d.box(-0.8, 0.12, 2.2, 0.8, 0.35, 3.4, TRIM, false);
    out.tram = { len: 9.0, wid: 2.3, hgt: 3.5, body: null, detail: d.build() };
  }

  // ── pedestrian: torso + head tinted by clothing colour, legs separate so they can swing ──
  {
    const b = new GB(), skin = K('#e2b896');
    b.box(-0.21, 0.82, -0.12, 0.21, 1.42, 0.12, WHITE, false);
    b.box(-0.29, 0.86, -0.07, -0.21, 1.4, 0.07, WHITE, false);
    b.box(0.21, 0.86, -0.07, 0.29, 1.4, 0.07, WHITE, false);
    const h = new GB();
    h.box(-0.1, 1.46, -0.11, 0.1, 1.7, 0.11, skin, false);
    h.box(-0.105, 1.62, -0.115, 0.105, 1.72, 0.115, K('#3a2c22'), false);
    const leg = new GB();
    leg.box(-0.075, -0.82, -0.08, 0.075, 0, 0.08, K('#2b3344'), false);
    out.ped = { body: b.build(), head: h.build(), leg: leg.build() };
  }
  return out;
}

export const PAINTS = [['Racing red', '#b3131f'], ['Midnight blue', '#16264a'], ['Pearl white', '#eceef0'], ['Graphite', '#3a3d42'], ['Silver', '#aeb3b9'], ['Jet black', '#101113'], ['Forest green', '#1f4a36'], ['Sunset orange', '#d2571b'], ['Sky blue', '#3e86c9'], ['Yellow', '#e3b213']];
export const CAR_COLORS = ['#d9dbde', '#1b1d21', '#8e9399', '#f4f4f2', '#2c3e5c', '#7a1f25', '#3b5b46', '#b9b2a0', '#4a4f57', '#c2c6cb', '#1f3f73', '#6b6f75', '#a53b2a', '#2a2c30'].map(K);
export const PED_COLORS = ['#3c5a80', '#7d3b3b', '#3f6b4f', '#c9a23a', '#5a4a6e', '#2f2f33', '#b5562e', '#8a8f96', '#d8d2c4', '#46708d'].map(K);

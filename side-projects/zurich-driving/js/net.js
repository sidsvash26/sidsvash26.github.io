// Road network: lanes, junction control, spatial lookup and routing.
// World frame: x = east, y = up, z = south (metres). Heading θ: 0 = north, +90° = east.

export const T = { MOTORWAY: 0, TRUNK: 1, PRIMARY: 2, SECONDARY: 3, TERTIARY: 4, UNCLASSIFIED: 5, RESIDENTIAL: 6, LIVING: 7, SERVICE: 8 };
export const F = { ONEWAY: 1, BRIDGE: 2, TUNNEL: 4, ROUNDABOUT: 8, LINK: 16, CYCLE_F: 32, CYCLE_B: 64, PASSAGE: 128 };
export const C = { EQUAL: 0, YIELD: 1, STOP: 2, SIGNAL: 3, PRIORITY: 4, NONE: 5 };

const LANE_W = [3.6, 3.5, 3.25, 3.25, 3.1, 3.0, 2.8, 2.6, 2.6];
const CELL = 40;
const key = (cx, cz) => (cx + 4096) * 8192 + (cz + 4096);

/** OSM turn:lanes ("left|through;right") → per-lane bitmask (1 left, 2 through, 4 right; 0 = anything). */
function parseTurns(str, n) {
  if (!str) return null;
  const parts = str.split('|');
  if (parts.length !== n || n < 2) return null;
  const masks = parts.map((p) => {
    let m = 0;
    for (const t of p.split(';')) {
      if (t.startsWith('merge') || t === 'through') m |= 2;
      else if (t.includes('left')) m |= 1;
      else if (t.includes('right')) m |= 4;
    }
    return m;
  });
  return masks.some((m) => m) ? masks : null;
}
export const turnBit = (turn) => (turn < 0 ? 1 : turn > 0 ? 4 : 2);

export const wrapAngle = (a) => {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
};
export const headingOf = (tx, tz) => Math.atan2(tx, -tz);

class Heap {
  constructor() { this.k = []; this.v = []; }
  get size() { return this.k.length; }
  push(k, v) {
    const K = this.k, V = this.v;
    let i = K.length;
    K.push(k); V.push(v);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (K[p] <= k) break;
      K[i] = K[p]; V[i] = V[p]; i = p;
    }
    K[i] = k; V[i] = v;
  }
  pop() {
    const K = this.k, V = this.v, top = V[0], k = K.pop(), v = V.pop(), n = K.length;
    if (n) {
      let i = 0;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && K[c + 1] < K[c]) c++;
        if (K[c] >= k) break;
        K[i] = K[c]; V[i] = V[c]; i = c;
      }
      K[i] = k; V[i] = v;
    }
    return top;
  }
}

export class Net {
  constructor(g, demData = null) {
    this.dem = demData ? { ...g.dem, data: demData } : null;
    this.origin = g.origin;
    this.k = g.k;
    this.tile = g.tile;
    this.bounds = g.bounds;
    this.names = g.names;
    this.tiles = new Set(g.tiles);

    const nn = g.nodes.length / 3;
    this.nodes = new Array(nn);
    for (let i = 0; i < nn; i++) {
      this.nodes[i] = { id: i, x: g.nodes[i * 3] / 10, z: g.nodes[i * 3 + 1] / 10, y: g.nodes[i * 3 + 2] / 10, ends: [], sig: g.sig[i], r: 0, mini: false };
    }
    for (const m of g.mini) this.nodes[m].mini = true;

    this.edges = g.edges.map((o, id) => {
      const a = this.nodes[o.a], b = this.nodes[o.b];
      const inner = o.p || [];
      const n = inner.length / 3 + 2;
      const pts = new Float32Array(n * 3);
      pts[0] = a.x; pts[1] = a.y; pts[2] = a.z;
      for (let i = 0; i < inner.length / 3; i++) {
        pts[(i + 1) * 3] = inner[i * 3] / 10;
        pts[(i + 1) * 3 + 1] = inner[i * 3 + 2] / 10;
        pts[(i + 1) * 3 + 2] = inner[i * 3 + 1] / 10;
      }
      pts[(n - 1) * 3] = b.x; pts[(n - 1) * 3 + 1] = b.y; pts[(n - 1) * 3 + 2] = b.z;
      const cum = new Float32Array(n);
      for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + Math.hypot(pts[i * 3] - pts[i * 3 - 3], pts[i * 3 + 2] - pts[i * 3 - 1]);
      const oneway = !!(o.f & F.ONEWAY);
      const narrow = !oneway && o.t >= T.RESIDENTIAL;
      const ring = !!(o.f & F.ROUNDABOUT) && o.lf === 1;       // single circulating lane: drawn generously wide
      const lw = ring ? 5.2 : narrow ? 2.75 : LANE_W[o.t];
      const link = !!(o.f & F.LINK);
      const e = {
        id, a: o.a, b: o.b, t: o.t, speed: o.s, nf: o.lf, nb: o.lb, flags: o.f, oneway, link,
        ca: o.ca, cb: o.cb, name: this.names[o.n || 0], tf: o.tf || '', tb: o.tb || '',
        pts, cum, n, len: cum[n - 1], lw,
        offR: oneway ? (o.lf * lw) / 2 : o.lf * lw,
        offL: oneway ? (-o.lf * lw) / 2 : -o.lb * lw,
        trimA: 0, trimB: 0, stopA: 0, stopB: 0, sa: (o.sa || 0) / 10, sb: (o.sb || 0) / 10,
        crossings: [], tunnel: !!(o.f & F.TUNNEL), roundabout: !!(o.f & F.ROUNDABOUT),
      };
      e.turnF = parseTurns(e.tf, e.nf);
      e.turnB = parseTurns(e.tb, e.nb);
      const mw = o.t <= T.TRUNK;
      const shR = mw ? (link ? 1.0 : 2.4) : 0.3, shL = mw ? 0.7 : 0.3;
      e.cyR = o.f & F.CYCLE_F ? 1.5 : 0;
      e.cyL = o.f & F.CYCLE_B ? 1.5 : 0;
      e.paveR = e.offR + e.cyR + shR;
      e.paveL = e.offL - e.cyL - shL;
      e.sidewalk = o.t >= T.PRIMARY && !e.tunnel && !link && !e.roundabout;
      a.ends.push({ e: id, end: 0 });
      b.ends.push({ e: id, end: 1 });
      return e;
    });

    this._fixMerges();
    // height of every road point above the natural ground: positive on bridges, negative in tunnels
    const relOf = (e) => { e.rel = new Float32Array(e.n); for (let i = 0; i < e.n; i++) e.rel[i] = e.pts[i * 3 + 1] - this.ground(e.pts[i * 3], e.pts[i * 3 + 2]); };
    this._relOf = relOf;
    for (const e of this.edges) relOf(e);

    // junction radii and stop positions
    for (const nd of this.nodes) {
      if (nd.ends.length < 3) continue;
      let w = 0, minLen = 1e9;
      for (const { e } of nd.ends) {
        const ed = this.edges[e];
        w = Math.max(w, ed.paveR, -ed.paveL);
        minLen = Math.min(minLen, ed.len);
      }
      nd.r = nd.merge ? Math.max(2, Math.min(24, minLen * 0.45)) : Math.max(2, Math.min(w + 1.5, 14, minLen * 0.45));
    }
    for (const e of this.edges) {
      e.trimA = Math.min(this.nodes[e.a].r, e.len * 0.45);
      e.trimB = Math.min(this.nodes[e.b].r, e.len * 0.45);
      const stop = (trim, explicit) => {
        let s = trim + 1.0;
        if (explicit > s && explicit < 30) s = explicit;
        return Math.min(s, e.len * 0.6);
      };
      e.stopA = stop(e.trimA, e.sa);
      e.stopB = stop(e.trimB, e.sb);
    }

    this.crossings = g.cross.map(([ei, s, sig], id) => {
      const e = this.edges[ei];
      const c = { id, e: ei, s: s / 10, sig: !!sig, x: 0, y: 0, z: 0, tx: 0, tz: 0, peds: 0 };
      const p = this.sample(e, c.s, {});
      Object.assign(c, { x: p.x, y: p.y, z: p.z, tx: p.tx, tz: p.tz, rel: p.rel });
      e.crossings.push(c);
      return c;
    });

    // spatial hash of edge segments
    this.grid = new Map();
    for (const e of this.edges) {
      for (let i = 0; i < e.n - 1; i++) {
        const x0 = e.pts[i * 3], z0 = e.pts[i * 3 + 2], x1 = e.pts[i * 3 + 3], z1 = e.pts[i * 3 + 5];
        const cx0 = Math.floor(Math.min(x0, x1) / CELL), cx1 = Math.floor(Math.max(x0, x1) / CELL);
        const cz0 = Math.floor(Math.min(z0, z1) / CELL), cz1 = Math.floor(Math.max(z0, z1) / CELL);
        for (let cx = cx0; cx <= cx1; cx++) for (let cz = cz0; cz <= cz1; cz++) {
          const k = key(cx, cz);
          let arr = this.grid.get(k);
          if (!arr) this.grid.set(k, (arr = []));
          arr.push(e.id, i);
        }
      }
    }

    // signed turn restrictions: approach key → set of forbidden exit edges
    this.bans = new Map();
    for (const [f, via, to] of g.ban || []) {
      const k = f * 2 + (this.edges[f].b === via ? 1 : 0);
      let set = this.bans.get(k);
      if (!set) this.bans.set(k, (set = new Set()));
      set.add(to);
    }

    this._buildTram(g.tram);
    this._stamp = new Int32Array(this.edges.length);
    this._stampN = 0;
  }

  /**
   * Slip roads in the data converge onto the centre line of the road they join. Reshape the last stretch
   * so the slip road runs alongside the main carriageway like a real acceleration lane.
   */
  _fixMerges() {
    for (const M of this.nodes) {
      if (M.ends.length !== 3) continue;
      const inc = [];
      let out = 0, ok = true;
      for (const { e, end } of M.ends) { const ed = this.edges[e]; if (!ed.oneway) ok = false; else if (end === 1) inc.push(ed); else out++; }
      if (!ok || inc.length !== 2 || out !== 1) continue;
      const [A, B] = inc;
      if (Math.cos(this.heading(A, 1, true, 12) - this.heading(B, 1, true, 12)) < 0.85) continue;
      let outE = null;
      for (const { e, end } of M.ends) if (end === 0) outE = this.edges[e];
      let side, main;
      if (A.cb === C.YIELD && B.cb !== C.YIELD) { side = A; main = B; } else if (B.cb === C.YIELD && A.cb !== C.YIELD) { side = B; main = A; }
      else if (A.cb === C.SIGNAL || B.cb === C.SIGNAL || A.cb === C.STOP || B.cb === C.STOP) continue;
      else {
        // two equal roads flowing together (ramp into ramp): the one that bends more to join gives way
        const ho = this.heading(outE, 1, false, 12);
        const da = Math.abs(wrapAngle(this.heading(A, 1, true, 12) - ho)), db = Math.abs(wrapAngle(this.heading(B, 1, true, 12) - ho));
        if (A.nf !== B.nf) { side = A.nf < B.nf ? A : B; } else side = da > db ? A : B;
        main = side === A ? B : A;
        side.cb = C.YIELD; main.cb = C.PRIORITY;
      }
      if (side.len < 40) continue;
      // "lane gain": the road beyond has room for everyone, so the slip road simply becomes a new lane
      const gain = outE.nf >= main.nf + side.nf;
      this._alignMerge(side, main, M, gain ? outE : null);
      if (gain) { side.cb = C.PRIORITY; side.gain = true; }
    }
  }

  _alignMerge(side, main, M, gainOut) {
    const lateral = (x, z) => {            // offset of a point from the main road's centre line (+ = right)
      let best = null;
      for (let i = 0; i < main.n - 1; i++) {
        const ax = main.pts[i * 3], az = main.pts[i * 3 + 2], dx = main.pts[i * 3 + 3] - ax, dz = main.pts[i * 3 + 5] - az;
        const L = Math.hypot(dx, dz) || 1e-6, tx = dx / L, tz = dz / L;
        const t = ((x - ax) * tx + (z - az) * tz) / L, tc = Math.max(0, Math.min(1, t));
        const d = Math.hypot(x - ax - dx * tc, z - az - dz * tc);
        if (!best || d < best.d) best = { d, lat: (x - ax) * -tz + (z - az) * tx, nx: -tz, nz: tx, before: i === 0 && t < 0 };
      }
      return best;
    };
    const from = Math.max(0, side.len - 240), P = [], tmp = {};
    for (let i = 0; i < side.n; i++) if (side.cum[i] < from - 0.5) P.push([side.pts[i * 3], side.pts[i * 3 + 1], side.pts[i * 3 + 2]]);
    for (let s = from; s < side.len - 1; s += 8) { this.sample(side, s, tmp); P.push([tmp.x, tmp.y, tmp.z]); }
    P.push([M.x, M.y, M.z]);
    const probe = P[Math.max(0, P.length - 4)], sgn = lateral(probe[0], probe[2]).lat >= 0 ? 1 : -1;
    let target = sgn > 0 ? main.offR + side.lw / 2 + 0.1 : main.offL - side.lw / 2 - 0.1;
    if (gainOut) target = sgn > 0 ? gainOut.offR - gainOut.lw / 2 : gainOut.offL + gainOut.lw / 2;       // line up with the new outer lane
    main.mergeMain = sgn;
    for (let i = P.length - 1; i > 0; i--) {
      const q = lateral(P[i][0], P[i][2]);
      if (q.before || (target - q.lat) * sgn <= 0) break;
      P[i][0] += q.nx * (target - q.lat); P[i][2] += q.nz * (target - q.lat);
    }
    const n = P.length, pts = new Float32Array(n * 3), cum = new Float32Array(n);
    for (let i = 0; i < n; i++) { pts[i * 3] = P[i][0]; pts[i * 3 + 1] = P[i][1]; pts[i * 3 + 2] = P[i][2]; }
    for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + Math.hypot(pts[i * 3] - pts[i * 3 - 3], pts[i * 3 + 2] - pts[i * 3 - 1]);
    side.pts = pts; side.cum = cum; side.n = n; side.len = cum[n - 1];
    side.merge = sgn;                       // +1: joins from the right of the main road, −1: from the left
    M.merge = true;
  }

  _buildTram(t) {
    const nn = t.nodes.length / 3;
    const nodes = new Array(nn);
    for (let i = 0; i < nn; i++) nodes[i] = { id: i, x: t.nodes[i * 3] / 10, z: t.nodes[i * 3 + 1] / 10, y: t.nodes[i * 3 + 2] / 10, out: [], inn: [], sigNode: -1 };
    const edges = t.edges.map(([a, b, inner], id) => {
      const n = inner.length / 3 + 2;
      const pts = new Float32Array(n * 3);
      const A = nodes[a], B = nodes[b];
      pts[0] = A.x; pts[1] = A.y; pts[2] = A.z;
      for (let i = 0; i < inner.length / 3; i++) {
        pts[(i + 1) * 3] = inner[i * 3] / 10;
        pts[(i + 1) * 3 + 1] = inner[i * 3 + 2] / 10;
        pts[(i + 1) * 3 + 2] = inner[i * 3 + 1] / 10;
      }
      pts[(n - 1) * 3] = B.x; pts[(n - 1) * 3 + 1] = B.y; pts[(n - 1) * 3 + 2] = B.z;
      const cum = new Float32Array(n);
      for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + Math.hypot(pts[i * 3] - pts[i * 3 - 3], pts[i * 3 + 2] - pts[i * 3 - 1]);
      A.out.push(id); B.inn.push(id);
      const te = { id, a, b, pts, cum, n, len: cum[n - 1], stops: [] };
      this._relOf(te);
      return te;
    });
    for (const [ei, s, nm] of t.stops) edges[ei].stops.push({ s: s / 10, name: this.names[nm] });
    for (const e of edges) e.stops.sort((p, q) => p.s - q.s);
    // where each track runs into a signalised road junction (tracks often cross one without having a node there)
    for (const e of edges) {
      e.sigs = [];
      let inside = -1;
      for (let d = 0; d <= e.len; d += 5) {
        const p = this.sample(e, d, {});
        let hit = -1;
        if (p.rel > -1) for (const rn of this.nodesNear(p.x, p.z, 13)) if (rn.sig >= 0) { hit = rn.sig; break; }
        if (hit >= 0 && inside < 0) e.sigs.push({ s: d, sig: hit, h: headingOf(p.tx, p.tz) });
        inside = hit;
      }
    }
    // tram nodes that sit on a signalised road junction obey that junction's lights
    for (const nd of nodes) {
      const near = this.nodesNear(nd.x, nd.z, 14);
      let best = 14;
      for (const rn of near) {
        if (rn.sig < 0) continue;
        const d = Math.hypot(rn.x - nd.x, rn.z - nd.z);
        if (d < best) { best = d; nd.sigNode = rn.id; }
      }
    }
    this.tram = { nodes, edges };
  }

  /** Natural ground height at a point (same datum as every y in the game), from the elevation grid. */
  ground(x, z) {
    const d = this.dem;
    if (!d) return 0;
    let fx = (x - d.x0) / d.step, fz = (z - d.z0) / d.step;
    fx = fx < 0 ? 0 : fx > d.nx - 1.001 ? d.nx - 1.001 : fx;
    fz = fz < 0 ? 0 : fz > d.nz - 1.001 ? d.nz - 1.001 : fz;
    const i = fx | 0, j = fz | 0, ax = fx - i, az = fz - j, g = d.data, n = d.nx;
    return ((g[j * n + i] * (1 - ax) + g[j * n + i + 1] * ax) * (1 - az) + (g[(j + 1) * n + i] * (1 - ax) + g[(j + 1) * n + i + 1] * ax) * az) / 10;
  }

  // ── geometry ──
  /** Point and unit tangent on edge centreline at arc length s (from node a). */
  sample(e, s, out) {
    const { cum, pts, n } = e;
    if (s <= 0) s = 0; else if (s >= e.len) s = e.len;
    let lo = 0, hi = n - 2;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (cum[mid] <= s) lo = mid; else hi = mid - 1;
    }
    const i = lo * 3, seg = cum[lo + 1] - cum[lo] || 1e-6, t = (s - cum[lo]) / seg;
    const dx = pts[i + 3] - pts[i], dz = pts[i + 5] - pts[i + 2];
    out.x = pts[i] + dx * t;
    out.y = pts[i + 1] + (pts[i + 4] - pts[i + 1]) * t;
    out.z = pts[i + 2] + dz * t;
    out.tx = dx / seg; out.tz = dz / seg;
    out.slope = (pts[i + 4] - pts[i + 1]) / seg;
    out.rel = e.rel ? e.rel[lo] + (e.rel[lo + 1] - e.rel[lo]) * t : 0;
    out.seg = lo;
    return out;
  }

  lanes(e, dir) { return dir > 0 ? e.nf : e.nb; }

  /** Lateral offset of a lane centre in the edge's a→b frame (+ = right of a→b). Lane 0 is the leftmost in travel direction. */
  laneOffset(e, dir, lane) {
    if (dir > 0) return e.oneway ? e.offL + (lane + 0.5) * e.lw : (lane + 0.5) * e.lw;
    return -(lane + 0.5) * e.lw;
  }

  /** Pose on a lane; s is measured in the direction of travel. */
  lanePoint(e, dir, lane, s, out, extra = 0) {
    this.sample(e, dir > 0 ? s : e.len - s, out);
    const off = this.laneOffset(e, dir, lane) + dir * extra;
    out.x += -out.tz * off; out.z += out.tx * off;
    if (dir < 0) { out.tx = -out.tx; out.tz = -out.tz; out.slope = -out.slope; }
    return out;
  }

  /** Painted lane arrows of (e, dir) as per-lane turn masks, or null. */
  turns(e, dir) { return dir > 0 ? e.turnF : e.turnB; }

  /**
   * Lane arrows that actually govern the junction at the end of (e, dir). Arrows are often painted well
   * before the junction they refer to, so they only count here when every arrow direction on the road
   * has a matching exit at this node (and there is a choice to make).
   */
  turnsAt(e, dir) {
    const k = dir > 0 ? '_taF' : '_taB';
    if (e[k] !== undefined) return e[k];
    const masks = this.turns(e, dir);
    let ok = !!masks && e.len >= 45;
    if (ok) {
      const exits = this.exits(this.endNode(e, dir), e.id);
      let have = 0, any = 0;
      for (const x of exits) { const a = this.turnAngle(e, dir, x.e, x.dir); have |= a < -0.5 ? 1 : a > 0.5 ? 4 : 2; }
      for (const m of masks) any |= m;
      ok = exits.length > 1 && (any & have) === any;
    }
    return (e[k] = ok ? masks : null);
  }

  laneAllows(e, dir, lane, turn) {
    const m = this.turnsAt(e, dir);
    return !m || m[lane] === undefined || m[lane] === 0 || !!(m[lane] & turnBit(turn));
  }

  endNode(e, dir) { return dir > 0 ? e.b : e.a; }
  startNode(e, dir) { return dir > 0 ? e.a : e.b; }
  control(e, dir) { return dir > 0 ? e.cb : e.ca; }
  stopDist(e, dir) { return dir > 0 ? e.stopB : e.stopA; }
  trimEnd(e, dir) { return dir > 0 ? e.trimB : e.trimA; }
  trimStart(e, dir) { return dir > 0 ? e.trimA : e.trimB; }

  /**
   * The junction a driver on (e, dir) is really heading for: follows the road through plain
   * degree-2 nodes (where only tags change) to the next node with three or more arms.
   * Returns { e, dir, extra, node } — the final edge, and the distance from the end of e to its end.
   */
  chain(e, dir) {
    const k = dir > 0 ? '_chF' : '_chB';
    if (e[k]) return e[k];
    let ce = e, cd = dir, extra = 0;
    for (let hops = 0; hops < 12 && extra < 300; hops++) {
      const n = this.nodes[this.endNode(ce, cd)];
      if (n.ends.length !== 2) break;
      const o = n.ends[0].e === ce.id ? n.ends[1] : n.ends[0];
      const oe = this.edges[o.e], od = o.end === 0 ? 1 : -1;
      if (oe === ce || (od < 0 && oe.oneway)) break;
      ce = oe; cd = od; extra += oe.len;
    }
    return (e[k] = { e: ce, dir: cd, extra, node: this.endNode(ce, cd) });
  }

  /** Like chain(), but looking back: the real junction (e, dir) comes from, and the road length in between. */
  chainBack(e, dir) {
    let ce = e, cd = dir, extra = 0;
    for (let hops = 0; hops < 12 && extra < 300; hops++) {
      const n = this.nodes[this.startNode(ce, cd)];
      if (n.ends.length !== 2) break;
      const o = n.ends[0].e === ce.id ? n.ends[1] : n.ends[0];
      const oe = this.edges[o.e], od = o.end === 1 ? 1 : -1;
      if (oe === ce || (od < 0 && oe.oneway)) break;
      ce = oe; cd = od; extra += oe.len;
    }
    return { node: this.startNode(ce, cd), extra };
  }

  /** Heading of travel (dir) on edge e, a few metres in from its end (atEnd) or start. */
  heading(e, dir, atEnd, inset = 6) {
    const sTravel = atEnd ? Math.max(e.len - inset, e.len * 0.5) : Math.min(inset, e.len * 0.5);
    const p = this.sample(e, dir > 0 ? sTravel : e.len - sTravel, this._tmp || (this._tmp = {}));
    return headingOf(p.tx * dir, p.tz * dir);
  }

  /** Signed turn angle (rad, + = right) going from (e1,dir1) into (e2,dir2). */
  turnAngle(e1, dir1, e2, dir2) {
    return wrapAngle(this.heading(e2, dir2, false) - this.heading(e1, dir1, true));
  }

  /** Directed edges leaving a node: [{e, dir}]. `from` (edge id) is excluded unless it is the only way out. */
  exits(nodeId, fromEdge = -1) {
    const out = [];
    for (const { e, end } of this.nodes[nodeId].ends) {
      const ed = this.edges[e];
      if (end === 1 && ed.oneway) continue;
      if (e === fromEdge) continue;
      out.push({ e: ed, dir: end === 0 ? 1 : -1 });
    }
    return out;
  }

  /** Is the turn from (e, dir) into edge `to` forbidden by a sign? */
  banned(e, dir, to) {
    const set = this.bans.get(e.id * 2 + (dir > 0 ? 1 : 0));
    return !!set && set.has(to.id);
  }

  /**
   * Exits a law-abiding driver may take from the end of (e, dir): signed bans are removed, and so are
   * turns that none of the painted lane arrows provide for.
   */
  legalExits(e, dir) {
    const all = this.exits(this.endNode(e, dir), e.id);
    if (all.length < 2) return all;
    const masks = this.turnsAt(e, dir);
    let any = 0;
    if (masks) for (const m of masks) any |= m || 7;
    const out = all.filter((x) => {
      if (this.banned(e, dir, x.e)) return false;
      const a = this.turnAngle(e, dir, x.e, x.dir);
      if (Math.abs(a) > 2.5) return false;               // hairpin back down the other carriageway: a U-turn
      if (!masks) return true;
      if (a < -0.9) return !!(any & 1);
      if (a > 0.9) return !!(any & 4);
      return true;
    });
    return out.length ? out : all;
  }

  /** Directed edges arriving at a node: [{e, dir}]. */
  approaches(nodeId) {
    const out = [];
    for (const { e, end } of this.nodes[nodeId].ends) {
      const ed = this.edges[e];
      if (end === 0 && ed.oneway) continue;
      out.push({ e: ed, dir: end === 1 ? 1 : -1 });
    }
    return out;
  }

  // ── spatial queries ──
  nodesNear(x, z, r) {
    const out = [], seen = new Set();
    this.forEdgesNear(x, z, r, (e) => {
      for (const id of [e.a, e.b]) {
        if (seen.has(id)) continue;
        seen.add(id);
        const nd = this.nodes[id];
        if (Math.hypot(nd.x - x, nd.z - z) <= r) out.push(nd);
      }
    });
    return out;
  }

  forEdgesNear(x, z, r, fn) {
    if (!this._stamp) { this._stamp = new Int32Array(this.edges.length); this._stampN = 0; }
    const stamp = ++this._stampN;
    const cx0 = Math.floor((x - r) / CELL), cx1 = Math.floor((x + r) / CELL);
    const cz0 = Math.floor((z - r) / CELL), cz1 = Math.floor((z + r) / CELL);
    for (let cx = cx0; cx <= cx1; cx++) for (let cz = cz0; cz <= cz1; cz++) {
      const arr = this.grid.get(key(cx, cz));
      if (!arr) continue;
      for (let i = 0; i < arr.length; i += 2) {
        const id = arr[i];
        if (this._stamp[id] === stamp) continue;
        this._stamp[id] = stamp;
        fn(this.edges[id]);
      }
    }
  }

  /**
   * Height of the highest carriageway covering a point that lies no more than `up` above `y`, or `y` if there
   * is none. Where a ramp peels off and climbs, its surface overlaps the road beside it and is the one drawn.
   */
  surfaceAbove(x, z, y, up = 1.2) {
    let top = y;
    const cx0 = Math.floor((x - 16) / CELL), cx1 = Math.floor((x + 16) / CELL);
    const cz0 = Math.floor((z - 16) / CELL), cz1 = Math.floor((z + 16) / CELL);
    for (let cx = cx0; cx <= cx1; cx++) for (let cz = cz0; cz <= cz1; cz++) {
      const arr = this.grid.get(key(cx, cz));
      if (!arr) continue;
      for (let j = 0; j < arr.length; j += 2) {
        const e = this.edges[arr[j]], i = arr[j + 1] * 3, p = e.pts;
        const ax = p[i], az = p[i + 2], dx = p[i + 3] - ax, dz = p[i + 5] - az;
        const L2 = dx * dx + dz * dz || 1e-9, t = ((x - ax) * dx + (z - az) * dz) / L2;
        if (t < 0 || t > 1) continue;
        const L = Math.sqrt(L2), lat = ((x - ax) * -dz + (z - az) * dx) / L;
        const m = e.sidewalk ? 2.2 : 1.0;                 // the verge or pavement drawn beside the carriageway
        if (lat > e.paveR + m || lat < e.paveL - m) continue;
        const sy = p[i + 1] + (p[i + 4] - p[i + 1]) * t;
        if (sy > top && sy <= y + up) top = sy;
      }
    }
    return top;
  }

  /**
   * Nearest road position to a point. Returns null if nothing within maxD.
   * opts: y (prefer roads at this height), heading (prefer aligned travel), prev (edge id to stick to).
   * Result: { e, s, lat, d, tx, tz, y, on } — lat is the offset to the right of a→b; `on` = within the paved width.
   */
  locate(x, z, opts = {}, maxD = 30) {
    const { y = null, heading = null, prev = -1, prefer = null } = opts;
    let best = null, bestCost = 1e9;
    const cx0 = Math.floor((x - maxD) / CELL), cx1 = Math.floor((x + maxD) / CELL);
    const cz0 = Math.floor((z - maxD) / CELL), cz1 = Math.floor((z + maxD) / CELL);
    for (let cx = cx0; cx <= cx1; cx++) for (let cz = cz0; cz <= cz1; cz++) {
      const arr = this.grid.get(key(cx, cz));
      if (!arr) continue;
      for (let j = 0; j < arr.length; j += 2) {
        const e = this.edges[arr[j]], i = arr[j + 1] * 3, p = e.pts;
        const ax = p[i], az = p[i + 2], dx = p[i + 3] - ax, dz = p[i + 5] - az;
        const L2 = dx * dx + dz * dz || 1e-9;
        let t = ((x - ax) * dx + (z - az) * dz) / L2;
        // past either end of the whole edge? (then we are really on whatever comes next)
        const beyond = (t > 1 && arr[j + 1] === e.n - 2) || (t < 0 && arr[j + 1] === 0);
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const px = ax + dx * t, pz = az + dz * t;
        const d = Math.hypot(x - px, z - pz);
        if (d > maxD) continue;
        const L = Math.sqrt(L2), tx = dx / L, tz = dz / L;
        const lat = (x - px) * -tz + (z - pz) * tx;
        const sy = p[i + 1] + (p[i + 4] - p[i + 1]) * t;
        let outside = lat > e.paveR ? lat - e.paveR : lat < e.paveL ? e.paveL - lat : 0;
        if (beyond) outside = Math.max(outside, d - Math.max(e.paveR, -e.paveL));       // off the end of the road
        let cost = outside * 3 + d * 0.25;
        if (y !== null) { const dy = Math.abs(sy - y); if (dy > 2.5) cost += dy * 6; }
        if (heading !== null) {
          const al = Math.cos(heading - headingOf(tx, tz));
          if (e.oneway) cost += al < 0 ? 4 : 0; else cost += (1 - Math.abs(al)) * 2;
          if (!outside && !e.oneway) cost += (al > 0) === (lat > 0) ? 0 : 0.8;   // prefer the carriageway we are driving along
        }
        if (beyond) cost += 0.6; else if (e.id === prev) cost -= 1.2;
        if (prefer && prefer.has(e.id)) cost -= 0.9;            // roads on the planned route win ties at forks
        if (cost < bestCost) {
          bestCost = cost;
          best = best || {};
          best.e = e; best.s = e.cum[arr[j + 1]] + L * t; best.lat = lat; best.d = d;
          best.tx = tx; best.tz = tz; best.y = sy; best.on = outside === 0; best.outside = outside;
          best.rel = e.rel[arr[j + 1]] + (e.rel[arr[j + 1] + 1] - e.rel[arr[j + 1]]) * t;
        }
      }
    }
    return best;
  }

  /** Closest point of one edge to (x, z): { s, d }. */
  project(e, x, z) {
    let bs = 0, bd = 1e9;
    for (let i = 0; i < e.n - 1; i++) {
      const ax = e.pts[i * 3], az = e.pts[i * 3 + 2], dx = e.pts[i * 3 + 3] - ax, dz = e.pts[i * 3 + 5] - az;
      const L2 = dx * dx + dz * dz || 1e-9;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
      const d = Math.hypot(x - ax - dx * t, z - az - dz * t);
      if (d < bd) { bd = d; bs = e.cum[i] + Math.sqrt(L2) * t; }
    }
    return { s: bs, d: bd };
  }

  /** Lane index (0 = leftmost in travel direction) for a lateral offset; may be out of range when off the lanes. */
  laneAt(e, dir, lat) {
    if (dir > 0) return Math.floor((e.oneway ? lat - e.offL : lat) / e.lw);
    return Math.floor(-lat / e.lw);
  }

  // ── routing ──
  /**
   * Fastest legal route from the end of (startEdge, startDir) to node `goal`.
   * Searches over directed edges (not nodes) so that turn restrictions are honoured properly.
   * Returns [{e, dir}] starting with the start edge, or null.
   */
  route(startEdge, startDir, goal, opts = {}) {
    const { avoidMotorway = false } = opts;
    const S = this.edges.length * 2, id = (e, dir) => e.id * 2 + (dir > 0 ? 1 : 0);
    const dist = new Float64Array(S).fill(Infinity), prev = new Int32Array(S).fill(-1);
    const G = this.nodes[goal], heap = new Heap();
    const s0 = id(startEdge, startDir);
    dist[s0] = 0;
    heap.push(0, s0);
    let found = -1;
    while (heap.size) {
      const u = heap.pop(), e = this.edges[u >> 1], dir = u & 1 ? 1 : -1;
      const node = this.endNode(e, dir);
      if (node === goal) { found = u; break; }
      const du = dist[u], real = this.nodes[node].ends.length > 2;
      let outs = real ? this.legalExits(e, dir) : this.exits(node, e.id);
      if (!outs.length && !e.oneway) outs = [{ e, dir: -dir }];            // dead end: turn round
      for (const x of outs) {
        if (avoidMotorway && x.e.t <= T.TRUNK) continue;
        let w = x.e.len / (x.e.speed / 3.6) + 2;
        if (x.e.t >= T.LIVING) w *= 2.5;
        if (real && Math.abs(this.turnAngle(e, dir, x.e, x.dir)) > 0.6) w += 6;
        const v = id(x.e, x.dir);
        if (du + w < dist[v]) {
          dist[v] = du + w; prev[v] = u;
          const n2 = this.nodes[this.endNode(x.e, x.dir)];
          heap.push(du + w + Math.hypot(n2.x - G.x, n2.z - G.z) / 34, v);
        }
      }
    }
    if (found < 0) return null;
    const path = [];
    for (let u = found; u >= 0; u = prev[u]) path.push({ e: this.edges[u >> 1], dir: u & 1 ? 1 : -1 });
    return path.reverse();
  }

  // ── geo helpers ──
  toWorld(lat, lon) {
    return { x: (lon - this.origin[1]) * this.k[0], z: -(lat - this.origin[0]) * this.k[1] };
  }

  /** Nearest drivable spot to a lat/lon, as { e, dir, s } travelling in whichever direction is legal. */
  spot(lat, lon, opts = {}) {
    const { maxType = T.RESIDENTIAL, minType = T.PRIMARY, r = 250 } = opts;
    const w = this.toWorld(lat, lon);
    let best = null, bd = 1e9;
    this.forEdgesNear(w.x, w.z, r, (e) => {
      if (e.t > maxType || e.t < minType || e.tunnel || e.len < 50 || e.roundabout) return;
      if (this.nodes[e.a].ends.some((en) => this.edges[en.e].roundabout) && e.len < 90) return;
      if (this.nodes[e.a].ends.length < 2 || this.nodes[e.b].ends.length < 2) return;      // not down a cul-de-sac
      for (let i = 0; i < e.n; i++) {
        const d = Math.hypot(e.pts[i * 3] - w.x, e.pts[i * 3 + 2] - w.z);
        if (d < bd) { bd = d; best = { e, s: Math.min(Math.max(e.cum[i], 22), e.len - 22) }; }
      }
    });
    if (!best) return null;
    // never start on top of a zebra crossing
    for (const c of best.e.crossings) if (Math.abs(c.s - best.s) < 10) best.s = c.s > 34 ? c.s - 12 : Math.min(best.e.len - 10, c.s + 12);
    best.dir = 1;
    // the waypoint node is the nearer end of the road, unless that end is a cul-de-sac
    const near = best.s > best.e.len / 2 ? best.e.b : best.e.a, far = near === best.e.a ? best.e.b : best.e.a;
    best.node = this.nodes[near].ends.length > 1 || this.nodes[far].ends.length < 2 ? near : far;
    return best;
  }
}

export async function loadNet(url) {
  const [res, dem] = await Promise.all([fetch(url), fetch(new URL('dem.bin', url))]);
  if (!res.ok) throw new Error(`map data: HTTP ${res.status}`);
  return new Net(await res.json(), dem.ok ? new Uint16Array(await dem.arrayBuffer()) : null);
}

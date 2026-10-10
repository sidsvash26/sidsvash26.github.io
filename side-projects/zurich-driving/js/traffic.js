// Simulated traffic: signal controllers, cars / vans / trucks / buses on lanes,
// trams on their tracks and pedestrians at zebra crossings.
import * as THREE from '../lib/three.module.min.js';
import { C, T, headingOf, wrapAngle, turnBit } from './net.js';
import { CAR_COLORS, PED_COLORS } from './models.js';

const YELLOW = 3, ALL_RED = 3, RED_YELLOW = 1.2;
const LEVEL = { [C.EQUAL]: 1, [C.YIELD]: 0, [C.STOP]: 0, [C.SIGNAL]: 3, [C.PRIORITY]: 2, [C.NONE]: 2 };
const hash = (n) => { let h = (n * 2654435761) >>> 0; h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; return (h >>> 8) / 16777216; };

/** Does a driver on approach A (control, heading, turn) have to give way to approach W? */
export function mustYield(ctlA, hA, turnA, W) {
  const la = LEVEL[ctlA], lw = LEVEL[W.ctl];
  if (la !== lw) return la < lw;
  const d = wrapAngle(W.h - hA);
  if (Math.cos(d) < -0.6) return turnA === -1 && W.turn !== -1;    // oncoming: the left-turner waits
  if (la >= 2) return false;
  return Math.sin(d) < -0.5;                                        // right-before-left: W comes from my right
}

export class Signals {
  constructor(net) {
    this.net = net;
    this.app = new Map();     // approach key → { c, group } | null (always green)
    this.ctl = new Map();
    // signalised junctions joined by a short stretch of road (possibly through plain nodes) act as one
    const root = new Map();
    const find = (i) => { while (root.has(i) && root.get(i) !== i) i = root.get(i); return i; };
    const internal = new Set();
    const approaches = [];
    for (const e of net.edges) {
      for (const dir of [1, -1]) {
        if ((dir < 0 && e.oneway) || net.control(e, dir) !== C.SIGNAL) continue;
        const sig = net.nodes[net.endNode(e, dir)].sig;
        if (sig < 0) continue;
        const key = e.id * 2 + (dir > 0 ? 1 : 0), back = net.chainBack(e, dir), from = net.nodes[back.node].sig;
        if (from >= 0 && e.len + back.extra < 45) { internal.add(key); if (find(from) !== find(sig)) root.set(find(from), find(sig)); }
        approaches.push({ key, sig, h: net.heading(e, dir, true), t: e.t });
      }
    }
    this._find = find;
    for (const a of approaches) {
      if (internal.has(a.key)) { this.app.set(a.key, null); continue; }
      const id = find(a.sig);
      let c = this.ctl.get(id);
      if (!c) this.ctl.set(id, (c = { id, list: [] }));
      c.list.push(a);
    }
    for (const c of this.ctl.values()) {
      c.list.sort((a, b) => a.t - b.t);
      c.axis = c.list[0].h;
      let n1 = 0;
      for (const a of c.list) {
        const group = Math.abs(Math.cos(a.h - c.axis)) > 0.6 ? 0 : 1;
        n1 += group;
        this.app.set(a.key, { c, group });
      }
      c.g0 = c.list[0].t <= T.SECONDARY ? 24 : 18;
      c.g1 = n1 ? 16 : 9;
      c.cycle = c.g0 + c.g1 + 2 * (YELLOW + ALL_RED);
      c.off = hash(c.id + 17) * c.cycle;
    }
    for (const c of net.crossings) {
      if (!c.sig) continue;
      const e = net.edges[c.e];
      if (e.cb === C.SIGNAL && e.len - c.s < 45) c.follow = 1;
      else if (e.ca === C.SIGNAL && !e.oneway && c.s < 45) c.follow = -1;
      else c.own = true;
    }
  }

  _phase(c, group, t) {
    const start = group === 0 ? 0 : c.g0 + YELLOW + ALL_RED, green = group === 0 ? c.g0 : c.g1;
    const r = (((t + c.off - start) % c.cycle) + c.cycle) % c.cycle;
    if (r < green) return 'G';
    if (r < green + YELLOW) return 'Y';
    return r > c.cycle - RED_YELLOW ? 'RY' : 'R';
  }

  /** Light shown to traffic on (e, dir) arriving at its end node. */
  state(e, dir, t) {
    const a = this.app.get(e.id * 2 + (dir > 0 ? 1 : 0));
    return a ? this._phase(a.c, a.group, t) : 'G';
  }

  /** Light for something (a tram) crossing signal cluster `sig` on heading h. */
  forHeading(sig, h, t) {
    const c = this.ctl.get(this._find(sig));
    return c ? this._phase(c, Math.abs(Math.cos(h - c.axis)) > 0.6 ? 0 : 1, t) : 'G';
  }

  /** Light shown to vehicles at a stand-alone pedestrian signal. */
  crossing(c, t) {
    const u = (t + hash(c.id) * 40) % 40;
    if (u < 27) return 'G';
    if (u < 30) return 'Y';
    return u > 40 - RED_YELLOW ? 'RY' : 'R';
  }

  /** May pedestrians start walking at this signalised crossing? */
  walk(c, t) {
    if (c.own) { const u = (t + hash(c.id) * 40) % 40; return u > 31 && u < 36; }
    return this.state(this.net.edges[c.e], c.follow, t) === 'R' && this.state(this.net.edges[c.e], c.follow, t + 5) === 'R';
  }
}

const KINDS = [
  { name: 'tesla', len: 4.68, wid: 1.85, aMax: 1.9, vmax: 50, car: true },
  { name: 'van', len: 5.2, wid: 2.0, aMax: 1.6, vmax: 36, w: 0.08 },
  { name: 'truck', len: 8.3, wid: 2.45, aMax: 1.0, vmax: 23, w: 0.06 },
  { name: 'bus', len: 12.0, wid: 2.55, aMax: 1.1, vmax: 17, w: 0.06 },
];
for (const [name, len, wid] of [['bmw', 4.7, 1.84], ['golf', 4.28, 1.79], ['rav', 4.6, 1.86], ['cinq', 3.6, 1.69]]) KINDS.push({ name, len, wid, aMax: 1.8, vmax: 50, car: true });
const CARS = KINDS.filter((k) => k.car);
const SPAWN_W = [1, 1, 1, 0.9, 0.7, 0.45, 0.28, 0.1, 0.06];
const NEXT_W = [8, 8, 6, 5, 4, 2.5, 1.5, 0.35, 0.25];
const CELL = 8;
const ckey = (cx, cz) => (cx + 8192) * 16384 + (cz + 8192);
const lkey = (e, dir, lane) => e.id * 16 + (dir > 0 ? 8 : 0) + lane;

function idm(v, v0, gap, dv, aMax) {
  const sStar = 2.0 + Math.max(0, v * 1.3 + (v * dv) / (2 * Math.sqrt(aMax * 2.2)));
  return aMax * (1 - (v / Math.max(v0, 0.1)) ** 4 - (sStar / Math.max(gap, 0.1)) ** 2);
}

export class Traffic {
  constructor(scene, net, geo, signals) {
    this.net = net;
    this.signals = signals;
    this.vehicles = [];
    this.trams = [];
    this.peds = [];
    this.events = [];
    this.target = { vehicles: 46, trams: 5, peds: 12 };
    this.lanes = new Map();
    this.approach = new Map();
    this.inJunction = new Map();
    this.obst = new Map();
    this.nextId = 1;
    this.spawnT = 0; this.pedT = 0; this.tramT = 0;
    this.P = { isPlayer: true, x: 0, z: 0, h: 0, v: 0, len: 4.35, wid: 1.8, s: 0, road: null };
    this.playerIn = null;
    this.time = 0;
    this._tmp = {}; this._tmp2 = {};

    // instanced meshes
    const L = THREE.MeshLambertMaterial;
    this.geo = geo;
    const paint = new THREE.MeshPhongMaterial({ shininess: 60, specular: '#3d3d3d' }), detail = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 50, specular: '#1c1c1c' });
    const inst = (g, m, n) => { const im = new THREE.InstancedMesh(g, m, n); im.count = 0; im.frustumCulled = false; im.castShadow = true; scene.add(im); return im; };
    this.mesh = {};
    for (const k of KINDS) this.mesh[k.name] = { body: inst(geo[k.name].body, paint, 80), detail: inst(geo[k.name].detail, detail, 80) };
    this.mesh.tram = inst(geo.tram.detail, detail, 40);
    this.mesh.ped = { body: inst(geo.ped.body, paint, 48), head: inst(geo.ped.head, detail, 48), leg: inst(geo.ped.leg, detail, 96) };
    this.mesh.lights = inst(new THREE.BoxGeometry(0.3, 0.13, 0.06), new THREE.MeshBasicMaterial(), 400);
    this.mesh.lights.castShadow = false;
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler(0, 0, 0, 'YXZ');
    this._p = new THREE.Vector3(); this._s = new THREE.Vector3(1, 1, 1);
    this._red = new THREE.Color('#ff2414'); this._amber = new THREE.Color('#ffae1a');
  }

  setDensity(level) {
    this.target = [{ vehicles: 0, trams: 0, peds: 0 }, { vehicles: 24, trams: 3, peds: 7 }, { vehicles: 46, trams: 5, peds: 12 }, { vehicles: 72, trams: 6, peds: 16 }][level];
  }

  reset() {
    this.vehicles.length = 0; this.trams.length = 0;
    for (const p of this.peds) this._leave(p);
    this.peds.length = 0; this.events.length = 0; this.playerIn = null;
    this._fresh = true;
  }

  // ───────────────────────── frame update ─────────────────────────
  update(dt, player, time) {
    this.time = time;
    const P = this.P;
    P.x = player.x; P.z = player.z; P.h = player.h; P.v = player.v; P.road = player.road; P.blink = player.blink;
    this._knock();
    this._index();
    for (const V of this.vehicles) this._drive(V, dt);
    for (const tr of this.trams) this._tram(tr, dt);
    for (const p of this.peds) this._ped(p, dt);
    this._population(dt, player);
    this._draw(player);
  }

  _addObst(x, z, r, vx, vz, owner) {
    const o = { x, z, r, vx, vz, owner };
    const k = ckey(Math.floor(x / CELL), Math.floor(z / CELL));
    const a = this.obst.get(k);
    if (a) a.push(o); else this.obst.set(k, [o]);
  }

  _index() {
    const net = this.net, P = this.P;
    this.lanes.clear(); this.approach.clear(); this.inJunction.clear(); this.obst.clear();
    const lanePush = (k, v) => { const a = this.lanes.get(k); if (a) a.push(v); else this.lanes.set(k, [v]); };
    const appPush = (n, w) => { const a = this.approach.get(n); if (a) a.push(w); else this.approach.set(n, [w]); };
    for (const V of this.vehicles) {
      const sx = Math.sin(V.h), sz = -Math.cos(V.h), vx = sx * V.v, vz = sz * V.v, r = V.K.wid / 2 + 0.05;
      const span = V.K.len / 2 - r, nC = Math.ceil((2 * span) / 1.7) + 1;
      for (let i = 0; i < nC; i++) { const o = -span + (2 * span * i) / (nC - 1); this._addObst(V.x + sx * o, V.z + sz * o, r, vx, vz, V); }
      if (V.junc) {
        const a = this.inJunction.get(V.junc.node);
        if (a) a.push(V); else this.inJunction.set(V.junc.node, [V]);
        continue;
      }
      lanePush(lkey(V.e, V.dir, V.lane), V);
      const ch = net.chain(V.e, V.dir), node = ch.node;
      if (net.nodes[node].ends.length >= 3) {
        const dist = V.e.len + ch.extra - net.stopDist(ch.e, ch.dir) - (V.s + V.K.len / 2);
        if (dist < 70) appPush(node, { veh: V, e: ch.e, dir: ch.dir, dist, v: V.v, h: ch.e === V.e ? V.hEnd : net.heading(ch.e, ch.dir, true), turn: V.next && ch.e === V.e ? V.next.turn : 0, ctl: net.control(ch.e, ch.dir) });
      }
      // short links (roundabout segments, split junctions): also announce the vehicle at the junction after next
      const nx = V.next;
      if (nx && nx.real && nx.e.len < 60) {
        const node2 = net.endNode(nx.e, nx.dir);
        if (net.nodes[node2].ends.length >= 3) {
          const dist2 = V.e.len - V.s + nx.e.len - net.stopDist(nx.e, nx.dir) - V.K.len / 2;
          if (dist2 < 70) appPush(node2, { veh: V, e: nx.e, dir: nx.dir, dist: dist2, v: V.v, h: net.heading(nx.e, nx.dir, true), turn: 0, ctl: net.control(nx.e, nx.dir), far: true });
        }
      }
    }
    // the player takes part as a pseudo-vehicle
    const sx = Math.sin(P.h), sz = -Math.cos(P.h);
    this._addObst(P.x + sx * 1.1, P.z + sz * 1.1, 0.95, sx * P.v, sz * P.v, P);
    this._addObst(P.x - sx * 1.1, P.z - sz * 1.1, 0.95, sx * P.v, sz * P.v, P);
    this.playerApproach = null;
    const r = P.road;
    if (r && r.outside < 1.5) {
      P.s = r.s; P.K = P; P.vAlong = Math.max(0, P.v);
      if (r.lane >= 0 && r.lane < r.nLanes) lanePush(lkey(r.e, r.dir, r.lane), P);
      const frac = r.laneF - Math.floor(r.laneF);
      if (frac < 0.22 && r.lane - 1 >= 0 && r.lane - 1 < r.nLanes) lanePush(lkey(r.e, r.dir, r.lane - 1), P);
      if (frac > 0.78 && r.lane + 1 < r.nLanes && r.lane + 1 >= 0) lanePush(lkey(r.e, r.dir, r.lane + 1), P);
      const ch = net.chain(r.e, r.dir), node = ch.node;
      if (net.nodes[node].ends.length >= 3 && !r.wrongWay) {
        const dist = r.e.len + ch.extra - net.stopDist(ch.e, ch.dir) - (r.s + P.len / 2);
        const w = { veh: P, isPlayer: true, e: ch.e, dir: ch.dir, dist, v: Math.max(0, P.v), h: net.heading(ch.e, ch.dir, true), turn: P.blink, ctl: net.control(ch.e, ch.dir), node };
        if (dist < 70) appPush(node, w);
        this.playerApproach = w;
        if (dist < 0) this.playerIn = { node, e: w.e, dir: w.dir, ctl: w.ctl, h: w.h, turn: w.turn };
      }
    }
    if (this.playerIn) { const nd = net.nodes[this.playerIn.node]; if (Math.hypot(nd.x - P.x, nd.z - P.z) > nd.r + 9) this.playerIn = null; }
    for (const tr of this.trams) {
      for (const sg of tr.segs) {
        const tx = Math.sin(sg.h), tz = -Math.cos(sg.h);
        for (const o of [-3, 0, 3]) this._addObst(sg.x + tx * o, sg.z + tz * o, 1.25, tx * tr.v, tz * tr.v, tr);
      }
    }
    for (const p of this.peds) if (p.phase !== 'down' && p.phase !== 'wait') this._addObst(p.x, p.z, p.phase === 'cross' ? 0.55 : 0.4, 0, 0, p);   // anyone on the move is something to avoid
  }

  /** Nearest obstacle touching a disc at (x, z); `skip` filters owners. */
  _hit(x, z, rad, self, skipAI) {
    const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
    let best = null, bd = 1e9;
    for (let i = cx - 1; i <= cx + 1; i++) for (let j = cz - 1; j <= cz + 1; j++) {
      const a = this.obst.get(ckey(i, j));
      if (!a) continue;
      for (const o of a) {
        if (o.owner === self) continue;
        if (skipAI && !o.owner.isPlayer && !o.owner.isPed) continue;
        const d = Math.hypot(o.x - x, o.z - z) - o.r - rad;
        if (d < 0 && d < bd) { bd = d; best = o; }
      }
    }
    return best;
  }

  // ───────────────────────── road vehicles ─────────────────────────
  _spawnVehicle(player, initial) {
    const net = this.net;
    const ang = initial ? Math.random() * Math.PI * 2 : player.h + (Math.random() < 0.72 ? (Math.random() - 0.5) * 2.2 : Math.PI + (Math.random() - 0.5) * 1.6);
    const sp = Math.abs(player.v);
    const rad = initial ? 50 + Math.random() * 330 : 170 + Math.random() * (190 + sp * 5);
    const x = player.x + Math.sin(ang) * rad, z = player.z - Math.cos(ang) * rad;
    const m = net.locate(x, z, {}, 70);
    if (!m || m.e.len < 22 || Math.random() > SPAWN_W[m.e.t]) return false;
    const e = m.e;
    const dir = e.oneway || Math.random() < 0.5 ? 1 : -1;
    const anyCar = () => CARS[Math.floor(Math.random() * CARS.length)];
    let kind = anyCar();
    const r = Math.random();
    if (r > 0.8) kind = r > 0.94 ? KINDS[3] : r > 0.88 ? KINDS[2] : KINDS[1];
    if (kind.name === 'bus' && (e.t > T.TERTIARY || e.t < T.PRIMARY)) kind = anyCar();
    if (kind.name === 'truck' && e.t > T.UNCLASSIFIED) kind = anyCar();
    const lane = Math.floor(Math.random() * net.lanes(e, dir));
    const s = Math.min(Math.max(dir > 0 ? m.s : e.len - m.s, net.trimStart(e, dir) + 3), e.len - net.trimEnd(e, dir) - 3);
    const p = net.lanePoint(e, dir, lane, s, this._tmp);
    if (Math.hypot(p.x - player.x, p.z - player.z) < (initial ? 75 : 150)) return false;
    if (this._hit(p.x, p.z, kind.len / 2 + 6, null, false)) return false;
    const V = {
      id: this.nextId++, K: kind, color: kind.name === 'bus' ? CAR_COLORS[3] : CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)],
      e, dir, lane, s, v: (e.speed / 3.6) * 0.7, acc: 0, shift: 0, next: null, junc: null, curve: null,
      x: p.x, y: p.y, z: p.z, h: headingOf(p.tx, p.tz), pitch: 0, hEnd: net.heading(e, dir, true),
      brake: false, blink: 0, wait: 0, stuck: 0, ghost: 0, force: 0, idle: 0, ox: 0, oz: 0, ovx: 0, ovz: 0, ow: 0, stopDone: false, stopT: 0, pT: 0, age: 0,
      vf: 0.9 + Math.random() * 0.14, len: kind.len,
    };
    V.v = Math.min(V.v, kind.vmax);
    this._plan(V);
    this.vehicles.push(V);
    // keep the obstacle index current so the next spawn does not overlap this one
    this._addObst(V.x, V.z, kind.len / 2, 0, 0, V);
    return true;
  }

  _plan(V) {
    const net = this.net, node = net.endNode(V.e, V.dir);
    const exits = net.legalExits(V.e, V.dir);
    V.next = null; V.curve = null; V.want = null;
    if (!exits.length) return;
    let pick = exits[0];
    if (exits.length > 1) {
      let tot = 0;
      const ws = exits.map((x) => {
        const ang = Math.abs(net.turnAngle(V.e, V.dir, x.e, x.dir));
        let w = NEXT_W[x.e.t] * (ang < 0.45 ? 2.6 : ang > 2.5 ? 0.02 : 1);
        if (V.K.len > 6 && x.e.t >= T.RESIDENTIAL) w *= 0.1;
        if (V.e.roundabout && !x.e.roundabout) w *= 1.4;
        tot += w;
        return w;
      });
      let r = Math.random() * tot;
      for (let i = 0; i < exits.length; i++) { r -= ws[i]; if (r <= 0) { pick = exits[i]; break; } }
    }
    const angle = net.turnAngle(V.e, V.dir, pick.e, pick.dir);
    const turn = angle > 0.6 ? 1 : angle < -0.6 ? -1 : 0;
    const n = net.lanes(V.e, V.dir), nl = net.lanes(pick.e, pick.dir);
    const real = net.nodes[node].ends.length >= 3;
    const a = Math.abs(angle);
    let turnV = a < 0.3 ? 99 : a < 0.8 ? 9.5 : 5.5;
    if (pick.e.roundabout || V.e.roundabout) turnV = Math.min(turnV, 7);
    V.next = { e: pick.e, dir: pick.dir, lane: 0, turn, angle, turnV, real };
    // which lane must we be in before the junction?
    if (n > 1) {
      const masks = real ? net.turnsAt(V.e, V.dir) : null;
      if (masks) {
        let best = -1, bd = 99;
        for (let i = 0; i < n; i++) if ((masks[i] === 0 || masks[i] & turnBit(turn)) && Math.abs(i - V.lane) < bd) { bd = Math.abs(i - V.lane); best = i; }
        if (best >= 0 && best !== V.lane) V.want = best;
      } else if (real && turn !== 0) V.want = turn > 0 ? n - 1 : 0;
      else if (n > nl && V.lane < n - nl) V.want = n - nl;        // road narrows: the left lanes end
      if (V.want === V.lane) V.want = null;
    }
    this._nextLane(V);
  }

  /** Lane we will arrive in on the next edge, given the lane we expect to leave from. */
  _nextLane(V) {
    const net = this.net, nx = V.next;
    if (!nx) return;
    const n = net.lanes(V.e, V.dir), nl = net.lanes(nx.e, nx.dir), from = V.want !== null && V.want !== undefined ? V.want : V.lane;
    let lane;
    if (V.e.merge) lane = V.e.merge > 0 ? nl - 1 : 0;                                  // slip road joins the outer lane
    else if (V.e.mergeMain && nl >= n) lane = V.e.mergeMain > 0 ? from : from + nl - n;   // main road keeps its lanes; the new one appears outside
    else if (nx.real && nx.turn > 0) lane = nl - 1;
    else if (nx.real && nx.turn < 0) lane = 0;
    else {
      const masks = nx.real ? net.turnsAt(V.e, V.dir) : null;
      const through = [];
      if (masks) for (let i = 0; i < n; i++) if (masks[i] === 0 || masks[i] & 2) through.push(i);
      const k = through.indexOf(from);
      if (k >= 0) lane = through.length > 1 ? Math.round((k * (nl - 1)) / (through.length - 1)) : nl - 1;
      else lane = from - (n - nl);                                  // keep right-aligned
    }
    nx.lane = Math.max(0, Math.min(nl - 1, lane));
  }

  _curve(V) {
    if (V.curve) return V.curve;
    const net = this.net, nx = V.next;
    const a = net.lanePoint(V.e, V.dir, V.lane, V.e.len - net.trimEnd(V.e, V.dir), this._tmp);
    const x0 = a.x, z0 = a.z, y0 = a.y, t0x = a.tx, t0z = a.tz;
    const b = net.lanePoint(nx.e, nx.dir, nx.lane, net.trimStart(nx.e, nx.dir), this._tmp);
    const x2 = b.x, z2 = b.z, y2 = b.y, t2x = b.tx, t2z = b.tz;
    const chord = Math.hypot(x2 - x0, z2 - z0);
    let x1 = (x0 + x2) / 2, z1 = (z0 + z2) / 2;
    const cr = t0x * t2z - t0z * t2x;
    if (Math.abs(cr) > 0.15) {
      const u = ((x2 - x0) * t2z - (z2 - z0) * t2x) / cr, w = ((x2 - x0) * t0z - (z2 - z0) * t0x) / cr;
      if (u > 0 && w > 0 && u < chord * 2 && w < chord * 2) { x1 = x0 + t0x * u; z1 = z0 + t0z * u; }
    }
    let len = 0, px = x0, pz = z0;
    for (let i = 1; i <= 8; i++) {
      const t = i / 8, m = 1 - t;
      const x = m * m * x0 + 2 * m * t * x1 + t * t * x2, z = m * m * z0 + 2 * m * t * z1 + t * t * z2;
      len += Math.hypot(x - px, z - pz); px = x; pz = z;
    }
    return (V.curve = { x0, z0, x1, z1, x2, z2, y0, y2, len, node: net.endNode(V.e, V.dir), d: 0 });
  }

  _curvePoint(c, d, out) {
    const t = Math.max(0, Math.min(1, d / Math.max(c.len, 1e-3))), m = 1 - t;
    out.x = m * m * c.x0 + 2 * m * t * c.x1 + t * t * c.x2;
    out.z = m * m * c.z0 + 2 * m * t * c.z1 + t * t * c.z2;
    out.y = c.y0 + (c.y2 - c.y0) * t;
    let tx = 2 * m * (c.x1 - c.x0) + 2 * t * (c.x2 - c.x1), tz = 2 * m * (c.z1 - c.z0) + 2 * t * (c.z2 - c.z1);
    const l = Math.hypot(tx, tz) || 1;
    out.tx = tx / l; out.tz = tz / l; out.slope = 0;
    return out;
  }

  /** Point on the vehicle's future path, `dist` metres ahead of its centre. */
  _ahead(V, dist, out) {
    const net = this.net;
    if (V.junc) {
      const d = V.junc.d + dist;
      if (d <= V.junc.len) return this._curvePoint(V.junc, d, out);
      return net.lanePoint(V.next.e, V.next.dir, V.next.lane, net.trimStart(V.next.e, V.next.dir) + d - V.junc.len, out);
    }
    const lim = V.e.len - net.trimEnd(V.e, V.dir), s = V.s + dist;
    if (s <= lim || !V.next) return net.lanePoint(V.e, V.dir, V.lane, Math.min(s, V.e.len), out, V.shift);
    const c = this._curve(V), over = s - lim;
    if (over <= c.len) return this._curvePoint(c, over, out);
    return net.lanePoint(V.next.e, V.next.dir, V.next.lane, net.trimStart(V.next.e, V.next.dir) + over - c.len, out);
  }

  _leader(V) {
    const net = this.net, half = V.K.len / 2;
    let gap = 1e9, lv = 0, who = null;
    if (!V.junc) {
      const list = this.lanes.get(lkey(V.e, V.dir, V.lane));
      if (list) for (const W of list) {
        if (W === V || W.s <= V.s) continue;
        const g = W.s - V.s - half - W.len / 2;
        if (g < gap) { gap = g; lv = W.isPlayer ? W.vAlong : W.v; who = W; }
      }
    }
    if (!V.junc && V.next && V.e.len - V.s < 55) {
      const n = net.lanes(V.e, V.dir);
      if (n > 1 && net.lanes(V.next.e, V.next.dir) < n) {
        for (let l = 0; l < n; l++) {
          if (l === V.lane) continue;
          const list = this.lanes.get(lkey(V.e, V.dir, l));
          if (list) for (const W of list) {
            if (W === V || W.s <= V.s + 0.5) continue;
            const g = Math.max(0.5, W.s - V.s - half - W.len / 2);
            if (g < gap) { gap = g; lv = W.isPlayer ? W.vAlong : W.v; who = W; }
          }
        }
      }
    }
    if (gap > 80 && V.next) {
      const rest = V.junc ? V.junc.len - V.junc.d : V.e.len - V.s;
      const list = this.lanes.get(lkey(V.next.e, V.next.dir, V.next.lane));
      if (list) for (const W of list) {
        const g = rest + W.s - half - W.len / 2;
        if (g < gap) { gap = g; lv = W.isPlayer ? W.vAlong : W.v; who = W; }
      }
    }
    return who ? { gap, v: lv, who } : null;
  }

  _exitBlocked(V) {
    const nx = V.next, list = this.lanes.get(lkey(nx.e, nx.dir, nx.lane));
    if (!list) return false;
    const need = this.net.trimStart(nx.e, nx.dir) + V.K.len + 2.5;
    for (const W of list) if (W.s - W.len / 2 < need && (W.isPlayer ? W.vAlong : W.v) < 1.2) return true;
    return false;
  }

  _crossingBlocked(c, t) {
    if (c.own) { const st = this.signals.crossing(c, t); if (st === 'R' || st === 'RY' || st === 'Y') return true; }
    if (c.pedList) for (const p of c.pedList) if (p.phase === 'cross' || (p.phase === 'wait' && !c.sig && t - p.waitStart > 0.3)) return true;
    return false;
  }

  /** Should V stop at the line of the junction ahead? `ch` is the approach (final edge of the chain). */
  _hold(V, ch, dStop, dt) {
    const net = this.net, ctl = net.control(ch.e, ch.dir), t = this.time, last = ch.e === V.e;
    if (dStop < -0.6 || ctl === C.NONE) return null;
    if (ctl === C.SIGNAL) {
      const st = this.signals.state(ch.e, ch.dir, t);
      if (st === 'R' || st === 'RY') return 'signal';
      if (st === 'Y' && (V.v * V.v) / 6.4 < dStop) return 'signal';
    }
    if (ctl === C.STOP && !V.stopDone) {
      if (V.v < 0.25 && dStop < 2.5) { V.stopT += dt; if (V.stopT > 0.9) V.stopDone = true; }
      if (!V.stopDone) return 'stop';
    }
    if (dStop > 38 || !V.next || V.force > 0) return null;
    if (last && dStop < 22 && this._exitBlocked(V)) return 'blocked';
    if (V.ghost > 0) return null;
    const hEnd = last ? V.hEnd : net.heading(ch.e, ch.dir, true), turn = last ? V.next.turn : 0;
    if (dStop < 14) {
      const pin = this.playerIn;
      if (pin && pin.node === ch.node && Math.abs(this.P.v) > 0.6 && !(pin.e === ch.e && pin.dir === ch.dir) && mustYield(ctl, hEnd, turn, pin)) return 'yield';
      const inside = this.inJunction.get(ch.node);
      if (inside) for (const W of inside) if (W !== V && W.entry && W.junc && W.junc.d < W.junc.len * 0.7 && !(W.entry.e === ch.e && W.entry.dir === ch.dir) && mustYield(ctl, hEnd, turn, W.entry)) return 'yield';
    }
    const list = this.approach.get(ch.node);
    if (!list) return null;
    const myEta = dStop / Math.max(V.v, 2.5);
    for (const W of list) {
      if (W.veh === V || (W.e === ch.e && W.dir === ch.dir)) continue;
      if (W.dist < -7 || (W.far && W.v < 1) || !mustYield(ctl, hEnd, turn, W)) continue;
      const eta = W.dist / Math.max(W.v, 1.5);
      if (eta < myEta + 4 && W.dist < 14 + W.v * 4.5) return 'yield';
    }
    return null;
  }

  _drive(V, dt) {
    const net = this.net, K = V.K, t = this.time;
    V.age += dt;
    if (V.halt > 0) {            // just been hit: no longer driving, just sliding to a stop where the blow sent it
      V.halt -= dt; V.v = 0; V.brake = true;
      if (V.ovx || V.ovz || V.ow) {
        const k = Math.max(0, 1 - dt * 3.2);
        V.x += V.ovx * dt; V.z += V.ovz * dt; V.ox += V.ovx * dt; V.oz += V.ovz * dt;
        V.h = wrapAngle(V.h + V.ow * dt);
        V.ovx *= k; V.ovz *= k; V.ow *= k;
      }
      return;
    }
    V.ghost = Math.max(0, V.ghost - dt);
    let v0 = Math.min((V.e.speed / 3.6) * V.vf, K.vmax);
    let acc = 1e9, byPlayer = false, reason = null;
    const consider = (gap, lv, who, why) => {
      const a = idm(V.v, v0, gap, V.v - lv, K.aMax);
      if (a < acc) { acc = a; byPlayer = !!(who && who.isPlayer); reason = why; }
    };

    if (!V.junc) {
      if (!V.next && net.exits(net.endNode(V.e, V.dir), V.e.id).length) this._plan(V);
      const front = V.s + K.len / 2;
      const ch = net.chain(V.e, V.dir);
      const dStop = V.e.len + ch.extra - net.stopDist(ch.e, ch.dir) - front;
      const dEnd = V.e.len - net.trimEnd(V.e, V.dir) - V.s;
      if (V.next) {
        if (V.next.turnV < 90) v0 = Math.min(v0, Math.sqrt(V.next.turnV ** 2 + 2 * 1.5 * Math.max(0, dEnd - 2)));
        if (net.nodes[ch.node].ends.length >= 3) {
          if (net.control(ch.e, ch.dir) === C.EQUAL) v0 = Math.min(v0, Math.sqrt(7.5 ** 2 + 2 * 1.5 * Math.max(0, dStop - 2)));
          const why = this._hold(V, ch, dStop, dt);
          if (why) { consider(Math.max(0.05, dStop - 0.4) + 2.0, 0, null, why); if (why === 'yield') V.wait += dt; }
          else V.wait = 0;
          if (V.wait > 8 + (V.id % 5)) { V.ghost = 4; V.wait = 0; }
        }
        V.blink = V.next.real && dStop < 45 ? V.next.turn : 0;
        if (V.next.real && V.e.roundabout) V.blink = V.next.e.roundabout ? 0 : 1;
      } else consider(Math.max(0.05, V.e.len - front - 1) + 2.0, 0, null, 'end');
      for (const c of V.e.crossings) {
        const d = (V.dir > 0 ? c.s : V.e.len - c.s) - 3.2 - front;
        if (d > -1.5 && d < 55 && (V.v * V.v) / (2 * Math.max(d, 0.5)) < 5 && this._crossingBlocked(c, t)) consider(Math.max(0.05, d) + 2.0, 0, null, 'zebra');
      }
      if (V.next) for (const c of V.next.e.crossings) {
        const sC = V.next.dir > 0 ? c.s : V.next.e.len - c.s;
        if (sC > 40) continue;
        const d = V.e.len - V.s + sC - 3.2 - K.len / 2;
        if (d > 0.5 && d < 55 && (V.v * V.v) / (2 * d) < 5 && this._crossingBlocked(c, t)) consider(d + 2.0, 0, null, 'zebra');
      }
      // change lane for the coming turn, or to pass / keep right on multi-lane roads
      const n = net.lanes(V.e, V.dir);
      if (n > 1 && Math.abs(V.shift) < 0.05 && V.age > 1.5) {
        let to = null;
        if (V.want !== null && V.want !== undefined && V.want !== V.lane && dEnd < 180) to = V.lane + Math.sign(V.want - V.lane);
        else if ((V.want === null || V.want === undefined) && V.e.t <= T.TRUNK) {
          const L = this._leader(V);
          if (L && L.gap < 30 && L.v < v0 * 0.82 && V.lane > 0) to = V.lane - 1;
          else if (V.lane < n - 1 && (!L || L.gap > 60) && V.id % 3) to = V.lane + 1;
        }
        if (to !== null && to >= 0 && to < n && this._laneFree(V, to)) {
          V.shift = (V.lane - to) * V.e.lw;
          V.blink = to > V.lane ? 1 : -1;
          V.lane = to; V.curve = null;
          if (V.want === to) V.want = null;
          this._nextLane(V);
        }
      }
    }
    else for (const c of V.next.e.crossings) {
      const sC = V.next.dir > 0 ? c.s : V.next.e.len - c.s;
      const d = V.junc.len - V.junc.d + sC - net.trimStart(V.next.e, V.next.dir) - 3.2 - K.len / 2;
      if (sC < 40 && d > 0.5 && (V.v * V.v) / (2 * d) < 5 && this._crossingBlocked(c, t)) consider(d + 2.0, 0, null, 'zebra');
    }
    const L = this._leader(V);
    if (L) consider(L.gap, L.v, L.who, 'lead');

    // probe the path ahead for anything the lane bookkeeping does not know about
    const reach = Math.max(6, V.v * 2.0 + 4), hx = Math.sin(V.h), hz = -Math.cos(V.h);
    for (const d of [1.2, 4, 7.5, 11.5, 16, 22]) {
      if (d > reach) break;
      const p = this._ahead(V, K.len / 2 + d, this._tmp2);
      const o = this._hit(p.x, p.z, K.wid / 2 + 0.2, V, V.ghost > 0);
      if (!o || (V.ghostAll && !o.owner.isPed)) continue;
      const along = o.vx * hx + o.vz * hz;
      if (along < -2 && !o.owner.isPed) continue;                 // oncoming traffic in the next lane
      consider(Math.max(0.05, d - 0.6), Math.max(0, along), o.owner, 'probe');
      break;
    }
    if (acc > 1e8) acc = idm(V.v, v0, 1e6, 0, K.aMax);
    acc = Math.max(-7.5, acc);

    V.pT = byPlayer ? V.pT + dt : 0;
    if (byPlayer && acc < -4.2 && V.v > 5 && V.pT < 1.6 && !V.flagged) { V.flagged = 3; this.events.push({ type: 'cutoff', kind: K.name, veh: V }); }
    if (V.flagged) V.flagged = Math.max(0, V.flagged - dt);
    if (V.v < 0.3 && reason === 'probe') { V.stuck += dt; if (V.stuck > 12) { V.ghost = 3.5; V.stuck = 0; } } else if (V.v > 1) V.stuck = 0;
    V.standoff = byPlayer && V.v < 0.3 && Math.abs(this.P.v) < 0.4 && reason === 'probe' ? (V.standoff || 0) + dt : 0;
    if (V.standoff > 14) { V.ghostAll = 5; V.standoff = 0; }
    if (V.ghostAll) V.ghostAll = Math.max(0, V.ghostAll - dt);
    if (V.v < 0.3) V.idle = (V.idle || 0) + dt; else V.idle = 0;
    // nobody waits for ever: after a long wait (other than at a red light) a driver edges through
    if (V.idle > 28 && reason !== 'signal' && reason !== 'stop' && !byPlayer) { V.ghost = Math.max(V.ghost, 4); V.force = 4; }
    if (V.force) V.force = Math.max(0, V.force - dt);

    V.v = Math.max(0, V.v + acc * dt);
    V.acc = acc; V.why = reason;
    V.brake = acc < -0.9 || V.v < 0.25;
    if (V.shift) { const st = Math.min(Math.abs(V.shift), dt * 1.3); V.shift -= Math.sign(V.shift) * st; }

    // ── advance ──
    const ds = V.v * dt, p = this._tmp;
    if (V.junc) {
      V.junc.d += ds;
      if (V.junc.d >= V.junc.len) this._enter(V, V.junc.d - V.junc.len);
    } else {
      V.s += ds;
      const lim = V.e.len - net.trimEnd(V.e, V.dir);
      if (V.s >= lim) {
        if (!V.next) { V.dead = true; return; }
        const c = this._curve(V);
        if (c.len < 0.4) this._enter(V, V.s - lim);
        else { V.junc = c; c.d = V.s - lim; V.entry = { e: V.e, dir: V.dir, ctl: net.control(V.e, V.dir), h: V.hEnd, turn: V.next.turn }; }
      }
    }
    if (V.junc) this._curvePoint(V.junc, V.junc.d, p);
    else net.lanePoint(V.e, V.dir, V.lane, V.s, p, V.shift);
    if (V.ox || V.oz) {          // easing back into lane after being shunted
      const k = Math.max(0, 1 - dt * 1.1);
      V.ox *= k; V.oz *= k;
      if (Math.abs(V.ox) + Math.abs(V.oz) < 0.03) V.ox = V.oz = 0;
    }
    V.x = p.x + V.ox; V.y = p.y; V.z = p.z + V.oz;
    const th = headingOf(p.tx, p.tz);
    V.h = wrapAngle(V.h + wrapAngle(th - V.h) * Math.min(1, dt * 10));
    V.pitch = Math.atan(p.slope || 0);
  }

  _enter(V, over) {
    const net = this.net, nx = V.next;
    V.e = nx.e; V.dir = nx.dir; V.lane = nx.lane;
    V.s = net.trimStart(V.e, V.dir) + over;
    V.junc = null; V.curve = null; V.shift = 0;
    V.stopDone = false; V.stopT = 0; V.wait = 0;
    V.hEnd = net.heading(V.e, V.dir, true);
    this._plan(V);
  }

  _laneFree(V, lane) {
    const list = this.lanes.get(lkey(V.e, V.dir, lane));
    if (!list) return true;
    for (const W of list) if (W.s > V.s - 9 - V.v * 0.6 && W.s < V.s + 10 + V.v * 0.5) return false;
    return true;
  }

  // ───────────────────────── trams ─────────────────────────
  _tramPoint(tr, back, out) {
    let e = tr.e, s = tr.s - back, i = 0;
    while (s < 0 && i < tr.hist.length) { e = tr.hist[i++]; s += e.len; }
    return this.net.sample(e, Math.max(0, s), out);
  }

  _tramAhead(tr, d, out) {
    let e = tr.e, s = tr.s + d;
    if (s > e.len && tr.next) { s -= e.len; e = tr.next; }
    return this.net.sample(e, Math.min(s, e.len), out);
  }

  _spawnTram(player, initial) {
    const tram = this.net.tram;
    if (!tram.edges.length) return;
    for (let tries = 0; tries < 30; tries++) {
      const e = tram.edges[Math.floor(Math.random() * tram.edges.length)];
      const i = (e.n >> 1) * 3, d = Math.hypot(e.pts[i] - player.x, e.pts[i + 2] - player.z);
      if (d > 520 || d < (initial ? 60 : 230) || e.len < 20) continue;
      if (this.trams.some((t) => t.e === e)) continue;
      const tr = { id: this.nextId++, isTram: true, e, s: Math.min(e.len * 0.5, e.len - 1), v: 6, hist: [], next: null, dwell: 0, served: null, segs: [], pT: 0 };
      for (const pe of tram.nodes[e.a].inn.slice(0, 1)) tr.hist.push(tram.edges[pe]);
      tr.next = this._tramNext(e);
      for (let k = 0; k < 4; k++) tr.segs.push({ x: 0, y: 0, z: 0, h: 0 });
      this._tramPose(tr);
      if (tr.segs[0].rel < -1) continue;
      this.trams.push(tr);
      return;
    }
  }

  _tramNext(e) {
    const out = this.net.tram.nodes[e.b].out;
    return out.length ? this.net.tram.edges[out[Math.floor(Math.random() * out.length)]] : null;
  }

  _tramPose(tr) {
    const p = this._tmp;
    for (let k = 0; k < tr.segs.length; k++) {
      this._tramPoint(tr, 4.6 + k * 9.25, p);
      const sg = tr.segs[k];
      sg.x = p.x; sg.y = p.y; sg.z = p.z; sg.h = headingOf(p.tx, p.tz); sg.rel = p.rel;
    }
  }

  _tram(tr, dt) {
    const net = this.net, t = this.time, p = this._tmp;
    if (tr.halt > 0) { tr.halt -= dt; tr.v = 0; return; }
    let v0 = 11.5, acc = 1e9, byPlayer = false;
    const consider = (gap, lv, who) => { const a = idm(tr.v, v0, gap, tr.v - lv, 1.0); if (a < acc) { acc = a; byPlayer = !!(who && who.isPlayer); } };
    const h0 = headingOf(this._tramAhead(tr, 0, p).tx, p.tz), h1 = headingOf(this._tramAhead(tr, 12, p).tx, p.tz);
    if (Math.abs(wrapAngle(h1 - h0)) > 0.18) v0 = 4.5;
    if (tr.dwell > 0) { tr.dwell -= dt; v0 = 0.01; consider(0.5, 0, null); }
    for (let i = 0; i < tr.e.stops.length; i++) {
      const st = tr.e.stops[i], d = st.s - tr.s, key = tr.e.id * 64 + i;
      if (d < -0.5 || tr.served === key) continue;
      consider(Math.max(0.05, d) + 2, 0, null);
      if (d < 1.2 && tr.v < 0.4) { tr.dwell = 7 + Math.random() * 5; tr.served = key; }
      break;
    }
    // signals: trams stop short of any signalised junction that is not showing green for their direction
    const sigCheck = (sg, base) => {
      const d = base + sg.s - tr.s - 4;
      if (d < -1 || d > 60) return;
      const st = this.signals.forHeading(sg.sig, sg.h, t);
      if (st === 'R' || st === 'RY' || (st === 'Y' && (tr.v * tr.v) / 4 < d)) consider(Math.max(0.05, d) + 2, 0, null);
    };
    for (const sg of tr.e.sigs) sigCheck(sg, 0);
    if (tr.next) for (const sg of tr.next.sigs) sigCheck(sg, tr.e.len);
    if (!tr.next) consider(Math.max(0.05, tr.e.len - tr.s - 2) + 2, 0, null);
    const reach = Math.max(7, tr.v * 2.6 + 5), hx = Math.sin(h0), hz = -Math.cos(h0);
    for (const d of [1.5, 4.5, 8, 12, 17, 23, 30]) {
      if (d > reach) break;
      this._tramAhead(tr, d, p);
      const o = this._hit(p.x, p.z, 1.3, tr, false);
      if (!o) continue;
      consider(Math.max(0.05, d - 0.6), Math.max(0, o.vx * hx + o.vz * hz), o.owner);
      break;
    }
    if (acc > 1e8) acc = idm(tr.v, v0, 1e6, 0, 1.0);
    acc = Math.max(-4.5, acc);
    tr.pT = byPlayer ? tr.pT + dt : 0;
    if (byPlayer && acc < -2.6 && tr.v > 3 && tr.pT < 2 && !tr.flagged) { tr.flagged = 4; this.events.push({ type: 'cutoff', kind: 'tram', veh: tr }); }
    if (tr.flagged) tr.flagged = Math.max(0, tr.flagged - dt);
    tr.v = Math.max(0, tr.v + acc * dt);
    tr.s += tr.v * dt;
    if (tr.s >= tr.e.len) {
      if (!tr.next) { tr.dead = true; return; }
      tr.s -= tr.e.len;
      tr.hist.unshift(tr.e);
      if (tr.hist.length > 6) tr.hist.pop();
      tr.e = tr.next;
      tr.next = this._tramNext(tr.e);
      tr.served = null;
    }
    this._tramPose(tr);
  }

  // ───────────────────────── pedestrians ─────────────────────────
  _spawnPed(player) {
    const net = this.net, cands = [];
    net.forEdgesNear(player.x, player.z, 170, (e) => {
      if (e.tunnel) return;
      for (const c of e.crossings) {
        const dx = c.x - player.x, dz = c.z - player.z, d = Math.hypot(dx, dz);
        if (d < 22 || d > 170 || (c.pedList && c.pedList.length) || Math.abs(c.rel) > 0.5) continue;
        const ahead = (dx * Math.sin(player.h) - dz * Math.cos(player.h)) / d;
        if (ahead > -0.3 || Math.random() < 0.25) cands.push(c);
      }
    });
    if (!cands.length) return;
    const c = cands[Math.floor(Math.random() * cands.length)];
    const rx = -c.tz, rz = c.tx, span = this._span(c);
    if (span.twins.some((t) => t.pedList && t.pedList.length)) return;
    const n = Math.random() < 0.3 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const side = Math.random() < 0.5 ? 1 : -1;
      const offNear = side > 0 ? span.R : span.L, offFar = side > 0 ? span.L : span.R;
      // walking to and from the crossing stays on the pavement: never across a side road or another carriageway
      const onRoad = (x, z) => { const m = net.locate(x, z, { y: c.y }, 9); return !!m && m.outside < 0.4; };
      const stroll = (off, want) => {
        for (const a of [want, -want, want / 2, -want / 2, want / 4, -want / 4, 1.5, -1.5]) {
          if (!onRoad(c.x + rx * off + c.tx * a, c.z + rz * off + c.tz * a) && !onRoad(c.x + rx * off + c.tx * a * 0.5, c.z + rz * off + c.tz * a * 0.5)) return a;
        }
        return 0;
      };
      const lane = (Math.random() - 0.5) * 2.2;
      const curb = { x: c.x + rx * offNear + c.tx * lane, z: c.z + rz * offNear + c.tz * lane };
      const far = { x: c.x + rx * offFar + c.tx * lane, z: c.z + rz * offFar + c.tz * lane };
      const walkOff = offNear + side * 0.9, exitOff = offFar - side * 0.9;
      const along = stroll(walkOff, (Math.random() < 0.5 ? 1 : -1) * (7 + Math.random() * 14));
      const exitAlong = stroll(exitOff, (Math.random() < 0.5 ? 1 : -1) * (12 + Math.random() * 10));
      const p = {
        id: this.nextId++, isPed: true, c, phase: 'approach', color: PED_COLORS[Math.floor(Math.random() * PED_COLORS.length)],
        x: c.x + rx * walkOff + c.tx * along, z: c.z + rz * walkOff + c.tz * along, y: c.y, h: 0,
        curb, far, exit: { x: c.x + rx * exitOff + c.tx * exitAlong, z: c.z + rz * exitOff + c.tz * exitAlong },
        tx: curb.x, tz: curb.z, v: 1.25 + Math.random() * 0.35, walk: Math.random() * 6, waitStart: 0, moving: true,
      };
      p.cs = [c, ...span.twins];
      for (const cc of p.cs) (cc.pedList || (cc.pedList = [])).push(p);
      this.peds.push(p);
    }
  }

  /**
   * How far a crossing reaches to either side. Where the road is split into two carriageways the walk
   * carries on over the other half (and its own crossing object is linked as a "twin"), so nobody is
   * ever left standing in a live lane.
   */
  _span(c) {
    if (c.span) return c.span;
    const net = this.net, e = net.edges[c.e], rx = -c.tz, rz = c.tx, twins = [];
    const other = (off) => {                 // is this point on some other carriageway?
      const x = c.x + rx * off, z = c.z + rz * off;
      let hit = null;
      net.forEdgesNear(x, z, 12, (o) => {
        if (o === e || hit || o.tunnel) return;
        const pr = net.project(o, x, z);
        if (pr.d < Math.max(o.paveR, -o.paveL) + 0.4 && Math.abs(net.sample(o, pr.s, this._tmp).y - c.y) < 1.5) hit = o;
      });
      return hit;
    };
    const reach = (sgn, start) => {
      let off = start;
      for (let k = 0; k < 16; k++) {
        const o = other(off);
        if (!o) break;
        for (const c2 of o.crossings) if (c2 !== c && Math.hypot(c2.x - c.x, c2.z - c.z) < 16 && !twins.includes(c2)) twins.push(c2);
        off += sgn;
      }
      return off;
    };
    return (c.span = { R: reach(1, e.paveR + 1.0), L: reach(-1, e.paveL - 1.0), twins });
  }

  _leave(p) {
    for (const c of p.cs || [p.c]) {
      const l = c.pedList;
      if (l) { const i = l.indexOf(p); if (i >= 0) l.splice(i, 1); }
    }
    p.dead = true;
  }

  _safeToCross(c0, patient) {
    for (const c of [c0, ...this._span(c0).twins]) if (!this._safeOne(c, patient)) return false;
    return true;
  }

  _safeOne(c, patient) {
    const net = this.net, e = net.edges[c.e], P = this.P;
    const ok = (d, v) => d < -3 || v < 1.2 || d > v * (patient ? 3.2 : 1.9) + (patient ? 5 : 3);
    for (const dir of e.oneway ? [1] : [1, -1]) {
      const sC = dir > 0 ? c.s : e.len - c.s;
      for (let lane = 0; lane < net.lanes(e, dir); lane++) {
        const list = this.lanes.get(lkey(e, dir, lane));
        if (!list) continue;
        for (const W of list) {
          const d = sC - (W.s + W.len / 2), v = W.isPlayer ? Math.abs(P.v) : W.v;
          if (d < -3) { if (d > -W.len - 4) return false; continue; }
          if (!ok(d, v)) return false;
        }
      }
    }
    // anything closing in from a side road or out of a junction
    const closing = (x, z, h, v) => {
      const dx = c.x - x, dz = c.z - z, d = Math.hypot(dx, dz);
      if (d > 50 || d < 0.1) return false;
      const cs = ((dx * Math.sin(h) - dz * Math.cos(h)) / d) * v;
      return cs > 1.2 && d < cs * (patient ? 3.0 : 2.0) + 5;
    };
    if (closing(P.x, P.z, P.h, Math.abs(P.v))) return false;
    for (const node of [e.a, e.b]) {
      const list = this.inJunction.get(node);
      if (list) for (const V of list) if (closing(V.x, V.z, V.h, V.v)) return false;
    }
    return true;
  }

  /**
   * The player's car has run into vehicle V: shunt it. It is pushed along the line of the blow, and an
   * off-centre hit also shoves it sideways and spins it, the way a real car reacts to a knock on one corner.
   */
  shove(V, player) {
    const sp = Math.abs(player.v), dirV = Math.sign(player.v) || 1;
    const fx = Math.sin(player.h) * dirV, fz = -Math.cos(player.h) * dirV;
    const lx = (V.x - player.x) * -fz + (V.z - player.z) * fx;          // how far to the side of our nose their centre is
    const mass = 4.35 / V.K.len, off = Math.max(-1, Math.min(1, lx / 1.2));
    V.ovx = (fx * 0.75 + -fz * off * 0.45) * sp * mass;
    V.ovz = (fz * 0.75 + fx * off * 0.45) * sp * mass;
    // which way it spins depends on which end we hit and on which side of centre
    const ahead = (V.x - player.x) * Math.sin(V.h) - (V.z - player.z) * Math.cos(V.h) > 0 ? 1 : -1;
    V.ow = off * ahead * sp * 0.16 * mass * dirV;
  }

  /** Did the player's car just run into somebody? They go flying, land, and later pick themselves up. */
  _knock() {
    const P = this.P, sp = Math.abs(P.v);
    if (sp < 1.2) return;
    const fx = Math.sin(P.h), fz = -Math.cos(P.h), dirV = Math.sign(P.v);
    for (const p of this.peds) {
      if (p.phase === 'down') continue;
      const dx = p.x - P.x, dz = p.z - P.z, lf = dx * fx + dz * fz, lx = dx * -fz + dz * fx;
      if (Math.abs(lf) > 2.3 || Math.abs(lx) > 1.0 || lf * dirV < 0) continue;
      for (const c of p.cs || [p.c]) { const l = c.pedList, i = l ? l.indexOf(p) : -1; if (i >= 0) l.splice(i, 1); }
      p.phase = 'down'; p.downT = 0; p.air = 0.05; p.tilt = 0;
      p.kvx = fx * P.v * 0.9 + -fz * Math.sign(lx || 1) * 1.5; p.kvz = fz * P.v * 0.9 + fx * Math.sign(lx || 1) * 1.5;
      p.kvy = 3 + sp * 0.4; p.spin = 5 + sp * 0.5;
      this.events.push({ type: 'pedhit', ped: p, speed: sp });
    }
  }

  _ped(p, dt) {
    if (p.phase === 'down') {
      p.downT += dt;
      p.moving = false;
      if (p.air > 0) {
        p.kvy -= 13 * dt;
        p.air = Math.max(0, p.air + p.kvy * dt);
        p.x += p.kvx * dt; p.z += p.kvz * dt;
        p.tilt -= p.spin * dt;
        if (p.air === 0) p.tilt = -Math.PI / 2;                      // flat on their back
      } else {
        const k = Math.max(0, 1 - dt * 4);
        p.x += p.kvx * dt; p.z += p.kvz * dt; p.kvx *= k; p.kvz *= k;
        if (p.downT > 5) p.tilt = Math.min(0, p.tilt + dt * 2.2);    // getting back up
        if (p.downT > 5.8) { p.phase = 'leave'; p.tilt = 0; p.tx = p.exit.x; p.tz = p.exit.z; }
      }
      return;
    }
    const t = this.time, c = p.c;
    const dx = p.tx - p.x, dz = p.tz - p.z, d = Math.hypot(dx, dz);
    p.moving = false;
    if (p.phase === 'wait') {
      const waited = t - p.waitStart;
      let go;
      if (c.sig) go = this.signals.walk(c, t) && this._safeToCross(c, false);
      else go = waited > 0.8 && this._safeToCross(c, waited < 3.5);
      if (go) { p.phase = 'cross'; p.tx = p.far.x; p.tz = p.far.z; }
      else if (waited > 45) { p.phase = 'leave'; p.tx = p.exit.x - (p.far.x - p.curb.x); p.tz = p.exit.z - (p.far.z - p.curb.z); }
      p.h = headingOf(p.far.x - p.x, p.far.z - p.z);
      return;
    }
    if (d < 0.25) {
      if (p.phase === 'approach') { p.phase = 'wait'; p.waitStart = t; }
      else if (p.phase === 'cross') { p.phase = 'leave'; p.tx = p.exit.x; p.tz = p.exit.z; }
      else this._leave(p);
      return;
    }
    const sp = p.phase === 'cross' ? p.v * 1.1 : p.v, st = Math.min(d, sp * dt);
    p.x += (dx / d) * st; p.z += (dz / d) * st;
    p.h = headingOf(dx, dz);
    p.walk += dt * sp * 4.2;
    p.moving = true;
  }

  // ───────────────────────── population ─────────────────────────
  _population(dt, player) {
    const far = 470 + Math.abs(player.v) * 4;
    for (const V of this.vehicles) {
      const d = Math.hypot(V.x - player.x, V.z - player.z);
      if (d > far || (V.idle > 50 && d > 70) || V.idle > 100) V.dead = true;
    }
    for (const tr of this.trams) if (Math.hypot(tr.segs[0].x - player.x, tr.segs[0].z - player.z) > 620) tr.dead = true;
    for (const p of this.peds) if (!p.dead && Math.hypot(p.x - player.x, p.z - player.z) > 230 && p.phase !== 'cross') this._leave(p);
    if (this.vehicles.some((v) => v.dead)) this.vehicles = this.vehicles.filter((v) => !v.dead);
    if (this.trams.some((v) => v.dead)) this.trams = this.trams.filter((v) => !v.dead);
    if (this.peds.some((v) => v.dead)) this.peds = this.peds.filter((v) => !v.dead);

    if (this._fresh) {
      this._fresh = false;
      for (let i = 0; i < 400 && this.vehicles.length < this.target.vehicles * 0.85; i++) this._spawnVehicle(player, true);
      for (let i = 0; i < 3 && this.trams.length < this.target.trams; i++) this._spawnTram(player, true);
    }
    this.spawnT -= dt;
    if (this.spawnT <= 0 && this.vehicles.length < this.target.vehicles) {
      for (let i = 0; i < 6; i++) if (this._spawnVehicle(player, false)) break;
      this.spawnT = 0.12;
    }
    this.tramT -= dt;
    if (this.tramT <= 0) { this.tramT = 2.5; if (this.trams.length < this.target.trams) this._spawnTram(player, false); }
    this.pedT -= dt;
    if (this.pedT <= 0) { this.pedT = 1.1; if (this.peds.length < this.target.peds) this._spawnPed(player); }
  }

  // ───────────────────────── queries for the examiner ─────────────────────────
  /** Vehicles the player would have to give way to if they entered the junction now. */
  threats(app) {
    const out = [];
    if (!app) return out;
    const list = this.approach.get(app.node);
    if (list) for (const W of list) {
      if (W.isPlayer || (W.e === app.e && W.dir === app.dir)) continue;
      if (W.dist < -5 || W.v < 1.5 || !mustYield(app.ctl, app.h, app.turn, W)) continue;
      if (W.dist / W.v < 3.4 && W.dist < 48) out.push(W);
    }
    const inside = this.inJunction.get(app.node);
    if (inside) for (const W of inside) {
      if (!W.entry || !W.junc || W.junc.d > W.junc.len * 0.75 || W.v < 1 || (W.entry.e === app.e && W.entry.dir === app.dir)) continue;
      if (mustYield(app.ctl, app.h, app.turn, W.entry)) out.push({ veh: W, e: W.entry.e, dir: W.entry.dir, dist: 0, v: W.v, h: W.entry.h, turn: W.entry.turn, ctl: W.entry.ctl, inside: true });
    }
    return out;
  }

  /** Oncoming vehicles close enough that a left turn would cut across them. */
  oncoming(app) {
    const out = [], list = app && this.approach.get(app.node);
    if (list) for (const W of list) {
      if (W.isPlayer || W.turn === -1 || W.v < 1.5 || W.dist < -5) continue;
      if (Math.cos(wrapAngle(W.h - app.h)) < -0.6 && LEVEL[W.ctl] >= LEVEL[app.ctl] && W.dist / W.v < 3.6 && W.dist < 50) out.push(W);
    }
    return out;
  }

  /** Gap (m) and speed of the vehicle directly ahead of the player in their lane, or null. */
  playerLead() {
    const r = this.P.road;
    if (!r || r.lane < 0 || r.lane >= r.nLanes) return null;
    const list = this.lanes.get(lkey(r.e, r.dir, r.lane));
    let best = null;
    if (list) for (const W of list) {
      if (W.isPlayer || W.s <= r.s) continue;
      const gap = W.s - r.s - W.len / 2 - this.P.len / 2;
      if (!best || gap < best.gap) best = { gap, v: W.v, who: W };
    }
    return best;
  }

  /** Is anything overlapping the player's car? Returns the obstacle owner or null. */
  playerHit() {
    const P = this.P, sx = Math.sin(P.h), sz = -Math.cos(P.h);
    for (const o of [1.25, 0, -1.25]) {
      const hit = this._hit(P.x + sx * o, P.z + sz * o, 0.72, P, false);
      if (hit) return hit;
    }
    return null;
  }

  // ───────────────────────── drawing ─────────────────────────
  _draw(player) {
    const m = this._m, q = this._q, e = this._e, pos = this._p, one = this._s;
    const counts = {};
    for (const k of KINDS) counts[k.name] = 0;
    const lights = this.mesh.lights;
    let nl = 0;
    const blinkOn = this.time % 0.7 < 0.35;
    const light = (V, lx, ly, lz, color) => {
      if (nl >= 400) return;
      const c = Math.cos(V.h), s = Math.sin(V.h);
      pos.set(V.x + lx * c - lz * s, V.y + ly, V.z + lx * s + lz * c);
      m.compose(pos, q, one);
      lights.setMatrixAt(nl, m);
      lights.setColorAt(nl, color);
      nl++;
    };
    for (const V of this.vehicles) {
      const name = V.K.name, mesh = this.mesh[name], i = counts[name];
      if (i >= 80) continue;
      e.set(V.pitch, -V.h, 0);
      q.setFromEuler(e);
      pos.set(V.x, V.y + 0.05, V.z);
      m.compose(pos, q, one);
      mesh.body.setMatrixAt(i, m);
      mesh.detail.setMatrixAt(i, m);
      mesh.body.setColorAt(i, V.color);
      counts[name]++;
      if (Math.abs(V.x - player.x) > 160 || Math.abs(V.z - player.z) > 160) continue;
      const hw = V.K.wid / 2 - 0.25, hl = V.K.len / 2 + 0.03, ly = V.K.car ? this.geo[name].tailY : name === 'truck' ? 0.87 : 0.95;
      if (V.brake) { light(V, -hw, ly, hl, this._red); light(V, hw, ly, hl, this._red); }
      if (V.blink && blinkOn) { light(V, V.blink * (hw + 0.1), ly - 0.12, hl, this._amber); light(V, V.blink * (hw + 0.1), ly - 0.2, -hl, this._amber); }
    }
    for (const k of KINDS) {
      const mesh = this.mesh[k.name];
      mesh.body.count = mesh.detail.count = counts[k.name];
      mesh.body.instanceMatrix.needsUpdate = mesh.detail.instanceMatrix.needsUpdate = true;
      if (mesh.body.instanceColor) mesh.body.instanceColor.needsUpdate = true;
    }
    lights.count = nl;
    lights.instanceMatrix.needsUpdate = true;
    if (lights.instanceColor) lights.instanceColor.needsUpdate = true;

    let nt = 0;
    for (const tr of this.trams) for (const sg of tr.segs) {
      if (nt >= 40) break;
      e.set(0, -sg.h, 0); q.setFromEuler(e);
      pos.set(sg.x, sg.y + 0.05, sg.z);
      m.compose(pos, q, one);
      this.mesh.tram.setMatrixAt(nt++, m);
    }
    this.mesh.tram.count = nt;
    this.mesh.tram.instanceMatrix.needsUpdate = true;

    const pm = this.mesh.ped;
    let np = 0;
    for (const p of this.peds) {
      if (np >= 48) break;
      const tilt = p.phase === 'down' ? p.tilt : 0, lift = p.phase === 'down' ? p.air + 0.12 : 0;
      e.set(tilt, -p.h, 0); q.setFromEuler(e);
      pos.set(p.x, p.y + 0.06 + lift, p.z);
      m.compose(pos, q, one);
      pm.body.setMatrixAt(np, m); pm.head.setMatrixAt(np, m);
      pm.body.setColorAt(np, p.color);
      const sw = p.moving ? Math.sin(p.walk) * 0.55 : 0;
      for (let k = 0; k < 2; k++) {
        // hips sit 0.88 m up the body, wherever the body is pointing
        e.set(tilt, -p.h, 0); q.setFromEuler(e);
        pos.set(k ? 0.1 : -0.1, 0.88, 0).applyQuaternion(q);
        pos.x += p.x; pos.y += p.y + lift; pos.z += p.z;
        e.set(tilt + (k ? sw : -sw), -p.h, 0); q.setFromEuler(e);
        m.compose(pos, q, one);
        pm.leg.setMatrixAt(np * 2 + k, m);
      }
      np++;
    }
    pm.body.count = pm.head.count = np; pm.leg.count = np * 2;
    pm.body.instanceMatrix.needsUpdate = pm.head.instanceMatrix.needsUpdate = pm.leg.instanceMatrix.needsUpdate = true;
    if (pm.body.instanceColor) pm.body.instanceColor.needsUpdate = true;
  }
}

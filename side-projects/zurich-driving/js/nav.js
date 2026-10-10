// Lessons, free-drive start points, route planning and turn-by-turn instructions.
import * as THREE from '../lib/three.module.min.js';
import { T } from './net.js';

const R = T.RESIDENTIAL;

/** via: [lat, lon, options?] — the route is planned through these points in order. */
export const LESSONS = [
  {
    id: 'quartier', title: 'Quartier streets', sub: 'Tempo 30 and right-before-left',
    focus: ['Rechtsvortritt', 'Zone 30', 'Observation'],
    brief: 'Quiet residential streets in Wiedikon. No signs at most junctions, so traffic from the right goes first. Roll up to each one slowly enough to stop.',
    via: [[47.37135, 8.5176, { minType: R }], [47.3729, 8.5152, { minType: R }], [47.3743, 8.5177, { minType: R }], [47.3757, 8.5139, { minType: R }], [47.3722, 8.5122, { minType: R }], [47.3702, 8.5141]],
  },
  {
    id: 'stadt', title: 'City traffic', sub: 'Lights, trams and zebra crossings',
    focus: ['Traffic lights', 'Trams', 'Fussgängerstreifen'],
    brief: 'From Albisriederplatz down Badenerstrasse to Stauffacher and on to Sihlcity. Trams share the road and pedestrians step out at the yellow stripes.',
    via: [[47.3783, 8.5106], [47.3746, 8.5222], [47.3735, 8.529], [47.3714, 8.5236], [47.358, 8.523]],
  },
  {
    id: 'kreisel', title: 'Roundabouts', sub: 'Give way on entry, signal on exit',
    focus: ['Kreisel', 'Blinker', 'Vortritt'],
    brief: 'From Adliswil over the hill to Thalwil through five roundabouts. Give way to traffic from the left, do not signal going in, indicate right before you leave.',
    via: [[47.3138, 8.5251], [47.299, 8.556], [47.2962, 8.5625]], avoidMotorway: true,
  },
  {
    id: 'adliswil', title: 'Adliswil', sub: 'Town centre and the Sihltal',
    focus: ['Main roads', 'Give way', 'Town driving'],
    brief: 'Around Adliswil: from the station through the centre, up towards Kilchberg and back down into the valley.',
    via: [[47.3121, 8.5246], [47.3168, 8.5262], [47.3225, 8.5405], [47.3105, 8.5345], [47.3075, 8.5262]],
  },
  {
    id: 'stadt-adliswil', title: 'Zürich to Adliswil', sub: 'Enge, Wollishofen, Albisstrasse',
    focus: ['Lane choice', 'Speed changes', 'Trams'],
    brief: 'The everyday route out of town: Enge, Wollishofen and down the Albisstrasse into Adliswil. Watch the limit change between 50, 60 and 30.',
    via: [[47.3641, 8.531], [47.3441, 8.5306], [47.3265, 8.527], [47.3121, 8.5246]], avoidMotorway: true,
  },
  {
    id: 'autobahn', title: 'Autobahn A3', sub: 'Joining, lane discipline, leaving',
    focus: ['Einfahren', 'Rechtsfahrgebot', '120 km/h'],
    brief: 'Join the A3 at Brunau, settle in the right lane, overtake properly and take the Thalwil exit. Use the slip road to match the speed of traffic.',
    via: [[47.3531, 8.5236], [47.3014, 8.5492, { maxType: T.TERTIARY }], [47.2977, 8.5598]], motorway: true,
  },
  {
    id: 'uetliberg', title: 'Westumfahrung', sub: 'A3 and the Uetliberg tunnel',
    focus: ['Tunnel', 'Autobahn', 'Abstand'],
    brief: 'From Brunau onto the motorway and through the Uetliberg tunnel. Keep your distance in the tunnel and hold the signed limit.',
    via: [[47.3531, 8.5236], [47.3378, 8.4577, { r: 400 }], [47.3349, 8.4613, { r: 400 }]], motorway: true,
  },
  {
    id: 'pruefung', title: 'Test route', sub: 'Mock practical exam from Albisgütli',
    focus: ['Everything', 'Strict marking'],
    brief: 'A mixed route starting at the Strassenverkehrsamt in Albisgütli, where real tests begin: quartier streets, main roads, trams and a stretch of faster road. Shoulder checks are marked.',
    via: [[47.3531, 8.5118], [47.3585, 8.5215], [47.3641, 8.531], [47.3712, 8.5236], [47.3702, 8.5141], [47.3622, 8.5075, { minType: R }], [47.3531, 8.5118]], strict: true,
  },
];

export const PLACES = [
  { name: 'Albisriederplatz', at: [47.3783, 8.5106] },
  { name: 'Stauffacher', at: [47.3735, 8.529] },
  { name: 'Bellevue', at: [47.3671, 8.5451] },
  { name: 'Central / HB', at: [47.3768, 8.5438] },
  { name: 'Escher-Wyss-Platz', at: [47.3908, 8.5222] },
  { name: 'Bahnhof Enge', at: [47.3641, 8.531] },
  { name: 'Albisgütli', at: [47.3531, 8.5118] },
  { name: 'Wollishofen', at: [47.3441, 8.5306] },
  { name: 'Oerlikon', at: [47.4112, 8.5446] },
  { name: 'Altstetten', at: [47.3913, 8.4889] },
  { name: 'Adliswil Bahnhof', at: [47.3121, 8.5246] },
  { name: 'Kilchberg', at: [47.3225, 8.5405] },
  { name: 'Thalwil', at: [47.2958, 8.5612] },
  { name: 'Brunau (A3)', at: [47.3531, 8.5236] },
  { name: 'Wettswil', at: [47.3378, 8.4577] },
];

export class Nav {
  constructor(net, scene) {
    this.net = net;
    this.path = null; this.idx = 0; this.wps = []; this.wpi = 0;
    this.instr = null; this.remaining = 0; this.done = false;
    this.offT = 0; this.opts = {};
    this.line = [];                       // whole remaining route for the map: [x0, z0, x1, z1, …]
    // ribbon on the road showing the next stretch
    const N = 90;
    this._N = N;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 2 * 3), 3));
    const idx = [];
    for (let i = 0; i < N - 1; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 3, i * 2, i * 2 + 3, i * 2 + 2);
    g.setIndex(idx);
    this.ribbon = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: '#39b8ff', transparent: true, opacity: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -24 }));
    this.ribbon.frustumCulled = false;
    this.ribbon.visible = false;
    this.ribbon.renderOrder = 2;
    scene.add(this.ribbon);
    this.showRibbon = true;
    this._ribT = 0;
  }

  clear() { this.path = null; this.instr = null; this.done = false; this.ribbon.visible = false; this.line = []; this.prefer = null; }

  /** Resolve lat/lon waypoints to road spots; returns the start pose { e, dir, s } or null. */
  plan(via, opts = {}) {
    const net = this.net;
    this.opts = opts;
    const spots = via.map(([lat, lon, o]) => net.spot(lat, lon, o || {})).filter(Boolean);
    if (spots.length < 2) return null;
    // choose the starting direction that gives the shorter first leg
    const s0 = spots[0];
    let best = null;
    for (const dir of s0.e.oneway ? [1] : [1, -1]) {
      const p = net.route(s0.e, dir, spots[1].node, opts);
      if (!p) continue;
      let len = 0;
      for (const el of p) len += el.e.len;
      if (!best || len < best.len) best = { dir, len };
    }
    if (!best) return null;
    this.wps = spots.slice(1).map((s) => s.node);
    this.wpi = 0;
    this.done = false; this.offT = 0;
    const s = Math.min(Math.max(best.dir > 0 ? s0.s : s0.e.len - s0.s, 8), s0.e.len - net.trimEnd(s0.e, best.dir) - 28);
    if (!this._route(s0.e, best.dir)) return null;
    return { e: s0.e, dir: best.dir, s: Math.max(4, s) };
  }

  /** Single destination (free drive). */
  planTo(e, dir, node, opts = {}) {
    this.opts = opts; this.wps = [node]; this.wpi = 0; this.done = false; this.offT = 0;
    return this._route(e, dir);
  }

  _route(e, dir) {
    const net = this.net;
    let path = [{ e, dir }], wpEnd = [];
    for (let k = this.wpi; k < this.wps.length; k++) {
      const last = path[path.length - 1];
      if (net.endNode(last.e, last.dir) !== this.wps[k]) {
        const leg = net.route(last.e, last.dir, this.wps[k], this.opts);
        if (!leg) return false;
        path = path.concat(leg.slice(1));
      }
      wpEnd.push(path.length - 1);
    }
    this.path = path; this.idx = 0; this.wpEnd = wpEnd;
    let acc = 0;
    this.line = [];
    const tmp = {};
    for (const el of path) {
      el.start = acc; acc += el.e.len;
      const n = el.e.n, lane = net.lanes(el.e, el.dir) - 1;
      for (let i = 0; i < n; i++) {
        const j = el.dir > 0 ? i : n - 1 - i;
        net.lanePoint(el.e, el.dir, lane, el.dir > 0 ? el.e.cum[j] : el.e.len - el.e.cum[j], tmp);
        this.line.push(tmp.x, tmp.z);
      }
    }
    this.total = acc;
    return true;
  }

  update(dt, player) {
    const r = player.road, path = this.path, net = this.net;
    if (!path || !r || this.done) return;
    let found = -1;
    for (let j = this.idx; j < Math.min(path.length, this.idx + 5); j++) if (path[j].e === r.e && path[j].dir === r.dir) { found = j; break; }
    if (found >= 0) {
      if (found !== this._prefIdx || !player.prefer) {
        this._prefIdx = found;
        player.prefer = new Set();
        for (let j = found; j < Math.min(path.length, found + 5); j++) player.prefer.add(path[j].e.id);
      }
      this.offT = 0;
      while (this.wpEnd.length > 1 && found > this.wpEnd[0]) { this.wpEnd.shift(); this.wpi++; }
      this.idx = found;
    } else if (r.on) {
      this.offT += dt;
      if (this.offT > 2.2 && !r.wrongWay) {
        this.offT = 0;
        const old = this.path;
        if (!this._route(r.e, r.dir)) this.path = old; else { this.rerouted = true; this._prefIdx = -1; player.prefer = null; }
        return;
      }
    }
    const cur = path[this.idx];
    const onPath = found >= 0;
    let dist = onPath ? cur.e.len - r.s : 0;
    this.remaining = this.total - cur.start - (onPath ? r.s : 0);
    const goal = net.nodes[net.endNode(path[path.length - 1].e, path[path.length - 1].dir)];
    // the drive ends on the last stretch of road, short of the final junction
    const lastEl = path[path.length - 1];
    const atEnd = (this.idx === path.length - 1 && onPath && cur.e.len - r.s < Math.max(34, net.trimEnd(lastEl.e, lastEl.dir) + 18)) || (this.idx >= path.length - 2 && Math.hypot(goal.x - player.x, goal.z - player.z) < 16);
    if (atEnd) { this.done = true; this.instr = { type: 'arrive', dist: 0, text: 'Arrived: pull up and stop', key: 'arrived' }; this.ribbon.visible = false; return; }

    // next manoeuvre
    let instr = null;
    for (let i = this.idx; i < path.length - 1 && dist < 1500; i++) {
      const a = path[i], b = path[i + 1], node = net.nodes[net.endNode(a.e, a.dir)];
      if (b.e === a.e) { instr = { type: 'uturn', dist }; break; }          // dead end
      if (node.ends.length >= 3) {
        const ang = net.turnAngle(a.e, a.dir, b.e, b.dir), name = b.e.name;
        if (!a.e.roundabout && b.e.roundabout) {
          let exit = 1, j = i + 1;
          for (; j < path.length - 1 && path[j + 1].e.roundabout; j++) {
            const n2 = net.endNode(path[j].e, path[j].dir);
            if (net.exits(n2, path[j].e.id).some((x) => !x.e.roundabout)) exit++;
          }
          const out = path[j + 1];
          instr = { type: 'roundabout', exit, dist, name: out ? out.e.name : '' };
        } else if (a.e.roundabout && !b.e.roundabout) instr = { type: 'rb-exit', dist, name };
        else if (a.e.roundabout) { /* keep circulating */ }
        else if (b.e.link && b.e.t <= T.TRUNK && a.e.t > T.TRUNK) instr = { type: ang < 0 ? 'ramp-left' : 'ramp-right', dist, name };
        else if (a.e.t <= T.TRUNK && !a.e.link && b.e.link) instr = { type: 'exit', dist, name };
        else if (Math.abs(ang) > 0.5) instr = { type: ang > 0 ? 'right' : 'left', dist, name, sharp: Math.abs(ang) > 2.0 };
        else {
          const others = net.exits(node.id, a.e.id).filter((x) => x.e !== b.e);
          const straighter = others.some((x) => Math.abs(net.turnAngle(a.e, a.dir, x.e, x.dir)) < Math.abs(ang) + 0.12 && Math.abs(net.turnAngle(a.e, a.dir, x.e, x.dir)) < 0.6);
          if (straighter && Math.abs(ang) > 0.08) instr = { type: ang > 0 ? 'keep-right' : 'keep-left', dist, name };
        }
        if (instr) break;
      }
      dist += b.e.len;
    }
    if (!instr) instr = this.remaining < 400 ? { type: 'arrive', dist: this.remaining } : { type: 'straight', dist: Math.min(dist, this.remaining) };
    instr.text = describe(instr);
    instr.key = `${instr.type}:${instr.exit || ''}:${instr.name || ''}`;
    this.instr = instr;

    // road ribbon
    this._ribT -= dt;
    this.ribbon.visible = this.showRibbon && onPath;
    if (this.ribbon.visible && this._ribT <= 0) { this._ribT = 0.12; this._buildRibbon(r); }
  }

  _buildRibbon(r) {
    const net = this.net, path = this.path, pos = this.ribbon.geometry.attributes.position, N = this._N, tmp = {};
    let k = 0, i = this.idx, s = r.s + 5, lastX = 0, lastY = 0, lastZ = 0, lastTx = 0, lastTz = 1;
    const put = (x, y, z, tx, tz) => {
      pos.setXYZ(k * 2, x + tz * 0.32, y + 0.14, z - tx * 0.32);
      pos.setXYZ(k * 2 + 1, x - tz * 0.32, y + 0.14, z + tx * 0.32);
      lastX = x; lastY = y; lastZ = z; lastTx = tx; lastTz = tz; k++;
    };
    while (k < N && i < path.length) {
      const el = path[i], next = path[i + 1];
      let lane = net.lanes(el.e, el.dir) - 1;
      if (i === this.idx && r.lane >= 0 && r.lane < r.nLanes) lane = r.lane;
      const end = el.e.len - net.trimEnd(el.e, el.dir);
      for (; s <= end && k < N; s += 3.2) { const p = net.lanePoint(el.e, el.dir, lane, s, tmp); put(p.x, p.y, p.z, p.tx, p.tz); }
      if (!next) break;
      s = net.trimStart(next.e, next.dir);
      i++;
    }
    for (; k < N; k++) put(lastX, lastY, lastZ, lastTx, lastTz);
    pos.needsUpdate = true;
  }
}

const ORD = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth'];
function describe(i) {
  const onto = i.name ? ` onto ${i.name}` : '';
  switch (i.type) {
    case 'left': return `${i.sharp ? 'Sharp left' : 'Turn left'}${onto}`;
    case 'right': return `${i.sharp ? 'Sharp right' : 'Turn right'}${onto}`;
    case 'keep-left': return `Keep left${onto}`;
    case 'keep-right': return `Keep right${onto}`;
    case 'roundabout': return `At the roundabout, take the ${ORD[i.exit] || `${i.exit}th`} exit${i.name ? ` (${i.name})` : ''}`;
    case 'rb-exit': return `Leave the roundabout${onto}`;
    case 'ramp-left': case 'ramp-right': return `Join the motorway${i.name ? ` ${i.name}` : ''}`;
    case 'exit': return `Take the exit${i.name ? ` ${i.name}` : ''}`;
    case 'uturn': return 'Dead end: turn round';
    case 'arrive': return 'Destination ahead';
    default: return 'Continue straight on';
  }
}

export function fmtDist(m) {
  if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
  if (m >= 100) return `${Math.round(m / 50) * 50} m`;
  return `${Math.max(10, Math.round(m / 10) * 10)} m`;
}

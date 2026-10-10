// Player input, car physics and map-matching to the road network.
import * as THREE from '../lib/three.module.min.js';
import { headingOf, wrapAngle } from './net.js';

export class Input {
  constructor() {
    this.down = new Set();
    this.handlers = new Map();
    this.touch = { steer: 0, gas: 0, brake: 0, look: 0, hand: false };
    this.enabled = true;
    addEventListener('keydown', (ev) => {
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
      const tag = ev.target && ev.target.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(ev.code)) ev.preventDefault();
      if (ev.repeat) return;
      this.down.add(ev.code);
      const fn = this.handlers.get(ev.code);
      if (fn) fn(ev);
    });
    addEventListener('keyup', (ev) => this.down.delete(ev.code));
    addEventListener('blur', () => this.down.clear());
  }
  on(codes, fn) { for (const c of [].concat(codes)) this.handlers.set(c, fn); }
  any(...codes) { return codes.some((c) => this.down.has(c)); }
  get steer() { return this.enabled ? (this.any('KeyD', 'ArrowRight') ? 1 : 0) - (this.any('KeyA', 'ArrowLeft') ? 1 : 0) + this.touch.steer : 0; }
  get gas() { return this.enabled ? Math.max(this.any('KeyW', 'ArrowUp') ? 1 : 0, this.touch.gas) : 0; }
  get brake() { return this.enabled ? Math.max(this.any('KeyS', 'ArrowDown') ? 1 : 0, this.touch.brake) : 0; }
  get handbrake() { return this.enabled && (this.any('Space') || !!this.touch.hand); }
  get look() { return this.enabled ? (this.any('KeyC') ? 1 : 0) - (this.any('KeyZ') ? 1 : 0) + this.touch.look : 0; }
  get lookBack() { return this.enabled && this.any('KeyX'); }
}

const WHEELBASE = 2.6;
export const CAR = { len: 4.35, wid: 1.8 };

export class Player {
  constructor(net, world) {
    this.net = net;
    this.world = world;
    this.x = 0; this.y = 0; this.z = 0; this.h = 0; this.pitch = 0;
    this.v = 0; this.acc = 0; this.steer = 0;
    this.gear = 'D';
    this.blink = 0; this.blinkT = 0; this.blinkH = 0; this.blinkLane = 0; this.blinkAge = 0;
    this.hazard = false;
    this.limiter = false;
    this.throttle = 0; this.brakeF = 0; this.stopHold = 0;
    this.road = null;
    this.crash = null;        // set for one frame: { kind: 'building' | 'wall' }
    this.crashCool = 0;
    this.odo = 0;
    this.lookYaw = 0;         // smoothed head yaw (rad), for observation checks
    this.lookLeftT = 99; this.lookRightT = 99;
    this.edge = 1e9;
    this.prefer = null;       // edge ids on the planned route (set by the navigator)
  }

  /** Put the car on a lane, stationary. */
  place(e, dir, sTravel, lane = null) {
    const n = this.net.lanes(e, dir);
    const p = this.net.lanePoint(e, dir, lane === null ? n - 1 : Math.min(lane, n - 1), sTravel, {});
    this.x = p.x; this.y = p.y; this.z = p.z;
    this.h = headingOf(p.tx, p.tz);
    this.v = 0; this.steer = 0; this.gear = 'D'; this.blink = 0; this.pitch = 0; this.throttle = 0; this.brakeF = 0;
    this.road = null;
    this._match();
  }

  setBlink(side) {
    this.blink = this.blink === side ? 0 : side;
    this.blinkH = this.h; this.blinkAge = 0;
    this.blinkLane = this.road ? this.road.lane : 0;
  }

  get blinkOn() { return (this.blink !== 0 || this.hazard) && this.blinkT % 0.7 < 0.35; }

  update(dt, input) {
    const net = this.net;
    this.crash = null;
    this.crashCool = Math.max(0, this.crashCool - dt);
    const px = this.x, pz = this.z;

    // ── pedals ──
    let gas = input.gas, brake = input.brake;
    if (this.gear === 'D') {
      if (Math.abs(this.v) < 0.15 && brake > 0 && gas === 0) { this.stopHold += dt; if (this.stopHold > 0.45) { this.gear = 'R'; this.stopHold = 0; } } else this.stopHold = 0;
    } else {
      [gas, brake] = [brake, gas];
      if (Math.abs(this.v) < 0.15 && brake > 0 && gas === 0) { this.stopHold += dt; if (this.stopHold > 0.2) { this.gear = 'D'; this.stopHold = 0; } } else this.stopHold = 0;
    }
    this.throttle += Math.max(-dt * 6, Math.min(dt * 2.2, gas - this.throttle));
    // the brake key gives firm, comfortable braking (about 6 m/s²); Space is the emergency stop
    this.brakeF += Math.max(-dt * 8, Math.min(dt * 2.8, brake * 0.64 - this.brakeF));
    const limit = this.road ? this.road.e.speed / 3.6 : 99;
    let thr = this.throttle;
    if (this.limiter && this.gear === 'D' && this.v > limit - 0.3) thr = Math.min(thr, Math.max(0, (limit + 0.3 - this.v) * 0.8));
    const sp = Math.abs(this.v);
    let a;
    if (this.gear === 'D') a = thr * 3.1 * Math.max(0, 1 - (sp / 47) ** 2);
    else a = thr * 2.0 * Math.max(0, 1 - (sp / 7) ** 2);
    const offroad = this.road && !this.road.on ? Math.min(3, this.road.outside) : 0;
    let dec = this.brakeF * 8.8 + (input.handbrake ? 5 : 0) + 0.18 + 0.01 * sp + 0.00055 * sp * sp + (thr < 0.05 ? 0.45 : 0) + offroad * 0.05 * sp;      // grass slows you in proportion to speed, so you can always pull away
    if (this.road) a -= 9.81 * this.road.slope * (this.gear === 'D' ? 1 : -1) * 0.6;
    const sign = this.gear === 'D' ? 1 : -1;
    let v = this.v * sign + a * dt;
    v = v > 0 ? Math.max(0, v - dec * dt) : Math.min(0, v + dec * dt);
    if (v < 0) v = 0;
    const prevV = this.v;
    this.v = v * sign;
    this.acc += ((this.v - prevV) / Math.max(dt, 1e-3) - this.acc) * Math.min(1, dt * 8);

    // ── steering ──
    // full lock is limited by lateral grip at speed and by a comfortable turning rate in town,
    // and the wheel is wound on gradually so a key press never snaps the car round
    const maxSteer = Math.min(0.55, Math.atan((WHEELBASE * 4.5) / Math.max(1, sp * sp)), Math.atan((WHEELBASE * 0.75) / Math.max(0.5, sp)));
    const target = Math.max(-1, Math.min(1, input.steer)) * maxSteer;
    const rate = (target === 0 ? 1.5 : 0.75) * (0.3 + maxSteer / 0.55);
    this.steer += Math.max(-rate * dt, Math.min(rate * dt, target - this.steer));
    this.h = wrapAngle(this.h + (this.v / WHEELBASE) * Math.tan(this.steer) * dt);
    this.x += Math.sin(this.h) * this.v * dt;
    this.z += -Math.cos(this.h) * this.v * dt;
    this.odo += Math.abs(this.v) * dt;

    const B = net.bounds;
    this.edge = Math.min(this.x - B[0], B[2] - this.x, this.z - B[1], B[3] - this.z);     // metres to the edge of the map
    this.x = Math.max(B[0] + 20, Math.min(B[2] - 20, this.x));
    this.z = Math.max(B[1] + 20, Math.min(B[3] - 20, this.z));

    this._match();
    const r = this.road;

    // ── walls: tunnels and bridge parapets keep the car on the deck (they open up at junctions) ──
    if (r && (r.e.tunnel || r.rel > (r.e.flags & 2 ? 0.9 : 3))) {
      const e = r.e;
      const nearJunction = r.s < net.trimStart(e, r.dir) + 3 || r.distEnd < net.trimEnd(e, r.dir) + 3;
      const margin = (e.tunnel ? 0.6 : e.sidewalk ? 2.2 : 1.0) - 0.95;
      let push = 0;
      if (r.latAB > e.paveR + margin) push = e.paveR + margin - r.latAB;
      else if (r.latAB < e.paveL - margin) push = e.paveL - margin - r.latAB;
      if (push && !nearJunction && Math.abs(push) < 4) {
        this.x += -r.tzAB * push; this.z += r.txAB * push;
        if (Math.abs(push) > 0.03 && sp > 2) {
          this.v *= Math.max(0, 1 - dt * 5);
          if (!this.crashCool && sp > 5) { this.crash = { kind: 'wall' }; this.crashCool = 3; }
        }
        this._match();
      }
    }
    // ── buildings (only matter once we have left the road) ──
    if ((this.road && this.road.outside > 0.6 && !this.road.e.tunnel) || !this.road) {
      const s = Math.sin(this.h), c = -Math.cos(this.h), hl = CAR.len / 2, hw = CAR.wid / 2;
      // only the end that is leading can hit something, so backing away from a wall always works
      const pts = this.v >= 0 ? [[hl, 0], [hl, hw], [hl, -hw]] : [[-hl, 0], [-hl, hw], [-hl, -hw]];
      for (const [f, l] of pts) {
        if (this.world.insideBuilding(this.x + s * f - c * l, this.z + c * f + s * l)) {
          this.x = px; this.z = pz;
          if (!this.crashCool && sp > 1) { this.crash = { kind: 'building' }; this.crashCool = 2; }
          this.v = -this.v * 0.15;
          this._match();
          break;
        }
      }
    }
    // ── height and pitch follow the road ──
    // on the road we ride its surface; off it, the open ground
    const rd = this.road, gy = this.world.heightAt(this.x, this.z);
    const onDeck = rd && (rd.e.tunnel || rd.rel > 0.9 || rd.rel < -0.9);
    let ty = !rd ? gy : rd.outside < 1 || onDeck ? rd.y : rd.y + (gy - rd.y) * Math.min(1, (rd.outside - 1) / 5);
    if (rd) ty = this.net.surfaceAbove(this.x, this.z, ty);          // a ramp overlapping our road is the surface we see
    this.y += (ty - this.y) * Math.min(1, dt * 12);
    const tp = this.road ? Math.atan(this.road.slope) : 0;
    this.pitch += (tp - this.pitch) * Math.min(1, dt * 6);

    // ── indicators ──
    this.blinkT += dt;
    if (this.blink) {
      this.blinkAge += dt;
      const turned = wrapAngle(this.h - this.blinkH) * this.blink;
      const laneMoved = this.road && (this.road.lane - this.blinkLane) * this.blink > 0;
      if (Math.abs(this.steer) < 0.03 && (turned > 0.6 || (laneMoved && this.blinkAge > 2.2))) {
        this._cancelT = (this._cancelT || 0) + dt;
        if (this._cancelT > 0.5) { this.blink = 0; this._cancelT = 0; }
      } else this._cancelT = 0;
    }
    // ── head movement (shoulder checks) ──
    const lookTarget = input.lookBack ? 2.6 : input.look * 1.35;
    this.lookYaw += (lookTarget - this.lookYaw) * Math.min(1, dt * 9);
    this.lookLeftT = this.lookYaw < -0.7 ? 0 : this.lookLeftT + dt;
    this.lookRightT = this.lookYaw > 0.7 ? 0 : this.lookRightT + dt;
  }

  _match() {
    const prev = this.road ? this.road.e.id : -1;
    const m = this.net.locate(this.x, this.z, { y: this.y, heading: this.h, prev, prefer: this.prefer }, 40);
    if (!m) { this.road = null; return; }
    const e = m.e;
    const dir = Math.cos(this.h - headingOf(m.tx, m.tz)) >= 0 ? 1 : -1;
    const s = dir > 0 ? m.s : e.len - m.s;
    const nLanes = this.net.lanes(e, dir);
    const laneF = dir > 0 ? (e.oneway ? m.lat - e.offL : m.lat) / e.lw : -m.lat / e.lw;
    const seg = this.net.sample(e, m.s, this._tmp || (this._tmp = {}));
    this.road = {
      e, dir, s, distEnd: e.len - s, latAB: m.lat, txAB: m.tx, tzAB: m.tz,
      lat: m.lat * dir, d: m.d, y: m.y, rel: m.rel, on: m.on, outside: m.outside, slope: seg.slope * dir,
      laneF, lane: Math.floor(laneF), nLanes,
      wrongWay: e.oneway && dir < 0,
      wrongSide: !e.oneway && laneF < -0.25,
      heading: headingOf(m.tx * dir, m.tz * dir),
    };
  }
}

/** Exterior of the player's car in the chosen model and paint, plus a blue learner plate. */
export function buildPlayerCar(geo, model = 'tesla', paint = '#b3131f') {
  const g = new THREE.Group(), spec = geo[model] || geo.tesla;
  const body = new THREE.Mesh(spec.body, new THREE.MeshPhongMaterial({ color: paint, shininess: 70, specular: '#4a4a4a' }));
  const detail = new THREE.Mesh(spec.detail, new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 60, specular: '#222' }));
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const c = cv.getContext('2d');
  c.fillStyle = '#1c5bd0'; c.fillRect(0, 0, 64, 64);
  c.fillStyle = '#fff'; c.font = '800 54px Helvetica, Arial, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('L', 32, 36);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.17), new THREE.MeshBasicMaterial({ map: tex }));
  plate.position.set(-0.42, spec.tailY - 0.14, spec.rear + 0.05);
  g.add(body, detail, plate);
  g.traverse((o) => { o.layers.set(1); o.castShadow = true; });
  g.userData.spec = spec;
  return g;
}

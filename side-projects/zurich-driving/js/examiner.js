// The examiner: watches how the player drives and scores it against Swiss road rules.
import { C, T, wrapAngle } from './net.js';

export const CATS = {
  speed: 'Speed',
  priority: 'Right of way',
  signals: 'Lights & signs',
  lane: 'Lane discipline',
  observe: 'Signalling & observation',
  control: 'Vehicle control',
};

// sev: 1 = minor, 2 = serious, 3 = critical (an instant fail in a real test)
export const RULES = {
  speed_minor: { cat: 'speed', sev: 1, pts: 2, title: 'Slightly over the limit', de: 'Geschwindigkeit', tip: 'The limit is a maximum, not a target. Ease off before the sign, not after it.' },
  speed_serious: { cat: 'speed', sev: 2, pts: 6, title: 'Speeding', de: 'Geschwindigkeitsüberschreitung', tip: 'Built-up areas are 50 unless signed; zones are 30 or 20. In a test anything clearly over the limit is a serious fault.' },
  speed_critical: { cat: 'speed', sev: 3, pts: 15, title: 'Far over the limit', de: 'Massive Überschreitung', tip: 'More than 15 km/h over is licence-threatening territory in Switzerland, and an instant fail.' },
  red_light: { cat: 'signals', sev: 3, pts: 25, title: 'Ran a red light', de: 'Rotlicht missachtet', tip: 'Red, and red-with-yellow, both mean stop behind the line. Wait for green.' },
  yellow_late: { cat: 'signals', sev: 1, pts: 4, title: 'Went through on late yellow', de: 'Gelb überfahren', tip: 'Yellow means stop if you can do so safely. Only carry on when braking would be abrupt.' },
  stop_sign: { cat: 'signals', sev: 2, pts: 12, title: 'Rolled through a STOP', de: 'Stopp nicht eingehalten', tip: 'At a STOP sign the wheels must stop completely at the line, even when the road is empty.' },
  rbl: { cat: 'priority', sev: 2, pts: 12, title: 'Ignored right-before-left', de: 'Rechtsvortritt missachtet', tip: 'With no signs or markings, traffic from your right goes first. Approach slowly enough to stop.' },
  give_way: { cat: 'priority', sev: 2, pts: 12, title: 'Did not give way', de: 'Kein Vortritt missachtet', tip: 'The inverted triangle and shark-teeth line mean every vehicle on the road you are joining has priority.' },
  roundabout_yield: { cat: 'priority', sev: 2, pts: 12, title: 'Pulled out into the roundabout', de: 'Vortritt im Kreisel', tip: 'Traffic already in the roundabout, coming from your left, has priority. Wait for a gap.' },
  left_oncoming: { cat: 'priority', sev: 2, pts: 12, title: 'Turned left across oncoming traffic', de: 'Gegenverkehr missachtet', tip: 'When turning left you give way to oncoming vehicles going straight on or turning right, also on green.' },
  rbl_speed: { cat: 'priority', sev: 1, pts: 3, title: 'Too fast into an unmarked junction', de: 'Rechtsvortritt: zu schnell', tip: 'Where right-before-left applies, slow to walking pace until you can see into the road on your right.' },
  zebra: { cat: 'priority', sev: 3, pts: 15, title: 'Did not stop for a pedestrian', de: 'Fussgängerstreifen missachtet', tip: 'Pedestrians on, or clearly waiting at, a yellow zebra crossing have priority. Stop before the stripes.' },
  tram: { cat: 'priority', sev: 3, pts: 15, title: 'Cut in front of a tram', de: 'Tramvortritt missachtet', tip: 'Trams have priority over almost everything and cannot swerve or stop quickly. Never pull across their path.' },
  cutoff: { cat: 'priority', sev: 2, pts: 10, title: 'Forced another driver to brake hard', de: 'Behinderung', tip: 'Only pull out or change lane when nobody has to brake or swerve because of you.' },
  collision: { cat: 'control', sev: 3, pts: 30, title: 'Collision', de: 'Kollision', tip: 'Keep enough space and look where the car is going to be in two seconds, not where it is now.' },
  ped_hit: { cat: 'control', sev: 3, pts: 40, title: 'Hit a pedestrian', de: 'Fussgänger angefahren', tip: 'Scan both pavements well ahead of every crossing and be ready to stop.' },
  crash: { cat: 'control', sev: 3, pts: 20, title: 'Hit a tree, sign or building', de: 'Kollision mit Hindernis', tip: 'Slow down before the bend, steer smoothly through it.' },
  pole: { cat: 'control', sev: 2, pts: 6, title: 'Knocked down a sign or signal', de: 'Signal umgefahren', tip: 'Poles stand right at the kerb. Take corners wider and slower, and keep the wheels on the carriageway.' },
  wrong_way: { cat: 'lane', sev: 3, pts: 20, title: 'Wrong way in a one-way street', de: 'Einbahnstrasse / Einfahrt verboten', tip: 'The red disc with a white bar means no entry. Check the signs before you turn in.' },
  wrong_side: { cat: 'lane', sev: 2, pts: 8, title: 'Driving on the wrong side', de: 'Rechtsfahren', tip: 'Keep to the right half of the road; cross the centre only to pass an obstacle when it is clear.' },
  off_road: { cat: 'lane', sev: 2, pts: 6, title: 'Left the carriageway', de: 'Fahrbahn verlassen', tip: 'Mounting the kerb or pavement endangers pedestrians. Use less steering, earlier.' },
  no_signal_turn: { cat: 'observe', sev: 1, pts: 3, title: 'Turned without indicating', de: 'Blinker vergessen', tip: 'Mirror, signal, shoulder check, then turn. Indicate before you start to slow down.' },
  no_signal_lane: { cat: 'observe', sev: 1, pts: 3, title: 'Changed lane without indicating', de: 'Spurwechsel ohne Blinker', tip: 'Every lane change is announced: mirror, indicator, look over the shoulder, then move.' },
  no_signal_roundabout: { cat: 'observe', sev: 1, pts: 2, title: 'No indicator leaving the roundabout', de: 'Kreisel: Blinker rechts', tip: 'You need not signal when entering a roundabout, but you must indicate right before your exit.' },
  shoulder: { cat: 'observe', sev: 1, pts: 2, title: 'No shoulder check', de: 'Seitenblick fehlt', tip: 'Before moving right or changing lane, glance over your shoulder: cyclists hide in the blind spot.' },
  tailgate: { cat: 'control', sev: 1, pts: 4, title: 'Following too closely', de: 'Zu geringer Abstand', tip: 'Keep two seconds behind the car in front: "half the speedo" in metres.' },
  harsh_brake: { cat: 'control', sev: 1, pts: 1, title: 'Harsh braking', de: 'Abruptes Bremsen', tip: 'Look further ahead and come off the accelerator earlier so braking stays gentle.' },
  keep_right: { cat: 'lane', sev: 1, pts: 3, title: 'Stayed in the overtaking lane', de: 'Rechtsfahrgebot', tip: 'On the motorway return to the right lane as soon as you have finished overtaking.' },
  banned_turn: { cat: 'signals', sev: 2, pts: 8, title: 'Made a prohibited turn', de: 'Abbiegeverbot missachtet', tip: 'A red ring around a crossed-out arrow bans that turn. Carry on and find another way round.' },
  wrong_lane_turn: { cat: 'lane', sev: 1, pts: 3, title: 'Turned from the wrong lane', de: 'Falsch eingespurt', tip: 'Get into lane early: far right to turn right, next to the centre line to turn left.' },
};

export const PRAISE = {
  good_stop: { title: 'Full stop at the STOP line', de: 'Stopp korrekt' },
  good_yield: { title: 'Gave way correctly', de: 'Vortritt gewährt' },
  good_zebra: { title: 'Stopped for the pedestrian', de: 'Fussgänger Vortritt gewährt' },
  good_red: { title: 'Stopped at the red light', de: 'Rotlicht beachtet' },
  good_rbl: { title: 'Careful approach to right-before-left', de: 'Rechtsvortritt: vorsichtig' },
  good_roundabout: { title: 'Signalled out of the roundabout', de: 'Kreisel korrekt verlassen' },
};

export class Examiner {
  constructor(net, traffic, signals, player) {
    this.net = net; this.traffic = traffic; this.signals = signals; this.player = player;
    this.onEvent = null;
    this.strict = false;
    this.reset();
  }

  reset() {
    this.log = [];
    this.penalty = 0;
    this.cool = {};
    this.t = 0; this.driveTime = 0;
    this.ap = null;
    this.overT = 0; this.maxOver = 0; this.limitChangedT = 0; this.lastLimit = 0;
    this.wrongSideT = 0; this.wrongWayT = 0; this.offT = 0; this.tailT = 0; this.leftLaneT = 0;
    this.lastBlinkL = -99; this.lastBlinkR = -99;
    this.lane = null;
    this.zebra = new Map();
    this.counts = { stops: 0, signals: 0, yields: 0 };
    this.hitCool = 0;
    this.cleanT = -99;          // last time the player entered a junction with right of way
    this.blameT = -99;          // last lane change: others braking right after it is on the player
  }

  get score() { return Math.max(0, Math.round(100 - this.penalty)); }
  get failed() { return this.log.some((l) => l.rule && l.rule.sev === 3); }

  fault(code, detail = '', cooldown = 6) {
    if (this.cool[code] > this.t) return false;
    this.cool[code] = this.t + cooldown;
    const rule = RULES[code];
    this.penalty += rule.pts;
    const ev = { t: this.t, code, rule, detail, good: false };
    this.log.push(ev);
    if (this.onEvent) this.onEvent(ev);
    return true;
  }

  praise(code, cooldown = 5) {
    if (this.cool[code] > this.t) return;
    this.cool[code] = this.t + cooldown;
    const ev = { t: this.t, code, rule: PRAISE[code], detail: '', good: true };
    this.log.push(ev);
    if (this.onEvent) this.onEvent(ev);
  }

  update(dt, t) {
    this.t = t;
    const p = this.player, r = p.road, net = this.net, v = Math.abs(p.v), kmh = v * 3.6;
    if (v > 0.5) this.driveTime += dt;
    if (p.blink < 0 || p.hazard) this.lastBlinkL = t;
    if (p.blink > 0 || p.hazard) this.lastBlinkR = t;
    this.hitCool = Math.max(0, this.hitCool - dt);

    // ── collisions ──
    if (p.crash) this.fault(p.crash.kind === 'pole' ? 'pole' : 'crash', '', p.crash.kind === 'pole' ? 1 : 3);
    const hit = this.traffic.playerHit();
    if (hit) {
      const o = hit.owner, dx = hit.x - p.x, dz = hit.z - p.z, d = Math.hypot(dx, dz) || 1;
      // only the player's fault if the player was moving into the other party
      const closing = ((dx * Math.sin(p.h) - dz * Math.cos(p.h)) / d) * p.v;
      const hadPriority = !o.isPed && !o.isTram && t - this.cleanT < 6;     // they pulled out on us
      if (!this.hitCool && !hadPriority && (closing > 0.8 || (o.isPed && v > 0.6))) {
        this.fault(o.isPed ? 'ped_hit' : 'collision', o.isTram ? 'with a tram' : o.isPed ? '' : `with a ${o.K ? (o.K.car ? 'car' : o.K.name) : 'vehicle'}`, 3);
        this.hitCool = 2.5;
      }
      p.x -= (dx / d) * 0.12; p.z -= (dz / d) * 0.12;
      const fresh = !(o.halt > 2.4);
      if (o.K && !o.isPed) {                // a road vehicle: it takes the blow and is shunted away
        if (fresh && closing > 1) { this.traffic.shove(o, p); p.v *= 0.45; } else if (closing > 0.3) p.v *= 0.8;
      } else if (closing > 0.3) p.v *= -0.1;  // a tram does not budge
      if (!o.isPed) { o.v = 0; o.halt = 3; }  // whatever we hit stops driving, so the player can back away
    }
    for (const ev of this.traffic.events) {
      if (ev.type === 'pedhit') { this.fault('ped_hit', `at ${Math.round(ev.speed * 3.6)} km/h`, 1); p.v *= 0.8; continue; }
      if (ev.kind === 'tram') { if (v > 0.8) this.fault('tram', '', 8); }
      else if (v > 1.5 && t - this.blameT < 4.5) this.fault('cutoff', 'after your lane change', 8);
    }
    this.traffic.events.length = 0;
    if (!r) return;
    const e = r.e;

    // ── speed ──
    if (e.speed !== this.lastLimit) { if (e.speed < this.lastLimit) this.limitChangedT = t; this.lastLimit = e.speed; }
    const over = kmh - e.speed;
    if (over > 3 && t - this.limitChangedT > 3 && p.gear === 'D') {
      this.overT += dt; this.maxOver = Math.max(this.maxOver, over);
      if (this.overT > 1.6) {
        const m = Math.round(this.maxOver), code = m > 15 ? 'speed_critical' : m > 7 ? 'speed_serious' : 'speed_minor';
        if (this.fault(code, `${Math.round(kmh)} in a ${e.speed} zone`, 9)) { this.overT = 0; this.maxOver = 0; }
      }
    } else { this.overT = Math.max(0, this.overT - dt * 2); if (over <= 0) this.maxOver = 0; }

    // ── position on the road ──
    const inJunction = r.s < net.trimStart(e, r.dir) + 2 || r.distEnd < net.trimEnd(e, r.dir) + 2;
    const moving = v > 1.5 && p.gear === 'D';
    this.wrongWayT = r.wrongWay && moving && r.on ? this.wrongWayT + dt : 0;
    if (this.wrongWayT > 1.0) { this.fault('wrong_way', e.name, 10); this.wrongWayT = 0; }
    this.wrongSideT = r.wrongSide && moving && !inJunction && r.on ? this.wrongSideT + dt : 0;
    if (this.wrongSideT > 1.7) { this.fault('wrong_side', '', 8); this.wrongSideT = 0; }
    this.offT = r.outside > 0.4 && v > 1 && !inJunction ? this.offT + dt : 0;
    if (this.offT > 0.8) { this.fault('off_road', '', 8); this.offT = 0; }

    // ── lane changes ──
    let L = this.lane;
    const frac = r.laneF - Math.floor(r.laneF);
    const settled = r.lane >= 0 && r.lane < r.nLanes && frac > 0.22 && frac < 0.78;
    if (!L || L.e !== e || L.dir !== r.dir) L = this.lane = { e, dir: r.dir, lane: null, pend: null, pendT: 0 };
    if (r.nLanes > 1 && !inJunction && settled) {
      if (L.pend !== r.lane) { L.pend = r.lane; L.pendT = 0; }
      L.pendT += dt;
      if (L.lane === null) { if (L.pendT > 0.6) L.lane = r.lane; }       // first settled lane on this stretch of road
      else if (r.lane !== L.lane && L.pendT > 0.45) {
        const side = r.lane > L.lane ? 1 : -1;
        const signalled = t - (side > 0 ? this.lastBlinkR : this.lastBlinkL) < 4.5;
        if (!signalled) this.fault('no_signal_lane', '', 4);
        else if (this.strict && (side > 0 ? p.lookRightT : p.lookLeftT) > 6) this.fault('shoulder', 'before the lane change', 8);
        L.lane = r.lane; this.blameT = t;
      }
    } else L.pend = null;

    // ── following distance, braking, keep right ──
    const lead = this.traffic.playerLead();
    this.tailT = lead && v > 8 && lead.gap / v < 0.8 ? this.tailT + dt : 0;
    if (this.tailT > 2.2) { this.fault('tailgate', `${lead.gap.toFixed(0)} m at ${Math.round(kmh)} km/h`, 12); this.tailT = 0; }
    if (p.acc < -7.4 && v > 6) this.fault('harsh_brake', '', 8);
    if (e.t <= T.TRUNK && !e.link && r.nLanes > 1 && r.lane >= 0 && r.lane < r.nLanes - 1 && v > 15) {
      const rightFree = this.traffic._laneFree({ e, dir: r.dir, s: r.s, v }, r.lane + 1) && this.traffic._laneFree({ e, dir: r.dir, s: r.s + 45, v }, r.lane + 1);
      this.leftLaneT = rightFree ? this.leftLaneT + dt : 0;
      if (this.leftLaneT > 14) { this.fault('keep_right', '', 25); this.leftLaneT = 0; }
    } else this.leftLaneT = 0;

    this._junctions(dt, t, r, v);
    this._crossings(dt, t, r, v);
  }

  // ───────────────────────── junctions ─────────────────────────
  _junctions(dt, t, r, v) {
    const net = this.net, p = this.player, app = this.traffic.playerApproach, e = r.e;
    let ap = this.ap;
    if (ap && !ap.crossed) {
      if (app && app.node === ap.node && app.e === ap.e && app.dir === ap.dir) {
        if (app.dist < 14) ap.minV = Math.min(ap.minV, v);
        ap.threats = this.traffic.threats(app);
        ap.oncoming = this.traffic.oncoming(app);
        if (ap.threats.length) { ap.sawThreat = true; if (v < 2.2) ap.waited = true; }
        if (ap.ctl === C.SIGNAL) {
          const st = this.signals.state(ap.e, ap.dir, t);
          if (st === 'Y') { if (ap.yellowT < 0) { ap.yellowT = t; ap.yellowDist = app.dist; ap.yellowV = v; } } else ap.yellowT = -1;
          if (st === 'R' && app.dist < 30 && v < 0.4) ap.stoppedRed = true;
        }
        if (app.dist <= 0 && v > 0.4 && p.gear === 'D') this._enterJunction(ap, t, r, v);
      } else if (e !== ap.e || r.dir !== ap.dir) {
        // left the approach some other way (cut the corner, or turned round)
        if (e !== ap.e && net.startNode(e, r.dir) === ap.node) this._enterJunction(ap, t, null, v);
        else ap = this.ap = null;
      }
    }
    if (ap && ap.crossed) {
      if (e !== ap.e) {
        if (net.startNode(e, r.dir) === ap.node) {
          // only trust an exit road once the car is really pointing along it
          if (r.on && Math.cos(p.h - net.heading(e, r.dir, false)) > 0.8) { ap.exitE = e; ap.exitDir = r.dir; }
          if (ap.exitE === e && r.s > net.trimStart(e, r.dir) + 3.5) { this._exitJunction(ap, t, e, r.dir); ap = this.ap = null; }
        } else if (e.a !== ap.node && e.b !== ap.node) {
          if (ap.exitE) this._exitJunction(ap, t, ap.exitE, ap.exitDir);        // short exit road, already beyond it
          ap = this.ap = null;
        }
      } else if (r.dir !== ap.dir) ap = this.ap = null;
      if (ap && t - ap.crossT > 12) ap = this.ap = null;
    }
    if (!this.ap && app && app.dist < 50 && app.dist > -2) {
      this.ap = { node: app.node, e: app.e, dir: app.dir, ctl: app.ctl, h: app.h, minV: 99, sawThreat: false, waited: false, crossed: false, crossT: 0, threats: [], oncoming: [], yellowT: -1, clean: true, stoppedRed: false, lane: -1, nLanes: 1 };
    }
  }

  _enterJunction(ap, t, r, v) {
    const net = this.net;
    ap.crossed = true; ap.crossT = t; ap.vIn = v;
    if (r) { ap.lane = r.lane; ap.nLanes = r.nLanes; }
    const node = net.nodes[ap.node];
    const roundabout = node.ends.some((en) => net.edges[en.e].roundabout);
    if (ap.ctl === C.SIGNAL) {
      const st = this.signals.state(ap.e, ap.dir, t);
      if (st === 'R' || st === 'RY') { this.fault('red_light', ap.e.name, 6); ap.clean = false; }
      else if (st === 'Y' && ap.yellowT >= 0 && ap.yellowDist > (ap.yellowV * ap.yellowV) / 7 + ap.yellowV * 0.8 + 2) { this.fault('yellow_late', '', 6); ap.clean = false; }
      else if (ap.stoppedRed) this.praise('good_red', 20);
      if (ap.clean) this.cleanT = t;
      return;
    }
    if (ap.e.merge) {            // acceleration lane: joining is judged like a lane change, not a give-way line
      ap.clean = false; this.blameT = t;
      return;
    }
    if (ap.ctl === C.STOP) {
      if (ap.minV > 0.5) { this.fault('stop_sign', `slowest ${Math.round(ap.minV * 3.6)} km/h`, 6); ap.clean = false; }
      else { this.counts.stops++; this.praise('good_stop'); }
    }
    if (ap.threats.length) {
      ap.clean = false;
      const code = ap.ctl === C.EQUAL ? 'rbl' : roundabout ? 'roundabout_yield' : 'give_way';
      this.fault(code, ap.e.name ? `leaving ${ap.e.name}` : '', 6);
    } else if (ap.sawThreat && ap.waited) { this.counts.yields++; this.praise('good_yield'); }
    if (ap.clean) this.cleanT = t;
    if (ap.ctl === C.EQUAL) {
      // is there a road joining from the right at all?
      const fromRight = net.approaches(ap.node).some((a) => a.e !== ap.e && net.control(a.e, a.dir) === C.EQUAL && Math.sin(wrapAngle(net.heading(a.e, a.dir, true) - ap.h)) < -0.5);
      if (fromRight) {
        if (v > 8.6) this.fault('rbl_speed', `${Math.round(v * 3.6)} km/h`, 6);
        else if (v < 5.6 && !ap.sawThreat) this.praise('good_rbl', 25);
      }
    }
  }

  _exitJunction(ap, t, ex, exDir) {
    const net = this.net, p = this.player;
    const angle = net.turnAngle(ap.e, ap.dir, ex, exDir);
    const turn = angle > 0.55 ? 1 : angle < -0.55 ? -1 : 0;
    const from = ap.crossT - 4.5;
    if (net.banned(ap.e, ap.dir, ex)) this.fault('banned_turn', ex.name ? `into ${ex.name}` : '', 6);
    if (ap.e.merge) {
      if (ap.e.gain) return;                    // the slip road became its own lane: nothing to signal
      if ((ap.e.merge > 0 ? this.lastBlinkL : this.lastBlinkR) < ap.crossT - 8) this.fault('no_signal_lane', 'when joining', 5);
      else this.counts.signals++;
      this.blameT = t;
      return;
    }
    if (ap.e.roundabout && !ex.roundabout) {
      if (this.lastBlinkR < from) this.fault('no_signal_roundabout', '', 5); else this.praise('good_roundabout', 20);
      return;
    }
    if (ex.roundabout) return;                         // entering or continuing round: no signal needed
    // lane arrows only bind where there is a real choice and the manoeuvre is unambiguous
    const clear = Math.abs(angle) < 0.3 || Math.abs(angle) > 0.9;
    const marked = clear ? net.turnsAt(ap.e, ap.dir) : null;
    const inLane = ap.nLanes > 1 && ap.lane >= 0 && ap.lane < ap.nLanes;
    if (inLane && marked && !net.laneAllows(ap.e, ap.dir, ap.lane, turn)) this.fault('wrong_lane_turn', turn === 0 ? 'went straight on from a turning lane' : 'check the lane arrows', 6);
    if (turn !== 0) {
      const last = turn > 0 ? this.lastBlinkR : this.lastBlinkL;
      if (last < from) this.fault('no_signal_turn', turn > 0 ? 'right turn' : 'left turn', 5);
      else this.counts.signals++;
      if (turn < 0 && ap.oncoming.length && ap.ctl !== C.YIELD && ap.ctl !== C.STOP) this.fault('left_oncoming', '', 6);
      if (inLane && !net.turns(ap.e, ap.dir) && ap.e.len > 45 && ((turn < 0 && ap.lane !== 0) || (turn > 0 && ap.lane !== ap.nLanes - 1))) this.fault('wrong_lane_turn', '', 6);
      if (turn > 0 && this.strict && p.lookRightT > 7) this.fault('shoulder', 'before turning right', 10);
    }
  }

  // ───────────────────────── zebra crossings ─────────────────────────
  _crossings(dt, t, r, v) {
    const e = r.e, front = r.s + 2.2;
    for (const c of e.crossings) {
      const sC = r.dir > 0 ? c.s : e.len - c.s, d = sC - front;
      if (d > 70 || d < -8) { this.zebra.delete(c.id); continue; }
      let st = this.zebra.get(c.id);
      if (!st) this.zebra.set(c.id, (st = { prev: d, sawPed: false, canStop: true, stopped: false }));
      const peds = c.pedList || [];
      let claim = false;
      for (const pd of peds) {
        if (pd.phase === 'cross') {
          const rest = Math.hypot(pd.far.x - pd.x, pd.far.z - pd.z);
          if (rest > 1.6) claim = true;
        } else if (pd.phase === 'wait' && !c.sig && t - pd.waitStart > 0.6) claim = true;
      }
      if (claim && d > 1.5) {
        if (!st.sawPed) { st.sawPed = true; st.canStop = d > (v * v) / 11 + v * 0.7 + 2; }
        if (v < 1.5 && d < 16) st.stopped = true;
      }
      // the nose reaches the stripes
      if (st.prev > 1.6 && d <= 1.6 && v > 1.2 && this.player.gear === 'D') {
        if (claim && st.canStop) this.fault('zebra', e.name, 6);
        else if (st.stopped) this.praise('good_zebra');
      }
      // stand-alone pedestrian light
      if (c.own && st.prev > 3.4 && d <= 3.4 && v > 1) {
        const s = this.signals.crossing(c, t);
        if (s === 'R' || s === 'RY') this.fault('red_light', 'pedestrian light', 6);
      }
      st.prev = d;
    }
  }

  // ───────────────────────── report ─────────────────────────
  report() {
    const groups = new Map(), cats = {};
    for (const k of Object.keys(CATS)) cats[k] = 0;
    for (const l of this.log) {
      if (l.good) continue;
      cats[l.rule.cat] += l.rule.pts;
      const g = groups.get(l.code);
      if (g) { g.n++; g.pts += l.rule.pts; } else groups.set(l.code, { code: l.code, rule: l.rule, n: 1, pts: l.rule.pts, detail: l.detail });
    }
    const faults = [...groups.values()].sort((a, b) => b.rule.sev - a.rule.sev || b.pts - a.pts);
    const good = new Map();
    for (const l of this.log) if (l.good) good.set(l.code, (good.get(l.code) || 0) + 1);
    const score = this.score, critical = this.failed;
    let grade = 'Test standard';
    if (critical) grade = 'Not yet: critical fault';
    else if (score < 60) grade = 'Needs more practice';
    else if (score < 80) grade = 'Getting there';
    else if (score < 93) grade = 'Solid drive';
    return {
      score, critical, grade, pass: !critical && score >= 80, cats, faults,
      good: [...good.entries()].map(([code, n]) => ({ code, n, rule: PRAISE[code] })),
      km: this.player.odo / 1000, minutes: this.driveTime / 60, counts: this.counts,
    };
  }
}

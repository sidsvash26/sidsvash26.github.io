// DOM heads-up display: score, directions, speed, event feed, minimap, full map and the report card.
import { T } from './net.js';
import { CATS } from './examiner.js';
import { fmtDist, PLACES } from './nav.js';

const $ = (id) => document.getElementById(id);
const ROAD_KIND = ['Motorway', 'Expressway', 'Main road', 'Main road', 'Through road', 'Local road', 'Residential', 'Begegnungszone', 'Access road'];

const ARROWS = {
  left: 'M19 21V11a4 4 0 0 0-4-4H7m0 0 4-4M7 7l4 4',
  right: 'M5 21V11a4 4 0 0 1 4-4h8m0 0-4-4m4 4-4 4',
  'keep-left': 'M15 21v-6L8 8V4m0 0L4.5 7.5M8 4l3.5 3.5',
  'keep-right': 'M9 21v-6l7-7V4m0 0-3.5 3.5M16 4l3.5 3.5',
  straight: 'M12 21V4m0 0L6.5 9.5M12 4l5.5 5.5',
  roundabout: 'M12 22v-5m0 0a5 5 0 1 1 5-5h4m0 0-3-3m3 3-3 3',
  'rb-exit': 'M5 20 L5 12 a5 5 0 0 1 5-5 h9 m0 0-4-4 m4 4-4 4',
  'ramp-left': 'M17 21V13L7 6m0 0v5m0-5h5',
  'ramp-right': 'M7 21V13l10-7m0 0v5m0-5h-5',
  exit: 'M7 21V13l10-7m0 0v5m0-5h-5',
  uturn: 'M8 21V9a4.5 4.5 0 0 1 9 0v6m0 0-3.5-3.5M17 15l3.5-3.5',
  arrive: 'M12 21s-6-5.2-6-10a6 6 0 1 1 12 0c0 4.8-6 10-6 10Zm0-8.2a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
};
const icon = (type) => `<svg viewBox="0 0 24 24" fill="none" stroke="#06131c" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="${ARROWS[type] || ARROWS.straight}"/></svg>`;

export class Hud {
  constructor(net) {
    this.net = net;
    this.mm = $('minimap').getContext('2d');
    this._mmT = 0; this._navKey = ''; this._last = {};
    this.big = null;
  }

  show(on) { $('hud').hidden = !on; }

  set(id, value) {
    if (this._last[id] === value) return;
    this._last[id] = value;
    $(id).textContent = value;
  }

  update(dt, s) {
    const { player, examiner, nav, modeLabel, view } = s;
    const r = player.road, kmh = Math.round(Math.abs(player.v) * 3.6), limit = r ? r.e.speed : 50;
    this.set('speed', kmh);
    this.set('limit', limit);
    const over = kmh > limit + 3;
    $('speed').parentElement.classList.toggle('over', over);
    $('limit').classList.toggle('over', over);
    this.set('gear', player.gear);
    this.set('street', r ? r.e.name || (r.e.roundabout ? 'Kreisel' : r.e.t <= T.TRUNK ? (r.e.link ? 'Slip road' : 'Motorway') : 'Unnamed road') : 'Off road');
    this.set('road-kind', r ? ROAD_KIND[r.e.t] + (r.e.tunnel ? ' · tunnel' : r.e.roundabout ? ' · roundabout' : r.e.oneway && r.e.t > T.TRUNK ? ' · one-way' : '') : '');
    $('blink-l').classList.toggle('on', player.blinkOn && (player.blink < 0 || player.hazard));
    $('blink-r').classList.toggle('on', player.blinkOn && (player.blink > 0 || player.hazard));
    $('chip-lim').hidden = !player.limiter;
    const look = player.lookYaw < -0.7 ? 'LOOKING LEFT' : player.lookYaw > 2 ? 'LOOKING BACK' : player.lookYaw > 0.7 ? 'LOOKING RIGHT' : '';
    $('chip-look').hidden = !look || view === 'cockpit';
    if (look) this.set('chip-look', look);

    const score = examiner.score;
    this.set('score', score);
    const ring = $('score-ring');
    if (this._last.ringScore !== score) {
      this._last.ringScore = score;
      ring.style.setProperty('--p', score);
      ring.style.setProperty('--c', score >= 85 ? 'var(--good)' : score >= 65 ? 'var(--warn)' : 'var(--bad)');
    }
    this.set('mode-label', modeLabel);
    this.set('fault-count', examiner.log.filter((l) => !l.good).length);
    const sec = Math.floor(examiner.driveTime);
    this.set('clock', `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`);

    const ins = nav.path ? nav.instr : null;
    $('nav-card').hidden = !ins;
    if (ins) {
      if (ins.type !== this._navKey) { this._navKey = ins.type; $('nav-icon').innerHTML = icon(ins.type); }
      this.set('nav-dist', ins.key === 'arrived' ? 'Stop' : fmtDist(ins.dist));
      this.set('nav-text', ins.text + (ins.type === 'straight' ? ` · ${fmtDist(nav.remaining)} to go` : ''));
    }
    this._mmT -= dt;
    if (this._mmT <= 0) { this._mmT = 0.09; this.minimap(s); }
  }

  toast(ev) {
    const feed = $('feed'), el = document.createElement('div');
    const sev = ev.good ? 'good' : ev.rule.sev === 1 ? 'minor' : '';
    el.className = `toast ${sev}`;
    el.innerHTML = `<div class="row"><b></b><span class="pts"></span></div><div class="de"></div>`;
    el.querySelector('b').textContent = ev.rule.title;
    el.querySelector('.pts').textContent = ev.good ? '✓' : `−${ev.rule.pts}`;
    el.querySelector('.de').textContent = ev.rule.de + (ev.detail ? ` · ${ev.detail}` : '');
    feed.prepend(el);
    while (feed.children.length > 4) feed.lastChild.remove();
    setTimeout(() => el.classList.add('out'), ev.good ? 3200 : 5200);
    setTimeout(() => el.remove(), ev.good ? 3700 : 5700);
  }

  clearFeed() { $('feed').innerHTML = ''; }

  minimap({ player, nav, traffic }) {
    const g = this.mm, S = 400, net = this.net, scale = 0.78, R = S / 2 / scale;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, S, S);
    g.save();
    g.beginPath(); g.arc(S / 2, S / 2, S / 2, 0, 7); g.clip();
    g.fillStyle = 'rgba(16,19,25,0.9)'; g.fillRect(0, 0, S, S);
    g.translate(S / 2, S * 0.6);
    g.rotate(-player.h);
    g.scale(scale, scale);
    g.translate(-player.x, -player.z);
    g.lineCap = 'round'; g.lineJoin = 'round';
    const draw = (minT, maxT, color, width) => {
      g.strokeStyle = color; g.lineWidth = width;
      g.beginPath();
      net.forEdgesNear(player.x, player.z, R * 1.3, (e) => {
        if (e.t < minT || e.t > maxT || (e.tunnel && !(player.road && player.road.e.tunnel))) return;
        g.moveTo(e.pts[0], e.pts[2]);
        for (let i = 1; i < e.n; i++) g.lineTo(e.pts[i * 3], e.pts[i * 3 + 2]);
      });
      g.stroke();
    };
    draw(5, 8, '#3a4352', 7);
    draw(2, 4, '#5a6679', 10);
    draw(0, 1, '#8b7a4a', 12);
    if (nav.path && nav.line.length) {
      g.strokeStyle = '#39b8ff'; g.lineWidth = 6; g.beginPath();
      let pen = false;
      const L = nav.line, lim = R * 1.5;
      for (let i = 0; i < L.length; i += 2) {
        if (Math.abs(L[i] - player.x) > lim || Math.abs(L[i + 1] - player.z) > lim) { pen = false; continue; }
        if (pen) g.lineTo(L[i], L[i + 1]); else { g.moveTo(L[i], L[i + 1]); pen = true; }
      }
      g.stroke();
    }
    for (const V of traffic.vehicles) { g.fillStyle = '#dfe5ee'; g.beginPath(); g.arc(V.x, V.z, 3.6, 0, 7); g.fill(); }
    g.fillStyle = '#4c9dff';
    for (const tr of traffic.trams) for (const sg of tr.segs) { g.beginPath(); g.arc(sg.x, sg.z, 4.4, 0, 7); g.fill(); }
    g.fillStyle = '#ffd43b';
    for (const p of traffic.peds) { g.beginPath(); g.arc(p.x, p.z, 2.4, 0, 7); g.fill(); }
    g.restore();
    // player marker
    g.save();
    g.translate(S / 2, S * 0.6);
    g.fillStyle = '#e2001a'; g.strokeStyle = '#fff'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(0, -17); g.lineTo(11, 13); g.lineTo(0, 7); g.lineTo(-11, 13); g.closePath(); g.fill(); g.stroke();
    g.restore();
    g.fillStyle = 'rgba(255,255,255,0.55)'; g.font = '700 22px system-ui'; g.textAlign = 'center';
    const nx = S / 2 + Math.sin(-player.h) * (S / 2 - 22), ny = S * 0.5 - Math.cos(-player.h) * (S / 2 - 22);
    g.fillText('N', nx, ny + 8);
  }

  // ── full map ──
  openMap({ player, nav, canTeleport, onPick }) {
    const el = $('mapview'), cv = $('bigmap'), net = this.net;
    el.hidden = false;
    $('map-note').textContent = canTeleport ? 'Click a road to jump there' : 'Your route is shown in blue';
    const dpr = Math.min(2, devicePixelRatio || 1);
    const W = cv.clientWidth, H = cv.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    const g = cv.getContext('2d');
    const B = net.bounds, pad = 24;
    const sc = Math.min((W - pad * 2) / (B[2] - B[0]), (H - pad * 2) / (B[3] - B[1]));
    const ox = (W - (B[2] - B[0]) * sc) / 2 - B[0] * sc, oy = (H - (B[3] - B[1]) * sc) / 2 - B[1] * sc;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#0d1015'; g.fillRect(0, 0, W, H);
    g.lineCap = 'round'; g.lineJoin = 'round';
    const pass = (lo, hi, color, w) => {
      g.strokeStyle = color; g.lineWidth = w; g.beginPath();
      for (const e of net.edges) {
        if (e.t < lo || e.t > hi) continue;
        g.moveTo(e.pts[0] * sc + ox, e.pts[2] * sc + oy);
        for (let i = 1; i < e.n; i++) g.lineTo(e.pts[i * 3] * sc + ox, e.pts[i * 3 + 2] * sc + oy);
      }
      g.stroke();
    };
    pass(5, 7, '#232a35', 0.7); pass(2, 4, '#4a5567', 1.3); pass(0, 1, '#a08c4f', 2.1);
    if (nav.path) {
      g.strokeStyle = '#39b8ff'; g.lineWidth = 3; g.beginPath();
      for (let i = 0; i < nav.line.length; i += 2) g[i ? 'lineTo' : 'moveTo'](nav.line[i] * sc + ox, nav.line[i + 1] * sc + oy);
      g.stroke();
    }
    g.font = '600 11.5px system-ui'; g.textAlign = 'left';
    for (const p of PLACES) {
      const w = net.toWorld(p.at[0], p.at[1]), x = w.x * sc + ox, y = w.z * sc + oy;
      g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, 2.5, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.8)'; g.fillText(p.name, x + 6, y + 4);
    }
    g.fillStyle = '#e2001a'; g.strokeStyle = '#fff'; g.lineWidth = 2;
    g.beginPath(); g.arc(player.x * sc + ox, player.z * sc + oy, 6, 0, 7); g.fill(); g.stroke();
    cv.onclick = canTeleport ? (ev) => {
      const rect = cv.getBoundingClientRect();
      onPick((ev.clientX - rect.left - ox) / sc, (ev.clientY - rect.top - oy) / sc);
    } : null;
  }

  closeMap() { $('mapview').hidden = true; }

  // ── report card ──
  report(rep, title) {
    $('r-score').textContent = rep.score;
    const ring = $('r-ring');
    ring.style.setProperty('--p', rep.score);
    ring.style.setProperty('--c', rep.critical ? 'var(--bad)' : rep.score >= 80 ? 'var(--good)' : rep.score >= 60 ? 'var(--warn)' : 'var(--bad)');
    $('r-eyebrow').textContent = title;
    $('r-grade').textContent = rep.grade;
    $('r-stats').textContent = `${rep.km.toFixed(1)} km in ${Math.max(1, Math.round(rep.minutes))} min · ${rep.faults.reduce((a, f) => a + f.n, 0)} faults`;
    const cats = $('r-cats');
    cats.innerHTML = '';
    for (const [k, name] of Object.entries(CATS)) {
      const lost = rep.cats[k], el = document.createElement('div');
      el.className = 'cat';
      const pct = Math.max(0, 100 - lost * 4);
      el.innerHTML = `<div class="row"><span>${name}</span><b>${lost ? `−${lost}` : '✓'}</b></div><div class="track"><i style="width:${pct}%;background:${lost === 0 ? 'var(--good)' : lost < 8 ? 'var(--warn)' : 'var(--bad)'}"></i></div>`;
      cats.appendChild(el);
    }
    const good = $('r-good');
    good.innerHTML = '';
    for (const gd of rep.good) { const d = document.createElement('div'); d.textContent = `${gd.rule.title}${gd.n > 1 ? ` ×${gd.n}` : ''}`; good.appendChild(d); }
    if (rep.counts.signals) { const d = document.createElement('div'); d.textContent = `Indicated before ${rep.counts.signals} turn${rep.counts.signals > 1 ? 's' : ''}`; good.appendChild(d); }
    $('r-good-h').hidden = !good.children.length;
    const faults = $('r-faults');
    faults.innerHTML = '';
    if (!rep.faults.length) {
      faults.innerHTML = '<div class="clean">A clean drive. No faults recorded.</div>';
    }
    for (const f of rep.faults) {
      const el = document.createElement('div');
      el.className = `fault s${f.rule.sev}`;
      el.innerHTML = `<div class="row"><b></b><span class="n"></span></div><div class="de"></div><p></p>`;
      el.querySelector('b').textContent = f.rule.title;
      el.querySelector('.n').textContent = `${f.n > 1 ? `${f.n}× · ` : ''}−${f.pts}`;
      el.querySelector('.de').textContent = f.rule.de + (f.rule.sev === 3 ? ' · critical' : '');
      el.querySelector('p').textContent = f.rule.tip;
      faults.appendChild(el);
    }
  }
}

/** Small synthesised sound set: engine hum, indicator tick, chimes. */
export class Sound {
  constructor() { this.on = true; this.ctx = null; this._tick = false; }
  _init() {
    if (this.ctx || !this.on) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain(); this.master.gain.value = 0.5; this.master.connect(ctx.destination);
    this.osc = ctx.createOscillator(); this.osc.type = 'sawtooth';
    this.osc2 = ctx.createOscillator(); this.osc2.type = 'triangle';
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260;
    this.eg = ctx.createGain(); this.eg.gain.value = 0;
    this.osc.connect(lp); this.osc2.connect(lp); lp.connect(this.eg); this.eg.connect(this.master);
    this.osc.start(); this.osc2.start();
    this.lp = lp;
  }
  resume() { this._init(); if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
  engine(speed, throttle, active) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, f = 38 + Math.abs(speed) * 2.3 + throttle * 16;
    this.osc.frequency.setTargetAtTime(f, t, 0.08);
    this.osc2.frequency.setTargetAtTime(f * 1.5, t, 0.08);
    this.lp.frequency.setTargetAtTime(220 + throttle * 320 + Math.abs(speed) * 6, t, 0.1);
    this.eg.gain.setTargetAtTime(active && this.on ? 0.035 + throttle * 0.03 : 0, t, 0.1);
  }
  blip(freq, dur = 0.08, type = 'sine', vol = 0.12) {
    if (!this.ctx || !this.on) return;
    const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  }
  tick(on) { if (on !== this._tick) { this._tick = on; this.blip(on ? 1500 : 1100, 0.025, 'square', 0.035); } }
  good() { this.blip(880, 0.12); setTimeout(() => this.blip(1320, 0.16), 90); }
  bad(sev) { this.blip(sev >= 3 ? 150 : 220, sev >= 2 ? 0.4 : 0.2, 'square', 0.07); }
}

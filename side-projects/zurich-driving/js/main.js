// Züri Drive — boot, game states and the frame loop.
import * as THREE from '../lib/three.module.min.js';
import { loadNet } from './net.js';
import { World } from './world.js';
import { buildVehicleGeometry, CAR_SPECS, PAINTS } from './models.js';
import { Input, Player, buildPlayerCar } from './player.js';
import { Cockpit } from './cockpit.js';
import { Signals, Traffic } from './traffic.js';
import { Examiner } from './examiner.js';
import { Nav, LESSONS, PLACES, fmtDist } from './nav.js';
import { Hud, Sound } from './hud.js';
import { initSigns } from './signs-ui.js';
import { addLandmarks } from './landmarks.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const QUALITY = [{ view: 600, dpr: 1, shadows: 0 }, { view: 850, dpr: 1.5, shadows: 2048 }, { view: 1150, dpr: 2, shadows: 4096 }];
const VIEWS = ['cockpit', 'chase', 'top'];
const HORIZON = '#c4d9ea';

const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(`zueridrive.${k}`)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(`zueridrive.${k}`, JSON.stringify(v)); } catch { /* private mode */ } },
};
const settings = { traffic: 2, quality: 1, mirrors: 1, ribbon: 1, voice: 1, sound: 1, strict: 0, view: 'cockpit', car: 'tesla', paint: '#b3131f', ...store.get('settings', {}) };
const best = store.get('best', {});

const setLoad = (frac, text) => { $('load-bar').style.width = `${Math.round(4 + frac * 96)}%`; if (text) $('load-text').textContent = text; };

// ───────────────────────── scene ─────────────────────────
const canvas = $('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, stencil: true, powerPreference: 'high-performance' });
const scene = new THREE.Scene();
scene.background = new THREE.Color(HORIZON);
scene.fog = new THREE.Fog(HORIZON, 180, 850);
scene.add(new THREE.HemisphereLight('#e4eeff', '#6f6a5e', 1.55));
const sun = new THREE.DirectionalLight('#fff1d6', 2.3);
const SUN_DIR = new THREE.Vector3(-0.5, 0.82, 0.42).normalize();
sun.position.copy(SUN_DIR);
sun.shadow.camera.left = sun.shadow.camera.bottom = -115;
sun.shadow.camera.right = sun.shadow.camera.top = 115;
sun.shadow.camera.near = 20; sun.shadow.camera.far = 520;
sun.shadow.camera.layers.enable(1);            // the player's own car casts a shadow too
sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.5;
scene.add(sun, sun.target);
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;         // refreshed once per frame, not once per mirror
// sky: gradient, sun glow, drifting cloud, and the Alps on the southern horizon
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(1300, 32, 16),
  new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color('#2f6fc4') }, horizon: { value: new THREE.Color(HORIZON) }, sunDir: { value: SUN_DIR }, time: { value: 0 } },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform vec3 top; uniform vec3 horizon; uniform vec3 sunDir; uniform float time; varying vec3 vP;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
      float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }
      void main(){
        vec3 d = normalize(vP);
        float h = clamp(d.y, 0.0, 1.0);
        vec3 col = mix(horizon, top, pow(h, 0.5));
        col += vec3(1.0, 0.9, 0.7) * pow(max(dot(d, sunDir), 0.0), 350.0) * 1.5 + vec3(1.0, 0.85, 0.6) * pow(max(dot(d, sunDir), 0.0), 12.0) * 0.18;
        if (d.y > 0.02) {                                   // clouds on a flat layer overhead
          vec2 uv = d.xz / (d.y + 0.12) * 1.3 + vec2(time * 0.004, 0.0);
          float c = smoothstep(0.52, 0.8, fbm(uv)) * smoothstep(0.02, 0.2, d.y);
          col = mix(col, vec3(1.0, 1.0, 1.0), c * 0.85);
        }
        // mountains: highest and snow-capped to the south (+z), low wooded hills elsewhere
        float az = atan(d.x, d.z);
        float south = smoothstep(1.9, 0.2, abs(az));
        float ridge = 0.012 + 0.03 * fbm(vec2(az * 3.0, 1.7)) + south * (0.035 + 0.075 * fbm(vec2(az * 7.0, 9.2)));
        if (d.y < ridge) {
          float snow = smoothstep(0.07, 0.1, d.y) * south;
          vec3 m = mix(vec3(0.42, 0.52, 0.56), vec3(0.93, 0.95, 0.98), snow);
          col = mix(m, horizon, 0.45 * (1.0 - snow * 0.5) + 0.25 * smoothstep(ridge, 0.0, d.y));
        }
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  }),
);
sky.renderOrder = -20;
sky.frustumCulled = false;
scene.add(sky);

let net, world, signals, traffic, player, car, cockpit, examiner, nav, hud, vehicleGeo, exterior;
const input = new Input();
const sound = new Sound();
let state = 'loading', simT = 0, current = null, mapOpen = false;
let spoken = '', spokenNow = '';

function applySettings() {
  const q = QUALITY[settings.quality];
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, q.dpr));
  renderer.setSize(innerWidth, innerHeight, false);
  scene.fog.far = q.view; scene.fog.near = q.view * 0.22;
  if (world) world.viewDist = q.view;
  renderer.shadowMap.enabled = !!q.shadows;
  sun.castShadow = !!q.shadows;
  if (q.shadows && sun.shadow.mapSize.x !== q.shadows) { sun.shadow.mapSize.set(q.shadows, q.shadows); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
  scene.traverse((o) => { if (o.material && !Array.isArray(o.material)) o.material.needsUpdate = true; });
  if (cockpit) { cockpit.resize(innerWidth, innerHeight); cockpit.mirrorsOn = !!settings.mirrors; }
  if (traffic) traffic.setDensity(settings.traffic);
  if (nav) nav.showRibbon = !!settings.ribbon;
  sound.on = !!settings.sound;
  store.set('settings', settings);
}

/** Swap the player's car body for the chosen model and paint. */
function dressCar() {
  if (exterior) { car.remove(exterior); exterior.traverse((o) => { if (o.material) o.material.dispose(); }); }
  if (!vehicleGeo[settings.car]) settings.car = 'tesla';
  exterior = buildPlayerCar(vehicleGeo, settings.car, settings.paint);
  car.add(exterior);
  if (cockpit) cockpit.paint.color.set(settings.paint);
}

async function boot() {
  applySettings();
  setLoad(0.05, 'Loading the road network…');
  net = await loadNet(new URL('../data/graph.json', import.meta.url));
  setLoad(0.35, 'Setting up junctions and signals…');
  signals = new Signals(net);
  world = new World(scene, net, { viewDist: QUALITY[settings.quality].view });
  const lm = addLandmarks(scene, net); world.suppress = lm.clear; world.solids = lm.solids; world.landmarkSites = lm.sites;          // landmarks replace the generic buildings on their plots
  await world.loadBig(new URL('../data/big.json', import.meta.url));
  setLoad(0.5, 'Building vehicles…');
  const geo = buildVehicleGeometry();
  traffic = new Traffic(scene, net, geo, signals);
  player = new Player(net, world);
  car = new THREE.Group();
  car.rotation.order = 'YXZ';
  vehicleGeo = geo;
  dressCar();
  scene.add(car);
  cockpit = new Cockpit(car, renderer, { mirrors: !!settings.mirrors });
  cockpit.paint.color.set(settings.paint);
  examiner = new Examiner(net, traffic, signals, player);
  nav = new Nav(net, scene);
  hud = new Hud(net);
  examiner.onEvent = (ev) => { hud.toast(ev); if (ev.good) sound.good(); else sound.bad(ev.rule.sev); if (ev.code === 'ped_hit') scream(); };
  applySettings();
  buildMenu();
  bindKeys();

  // park at Albisriederplatz as the menu backdrop
  const s = net.spot(47.3783, 8.5106);
  player.place(s.e, 1, s.s);
  setLoad(0.6, 'Building the streets…');
  await world.prime(player.x, player.z, (f) => setLoad(0.6 + f * 0.4));
  traffic.reset();
  $('loading').hidden = true;
  window.__zd = { net, world, traffic, player, examiner, nav, signals, cockpit, begin, LESSONS, get state() { return state; }, get simT() { return simT; }, input };

  const auto = params.get('lesson') || params.get('place');
  if (auto) {
    const lesson = LESSONS.find((l) => l.id === params.get('lesson'));
    const place = PLACES.find((p) => p.name.toLowerCase().startsWith((params.get('place') || '~').toLowerCase()));
    if (params.get('view')) settings.view = params.get('view');
    await begin(lesson ? { lesson } : { place: place || PLACES[0] });
  } else showMenu();
  let last = performance.now();
  const loop = (now) => { frame(Math.min(0.05, (now - last) / 1000)); last = now; requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
}

// ───────────────────────── states ─────────────────────────
function showMenu() {
  state = 'menu';
  hud.show(false); hud.closeMap(); mapOpen = false;
  for (const id of ['pause', 'report', 'brief']) $(id).hidden = true;
  $('menu').hidden = false;
  cockpit.mode = 'orbit';
  cockpit.showroom = !!document.querySelector('.tabs button.on[data-tab="car"]');
  nav.clear();
  player.v = 0;
  refreshBest();
  speechSynthesis?.cancel();
}

async function begin(cfg) {
  state = 'loading';
  current = cfg;
  for (const id of ['menu', 'pause', 'report', 'brief']) $(id).hidden = true;
  hud.show(false);
  $('loading').hidden = false;
  setLoad(0, cfg.lesson ? `Preparing ${cfg.lesson.title}…` : `Driving to ${cfg.place.name}…`);
  await new Promise((r) => setTimeout(r, 30));
  nav.clear();
  if (cfg.lesson) {
    const start = nav.plan(cfg.lesson.via, { avoidMotorway: !!cfg.lesson.avoidMotorway });
    if (!start) { alert('Sorry, that route could not be planned.'); $('loading').hidden = true; showMenu(); return; }
    player.place(start.e, start.dir, start.s);
  } else {
    const s = cfg.spot || net.spot(cfg.place.at[0], cfg.place.at[1]);
    player.place(s.e, s.dir || 1, s.s);
  }
  player.odo = 0; player.limiter = false; player.hazard = false; player.prefer = null; player.edge = 1e9;
  await world.prime(player.x, player.z, (f) => setLoad(f));
  traffic.reset();
  examiner.reset();
  examiner.strict = !!(settings.strict || (cfg.lesson && cfg.lesson.strict));
  hud.clearFeed();
  spoken = ''; spokenNow = '';
  cockpit.mode = settings.view;
  cockpit.snap(player);
  $('loading').hidden = true;
  hud.show(true);
  $('hint').innerHTML = '<kbd>V</kbd> view · <kbd>Q</kbd> <kbd>E</kbd> indicate · <kbd>Z</kbd> <kbd>C</kbd> look · <kbd>M</kbd> map · <kbd>Esc</kbd> pause';
  sound.resume();
  state = 'drive';
}

function pause(on) {
  if (on && state === 'drive') {
    state = 'pause';
    $('pause-brief').textContent = current.lesson ? current.lesson.brief : `Free drive from ${current.place.name}. Open the map (M) to jump somewhere else.`;
    $('pause').hidden = false;
  } else if (!on && state === 'pause') { state = 'drive'; $('pause').hidden = true; }
}

function finish() {
  if (state !== 'drive' && state !== 'pause') return;
  state = 'report';
  $('pause').hidden = true;
  const rep = examiner.report();
  if (current.lesson && rep.km > 0.2) {
    const id = current.lesson.id;
    if (!best[id] || rep.score > best[id]) { best[id] = rep.score; store.set('best', best); }
  }
  hud.report(rep, current.lesson ? current.lesson.title : `Free drive · ${current.place.name}`);
  const i = current.lesson ? LESSONS.indexOf(current.lesson) : -1;
  $('r-next').hidden = i < 0 || i >= LESSONS.length - 1;
  $('report').hidden = false;
  speechSynthesis?.cancel();
}

function brief(lesson) {
  $('b-eyebrow').textContent = `Lesson ${LESSONS.indexOf(lesson) + 1}`;
  $('b-title').textContent = lesson.title;
  $('b-text').textContent = lesson.brief;
  $('b-focus').innerHTML = lesson.focus.map((f) => `<span>${f}</span>`).join('');
  $('brief').hidden = false;
  $('b-go').onclick = () => begin({ lesson });
  $('b-back').onclick = () => { $('brief').hidden = true; };
}

// ───────────────────────── menu ─────────────────────────
function refreshBest() {
  for (const el of document.querySelectorAll('.lesson')) {
    const b = best[el.dataset.id];
    el.querySelector('.num em').textContent = b ? `best ${b}` : '';
  }
}

function buildMenu() {
  const grid = $('lesson-grid');
  LESSONS.forEach((l, i) => {
    const b = document.createElement('button');
    b.className = 'lesson';
    b.dataset.id = l.id;
    b.innerHTML = `<div class="num"><span>LESSON ${i + 1}</span><em></em></div><div class="t"></div><div class="s"></div><div class="chiprow"></div>`;
    b.querySelector('.t').textContent = l.title;
    b.querySelector('.s').textContent = l.sub;
    b.querySelector('.chiprow').innerHTML = l.focus.slice(0, 3).map((f) => `<span>${f}</span>`).join('');
    b.onclick = () => { sound.resume(); brief(l); };
    grid.appendChild(b);
  });
  const places = $('place-grid');
  for (const p of PLACES) {
    const b = document.createElement('button');
    b.textContent = p.name;
    b.onclick = () => { sound.resume(); begin({ place: p }); };
    places.appendChild(b);
  }
  for (const t of document.querySelectorAll('.tabs button')) {
    t.onclick = () => {
      for (const o of document.querySelectorAll('.tabs button')) o.classList.toggle('on', o === t);
      for (const pnl of document.querySelectorAll('.panel')) pnl.hidden = pnl.dataset.panel !== t.dataset.tab;
      cockpit.showroom = t.dataset.tab === 'car';
      $('menu').classList.toggle('showroom', cockpit.showroom);
    };
  }
  // car chooser
  const models = $('car-models'), paints = $('car-paints');
  const mark = () => {
    for (const b of models.children) b.classList.toggle('on', b.dataset.id === settings.car);
    for (const b of paints.children) b.classList.toggle('on', b.dataset.c === settings.paint);
  };
  for (const sp of CAR_SPECS) {
    const b = document.createElement('button');
    b.dataset.id = sp.id;
    b.innerHTML = '<b></b><i></i>';
    b.querySelector('b').textContent = sp.label;
    b.querySelector('i').textContent = sp.note;
    b.onclick = () => { settings.car = sp.id; store.set('settings', settings); dressCar(); mark(); };
    models.appendChild(b);
  }
  for (const [name, hex] of PAINTS) {
    const b = document.createElement('button');
    b.dataset.c = hex; b.title = name; b.style.background = hex;
    b.onclick = () => { settings.paint = hex; store.set('settings', settings); dressCar(); mark(); };
    paints.appendChild(b);
  }
  mark();
  initSigns(store);
  for (const k of ['traffic', 'quality', 'mirrors', 'ribbon', 'voice', 'sound', 'strict']) {
    const el = $(`set-${k}`);
    el.value = String(settings[k]);
    el.onchange = () => { settings[k] = +el.value; applySettings(); };
  }
  $('p-resume').onclick = () => pause(false);
  $('p-restart').onclick = () => begin(current);
  $('p-finish').onclick = finish;
  $('p-menu').onclick = showMenu;
  $('r-again').onclick = () => begin(current);
  $('r-menu').onclick = showMenu;
  $('r-next').onclick = () => { const i = LESSONS.indexOf(current.lesson); if (i >= 0 && LESSONS[i + 1]) { $('report').hidden = true; brief(LESSONS[i + 1]); } };
  $('btn-view').onclick = cycleView;
  $('btn-map').onclick = toggleMap;
  $('btn-pause').onclick = () => pause(true);
  $('map-close').onclick = toggleMap;

  if (matchMedia('(pointer: coarse)').matches) {
    $('touch').hidden = false;
    const bind = (name, down, up) => {
      const el = document.querySelector(`[data-t="${name}"]`);
      el.addEventListener('pointerdown', (ev) => { ev.preventDefault(); el.setPointerCapture(ev.pointerId); down(); });
      const end = (ev) => { ev.preventDefault(); if (up) up(); };
      el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
    };
    bind('left', () => { input.touch.steer = -1; }, () => { input.touch.steer = 0; });
    bind('right', () => { input.touch.steer = 1; }, () => { input.touch.steer = 0; });
    bind('gas', () => { input.touch.gas = 1; }, () => { input.touch.gas = 0; });
    bind('brake', () => { input.touch.brake = 1; }, () => { input.touch.brake = 0; });
    bind('blinkL', () => player.setBlink(-1));
    bind('blinkR', () => player.setBlink(1));
  }
}

/** The map ends here: put the car back on the road heading the other way. */
let turnedBackT = -99;
function turnBack() {
  turnedBackT = simT;
  const want = player.h + Math.PI;
  let best = null;
  net.forEdgesNear(player.x, player.z, 200, (e) => {
    const pr = net.project(e, player.x, player.z);
    for (const dir of e.oneway ? [1] : [1, -1]) {
      const s = dir > 0 ? pr.s : e.len - pr.s, p = net.lanePoint(e, dir, 0, s, {});
      if (Math.cos(Math.atan2(p.tx, -p.tz) - want) > 0.5 && e.len - s > 50 && (!best || pr.d < best.d)) best = { e, dir, s: Math.max(s, 3), d: pr.d };
    }
  });
  if (!best) { begin(current); return; }
  player.place(best.e, best.dir, best.s);
  player.edge = 1e9;
  player.prefer = null;
  cockpit.snap(player);
  hud.toast({ good: true, rule: { title: 'End of the practice area', de: 'Turned you round to head back' }, detail: '' });
}

function cycleView() {
  if (state !== 'drive') return;
  settings.view = VIEWS[(VIEWS.indexOf(cockpit.mode) + 1) % VIEWS.length];
  cockpit.mode = settings.view;
  cockpit.snap(player);
  store.set('settings', settings);
}

function toggleMap() {
  if (state !== 'drive' && !mapOpen) return;
  mapOpen = !mapOpen;
  if (!mapOpen) { hud.closeMap(); return; }
  hud.openMap({
    player, nav, canTeleport: !current.lesson,
    onPick: (x, z) => {
      const m = net.locate(x, z, {}, 400);
      if (!m) return;
      mapOpen = false; hud.closeMap();
      const s = Math.min(Math.max(m.s, 8), m.e.len - 8);
      begin({ place: { name: m.e.name || 'the map', at: [0, 0] }, spot: { e: m.e, dir: 1, s } });
    },
  });
}

function bindKeys() {
  const driving = (fn) => () => { if (state === 'drive' && !mapOpen) fn(); };
  input.on(['KeyQ', 'Comma'], driving(() => player.setBlink(-1)));
  input.on(['KeyE', 'Period'], driving(() => player.setBlink(1)));
  input.on('KeyH', driving(() => { player.hazard = !player.hazard; }));
  input.on('KeyL', driving(() => { player.limiter = !player.limiter; }));
  input.on(['KeyV', 'Tab'], cycleView);
  input.on('KeyM', toggleMap);
  input.on('KeyR', driving(() => {
    const r = player.road;
    if (!r) return;
    const dir = r.wrongWay ? 1 : r.dir, s = dir === r.dir ? r.s : r.e.len - r.s;
    player.place(r.e, dir, Math.min(Math.max(s, 3), r.e.len - 3), Math.max(0, Math.min(r.lane, net.lanes(r.e, dir) - 1)));
    cockpit.snap(player);
  }));
  input.on(['Escape', 'KeyP'], () => {
    if (mapOpen) { toggleMap(); return; }
    if (state === 'drive') pause(true); else if (state === 'pause') pause(false);
  });
  addEventListener('resize', applySettings);
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(true); });
  addEventListener('pointerdown', () => sound.resume(), { once: true });
}

const SHOUTS = ['Aua!', 'Hey! Pass doch auf!', 'Spinnst du?!', 'Aua, mein Bein!', 'Hesch en Vogel?!', 'Hilfe!', 'Kannst du nicht schauen?!', 'Autsch!'];
/** A knocked-over pedestrian lets you know about it, in German. */
function scream() {
  sound.blip(90, 0.18, 'square', 0.12);
  if (!settings.sound || !window.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance(SHOUTS[Math.floor(Math.random() * SHOUTS.length)]);
  u.lang = 'de-DE'; u.rate = 1.2; u.pitch = 1.2 + Math.random() * 0.5; u.volume = 1;
  speechSynthesis.speak(u);
}

function speak(text) {
  if (!settings.voice || !window.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-GB'; u.rate = 1.05; u.volume = 0.9;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

function directions() {
  const ins = nav.instr;
  if (!ins || !nav.path) return;
  if (ins.key === 'arrived') { if (spoken !== 'arrived') { spoken = 'arrived'; speak('You have arrived. Pull up and stop.'); } return; }
  if (ins.type === 'straight') return;
  if (ins.key !== spoken && ins.dist < 320) {
    spoken = ins.key;
    speak(ins.type === 'arrive' ? 'Your destination is ahead.' : `In ${fmtDist(ins.dist).replace(' m', ' metres').replace(' km', ' kilometres')}, ${ins.text.charAt(0).toLowerCase()}${ins.text.slice(1)}`);
  } else if (ins.key !== spokenNow && ins.dist < 45 && ins.key === spoken && ins.type !== 'arrive') {
    spokenNow = ins.key;
    speak(ins.text.replace(/ onto .*/, '').replace(/ \(.*/, ''));
  }
}

// ───────────────────────── frame ─────────────────────────
const lampState = (s) => (s.crossing ? signals.crossing(s.crossing, simT) : signals.state(s.e, s.dir, simT));
const camPos = new THREE.Vector3();

function simulate(dt) {
  simT += dt;
  if (state === 'drive') {
    player.update(dt, input);
    if (Math.abs(player.v) > 1) {          // trees, signs and traffic lights in the way get knocked flying
      const sp = Math.abs(player.v), dirV = Math.sign(player.v), fx = Math.sin(player.h) * dirV, fz = -Math.cos(player.h) * dirV;
      for (const side of [0, -0.75, 0.75]) {
        const x = player.x + fx * 1.95 - fz * side, z = player.z + fz * 1.95 + fx * side;
        const tree = world.treeAt(x, z, 0.45, player.y), pole = tree ? null : world.poleAt(x, z, 0.35, player.y);
        if (!tree && !pole) continue;
        // a glancing blow throws things outwards as well as forwards
        const vx = (fx - fz * side * 0.5) * sp, vz = (fz + fx * side * 0.5) * sp;
        if (tree) { world.flingTree(tree, vx, vz); player.v *= 0.7; sound.blip(70, 0.25, 'sawtooth', 0.14); }
        else { world.flingPole(pole, vx, vz); player.v *= 0.85; sound.blip(180, 0.12, 'square', 0.12); sound.blip(1400, 0.08, 'triangle', 0.08); }
        player.crash = { kind: tree ? 'tree' : 'pole' };
        break;
      }
    }
    traffic.update(dt, player, simT);
    examiner.update(dt, simT);
    nav.update(dt, player);
    directions();
    if (nav.done && Math.abs(player.v) < 1.2) finish();
    if (simT - turnedBackT > 20 && (player.edge < 140 || (player.road && player.road.distEnd < 60 && !net.exits(net.endNode(player.road.e, player.road.dir), player.road.e.id).length && player.edge < 400))) turnBack();
    sound.tick(player.blinkOn);
  } else traffic.update(dt, player, simT);
}

const FF = Math.max(1, +params.get('ff') || 1);     // ?ff=N runs the simulation N× faster (for testing)

function frame(dt) {
  const live = (state === 'drive' && !mapOpen) || state === 'menu';
  const ff = window.__zdFF || FF;
  if (live) for (let i = 0; i < ff && ((state === 'drive' && !mapOpen) || state === 'menu'); i++) { if (window.__zdStep) window.__zdStep(ff > 1 ? 1 / 30 : dt); simulate(ff > 1 ? 1 / 30 : dt); }
  sound.engine(player.v, player.throttle, state === 'drive');
  world.update(player.x, player.z, state === 'drive' ? 5 : 10);
  world.updateDebris(dt);
  car.position.set(player.x, player.y, player.z);
  car.rotation.set(player.pitch, -player.h, 0);
  const inTunnel = !!(player.road && player.road.e.tunnel && player.road.rel < -1.5);
  cockpit.update(dt, player, inTunnel, simT);
  world.updateLamps(player.x, player.z, lampState);
  cockpit.camera.getWorldPosition(camPos);
  sky.position.copy(camPos);
  if (state === 'drive' || state === 'pause') cockpit.drawDash(dt, player, player.road ? player.road.e.speed : 50);
  // the sun's shadow box follows the car in whole-texel steps, so shadow edges do not shimmer
  const step = 230 / (sun.shadow.mapSize.x || 2048) * 8;
  sun.target.position.set(Math.round(player.x / step) * step, player.y, Math.round(player.z / step) * step);
  sun.position.copy(sun.target.position).addScaledVector(SUN_DIR, 260);
  renderer.shadowMap.needsUpdate = true;
  sky.material.uniforms.time.value = simT;
  cockpit.renderMirrors(scene);
  renderer.render(scene, cockpit.camera);
  if (state === 'drive') hud.update(dt, { player, examiner, nav, traffic, view: cockpit.mode, modeLabel: current.lesson ? current.lesson.title : 'Free drive' });
  window.__frames = (window.__frames || 0) + 1;
}

boot().catch((err) => {
  console.error(err);
  $('load-text').textContent = `Could not start: ${err.message}`;
});

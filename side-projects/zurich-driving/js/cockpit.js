// Car interior, working mirrors and the three camera modes (cockpit / chase / bird's-eye).
import * as THREE from '../lib/three.module.min.js';
import { wrapAngle } from './net.js';

const EYE = new THREE.Vector3(-0.37, 1.24, 0.2);

function beam(p0, p1, t, mat) {
  const a = new THREE.Vector3(...p0), b = new THREE.Vector3(...p1), d = b.clone().sub(a);
  const m = new THREE.Mesh(new THREE.BoxGeometry(t, d.length(), t), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return m;
}
function slab(w, h, d, x, y, z, mat, rx = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.rotation.x = rx;
  return m;
}

export class Cockpit {
  /** `car` is the player's Group; interior and mirror cameras are attached to it. */
  constructor(car, renderer, opts = {}) {
    this.car = car;
    this.renderer = renderer;
    this.mirrorsOn = opts.mirrors !== false;
    const L = THREE.MeshLambertMaterial;
    const dark = new L({ color: '#1b1c1f' }), mid = new L({ color: '#2a2c30' }), trim = new L({ color: '#35373c' }), paint = (this.paint = new THREE.MeshPhongMaterial({ color: '#b3131f', shininess: 110, specular: '#9a9a9a' }));
    const g = (this.group = new THREE.Group());

    // dashboard, hood, sills, pillars, roof
    g.add(slab(1.62, 0.34, 0.62, 0, 0.73, -0.72, dark));
    g.add(slab(1.62, 0.05, 0.16, 0, 0.9, -1.0, dark, 0.5));
    g.add(slab(0.52, 0.045, 0.3, EYE.x, 1.045, -0.6, mid));                     // instrument cowl: a brow over the display
    g.add(slab(0.52, 0.16, 0.1, EYE.x, 0.975, -0.7, mid));
    g.add(slab(0.34, 0.46, 0.5, 0.02, 0.5, -0.3, mid));                         // centre console
    const hood = slab(1.72, 0.05, 1.25, 0, 0.83, -1.62, paint, 0.085);
    g.add(hood);
    for (const sx of [-1, 1]) {
      g.add(slab(0.14, 0.7, 2.4, sx * 0.86, 0.62, 0.15, dark));                 // door
      g.add(slab(0.05, 0.035, 2.3, sx * 0.8, 0.975, 0.1, trim));                // window sill
      g.add(beam([sx * 0.85, 0.9, -0.74], [sx * 0.71, 1.57, -0.1], 0.05, dark));  // A pillar
      g.add(beam([sx * 0.83, 0.96, 0.55], [sx * 0.7, 1.56, 0.5], 0.11, dark));   // B pillar
      g.add(beam([sx * 0.71, 1.57, -0.1], [sx * 0.7, 1.56, 1.3], 0.07, dark));   // roof rail
      g.add(beam([sx * 0.8, 0.98, 1.55], [sx * 0.68, 1.56, 1.15], 0.14, dark));  // C pillar
    }
    g.add(slab(1.46, 0.05, 1.56, 0, 1.6, 0.66, mid));                            // roof
    g.add(slab(1.44, 0.06, 0.1, 0, 1.585, -0.1, dark));                          // windscreen header
    g.add(slab(1.5, 0.5, 0.1, 0, 0.74, 1.62, dark));                             // rear shelf wall
    g.add(slab(0.5, 0.75, 0.12, -0.37, 0.72, 0.5, mid, -0.12));                  // driver seat back (seen when looking back)
    g.add(slab(0.5, 0.75, 0.12, 0.37, 0.72, 0.5, mid, -0.12));

    // steering wheel
    const wheel = (this.wheel = new THREE.Group());
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.175, 0.017, 8, 28), new L({ color: '#0f1012' }));
    wheel.add(rim, slab(0.34, 0.035, 0.02, 0, 0, 0, dark), slab(0.035, 0.17, 0.02, 0, -0.085, 0, dark), slab(0.09, 0.07, 0.03, 0, 0, 0.005, mid));
    const column = new THREE.Group();
    column.position.set(EYE.x, 0.9, -0.34);
    column.rotation.x = -0.36;
    column.add(wheel);
    g.add(column);

    // instrument display
    const cv = (this.dashCanvas = document.createElement('canvas'));
    cv.width = 512; cv.height = 160;
    this.dashCtx = cv.getContext('2d');
    this.dashTex = new THREE.CanvasTexture(cv);
    this.dashTex.colorSpace = THREE.SRGBColorSpace;
    const disp = new THREE.Mesh(new THREE.PlaneGeometry(0.33, 0.103), new THREE.MeshBasicMaterial({ map: this.dashTex, fog: false }));
    disp.position.set(EYE.x, 0.968, -0.52);
    disp.rotation.x = -0.28;
    g.add(disp);
    this._dashT = 0;

    // mirrors: each is a camera looking back plus a plate showing its picture flipped left-right
    this.mirrors = [];
    const addMirror = (name, w, h, platePos, aim, camPos, camYaw, fov, res) => {
      const rt = new THREE.WebGLRenderTarget(res, Math.round((res * h) / w), { stencilBuffer: true, depthBuffer: true, samples: 4 });
      const geo = new THREE.PlaneGeometry(w, h);
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i));
      const plate = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: rt.texture, fog: false }));
      plate.position.set(...platePos);
      plate.lookAt(new THREE.Vector3(...aim));
      const back = new THREE.Mesh(new THREE.BoxGeometry(w + 0.03, h + 0.03, 0.035), dark);
      back.position.copy(plate.position);
      back.quaternion.copy(plate.quaternion);
      back.translateZ(-0.022);
      g.add(back, plate);
      const cam = new THREE.PerspectiveCamera(fov, w / h, 0.4, 420);
      cam.position.set(...camPos);
      cam.rotation.order = 'YXZ';
      cam.rotation.y = camYaw;
      cam.rotation.x = -0.02;
      car.add(cam);
      this.mirrors.push({ name, rt, cam, plate, back });
    };
    addMirror('centre', 0.27, 0.075, [0.02, 1.43, -0.5], [EYE.x * 0.6, EYE.y - 0.02, 0.6], [0, 1.3, 0.9], Math.PI, 15, 640);
    addMirror('left', 0.17, 0.11, [-0.99, 1.03, -0.62], [EYE.x - 0.25, EYE.y, 0.7], [-1.0, 1.03, -0.55], Math.PI - 0.22, 22, 320);
    addMirror('right', 0.17, 0.11, [0.99, 1.03, -0.62], [EYE.x + 0.6, EYE.y, 0.7], [1.0, 1.03, -0.55], Math.PI + 0.3, 22, 320);
    g.add(beam([-0.86, 1.0, -0.66], [-0.92, 1.02, -0.64], 0.05, dark), beam([0.86, 1.0, -0.66], [0.92, 1.02, -0.64], 0.05, dark));
    g.add(beam([0.02, 1.57, -0.2], [0.02, 1.47, -0.5], 0.03, dark));

    g.traverse((o) => o.layers.set(2));
    car.add(g);

    // cameras
    this.camIn = new THREE.PerspectiveCamera(70, 1, 0.1, 1500);
    this.camIn.rotation.order = 'YXZ';
    this.camIn.position.copy(EYE);
    this.camIn.layers.enable(2);
    car.add(this.camIn);
    this.camOut = new THREE.PerspectiveCamera(58, 1, 0.5, 1700);
    this.camOut.layers.enable(1);
    this.mode = 'cockpit';
    this.chaseH = 0;
    this._frame = 0;
  }

  get camera() { return this.mode === 'cockpit' ? this.camIn : this.camOut; }

  resize(w, h) {
    this._w = w; this._h = h;
    for (const c of [this.camIn, this.camOut]) { c.aspect = w / h; c.updateProjectionMatrix(); }
  }

  snap(player) { this.chaseH = player.h; this._snap = true; }

  update(dt, player, inTunnel, t = 0) {
    this.group.visible = this.mode === 'cockpit';
    this.wheel.rotation.z = -player.steer * 7.5;
    if (this.mode === 'orbit') {           // slow circling shot behind the menu
      const c = this.camOut, show = this.showroom;          // showroom: a slow walk round the car at eye level
      const a = show ? t * 0.35 : t * 0.07, R = show ? 6.6 : 85, H = show ? 1.9 : 62;
      c.fov = show ? 42 : 50; c.up.set(0, 1, 0);
      c.position.set(player.x + Math.cos(a) * R, player.y + H, player.z + Math.sin(a) * R);
      c.lookAt(player.x, player.y + (show ? 0.75 : 3), player.z);
      // in the showroom the picture is shifted right, clear of the menu column
      if (show && this._w > 900) c.setViewOffset(this._w, this._h, -this._w * 0.24, 0, this._w, this._h); else if (c.view) c.clearViewOffset();
      c.updateProjectionMatrix();
      return;
    }
    if (this.mode === 'cockpit') {
      const c = this.camIn;
      // the head eases gently into a turn instead of following the wheel directly
      this.turnLook = (this.turnLook || 0) + (player.steer * 0.22 - (this.turnLook || 0)) * Math.min(1, dt * 2.5);
      c.rotation.y = -(player.lookYaw + this.turnLook);
      c.rotation.x = -0.075;
      const lean = Math.max(-1, Math.min(1, player.lookYaw));
      c.position.set(EYE.x + lean * 0.08, EYE.y, EYE.z - Math.abs(lean) * 0.05);
      return;
    }
    if (this.camOut.view) this.camOut.clearViewOffset();
    const k = this._snap ? 1 : Math.min(1, dt * 2.4);
    this._snap = false;
    this.chaseH = wrapAngle(this.chaseH + wrapAngle(player.h - this.chaseH) * k);
    const fx = Math.sin(this.chaseH), fz = -Math.cos(this.chaseH), sp = Math.abs(player.v);
    const c = this.camOut;
    if (this.mode === 'top' && !inTunnel) {
      const hgt = 48 + sp * 1.6;
      c.fov = 50;
      c.position.set(player.x - fx * hgt * 0.25, player.y + hgt, player.z - fz * hgt * 0.25);
      c.up.set(fx, 0, fz);
      c.lookAt(player.x + fx * (8 + sp * 0.9), player.y, player.z + fz * (8 + sp * 0.9));
    } else {
      const back = 7.2 + sp * 0.09, up = inTunnel ? 2.2 : 3.0 + sp * 0.015;
      c.fov = 58;
      c.up.set(0, 1, 0);
      c.position.set(player.x - fx * back, player.y + up, player.z - fz * back);
      c.lookAt(player.x + fx * 7, player.y + 1.1, player.z + fz * 7);
    }
    c.updateProjectionMatrix();
  }

  /** Render the mirror views into their textures. Call before the main render. */
  renderMirrors(scene) {
    if (this.mode !== 'cockpit' || !this.mirrorsOn) return;
    this._frame++;
    const r = this.renderer;
    for (let i = 0; i < this.mirrors.length; i++) {
      if (i > 0 && (this._frame + i) % 2) continue;      // side mirrors refresh on alternate frames
      const m = this.mirrors[i];
      r.setRenderTarget(m.rt);
      r.clear();
      r.render(scene, m.cam);
    }
    r.setRenderTarget(null);
  }

  /** Instrument cluster drawn on a canvas texture. */
  drawDash(dt, player, limitKmh) {
    this._dashT += dt;
    if (this._dashT < 0.07) return;
    this._dashT = 0;
    const g = this.dashCtx, W = 512, H = 160;
    g.fillStyle = '#06080b'; g.fillRect(0, 0, W, H);
    const kmh = Math.round(Math.abs(player.v) * 3.6);
    const over = kmh > limitKmh + 3;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = over ? '#ff5b4d' : '#f2f4f7';
    g.font = '700 96px Helvetica, Arial, sans-serif';
    g.fillText(String(kmh), 256, 76);
    g.fillStyle = '#7f8894'; g.font = '600 22px Helvetica, Arial, sans-serif';
    g.fillText('km/h', 256, 138);
    // speed bar
    g.fillStyle = '#1b2028'; g.fillRect(150, 150, 212, 5);
    g.fillStyle = over ? '#ff5b4d' : '#4fd08a'; g.fillRect(150, 150, Math.min(212, (kmh / 140) * 212), 5);
    // gear and limit (kept towards the middle: the wheel rim hides the edges of the display)
    g.fillStyle = '#c6ccd4'; g.font = '700 34px Helvetica, Arial, sans-serif';
    g.fillText(player.gear, 372, 112);
    g.strokeStyle = '#e03131'; g.lineWidth = 6; g.beginPath(); g.arc(146, 110, 24, 0, 7); g.stroke();
    g.fillStyle = '#f2f4f7'; g.font = '700 24px Helvetica, Arial, sans-serif'; g.fillText(String(limitKmh), 146, 112);
    // indicators
    const arrow = (x, dir, on) => {
      g.fillStyle = on ? '#3df07c' : '#1a2a20';
      g.beginPath(); g.moveTo(x + dir * 22, 40); g.lineTo(x, 22); g.lineTo(x, 32); g.lineTo(x - dir * 18, 32); g.lineTo(x - dir * 18, 48); g.lineTo(x, 48); g.lineTo(x, 58); g.closePath(); g.fill();
    };
    arrow(150, -1, player.blinkOn && (player.blink < 0 || player.hazard));
    arrow(362, 1, player.blinkOn && (player.blink > 0 || player.hazard));
    if (player.limiter) { g.fillStyle = '#ffc94d'; g.font = '700 16px Helvetica, Arial, sans-serif'; g.fillText('LIM', 372, 142); }
    this.dashTex.needsUpdate = true;
  }
}

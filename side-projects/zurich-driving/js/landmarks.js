// Hand-built Zürich landmarks. Shapes are simplified and positions approximate: they are there to
// make the skyline recognisable, not to be surveyed models.
import * as THREE from '../lib/three.module.min.js';

const L = THREE.MeshLambertMaterial;

function glassTexture(a, b, cols = 4, rows = 6) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g = cv.getContext('2d');
  g.fillStyle = b; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    g.fillStyle = (i * 7 + j * 3) % 5 === 0 ? b : a;
    g.fillRect((i * 128) / cols + 1.5, (j * 128) / rows + 1.5, 128 / cols - 3, 128 / rows - 3);
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Adds the landmarks to the scene. Returns `clear`, the areas where generic map buildings must be left out
 * because a landmark stands there instead, and `solids`, the footprints a car cannot drive through.
 */
export function addLandmarks(scene, net) {
  const root = new THREE.Group(), clear = [], solids = [], sites = [];
  const stone = new L({ color: '#cfc6b4' }), cream = new L({ color: '#e3dac6' }), copper = new L({ color: '#5f9a86' }), slate = new L({ color: '#4d5560' });
  const face = new L({ color: '#f1ede2' }), gold = new L({ color: '#c9a646' }), concrete = new L({ color: '#a9a8a2' }), brick = new L({ color: '#9a5341' }), dark = new L({ color: '#22262b' });

  /** A group standing on the ground at a lat/lon, turned so its local −z points along `facing` degrees (0 = north). */
  const site = (lat, lon, facing = 0, suppress = 0, minH = 0) => {
    const w = net.toWorld(lat, lon), g = new THREE.Group();
    g.position.set(w.x, net.ground(w.x, w.z), w.z);
    g.rotation.y = (-facing * Math.PI) / 180;
    root.add(g);
    const c = suppress ? { x: w.x, z: w.z, r: suppress, minH } : null;
    if (c) clear.push(c);
    sites.push({ g, c, from: solids.length });
    return g;
  };
  /** Marks a footprint of the landmark as solid: half sizes along local x and z, an ellipse when `round`. */
  const solid = (g, hw, hd, x = 0, z = 0, round = false) => solids.push({ px: g.position.x, pz: g.position.z, c: Math.cos(g.rotation.y), s: Math.sin(g.rotation.y), x, z, hw, hd, round });
  const box = (g, w, h, d, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y + h / 2, z); g.add(m); return m; };
  const cyl = (g, r0, r1, h, mat, x = 0, y = 0, z = 0, seg = 16) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, h, seg), mat); m.position.set(x, y + h / 2, z); g.add(m); return m; };
  /** A pitched roof: w along local x, d along z, ridge along x (or along z when `turn`). */
  const gable = (g, w, h, d, mat, x = 0, y = 0, z = 0, turn = false) => {
    const a = w / 2, b = d / 2;
    const P = [[-a, 0, b], [a, 0, b], [a, 0, -b], [-a, 0, -b], [-a, h, 0], [a, h, 0]];
    const T = [[0, 1, 5], [0, 5, 4], [2, 3, 4], [2, 4, 5], [3, 0, 4], [1, 2, 5]];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(T.flat().flatMap((i) => P[i]), 3));
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (turn) m.rotation.y = Math.PI / 2; g.add(m); return m;
  };
  const cone = (g, r, h, mat, x = 0, y = 0, z = 0, seg = 4) => { const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), mat); m.position.set(x, y + h / 2, z); m.rotation.y = Math.PI / 4; g.add(m); return m; };
  const dome = (g, r, mat, x = 0, y = 0, z = 0, squash = 1) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat); m.position.set(x, y, z); m.scale.y = squash; g.add(m); return m; };

  // ── old town churches ──
  const tile = new L({ color: '#8a4a36' });
  { const g = site(47.37005, 8.54395, 0, 45, 25);                        // Grossmünster: twin towers
    for (const dz of [-7, 7]) { box(g, 9, 44, 9, stone, 0, 0, dz); box(g, 7, 12, 7, stone, 0, 44, dz); cyl(g, 4.4, 3.6, 5, stone, 0, 56, dz, 8); dome(g, 3.6, copper, 0, 61, dz, 1.5); }
    solid(g, 4.5, 11.5); solid(g, 17, 11, 21, 0); box(g, 34, 22, 22, stone, 21, 0, 0); gable(g, 34, 9, 22, tile, 21, 22, 0); }
  { const g = site(47.36985, 8.54155, 0, 45, 25); box(g, 10, 46, 10, stone); cone(g, 7.4, 36, copper, 0, 46);
    solid(g, 5, 5); solid(g, 22, 9, -12, 14); box(g, 44, 20, 18, stone, -12, 0, 14); gable(g, 44, 9, 18, copper, -12, 20, 14); }             // Fraumünster
  { const g = site(47.37105, 8.54085, 0, 45, 25); box(g, 10, 40, 10, stone); cone(g, 7.6, 24, slate, 0, 40);
    solid(g, 5, 5); solid(g, 15, 9.5, -20, 0); box(g, 30, 15, 19, cream, -20, 0, 0); gable(g, 30, 8, 19, tile, -20, 15, 0);               // St. Peter and its clock faces
    for (let k = 0; k < 4; k++) { const a = (k * Math.PI) / 2;
      const c = new THREE.Mesh(new THREE.CircleGeometry(4.3, 24), face); c.position.set(Math.sin(a) * 5.06, 33, Math.cos(a) * 5.06); c.rotation.y = a; g.add(c);
      const ring = new THREE.Mesh(new THREE.RingGeometry(4.0, 4.4, 24), gold); ring.position.set(Math.sin(a) * 5.1, 33, Math.cos(a) * 5.1); ring.rotation.y = a; g.add(ring); } }
  { const g = site(47.37385, 8.54545, 0, 45, 25); box(g, 5, 38, 5, stone, 0, 0, -9); cone(g, 3.8, 50, copper, 0, 38, -9);
    solid(g, 23, 8); box(g, 46, 24, 16, cream); gable(g, 46, 12, 16, tile, 0, 24, 0); }               // Predigerkirche
  { const g = site(47.3625, 8.5300);                                                                              // Kirche Enge on its hill
    solid(g, 13, 13); solid(g, 3.5, 3.5, 0, -17); box(g, 26, 16, 26, cream); cyl(g, 9.5, 9.5, 8, cream, 0, 16); dome(g, 9.5, copper, 0, 24, 0, 1.1); box(g, 7, 46, 7, cream, 0, 0, -17); cone(g, 5.2, 14, copper, 0, 46, -17); }

  // ── towers that mark the skyline: kept visible through the haze ──
  const far = (mat) => { mat.fog = false; return mat; };
  { const g = site(47.3861, 8.5173, 20, 30);                                                                       // Prime Tower
    solid(g, 22, 15, 0, 0, true);
    const tex = glassTexture('#4f8f86', '#2c5a57'); tex.repeat.set(6, 22);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(20, 16, 126, 6), far(new THREE.MeshPhongMaterial({ map: tex, shininess: 90, specular: '#8fb8b0' })));
    m.position.y = 63; m.scale.set(1.25, 1, 0.85); g.add(m); }
  { const g = site(47.3895, 8.5268, 35, 70, 60);                                                                       // Swissmill grain silo
    solid(g, 12, 15); box(g, 24, 118, 30, far(new L({ color: '#b3b2ad' }))); box(g, 24.4, 3, 30.4, far(new L({ color: '#8e8d88' })), 0, 112); }
  { const g = site(47.3493, 8.4903);                                                                               // Uetliberg television tower
    const shaft = far(new L({ color: '#c9c8c2' })), red = far(new L({ color: '#c4372c' })), white = far(new L({ color: '#eeeeea' }));
    solid(g, 3.6, 3.6, 0, 0, true); cyl(g, 3.6, 2.4, 100, shaft); cyl(g, 7, 7, 4, shaft, 0, 96); cyl(g, 5.5, 5.5, 3, shaft, 0, 104);
    for (let k = 0; k < 8; k++) cyl(g, 1.0 - k * 0.07, 0.93 - k * 0.07, 10, k % 2 ? white : red, 0, 107 + k * 10, 0, 8); }

  // ── civic buildings ──
  { const g = site(47.3764, 8.5482); cyl(g, 14, 14, 7, stone, 0, 30); dome(g, 14, new L({ color: '#7fa79a' }), 0, 37, 0, 0.9); }           // ETH main building dome
  { const g = site(47.3743, 8.5485); solid(g, 6.5, 6.5); box(g, 13, 58, 13, cream); box(g, 15, 3, 15, cream, 0, 58); dome(g, 7.4, copper, 0, 61, 0, 1.25); }        // University tower
  { const g = site(47.3792, 8.5406);                                                                                                          // Landesmuseum tower
    solid(g, 5, 5); box(g, 10, 40, 10, stone); cone(g, 8.2, 20, slate, 0, 40);
    for (const [dx, dz] of [[-5, -5], [5, -5], [-5, 5], [5, 5]]) { cyl(g, 1.6, 1.6, 8, stone, dx, 36, dz, 8); cone(g, 2.1, 6, slate, dx, 44, dz, 8); } }
  { const g = site(47.3650, 8.5468, 270, 34);                                                                                                 // Opera House, portico towards the square
    solid(g, 22, 18, 0, 4); solid(g, 15, 4, 0, -17); box(g, 44, 19, 36, cream, 0, 0, 4); box(g, 24, 31, 22, cream, 0, 0, 14); box(g, 46, 1.4, 38, stone, 0, 19, 4);
    box(g, 30, 1.5, 8, stone, 0, 0, -17); box(g, 30, 1.6, 7, stone, 0, 12.5, -17);
    for (let k = 0; k < 8; k++) cyl(g, 0.75, 0.65, 11, face, -13.1 + k * 3.74, 1.5, -19.2, 10);
    gable(g, 7, 5, 30, stone, 0, 14.1, -17, true);
    dome(g, 5, copper, 0, 31, 14, 0.7); }
  { const g = site(47.3776, 8.5398, 180, 0);                                                                                                  // Hauptbahnhof: the triumphal-arch entrance
    solid(g, 6.5, 4.5, -13.5, 0); solid(g, 6.5, 4.5, 13.5, 0); box(g, 13, 26, 9, stone, -13.5, 0, 0); box(g, 13, 26, 9, stone, 13.5, 0, 0); box(g, 40, 7, 9, stone, 0, 19, 0); box(g, 42, 1.4, 10, cream, 0, 26, 0);
    const arch = new THREE.Mesh(new THREE.CircleGeometry(7, 20, 0, Math.PI), dark); arch.position.set(0, 12, -4.56); arch.rotation.y = Math.PI; g.add(arch);
    box(g, 14, 12, 0.1, dark, 0, 0, -4.56); box(g, 5, 6, 5, stone, 0, 27.4, 0); cone(g, 2.4, 4, copper, 0, 33.4, 0, 8); }
  { const g = site(47.4117, 8.5512, 20, 64);                                                                                                  // Hallenstadion
    solid(g, 50, 40, 0, 0, true);
    const hall = cyl(g, 1, 1, 17, concrete, 0, 0, 0, 28); hall.scale.set(50, 1, 40);
    const roof = dome(g, 1, new L({ color: '#8d9399' }), 0, 17, 0, 1); roof.scale.set(50, 7, 40); }
  { const g = site(47.3582, 8.5225); solid(g, 2.4, 2.4, 0, 0, true); cyl(g, 2.4, 1.6, 60, brick, 0, 0, 0, 12); cyl(g, 1.8, 1.8, 1.2, dark, 0, 60, 0, 12); }                     // Sihlcity chimney

  // The coordinates are approximate, so a footprint can land on a carriageway: slide such a landmark to the
  // nearest spot where it stands clear of every road.
  const overlap = (list, ox, oz) => {
    let bad = 0;
    for (const b of list) for (let k = 0; k < 96; k++) {
      const a = (k / 48) * Math.PI * 2, pad = k < 48 ? 0 : 2.5;
      let ux = Math.cos(a), uz = Math.sin(a);
      if (!b.round) { const m = Math.max(Math.abs(ux), Math.abs(uz)); ux /= m; uz /= m; }
      const lx = b.x + ux * (b.hw + pad), lz = b.z + uz * (b.hd + pad);
      const hit = net.locate(b.px + ox + lx * b.c + lz * b.s, b.pz + oz - lx * b.s + lz * b.c, {}, 30);
      if (hit && hit.outside < 1.5 && Math.abs(hit.rel) < 3) bad++;
    }
    return bad;
  };
  sites.forEach((st, i) => {
    const list = solids.slice(st.from, i + 1 < sites.length ? sites[i + 1].from : solids.length);
    if (!list.length || !overlap(list, 0, 0)) return;
    let best = [0, 0], least = 1e9;
    search: for (let r = 4; r <= 90; r += 4) for (let k = 0; k < 16; k++) {
      const ox = Math.cos((k * Math.PI) / 8) * r, oz = Math.sin((k * Math.PI) / 8) * r, bad = overlap(list, ox, oz);
      if (bad < least) { least = bad; best = [ox, oz]; }
      if (!bad) break search;
    }
    st.g.position.x += best[0]; st.g.position.z += best[1];
    st.g.position.y = net.ground(st.g.position.x, st.g.position.z);
    for (const b of list) { b.px += best[0]; b.pz += best[1]; }
    if (st.c) { st.c.x += best[0]; st.c.z += best[1]; }
    st.moved = Math.hypot(best[0], best[1]); st.left = least;
  });

  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(root);
  return { clear, solids, sites };
}

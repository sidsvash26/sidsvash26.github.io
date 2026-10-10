// ─────────────────────────────────────────────────────────────
// Swiss traffic signs (SSV-style), markings & lights — pure SVG.
// ─────────────────────────────────────────────────────────────
const RED = '#e30613', BLUE = '#0059b3', YEL = '#ffd200', BLK = '#161616', WHT = '#ffffff';
const svg = (inner, vb = '0 0 100 100') => `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
const g = (inner, tx = 50, ty = 58, s = 1, fill = BLK) => `<g transform="translate(${tx} ${ty}) scale(${s})" fill="${fill}">${inner}</g>`;

// Shapes
const triangle = (inner) => svg(`<path d="M50 10 L93 86 H7 Z" fill="${WHT}" stroke="${RED}" stroke-width="9" stroke-linejoin="round"/>${inner}`);
const invTriangle = (inner = '') => svg(`<path d="M7 14 H93 L50 90 Z" fill="${WHT}" stroke="${RED}" stroke-width="9" stroke-linejoin="round"/>${inner}`);
const prohib = (inner, bg = WHT) => svg(`<circle cx="50" cy="50" r="44" fill="${bg}" stroke="${RED}" stroke-width="10"/>${inner}`);
const mandatory = (inner) => svg(`<circle cx="50" cy="50" r="47" fill="${BLUE}" stroke="${WHT}" stroke-width="2"/>${inner}`);
const info = (inner) => svg(`<rect x="4" y="4" width="92" height="92" rx="9" fill="${BLUE}" stroke="${WHT}" stroke-width="3"/>${inner}`);
const asphalt = (inner) => svg(`<rect x="0" y="0" width="100" height="100" rx="14" fill="#5b5f66"/>${inner}`);

// Glyphs (drawn around 0,0 in ~40×40 box)
const PED = `<circle cx="1" cy="-15" r="4.6"/><path d="M-2.5-9.5h6.5l2.2 9.5 5.3 14.5-4.6 1.8-4.6-12.5-3.4 4.6-4.4 8.6-4.4-2.2 5.2-11-.2-6.6-4.6 5.4-3.2-2.4z"/><path d="M4-8.5l7.5 6.5-2.4 2.6-6-4.8z"/>`;
const BIKE = (c = BLK) => `<g fill="none" stroke="${c}" stroke-width="3"><circle cx="-11" cy="8" r="7.5"/><circle cx="12" cy="8" r="7.5"/><path d="M-11 8 L-3 -5 H9 L12 8 M-3-5 L1 8 H-11 M9-5 L7-10 H11" stroke-linejoin="round"/></g>`;
const CYCLIST = `${BIKE()}<circle cx="1" cy="-17" r="4"/><path d="M-1-12 L4-11 L8-5 L2-4 L4 3 L0 3 L-2-5 Z"/>`;
const CAR_SIDE = (c = BLK) => `<path fill="${c}" d="M-19 5 V-1 L-15-3 L-9-4 L-5-11 H8 L13-4 L18-3 L19 5 Z"/><circle cx="-10" cy="5" r="4.2" fill="${c}"/><circle cx="11" cy="5" r="4.2" fill="${c}"/><path d="M-3-9 H3 V-4 H-6 Z M5-9 H7 L10-4 H5 Z" fill="${WHT}"/>`;
const CAR_REAR = (c) => `<path fill="${c}" d="M-9 7 V-2 L-6.5-9.5 H6.5 L9-2 V7 H5.5 V10.5 H2.5 V7 H-2.5 V10.5 H-5.5 V7 Z"/><path d="M-5-7.5 H5 L6.5-3 H-6.5 Z" fill="${WHT}"/>`;
const TRAM = `<path d="M-6-22 L6-22 M0-22 L-4-15 L4-15" stroke="${BLK}" stroke-width="2" fill="none"/><rect x="-12" y="-15" width="24" height="30" rx="4"/><rect x="-9" y="-11" width="18" height="10" rx="1.5" fill="${WHT}"/><circle cx="-7" cy="8" r="2" fill="${WHT}"/><circle cx="7" cy="8" r="2" fill="${WHT}"/><rect x="-14" y="15" width="28" height="3"/>`;
const BUS_SIDE = (c = WHT) => `<g fill="${c}"><rect x="-21" y="-11" width="42" height="18" rx="3"/><circle cx="-12" cy="9" r="4"/><circle cx="12" cy="9" r="4"/></g><g fill="${BLUE}"><rect x="-18" y="-8" width="7" height="6"/><rect x="-9" y="-8" width="7" height="6"/><rect x="0" y="-8" width="7" height="6"/><rect x="9" y="-8" width="9" height="6"/></g>`;
const ARROW_UP = (c = WHT) => `<path fill="${c}" d="M0-26 L16-8 H6 V26 H-6 V-8 H-16 Z"/>`;
const LIGHTS = `<rect x="-9" y="-22" width="18" height="44" rx="5" fill="${BLK}"/><circle cx="0" cy="-12" r="5.5" fill="${RED}"/><circle cx="0" cy="0" r="5.5" fill="${YEL}"/><circle cx="0" cy="12" r="5.5" fill="#1db954"/>`;
const STRIPES = `<g fill="${BLK}"><rect x="-20" y="16" width="6" height="5"/><rect x="-10" y="16" width="6" height="5"/><rect x="0" y="16" width="6" height="5"/><rect x="10" y="16" width="6" height="5"/></g>`;

function roundaboutArrows(color = WHT, r = 22, w = 8) {
  // three counter-clockwise arrows (as seen from above, right-hand traffic)
  let s = '';
  for (let k = 0; k < 3; k++) {
    const a0 = (k * 120 + 20) * Math.PI / 180;
    const a1 = a0 + 75 * Math.PI / 180;
    const p = (a, rr = r) => [50 + rr * Math.cos(-a), 50 + rr * Math.sin(-a)];
    const [x0, y0] = p(a0), [x1, y1] = p(a1);
    s += `<path d="M${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 0 0 ${x1.toFixed(1)} ${y1.toFixed(1)}" fill="none" stroke="${color}" stroke-width="${w}"/>`;
    const ah = a1 + 0.42;
    const [hx, hy] = p(ah);
    const [bx1, by1] = p(a1 - 0.05, r + 10);
    const [bx2, by2] = p(a1 - 0.05, r - 10);
    s += `<path d="M${hx.toFixed(1)} ${hy.toFixed(1)} L${bx1.toFixed(1)} ${by1.toFixed(1)} L${bx2.toFixed(1)} ${by2.toFixed(1)} Z" fill="${color}"/>`;
  }
  return s;
}

export function speedSVG(v) {
  return prohib(`<text x="50" y="50" dy="0.36em" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="${v >= 100 ? 36 : 44}" fill="${BLK}">${v}</text>`);
}
const zoneSVG = (v) => svg(`<rect x="3" y="3" width="94" height="124" rx="8" fill="${WHT}" stroke="#222" stroke-width="2"/>
  <text x="50" y="28" text-anchor="middle" font-family="Arial" font-weight="700" font-size="20" fill="${BLK}">ZONE</text>
  <circle cx="50" cy="76" r="33" fill="${WHT}" stroke="${RED}" stroke-width="8"/><text x="50" y="76" dy="0.36em" text-anchor="middle" font-family="Arial" font-weight="700" font-size="34" fill="${BLK}">${v}</text>`, '0 0 100 130');
const encounterSVG = () => svg(`<rect x="3" y="3" width="94" height="124" rx="8" fill="${WHT}" stroke="#222" stroke-width="2"/>
  <rect x="12" y="12" width="76" height="76" fill="${BLUE}"/>
  <g transform="translate(34 52) scale(0.75)" fill="${WHT}">${PED}</g>
  <g transform="translate(66 64) scale(0.55)">${CAR_SIDE(WHT)}</g>
  <circle cx="72" cy="30" r="12" fill="${WHT}" stroke="${RED}" stroke-width="4"/><text x="72" y="30" dy="0.36em" text-anchor="middle" font-family="Arial" font-weight="700" font-size="13" fill="${BLK}">20</text>
  <text x="50" y="112" text-anchor="middle" font-family="Arial" font-weight="700" font-size="10.5" fill="${BLK}">BEGEGNUNGSZONE</text>`, '0 0 100 130');
const pedZoneSVG = () => svg(`<rect x="3" y="3" width="94" height="124" rx="8" fill="${WHT}" stroke="#222" stroke-width="2"/>
  <circle cx="50" cy="52" r="36" fill="${BLUE}"/><g transform="translate(50 56)" fill="${WHT}">${PED}</g>
  <text x="50" y="112" text-anchor="middle" font-family="Arial" font-weight="700" font-size="10" fill="${BLK}">FUSSGÄNGERZONE</text>`, '0 0 100 130');

const stopSVG = () => {
  const pts = [], pts2 = [];
  for (let i = 0; i < 8; i++) {
    const a = (22.5 + i * 45) * Math.PI / 180;
    pts.push(`${(50 + 47 * Math.cos(a)).toFixed(1)},${(50 + 47 * Math.sin(a)).toFixed(1)}`);
    pts2.push(`${(50 + 42 * Math.cos(a)).toFixed(1)},${(50 + 42 * Math.sin(a)).toFixed(1)}`);
  }
  return svg(`<polygon points="${pts.join(' ')}" fill="${WHT}"/><polygon points="${pts2.join(' ')}" fill="${RED}"/>
  <text x="50" y="50" dy="0.36em" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="27" fill="${WHT}">STOP</text>`);
};
const mainRoad = (end = false) => svg(`<polygon points="50,3 97,50 50,97 3,50" fill="${WHT}" stroke="#444" stroke-width="1.5"/>
  <polygon points="50,16 84,50 50,84 16,50" fill="${YEL}"/>
  ${end ? `<clipPath id="mrc"><polygon points="50,16 84,50 50,84 16,50"/></clipPath><g clip-path="url(#mrc)" stroke="${BLK}" stroke-width="4">
  <line x1="20" y1="90" x2="90" y2="20"/><line x1="10" y1="80" x2="80" y2="10"/><line x1="30" y1="100" x2="100" y2="30"/><line x1="0" y1="70" x2="70" y2="0"/></g>` : ''}`);

const TURN_LEFT = (c = BLK) => `<path fill="${c}" d="M8 26 V2 Q8-8 -2-8 H-8 V-18 L-24-3 L-8 12 V2 H-2 Q-4 2 -4 4 V26 Z"/>`;
const TURN_RIGHT = (c = BLK) => `<g transform="scale(-1 1)">${TURN_LEFT(c)}</g>`;
const UTURN = (c = BLK) => `<path fill="none" stroke="${c}" stroke-width="7" d="M9 26 V-4 Q9-16 -2-16 Q-13-16 -13-4 V8"/><path fill="${c}" d="M-23 4 L-3 4 L-13 20 Z"/>`;
const BAR = `<line x1="22" y1="22" x2="78" y2="78" stroke="${RED}" stroke-width="9"/>`;

const MARK_ZEBRA = asphalt(`<g fill="${YEL}">${[14, 30, 46, 62, 78].map((x) => `<rect x="${x}" y="12" width="9" height="76"/>`).join('')}</g>`);
const MARK_BIKELANE = asphalt(`<g stroke="${YEL}" stroke-width="3" stroke-dasharray="10 8"><line x1="66" y1="0" x2="66" y2="100"/></g><g transform="translate(83 52) scale(0.5) rotate(-90)">${BIKE(YEL)}</g>`);
const MARK_BUSLANE = asphalt(`<line x1="60" y1="0" x2="60" y2="100" stroke="${YEL}" stroke-width="4"/><text x="80" y="50" font-family="Arial" font-weight="700" font-size="16" fill="${YEL}" text-anchor="middle" transform="rotate(-90 80 50)">BUS</text>`);
const MARK_SOLID = asphalt(`<line x1="50" y1="0" x2="50" y2="100" stroke="${WHT}" stroke-width="4"/>`);
const MARK_DASHED = asphalt(`<line x1="50" y1="0" x2="50" y2="100" stroke="${WHT}" stroke-width="4" stroke-dasharray="18 14"/>`);
const MARK_STOP = asphalt(`<rect x="8" y="64" width="84" height="7" fill="${WHT}"/><text x="50" y="50" text-anchor="middle" font-family="Arial" font-weight="700" font-size="22" fill="${WHT}">STOP</text>`);
const MARK_GIVE = asphalt(`<g fill="${WHT}">${[8, 26, 44, 62, 80].map((x) => `<rect x="${x}" y="66" width="12" height="6"/>`).join('')}<path d="M34 18 H66 L50 50 Z" fill="none" stroke="${WHT}" stroke-width="4"/></g>`);
const MARK_ZIGZAG = asphalt(`<path d="M6 70 L18 58 L30 70 L42 58 L54 70 L66 58 L78 70 L90 58" fill="none" stroke="${YEL}" stroke-width="4"/>`);
const MARK_TRAM = asphalt(`<g stroke="#2a2c30" stroke-width="3"><line x1="40" y1="0" x2="40" y2="100"/><line x1="60" y1="0" x2="60" y2="100"/></g><g stroke="#8d939c" stroke-width="1"><line x1="40" y1="0" x2="40" y2="100"/><line x1="60" y1="0" x2="60" y2="100"/></g>`);

const light = (r, y, gr, flash = false) => svg(`<rect x="30" y="4" width="40" height="92" rx="10" fill="#1d1f24"/>
  <circle cx="50" cy="22" r="11" fill="${r ? '#ff3030' : '#3a2020'}"/>
  <circle cx="50" cy="50" r="11" fill="${y ? '#ffb000' : '#3a3020'}">${flash ? '<animate attributeName="opacity" values="1;0.15;1" dur="1.2s" repeatCount="indefinite"/>' : ''}</circle>
  <circle cx="50" cy="78" r="11" fill="${gr ? '#1fe07a' : '#1d3326'}"/>`);
const tramLight = () => svg(`<rect x="22" y="14" width="56" height="72" rx="8" fill="#1d1f24"/><rect x="34" y="30" width="32" height="7" fill="${WHT}"/><rect x="46" y="54" width="8" height="24" fill="#555"/>`);

export const SIGN_CATS = [
  { id: 'all', name: { en: 'All', de: 'Alle' } },
  { id: 'priority', name: { en: 'Priority', de: 'Vortritt' } },
  { id: 'danger', name: { en: 'Danger', de: 'Gefahr' } },
  { id: 'prohibition', name: { en: 'Prohibition', de: 'Verbot' } },
  { id: 'mandatory', name: { en: 'Mandatory', de: 'Vorschrift' } },
  { id: 'info', name: { en: 'Information', de: 'Hinweis' } },
  { id: 'zones', name: { en: 'Zones & speed', de: 'Zonen & Tempo' } },
  { id: 'markings', name: { en: 'Road markings', de: 'Markierungen' } },
  { id: 'lights', name: { en: 'Traffic lights', de: 'Lichtsignale' } },
];

const S = (id, cat, en, de, dEn, dDe, svgStr, extra = {}) => ({ id, cat, name: { en, de }, desc: { en: dEn, de: dDe }, svg: svgStr, ...extra });

export const SIGNS = [
  // ── Priority
  S('stop', 'priority', 'Stop', 'Stop',
    'Come to a complete stop at the stop line (wheels not turning), then give way to all traffic on the road you are entering. Rolling through counts as a serious mistake.',
    'Vor der Haltelinie vollständig anhalten (Räder stehen still) und dann allen Fahrzeugen auf der Strasse, in die du einfährst, den Vortritt lassen.', stopSVG(), { lesson: 'priority' }),
  S('give', 'priority', 'Give way', 'Kein Vortritt',
    'You must give way to traffic on the road you are entering. Slow down, and stop if necessary. Usually paired with a dashed white line (Wartelinie) and a painted triangle.',
    'Du musst den Fahrzeugen auf der Strasse, in die du einfährst, den Vortritt lassen. Langsam heranfahren und wenn nötig anhalten. Meist mit Wartelinie und aufgemaltem Dreieck.', invTriangle(), { lesson: 'priority' }),
  S('main', 'priority', 'Main road', 'Hauptstrasse',
    'You are on a priority road: traffic from side streets must give way to you at every junction. Right-before-left does not apply here. Still watch out for trams, which keep their priority.',
    'Du fährst auf einer Hauptstrasse: Fahrzeuge aus Nebenstrassen müssen dir den Vortritt lassen. Kein Rechtsvortritt. Achtung: Trams behalten ihren Vortritt.', mainRoad(), { lesson: 'priority' }),
  S('mainend', 'priority', 'End of main road', 'Ende der Hauptstrasse',
    'The priority road ends. From here on the general rule applies again: right-before-left, unless other signs say otherwise.',
    'Die Hauptstrasse endet. Ab hier gilt wieder der Rechtsvortritt, sofern nichts anderes signalisiert ist.', mainRoad(true), { lesson: 'rvl' }),
  S('rvlx', 'priority', 'Junction with right-before-left', 'Verzweigung mit Rechtsvortritt',
    'Warning: at the next junction, vehicles coming from your right have priority.',
    'Warnung: An der nächsten Verzweigung haben Fahrzeuge von rechts Vortritt.', triangle(`<g stroke="${BLK}" stroke-width="7" stroke-linecap="butt"><line x1="36" y1="46" x2="64" y2="76"/><line x1="64" y1="46" x2="36" y2="76"/></g>`), { lesson: 'rvl' }),
  S('sideroad', 'priority', 'Junction with a side road', 'Verzweigung mit Strasse ohne Vortritt',
    'You have priority at the next junction. Traffic from the side road (thin line) must give way to you.',
    'Du hast an der nächsten Verzweigung Vortritt; die Nebenstrasse (dünne Linie) muss warten.', triangle(`<rect x="45" y="38" width="10" height="42" fill="${BLK}"/><rect x="32" y="55" width="36" height="5" fill="${BLK}"/>`), { lesson: 'priority' }),
  S('prioOncoming', 'priority', 'Priority over oncoming traffic', 'Vortritt vor dem Gegenverkehr',
    'At a narrow section you may go first. Oncoming traffic must wait.',
    'An der Engstelle darfst du zuerst fahren; der Gegenverkehr muss warten.', info(`<g transform="translate(62 50) scale(0.9)">${ARROW_UP(WHT)}</g><g transform="translate(36 50) scale(0.65) rotate(180)">${ARROW_UP(RED)}</g>`)),
  S('yieldOncoming', 'priority', 'Give way to oncoming traffic', 'Dem Gegenverkehr Vortritt lassen',
    'At a narrow section, oncoming traffic goes first. Wait until the road is clear.',
    'An der Engstelle hat der Gegenverkehr Vortritt. Warte, bis die Strecke frei ist.', prohib(`<g transform="translate(38 50) scale(0.8) rotate(180)">${ARROW_UP(BLK)}</g><g transform="translate(63 50) scale(0.6)">${ARROW_UP(RED)}</g>`)),

  // ── Danger
  S('dPed', 'danger', 'Pedestrian crossing ahead', 'Fussgängerstreifen',
    'A zebra crossing is coming up. Slow down and be ready to stop: pedestrians who are on the crossing, or clearly about to step onto it, have priority.',
    'Ein Fussgängerstreifen folgt. Langsamer fahren und bremsbereit sein: Fussgänger auf dem Streifen oder davor haben Vortritt.', triangle(g(`${PED}${STRIPES}`, 50, 58, 0.85)), { lesson: 'zebra' }),
  S('dChildren', 'danger', 'Children', 'Kinder',
    'Schools and playgrounds nearby. Children are unpredictable, so drive slowly and be ready to brake.',
    'Schulen oder Spielplätze in der Nähe. Kinder sind unberechenbar – langsam und bremsbereit fahren.', triangle(`${g(PED, 42, 60, 0.75)}${g(PED, 60, 64, 0.6)}`), { lesson: 'zebra' }),
  S('dLights', 'danger', 'Traffic lights ahead', 'Lichtsignale',
    'Traffic lights ahead that you might not see yet. Be ready to stop.',
    'Lichtsignalanlage, die evtl. noch nicht sichtbar ist. Bremsbereit sein.', triangle(g(LIGHTS, 50, 60, 0.7)), { lesson: 'lights' }),
  S('dTram', 'danger', 'Tram crossing', 'Strassenbahn',
    'Tram tracks cross or join the road. Trams have priority, they cannot swerve, and they need a long distance to stop.',
    'Tramgleise kreuzen oder folgen der Strasse. Trams haben Vortritt, können nicht ausweichen und haben lange Bremswege.', triangle(g(TRAM, 50, 62, 0.85)), { lesson: 'trams' }),
  S('dCyclists', 'danger', 'Cyclists', 'Radfahrer',
    'Cyclists may cross or join the road. Leave space, and when overtaking keep at least 1.5 m in town.',
    'Radfahrer können queren oder einbiegen. Abstand halten – beim Überholen innerorts mind. 1,5 m.', triangle(g(CYCLIST, 50, 64, 0.85)), { lesson: 'bikes' }),
  S('dOncoming', 'danger', 'Two-way traffic', 'Gegenverkehr',
    'After a one-way section, traffic now runs in both directions. Keep right.',
    'Nach einem Einbahnabschnitt folgt Gegenverkehr. Rechts fahren.', triangle(`<g transform="translate(42 62) scale(0.5) rotate(180)">${ARROW_UP(BLK)}</g><g transform="translate(58 62) scale(0.5)">${ARROW_UP(BLK)}</g>`)),
  S('dRoundabout', 'danger', 'Roundabout ahead', 'Kreisverkehr',
    'A roundabout is coming up. Slow down. Vehicles already in the roundabout have priority.',
    'Ein Kreisel folgt. Langsamer fahren – Fahrzeuge im Kreisel haben Vortritt.', triangle(`<g transform="translate(50 62) scale(0.48) translate(-50 -50)">${roundaboutArrows(BLK, 24, 9)}</g>`), { lesson: 'roundabout' }),
  S('dOther', 'danger', 'Other danger', 'Andere Gefahren',
    'A hazard not covered by another sign, such as roadworks or a narrowing. A panel underneath often explains it.',
    'Gefahr, für die es kein eigenes Signal gibt (z. B. Baustelle). Oft mit Zusatztafel.', triangle(`<rect x="45.5" y="38" width="9" height="28" rx="2" fill="${BLK}"/><circle cx="50" cy="74" r="5" fill="${BLK}"/>`)),

  // ── Prohibition
  S('noVehicles', 'prohibition', 'No vehicles', 'Allgemeines Fahrverbot',
    'No motor vehicles or bicycles may enter in either direction. Pushing a bike is allowed.',
    'Fahrverbot in beiden Richtungen für alle Fahrzeuge. Fahrräder schieben ist erlaubt.', prohib('')),
  S('noEntry', 'prohibition', 'No entry', 'Einfahrt verboten',
    'Do not enter. You usually see this at the exit end of a one-way street. Driving in counts as a serious mistake.',
    'Einfahrt verboten – meist am Ende einer Einbahnstrasse. Hineinfahren ist ein schwerer Fehler.', svg(`<circle cx="50" cy="50" r="47" fill="${RED}"/><rect x="16" y="41" width="68" height="18" fill="${WHT}"/>`), { lesson: 'oneway' }),
  S('noCars', 'prohibition', 'No motor cars', 'Verbot für Motorwagen',
    'Cars may not enter. Often used for streets reserved for trams, buses or bikes.',
    'Motorwagen dürfen nicht einfahren. Häufig bei Strassen nur für Tram, Bus und Velo.', prohib(g(CAR_SIDE(BLK), 50, 52, 1.1))),
  S('speed50', 'zones', 'Speed limit 50', 'Höchstgeschwindigkeit 50',
    '50 km/h is the general speed limit in built-up areas in Switzerland, so it applies even without a sign.',
    '50 km/h ist die generelle Höchstgeschwindigkeit innerorts – auch ohne Signal.', speedSVG(50), { lesson: 'speed' }),
  S('speed30', 'zones', 'Speed limit 30', 'Höchstgeschwindigkeit 30',
    'Maximum speed is 30 km/h. More and more Zurich streets are signed 30 to cut noise and accidents.',
    'Maximal 30 km/h. In Zürich gilt auf immer mehr Strassen Tempo 30 (Lärm, Sicherheit).', speedSVG(30), { lesson: 'speed' }),
  S('speed60', 'zones', 'Speed limit 60', 'Höchstgeschwindigkeit 60',
    'Maximum speed is 60 km/h. You find it on some wide arterial roads in Zurich.',
    'Maximal 60 km/h, z. B. auf breiten Einfallsachsen.', speedSVG(60), { lesson: 'speed' }),
  S('speed80', 'zones', 'Speed limit 80', 'Höchstgeschwindigkeit 80',
    '80 km/h is the general limit outside built-up areas (motorways 120, expressways 100).',
    '80 km/h ist die generelle Höchstgeschwindigkeit ausserorts (Autobahn 120, Autostrasse 100).', speedSVG(80), { lesson: 'speed' }),
  S('noOvertake', 'prohibition', 'No overtaking', 'Überholen verboten',
    'You may not overtake motor vehicles with more than two wheels.',
    'Überholen von mehrspurigen Motorfahrzeugen verboten.', prohib(`${g(CAR_REAR(RED), 34, 52, 1.35)}${g(CAR_REAR(BLK), 66, 52, 1.35)}`)),
  S('noLeft', 'prohibition', 'No left turn', 'Abbiegen nach links verboten',
    'Turning left is prohibited at the next junction.',
    'Links abbiegen an der nächsten Verzweigung verboten.', prohib(`${g(TURN_LEFT(BLK), 52, 52, 0.95)}${BAR}`), { lesson: 'left' }),
  S('noRight', 'prohibition', 'No right turn', 'Abbiegen nach rechts verboten',
    'Turning right is prohibited at the next junction.',
    'Rechts abbiegen an der nächsten Verzweigung verboten.', prohib(`${g(TURN_RIGHT(BLK), 48, 52, 0.95)}${BAR}`)),
  S('noUturn', 'prohibition', 'No U-turn', 'Wenden verboten',
    'Turning around is prohibited.',
    'Wenden verboten.', prohib(`${g(UTURN(BLK), 52, 50, 1)}${BAR}`)),
  S('noParking', 'prohibition', 'No parking', 'Parkieren verboten',
    'Parking is not allowed, but a short stop to let people in or out, or to load, is OK.',
    'Parkieren verboten. Kurzes Halten zum Ein-/Aussteigen oder Güterumschlag ist erlaubt.', svg(`<circle cx="50" cy="50" r="44" fill="${BLUE}" stroke="${RED}" stroke-width="10"/><line x1="20" y1="20" x2="80" y2="80" stroke="${RED}" stroke-width="10"/>`)),
  S('noStopping', 'prohibition', 'No stopping', 'Halten verboten',
    'Stopping is not allowed at all, not even briefly.',
    'Halten ist verboten – auch kurzzeitig.', svg(`<circle cx="50" cy="50" r="44" fill="${BLUE}" stroke="${RED}" stroke-width="10"/><line x1="20" y1="20" x2="80" y2="80" stroke="${RED}" stroke-width="10"/><line x1="80" y1="20" x2="20" y2="80" stroke="${RED}" stroke-width="10"/>`)),

  // ── Mandatory
  S('roundabout', 'mandatory', 'Roundabout', 'Kreisverkehrsplatz',
    'Drive around counter-clockwise. Give way to vehicles already in the roundabout (coming from your left). Don\'t signal when entering; signal right before you exit.',
    'Gegen den Uhrzeigersinn befahren. Fahrzeuge im Kreisel (von links) haben Vortritt. Bei der Einfahrt nicht blinken, vor der Ausfahrt rechts blinken.', mandatory(roundaboutArrows()), { lesson: 'roundabout' }),
  S('aheadOnly', 'mandatory', 'Ahead only', 'Geradeausfahren',
    'You must go straight ahead.',
    'Vorgeschriebene Fahrtrichtung geradeaus.', mandatory(g(ARROW_UP(WHT), 50, 50, 1))),
  S('turnRight', 'mandatory', 'Turn right', 'Rechtsabbiegen',
    'You must turn right.',
    'Vorgeschriebene Fahrtrichtung rechts.', mandatory(g(TURN_RIGHT(WHT), 50, 52, 1))),
  S('keepRight', 'mandatory', 'Pass on the right', 'Hindernis rechts umfahren',
    'Pass the obstacle or traffic island on the right.',
    'Hindernis (z. B. Verkehrsinsel) rechts umfahren.', mandatory(`<g transform="translate(50 50) rotate(135)">${ARROW_UP(WHT)}</g>`)),
  S('bikePath', 'mandatory', 'Cycle path', 'Radweg',
    'Reserved for bicycles (and e-bikes up to 25 km/h). Cyclists must use it, and cars may not drive on it.',
    'Für Fahrräder (und langsame E-Bikes) reserviert und für sie obligatorisch. Für Autos verboten.', mandatory(g(BIKE(WHT), 50, 50, 1.25)), { lesson: 'bikes' }),
  S('footPath', 'mandatory', 'Footpath', 'Fussweg',
    'For pedestrians only.',
    'Nur für Fussgänger.', mandatory(g(PED, 50, 54, 1.3, WHT))),
  S('bikeFoot', 'mandatory', 'Cycle and footpath', 'Rad- und Fussweg',
    'Shared or split path for cyclists and pedestrians. Cars may not use it.',
    'Gemeinsamer oder getrennter Weg für Velo und Fussgänger. Für Autos verboten.', mandatory(`<line x1="50" y1="8" x2="50" y2="92" stroke="${WHT}" stroke-width="3"/>${g(BIKE(WHT), 28, 52, 0.7)}${g(PED, 72, 54, 0.85, WHT)}`), { lesson: 'bikes' }),
  S('busway', 'mandatory', 'Bus lane / busway', 'Busfahrbahn',
    'Reserved for public transport buses. Cars must stay out, except to turn right where the line is dashed.',
    'Den Linienbussen vorbehalten. Autos dürfen nur zum Rechtsabbiegen (bei unterbrochener Linie) hineinfahren.', mandatory(g(BUS_SIDE(WHT), 50, 52, 1)), { lesson: 'bus' }),

  // ── Information
  S('oneway', 'info', 'One-way street', 'Einbahnstrasse',
    'Traffic flows only in the direction of the arrow. In Zurich cyclists are often allowed both ways (panel underneath), so expect oncoming bikes.',
    'Verkehr nur in Pfeilrichtung. In Zürich oft mit Zusatztafel: Velos in beide Richtungen erlaubt – rechne mit entgegenkommenden Velos.', info(g(ARROW_UP(WHT), 50, 50, 1.15)), { lesson: 'oneway' }),
  S('deadEnd', 'info', 'Dead end', 'Sackgasse',
    'No through road.',
    'Keine Durchfahrt.', info(`<rect x="42" y="30" width="16" height="58" fill="${WHT}"/><rect x="24" y="16" width="52" height="16" fill="${RED}"/>`)),
  S('zebraInfo', 'info', 'Pedestrian crossing', 'Standort eines Fussgängerstreifens',
    'Marks the exact spot of a zebra crossing. Pedestrians there have priority, and overtaking right before it is forbidden.',
    'Markiert den Fussgängerstreifen. Fussgänger haben Vortritt; Überholen unmittelbar davor ist verboten.', info(`<path d="M50 14 L86 82 H14 Z" fill="${WHT}"/>${g(PED, 50, 60, 0.8)}<g fill="${BLK}"><rect x="28" y="76" width="7" height="4"/><rect x="40" y="76" width="7" height="4"/><rect x="52" y="76" width="7" height="4"/><rect x="64" y="76" width="7" height="4"/></g>`), { lesson: 'zebra' }),
  S('parking', 'info', 'Parking', 'Parkieren gestattet',
    'Parking is allowed. In Zurich, check the blue zone or meter rules on the panels below.',
    'Parkieren erlaubt. In Zürich: Blaue Zone oder Parkuhr beachten.', info(`<text x="50" y="52" dy="0.36em" text-anchor="middle" font-family="Arial" font-weight="700" font-size="68" fill="${WHT}">P</text>`)),
  S('tramStop', 'info', 'Tram stop', 'Haltestelle',
    'Tram or bus stop. Where there is no traffic island, passengers step straight onto the road, so stop behind a halted tram and wait.',
    'Tram- oder Bushaltestelle. Ohne Schutzinsel steigen Fahrgäste direkt auf die Fahrbahn aus – hinter dem haltenden Tram anhalten und warten.', svg(`<rect x="6" y="6" width="88" height="88" rx="44" fill="${WHT}" stroke="#1a7f3c" stroke-width="8"/><text x="50" y="52" dy="0.36em" text-anchor="middle" font-family="Arial" font-weight="700" font-size="54" fill="#1a7f3c">H</text>`), { lesson: 'trams' }),
  S('motorway', 'info', 'Motorway', 'Autobahn',
    'Motorway: 120 km/h, a vignette is required, and only vehicles that can go above 80 km/h may use it.',
    'Autobahn: 120 km/h, Vignettenpflicht, nur für Fahrzeuge über 80 km/h.', svg(`<rect x="4" y="4" width="92" height="92" rx="9" fill="#00843d" stroke="${WHT}" stroke-width="3"/><path d="M30 86 L44 30 H56 L70 86 Z" fill="${WHT}"/><rect x="47" y="40" width="6" height="10" fill="#00843d"/><rect x="47" y="58" width="6" height="12" fill="#00843d"/><rect x="18" y="18" width="64" height="8" fill="${WHT}"/>`), { lesson: 'speed' }),

  // ── Zones
  S('zone30', 'zones', '30 zone', 'Tempo-30-Zone',
    'Speed limit 30 km/h throughout the zone. Usually there are no zebra crossings and right-before-left applies at junctions. Pedestrians may cross anywhere.',
    'In der ganzen Zone max. 30 km/h. Meist keine Fussgängerstreifen, an Verzweigungen gilt Rechtsvortritt. Fussgänger dürfen überall queren.', zoneSVG(30), { lesson: 'speed' }),
  S('encounter', 'zones', 'Encounter zone', 'Begegnungszone',
    'Max 20 km/h. Pedestrians may use the whole road and have priority over vehicles, but they must not obstruct traffic unnecessarily. Right-before-left applies.',
    'Max. 20 km/h. Fussgänger dürfen die ganze Fläche benützen und haben Vortritt, dürfen Fahrzeuge aber nicht unnötig behindern. Rechtsvortritt.', encounterSVG(), { lesson: 'speed' }),
  S('pedZone', 'zones', 'Pedestrian zone', 'Fussgängerzone',
    'Pedestrians only, plus vehicles allowed by a panel underneath (e.g. deliveries at walking pace).',
    'Nur für Fussgänger; Fahrzeuge nur wenn auf Zusatztafel erlaubt (z. B. Zubringer, im Schritttempo).', pedZoneSVG()),

  // ── Markings
  S('mZebra', 'markings', 'Zebra crossing (yellow)', 'Fussgängerstreifen (gelb)',
    'Swiss zebra crossings are yellow. Stop for anyone who is on it or waiting to cross. Overtaking just before the crossing and stopping on it are forbidden.',
    'Schweizer Fussgängerstreifen sind gelb. Für Fussgänger auf dem Streifen oder wartende anhalten. Überholen unmittelbar davor und Halten darauf verboten.', MARK_ZEBRA, { lesson: 'zebra' }),
  S('mBike', 'markings', 'Bike lane (yellow dashed)', 'Radstreifen',
    'The bike lane is marked by a yellow dashed line and bike symbols. Cars may cross it briefly if no cyclist is endangered, but may not drive or park in it.',
    'Radstreifen mit gelber unterbrochener Linie und Velosymbolen. Autos dürfen ihn kurz überfahren, wenn kein Velo gefährdet wird, aber nicht darauf fahren oder parkieren.', MARK_BIKELANE, { lesson: 'bikes' }),
  S('mBus', 'markings', 'Bus lane (yellow)', 'Busstreifen',
    'Yellow line and the word BUS. Reserved for buses (and taxis where signed). Cars may enter only where the line is dashed, to turn right.',
    'Gelbe Linie mit Aufschrift BUS. Für Busse (und Taxis, falls signalisiert). Autos nur bei unterbrochener Linie zum Rechtsabbiegen.', MARK_BUSLANE, { lesson: 'bus' }),
  S('mSolid', 'markings', 'Solid line', 'Sicherheitslinie',
    'Never cross or drive on a solid white line.',
    'Die Sicherheitslinie darf weder überfahren noch überquert werden.', MARK_SOLID),
  S('mDashed', 'markings', 'Dashed line', 'Leitlinie',
    'Lane divider. You may cross it to overtake or turn when it is safe.',
    'Trennt Fahrstreifen. Darf zum Überholen oder Abbiegen überfahren werden, wenn es sicher ist.', MARK_DASHED),
  S('mStop', 'markings', 'Stop line', 'Haltelinie',
    'Solid line with STOP: come to a full stop with your front at the line.',
    'Haltelinie mit STOP: Vollständig anhalten – Fahrzeugfront an der Linie.', MARK_STOP, { lesson: 'priority' }),
  S('mGive', 'markings', 'Give-way line', 'Wartelinie',
    'Dashed line with a triangle: give way to crossing traffic. Stop only if needed.',
    'Unterbrochene Linie mit Dreieck: Querverkehr hat Vortritt. Nur anhalten, wenn nötig.', MARK_GIVE, { lesson: 'priority' }),
  S('mZigzag', 'markings', 'Yellow zigzag', 'Zickzacklinie',
    'Bus stop area. No stopping or parking.',
    'Bushaltestelle: Halten und Parkieren verboten.', MARK_ZIGZAG),
  S('mTram', 'markings', 'Tram tracks', 'Tramgleise',
    'Trams cannot swerve. Cross the rails at a steep angle on a bike, don\'t stop on them, and remember trams have priority.',
    'Trams können nicht ausweichen. Gleise steil queren (Velo), nicht darauf anhalten – Trams haben Vortritt.', MARK_TRAM, { lesson: 'trams' }),

  // ── Lights
  S('lRed', 'lights', 'Red light', 'Rot',
    'Stop before the stop line. Running a red light means failing the test.',
    'Vor der Haltelinie anhalten. Rotlicht missachten = Prüfung nicht bestanden.', light(1, 0, 0), { lesson: 'lights' }),
  S('lRedYellow', 'lights', 'Red + yellow', 'Rot-Gelb',
    'The light is about to turn green. Get ready, but don\'t move off yet. Switzerland has this phase, unlike many countries.',
    'Gleich wird es grün – bereit machen, aber noch nicht losfahren.', light(1, 1, 0), { lesson: 'lights' }),
  S('lGreen', 'lights', 'Green light', 'Grün',
    'Go, if the junction is clear. When turning you must still give way to pedestrians and oncoming traffic.',
    'Fahren, wenn die Kreuzung frei ist. Beim Abbiegen trotzdem Fussgängern und Gegenverkehr Vortritt lassen.', light(0, 0, 1), { lesson: 'lights' }),
  S('lYellow', 'lights', 'Yellow (amber)', 'Gelb',
    'Stop, unless you are so close that you can no longer stop safely.',
    'Anhalten – ausser du bist so nah, dass ein sicheres Anhalten nicht mehr möglich ist.', light(0, 1, 0), { lesson: 'lights' }),
  S('lFlash', 'lights', 'Flashing amber', 'Gelbes Blinklicht',
    'The signals are off or there is a special hazard. Drive carefully and follow the signs. Without signs, right-before-left applies.',
    'Anlage ausser Betrieb oder besondere Gefahr: vorsichtig fahren, Signale beachten. Ohne Signale gilt Rechtsvortritt.', light(0, 1, 0, true), { lesson: 'lights' }),
  S('lTram', 'lights', 'Tram signal (white bars)', 'Tramsignal',
    'Signals with white bars are for trams and buses only. Ignore them and follow your own traffic light.',
    'Signale mit weissen Balken gelten nur für Tram und Bus. Für Autos nicht massgebend.', tramLight(), { lesson: 'trams' }),
];


// ─────────────────────────────────────────────────────────────
// Further signs, markings and signals
// ─────────────────────────────────────────────────────────────
const TXT = (t, size = 30, fill = BLK, y = 50, x = 50) => `<text x="${x}" y="${y}" dy="0.36em" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="${size}" fill="${fill}">${t}</text>`;
const FLIP = (inner) => `<g transform="translate(100 0) scale(-1 1)">${inner}</g>`;
const strike = (s, color = RED, w = 7) => s.replace(/<\/svg>\s*$/, `<line x1="10" y1="90" x2="90" y2="10" stroke="${color}" stroke-width="${w}"/></svg>`);
const BEND = `<path d="M43 82 V62 Q43 49 57 49" fill="none" stroke="${BLK}" stroke-width="6.5"/><path d="M55 40 L69 49 L55 58 Z" fill="${BLK}"/>`;
const SBEND = `<path d="M42 84 V76 Q42 66 50 63 Q58 60 58 50 V46" fill="none" stroke="${BLK}" stroke-width="6.5"/><path d="M49 48 L58 35 L67 48 Z" fill="${BLK}"/>`;
const TRUCK = (c = BLK) => `<g fill="${c}"><rect x="-20" y="-12" width="26" height="19"/><path d="M8-6 H15 L20 0 V7 H8 Z"/><circle cx="-12" cy="9" r="4.2"/><circle cx="13" cy="9" r="4.2"/></g>`;
const MOTO = (c = BLK) => `<g fill="none" stroke="${c}" stroke-width="3.4"><circle cx="-12" cy="8" r="7"/><circle cx="13" cy="8" r="7"/></g><path fill="${c}" d="M-12 6 L-4-6 H7 L14 6 H9 L5 0 H-3 L-7 8 Z"/><path d="M6-6 L10-13 H15" fill="none" stroke="${c}" stroke-width="3"/><circle cx="-1" cy="-13" r="4.2" fill="${c}"/>`;
const DEER = `<path fill="${BLK}" d="M-20 4 Q-8-6 6-4 L12-14 L10-22 L14-16 L17-23 L18-15 L23-18 L19-11 L22-6 L16-5 L12 2 L18 16 L15 17 L7 6 L-2 6 L-12 18 L-15 17 L-9 4 L-18 8 L-24 16 L-26 14 Z"/>`;
const board = (inner, bg = BLUE, w = 150, h = 60, edge = WHT) => svg(`<rect x="3" y="3" width="${w - 6}" height="${h - 6}" rx="6" fill="${bg}" stroke="${edge}" stroke-width="3"/>${inner}`, `0 0 ${w} ${h}`);
const endRing = (inner) => svg(`<circle cx="50" cy="50" r="46" fill="${WHT}" stroke="#333" stroke-width="2.5"/>${inner}<g stroke="#222" stroke-width="2.2">${[-12, -6, 0, 6, 12].map((o) => `<line x1="${22 + o}" y1="${78 + o}" x2="${78 + o}" y2="${22 + o}"/>`).join('')}</g>`);
const zoneEnd = (v) => svg(`<rect x="3" y="3" width="94" height="124" rx="8" fill="${WHT}" stroke="#222" stroke-width="2"/>
  <text x="50" y="28" text-anchor="middle" font-family="Arial" font-weight="700" font-size="20" fill="#888">ZONE</text>
  <circle cx="50" cy="76" r="33" fill="${WHT}" stroke="#999" stroke-width="8"/><text x="50" y="76" dy="0.36em" text-anchor="middle" font-family="Arial" font-weight="700" font-size="34" fill="#888">${v}</text>
  <g stroke="#222" stroke-width="2.4">${[-10, -5, 0, 5, 10].map((o) => `<line x1="${8 + o}" y1="${118 + o}" x2="${92 + o}" y2="${12 + o}"/>`).join('')}</g>`, '0 0 100 130');
const MOTORWAY_SVG = svg(`<rect x="4" y="4" width="92" height="92" rx="9" fill="#00843d" stroke="${WHT}" stroke-width="3"/><path d="M30 86 L44 30 H56 L70 86 Z" fill="${WHT}"/><rect x="47" y="40" width="6" height="10" fill="#00843d"/><rect x="47" y="58" width="6" height="12" fill="#00843d"/><rect x="18" y="22" width="64" height="8" fill="${WHT}"/><rect x="26" y="30" width="6" height="14" fill="${WHT}"/><rect x="68" y="30" width="6" height="14" fill="${WHT}"/>`);
const EXPRESS_SVG = svg(`<rect x="4" y="4" width="92" height="92" rx="9" fill="#00843d" stroke="${WHT}" stroke-width="3"/>${g(CAR_REAR(WHT).replace(`fill="${WHT}"/>`, `fill="#00843d"/>`), 50, 50, 2.9, WHT)}`);
const lightArrow = (lit, flash = false) => svg(`<rect x="30" y="4" width="40" height="92" rx="10" fill="#1d1f24"/>
  <circle cx="50" cy="22" r="11" fill="#3a2020"/><circle cx="50" cy="50" r="11" fill="#3a3020"/><circle cx="50" cy="78" r="11" fill="#1d3326"/>
  <g transform="translate(50 ${lit === 'g' ? 78 : 50}) scale(0.34) rotate(-90)" fill="${lit === 'g' ? '#1fe07a' : '#ffb000'}">${ARROW_UP(lit === 'g' ? '#1fe07a' : '#ffb000')}${flash ? '<animate attributeName="opacity" values="1;0.15;1" dur="1.2s" repeatCount="indefinite"/>' : ''}</g>`);

SIGNS.push(
  // ── Priority
  S('andreas', 'priority', "St Andrew's cross", 'Andreaskreuz', 'Marks a level crossing. Trains always have priority. Stop before the cross when lights flash, bells ring or a train is coming.', '',
    svg(`<g stroke="${RED}" stroke-width="13" stroke-linecap="butt"><line x1="8" y1="26" x2="92" y2="74"/><line x1="92" y1="26" x2="8" y2="74"/></g><g stroke="${WHT}" stroke-width="13"><line x1="27" y1="37" x2="73" y2="63"/><line x1="73" y1="37" x2="27" y2="63"/></g>`)),

  // ── Danger
  S('dBendR', 'danger', 'Right-hand bend', 'Rechtskurve', 'A bend to the right follows. Brake before it, not in it, and keep to your side.', '', triangle(BEND)),
  S('dBendL', 'danger', 'Left-hand bend', 'Linkskurve', 'A bend to the left follows. Slow down beforehand and do not cut the corner.', '', triangle(FLIP(BEND))),
  S('dDouble', 'danger', 'Double bend', 'Doppelkurve', 'Two or more bends in a row, the first in the direction shown.', '', triangle(SBEND)),
  S('dSlip', 'danger', 'Slippery road', 'Schleudergefahr', 'The surface can be slippery (wet, ice, leaves). Reduce speed, steer and brake gently.', '',
    triangle(`${g(CAR_REAR(BLK), 50, 54, 1.25)}<g fill="none" stroke="${BLK}" stroke-width="3"><path d="M36 70 Q30 76 37 82"/><path d="M62 70 Q68 76 61 82"/></g>`)),
  S('dBumps', 'danger', 'Uneven road', 'Unebene Fahrbahn', 'Bumps or dips ahead. Slow down to keep control and spare the suspension.', '', triangle(`<path d="M26 78 H38 Q44 60 50 78 Q56 60 62 78 H74 V82 H26 Z" fill="${BLK}"/>`)),
  S('dNarrow', 'danger', 'Road narrows', 'Engpass', 'The carriageway gets narrower. Be ready to give way to oncoming traffic.', '',
    triangle(`<g fill="none" stroke="${BLK}" stroke-width="6"><path d="M38 84 V70 L45 58 V44"/><path d="M62 84 V70 L55 58 V44"/></g>`)),
  S('dWorks', 'danger', 'Roadworks', 'Baustelle', 'Workers and machines on or beside the road. Slow down and follow temporary orange markings, which override the white ones.', '',
    triangle(`${g(PED, 44, 62, 0.72)}<path d="M56 82 L66 66 L78 82 Z" fill="${BLK}"/><line x1="50" y1="56" x2="64" y2="72" stroke="${BLK}" stroke-width="3"/>`)),
  S('dDown', 'danger', 'Steep descent', 'Gefährliches Gefälle', 'A steep downhill stretch. Change down early and let the engine do the braking.', '', triangle(`<path d="M26 56 L74 80 H26 Z" fill="${BLK}"/>${TXT('10%', 13, BLK, 50, 58)}`)),
  S('dUp', 'danger', 'Steep climb', 'Starke Steigung', 'A steep uphill stretch. Change down in good time; slow vehicles may be crawling ahead.', '', triangle(`<path d="M74 56 L26 80 H74 Z" fill="${BLK}"/>${TXT('10%', 13, BLK, 50, 42)}`)),
  S('dQueue', 'danger', 'Traffic queues', 'Stau', 'Queues are likely. Watch far ahead and switch on the hazard lights when you reach the tail end.', '',
    triangle(`${g(CAR_REAR(BLK), 50, 46, 0.8)}${g(CAR_REAR(BLK), 38, 68, 0.95)}${g(CAR_REAR(BLK), 62, 68, 0.95)}`)),
  S('dBarrier', 'danger', 'Level crossing with barriers', 'Schranken', 'A railway crossing with barriers ahead. Never drive round closing barriers.', '',
    triangle(`<g stroke="${BLK}" stroke-width="5"><line x1="28" y1="58" x2="72" y2="58"/><line x1="28" y1="72" x2="72" y2="72"/><line x1="37" y1="50" x2="37" y2="82"/><line x1="63" y1="50" x2="63" y2="82"/></g>`)),
  S('dRail', 'danger', 'Level crossing without barriers', 'Bahnübergang ohne Schranken', 'An unguarded railway crossing ahead. Slow down, look and listen; trains have priority.', '',
    triangle(`<g fill="${BLK}"><rect x="34" y="56" width="26" height="16" rx="2"/><rect x="56" y="48" width="12" height="24"/><rect x="38" y="46" width="6" height="10"/><circle cx="40" cy="76" r="5"/><circle cx="52" cy="76" r="5"/><circle cx="64" cy="76" r="5"/></g>`)),
  S('dDeer', 'danger', 'Wild animals', 'Wildwechsel', 'Deer and other animals may cross, especially at dawn and dusk. Slow down; where one crosses, more often follow.', '', triangle(g(DEER, 50, 64, 0.85))),
  S('dRocks', 'danger', 'Falling rocks', 'Steinschlag', 'Rocks may be on the road or fall onto it. Do not stop here unless you have to.', '',
    triangle(`<path d="M68 42 L74 82 H56 Z" fill="${BLK}"/><g fill="${BLK}"><circle cx="48" cy="58" r="4"/><circle cx="40" cy="70" r="5"/><circle cx="50" cy="78" r="3.5"/><circle cx="32" cy="80" r="3"/></g>`)),
  S('dWind', 'danger', 'Crosswind', 'Seitenwind', 'Strong side winds, often on bridges and at tunnel exits. Grip the wheel firmly and leave room beside lorries.', '',
    triangle(`<line x1="34" y1="46" x2="34" y2="84" stroke="${BLK}" stroke-width="4"/><path d="M36 48 L72 56 L72 66 L36 64 Z" fill="${WHT}" stroke="${BLK}" stroke-width="2.5"/><path d="M46 50 L56 52.5 V65 L46 64.5 Z M64 54.5 L72 56 V66 L64 65.5 Z" fill="${RED}"/>`)),
  S('dGravel', 'danger', 'Loose chippings', 'Rollsplitt', 'Loose stones on the surface. Slow down and keep your distance so nothing is thrown at other vehicles.', '',
    triangle(`${g(CAR_SIDE(BLK), 46, 60, 0.9)}<g fill="${BLK}"><circle cx="70" cy="70" r="2"/><circle cx="76" cy="64" r="2"/><circle cx="74" cy="76" r="2"/><circle cx="66" cy="78" r="1.6"/></g>`)),

  // ── Prohibition
  S('noMotor', 'prohibition', 'No motor vehicles', 'Verbot für Motorwagen und Motorräder', 'Closed to cars and motorcycles. Bicycles and mopeds may usually still use it.', '', prohib(`${g(MOTO(BLK), 50, 36, 0.78)}${g(CAR_SIDE(BLK), 50, 64, 0.95)}`)),
  S('noMoto', 'prohibition', 'No motorcycles', 'Verbot für Motorräder', 'Closed to motorcycles.', '', prohib(g(MOTO(BLK), 50, 52, 1.15))),
  S('noBikes', 'prohibition', 'No bicycles or mopeds', 'Verbot für Fahrräder und Motorfahrräder', 'Closed to bicycles and mopeds. Does not affect cars.', '', prohib(g(BIKE(BLK), 50, 50, 1.2))),
  S('noTrucks', 'prohibition', 'No lorries', 'Verbot für Lastwagen', 'Closed to heavy goods vehicles. Cars may pass.', '', prohib(g(TRUCK(BLK), 50, 52, 1.25))),
  S('noPeds', 'prohibition', 'No pedestrians', 'Verbot für Fussgänger', 'Pedestrians may not use this road or path.', '', prohib(g(PED, 50, 54, 1.15))),
  S('maxWeight', 'prohibition', 'Maximum weight', 'Höchstgewicht', 'Vehicles heavier than shown (actual weight including load) may not pass.', '', prohib(TXT('5,5t', 30))),
  S('maxHeight', 'prohibition', 'Maximum height', 'Höchsthöhe', 'Vehicles taller than shown, including load and roof boxes, may not pass.', '', prohib(`${TXT('3,5m', 25)}<path d="M40 14 H60 L50 26 Z M40 86 H60 L50 74 Z" fill="${BLK}"/>`)),
  S('maxWidth', 'prohibition', 'Maximum width', 'Höchstbreite', 'Vehicles wider than shown, including load and mirrors, may not pass.', '', prohib(`${TXT('2,3m', 22)}<path d="M13 40 V60 L24 50 Z M87 40 V60 L76 50 Z" fill="${BLK}"/>`)),
  S('noOvertakeTrucks', 'prohibition', 'No overtaking for lorries', 'Überholen für Lastwagen verboten', 'Lorries may not overtake. Cars may, if it is safe.', '', prohib(`${g(TRUCK(RED), 33, 52, 0.85)}${g(CAR_REAR(BLK), 70, 52, 1.2)}`)),
  S('customs', 'prohibition', 'Customs: stop', 'Zollhaltestelle', 'Stop at the customs post and wait for instructions.', '', prohib(`<line x1="10" y1="50" x2="90" y2="50" stroke="${BLK}" stroke-width="3"/>${TXT('ZOLL', 17, BLK, 36)}${TXT('DOUANE', 14, BLK, 64)}`)),
  S('endSpeed', 'prohibition', 'End of speed limit', 'Ende der Höchstgeschwindigkeit', 'The signed limit ends here. The general limit for this kind of road applies again.', '', endRing(TXT('60', 40, '#999'))),
  S('endOvertake', 'prohibition', 'End of no-overtaking', 'Ende des Überholverbots', 'Overtaking is allowed again, where it is safe.', '', endRing(`${g(CAR_REAR('#999'), 34, 52, 1.35)}${g(CAR_REAR('#999'), 66, 52, 1.35)}`)),
  S('freeRide', 'prohibition', 'End of all restrictions', 'Freie Fahrt', 'Cancels the speed limits and overtaking bans signed before. General rules and limits still apply.', '', endRing('')),

  // ── Mandatory
  S('turnLeft', 'mandatory', 'Turn left', 'Linksabbiegen', 'You must turn left at the junction.', '', mandatory(g(TURN_LEFT(WHT), 50, 52, 1))),
  S('aheadRight', 'mandatory', 'Straight on or right', 'Geradeaus oder Rechtsabbiegen', 'You may go straight on or turn right; turning left is not allowed.', '',
    mandatory(`<path fill="${WHT}" d="M36 84 V34 H28 L42 14 L56 34 H48 V52 H62 V44 L80 58 L62 72 V64 H48 V84 Z"/>`)),
  S('aheadLeft', 'mandatory', 'Straight on or left', 'Geradeaus oder Linksabbiegen', 'You may go straight on or turn left; turning right is not allowed.', '',
    mandatory(FLIP(`<path fill="${WHT}" d="M36 84 V34 H28 L42 14 L56 34 H48 V52 H62 V44 L80 58 L62 72 V64 H48 V84 Z"/>`))),
  S('leftRight', 'mandatory', 'Turn left or right', 'Rechts- oder Linksabbiegen', 'You must turn left or right; going straight on is not allowed.', '',
    mandatory(`<path fill="${WHT}" d="M44 86 V56 H32 V66 L12 50 L32 34 V44 H68 V34 L88 50 L68 66 V56 H56 V86 Z"/>`)),
  S('keepLeft', 'mandatory', 'Pass on the left', 'Hindernis links umfahren', 'Pass the obstacle or island on its left.', '', mandatory(`<g transform="translate(50 50) rotate(-135)">${ARROW_UP(WHT)}</g>`)),
  S('passEither', 'mandatory', 'Pass either side', 'Hindernis links oder rechts umfahren', 'You may pass the obstacle on either side.', '',
    mandatory(`<g transform="translate(34 52) rotate(-145) scale(0.7)">${ARROW_UP(WHT)}</g><g transform="translate(66 52) rotate(145) scale(0.7)">${ARROW_UP(WHT)}</g>`)),
  S('minSpeed', 'mandatory', 'Minimum speed', 'Mindestgeschwindigkeit', 'Drive at least this fast when conditions allow. Vehicles that cannot may not use the lane or road.', '', mandatory(TXT('60', 46, WHT))),
  S('chains', 'mandatory', 'Snow chains compulsory', 'Schneeketten obligatorisch', 'Carry on only with snow chains fitted to at least two driving wheels.', '',
    mandatory(`<circle cx="50" cy="50" r="26" fill="none" stroke="${WHT}" stroke-width="9"/><g stroke="${BLUE}" stroke-width="3">${[0, 45, 90, 135].map((a) => `<line x1="20" y1="50" x2="80" y2="50" transform="rotate(${a} 50 50)"/>`).join('')}</g><circle cx="50" cy="50" r="12" fill="${BLUE}"/>`)),

  // ── Information
  S('motorwayEnd', 'info', 'End of motorway', 'Ende der Autobahn', 'The motorway ends. Lower limits, junctions and oncoming traffic follow: adjust your speed.', '', strike(MOTORWAY_SVG)),
  S('express', 'info', 'Expressway', 'Autostrasse', 'Motor vehicles only, 100 km/h unless signed lower, vignette required. Often a single carriageway with oncoming traffic.', '', EXPRESS_SVG),
  S('expressEnd', 'info', 'End of expressway', 'Ende der Autostrasse', 'The expressway ends; ordinary road rules and limits apply again.', '', strike(EXPRESS_SVG)),
  S('tunnel', 'info', 'Tunnel', 'Tunnel', 'Dipped headlights on, sunglasses off, keep your distance. No U-turns, no reversing; stop only in an emergency.', '',
    info(`<path d="M20 86 V52 A30 30 0 0 1 80 52 V86 Z" fill="${WHT}"/><path d="M33 86 V56 A17 17 0 0 1 67 56 V86 Z" fill="${BLK}"/>`)),
  S('layby', 'info', 'Emergency lay-by', 'Abstellplatz für Pannenfahrzeuge', 'A bay for breakdowns and emergencies only, usually with an emergency telephone.', '',
    info(`<path d="M30 92 V8 H46 V28 L72 38 V64 L46 74 V92 Z" fill="${WHT}"/>${TXT('SOS', 13, RED, 51, 56)}`)),
  S('onewaySide', 'info', 'One-way street (side board)', 'Einbahnstrasse', 'Traffic flows only in the direction of the arrow. Mounted across the junction to show which way the road runs.', '',
    board(`<path fill="${WHT}" d="M20 23 H96 V12 L132 30 L96 48 V37 H20 Z"/>`, BLUE, 150, 60)),
  S('dirColours', 'info', 'Direction signs: colour code', 'Wegweiser', 'Green leads to motorways and expressways, blue to main roads, white to minor roads and local destinations.', '',
    svg(`<rect x="4" y="4" width="112" height="26" rx="4" fill="#00843d" stroke="${WHT}" stroke-width="2"/><rect x="4" y="34" width="112" height="26" rx="4" fill="${BLUE}" stroke="${WHT}" stroke-width="2"/><rect x="4" y="64" width="112" height="26" rx="4" fill="${WHT}" stroke="#222" stroke-width="2"/>
      <g font-family="Arial" font-weight="700" font-size="15"><text x="12" y="23" fill="${WHT}">Chur  A3</text><text x="12" y="53" fill="${WHT}">Adliswil</text><text x="12" y="83" fill="${BLK}">Zoo</text></g>`, '0 0 120 94')),
  S('detour', 'info', 'Diversion', 'Umleitung', 'Follow the orange signs around a closed road until the diversion ends.', '',
    board(`<text x="60" y="38" text-anchor="middle" font-family="Arial" font-weight="700" font-size="20" fill="${BLK}">Umleitung</text><path fill="${BLK}" d="M112 30 L128 30 M120 20 L132 30 L120 40 Z"/>`, '#f39200', 150, 60, BLK)),

  // ── Zones & speed
  S('speed100', 'zones', 'Speed limit 100', 'Höchstgeschwindigkeit 100', '100 km/h is also the general limit on expressways (Autostrassen).', '', speedSVG(100)),
  S('speed120', 'zones', 'Speed limit 120', 'Höchstgeschwindigkeit 120', '120 km/h is the general limit on motorways. It is a maximum for good conditions, not a target.', '', speedSVG(120)),
  S('general50', 'zones', '50 general limit', 'Höchstgeschwindigkeit 50 generell', 'From here the general 50 km/h limit for built-up areas applies on every street, until an end sign or another limit.', '',
    svg(`<rect x="3" y="3" width="94" height="124" rx="8" fill="${WHT}" stroke="#222" stroke-width="2"/><circle cx="50" cy="52" r="36" fill="${WHT}" stroke="${RED}" stroke-width="9"/>${TXT('50', 36, BLK, 52)}<text x="50" y="112" text-anchor="middle" font-family="Arial" font-weight="700" font-size="15" fill="${BLK}">generell</text>`, '0 0 100 130')),
  S('townStart', 'zones', 'Place-name board', 'Ortsbeginn', 'Start of a town or village: blue on main roads, white on minor roads. Expect the "50 generell" sign with it or soon after.', '',
    board(`<text x="75" y="38" text-anchor="middle" font-family="Arial" font-weight="700" font-size="22" fill="${WHT}">Adliswil</text>`, BLUE, 150, 60)),
  S('townEnd', 'zones', 'End of place', 'Ortsende', 'You are leaving the town or village; the upper line names the next place.', '',
    board(`<text x="75" y="24" text-anchor="middle" font-family="Arial" font-weight="700" font-size="14" fill="${WHT}">Langnau a.A.</text><line x1="10" y1="31" x2="140" y2="31" stroke="${WHT}" stroke-width="2"/><text x="75" y="49" text-anchor="middle" font-family="Arial" font-weight="700" font-size="15" fill="${WHT}">Adliswil</text><line x1="14" y1="54" x2="136" y2="36" stroke="${RED}" stroke-width="4"/>`, BLUE, 150, 60)),
  S('zone30end', 'zones', 'End of 30 zone', 'Ende der Tempo-30-Zone', 'The zone ends. The general limit applies again and right-before-left is no longer the default at every junction.', '', zoneEnd(30)),
  S('blueZone', 'zones', 'Blue zone parking', 'Parkieren mit Parkscheibe (Blaue Zone)', 'Parking in blue-marked bays with the blue parking disc, normally for one hour on working days. Set the disc to your arrival time.', '',
    info(`${TXT('P', 54, WHT, 40)}<rect x="30" y="66" width="40" height="22" rx="3" fill="${WHT}"/><circle cx="50" cy="77" r="7" fill="none" stroke="${BLUE}" stroke-width="2.5"/><line x1="50" y1="77" x2="50" y2="72" stroke="${BLUE}" stroke-width="2"/>`)),

  // ── Road markings
  S('mDouble', 'markings', 'Double solid line', 'Doppelte Sicherheitslinie', 'Must not be crossed or straddled from either side.', '', asphalt(`<line x1="46" y1="0" x2="46" y2="100" stroke="${WHT}" stroke-width="3.5"/><line x1="54" y1="0" x2="54" y2="100" stroke="${WHT}" stroke-width="3.5"/>`)),
  S('mMixed', 'markings', 'Solid beside dashed', 'Doppellinie (Sicherheits- und Leitlinie)', 'You may cross only if the dashed line is on your side, for example to finish overtaking.', '', asphalt(`<line x1="46" y1="0" x2="46" y2="100" stroke="${WHT}" stroke-width="3.5"/><line x1="54" y1="0" x2="54" y2="100" stroke="${WHT}" stroke-width="3.5" stroke-dasharray="16 12"/>`)),
  S('mArrows', 'markings', 'Lane arrows', 'Einspurpfeile', 'Get into the lane for your direction early. Once the lines are solid you must follow the arrow of the lane you are in.', '',
    asphalt(`<line x1="50" y1="0" x2="50" y2="100" stroke="${WHT}" stroke-width="3"/>${g(TURN_LEFT(WHT), 27, 54, 0.75)}<g transform="translate(73 52) scale(0.62)">${ARROW_UP(WHT)}</g>`)),
  S('mNoPark', 'markings', 'No-parking line', 'Parkverbotslinie', 'A yellow line broken by crosses along the kerb: no parking. Stopping briefly to let people in or out is allowed.', '',
    asphalt(`<g stroke="${YEL}" stroke-width="3.5" fill="none"><path d="M6 72 H30 M40 72 H64 M74 72 H94"/><path d="M31 67 L39 77 M39 67 L31 77 M65 67 L73 77 M73 67 L65 77"/></g>`)),
  S('mNoStop', 'markings', 'No-stopping line', 'Halteverbotslinie', 'A continuous yellow line along the kerb: no stopping at all, not even briefly.', '', asphalt(`<line x1="6" y1="72" x2="94" y2="72" stroke="${YEL}" stroke-width="4"/>`)),
  S('mBlueBay', 'markings', 'Blue parking bays', 'Blaue Zone', 'Blue bays need the blue parking disc; white bays follow the signs or meter; yellow bays are private or reserved.', '',
    asphalt(`<g fill="none" stroke="#3aa0ff" stroke-width="4"><path d="M14 20 V80 M42 20 V80 M70 20 V80 M14 20 H92"/></g>`)),
  S('mBikeBox', 'markings', 'Advanced stop box for cyclists', 'Ausgeweiteter Radstreifen', 'Cyclists wait in the yellow box ahead of you at the lights. Stop at the first line and leave the box free.', '',
    asphalt(`<rect x="10" y="58" width="80" height="5" fill="${WHT}"/><rect x="10" y="22" width="80" height="4" fill="${YEL}"/><g transform="translate(50 42) scale(0.7)">${BIKE(YEL)}</g>`)),

  // ── Traffic lights
  S('lGreenArrow', 'lights', 'Green arrow', 'Grüner Pfeil', 'You may go in the direction of the arrow, and no conflicting traffic or pedestrian stream has green at the same time.', '', lightArrow('g')),
  S('lYellowArrow', 'lights', 'Flashing yellow beside green', 'Gelbes Blinklicht beim Abbiegen', 'You may turn, but with care: pedestrians and cyclists crossing the road you turn into have priority.', '', lightArrow('y', true)),
  S('lLane', 'lights', 'Lane signals', 'Fahrstreifen-Lichtsignale', 'Above each lane: a red cross means the lane is closed, a green arrow means it is open, a flashing yellow arrow means change lane now.', '',
    svg(`<rect x="4" y="26" width="42" height="48" rx="6" fill="#1d1f24"/><g stroke="#ff3030" stroke-width="7"><line x1="14" y1="38" x2="36" y2="62"/><line x1="36" y1="38" x2="14" y2="62"/></g><rect x="54" y="26" width="42" height="48" rx="6" fill="#1d1f24"/><g transform="translate(75 50) rotate(180) scale(0.62)">${ARROW_UP('#1fe07a')}</g>`)),
);

export const SIGN_BY_ID = Object.fromEntries(SIGNS.map((s) => [s.id, s]));
export const signSVG = (id) => (SIGN_BY_ID[id] ? SIGN_BY_ID[id].svg : '');

// ── Canvas images (for in-game sign billboards & HUD)
const imgCache = new Map();
export function signImage(id) {
  if (imgCache.has(id)) return imgCache.get(id);
  let s;
  if (id.startsWith('speed:')) s = speedSVG(+id.slice(6));
  else s = signSVG(id);
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
  imgCache.set(id, img);
  return img;
}

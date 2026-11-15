// Builds src/components/map/stAndrewsGeo.js from OpenStreetMap data (© OpenStreetMap contributors, ODbL).
// Run once; the app then draws St Andrews without calling any map service.
//
//   node scripts/build-st-andrews-map.mjs <osm.json>
//
// <osm.json> is the `out geom` answer of the Overpass query in scripts/st-andrews-map.overpass
// (POST it to https://overpass-api.de/api/interpreter). Output coordinates are metres in the map's
// own projection (equirectangular, cos(lat) corrected), simplified to about 3 m.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const BOUNDS = { latMin: 56.326, latMax: 56.366, lngMin: -2.845, lngMax: -2.755 };
const M_PER_DEG = 111320;
const COS_LAT = Math.cos((((BOUNDS.latMin + BOUNDS.latMax) / 2) * Math.PI) / 180);
export const WORLD_W = Math.round((BOUNDS.lngMax - BOUNDS.lngMin) * COS_LAT * M_PER_DEG);
export const WORLD_H = Math.round((BOUNDS.latMax - BOUNDS.latMin) * M_PER_DEG);
const project = ({ lat, lon }) => [(lon - BOUNDS.lngMin) * COS_LAT * M_PER_DEG, (BOUNDS.latMax - lat) * M_PER_DEG];

// ---------- geometry helpers (planar, metres) ----------
function simplify(pts, tol) { // Douglas–Peucker
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = pts[a], [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
    let max = 0, idx = -1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / len;
      if (d > max) { max = d; idx = i; }
    }
    if (max > tol) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
const r = (n) => Math.round(n);
function pathD(pts, closed) {
  const s = simplify(pts, 3).map(([x, y]) => [r(x), r(y)]);
  if (s.length < 2) return '';
  let d = `M${s[0][0]} ${s[0][1]}`;
  for (let i = 1; i < s.length; i++) d += `l${s[i][0] - s[i - 1][0]} ${s[i][1] - s[i - 1][1]}`;
  return closed ? d + 'z' : d;
}
const area = (pts) => { let a = 0; for (let i = 0; i < pts.length; i++) { const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length]; a += x1 * y2 - x2 * y1; } return a / 2; };
const bboxOf = (pts) => pts.reduce((b, [x, y]) => [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)], [Infinity, Infinity, -Infinity, -Infinity]);
const touchesWorld = (pts, pad = 200) => { const b = bboxOf(pts); return b[2] > -pad && b[0] < WORLD_W + pad && b[3] > -pad && b[1] < WORLD_H + pad; };

// ---------- coastline → land polygon ----------
// OSM coastline ways run with land on the left in map space (y up).
// Chain the ways, clip the chain to a frame a little larger than the world, and close each piece
// along the frame on the land side.
function chainWays(ways) {
  const lines = ways.map((w) => w.map(project));
  const key = ([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`;
  const out = [];
  const used = new Set();
  for (let i = 0; i < lines.length; i++) {
    if (used.has(i)) continue;
    used.add(i);
    let line = [...lines[i]];
    let grown = true;
    while (grown) {
      grown = false;
      for (let j = 0; j < lines.length; j++) {
        if (used.has(j)) continue;
        if (key(lines[j][0]) === key(line[line.length - 1])) { line = line.concat(lines[j].slice(1)); used.add(j); grown = true; }
        else if (key(lines[j][lines[j].length - 1]) === key(line[0])) { line = lines[j].slice(0, -1).concat(line); used.add(j); grown = true; }
      }
    }
    out.push(line);
  }
  return out;
}

function landPolygons(coastWays) {
  const PAD = 300;
  const F = { x0: -PAD, y0: -PAD, x1: WORLD_W + PAD, y1: WORLD_H + PAD };
  const inside = ([x, y]) => x >= F.x0 && x <= F.x1 && y >= F.y0 && y <= F.y1;
  const cross = (p, q) => { // first point where segment p→q meets the frame
    let best = null;
    const tryT = (t) => { if (t >= 0 && t <= 1) { const pt = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]; if (pt[0] >= F.x0 - 1e-6 && pt[0] <= F.x1 + 1e-6 && pt[1] >= F.y0 - 1e-6 && pt[1] <= F.y1 + 1e-6 && (!best || t < best.t)) best = { t, pt }; } };
    if (q[0] !== p[0]) { tryT((F.x0 - p[0]) / (q[0] - p[0])); tryT((F.x1 - p[0]) / (q[0] - p[0])); }
    if (q[1] !== p[1]) { tryT((F.y0 - p[1]) / (q[1] - p[1])); tryT((F.y1 - p[1]) / (q[1] - p[1])); }
    return best?.pt;
  };
  // Position along the frame perimeter, clockwise in screen space from the top-left corner.
  const W = F.x1 - F.x0, H = F.y1 - F.y0;
  const perim = ([x, y]) => {
    if (Math.abs(y - F.y0) < 1e-3) return x - F.x0;
    if (Math.abs(x - F.x1) < 1e-3) return W + (y - F.y0);
    if (Math.abs(y - F.y1) < 1e-3) return W + H + (F.x1 - x);
    return 2 * W + H + (F.y1 - y);
  };
  const corners = [[F.x1, F.y0, W], [F.x1, F.y1, W + H], [F.x0, F.y1, 2 * W + H], [F.x0, F.y0, 2 * W + 2 * H]];
  const total = 2 * W + 2 * H;

  const closedRings = [];
  const pieces = []; // open pieces from frame entry to frame exit
  // Reversed so land is on the right of travel in y-down space (OSM: land left in y-up space).
  for (const line of chainWays(coastWays).map((l) => l.reverse())) {
    const closed = line.length > 3 && Math.hypot(line[0][0] - line.at(-1)[0], line[0][1] - line.at(-1)[1]) < 0.5;
    if (closed) { if (touchesWorld(line)) closedRings.push(line); continue; }
    let cur = inside(line[0]) ? [line[0]] : null;
    for (let i = 1; i < line.length; i++) {
      const p = line[i - 1], q = line[i];
      if (cur && inside(q)) cur.push(q);
      else if (cur && !inside(q)) { cur.push(cross(q, p) ?? q); pieces.push(cur); cur = null; }
      else if (!cur && inside(q)) { cur = [cross(p, q) ?? p, q]; }
    }
    if (cur) pieces.push(cur); // ends inside the frame (should not happen with a wide query)
  }

  // Walk: end of a piece → clockwise along the frame (land on the right in y-down space) → next piece start.
  const rings = [];
  const left = new Set(pieces.map((_, i) => i));
  while (left.size) {
    const first = left.values().next().value;
    let ring = [...pieces[first]];
    left.delete(first);
    let idx = first;
    for (let guard = 0; guard < 100; guard++) {
      const endPos = perim(pieces[idx].at(-1));
      // next piece start clockwise from endPos
      let bestJ = -1, bestD = Infinity;
      for (let j = 0; j < pieces.length; j++) {
        if (j !== first && !left.has(j)) continue;
        const d = ((perim(pieces[j][0]) - endPos) % total + total) % total;
        if (d < bestD) { bestD = d; bestJ = j; }
      }
      for (const [cx, cy, cp] of corners.concat(corners.map(([a, b, c]) => [a, b, c + total]))) {
        const d = cp - endPos;
        if (d > 0 && d < bestD) ring.push([cx, cy]);
      }
      if (bestJ === first) break;
      ring = ring.concat(pieces[bestJ]);
      left.delete(bestJ);
      idx = bestJ;
    }
    rings.push(ring);
  }
  // Islands (closed coastline rings) are land too.
  return rings.concat(closedRings).map((ring) => pathD(ring, true)).filter(Boolean);
}

// ---------- classify OSM features ----------
const MAJOR = new Set(['primary', 'secondary', 'tertiary']);
const MINOR = new Set(['unclassified', 'residential', 'pedestrian', 'living_street']);
const PARK = new Set(['park', 'garden', 'recreation_ground', 'pitch', 'nature_reserve']);
const GREEN_LANDUSE = new Set(['grass', 'recreation_ground', 'cemetery', 'meadow']);
const FIELDS = new Set(['farmland', 'forest']);

function build(osm) {
  const out = { land: [], beach: [], golf: [], park: [], fields: [], town: [], water: [], major: [], minor: [], paths: [], piers: [], names: {} };
  const coast = [];
  const geomOf = (e) => (e.geometry ?? []).filter(Boolean);
  for (const e of osm.elements) {
    const t = e.tags ?? {};
    if (e.type === 'relation') {
      if (t.leisure === 'golf_course' || PARK.has(t.leisure) || t.leisure === 'garden') {
        for (const m of e.members ?? []) {
          if (m.role !== 'outer' || !m.geometry) continue;
          const pts = m.geometry.map(project);
          if (touchesWorld(pts)) (t.leisure === 'golf_course' ? out.golf : out.park).push(pathD(pts, true));
        }
      }
      continue;
    }
    const g = geomOf(e);
    if (g.length < 2) continue;
    const pts = g.map(project);
    if (t.natural === 'coastline') { coast.push(g); continue; }
    if (!touchesWorld(pts)) continue;
    const closed = g.length > 3 && g[0].lat === g.at(-1).lat && g[0].lon === g.at(-1).lon;
    if (t.highway && MAJOR.has(t.highway)) out.major.push(pathD(pts, false));
    else if (t.highway && MINOR.has(t.highway)) out.minor.push(pathD(pts, false));
    else if (t.highway) { if (/lade braes/i.test(t.name ?? '')) out.paths.push(pathD(pts, false)); }
    else if (t.waterway) out.water.push(pathD(pts, false));
    else if (t.leisure === 'golf_course' && closed) out.golf.push(pathD(pts, true));
    else if (PARK.has(t.leisure) && closed && Math.abs(area(pts)) > 1500) out.park.push(pathD(pts, true));
    else if (t.landuse === 'residential' && closed) out.town.push(pathD(pts, true));
    else if (GREEN_LANDUSE.has(t.landuse) && closed && Math.abs(area(pts)) > 1500) out.park.push(pathD(pts, true));
    else if ((FIELDS.has(t.landuse) || t.natural === 'wood' || t.natural === 'scrub') && closed) out.fields.push(pathD(pts, true));
    else if ((t.natural === 'beach' || t.natural === 'sand') && closed) out.beach.push(pathD(pts, true));
    else if (t.man_made) out.piers.push(pathD(pts, closed));
  }
  out.land = landPolygons(coast);
  delete out.names;
  for (const k of Object.keys(out)) out[k] = out[k].filter(Boolean);
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const osm = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  const geo = build(osm);
  const join = (arr) => JSON.stringify(arr.join(''));
  const lines = Object.entries(geo).map(([k, v]) => `  ${k}: ${join(v)},`);
  const file = `// Generated by scripts/build-st-andrews-map.mjs from OpenStreetMap data. Do not edit by hand.
// Map data © OpenStreetMap contributors, available under the Open Database Licence (ODbL).
// SVG path data in metres; origin at the north-west corner of BOUNDS, y grows southwards.
export const BOUNDS = ${JSON.stringify(BOUNDS)};
export const WORLD_W = ${WORLD_W};
export const WORLD_H = ${WORLD_H};
export const GEO = {
${lines.join('\n')}
};
`;
  const target = new URL('../src/components/map/stAndrewsGeo.js', import.meta.url);
  writeFileSync(target, file);
  console.log(Object.fromEntries(Object.entries(geo).map(([k, v]) => [k, v.length])), `${(file.length / 1024).toFixed(1)} KB`);
}

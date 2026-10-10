#!/usr/bin/env python3
"""
Build compact game data for "Züri Drive" from raw Overpass JSON.

Usage:
    python3 build_map.py <raw_dir> <out_dir>

Reads   roads.json, restrictions.json, pois.json, trees.json, areas_*.json   (see fetch_osm.py)
Writes  graph.json   road network: nodes, edges, lanes, junction control, crossings, trams
        dem.bin      terrain height grid (uint16, decimetres above BASE_ELEV)
        big.json     large polygons (lake, rivers, forests, big parks)
        tiles/X_Z.json  buildings, small green areas, rails and trees per 500 m tile

World frame: x = east (m), z = south (m), y = up (m); origin at LAT0/LON0.
All coordinates are stored as integer decimetres.

Heights are metres above BASE_ELEV, taken from open elevation data. Roads lie on the terrain;
bridges and tunnels run straight between their ends, lifted or dipped where they cross something.
"""
import glob
import hashlib
import heapq
import json
import math
import os
import sys
from collections import defaultdict

LAT0, LON0 = 47.3600, 8.5300
KX = 111320.0 * math.cos(math.radians(LAT0))
KZ = 111200.0
TILE = 500.0

ROAD_TYPES = {
    "motorway": 0, "trunk": 1, "primary": 2, "secondary": 3, "tertiary": 4,
    "unclassified": 5, "residential": 6, "living_street": 7, "service": 8,
}
LINK_PARENT = {
    "motorway_link": "motorway", "trunk_link": "trunk", "primary_link": "primary",
    "secondary_link": "secondary", "tertiary_link": "tertiary",
}
RANK = {0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 5, 7: 7, 8: 8}
DEFAULT_SPEED = {0: 120, 1: 100, 2: 50, 3: 50, 4: 50, 5: 50, 6: 50, 7: 20, 8: 20}
SKIP_SERVICE = {"driveway", "parking_aisle", "drive-through", "emergency_access", "private", "parking", "yard", "slipway"}

# edge flags
F_ONEWAY, F_BRIDGE, F_TUNNEL, F_ROUNDABOUT, F_LINK, F_CYCLE_F, F_CYCLE_B, F_PASSAGE = 1, 2, 4, 8, 16, 32, 64, 128
# approach control
C_EQUAL, C_YIELD, C_STOP, C_SIGNAL, C_PRIORITY, C_NONE = 0, 1, 2, 3, 4, 5

BRIDGE_H, BRIDGE_SLOPE = 6.5, 0.06
TUNNEL_D, TUNNEL_SLOPE = 7.5, 0.08


def proj(lat, lon):
    return ((lon - LON0) * KX, -(lat - LAT0) * KZ)


def num(v, default=None):
    if v is None:
        return default
    try:
        return int(float(str(v).split(";")[0].split(" ")[0]))
    except ValueError:
        return default


def dm(v):
    return int(round(v * 10))


def dp_simplify(pts, tol):
    """Douglas-Peucker on a list of tuples (uses all dimensions)."""
    if len(pts) < 3:
        return list(pts)
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        a, b = stack.pop()
        pa, pb = pts[a], pts[b]
        d = [q - p for p, q in zip(pa, pb)]
        L2 = sum(c * c for c in d)
        best, bi = -1.0, -1
        for i in range(a + 1, b):
            v = [q - p for p, q in zip(pa, pts[i])]
            if L2 == 0:
                dist = math.sqrt(sum(c * c for c in v))
            else:
                t = max(0.0, min(1.0, sum(x * y for x, y in zip(v, d)) / L2))
                dist = math.sqrt(sum((x - t * y) ** 2 for x, y in zip(v, d)))
            if dist > best:
                best, bi = dist, i
        if best > tol:
            keep[bi] = True
            stack.append((a, bi))
            stack.append((bi, b))
    return [p for p, k in zip(pts, keep) if k]


def poly_area(pts):
    a = 0.0
    for i in range(len(pts)):
        x1, z1 = pts[i]
        x2, z2 = pts[(i + 1) % len(pts)]
        a += x1 * z2 - x2 * z1
    return a / 2


def seg_intersect(p1, p2, p3, p4):
    def orient(a, b, c):
        return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
    d1, d2 = orient(p3, p4, p1), orient(p3, p4, p2)
    d3, d4 = orient(p1, p2, p3), orient(p1, p2, p4)
    return ((d1 > 0) != (d2 > 0)) and ((d3 > 0) != (d4 > 0))


def pt_seg_dist(p, a, b):
    dx, dz = b[0] - a[0], b[1] - a[1]
    L2 = dx * dx + dz * dz
    t = 0.0 if L2 == 0 else max(0.0, min(1.0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / L2))
    return math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz), t


def stable_rand(key):
    return int(hashlib.md5(str(key).encode()).hexdigest()[:8], 16) / 0xFFFFFFFF


class Grid:
    def __init__(self, cell):
        self.cell = cell
        self.cells = defaultdict(list)

    def add_seg(self, a, b, item):
        c = self.cell
        x0, x1 = sorted((a[0], b[0]))
        z0, z1 = sorted((a[1], b[1]))
        for gx in range(int(x0 // c), int(x1 // c) + 1):
            for gz in range(int(z0 // c), int(z1 // c) + 1):
                self.cells[(gx, gz)].append(item)

    def near(self, a, b, pad=0.0):
        c = self.cell
        x0, x1 = sorted((a[0], b[0]))
        z0, z1 = sorted((a[1], b[1]))
        seen = set()
        for gx in range(int((x0 - pad) // c), int((x1 + pad) // c) + 1):
            for gz in range(int((z0 - pad) // c), int((z1 + pad) // c) + 1):
                for it in self.cells.get((gx, gz), ()):
                    if it not in seen:
                        seen.add(it)
                        yield it


# ───────────────────────────── terrain ─────────────────────────────

DEM_ZOOM = 13
DEM_STEP = 25.0      # metres between samples of the game's height grid
BASE_ELEV = 300.0    # heights are stored relative to this (metres above sea level)


def read_png_rgb(path):
    """Minimal PNG reader for 8-bit RGB, non-interlaced images (all the terrain tiles are)."""
    import struct
    import zlib
    data = open(path, "rb").read()
    pos, idat, w, h = 8, b"", 0, 0
    while pos < len(data):
        n, kind = struct.unpack(">I4s", data[pos:pos + 8])
        body = data[pos + 8:pos + 8 + n]
        if kind == b"IHDR":
            w, h, depth, ctype = struct.unpack(">IIBB", body[:10])
            if depth != 8 or ctype != 2:
                raise ValueError(f"{path}: unsupported PNG type")
        elif kind == b"IDAT":
            idat += body
        pos += 12 + n
    raw, stride, out, prev = zlib.decompress(idat), w * 3, [], bytearray(w * 3)
    for y in range(h):
        f = raw[y * (stride + 1)]
        row = bytearray(raw[y * (stride + 1) + 1:(y + 1) * (stride + 1)])
        if f == 1:
            for i in range(3, stride):
                row[i] = (row[i] + row[i - 3]) & 255
        elif f == 2:
            for i in range(stride):
                row[i] = (row[i] + prev[i]) & 255
        elif f == 3:
            for i in range(stride):
                row[i] = (row[i] + ((row[i - 3] if i >= 3 else 0) + prev[i]) // 2) & 255
        elif f == 4:
            for i in range(stride):
                a = row[i - 3] if i >= 3 else 0
                b = prev[i]
                c = prev[i - 3] if i >= 3 else 0
                pa, pb, pc = abs(b - c), abs(a - c), abs(a + b - 2 * c)
                row[i] = (row[i] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 255
        out.append(row)
        prev = row
    return w, h, out


class Terrain:
    """Real elevation, resampled onto a regular grid in the game's world frame."""

    def __init__(self, raw_dir, bounds):
        self.tiles = {}
        self.dir = os.path.join(raw_dir, "dem")
        x0, z0, x1, z1 = bounds
        self.x0, self.z0 = math.floor(x0 / DEM_STEP) * DEM_STEP, math.floor(z0 / DEM_STEP) * DEM_STEP
        self.nx, self.nz = int((x1 - self.x0) / DEM_STEP) + 2, int((z1 - self.z0) / DEM_STEP) + 2
        self.grid = [0.0] * (self.nx * self.nz)
        for j in range(self.nz):
            for i in range(self.nx):
                x, z = self.x0 + i * DEM_STEP, self.z0 + j * DEM_STEP
                self.grid[j * self.nx + i] = self._source(LAT0 - z / KZ, LON0 + x / KX) - BASE_ELEV
        lo, hi = min(self.grid), max(self.grid)
        print(f"  terrain: {self.nx} x {self.nz} samples, {lo + BASE_ELEV:.0f} to {hi + BASE_ELEV:.0f} m above sea level")

    def _pixel(self, tx, ty, px, py):
        key = (tx, ty)
        if key not in self.tiles:
            path = os.path.join(self.dir, f"{DEM_ZOOM}_{tx}_{ty}.png")
            self.tiles[key] = read_png_rgb(path)[2] if os.path.exists(path) else None
        rows = self.tiles[key]
        if rows is None:
            return None
        r, g, b = rows[py][px * 3:px * 3 + 3]
        return r * 256 + g + b / 256 - 32768

    def _source(self, lat, lon):
        k = 2 ** DEM_ZOOM
        fx = (lon + 180) / 360 * k * 256 - 0.5
        fy = (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * k * 256 - 0.5
        ix, iy = int(math.floor(fx)), int(math.floor(fy))
        ax, ay, tot, wsum = fx - ix, fy - iy, 0.0, 0.0
        for dx, dy, wgt in ((0, 0, (1 - ax) * (1 - ay)), (1, 0, ax * (1 - ay)), (0, 1, (1 - ax) * ay), (1, 1, ax * ay)):
            v = self._pixel((ix + dx) // 256, (iy + dy) // 256, (ix + dx) % 256, (iy + dy) % 256)
            if v is not None:
                tot += v * wgt
                wsum += wgt
        return tot / wsum if wsum else 410.0

    def at(self, x, z):
        fx = min(max((x - self.x0) / DEM_STEP, 0), self.nx - 1.001)
        fz = min(max((z - self.z0) / DEM_STEP, 0), self.nz - 1.001)
        i, j = int(fx), int(fz)
        ax, az, g, n = fx - i, fz - j, self.grid, self.nx
        return (g[j * n + i] * (1 - ax) + g[j * n + i + 1] * ax) * (1 - az) + (g[(j + 1) * n + i] * (1 - ax) + g[(j + 1) * n + i + 1] * ax) * az

    def write(self, path):
        import struct
        with open(path, "wb") as f:
            f.write(struct.pack(f"<{len(self.grid)}H", *[max(0, min(65535, int(round(v * 10)))) for v in self.grid]))
        return {"x0": self.x0, "z0": self.z0, "step": DEM_STEP, "nx": self.nx, "nz": self.nz, "base": BASE_ELEV}


def densify(pts, keys, tag, step=30.0):
    """Insert extra points so no stretch is longer than `step`: roads then follow the hills between map nodes."""
    op, ok = [pts[0]], [keys[0]]
    for i in range(1, len(pts)):
        d = math.dist(pts[i - 1], pts[i])
        n = int(d // step)
        for j in range(1, n + 1):
            t = j / (n + 1)
            op.append((pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t))
            ok.append(("d", tag, i, j))
        op.append(pts[i])
        ok.append(keys[i])
    return op, ok


# ───────────────────────────── roads ─────────────────────────────

def load_ways(raw_dir):
    """Returns (ways, feature_nodes). Each way: kind, keys, pts, tags, plus derived attributes."""
    elements = json.load(open(os.path.join(raw_dir, "roads.json")))["elements"]
    ways, feats = [], {}
    for e in elements:
        t = e.get("tags", {})
        if e["type"] == "node":
            feats[e["id"]] = (t, proj(e["lat"], e["lon"]))
            continue
        if e["type"] != "way" or "geometry" not in e:
            continue
        ok = [i for i, g in enumerate(e["geometry"]) if g]
        pts = [proj(e["geometry"][i]["lat"], e["geometry"][i]["lon"]) for i in ok]
        keys = [e["nodes"][i] for i in ok]
        if len(pts) < 2:
            continue
        if t.get("railway") == "tram":
            if t.get("service") in ("yard", "siding", "spur"):
                continue
            ways.append({"kind": "tram", "id": e["id"], "keys": keys, "pts": pts, "tags": t})
            continue
        hw = t.get("highway")
        link = hw in LINK_PARENT
        hw = LINK_PARENT.get(hw, hw)
        if hw not in ROAD_TYPES or t.get("area") == "yes":
            continue
        acc, mv, veh = t.get("access"), t.get("motor_vehicle"), t.get("vehicle")
        if mv in ("no", "private", "agricultural", "forestry") or veh in ("no", "private"):
            continue
        if acc in ("no", "private", "agricultural", "forestry", "customers", "delivery") and mv not in ("yes", "permissive", "destination"):
            continue
        if hw == "service" and (t.get("service") in SKIP_SERVICE or "name" not in t):
            continue
        typ = ROAD_TYPES[hw]
        roundabout = t.get("junction") in ("roundabout", "circular")
        ow = t.get("oneway")
        oneway = ow in ("yes", "1", "true") or hw == "motorway" or roundabout or (link and typ == 0 and ow != "no")
        if ow == "-1":
            oneway = True
            pts.reverse()
            keys.reverse()
        lanes = num(t.get("lanes"))
        if oneway:
            lf = lanes or (2 if typ == 0 and not link else 1)
            lb = 0
        else:
            total = lanes or 2
            lf = num(t.get("lanes:forward")) or max(1, math.ceil(total / 2))
            lb = num(t.get("lanes:backward")) or max(1, total - lf)
        lf, lb = min(lf, 5), min(lb, 4)
        ms = t.get("maxspeed")
        speed = num(ms)
        if speed is None:
            speed = {"walk": 10, "CH:urban": 50, "CH:rural": 80, "CH:motorway": 120, "CH:trunk": 100, "signals": 50}.get(ms)
        if speed is None:
            speed = 80 if (link and typ <= 1) else DEFAULT_SPEED[typ]
        flags = (F_ONEWAY if oneway else 0) | (F_ROUNDABOUT if roundabout else 0) | (F_LINK if link else 0)
        cyc = lambda k: t.get(k) == "lane"  # noqa: E731
        if cyc("cycleway") or cyc("cycleway:both") or cyc("cycleway:right"):
            flags |= F_CYCLE_F
        if not oneway and (cyc("cycleway") or cyc("cycleway:both") or cyc("cycleway:left")):
            flags |= F_CYCLE_B
        if t.get("tunnel") in ("building_passage", "passage"):
            flags |= F_PASSAGE
        w = {"kind": "road", "id": e["id"], "keys": keys, "pts": pts, "tags": t, "typ": typ, "link": link,
             "oneway": oneway, "lf": lf, "lb": lb, "speed": speed, "flags": flags,
             "name": t.get("name") or t.get("ref") or ""}
        if oneway:
            w["tf"] = t.get("turn:lanes") or t.get("turn:lanes:forward") or ""
            w["tb"] = ""
        else:
            w["tf"] = t.get("turn:lanes:forward") or ""
            w["tb"] = t.get("turn:lanes:backward") or ""
        ways.append(w)
    return ways, feats


def load_rails(raw_dir):
    """Rail lines from the area files; nodes are keyed by coordinate since `out geom` has no ids."""
    rails, seen = [], set()
    for path in sorted(glob.glob(os.path.join(raw_dir, "areas_*.json"))):
        for e in json.load(open(path))["elements"]:
            t = e.get("tags", {})
            if e["type"] != "way" or t.get("railway") != "rail" or e["id"] in seen or "geometry" not in e:
                continue
            seen.add(e["id"])
            if t.get("tunnel") not in (None, "no") or t.get("service") in ("yard", "siding", "spur", "crossover"):
                continue
            geo = [g for g in e["geometry"] if g]
            if len(geo) < 2:
                continue
            rails.append({"kind": "rail", "id": e["id"], "tags": t,
                          "keys": [("r", round(g["lat"] * 1e7), round(g["lon"] * 1e7)) for g in geo],
                          "pts": [proj(g["lat"], g["lon"]) for g in geo]})
    return rails


def compute_heights(ways, terrain):
    """
    Assigns w['y'] (height per point, relative to BASE_ELEV) and w['g'] (natural ground there) for every way.
    Ordinary roads lie on the terrain. Bridges and tunnels run straight between their ends instead of
    following the ground; bridges are lifted further where they must clear something, and a tunnel on
    flat ground dips so that whatever crosses above it has room.
    """
    for w in ways:
        w["pts"], w["keys"] = densify(w["pts"], w["keys"], (w["kind"], w["id"]))
        t = w["tags"]
        layer = num(t.get("layer"))
        w["struct"], w["L"] = None, 0
        if t.get("bridge") not in (None, "no"):
            L = layer if layer is not None else 1
            if L >= 1:
                w["struct"], w["L"] = "B", min(L, 3)
        elif t.get("tunnel") in ("yes", "covered") and w["kind"] != "rail":
            L = layer if layer is not None else -1
            if L <= -1:
                w["struct"], w["L"] = "T", max(L, -3)

    ground = {}
    for w in ways:
        for k, p in zip(w["keys"], w["pts"]):
            if k not in ground:
                ground[k] = terrain.at(p[0], p[1])

    grid = Grid(60.0)
    for wi, w in enumerate(ways):
        for si in range(len(w["pts"]) - 1):
            grid.add_seg(w["pts"][si], w["pts"][si + 1], (wi, si))

    anchors = {}                 # bridge node -> level it must clear
    crossing_tunnels = set()
    for wi, w in enumerate(ways):
        if not w["struct"]:
            continue
        for si in range(len(w["pts"]) - 1):
            a, b = w["pts"][si], w["pts"][si + 1]
            ka, kb = w["keys"][si], w["keys"][si + 1]
            for (vi, sj) in grid.near(a, b):
                if vi == wi:
                    continue
                v = ways[vi]
                if w["struct"] == "B" and not v["L"] < w["L"]:
                    continue
                if w["struct"] == "T" and not v["L"] > w["L"]:
                    continue
                if v["keys"][sj] in (ka, kb) or v["keys"][sj + 1] in (ka, kb):
                    continue
                if not seg_intersect(a, b, v["pts"][sj], v["pts"][sj + 1]):
                    continue
                if w["struct"] == "B":
                    for k in (ka, kb):
                        anchors[k] = max(anchors.get(k, 0), w["L"])
                else:
                    crossing_tunnels.add(wi)

    adj = defaultdict(list)
    for w in ways:
        for i in range(len(w["pts"]) - 1):
            d = math.dist(w["pts"][i], w["pts"][i + 1])
            adj[w["keys"][i]].append((w["keys"][i + 1], d))
            adj[w["keys"][i + 1]].append((w["keys"][i], d))

    def components(idxs):
        parent = {i: i for i in idxs}

        def find(i):
            while parent[i] != i:
                parent[i] = parent[parent[i]]
                i = parent[i]
            return i

        by_key = defaultdict(list)
        for i in idxs:
            for k in ways[i]["keys"]:
                by_key[k].append(i)
        for members in by_key.values():
            for m in members[1:]:
                parent[find(m)] = find(members[0])
        groups = defaultdict(list)
        for i in idxs:
            groups[find(i)].append(i)
        return list(groups.values())

    def straighten(group, base):
        """Heights along a bridge or tunnel: a straight run between the points where it meets ordinary ground."""
        inside = set(group)
        keys, cadj = set(), defaultdict(list)
        for i in group:
            w = ways[i]
            keys.update(w["keys"])
            for j in range(len(w["keys"]) - 1):
                d = math.dist(w["pts"][j], w["pts"][j + 1])
                cadj[w["keys"][j]].append((w["keys"][j + 1], d))
                cadj[w["keys"][j + 1]].append((w["keys"][j], d))
        outside = set()
        for i, w in enumerate(ways):
            if i not in inside and not w["struct"]:
                outside.update(k for k in w["keys"] if k in keys)
        if not outside:      # cut off by the edge of the map: fall back to its own end points
            ends = [ways[i]["keys"][0] for i in group] + [ways[i]["keys"][-1] for i in group]
            outside = {k for k in ends if ends.count(k) == 1}
        dists = []
        for t in outside:
            dist, heap, tie = {t: 0.0}, [(0.0, 0, t)], 0
            while heap:
                d0, _, k = heapq.heappop(heap)
                if d0 > dist.get(k, 1e18):
                    continue
                for k2, d in cadj[k]:
                    if d0 + d < dist.get(k2, 1e18):
                        dist[k2] = d0 + d
                        tie += 1
                        heapq.heappush(heap, (d0 + d, tie, k2))
            dists.append((t, dist))
        portal = {}
        for k in keys:
            near = sorted((dist.get(k, 1e18), ground[t]) for t, dist in dists)[:2]
            if not near or near[0][0] > 1e17:
                continue
            portal[k] = near[0][0]
            if len(near) == 1 or near[1][0] > 1e17:
                base[k] = near[0][1]
            else:
                (d1, y1), (d2, y2) = near
                base[k] = y1 if d1 + d2 == 0 else (y1 * d2 + y2 * d1) / (d1 + d2)
        return portal

    base = dict(ground)
    bridges = [i for i, w in enumerate(ways) if w["struct"] == "B"]
    for group in components(bridges):
        straighten(group, base)

    tunnels = [i for i, w in enumerate(ways) if w["struct"] == "T"]
    n_sunk = 0
    for group in components(tunnels):
        length = sum(math.dist(ways[i]["pts"][j], ways[i]["pts"][j + 1]) for i in group for j in range(len(ways[i]["pts"]) - 1))
        crosses = any(i in crossing_tunnels for i in group)
        if not crosses and length <= 150:
            continue
        n_sunk += len(group)
        portal = straighten(group, base)
        for i in group:
            w = ways[i]
            w["sunk"] = True
            for k in w["keys"]:
                y = min(base[k], ground[k])               # never above the natural surface
                if crosses:                               # make room for what passes overhead, as far as the ramps allow
                    dip = min(TUNNEL_D * -w["L"], TUNNEL_SLOPE * portal.get(k, 1e9))
                    y = min(y, max(ground[k] - TUNNEL_D + 1.0, base[k] - dip))
                base[k] = y

    # Bridges: where one must clear something, lift it there and let the rise fade out along the road.
    need = {k: max(base[k], ground[k] + BRIDGE_H * L) for k, L in anchors.items()}
    h = dict(need)
    heap = [(-v, i, k) for i, (k, v) in enumerate(need.items())]
    heapq.heapify(heap)
    tie = len(heap)
    tunnel_keys = {k for i in tunnels if ways[i].get("sunk") for k in ways[i]["keys"]}
    while heap:
        nh, _, k = heapq.heappop(heap)
        v = -nh
        if v < h.get(k, -1e9) - 1e-9:
            continue
        for k2, d in adj[k]:
            v2 = v - BRIDGE_SLOPE * d
            if k2 in tunnel_keys or v2 <= base[k2] + 0.05 or v2 <= h.get(k2, -1e9) + 1e-9:
                continue
            h[k2] = v2
            tie += 1
            heapq.heappush(heap, (-v2, tie, k2))

    for w in ways:
        w["y"] = [max(base[k], h.get(k, -1e9)) for k in w["keys"]]
        w["g"] = [ground[k] for k in w["keys"]]
    print(f"  heights: {len(anchors)} bridge anchor nodes, {n_sunk}/{len(tunnels)} tunnel ways below ground")


def build_graph(ways, feats):
    roads = [w for w in ways if w["kind"] == "road"]
    use = defaultdict(int)
    for w in roads:
        for i, k in enumerate(w["keys"]):
            use[k] += 2 if i in (0, len(w["keys"]) - 1) else 1
    # endpoints count double so a lone endpoint (2) or any shared node (>=2) becomes a graph node
    node_idx, nodes, edges = {}, [], []

    def node(k, p, y):
        if k not in node_idx:
            node_idx[k] = len(nodes)
            nodes.append({"k": k, "x": p[0], "z": p[1], "y": y, "ends": []})
        return node_idx[k]

    synth = 0
    for w in roads:
        n = len(w["keys"])
        cuts = [i for i in range(n) if i in (0, n - 1) or use[w["keys"][i]] >= 2]
        pieces = []
        for c0, c1 in zip(cuts, cuts[1:]):
            if w["keys"][c0] == w["keys"][c1] and c1 - c0 >= 2:
                mid = (c0 + c1) // 2
                pieces += [(c0, mid), (mid, c1)]
                synth += 1
            elif w["keys"][c0] != w["keys"][c1]:
                pieces.append((c0, c1))
        for c0, c1 in pieces:
            pts3 = [(w["pts"][i][0], w["pts"][i][1], w["y"][i]) for i in range(c0, c1 + 1)]
            above = [w["y"][i] - w["g"][i] for i in range(c0, c1 + 1)]
            length = sum(math.dist(pts3[i][:2], pts3[i + 1][:2]) for i in range(len(pts3) - 1))
            if length < 0.5:
                continue
            a = node(w["keys"][c0], w["pts"][c0], w["y"][c0])
            b = node(w["keys"][c1], w["pts"][c1], w["y"][c1])
            ei = len(edges)
            flags = w["flags"]
            ys = [p[2] for p in pts3]
            if w.get("sunk"):
                flags |= F_TUNNEL
            if w["struct"] == "B" and max(above) > 1.0:
                flags |= F_BRIDGE
            edges.append({"a": a, "b": b, "w": w, "keys": w["keys"][c0:c1 + 1], "raw": pts3, "above": above, "len": length,
                          "flags": flags, "ca": C_NONE, "cb": C_NONE, "sa": 0, "sb": 0, "ctl_explicit": {}})
            nodes[a]["ends"].append((ei, "a"))
            nodes[b]["ends"].append((ei, "b"))
    print(f"  graph: {len(nodes)} nodes, {len(edges)} edges ({synth} loops split)")

    # ── locate feature nodes on edges ──
    where = defaultdict(list)
    for ei, e in enumerate(edges):
        for k, key in enumerate(e["keys"]):
            where[key].append((ei, k))

    def s_at(e, k):
        return sum(math.dist(e["raw"][i][:2], e["raw"][i + 1][:2]) for i in range(k))

    def deg(n):
        return len(nodes[n]["ends"])

    def can_arrive(e, end):
        """Can traffic travel along edge e towards its `end` ('a' or 'b')?"""
        return end == "b" or not e["w"]["oneway"]

    def walk_to_junction(ei, end, dist0):
        """Follow edge ei towards `end`, passing through degree-2 nodes, to the next real junction."""
        d, hops = dist0, 0
        while hops < 6:
            e = edges[ei]
            n = e[end]
            if deg(n) >= 3:
                return ei, end, d, n
            if deg(n) != 2 or d > 90:
                return None
            (o_ei, o_end), = [x for x in nodes[n]["ends"] if x != (ei, end)] or [(None, None)]
            if o_ei is None or o_ei == ei:
                return None
            ei, end = o_ei, ("b" if o_end == "a" else "a")
            d += edges[ei]["len"]
            hops += 1
        return None

    sig_nodes, mini_nodes, crossings = set(), set(), []
    n_ped_sig = 0
    for fid, (t, _) in feats.items():
        kind = t.get("highway")
        if fid not in where:
            continue
        gi = node_idx.get(fid)
        if kind == "mini_roundabout":
            if gi is not None:
                mini_nodes.add(gi)
            continue
        if kind == "crossing":
            c = t.get("crossing")
            mark = t.get("crossing:markings")
            marked = c in ("uncontrolled", "marked", "zebra", "traffic_signals") or (mark not in (None, "no") and c != "no")
            if not marked or (gi is not None and deg(gi) >= 3):
                continue
            ei, k = where[fid][0]
            e = edges[ei]
            if e["w"]["typ"] <= 1 and not e["w"]["link"]:
                continue
            s = min(max(s_at(e, k), 1.5), e["len"] - 1.5)
            if e["len"] > 4:
                crossings.append({"e": ei, "s": s, "sig": 1 if c == "traffic_signals" else 0})
            continue
        if kind not in ("traffic_signals", "stop", "give_way"):
            continue
        if gi is not None and deg(gi) >= 3:
            if kind == "traffic_signals":
                sig_nodes.add(gi)
            continue
        direction = t.get("traffic_signals:direction") or t.get("direction")
        cands = []
        for ei, k in where[fid]:
            e = edges[ei]
            s = s_at(e, k)
            for end, d0, dname in (("b", e["len"] - s, "forward"), ("a", s, "backward")):
                if direction in ("forward", "backward") and direction != dname:
                    continue
                if not can_arrive(e, end):
                    continue
                if d0 < 0.5 and gi is not None:
                    continue  # feature sits on this end; the other edge handles it
                r = walk_to_junction(ei, end, d0)
                if r:
                    cands.append((r[2], r[0], r[1], r[3], d0 if r[0] == ei else 0))
        if not cands:
            if kind == "traffic_signals":   # mid-block pedestrian light
                ei, k = where[fid][0]
                e = edges[ei]
                if e["len"] > 4 and not (e["w"]["typ"] <= 1 and not e["w"]["link"]):
                    crossings.append({"e": ei, "s": min(max(s_at(e, k), 1.5), e["len"] - 1.5), "sig": 1})
                    n_ped_sig += 1
            continue
        if direction not in ("forward", "backward"):
            cands = [min(cands)]
        for d, ei, end, n, d_on_edge in cands:
            e = edges[ei]
            if kind == "traffic_signals":
                sig_nodes.add(n)
                if d_on_edge:
                    e["s" + end] = d_on_edge
            else:
                e["ctl_explicit"][end] = C_STOP if kind == "stop" else C_YIELD
                if d_on_edge:
                    e["s" + end] = d_on_edge

    # ── signal clusters: signalised junctions joined by short edges share one controller ──
    parent = {n: n for n in sig_nodes}

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for e in edges:
        if e["a"] in parent and e["b"] in parent and e["len"] < 45:
            parent[find(e["a"])] = find(e["b"])
    cluster_ids = {}
    for n in sig_nodes:
        nodes[n]["sig"] = cluster_ids.setdefault(find(n), len(cluster_ids))

    # ── junction control per approach ──
    stats = defaultdict(int)
    for ni, n in enumerate(nodes):
        ends = n["ends"]
        if len(ends) < 3:
            continue
        approaches = [(ei, end) for ei, end in ends if can_arrive(edges[ei], end)]
        if len(approaches) == 1 and "sig" not in n:
            # a fork: one road in, several out. Nobody to give way to.
            edges[approaches[0][0]]["c" + approaches[0][1]] = C_PRIORITY
            stats["fork"] += 1
            continue
        if "sig" in n:
            for ei, end in approaches:
                edges[ei]["c" + end] = C_SIGNAL
            stats["signal"] += 1
            continue
        has_rb = any(edges[ei]["flags"] & F_ROUNDABOUT for ei, _ in ends)
        explicit = {(ei, end): edges[ei]["ctl_explicit"][end] for ei, end in approaches if end in edges[ei]["ctl_explicit"]}
        if has_rb:
            for ei, end in approaches:
                edges[ei]["c" + end] = C_PRIORITY if edges[ei]["flags"] & F_ROUNDABOUT else explicit.get((ei, end), C_YIELD)
            stats["roundabout"] += 1
            continue
        if explicit and len(approaches) > len(explicit):
            for ei, end in approaches:
                edges[ei]["c" + end] = explicit.get((ei, end), C_PRIORITY)
            stats["signed"] += 1
            continue

        def rank(ei):
            w = edges[ei]["w"]
            return RANK[w["typ"]] + (0.5 if w["link"] else 0)

        r_star = min(rank(ei) for ei, _ in ends)
        main = [ei for ei, _ in ends if rank(ei) <= r_star + 0.01]
        minor = [(ei, end) for ei, end in approaches if rank(ei) > r_star + 0.4]
        main_speed = max(edges[ei]["w"]["speed"] for ei in main)
        regime = bool(minor) and (
            all(rank(ei) >= 7 for ei, _ in minor)
            or (len(main) >= 2 and (r_star <= 3.5 or (r_star <= 4.5 and main_speed >= 50)))
        )
        if len(approaches) < 2:
            regime = False
        if regime:
            for ei, end in approaches:
                edges[ei]["c" + end] = C_YIELD if (ei, end) in minor else C_PRIORITY
            stats["inferred priority"] += 1
        else:
            for ei, end in approaches:
                edges[ei]["c" + end] = explicit.get((ei, end), C_EQUAL)
            stats["right-before-left"] += 1
    print("  junctions:", dict(stats), f"| {len(cluster_ids)} signal controllers, "
          f"{len(crossings)} marked crossings ({n_ped_sig} mid-block lights), {len(mini_nodes)} mini roundabouts")
    return nodes, edges, crossings, mini_nodes, node_idx


def build_restrictions(raw_dir, nodes, edges, node_idx):
    """Turn restrictions (no_left_turn, only_straight_on, …) as banned [from edge, via node, to edge] triples."""
    path = os.path.join(raw_dir, "restrictions.json")
    if not os.path.exists(path):
        return []
    by_way_node = defaultdict(list)
    for ei, e in enumerate(edges):
        by_way_node[(e["w"]["id"], e["a"])].append(ei)
        by_way_node[(e["w"]["id"], e["b"])].append(ei)
    bans = set()
    for r in json.load(open(path))["elements"]:
        t = r.get("tags", {})
        kind = t.get("restriction") or t.get("restriction:motorcar") or ""
        ms = r.get("members", [])
        frm = [m["ref"] for m in ms if m["role"] == "from" and m["type"] == "way"]
        via = [m["ref"] for m in ms if m["role"] == "via" and m["type"] == "node"]
        to = [m["ref"] for m in ms if m["role"] == "to" and m["type"] == "way"]
        if len(frm) != 1 or len(via) != 1 or len(to) != 1 or via[0] not in node_idx:
            continue
        vn = node_idx[via[0]]
        f_edges, t_edges = by_way_node.get((frm[0], vn), []), by_way_node.get((to[0], vn), [])
        for f in f_edges:
            if kind.startswith("no_"):
                for te in t_edges:
                    if te != f or kind == "no_u_turn":
                        bans.add((f, vn, te))
            elif kind.startswith("only_") and t_edges:
                for o_ei, _ in nodes[vn]["ends"]:
                    if o_ei != f and o_ei not in t_edges:
                        bans.add((f, vn, o_ei))
    print(f"  restrictions: {len(bans)} banned turns")
    return sorted(bans)


def project_s(pts, p):
    """Arc length of the point on polyline `pts` (x,z,…) closest to p."""
    best, best_s, acc = 1e18, 0.0, 0.0
    for i in range(len(pts) - 1):
        d, t = pt_seg_dist(p, pts[i], pts[i + 1])
        seg = math.dist(pts[i][:2], pts[i + 1][:2])
        if d < best:
            best, best_s = d, acc + t * seg
        acc += seg
    return best_s


def build_trams(ways, feats, names):
    trams = [w for w in ways if w["kind"] == "tram"]
    use = defaultdict(int)
    for w in trams:
        for i, k in enumerate(w["keys"]):
            use[k] += 2 if i in (0, len(w["keys"]) - 1) else 1
    node_idx, nodes, edges, where = {}, [], [], {}
    for w in trams:
        n = len(w["keys"])
        cuts = [i for i in range(n) if i in (0, n - 1) or use[w["keys"][i]] >= 2]
        for c0, c1 in zip(cuts, cuts[1:]):
            if w["keys"][c0] == w["keys"][c1]:
                continue
            raw = [(w["pts"][i][0], w["pts"][i][1], w["y"][i]) for i in range(c0, c1 + 1)]
            ab = []
            for c in (c0, c1):
                k = w["keys"][c]
                if k not in node_idx:
                    node_idx[k] = len(nodes)
                    nodes.append(raw[0] if c == c0 else raw[-1])
                ab.append(node_idx[k])
            simp = dp_simplify(raw, 0.25)
            for k in w["keys"][c0:c1 + 1]:
                where.setdefault(k, len(edges))
            edges.append({"a": ab[0], "b": ab[1], "pts": simp})
    stops = []
    for fid, (t, p) in feats.items():
        if t.get("railway") == "tram_stop" and fid in where:
            ei = where[fid]
            nm = t.get("name", "")
            stops.append([ei, dm(project_s(edges[ei]["pts"], p)), names.setdefault(nm, len(names))])
    out_nodes = []
    for x, z, y in nodes:
        out_nodes += [dm(x), dm(z), dm(y)]
    out_edges = []
    for e in edges:
        inner = []
        for x, z, y in e["pts"][1:-1]:
            inner += [dm(x), dm(z), dm(y)]
        out_edges.append([e["a"], e["b"], inner])
    print(f"  trams: {len(nodes)} nodes, {len(edges)} track edges, {len(stops)} stops")
    return {"nodes": out_nodes, "edges": out_edges, "stops": stops}


# ───────────────────────────── areas ─────────────────────────────

def rings_of(e):
    """Outer rings (lists of (lat, lon)) of a way or multipolygon relation."""
    if e["type"] == "way":
        g = [p for p in (e.get("geometry") or []) if p]
        return [[(p["lat"], p["lon"]) for p in g]] if len(g) >= 4 and g[0] == g[-1] else []
    parts = []
    for m in e.get("members", []):
        if m.get("type") == "way" and m.get("role") in ("outer", "") and m.get("geometry"):
            parts.append([(p["lat"], p["lon"]) for p in m["geometry"] if p])
    rings = []
    while parts:
        ring = parts.pop()
        while ring[0] != ring[-1]:
            for i, p in enumerate(parts):
                if p[0] == ring[-1]:
                    ring += parts.pop(i)[1:]
                    break
                if p[-1] == ring[-1]:
                    ring += parts.pop(i)[::-1][1:]
                    break
            else:
                break
        if len(ring) >= 4 and ring[0] == ring[-1]:
            rings.append(ring)
    return rings


def building_height(e, ring_xy, area):
    t = e.get("tags", {})
    h = None
    if "height" in t:
        try:
            h = float(str(t["height"]).replace("m", "").strip())
        except ValueError:
            h = None
    if h is None and num(t.get("building:levels")):
        h = num(t["building:levels"]) * 3.1 + 1.5
    if h is None:
        b = t.get("building")
        r = stable_rand(e["id"])
        cx = sum(p[0] for p in ring_xy) / len(ring_xy)
        cz = sum(p[1] for p in ring_xy) / len(ring_xy)
        centre = math.hypot(cx - 700, cz + 1100)   # distance from Paradeplatz-ish
        if b in ("garage", "garages", "shed", "hut", "carport", "kiosk", "service") or area < 45:
            h = 2.8 + r
        elif b in ("house", "detached", "semidetached_house", "bungalow") or area < 110:
            h = 6.5 + 3.5 * r
        elif b in ("industrial", "warehouse", "retail", "supermarket", "hangar"):
            h = 7 + 6 * r
        elif b in ("church", "cathedral"):
            h = 18 + 10 * r
        elif centre < 2200:
            h = 16 + 7 * r
        elif centre < 5000:
            h = 12 + 8 * r
        else:
            h = 8 + 7 * r
    return max(2.5, min(h, 130))


def build_areas(raw_dir, out_dir, edges, ways):
    # zones where sunk tunnels poke through the ground, or roads run on ramps: no buildings there
    clear = Grid(60.0)
    clear_segs = []
    for e in edges:
        raw = e["raw"]
        for i in range(len(raw) - 1):
            ya = (e["above"][i] + e["above"][i + 1]) / 2
            if (e["flags"] & F_TUNNEL and ya > -6.5) or ya > 1.5:
                clear.add_seg(raw[i], raw[i + 1], len(clear_segs))
                clear_segs.append((raw[i][:2], raw[i + 1][:2], (e["w"]["lf"] + e["w"]["lb"]) * 1.7 + 3))

    tiles = defaultdict(lambda: {"b": [], "g": [], "w": [], "r": [], "t": [], "p": [], "s": []})

    def inside(p, poly):
        x, z, hit = p[0], p[1], False
        for i in range(len(poly)):
            (x1, z1), (x2, z2) = poly[i], poly[i - 1]
            if (z1 > z) != (z2 > z) and x < (x2 - x1) * (z - z1) / (z2 - z1) + x1:
                hit = not hit
        return hit

    # ── named places: shop and restaurant signs, stations, stadiums ──
    stadiums, pois = [], []
    ppath = os.path.join(raw_dir, "pois.json")
    if os.path.exists(ppath):
        KIND = {"supermarket": 0, "convenience": 0, "restaurant": 1, "cafe": 1, "bar": 1, "pub": 1, "fast_food": 1, "bakery": 1,
                "bank": 2, "post_office": 2, "pharmacy": 3, "hospital": 3, "hotel": 4, "museum": 4, "cinema": 4, "theatre": 4,
                "library": 4, "university": 4, "school": 4, "police": 4, "station": 5, "fuel": 6}
        seen_poi = set()
        for e in json.load(open(ppath))["elements"]:
            t = e.get("tags", {})
            if e["type"] == "way" and t.get("leisure") == "stadium" and e.get("geometry") and t.get("building") is None:
                pts = dp_simplify([proj(g["lat"], g["lon"]) for g in e["geometry"] if g], 1.0)
                if len(pts) >= 5 and abs(poly_area(pts[:-1])) > 9000:
                    stadiums.append((pts[:-1], t.get("name", "")))
                continue
            if (e["type"], e["id"]) in seen_poi or "name" not in t:
                continue
            seen_poi.add((e["type"], e["id"]))
            c = e.get("center") or e
            if "lat" not in c:
                continue
            name = t.get("brand") if t.get("brand") and len(t["name"]) > 22 else t["name"]
            what = t.get("shop") or t.get("amenity") or t.get("tourism") or t.get("railway")
            kind = KIND.get(what, 7 if "shop" in t else None)
            if kind is None or len(name) > 26 or what in ("hairdresser", "beauty"):
                continue
            x, z = proj(c["lat"], c["lon"])
            pois.append((x, z, kind, name))
    for pts, name in stadiums:
        cx, cz = sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts)
        key = (int(math.floor(cx / TILE)), int(math.floor(cz / TILE)))
        tiles[key]["s"].append({"n": name, "p": [c for p in pts for c in (dm(p[0] - key[0] * TILE), dm(p[1] - key[1] * TILE))]})
    for x, z, kind, name in pois:
        key = (int(math.floor(x / TILE)), int(math.floor(z / TILE)))
        tiles[key]["p"].append([dm(x - key[0] * TILE), dm(z - key[1] * TILE), kind, name])
    big = {"water": [], "forest": [], "green": []}

    def tkey(x, z):
        return (int(math.floor(x / TILE)), int(math.floor(z / TILE)))

    def rel(pts, key):
        ox, oz = key[0] * TILE, key[1] * TILE
        out = []
        for p in pts:
            out += [dm(p[0] - ox), dm(p[1] - oz)]
        return out

    seen = set()
    counts = defaultdict(int)
    for path in sorted(glob.glob(os.path.join(raw_dir, "areas_*.json"))):
        for e in json.load(open(path))["elements"]:
            uid = (e["type"], e["id"])
            if uid in seen:
                continue
            if e["type"] == "relation" and not any(m.get("geometry") for m in e.get("members", [])):
                continue        # listed without its outline here; areas_relations.json has the full version
            seen.add(uid)
            t = e.get("tags", {})
            if t.get("railway") == "rail":
                continue
            if "building" in t:
                kind = "b"
                if t["building"] in ("roof", "carport", "no") or t.get("location") == "underground" or (num(t.get("layer")) or 0) < 0:
                    continue
            elif t.get("natural") == "water":
                kind = "w"
            elif t.get("landuse") == "forest" or t.get("natural") == "wood":
                kind = "f"
            else:
                kind = "g"
            for ring in rings_of(e):
                pts = [proj(lat, lon) for lat, lon in ring[:-1]]
                tol = 0.3 if kind == "b" else (1.0 if kind == "g" else 1.5)
                pts = dp_simplify(pts + [pts[0]], tol)[:-1]
                if len(pts) < 3:
                    continue
                area = abs(poly_area(pts))
                xs, zs = [p[0] for p in pts], [p[1] for p in pts]
                cx, cz = sum(xs) / len(pts), sum(zs) / len(pts)
                span = max(max(xs) - min(xs), max(zs) - min(zs))
                if kind == "b":
                    if area < 18:
                        continue
                    hit = False
                    for si in clear.near((min(xs), min(zs)), (max(xs), max(zs)), 12):
                        a, b, half = clear_segs[si]
                        if any(pt_seg_dist(p, a, b)[0] < half for p in pts + [(cx, cz)]):
                            hit = True
                            break
                    if hit:
                        counts["buildings cleared"] += 1
                        continue
                    if any(inside((cx, cz), sp) for sp, _ in stadiums):
                        counts["buildings inside stadiums"] += 1      # grandstands: the stadium bowl replaces them
                        continue
                    key = tkey(cx, cz)
                    tiles[key]["b"].append([dm(building_height(e, pts, area))] + rel(pts, key))
                    counts["buildings"] += 1
                elif kind == "w":
                    if area < 30:
                        continue
                    if span > 350:
                        big["water"].append([c for p in pts for c in (dm(p[0]), dm(p[1]))])
                    else:
                        key = tkey(cx, cz)
                        tiles[key]["w"].append(rel(pts, key))
                    counts["water"] += 1
                elif kind == "f":
                    if area < 150:
                        continue
                    big["forest"].append([c for p in pts for c in (dm(p[0]), dm(p[1]))])
                    counts["forest"] += 1
                else:
                    if area < 60:
                        continue
                    if span > 350:
                        big["green"].append([c for p in pts for c in (dm(p[0]), dm(p[1]))])
                    else:
                        key = tkey(cx, cz)
                        tiles[key]["g"].append(rel(pts, key))
                    counts["green"] += 1

    for w in ways:
        if w["kind"] != "rail":
            continue
        pts = dp_simplify([(p[0], p[1], y) for p, y in zip(w["pts"], w["y"])], 0.4)
        mid = pts[len(pts) // 2]
        key = tkey(mid[0], mid[1])
        ox, oz = key[0] * TILE, key[1] * TILE
        tiles[key]["r"].append([c for p in pts for c in (dm(p[0] - ox), dm(p[1] - oz), dm(p[2]))])
        counts["rail lines"] += 1

    for e in json.load(open(os.path.join(raw_dir, "trees.json")))["elements"]:
        x, z = proj(e["lat"], e["lon"])
        key = tkey(x, z)
        tiles[key]["t"] += [dm(x - key[0] * TILE), dm(z - key[1] * TILE)]
        counts["trees"] += 1

    tdir = os.path.join(out_dir, "tiles")
    os.makedirs(tdir, exist_ok=True)
    for f in glob.glob(os.path.join(tdir, "*.json")):
        os.remove(f)
    total = 0
    for (tx, tz), data in tiles.items():
        data = {k: v for k, v in data.items() if v}
        body = json.dumps(data, separators=(",", ":"))
        total += len(body)
        with open(os.path.join(tdir, f"{tx}_{tz}.json"), "w") as f:
            f.write(body)
    body = json.dumps(big, separators=(",", ":"))
    with open(os.path.join(out_dir, "big.json"), "w") as f:
        f.write(body)
    counts["named places"] = len(pois)
    counts["stadiums"] = len(stadiums)
    print("  areas:", dict(counts))
    print(f"  wrote {len(tiles)} tiles ({total / 1e6:.1f} MB) + big.json ({len(body) / 1e6:.1f} MB)")
    return sorted(f"{tx}_{tz}" for tx, tz in tiles)


# ───────────────────────────── main ─────────────────────────────

def main():
    raw_dir, out_dir = sys.argv[1], sys.argv[2]
    os.makedirs(out_dir, exist_ok=True)
    print("loading…")
    ways, feats = load_ways(raw_dir)
    ways += load_rails(raw_dir)
    print(f"  {sum(w['kind'] == 'road' for w in ways)} road ways, {sum(w['kind'] == 'tram' for w in ways)} tram ways, "
          f"{sum(w['kind'] == 'rail' for w in ways)} rail ways, {len(feats)} feature nodes")
    xs_all = [p[0] for w in ways for p in w["pts"]]
    zs_all = [p[1] for w in ways for p in w["pts"]]
    terrain = Terrain(raw_dir, (min(xs_all) - 700, min(zs_all) - 700, max(xs_all) + 700, max(zs_all) + 700))
    compute_heights(ways, terrain)
    nodes, edges, crossings, mini_nodes, node_idx = build_graph(ways, feats)
    bans = build_restrictions(raw_dir, nodes, edges, node_idx)

    names = {"": 0}
    out_edges = []
    for e in edges:
        w = e["w"]
        simp = dp_simplify(e["raw"], 0.25)
        e["simp"] = simp
        inner = []
        for x, z, y in simp[1:-1]:
            inner += [dm(x), dm(z), dm(y)]
        o = {"a": e["a"], "b": e["b"], "t": w["typ"], "s": w["speed"], "lf": w["lf"], "lb": w["lb"],
             "f": e["flags"], "ca": e["ca"], "cb": e["cb"]}
        if w["name"]:
            o["n"] = names.setdefault(w["name"], len(names))
        if inner:
            o["p"] = inner
        if e["sa"]:
            o["sa"] = dm(e["sa"])
        if e["sb"]:
            o["sb"] = dm(e["sb"])
        if w["tf"]:
            o["tf"] = w["tf"]
        if w["tb"]:
            o["tb"] = w["tb"]
        out_edges.append(o)
    out_cross = []
    for c in crossings:
        e = edges[c["e"]]
        raw = e["raw"]
        acc, p = 0.0, raw[-1]
        for i in range(len(raw) - 1):   # world position of the crossing on the unsimplified line
            seg = math.dist(raw[i][:2], raw[i + 1][:2])
            if acc + seg >= c["s"]:
                t = (c["s"] - acc) / seg if seg else 0
                p = (raw[i][0] + (raw[i + 1][0] - raw[i][0]) * t, raw[i][1] + (raw[i + 1][1] - raw[i][1]) * t)
                break
            acc += seg
        out_cross.append([c["e"], dm(project_s(e["simp"], p)), c["sig"]])

    out_nodes, node_sig = [], []
    for n in nodes:
        out_nodes += [dm(n["x"]), dm(n["z"]), dm(n["y"])]
        node_sig.append(n.get("sig", -1))
    tram = build_trams(ways, feats, names)
    tile_list = build_areas(raw_dir, out_dir, edges, ways)

    xs = [n["x"] for n in nodes]
    zs = [n["z"] for n in nodes]
    graph = {
        "origin": [LAT0, LON0], "k": [KX, KZ], "tile": TILE,
        "bounds": [round(min(xs)), round(min(zs)), round(max(xs)), round(max(zs))],
        "names": [k for k, _ in sorted(names.items(), key=lambda kv: kv[1])],
        "nodes": out_nodes, "sig": node_sig, "mini": sorted(mini_nodes),
        "dem": terrain.write(os.path.join(out_dir, "dem.bin")),
        "edges": out_edges, "cross": out_cross, "ban": [list(b) for b in bans], "tram": tram, "tiles": tile_list,
    }
    body = json.dumps(graph, separators=(",", ":"), ensure_ascii=False)
    with open(os.path.join(out_dir, "graph.json"), "w") as f:
        f.write(body)
    km = sum(e["len"] for e in edges) / 1000
    print(f"  wrote graph.json ({len(body) / 1e6:.1f} MB): {km:.0f} km of road")


if __name__ == "__main__":
    main()

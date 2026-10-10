#!/usr/bin/env python3
"""
Fetch raw OpenStreetMap data for Züri Drive via the Overpass API.

Usage:
    python3 fetch_osm.py <raw_dir>

Covers Zurich city, Adliswil / Sihltal, and the surrounding motorway ring
(A1 Nordring, A3 Brunau-Thalwil, A4 Uetliberg tunnel / Westumfahrung).
Writes dem/*.png (elevation), roads.json, restrictions.json, pois.json, trees.json and areas_<row>_<col>.json into <raw_dir>;
files that already exist are skipped, so the script can be re-run to resume.
"""
import json
import os
import sys
import time
import urllib.parse
import urllib.request

# south, west, north, east
BBOX = (47.275, 8.435, 47.445, 8.625)
GRID = 4  # areas are fetched in GRID x GRID sub-boxes
UA = "sidvash-zurich-driving-game/2.0 (https://sidsvash26.github.io)"
ENDPOINTS = [
    "https://overpass.osm.ch/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]

HIGHWAYS = ("motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|service|"
            "motorway_link|trunk_link|primary_link|secondary_link|tertiary_link")


def box(b):
    return "(%.5f,%.5f,%.5f,%.5f)" % b


def roads_query(b):
    return f"""[out:json][timeout:300];(
way["highway"~"^({HIGHWAYS})$"]{box(b)};
way["railway"="tram"]{box(b)};
);out body geom;
(
node["highway"~"^(traffic_signals|crossing|stop|give_way|mini_roundabout|bus_stop)$"]{box(b)};
node["railway"="tram_stop"]{box(b)};
);out body;"""


def restrictions_query(b):
    return f"""[out:json][timeout:300];relation["type"="restriction"]{box(b)};out body;"""


def pois_query(b):
    return f"""[out:json][timeout:300];(
nwr["shop"]["name"]{box(b)};
nwr["amenity"~"^(restaurant|cafe|bar|pub|fast_food|bank|pharmacy|post_office|fuel|cinema|theatre|hospital|police|library|university|school)$"]["name"]{box(b)};
nwr["tourism"~"^(hotel|museum)$"]["name"]{box(b)};
nwr["railway"="station"]["name"]{box(b)};
nwr["leisure"="stadium"]{box(b)};
way["building"~"^(stadium|grandstand)$"]{box(b)};
);out center tags;
way["leisure"="stadium"]{box(b)};out geom;"""


def water_relations_query(b):
    # lakes and wide rivers are multipolygon relations; they need their member geometry (plain "out tags geom" drops it)
    return f"""[out:json][timeout:300];(relation["natural"="water"]{box(b)};relation["landuse"="forest"]{box(b)};relation["natural"="wood"]{box(b)};);out geom;"""


def trees_query(b):
    return f"""[out:json][timeout:300];node["natural"="tree"]{box(b)};out skel;"""


def areas_query(b):
    return f"""[out:json][timeout:300];(
way["building"]{box(b)};
relation["building"]["type"="multipolygon"]{box(b)};
way["natural"="water"]{box(b)};
relation["natural"="water"]{box(b)};
way["leisure"~"^(park|pitch|garden|playground|golf_course)$"]{box(b)};
way["landuse"~"^(grass|forest|cemetery|meadow|farmland|orchard|vineyard|allotments|recreation_ground|village_green)$"]{box(b)};
relation["landuse"="forest"]{box(b)};
way["natural"~"^(wood|scrub)$"]{box(b)};
relation["natural"="wood"]{box(b)};
way["railway"="rail"]{box(b)};
);out tags geom;"""


def fetch(query, out):
    if os.path.exists(out) and os.path.getsize(out) > 200:
        print("skip (exists)", out)
        return
    data = urllib.parse.urlencode({"data": query}).encode()
    for attempt in range(4):
        for ep in ENDPOINTS:
            print(f"-> {os.path.basename(out)} from {ep} (attempt {attempt + 1})", flush=True)
            try:
                req = urllib.request.Request(ep, data=data, headers={"User-Agent": UA, "Accept": "application/json"})
                with urllib.request.urlopen(req, timeout=420) as r:
                    body = r.read()
                parsed = json.loads(body)
                if "elements" not in parsed or (parsed.get("remark") and "error" in parsed["remark"]):
                    raise RuntimeError(parsed.get("remark", "no elements"))
                with open(out, "wb") as f:
                    f.write(body)
                print(f"   ok: {len(parsed['elements'])} elements, {len(body) / 1e6:.1f} MB", flush=True)
                return
            except Exception as e:  # noqa: BLE001 - any failure just means "try the next mirror"
                print("   failed:", str(e)[:200], flush=True)
                time.sleep(6)
    raise SystemExit(f"could not fetch {out}")


DEM_ZOOM = 13
DEM_URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"


def fetch_dem(raw):
    """Elevation: Terrarium-encoded PNG tiles (Mapzen / AWS open terrain tiles) covering the box plus a margin."""
    import math
    out = os.path.join(raw, "dem")
    os.makedirs(out, exist_ok=True)
    s, w, n, e = BBOX[0] - 0.012, BBOX[1] - 0.016, BBOX[2] + 0.012, BBOX[3] + 0.016
    k = 2 ** DEM_ZOOM
    tx = lambda lon: int((lon + 180) / 360 * k)                                                     # noqa: E731
    ty = lambda lat: int((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * k)          # noqa: E731
    for x in range(tx(w), tx(e) + 1):
        for y in range(ty(n), ty(s) + 1):
            path = os.path.join(out, f"{DEM_ZOOM}_{x}_{y}.png")
            if os.path.exists(path) and os.path.getsize(path) > 500:
                continue
            req = urllib.request.Request(DEM_URL.format(z=DEM_ZOOM, x=x, y=y), headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=60) as r, open(path, "wb") as f:
                f.write(r.read())
            print("   dem tile", x, y, flush=True)


def main():
    raw = sys.argv[1] if len(sys.argv) > 1 else "./raw"
    os.makedirs(raw, exist_ok=True)
    fetch_dem(raw)
    fetch(roads_query(BBOX), os.path.join(raw, "roads.json"))
    fetch(restrictions_query(BBOX), os.path.join(raw, "restrictions.json"))
    fetch(pois_query(BBOX), os.path.join(raw, "pois.json"))
    fetch(water_relations_query(BBOX), os.path.join(raw, "areas_relations.json"))
    fetch(trees_query(BBOX), os.path.join(raw, "trees.json"))
    s, w, n, e = BBOX
    dlat, dlon = (n - s) / GRID, (e - w) / GRID
    for r in range(GRID):
        for c in range(GRID):
            b = (s + r * dlat, w + c * dlon, s + (r + 1) * dlat, w + (c + 1) * dlon)
            fetch(areas_query(b), os.path.join(raw, f"areas_{r}_{c}.json"))
            time.sleep(2)
    print("done")


if __name__ == "__main__":
    main()

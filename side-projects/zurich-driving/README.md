# Züri Drive

A browser driving simulator for practising the Swiss practical test on real roads:
Zürich, Adliswil / Sihltal and the surrounding motorways. Plain ES modules and
[three.js](https://threejs.org) (vendored in `lib/`), no build step.

## Running locally

Any static file server works, from the repository root:

```sh
python3 -m http.server 8765
# then open http://127.0.0.1:8765/side-projects/zurich-driving/
```

Opening `index.html` straight from disk will not work: the game loads its map data with `fetch`.

Useful URL parameters while developing:

| Parameter | Effect |
| --- | --- |
| `?lesson=stadt` | Skip the menu and start a lesson (ids are in `js/nav.js`) |
| `?place=Adliswil` | Skip the menu and start a free drive (prefix of a name in `PLACES`) |
| `?view=chase` | Start in a given view: `cockpit`, `chase` or `top` |
| `?ff=8` | Run the simulation 8× faster |

## Layout

| Path | What it does |
| --- | --- |
| `js/net.js` | Road network: lanes, junction control, turn restrictions, map-matching, routing |
| `js/world.js` | Streams the 3D world per 500 m tile: roads, markings, signs, signals, bridges, tunnels, buildings, trees |
| `js/models.js` | Procedural vehicles (five selectable car models) and pedestrians |
| `js/landmarks.js` | Hand-built Zürich landmarks |
| `js/player.js` | Keyboard / touch input, car physics |
| `js/cockpit.js` | Car interior, mirrors (render-to-texture), the three camera modes |
| `js/traffic.js` | Signal controllers, AI vehicles, trams, pedestrians |
| `js/examiner.js` | Rule checks and scoring; the rule texts live in `RULES` |
| `js/nav.js` | Lessons, free-drive places, turn-by-turn directions |
| `js/hud.js` | HUD, minimap, full map, report card, sounds |
| `js/signs.js` | Catalogue of Swiss signs, markings and signals (SVG artwork, English and German names) |
| `js/signs-ui.js` | The Signs tab: browse by category, and the multiple-choice quiz |
| `js/main.js` | Boot, game states, frame loop |
| `data/` | Generated map data (see below) |
| `tools/` | Scripts that generate `data/` from OpenStreetMap |

## Rebuilding the map

The map comes from OpenStreetMap via the Overpass API. To refresh it, or to change the area
(edit `BBOX` in `tools/fetch_osm.py`):

```sh
python3 tools/fetch_osm.py /tmp/zueri-raw      # about 130 MB of raw JSON, resumable
python3 tools/build_map.py /tmp/zueri-raw data # writes data/graph.json, data/dem.bin, data/big.json, data/tiles/
```

Both scripts use only the Python standard library.

## How the world is modelled

- **Terrain** comes from the public Terrarium elevation tiles, resampled to a 25 m grid
  (`data/dem.bin`). Roads follow the ground; bridges and tunnels run straight between their ends,
  and the ground mesh is flattened under each road.
- **Buildings** are extruded OSM footprints with generated façades. About fifteen landmarks
  (churches, Prime Tower, Opera House, Hallenstadion…) are hand-built in `js/landmarks.js`; their
  shapes are simplified and their positions approximate.
- **Junction priority** comes from OSM signals, stop and give-way signs. Where nothing is mapped it
  is inferred: a clearly bigger road has priority over a side street, otherwise right-before-left
  applies. This matches Zürich well but will not be right at every junction.
- **Lanes** follow the `lanes` and `turn:lanes` tags; lane arrows are only enforced where they
  unambiguously match the junction ahead.
- **Slip roads** are reshaped to run alongside the carriageway they join, as an acceleration lane.

## Credits

Map data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, ODbL.
Elevation from the Terrain Tiles open dataset on AWS (Mapzen; SRTM and other public sources).
three.js is MIT licensed (see `lib/three.LICENSE`).

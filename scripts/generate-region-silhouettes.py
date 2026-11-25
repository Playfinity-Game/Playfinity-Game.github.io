#!/usr/bin/env python3
"""Generate continent and curated archipelago SVG silhouettes from Natural Earth 10m data."""
import json, math, re, sys, tempfile, zipfile
from pathlib import Path
import shapefile
from shapely.geometry import shape as make_geometry, box
from shapely.ops import unary_union

COUNTRIES_ZIP = Path(sys.argv[1])
LAND_ZIP = Path(sys.argv[2])
OUT = Path("assets/silhouettes/regions")
OUT.mkdir(parents=True, exist_ok=True)

CONTINENT_NAMES = {
    "Africa": "Afrika",
    "Antarctica": "Antarktika",
    "Asia": "Asien",
    "Europe": "Europa",
    "North America": "Nordamerika",
    "Oceania": "Ozeanien",
    "South America": "Südamerika",
}

# Bounding boxes select Natural Earth land polygons by their representative point.
# Multiple boxes support archipelagos crossing the 180-degree meridian.
ISLAND_GROUPS = [
    {"id":"caribbean","name":"Karibische Inseln","boxes":[[-90,8,-58,28]]},
    {"id":"japanese-archipelago","name":"Japanischer Archipel","boxes":[[128,30,147,46]]},
    {"id":"philippines","name":"Philippinen","boxes":[[116,4,127,22]]},
    {"id":"indonesian-archipelago","name":"Indonesischer Archipel","boxes":[[94,-12,142,8]]},
    {"id":"hawaiian-islands","name":"Hawaii","boxes":[[-161,18,-154,23]]},
    {"id":"canary-islands","name":"Kanarische Inseln","boxes":[[-19,27,-12,30]]},
    {"id":"azores","name":"Azoren","boxes":[[-32,36,-24,41]]},
    {"id":"galapagos","name":"Galápagosinseln","boxes":[[-92,-2,-89,2]]},
    {"id":"fiji","name":"Fidschi-Inseln","boxes":[[175,-22,180,-14],[-180,-22,-178,-14]]},
    {"id":"maldives","name":"Malediven","boxes":[[72,-1,74,8]]},
    {"id":"seychelles","name":"Seychellen","boxes":[[45,-11,57,-3]]},
    {"id":"new-zealand","name":"Neuseeland","boxes":[[165,-48,180,-33]]},
]

def read_records(zip_path):
    with tempfile.TemporaryDirectory() as td:
        with zipfile.ZipFile(zip_path) as zf:
            zf.extractall(td)
        shp = next(Path(td).glob("*.shp"))
        reader = shapefile.Reader(str(shp), encoding="utf-8")
        fields = [f[0] for f in reader.fields[1:]]
        result = []
        for item in reader.iterShapeRecords():
            try:
                geom = make_geometry(item.shape.__geo_interface__)
                if not geom.is_empty:
                    result.append((dict(zip(fields, item.record)), geom))
            except Exception:
                continue
        return result

def slug(s):
    return re.sub(r"[^a-z0-9]+","-",s.lower()).strip("-")

def geometry_to_svg(geom, title, desc):
    minx,miny,maxx,maxy = geom.bounds
    mid_lat = (miny+maxy)/2
    cos_lat = max(0.12, abs(math.cos(math.radians(mid_lat))))
    width = max((maxx-minx)*cos_lat, 1e-8)
    height = max(maxy-miny, 1e-8)
    scale = min(488/width,488/height)
    ox=(512-width*scale)/2
    oy=(512-height*scale)/2
    def ring_path(coords):
        pts=[(ox+(x-minx)*cos_lat*scale, oy+(maxy-y)*scale) for x,y,*_ in coords]
        if len(pts)<3: return ""
        return "M "+" ".join((f"{x:.2f},{y:.2f}" if i==0 else f"L {x:.2f},{y:.2f}") for i,(x,y) in enumerate(pts))+" Z"
    polys = list(geom.geoms) if geom.geom_type=="MultiPolygon" else [geom]
    paths=[]
    for poly in polys:
        if poly.geom_type!="Polygon": continue
        paths.append(ring_path(poly.exterior.coords))
        paths.extend(ring_path(r.coords) for r in poly.interiors)
    d=" ".join(p for p in paths if p)
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-labelledby="title desc">
<title id="title">{title}</title><desc id="desc">{desc}</desc>
<path d="{d}" fill="#171717" fill-rule="evenodd" stroke="#171717" stroke-width="0.35" stroke-linejoin="round"/>
</svg>
'''

country_rows = read_records(COUNTRIES_ZIP)
continent_geoms = {}
for props, geom in country_rows:
    continent = str(props.get("CONTINENT") or "").strip()
    if continent in CONTINENT_NAMES:
        continent_geoms.setdefault(continent, []).append(geom)

entries=[]
for key,name in CONTINENT_NAMES.items():
    geoms=continent_geoms.get(key,[])
    if not geoms: 
        print(f"WARNING: no geometry found for {key}")
        continue
    merged=unary_union(geoms)
    filename=f"continent-{slug(key)}.svg"
    (OUT/filename).write_text(geometry_to_svg(merged,name,f"Silhouette des Kontinents {name}, Natural Earth 10m."),encoding="utf-8")
    entries.append({"id":f"continent-{slug(key)}","name":name,"type":"continent","file":filename,"source":"Natural Earth 10m Admin-0 Countries","license":"Public domain"})

land_rows=read_records(LAND_ZIP)
for group in ISLAND_GROUPS:
    windows=[box(*b) for b in group["boxes"]]
    selected=[geom for _,geom in land_rows if any(w.contains(geom.representative_point()) for w in windows)]
    if not selected:
        print(f"WARNING: no land polygons selected for {group['id']}")
        continue
    merged=unary_union(selected)
    filename=f"island-group-{group['id']}.svg"
    (OUT/filename).write_text(geometry_to_svg(merged,group["name"],f"Silhouette der Inselgruppe {group['name']}, Natural Earth 10m Land."),encoding="utf-8")
    entries.append({"id":f"island-group-{group['id']}","name":group["name"],"type":"island_group","file":filename,"source":"Natural Earth 10m Land","license":"Public domain"})

index={"source":"Natural Earth 10m","license":"Public domain","count":len(entries),"regions":sorted(entries,key=lambda x:(x["type"],x["name"]))}
(OUT/"index.json").write_text(json.dumps(index,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(f"Generated {len(entries)} continent and island-group SVGs in {OUT}")

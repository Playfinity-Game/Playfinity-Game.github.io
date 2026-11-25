#!/usr/bin/env python3
"""Generate one local SVG silhouette per Natural Earth Admin-0 country feature."""
import json, math, re, sys, zipfile, tempfile
from pathlib import Path
import shapefile

ZIP = Path(sys.argv[1])
OUT = Path("assets/silhouettes/countries")
OUT.mkdir(parents=True, exist_ok=True)

def slug(value):
    value = value.lower().strip()
    value = re.sub(r"[^a-z0-9]+", "-", value).strip("-")
    return value or "unknown"

with tempfile.TemporaryDirectory() as td:
    with zipfile.ZipFile(ZIP) as zf:
        zf.extractall(td)
    shp = next(Path(td).glob("*.shp"))
    reader = shapefile.Reader(str(shp), encoding="utf-8")
    fields = [f[0] for f in reader.fields[1:]]
    records = []
    used = set()
    for shape_rec in reader.iterShapeRecords():
        props = dict(zip(fields, shape_rec.record))
        name = str(props.get("ADMIN") or props.get("NAME") or "Unbenannt")
        a3 = str(props.get("ADM0_A3") or props.get("ISO_A3") or "").strip()
        a2 = str(props.get("ISO_A2") or "").strip()
        key = a3 if a3 and a3 != "-99" else slug(name)
        if key in used:
            key = key + "-" + slug(name)
        used.add(key)
        points = shape_rec.shape.points
        parts = list(shape_rec.shape.parts) + [len(points)]
        rings = [points[parts[i]:parts[i+1]] for i in range(len(parts)-1)]
        all_pts = [p for ring in rings for p in ring]
        if not all_pts:
            continue
        mid_lat = sum(p[1] for p in all_pts) / len(all_pts)
        cos_lat = max(0.12, abs(math.cos(math.radians(mid_lat))))
        projected = [[(p[0]*cos_lat, -p[1]) for p in ring] for ring in rings]
        flat = [p for ring in projected for p in ring]
        minx=min(p[0] for p in flat); maxx=max(p[0] for p in flat)
        miny=min(p[1] for p in flat); maxy=max(p[1] for p in flat)
        w=max(maxx-minx, 1e-9); h=max(maxy-miny, 1e-9)
        scale=min(488/w, 488/h)
        ox=(512-w*scale)/2; oy=(512-h*scale)/2
        path=[]
        for ring in projected:
            if len(ring)<3: continue
            coords=[(ox+(x-minx)*scale, oy+(y-miny)*scale) for x,y in ring]
            path.append("M "+" ".join((f"{x:.2f},{y:.2f}" if i==0 else f"L {x:.2f},{y:.2f}") for i,(x,y) in enumerate(coords))+" Z")
        d=" ".join(path)
        svg=f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-labelledby="title desc">
<title id="title">{name}</title><desc id="desc">Geografische Silhouette von {name}, abgeleitet aus Natural Earth Admin-0 Countries.</desc>
<path d="{d}" fill="#171717" fill-rule="evenodd" stroke="#171717" stroke-width="0.35" stroke-linejoin="round"/>
</svg>
'''
        (OUT / f"{key.lower()}.svg").write_text(svg, encoding="utf-8")
        records.append({"id":key.lower(),"name":name,"iso_a2":a2 if a2 != "-99" else None,"iso_a3":a3 if a3 != "-99" else None,"file":f"{key.lower()}.svg","source":"Natural Earth 10m Admin-0 Countries","license":"Public domain"})
    (OUT / "index.json").write_text(json.dumps({"source":"Natural Earth 10m Admin-0 Countries","license":"Public domain","count":len(records),"countries":sorted(records,key=lambda x:x["name"])},ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(f"Generated {len(records)} country/territory SVGs in {OUT}")

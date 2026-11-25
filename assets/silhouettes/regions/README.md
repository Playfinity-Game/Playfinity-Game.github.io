# MEGASIZE continents and island groups

Generated SVG silhouettes from the repository's Natural Earth 10m archives.

- Continents are assembled from Natural Earth Admin-0 country geometries, grouped by the source `CONTINENT` field.
- Curated island groups are selected from Natural Earth 10m Land polygons using documented geographic windows.
- `index.json` lists each generated region, its type, and SVG path.
- Natural Earth data is public domain.

Run locally:

```sh
pip install pyshp shapely
python scripts/generate-region-silhouettes.py assets/silhouettes/natural-earth/ne_10m_admin_0_countries.zip assets/silhouettes/natural-earth/ne_10m_land.zip
```

Island-group windows are intentionally curated and may be refined as the collection grows.

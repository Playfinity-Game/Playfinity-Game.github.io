# MEGASIZE country silhouettes

Generated local SVG silhouettes from the repository's Natural Earth 10m Admin-0 Countries archive.

- One SVG per country/territory feature.
- `index.json` maps stable IDs, names and ISO codes to SVG files.
- Source geometry: Natural Earth, 1:10m Admin-0 Countries.
- Underlying Natural Earth data is public domain.
- Generation: `python scripts/generate-country-silhouettes.py assets/silhouettes/natural-earth/ne_10m_admin_0_countries.zip`

The GitHub Actions workflow regenerates these files when the source ZIP or generator changes.

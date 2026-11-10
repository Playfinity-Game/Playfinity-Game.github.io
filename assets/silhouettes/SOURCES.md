# Size It Up – Silhouette sources and asset policy

This directory is reserved for locally bundled SVG silhouette assets. The game must not hotlink third-party images at runtime.

## Approved source families

| Use | Source | Licence / conditions | Use in this project |
|---|---|---|---|
| Countries, coastlines, rivers, lakes, physical geography | [Natural Earth](https://www.naturalearthdata.com/) | Public domain; commercial use, modification and redistribution allowed | Generate simplified SVG outlines from versioned vector data; record feature name, metric and source |
| Game-related objects and generic fantasy/game equipment | [Game-icons.net](https://game-icons.net/) / [source repository](https://github.com/game-icons/icons) | CC BY 3.0 or CC0 per individual asset; attribution required for CC BY | Use only generic non-franchise assets; record creator and licence per SVG |
| Everyday objects and transport pictograms | [Font Awesome Free](https://github.com/FortAwesome/Font-Awesome) | SVG icons CC BY 4.0; attribution required | Use only as pictorial silhouettes, not as evidence of physical dimensions |
| Named landmarks | [Wikimedia Commons reuse guidance](https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia) | Varies per file; verify individual licence and author | Use only individually verified public-domain / CC files; store attribution and source URL |

## Asset rules

- Every playable item must have a local SVG asset, a stable ID, a human-readable name, a category, a metric, a numeric value, a unit, a short definition, a source URL, a licence, and a verification date.
- Never infer a real-world measurement from an icon's pixel dimensions.
- The silhouette is a recognisable outline; the metric is a separately sourced factual value.
- No Nintendo, Pokémon, Minecraft, Mario, film or other protected character artwork unless a specific asset is demonstrably licensed for this use. Generic controller, block, creature and equipment silhouettes are acceptable.
- Geography should be generated from Natural Earth feature geometry, not drawn from emoji or approximated with generic blobs.
- Landmark assets must be checked individually; Wikimedia Commons is a catalogue, not a blanket licence.
- Keep a copy of each source's required attribution alongside the SVG and in the in-game credits.

## Sources checked

- Natural Earth terms: https://www.naturalearthdata.com/about/terms-of-use/
- Game-icons.net licence: https://game-icons.net/about.html and https://game-icons.net/faq.html
- Game-icons source licence: https://github.com/game-icons/icons
- Font Awesome Free licence: https://github.com/FortAwesome/Font-Awesome
- Wikimedia Commons reuse policy: https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia

## Important status

This file documents approved sources and the acceptance policy only. It is not a claim that the full target catalogue (200+ assets per category) has already been collected or verified.

# Wordfinity – vorläufige Wortlisten nach Bekanntheitsgrad

Die Listen sind eine Prüfgrundlage. Die aktive Datei `data/wordfinity-nouns.json` wurde nicht verändert; die neuen Listen werden vom Spiel nicht geladen.

## Aktueller Stand
- Sehr bekannt: 1730 Wörter
- Eher bekannt: 4698 Wörter
- Seltene/fachliche/unpassende Einträge: 90.295 (unverändert)
- Aus den beiden bekannten Gruppen ausgeschlossene unterschiedliche Namensformen: 427

## Sortierung
Ursprüngliche Häufigkeitseinteilung anhand der deutschen OpenSubtitles-2018-FrequencyWords-Liste (50.000 Einträge): sehr bekannt = Rang 1–5.000, eher bekannt = Rang 5.001–20.000. Die Häufigkeit ist nur ein Näherungswert für allgemeine Bekanntheit.

## Namensfilter
Abgleich mit einer deutschen Vornamenliste (2.488 Einträge), einer zusätzlichen deutschen Vor-/Nachnamen-Sammlung, häufigen Familiennamen und einer ergänzenden Liste internationaler Vornamen. Alle erkannten Treffer werden entfernt, auch wenn die Form zugleich ein gewöhnliches Wort sein kann. Die entfernten Formen stehen in `wordfinity-ausgeschlossene-personennamen.json`.

## Grenzen
Der Filter ist deutlich erweitert, aber nicht vollständig: seltene, regionale, neue und internationale Namen können weiterhin vorkommen. Orts-, Marken-, Figuren- und Firmennamen sind nicht systematisch erfasst. Mehrdeutige Formen können versehentlich entfernt werden. Eine redaktionelle Endkontrolle bleibt erforderlich.

## Dateien
- `wordfinity-sehr-bekannt.json`
- `wordfinity-eher-bekannt.json`
- `wordfinity-selten-fachlich.json`
- `wordfinity-ausgeschlossene-personennamen.json`

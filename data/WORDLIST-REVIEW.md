# Wordfinity – vorläufige Wortlisten nach Bekanntheitsgrad

Die Listen sind eine Prüfgrundlage. Die aktive Datei `data/wordfinity-nouns.json` wurde nicht verändert; die neuen Listen werden vom Spiel nicht geladen.

## Aktueller Stand nach strengem Namensabgleich
- Sehr bekannt: 1740 Wörter
- Eher bekannt: 4699 Wörter
- Seltene/fachliche/unpassende Einträge: 90.295 (unverändert)
- Aus den beiden bekannten Gruppen ausgeschlossene unterschiedliche Namensformen: 416

## Sortiermethode
Die ursprüngliche Einteilung beruht auf `hermitdave/FrequencyWords`, deutscher OpenSubtitles-2018-Liste (50.000 Einträge): sehr bekannt = Rang 1–5.000, eher bekannt = Rang 5.001–20.000. Das ist nur ein Näherungswert für Bekanntheit.

## Namensfilter
Abgleich mit einer historischen/deutschen Vornamenliste (2.488 Einträge), einer zusätzlichen deutschen Vor- und Nachnamen-Sammlung sowie häufigen Vor- und Familiennamen. Alle Treffer werden entfernt – auch dann, wenn eine Form zugleich als normales Wort vorkommen kann. Dadurch können einzelne gültige Sachwörter verloren gehen.

Die entfernten Formen stehen in `wordfinity-ausgeschlossene-personennamen.json`.

## Grenzen
Der Abgleich ist umfangreicher, aber nicht vollständig. Seltene, internationale, regionale und neue Namen können weiterhin übrig bleiben. Orts-, Marken-, Figuren- und Firmennamen sind nicht systematisch erfasst. Eine redaktionelle Prüfung der verbleibenden Wörter ist weiterhin nötig.

## Dateien
- `wordfinity-sehr-bekannt.json`
- `wordfinity-eher-bekannt.json`
- `wordfinity-selten-fachlich.json`
- `wordfinity-ausgeschlossene-personennamen.json`

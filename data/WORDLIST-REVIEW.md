# Wordfinity – vorläufige Wortlisten nach Bekanntheitsgrad

Die Listen sind eine Prüfgrundlage. Die aktive Datei `data/wordfinity-nouns.json` wurde nicht verändert; die neuen Listen werden vom Spiel nicht geladen.

## Aktueller Stand
- Sehr bekannt: 1701 Wörter
- Eher bekannt: 4657 Wörter
- Seltene/fachliche/unpassende Einträge: 90.295 (unverändert)
- Ausgeschlossene unterschiedliche Personen-, Orts- und weitere Eigennamen: 497

## Sortierung
Ursprüngliche Häufigkeitseinteilung anhand der deutschen OpenSubtitles-2018-FrequencyWords-Liste (50.000 Einträge): sehr bekannt = Rang 1–5.000, eher bekannt = Rang 5.001–20.000. Die Häufigkeit ist nur ein Näherungswert für allgemeine Bekanntheit.

## Namensfilter
Abgleich mit deutschen Vor- und Nachnamenlisten, ergänzenden häufigen internationalen Vornamen und einer Liste geläufiger Länder-/Städte-/Markenbezeichnungen. Alle erkannten Treffer werden entfernt; bei Mehrdeutigkeiten können auch normale Wörter verloren gehen. Die entfernten Formen stehen in `wordfinity-ausgeschlossene-personennamen.json`.

## Grenzen
Der Filter ist erweitert, aber nicht vollständig: seltene, regionale, neue und internationale Namen sowie Figuren-, Firmen- und Markennamen können weiterhin vorkommen. Eine redaktionelle Endkontrolle bleibt erforderlich.

## Dateien
- `wordfinity-sehr-bekannt.json`
- `wordfinity-eher-bekannt.json`
- `wordfinity-selten-fachlich.json`
- `wordfinity-ausgeschlossene-personennamen.json`

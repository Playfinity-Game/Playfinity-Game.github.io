# Wordfinity – vorläufige Wortlisten nach Bekanntheitsgrad

Die drei Listen sind eine Prüfgrundlage. Die aktive Datei `data/wordfinity-nouns.json` wurde nicht verändert; die neuen Listen werden vom Spiel nicht geladen.

## Aktueller Stand nach erweitertem Namensabgleich
- Sehr bekannt: 1818 Wörter
- Eher bekannt: 4715 Wörter
- Seltene/fachliche/unpassende Einträge: 90.295 (unverändert)
- Aus den beiden bekannten Gruppen ausgeschlossene unterschiedliche Personennamen: 322

## Sortiermethode
Die ursprüngliche Einteilung beruht auf `hermitdave/FrequencyWords`, deutscher OpenSubtitles-2018-Liste (50.000 Einträge): sehr bekannt = Rang 1–5.000, eher bekannt = Rang 5.001–20.000. Das ist nur ein Näherungswert und keine repräsentative Befragung zur Bekanntheit.

## Namensfilter
Der Abgleich kombiniert:
- 2.488 Einträge aus `PenTestical/german_names`
- eine zusätzliche deutsche Vornamenliste aus `AlessandroMinoccheri/human-names`
- ergänzende häufige Vor- und Familiennamen, die beim Durchsehen der Listen auffielen.

Die Ausschlussliste liegt in `data/wordfinity-ausgeschlossene-personennamen.json`.

## Grenzen
Auch ein erweiterter Namensabgleich ist nicht vollständig: seltene, internationale, regionale und neuere Namen können übrig bleiben. Mehrdeutige Wörter, die zugleich normale deutsche Sachwörter sind (z. B. Bauer, Fischer, Koch, Stein, Bach), bleiben bewusst erhalten. Orts-, Marken-, Figuren- und Firmennamen sind nicht systematisch geprüft. Vor dem Einsatz im Spiel ist deshalb weiterhin eine redaktionelle Prüfung sinnvoll.

## Dateien
- `wordfinity-sehr-bekannt.json`
- `wordfinity-eher-bekannt.json`
- `wordfinity-selten-fachlich.json`
- `wordfinity-ausgeschlossene-personennamen.json`

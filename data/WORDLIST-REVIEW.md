# Wordfinity – vorläufige Wortlisten nach Bekanntheitsgrad

Diese drei Dateien sind eine **Prüfgrundlage**, keine endgültig redaktionell freigegebenen Spielwortlisten. Die aktive Datei `data/wordfinity-nouns.json` wurde nicht verändert. Die neuen Dateien werden vom Spiel nicht geladen.

## Ergebnis

- Sehr bekannt: 1920 Wörter
- Eher bekannt: 4935 Wörter
- Selten / fachlich / nicht in der Häufigkeitsquelle belegt: 90295 Wörter
- Ausgangsdatei: 97206 Einträge; nach Normalisierung auf Kleinschreibung 97150 eindeutige Wörter (56 Schreibvarianten/Dubletten zusammengeführt).

## Sortiermethode

Abgleich mit `hermitdave/FrequencyWords`, Datei `content/2018/de/de_50k.txt` (deutsche Untertitel-Worthäufigkeiten, 50.000 Einträge).

- Sehr bekannt: Häufigkeitsrang 1–5.000
- Eher bekannt: Häufigkeitsrang 5.001–20.000
- Selten/fachlich/nicht belegt: Rang über 20.000, nicht enthalten oder nicht passend zur einfachen Nomen-Schreibweise (z. B. Bindestrich, ungewöhnliche Länge).

Die Häufigkeitsquelle basiert auf Untertiteln und ist nur ein Näherungswert für allgemeine Bekanntheit. Häufige Eigennamen und Wörter, die in Untertiteln häufig vorkommen, können daher in den ersten beiden Gruppen stehen. Umgekehrt können alltagsbekannte Wörter fehlen. **Vor einer Verwendung im Spiel ist eine weitere Prüfung auf Eigennamen, Fremdwörter, Fachbegriffe, veraltete Wörter und tatsächliche Nomen erforderlich.**

## Quelle und Lizenz

FrequencyWords / Hermit Dave, deutsche Liste aus OpenSubtitles 2018. Die Wortdaten stehen unter CC BY-SA 4.0. Quelle: https://github.com/hermitdave/FrequencyWords/tree/master/content/2018/de

Die ursprüngliche Wordfinity-Wortliste stammt laut `data/WORDLIST-SOURCE.md` aus `gambolputty/german-nouns` / WiktionaryDE (CC BY-SA 4.0).

## Dateien

- `wordfinity-sehr-bekannt.json`
- `wordfinity-eher-bekannt.json`
- `wordfinity-selten-fachlich.json`

Alle Dateien enthalten einfache JSON-Arrays aus Wörtern.

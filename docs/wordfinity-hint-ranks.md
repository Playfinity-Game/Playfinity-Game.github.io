# Wordfinity: vorab berechnete semantische Tipp-Ranglisten

## Ziel

Dieses Build-Werkzeug erzeugt eine reproduzierbare semantische Rangliste für jedes
bestehende Lösungswort. Es verändert weder `data/wordfinity-nouns.json` noch die
Auswahl der Lösungswörter, die Kategorien, die normale Spielwertung oder die
bestehende Rangberechnung.

Die Ranglisten verwenden das vorhandene Embedding-Modell BGE-M3. Das ist eine
eigene Wordfinity-Implementierung des Vorberechnungsprinzips; sie kopiert weder
Kontextos Quellcode noch deren proprietäre Wortlisten oder Rangdaten. Die
Rangnummern sind daher nicht mit Kontexto-Rangnummern gleichzusetzen.

## Build

Im Repository-Hauptverzeichnis:

```bash
python -m venv .venv
. .venv/bin/activate
pip install -r scripts/requirements-hint-ranks.txt
python scripts/build_wordfinity_hint_ranks.py
```

Standardmäßig liest das Skript die vorhandene Datei
`data/wordfinity-nouns.json` und schreibt
`build/wordfinity-hint-ranks/manifest.json` und einzelne Dateien unter `build/wordfinity-hint-ranks/rankings/`. Das Ergebnis enthält:
- den unveränderten Zielwortbestand als Prüfsumme und Anzahl,
- einen separaten, häufigen deutschen Tipp-Wortschatz,
- für jedes Zielwort die vollständige, nach Kosinus-Ähnlichkeit sortierte
  Kandidatenliste als separate, gzip-komprimierte UInt16-Datei pro Zielwort. Im Spiel muss so nur die Rangliste des aktuellen Zielworts geladen werden.

Die Kandidatenbasis wird aus der deutschen Häufigkeitsliste von `wordfreq`
gebildet; vorhandene Zielwörter werden zusätzlich aufgenommen, falls sie nicht
im Häufigkeits-Ausschnitt vorkommen. Der Build ist deterministisch bei gleicher
Modell- und Paketversion.

## Online-Veröffentlichung und Laufzeitintegration

Der Build veröffentlicht die erzeugten Dateien in den separaten Git-Branch
`wordfinity-rank-data`. Dieser Branch wird als statischer Datenspeicher über
`raw.githubusercontent.com` ausgeliefert; er enthält nur das Manifest und
die gzip-komprimierten Rangdateien, nicht den Spielcode.

Das Spiel lädt das Manifest bei Bedarf einmal und danach ausschließlich die
Rangdatei des aktuellen Zielworts. Die Dekomprimierung und Rangauflösung laufen
im Browser, nicht im Cloudflare Worker. Die Dateien werden vom Browser-Cache
wiederverwendet. Für Wörter außerhalb des vorberechneten Kandidatenbestands
oder bei nicht erreichbaren Rangdateien bleibt der bisherige BGE-M3-Worker als
Fallback aktiv.

Die angezeigte Rangnummer entspricht bei enthaltenen Tippwörtern der echten
Position in der vorberechneten BGE-M3-Kandidatenliste. Die Rangliste verändert
weder die Zielwortauswahl noch die übrige Spielwertung.

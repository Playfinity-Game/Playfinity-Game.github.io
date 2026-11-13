# WORDFINITY – streng geprüfte Nomen-Wortliste

Diese strenge Nomenliste ist die **aktive WORDFINITY-Wortliste**. Die bisherige große Liste wird beim nächsten erfolgreichen Build einmalig unter `data/archive/wordfinity-nouns-legacy.json` archiviert und danach nicht mehr vom Spiel geladen. Der Workflow erstellt sie aus der Leipzig Corpora Collection, testet die Filterregeln und veröffentlicht die erzeugte JSON-Liste als `data/wordfinity-nouns.json`. Genau diese Datei lädt Wordfinity beim Start.

## Qualitätsregeln

- Ausschließlich als `NOUN` erkannte Gattungsnomen; keine Verben, Adjektive oder Eigennamen.
- Nur alphabetische deutsche Einzelwörter ohne Bindestriche, Ziffern, Satzzeichen oder Leerzeichen.
- Nomen müssen großgeschrieben sein, mindestens 3 und höchstens 24 Zeichen enthalten und dürfen nicht vollständig in Großbuchstaben stehen.
- Mindestens 5 Korpusbelege; maximal 15.000 Nomen, nach Häufigkeit sortiert.
- Eindeutige alte Schreibweisen werden vereinheitlicht. Bedeutungsunterschiede wie „Masse“ und „Maße“ bleiben getrennt.
- Manuelle Ausschlüsse stehen in `data/wordfinity-excluded-words.txt`.

## Quelle

- Leipzig Corpora Collection, Korpus `deu_news_2023_1M`
- Download: https://downloads.wortschatz-leipzig.de/corpora/deu_news_2023_1M.tar.gz
- Zuordnung über Grundform/Lemma und Wortart; falls keine POS-Wortliste vorliegt, erfolgt die Erkennung mit dem deutschen spaCy-Modell.
- Namensnennung: Leipzig Corpora Collection, Universität Leipzig.
- Angegebene Lizenz: CC BY 4.0. Vor Weitergabe die aktuellen Downloadbedingungen prüfen und die Namensnennung beibehalten.

## Erstellung und Veröffentlichung

Der GitHub-Actions-Workflow **Build WORDFINITY strict noun list** läuft nach Änderungen an Generator, Tests, Ausschlussliste oder dieser Dokumentation auf `main`; er kann außerdem manuell gestartet werden. Zuerst laufen die Tests. Danach wird der Nomen-Pool erstellt und als JSON-Array in `data/wordfinity-nouns.json` geschrieben. Bei weniger als 1.000 Kandidaten bricht der Workflow ab und lässt die bisherige aktive Liste unverändert. Der Workflow lädt Kandidatenliste und aktive Liste als 30 Tage verfügbares Artefakt hoch und committet die aktive Wortliste anschließend nach `main`.

## Grenzen

Automatische Wortarterkennung und Korpus-Häufigkeit garantieren nicht, dass jedes Wort kindgerecht oder allgemein bekannt ist. Die Liste ist streng nach Wortart und Form gefiltert, aber nicht jedes einzelne Wort ist redaktionell von Hand geprüft.

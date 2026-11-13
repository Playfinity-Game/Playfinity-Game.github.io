# WORDFINITY – strenger Nomen-Kandidatenpool

Diese Datei beschreibt einen separaten Prüfpool. Er ersetzt **nicht** die aktive
Datei `wordfinity-nouns.json` und ist nicht mit der Spielauswahl verbunden.

## Qualitätsziel

Es gilt bewusst eine strenge Auswahl: lieber weniger Wörter als zweifelhafte
Einträge. Der Generator übernimmt ausschließlich als `NOUN` markierte
Gattungsnomen. Verben, Adjektive, andere Wortarten und Eigennamen werden
ausgeschlossen.

## Quelle

- Leipzig Corpora Collection, Korpus `deu_news_2023_1M`
- Download: https://downloads.wortschatz-leipzig.de/corpora/deu_news_2023_1M.tar.gz
- Zuordnung über Grundform/Lemma und Wortart; falls keine POS-Wortliste vorliegt,
  erfolgt die Erkennung mit dem deutschen spaCy-Modell.
- Namensnennung: Leipzig Corpora Collection, Universität Leipzig.
- Angegebene Lizenz: CC BY 4.0. Vor Weitergabe die aktuellen Downloadbedingungen
  prüfen und die Namensnennung beibehalten.

## Strenge Filter

- Ausschließlich `NOUN`; niemals Verben.
- Eigennamen (`PROPN`) und alle anderen Wortarten ausschließen.
- Nur alphabetische deutsche Einzelwörter; keine Bindestriche, Ziffern,
  Satzzeichen oder Leerzeichen.
- Nomen müssen großgeschrieben sein, mindestens 3 und höchstens 24 Zeichen
  enthalten und dürfen nicht vollständig in Großbuchstaben stehen.
- Mindestens 5 Korpusbelege; danach Begrenzung auf die häufigsten 15.000 Nomen.
- Bekannte alte Schreibweisen werden vereinheitlicht. Bedeutungsunterschiede
  wie „Masse“ und „Maße“ bleiben getrennt.
- Manuelle Ausschlüsse stehen in `wordfinity-excluded-words.txt`.

## Grenzen und Freigabe

Häufigkeit und automatische Wortarterkennung sind keine Garantie für korrekte,
kindgerechte oder allgemein bekannte Wörter. Auch ein häufiges Zeitungssubstantiv
kann ein Fachwort, ein ungewöhnliches Kompositum oder ein Fehler sein. Deshalb
bleibt der Kandidatenpool eine Prüfliste: Vor einer Übernahme in das Spiel müssen
die Wörter zusätzlich manuell kontrolliert werden. Die aktive Wortliste wird
durch diesen Workflow nicht verändert.

## Erstellen

Den GitHub-Actions-Workflow **Build WORDFINITY quality candidate pool**
manuell starten. Er führt zuerst die Tests aus, erstellt danach den Nomen-Pool
und lädt die JSON-Datei als 30 Tage verfügbares Artefakt hoch.

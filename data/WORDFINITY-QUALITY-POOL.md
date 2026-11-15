# WORDFINITY – zusätzlicher Nomen-Kandidatenpool

Dieses Skript erzeugt einen **separaten Kandidatenpool** aus der Leipzig Corpora Collection. Dieser Pool ist nicht die aktive WORDFINITY-Wortliste und wird nicht automatisch in das Spiel übernommen.

## Qualitätsregeln

- Kandidaten werden anhand von Wortart, Schreibweise und Korpus-Häufigkeit gefiltert.
- Automatische POS-Erkennung und Häufigkeitsgrenzen sind Näherungen. Sie garantieren weder Kindgerechtheit noch, dass jedes Wort ein geeignetes Spielziel ist.
- Manuelle Ausschlüsse stehen in `data/wordfinity-excluded-words.txt`.
- Kandidaten müssen vor einer Übernahme redaktionell geprüft und in die passende der 38 aktiven Kategorien einsortiert werden.

## Quelle

- Leipzig Corpora Collection, Korpus `deu_news_2023_1M`
- Download: https://downloads.wortschatz-leipzig.de/corpora/deu_news_2023_1M.tar.gz
- Namensnennung: Leipzig Corpora Collection, Universität Leipzig.
- Die Lizenz- und Downloadbedingungen sind vor Weiterverwendung direkt bei der Quelle zu prüfen.

## Erstellung

Der Workflow führt zunächst die Tests aus, erzeugt anschließend den separaten Kandidatenpool und stellt ihn als GitHub-Actions-Artefakt bereit. **Er verändert niemals `data/wordfinity-nouns.json` und committet keine automatisch erzeugte Kandidatenliste in die aktive Spielliste.**

## Grenzen

Korpusbelege können Eigennamen, Fachwörter, seltene Formen und kontextabhängige Wortarten enthalten. Die POS-Erkennung kann Fehler machen. Der Kandidatenpool ist daher nur eine Prüfhilfe und darf nicht ungeprüft veröffentlicht werden.

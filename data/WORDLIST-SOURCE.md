# WORDFINITY – Wortlistenquelle

Die Datei `wordfinity-nouns.json` wird automatisiert aus der CSV-Datenbank
[gambolputty/german-nouns](https://github.com/gambolputty/german-nouns) erzeugt.
Das Projekt beschreibt rund 100.000 deutsche Substantive, zusammengestellt aus
WiktionaryDE.

- Quelle: WiktionaryDE, über gambolputty/german-nouns
- Lizenz der Wortdatenbank: Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)
- Code/Generator: `scripts/build-wordfinity-nouns.py`
- Der Generator übernimmt ausschließlich Einträge, deren Wortart als
  `Substantiv` markiert ist, und verwendet die Lemma-Grundform.
- Die Datenbank ist keine Garantie für ausschließlich gebräuchliche Wörter;
  seltene, historische und fachsprachliche Nomen können enthalten sein.

Wiktionary-Beiträge stehen unter CC BY-SA 4.0. Bei Weitergabe der abgeleiteten
Wortliste müssen Quelle und Lizenz genannt und die ShareAlike-Bedingungen
beachtet werden. Lizenztext: https://creativecommons.org/licenses/by-sa/4.0/

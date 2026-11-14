# Wordfinity – sauberer Zielwortfilter

Dieser Prüfaufbau erzeugt eine **separate** Zielwortliste aus der unveränderten
Ausgangsdatei `data/wordfinity-nouns.json`. Er verändert weder die aktive
Wortliste noch den Spielcode und aktiviert keine neuen Wörter.

## Eingaben

- `data/wordfinity-nouns.json`: bestehende Wiktionary-basierte Nomen-Ausgangsliste
- Leipzig-Corpora-Archiv `deu_news_2023_1M.tar.gz` mit einer
  `*_words_pos_base.txt`-Datei (Wortart und Grundform)
- `openthesaurus.txt`: optionale Synonymdatenbank; nur Zusatzsignal

## Ausführen

```bash
python3 scripts/build_wordfinity_clean_targets.py /pfad/deu_news_2023_1M.tar.gz
```

Optional können Eingabe- und Ausgabepfade sowie die Mindestfrequenz über
Kommandozeilenargumente geändert werden. Der Standardwert für die Mindestfrequenz
ist fünf Korpusbelege. Es gibt **keine Zielanzahl**.

## Ausgaben

- `data/wordfinity-zielwoerter.json`: zugelassene Nomen, nach Korpusfrequenz sortiert
- `data/wordfinity-ausgeschlossen.json`: verworfene Wörter mit Grund
- `data/wordfinity-pruefbericht.json`: Mengen, Quellen und offene Grenzen

## Regeln und Grenzen

1. Ausgangswörter müssen in der ursprünglichen Nomenliste vorkommen.
2. Leipzig muss das Lemma als `NOUN` ausweisen; bloße Großschreibung genügt nicht.
3. Als `PROPN` erkannte Eigennamen werden ausgeschlossen, sofern sie nicht
   unabhängig auch als Gattungsnomen belegt sind.
4. Zugelassen werden alphabetische Einzelwörter mit 4–11 Buchstaben.
5. Mindestens fünf Korpusbelege; es wird keine feste Anzahl erzwungen.
6. OpenThesaurus ist kein vollständiges Wörterbuch. Ein Treffer stärkt die
   Evidenz, ein fehlender Treffer ist allein kein Ausschlussgrund.
7. Korpus-POS löst Mehrdeutigkeiten nicht immer kontextgenau. Der Prüfbericht
   weist deshalb auf notwendige manuelle Stichproben hin.

## Sicherheit

Das Skript schreibt ausschließlich die drei separaten Prüfausgaben. Es schreibt
niemals `data/wordfinity-nouns.json`, `index.html` oder Dateien anderer Spiele.
Es gibt absichtlich keinen GitHub-Actions-Workflow, der Ergebnisse automatisch
committet oder die aktive Liste ersetzt. Jeder weitere Schritt bleibt manuell
prüfbar; Merges und Aktivierung erfolgen ausschließlich durch den Repository-
Eigentümer.

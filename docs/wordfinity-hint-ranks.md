# Wordfinity: vorab berechnete semantische Tipp-Ranglisten

## Ziel

Dieses Build-Werkzeug erzeugt eine reproduzierbare semantische Rangliste für jedes
bestehende Lösungswort. Es verändert weder \`data/wordfinity-nouns.json\` noch die
Auswahl der Lösungswörter, die Kategorien, die normale Spielwertung oder die
bestehende Rangberechnung.

Die Ranglisten verwenden das vorhandene Embedding-Modell BGE-M3. Das ist eine
eigene Wordfinity-Implementierung des Vorberechnungsprinzips; sie kopiert weder
Kontextos Quellcode noch deren proprietäre Wortlisten oder Rangdaten. Die
Rangnummern sind daher nicht mit Kontexto-Rangnummern gleichzusetzen.

## Build

Im Repository-Hauptverzeichnis:

\`\`\`bash
python -m venv .venv
. .venv/bin/activate
pip install -r scripts/requirements-hint-ranks.txt
python scripts/build_wordfinity_hint_ranks.py
\`\`\`

Standardmäßig liest das Skript die vorhandene Datei
\`data/wordfinity-nouns.json\` und schreibt
\`data/wordfinity-hint-ranks.json.gz\`. Das Ergebnis enthält:
- den unveränderten Zielwortbestand als Prüfsumme und Anzahl,
- einen separaten, häufigen deutschen Tipp-Wortschatz,
- für jedes Zielwort die vollständige, nach Kosinus-Ähnlichkeit sortierte
  Kandidatenliste (als Base64-kodierte UInt16-IDs).

Die Kandidatenbasis wird aus der deutschen Häufigkeitsliste von \`wordfreq\`
gebildet; vorhandene Zielwörter werden zusätzlich aufgenommen, falls sie nicht
im Häufigkeits-Ausschnitt vorkommen. Der Build ist deterministisch bei gleicher
Modell- und Paketversion.

## Geplante Laufzeitintegration

Die generierte Datei ist zunächst nur ein Build-Artefakt. Sie wird bewusst noch
nicht vom Live-Worker geladen: Vorher müssen Hosting/Cache, Dateigröße,
Ladeverhalten und die Worker-Ressourcengrenzen geprüft werden. Danach kann der
Worker für **Leicht** ungefähr die halbe Rangposition des besten Versuchs und
für **Mittel** die unmittelbar bessere Rangposition wählen und belegte,
bereits geratene oder ausgeschlossene Wörter überspringen.

Ohne erfolgreiche Erzeugung und Integration dieser Datei darf das Spiel nicht
behaupten, bereits echte vorberechnete Ranglisten zu verwenden.

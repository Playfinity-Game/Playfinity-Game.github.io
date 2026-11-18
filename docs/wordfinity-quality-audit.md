# Wordfinity: vollständige Qualitätsprüfung der Ranglisten

Die Qualitätsprüfung läuft nach dem vollständigen Ranglisten-Build und verändert
weder die aktive Wortliste noch die Live-Spielwertung.

## Ausführen

```bash
python scripts/build_wordfinity_hint_ranks.py
python scripts/evaluate_wordfinity_rank_quality.py
```

Der Prüfer kontrolliert **jedes eindeutige Zielwort**: Existenz der Rangliste,
SHA-256, Dateilänge, vollständige Permutation der Kandidaten-IDs und Rang 1
für das jeweilige Lösungswort. Zusätzlich wertet er kuratierte semantische
Positiv- und Negativbeispiele aus. Ein harter Negativtreffer in den Top 10
lässt die Prüfung fehlschlagen.

Der Bericht wird unter
`build/wordfinity-quality-report.json` gespeichert. Fehlende Kandidaten werden
als `null` ausgewiesen und nicht stillschweigend als gute oder schlechte
Ränge gewertet.

## Semantische Kontrollfälle

`data/wordfinity-ranking-benchmark.json` enthält geprüfte Kontrollfälle.
Positive Begriffe sind semantisch verwandt; negative Begriffe sind bewusst
irreführende Schreibähnlichkeiten. Der Fall **Dachs → Dach** bildet den
gemeldeten Fehler direkt ab.

Wichtig: Das ist ein reproduzierbarer Qualitäts- und Regressionstest, kein
Fine-Tuning der BGE-M3-Modellgewichte. Die Messwerte zeigen, wo die aktuelle
Ranglogik versagt. Erst nach einem gemessenen Vergleich werden neue Scoring-
Regeln oder ein alternatives Modell übernommen.

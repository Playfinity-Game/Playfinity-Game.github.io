# WORDFINITY – Kategorien und Tipps

## Verbindlicher Kategorie-Katalog

Für die 8.213 aktiven WORDFINITY-Zielwörter gelten verbindlich genau diese 26 Kategorien. Die Schreibweisen und Reihenfolge entsprechen dem festgelegten Katalog:

1. **Essen und Getränke** – Lebensmittel, Zutaten, Speisen und Getränke.
2. **Haushalt und Wohnen** – Wohnräume, Möbel, Haushaltsgegenstände und Dinge des täglichen Wohnens.
3. **Kleidung und Accessoires** – Kleidung, Schuhe, Schmuck, Taschen und tragbare Accessoires.
4. **Werkzeuge und Materialien** – Werkzeuge, Geräte und Materialien zum Bearbeiten, Reparieren und Herstellen.
5. **Technik und Elektronik** – Elektronische Geräte, Computer, digitale Technik, Maschinen und technische Systeme.
6. **Fahrzeuge und Verkehr** – Fahrzeuge, Verkehrsmittel, Verkehrswege und Verkehrseinrichtungen.
7. **Orte und Gebäude** – Gebäude, Bauwerke, Räume und von Menschen geschaffene Orte.
8. **Geografie und Landschaften** – Länder, Regionen, Kontinente, Gewässer, Berge und natürliche Landschaften.
9. **Wetter und Klima** – Wetterlagen, Niederschlag, Temperatur, Klima und atmosphärische Erscheinungen.
10. **Natur und Umwelt** – Natur, Umwelt, Ökosysteme, natürliche Phänomene und Umweltschutz.
11. **Weltraum und Himmelskörper** – Sterne, Planeten, Monde, Galaxien, Astronomie und Raumfahrt.
12. **Zeit und Jahreszeiten** – Zeitangaben, Zeiträume, Kalender, Tageszeiten, Monate und Jahreszeiten.
13. **Sport und Bewegung** – Sportarten, Bewegung, Training, Wettkämpfe und sportliche Aktivitäten.
14. **Kunst und Musik** – Bildende Kunst, Musik, Instrumente, musikalische Werke und künstlerischer Ausdruck.
15. **Film, Bücher und Medien** – Filme, Bücher, Literatur, Fernsehen, Presse und digitale Medieninhalte.
16. **Spiele und Freizeit** – Spiele, Spielzeug, Hobbys, Unterhaltung und Freizeitbeschäftigungen.
17. **Schule und Wissenschaft** – Schule, Unterricht, Lernen, Forschung und wissenschaftliche Fachgebiete.
18. **Sprache und Kommunikation** – Sprache, Wörter, Schrift, Texte, Gespräche und Informationsaustausch.
19. **Gesellschaft und Zusammenleben** – Gemeinschaft, soziale Beziehungen, Institutionen, Politik und gesellschaftliches Leben.
20. **Geschichte und Vergangenheit** – Historische Epochen, Ereignisse, Personenrollen und Dinge aus der Vergangenheit.
21. **Wirtschaft und Geld** – Geld, Handel, Unternehmen, Märkte, Finanzen und wirtschaftliche Vorgänge.
22. **Gefühle und Eigenschaften** – Emotionen, Stimmungen, Charakterzüge, Eigenschaften und abstrakte Zustände.
23. **Religion und Mythologie** – Religionen, Glaubensvorstellungen, Gottheiten, Mythen und religiöse Gegenstände.
24. **Fantasie und Fabelwesen** – Fabelwesen, Zauberwesen, Märchenfiguren und erfundene fantastische Dinge.
25. **Landwirtschaft und Garten** – Landwirtschaft, Ackerbau, Nutztiere, Pflanzenanbau, Gartenarbeit und Gartengeräte.
26. **Handwerk und Bauwesen** – Handwerksberufe, Bauarbeiten, Bauteile, Baustellen und Bauverfahren.

## Zuordnungsregeln

- Jedes der 8.213 eindeutigen Zielwörter erhält genau **eine** Hauptkategorie aus diesem Katalog.
- Es werden keine Kategorien ergänzt, zusammengelegt oder umbenannt.
- Bei Überschneidungen entscheidet die konkrete Bedeutung des Wortes im üblichen Sprachgebrauch. Beispielsweise gehört ein essbares Produkt zu **Essen und Getränke**, eine Pflanzenart als Lebewesen zu **Natur und Umwelt**; ein Gebäude zu **Orte und Gebäude**, ein Baustoff zu **Werkzeuge und Materialien** oder **Handwerk und Bauwesen** je nach Schwerpunkt.
- Mehrdeutige oder schwach bewertete Zuordnungen werden zusätzlich in der Prüfliste festgehalten. Die Prüfliste ersetzt nicht die eindeutige Hauptkategorie.

## Automatische Zuordnung

Das Skript `scripts/categorize-wordfinity.mjs` ordnet die Wörter anhand mehrsprachiger semantischer Embeddings den 26 Kategorieprofilen zu. Es prüft vor dem Lauf, dass genau 8.213 eindeutige Wörter vorhanden sind, und erzeugt:

- `data/wordfinity-categories.json`: Zuordnung jedes Wortes zu genau einer Kategorie.
- `data/wordfinity-category-review.json`: Wörter mit geringer Sicherheit oder knapper Entscheidung zur manuellen Prüfung.

Die automatische Zuordnung ist eine semantische Schätzung und keine behauptete vollständige menschliche Einzelprüfung. Die Prüfliste ist deshalb Bestandteil der Qualitätssicherung.

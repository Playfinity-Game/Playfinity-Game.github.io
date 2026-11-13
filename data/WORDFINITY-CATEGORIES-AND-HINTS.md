# WORDFINITY – Kategorien und Tipps

## Kategorie-Katalog

Die semantische Zuordnung verwendet aktuell diese 21 Kategorien:

1. **Tiere** – Säugetiere, Vögel, Fische, Insekten, Reptilien, Amphibien, Haustiere und Wildtiere
2. **Pflanzen und Pilze** – Bäume, Blumen, Gräser, Kräuter, Gemüse, Obstpflanzen und Pilze
3. **Essen und Getränke** – Lebensmittel, Speisen, Zutaten, Obst, Gemüse, Süßigkeiten, Backwaren und Getränke
4. **Körper und Gesundheit** – Körperteile, Organe, Krankheiten, Medizin, Gesundheit und Pflege
5. **Kleidung und Accessoires** – Kleidung, Schuhe, Stoffe, Schmuck und Taschen
6. **Haushalt und Wohnen** – Möbel, Haushaltsgegenstände, Räume, Küche, Bad und Einrichtung
7. **Werkzeuge und Materialien** – Werkzeuge, Handwerk, Baustoffe und Werkstoffe
8. **Technik und Elektronik** – technische Geräte, Computer, Elektronik, Maschinen und Software
9. **Fahrzeuge und Verkehr** – Autos, Fahrräder, Schiffe, Flugzeuge und Verkehrsmittel
10. **Berufe und Menschen** – Berufe, Tätigkeiten, Berufsgruppen und menschliche Rollen
11. **Orte und Gebäude** – Gebäude, Bauwerke, Städte und Einrichtungen
12. **Geografie und Landschaften** – Länder, Regionen, Landschaften, Gewässer, Berge und Inseln
13. **Wetter und Jahreszeiten** – Wetter, Klima, Jahreszeiten und Naturereignisse
14. **Weltraum und Himmelskörper** – Sterne, Planeten, Monde, Galaxien, Astronomie und Raumfahrt
15. **Sport und Freizeit** – Sportarten, Spiele, Hobbys, Spielzeug und Erholung
16. **Kunst und Unterhaltung** – Kunst, Musik, Film, Theater, Literatur und Medien
17. **Sprache und Kommunikation** – Sprache, Wörter, Schrift, Nachrichten und Informationsaustausch
18. **Wissenschaft und Bildung** – Forschung, Mathematik, Physik, Chemie, Schule und Bildung
19. **Gefühle und Eigenschaften** – Emotionen, Charaktereigenschaften und Zustände
20. **Gesellschaft und Geschichte** – Gesellschaft, Politik, Geschichte, Kultur, Religion, Recht und Wirtschaft
21. **Fantasie und Fabelwesen** – Zauberer, Hexen, Drachen, Fabelwesen, Märchenfiguren und erfundene magische Figuren

## Redaktionell festgelegte Beispiel-Zuordnungen

| Zielwort | Kategorie |
|---|---|
| Hund, Pferd, Schmetterling | Tiere |
| Kaffee, Kuchen | Essen und Getränke |
| Schloss | Orte und Gebäude |
| Gitarre, Musik | Kunst und Unterhaltung |
| Sommer, Winter | Wetter und Jahreszeiten |
| Flugzeug | Fahrzeuge und Verkehr |
| Ozean, Insel | Geografie und Landschaften |
| Roboter, Kamera, Telefon | Technik und Elektronik |
| Zauberer | Fantasie und Fabelwesen |
| Sonne, Rakete | Weltraum und Himmelskörper |
| Wald | Pflanzen und Pilze |

## Verbesserungen an den Tipps

- Die 21 Kategorie-Beschreibungen werden mit einem einzigen Batch-Modellaufruf vorbereitet und zwischengespeichert.
- Die vorberechneten Kategorie-Embeddings werden nach dem Modellstart im Hintergrund geladen.
- Redaktionelle Wort-Tipp-Kandidaten werden gemeinsam bewertet statt nacheinander einzeln.
- Dynamische Wort-Tipps prüfen höchstens 16 neue Kandidaten pro Klick; weitere Klicks prüfen neue Kandidaten. Bereits berechnete Wort-Embeddings werden zwischengespeichert.
- Das Initialisierungs-Promise für Wörterbuch und KI-Modell steht direkt beim Spielstart bereit, damit Tipp-Klicks während des Ladens nicht ins Leere laufen.
- Der Kategorie-Button wird nach einer Unterbrechung (z. B. Pause) wieder freigegeben.

## Grenzen

Die automatische Zuordnung bleibt eine semantische Schätzung des Embedding-Modells. Besonders bei mehrdeutigen oder abstrakten Begriffen können mehrere Kategorien passen. Die 20 redaktionellen Beispiel-Zuordnungen sind festgelegt; die übrigen Wörter werden weiterhin automatisch klassifiziert. Eine vollständige menschliche Einzelprüfung des gesamten Wörterbuchs ist damit nicht behauptet.

- Das Zielwort-Embedding wird beim Rundenwechsel im Hintergrund vorbereitet, damit die neue Runde sofort spielbar ist.
- Kandidaten werden erst nach erfolgreicher Embedding-Berechnung als geprüft markiert; fehlgeschlagene Berechnungen können erneut versucht werden.

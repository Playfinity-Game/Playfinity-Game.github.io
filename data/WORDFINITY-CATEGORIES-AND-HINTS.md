# WORDFINITY – Kategorien und Tipps

## Kategorie-Katalog

Die semantische Zuordnung verwendet aktuell diese 21 Kategorien. Die Definitionen legen bewusst fest, welche Art von Begriff Vorrang hat, wenn Themen überlappen:

1. **Tiere** – Reale Lebewesen aus dem Tierreich; keine Fabelwesen.
2. **Pflanzen und Pilze** – Botanische Lebewesen und Pflanzenteile; essbare Produkte als Lebensmittel gehören zu Essen und Getränke.
3. **Essen und Getränke** – Essbare Lebensmittel, Zutaten, Speisen und Trinkbares; botanische Arten als Lebewesen gehören zu Pflanzen und Pilze.
4. **Körper und Gesundheit** – Körperteile, Organe, Krankheiten, Symptome, Medizin, Behandlung und Pflege.
5. **Kleidung und Accessoires** – Getragene Kleidung, Schuhe, Schmuck, Taschen und Modeartikel.
6. **Haushalt und Wohnen** – Möbel, Geschirr, Haushaltsgeräte, Wohnräume und Dinge des täglichen Wohnens.
7. **Werkzeuge und Materialien** – Handwerkzeuge, Baugeräte und Werkstoffe zur Herstellung, Reparatur oder Konstruktion.
8. **Technik und Elektronik** – Elektronische und digitale Geräte, Computer, Software, Maschinen und technische Systeme.
9. **Fahrzeuge und Verkehr** – Fortbewegungsmittel, Verkehrsanlagen und Verkehrsbegriffe.
10. **Berufe und Menschen** – Reale Menschen, Personengruppen, Rollen, Berufe und berufliche Tätigkeiten.
11. **Orte und Gebäude** – Von Menschen geschaffene oder genutzte konkrete Bauwerke und Einrichtungen; keine natürlichen Landschaften.
12. **Geografie und Landschaften** – Natürliche und politische geografische Räume, Länder, Regionen, Gewässer, Berge und Inseln.
13. **Wetter und Jahreszeiten** – Atmosphärische Zustände, Wetterereignisse, Jahreszeiten und Klimaerscheinungen.
14. **Weltraum und Himmelskörper** – Objekte und Phänomene außerhalb der Erde sowie Astronomie und Raumfahrt.
15. **Sport und Freizeit** – Sportarten, Wettkämpfe, Freizeitaktivitäten, Hobbys, Spiele und Spielzeug.
16. **Kunst und Unterhaltung** – Künstlerische Werke und Ausdrucksformen sowie Kultur- und Unterhaltungsmedien.
17. **Sprache und Kommunikation** – Wörter, Schrift, Grammatik, Sprachen und Informationsaustausch.
18. **Wissenschaft und Bildung** – Wissenschaftliche Fachgebiete, Forschung, Lehrinhalte, Schule und Unterricht.
19. **Gefühle und Eigenschaften** – Abstrakte Emotionen, Stimmungen, Charakterzüge, Bewertungen und Zustände.
20. **Gesellschaft und Geschichte** – Gesellschaftliche Systeme, Politik, Recht, Religion, Wirtschaft, Kultur und historische Ereignisse.
21. **Fantasie und Fabelwesen** – Erfundenes Übernatürliches, magische Figuren und Märchenwesen; reale Tiere gehören zu Tiere.

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

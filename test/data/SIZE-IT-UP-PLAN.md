# SIZE IT UP – Spielplan

> Zentrale Konzeptnotiz für die Weiterentwicklung von SIZE IT UP. Diese Datei beschreibt die vereinbarten Spielregeln und das gewünschte Verhalten. Der Objektpool liegt separat in `size-it-up-pool.json`.

## 1. Spielidee

SIZE IT UP ist ein Größenvergleichs- und Schätzspiel. Spieler sehen zwei Objekte als Silhouetten und skalieren das Zielobjekt so, dass sie dessen tatsächliche Größe möglichst genau treffen. Nach dem Abschicken wird die Schätzung mit der Realität verglichen.

## 2. Die fünf Kategorien

1. **Geografie:** Länder, Kontinente, Städte, Berge, Flüsse, Inseln, Seen, Gebäude und Sehenswürdigkeiten.
2. **Games:** Konsolen, Controller, Gaming-Zubehör und weitere Dinge rund ums Gaming.
3. **Alltagsgegenstände:** Smartphones, Waschmaschinen, Schaufeln, Besen, Möbel und Haushaltsgeräte.
4. **Transport & Fahrzeuge:** Autos, Motorräder, Fahrräder, LKWs, Busse, Züge, Flugzeuge, Schiffe und Raumfahrzeuge.
5. **Natur & Tiere:** Tiere, Pflanzen, Bäume, Insekten und Naturphänomene.

## 3. Objektpool und zufällige Vergleiche

- Es soll ein großer, laufend erweiterbarer Pool aus allen fünf Kategorien entstehen.
- Objektpaare werden zufällig und abwechslungsreich ausgewählt; keine feste Abfolge.
- Vergleiche dürfen Kategorien mischen, zum Beispiel Waschmaschine gegen Elefant oder Smartphone gegen Eiffelturm.
- Paarungen müssen sinnvoll und spielbar sein.
- Für jedes Objekt müssen verlässliche Messwerte und die tatsächlich gemeinte Dimension hinterlegt sein (z. B. Höhe, Länge oder Spannweite).
- Keine erfundenen oder ungeprüften Größenangaben.
- Die Daten werden zentral in `test/data/size-it-up-pool.json` gepflegt, getrennt von der Spielmechanik.

## 4. Silhouetten und Darstellung

- Linkes Referenzobjekt: **blau**.
- Rechtes, vom Spieler zu skalierendes Zielobjekt: **rot**.
- Nach der Auflösung: zusätzliche **weiße Silhouette** des Zielobjekts in seiner tatsächlichen Größe.
- Silhouetten sollen transparenten Hintergrund haben, klar erkennbar und möglichst realistisch sein.
- Keine Markenlogos oder geschützten Produktdetails verwenden; bei Gaming-Objekten neutrale, eigenständige Formen verwenden.
- Größenverhältnisse müssen rechnerisch aus den echten Messwerten abgeleitet werden. Illustrative Bildgrößen dürfen keine falschen Maßstäbe vortäuschen.

## 5. Spielablauf

### Phase A – Vergleich anzeigen

- Blaue Silhouette links und rote Silhouette rechts anzeigen.
- Unter dem Spielfeld nur die Namen der beiden Objekte nennen, z. B. „Mensch vs. Elefant“.
- Vor dem Abschicken keine tatsächlichen Größen oder Maße zeigen – auch nicht die Größe des Referenzobjekts.

### Phase B – Schätzung

- Der Spieler skaliert die rote Silhouette mit der vorhandenen Zieh-/Skaliermechanik.
- Bestehende Bedienung und Spielmechanik möglichst erhalten.

### Phase C – Guess abschicken / Lock In

- Die Schätzung wird festgehalten.
- Erst jetzt werden die tatsächlichen Größen und die Auflösung sichtbar.

### Phase D – Auflösung

- Die blaue Referenz-Silhouette bleibt sichtbar.
- Die rote Silhouette zeigt weiterhin die vom Spieler geschätzte Größe.
- Zusätzlich erscheint eine **weiße Silhouette in der tatsächlichen Größe des Zielobjekts**.
- Die weiße Silhouette muss auf dem echten Messwert beruhen und darf nicht bloß dekorativ sein.
- Textlich anzeigen:
  - Tipp des Spielers.
  - Tatsächliche Größe des Zielobjekts.
  - Tatsächliche Größe des Referenzobjekts.
  - Tatsächliche Größe des Zielobjekts nochmals eindeutig zugeordnet, damit der Vergleich verständlich bleibt.

## 6. Maße und Einheiten

- Die passende Dimension muss pro Objekt klar angegeben sein (z. B. Höhe, Länge oder Spannweite).
- Einheiten passend zur Größe verwenden: mm nur wenn nötig, sonst cm, m oder km.
- Vergleich und Skalierung müssen dieselbe definierte Dimension verwenden.
- Messwerte und Quellen vor Aufnahme in den Pool prüfen.

## 7. Wertung und bestehende Mechanik

- Bestehende Zieh-/Skaliermechanik, Rundenablauf und Punkteberechnung möglichst beibehalten.
- Die bisherige Wertung bis maximal 100 Punkte und fünf Runden bleibt der Ausgangspunkt.
- Je genauer die Schätzung, desto mehr Punkte.
- Änderungen an der Wertung nur nach gesonderter Abstimmung.

## 8. Technische und organisatorische Leitplanken

- Objekt-Datenpool und Spielmechanik getrennt halten.
- Stabilität hat Vorrang vor zusätzlichen Features.
- Änderungen zunächst ausschließlich für die Testseite vorbereiten.
- Die Live-Seite bzw. `main/index.html` nicht ohne ausdrückliche Freigabe verändern oder veröffentlichen.
- Keine Pull Requests mergen und nichts deployen, bevor der Nutzer ausdrücklich zugestimmt hat.
- Browser-/End-to-End-Tests nur dann als durchgeführt bezeichnen, wenn sie tatsächlich ausgeführt wurden.

## 9. Nächste sinnvolle Schritte

1. Objekt-Datenstruktur in `size-it-up-pool.json` finalisieren.
2. Einen ersten kuratierten Satz an Objekten mit geprüften Messwerten und Quellen ergänzen.
3. Geeignete, rechtlich unbedenkliche Silhouetten für diese Objekte sammeln/erstellen.
4. Zufällige, sinnvolle Objektpaar-Auswahl implementieren.
5. Die Auflösung mit der weißen Echtmaß-Silhouette implementieren.
6. Testseite prüfen und erst nach ausdrücklicher Freigabe veröffentlichen.

---

**Merksatz:** Vor Lock In keine echten Größen verraten. Nach Lock In zeigt die weiße Silhouette die tatsächliche Größe des Zielobjekts.

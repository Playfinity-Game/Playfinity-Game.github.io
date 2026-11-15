# WORDFINITY – Kategorien und Wortzuordnung

Die aktive Datei `data/wordfinity-nouns.json` enthält **38 Kategorien** und **4.500 eindeutige Wörter**. Jedes Wort ist genau einer Hauptkategorie zugeordnet. Die Kategorien bleiben erhalten; die Wortliste ist bewusst als gruppiertes JSON-Objekt gespeichert.

## Aktive Kategorien

1. **Tiere**
2. **Pflanzen & Garten**
3. **Essen & Trinken**
4. **Haushalt & Wohnen**
5. **Kleidung & Accessoires**
6. **Körper & Gesundheit**
7. **Familie & Menschen**
8. **Berufe & Arbeit**
9. **Schule & Bildung**
10. **Sport & Bewegung**
11. **Spiele & Freizeit**
12. **Musik & Kunst**
13. **Film, Bücher & Medien**
14. **Technik & Elektronik**
15. **Werkzeuge & Material**
16. **Fahrzeuge & Verkehr**
17. **Gebäude & Orte**
18. **Natur & Landschaft**
19. **Wetter & Klima**
20. **Weltraum & Wissenschaft**
21. **Zeit & Kalender**
22. **Geld & Wirtschaft**
23. **Gefühle & Eigenschaften**
24. **Fantasie & Märchen**
25. **Religion & Feste**
26. **Geschichte & Gesellschaft**
27. **Reisen & Urlaub**
28. **Obst & Gemüse**
29. **Getränke & Süßes**
30. **Küche & Kochen**
31. **Bauernhof & Landwirtschaft**
32. **Meer & Wasser**
33. **Internet & Handy**
34. **Restaurant & Café**
35. **Körperpflege & Bad**
36. **Polizei, Feuerwehr & Rettung**
37. **Zirkus & Jahrmarkt**
38. **Camping & Outdoor**

## Zuordnungsregeln

- Jedes Wort erhält genau eine Hauptkategorie.
- Bei Überschneidungen entscheidet die typische, konkrete Bedeutung des Wortes.
- Ein Wort wird nicht mehrfach in verschiedenen Kategorien geführt.
- Ein gültiges Wort wird bei einer falschen Zuordnung verschoben, nicht gelöscht.
- Ungewöhnliche, regionale oder fachsprachliche Wörter müssen im Einzelfall geprüft werden; die automatische oder strukturelle Bereinigung ist kein Ersatz für ein vollständiges Wörterbuchlektorat.

## Technische Hinweise

- Die aktive Wortliste ist ein JSON-Objekt mit Kategorie-Schlüsseln und Wort-Arrays.
- Änderungen müssen die Objektstruktur und alle 38 Kategorien erhalten.
- Die Spiel- und Tippfunktionen müssen die gruppierte Struktur laden und die gespeicherte Hauptkategorie verwenden.
- Die Skripte zur Kandidatenerzeugung dürfen die aktive Datei nicht automatisch durch ein flaches Array ersetzen.

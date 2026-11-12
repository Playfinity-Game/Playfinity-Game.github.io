# Spielidee: ZEICHNEN & RATEN

> **Status:** Konzeptnotiz – noch nicht umgesetzt.

## Grundidee
Der Streamer erhält einen geheimen Begriff und zeichnet ihn live. Die Community versucht, den Begriff über den TikTok-Live-Chat zu erraten.

## Geplanter Spielablauf
1. Das Spiel wählt zufällig einen Begriff aus einem gepflegten Begriffepool.
2. Nur der Streamer sieht den geheimen Begriff.
3. Der Streamer zeichnet auf einer digitalen Zeichenfläche.
4. Die Community sieht ausschließlich die Zeichnung und sendet ihre Tipps im TikTok-Chat.
5. Das Spiel erkennt richtige Antworten, bestimmt den ersten Treffer und vergibt Punkte.
6. Nach Ablauf der Runde wird die Lösung gezeigt; danach startet die nächste Runde.

## Zwei strikt getrennte Ansichten

### Streamer-Ansicht (privat)
- Geheimer Begriff gut sichtbar
- Zeichenfläche und Zeichenwerkzeuge
- Timer und Rundensteuerung
- Optional: Kategorie oder Schwierigkeitsgrad

### Community-/Stream-Ansicht (öffentlich)
- Nur die Zeichnung
- Countdown und Spielstatus
- Chat-Hinweis wie „Schreib deine Antwort in den TikTok-Chat!“
- **Niemals** der geheime Begriff oder andere Lösungsdaten

## Technischer Ansatz
- Zeichenfläche im Browser, z. B. HTML Canvas; Bedienung mit Maus, Touch oder Stift.
- Stream-Ausgabe als separate öffentliche Ansicht, z. B. OBS-Browser-Quelle oder gezielte Bildschirmaufnahme.
- Geheime Lösung serverseitig verwalten und ausschließlich an die authentifizierte Streamer-Ansicht ausliefern.
- TikTok-Chat über das vorhandene PLAYFINITY-Live-Backend anbinden.
- Antworten serverseitig normalisieren und prüfen (z. B. Groß-/Kleinschreibung, Satzzeichen, Umlaute und definierte Alternativbegriffe).
- Der Server bestimmt die Reihenfolge korrekter Antworten und vergibt Punkte; Browserdaten sind nicht maßgeblich.
- Bestehende Pause- und Rundensteuerung nach Möglichkeit wiederverwenden.

## Mögliche erste Regeln
- 60 Sekunden pro Runde
- Erster richtiger Tipp: 100 Punkte
- Weitere richtige Tipps: optional weniger Punkte
- Lösungseinblendung: etwa 7 Sekunden
- Nächste Runde automatisch oder manuell

## Zeichenwerkzeuge für eine spätere Version
- Stift/Farbe und Strichstärke
- Radierer
- Rückgängig
- Zeichenfläche leeren

## Sicherheits- und Datenschutzanforderung
Die geheime Lösung darf weder im öffentlichen HTML/JavaScript noch in öffentlichen Netzwerkantworten oder Stream-Overlays auftauchen. Die öffentliche Ansicht erhält nur die zum Anzeigen nötigen Zeichnungsdaten und den Spielstatus. Die Trennung der Ansichten muss vor einem Live-Test geprüft werden.

## Umsetzungsumfang
Zunächst nur eine Testversion mit Zeichenfläche, privater Begriffsanzeige, Timer und TikTok-Antwortprüfung. Erst nach erfolgreichem Test weitere Funktionen ergänzen.

**Wichtig:** Diese Datei dokumentiert nur die Idee und Planung. Sie verändert keine bestehenden Spiele oder die Live-Seite.

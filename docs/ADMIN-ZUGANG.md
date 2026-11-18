# PLAYFINITY – Admin-Zugang & Server-Notizen

## Richtige Administrator-Seite

https://playfinity-troll-admin-test.onrender.com/admin

**Wichtig:** Das ist die maßgebliche Admin-Adresse für PLAYFINITY im Testmodus. Nicht mit der GitHub-Pages-Spieleseite oder der Hauptserver-URL verwechseln.

## Render-Server

### 1. PLAYFINITY-Hauptserver (Produktion)

- **Name:** `playfinity-game-github-io`
- **URL:** https://playfinity-game-github-io.onrender.com
- **Render Service ID:** `srv-dbqeeetbedkc73dbeatg`
- **Aufgabe:** TikTok-LIVE-Verbindungen, zentrale Serverlogik, WebSocket-Verteilung an die Spiele und API-Endpunkte (u. a. Spielzeit-Statistik).
- **Wichtig:** Die aktiven TikTok-LIVE-Sitzungen laufen auf diesem Hauptserver.

### 2. PLAYFINITY Troll-Admin (Test)

- **Name:** `playfinity-troll-admin-test`
- **URL:** https://playfinity-troll-admin-test.onrender.com
- **Admin-Seite:** https://playfinity-troll-admin-test.onrender.com/admin
- **Render Service ID:** `srv-dbtrcp1srm7s73dqnehg`
- **Branch:** `feature/troll-admin-safe-preview`
- **Aufgabe:** Geschützte Admin-Oberfläche im Testmodus. Die Anzeige der LIVE-Verbindungen und Diagnosedaten fragt den Hauptserver ab.

### Verbindung zwischen Admin und Hauptserver

Der Test-Admin ruft für die LIVE-Übersicht den internen Snapshot-Endpunkt des Hauptservers ab:

`/internal/admin-snapshot`

Der Test-Admin-Proxy stellt die Daten über seine Admin-Route `/admin/live-connections` bereit. Die dafür konfigurierte Bridge-Authentifizierung liegt ausschließlich in den Render-Umgebungsvariablen. **Keine Tokens oder Secrets in diese Datei schreiben.**

## TikTok-Chat-Diagnose

Im Test-Admin unter **„Live-Streamer“** erscheinen bei einer verbundenen LIVE-Sitzung:

- **Chat empfangen:** Chat-Ereignisse, die der Hauptserver vom TikTok-Connector erhalten hat.
- **Chat weitergeleitet:** Chat-Ereignisse, die der Hauptserver an verbundene Clients weitergegeben hat.
- **Zustellungen:** Anzahl der WebSocket-Client-Zustellungen laut Serverzähler.
- **Letzter Chat / letztes TikTok-Ereignis:** Zeitpunkt und Typ des zuletzt erfassten Ereignisses.
- **Connector-Fehler:** letzter protokollierter Verbindungsfehler samt Zeitpunkt, sofern vorhanden.

### Einordnung der Zähler

- Empfangen steigt, weitergeleitet bleibt stehen: Weiterleitung auf dem Hauptserver untersuchen.
- Empfangen und weitergeleitet steigen, Spiel reagiert nicht: WebSocket-Verbindung bzw. Eingabelogik des jeweiligen Spiels untersuchen.
- Streamer erscheint gar nicht unter „Live-Streamer“: zuerst TikTok-LIVE-Verbindung und Snapshot-/Admin-Brücke prüfen.
- Zustellungen zählen Client-Zustellungen; sie beweisen allein noch nicht, dass das Spiel die Nachricht korrekt verarbeitet hat.

## Dokumentierte Arbeiten – 18.11.2026

### TikTok-Chat-Diagnose im Admin sichtbar gemacht

- **PR #209 – Hauptserver:** Diagnosefelder werden jetzt über `/internal/admin-snapshot` an den Test-Admin durchgereicht.
- **PR #210 – Test-Admin:** LIVE-Streamer-Karten zeigen Chat empfangen, Chat weitergeleitet, Zustellungen, letzten Chat und Connector-Fehler.
- Beide PRs wurden gemergt; die zugehörigen Render-Deployments wurden als erfolgreich/live bestätigt.
- Die Änderungen betreffen die Diagnose und Anzeige. TikFinity-Einstellungen und die eigentliche Spiel-Eingabelogik wurden dabei nicht umgestellt.
- Für diese Diagnose-Erweiterung waren keine neuen Keys nötig.

### Beobachteter TikTok-Connector-Fehler

In älteren Hauptserver-Logs trat auf:

`Failed to retrieve Room ID from all sources.`

Bedeutung: Der TikTok-Connector konnte bei einem Verbindungsversuch die eindeutige LIVE-Room-ID nicht ermitteln. Das kann an vorübergehend nicht verfügbaren TikTok-LIVE-Daten oder am Connector liegen. Die konkrete Ursache wurde nicht eindeutig nachgewiesen; der Fehler ist kein Beweis dafür, dass TikTok allein verantwortlich war.

### Erfolgreicher Funktionstest

Beim späteren Test mit `@blackangel16051983` zeigte der Admin:

- 1 LIVE-Verbindung
- 50 Chat-Ereignisse empfangen
- 44 Chat-Ereignisse weitergeleitet
- 44 Zustellungen

Damit war der Empfang und die Weiterleitung von Chat-Ereignissen sichtbar. Die Zähler allein beweisen nicht die korrekte Verarbeitung jedes einzelnen Buchstabens im Spiel.

## Weitere bekannte Projektarbeiten

- Hangman: Wortlisten/Rechtschreibung und mobile Lösungseingabe verbessert.
- FIVE-X: deutsche Wortliste bereinigt und erweitert.
- Wordfinity: Gewinneranzeige und Hinweise bearbeitet; mögliche Verlangsamung bei wiederholten Hinweisen war noch ein gesonderter Prüfpunkt.
- Troll-Admin: zusätzliche visuelle Effekte und gezielte Spieleraktionen.
- MEGASIZE: Zoom-/Ergebnisdarstellung und Messwerttexte angepasst; Silhouetten bewusst unverändert gelassen.

## Offene bzw. separat zu prüfende Punkte

- Bei erneutem TikTok-Chat-Ausfall zuerst die Werte unter „Live-Streamer“ prüfen und einen Test-Chat senden lassen.
- Falls Chat empfangen und weitergeleitet steigen, aber ein Spiel nicht reagiert, die Spieleingabe/WebSocket-Verarbeitung separat untersuchen.
- Die geplante unabhängige Auto-Next-Einstellung für Wordfinity, FIVE-X und GUESSWHAT war als Idee notiert; ihre Fertigstellung ist hier nicht bestätigt.

## Sicherheits- und Betriebsnotizen

- Keine Passwörter, API-Keys, Tokens oder Secrets in GitHub-Dokumentation eintragen.
- TikFinity nicht ohne ausdrücklichen Auftrag verändern.
- Änderungen am Hauptserver können einen Neustart und eine kurze Unterbrechung laufender LIVE-Verbindungen auslösen. Vor solchen Änderungen Zustimmung einholen.
- Admin-Statistiken liegen teilweise nur im Arbeitsspeicher und können bei Render-Neustarts oder Sleep verloren gehen.

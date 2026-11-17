# PLAYFINITY – Troll Admin Projektlog

## Ziel
Ein passwortgeschütztes Admin-Menü für fünf spätere Live-Funktionen: Bildschirm wackeln, Spiel umdrehen, Konfetti, Spiel einfrieren/freigeben und lustige Nachrichten.

## Sicherheitsregeln
- Keine Passwörter oder Secrets im Repository.
- Anmeldung ausschließlich serverseitig mit sicherer Session und Environment Secret.
- Not-Aus muss Effekte sofort stoppen und weitere Aktionen sperren, bis bewusst wieder freigegeben wird.
- Erst isolierte Vorschau, danach Tests und ausdrückliche Freigabe des Nutzers vor jeder Live-Integration.
- `main` und Render bleiben bis zur ausdrücklichen Freigabe unverändert.

## Projektbestand
- Repository: Playfinity-Game/Playfinity-Game.github.io
- Render-Service: Playfinity-Game.github.io (Node Web Service), Root-Verzeichnis `tiktok-connector`
- Render-URL: https://playfinity-game-github-io.onrender.com
- Hauptspiel: `index.html` (große HTML-Datei mit eingebettetem CSS/JavaScript)
- TikTok-Connector: `tiktok-connector/server.js`
- Connector stellt bereits TikTok-Live-Ereignisse per WebSocket bereit; Troll-Admin-Endpunkte sind noch nicht vorhanden.
- Die vorhandene normale Pause-Funktion ist nicht der Troll-Not-Aus.

## Arbeitsprotokoll
### 2026-11-17 – Bestandsaufnahme
- Repository-Struktur auf `main` lesend geprüft.
- Hauptdatei `index.html`, Ordner `scripts`, `tests`, `assets` und `tiktok-connector` identifiziert.
- Keine Änderung an `main` oder Render.

### 2026-11-17 – Isolierte Vorschau
- Feature-Branch `feature/troll-admin-safe-preview` von `main` erstellt.
- Datei `troll-admin-preview.html` angelegt.
- Enthält Simulationen für alle fünf gewünschten Funktionen sowie Not-Aus mit Sperre und bewusster Wiederfreigabe.
- Vorschau hat keine TikTok-Verbindung, keine Server-Aufrufe und keine Verbindung zum echten Spiel.
- Keine echte Passwort-Authentifizierung; diese muss serverseitig implementiert werden, bevor irgendeine Live-Steuerung zulässig ist.
- Vorschau nach dem Commit erneut abgerufen und geprüft.

### 2026-11-17 – Browser-Testautomatisierung
- Playwright-Browser-Tests unter `tests/troll-admin-preview.spec.cjs` ergänzt.
- Tests prüfen fünf Steuerungen, lokale Effekte, Not-Aus, Sperre und bewusste Wiederfreigabe.
- Zusätzliche Prüfung stellt sicher, dass die Vorschau keine externen Netzwerkaufrufe macht.
- GitHub-Actions-Workflow `.github/workflows/troll-admin-preview-tests.yml` erstellt.
- Zweiter Lauf auf Commit `4b42ac0d0f11368a8e8274b5bb97b43e5c6999b2` erfolgreich abgeschlossen; alle Workflow-Schritte einschließlich Browser-Tests meldeten `success`.
- Ergebnis: https://github.com/Playfinity-Game/Playfinity-Game.github.io/actions/runs/43998075007

### 2026-11-17 – Sicherheitsentwurf
- `TROLL_ADMIN_SICHERHEITSKONZEPT.md` erstellt.
- Bevorzugt wird, die spätere Admin-Oberfläche direkt vom Connector unter derselben Herkunft auszuliefern. Das vermeidet fragile Cross-Site-Cookie-Abhängigkeiten zwischen GitHub Pages und Render.
- Entwurf beschreibt serverseitigen Login, scrypt-Hash aus Render-Environment-Konfiguration, sichere Session-Cookies, Origin-Prüfung, Rate-Limits und serverseitigen Not-Aus.
- Noch keine Anmeldung, Session oder Live-Steuerung implementiert.

## Status
Die isolierte Vorschau und ihre automatisierten Browser-Tests sind vorhanden; der CI-Lauf ist erfolgreich. Der Sicherheitsentwurf ist dokumentiert. Das ist kein Nachweis für Live-Integration oder Authentifizierung: Beides ist noch nicht implementiert. Render und `main` wurden nicht verändert.

## Nächste Schritte
1. Sicherheitsentwurf in konkrete serverseitige Authentifizierungs- und Not-Aus-Tests übersetzen.
2. Authentifizierung und Admin-Endpunkte zunächst ohne Live-Spiel-Aktionen im Feature-Branch implementieren.
3. Regressionstests für bestehende Health-, TikTok-Connect- und WebSocket-Funktionen durchführen.
4. Erst nach Tests und ausdrücklicher Freigabe über Integration und Deployment entscheiden.

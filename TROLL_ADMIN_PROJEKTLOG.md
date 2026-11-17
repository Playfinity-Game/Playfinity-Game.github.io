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
### 2026-11-17 – Bestandsaufnahme und isolierte Vorschau
- Repository-Struktur auf `main` lesend geprüft; keine Änderungen an `main` oder Render.
- Hauptdatei `index.html`, Ordner `scripts`, `tests`, `assets` und `tiktok-connector` identifiziert.
- Feature-Branch `feature/troll-admin-safe-preview` erstellt.
- `troll-admin-preview.html` enthält Simulationen der fünf Funktionen sowie Not-Aus mit Sperre und bewusster Wiederfreigabe.
- Vorschau hat keine TikTok-Verbindung, keine Server-Aufrufe und keine Verbindung zum echten Spiel.
- Vorschau enthält keine echte Passwort-Authentifizierung.

### 2026-11-17 – Vorschau-Browser-Tests
- Playwright-Tests unter `tests/troll-admin-preview.spec.cjs` prüfen die fünf lokalen Effekte, Not-Aus, Sperre/Wiederfreigabe und ausbleibende externe Netzwerkaufrufe.
- GitHub-Actions-Lauf erfolgreich: https://github.com/Playfinity-Game/Playfinity-Game.github.io/actions/runs/43998075007

### 2026-11-17 – Sicherheitsentwurf und Auth-Modul
- `TROLL_ADMIN_SICHERHEITSKONZEPT.md` dokumentiert Architektur, sichere Session-Cookies, Origin-Prüfung, Rate-Limits und serverseitigen Not-Aus.
- `tiktok-connector/troll-admin-auth.js` ergänzt: Passwort-Hashprüfung mit Node `scrypt`, Salt/Hash aus Environment-Konfiguration, konstanter Hash-Vergleich, zufällige opake Sitzungstokens, Ablauf und Logout.
- Das Auth-Modul verweigert die Initialisierung, wenn Hash oder Salt fehlen/ungültig sind.
- `tests/troll-admin-auth.spec.js` prüft Konfigurationsfehler, korrekten/falschen Login, unbekannte/abgemeldete Tokens und Ablauf.
- GitHub-Actions-Workflow führt Auth-Unit-Tests und Vorschau-Browser-Tests gemeinsam aus.
- CI-Lauf auf Commit `8ebc15756449fb7059d579016292d984b5fdf93b` vollständig erfolgreich: https://github.com/Playfinity-Game/Playfinity-Game.github.io/actions/runs/43998519124

## Status
Die isolierte Vorschau und das Auth-Modul sind vorhanden; Vorschau- und Authentifizierungstests sind in GitHub Actions erfolgreich. Das Auth-Modul ist noch nicht in `server.js` eingebunden und es gibt noch keine HTTP-Login-/Session-Endpunkte. Serverseitiger Not-Aus und Live-Steuerung sind noch nicht implementiert. Render und `main` wurden nicht verändert.

## Nächste Schritte
1. Auth-Modul in isolierte HTTP-Routen für Login/Logout und Session-Cookie-Schutz integrieren.
2. Origin-Prüfung, Login-Rate-Limit und sichere JSON-Verarbeitung ergänzen und testen.
3. Serverseitigen Not-Aus samt gesperrtem Standardzustand und authentifizierter bewusster Wiederfreigabe ergänzen.
4. Regressionstests für bestehende Health-, TikTok-Connect- und WebSocket-Funktionen durchführen.
5. Erst nach Tests und ausdrücklicher Freigabe über Integration und Deployment entscheiden.

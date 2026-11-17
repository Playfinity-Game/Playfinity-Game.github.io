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
- Playwright-Tests unter `tests/troll-admin-preview.spec.cjs` ergänzen Prüfungen der fünf lokalen Effekte, Not-Aus, Sperre/Wiederfreigabe und ausbleibender externer Netzwerkaufrufe.
- GitHub-Actions-Lauf auf Commit `4b42ac0d0f11368a8e8274b5bb97b43e5c6999b2` erfolgreich: https://github.com/Playfinity-Game/Playfinity-Game.github.io/actions/runs/43998075007

### 2026-11-17 – Sicherheitsentwurf und Auth-Modul
- `TROLL_ADMIN_SICHERHEITSKONZEPT.md` dokumentiert Architektur, sichere Session-Cookies, Origin-Prüfung, Rate-Limits und serverseitigen Not-Aus.
- `tiktok-connector/troll-admin-auth.js` ergänzt: Passwort-Hashprüfung mit Node `scrypt`, Salt/Hash aus Environment-Konfiguration, konstante Hash-Vergleichszeit, zufällige opake Sitzungstokens, Ablauf und Logout.
- Das Auth-Modul verweigert die Initialisierung, wenn Hash oder Salt fehlen/ungültig sind.
- `tests/troll-admin-auth.spec.js` ergänzt: Konfigurationsfehler, korrekter/falscher Login, unbekannte/abgemeldete Tokens und Ablauf werden getestet.
- Workflow erweitert, damit Auth-Unit-Tests und Vorschau-Browser-Tests gemeinsam laufen.
- CI-Lauf für Commit `8ebc15756449fb7059d579016292d984b5fdf93b`: https://github.com/Playfinity-Game/Playfinity-Game.github.io/actions/runs/43998519124
- Zuletzt beobachtet: Playwright- und Chromium-Installation laufen; Testschritt noch ausstehend.

## Status
Die isolierte Vorschau ist getestet. Das Authentifizierungsmodul ist als separater Baustein angelegt, aber noch nicht in `server.js` eingebunden und noch nicht für HTTP-Login/Session-Endpunkte verwendet. Die neuen Auth-Tests sind noch nicht als bestanden bestätigt. Not-Aus und Live-Steuerung sind serverseitig noch nicht implementiert. Render und `main` wurden nicht verändert.

## Nächste Schritte
1. Aktuellen CI-Lauf abschließen und mögliche Fehler beheben.
2. Auth-Modul mit HTTP-Login, Logout, Cookie- und Origin-Schutz in einem isolierten Server-Entwurf verbinden.
3. Server-seitigen Not-Aus und Test-Endpunkte ohne echte Spielaktionen ergänzen.
4. Regressionstests für bestehende Health-, TikTok-Connect- und WebSocket-Funktionen durchführen.
5. Erst nach Tests und ausdrücklicher Freigabe über Integration und Deployment entscheiden.

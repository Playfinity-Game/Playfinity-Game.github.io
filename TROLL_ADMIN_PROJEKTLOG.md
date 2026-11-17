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
- Hauptspiel: `index.html`
- TikTok-Connector: `tiktok-connector/server.js`

## Arbeitsprotokoll
### 2026-11-17 – Isolierte Vorschau und Browser-Tests
- Feature-Branch `feature/troll-admin-safe-preview` enthält `troll-admin-preview.html` mit fünf rein lokalen Simulationen und Not-Aus.
- Playwright-Tests prüfen alle Effekte, Sperre/Wiederfreigabe und das Ausbleiben externer Netzwerkaufrufe.
- CI erfolgreich: https://github.com/Playfinity-Game/Playfinity-Game.github.io/actions/runs/43998075007

### 2026-11-17 – Passwort-Authentifizierung
- `tiktok-connector/troll-admin-auth.js` nutzt Node `scrypt`, einen Salt und Hash aus Environment-Variablen, konstanten Hash-Vergleich, kryptografisch zufällige Session-Tokens, Ablaufzeit und Logout.
- Bei fehlendem/ungültigem Secret bleibt die Admin-Funktion deaktiviert; der bestehende Connector kann weiterhin starten.
- Auth-Tests für Konfiguration, Login, falsches Passwort, Logout und Session-Ablauf erfolgreich.
- CI erfolgreich: https://github.com/Playfinity-Game/Playfinity-Game.github.io/actions/runs/43998519124

### 2026-11-17 – Server-Routen und Not-Aus
- `tiktok-connector/troll-admin-state.js` implementiert serverseitigen Not-Aus; Standardzustand nach Prozessstart ist gesperrt.
- `server.js` bindet Authentifizierung ein und ergänzt POST-Routen `/admin/login`, `/admin/logout`, `/admin/emergency-stop`, `/admin/re-enable`, `/admin/action` sowie GET `/admin/status`.
- Session-Cookie: `HttpOnly; Secure; SameSite=Strict`, Host-only Cookie; Sitzungen liegen nur im Arbeitsspeicher und verfallen.
- Admin-Schreibzugriffe verlangen gleiche Origin, gültige Session (außer Login) und Rate-Limit.
- Die fünf Aktionen werden ausschließlich als Simulation bestätigt; es gibt keine Verbindung zum Spiel und keine TikTok-Live-Aktion.
- Not-Aus blockiert Aktionen bis zur bewussten authentifizierten Freigabe.
- Server-Syntaxcheck und Unit-/Browser-Tests laufen in GitHub Actions. Lauf für vorherigen Commit: https://github.com/Playfinity-Game/Playfinity-Game.github.io/actions/runs/43998790579

## Aktueller Status / Grenzen
- Server-Routen und Not-Aus sind im Feature-Branch implementiert, noch nicht deployed.
- Es gibt noch keine Admin-Weboberfläche unter `/admin`; die Routen sind API-Endpunkte.
- Die Admin-Aktionen sind weiterhin Simulationen und verändern das echte Spiel nicht.
- Vor Render-Einsatz müssen Passwort-Hash und Salt als Environment-Variablen sicher gesetzt werden.
- CI für den jüngsten Server-Stand muss vollständig erfolgreich sein.
- `main` und Render wurden nicht verändert.

## Nächste Schritte
1. Den CI-Lauf für den neuesten Commit erfolgreich abschließen und bei Fehlern korrigieren.
2. HTTP-Integrationstests für Login-Cookie, Origin-Schutz, Session-Prüfung, Logout und Not-Aus ergänzen.
3. Eine Admin-Oberfläche mit Login, Status, fünf Simulationstasten und Not-Aus erstellen.
4. Erst danach nach ausdrücklicher Zustimmung kontrolliert in eine Testumgebung übernehmen; Live-Steuerung bleibt gesondert freizugeben.

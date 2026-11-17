# PLAYFINITY Troll Admin – Sicherheits- und Integrationsentwurf

## Zweck und Grenzen
Dieser Entwurf beschreibt die nächste Ausbaustufe, ohne Live-Steuerung einzuschalten. Alle Änderungen bleiben auf `feature/troll-admin-safe-preview`. Kein Passwort, Hash, Session-Token oder sonstiges Secret gehört ins Git-Repository. Kein Deployment und keine Änderung an `main` ohne ausdrückliche Freigabe.

## Architekturentscheidung: gleiche Herkunft
Die bestehende GitHub-Pages-Seite und der Render-Connector liegen auf unterschiedlichen Domains. Eine Admin-Oberfläche auf GitHub Pages würde deshalb browserseitig Cross-Site-Cookies benötigen; diese können durch Browser-Datenschutz blockiert werden. Bevorzugte Lösung: Die spätere Admin-Oberfläche wird vom Connector selbst unter derselben Herkunft ausgeliefert (z. B. `/admin`). So können Session-Cookies als `HttpOnly; Secure; SameSite=Strict` gesetzt werden, ohne Drittanbieter-Cookies.

## Anmeldung und Session
- Serverseitiger Login-Endpunkt; Passwort wird ausschließlich über eine Render-Environment-Variable bzw. einen daraus abgeleiteten sicheren Hash bereitgestellt.
- Bevorzugt wird ein mit `scrypt` abgeleiteter Passwort-Hash plus Salt in Environment-Konfiguration; keine Klartext-Passwörter in Quellcode, HTML, Logs oder GitHub Actions.
- Vergleiche von Hashes mit `timingSafeEqual`; Eingabegrößen begrenzen und Login-Versuche pro IP drosseln.
- Bei erfolgreichem Login ein kryptografisch zufälliges, opakes Session-Token ausstellen. Serverseitige Session mit Ablaufzeit; Cookie `HttpOnly`, `Secure`, `SameSite=Strict`, eng begrenztem Pfad und `Cache-Control: no-store`.
- Logout widerruft Session serverseitig. Ablauf und Server-Neustart invalidieren Sessions.
- Admin-Endpunkte prüfen bei jedem Aufruf die Session serverseitig. Frontend-Status oder versteckte Buttons gelten niemals als Berechtigungsprüfung.

## Schutz der Admin-Aktionen
- Mutierende Requests nur mit erlaubter Origin und passender Session akzeptieren; keine permissiven CORS-Freigaben für Admin-Routen.
- Strikte JSON- und Größenprüfung, feste Allowlist der fünf Aktionen, Rate-Limits.
- Admin-Aktionen zunächst nur als simulierte Ereignisse/Antworten; noch keine TikTok- oder Spielsteuerung.
- Jede Aktion wird serverseitig abgelehnt, wenn der Not-Aus aktiv ist.
- Not-Aus ist serverseitiger Zustand und hat Vorrang vor allen Aktionsanforderungen. Aktivieren stoppt aktive Effekte, sperrt weitere Aktionen und bleibt nachfolgend gesperrt, bis ein authentifizierter, bewusster Re-Enable-Aufruf erfolgt.
- Bei Prozessneustart ist der sichere Standardzustand „Not-Aus aktiv“.

## Not-Aus-Semantik
1. Not-Aus aktivieren: serverseitig sperren, aktive Effekt-Timer/Tasks abbrechen und Stoppereignis ausgeben.
2. Jede Aktionsroute prüft die Sperre unmittelbar vor Ausführung.
3. Wiederfreigabe nur über authentifizierten Admin-Endpunkt; kein automatisches Entsperren durch Zeitablauf oder Browser-Refresh.
4. Verbindungsverlust oder interner Fehler darf niemals automatisch Live-Aktionen wieder aktivieren.

## Testplan vor Live-Anbindung
- Login: gültiges/ungültiges Passwort, fehlende Konfiguration, Rate-Limit, keine Passwort-/Token-Ausgabe in Logs oder Antworten.
- Session: Cookie-Flags, Ablauf, Logout, ungültige/fehlende Session.
- Request-Schutz: fremde Origin, ungültiges JSON, übergroßer Body, unbekannte Aktion, Rate-Limit.
- Not-Aus: Aktionen im gesperrten Zustand abweisen; aktive Simulation stoppen; erst nach bewusster authentifizierter Freigabe wieder zulassen.
- Regression: bestehende `/health`, `/api/connect` und TikTok-WebSocket-Funktion unverändert.
- Tests müssen ohne echte TikTok-Verbindung und ohne Live-Game-Zugriff laufen.

## Offene Konfigurationsentscheidung
Vor Implementierung muss festgelegt werden, wie der Passwort-Hash sicher erzeugt und als Render-Environment-Variable gesetzt wird. Der Nutzer soll das Secret selbst in Render eintragen; es wird niemals im Chat oder Repository benötigt. Die tatsächlichen Live-Aktionen bleiben ein separater, späterer Freigabeschritt.

## Aktueller Stand
- Isolierte HTML-Vorschau vorhanden.
- Playwright-Browser-Tests erfolgreich: https://github.com/Playfinity-Game/Playfinity-Game.github.io/actions/runs/43998075007
- Dieser Entwurf implementiert noch keine Anmeldung, keine Sessions und keine Live-Aktionen.
- `main` und Render unverändert.

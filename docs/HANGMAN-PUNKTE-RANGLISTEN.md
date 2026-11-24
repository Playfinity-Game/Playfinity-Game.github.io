# PLAYFINITY Hangman – Punkte und Ranglisten

## Regeln
- Ein richtiger Buchstabe bringt dem TikTok-Chatnutzer, der ihn zuerst nennt, **1 Punkt**.
- Ein Buchstabe zählt pro Runde nur einmal, auch wenn er mehrfach im Wort vorkommt.
- Wer das vollständige Wort zuerst richtig in den Chat schreibt, erhält **10 Punkte**.
- Wer mit dem letzten richtigen Buchstaben das Wort vervollständigt, erhält den Buchstabenpunkt und zusätzlich den 10-Punkte-Wortbonus.
- Lokale Tastatur-/Formulareingaben erhalten keine Chat-Punkte, da ihnen keine TikTok-Spieleridentität zugeordnet ist.

## Ranglisten
- **Letzte 24 Stunden:** rollierendes Zeitfenster von 24 Stunden.
- **Diese Woche:** Montag 00:00 bis zum aktuellen Zeitpunkt, nach `Europe/Berlin` (MEZ/MESZ inklusive Sommerzeit).
- Keine Hangman-Gesamtrangliste.

## Technische Umsetzung
- TikTok-LIVE-Chat wird bereits über den bestehenden PLAYFINITY-Connector in `tiktok-connector` empfangen und an `index.html` weitergeleitet.
- Die Hangman-Chatroute reicht nun die Zuschaueridentität an die Buchstaben- und Wortprüfung weiter.
- Hangman-Punkte werden getrennt von der spielübergreifenden Rangliste in `private.hangman_score_events` gespeichert.
- Die RPC-Funktion verhindert doppelte Vergabe desselben Award-Schlüssels pro Spieler und Runde.
- Die Wochenstartzeit wird in PostgreSQL mit `Europe/Berlin` berechnet; dadurch werden CET und CEST automatisch berücksichtigt.

## Datenbank
Die SQL-Definition liegt in `database/hangman-leaderboards.sql`. Sie wurde auf dem Supabase-Projekt `playfinity-stats` angewendet und die Punktevergabe, Duplikatvermeidung sowie beide Ranglisten wurden mit einem Testdatensatz geprüft. Der Testdatensatz wurde danach wieder entfernt.

## Hinweis
Die bestehende spielübergreifende PLAYFINITY-Gesamtrangliste bleibt unverändert. Die Hangman-Ranglisten sind davon getrennt.

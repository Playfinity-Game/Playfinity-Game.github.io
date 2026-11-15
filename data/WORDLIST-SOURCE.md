# WORDFINITY – aktive Wortliste

`wordfinity-nouns.json` ist die aktive, nach 38 Spielkategorien gruppierte WORDFINITY-Wortliste.

- Stand nach der Bereinigung: **4.064 Einträge und 4.064 eindeutige Wörter**.
- Jedes Wort steht genau einmal in genau einer Hauptkategorie. Mehrfachzuordnungen wurden entfernt, damit die Kategoriezuweisung im Spiel eindeutig bleibt.
- Die Datei ist ein JSON-Objekt: Kategoriebezeichnungen sind die Schlüssel, die jeweiligen Wortlisten sind Arrays.
- Änderungen am aktiven Wortbestand erfolgen kontrolliert und dürfen die gruppierte Struktur nicht in ein flaches Array umwandeln.
- Die Liste wurde zusätzlich auf eindeutig abstrakte Begriffe und weibliche Personen-/Berufsbezeichnungen gefiltert. Weibliche grammatische Formen konkreter Dinge (z. B. Gabel, Lampe, Blume) bleiben erhalten. Die Bereinigung ist eine redaktionelle Filterrunde, keine zertifizierte Wörterbuch- oder vollständige Einzelprüfung jedes deutschen Lemmas.

Vor jedem Commit müssen JSON-Syntax, 38 Kategorien, eindeutige Wörter und die erwartete Objektstruktur geprüft werden.

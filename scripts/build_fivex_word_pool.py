#!/usr/bin/env python3
"""Build a conservative, family-friendly FiveX pool from the CC0 spielwoerter list."""

import json
import re
import urllib.request
from pathlib import Path

SOURCE_URL = "https://raw.githubusercontent.com/marekventur/spielwoerter/main/wordlist_accepted.jsonl"
OUTPUT = Path("data/fivex-words.json")
WORD_RE = re.compile(r"^[a-zäöüß]{5}$")

# Explicitly exclude slurs, vulgar insults and sexual vulgarities.
# This is a conservative safety filter, not a claim that every possible
# offensive or unsuitable word in the source can be detected automatically.
BLOCKLIST = {
    "fotze", "neger", "nutte", "hure", "arsch", "wichs", "ficke",
    "fickst", "ficken", "ficker", "scheiß", "scheis", "idiot",
    "depp", "dödel", "mistker", "schwul", "mongo", "spast",
}

# Reject entries whose dictionary description clearly identifies a proper
# name, place, country, nationality, abbreviation or vulgar/derogatory term.
UNSUITABLE_DESCRIPTION = re.compile(
    r"\b(eigenname|vorname|nachname|familienname|personenname|"
    r"stadtname|ortsname|ländername|landesname|staat|hauptstadt|"
    r"abkürzung|kurzform|vulgär|vulgärsprachlich|derb|beleidigung|"
    r"schimpfwort|abwertend|herabwürdigend|pejorativ|"
    r"nationalität|bewohner von|einwohner von)\b",
    re.IGNORECASE,
)


def rank(entry):
    source_rank = 0 if entry.get("source") == "curated" else 1
    pass_rank = {"double-pass-agree": 0, "tiebreaker": 1}.get(
        entry.get("classification_pass"), 2
    )
    return (
        source_rank,
        pass_rank,
        -int(entry.get("dict_source_count") or 0),
        -len(entry.get("corpus_sources") or []),
        entry["word"],
    )


def main():
    request = urllib.request.Request(
        SOURCE_URL, headers={"User-Agent": "PLAYFINITY-FiveX-wordlist-builder"}
    )
    with urllib.request.urlopen(request, timeout=120) as response:
        raw = response.read().decode("utf-8")

    best_by_word = {}
    rejected = 0
    for line in raw.splitlines():
        try:
            entry = json.loads(line)
        except json.JSONDecodeError:
            continue

        word = entry.get("word", "")
        description = entry.get("description") or ""

        if not isinstance(word, str) or not WORD_RE.fullmatch(word):
            continue
        # Keep lemmas only: exclude generated and other inflected forms.
        if entry.get("base") is not None or entry.get("source") == "morphology":
            rejected += 1
            continue
        if entry.get("source") not in {"llm", "curated"}:
            rejected += 1
            continue
        if not description or UNSUITABLE_DESCRIPTION.search(description):
            rejected += 1
            continue
        if word in BLOCKLIST:
            rejected += 1
            continue

        previous = best_by_word.get(word)
        if previous is None or rank(entry) < rank(previous):
            best_by_word[word] = entry

    candidates = sorted(best_by_word.values(), key=rank)
    words = [entry["word"].upper() for entry in candidates]

    if len(set(words)) != len(words) or any(len(word) != 5 for word in words):
        raise SystemExit("Interne Prüfung fehlgeschlagen: Duplikate oder falsche Länge.")
    if any(word.lower() in BLOCKLIST for word in words):
        raise SystemExit("Interne Prüfung fehlgeschlagen: Sperrliste verletzt.")

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(
        json.dumps(words, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Ausgeschlossene Einträge durch Qualitätsfilter: {rejected}")
    print(f"Übernommene, eindeutige Wörter: {len(words)}")
    print(f"Datei erstellt: {OUTPUT}")


if __name__ == "__main__":
    main()

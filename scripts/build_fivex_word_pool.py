#!/usr/bin/env python3
"""Build FiveX's 5-letter German word pool from the CC0 spielwoerter list."""

import json
import re
import urllib.request
from pathlib import Path

SOURCE_URL = "https://raw.githubusercontent.com/marekventur/spielwoerter/main/wordlist_accepted.jsonl"
OUTPUT = Path("data/fivex-words.json")
WORD_RE = re.compile(r"^[a-zäöüß]{5}$")


def rank(entry):
    # Prefer directly classified words, strong independent agreement,
    # and entries attested by multiple dictionary/corpus sources.
    source_rank = 0 if entry.get("source") == "llm" else 1
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
    for line in raw.splitlines():
        try:
            entry = json.loads(line)
        except json.JSONDecodeError:
            continue
        word = entry.get("word", "")
        if not isinstance(word, str) or not WORD_RE.fullmatch(word):
            continue
        if entry.get("source") == "llm" and not entry.get("description"):
            continue
        previous = best_by_word.get(word)
        if previous is None or rank(entry) < rank(previous):
            best_by_word[word] = entry

    candidates = sorted(best_by_word.values(), key=rank)
    words = [entry["word"].upper() for entry in candidates]
    if len(set(words)) != len(words) or any(len(word) != 5 for word in words):
        raise SystemExit("Interne Prüfung fehlgeschlagen: Duplikate oder falsche Länge.")

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(
        json.dumps(words, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Quellkandidaten mit genau 5 Buchstaben: {len(candidates)}")
    print(f"Übernommene, eindeutige Wörter: {len(words)}")
    print(f"Datei erstellt: {OUTPUT}")


if __name__ == "__main__":
    main()

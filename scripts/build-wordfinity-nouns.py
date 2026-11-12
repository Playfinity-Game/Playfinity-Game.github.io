#!/usr/bin/env python3
"""Build Playfinity's compact WORDFINITY noun allow-list from german-nouns CSV."""
import ast
import csv
import json
import re
import sys
import unicodedata
from pathlib import Path

SOURCE = Path("nouns.csv")
OUTPUT = Path("data/wordfinity-nouns.json")

def parse_pos(value):
    value = (value or "").strip()
    try:
        parsed = ast.literal_eval(value)
        if isinstance(parsed, (list, tuple, set)):
            return [str(item).casefold() for item in parsed]
        return [str(parsed).casefold()]
    except (ValueError, SyntaxError):
        return [part.strip().casefold() for part in re.split(r"[,;|]", value)]

def main():
    if not SOURCE.is_file():
        raise SystemExit("nouns.csv fehlt")
    words = set()
    with SOURCE.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if not reader.fieldnames or "lemma" not in reader.fieldnames or "pos" not in reader.fieldnames:
            raise SystemExit(f"Unerwartete CSV-Spalten: {reader.fieldnames}")
        for row in reader:
            if not any("substantiv" in tag or tag == "noun" for tag in parse_pos(row.get("pos"))):
                continue
            lemma = unicodedata.normalize("NFC", (row.get("lemma") or "").strip())
            if not lemma or len(lemma) < 2:
                continue
            if not all(ch.isalpha() or ch in "-‐‑" for ch in lemma):
                continue
            words.add(lemma)
    if len(words) < 1000:
        raise SystemExit(f"Nur {len(words)} Nomen gefunden – Abbruch statt unvollständige Liste zu veröffentlichen")
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(sorted(words, key=str.casefold), ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"{len(words)} eindeutige Nomen geschrieben nach {OUTPUT}")

if __name__ == "__main__":
    main()

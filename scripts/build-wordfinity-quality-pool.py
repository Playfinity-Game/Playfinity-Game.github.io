#!/usr/bin/env python3
"""Build a separate, frequency-filtered WORDFINITY candidate pool from Leipzig data."""
from __future__ import annotations

import argparse
import io
import json
import re
import tarfile
import unicodedata
from collections import defaultdict
from pathlib import Path

CORPUS_ID = "deu_news_2023_1M"
MAX_NOUNS = 15_000
MAX_VERBS = 5_000
MIN_FREQUENCY = 2
WORD_RE = re.compile(r"^[A-Za-zÄÖÜäöüß]+$")
DEFAULT_EXCLUSIONS = Path("data/wordfinity-excluded-words.txt")


def normalize_word(value: str) -> str:
    return unicodedata.normalize("NFC", value.strip())


def load_exclusions(path: Path) -> set[str]:
    if not path.exists():
        return set()
    return {
        normalize_word(line).casefold()
        for line in path.read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.lstrip().startswith("#")
    }


def build_word_lists(lines, excluded_words=None, noun_limit=MAX_NOUNS, verb_limit=MAX_VERBS):
    """Aggregate corpus frequencies by lemma and keep only common NOUN/VERB entries."""
    excluded = {word.casefold() for word in (excluded_words or set())}
    totals = {"NOUN": defaultdict(int), "VERB": defaultdict(int)}

    for raw_line in lines:
        fields = raw_line.rstrip("\r\n").split("\t")
        if len(fields) < 6:
            continue

        # Leipzig format: ID, word form, POS, UD17 POS, base form, frequency.
        _, _surface, _pos, ud_pos, base_form, raw_frequency = fields[:6]
        if ud_pos not in totals:
            continue

        lemma = normalize_word(base_form)
        if len(lemma) < 3 or not WORD_RE.fullmatch(lemma):
            continue
        if lemma.casefold() in excluded:
            continue

        try:
            frequency = int(raw_frequency)
        except ValueError:
            continue
        if frequency < MIN_FREQUENCY:
            continue

        if ud_pos == "NOUN":
            # German common nouns are capitalized; PROPN is excluded above.
            if not lemma[0].isupper() or lemma.isupper() or len(lemma) > 24:
                continue
        else:
            lemma = lemma.lower()
            # Keep infinitive lemmas, not conjugated surface forms.
            if not lemma.endswith(("en", "n")) or len(lemma) > 22:
                continue

        totals[ud_pos][lemma] += frequency

    nouns = sorted(
        ((word, count) for word, count in totals["NOUN"].items() if count >= MIN_FREQUENCY),
        key=lambda item: (-item[1], item[0].casefold()),
    )[:noun_limit]
    verbs = sorted(
        ((word, count) for word, count in totals["VERB"].items() if count >= MIN_FREQUENCY),
        key=lambda item: (-item[1], item[0].casefold()),
    )[:verb_limit]

    return [word for word, _ in nouns], [word for word, _ in verbs]


def read_leipzig_archive(archive_path: Path):
    with tarfile.open(archive_path, "r:gz") as archive:
        members = [
            member for member in archive.getmembers()
            if member.isfile() and member.name.endswith("_words_pos_base.txt")
        ]
        if not members:
            raise SystemExit(
                "Im Leipzig-Archiv fehlt *_words_pos_base.txt. "
                "Bitte ein Korpus mit POS-Tags und Grundformen verwenden."
            )
        # Prefer the expected corpus member if the archive contains more than one.
        member = next(
            (item for item in members if Path(item.name).name.startswith(CORPUS_ID)),
            members[0],
        )
        extracted = archive.extractfile(member)
        if extracted is None:
            raise SystemExit("Die Leipzig-Wortdatei konnte nicht gelesen werden.")
        with io.TextIOWrapper(extracted, encoding="utf-8") as handle:
            return build_word_lists(handle, load_exclusions(DEFAULT_EXCLUSIONS))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("archive", type=Path, help="Leipzig *.tar.gz corpus archive")
    parser.add_argument(
        "--output", type=Path,
        default=Path("data/wordfinity-quality-candidates.json"),
    )
    args = parser.parse_args()

    nouns, verbs = read_leipzig_archive(args.archive)
    if len(nouns) < 1_000 or len(verbs) < 500:
        raise SystemExit(
            f"Zu wenige Kandidaten gefunden (Nomen: {len(nouns)}, Verben: {len(verbs)}). "
            "Die aktive Wortliste bleibt unverändert."
        )

    payload = {
        "version": 1,
        "source": {
            "name": "Leipzig Corpora Collection",
            "corpus": CORPUS_ID,
            "attribution": "Leipzig Corpora Collection, Universität Leipzig",
            "license": "CC BY 4.0",
        },
        "selection": {
            "noun_limit": MAX_NOUNS,
            "verb_limit": MAX_VERBS,
            "minimum_frequency": MIN_FREQUENCY,
            "exclusions_file": str(DEFAULT_EXCLUSIONS),
        },
        "counts": {"nouns": len(nouns), "verbs": len(verbs), "total": len(nouns) + len(verbs)},
        "nouns": nouns,
        "verbs": verbs,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )
    print(
        f"{len(nouns)} Nomen und {len(verbs)} Verben "
        f"({len(nouns) + len(verbs)} insgesamt) geschrieben: {args.output}"
    )


if __name__ == "__main__":
    main()

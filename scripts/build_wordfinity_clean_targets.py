#!/usr/bin/env python3
"""Build a separate, auditable Wordfinity target list. Never edits the active dictionary."""
from __future__ import annotations

import argparse
import io
import json
import re
import tarfile
import unicodedata
from collections import defaultdict
from pathlib import Path

WORD_RE = re.compile(r"^[A-Za-zÄÖÜäöüß]{4,11}$")
DEFAULT_BASE = Path("data/wordfinity-nouns.json")
DEFAULT_THESAURUS = Path("openthesaurus.txt")
DEFAULT_OUTPUT = Path("data/wordfinity-zielwoerter.json")
DEFAULT_EXCLUDED = Path("data/wordfinity-ausgeschlossen.json")
DEFAULT_REPORT = Path("data/wordfinity-pruefbericht.json")
DEFAULT_CORPUS = "deu_news_2023_1M"


def norm(value: str) -> str:
    return unicodedata.normalize("NFC", value.strip())


def key(value: str) -> str:
    return norm(value).casefold()


def load_base(path: Path) -> dict[str, str]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, list) or not data:
        raise SystemExit(f"Ungültige Ausgangsliste: {path} (erwartet JSON-Array)")
    words: dict[str, str] = {}
    for item in data:
        if not isinstance(item, str):
            continue
        word = norm(item)
        if word:
            words.setdefault(key(word), word)
    if len(words) < 10_000:
        raise SystemExit(f"Unerwartet kleine Ausgangsliste ({len(words)}); Abbruch.")
    return words


def load_thesaurus(path: Path) -> set[str]:
    terms: set[str] = set()
    if not path.exists():
        return terms
    with path.open(encoding="utf-8") as handle:
        for line in handle:
            if line.startswith("#"):
                continue
            for item in line.rstrip("\r\n").split(";"):
                # Parenthetical notes are metadata, not part of the term.
                term = re.sub(r"\([^()]*\)", "", item).strip()
                if term and " " not in term and "-" not in term:
                    terms.add(key(term))
    return terms


def read_pos_corpus(archive_path: Path, corpus_id: str) -> tuple[dict[str, int], dict[str, int]]:
    """Return NOUN and PROPN lemma frequencies from Leipzig *_words_pos_base.txt."""
    noun_freq: dict[str, int] = defaultdict(int)
    propn_freq: dict[str, int] = defaultdict(int)
    with tarfile.open(archive_path, "r:gz") as archive:
        members = [m for m in archive.getmembers() if m.isfile() and
                   m.name.endswith(("_words_pos_base.txt", "-words-pos-base.txt"))]
        if not members:
            raise SystemExit("Im Leipzig-Archiv fehlt die POS-/Grundform-Wortdatei.")
        member = next((m for m in members if Path(m.name).name.startswith(corpus_id)), members[0])
        stream = archive.extractfile(member)
        if stream is None:
            raise SystemExit("Leipzig-POS-Datei konnte nicht gelesen werden.")
        with io.TextIOWrapper(stream, encoding="utf-8") as handle:
            for line in handle:
                fields = line.rstrip("\r\n").split("\t")
                if len(fields) < 5:
                    continue
                # Leipzig POS/base files exist in two schemas. Prefer UD-POS
                # when present; otherwise accept the legacy POS column.
                if len(fields) >= 6 and fields[-3] in {"NOUN", "PROPN"}:
                    pos, lemma, raw_freq = fields[-3], norm(fields[-2]), fields[-1]
                else:
                    legacy_pos = fields[2].upper()
                    pos = "NOUN" if legacy_pos in {"N", "NN", "NOUN", "SUBSTANTIV"} else (
                        "PROPN" if legacy_pos in {"NE", "PROPN", "PROPER_NOUN"} else ""
                    )
                    lemma, raw_freq = norm(fields[-2]), fields[-1]
                if not lemma:
                    continue
                try:
                    freq = int(raw_freq)
                except ValueError:
                    continue
                target = noun_freq if pos == "NOUN" else propn_freq if pos == "PROPN" else None
                if target is not None:
                    target[key(lemma)] += freq
    if not noun_freq:
        raise SystemExit("Keine NOUN-Lemmata erkannt; Dateiformat prüfen. Keine Ausgabedateien geschrieben.")
    return noun_freq, propn_freq


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("leipzig_archive", type=Path)
    parser.add_argument("--base", type=Path, default=DEFAULT_BASE)
    parser.add_argument("--thesaurus", type=Path, default=DEFAULT_THESAURUS)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--excluded", type=Path, default=DEFAULT_EXCLUDED)
    parser.add_argument("--report", type=Path, default=DEFAULT_REPORT)
    parser.add_argument("--corpus", default=DEFAULT_CORPUS)
    parser.add_argument("--min-frequency", type=int, default=5)
    args = parser.parse_args()

    base = load_base(args.base)
    thesaurus = load_thesaurus(args.thesaurus)
    nouns, propns = read_pos_corpus(args.leipzig_archive, args.corpus)

    accepted: list[tuple[str, int, bool]] = []
    excluded: list[dict[str, str | int]] = []
    for folded, original in base.items():
        if not WORD_RE.fullmatch(original):
            excluded.append({"word": original, "reason": "nicht 4–11 Buchstaben oder kein alphabetisches Einzelwort"})
            continue
        if folded in propns and folded not in nouns:
            excluded.append({"word": original, "reason": "im Leipzig-Korpus als Eigenname (PROPN) erkannt"})
            continue
        frequency = nouns.get(folded, 0)
        if frequency < args.min_frequency:
            reason = "kein NOUN-Lemma im Leipzig-Korpus" if frequency == 0 else "zu geringe Korpusfrequenz"
            excluded.append({"word": original, "reason": reason})
            continue
        accepted.append((original, frequency, folded in thesaurus))

    accepted.sort(key=lambda item: (-item[1], key(item[0])))
    output = {
        "version": 1,
        "source": {
            "base": str(args.base),
            "pos_corpus": "Leipzig Corpora Collection",
            "corpus": args.corpus,
            "thesaurus": str(args.thesaurus) if args.thesaurus.exists() else None,
        },
        "policy": {
            "part_of_speech": "NOUN only; PROPN excluded unless independently tagged NOUN",
            "lemma": "corpus base form",
            "length": "4–11 alphabetic characters",
            "minimum_corpus_frequency": args.min_frequency,
            "openthesaurus": "supporting evidence only; not a hard gate",
            "sort": "descending Leipzig lemma frequency",
        },
        "count": len(accepted),
        "words": [word for word, _, _ in accepted],
    }
    excluded_payload = sorted(excluded, key=lambda item: key(str(item["word"])))
    report = {
        "base_unique": len(base),
        "leipzig_noun_lemmas": len(nouns),
        "leipzig_proper_name_lemmas": len(propns),
        "accepted": len(accepted),
        "excluded": len(excluded_payload),
        "openthesaurus_matches": sum(1 for _, _, match in accepted if match),
        "minimum_frequency": args.min_frequency,
        "manual_review_required": [
            "NOUN/PROPN-Mehrdeutigkeiten können ohne Kontext nicht vollständig aufgelöst werden.",
            "OpenThesaurus-Abdeckung ist unvollständig und entscheidet nicht allein über Aufnahme.",
            "Häufigkeit ist ein Maß für Korpusbelege, keine Garantie für kindgerechte oder allgemein bekannte Wörter."
        ],
    }
    # Write only after every input has been validated and parsed successfully.
    for path, payload in (
        (args.output, output),
        (args.excluded, excluded_payload),
        (args.report, report),
    ):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Prüfung abgeschlossen: {len(accepted)} zugelassen, {len(excluded_payload)} ausgeschlossen.")


if __name__ == "__main__":
    main()

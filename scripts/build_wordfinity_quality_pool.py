#!/usr/bin/env python3
"""Build a separate, strict noun-only WORDFINITY candidate pool."""
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
MIN_FREQUENCY = 5
WORD_RE = re.compile(r"^[A-Za-zÄÖÜäöüß]+$")
DEFAULT_EXCLUSIONS = Path("data/wordfinity-excluded-words.txt")

# Only unambiguous orthographic updates. Meaning-distinguishing forms
# such as "Masse" and "Maße" are deliberately never merged.
SPELLING_FIXES = {
    "Strasse": "Straße", "Massnahme": "Maßnahme", "Fuss": "Fuß",
    "Prozeß": "Prozess", "Abschluß": "Abschluss", "Fussball": "Fußball",
    "Anlaß": "Anlass", "Einfluß": "Einfluss", "Grossteil": "Großteil",
    "Schloß": "Schloss", "Schuß": "Schuss", "Aussenminister": "Außenminister",
    "Ausmass": "Ausmaß", "Schliessung": "Schließung", "Haß": "Hass",
    "Paß": "Pass", "Fluß": "Fluss", "Kompromiß": "Kompromiss",
    "Beschluß": "Beschluss", "Zuschuß": "Zuschuss", "Kongreß": "Kongress",
    "Erdgeschoß": "Erdgeschoss", "Riß": "Riss", "Ausschuß": "Ausschuss",
    "Grossbank": "Großbank", "Untersuchungsausschuß": "Untersuchungsausschuss",
    "Boß": "Boss", "Engpaß": "Engpass", "Überschuß": "Überschuss",
    "Beschuß": "Beschuss",
}


def normalize_word(value: str) -> str:
    return unicodedata.normalize("NFC", value.strip())


def merge_spelling_variants(totals):
    merged = defaultdict(int)
    for word, frequency in totals.items():
        merged[SPELLING_FIXES.get(word, word)] += frequency
    return merged


def load_exclusions(path: Path) -> set[str]:
    if not path.exists():
        return set()
    return {
        normalize_word(line).casefold()
        for line in path.read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.lstrip().startswith("#")
    }


def valid_noun(lemma: str) -> bool:
    return (
        len(lemma) >= 3
        and len(lemma) <= 24
        and WORD_RE.fullmatch(lemma) is not None
        and lemma[0].isupper()
        and not lemma.isupper()
    )


def build_word_lists(lines, excluded_words=None, noun_limit=MAX_NOUNS):
    """Return frequent, alphabetic common-noun lemmas only; never verbs."""
    excluded = {normalize_word(word).casefold() for word in (excluded_words or set())}
    totals = defaultdict(int)

    for raw_line in lines:
        fields = raw_line.rstrip("\r\n").split("\t")
        if len(fields) < 5:
            continue

        _, _surface, pos, *tail = fields
        if len(tail) == 3:
            ud_pos, base_form, raw_frequency = tail
            if ud_pos != "NOUN":
                continue
        else:
            base_form, raw_frequency = tail
            if pos.upper() not in {"N", "NN", "NOUN", "SUBSTANTIV"}:
                continue

        lemma = normalize_word(base_form)
        if not valid_noun(lemma) or lemma.casefold() in excluded:
            continue
        try:
            frequency = int(raw_frequency)
        except ValueError:
            continue
        if frequency < MIN_FREQUENCY:
            continue
        totals[lemma] += frequency

    totals = merge_spelling_variants(totals)
    nouns = sorted(
        ((word, count) for word, count in totals.items() if count >= MIN_FREQUENCY),
        key=lambda item: (-item[1], item[0].casefold()),
    )[:noun_limit]
    return [word for word, _ in nouns]


def build_nouns_from_sentences(lines, nlp, excluded_words=None):
    """Use contextual German POS tagging and retain NOUN tokens only."""
    excluded = {normalize_word(word).casefold() for word in (excluded_words or set())}
    totals = defaultdict(int)

    def sentence_texts():
        for raw_line in lines:
            fields = raw_line.rstrip("\r\n").split("\t", 1)
            if len(fields) == 2 and fields[1].strip():
                yield fields[1].strip()

    for doc in nlp.pipe(sentence_texts(), batch_size=500):
        for token in doc:
            if token.pos_ != "NOUN" or token.is_punct or token.is_space:
                continue
            lemma = normalize_word(token.lemma_)
            if not lemma:
                continue
            lemma = lemma[0].upper() + lemma[1:]
            if not valid_noun(lemma) or lemma.casefold() in excluded:
                continue
            totals[lemma] += 1

    totals = merge_spelling_variants(totals)
    nouns = sorted(
        ((word, count) for word, count in totals.items() if count >= MIN_FREQUENCY),
        key=lambda item: (-item[1], item[0].casefold()),
    )[:MAX_NOUNS]
    return [word for word, _ in nouns]


def read_leipzig_archive(archive_path: Path):
    with tarfile.open(archive_path, "r:gz") as archive:
        members = [member for member in archive.getmembers() if member.isfile()]
        pos_members = [m for m in members if m.name.endswith(("_words_pos_base.txt", "-words-pos-base.txt"))]
        if pos_members:
            member = next((m for m in pos_members if Path(m.name).name.startswith(CORPUS_ID)), pos_members[0])
            extracted = archive.extractfile(member)
            if extracted is None:
                raise SystemExit("Die Leipzig-Wortdatei konnte nicht gelesen werden.")
            with io.TextIOWrapper(extracted, encoding="utf-8") as handle:
                return build_word_lists(handle, load_exclusions(DEFAULT_EXCLUSIONS))

        sentence_members = [m for m in members if m.name.endswith(("_sentences.txt", "-sentences.txt"))]
        if not sentence_members:
            raise SystemExit("Im Leipzig-Archiv fehlt sowohl *_words_pos_base.txt als auch *_sentences.txt.")
        member = next((m for m in sentence_members if Path(m.name).name.startswith(CORPUS_ID)), sentence_members[0])
        extracted = archive.extractfile(member)
        if extracted is None:
            raise SystemExit("Die Leipzig-Satzdatei konnte nicht gelesen werden.")
        try:
            import spacy
        except ImportError as exc:
            raise SystemExit("spaCy fehlt. Bitte den deutschen Sprachbaustein im Workflow installieren.") from exc
        nlp = spacy.load("de_core_news_sm", disable=["ner"])
        with io.TextIOWrapper(extracted, encoding="utf-8") as handle:
            return build_nouns_from_sentences(handle, nlp, load_exclusions(DEFAULT_EXCLUSIONS))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("archive", type=Path, help="Leipzig *.tar.gz corpus archive")
    parser.add_argument("--output", type=Path, default=Path("data/wordfinity-quality-candidates.json"))
    args = parser.parse_args()

    nouns = read_leipzig_archive(args.archive)
    if len(nouns) < 1_000:
        raise SystemExit(f"Zu wenige strenge Nomen-Kandidaten gefunden ({len(nouns)}). Die aktive Wortliste bleibt unverändert.")

    payload = {
        "version": 2,
        "source": {
            "name": "Leipzig Corpora Collection",
            "corpus": CORPUS_ID,
            "attribution": "Leipzig Corpora Collection, Universität Leipzig",
            "license": "CC BY 4.0",
        },
        "selection": {
            "noun_limit": MAX_NOUNS,
            "minimum_frequency": MIN_FREQUENCY,
            "exclusions_file": str(DEFAULT_EXCLUSIONS),
            "policy": "strict-common-nouns-only",
        },
        "counts": {"nouns": len(nouns)},
        "nouns": nouns,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"{len(nouns)} strenge Nomen-Kandidaten geschrieben: {args.output}")


if __name__ == "__main__":
    main()

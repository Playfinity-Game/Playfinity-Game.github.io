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



# Alte Schreibweisen werden auf die heutige deutsche Rechtschreibung vereinheitlicht.
# Bedeutungsverschiedene Wörter wie „Masse“ und „Maße“ bleiben ausdrücklich getrennt.
SPELLING_FIXES = {
    "Strasse": "Straße", "Massnahme": "Maßnahme", "Fuss": "Fuß",
    "Prozeß": "Prozess", "Abschluß": "Abschluss", "Fussball": "Fußball",
    "Anlaß": "Anlass", "Einfluß": "Einfluss", "Grossteil": "Großteil",
    "Schloß": "Schloss", "Schuß": "Schuss", "Aussenminister": "Außenminister",
    "Ausmass": "Ausmaß", "Mass": "Maß", "Schliessung": "Schließung",
    "Haß": "Hass", "Paß": "Pass", "Fluß": "Fluss",
    "Kompromiß": "Kompromiss", "Beschluß": "Beschluss",
    "Zuschuß": "Zuschuss", "Kongreß": "Kongress", "Erdgeschoß": "Erdgeschoss",
    "Riß": "Riss", "Ausschuß": "Ausschuss", "Grossbank": "Großbank",
    "Untersuchungsausschuß": "Untersuchungsausschuss", "Boß": "Boss",
    "Engpaß": "Engpass", "Überschuß": "Überschuss", "Beschuß": "Beschuss",
    "heissen": "heißen", "schliessen": "schließen", "äussern": "äußern",
    "abschliessen": "abschließen", "stossen": "stoßen", "geniessen": "genießen",
    "ausschliessen": "ausschließen", "begrüssen": "begrüßen",
    "schiessen": "schießen", "fliessen": "fließen", "reissen": "reißen",
    "vergrössern": "vergrößern", "büssen": "büßen", "versüssen": "versüßen",
}


def merge_spelling_variants(totals):
    """Combine known old/new spellings before applying the word-count limits."""
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


def build_word_lists(lines, excluded_words=None, noun_limit=MAX_NOUNS, verb_limit=MAX_VERBS):
    """Aggregate corpus frequencies by lemma and keep only common NOUN/VERB entries."""
    excluded = {word.casefold() for word in (excluded_words or set())}
    totals = {"NOUN": defaultdict(int), "VERB": defaultdict(int)}

    for raw_line in lines:
        fields = raw_line.rstrip("\r\n").split("\t")
        if len(fields) < 5:
            continue

        # Leipzig format may include UD17 POS or only the corpus-specific POS:
        # ID, word form, POS, [UD17 POS,] base form, frequency.
        _, _surface, pos, *tail = fields
        if len(tail) == 3:
            ud_pos, base_form, raw_frequency = tail
        else:
            ud_pos = ""
            base_form, raw_frequency = tail

        if ud_pos in totals:
            word_class = ud_pos
        else:
            tag = pos.upper()
            if tag in {"N", "NN", "NOUN", "SUBSTANTIV"}:
                word_class = "NOUN"
            elif tag in {"V", "VERB"} or tag.startswith(("VV", "VA", "VM")):
                word_class = "VERB"
            else:
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

        if word_class == "NOUN":
            # German common nouns are capitalized; PROPN is excluded above.
            if not lemma[0].isupper() or lemma.isupper() or len(lemma) > 24:
                continue
        else:
            lemma = lemma.lower()
            # Keep infinitive lemmas, not conjugated surface forms.
            if not lemma.endswith(("en", "n")) or len(lemma) > 22:
                continue

        totals[word_class][lemma] += frequency

    totals["NOUN"] = merge_spelling_variants(totals["NOUN"])
    totals["VERB"] = merge_spelling_variants(totals["VERB"])

    nouns = sorted(
        ((word, count) for word, count in totals["NOUN"].items() if count >= MIN_FREQUENCY),
        key=lambda item: (-item[1], item[0].casefold()),
    )[:noun_limit]
    verbs = sorted(
        ((word, count) for word, count in totals["VERB"].items() if count >= MIN_FREQUENCY),
        key=lambda item: (-item[1], item[0].casefold()),
    )[:verb_limit]

    return [word for word, _ in nouns], [word for word, _ in verbs]


def build_word_lists_from_sentences(lines, nlp, excluded_words=None):
    """Use contextual German POS tagging when the corpus has no POS word list."""
    excluded = {word.casefold() for word in (excluded_words or set())}
    totals = {"NOUN": defaultdict(int), "VERB": defaultdict(int)}

    def sentence_texts():
        for raw_line in lines:
            fields = raw_line.rstrip("\r\n").split("\t", 1)
            if len(fields) == 2 and fields[1].strip():
                yield fields[1].strip()

    for doc in nlp.pipe(sentence_texts(), batch_size=500):
        for token in doc:
            if token.pos_ not in totals or token.is_punct or token.is_space:
                continue
            lemma = normalize_word(token.lemma_)
            if len(lemma) < 3 or not WORD_RE.fullmatch(lemma):
                continue
            if lemma.casefold() in excluded:
                continue
            if token.pos_ == "NOUN":
                lemma = lemma[0].upper() + lemma[1:]
                if lemma.isupper() or len(lemma) > 24:
                    continue
            else:
                lemma = lemma.lower()
                if not lemma.endswith(("en", "n")) or len(lemma) > 22:
                    continue
            totals[token.pos_][lemma] += 1

    totals["NOUN"] = merge_spelling_variants(totals["NOUN"])
    totals["VERB"] = merge_spelling_variants(totals["VERB"])

    nouns = sorted(
        ((word, count) for word, count in totals["NOUN"].items() if count >= MIN_FREQUENCY),
        key=lambda item: (-item[1], item[0].casefold()),
    )[:MAX_NOUNS]
    verbs = sorted(
        ((word, count) for word, count in totals["VERB"].items() if count >= MIN_FREQUENCY),
        key=lambda item: (-item[1], item[0].casefold()),
    )[:MAX_VERBS]
    return [word for word, _ in nouns], [word for word, _ in verbs]


def read_leipzig_archive(archive_path: Path):
    with tarfile.open(archive_path, "r:gz") as archive:
        members = [member for member in archive.getmembers() if member.isfile()]
        # POS/baseform files are preferred where the corpus provides them.
        pos_members = [m for m in members if m.name.endswith(("_words_pos_base.txt", "-words-pos-base.txt"))]
        if pos_members:
            member = next(
                (item for item in pos_members if Path(item.name).name.startswith(CORPUS_ID)),
                pos_members[0],
            )
            extracted = archive.extractfile(member)
            if extracted is None:
                raise SystemExit("Die Leipzig-Wortdatei konnte nicht gelesen werden.")
            with io.TextIOWrapper(extracted, encoding="utf-8") as handle:
                return build_word_lists(handle, load_exclusions(DEFAULT_EXCLUSIONS))

        # The current 2023 news archive provides sentences but no POS word list. Leipzig filenames use hyphens; older variants may use underscores.
        sentence_members = [m for m in members if m.name.endswith(("_sentences.txt", "-sentences.txt"))]
        if not sentence_members:
            raise SystemExit("Im Leipzig-Archiv fehlt sowohl *_words_pos_base.txt als auch *_sentences.txt.")
        member = next(
            (item for item in sentence_members if Path(item.name).name.startswith(CORPUS_ID)),
            sentence_members[0],
        )
        extracted = archive.extractfile(member)
        if extracted is None:
            raise SystemExit("Die Leipzig-Satzdatei konnte nicht gelesen werden.")
        try:
            import spacy
        except ImportError as exc:
            raise SystemExit("spaCy fehlt. Bitte den deutschen Sprachbaustein im Workflow installieren.") from exc
        nlp = spacy.load("de_core_news_sm", disable=["ner"])
        with io.TextIOWrapper(extracted, encoding="utf-8") as handle:
            return build_word_lists_from_sentences(handle, nlp, load_exclusions(DEFAULT_EXCLUSIONS))


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

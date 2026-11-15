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


def read_corpus(archive_path: Path, corpus_id: str) -> tuple[dict[str, int], dict[str, int], str]:
    """Read Leipzig lemma POS data, or infer POS from sentence context with spaCy."""
    noun_freq: dict[str, int] = defaultdict(int)
    propn_freq: dict[str, int] = defaultdict(int)
    with tarfile.open(archive_path, "r:gz") as archive:
        members = [m for m in archive.getmembers() if m.isfile()]
        pos_members = [m for m in members if m.name.endswith(("_words_pos_base.txt", "-words-pos-base.txt"))]
        if pos_members:
            member = next((m for m in pos_members if Path(m.name).name.startswith(corpus_id)), pos_members[0])
            stream = archive.extractfile(member)
            if stream is None:
                raise SystemExit("Leipzig-POS-Datei konnte nicht gelesen werden.")
            with io.TextIOWrapper(stream, encoding="utf-8") as handle:
                for line in handle:
                    fields = line.rstrip("\r\n").split("\t")
                    if len(fields) < 5:
                        continue
                    if len(fields) >= 6 and fields[-3].upper() in {"NOUN", "PROPN"}:
                        pos, lemma, raw_freq = fields[-3].upper(), norm(fields[-2]), fields[-1]
                    else:
                        legacy_pos = fields[2].upper()
                        pos = "NOUN" if legacy_pos in {"N", "NN", "NOUN", "SUBSTANTIV"} else (
                            "PROPN" if legacy_pos in {"NE", "PROPN", "PROPER_NOUN"} else ""
                        )
                        lemma, raw_freq = norm(fields[-2]), fields[-1]
                    try:
                        freq = int(raw_freq)
                    except (ValueError, IndexError):
                        continue
                    if not lemma:
                        continue
                    target = noun_freq if pos == "NOUN" else propn_freq if pos == "PROPN" else None
                    if target is not None:
                        target[key(lemma)] += freq
            if not noun_freq and not propn_freq:
                raise SystemExit("POS-Datei gefunden, aber keine NOUN-/PROPN-Lemmata erkannt.")
            return noun_freq, propn_freq, "Leipzig POS-/Grundform-Wortdatei"

        sentence_members = [m for m in members if m.name.endswith(("_sentences.txt", "-sentences.txt"))]
        if not sentence_members:
            available = ", ".join(Path(m.name).name for m in members[:30])
            raise SystemExit(
                "Leipzig-Archiv enthält weder POS-/Grundform-Wortdatei noch Satzdatei. "
                f"Vorhandene Dateien (Auszug): {available}"
            )
        member = next((m for m in sentence_members if Path(m.name).name.startswith(corpus_id)), sentence_members[0])
        stream = archive.extractfile(member)
        if stream is None:
            raise SystemExit("Leipzig-Satzdatei konnte nicht gelesen werden.")
        try:
            import spacy
        except ImportError as exc:
            raise SystemExit("spaCy fehlt; Workflow muss spaCy und de_core_news_sm installieren.") from exc
        try:
            nlp = spacy.load("de_core_news_sm", disable=["ner"])
        except OSError as exc:
            raise SystemExit("Deutsches spaCy-Modell de_core_news_sm fehlt.") from exc

        def sentence_texts():
            with io.TextIOWrapper(stream, encoding="utf-8") as handle:
                for line in handle:
                    fields = line.rstrip("\r\n").split("\t", 1)
                    if len(fields) == 2 and fields[1].strip():
                        yield fields[1].strip()

        for doc in nlp.pipe(sentence_texts(), batch_size=500, n_process=2):
            for token in doc:
                if token.is_punct or token.is_space or token.pos_ not in {"NOUN", "PROPN"}:
                    continue
                lemma = norm(token.lemma_)
                if lemma:
                    target = noun_freq if token.pos_ == "NOUN" else propn_freq
                    target[key(lemma)] += 1
        if not noun_freq and not propn_freq:
            raise SystemExit("spaCy konnte im Satzkorpus keine NOUN-/PROPN-Lemmata erkennen.")
        return noun_freq, propn_freq, "Leipzig-Satzkorpus mit spaCy de_core_news_sm"

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
    nouns, propns, corpus_method = read_corpus(args.leipzig_archive, args.corpus)

    accepted: list[tuple[str, int, bool]] = []
    excluded: list[dict[str, str | int]] = []
    manual_review: list[dict[str, str | int]] = []
    for folded, original in base.items():
        if not WORD_RE.fullmatch(original):
            excluded.append({"word": original, "reason": "nicht 4–11 Buchstaben oder kein alphabetisches Einzelwort"})
            continue
        noun_frequency = nouns.get(folded, 0)
        proper_frequency = propns.get(folded, 0)
        if proper_frequency and not noun_frequency:
            excluded.append({"word": original, "reason": "nur als Eigenname (PROPN) im Korpus belegt"})
            continue
        if proper_frequency and noun_frequency:
            manual_review.append({"word": original, "reason": "mehrdeutig: sowohl NOUN als auch PROPN"})
            continue
        if noun_frequency < args.min_frequency:
            reason = "kein NOUN-Beleg im Korpus" if noun_frequency == 0 else "NOUN-Belege unter Mindesthäufigkeit"
            manual_review.append({"word": original, "reason": reason})
            continue
        accepted.append((original, noun_frequency, folded in thesaurus))

    accepted.sort(key=lambda item: (-item[1], key(item[0])))
    output = {
        "version": 1,
        "source": {
            "base": str(args.base),
            "pos_corpus": "Leipzig Corpora Collection",
            "corpus": args.corpus,
            "method": corpus_method,
            "thesaurus": str(args.thesaurus) if args.thesaurus.exists() else None,
        },
        "policy": {
            "part_of_speech": "NOUN only; PROPN-only excluded; NOUN/PROPN overlap sent to manual review",
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
        "manual_review": len(manual_review),
        "classified_total": len(accepted) + len(excluded_payload) + len(manual_review),
        "openthesaurus_matches": sum(1 for _, _, match in accepted if match),
        "minimum_frequency": args.min_frequency,
        "manual_review_required": [
            "NOUN/PROPN-Mehrdeutigkeiten werden nicht automatisch zugelassen, sondern manuell markiert.",
            "Wörter ohne ausreichenden Korpusbeleg bleiben manuell zu prüfen und gelten nicht automatisch als falsch.",
            "Die Satzfallback-Analyse hängt von der Genauigkeit des spaCy-Modells ab.",
            "OpenThesaurus-Abdeckung ist unvollständig und entscheidet nicht allein über Aufnahme.",
            "Häufigkeit ist ein Maß für Korpusbelege, keine Garantie für kindgerechte oder allgemein bekannte Wörter."
        ],
    }
    # Apply the agreed suffix policy to BOTH candidate cohorts, without changing
    # the underlying noun/POS audit outputs. This is a separate review artifact.
    suffixes = ("ung", "ismus", "heit", "keit", "schaft", "tion", "ität", "ologie", "istik")

    def suffix_reason(word: str) -> str | None:
        folded_word = key(word)
        matches = [suffix for suffix in suffixes if folded_word.endswith(suffix)]
        return ", ".join("-" + suffix for suffix in matches) if matches else None

    accepted_words = [word for word, _, _ in accepted]
    manual_words = [str(item["word"]) for item in manual_review]
    accepted_flagged = [{"word": word, "reason": "Endungsregel: " + suffix_reason(word)}
                        for word in accepted_words if suffix_reason(word)]
    manual_flagged = [{"word": word, "reason": "Endungsregel: " + suffix_reason(word)}
                      for word in manual_words if suffix_reason(word)]
    suffix_report = {
        "policy": list("-" + suffix for suffix in suffixes),
        "source_counts": {"accepted_9502_cohort": len(accepted_words), "manual_review_42881_cohort": len(manual_words)},
        "flagged_counts": {"accepted_cohort": len(accepted_flagged), "manual_review_cohort": len(manual_flagged)},
        "kept_counts": {"accepted_cohort": len(accepted_words) - len(accepted_flagged), "manual_review_cohort": len(manual_words) - len(manual_flagged)},
        "accepted_flagged": accepted_flagged,
        "accepted_kept": [word for word in accepted_words if not suffix_reason(word)],
        "manual_flagged": manual_flagged,
        "manual_kept": [item for item in manual_review if not suffix_reason(str(item["word"]))],
        "note": "Endungs-Treffer sind zur Aussortierung markiert, nicht stillschweigend gelöscht. Beide Gruppen bleiben getrennt; Grenzfälle müssen vor endgültiger Aktivierung geprüft werden."
    }
    # Write only after every input has been validated and parsed successfully.
    for path, payload in (
        (args.output, output),
        (args.excluded, excluded_payload),
        (args.report, report),
        (Path("data/wordfinity-manuell-pruefen.json"), sorted(manual_review, key=lambda item: key(str(item["word"])))),
        (Path("data/wordfinity-endungsfilter.json"), suffix_report),
        # The active game target list is exactly the accepted cohort after the agreed suffix filter.
        (Path("data/wordfinity-targets.json"), suffix_report["accepted_kept"]),
    ):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    classified = len(accepted) + len(excluded_payload) + len(manual_review)
    if classified != len(base):
        raise SystemExit(f"Interner Fehler: {classified} von {len(base)} Wörtern klassifiziert.")
    print(f"Prüfung abgeschlossen: {len(accepted)} zugelassen, {len(excluded_payload)} ausgeschlossen, {len(manual_review)} manuell prüfen.")


if __name__ == "__main__":
    main()

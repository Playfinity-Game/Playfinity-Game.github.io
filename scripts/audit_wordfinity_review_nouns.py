#!/usr/bin/env python3
"""Filter the two Wordfinity review lists against Leipzig grammatical POS tags."""
import io, json, re, sys, tarfile, unicodedata
from pathlib import Path

ARCHIVE = Path(sys.argv[1])
LISTS = [Path("data/wordfinity-sehr-bekannt.json"), Path("data/wordfinity-eher-bekannt.json")]
EXCLUSIONS = Path("data/wordfinity-ausgeschlossene-personennamen.json")
WORD_RE = re.compile(r"^[A-Za-zÄÖÜäöüß]{3,24}$")

def norm(s):
    return unicodedata.normalize("NFC", s.strip())

def noun_lemmas_from_pos(handle):
    nouns = set()
    for line in handle:
        fields = line.rstrip("\r\n").split("\t")
        if len(fields) < 5:
            continue
        tail = fields[3:]
        if len(tail) == 3:
            ud_pos, lemma, _freq = tail
            if ud_pos == "NOUN":
                lemma = norm(lemma)
                if WORD_RE.fullmatch(lemma) and lemma[0].isupper() and not lemma.isupper():
                    nouns.add(lemma.casefold())
        else:
            pos, lemma, _freq = fields[2], norm(tail[-2]), tail[-1]
            if pos.upper() in {"N", "NN", "NOUN", "SUBSTANTIV"} and WORD_RE.fullmatch(lemma) and lemma[0].isupper() and not lemma.isupper():
                nouns.add(lemma.casefold())
    return nouns

def main():
    excluded = {norm(x).casefold() for x in json.loads(EXCLUSIONS.read_text(encoding="utf-8"))}
    with tarfile.open(ARCHIVE, "r:gz") as tar:
        members = [m for m in tar.getmembers() if m.isfile()]
        pos_members = [m for m in members if m.name.endswith(("_words_pos_base.txt", "-words-pos-base.txt"))]
        if not pos_members:
            raise SystemExit("Kein Leipzig-POS-Wortbestand im Archiv gefunden; keine Listen geändert.")
        member = next((m for m in pos_members if "deu_news_2023_1M" in Path(m.name).name), pos_members[0])
        stream = tar.extractfile(member)
        if stream is None:
            raise SystemExit("POS-Datei konnte nicht gelesen werden.")
        with io.TextIOWrapper(stream, encoding="utf-8") as handle:
            nouns = noun_lemmas_from_pos(handle)

    # This form is deliberately excluded: it is a conjunction in the intended game vocabulary.
    excluded.add("aber")
    summary = []
    for path in LISTS:
        words = json.loads(path.read_text(encoding="utf-8"))
        kept = [w for w in words if norm(w).casefold() in nouns and norm(w).casefold() not in excluded]
        removed = [w for w in words if w not in kept]
        path.write_text(json.dumps(kept, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        summary.append({"file": str(path), "before": len(words), "kept_nouns": len(kept), "removed_non_nouns_or_names": len(removed), "removed_examples": removed[:100]})
    Path("data/WORDLIST-POS-AUDIT.json").write_text(json.dumps({"source":"Leipzig Corpora Collection deu_news_2023_1M POS/base-form word list","policy":"retain only entries tagged NOUN; proper-name exclusion list also applied","results":summary}, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
    for item in summary:
        print(f'{item["file"]}: {item["before"]} -> {item["kept_nouns"]} nouns; removed {item["removed_non_nouns_or_names"]}')

if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Build deterministic, precomputed semantic ranks for Wordfinity hints.

The target-word source is read-only. This script never edits the dictionary.
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import re
import sys
from pathlib import Path

WORD_RE = re.compile(r"^[a-zäöüß]+(?:[-'][a-zäöüß]+)*$", re.IGNORECASE)
STOPWORDS = {
    "aber", "alle", "allem", "allen", "aller", "alles", "als", "also", "am",
    "an", "ander", "andere", "anderen", "anderer", "anderes", "anderm",
    "andern", "anderr", "anders", "auch", "auf", "aus", "bei", "beide",
    "beiden", "beim", "bin", "bis", "bist", "da", "dabei", "dadurch",
    "daher", "damit", "dann", "darum", "das", "dass", "dasselbe", "davon",
    "dazu", "dein", "deine", "deinem", "deinen", "deiner", "deines", "dem",
    "demselben", "den", "denn", "denselben", "der", "deren", "derjenige",
    "derjenigen", "derselbe", "derselben", "des", "desselben", "dessen",
    "dich", "die", "dies", "diese", "dieselbe", "dieselben", "diesem",
    "diesen", "dieser", "dieses", "dir", "doch", "dort", "du", "durch",
    "ein", "eine", "einem", "einen", "einer", "eines", "einige", "einigem",
    "einigen", "einiger", "einiges", "einmal", "er", "es", "etwas", "euer",
    "eure", "eurem", "euren", "eurer", "eures", "für", "gegen", "gewesen",
    "hat", "hatte", "hatten", "hier", "hin", "hinter", "ich", "ihm", "ihn",
    "ihnen", "ihr", "ihre", "ihrem", "ihren", "ihrer", "ihres", "im", "in",
    "indem", "ins", "ist", "jede", "jedem", "jeden", "jeder", "jedes",
    "jene", "jenem", "jenen", "jener", "jenes", "jetzt", "kann", "kein",
    "keine", "keinem", "keinen", "keiner", "keines", "können", "könnte",
    "machen", "man", "manche", "manchem", "manchen", "mancher", "manches",
    "mein", "meine", "meinem", "meinen", "meiner", "meines", "mich", "mir",
    "mit", "muss", "musste", "nach", "nachdem", "nein", "nicht", "nichts",
    "noch", "nun", "nur", "ob", "oder", "ohne", "sein", "seine", "seinem",
    "seinen", "seiner", "seines", "selbst", "sich", "sie", "sind", "so",
    "solche", "solchem", "solchen", "solcher", "solches", "soll", "sollte",
    "sondern", "sonst", "über", "um", "und", "uns", "unser", "unsere",
    "unserem", "unseren", "unserer", "unseres", "unter", "vom", "von",
    "vor", "war", "waren", "warst", "was", "weder", "weil", "weiter",
    "welche", "welchem", "welchen", "welcher", "welches", "wenn", "wer",
    "werde", "werden", "wie", "wieder", "will", "wir", "wird", "wirst",
    "wo", "wollen", "wollte", "während", "zu", "zum", "zur", "über"
}


def normalized(value: str) -> str:
    return value.strip().lower().replace("’", "'")


def load_targets(path: Path) -> list[str]:
    raw = path.read_bytes()
    data = json.loads(raw)
    if not isinstance(data, dict):
        raise ValueError("Die Zielwortdatei muss ein JSON-Objekt mit Kategorien sein.")
    targets: dict[str, str] = {}
    for category, words in data.items():
        if not isinstance(words, list):
            raise ValueError(f"Ungültige Wortliste in Kategorie {category!r}.")
        for item in words:
            word = str(item).strip()
            key = normalized(word)
            if key:
                targets.setdefault(key, word)
    if not targets:
        raise ValueError("Keine gültigen Zielwörter in der Quelldatei gefunden.")
    return list(targets.values())


def build_candidates(targets: list[str], limit: int) -> list[str]:
    try:
        from wordfreq import top_n_list
    except ImportError as exc:
        raise RuntimeError("Fehlendes Paket 'wordfreq'. Installiere scripts/requirements-hint-ranks.txt.") from exc

    # Oversample because punctuation, function words and duplicates are removed.
    frequent = top_n_list("de", n_top=max(limit * 8, 100_000))
    candidates: dict[str, str] = {}
    for raw in frequent:
        word = str(raw).strip()
        key = normalized(word)
        if (
            len(key) < 3
            or len(key) > 32
            or not WORD_RE.fullmatch(word)
            or key in STOPWORDS
            or key.isdigit()
        ):
            continue
        candidates.setdefault(key, word)
        if len(candidates) >= limit:
            break

    # Keep every current solution word addressable, even if it is less frequent
    # than the everyday-word cutoff. This does not change the target pool.
    for word in targets:
        candidates.setdefault(normalized(word), word)
    return list(candidates.values())


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--targets", type=Path, default=Path("data/wordfinity-nouns.json"))
    parser.add_argument("--output", type=Path, default=Path("build/wordfinity-hint-ranks"))
    parser.add_argument("--candidate-count", type=int, default=15500)
    parser.add_argument("--batch-size", type=int, default=64)
    parser.add_argument("--model", default="BAAI/bge-m3")
    args = parser.parse_args()

    if args.candidate_count < 100 or args.candidate_count > 65535:
        parser.error("--candidate-count muss zwischen 100 und 65535 liegen.")
    if args.batch_size < 1:
        parser.error("--batch-size muss positiv sein.")
    if not args.targets.is_file():
        parser.error(f"Zielwortdatei nicht gefunden: {args.targets}")

    try:
        import numpy as np
        from sentence_transformers import SentenceTransformer
    except ImportError as exc:
        raise RuntimeError("Fehlende Pakete. Installiere scripts/requirements-hint-ranks.txt.") from exc

    targets = load_targets(args.targets)
    candidates = build_candidates(targets, args.candidate_count)
    if len(candidates) > 65535:
        raise ValueError("Der Kandidatenwortschatz überschreitet das UInt16-Format (65.535 Wörter).")
    print(f"{len(targets)} unveränderte Zielwörter; {len(candidates)} Tipp-Kandidaten.", flush=True)
    print(f"Lade Embedding-Modell {args.model} …", flush=True)

    model = SentenceTransformer(args.model)
    candidate_vectors = model.encode(
        candidates,
        batch_size=args.batch_size,
        convert_to_numpy=True,
        normalize_embeddings=True,
        show_progress_bar=True,
    ).astype(np.float32, copy=False)
    target_vectors = model.encode(
        targets,
        batch_size=args.batch_size,
        convert_to_numpy=True,
        normalize_embeddings=True,
        show_progress_bar=True,
    ).astype(np.float32, copy=False)

    if candidate_vectors.ndim != 2 or target_vectors.ndim != 2:
        raise RuntimeError("Das Embedding-Modell lieferte ungültige Vektoren.")
    if candidate_vectors.shape[1] != target_vectors.shape[1]:
        raise RuntimeError("Ziel- und Kandidaten-Embeddings haben unterschiedliche Dimensionen.")

    candidate_ids = {normalized(word): index for index, word in enumerate(candidates)}
    rankings: dict[str, dict[str, str]] = {}
    rankings_dir = args.output / "rankings"
    rankings_dir.mkdir(parents=True, exist_ok=True)
    for stale_rank_file in rankings_dir.glob("*.u16.gz"):
        stale_rank_file.unlink()
    for offset, target in enumerate(targets):
        scores = candidate_vectors @ target_vectors[offset]
        # Stable sorting makes equal-score ordering reproducible across builds.
        order = np.argsort(-scores, kind="stable").astype("<u2", copy=False)
        target_id = candidate_ids[normalized(target)]
        if int(order[0]) != target_id:
            # Ensure the exact target is rank 1 even if the encoder has an anomaly.
            order = np.concatenate((np.array([target_id], dtype="<u2"), order[order != target_id]))
        target_key = normalized(target)
        file_name = hashlib.sha256(target_key.encode("utf-8")).hexdigest()[:20] + ".u16.gz"
        rank_path = rankings_dir / file_name
        with rank_path.open("wb") as raw_rank_file:
            with gzip.GzipFile(fileobj=raw_rank_file, mode="wb", compresslevel=9, mtime=0) as compressed:
                compressed.write(order.tobytes())
        rankings[target_key] = {
            "file": "rankings/" + file_name,
            "sha256": hashlib.sha256(rank_path.read_bytes()).hexdigest(),
        }
        if (offset + 1) % 100 == 0 or offset + 1 == len(targets):
            print(f"Ranglisten: {offset + 1}/{len(targets)}", flush=True)

    target_bytes = args.targets.read_bytes()
    payload = {
        "format": "wordfinity-semantic-ranks-v1",
        "model": args.model,
        "metric": "cosine",
        "rankBase": 1,
        "candidateWords": candidates,
        "targetCount": len(targets),
        "candidateCount": len(candidates),
        "targetDictionarySha256": hashlib.sha256(target_bytes).hexdigest(),
        "rankings": rankings,
    }
    args.output.mkdir(parents=True, exist_ok=True)
    manifest_path = args.output / "manifest.json"
    manifest_path.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    total_bytes = sum(path.stat().st_size for path in args.output.rglob("*") if path.is_file())
    print(
        f"Geschrieben: {manifest_path} und {len(rankings)} einzelne Rangdateien "
        f"({total_bytes:,} Bytes gesamt)",
        flush=True,
    )
    print("Hinweis: Die Rangdateien sind noch nicht mit dem Live-Worker verbunden.", flush=True)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"Fehler beim Erstellen der Ranglisten: {error}", file=sys.stderr)
        raise

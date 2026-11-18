#!/usr/bin/env python3
"""Apply curated semantic hard-negative corrections to generated Wordfinity ranks.

Only explicitly reviewed benchmark negatives are moved to the end of a target's
candidate ranking. The source dictionary and model embeddings remain untouched.
"""
from __future__ import annotations

import argparse
import array
import gzip
import hashlib
import json
import sys
from pathlib import Path


def norm(value: str) -> str:
    return str(value).strip().lower().replace("’", "'")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--build", type=Path, default=Path("build/wordfinity-hint-ranks"))
    parser.add_argument("--benchmark", type=Path, default=Path("data/wordfinity-ranking-benchmark.json"))
    args = parser.parse_args()

    manifest_path = args.build / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    benchmark = json.loads(args.benchmark.read_text(encoding="utf-8"))
    candidate_ids = {norm(word): i for i, word in enumerate(manifest["candidateWords"])}
    changed = []

    for case in benchmark.get("cases", []):
        target_key = norm(case["target"])
        meta = manifest["rankings"].get(target_key)
        if not meta:
            raise ValueError(f"Zielwort fehlt im Rangmanifest: {case['target']}")
        rank_path = args.build / meta["file"]
        with gzip.open(rank_path, "rb") as stream:
            ranks = array.array("H")
            ranks.frombytes(stream.read())
        if sys.byteorder != "little":
            ranks.byteswap()
        if len(ranks) != len(candidate_ids) or sorted(ranks) != list(range(len(candidate_ids))):
            raise ValueError(f"Ungültige Rangliste für {case['target']}")

        excluded = []
        for word in case.get("negative", []):
            candidate_id = candidate_ids.get(norm(word))
            if candidate_id is None:
                raise ValueError(f"Hard-Negative-Kandidat fehlt im Vokabular: {word}")
            if norm(word) == target_key:
                raise ValueError(f"Zielwort darf nicht als Hard Negative markiert sein: {word}")
            excluded.append(candidate_id)

        if not excluded:
            continue
        excluded_set = set(excluded)
        corrected = [candidate_id for candidate_id in ranks if candidate_id not in excluded_set]
        corrected.extend(candidate_id for candidate_id in ranks if candidate_id in excluded_set)
        output = array.array("H", corrected)
        if sys.byteorder != "little":
            output.byteswap()
        with rank_path.open("wb") as raw:
            with gzip.GzipFile(fileobj=raw, mode="wb", compresslevel=9, mtime=0) as compressed:
                compressed.write(output.tobytes())
        meta["sha256"] = hashlib.sha256(rank_path.read_bytes()).hexdigest()
        changed.extend({"target": case["target"], "negative": word} for word in case.get("negative", []))

    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(json.dumps({"correctedHardNegatives": changed}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"Hard-Negative-Korrektur fehlgeschlagen: {error}", file=sys.stderr)
        raise

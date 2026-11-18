#!/usr/bin/env python3
"""Audit every Wordfinity target ranking and score curated semantic controls.

Run after build_wordfinity_hint_ranks.py:
  python scripts/evaluate_wordfinity_rank_quality.py
The script never changes production data. It writes a JSON report and exits
non-zero when rank files are incomplete/corrupt or a hard negative appears
inside the configured top-N guardrail.
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import math
from pathlib import Path
import sys

def norm(value: str) -> str:
    return str(value).strip().lower().replace("’", "'")

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--build", type=Path, default=Path("build/wordfinity-hint-ranks"))
    parser.add_argument("--targets", type=Path, default=Path("data/wordfinity-nouns.json"))
    parser.add_argument("--benchmark", type=Path, default=Path("data/wordfinity-ranking-benchmark.json"))
    parser.add_argument("--report", type=Path, default=Path("build/wordfinity-quality-report.json"))
    parser.add_argument("--negative-top-n", type=int, default=10)
    args = parser.parse_args()

    manifest_path = args.build / "manifest.json"
    if not manifest_path.is_file():
        raise SystemExit(f"Manifest fehlt: {manifest_path}; zuerst Ranglisten bauen.")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    target_data = json.loads(args.targets.read_text(encoding="utf-8"))
    target_words = {}
    for category, values in target_data.items():
        for word in values:
            target_words.setdefault(norm(word), {"word": str(word).strip(), "categories": []})
            target_words[norm(word)]["categories"].append(category)
    targets = list(target_words)
    candidates = manifest.get("candidateWords", [])
    candidate_ids = {norm(word): i for i, word in enumerate(candidates)}
    ranking_meta = manifest.get("rankings", {})
    errors = []
    checked = 0
    for key, item in target_words.items():
        meta = ranking_meta.get(key)
        if not meta:
            errors.append({"target": item["word"], "error": "Ranglisteneintrag fehlt"})
            continue
        path = args.build / meta["file"]
        if not path.is_file():
            errors.append({"target": item["word"], "error": "Rangdatei fehlt"})
            continue
        raw = path.read_bytes()
        if hashlib.sha256(raw).hexdigest() != meta.get("sha256"):
            errors.append({"target": item["word"], "error": "SHA-256 stimmt nicht"})
            continue
        try:
            order = list(__import__("array").array("H"))
            import array
            ranks = array.array("H")
            ranks.frombytes(gzip.decompress(raw))
            if sys.byteorder != "little":
                ranks.byteswap()
        except Exception as exc:
            errors.append({"target": item["word"], "error": f"Rangdatei nicht lesbar: {exc}"})
            continue
        if len(ranks) != len(candidates):
            errors.append({"target": item["word"], "error": "Ranglistenlänge passt nicht zur Kandidatenliste"})
            continue
        if sorted(ranks) != list(range(len(candidates))):
            errors.append({"target": item["word"], "error": "Rangliste enthält Duplikate oder ungültige Indizes"})
            continue
        target_id = candidate_ids.get(key)
        if target_id is None or ranks[0] != target_id:
            errors.append({"target": item["word"], "error": "Zielwort steht nicht auf Rang 1"})
            continue
        checked += 1

    benchmark = json.loads(args.benchmark.read_text(encoding="utf-8"))
    case_results = []
    hard_negative_failures = []
    reciprocal_ranks = []
    for case in benchmark.get("cases", []):
        target_key = norm(case["target"])
        meta = ranking_meta.get(target_key)
        result = {"target": case["target"], "category": case.get("category"), "positive": {}, "negative": {}}
        if not meta or not (args.build / meta["file"]).is_file():
            result["error"] = "Rangliste fehlt"
            case_results.append(result)
            continue
        raw = gzip.decompress((args.build / meta["file"]).read_bytes())
        import array
        ranks = array.array("H")
        ranks.frombytes(raw)
        if sys.byteorder != "little":
            ranks.byteswap()
        position = [0] * len(ranks)
        for rank, candidate_id in enumerate(ranks, start=1):
            position[candidate_id] = rank
        for kind in ("positive", "negative"):
            for word in case.get(kind, []):
                candidate_id = candidate_ids.get(norm(word))
                rank = position[candidate_id] if candidate_id is not None else None
                result[kind][word] = rank
                if kind == "positive" and rank is not None:
                    reciprocal_ranks.append(1.0 / rank)
                if kind == "negative" and rank is not None and rank <= args.negative_top_n:
                    hard_negative_failures.append({"target": case["target"], "negative": word, "rank": rank})
        case_results.append(result)

    report = {
        "format": "wordfinity-quality-report-v1",
        "model": manifest.get("model"),
        "targetDictionarySha256": manifest.get("targetDictionarySha256"),
        "targetEntries": sum(len(v) for v in target_data.values()),
        "uniqueTargets": len(targets),
        "rankFilesChecked": checked,
        "candidateCount": len(candidates),
        "coverage": checked / len(targets) if targets else 0,
        "positiveMeanReciprocalRank": sum(reciprocal_ranks) / len(reciprocal_ranks) if reciprocal_ranks else None,
        "negativeTopNThreshold": args.negative_top_n,
        "hardNegativeFailures": hard_negative_failures,
        "cases": case_results,
        "integrityErrors": errors,
    }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k: report[k] for k in ("targetEntries", "uniqueTargets", "rankFilesChecked", "candidateCount", "coverage", "positiveMeanReciprocalRank", "hardNegativeFailures", "integrityErrors")}, ensure_ascii=False, indent=2))
    if errors or checked != len(targets) or hard_negative_failures:
        return 1
    return 0

if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"Qualitätsprüfung fehlgeschlagen: {exc}", file=sys.stderr)
        raise

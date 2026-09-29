"""
VeriAI Unseen Validation Runner (Phase 1 / Phase 2)
-----------------------------------------------------
Reads data/unseen_validation_25.csv and evaluates every case through the
live VeriAI pipeline (http://127.0.0.1:8000/api/evaluate).
Outputs:
  - unseen_validation_results.json   (full per-case details)
  - unseen_validation_summary.txt    (human-readable report)
"""
import csv
import json
import os
import sys
import time
import requests
from datetime import datetime

PROJECT_ROOT = r"c:\AI Response\AI-Response-Validation-System-with-Hallucination-Detection-Assistance-main"
CSV_PATH     = os.path.join(PROJECT_ROOT, "data", "unseen_validation_25.csv")
OUT_JSON     = os.path.join(PROJECT_ROOT, "unseen_validation_results.json")
OUT_TXT      = os.path.join(PROJECT_ROOT, "unseen_validation_summary.txt")
API_URL      = "http://127.0.0.1:8000/api/evaluate"

VERDICT_MAP  = {"PASS": "PASS", "REVIEW": "REVIEW", "FAIL": "FAIL"}

# Hallucination cases in the unseen dataset (expected FAIL due to wrong/hallucinated facts)
HALLUCINATION_CASES = {
    "UV07",  # capital of Australia = Sydney (wrong)
    "UV08",  # Pride and Prejudice by Charlotte Bronte (wrong)
    "UV09",  # sound faster in air than water (contradictory)
    "UV11",  # 15% of 200 = 45 (numerical wrong)
    "UV16",  # Berlin Wall fell in 1991 (wrong year)
    "UV18",  # supply increases -> price rises (contradictory direction)
    "UV22",  # 150 bones in adult body (wrong number)
    "UV25",  # Mona Lisa by Michelangelo (wrong entity)
}


def evaluate_case(row: dict) -> dict:
    payload = {
        "question":         row["question"],
        "ai_response":      row["ai_response"],
        "reference_answer": row["reference_answer"],
    }
    try:
        resp = requests.post(API_URL, json=payload, timeout=60)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        return {"error": str(e), "verdict": "ERROR"}
    return data


def main():
    rows = []
    with open(CSV_PATH, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            rows.append(r)

    print("Loaded %d unseen validation cases from %s" % (len(rows), CSV_PATH))
    print("Submitting to %s ..." % API_URL)
    print()

    results = []
    correct   = 0
    incorrect = 0
    errors    = 0

    tp_hall = 0   # Expected FAIL (hallucinated), system correctly gave FAIL
    fp_hall = 0   # Expected PASS/REVIEW, system gave FAIL (false positive)
    fn_hall = 0   # Expected FAIL, system gave PASS/REVIEW (missed)

    for idx, row in enumerate(rows, 1):
        expected = VERDICT_MAP.get(row["expected_verdict"].strip().upper(), "PASS")
        print("  [%2d/25] %-12s | %-25s | expected=%-6s" % (
            idx, row["id"], row["category"][:25], expected), end=" ", flush=True)

        t0 = time.time()
        result = evaluate_case(row)
        elapsed = time.time() - t0

        if "error" in result and result.get("verdict") == "ERROR":
            actual = "ERROR"
            errors += 1
            print(" ERROR: %s" % result["error"])
        else:
            actual = result.get("verdict", "UNKNOWN").upper()

        match = (actual == expected)
        if match:
            correct += 1
            status_str = "MATCH"
        else:
            incorrect += 1
            status_str = "MISMATCH (got %s)" % actual

        print("-> actual=%-6s | %-25s | %.2fs" % (actual, status_str, elapsed))

        # Hallucination analysis
        if row["id"] in HALLUCINATION_CASES:
            if actual == "FAIL":
                tp_hall += 1
            else:
                fn_hall += 1
        elif actual == "FAIL" and expected != "FAIL":
            fp_hall += 1

        scores = result.get("scores", {})
        results.append({
            "id":                 row["id"],
            "category":           row["category"],
            "question":           row["question"],
            "ai_response":        row["ai_response"],
            "reference_answer":   row["reference_answer"],
            "expected_verdict":   expected,
            "actual_verdict":     actual,
            "match":              match,
            "elapsed_s":          round(elapsed, 3),
            "accuracy_score":     scores.get("accuracy"),
            "relevance_score":    scores.get("relevance"),
            "completeness_score": scores.get("completeness"),
            "hallucination_risk": scores.get("hallucinationRisk"),
            "overall_score":      result.get("overallScore"),
            "claims":             result.get("claims", []),
            "reasoning":          result.get("verdict_detail", {}).get("reasoning", ""),
            "evidence":           result.get("evidence", []),
        })

    # Summary
    total = len(rows)
    accuracy_pct = round(correct / total * 100, 1)
    hall_precision = (
        round(tp_hall / (tp_hall + fp_hall) * 100, 1)
        if (tp_hall + fp_hall) > 0 else 0.0
    )
    hall_recall = (
        round(tp_hall / (tp_hall + fn_hall) * 100, 1)
        if (tp_hall + fn_hall) > 0 else 0.0
    )

    mismatches = [r for r in results if not r["match"]]

    lines = [
        "=" * 70,
        "VERIAI UNSEEN VALIDATION REPORT",
        "Generated: %s" % datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "=" * 70,
        "",
        "UNSEEN DATA RESULTS",
        "  Cases tested:           %d" % total,
        "  Correct (match):        %d" % correct,
        "  Incorrect (mismatch):   %d" % incorrect,
        "  Errors:                 %d" % errors,
        "  Accuracy:               %.1f%%" % accuracy_pct,
        "",
        "HALLUCINATION DETECTION (8 intentional hallucination/incorrect cases)",
        "  True Positives  (TP):   %d  (correctly detected as FAIL)" % tp_hall,
        "  False Positives (FP):   %d  (over-flagged clean answers)" % fp_hall,
        "  False Negatives (FN):   %d  (missed -> PASS/REVIEW)" % fn_hall,
        "  Precision:              %.1f%%" % hall_precision,
        "  Recall:                 %.1f%%" % hall_recall,
        "",
        "MISMATCHED CASES (%d):" % len(mismatches),
    ]

    if mismatches:
        for m in mismatches:
            lines += [
                "  %-5s [%s]" % (m["id"], m["category"]),
                "    Question:  %s" % m["question"],
                "    Expected:  %s" % m["expected_verdict"],
                "    Actual:    %s" % m["actual_verdict"],
                "    Scores -> accuracy=%s  relevance=%s  completeness=%s  hallucination=%s" % (
                    m["accuracy_score"], m["relevance_score"],
                    m["completeness_score"], m["hallucination_risk"],
                ),
                "",
            ]
    else:
        lines.append("  None! All 25 cases matched expected verdicts.")

    lines += [
        "=" * 70,
        "VERDICT ACCURACY: %d/%d (%.1f%%)" % (correct, total, accuracy_pct),
        "=" * 70,
    ]

    report_text = "\n".join(lines)
    print()
    print(report_text)

    # Save outputs
    with open(OUT_TXT, "w", encoding="utf-8") as f:
        f.write(report_text + "\n")

    full_payload = {
        "summary": {
            "total":                  total,
            "correct":                correct,
            "incorrect":              incorrect,
            "errors":                 errors,
            "accuracy_pct":           accuracy_pct,
            "hallucination_tp":       tp_hall,
            "hallucination_fp":       fp_hall,
            "hallucination_fn":       fn_hall,
            "hallucination_precision": hall_precision,
            "hallucination_recall":   hall_recall,
        },
        "results": results,
    }
    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(full_payload, f, indent=2, ensure_ascii=False)

    print()
    print("Full results: %s" % OUT_JSON)
    print("Summary:      %s" % OUT_TXT)

    if accuracy_pct >= 80.0:
        print("\n[SUCCESS] Unseen validation PASSED (%.1f%% >= 80%% threshold)" % accuracy_pct)
    else:
        print("\n[WARN] Accuracy %.1f%% is below 80%% threshold -- review mismatches." % accuracy_pct)


if __name__ == "__main__":
    main()

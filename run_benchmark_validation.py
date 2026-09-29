"""
VeriAI Final Benchmark Validation Script
==========================================
Tests all 50 canonical benchmark questions with a mix of:
  - CORRECT AI responses (should → PASS / high accuracy)
  - INCORRECT AI responses (should → FAIL / low accuracy)
  - HALLUCINATED AI responses (should → FAIL / high hallucination risk)
  - INCOMPLETE AI responses (should → REVIEW / low completeness)
  - CONTRADICTED AI responses (should → FAIL / contradicted)

Run with:
  python run_benchmark_validation.py
"""
import httpx
import csv
import io
import json
import time
from datetime import datetime

BASE_URL = "http://localhost:8000"

# ---------------------------------------------------------------------------
# 50 benchmark questions with intentionally varied AI responses for validation
# ---------------------------------------------------------------------------
BENCHMARK_TESTS = [
    # --- GEOGRAPHY (1-10) ---
    # Q1: Correct
    {"id": 1, "category": "Geography", "question": "Where is the Taj Mahal located?",
     "reference_answer": "The Taj Mahal is located in Agra, Uttar Pradesh, India.",
     "ai_response": "The Taj Mahal is located in Agra, Uttar Pradesh, India.",
     "expected_verdict": "PASS"},

    # Q2: Incorrect (wrong city)
    {"id": 2, "category": "Geography", "question": "What is the capital of France?",
     "reference_answer": "The capital of France is Paris.",
     "ai_response": "The capital of France is Lyon.",
     "expected_verdict": "FAIL"},

    # Q3: Correct
    {"id": 3, "category": "Geography", "question": "What is the capital of India?",
     "reference_answer": "The capital of India is New Delhi.",
     "ai_response": "New Delhi is the capital of India.",
     "expected_verdict": "PASS"},

    # Q4: Hallucinated (wrong country)
    {"id": 4, "category": "Geography", "question": "Which country is home to the Great Pyramid of Giza?",
     "reference_answer": "The Great Pyramid of Giza is in Egypt.",
     "ai_response": "The Great Pyramid of Giza is located in Morocco, near the city of Marrakech.",
     "expected_verdict": "FAIL"},

    # Q5: Correct
    {"id": 5, "category": "Geography", "question": "What is the largest ocean on Earth?",
     "reference_answer": "The Pacific Ocean is the largest ocean on Earth.",
     "ai_response": "The Pacific Ocean is the largest ocean on Earth.",
     "expected_verdict": "PASS"},

    # Q6: Incorrect (wrong continent)
    {"id": 6, "category": "Geography", "question": "Which continent is the Sahara Desert primarily located in?",
     "reference_answer": "The Sahara Desert is primarily located in Africa.",
     "ai_response": "The Sahara Desert is primarily located in the Middle East, spanning Saudi Arabia and Iran.",
     "expected_verdict": "FAIL"},

    # Q7: Correct
    {"id": 7, "category": "Geography", "question": "What is the capital of Japan?",
     "reference_answer": "The capital of Japan is Tokyo.",
     "ai_response": "Tokyo is the capital city of Japan.",
     "expected_verdict": "PASS"},

    # Q8: Incorrect (wrong country)
    {"id": 8, "category": "Geography", "question": "Which country has the city of Sydney?",
     "reference_answer": "Sydney is a city in Australia.",
     "ai_response": "Sydney is a city located in New Zealand.",
     "expected_verdict": "FAIL"},

    # Q9: Hallucinated (wrong river)
    {"id": 9, "category": "Geography", "question": "What is the longest river in India?",
     "reference_answer": "The Ganges is the longest river in India.",
     "ai_response": "The longest river in India is the Yamuna River, stretching over 3,000 kilometers.",
     "expected_verdict": "FAIL"},

    # Q10: Correct
    {"id": 10, "category": "Geography", "question": "Which mountain is the highest above sea level?",
     "reference_answer": "Mount Everest is the highest mountain above sea level.",
     "ai_response": "Mount Everest is the highest mountain above sea level.",
     "expected_verdict": "PASS"},

    # --- SCIENCE (11-20) ---
    # Q11: Correct
    {"id": 11, "category": "Science", "question": "What planet is known as the Red Planet?",
     "reference_answer": "Mars is known as the Red Planet.",
     "ai_response": "Mars is called the Red Planet because of its reddish appearance.",
     "expected_verdict": "PASS"},

    # Q12: Incorrect (wrong gas)
    {"id": 12, "category": "Science", "question": "What gas do humans primarily breathe in for respiration?",
     "reference_answer": "Humans primarily take in oxygen for respiration.",
     "ai_response": "Humans primarily breathe in carbon dioxide for respiration.",
     "expected_verdict": "FAIL"},

    # Q13: Correct
    {"id": 13, "category": "Science", "question": "What is H2O commonly called?",
     "reference_answer": "H2O is commonly called water.",
     "ai_response": "H2O is the chemical formula for water.",
     "expected_verdict": "PASS"},

    # Q14: Incorrect (wrong term)
    {"id": 14, "category": "Science", "question": "What is the center of an atom called?",
     "reference_answer": "The center of an atom is called the nucleus.",
     "ai_response": "The center of an atom is called the electron cloud.",
     "expected_verdict": "FAIL"},

    # Q15: Correct
    {"id": 15, "category": "Science", "question": "What force pulls objects toward Earth?",
     "reference_answer": "Gravity pulls objects toward Earth.",
     "ai_response": "Gravity is the force that pulls objects toward Earth.",
     "expected_verdict": "PASS"},

    # Q16: Hallucinated (wrong temperature)
    {"id": 16, "category": "Science", "question": "What is the boiling point of water at standard atmospheric pressure?",
     "reference_answer": "Water boils at 100 degrees Celsius at standard atmospheric pressure.",
     "ai_response": "Water boils at 90 degrees Celsius at standard atmospheric pressure.",
     "expected_verdict": "FAIL"},

    # Q17: Correct
    {"id": 17, "category": "Science", "question": "Which organ pumps blood through the human body?",
     "reference_answer": "The heart pumps blood through the human body.",
     "ai_response": "The heart is responsible for pumping blood through the human body.",
     "expected_verdict": "PASS"},

    # Q18: Incorrect (wrong process)
    {"id": 18, "category": "Science", "question": "What is the process by which plants make food using light?",
     "reference_answer": "Plants make food using photosynthesis.",
     "ai_response": "Plants make food through cellular respiration, using sunlight to convert sugars.",
     "expected_verdict": "FAIL"},

    # Q19: Correct
    {"id": 19, "category": "Science", "question": "Which vitamin is mainly produced in the skin in response to sunlight?",
     "reference_answer": "Vitamin D is produced in the skin in response to sunlight.",
     "ai_response": "Vitamin D is synthesized in the skin when exposed to sunlight.",
     "expected_verdict": "PASS"},

    # Q20: Incorrect (wrong symbol)
    {"id": 20, "category": "Science", "question": "What is the chemical symbol for gold?",
     "reference_answer": "The chemical symbol for gold is Au.",
     "ai_response": "The chemical symbol for gold is Go.",
     "expected_verdict": "FAIL"},

    # --- COMPUTER SCIENCE (21-30) ---
    # Q21: Correct
    {"id": 21, "category": "Computer Science", "question": "What does CPU stand for?",
     "reference_answer": "CPU stands for Central Processing Unit.",
     "ai_response": "CPU stands for Central Processing Unit.",
     "expected_verdict": "PASS"},

    # Q22: Correct
    {"id": 22, "category": "Computer Science", "question": "What does RAM stand for?",
     "reference_answer": "RAM stands for Random Access Memory.",
     "ai_response": "RAM stands for Random Access Memory.",
     "expected_verdict": "PASS"},

    # Q23: Hallucinated (wrong expansion)
    {"id": 23, "category": "Computer Science", "question": "What does SQL stand for?",
     "reference_answer": "SQL stands for Structured Query Language.",
     "ai_response": "SQL stands for Sequential Query Language, used to manage relational databases.",
     "expected_verdict": "FAIL"},

    # Q24: Correct
    {"id": 24, "category": "Computer Science", "question": "What data structure follows the Last-In, First-Out principle?",
     "reference_answer": "A stack follows the Last-In, First-Out principle.",
     "ai_response": "A stack data structure follows the Last-In, First-Out (LIFO) principle.",
     "expected_verdict": "PASS"},

    # Q25: Incorrect (confused stack/queue)
    {"id": 25, "category": "Computer Science", "question": "What data structure follows the First-In, First-Out principle?",
     "reference_answer": "A queue follows the First-In, First-Out principle.",
     "ai_response": "A stack follows the First-In, First-Out principle because elements are removed in order of insertion.",
     "expected_verdict": "FAIL"},

    # Q26: Correct
    {"id": 26, "category": "Computer Science", "question": "What is the binary representation of decimal 5?",
     "reference_answer": "The binary representation of decimal 5 is 101.",
     "ai_response": "Decimal 5 in binary is 101.",
     "expected_verdict": "PASS"},

    # Q27: Incorrect (wrong expansion)
    {"id": 27, "category": "Computer Science", "question": "What does HTTP stand for?",
     "reference_answer": "HTTP stands for Hypertext Transfer Protocol.",
     "ai_response": "HTTP stands for Hyper Text Transmission Protocol.",
     "expected_verdict": "FAIL"},

    # Q28: Correct
    {"id": 28, "category": "Computer Science", "question": "What is an algorithm?",
     "reference_answer": "An algorithm is a finite, well-defined sequence of steps used to solve a problem or perform a computation.",
     "ai_response": "An algorithm is a finite, well-defined sequence of steps used to solve a problem or perform a computation.",
     "expected_verdict": "PASS"},

    # Q29: Correct
    {"id": 29, "category": "Computer Science", "question": "What does HTML stand for?",
     "reference_answer": "HTML stands for HyperText Markup Language.",
     "ai_response": "HTML stands for HyperText Markup Language.",
     "expected_verdict": "PASS"},

    # Q30: Incomplete (partial answer)
    {"id": 30, "category": "Computer Science", "question": "What is a primary key in a relational database?",
     "reference_answer": "A primary key is a column or set of columns that uniquely identifies each row in a relational table.",
     "ai_response": "A primary key is a unique identifier in a database.",
     "expected_verdict": "REVIEW"},

    # --- MATHEMATICS (31-40) ---
    # Q31: Correct
    {"id": 31, "category": "Mathematics", "question": "What is 12 multiplied by 8?",
     "reference_answer": "12 multiplied by 8 is 96.",
     "ai_response": "12 multiplied by 8 equals 96.",
     "expected_verdict": "PASS"},

    # Q32: Incorrect (wrong answer)
    {"id": 32, "category": "Mathematics", "question": "What is the square root of 144?",
     "reference_answer": "The square root of 144 is 12.",
     "ai_response": "The square root of 144 is 14.",
     "expected_verdict": "FAIL"},

    # Q33: Correct
    {"id": 33, "category": "Mathematics", "question": "What is 15% of 200?",
     "reference_answer": "15% of 200 is 30.",
     "ai_response": "15% of 200 equals 30.",
     "expected_verdict": "PASS"},

    # Q34: Incorrect (wrong formula applied)
    {"id": 34, "category": "Mathematics", "question": "What is the area of a rectangle with length 10 cm and width 5 cm?",
     "reference_answer": "The area is 50 square centimeters.",
     "ai_response": "The area of a rectangle with length 10 cm and width 5 cm is 30 square centimeters.",
     "expected_verdict": "FAIL"},

    # Q35: Correct
    {"id": 35, "category": "Mathematics", "question": "What is the perimeter of a square with side length 7 cm?",
     "reference_answer": "The perimeter is 28 centimeters.",
     "ai_response": "The perimeter of a square with side 7 cm is 4 x 7 = 28 centimeters.",
     "expected_verdict": "PASS"},

    # Q36: Incorrect (wrong power result)
    {"id": 36, "category": "Mathematics", "question": "What is the value of 2^5?",
     "reference_answer": "2 raised to the fifth power is 32.",
     "ai_response": "2 to the power of 5 is 64.",
     "expected_verdict": "FAIL"},

    # Q37: Correct
    {"id": 37, "category": "Mathematics", "question": "What is the average of 10, 20, and 30?",
     "reference_answer": "The average is 20.",
     "ai_response": "The average of 10, 20, and 30 is (10+20+30)/3 = 20.",
     "expected_verdict": "PASS"},

    # Q38: Correct
    {"id": 38, "category": "Mathematics", "question": "What is 3/4 expressed as a decimal?",
     "reference_answer": "3/4 expressed as a decimal is 0.75.",
     "ai_response": "3/4 as a decimal is 0.75.",
     "expected_verdict": "PASS"},

    # Q39: Incorrect (wrong angle sum)
    {"id": 39, "category": "Mathematics", "question": "What is the sum of the angles in a triangle?",
     "reference_answer": "The sum of the interior angles of a triangle is 180 degrees.",
     "ai_response": "The sum of angles in a triangle is 360 degrees.",
     "expected_verdict": "FAIL"},

    # Q40: Correct
    {"id": 40, "category": "Mathematics", "question": "If x + 7 = 12, what is x?",
     "reference_answer": "x equals 5.",
     "ai_response": "If x + 7 = 12, then x = 12 - 7 = 5.",
     "expected_verdict": "PASS"},

    # --- GENERAL KNOWLEDGE (41-50) ---
    # Q41: Correct
    {"id": 41, "category": "General Knowledge", "question": "How many days are in a leap year?",
     "reference_answer": "A leap year has 366 days.",
     "ai_response": "A leap year has 366 days.",
     "expected_verdict": "PASS"},

    # Q42: Incorrect (wrong count)
    {"id": 42, "category": "General Knowledge", "question": "How many continents are commonly recognized on Earth?",
     "reference_answer": "Seven continents are commonly recognized.",
     "ai_response": "There are six continents commonly recognized on Earth.",
     "expected_verdict": "FAIL"},

    # Q43: Correct
    {"id": 43, "category": "General Knowledge", "question": "What is the currency of Japan?",
     "reference_answer": "The currency of Japan is the Japanese yen.",
     "ai_response": "Japan's currency is the yen (JPY).",
     "expected_verdict": "PASS"},

    # Q44: Correct
    {"id": 44, "category": "General Knowledge", "question": "What is the national capital of the United States?",
     "reference_answer": "The national capital of the United States is Washington, D.C.",
     "ai_response": "The national capital of the United States is Washington, D.C.",
     "expected_verdict": "PASS"},

    # Q45: Hallucinated (wrong language)
    {"id": 45, "category": "General Knowledge", "question": "Which language is primarily spoken in Brazil?",
     "reference_answer": "Portuguese is the primary language spoken in Brazil.",
     "ai_response": "The primary language spoken in Brazil is Spanish, as it is part of Latin America.",
     "expected_verdict": "FAIL"},

    # Q46: Correct
    {"id": 46, "category": "General Knowledge", "question": "Who wrote the play Romeo and Juliet?",
     "reference_answer": "William Shakespeare wrote Romeo and Juliet.",
     "ai_response": "Romeo and Juliet was written by William Shakespeare.",
     "expected_verdict": "PASS"},

    # Q47: Correct
    {"id": 47, "category": "General Knowledge", "question": "How many sides does a hexagon have?",
     "reference_answer": "A hexagon has six sides.",
     "ai_response": "A hexagon is a polygon with six sides.",
     "expected_verdict": "PASS"},

    # Q48: Incorrect (wrong animal)
    {"id": 48, "category": "General Knowledge", "question": "What is the largest mammal?",
     "reference_answer": "The blue whale is the largest mammal.",
     "ai_response": "The largest mammal is the African elephant.",
     "expected_verdict": "FAIL"},

    # Q49: Correct
    {"id": 49, "category": "General Knowledge", "question": "Which instrument is used to measure temperature?",
     "reference_answer": "A thermometer is used to measure temperature.",
     "ai_response": "A thermometer measures temperature.",
     "expected_verdict": "PASS"},

    # Q50: Incorrect (wrong temperature)
    {"id": 50, "category": "General Knowledge", "question": "What is the freezing point of water at standard atmospheric pressure?",
     "reference_answer": "Water freezes at 0 degrees Celsius at standard atmospheric pressure.",
     "ai_response": "Water freezes at 32 degrees Celsius at standard atmospheric pressure.",
     "expected_verdict": "FAIL"},
]


def run_single_evaluation(test: dict, client: httpx.Client) -> dict:
    """Run a single evaluation and return enriched result."""
    payload = {
        "question": test["question"],
        "ai_response": test["ai_response"],
        "reference_answer": test["reference_answer"],
        "dataset": "veriai_benchmark",
        "top_k": 5,
    }
    try:
        r = client.post(f"{BASE_URL}/api/evaluate", json=payload, timeout=60.0)
        if r.status_code == 200:
            data = r.json()
            actual_verdict = data.get("verdict", "UNKNOWN")
            scores = data.get("scores", {})
            return {
                "id": test["id"],
                "category": test["category"],
                "question": test["question"][:60],
                "expected": test["expected_verdict"],
                "actual": actual_verdict,
                "match": actual_verdict == test["expected_verdict"],
                "overall_score": data.get("overallScore", 0),
                "accuracy": scores.get("accuracy", 0),
                "relevance": scores.get("relevance", 0),
                "hallucination_risk": scores.get("hallucinationRisk", 0),
                "completeness": scores.get("completeness", 0),
                "confidence": data.get("confidence", ""),
                "evidence_status": data.get("evidence_status", ""),
                "eval_id": data.get("id", ""),
                "error": None,
            }
        else:
            return {**{k: test[k] for k in ["id", "category", "question"]},
                    "expected": test["expected_verdict"], "actual": "ERROR",
                    "match": False, "overall_score": 0, "accuracy": 0,
                    "relevance": 0, "hallucination_risk": 0, "completeness": 0,
                    "confidence": "", "evidence_status": "", "eval_id": "",
                    "error": f"HTTP {r.status_code}: {r.text[:200]}"}
    except Exception as exc:
        return {**{k: test[k] for k in ["id", "category", "question"]},
                "expected": test["expected_verdict"], "actual": "ERROR",
                "match": False, "overall_score": 0, "accuracy": 0,
                "relevance": 0, "hallucination_risk": 0, "completeness": 0,
                "confidence": "", "evidence_status": "", "eval_id": "",
                "error": str(exc)[:200]}


def print_summary(results: list):
    """Print comprehensive validation summary."""
    total = len(results)
    correct_verdicts = sum(1 for r in results if r["match"])
    errors = sum(1 for r in results if r["error"])

    print("\n" + "=" * 70)
    print("  VERIAI FINAL BENCHMARK VALIDATION REPORT")
    print(f"  Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)

    print(f"\n{'ID':>3}  {'Category':<18} {'Expected':<8} {'Actual':<8} {'Score':>5} {'Acc':>4} {'Hall':>4} {'Match'}")
    print("-" * 70)
    for r in results:
        match_sym = "OK" if r["match"] else ("ERR" if r["error"] else "MISS")
        err = f" [{r['error'][:30]}]" if r["error"] else ""
        print(f"{r['id']:>3}  {r['category']:<18} {r['expected']:<8} {r['actual']:<8} "
              f"{r['overall_score']:>5} {r['accuracy']:>4} {r['hallucination_risk']:>4} "
              f"  {match_sym}{err}")

    print("\n" + "=" * 70)
    print(f"  OVERALL ACCURACY:       {correct_verdicts}/{total} = {correct_verdicts/total*100:.1f}%")
    print(f"  ERRORS:                 {errors}")
    print(f"  VERDICT MATCHES:        {correct_verdicts}")
    print(f"  VERDICT MISMATCHES:     {total - correct_verdicts - errors}")

    # Category breakdown
    print("\n  BY CATEGORY:")
    categories = {}
    for r in results:
        cat = r["category"]
        if cat not in categories:
            categories[cat] = {"total": 0, "match": 0}
        categories[cat]["total"] += 1
        if r["match"]:
            categories[cat]["match"] += 1
    for cat, stats in categories.items():
        acc = stats["match"] / stats["total"] * 100
        print(f"    {cat:<20}: {stats['match']}/{stats['total']} ({acc:.0f}%)")

    # Verdict type breakdown
    print("\n  BY EXPECTED VERDICT:")
    verdict_types = {}
    for r in results:
        ev = r["expected"]
        if ev not in verdict_types:
            verdict_types[ev] = {"total": 0, "match": 0}
        verdict_types[ev]["total"] += 1
        if r["match"]:
            verdict_types[ev]["match"] += 1
    for vt, stats in verdict_types.items():
        acc = stats["match"] / stats["total"] * 100
        print(f"    {vt:<10}: {stats['match']}/{stats['total']} ({acc:.0f}%)")

    # Score averages
    valid = [r for r in results if not r["error"]]
    if valid:
        avg_score = sum(r["overall_score"] for r in valid) / len(valid)
        avg_acc = sum(r["accuracy"] for r in valid) / len(valid)
        avg_hall = sum(r["hallucination_risk"] for r in valid) / len(valid)
        avg_comp = sum(r["completeness"] for r in valid) / len(valid)
        print(f"\n  AVERAGE SCORES (across {len(valid)} valid evaluations):")
        print(f"    Overall Score:        {avg_score:.1f}/100")
        print(f"    Accuracy:             {avg_acc:.1f}/100")
        print(f"    Hallucination Risk:   {avg_hall:.1f}/100 (lower is better)")
        print(f"    Completeness:         {avg_comp:.1f}/100")

    print("=" * 70)

    return {
        "total": total,
        "correct": correct_verdicts,
        "errors": errors,
        "accuracy_pct": round(correct_verdicts / total * 100, 1),
    }


def save_results(results: list, summary: dict):
    """Save results to CSV and JSON."""
    # Save CSV
    csv_path = "benchmark_validation_results.csv"
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        fieldnames = ["id", "category", "question", "expected", "actual", "match",
                      "overall_score", "accuracy", "relevance", "hallucination_risk",
                      "completeness", "confidence", "evidence_status", "eval_id", "error"]
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(results)
    print(f"\n  Results saved to: {csv_path}")

    # Save JSON
    json_path = "benchmark_validation_results.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump({"summary": summary, "results": results,
                   "generated_at": datetime.now().isoformat()}, f, indent=2)
    print(f"  Results saved to: {json_path}")


def main():
    print("VeriAI Final Benchmark Validation")
    print(f"Testing {len(BENCHMARK_TESTS)} questions against canonical ground truth...")
    print(f"Backend: {BASE_URL}\n")

    # Check backend health
    try:
        r = httpx.get(f"{BASE_URL}/api/health", timeout=5.0)
        assert r.status_code == 200
        print(f"Backend healthy: {r.json()}")
    except Exception as exc:
        print(f"Backend not reachable: {exc}")
        print("  Start the backend with: uvicorn backend.app.main:app --port 8000")
        return

    results = []
    with httpx.Client() as client:
        for i, test in enumerate(BENCHMARK_TESTS, 1):
            print(f"  [{i:2d}/50] Q{test['id']:2d} [{test['category']:<18}] "
                  f"Expected: {test['expected_verdict']:<6}", end=" ... ", flush=True)
            result = run_single_evaluation(test, client)
            results.append(result)
            status = "OK" if result["match"] else ("ERR" if result["error"] else "MISS")
            print(f"{status} Actual: {result['actual']} (Score: {result['overall_score']})")
            time.sleep(0.1)

    summary = print_summary(results)
    save_results(results, summary)

    print(f"\n  BENCHMARK VALIDATION COMPLETE.")
    print(f"  VeriAI detected {summary['correct']}/{summary['total']} verdicts correctly "
          f"({summary['accuracy_pct']}% accuracy).\n")


if __name__ == "__main__":
    main()

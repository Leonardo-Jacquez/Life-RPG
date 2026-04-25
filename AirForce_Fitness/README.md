# USAF Fitness Test Equivalence Analysis

Rigorous data-science comparison of the **legacy USAF PFA** (pre-1 Mar 2026)
vs the **PFRA 2026** — normalized for distance, weighting, and minimums.

---

## Core Hypothesis

The new test is **structurally harder** and does not follow the same difficulty
curve once normalized (pace in min/mi, % of component max, same raw performance held constant).

---

## Test Structures

| Component | Legacy PFA | PFRA 2026 |
|---|---|---|
| **Cardio** | 1.5-mi run or HAMR — **60 pts** | 2-mi run or HAMR — **50 pts** |
| **Strength** | Push-ups (1 min) — **20 pts** | Push-ups or HRPU (2 min) — **15 pts** |
| **Core** | Sit-ups (1 min) — **20 pts** | Sit-ups, CLRC, or Plank — **15 pts** |
| **Body comp** | Waist circumference (pass/fail, 0 pts) | WHtR (0–20 pts; >0.55 = auto-fail) |
| **Total** | 100 pts | 100 pts |
| **Pass** | ≥ 75 composite + component minimums | ≥ 75 composite + component minimums (cardio min = 35) |

---

## Normalization Approach

1. **Run**: converted to min/mi pace — same pace applied to 1.5-mi (legacy) and 2-mi (PFRA).
2. **Reps**: compared at the same absolute rep count.
3. **Weighted contribution**: `(raw / component_max) × composite_weight`
4. **Delta**: `PFRA_weighted − legacy_weighted`. Negative = PFRA harder.

---

## Verdicts

| Component | Verdict | Reason |
|---|---|---|
| Run | **HARDER** | Same pace → 2-mi takes 33% longer; weighted ceiling drops 60→50 |
| Strength | **EASIER** | Weight drops 20→15 pts; per-rep return falls ~25% |
| Core | **EASIER** | Same as strength |
| Body Comp | **STRUCTURALLY HARDER** | Legacy = 0 pts (binary only). PFRA = 20 live scored pts |
| Overall | **HARDER** | WHtR adds 20 pts of structured jeopardy that did not exist |

---

## Quick Start

```bash
pip install -r requirements.txt
python run_analysis.py                           # Male, 30-34, defaults
python run_analysis.py --gender F --age 25-29
python run_analysis.py --gender M --age 35-39 --pace 8.5 --pushups 42 --situps 45 --whtr 0.48

"""
WHtR (Waist-to-Height Ratio) scoring for PFRA 2026.

Source: PFRA Scoring Charts (AFPC, effective 1 Mar 2026) — ✅ ALL CONFIRMED
        DAFMAN 36-2905 (24 Mar 2026)

Scoring (age-agnostic, gender-agnostic, STEPPED — not linear):
  ≤ 0.49 → 20.0 pts          0.55 → 12.5 pts
    0.50 → 19.0 pts          0.56 → 10.0 pts
    0.51 → 18.0 pts          0.57 →  7.5 pts
    0.52 → 17.0 pts          0.58 →  5.0 pts
    0.53 → 16.0 pts          0.59 →  2.5 pts
    0.54 → 15.0 pts        ≥ 0.60 →  0.0 pts

Important DAFMAN rules:
  - Body Composition has NO component minimum requirement (DAFMAN 3.7.1).
  - WHtR > 0.55 is NOT an automatic test failure. If the member's overall
    PFRA is Unsatisfactory AND WHtR > 0.55, they complete a Body Fat
    Assessment (BFA) using a secondary method and enter a body composition
    remedial program (DAFMAN Summary of Changes).
  - BFA failure (NOT WHtR alone) results in an Unsatisfactory PFRA score
    (DAFMAN 3.7.2).

Legacy PFA used waist circumference as a binary pass/fail gate for active
duty (not scored). ANG members had no body-comp component at all.
"""

WHTR_MAX_PTS = 20.0
WHTR_MAX_RATIO = 0.49      # ≤ this → 20 pts
WHTR_ZERO_RATIO = 0.60     # ≥ this → 0 pts
WHTR_BFA_TRIGGER = 0.55    # > this + Unsat PFRA → BFA + remedial program

# Stepped lookup: (upper_bound_ratio, points). First match where ratio <= upper wins.
_WHTR_TABLE = [
    (0.49, 20.0),
    (0.50, 19.0),
    (0.51, 18.0),
    (0.52, 17.0),
    (0.53, 16.0),
    (0.54, 15.0),
    (0.55, 12.5),
    (0.56, 10.0),
    (0.57,  7.5),
    (0.58,  5.0),
    (0.59,  2.5),
]


def score_whtr(ratio: float) -> float:
    """Return WHtR component points (0–20) per the PFRA stepped scoring table."""
    for upper, pts in _WHTR_TABLE:
        if ratio <= upper + 1e-9:
            return pts
    return 0.0  # ≥ 0.60


def triggers_bfa(ratio: float, pfra_unsatisfactory: bool) -> bool:
    """Returns True if member must complete BFA per DAFMAN 36-2905."""
    return ratio > WHTR_BFA_TRIGGER and pfra_unsatisfactory


def whtr_from_measurements(waist_in: float, height_in: float) -> float:
    return waist_in / height_in


def score_table(step: float = 0.01) -> list[tuple[float, float]]:
    """Return list of (ratio, points) for the 0.40–0.61 range."""
    rows = []
    ratio = 0.40
    while ratio <= 0.605:
        rows.append((round(ratio, 3), score_whtr(round(ratio, 3))))
        ratio += step
    return rows

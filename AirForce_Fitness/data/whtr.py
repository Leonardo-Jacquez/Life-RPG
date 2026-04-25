"""
WHtR (Waist-to-Height Ratio) scoring for PFRA 2026.

Confirmed calibration points:
  0.49 -> 20.0 pts
  0.52 -> 17.0 pts  (36" waist / 69" height example)
  Slope = -100 pts per unit WHtR
  Auto-fail at >0.55 is a separate pass/fail condition from the scoring curve.
  Legacy PFA: waist circumference was binary pass/fail only (0 scored pts; not applicable for ANG).
"""

WHTR_MAX_RATIO  = 0.49
WHTR_FAIL_RATIO = 0.55
WHTR_ZERO_RATIO = 0.69   # DERIVED: slope zero-crossing
WHTR_MAX_PTS    = 20.0
_SLOPE          = -100.0


def score_whtr(ratio: float) -> float:
    if ratio <= WHTR_MAX_RATIO:
        return WHTR_MAX_PTS
    return round(max(0.0, WHTR_MAX_PTS + _SLOPE * (ratio - WHTR_MAX_RATIO)), 2)


def is_autofail(ratio: float) -> bool:
    return ratio > WHTR_FAIL_RATIO


def whtr_from_measurements(waist_in: float, height_in: float) -> float:
    return waist_in / height_in


def score_table(step: float = 0.005) -> list:
    rows, ratio = [], 0.40
    while ratio <= 0.605:
        rows.append((round(ratio, 3), score_whtr(round(ratio, 3))))
        ratio += step
    return rows

"""
USAF Fitness Test constants — weights, age groups, thresholds.

Sources (authoritative, effective 1 Mar 2026):
  DAFMAN 36-2905 (24 Mar 2026):
    https://static.e-publishing.af.mil/production/1/af_a1/publication/afman36-2905/dafman36-2905.pdf
  PFRA Scoring Charts (AFPC):
    https://www.afpc.af.mil/Portals/70/documents/FITNESS/PFRA%20Scoring%20Charts.pdf
  Legacy PFA Score Chart (AFROTC Utah mirror):
    https://afrotc.utah.edu/_resources/documents/pfa_score_chart.pdf
"""

AGE_GROUPS = ["<25", "25-29", "30-34", "35-39", "40-44", "45-49", "50-54", "55-59", "60+"]

GENDERS = ["M", "F"]

# ---------------------------------------------------------------------------
# Legacy PFA (pre-1 Mar 2026) — 60/20/20 split
# Body comp (waist circumference) is pass/fail for active duty; NOT scored for ANG.
# ---------------------------------------------------------------------------
LEGACY_WEIGHTS = {
    "cardio": 60,
    "strength": 20,
    "core": 20,
}
LEGACY_MAX_COMPOSITE = 100
LEGACY_PASS_COMPOSITE = 75

# Minimum raw component scores to avoid auto-fail (legacy)
LEGACY_COMPONENT_MINIMUMS = {
    "cardio": 0.0,    # below-min time = unsatisfactory regardless of composite
    "strength": 0.0,
    "core": 0.0,
}

# ---------------------------------------------------------------------------
# PFRA 2026 (effective 1 Mar 2026) — 50/15/15/20 split
# ---------------------------------------------------------------------------
PFRA_WEIGHTS = {
    "cardio": 50,
    "strength": 15,
    "core": 15,
    "body_comp": 20,
}
PFRA_MAX_COMPOSITE = 100
PFRA_PASS_COMPOSITE = 75

# Minimum raw component scores (PFRA) per DAFMAN 36-2905 §3.7.1
# Body comp has NO component minimum requirement (always counted in composite).
PFRA_COMPONENT_MINIMUMS = {
    "cardio": 35.0,
    "strength": 2.5,
    "core": 2.5,
    "body_comp": None,  # NO minimum per DAFMAN
}

# WHtR thresholds (age/gender agnostic) per PFRA Scoring Charts
WHTR_MAX_RATIO  = 0.49   # ≤ this → 20.0 pts (maximum)
WHTR_ZERO_RATIO = 0.60   # ≥ this → 0.0 pts
WHTR_BFA_TRIGGER = 0.55  # > this + Unsat PFRA → BFA + remedial program (NOT auto-fail)

# ---------------------------------------------------------------------------
# Cardio event distances
# ---------------------------------------------------------------------------
LEGACY_RUN_MILES = 1.5
PFRA_RUN_MILES = 2.0

# 20m HAMR shuttle length in meters
HAMR_SHUTTLE_METERS = 20.0

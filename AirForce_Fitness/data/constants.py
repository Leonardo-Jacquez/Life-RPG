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

LEGACY_WEIGHTS = {"cardio": 60, "strength": 20, "core": 20}
LEGACY_MAX_COMPOSITE = 100
LEGACY_PASS_COMPOSITE = 75
LEGACY_COMPONENT_MINIMUMS = {"cardio": 0.0, "strength": 0.0, "core": 0.0}

PFRA_WEIGHTS = {"cardio": 50, "strength": 15, "core": 15, "body_comp": 20}
PFRA_MAX_COMPOSITE = 100
PFRA_PASS_COMPOSITE = 75
PFRA_COMPONENT_MINIMUMS = {"cardio": 35.0, "strength": 2.5, "core": 2.5, "body_comp": 0.0}

WHTR_MAX_RATIO  = 0.49
WHTR_FAIL_RATIO = 0.55
LEGACY_RUN_MILES = 1.5
PFRA_RUN_MILES   = 2.0
HAMR_SHUTTLE_METERS = 20.0

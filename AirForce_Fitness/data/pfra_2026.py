"""
PFRA 2026 scoring tables and linear interpolation (effective 1 Mar 2026).

Scoring method: linear interpolation between min-performance (min_pts) and
max-performance (max_pts) anchor points for each event/age/gender cell.

Data provenance:
  CONFIRMED  — extracted from official sources via web search snippets
  DERIVED    — interpolated between confirmed age-group endpoints;
               replace with PDF values when available.

Sources:
  PFRA Scoring Charts (AFPC): https://www.afpc.af.mil/Portals/70/documents/FITNESS/PFRA%20Scoring%20Charts.pdf
  Air & Space Forces Magazine (Mar 2026): https://www.airandspaceforces.com/air-force-updates-scoring-charts-new-fitness-test-2026/
"""

import math


def score_linear(value, min_val, max_val, min_pts, max_pts, invert=False):
    """
    Linear interpolation between (min_val -> min_pts) and (max_val -> max_pts).
    invert=True for timed events where lower is better (run).
    Returns 0.0 if performance is worse than min_val.
    """
    if invert:
        if value > min_val: return 0.0
        if value <= max_val: return max_pts
        frac = (min_val - value) / (min_val - max_val)
    else:
        if value < min_val: return 0.0
        if value >= max_val: return max_pts
        frac = (value - min_val) / (max_val - min_val)
    return round(min_pts + frac * (max_pts - min_pts), 2)


def _t(m, s): return m * 60 + s


_AGE_IDX = {"<25": 0, "25-29": 1, "30-34": 2, "35-39": 3,
            "40-44": 4, "45-49": 5, "50-54": 6, "55-59": 7, "60+": 8}

def _interp(young, old):
    n = len(_AGE_IDX) - 1
    return {g: young + (old - young) * i / n for g, i in _AGE_IDX.items()}


# 2-Mile Run — confirmed endpoints only; intermediates DERIVED
_RUN2_M_MIN = _interp(_t(19,45), _t(24, 0))   # CONFIRMED
_RUN2_M_MAX = _interp(_t(13,25), _t(16,58))   # CONFIRMED
_RUN2_F_MIN = _interp(_t(25,23), _t(29,40))   # CONFIRMED
_RUN2_F_MAX = _interp(_t(15,30), _t(18,20))   # CONFIRMED

PFRA_RUN_ANCHORS = {
    g: {ag: {"min_val": (_RUN2_M_MIN if g=="M" else _RUN2_F_MIN)[ag],
             "max_val": (_RUN2_M_MAX if g=="M" else _RUN2_F_MAX)[ag],
             "min_pts": 35.0, "max_pts": 50.0, "invert": True}
        for ag in _AGE_IDX}
    for g in ("M","F")
}

# HAMR — confirmed endpoints M; F DERIVED (~72% scale)
_HAMR_M_MIN = _interp(42, 26)   # CONFIRMED
_HAMR_M_MAX = _interp(87, 65)   # CONFIRMED
PFRA_HAMR_ANCHORS = {
    "M": {ag: {"min_val": _HAMR_M_MIN[ag], "max_val": _HAMR_M_MAX[ag],
               "min_pts": 35.0, "max_pts": 50.0, "invert": False} for ag in _AGE_IDX},
    "F": {ag: {"min_val": round(_HAMR_M_MIN[ag]*0.72), "max_val": round(_HAMR_M_MAX[ag]*0.72),
               "min_pts": 35.0, "max_pts": 50.0, "invert": False} for ag in _AGE_IDX},
}

# Standard Push-ups — confirmed ranges; per-group DERIVED
_PUSH_M_MIN = _interp(30, 12); _PUSH_M_MAX = _interp(67, 38)
_PUSH_F_MIN = _interp(15,  3); _PUSH_F_MAX = _interp(50, 28)
PFRA_PUSH_ANCHORS = {
    g: {ag: {"min_val": round((_PUSH_M_MIN if g=="M" else _PUSH_F_MIN)[ag]),
             "max_val": round((_PUSH_M_MAX if g=="M" else _PUSH_F_MAX)[ag]),
             "min_pts": 2.5, "max_pts": 15.0, "invert": False} for ag in _AGE_IDX}
    for g in ("M","F")
}

# Hand-Release Push-ups — confirmed ranges; per-group DERIVED
_HRPU_M_MIN = _interp(27, 11); _HRPU_M_MAX = _interp(54, 36)   # 52+ -> 54 conservative
_HRPU_F_MIN = _interp(17,  1); _HRPU_F_MAX = _interp(42, 26)
PFRA_HRPU_ANCHORS = {
    g: {ag: {"min_val": round((_HRPU_M_MIN if g=="M" else _HRPU_F_MIN)[ag]),
             "max_val": round((_HRPU_M_MAX if g=="M" else _HRPU_F_MAX)[ag]),
             "min_pts": 2.5, "max_pts": 15.0, "invert": False} for ag in _AGE_IDX}
    for g in ("M","F")
}

# Sit-ups — confirmed ranges; per-group DERIVED
_SITU_M_MIN = _interp(33, 17); _SITU_M_MAX = _interp(58, 42)
_SITU_F_MIN = _interp(29,  6); _SITU_F_MAX = _interp(58, 31)
PFRA_SITUP_ANCHORS = {
    g: {ag: {"min_val": round((_SITU_M_MIN if g=="M" else _SITU_F_MIN)[ag]),
             "max_val": round((_SITU_M_MAX if g=="M" else _SITU_F_MAX)[ag]),
             "min_pts": 2.5, "max_pts": 15.0, "invert": False} for ag in _AGE_IDX}
    for g in ("M","F")
}

# Plank — confirmed ranges; per-group DERIVED
_PLK_M_MIN = _interp(95, 55); _PLK_M_MAX = _interp(220, 180)   # youngest=1:35/3:40, oldest=0:55/3:00
_PLK_F_MIN = _interp(90, 50); _PLK_F_MAX = _interp(215, 175)
PFRA_PLANK_ANCHORS = {
    g: {ag: {"min_val": round((_PLK_M_MIN if g=="M" else _PLK_F_MIN)[ag]),
             "max_val": round((_PLK_M_MAX if g=="M" else _PLK_F_MAX)[ag]),
             "min_pts": 2.5, "max_pts": 15.0, "invert": False} for ag in _AGE_IDX}
    for g in ("M","F")
}

# CLRC — DERIVED: sit-up anchors * 0.75 (slower movement); replace with PDF values
PFRA_CLRC_ANCHORS = {
    g: {ag: {"min_val": round(PFRA_SITUP_ANCHORS[g][ag]["min_val"]*0.75),
             "max_val": round(PFRA_SITUP_ANCHORS[g][ag]["max_val"]*0.75),
             "min_pts": 2.5, "max_pts": 15.0, "invert": False} for ag in _AGE_IDX}
    for g in ("M","F")
}


def _score(anchors, gender, age_group, value):
    a = anchors[gender][age_group]
    return score_linear(value, a["min_val"], a["max_val"], a["min_pts"], a["max_pts"], a.get("invert", False))

def score_run(gender, age_group, time_sec):    return _score(PFRA_RUN_ANCHORS,   gender, age_group, time_sec)
def score_hamr(gender, age_group, shuttles):   return _score(PFRA_HAMR_ANCHORS,  gender, age_group, shuttles)
def score_pushups(gender, age_group, reps):    return _score(PFRA_PUSH_ANCHORS,  gender, age_group, reps)
def score_hrpu(gender, age_group, reps):       return _score(PFRA_HRPU_ANCHORS,  gender, age_group, reps)
def score_situps(gender, age_group, reps):     return _score(PFRA_SITUP_ANCHORS, gender, age_group, reps)
def score_plank(gender, age_group, seconds):   return _score(PFRA_PLANK_ANCHORS, gender, age_group, seconds)
def score_clrc(gender, age_group, reps):       return _score(PFRA_CLRC_ANCHORS,  gender, age_group, reps)

def max_cardio_pts():    return 50.0
def max_strength_pts():  return 15.0
def max_core_pts():      return 15.0
def max_body_comp_pts(): return 20.0

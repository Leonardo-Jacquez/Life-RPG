"""
Composite score calculators for both test systems.

Returns dict with keys:
  components, weighted, composite, passing, autofail
"""

from data import legacy_pfa, pfra_2026
from data.whtr import score_whtr, is_autofail
from data.constants import (
    LEGACY_WEIGHTS, LEGACY_PASS_COMPOSITE,
    PFRA_WEIGHTS, PFRA_PASS_COMPOSITE,
    PFRA_COMPONENT_MINIMUMS, WHTR_FAIL_RATIO,
)


def calc_legacy_score(gender, age_group, run_time_sec, pushups, situps):
    cr = legacy_pfa.score_run(gender, age_group, run_time_sec)
    sr = legacy_pfa.score_pushups(gender, age_group, pushups)
    cor = legacy_pfa.score_situps(gender, age_group, situps)
    w = LEGACY_WEIGHTS
    cw = (cr / 60.0) * w["cardio"]
    sw = (sr / 20.0) * w["strength"]
    ow = (cor / 20.0) * w["core"]
    comp = cw + sw + ow
    af = "cardio below minimum" if cr == 0.0 else None
    return {
        "components": {"cardio": cr, "strength": sr, "core": cor},
        "weighted":   {"cardio": round(cw,2), "strength": round(sw,2), "core": round(ow,2)},
        "composite":  round(comp, 2),
        "passing":    af is None and comp >= LEGACY_PASS_COMPOSITE,
        "autofail":   af,
    }


def calc_pfra_score(gender, age_group, cardio_value, strength_value, core_value, whtr,
                   cardio_event="run", strength_event="pushups", core_event="situps"):
    if cardio_event == "run":      cr = pfra_2026.score_run(gender, age_group, cardio_value)
    else:                          cr = pfra_2026.score_hamr(gender, age_group, int(cardio_value))

    if strength_event == "pushups": sr = pfra_2026.score_pushups(gender, age_group, int(strength_value))
    else:                           sr = pfra_2026.score_hrpu(gender, age_group, int(strength_value))

    if core_event == "situps":  cor = pfra_2026.score_situps(gender, age_group, int(core_value))
    elif core_event == "plank": cor = pfra_2026.score_plank(gender, age_group, core_value)
    else:                       cor = pfra_2026.score_clrc(gender, age_group, int(core_value))

    bc = score_whtr(whtr)
    af = f"WHtR {whtr:.3f} > {WHTR_FAIL_RATIO} auto-fail" if is_autofail(whtr) else None
    w = PFRA_WEIGHTS
    cw  = (cr  / 50.0) * w["cardio"]
    sw  = (sr  / 15.0) * w["strength"]
    ow  = (cor / 15.0) * w["core"]
    bcw = (bc  / 20.0) * w["body_comp"]
    comp = cw + sw + ow + bcw

    if af is None:
        if cr  < PFRA_COMPONENT_MINIMUMS["cardio"]:   af = f"cardio {cr:.1f} < min"
        elif sr < PFRA_COMPONENT_MINIMUMS["strength"]: af = f"strength {sr:.1f} < min"
        elif cor< PFRA_COMPONENT_MINIMUMS["core"]:     af = f"core {cor:.1f} < min"

    return {
        "components": {"cardio": cr, "strength": sr, "core": cor, "body_comp": bc},
        "weighted":   {"cardio": round(cw,2), "strength": round(sw,2),
                       "core": round(ow,2), "body_comp": round(bcw,2)},
        "composite":  round(comp, 2),
        "passing":    af is None and comp >= PFRA_PASS_COMPOSITE,
        "autofail":   af,
        "events":     {"cardio": cardio_event, "strength": strength_event, "core": core_event},
    }

"""Cross-system equivalence analysis."""

import numpy as np
import pandas as pd

from analysis.normalize import (
    pace_per_mile, pace_to_mmss,
    legacy_time_from_pace, pfra_time_from_pace,
    hamr_to_pace_min_mi, weighted_score,
)
from analysis.scoring import calc_legacy_score, calc_pfra_score
from data import legacy_pfa, pfra_2026
from data.whtr import score_whtr, WHTR_MAX_RATIO, WHTR_FAIL_RATIO
from data.constants import LEGACY_WEIGHTS, PFRA_WEIGHTS

VERDICT_THRESHOLD = 0.5


def _verdict(delta_series, threshold=VERDICT_THRESHOLD):
    mean_d   = delta_series.mean()
    median_d = delta_series.median()
    if abs(mean_d) <= threshold:  label = "EQUIVALENT"
    elif mean_d < 0:              label = "HARDER"
    else:                         label = "EASIER"
    return {
        "verdict":      label,
        "mean_delta":   round(mean_d,   3),
        "median_delta": round(median_d, 3),
        "min_delta":    round(delta_series.min(), 3),
        "max_delta":    round(delta_series.max(), 3),
    }


def run_equivalence_curve(gender, age_group, pace_min_mi_range=(6.0, 14.0), n_points=200):
    paces = np.linspace(pace_min_mi_range[0], pace_min_mi_range[1], n_points)
    rows = []
    for pace in paces:
        legacy_sec = legacy_time_from_pace(pace)
        pfra_sec   = pfra_time_from_pace(pace)
        legacy_raw = legacy_pfa.score_run(gender, age_group, legacy_sec)
        pfra_raw   = pfra_2026.score_run(gender, age_group, pfra_sec)
        legacy_w   = (legacy_raw / 60.0) * LEGACY_WEIGHTS["cardio"]
        pfra_w     = (pfra_raw   / 50.0) * PFRA_WEIGHTS["cardio"]
        rows.append({
            "pace_min_mi":         round(pace, 3),
            "pace_label":          pace_to_mmss(pace),
            "legacy_time_1_5mi_s": round(legacy_sec),
            "pfra_time_2mi_s":     round(pfra_sec),
            "legacy_cardio_raw":   legacy_raw,
            "pfra_cardio_raw":     pfra_raw,
            "legacy_cardio_wtd":   round(legacy_w, 2),
            "pfra_cardio_wtd":     round(pfra_w, 2),
            "delta_wtd":           round(pfra_w - legacy_w, 2),
        })
    df = pd.DataFrame(rows)
    return df, _verdict(df["delta_wtd"])


def strength_equivalence_curve(gender, age_group):
    legacy_anchor = legacy_pfa.LEGACY_PUSHUPS[gender][age_group]
    max_reps  = legacy_anchor[0][0]
    pfra_max  = pfra_2026.PFRA_PUSH_ANCHORS[gender][age_group]["max_val"]
    shared_max = min(max_reps, pfra_max)
    rows = []
    for reps in range(1, int(shared_max) + 1):
        legacy_raw = legacy_pfa.score_pushups(gender, age_group, reps)
        pfra_raw   = pfra_2026.score_pushups(gender, age_group, reps)
        legacy_w   = (legacy_raw / 20.0) * LEGACY_WEIGHTS["strength"]
        pfra_w     = (pfra_raw   / 15.0) * PFRA_WEIGHTS["strength"]
        rows.append({
            "reps":                reps,
            "legacy_strength_raw": legacy_raw,
            "pfra_strength_raw":   pfra_raw,
            "legacy_strength_wtd": round(legacy_w, 2),
            "pfra_strength_wtd":   round(pfra_w, 2),
            "delta_wtd":           round(pfra_w - legacy_w, 2),
        })
    df = pd.DataFrame(rows)
    return df, _verdict(df["delta_wtd"])


def core_equivalence_curve(gender, age_group):
    legacy_anchor = legacy_pfa.LEGACY_SITUPS[gender][age_group]
    max_reps  = legacy_anchor[0][0]
    pfra_max  = pfra_2026.PFRA_SITUP_ANCHORS[gender][age_group]["max_val"]
    shared_max = min(max_reps, pfra_max)
    rows = []
    for reps in range(1, int(shared_max) + 1):
        legacy_raw = legacy_pfa.score_situps(gender, age_group, reps)
        pfra_raw   = pfra_2026.score_situps(gender, age_group, reps)
        legacy_w   = (legacy_raw / 20.0) * LEGACY_WEIGHTS["core"]
        pfra_w     = (pfra_raw   / 15.0) * PFRA_WEIGHTS["core"]
        rows.append({
            "reps":            reps,
            "legacy_core_raw": legacy_raw,
            "pfra_core_raw":   pfra_raw,
            "legacy_core_wtd": round(legacy_w, 2),
            "pfra_core_wtd":   round(pfra_w, 2),
            "delta_wtd":       round(pfra_w - legacy_w, 2),
        })
    df = pd.DataFrame(rows)
    return df, _verdict(df["delta_wtd"])


def body_comp_comparison():
    rows = []
    for ratio in np.arange(0.40, 0.61, 0.005):
        ratio = round(ratio, 3)
        pfra_pts  = score_whtr(ratio)
        rows.append({
            "whtr":             ratio,
            "legacy_pts":       0.0,
            "legacy_pass":      ratio <= 0.55,
            "pfra_pts":         pfra_pts,
            "pfra_autofail":    ratio > WHTR_FAIL_RATIO,
            "structural_gain":  pfra_pts,
        })
    df = pd.DataFrame(rows)
    verdict = {
        "verdict": "STRUCTURALLY HARDER",
        "reason": (
            "Legacy body comp contributes 0 pts to composite (binary gate only). "
            "PFRA WHtR contributes up to 20 pts — scoreable regardless of other events. "
            f"Auto-fail threshold identical (WHtR > {WHTR_FAIL_RATIO})."
        ),
        "max_pfra_gain": 20.0,
        "max_pfra_loss": 20.0,
    }
    return df, verdict


def composite_equivalence(gender, age_group, run_pace_min_mi, pushups, situps, whtr,
                           cardio_event="run", strength_event="pushups", core_event="situps"):
    legacy_sec = legacy_time_from_pace(run_pace_min_mi)
    pfra_sec   = pfra_time_from_pace(run_pace_min_mi)
    legacy = calc_legacy_score(gender, age_group, legacy_sec, pushups, situps)
    pfra   = calc_pfra_score(
        gender, age_group,
        pfra_sec, pushups, situps, whtr,
        cardio_event, strength_event, core_event,
    )
    return {
        "inputs": {
            "gender": gender, "age_group": age_group,
            "pace_min_mi": run_pace_min_mi,
            "pushups": pushups, "situps": situps, "whtr": whtr,
        },
        "legacy":          legacy,
        "pfra":            pfra,
        "composite_delta": round(pfra["composite"] - legacy["composite"], 2),
        "verdict": (
            "HARDER"     if pfra["composite"] < legacy["composite"] - VERDICT_THRESHOLD else
            "EASIER"     if pfra["composite"] > legacy["composite"] + VERDICT_THRESHOLD else
            "EQUIVALENT"
        ),
    }


def hamr_vs_run_equivalence(gender, age_group, shuttle_range=(20, 90)):
    rows = []
    for shuttles in range(shuttle_range[0], shuttle_range[1] + 1):
        hamr_pts = pfra_2026.score_hamr(gender, age_group, shuttles)
        pace     = hamr_to_pace_min_mi(shuttles)
        run_sec  = pfra_time_from_pace(pace)
        run_pts  = pfra_2026.score_run(gender, age_group, run_sec)
        rows.append({
            "shuttles":        shuttles,
            "est_pace_min_mi": round(pace, 3),
            "est_pace_label":  pace_to_mmss(pace),
            "hamr_pts":        hamr_pts,
            "run_pts_equiv":   run_pts,
            "delta":           round(hamr_pts - run_pts, 2),
        })
    return pd.DataFrame(rows)

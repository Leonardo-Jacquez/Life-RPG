"""
Bang-for-buck analysis: marginal composite points per unit of training effort.

Effort units:
  Run     : 0.5 min/mi pace improvement
  Push-ups: 5 reps
  Sit-ups : 5 reps
  Plank   : 15 seconds
  WHtR    : 0.02 ratio improvement
"""

import numpy as np
import pandas as pd

from analysis.normalize import pfra_time_from_pace, legacy_time_from_pace, pace_per_mile
from data import legacy_pfa, pfra_2026
from data.whtr import score_whtr
from data.constants import PFRA_WEIGHTS, LEGACY_WEIGHTS


def marginal_pts_run_pfra(gender, age_group, pace_range=(7.0, 13.0), step_min_mi=0.5):
    paces = np.arange(pace_range[0], pace_range[1] + step_min_mi, step_min_mi)
    rows, prev_wtd = [], None
    for pace in paces:
        raw = pfra_2026.score_run(gender, age_group, pfra_time_from_pace(pace))
        wtd = (raw / 50.0) * PFRA_WEIGHTS["cardio"]
        rows.append({
            "pace_min_mi":         round(pace, 2),
            "pfra_run_raw":        raw,
            "pfra_run_wtd":        round(wtd, 2),
            "marginal_per_min_mi": round(prev_wtd - wtd, 3) if prev_wtd is not None else None,
        })
        prev_wtd = wtd
    return pd.DataFrame(rows)


def marginal_pts_run_legacy(gender, age_group, pace_range=(7.0, 13.0), step_min_mi=0.5):
    paces = np.arange(pace_range[0], pace_range[1] + step_min_mi, step_min_mi)
    rows, prev_wtd = [], None
    for pace in paces:
        raw = legacy_pfa.score_run(gender, age_group, legacy_time_from_pace(pace))
        wtd = (raw / 60.0) * LEGACY_WEIGHTS["cardio"]
        rows.append({
            "pace_min_mi":         round(pace, 2),
            "legacy_run_raw":      raw,
            "legacy_run_wtd":      round(wtd, 2),
            "marginal_per_min_mi": round(prev_wtd - wtd, 3) if prev_wtd is not None else None,
        })
        prev_wtd = wtd
    return pd.DataFrame(rows)


def marginal_pts_pushups_pfra(gender, age_group):
    max_reps = int(pfra_2026.PFRA_PUSH_ANCHORS[gender][age_group]["max_val"]) + 5
    rows, prev_wtd = [], None
    for reps in range(0, max_reps + 1):
        raw = pfra_2026.score_pushups(gender, age_group, reps)
        wtd = (raw / 15.0) * PFRA_WEIGHTS["strength"]
        rows.append({"reps": reps, "pfra_push_raw": raw, "pfra_push_wtd": round(wtd, 2),
                     "marginal_per_rep": round(wtd - prev_wtd, 3) if prev_wtd is not None else None})
        prev_wtd = wtd
    return pd.DataFrame(rows)


def marginal_pts_pushups_legacy(gender, age_group):
    max_reps = legacy_pfa.LEGACY_PUSHUPS[gender][age_group][0][0]
    rows, prev_wtd = [], None
    for reps in range(0, max_reps + 1):
        raw = legacy_pfa.score_pushups(gender, age_group, reps)
        wtd = (raw / 20.0) * LEGACY_WEIGHTS["strength"]
        rows.append({"reps": reps, "legacy_push_raw": raw, "legacy_push_wtd": round(wtd, 2),
                     "marginal_per_rep": round(wtd - prev_wtd, 3) if prev_wtd is not None else None})
        prev_wtd = wtd
    return pd.DataFrame(rows)


def marginal_pts_situps_pfra(gender, age_group):
    max_reps = int(pfra_2026.PFRA_SITUP_ANCHORS[gender][age_group]["max_val"]) + 5
    rows, prev_wtd = [], None
    for reps in range(0, max_reps + 1):
        raw = pfra_2026.score_situps(gender, age_group, reps)
        wtd = (raw / 15.0) * PFRA_WEIGHTS["core"]
        rows.append({"reps": reps, "pfra_situ_raw": raw, "pfra_situ_wtd": round(wtd, 2),
                     "marginal_per_rep": round(wtd - prev_wtd, 3) if prev_wtd is not None else None})
        prev_wtd = wtd
    return pd.DataFrame(rows)


def marginal_pts_plank_pfra(gender, age_group, step_sec=5):
    max_sec = int(pfra_2026.PFRA_PLANK_ANCHORS[gender][age_group]["max_val"]) + 15
    rows, prev_wtd = [], None
    for sec in range(0, max_sec + 1, step_sec):
        raw = pfra_2026.score_plank(gender, age_group, sec)
        wtd = (raw / 15.0) * PFRA_WEIGHTS["core"]
        rows.append({"seconds": sec, "pfra_plank_raw": raw, "pfra_plank_wtd": round(wtd, 2),
                     "marginal_per_5sec": round(wtd - prev_wtd, 3) if prev_wtd is not None else None})
        prev_wtd = wtd
    return pd.DataFrame(rows)


def marginal_pts_whtr_pfra(whtr_range=(0.40, 0.60), step=0.01):
    ratios = np.arange(whtr_range[0], whtr_range[1] + step, step)
    rows, prev_wtd = [], None
    for ratio in ratios:
        ratio = round(ratio, 3)
        raw = score_whtr(ratio)
        wtd = (raw / 20.0) * PFRA_WEIGHTS["body_comp"]
        rows.append({"whtr": ratio, "pfra_bc_raw": raw, "pfra_bc_wtd": round(wtd, 2),
                     "marginal_per_001": round(wtd - prev_wtd, 3) if prev_wtd is not None else None})
        prev_wtd = wtd
    df = pd.DataFrame(rows)
    df["marginal_per_001_improvement"] = -df["marginal_per_001"]
    return df


def rank_events_by_roi(gender, age_group, current_run_pace=9.0, current_pushups=30,
                       current_situps=35, current_plank_sec=90, current_whtr=0.51):
    results = []

    pace_better = current_run_pace - 0.5
    raw_now  = pfra_2026.score_run(gender, age_group, pfra_time_from_pace(current_run_pace))
    raw_next = pfra_2026.score_run(gender, age_group, pfra_time_from_pace(pace_better))
    results.append({"event": "2-Mile Run", "component": "cardio",
                    "effort_unit": "0.5 min/mi faster", "current_perf": f"{current_run_pace:.1f} min/mi",
                    "pts_gain": round(((raw_next - raw_now) / 50.0) * PFRA_WEIGHTS["cardio"], 3), "roi_rank": None})

    raw_now  = pfra_2026.score_pushups(gender, age_group, current_pushups)
    raw_next = pfra_2026.score_pushups(gender, age_group, current_pushups + 5)
    results.append({"event": "Push-ups (std)", "component": "strength",
                    "effort_unit": "+5 reps", "current_perf": f"{current_pushups} reps",
                    "pts_gain": round(((raw_next - raw_now) / 15.0) * PFRA_WEIGHTS["strength"], 3), "roi_rank": None})

    raw_now  = pfra_2026.score_hrpu(gender, age_group, current_pushups)
    raw_next = pfra_2026.score_hrpu(gender, age_group, current_pushups + 5)
    results.append({"event": "Hand-Release Push-ups", "component": "strength",
                    "effort_unit": "+5 reps", "current_perf": f"{current_pushups} reps",
                    "pts_gain": round(((raw_next - raw_now) / 15.0) * PFRA_WEIGHTS["strength"], 3), "roi_rank": None})

    raw_now  = pfra_2026.score_situps(gender, age_group, current_situps)
    raw_next = pfra_2026.score_situps(gender, age_group, current_situps + 5)
    results.append({"event": "Sit-ups", "component": "core",
                    "effort_unit": "+5 reps", "current_perf": f"{current_situps} reps",
                    "pts_gain": round(((raw_next - raw_now) / 15.0) * PFRA_WEIGHTS["core"], 3), "roi_rank": None})

    raw_now  = pfra_2026.score_plank(gender, age_group, current_plank_sec)
    raw_next = pfra_2026.score_plank(gender, age_group, current_plank_sec + 15)
    results.append({"event": "Plank", "component": "core",
                    "effort_unit": "+15 sec", "current_perf": f"{current_plank_sec}s",
                    "pts_gain": round(((raw_next - raw_now) / 15.0) * PFRA_WEIGHTS["core"], 3), "roi_rank": None})

    raw_now  = score_whtr(current_whtr)
    raw_next = score_whtr(round(current_whtr - 0.02, 3))
    results.append({"event": "WHtR (body comp)", "component": "body_comp",
                    "effort_unit": "−0.02 ratio", "current_perf": f"{current_whtr:.3f}",
                    "pts_gain": round(((raw_next - raw_now) / 20.0) * PFRA_WEIGHTS["body_comp"], 3), "roi_rank": None})

    df = pd.DataFrame(results).sort_values("pts_gain", ascending=False).reset_index(drop=True)
    df["roi_rank"] = df.index + 1
    return df


def optimal_event_selection(gender, age_group, pushup_reps, hrpu_reps, situp_reps, plank_sec, clrc_reps):
    push_pts = pfra_2026.score_pushups(gender, age_group, pushup_reps)
    hrpu_pts = pfra_2026.score_hrpu(gender, age_group, hrpu_reps)
    best_strength = "pushups" if push_pts >= hrpu_pts else "hrpu"

    situ_pts = pfra_2026.score_situps(gender, age_group, situp_reps)
    plnk_pts = pfra_2026.score_plank(gender, age_group, plank_sec)
    clrc_pts = pfra_2026.score_clrc(gender, age_group, clrc_reps)
    core_scores = {"situps": situ_pts, "plank": plnk_pts, "clrc": clrc_pts}
    best_core = max(core_scores, key=core_scores.get)

    return {
        "strength": {"pushups": {"reps": pushup_reps, "pts": push_pts},
                     "hrpu":    {"reps": hrpu_reps,   "pts": hrpu_pts},
                     "best": best_strength, "gain_pts": round(abs(push_pts - hrpu_pts), 2)},
        "core":     {"situps": {"reps": situp_reps, "pts": situ_pts},
                     "plank":  {"sec": plank_sec,   "pts": plnk_pts},
                     "clrc":   {"reps": clrc_reps,  "pts": clrc_pts},
                     "best": best_core, "scores": core_scores},
    }

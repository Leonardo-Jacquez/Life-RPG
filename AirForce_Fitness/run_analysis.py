"""
AF Fitness Test Equivalence Analysis — main entry point.

Usage:
    python run_analysis.py
    python run_analysis.py --gender F --age 25-29
    python run_analysis.py --gender M --age 35-39 --pace 8.5 --pushups 42 --situps 45 --whtr 0.48
"""

import argparse, os, sys
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(__file__))

from analysis.compare import (
    run_equivalence_curve, strength_equivalence_curve, core_equivalence_curve,
    body_comp_comparison, composite_equivalence, hamr_vs_run_equivalence,
)
from analysis.bang_for_buck import (
    rank_events_by_roi, optimal_event_selection,
)
from analysis.normalize import pace_to_mmss
from data.constants import AGE_GROUPS

TABLES_DIR = os.path.join("outputs", "tables")
CHARTS_DIR = os.path.join("outputs", "charts")
LEGACY_COLOR = "#C0392B"
PFRA_COLOR   = "#2980B9"
DELTA_COLOR  = "#27AE60"
WARN_COLOR   = "#E67E22"


def _ensure_dirs():
    os.makedirs(TABLES_DIR, exist_ok=True)
    os.makedirs(CHARTS_DIR, exist_ok=True)

def _save_table(df, name):
    df.to_csv(os.path.join(TABLES_DIR, f"{name}.csv"), index=False)
    with open(os.path.join(TABLES_DIR, f"{name}.md"), "w") as f:
        f.write(df.to_markdown(index=False))
    print(f"  [table] {name}")

def _save_chart(fig, name):
    fig.savefig(os.path.join(CHARTS_DIR, f"{name}.png"), dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"  [chart] {name}")


def _chart_run_equivalence(df, gender, age, verdict):
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(11, 9), sharex=True)
    ax1.plot(df["pace_min_mi"], df["legacy_cardio_wtd"], color=LEGACY_COLOR, lw=2, label="Legacy 1.5-mi (60-pt)")
    ax1.plot(df["pace_min_mi"], df["pfra_cardio_wtd"],   color=PFRA_COLOR,   lw=2, label="PFRA 2-mi (50-pt)")
    ax1.set_ylabel("Weighted Composite Points")
    ax1.set_title(f"Run Component — {gender} {age}\nVerdict: {verdict['verdict']}  (mean Δ = {verdict['mean_delta']:+.2f} pts)")
    ax1.legend(); ax1.grid(alpha=0.3)
    ax2.bar(df["pace_min_mi"], df["delta_wtd"], width=0.035,
            color=[DELTA_COLOR if d >= 0 else LEGACY_COLOR for d in df["delta_wtd"]], alpha=0.7)
    ax2.axhline(0, color="black", lw=1)
    ax2.set_ylabel("PFRA − Legacy (pts)"); ax2.set_xlabel("Pace (min/mi)"); ax2.grid(alpha=0.3)
    ticks = np.arange(int(df["pace_min_mi"].min()) + 1, df["pace_min_mi"].max() + 1, 1)
    ax2.set_xticks(ticks)
    ax2.set_xticklabels([pace_to_mmss(p) for p in ticks], rotation=45, ha="right")
    fig.tight_layout(); return fig

def _chart_strength_equivalence(df, gender, age, verdict):
    fig, ax = plt.subplots(figsize=(10, 6))
    ax.plot(df["reps"], df["legacy_strength_wtd"], color=LEGACY_COLOR, lw=2, label="Legacy (20-pt)")
    ax.plot(df["reps"], df["pfra_strength_wtd"],   color=PFRA_COLOR,   lw=2, label="PFRA (15-pt)")
    ax.fill_between(df["reps"], df["legacy_strength_wtd"], df["pfra_strength_wtd"],
                    where=df["delta_wtd"] < 0, alpha=0.15, color=LEGACY_COLOR)
    ax.set_xlabel("Push-up Reps"); ax.set_ylabel("Weighted Composite Points")
    ax.set_title(f"Strength Component — {gender} {age}\nVerdict: {verdict['verdict']}  (mean Δ = {verdict['mean_delta']:+.2f} pts)")
    ax.legend(); ax.grid(alpha=0.3); fig.tight_layout(); return fig

def _chart_core_equivalence(df, gender, age, verdict):
    fig, ax = plt.subplots(figsize=(10, 6))
    ax.plot(df["reps"], df["legacy_core_wtd"], color=LEGACY_COLOR, lw=2, label="Legacy (20-pt)")
    ax.plot(df["reps"], df["pfra_core_wtd"],   color=PFRA_COLOR,   lw=2, label="PFRA (15-pt)")
    ax.fill_between(df["reps"], df["legacy_core_wtd"], df["pfra_core_wtd"],
                    where=df["delta_wtd"] < 0, alpha=0.15, color=LEGACY_COLOR)
    ax.set_xlabel("Sit-up Reps"); ax.set_ylabel("Weighted Composite Points")
    ax.set_title(f"Core Component — {gender} {age}\nVerdict: {verdict['verdict']}  (mean Δ = {verdict['mean_delta']:+.2f} pts)")
    ax.legend(); ax.grid(alpha=0.3); fig.tight_layout(); return fig

def _chart_whtr(df, verdict):
    fig, ax = plt.subplots(figsize=(10, 6))
    ax.plot(df["whtr"], df["pfra_pts"], color=PFRA_COLOR, lw=2.5, label="PFRA WHtR (0–20 pts)")
    ax.axhline(0, color=LEGACY_COLOR, lw=2, ls="--", label="Legacy (0 pts, binary gate)")
    ax.axvline(0.49, color=PFRA_COLOR, lw=1, ls=":", alpha=0.7, label="0.49 = max pts")
    ax.axvline(0.55, color="red", lw=1.5, ls="--", label="0.55 = auto-fail")
    ax.fill_between(df["whtr"], 0, df["pfra_pts"], alpha=0.12, color=PFRA_COLOR)
    ax.set_xlabel("WHtR"); ax.set_ylabel("Component Points")
    ax.set_title(f"Body Comp: PFRA Scored WHtR vs Legacy Binary\nVerdict: {verdict['verdict']}")
    ax.legend(); ax.grid(alpha=0.3); ax.set_xlim(0.40, 0.60); ax.set_ylim(-1, 22)
    fig.tight_layout(); return fig

def _chart_bang_for_buck(df_roi, gender, age):
    from matplotlib.patches import Patch
    fig, ax = plt.subplots(figsize=(10, 6))
    colors = [PFRA_COLOR if c == "cardio" else LEGACY_COLOR if c == "strength"
              else DELTA_COLOR if c == "core" else WARN_COLOR for c in df_roi["component"]]
    bars = ax.barh(df_roi["event"], df_roi["pts_gain"], color=colors, alpha=0.85)
    ax.bar_label(bars, fmt="%.3f", padding=3)
    ax.set_xlabel("Composite Points Gained per Effort Unit")
    ax.set_title(f"PFRA 2026 Bang-for-Buck — {gender} {age}\n"
                 "(Run: +0.5 min/mi | Push/Sit: +5 reps | Plank: +15 sec | WHtR: −0.02)")
    ax.grid(axis="x", alpha=0.3)
    ax.legend(handles=[Patch(color=PFRA_COLOR, label="Cardio"), Patch(color=LEGACY_COLOR, label="Strength"),
                        Patch(color=DELTA_COLOR, label="Core"),  Patch(color=WARN_COLOR,   label="Body Comp")])
    fig.tight_layout(); return fig

def _chart_hamr_vs_run(df, gender, age):
    fig, ax = plt.subplots(figsize=(10, 6))
    ax.plot(df["shuttles"], df["hamr_pts"],      color=PFRA_COLOR,   lw=2, label="HAMR pts")
    ax.plot(df["shuttles"], df["run_pts_equiv"],  color=LEGACY_COLOR, lw=2, label="Equiv. 2-mi run pts")
    ax.fill_between(df["shuttles"], df["hamr_pts"], df["run_pts_equiv"],
                    where=df["delta"] >= 0, alpha=0.12, color=PFRA_COLOR, label="HAMR advantage")
    ax.fill_between(df["shuttles"], df["hamr_pts"], df["run_pts_equiv"],
                    where=df["delta"] < 0,  alpha=0.12, color=LEGACY_COLOR, label="Run advantage")
    ax.set_xlabel("HAMR Shuttles"); ax.set_ylabel("PFRA Cardio Points")
    ax.set_title(f"PFRA 2026: HAMR vs Equivalent-Pace 2-Mile Run — {gender} {age}")
    ax.legend(); ax.grid(alpha=0.3); fig.tight_layout(); return fig

def _chart_composite_delta(results_grid, gender, age):
    paces = sorted(set(r["inputs"]["pace_min_mi"] for r in results_grid))
    whtrs = sorted(set(r["inputs"]["whtr"]        for r in results_grid))
    Z = np.zeros((len(whtrs), len(paces)))
    for r in results_grid:
        Z[whtrs.index(r["inputs"]["whtr"])][paces.index(r["inputs"]["pace_min_mi"])] = r["composite_delta"]
    fig, ax = plt.subplots(figsize=(11, 7))
    vmax = max(abs(Z.min()), abs(Z.max()))
    im = ax.imshow(Z, aspect="auto", origin="lower",
                   extent=[min(paces), max(paces), min(whtrs), max(whtrs)],
                   cmap="RdBu", vmin=-vmax, vmax=vmax)
    fig.colorbar(im, ax=ax).set_label("PFRA − Legacy (pts)\nBlue=PFRA harder, Red=PFRA easier")
    ax.set_xlabel("Run Pace (min/mi)"); ax.set_ylabel("WHtR")
    ax.set_title(f"Composite Delta: PFRA 2026 − Legacy PFA — {gender} {age}")
    ax.contour(np.linspace(min(paces), max(paces), len(paces)),
               np.linspace(min(whtrs), max(whtrs), len(whtrs)),
               Z, levels=[0], colors="black", linewidths=1.5)
    fig.tight_layout(); return fig


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--gender",  default="M",     choices=["M", "F"])
    parser.add_argument("--age",     default="30-34", choices=AGE_GROUPS)
    parser.add_argument("--pace",    type=float, default=9.0)
    parser.add_argument("--pushups", type=int,   default=35)
    parser.add_argument("--situps",  type=int,   default=40)
    parser.add_argument("--plank",   type=int,   default=90)
    parser.add_argument("--hrpu",    type=int,   default=28)
    parser.add_argument("--clrc",    type=int,   default=25)
    parser.add_argument("--whtr",    type=float, default=0.51)
    args = parser.parse_args()

    gender = args.gender
    age    = args.age
    tag    = f"{gender}_{age.replace('<','u').replace('+','plus')}"

    _ensure_dirs()
    print(f"\n=== USAF Fitness Test Equivalence Analysis ===")
    print(f"    Profile: {gender}, age {age}")
    print(f"    Inputs:  pace={args.pace} | push={args.pushups} | sit={args.situps} | WHtR={args.whtr}\n")

    verdicts = {}

    print("[ 1 ] Run equivalence...")
    df_run, v_run = run_equivalence_curve(gender, age)
    verdicts["run"] = v_run
    _save_table(df_run, f"run_equivalence_{tag}")
    _save_chart(_chart_run_equivalence(df_run, gender, age, v_run), f"run_equivalence_{tag}")

    print("[ 2 ] Strength equivalence...")
    df_str, v_str = strength_equivalence_curve(gender, age)
    verdicts["strength"] = v_str
    _save_table(df_str, f"strength_equivalence_{tag}")
    _save_chart(_chart_strength_equivalence(df_str, gender, age, v_str), f"strength_equivalence_{tag}")

    print("[ 3 ] Core equivalence...")
    df_core, v_core = core_equivalence_curve(gender, age)
    verdicts["core"] = v_core
    _save_table(df_core, f"core_equivalence_{tag}")
    _save_chart(_chart_core_equivalence(df_core, gender, age, v_core), f"core_equivalence_{tag}")

    print("[ 4 ] Body comp comparison...")
    df_bc, v_bc = body_comp_comparison()
    verdicts["body_comp"] = v_bc
    _save_table(df_bc, "body_comp_comparison")
    _save_chart(_chart_whtr(df_bc, v_bc), "whtr_curve")

    print("[ 5 ] HAMR vs 2-mile run...")
    df_hamr = hamr_vs_run_equivalence(gender, age)
    _save_table(df_hamr, f"hamr_vs_run_{tag}")
    _save_chart(_chart_hamr_vs_run(df_hamr, gender, age), f"hamr_vs_run_{tag}")

    print("[ 6 ] Composite grid (pace × WHtR)...")
    grid_paces = [7.0, 8.0, 9.0, 10.0, 11.0, 12.0]
    grid_whtrs = [0.45, 0.47, 0.49, 0.51, 0.53, 0.55]
    results_grid, grid_rows = [], []
    for pace in grid_paces:
        for whtr in grid_whtrs:
            res = composite_equivalence(gender, age, pace, args.pushups, args.situps, whtr)
            results_grid.append(res)
            grid_rows.append({
                "pace_min_mi": pace, "whtr": whtr,
                "legacy_composite": res["legacy"]["composite"],
                "pfra_composite":   res["pfra"]["composite"],
                "delta":            res["composite_delta"],
                "verdict":          res["verdict"],
            })
    _save_table(pd.DataFrame(grid_rows), f"composite_grid_{tag}")
    _save_chart(_chart_composite_delta(results_grid, gender, age), f"composite_delta_{tag}")

    print("[ 7 ] Bang-for-buck ROI...")
    df_roi = rank_events_by_roi(gender, age, args.pace, args.pushups, args.situps, args.plank, args.whtr)
    _save_table(df_roi, f"bang_for_buck_{tag}")
    _save_chart(_chart_bang_for_buck(df_roi, gender, age), f"bang_for_buck_{tag}")

    print("[ 8 ] Optimal event selection...")
    opt = optimal_event_selection(gender, age, args.pushups, args.hrpu, args.situps, args.plank, args.clrc)

    print(f"\n{'='*60}")
    print(f"VERDICTS — {gender}, age {age}")
    print(f"{'='*60}")
    print(f"  Run        : {verdicts['run']['verdict']:<12}  (mean Δ {verdicts['run']['mean_delta']:+.2f} pts)")
    print(f"  Strength   : {verdicts['strength']['verdict']:<12}  (mean Δ {verdicts['strength']['mean_delta']:+.2f} pts)")
    print(f"  Core       : {verdicts['core']['verdict']:<12}  (mean Δ {verdicts['core']['mean_delta']:+.2f} pts)")
    print(f"  Body comp  : {verdicts['body_comp']['verdict']}")
    print()
    print("BANG-FOR-BUCK (PFRA 2026):")
    for _, row in df_roi.iterrows():
        print(f"  #{int(row['roi_rank'])} {row['event']:<26} +{row['pts_gain']:.3f} pts  ({row['effort_unit']})")
    print()
    print("OPTIMAL EVENT SELECTION:")
    print(f"  Strength: {opt['strength']['best'].upper()}  (push={opt['strength']['pushups']['pts']:.1f} vs hrpu={opt['strength']['hrpu']['pts']:.1f})")
    core_s = opt['core']
    print(f"  Core:     {core_s['best'].upper()}  (sit={core_s['situps']['pts']:.1f}  plank={core_s['plank']['pts']:.1f}  clrc={core_s['clrc']['pts']:.1f})")
    print(f"\nOutputs written to outputs/")


if __name__ == "__main__":
    main()

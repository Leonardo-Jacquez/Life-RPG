"""
Normalization utilities: convert raw performances to comparable units.
All functions are pure.
"""

import math


def pace_per_mile(time_sec, distance_miles):
    return (time_sec / 60.0) / distance_miles

def pace_to_mmss(pace_min_mi):
    m = int(pace_min_mi)
    s = round((pace_min_mi - m) * 60)
    if s == 60: m, s = m + 1, 0
    return f"{m}:{s:02d}/mi"

def time_for_pace(pace_min_mi, distance_miles):
    return pace_min_mi * distance_miles * 60.0

def legacy_time_from_pace(pace): return time_for_pace(pace, 1.5)
def pfra_time_from_pace(pace):   return time_for_pace(pace, 2.0)

def pct_max_component(raw, max_score):
    return 0.0 if max_score <= 0 else min(100.0, raw / max_score * 100.0)

def pct_max_reps(reps, max_reps):
    return 0.0 if max_reps <= 0 else min(100.0, reps / max_reps * 100.0)

def pace_delta(pfra, legacy): return pfra - legacy


# HAMR <-> pace via Leger 1988: speed = 8.0 + 0.5*level (km/h)
def hamr_level_from_shuttles(shuttles):
    return 0.0 if shuttles <= 0 else -1.0 + math.sqrt(1.0 + shuttles)

def hamr_speed_kmh(level): return 8.0 + 0.5 * level

def hamr_vo2max(shuttles):
    return max(0.0, 5.857 * hamr_speed_kmh(hamr_level_from_shuttles(shuttles)) - 19.458)

def hamr_to_pace_min_mi(shuttles):
    spd = hamr_speed_kmh(hamr_level_from_shuttles(shuttles))
    return 99.0 if spd <= 0 else 1.0 / (spd / 1.60934 / 60.0)

def weighted_score(raw_pts, component_max_pts, weight):
    return 0.0 if component_max_pts <= 0 else (raw_pts / component_max_pts) * weight

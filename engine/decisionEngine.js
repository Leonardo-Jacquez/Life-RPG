'use strict';

// ─── Constants ───────────────────────────────────────────────────────────────

const PHASE_WEIGHTS = {
  high_school: { academic: 0.50, work_ethic: 0.30, social: 0.15, financial: 0.05 },
  college:     { academic: 0.40, work_ethic: 0.35, social: 0.15, financial: 0.10 },
  adult:       { financial: 0.50, work_ethic: 0.30, social: 0.10, academic: 0.10 },
};

const POST_SECONDARY_PATHS = [
  { id: 'workforce',          label: 'Enter Workforce',        min_score: 0  },
  { id: 'military',           label: 'Military',               min_score: 20 },
  { id: 'trade_school',       label: 'Trade School',           min_score: 30 },
  { id: 'community_college',  label: 'Community College',      min_score: 40 },
  { id: 'state_university',   label: 'State University',       min_score: 55 },
  { id: 'private_university', label: 'Private University',     min_score: 70 },
  { id: 'ivy_league',         label: 'Ivy League University',  min_score: 88 },
];

// 2024 single-filer federal income tax brackets
const TAX_BRACKETS = [
  { ceiling: 11600,    rate: 0.10 },
  { ceiling: 47150,    rate: 0.12 },
  { ceiling: 100525,   rate: 0.22 },
  { ceiling: 191950,   rate: 0.24 },
  { ceiling: 243725,   rate: 0.32 },
  { ceiling: 609350,   rate: 0.35 },
  { ceiling: Infinity, rate: 0.37 },
];

const FICA_RATE = 0.0765;
const SS_WAGE_BASE = 168600; // 2024 SS wage ceiling
const FEDERAL_STUDENT_LOAN_RATE = 0.0653;
const STANDARD_LOAN_TERM_YEARS = 10;
const RIPPLE_THRESHOLD = 0.40; // 40% of class must pick same choice

// Career attainment baseline scores by path (used in outcome scoring)
const PATH_CAREER_SCORES = {
  workforce:          30,
  military:           45,
  trade_school:       55,
  community_college:  65,
  state_university:   75,
  private_university: 85,
  ivy_league:         95,
};

// US median net worth (2022 Federal Reserve Survey of Consumer Finances)
const MEDIAN_NET_WORTH = 192700;

// Valid phase progression
const VALID_TRANSITIONS = {
  high_school: 'college',
  college:     'adult',
};

// ─── Core stat utilities ──────────────────────────────────────────────────────

/**
 * Clamp a stat value to the [0, 100] range.
 * @param {number} value
 * @returns {number}
 */
function clampStat(value) {
  return Math.min(100, Math.max(0, value));
}

/**
 * Apply stat deltas to a stats object, modified by the student's psychometric
 * profile (archetypes). Returns a new stats object — does not mutate the input.
 *
 * Psychometric modifiers:
 *   - High Conscientiousness (C) amplifies academic gains (+up to 30%)
 *   - High Grit softens work_ethic penalties (absorbs up to 40% of penalty)
 *   - High Openness (O) amplifies social gains (+up to 20%)
 *   - High Agreeableness (A) slightly amplifies social gains (+up to 10%)
 *   - High Neuroticism (N) amplifies academic penalties (up to +20% worse)
 *   - High Future Time Perspective (ftp) amplifies financial gains (+up to 25%)
 *
 * @param {{ academic: number, financial: number, work_ethic: number, social: number }} stats
 * @param {{ [stat: string]: number }} deltas
 * @param {{ O?: number, C?: number, E?: number, A?: number, N?: number, grit?: number, ftp?: number }} archetypes
 * @returns {{ academic: number, financial: number, work_ethic: number, social: number }}
 */
function applyStatDeltas(stats, deltas, archetypes = {}) {
  const {
    O   = 0.5,
    C   = 0.5,
    A   = 0.5,
    N   = 0.5,
    grit = 0.5,
    ftp  = 0.5,
  } = archetypes;

  const newStats = { ...stats };

  for (const [stat, rawDelta] of Object.entries(deltas)) {
    let delta = rawDelta;

    if (stat === 'academic') {
      if (delta > 0) {
        // High conscientiousness amplifies academic gains
        delta *= 1 + (C - 0.5) * 0.6;
      } else {
        // High neuroticism worsens academic penalties
        delta *= 1 + (N - 0.5) * 0.4;
      }
    }

    if (stat === 'work_ethic' && delta < 0) {
      // High grit softens work_ethic penalties
      delta *= 1 - grit * 0.4;
    }

    if (stat === 'social') {
      if (delta > 0) {
        // Openness and agreeableness amplify social gains
        delta *= 1 + (O - 0.5) * 0.4 + (A - 0.5) * 0.2;
      }
    }

    if (stat === 'financial' && delta > 0) {
      // High future time perspective amplifies financial gains
      delta *= 1 + (ftp - 0.5) * 0.5;
    }

    newStats[stat] = clampStat((newStats[stat] ?? 0) + delta);
  }

  return newStats;
}

// ─── Phase & progression ─────────────────────────────────────────────────────

/**
 * Compute the opportunity score for a game run in the given phase.
 * Returns a weighted average of the four core stats (0–100).
 *
 * @param {{ academic: number, financial: number, work_ethic: number, social: number }} stats
 * @param {'high_school'|'college'|'adult'} phase
 * @returns {number}
 */
function computeOpportunityScore(stats, phase) {
  const weights = PHASE_WEIGHTS[phase];
  if (!weights) throw new Error(`Unknown phase: "${phase}"`);

  return Object.entries(weights).reduce((score, [stat, weight]) => {
    return score + (stats[stat] ?? 0) * weight;
  }, 0);
}

/**
 * Return all post-secondary paths the student qualifies for based on their
 * current high_school opportunity score.
 *
 * @param {{ stats: object }} gameRun
 * @returns {Array<{ id: string, label: string, min_score: number }>}
 */
function getAvailablePaths(gameRun) {
  const score = computeOpportunityScore(gameRun.stats, 'high_school');
  return POST_SECONDARY_PATHS.filter(path => score >= path.min_score);
}

/**
 * Validate and execute a phase transition.
 * Throws if the transition is illegal or the path is unavailable.
 *
 * @param {object} gameRun
 * @param {'college'|'adult'} nextPhase
 * @param {string} pathId  — required when transitioning out of high_school
 * @returns {object} updated gameRun (does not mutate original)
 */
function advancePhase(gameRun, nextPhase, pathId) {
  const expectedNext = VALID_TRANSITIONS[gameRun.phase];
  if (expectedNext !== nextPhase) {
    throw new Error(
      `Invalid phase transition: "${gameRun.phase}" → "${nextPhase}". Expected "${expectedNext}".`
    );
  }

  if (gameRun.phase === 'high_school') {
    const available = getAvailablePaths(gameRun);
    if (!available.find(p => p.id === pathId)) {
      const score = computeOpportunityScore(gameRun.stats, 'high_school');
      throw new Error(
        `Path "${pathId}" not available. Opportunity score ${score.toFixed(1)} is too low.`
      );
    }
  }

  return {
    ...gameRun,
    phase: nextPhase,
    path_id: pathId ?? gameRun.path_id,
    updated_at: new Date().toISOString(),
  };
}

// ─── Event prerequisites & selection ─────────────────────────────────────────

/**
 * Check whether an event's prerequisites are met by the current game run.
 *
 * Prerequisites object shape:
 * {
 *   phase?: string,
 *   min_run_number?: number,
 *   stat_minimums?: { [stat]: number },
 *   required_events?: string[],   // event IDs that must have been seen
 *   blockers?: string[],           // event IDs that prevent this one from firing
 * }
 *
 * @param {object} event
 * @param {object} gameRun
 * @param {Set<string>} seenEventIds
 * @returns {boolean}
 */
function checkPrerequisites(event, gameRun, seenEventIds = new Set()) {
  const prereqs = event.prerequisites ?? {};

  if (prereqs.phase && prereqs.phase !== gameRun.phase) return false;

  if (prereqs.min_run_number != null && gameRun.run_number < prereqs.min_run_number) return false;

  if (prereqs.stat_minimums) {
    for (const [stat, minimum] of Object.entries(prereqs.stat_minimums)) {
      if ((gameRun.stats[stat] ?? 0) < minimum) return false;
    }
  }

  if (prereqs.required_events) {
    for (const id of prereqs.required_events) {
      if (!seenEventIds.has(String(id))) return false;
    }
  }

  if (prereqs.blockers) {
    for (const id of prereqs.blockers) {
      if (seenEventIds.has(String(id))) return false;
    }
  }

  return true;
}

/**
 * Draw the next event using weighted random selection.
 *
 * Filtering order:
 *   1. Must match current phase
 *   2. Must not be in seenEventIds (unless event.is_repeatable === true)
 *   3. Must not be in recentEventIds (cooldown window)
 *   4. Must pass prerequisite check
 *
 * rippleBoosts is a map { [eventId]: multiplier } that boosts an event's
 * rotation_weight for students affected by a ripple.
 *
 * @param {object[]} eventPool
 * @param {object} gameRun
 * @param {Set<string>} seenEventIds
 * @param {Set<string>} recentEventIds
 * @param {{ [eventId: string]: number }} rippleBoosts
 * @returns {object|null}
 */
function drawNextEvent(
  eventPool,
  gameRun,
  seenEventIds = new Set(),
  recentEventIds = new Set(),
  rippleBoosts = {}
) {
  const eligible = eventPool.filter(event => {
    if (event.phase && event.phase !== gameRun.phase) return false;
    if (!event.is_repeatable && seenEventIds.has(String(event.id))) return false;
    if (recentEventIds.has(String(event.id))) return false;
    return checkPrerequisites(event, gameRun, seenEventIds);
  });

  if (eligible.length === 0) return null;

  const weights = eligible.map(event => {
    const boost = rippleBoosts[String(event.id)] ?? 1;
    return Math.max(0, (event.rotation_weight ?? 1) * boost);
  });

  const total = weights.reduce((sum, w) => sum + w, 0);
  if (total === 0) return eligible[0];

  let rand = Math.random() * total;
  for (let i = 0; i < eligible.length; i++) {
    rand -= weights[i];
    if (rand <= 0) return eligible[i];
  }

  return eligible[eligible.length - 1];
}

// ─── Choice resolution ────────────────────────────────────────────────────────

/**
 * Apply a student's choice to their game run.
 * Returns an updated (immutable) game run and an event log entry.
 *
 * The log entry is NOT yet marked ripple_triggered — that flag is set later
 * by the server after processRipple runs across the full class.
 *
 * @param {object} gameRun
 * @param {object} event
 * @param {object} choice
 * @param {object} archetypes
 * @returns {{ updatedRun: object, logEntry: object }}
 */
function resolveChoice(gameRun, event, choice, archetypes = {}) {
  const statsBefore = { ...gameRun.stats };
  const statsAfter = applyStatDeltas(statsBefore, choice.stat_deltas ?? {}, archetypes);

  const updatedRun = {
    ...gameRun,
    stats: statsAfter,
    updated_at: new Date().toISOString(),
  };

  const logEntry = {
    game_run_id: gameRun.id,
    event_id:    event.id,
    choice_id:   choice.id,
    stats_before: statsBefore,
    stats_after:  statsAfter,
    ripple_triggered: false,
    class_choice_pct: null,   // filled in by server after class resolves
    timestamp: new Date().toISOString(),
  };

  return { updatedRun, logEntry };
}

// ─── Ripple system ────────────────────────────────────────────────────────────

/**
 * Evaluate whether a ripple event fires for the class.
 *
 * classChoices:  { [studentId: string]: choiceId }
 * allChoices:    the full array of choice objects for this event
 *
 * If ≥ 40% of students made the same choice AND that choice has a
 * ripple_payload, the ripple fires. rippleBoostsByStudent maps each student
 * who made the dominant choice to the payload (which the server stores and
 * applies to their future drawNextEvent calls).
 *
 * @param {object} event
 * @param {{ [studentId: string]: string|number }} classChoices
 * @param {object[]} allChoices
 * @returns {{ firedRipple: boolean, dominantChoiceId: string|null, rippleBoostsByStudent: object }}
 */
function processRipple(event, classChoices, allChoices) {
  const empty = { firedRipple: false, dominantChoiceId: null, rippleBoostsByStudent: {} };

  const studentIds = Object.keys(classChoices);
  if (studentIds.length === 0) return empty;

  // Tally votes
  const counts = {};
  for (const choiceId of Object.values(classChoices)) {
    const key = String(choiceId);
    counts[key] = (counts[key] ?? 0) + 1;
  }

  // Find the most-chosen option
  const [dominantChoiceId, dominantCount] = Object.entries(counts)
    .sort(([, a], [, b]) => b - a)[0];

  const dominantPct = dominantCount / studentIds.length;
  if (dominantPct < RIPPLE_THRESHOLD) return empty;

  const dominantChoice = allChoices.find(c => String(c.id) === dominantChoiceId);
  if (!dominantChoice?.ripple_payload) return empty;

  // Only students who picked the dominant choice receive the ripple boost
  const rippleBoostsByStudent = {};
  for (const [studentId, choiceId] of Object.entries(classChoices)) {
    if (String(choiceId) === dominantChoiceId) {
      rippleBoostsByStudent[studentId] = dominantChoice.ripple_payload;
    }
  }

  return { firedRipple: true, dominantChoiceId, rippleBoostsByStudent };
}

// ─── Financial simulation ─────────────────────────────────────────────────────

/**
 * Estimate federal income tax for a single filer using 2024 progressive brackets.
 * Does not include standard deduction (simplified model appropriate for a sim).
 *
 * @param {number} annualIncome
 * @returns {number} annual federal tax owed
 */
function estimateFederalTax(annualIncome) {
  if (annualIncome <= 0) return 0;

  let tax = 0;
  let floor = 0;

  for (const { ceiling, rate } of TAX_BRACKETS) {
    if (annualIncome <= floor) break;
    const taxableInBracket = Math.min(annualIncome, ceiling) - floor;
    tax += taxableInBracket * rate;
    floor = ceiling;
  }

  return Math.round(tax * 100) / 100;
}

/**
 * Compute the monthly payment for a standard amortizing loan.
 *
 * @param {number} principal
 * @param {number} annualRate  — e.g. 0.0653 for 6.53%
 * @param {number} termYears
 * @returns {number} monthly payment
 */
function computeLoanPayment(principal, annualRate, termYears) {
  if (principal <= 0 || annualRate <= 0) return 0;

  const r = annualRate / 12;
  const n = termYears * 12;
  const payment = principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  return Math.round(payment * 100) / 100;
}

/**
 * Compute the full monthly budget for the adult phase.
 *
 * occupation must include median_annual_wage.
 * costs comes from snapshot_costs and should include:
 *   median_rent, monthly_groceries, monthly_transport,
 *   monthly_utilities, monthly_healthcare, tuition_total (for the student's path)
 *
 * selections (player-controlled):
 *   retirement_pct (0–0.20, default 0.05)
 *
 * @param {object} gameRun
 * @param {{ median_annual_wage: number }} occupation
 * @param {object} costs
 * @param {{ retirement_pct?: number }} selections
 * @returns {object}
 */
function computeMonthlyBudget(gameRun, occupation, costs, selections = {}) {
  // Work ethic provides an experience multiplier (0–30% salary boost)
  const workEthicMultiplier = 1 + (gameRun.stats.work_ethic / 100) * 0.30;
  const annualSalary = occupation.median_annual_wage * workEthicMultiplier;
  const grossMonthly = annualSalary / 12;

  // Taxes
  const annualFederalTax = estimateFederalTax(annualSalary);
  const monthlyFederalTax = annualFederalTax / 12;

  // FICA: SS (6.2% up to wage base) + Medicare (1.45%)
  const ssWages = Math.min(annualSalary, SS_WAGE_BASE);
  const annualFICA = ssWages * 0.062 + annualSalary * 0.0145;
  const monthlyFICA = annualFICA / 12;

  // Retirement contribution (pre-tax, reduces take-home)
  const retirementPct = Math.min(0.20, Math.max(0, selections.retirement_pct ?? 0.05));
  const monthlyRetirement = grossMonthly * retirementPct;

  const netMonthly = grossMonthly - monthlyFederalTax - monthlyFICA - monthlyRetirement;

  // Living expenses from snapshot
  const rent        = costs.median_rent         ?? 1200;
  const groceries   = costs.monthly_groceries   ?? 400;
  const transport   = costs.monthly_transport   ?? 350;
  const utilities   = costs.monthly_utilities   ?? 150;
  const healthcare  = costs.monthly_healthcare  ?? 200;

  // Student loan (not applicable for workforce or military paths)
  let monthlyLoanPayment = 0;
  const loanPaths = ['trade_school', 'community_college', 'state_university', 'private_university', 'ivy_league'];
  if (loanPaths.includes(gameRun.path_id) && costs.tuition_total > 0) {
    monthlyLoanPayment = computeLoanPayment(
      costs.tuition_total,
      FEDERAL_STUDENT_LOAN_RATE,
      STANDARD_LOAN_TERM_YEARS
    );
  }

  const totalExpenses = rent + groceries + transport + utilities + healthcare + monthlyLoanPayment;
  const netCashFlow = netMonthly - totalExpenses;

  return {
    annual_salary:   round2(annualSalary),
    gross_monthly:   round2(grossMonthly),
    net_monthly:     round2(netMonthly),
    deductions: {
      federal_tax: round2(monthlyFederalTax),
      fica:        round2(monthlyFICA),
      retirement:  round2(monthlyRetirement),
    },
    expenses: {
      rent,
      groceries,
      transport,
      utilities,
      healthcare,
      student_loan: round2(monthlyLoanPayment),
    },
    total_expenses: round2(totalExpenses),
    net_cash_flow:  round2(netCashFlow),
    is_solvent:     netCashFlow >= 0,
  };
}

// ─── Outcome scoring ──────────────────────────────────────────────────────────

/**
 * Compute the final outcome score for a completed game run.
 *
 * Score = net_worth_score (35%) + career_attainment_score (35%) + quality_of_life (30%)
 *
 * @param {object} gameRun  — must have net_worth, path_id, stats
 * @param {object} occupation
 * @returns {{ total_score: number, breakdown: object }}
 */
function computeOutcome(gameRun, occupation) {
  // Net worth score: 50 = median, scales ±50 around it
  const rawNetWorthScore = (gameRun.net_worth / MEDIAN_NET_WORTH) * 50 + 50;
  const netWorthScore = Math.min(100, Math.max(0, rawNetWorthScore));

  // Career attainment: path-based baseline, boosted if occupation wage is high
  const pathBase = PATH_CAREER_SCORES[gameRun.path_id] ?? 50;
  const wageBonus = occupation?.median_annual_wage
    ? Math.min(10, (occupation.median_annual_wage / 100000) * 10)
    : 0;
  const careerScore = Math.min(100, pathBase + wageBonus);

  // Quality of life: adult-weighted opportunity score
  const qolScore = computeOpportunityScore(gameRun.stats, 'adult');

  const totalScore = Math.round(
    netWorthScore * 0.35 +
    careerScore   * 0.35 +
    qolScore      * 0.30
  );

  return {
    total_score: totalScore,
    breakdown: {
      net_worth_score:        Math.round(netWorthScore),
      career_attainment_score: Math.round(careerScore),
      quality_of_life_score:  Math.round(qolScore),
    },
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function round2(n) {
  return Math.round(n * 100) / 100;
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  clampStat,
  applyStatDeltas,
  computeOpportunityScore,
  checkPrerequisites,
  drawNextEvent,
  resolveChoice,
  processRipple,
  getAvailablePaths,
  advancePhase,
  computeMonthlyBudget,
  estimateFederalTax,
  computeLoanPayment,
  computeOutcome,
  // Constants exported for use by API layer
  POST_SECONDARY_PATHS,
  PHASE_WEIGHTS,
  RIPPLE_THRESHOLD,
};

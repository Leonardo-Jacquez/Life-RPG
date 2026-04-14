'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
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
} = require('./decisionEngine.js');

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const baseStats = { academic: 60, financial: 40, work_ethic: 70, social: 50 };

const defaultGameRun = {
  id: 'run-1',
  phase: 'high_school',
  run_number: 1,
  stats: { ...baseStats },
  path_id: null,
  net_worth: 0,
};

const defaultArchetypes = { O: 0.5, C: 0.5, E: 0.5, A: 0.5, N: 0.5, grit: 0.5, ftp: 0.5 };

const makeEvent = (overrides = {}) => ({
  id: 'evt-1',
  phase: 'high_school',
  category: 'academic',
  rotation_weight: 1,
  is_repeatable: false,
  prerequisites: {},
  prompt_text: 'Study or hang out?',
  ...overrides,
});

const makeChoice = (overrides = {}) => ({
  id: 'choice-1',
  stat_deltas: { academic: 5 },
  outcome_text: 'You studied hard.',
  ripple_payload: null,
  ...overrides,
});

// ─── clampStat ────────────────────────────────────────────────────────────────

describe('clampStat', () => {
  it('clamps values above 100 to 100', () => {
    assert.equal(clampStat(150), 100);
  });

  it('clamps values below 0 to 0', () => {
    assert.equal(clampStat(-10), 0);
  });

  it('passes through values within range', () => {
    assert.equal(clampStat(55), 55);
    assert.equal(clampStat(0), 0);
    assert.equal(clampStat(100), 100);
  });
});

// ─── applyStatDeltas ──────────────────────────────────────────────────────────

describe('applyStatDeltas', () => {
  it('applies simple deltas without archetypes bias', () => {
    const result = applyStatDeltas(baseStats, { academic: 10 }, defaultArchetypes);
    // C=0.5 → modifier = 1 + (0.5-0.5)*0.6 = 1.0, so delta stays 10
    assert.equal(result.academic, 70);
  });

  it('does not mutate the input stats object', () => {
    const stats = { academic: 50, financial: 50, work_ethic: 50, social: 50 };
    applyStatDeltas(stats, { academic: 10 }, defaultArchetypes);
    assert.equal(stats.academic, 50);
  });

  it('high conscientiousness amplifies academic gains', () => {
    const highC = { ...defaultArchetypes, C: 1.0 };
    const result = applyStatDeltas(baseStats, { academic: 10 }, highC);
    // delta = 10 * (1 + (1.0-0.5)*0.6) = 10 * 1.3 = 13
    assert.equal(result.academic, 73);
  });

  it('low conscientiousness reduces academic gains', () => {
    const lowC = { ...defaultArchetypes, C: 0.0 };
    const result = applyStatDeltas(baseStats, { academic: 10 }, lowC);
    // delta = 10 * (1 + (0.0-0.5)*0.6) = 10 * 0.7 = 7
    assert.equal(result.academic, 67);
  });

  it('high grit softens work_ethic penalties', () => {
    const highGrit = { ...defaultArchetypes, grit: 1.0 };
    const result = applyStatDeltas(baseStats, { work_ethic: -20 }, highGrit);
    // delta = -20 * (1 - 1.0*0.4) = -20 * 0.6 = -12
    assert.equal(result.work_ethic, 58);
  });

  it('high neuroticism worsens academic penalties', () => {
    const highN = { ...defaultArchetypes, N: 1.0 };
    const result = applyStatDeltas(baseStats, { academic: -10 }, highN);
    // delta = -10 * (1 + (1.0-0.5)*0.4) = -10 * 1.2 = -12
    assert.equal(result.academic, 48);
  });

  it('clamps results to [0, 100]', () => {
    const result = applyStatDeltas({ academic: 95, financial: 5, work_ethic: 50, social: 50 },
      { academic: 20, financial: -20 }, defaultArchetypes);
    assert.equal(result.academic, 100);
    assert.equal(result.financial, 0);
  });

  it('handles missing stats gracefully (defaults to 0)', () => {
    const result = applyStatDeltas({}, { academic: 10 }, defaultArchetypes);
    assert.equal(result.academic, 10);
  });
});

// ─── computeOpportunityScore ──────────────────────────────────────────────────

describe('computeOpportunityScore', () => {
  it('computes correct score for high_school phase', () => {
    // 60*0.5 + 70*0.3 + 50*0.15 + 40*0.05 = 30+21+7.5+2 = 60.5
    const score = computeOpportunityScore(baseStats, 'high_school');
    assert.equal(score, 60.5);
  });

  it('computes correct score for adult phase', () => {
    // financial*0.5 + work_ethic*0.3 + social*0.1 + academic*0.1
    // 40*0.5 + 70*0.3 + 50*0.1 + 60*0.1 = 20+21+5+6 = 52
    const score = computeOpportunityScore(baseStats, 'adult');
    assert.equal(score, 52);
  });

  it('throws for an unknown phase', () => {
    assert.throws(() => computeOpportunityScore(baseStats, 'kindergarten'), /Unknown phase/);
  });
});

// ─── checkPrerequisites ───────────────────────────────────────────────────────

describe('checkPrerequisites', () => {
  it('passes an event with no prerequisites', () => {
    assert.equal(checkPrerequisites(makeEvent(), defaultGameRun, new Set()), true);
  });

  it('fails phase mismatch', () => {
    const event = makeEvent({ prerequisites: { phase: 'college' } });
    assert.equal(checkPrerequisites(event, defaultGameRun, new Set()), false);
  });

  it('fails if run_number is below minimum', () => {
    const event = makeEvent({ prerequisites: { min_run_number: 3 } });
    assert.equal(checkPrerequisites(event, defaultGameRun, new Set()), false);
  });

  it('passes if run_number meets minimum', () => {
    const event = makeEvent({ prerequisites: { min_run_number: 1 } });
    assert.equal(checkPrerequisites(event, defaultGameRun, new Set()), true);
  });

  it('fails if stat minimum not met', () => {
    const event = makeEvent({ prerequisites: { stat_minimums: { academic: 80 } } });
    assert.equal(checkPrerequisites(event, defaultGameRun, new Set()), false);
  });

  it('passes if stat minimum is met', () => {
    const event = makeEvent({ prerequisites: { stat_minimums: { academic: 60 } } });
    assert.equal(checkPrerequisites(event, defaultGameRun, new Set()), true);
  });

  it('fails if required prior event not seen', () => {
    const event = makeEvent({ prerequisites: { required_events: ['evt-99'] } });
    assert.equal(checkPrerequisites(event, defaultGameRun, new Set(['evt-1'])), false);
  });

  it('passes if required prior event was seen', () => {
    const event = makeEvent({ prerequisites: { required_events: ['evt-99'] } });
    assert.equal(checkPrerequisites(event, defaultGameRun, new Set(['evt-99'])), true);
  });

  it('fails if a blocking event was seen', () => {
    const event = makeEvent({ prerequisites: { blockers: ['evt-bad'] } });
    assert.equal(checkPrerequisites(event, defaultGameRun, new Set(['evt-bad'])), false);
  });

  it('passes if no blocking events were seen', () => {
    const event = makeEvent({ prerequisites: { blockers: ['evt-bad'] } });
    assert.equal(checkPrerequisites(event, defaultGameRun, new Set(['evt-other'])), true);
  });
});

// ─── drawNextEvent ────────────────────────────────────────────────────────────

describe('drawNextEvent', () => {
  it('returns null when no eligible events exist', () => {
    const result = drawNextEvent([], defaultGameRun);
    assert.equal(result, null);
  });

  it('skips events from wrong phase', () => {
    const pool = [makeEvent({ phase: 'college' })];
    assert.equal(drawNextEvent(pool, defaultGameRun), null);
  });

  it('skips already-seen non-repeatable events', () => {
    const pool = [makeEvent({ id: 'evt-1' })];
    assert.equal(drawNextEvent(pool, defaultGameRun, new Set(['evt-1'])), null);
  });

  it('returns repeatable events even if already seen', () => {
    const pool = [makeEvent({ id: 'evt-1', is_repeatable: true })];
    const result = drawNextEvent(pool, defaultGameRun, new Set(['evt-1']));
    assert.notEqual(result, null);
    assert.equal(result.id, 'evt-1');
  });

  it('applies ripple boosts to selection probability', () => {
    // With a very high boost on evt-2, it should be drawn almost always
    const pool = [
      makeEvent({ id: 'evt-1', rotation_weight: 1 }),
      makeEvent({ id: 'evt-2', rotation_weight: 1 }),
    ];
    const rippleBoosts = { 'evt-2': 1000 };
    let evt2Count = 0;
    for (let i = 0; i < 100; i++) {
      const drawn = drawNextEvent(pool, defaultGameRun, new Set(), new Set(), rippleBoosts);
      if (drawn?.id === 'evt-2') evt2Count++;
    }
    assert.ok(evt2Count > 90, `Expected >90 evt-2 draws, got ${evt2Count}`);
  });

  it('skips recently shown events', () => {
    const pool = [makeEvent({ id: 'evt-1' }), makeEvent({ id: 'evt-2' })];
    const result = drawNextEvent(pool, defaultGameRun, new Set(), new Set(['evt-1']));
    assert.equal(result?.id, 'evt-2');
  });
});

// ─── resolveChoice ────────────────────────────────────────────────────────────

describe('resolveChoice', () => {
  it('returns updatedRun and logEntry', () => {
    const event = makeEvent();
    const choice = makeChoice({ stat_deltas: { academic: 5 } });
    const { updatedRun, logEntry } = resolveChoice(defaultGameRun, event, choice, defaultArchetypes);
    assert.equal(updatedRun.stats.academic, 65);
    assert.equal(logEntry.event_id, event.id);
    assert.equal(logEntry.choice_id, choice.id);
  });

  it('does not mutate the original gameRun', () => {
    const event = makeEvent();
    const choice = makeChoice({ stat_deltas: { academic: 10 } });
    resolveChoice(defaultGameRun, event, choice, defaultArchetypes);
    assert.equal(defaultGameRun.stats.academic, 60);
  });

  it('logEntry captures stats_before and stats_after correctly', () => {
    const event = makeEvent();
    const choice = makeChoice({ stat_deltas: { work_ethic: -5 } });
    const { logEntry } = resolveChoice(defaultGameRun, event, choice, defaultArchetypes);
    assert.equal(logEntry.stats_before.work_ethic, 70);
    // grit=0.5 softens the penalty: -5 * (1 - 0.5*0.4) = -5 * 0.8 = -4 → 66
    assert.equal(logEntry.stats_after.work_ethic, 66);
  });

  it('logEntry starts with ripple_triggered: false', () => {
    const { logEntry } = resolveChoice(defaultGameRun, makeEvent(), makeChoice(), defaultArchetypes);
    assert.equal(logEntry.ripple_triggered, false);
  });
});

// ─── processRipple ────────────────────────────────────────────────────────────

describe('processRipple', () => {
  const rippleChoice = makeChoice({
    id: 'c-party',
    ripple_payload: { 'evt-sick': 2.5 },
  });
  const otherChoice = makeChoice({ id: 'c-study', ripple_payload: null });
  const allChoices = [rippleChoice, otherChoice];

  it('does not fire when class is empty', () => {
    const { firedRipple } = processRipple(makeEvent(), {}, allChoices);
    assert.equal(firedRipple, false);
  });

  it('does not fire when dominant choice is below 40%', () => {
    const classChoices = { s1: 'c-party', s2: 'c-study', s3: 'c-study', s4: 'c-study' };
    const { firedRipple } = processRipple(makeEvent(), classChoices, allChoices);
    assert.equal(firedRipple, false);
  });

  it('fires when ≥ 40% choose the same option with a ripple_payload', () => {
    // c-party must be the plurality AND ≥40% — give it 3/5 = 60%
    const classChoices = { s1: 'c-party', s2: 'c-party', s3: 'c-party', s4: 'c-study', s5: 'c-study' };
    const { firedRipple, dominantChoiceId } = processRipple(makeEvent(), classChoices, allChoices);
    assert.equal(firedRipple, true);
    assert.equal(dominantChoiceId, 'c-party');
  });

  it('does not fire when dominant choice has no ripple_payload', () => {
    // majority picks study (no payload)
    const classChoices = { s1: 'c-study', s2: 'c-study', s3: 'c-party' };
    const { firedRipple } = processRipple(makeEvent(), classChoices, allChoices);
    assert.equal(firedRipple, false);
  });

  it('rippleBoostsByStudent only includes students who picked the dominant choice', () => {
    const classChoices = { s1: 'c-party', s2: 'c-party', s3: 'c-study' };
    const { rippleBoostsByStudent } = processRipple(makeEvent(), classChoices, allChoices);
    assert.ok('s1' in rippleBoostsByStudent);
    assert.ok('s2' in rippleBoostsByStudent);
    assert.ok(!('s3' in rippleBoostsByStudent));
  });
});

// ─── getAvailablePaths ────────────────────────────────────────────────────────

describe('getAvailablePaths', () => {
  it('always includes workforce (min score 0)', () => {
    const run = { ...defaultGameRun, stats: { academic: 0, financial: 0, work_ethic: 0, social: 0 } };
    const paths = getAvailablePaths(run);
    assert.ok(paths.find(p => p.id === 'workforce'));
  });

  it('excludes ivy_league when score is too low', () => {
    const paths = getAvailablePaths(defaultGameRun);
    // score is 60.5, ivy requires 88
    assert.ok(!paths.find(p => p.id === 'ivy_league'));
  });

  it('includes ivy_league when stats are maxed out', () => {
    const run = { ...defaultGameRun, stats: { academic: 100, financial: 100, work_ethic: 100, social: 100 } };
    const paths = getAvailablePaths(run);
    assert.ok(paths.find(p => p.id === 'ivy_league'));
  });

  it('returns paths in ascending min_score order', () => {
    const paths = getAvailablePaths(defaultGameRun);
    for (let i = 1; i < paths.length; i++) {
      assert.ok(paths[i].min_score >= paths[i - 1].min_score);
    }
  });
});

// ─── advancePhase ─────────────────────────────────────────────────────────────

describe('advancePhase', () => {
  it('transitions high_school → college', () => {
    const updated = advancePhase(defaultGameRun, 'college', 'state_university');
    assert.equal(updated.phase, 'college');
    assert.equal(updated.path_id, 'state_university');
  });

  it('throws on invalid phase transition', () => {
    assert.throws(() => advancePhase(defaultGameRun, 'adult', 'workforce'), /Invalid phase transition/);
  });

  it('throws if chosen path is not available', () => {
    assert.throws(() => advancePhase(defaultGameRun, 'college', 'ivy_league'), /not available/);
  });

  it('transitions college → adult', () => {
    const collegeRun = { ...defaultGameRun, phase: 'college', path_id: 'state_university' };
    const updated = advancePhase(collegeRun, 'adult', null);
    assert.equal(updated.phase, 'adult');
  });

  it('does not mutate the original gameRun', () => {
    advancePhase(defaultGameRun, 'college', 'workforce');
    assert.equal(defaultGameRun.phase, 'high_school');
  });
});

// ─── estimateFederalTax ───────────────────────────────────────────────────────

describe('estimateFederalTax', () => {
  it('returns 0 for zero income', () => {
    assert.equal(estimateFederalTax(0), 0);
  });

  it('returns 0 for negative income', () => {
    assert.equal(estimateFederalTax(-1000), 0);
  });

  it('applies 10% bracket correctly', () => {
    // $10,000 income → 10% of 10,000 = $1,000
    assert.equal(estimateFederalTax(10000), 1000);
  });

  it('applies multiple brackets correctly for $50,000 income', () => {
    // 10% on 0-11600 = 1160
    // 12% on 11600-47150 = 4266
    // 22% on 47150-50000 = 627
    const expected = 1160 + (47150 - 11600) * 0.12 + (50000 - 47150) * 0.22;
    assert.equal(estimateFederalTax(50000), Math.round(expected * 100) / 100);
  });
});

// ─── computeLoanPayment ───────────────────────────────────────────────────────

describe('computeLoanPayment', () => {
  it('returns 0 for zero principal', () => {
    assert.equal(computeLoanPayment(0, 0.0653, 10), 0);
  });

  it('computes payment for $30,000 at 6.53% over 10 years', () => {
    const payment = computeLoanPayment(30000, 0.0653, 10);
    // Ballpark: ~$338/month
    assert.ok(payment > 300 && payment < 400, `Unexpected payment: ${payment}`);
  });

  it('higher principal = higher payment', () => {
    const low = computeLoanPayment(10000, 0.0653, 10);
    const high = computeLoanPayment(50000, 0.0653, 10);
    assert.ok(high > low);
  });

  it('longer term = lower monthly payment', () => {
    const short = computeLoanPayment(30000, 0.0653, 5);
    const long  = computeLoanPayment(30000, 0.0653, 20);
    assert.ok(short > long);
  });
});

// ─── computeMonthlyBudget ─────────────────────────────────────────────────────

describe('computeMonthlyBudget', () => {
  const occupation = { median_annual_wage: 60000 };
  const costs = {
    median_rent: 1200,
    monthly_groceries: 400,
    monthly_transport: 350,
    monthly_utilities: 150,
    monthly_healthcare: 200,
    tuition_total: 0,
  };
  const adultRun = {
    ...defaultGameRun,
    phase: 'adult',
    path_id: 'state_university',
    stats: { ...baseStats },
  };

  it('returns all required output fields', () => {
    const budget = computeMonthlyBudget(adultRun, occupation, costs);
    assert.ok('gross_monthly' in budget);
    assert.ok('net_monthly' in budget);
    assert.ok('deductions' in budget);
    assert.ok('expenses' in budget);
    assert.ok('net_cash_flow' in budget);
    assert.ok('is_solvent' in budget);
  });

  it('gross_monthly is annual_salary / 12', () => {
    const budget = computeMonthlyBudget(adultRun, occupation, costs);
    assert.ok(Math.abs(budget.gross_monthly - budget.annual_salary / 12) < 0.01);
  });

  it('work_ethic stat increases gross salary', () => {
    const highEthicRun = { ...adultRun, stats: { ...baseStats, work_ethic: 100 } };
    const lowEthicRun  = { ...adultRun, stats: { ...baseStats, work_ethic: 0   } };
    const high = computeMonthlyBudget(highEthicRun, occupation, costs);
    const low  = computeMonthlyBudget(lowEthicRun,  occupation, costs);
    assert.ok(high.gross_monthly > low.gross_monthly);
  });

  it('is_solvent is true when income covers expenses', () => {
    const highWage = { median_annual_wage: 200000 };
    const budget = computeMonthlyBudget(adultRun, highWage, costs);
    assert.equal(budget.is_solvent, true);
  });

  it('is_solvent is false when expenses exceed income', () => {
    const lowWage = { median_annual_wage: 15000 };
    const budget = computeMonthlyBudget(adultRun, lowWage, costs);
    assert.equal(budget.is_solvent, false);
  });

  it('student loan is included for education paths', () => {
    const costsWithTuition = { ...costs, tuition_total: 40000 };
    const budget = computeMonthlyBudget(adultRun, occupation, costsWithTuition);
    assert.ok(budget.expenses.student_loan > 0);
  });

  it('student loan is zero for workforce path', () => {
    const workforceRun = { ...adultRun, path_id: 'workforce' };
    const costsWithTuition = { ...costs, tuition_total: 40000 };
    const budget = computeMonthlyBudget(workforceRun, occupation, costsWithTuition);
    assert.equal(budget.expenses.student_loan, 0);
  });
});

// ─── computeOutcome ───────────────────────────────────────────────────────────

describe('computeOutcome', () => {
  const occupation = { median_annual_wage: 65000 };

  it('returns total_score and breakdown', () => {
    const run = { ...defaultGameRun, phase: 'adult', path_id: 'state_university', net_worth: 200000 };
    const result = computeOutcome(run, occupation);
    assert.ok('total_score' in result);
    assert.ok('breakdown' in result);
    assert.ok('net_worth_score' in result.breakdown);
    assert.ok('career_attainment_score' in result.breakdown);
    assert.ok('quality_of_life_score' in result.breakdown);
  });

  it('higher net worth yields higher score', () => {
    const poor = { ...defaultGameRun, phase: 'adult', path_id: 'workforce', net_worth: 0 };
    const rich = { ...defaultGameRun, phase: 'adult', path_id: 'workforce', net_worth: 1000000 };
    const s1 = computeOutcome(poor, occupation);
    const s2 = computeOutcome(rich, occupation);
    assert.ok(s2.total_score > s1.total_score);
  });

  it('ivy_league path yields higher career score than workforce', () => {
    const wf = { ...defaultGameRun, phase: 'adult', path_id: 'workforce', net_worth: 100000 };
    const iv = { ...defaultGameRun, phase: 'adult', path_id: 'ivy_league', net_worth: 100000 };
    const s1 = computeOutcome(wf, occupation);
    const s2 = computeOutcome(iv, occupation);
    assert.ok(s2.total_score > s1.total_score);
  });

  it('total_score is between 0 and 100', () => {
    const run = { ...defaultGameRun, phase: 'adult', path_id: 'state_university', net_worth: 150000 };
    const result = computeOutcome(run, occupation);
    assert.ok(result.total_score >= 0 && result.total_score <= 100);
  });
});

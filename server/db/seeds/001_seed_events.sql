-- Seed decision events for all three phases.
-- This is starter content — the full library requires human authoring
-- by Leonardo and his wife based on real classroom scenarios.
-- Add more events to decision_events + event_choices following the same pattern.

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- HIGH SCHOOL EVENTS
-- ────────────────────────────────────────────────────────────────────────────

-- Event 1: Study vs hang out (classic opener)
WITH e AS (
  INSERT INTO decision_events (id, phase, category, rotation_weight, prompt_text, prerequisites)
  VALUES (
    'hs-001', 'high_school', 'academic', 1.5,
    'It''s the night before a big history exam. Your friends are texting asking you to come hang out. What do you do?',
    '{}'
  ) RETURNING id
)
INSERT INTO event_choices (event_id, choice_order, choice_text, outcome_text, stat_deltas, ripple_payload)
SELECT id, 1, 'Stay home and study', 'You stayed focused. The extra review paid off — you felt confident walking in.', '{"academic": 8, "social": -3}', NULL FROM e
UNION ALL
SELECT id, 2, 'Go hang out, study in the morning', 'You had a good time but morning cramming left you foggy. You did okay, not great.', '{"academic": -3, "social": 6, "work_ethic": -2}', NULL FROM e
UNION ALL
SELECT id, 3, 'Invite friends over to study together', 'Smart move. The group session helped everyone and you still had fun.', '{"academic": 5, "social": 5}',
  '{"hs-001-ripple": 1.8}'::jsonb FROM e;

-- Event 2: Part-time job offer
WITH e AS (
  INSERT INTO decision_events (id, phase, category, rotation_weight, prompt_text, prerequisites)
  VALUES (
    'hs-002', 'high_school', 'financial', 1.2,
    'A local grocery store offers you a part-time job — 15 hours a week, $12/hr. Your parents say it''s your call.',
    '{}'
  ) RETURNING id
)
INSERT INTO event_choices (event_id, choice_order, choice_text, outcome_text, stat_deltas)
SELECT id, 1, 'Take the job', 'Having your own money feels great. You learn to manage your time, but school slips a little.', '{"financial": 10, "work_ethic": 6, "academic": -4}' FROM e
UNION ALL
SELECT id, 2, 'Pass — focus on school', 'You stay free to study and join activities. No income, but your grades stay strong.', '{"academic": 5, "work_ethic": 2}' FROM e
UNION ALL
SELECT id, 3, 'Negotiate — work weekends only', 'They agree. You earn some money without destroying your schedule. Smart negotiation.', '{"financial": 5, "work_ethic": 8, "academic": -1}' FROM e;

-- Event 3: Cheating on a test (ethical choice)
WITH e AS (
  INSERT INTO decision_events (id, phase, category, rotation_weight, prompt_text, prerequisites)
  VALUES (
    'hs-003', 'high_school', 'academic', 0.9,
    'You forgot about a quiz and completely blanked. Your classmate slides their paper toward you.',
    '{}'
  ) RETURNING id
)
INSERT INTO event_choices (event_id, choice_order, choice_text, outcome_text, stat_deltas, ripple_payload)
SELECT id, 1, 'Don''t look — take the zero', 'It stings, but you keep your integrity. Your teacher notices your honesty later.', '{"academic": -8, "work_ethic": 5, "social": 2}', NULL FROM e
UNION ALL
SELECT id, 2, 'Glance at a few answers', 'You pass, but feel uneasy. A pattern like this becomes a habit.', '{"academic": 4, "work_ethic": -6}',
  '{"hs-003-ripple": 2.0}'::jsonb FROM e
UNION ALL
SELECT id, 3, 'Ask to move your seat — you don''t want the temptation', 'Mature move. Your teacher respects you more for it.', '{"academic": -4, "work_ethic": 7, "social": 3}', NULL FROM e;

-- Event 4: Extracurricular (social capital builder)
WITH e AS (
  INSERT INTO decision_events (id, phase, category, rotation_weight, prompt_text, prerequisites)
  VALUES (
    'hs-004', 'high_school', 'social', 1.3,
    'Tryouts are coming up. You could join the debate team, varsity soccer, or skip activities this semester.',
    '{}'
  ) RETURNING id
)
INSERT INTO event_choices (event_id, choice_order, choice_text, outcome_text, stat_deltas)
SELECT id, 1, 'Join debate team', 'You learn to argue persuasively and think fast. Colleges love this.', '{"academic": 5, "social": 6, "work_ethic": 3}' FROM e
UNION ALL
SELECT id, 2, 'Try out for soccer', 'Team sports build discipline and friendships. Your coach becomes a mentor.', '{"social": 8, "work_ethic": 5}' FROM e
UNION ALL
SELECT id, 3, 'Skip — need the free time', 'You rest and recharge. Your grades stay solid but your social circle doesn''t grow much.', '{"academic": 3, "social": -2}' FROM e;

-- Event 5: Financial emergency (parents struggling)
WITH e AS (
  INSERT INTO decision_events (id, phase, category, rotation_weight, prompt_text, prerequisites)
  VALUES (
    'hs-005', 'high_school', 'financial', 0.8,
    'Your family hits a rough patch. Your mom asks if you can contribute some of your savings to help with bills.',
    '{}'
  ) RETURNING id
)
INSERT INTO event_choices (event_id, choice_order, choice_text, outcome_text, stat_deltas)
SELECT id, 1, 'Give what you can without hesitation', 'The family pulls through. Your sacrifice is noticed and appreciated.', '{"financial": -6, "social": 5, "work_ethic": 4}' FROM e
UNION ALL
SELECT id, 2, 'Offer a little but keep most of your savings', 'A compromise. You help, but protect your future a little too.', '{"financial": -2, "social": 2}' FROM e
UNION ALL
SELECT id, 3, 'Explain that you''re saving for college', 'Your mom understands. You feel guilty but stay focused on the long game.', '{"financial": 2, "social": -3, "academic": 2}' FROM e;

-- Event 6: Ripple — party weekend (is_ripple = true)
WITH e AS (
  INSERT INTO decision_events (id, phase, category, is_ripple, rotation_weight, prompt_text, prerequisites)
  VALUES (
    'hs-006', 'high_school', 'social', true, 1.0,
    'A senior throws the party of the year the weekend before finals week. Practically everyone is going.',
    '{}'
  ) RETURNING id
)
INSERT INTO event_choices (event_id, choice_order, choice_text, outcome_text, stat_deltas, ripple_payload)
SELECT id, 1, 'Go to the party', 'Great night. But Monday morning hits hard.', '{"social": 8, "academic": -5, "work_ethic": -3}',
  '{"hs-sick-event": 2.5}'::jsonb FROM e
UNION ALL
SELECT id, 2, 'Stay home and prepare for finals', 'You miss out socially, but walk into finals rested and ready.', '{"academic": 6, "social": -4}', NULL FROM e
UNION ALL
SELECT id, 3, 'Go for a few hours, then leave early', 'Best of both worlds — mostly.', '{"social": 4, "academic": -1}',
  '{"hs-sick-event": 1.3}'::jsonb FROM e;

-- Event 7: Sick event (triggered by ripple from party)
WITH e AS (
  INSERT INTO decision_events (id, phase, category, rotation_weight, is_repeatable, prompt_text, prerequisites)
  VALUES (
    'hs-sick-event', 'high_school', 'random', 0.1, false,
    'You wake up Monday with a fever. It''s the day before your chemistry final.',
    '{}'
  ) RETURNING id
)
INSERT INTO event_choices (event_id, choice_order, choice_text, outcome_text, stat_deltas)
SELECT id, 1, 'Push through and take the test anyway', 'You barely hold it together. You pass, but just barely.', '{"academic": -8, "work_ethic": 4}' FROM e
UNION ALL
SELECT id, 2, 'Email your teacher and request a makeup', 'Your teacher appreciates the honesty and gives you a makeup the following week.', '{"academic": -2, "social": 2}' FROM e;

-- Event 8: Mentorship opportunity
WITH e AS (
  INSERT INTO decision_events (id, phase, category, rotation_weight, prompt_text, prerequisites)
  VALUES (
    'hs-008', 'high_school', 'academic', 1.1,
    'Your favorite teacher offers to mentor you after school — college apps, study skills, and life advice. It''s optional and unpaid.',
    '{}'
  ) RETURNING id
)
INSERT INTO event_choices (event_id, choice_order, choice_text, outcome_text, stat_deltas)
SELECT id, 1, 'Say yes and show up consistently', 'Best decision you make in high school. Their letters of recommendation open real doors.', '{"academic": 8, "work_ethic": 6, "social": 3}' FROM e
UNION ALL
SELECT id, 2, 'Agree but cancel more than you attend', 'You mean well but don''t follow through. They stop offering.', '{"academic": 2, "work_ethic": -5}' FROM e
UNION ALL
SELECT id, 3, 'Decline — too busy right now', 'You protect your schedule. The window closes.', '{"work_ethic": 2, "academic": -1}' FROM e;

-- ────────────────────────────────────────────────────────────────────────────
-- COLLEGE EVENTS
-- ────────────────────────────────────────────────────────────────────────────

-- Event 9: Choosing a major
WITH e AS (
  INSERT INTO decision_events (id, phase, category, rotation_weight, prompt_text, prerequisites)
  VALUES (
    'col-001', 'college', 'academic', 1.5,
    'You need to declare a major. Your heart says art history. Your head says nursing. Your parents say business.',
    '{}'
  ) RETURNING id
)
INSERT INTO event_choices (event_id, choice_order, choice_text, outcome_text, stat_deltas)
SELECT id, 1, 'Follow your passion — art history', 'You love every class. Your grades are great but the job outlook is narrower.', '{"academic": 9, "social": 4, "financial": -4}' FROM e
UNION ALL
SELECT id, 2, 'Nursing — strong job market', 'Challenging but rewarding. You struggle early, but the career ceiling is high.', '{"academic": -2, "work_ethic": 8, "financial": 6}' FROM e
UNION ALL
SELECT id, 3, 'Business — practical and flexible', 'Not your dream, but doors stay open. You do well.', '{"academic": 3, "financial": 5, "work_ethic": 4}' FROM e;

-- Event 10: Student loan decision
WITH e AS (
  INSERT INTO decision_events (id, phase, category, rotation_weight, prompt_text, prerequisites)
  VALUES (
    'col-002', 'college', 'financial', 1.3,
    'You''re offered an additional $8,000 unsubsidized loan beyond what you need. Some students use it to avoid working during school.',
    '{}'
  ) RETURNING id
)
INSERT INTO event_choices (event_id, choice_order, choice_text, outcome_text, stat_deltas)
SELECT id, 1, 'Take the extra loan — less stress now', 'You live comfortably but that debt will cost you thousands more in interest.', '{"financial": -8, "academic": 3}' FROM e
UNION ALL
SELECT id, 2, 'Decline — take only what you need', 'Tighter budget, but you''ll graduate with less hanging over you.', '{"financial": 6, "work_ethic": 4, "academic": -1}' FROM e
UNION ALL
SELECT id, 3, 'Decline and pick up campus work-study instead', 'You earn a little, build a resume, and stay out of extra debt. Best of both.', '{"financial": 4, "work_ethic": 7, "academic": -2}' FROM e;

-- Event 11: Internship vs. GPA
WITH e AS (
  INSERT INTO decision_events (id, phase, category, rotation_weight, prompt_text, prerequisites)
  VALUES (
    'col-003', 'college', 'academic', 1.2,
    'A company offers you a part-time internship. It pays $16/hr and could lead to a job offer. But it''s during the semester.',
    '{}'
  ) RETURNING id
)
INSERT INTO event_choices (event_id, choice_order, choice_text, outcome_text, stat_deltas)
SELECT id, 1, 'Take the internship', 'Real-world experience. Your GPA dips slightly, but your resume gets strong.', '{"financial": 8, "work_ethic": 8, "academic": -4}' FROM e
UNION ALL
SELECT id, 2, 'Decline — protect your GPA', 'Your grades stay strong. You lose the experience but keep grad school options open.', '{"academic": 6, "financial": -2}' FROM e
UNION ALL
SELECT id, 3, 'Negotiate down to 10 hours a week', 'They agree. You get a taste of real work without your studies collapsing.', '{"financial": 4, "work_ethic": 5, "academic": -1}' FROM e;

-- Event 12: Drop a hard class
WITH e AS (
  INSERT INTO decision_events (id, phase, category, rotation_weight, prompt_text, prerequisites)
  VALUES (
    'col-004', 'college', 'academic', 1.0,
    'Organic Chemistry is kicking your teeth in. You''re at a C– with 6 weeks left. You can drop without penalty by Friday.',
    '{}'
  ) RETURNING id
)
INSERT INTO event_choices (event_id, choice_order, choice_text, outcome_text, stat_deltas)
SELECT id, 1, 'Drop it and retake next semester', 'Smart retreat. You retake it rested and earn a B.', '{"academic": -2, "work_ethic": -3, "financial": -3}' FROM e
UNION ALL
SELECT id, 2, 'Stay and fight for a passing grade', 'You grind. You pull a C. You learn more about perseverance than chemistry.', '{"academic": -5, "work_ethic": 10}' FROM e
UNION ALL
SELECT id, 3, 'Get a tutor immediately', 'You scramble but the extra help moves you to a B–. More expensive but it worked.', '{"academic": 3, "financial": -5, "work_ethic": 5}' FROM e;

-- ────────────────────────────────────────────────────────────────────────────
-- ADULT LIFE EVENTS
-- ────────────────────────────────────────────────────────────────────────────

-- Event 13: First apartment choice
WITH e AS (
  INSERT INTO decision_events (id, phase, category, rotation_weight, prompt_text, prerequisites)
  VALUES (
    'adult-001', 'adult', 'financial', 1.5,
    'You''re apartment hunting. You can afford a nicer 1BR solo, split a 2BR with a stranger, or live with family rent-free for a year.',
    '{}'
  ) RETURNING id
)
INSERT INTO event_choices (event_id, choice_order, choice_text, outcome_text, stat_deltas)
SELECT id, 1, 'Nice 1BR solo — you''ve earned it', 'Freedom is wonderful. So is the credit card debt you accumulate to furnish it.', '{"financial": -8, "social": 3}' FROM e
UNION ALL
SELECT id, 2, 'Roommate split — save money fast', 'Tighter quarters, but you bank $600/month more. Your savings grow fast.', '{"financial": 9, "social": 4}' FROM e
UNION ALL
SELECT id, 3, 'Live with family — save aggressively', 'Zero rent for a year. You save a down payment starter. The tradeoff is independence.', '{"financial": 12, "social": -3, "work_ethic": 3}' FROM e;

-- Event 14: Emergency fund test
WITH e AS (
  INSERT INTO decision_events (id, phase, category, rotation_weight, prompt_text, prerequisites)
  VALUES (
    'adult-002', 'adult', 'financial', 1.2,
    'Your car breaks down. The repair is $1,400. You have $900 in savings. You need the car for work.',
    '{}'
  ) RETURNING id
)
INSERT INTO event_choices (event_id, choice_order, choice_text, outcome_text, stat_deltas)
SELECT id, 1, 'Put it on a credit card', 'Fixed. But at 24% APR, that $500 gap will cost you real money in interest.', '{"financial": -7}' FROM e
UNION ALL
SELECT id, 2, 'Ask family for a short-term loan', 'They help. You pay it back in 3 months. The relationship stays good.', '{"financial": -2, "social": -2}' FROM e
UNION ALL
SELECT id, 3, 'Negotiate a payment plan with the mechanic', 'They say yes. You pay $350/month for 4 months. No credit card needed.', '{"financial": -3, "work_ethic": 4}' FROM e;

-- Event 15: Career advancement decision
WITH e AS (
  INSERT INTO decision_events (id, phase, category, rotation_weight, prompt_text, prerequisites)
  VALUES (
    'adult-003', 'adult', 'academic', 1.3,
    'Your company offers to pay for a graduate certificate if you commit to staying 2 more years. It would boost your salary by 15%.',
    '{}'
  ) RETURNING id
)
INSERT INTO event_choices (event_id, choice_order, choice_text, outcome_text, stat_deltas)
SELECT id, 1, 'Accept the deal', 'You lock in 2 years, but you emerge with credentials and a raise.', '{"academic": 8, "financial": 10, "work_ethic": 5}' FROM e
UNION ALL
SELECT id, 2, 'Decline — you want flexibility', 'You stay mobile. A competitor recruits you 6 months later for more money.', '{"financial": 6, "social": 3}' FROM e
UNION ALL
SELECT id, 3, 'Counter-propose a 1-year commitment', 'They say no. You walk away having tried to negotiate — good practice either way.', '{"work_ethic": 4}' FROM e;

-- Event 16: Retirement contribution
WITH e AS (
  INSERT INTO decision_events (id, phase, category, rotation_weight, prompt_text, prerequisites)
  VALUES (
    'adult-004', 'adult', 'financial', 1.4,
    'Your employer offers a 401(k) match up to 5%. You can contribute 0%, 5%, or 10% of your paycheck.',
    '{}'
  ) RETURNING id
)
INSERT INTO event_choices (event_id, choice_order, choice_text, outcome_text, stat_deltas)
SELECT id, 1, 'Contribute 0% — need every dollar now', 'You feel rich monthly. But you''re leaving free money on the table and starting late.', '{"financial": -6}' FROM e
UNION ALL
SELECT id, 2, 'Contribute 5% — capture the full match', 'You get the full employer match. Compound interest starts working for you.', '{"financial": 8, "work_ethic": 3}' FROM e
UNION ALL
SELECT id, 3, 'Contribute 10% — max it out early', 'A tight month-to-month, but 30 years of compound growth will make you comfortable.', '{"financial": 12, "work_ethic": 5}' FROM e;

COMMIT;

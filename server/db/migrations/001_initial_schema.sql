-- Life-RPG initial schema
-- 14 tables across 5 layers: Platform, Identity, Game, Research, Data

BEGIN;

-- ─── Extensions ────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── LAYER 1: Platform ─────────────────────────────────────────────────────────

CREATE TABLE schools (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  district      TEXT,
  state_abbr    CHAR(2),
  license_type  TEXT NOT NULL DEFAULT 'trial' CHECK (license_type IN ('trial','standard','research')),
  license_expires_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE teachers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       UUID REFERENCES schools(id) ON DELETE CASCADE,
  display_name    TEXT NOT NULL,
  email           TEXT UNIQUE NOT NULL,
  google_sub      TEXT UNIQUE,          -- Google OAuth subject ID
  clever_id       TEXT UNIQUE,          -- Clever SSO id
  tier            TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free','pro')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON teachers(school_id);

CREATE TABLE classes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id      UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  class_code      CHAR(6) UNIQUE NOT NULL,  -- fallback join code, e.g. "XKQT9A"
  -- Visibility tier: blind | aggregate | open
  visibility      TEXT NOT NULL DEFAULT 'aggregate' CHECK (visibility IN ('blind','aggregate','open')),
  active          BOOLEAN NOT NULL DEFAULT true,
  snapshot_id     UUID,                 -- FK added after semester_snapshots table
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON classes(teacher_id);
CREATE INDEX ON classes(class_code);

CREATE TABLE student_enrollments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    UUID NOT NULL,          -- FK added after students table
  class_id      UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  enrolled_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, class_id)
);

CREATE INDEX ON student_enrollments(class_id);

-- ─── LAYER 2: Identity ──────────────────────────────────────────────────────────

-- No passwords stored. Students authenticate via SSO or class code.
-- Privacy firewall: research exports only ever reference research_uuid, never id.
-- There is NO mathematical relationship between id and research_uuid.

CREATE TABLE students (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  research_uuid       UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),  -- privacy firewall
  display_username    TEXT NOT NULL,
  google_sub          TEXT UNIQUE,
  clever_id           TEXT UNIQUE,
  -- COPPA/FERPA compliance
  guardian_consent_at  TIMESTAMPTZ,
  research_consent_at  TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add FK now that students table exists
ALTER TABLE student_enrollments
  ADD CONSTRAINT fk_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;

-- ─── LAYER 3: Game ─────────────────────────────────────────────────────────────

-- One row per student per class per life-run.
-- stats, character_prefs, and other flexible data stored as JSONB.

CREATE TABLE game_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id        UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  run_number      SMALLINT NOT NULL DEFAULT 1,
  phase           TEXT NOT NULL DEFAULT 'high_school'
                    CHECK (phase IN ('high_school','college','adult','complete')),
  path_id         TEXT CHECK (path_id IN (
                    'workforce','military','trade_school','community_college',
                    'state_university','private_university','ivy_league'
                  )),
  -- Core stats (0–100)
  stat_academic   SMALLINT NOT NULL DEFAULT 50 CHECK (stat_academic BETWEEN 0 AND 100),
  stat_financial  SMALLINT NOT NULL DEFAULT 50 CHECK (stat_financial BETWEEN 0 AND 100),
  stat_work_ethic SMALLINT NOT NULL DEFAULT 50 CHECK (stat_work_ethic BETWEEN 0 AND 100),
  stat_social     SMALLINT NOT NULL DEFAULT 50 CHECK (stat_social BETWEEN 0 AND 100),
  -- Adult phase outputs
  net_worth           NUMERIC(12,2) DEFAULT 0,
  quality_of_life     SMALLINT DEFAULT 50,
  career_code         TEXT,             -- BLS SOC occupation code
  final_score         SMALLINT,         -- computed on game completion
  -- Flexible JSONB fields
  character_prefs     JSONB NOT NULL DEFAULT '{}',  -- avatar, name, psychometric responses
  is_complete         BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, class_id, run_number)
);

CREATE INDEX ON game_runs(student_id);
CREATE INDEX ON game_runs(class_id);
CREATE INDEX ON game_runs(class_id, is_complete);

-- The authored event library. Content authored by humans (not generated).
CREATE TABLE decision_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase           TEXT NOT NULL CHECK (phase IN ('high_school','college','adult')),
  category        TEXT NOT NULL CHECK (category IN ('academic','social','financial','random')),
  is_ripple       BOOLEAN NOT NULL DEFAULT false,
  is_repeatable   BOOLEAN NOT NULL DEFAULT false,
  rotation_weight NUMERIC(5,2) NOT NULL DEFAULT 1.0,
  prompt_text     TEXT NOT NULL,
  -- prerequisites stored as JSONB: { phase, min_run_number, stat_minimums, required_events, blockers }
  prerequisites   JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON decision_events(phase, category);
CREATE INDEX ON decision_events(is_ripple);

-- Choices for each event. stat_deltas and ripple_payload stored as JSONB.
CREATE TABLE event_choices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID NOT NULL REFERENCES decision_events(id) ON DELETE CASCADE,
  choice_order    SMALLINT NOT NULL DEFAULT 0,
  choice_text     TEXT NOT NULL,
  outcome_text    TEXT NOT NULL,
  -- stat_deltas: { academic: n, financial: n, work_ethic: n, social: n }
  stat_deltas     JSONB NOT NULL DEFAULT '{}',
  -- ripple_payload: { [eventId]: weight_multiplier } applied to future draws
  ripple_payload  JSONB,
  UNIQUE(event_id, choice_order)
);

CREATE INDEX ON event_choices(event_id);

-- ─── LAYER 4: Research ─────────────────────────────────────────────────────────

-- Immutable, append-only log. Trigger prevents UPDATE/DELETE.
-- Linked to research_uuid ONLY — never to students.id.

CREATE TABLE game_event_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  research_uuid   UUID NOT NULL,        -- references students.research_uuid (no FK — intentional)
  game_run_id     UUID NOT NULL REFERENCES game_runs(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES decision_events(id),
  choice_id       UUID NOT NULL REFERENCES event_choices(id),
  stats_before    JSONB NOT NULL,
  stats_after     JSONB NOT NULL,
  ripple_triggered   BOOLEAN NOT NULL DEFAULT false,
  class_choice_pct   NUMERIC(5,2),     -- % of class that made same choice (0–100)
  logged_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON game_event_log(research_uuid);
CREATE INDEX ON game_event_log(game_run_id);
CREATE INDEX ON game_event_log(logged_at);

-- Prevent any mutation of the event log
CREATE OR REPLACE FUNCTION fn_prevent_log_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'game_event_log is append-only and cannot be updated or deleted';
END;
$$;

CREATE TRIGGER trg_immutable_event_log
  BEFORE UPDATE OR DELETE ON game_event_log
  FOR EACH ROW EXECUTE FUNCTION fn_prevent_log_mutation();

-- Psychometric profiles — linked to research_uuid only.
-- Raw responses stored for research integrity; scored values pre-computed.

CREATE TABLE psychometric_profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  research_uuid   UUID UNIQUE NOT NULL,  -- no FK to students — intentional
  -- Big Five OCEAN scores (0.0–1.0)
  score_O         NUMERIC(4,3) CHECK (score_O BETWEEN 0 AND 1),
  score_C         NUMERIC(4,3) CHECK (score_C BETWEEN 0 AND 1),
  score_E         NUMERIC(4,3) CHECK (score_E BETWEEN 0 AND 1),
  score_A         NUMERIC(4,3) CHECK (score_A BETWEEN 0 AND 1),
  score_N         NUMERIC(4,3) CHECK (score_N BETWEEN 0 AND 1),
  -- Grit Scale (0.0–1.0)
  score_grit      NUMERIC(4,3) CHECK (score_grit BETWEEN 0 AND 1),
  -- Future Time Perspective (0.0–1.0)
  score_ftp       NUMERIC(4,3) CHECK (score_ftp BETWEEN 0 AND 1),
  -- Raw character-creation responses (avatar choices map to trait scores)
  raw_responses   JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── LAYER 5: Data ─────────────────────────────────────────────────────────────

-- One row per class per semester. Data locked at teacher's trigger.
-- Students query snapshot tables only — never live external APIs.

CREATE TABLE semester_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id        UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  label           TEXT NOT NULL,        -- e.g. "Fall 2025"
  pulled_by       UUID NOT NULL REFERENCES teachers(id),
  locked_at       TIMESTAMPTZ,          -- NULL = draft, NOT NULL = immutable
  bls_vintage     TEXT,                 -- BLS data series vintage identifier
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(class_id, label)
);

CREATE INDEX ON semester_snapshots(class_id);

-- Prevent mutation of locked snapshots
CREATE OR REPLACE FUNCTION fn_prevent_locked_snapshot_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.locked_at IS NOT NULL THEN
    RAISE EXCEPTION 'Snapshot % is locked and cannot be modified', OLD.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_locked_snapshot
  BEFORE UPDATE ON semester_snapshots
  FOR EACH ROW EXECUTE FUNCTION fn_prevent_locked_snapshot_mutation();

-- Add FK from classes back to semester_snapshots
ALTER TABLE classes
  ADD CONSTRAINT fk_snapshot FOREIGN KEY (snapshot_id) REFERENCES semester_snapshots(id);

-- ~800 careers from BLS. Salary/growth/attrition per snapshot.
CREATE TABLE snapshot_occupations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id     UUID NOT NULL REFERENCES semester_snapshots(id) ON DELETE CASCADE,
  soc_code        TEXT NOT NULL,        -- BLS Standard Occupational Classification code
  title           TEXT NOT NULL,
  median_annual_wage      NUMERIC(10,2),
  employment_thousands    NUMERIC(10,1),
  projected_growth_pct    NUMERIC(5,2), -- 10-year projected growth %
  median_entry_wage       NUMERIC(10,2),
  typical_education       TEXT,         -- BLS education requirement label
  attrition_rate_pct      NUMERIC(5,2),
  UNIQUE(snapshot_id, soc_code)
);

CREATE INDEX ON snapshot_occupations(snapshot_id);
CREATE INDEX ON snapshot_occupations(snapshot_id, median_annual_wage);

-- Cost-of-living data from USDA, Census ACS, BLS CPI, NCES IPEDS.
-- One row per snapshot (national averages; regional breakdowns in JSONB).

CREATE TABLE snapshot_costs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id     UUID UNIQUE NOT NULL REFERENCES semester_snapshots(id) ON DELETE CASCADE,
  -- Housing (Census ACS median rent by bedroom count)
  median_rent_studio      NUMERIC(8,2),
  median_rent_1br         NUMERIC(8,2),
  median_rent_2br         NUMERIC(8,2),
  -- USDA food costs (monthly, moderate plan, single adult)
  monthly_groceries       NUMERIC(8,2),
  -- BLS CPI transport index (monthly personal vehicle estimate)
  monthly_transport       NUMERIC(8,2),
  -- Utility average (EIA / BLS)
  monthly_utilities       NUMERIC(8,2),
  -- Healthcare (KFF average individual marketplace premium)
  monthly_healthcare      NUMERIC(8,2),
  -- NCES IPEDS tuition totals (1-year cost)
  tuition_trade_school          NUMERIC(10,2),
  tuition_community_college     NUMERIC(10,2),
  tuition_state_university      NUMERIC(10,2),
  tuition_private_university    NUMERIC(10,2),
  tuition_ivy_league            NUMERIC(10,2),
  -- Federal student loan rate at time of snapshot (FSA)
  federal_loan_rate_pct   NUMERIC(5,3),
  -- Regional breakdowns stored as JSONB for future drill-down
  regional_data           JSONB DEFAULT '{}',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Session tracking (14th table) ────────────────────────────────────────────

-- Tracks active WebSocket game sessions for teacher live-view.
CREATE TABLE class_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id        UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  teacher_id      UUID NOT NULL REFERENCES teachers(id),
  -- Aggregate class state for ripple evaluation
  current_event_id  UUID REFERENCES decision_events(id),
  -- { [studentId]: choiceId } — in-progress choice collection
  pending_choices   JSONB NOT NULL DEFAULT '{}',
  -- Number of students who have submitted choices for the current event
  choices_submitted  SMALLINT NOT NULL DEFAULT 0,
  total_students     SMALLINT NOT NULL DEFAULT 0,
  opened_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at          TIMESTAMPTZ,
  UNIQUE(class_id, opened_at)
);

CREATE INDEX ON class_sessions(class_id);

COMMIT;

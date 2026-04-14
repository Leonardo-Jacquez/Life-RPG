'use strict';

// Snapshot orchestrator — pulls data from all external sources and writes
// to the DB under a given snapshot_id.

const { query, transaction } = require('../../db');
const bls    = require('./bls');
const usda   = require('./usda');
const census = require('./census');
const ipeds  = require('./ipeds');

/**
 * Pull all external data and populate the snapshot tables.
 * Called asynchronously after POST /snapshot/:classId/pull.
 *
 * @param {string} snapshotId
 */
async function pullAll(snapshotId) {
  console.log(`[snapshot] Starting data pull for ${snapshotId}`);

  const [occupations, foodCosts, rentCosts, tuitionCosts] = await Promise.all([
    bls.fetchOccupations(),
    usda.fetchFoodCosts(),
    census.fetchRentCosts(),
    ipeds.fetchTuitionCosts(),
  ]);

  await transaction(async (client) => {
    // Insert occupations
    for (const occ of occupations) {
      await client.query(
        `INSERT INTO snapshot_occupations
           (snapshot_id, soc_code, title, median_annual_wage, employment_thousands,
            projected_growth_pct, median_entry_wage, typical_education, attrition_rate_pct)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (snapshot_id, soc_code) DO UPDATE SET
           median_annual_wage   = EXCLUDED.median_annual_wage,
           projected_growth_pct = EXCLUDED.projected_growth_pct,
           median_entry_wage    = EXCLUDED.median_entry_wage`,
        [
          snapshotId,
          occ.soc_code,
          occ.title,
          occ.median_annual_wage,
          occ.employment_thousands,
          occ.projected_growth_pct,
          occ.median_entry_wage,
          occ.typical_education,
          occ.attrition_rate_pct,
        ]
      );
    }

    // Insert cost-of-living row
    await client.query(
      `INSERT INTO snapshot_costs
         (snapshot_id,
          median_rent_studio, median_rent_1br, median_rent_2br,
          monthly_groceries, monthly_transport, monthly_utilities, monthly_healthcare,
          tuition_trade_school, tuition_community_college, tuition_state_university,
          tuition_private_university, tuition_ivy_league,
          federal_loan_rate_pct)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT (snapshot_id) DO NOTHING`,
      [
        snapshotId,
        rentCosts.median_rent_studio,
        rentCosts.median_rent_1br,
        rentCosts.median_rent_2br,
        foodCosts.monthly_groceries,
        350.00,   // BLS CPI transport — placeholder, add dedicated transport fetcher
        150.00,   // EIA utility average
        350.00,   // KFF individual marketplace premium average
        tuitionCosts.tuition_trade_school,
        tuitionCosts.tuition_community_college,
        tuitionCosts.tuition_state_university,
        tuitionCosts.tuition_private_university,
        tuitionCosts.tuition_ivy_league,
        tuitionCosts.federal_loan_rate_pct,
      ]
    );

    // Record BLS vintage on the snapshot row
    await client.query(
      `UPDATE semester_snapshots SET bls_vintage = $1 WHERE id = $2`,
      ['2023 OES National', snapshotId]
    );
  });

  console.log(`[snapshot] Data pull complete for ${snapshotId} — ${occupations.length} occupations`);
}

module.exports = { pullAll };

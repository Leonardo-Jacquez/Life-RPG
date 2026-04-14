'use strict';

// NCES IPEDS (Integrated Postsecondary Education Data System) tuition data.
// API: https://educationdata.urban.org/documentation/colleges.html (Urban Institute)
// Source tables: IPEDS Institutional Characteristics (IC) + Student Financial Aid (SFA)

/**
 * Fetch average annual tuition for each postsecondary path.
 * These represent national average total cost of attendance for 1 year.
 *
 * In production: query the IPEDS Data Center API or Urban Institute Education Data API
 * https://educationdata.urban.org/api/v1/college-university/ipeds/ic/
 *
 * Values below are from NCES 2022-23 academic year averages.
 */
async function fetchTuitionCosts() {
  return {
    // Average total annual cost of attendance (tuition + fees + room & board)
    tuition_trade_school:       17700,  // Vocational/career colleges, NCES 2022-23
    tuition_community_college:  10000,  // 2-year public institutions (in-state)
    tuition_state_university:   28240,  // 4-year public universities (in-state)
    tuition_private_university: 56560,  // 4-year nonprofit private universities
    tuition_ivy_league:         82950,  // Top 10 private research universities (2023-24 avg)
    // Federal direct loan rates (FSA 2024-25 academic year)
    federal_loan_rate_pct: 6.53,
    vintage: '2022-23 IPEDS / 2024-25 FSA',
    source: 'NCES Integrated Postsecondary Education Data System',
  };
}

module.exports = { fetchTuitionCosts };

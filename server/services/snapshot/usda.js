'use strict';

// USDA food cost data.
// Source: USDA Center for Nutrition Policy and Promotion — Official USDA Food Plans
// https://www.fns.usda.gov/cnpp/usda-food-plans-cost-food-reports-monthly-reports

/**
 * Fetch the current USDA monthly food cost for a single adult (moderate-cost plan).
 * Returns monthly_groceries in USD.
 *
 * The USDA publishes this monthly as a PDF; there is no machine-readable API.
 * For production: scrape or manually update the value each semester.
 * Current value: ~$331/month (Jan 2024, moderate plan, single male 19-50)
 */
async function fetchFoodCosts() {
  // In production: fetch and parse from USDA PDF or a maintained JSON mirror.
  // The value below is from the USDA January 2024 report.
  return {
    monthly_groceries: 331.00,
    plan: 'moderate',
    vintage: 'January 2024',
    source: 'USDA Center for Nutrition Policy and Promotion',
  };
}

module.exports = { fetchFoodCosts };

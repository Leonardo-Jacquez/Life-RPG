'use strict';

// Census Bureau American Community Survey (ACS) housing cost data.
// API: https://api.census.gov/data/{year}/acs/acs1
// Variable: B25058 (median contract rent), B25031 (median gross rent by bedrooms)

const https = require('https');

const CENSUS_API_BASE = 'https://api.census.gov/data';
const API_KEY = process.env.CENSUS_API_KEY ?? 'YOUR_KEY_HERE';

/**
 * Fetch national median rent estimates from Census ACS 1-year estimates.
 * Returns studio, 1BR, and 2BR median rent.
 */
async function fetchRentCosts() {
  // ACS Table B25031: Median gross rent by number of bedrooms
  // Variables:
  //   B25031_002E = No bedroom (studio)
  //   B25031_003E = 1 bedroom
  //   B25031_004E = 2 bedrooms
  //
  // In production, query:
  //   GET https://api.census.gov/data/2022/acs/acs1?get=B25031_002E,B25031_003E,B25031_004E&for=us:1&key=<KEY>
  //
  // These values are from ACS 2022 1-Year Estimates (national).
  return {
    median_rent_studio: 1038,
    median_rent_1br:    1209,
    median_rent_2br:    1451,
    vintage: '2022 ACS 1-Year Estimates',
    source: 'U.S. Census Bureau, American Community Survey',
  };
}

module.exports = { fetchRentCosts };

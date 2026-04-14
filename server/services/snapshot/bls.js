'use strict';

// BLS (Bureau of Labor Statistics) Occupational Employment and Wage Statistics
// API docs: https://www.bls.gov/developers/api_signature_v2.htm
// OES series: https://www.bls.gov/oes/

const https = require('https');

const BLS_API_BASE = 'https://api.bls.gov/publicAPI/v2';
const API_KEY = process.env.BLS_API_KEY;

/**
 * Fetch national occupational employment and wage data from BLS OES.
 * Returns an array of occupation objects ready to insert into snapshot_occupations.
 *
 * BLS OES data covers ~800 occupations with median wage, employment, and
 * 10-year projected growth (from the Employment Projections program).
 */
async function fetchOccupations() {
  // The BLS public API v2 allows querying multiple series at once (up to 50).
  // For a full pull we use the OES flat files which are more efficient.
  // This fetches the OES national cross-industry estimates.
  const url = `${BLS_API_BASE}/timeseries/data/`;

  // For production: download and parse the OES flat file (oes_research_2023.xlsx or CSV)
  // Endpoint for the flat file is https://www.bls.gov/oes/special-requests/oesm23nat.zip
  // This function structures what that data looks like once parsed.

  // For development/demo: return a representative sample of 20 occupations
  return getSampleOccupations();
}

/**
 * Fetch 10-year employment projections from BLS EP table 1.2.
 * Returns a map { socCode: projectedGrowthPct }
 */
async function fetchProjections() {
  // BLS Occupational Outlook Handbook projections
  // Full data: https://www.bls.gov/emp/tables/occupational-projections-and-characteristics.htm
  // For production: parse the EP table CSV
  return {};
}

function getSampleOccupations() {
  // Representative cross-section of careers students might aspire to.
  // In production this is replaced by the full ~800-row BLS OES data set.
  return [
    { soc_code: '29-1141', title: 'Registered Nurse',               median_annual_wage: 81220,  employment_thousands: 3279.3, projected_growth_pct: 6.0,  median_entry_wage: 61640,  typical_education: "Bachelor's degree",       attrition_rate_pct: 3.2 },
    { soc_code: '15-1252', title: 'Software Developer',             median_annual_wage: 124200, employment_thousands: 1795.7, projected_growth_pct: 25.0, median_entry_wage: 79170,  typical_education: "Bachelor's degree",       attrition_rate_pct: 2.1 },
    { soc_code: '11-1021', title: 'General and Operations Manager', median_annual_wage: 99000,  employment_thousands: 3296.0, projected_growth_pct: 3.0,  median_entry_wage: 53970,  typical_education: "Bachelor's degree",       attrition_rate_pct: 4.1 },
    { soc_code: '25-2021', title: 'Elementary School Teacher',      median_annual_wage: 61350,  employment_thousands: 1493.4, projected_growth_pct: -1.0, median_entry_wage: 43950,  typical_education: "Bachelor's degree",       attrition_rate_pct: 5.1 },
    { soc_code: '33-3051', title: 'Police Officer',                 median_annual_wage: 66020,  employment_thousands: 689.1,  projected_growth_pct: 3.0,  median_entry_wage: 42140,  typical_education: 'High school diploma',      attrition_rate_pct: 4.5 },
    { soc_code: '17-2141', title: 'Mechanical Engineer',            median_annual_wage: 96310,  employment_thousands: 291.0,  projected_growth_pct: 10.0, median_entry_wage: 66540,  typical_education: "Bachelor's degree",       attrition_rate_pct: 2.8 },
    { soc_code: '23-1011', title: 'Lawyer',                         median_annual_wage: 135740, employment_thousands: 813.9,  projected_growth_pct: 8.0,  median_entry_wage: 63670,  typical_education: 'Doctoral or professional', attrition_rate_pct: 2.5 },
    { soc_code: '49-3023', title: 'Automotive Service Technician',  median_annual_wage: 46990,  employment_thousands: 699.5,  projected_growth_pct: 2.0,  median_entry_wage: 30850,  typical_education: 'Postsecondary certificate', attrition_rate_pct: 6.2 },
    { soc_code: '29-1215', title: 'Family Medicine Physician',      median_annual_wage: 226000, employment_thousands: 124.9,  projected_growth_pct: 3.0,  median_entry_wage: 116610, typical_education: 'Doctoral or professional', attrition_rate_pct: 1.8 },
    { soc_code: '41-2031', title: 'Retail Salesperson',             median_annual_wage: 31310,  employment_thousands: 4455.9, projected_growth_pct: -2.0, median_entry_wage: 22680,  typical_education: 'No formal credential',    attrition_rate_pct: 12.1 },
    { soc_code: '47-2111', title: 'Electrician',                    median_annual_wage: 60040,  employment_thousands: 739.9,  projected_growth_pct: 11.0, median_entry_wage: 38060,  typical_education: 'Apprenticeship',          attrition_rate_pct: 4.8 },
    { soc_code: '13-2011', title: 'Accountant',                     median_annual_wage: 78000,  employment_thousands: 1501.9, projected_growth_pct: 4.0,  median_entry_wage: 48560,  typical_education: "Bachelor's degree",       attrition_rate_pct: 3.0 },
    { soc_code: '27-1024', title: 'Graphic Designer',               median_annual_wage: 53860,  employment_thousands: 281.3,  projected_growth_pct: 3.0,  median_entry_wage: 35550,  typical_education: "Bachelor's degree",       attrition_rate_pct: 5.5 },
    { soc_code: '29-1071', title: 'Physician Assistant',            median_annual_wage: 121530, employment_thousands: 148.5,  projected_growth_pct: 27.0, median_entry_wage: 89880,  typical_education: "Master's degree",         attrition_rate_pct: 2.0 },
    { soc_code: '35-3023', title: 'Fast Food and Counter Worker',   median_annual_wage: 27580,  employment_thousands: 3809.1, projected_growth_pct: 4.0,  median_entry_wage: 22440,  typical_education: 'No formal credential',    attrition_rate_pct: 18.0 },
    { soc_code: '47-2061', title: 'Construction Laborer',           median_annual_wage: 42320,  employment_thousands: 1197.1, projected_growth_pct: 5.0,  median_entry_wage: 30500,  typical_education: 'No formal credential',    attrition_rate_pct: 7.8 },
    { soc_code: '11-3031', title: 'Financial Manager',              median_annual_wage: 156100, employment_thousands: 745.1,  projected_growth_pct: 16.0, median_entry_wage: 80260,  typical_education: "Bachelor's degree",       attrition_rate_pct: 2.5 },
    { soc_code: '21-1021', title: 'Child and Family Social Worker', median_annual_wage: 49500,  employment_thousands: 324.6,  projected_growth_pct: 7.0,  median_entry_wage: 35890,  typical_education: "Bachelor's degree",       attrition_rate_pct: 6.9 },
    { soc_code: '55-1015', title: 'Army Officer (Military)',        median_annual_wage: 97000,  employment_thousands: 222.0,  projected_growth_pct: 1.0,  median_entry_wage: 55000,  typical_education: "Bachelor's degree",       attrition_rate_pct: 3.5 },
    { soc_code: '53-3032', title: 'Heavy Truck Driver',             median_annual_wage: 49920,  employment_thousands: 2023.3, projected_growth_pct: 4.0,  median_entry_wage: 36370,  typical_education: 'Postsecondary certificate', attrition_rate_pct: 5.5 },
  ];
}

module.exports = { fetchOccupations, fetchProjections };

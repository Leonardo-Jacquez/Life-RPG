'use strict';

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected Postgres pool error:', err);
});

/**
 * Execute a query with optional parameters.
 * @param {string} text
 * @param {any[]} [params]
 */
async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  if (process.env.NODE_ENV === 'development') {
    console.debug(`[db] ${text.slice(0, 80)} — ${Date.now() - start}ms`);
  }
  return res;
}

/**
 * Run multiple queries inside a single transaction.
 * @param {(client: import('pg').PoolClient) => Promise<T>} fn
 */
async function transaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { query, transaction, pool };

'use strict';

// Simple migration runner — reads SQL files from migrations/ in order.
// Run with: node db/migrate.js

require('dotenv').config({ path: '../.env' });

const fs   = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function migrate() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  // Create migrations tracking table if it doesn't exist
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const dir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();

  for (const file of files) {
    const { rows } = await pool.query('SELECT 1 FROM _migrations WHERE filename = $1', [file]);
    if (rows.length > 0) {
      console.log(`  skip  ${file} (already applied)`);
      continue;
    }
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    await pool.query(sql);
    await pool.query('INSERT INTO _migrations (filename) VALUES ($1)', [file]);
    console.log(`  apply ${file}`);
  }

  await pool.end();
  console.log('Migrations complete.');
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});

// Applies schema.sql. Runs automatically at boot (see index.js) and can also be
// invoked manually with `npm run migrate`. Statements are split on ';' — keep
// schema.sql free of stored procedures/triggers that need DELIMITER changes.

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pool } from './pool.js';
import { logger } from '../logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function migrate() {
  const sql = await readFile(join(__dirname, 'schema.sql'), 'utf8');
  // Strip line comments FIRST, then split on ';'. Doing it in this order matters:
  // a comment may itself contain a ';', which would otherwise split mid-comment
  // and leave comment text glued to the next statement (a parse error).
  const statements = sql
    .replace(/--.*$/gm, '')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);

  let conn;
  // Errors that just mean "this upgrade step was already applied" — safe to skip
  // so the schema converges whether the DB is brand new or being upgraded.
  // 1060 = duplicate column, 1050 = table exists, 1061 = dup key, 1091 = can't drop.
  const BENIGN = new Set([1050, 1060, 1061, 1091]);

  try {
    conn = await pool.getConnection();
    let applied = 0;
    for (const stmt of statements) {
      try {
        await conn.query(stmt);
        applied += 1;
      } catch (err) {
        if (BENIGN.has(err.errno)) continue; // already-applied upgrade step
        throw err;
      }
    }
    logger.info('Database schema is up to date.', { statements: statements.length, applied });
  } finally {
    if (conn) conn.release();
  }
}

// Allow running standalone: `npm run migrate`
if (import.meta.url === `file://${process.argv[1]}`) {
  migrate()
    .then(() => pool.end())
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error('Migration failed', { error: err.message });
      process.exit(1);
    });
}

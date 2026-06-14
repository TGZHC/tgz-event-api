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
  const statements = sql
    .split(';')
    .map((s) => s.replace(/--.*$/gm, '').trim())
    .filter(Boolean);

  let conn;
  try {
    conn = await pool.getConnection();
    for (const stmt of statements) {
      await conn.query(stmt);
    }
    logger.info('Database schema is up to date.', { statements: statements.length });
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

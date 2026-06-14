// MariaDB connection pool. One pool for the whole process; handlers borrow and
// release connections. The pool tolerates the DB being briefly unavailable
// (Railway restarts, etc.) — queries just reconnect.

import mariadb from 'mariadb';
import config from '../config.js';
import { logger } from '../logger.js';

export const pool = mariadb.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  connectionLimit: config.db.connectionLimit,
  // Return native JS types; BigInt would otherwise leak from COUNT()/SUM().
  bigIntAsNumber: true,
  // Don't let a wedged connection hang a request forever.
  acquireTimeout: 10_000,
});

/** Run a query and always release the connection. */
export async function query(sql, params) {
  let conn;
  try {
    conn = await pool.getConnection();
    return await conn.query(sql, params);
  } finally {
    if (conn) conn.release();
  }
}

/** Run several statements inside a single transaction. */
export async function transaction(fn) {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    if (conn) await conn.rollback().catch(() => {});
    throw err;
  } finally {
    if (conn) conn.release();
  }
}

/** Lightweight liveness probe used by /health. */
export async function ping() {
  await query('SELECT 1');
  return true;
}

export async function close() {
  try {
    await pool.end();
    logger.info('Database pool closed.');
  } catch (err) {
    logger.warn('Error closing database pool', { error: err.message });
  }
}

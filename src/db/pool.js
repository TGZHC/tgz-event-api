// MariaDB connection pool. One pool for the whole process; handlers borrow and
// release connections. The pool tolerates the DB being briefly unavailable
// (Railway restarts, etc.) — queries just reconnect.

import mariadb from 'mariadb';
import config from '../config.js';
import { logger } from '../logger.js';

// Turn config.db into the option object the driver wants. When a connection URL
// is provided (Railway's MYSQL_URL / DATABASE_URL) we parse it ourselves rather
// than handing the raw string to the driver, so any URL scheme (mysql://,
// mariadb://) works the same way.
function connectionOptions() {
  const base = {
    connectionLimit: config.db.connectionLimit,
    // Return native JS types; BigInt would otherwise leak from COUNT()/SUM().
    bigIntAsNumber: true,
    // Don't let a wedged connection hang a request forever.
    acquireTimeout: 10_000,
    // MySQL 8/9 default auth (caching_sha2_password) needs the server's public
    // key when the connection isn't TLS — allow retrieving it.
    allowPublicKeyRetrieval: true,
  };
  if (config.db.url) {
    const u = new URL(config.db.url);
    return {
      ...base,
      host: u.hostname,
      port: u.port ? Number(u.port) : 3306,
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      database: u.pathname.replace(/^\//, '') || undefined,
    };
  }
  return {
    ...base,
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
  };
}

export const pool = mariadb.createPool(connectionOptions());

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

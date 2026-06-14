// Imported FIRST by any test whose import graph reaches config.js. ESM evaluates
// imports in source order, so setting these here (before the config import is
// evaluated) satisfies config validation without a real .env. Pure-logic tests
// (embeds, periods, normalize) don't need this.

process.env.NODE_ENV ??= 'test';
process.env.API_TOKEN ??= 'test-token-0123456789abcdef';
process.env.DB_HOST ??= 'localhost';
process.env.DB_USER ??= 'test';
process.env.DB_PASSWORD ??= 'test';
process.env.DB_NAME ??= 'test';

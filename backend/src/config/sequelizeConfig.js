/**
 * Sequelize CLI configuration (CommonJS).
 *
 * Reads DB credentials from environment variables (loaded by dotenv
 * from backend/.env when the CLI runs). Sequelize CLI runs this file
 * directly with Node — no TypeScript transpilation — so it stays .js.
 *
 * Uses the `pg` driver via the `dialectModule` option so migrations
 * and seeders hit the same Postgres instance the runtime app does.
 *
 * Connection priority: POSTGRES_URL (Vercel/Neon) → DATABASE_URL →
 * individual DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME (local dev).
 *
 * For migrations against Neon in production, use the non-pooled
 * connection string (POSTGRES_URL_DIRECT) so the CLI keeps a single
 * long-lived connection. The pooled string is fine for local dev
 * against docker-compose.
 */

require('dotenv').config();

const dialectModule = require('pg');

const connectionUrl =
  process.env.POSTGRES_URL_DIRECT ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL;

const baseOptions = {
  dialect: 'postgres',
  dialectModule,
  logging: false,
};

if (connectionUrl) {
  baseOptions.url = connectionUrl;
  baseOptions.dialectOptions = {
    ssl: {
      require: true,
      rejectUnauthorized: false,
    },
  };
} else {
  baseOptions.host = process.env.DB_HOST || 'localhost';
  baseOptions.port = parseInt(process.env.DB_PORT || '5432', 10);
  baseOptions.username = process.env.DB_USER || 'helpdesk';
  baseOptions.password = process.env.DB_PASSWORD || 'helpdesk_pwd';
  baseOptions.database = process.env.DB_NAME || 'helpdesk_lite';
}

module.exports = {
  development: {
    ...baseOptions,
    seederStorage: 'sequelize',
  },
  test: {
    ...baseOptions,
  },
  production: {
    ...baseOptions,
  },
};

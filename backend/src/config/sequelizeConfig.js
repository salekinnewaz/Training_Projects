/**
 * Sequelize CLI configuration (CommonJS).
 *
 * Reads DB credentials from environment variables (loaded by dotenv
 * from backend/.env when the CLI runs). Sequelize CLI runs this file
 * directly with Node — no TypeScript transpilation — so it stays .js.
 *
 * `dialectModule` is required so Sequelize CLI uses the same mysql2
 * driver that the runtime Sequelize instance uses.
 */

require('dotenv').config();

const dialectModule = require('mysql2');

const common = {
  dialect: 'mysql',
  dialectModule,
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  username: process.env.DB_USER || 'helpdesk',
  password: process.env.DB_PASSWORD || 'helpdesk_pwd',
  database: process.env.DB_NAME || 'helpdesk_lite',
  logging: false,
};

module.exports = {
  development: {
    ...common,
    seederStorage: 'sequelize',
  },
  test: {
    ...common,
  },
  production: {
    ...common,
  },
};

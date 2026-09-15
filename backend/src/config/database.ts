/**
 * Runtime Sequelize instance.
 *
 * Used by the Express app at request time and by Sequelize models
 * at runtime. Distinct from the CLI configuration (sequelizeConfig.js)
 * which is loaded only by `sequelize-cli` for migration and seeding.
 *
 * HD-002 imports ../models as a side-effect so every model's
 * `init()` runs and every association is wired against this
 * instance. Anything that touches the DB at runtime should
 * import models from `../models` (which re-exports `sequelize`).
 */

import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';
import '../models';

dotenv.config();

const dbName = process.env.DB_NAME || 'helpdesk_lite';
const dbUser = process.env.DB_USER || 'helpdesk';
const dbPassword = process.env.DB_PASSWORD || 'helpdesk_pwd';
const dbHost = process.env.DB_HOST || 'localhost';
const dbPort = parseInt(process.env.DB_PORT || '3306', 10);

export const sequelize = new Sequelize(dbName, dbUser, dbPassword, {
  host: dbHost,
  port: dbPort,
  dialect: 'mysql',
  logging: false,
  // Pool sized small for dev; tuned later.
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
});

export default sequelize;

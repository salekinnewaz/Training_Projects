/**
 * Runtime Sequelize instance.
 *
 * Postgres on Vercel (Neon free tier) + Postgres locally. Reads the
 * connection string from `POSTGRES_URL` (production on Vercel) or
 * `DATABASE_URL` (common convention), falling back to
 * `DB_HOST`/`DB_PORT`/`DB_USER`/`DB_PASSWORD`/`DB_NAME` for
 * legacy local-dev setups.
 *
 * Pool sized small for serverless (max 5 per function instance).
 * SSL is required for Neon; the local docker-compose Postgres
 * doesn't need SSL, so we turn it on only when POSTGRES_URL is
 * present (i.e. we're talking to a managed instance).
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

const connectionUrl =
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_URL_DIRECT ||
  process.env.DATABASE_URL;

const usingHostedDb = Boolean(connectionUrl);

export const sequelize = connectionUrl
  ? new Sequelize(connectionUrl, {
      dialect: 'postgres',
      logging: false,
      // Neon (and any managed Postgres over the public internet)
      // requires SSL. Local docker-compose Postgres doesn't, so
      // we only set it when a URL is present.
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false,
        },
      },
      // Pool sized small for serverless — Vercel functions each
      // open at most a handful of concurrent queries.
      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000,
      },
    })
  : new Sequelize(
      process.env.DB_NAME || 'helpdesk_lite',
      process.env.DB_USER || 'helpdesk',
      process.env.DB_PASSWORD || 'helpdesk_pwd',
      {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        dialect: 'postgres',
        logging: false,
        pool: {
          max: 5,
          min: 0,
          acquire: 30000,
          idle: 10000,
        },
      },
    );

export default sequelize;

// Re-export so the conditional in the constructor is reachable
// from tests / diagnostics.
export { usingHostedDb };

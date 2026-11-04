/**
 * Run the demo-data seeder directly.
 *
 * The Sequelize CLI does not pick these seeders up (it resolves
 * `seeders-path` relative to the CWD and reports "No seeders
 * found"), so the seeder module is invoked by hand instead. This
 * gives the same result as `npm run db:seed`.
 *
 * usage: node scripts/run-seeder.cjs
 */
const path = require('node:path');
const { Sequelize } = require('sequelize');
const cfg = require('../src/config/sequelizeConfig.js').development;

const sequelize = new Sequelize(cfg.database, cfg.username, cfg.password, {
  host: cfg.host,
  port: cfg.port,
  dialect: 'postgres',
  dialectModule: require('pg'),
  logging: false,
});

const seeders = [
  '20260915000000-demo-data.js',
  '20260915000001-notifications-demo.js',
];

(async () => {
  const qi = sequelize.getQueryInterface();
  for (const file of seeders) {
    const mod = require(path.join(__dirname, '..', 'src', 'seeders', file));
    console.log(`running ${file} ...`);
    await mod.up(qi, Sequelize);
    console.log(`done ${file}`);
  }
  await sequelize.close();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

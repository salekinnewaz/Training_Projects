/**
 * Bootstrap migration — HD-001.
 *
 * Purpose: prove that sequelize-cli can talk to MySQL using the
 * development credentials in backend/.env. No schema is created.
 *
 * This migration is tracked in SequelizeMeta so future runs skip past
 * it; it will be superseded by the first real model migration in HD-002.
 *
 * Note: sequelize-cli runs migration files as plain CommonJS — no
 * TypeScript transpilation. Parameter names must be valid JS identifiers
 * (no underscore-prefix + space; that pattern is TypeScript-only).
 */

'use strict';

module.exports = {
  async up(_queryInterface, _Sequelize) {
    // No-op for HD-001. Real schema lands in HD-002.
  },

  async down(_queryInterface, _Sequelize) {
    // No-op for HD-001.
  },
};

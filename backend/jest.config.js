/**
 * Jest config — HD-007.
 *
 * Uses ts-jest so .spec.ts files compile directly. Without this,
 * jest falls back to babel-jest which doesn't understand TS
 * `import type` syntax and fails to parse even simple spec files.
 */

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.spec.ts'],
};

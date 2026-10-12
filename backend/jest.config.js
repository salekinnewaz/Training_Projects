/**
 * Jest config — HD-007 + D9.
 *
 * Two projects:
 *   1. `unit` — every `*.spec.ts` co-located with source. Mocks
 *      at module boundaries; no DB. Default `npm test` behavior.
 *   2. `integration` — `*.integration.spec.ts` rooted under
 *      `test/integration/`. Hits the live MySQL container
 *      (specifically the `helpdesk_lite_test` database) to
 *      exercise the real Sequelize transaction + FOR UPDATE
 *      code path. D9's `createTicket.integration.spec.ts`
 *      pins DUPLICATE_NUMBER (HD-008 row).
 *
 * `npm test` runs both. The integration project gracefully
 * skips when MySQL is unreachable (see setup.ts), so a
 * contributor without Docker can still run the unit suite
 * end-to-end.
 *
 * The unit project keeps the original 2026-09-15 config —
 * ts-jest, node env, the standard co-located spec glob — minus
 * files matching `.integration.spec.ts$` so the two projects
 * don't double-discover the same file.
 */

module.exports = {
  projects: [
    {
      displayName: 'unit',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/src/**/*.spec.ts'],
      testPathIgnorePatterns: [
        '/node_modules/',
        '.integration.spec.ts$',
      ],
    },
    {
      displayName: 'integration',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: [
        '<rootDir>/test/integration/**/*.integration.spec.ts',
      ],
      setupFilesAfterEnv: [
        '<rootDir>/test/integration/setup.ts',
      ],
    },
  ],
};

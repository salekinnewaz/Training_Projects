import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for the post-deployment QA loop.
 *
 * - Targets the live Vercel deployment. Override via BASE_URL
 *   env var to point at a local dev stack (`localhost:4200` for
 *   the frontend + `localhost:3000` for the API).
 *
 *   The frontend port is not fixed at 4200: when two devs (or two
 *   IDEs) run the stack at once, the second instance moves to
 *   another port. So always point BASE_URL at the instance you
 *   actually want to test:
 *
 *     BASE_URL=http://localhost:4300 npx playwright test
 *
 *   The backend stays on 3000 for everyone — it is shared.
 * - Single project (chromium) — the wireframes are desktop-first
 *   per the UX spec; mobile coverage is v1.x and out of MVP.
 * - Parallelism is on; tests within a file are serial because
 *   they share seeded data and we want stable counts.
 * - HTML reporter writes to ./playwright-report; a `qa:report`
 *   script in the root `package.json` opens it after a run.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: 0,
  workers: 2,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],
  use: {
    baseURL: process.env['BASE_URL'] ?? 'https://helpdesk-lite-tawny.vercel.app',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
  },
  expect: {
    timeout: 5_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
});

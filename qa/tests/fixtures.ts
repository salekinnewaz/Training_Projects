import { test as base, expect, Page } from '@playwright/test';

/**
 * Reusable test fixtures and helpers for the QA suite.
 *
 * - `loginAs(page, who)` — types credentials, submits, waits
 *   for the resulting dashboard. `who` is one of: 'admin',
 *   'sam' (Support Agent), 'morgan' (Support Agent), 'eli'
 *   (Employee), 'jess' (Employee), 'noah' (Employee),
 *   'priya' (Employee). All seeded users share password
 *   `password123`.
 * - `loginOrFail` — flip `expect.toHaveURL(...)` failures into
 *   useful diagnostics by attaching the response body to the
 *   error.
 *
 * Tests that need an Employee account pick `eli` (the wireframe
 * scenario persona). Tests that need an Agent pick `sam`. Tests
 * that need an Admin pick `admin`. Other seeded accounts exist
 * for coverage of "another agent" / "another employee" paths.
 */

type SeededUser =
  | 'admin'
  | 'sam'
  | 'morgan'
  | 'eli'
  | 'jess'
  | 'noah'
  | 'priya';

const PASSWORDS = 'password123';

const EMAILS: Record<SeededUser, string> = {
  admin: 'admin@company.com',
  sam: 'sam@company.com',
  morgan: 'morgan@company.com',
  eli: 'eli@company.com',
  jess: 'jess@company.com',
  noah: 'noah@company.com',
  priya: 'priya@company.com',
};

/** Routes the given seeded user lands on after a successful login. */
const ROLE_HOME: Record<SeededUser, RegExp | string> = {
  admin: /\/admin/,
  sam: /\/queue/,
  morgan: /\/queue/,
  eli: /\/dashboard/,
  jess: /\/dashboard/,
  noah: /\/dashboard/,
  priya: /\/dashboard/,
};

export async function loginAs(page: Page, who: SeededUser): Promise<void> {
  await page.goto('/login');
  await page.locator('input#login-email').fill(EMAILS[who]);
  await page.locator('input#login-password').fill(PASSWORDS);
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page).toHaveURL(ROLE_HOME[who]);
}

export async function logout(page: Page, who: SeededUser): Promise<void> {
  // Click the user-name button (the live chrome trigger is
  // the user's display name, not the wireframe "My Profile ▾"
  // label), then "Logout" inside the panel, then confirm in
  // the modal.
  const names: Record<SeededUser, string> = {
    admin: 'Admin',
    sam: 'Sam Chen',
    morgan: 'Morgan Lee',
    eli: 'Eli Tanaka',
    jess: 'Jess Park',
    noah: 'Noah Kim',
    priya: 'Priya Singh',
  };
  await page.getByRole('button', { name: names[who] }).click();
  await page.getByRole('button', { name: /^log out$/i }).first().click();
  // The wireframe spec'd a confirmation dialog before logout;
  // the live impl just signs out on click.
  await expect(page).toHaveURL(/\/login/);
}

export const test = base;
export { expect };

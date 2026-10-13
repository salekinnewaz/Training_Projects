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
  await page.getByLabel('Email').fill(EMAILS[who]);
  await page.getByLabel('Password').fill(PASSWORDS);
  await page.getByRole('button', { name: /log in/i }).click();
  await expect(page).toHaveURL(ROLE_HOME[who]);
}

export async function logout(page: Page): Promise<void> {
  // Click "My Profile" trigger, then "Logout" inside the panel,
  // then confirm in the modal.
  await page.getByRole('button', { name: /my profile/i }).click();
  await page.getByRole('button', { name: /^logout$/i }).first().click();
  await page.getByRole('button', { name: /^log out$/i }).click();
  await expect(page).toHaveURL(/\/login/);
}

export const test = base;
export { expect };

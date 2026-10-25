/**
 * Restores the seeded user roles.
 *
 * The Admin-Users regression tests change user roles to prove the
 * change persists. A test run that aborts mid-way can leave the
 * seeded data drifted (e.g. every Agent promoted to Admin), which
 * makes later runs fail for the wrong reason.
 *
 * Usage: npx ts-node qa/role-audit/reset-roles.ts
 */

// Import the models REGISTRY (not the individual model) — the
// registry is what initialises the Sequelize instance the models
// attach themselves to.
import { sequelize, User } from '../../backend/src/models';

const SEEDED_ROLES: Record<string, 'User' | 'Support Agent' | 'Admin'> = {
  'admin@company.com': 'Admin',
  'sam@company.com': 'Support Agent',
  'morgan@company.com': 'Support Agent',
  'eli@company.com': 'Support Agent',
  'jess@company.com': 'User',
  'noah@company.com': 'User',
  'priya@company.com': 'User',
  'tomas@company.com': 'User',
};

async function main(): Promise<void> {
  const users = await User.findAll();
  for (const user of users) {
    const email = user.get('email') as string;
    const want = SEEDED_ROLES[email];
    if (!want) continue;
    const have = user.get('role') as string;
    if (have !== want) {
      await user.update({ role: want });
      console.log(`reset ${email}: ${have} -> ${want}`);
    }
  }
  console.log('done');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });

import { Client } from './api-harness';

(async () => {
  const c = new Client('admin');
  await c.loginOk('admin@company.com');
  const r = await c.get('/api/users');
  console.log('DB roles now:', r.body.users.map((u: any) => `${u.displayName}=${u.role}`).join(', '));
})();

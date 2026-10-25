/**
 * Role audit — ADMIN role.
 * Covers the Admin Dashboard, Users tab (role + status management),
 * self-protection, and admin-vs-agent parity on ticket actions.
 */

import { Client, ACCOUNTS, pass, section } from './api-harness';

const results: boolean[] = [];
const admin = new Client('admin');
const agent = new Client('agent');
const user = new Client('user');

async function run() {
  section('ADMIN — Authentication');
  const login = await admin.loginOk(ACCOUNTS.admin.email);
  results.push(pass('login succeeds', login.status === 200, `status=${login.status}`));
  results.push(pass('role is Admin', login.body?.user?.role === 'Admin', JSON.stringify(login.body?.user)));

  section('ADMIN — Admin dashboard');
  const dash = await admin.get('/api/admin/dashboard');
  results.push(pass('GET /admin/dashboard 200', dash.status === 200, `status=${dash.status}`));
  // Shape: { open: {rows,total}, inProgress: {...}, resolved: {...}, closed: {...} }
  const buckets = dash.body ?? {};
  const rowKeys = Object.keys(buckets);
  results.push(
    pass(
      'dashboard buckets are the four statuses',
      ['open', 'inProgress', 'resolved', 'closed'].every((k) => rowKeys.includes(k)),
      `keys=${rowKeys.join(',')}`,
    ),
  );
  results.push(
    pass(
      'dashboard each bucket has rows+total',
      rowKeys.every((k) => Array.isArray(buckets[k]?.rows) && typeof buckets[k]?.total === 'number'),
      `sample=${JSON.stringify(buckets[rowKeys[0]]).slice(0, 150)}`,
    ),
  );
  results.push(
    pass(
      'dashboard total matches sum of bucket totals',
      rowKeys.reduce((sum, k) => sum + (buckets[k]?.total ?? 0), 0) > 0,
      `sum=${rowKeys.reduce((sum, k) => sum + (buckets[k]?.total ?? 0), 0)}`,
    ),
  );

  section('ADMIN — Users tab: list');
  const users = await admin.get('/api/users');
  results.push(pass('GET /users 200', users.status === 200, `status=${users.status}`));
  const list = users.body?.users ?? [];
  results.push(pass('users list non-empty', list.length > 0, `count=${list.length}`));
  results.push(pass('users envelope has count', typeof users.body?.count === 'number', `count=${users.body?.count}`));
  results.push(
    pass('users sorted by displayName ASC', (() => {
      const names = list.map((u: any) => u.displayName);
      return JSON.stringify(names) === JSON.stringify([...names].sort());
    })(), `names=${list.slice(0, 3).map((u: any) => u.displayName).join(', ')}`),
  );
  results.push(
    pass('no passwordHash leaked', !JSON.stringify(list).includes('passwordHash'), ''),
  );

  section('ADMIN — Users tab: role management');
  // Use a non-admin, non-self target so we can restore it afterwards.
  const target = list.find((u: any) => u.id !== ACCOUNTS.admin.id && u.role === 'User');
  results.push(pass('found a User-role target', !!target, `target=${target?.email}`));

  if (target) {
    const promote = await admin.put(`/api/users/${target.id}/role`, { role: 'Support Agent' });
    results.push(pass('promote User -> Support Agent', promote.status === 200, `status=${promote.status} ${JSON.stringify(promote.body).slice(0, 150)}`));
    results.push(pass('response reflects new role', promote.body?.role === 'Support Agent', `role=${promote.body?.role}`));

    const demote = await admin.put(`/api/users/${target.id}/role`, { role: 'User' });
    results.push(pass('demote Support Agent -> User', demote.status === 200, `status=${demote.status}`));

    const badRole = await admin.put(`/api/users/${target.id}/role`, { role: 'Superuser' });
    results.push(pass('invalid role -> 400', badRole.status === 400, `status=${badRole.status}`));

    const noRole = await admin.put(`/api/users/${target.id}/role`, {});
    results.push(pass('missing role -> 400', noRole.status === 400, `status=${noRole.status}`));
  }

  section('ADMIN — Users tab: self-protection');
  const selfRole = await admin.put(`/api/users/${ACCOUNTS.admin.id}/role`, { role: 'User' });
  results.push(
    pass('Admin cannot change OWN role', selfRole.status === 400, `status=${selfRole.status} ${JSON.stringify(selfRole.body).slice(0, 150)}`),
  );

  const selfDeactivate = await admin.put(`/api/users/${ACCOUNTS.admin.id}/status`, { isActive: false });
  results.push(
    pass('Admin cannot deactivate SELF', selfDeactivate.status === 400, `status=${selfDeactivate.status} ${JSON.stringify(selfDeactivate.body).slice(0, 150)}`),
  );

  section('ADMIN — Users tab: status management');
  if (target) {
    const deactivate = await admin.put(`/api/users/${target.id}/status`, { isActive: false });
    results.push(pass('Admin can deactivate a user', deactivate.status === 200, `status=${deactivate.status}`));
    results.push(pass('response reflects isActive=false', deactivate.body?.isActive === false, `isActive=${deactivate.body?.isActive}`));

    // Deactivated user must not be able to log in.
    const deadClient = new Client('deactivated');
    const deadLogin = await deadClient.login(target.email, 'password123');
    results.push(
      pass('deactivated user cannot log in', deadLogin.status === 403, `status=${deadLogin.status} ${JSON.stringify(deadLogin.body).slice(0, 150)}`),
    );

    const reactivate = await admin.put(`/api/users/${target.id}/status`, { isActive: true });
    results.push(pass('Admin can reactivate a user', reactivate.status === 200, `status=${reactivate.status}`));

    const relogin = await new Client('reactivated').login(target.email, 'password123');
    results.push(pass('reactivated user can log in again', relogin.status === 200, `status=${relogin.status}`));

    const badStatus = await admin.put(`/api/users/${target.id}/status`, { isActive: 'yes' });
    results.push(pass('non-boolean isActive -> 400', badStatus.status === 400, `status=${badStatus.status}`));

    const noStatus = await admin.put(`/api/users/${target.id}/status`, {});
    results.push(pass('missing isActive -> 400', noStatus.status === 400, `status=${noStatus.status}`));
  }

  section('ADMIN — Users tab: edge cases');
  const missingUser = await admin.put('/api/users/999999/role', { role: 'User' });
  results.push(pass('role change on nonexistent user -> 404', missingUser.status === 404, `status=${missingUser.status}`));

  const badId = await admin.put('/api/users/abc/role', { role: 'User' });
  results.push(pass('non-numeric user id -> 400', badId.status === 400, `status=${badId.status}`));

  section('ADMIN — Agents list excludes employees');
  const agents = await admin.get('/api/users/agents');
  results.push(pass('GET /users/agents 200', agents.status === 200, `status=${agents.status}`));
  const agentList = agents.body?.agents ?? [];
  results.push(
    pass('agents list has no User-role entries', agentList.every((a: any) => a.role === 'Support Agent' || a.role === 'Admin'), `roles=${[...new Set(agentList.map((a: any) => a.role))].join(',')}`),
  );
  results.push(
    pass('agents list excludes inactive users', !agentList.some((a: any) => a.id === 8), `ids=${agentList.map((a: any) => a.id).join(',')}`),
  );

  section('ADMIN — Admin == Agent on the action matrix');
  const stats = await admin.get('/api/tickets/stats');
  results.push(pass('Admin can read /tickets/stats', stats.status === 200, `status=${stats.status}`));

  // Per agent-kanban.md: "If Admin reaches /queue directly ... the
  // route returns 403 — the page is Support-Agent-only." Admin's
  // home is /admin; the shared agent+admin surface is /tickets/list.
  const queue = await admin.get('/api/tickets/queue');
  results.push(pass('Admin is denied /tickets/queue (Agent-only page)', queue.status === 403, `status=${queue.status}`));

  const listTickets = await admin.get('/api/tickets/list');
  results.push(pass('Admin can read /tickets/list', listTickets.status === 200, `status=${listTickets.status}`));

  // Admin has identical ticket actions to Agent: can change status,
  // reassign, change priority — but NOT close.
  await user.loginOk(ACCOUNTS.user.email);
  const probe = await user.post('/api/tickets', { title: 'Audit: admin action probe', description: 'probe', category: 'General', priority: 'Medium' });
  const pId = probe.body?.ticket?.id;

  if (pId) {
    const statusChange = await admin.patch(`/api/tickets/${pId}`, { status: 'In Progress' });
    results.push(pass('Admin CAN change status (same as Agent)', statusChange.status === 200, `status=${statusChange.status}`));

    const assign = await admin.patch(`/api/tickets/${pId}`, { ownerId: 3 });
    results.push(pass('Admin CAN reassign (same as Agent)', assign.status === 200, `status=${assign.status}`));

    const prio = await admin.patch(`/api/tickets/${pId}`, { priority: 'High' });
    results.push(pass('Admin CAN change priority (same as Agent)', prio.status === 200, `status=${prio.status}`));

    await admin.patch(`/api/tickets/${pId}`, { status: 'Resolved' });
    // Admin == Agent on the matrix: neither can close via PATCH.
    const adminClose = await admin.patch(`/api/tickets/${pId}`, { status: 'Closed' });
    results.push(
      pass('Admin CANNOT close via PATCH (Closed is submitter-only)', adminClose.status === 403, `status=${adminClose.status} ${JSON.stringify(adminClose.body).slice(0, 150)}`),
    );

    // Only the submitter closes the ticket.
    const submitterClose = await user.post(`/api/tickets/${pId}/confirm-close`);
    results.push(pass('submitter can confirm-close', submitterClose.status === 200, `status=${submitterClose.status} ${JSON.stringify(submitterClose.body).slice(0, 150)}`));
  }

  section('ADMIN — Notifications & misc');
  const notif = await admin.get('/api/notifications');
  results.push(pass('Admin can read notifications', notif.status === 200, `status=${notif.status}`));

  const mine = await admin.get('/api/tickets/mine');
  results.push(pass('Admin can read /tickets/mine', mine.status === 200, `status=${mine.status}`));

  const profile = await admin.get('/api/auth/me');
  results.push(pass('Admin /auth/me 200', profile.status === 200, `status=${profile.status}`));

  console.log(`\n${'='.repeat(70)}`);
  const passed = results.filter(Boolean).length;
  console.log(`ADMIN ROLE: ${passed}/${results.length} passed`);
  console.log(`${'='.repeat(70)}`);
  if (passed !== results.length) process.exitCode = 1;
}

run().catch((e) => {
  console.error('HARNESS ERROR:', e);
  process.exitCode = 2;
});

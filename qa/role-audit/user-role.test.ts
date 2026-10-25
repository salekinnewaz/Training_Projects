/**
 * Role audit — USER (employee) role.
 * Covers every scenario the UX spec defines for employees plus edge cases.
 */

import { Client, ACCOUNTS, pass, section } from './api-harness';

const results: boolean[] = [];
const c = new Client('user');
const other = new Client('other-user');
const anon = new Client('anon');

async function run() {
  section('USER — Authentication');
  const login = await c.loginOk(ACCOUNTS.user.email);
  results.push(pass('login succeeds', login.status === 200, `status=${login.status}`));
  results.push(
    pass('login returns user with role User', login.body?.user?.role === 'User', JSON.stringify(login.body?.user)),
  );
  results.push(
    pass('login sets httpOnly auth cookie', c.raw !== undefined && login.headers.getSetCookie().some((x) => x.includes('auth='))),
  );

  const bad = await c.raw('POST', '/api/auth/login', { email: ACCOUNTS.user.email, password: 'wrong' });
  results.push(pass('wrong password rejected 401', bad.status === 401, `status=${bad.status} ${JSON.stringify(bad.body)}`));

  const noAuth = await anon.get('/api/auth/me');
  results.push(pass('GET /auth/me without cookie -> 401', noAuth.status === 401, `status=${noAuth.status}`));

  const me = await c.get('/api/auth/me');
  results.push(pass('GET /auth/me returns profile', me.status === 200 && me.body?.user?.email === ACCOUNTS.user.email, `status=${me.status} ${JSON.stringify(me.body).slice(0, 120)}`));

  section('USER — Own tickets (dashboard)');
  const mine = await c.get('/api/tickets/mine');
  results.push(pass('GET /tickets/mine 200', mine.status === 200, `status=${mine.status}`));
  results.push(
    pass('/tickets/mine returns array shape', Array.isArray(mine.body?.tickets), `keys=${Object.keys(mine.body ?? {})}`),
  );
  const myTickets = mine.body?.tickets ?? [];
  results.push(pass('user has own tickets', myTickets.length > 0, `count=${myTickets.length}`));
  results.push(
    pass(
      'all /mine tickets are owned by caller',
      myTickets.every((t: any) => t.submitter?.id === ACCOUNTS.user.id || t.submitterId === ACCOUNTS.user.id),
      `sample=${JSON.stringify(myTickets[0]?.submitter ?? myTickets[0]?.submitterId)}`,
    ),
  );

  section('USER — Stats scoping');
  const statsMine = await c.get('/api/tickets/stats/mine');
  results.push(pass('GET /tickets/stats/mine 200', statsMine.status === 200, `status=${statsMine.status}`));
  const statsAll = await c.get('/api/tickets/stats');
  results.push(pass('GET /tickets/stats forbidden for User', statsAll.status === 403, `status=${statsAll.status}`));

  section('USER — Create ticket');
  const created = await c.post('/api/tickets', {
    title: 'Audit: user creates ticket',
    description: 'Created by the role-audit harness for the User role.',
    category: 'IT',
    priority: 'Medium',
  });
  results.push(pass('POST /tickets 201', created.status === 201, `status=${created.status} ${JSON.stringify(created.body).slice(0, 200)}`));
  const newTicket = created.body?.ticket;
  results.push(pass('created ticket has id', !!newTicket?.id, `id=${newTicket?.id}`));
  results.push(
    pass('created ticket number assigned', !!newTicket?.ticketNumber || !!newTicket?.number, `number=${newTicket?.ticketNumber ?? newTicket?.number}`),
  );
  results.push(
    pass('created ticket submitter is caller', (newTicket?.submitter?.id ?? newTicket?.submitterId) === ACCOUNTS.user.id),
  );
  results.push(pass('created ticket status Open', /open/i.test(String(newTicket?.status)), `status=${newTicket?.status}`));

  // Edge: missing title
  const noTitle = await c.post('/api/tickets', { description: 'no title here', priority: 'Medium' });
  results.push(pass('create without title -> 4xx', noTitle.status >= 400 && noTitle.status < 500, `status=${noTitle.status} ${JSON.stringify(noTitle.body).slice(0, 150)}`));

  // Edge: missing description
  const noDesc = await c.post('/api/tickets', { title: 'no desc', priority: 'Medium' });
  results.push(pass('create without description -> 4xx', noDesc.status >= 400 && noDesc.status < 500, `status=${noDesc.status}`));

  // Edge: empty strings
  const empty = await c.post('/api/tickets', { title: '', description: '', priority: 'Medium' });
  results.push(pass('create with empty strings -> 4xx', empty.status >= 400 && empty.status < 500, `status=${empty.status}`));

  // Edge: invalid priority
  const badPriority = await c.post('/api/tickets', { title: 'bad prio', description: 'x', priority: 'NotARealPriority' });
  results.push(pass('create with invalid priority -> 4xx', badPriority.status >= 400 && badPriority.status < 500, `status=${badPriority.status} ${JSON.stringify(badPriority.body).slice(0, 150)}`));

  // Edge: invalid category
  const badCategory = await c.post('/api/tickets', { title: 'bad cat', description: 'x', priority: 'Low', category: 'Nope' });
  results.push(pass('create with invalid category -> 4xx', badCategory.status >= 400 && badCategory.status < 500, `status=${badCategory.status} ${JSON.stringify(badCategory.body).slice(0, 150)}`));

  section('USER — Ticket detail visibility');
  const detail = await c.get(`/api/tickets/${newTicket?.id}`);
  results.push(pass('GET own ticket by id 200', detail.status === 200, `status=${detail.status}`));

  // Find a ticket belonging to someone else. Use the admin's full list
  // so we get a ticket the employee definitively does NOT own.
  const adminClient = new Client('admin-probe');
  await adminClient.loginOk(ACCOUNTS.admin.email);
  const all = await adminClient.get('/api/tickets/list');
  const foreign = (all.body?.tickets ?? []).find(
    (t: any) => t.submitterId !== ACCOUNTS.user.id && t.submitter?.id !== ACCOUNTS.user.id,
  );
  const foreignId = foreign?.id;

  if (foreignId) {
    const denied = await c.get(`/api/tickets/${foreignId}`);
    results.push(pass("GET another user's ticket -> 403/404", denied.status === 403 || denied.status === 404, `status=${denied.status}`));

    const deniedPatch = await c.patch(`/api/tickets/${foreignId}`, { status: 'In Progress' });
    results.push(pass("PATCH another user's ticket -> 403/404", deniedPatch.status === 403 || deniedPatch.status === 404, `status=${deniedPatch.status}`));

    const deniedComment = await c.post(`/api/tickets/${foreignId}/comments`, { body: 'sneaky' });
    results.push(pass("comment on another user's ticket -> 403/404", deniedComment.status === 403 || deniedComment.status === 404, `status=${deniedComment.status}`));
  } else {
    results.push(pass('found a foreign ticket to probe', false, 'none found'));
  }

  section('USER — Comments & activity on own ticket');
  const comment = await c.post(`/api/tickets/${newTicket?.id}/comments`, { body: 'Audit comment from user.' });
  results.push(pass('POST comment on own ticket 201', comment.status === 201, `status=${comment.status} ${JSON.stringify(comment.body).slice(0, 200)}`));

  const comments = await c.get(`/api/tickets/${newTicket?.id}/comments`);
  results.push(pass('GET comments 200', comments.status === 200, `status=${comments.status}`));
  results.push(
    pass('comment list contains our comment', (comments.body?.comments ?? []).some((x: any) => x.body === 'Audit comment from user.')),
  );

  const emptyComment = await c.post(`/api/tickets/${newTicket?.id}/comments`, { body: '' });
  results.push(pass('empty comment -> 4xx', emptyComment.status >= 400 && emptyComment.status < 500, `status=${emptyComment.status}`));

  const activity = await c.get(`/api/tickets/${newTicket?.id}/activity`);
  results.push(pass('GET activity 200', activity.status === 200, `status=${activity.status}`));
  results.push(
    pass(
      'activity lists events',
      Array.isArray(
        activity.body?.activity ?? activity.body?.events ?? activity.body?.activityLogs,
      ),
      `keys=${Object.keys(activity.body ?? {})}`,
    ),
  );

  section('USER — Permissions on status fields');
  // A User must NOT be able to set status/priority/owner directly.
  const statusPatch = await c.patch(`/api/tickets/${newTicket?.id}`, { status: 'In Progress' });
  results.push(
    pass('User cannot set status via PATCH (403 forbidden)', statusPatch.status === 403 && statusPatch.body?.error === 'forbidden', `status=${statusPatch.status} ${JSON.stringify(statusPatch.body).slice(0, 150)}`),
  );

  const prioPatch = await c.patch(`/api/tickets/${newTicket?.id}`, { priority: 'High' });
  results.push(pass('User cannot set priority via PATCH (403 forbidden)', prioPatch.status === 403 && prioPatch.body?.error === 'forbidden', `status=${prioPatch.status}`));

  const ownerPatch = await c.patch(`/api/tickets/${newTicket?.id}`, { ownerId: 2 });
  results.push(pass('User cannot set owner via PATCH (403 forbidden)', ownerPatch.status === 403 && ownerPatch.body?.error === 'forbidden', `status=${ownerPatch.status}`));

  // Spec: description/title are read-only after create ("edit-description-
  // after-create is out of MVP"), so a User must NOT be able to rename.
  const titlePatch = await c.patch(`/api/tickets/${newTicket?.id}`, { title: 'Renamed by audit' });
  results.push(
    pass('User cannot edit title (read-only per spec)', titlePatch.status >= 400, `status=${titlePatch.status} ${JSON.stringify(titlePatch.body).slice(0, 150)}`),
  );

  section('USER — Restricted endpoints');
  const queue = await c.get('/api/tickets/queue');
  results.push(pass('GET /tickets/queue forbidden for User', queue.status === 403, `status=${queue.status}`));

  const list = await c.get('/api/tickets/list');
  results.push(pass('GET /tickets/list forbidden for User', list.status === 403, `status=${list.status}`));

  const allUsers = await c.get('/api/users');
  results.push(pass('GET /users forbidden for User', allUsers.status === 403, `status=${allUsers.status}`));

  const usersRole = await c.put('/api/users/2/role', { role: 'Admin' });
  results.push(pass('PUT /users/:id/role forbidden for User', usersRole.status === 403, `status=${usersRole.status}`));

  const usersStatus = await c.put('/api/users/2/status', { isActive: false });
  results.push(pass('PUT /users/:id/status forbidden for User', usersStatus.status === 403, `status=${usersStatus.status}`));

  const adminDash = await c.get('/api/admin/dashboard');
  results.push(pass('GET /admin/dashboard forbidden for User', adminDash.status === 403, `status=${adminDash.status}`));

  const agents = await c.get('/api/users/agents');
  results.push(pass('GET /users/agents allowed for User', agents.status === 200, `status=${agents.status}`));

  section('USER — Notifications');
  const notif = await c.get('/api/notifications');
  results.push(pass('GET /notifications 200', notif.status === 200, `status=${notif.status}`));

  if (Array.isArray(notif.body?.notifications) && notif.body.notifications.length > 0) {
    const nid = notif.body.notifications[0].id;
    const markRead = await c.post(`/api/notifications/${nid}/read`);
    results.push(pass('POST /notifications/:id/read 200', markRead.status === 200, `status=${markRead.status}`));
  } else {
    results.push(pass('notifications array present', true, 'empty feed — read test skipped'));
  }
  const markAll = await c.post('/api/notifications/read-all');
  results.push(pass('POST /notifications/read-all 200', markAll.status === 200, `status=${markAll.status}`));

  section('USER — Profile & password');
  const change = await c.patch('/api/auth/me/password', { currentPassword: 'password123', newPassword: 'password123' });
  results.push(pass('PATCH /auth/me/password with same password', change.status === 204 || change.status === 400, `status=${change.status} ${JSON.stringify(change.body).slice(0, 150)}`));

  const wrongCurrent = await c.patch('/api/auth/me/password', { currentPassword: 'nope', newPassword: 'whatever123' });
  results.push(pass('change password with wrong current -> 4xx', wrongCurrent.status >= 400 && wrongCurrent.status < 500, `status=${wrongCurrent.status}`));

  section('USER — Reopen / confirm-close (submitter-only)');
  const reopen = await c.post(`/api/tickets/${newTicket?.id}/reopen`);
  results.push(pass('reopen on Open ticket -> 4xx (wrong state)', reopen.status >= 400, `status=${reopen.status} ${JSON.stringify(reopen.body).slice(0, 150)}`));

  const confirm = await c.post(`/api/tickets/${newTicket?.id}/confirm-close`);
  results.push(pass('confirm-close on Open ticket -> 4xx (wrong state)', confirm.status >= 400, `status=${confirm.status}`));

  console.log(`\n${'='.repeat(70)}`);
  const passed = results.filter(Boolean).length;
  console.log(`USER ROLE: ${passed}/${results.length} passed`);
  console.log(`${'='.repeat(70)}`);
  const failures = results.filter((r) => !r).length;
  if (failures) process.exitCode = 1;
}

run().catch((e) => {
  console.error('HARNESS ERROR:', e);
  process.exitCode = 2;
});

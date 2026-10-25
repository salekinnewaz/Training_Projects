/**
 * Role audit — SUPPORT AGENT role.
 * Covers the Agent Kanban, ticket queue, status transitions, assignment,
 * priority changes, comments, and permission boundaries.
 */

import { Client, ACCOUNTS, pass, section } from './api-harness';

const results: boolean[] = [];
const agent = new Client('agent');
const admin = new Client('admin');
const user = new Client('user');

/**
 * Probe tickets must be created by an EMPLOYEE — the API restricts
 * ticket creation to the User role ("Only employees can file
 * tickets"). The agent then acts on them.
 */
async function createProbeTicket(title: string, description: string) {
  await user.loginOk(ACCOUNTS.user.email);
  const r = await user.post('/api/tickets', {
    title,
    description,
    category: 'IT',
    priority: 'Medium',
  });
  return r;
}

async function run() {
  section('AGENT — Authentication');
  const login = await agent.loginOk(ACCOUNTS.agent.email);
  results.push(pass('login succeeds', login.status === 200, `status=${login.status}`));
  results.push(pass('role is Support Agent', login.body?.user?.role === 'Support Agent', JSON.stringify(login.body?.user)));

  section('AGENT — Queue & list access');
  const queue = await agent.get('/api/tickets/queue');
  results.push(pass('GET /tickets/queue 200', queue.status === 200, `status=${queue.status}`));
  const queueTickets = queue.body?.tickets ?? [];
  results.push(pass('queue returns tickets', queueTickets.length > 0, `count=${queueTickets.length}`));
  results.push(pass('queue envelope has count', typeof queue.body?.count === 'number', `count=${queue.body?.count}`));

  const list = await agent.get('/api/tickets/list');
  results.push(pass('GET /tickets/list 200', list.status === 200, `status=${list.status}`));

  const stats = await agent.get('/api/tickets/stats');
  results.push(pass('GET /tickets/stats 200', stats.status === 200, `status=${stats.status}`));
  results.push(pass('stats has counts', !!stats.body?.counts, `keys=${Object.keys(stats.body ?? {})}`));
  results.push(pass('stats has dailyCreated array', Array.isArray(stats.body?.dailyCreated), `len=${stats.body?.dailyCreated?.length}`));

  const mine = await agent.get('/api/tickets/mine');
  results.push(pass('GET /tickets/mine 200 for agent', mine.status === 200, `status=${mine.status}`));

  section('AGENT — Restricted endpoints');
  const adminDash = await agent.get('/api/admin/dashboard');
  results.push(pass('GET /admin/dashboard forbidden for Agent', adminDash.status === 403, `status=${adminDash.status}`));

  const allUsers = await agent.get('/api/users');
  results.push(pass('GET /users forbidden for Agent', allUsers.status === 403, `status=${allUsers.status}`));

  const setRole = await agent.put('/api/users/5/role', { role: 'Admin' });
  results.push(pass('PUT /users/:id/role forbidden for Agent', setRole.status === 403, `status=${setRole.status}`));

  const setStatus = await agent.put('/api/users/5/status', { isActive: false });
  results.push(pass('PUT /users/:id/status forbidden for Agent', setStatus.status === 403, `status=${setStatus.status}`));

  const agents = await agent.get('/api/users/agents');
  results.push(pass('GET /users/agents 200', agents.status === 200, `status=${agents.status}`));

  section('AGENT — Ticket visibility');
  // Agent can see ANY ticket, including one owned by an employee.
  await admin.loginOk(ACCOUNTS.admin.email);
  const all = await admin.get('/api/tickets/list');
  const anyTicket = (all.body?.tickets ?? [])[0];
  const anyId = anyTicket?.id;

  if (anyId) {
    const detail = await agent.get(`/api/tickets/${anyId}`);
    results.push(pass('Agent CAN read any ticket', detail.status === 200, `status=${detail.status}`));
  } else {
    results.push(pass('found a ticket to probe', false, 'none'));
  }

  section('AGENT — Create ticket (spec: employees create; agent behavior)');
  const agentCreate = await agent.post('/api/tickets', {
    title: 'Audit: agent creates ticket',
    description: 'Agent creating a ticket during role audit.',
    category: 'General',
    priority: 'Low',
  });
  results.push(
    pass('Agent POST /tickets', agentCreate.status === 201 || agentCreate.status === 403, `status=${agentCreate.status} ${JSON.stringify(agentCreate.body).slice(0, 180)}`),
  );

  section('AGENT — Status transitions');
  // Build a fresh Open ticket to drive the transition matrix on.
  const created = await createProbeTicket(
    'Audit: transition probe',
    'Ticket for status transition testing.',
  );
  const tId = created.body?.ticket?.id;
  results.push(pass('created transition probe ticket', created.status === 201 && !!tId, `status=${created.status} id=${tId}`));

  if (tId) {
    // Open -> In Progress is legal.
    const toProgress = await agent.patch(`/api/tickets/${tId}`, { status: 'In Progress' });
    results.push(pass('Open -> In Progress allowed', toProgress.status === 200, `status=${toProgress.status} ${JSON.stringify(toProgress.body).slice(0, 150)}`));

    // In Progress -> Resolved is legal.
    const toResolved = await agent.patch(`/api/tickets/${tId}`, { status: 'Resolved' });
    results.push(pass('In Progress -> Resolved allowed', toResolved.status === 200, `status=${toResolved.status}`));

    // Agent CANNOT transition to Closed (spec: Closed is submitter-only).
    const toClosed = await agent.patch(`/api/tickets/${tId}`, { status: 'Closed' });
    results.push(
      pass('Agent CANNOT set Closed (403 forbidden)', toClosed.status === 403 && toClosed.body?.error === 'forbidden', `status=${toClosed.status} ${JSON.stringify(toClosed.body).slice(0, 180)}`),
    );

    // Resolved -> Open (reopen by agent) is allowed.
    const reopenByAgent = await agent.patch(`/api/tickets/${tId}`, { status: 'Open' });
    results.push(pass('Resolved -> Open allowed for Agent', reopenByAgent.status === 200, `status=${reopenByAgent.status}`));

    // Admin == Agent on the action matrix, so an Admin cannot drive
    // -> Closed via PATCH either. The ONLY way a ticket reaches Closed
    // is the submitter's "Confirm (close)" at Resolved. Verify the
    // submitter path works, then that Closed is terminal.
    const adminClose = await admin.patch(`/api/tickets/${tId}`, { status: 'Closed' });
    results.push(
      pass('Admin cannot close via PATCH (Admin == Agent on matrix)', adminClose.status >= 400, `status=${adminClose.status} ${JSON.stringify(adminClose.body).slice(0, 150)}`),
    );

    // Submitter confirms close at Resolved -> Closed.
    await agent.patch(`/api/tickets/${tId}`, { status: 'In Progress' });
    await agent.patch(`/api/tickets/${tId}`, { status: 'Resolved' });
    const confirmClose = await user.post(`/api/tickets/${tId}/confirm-close`);
    results.push(pass('Submitter confirm-close succeeds', confirmClose.status === 200, `status=${confirmClose.status} ${JSON.stringify(confirmClose.body).slice(0, 150)}`));

    const closedState = await agent.get(`/api/tickets/${tId}`);
    results.push(pass('ticket is now Closed', closedState.body?.ticket?.status === 'Closed', `status=${closedState.body?.ticket?.status}`));

    const leaveClosed = await agent.patch(`/api/tickets/${tId}`, { status: 'Open' });
    results.push(pass('Closed is terminal (cannot leave)', leaveClosed.status >= 400, `status=${leaveClosed.status} ${JSON.stringify(leaveClosed.body).slice(0, 150)}`));

    // Comment on a closed ticket must be refused.
    const closedComment = await agent.post(`/api/tickets/${tId}/comments`, { body: 'late comment' });
    results.push(pass('comment on Closed ticket -> 403', closedComment.status === 403, `status=${closedComment.status} ${JSON.stringify(closedComment.body).slice(0, 150)}`));

    section('AGENT — Assignment & priority');
    const t2 = await createProbeTicket('Audit: assign probe', 'Assignment probe.');
    const t2Id = t2.body?.ticket?.id;

    const assign = await agent.patch(`/api/tickets/${t2Id}`, { ownerId: ACCOUNTS.agent.id });
    results.push(pass('Agent CAN assign ticket to self', assign.status === 200, `status=${assign.status} ${JSON.stringify(assign.body).slice(0, 150)}`));

    const assignOther = await agent.patch(`/api/tickets/${t2Id}`, { ownerId: 3 });
    results.push(pass('Agent CAN assign to another agent', assignOther.status === 200, `status=${assignOther.status}`));

    const unassign = await agent.patch(`/api/tickets/${t2Id}`, { ownerId: null });
    results.push(pass('Agent CAN unassign (ownerId null)', unassign.status === 200, `status=${unassign.status}`));

    const prio = await agent.patch(`/api/tickets/${t2Id}`, { priority: 'High' });
    results.push(pass('Agent CAN change priority', prio.status === 200, `status=${prio.status}`));

    const badPrio = await agent.patch(`/api/tickets/${t2Id}`, { priority: 'Urgent' });
    results.push(pass('Agent invalid priority -> 4xx', badPrio.status >= 400 && badPrio.status < 500, `status=${badPrio.status}`));

    const badOwner = await agent.patch(`/api/tickets/${t2Id}`, { ownerId: 9999 });
    results.push(pass('Agent assign to nonexistent user -> 4xx', badOwner.status >= 400 && badOwner.status < 500, `status=${badOwner.status} ${JSON.stringify(badOwner.body).slice(0, 150)}`));

    const badStatus = await agent.patch(`/api/tickets/${t2Id}`, { status: 'NotAStatus' });
    results.push(pass('Agent invalid status -> 4xx', badStatus.status >= 400 && badStatus.status < 500, `status=${badStatus.status}`));

    section('AGENT — Comments & activity');
    const comment = await agent.post(`/api/tickets/${t2Id}/comments`, { body: 'Agent reply to ticket.' });
    results.push(pass('Agent CAN comment on any ticket', comment.status === 201, `status=${comment.status} ${JSON.stringify(comment.body).slice(0, 180)}`));

    const comments = await agent.get(`/api/tickets/${t2Id}/comments`);
    results.push(pass('Agent can list comments', comments.status === 200, `status=${comments.status}`));

    const activity = await agent.get(`/api/tickets/${t2Id}/activity`);
    results.push(pass('Agent can list activity', activity.status === 200, `status=${activity.status}`));
    const events = activity.body?.activity ?? activity.body?.events ?? [];
    results.push(pass('activity has entries', events.length > 0, `count=${events.length}`));

    // Assignment + priority changes must be recorded.
    const types = events.map((e: any) => e.eventType);
    results.push(pass('activity records assignment', types.includes('Assigned') || types.includes('Reassigned'), `types=${types.join(',')}`));
    results.push(pass('activity records priority change', types.includes('PriorityChanged'), `types=${types.join(',')}`));

    // Status changes must be recorded on the transition probe ticket.
    const probeActivity = await agent.get(`/api/tickets/${tId}/activity`);
    const probeEvents = probeActivity.body?.activity ?? probeActivity.body?.events ?? [];
    const probeTypes = probeEvents.map((e: any) => e.eventType);
    results.push(pass('activity records status change', probeTypes.includes('StatusChanged'), `types=${probeTypes.join(',')}`));

    section('AGENT — Edge cases');
    const missing = await agent.get('/api/tickets/999999');
    results.push(pass('GET nonexistent ticket -> 404', missing.status === 404, `status=${missing.status}`));

    const badId = await agent.get('/api/tickets/abc');
    results.push(pass('GET non-numeric ticket id -> 400', badId.status === 400, `status=${badId.status}`));

    const zeroId = await agent.get('/api/tickets/0');
    results.push(pass('GET ticket id 0 -> 400', zeroId.status === 400, `status=${zeroId.status}`));

    const negId = await agent.get('/api/tickets/-5');
    results.push(pass('GET negative ticket id -> 400', negId.status === 400, `status=${negId.status}`));

    const longComment = await agent.post(`/api/tickets/${t2Id}/comments`, { body: 'x'.repeat(6000) });
    results.push(pass('over-long comment -> 4xx', longComment.status >= 400 && longComment.status < 500, `status=${longComment.status}`));

    const emptyBody = await agent.post(`/api/tickets/${t2Id}/comments`, {});
    results.push(pass('comment with no body -> 4xx', emptyBody.status >= 400 && emptyBody.status < 500, `status=${emptyBody.status}`));

    section('AGENT — Agent cannot use submitter-only endpoints');
    // reopen/confirm-close are submitter-only; agent is not the submitter here.
    const t3 = await createProbeTicket('Audit: submitter-only probe', 'probe');
    const t3Id = t3.body?.ticket?.id;
    await agent.patch(`/api/tickets/${t3Id}`, { status: 'In Progress' });
    await agent.patch(`/api/tickets/${t3Id}`, { status: 'Resolved' });

    const agentReopen = await agent.post(`/api/tickets/${t3Id}/reopen`);
    results.push(
      pass('Agent cannot reopen via submitter-only endpoint', agentReopen.status >= 400, `status=${agentReopen.status} ${JSON.stringify(agentReopen.body).slice(0, 150)}`),
    );

    const agentConfirm = await agent.post(`/api/tickets/${t3Id}/confirm-close`);
    results.push(
      pass('Agent cannot confirm-close via submitter-only endpoint', agentConfirm.status >= 400, `status=${agentConfirm.status}`),
    );
  }

  console.log(`\n${'='.repeat(70)}`);
  const passed = results.filter(Boolean).length;
  console.log(`AGENT ROLE: ${passed}/${results.length} passed`);
  console.log(`${'='.repeat(70)}`);
  if (passed !== results.length) process.exitCode = 1;
}

run().catch((e) => {
  console.error('HARNESS ERROR:', e);
  process.exitCode = 2;
});

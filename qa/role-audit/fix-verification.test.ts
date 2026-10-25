/**
 * Live verification of the 7 fixed defects.
 * Each assertion names the defect and asserts the corrected behaviour
 * against the RUNNING backend (localhost:3000).
 */

import { Client, ACCOUNTS, pass, section } from './api-harness';

const results: boolean[] = [];
const user = new Client('user');
const agent = new Client('agent');
const admin = new Client('admin');

async function run() {
  section('FIX 1 — PATCH /tickets/:id role denials must be 403, not 400');
  await user.loginOk(ACCOUNTS.user.email);
  await agent.loginOk(ACCOUNTS.agent.email);
  await admin.loginOk(ACCOUNTS.admin.email);
  const t = await user.post('/api/tickets', {
    title: 'Fix verification ticket',
    description: 'Verifying role denial status codes.',
    category: 'IT',
    priority: 'Medium',
  });
  const tId = t.body?.ticket?.id;

  const statusDenied = await user.patch(`/api/tickets/${tId}`, { status: 'In Progress' });
  results.push(
    pass('User PATCH status -> 403 forbidden (was 400)', statusDenied.status === 403 && statusDenied.body?.error === 'forbidden', `status=${statusDenied.status} body=${JSON.stringify(statusDenied.body)}`),
  );
  const priorityDenied = await user.patch(`/api/tickets/${tId}`, { priority: 'High' });
  results.push(
    pass('User PATCH priority -> 403 forbidden', priorityDenied.status === 403 && priorityDenied.body?.error === 'forbidden', `status=${priorityDenied.status}`),
  );
  const ownerDenied = await user.patch(`/api/tickets/${tId}`, { ownerId: 2 });
  results.push(
    pass('User PATCH ownerId -> 403 forbidden', ownerDenied.status === 403 && ownerDenied.body?.error === 'forbidden', `status=${ownerDenied.status}`),
  );

  section('FIX 2 — assigning a nonexistent user must be 400, not 500');
  const badAssignee = await agent.patch(`/api/tickets/${tId}`, { ownerId: 999999 });
  results.push(
    pass('Agent PATCH ownerId=999999 -> 400 validation_error (was 500)', badAssignee.status === 400 && badAssignee.body?.error === 'validation_error', `status=${badAssignee.status} body=${JSON.stringify(badAssignee.body)}`),
  );

  section('FIX 3 — malformed ticket ids must be 400, not 404');
  const zeroId = await agent.get('/api/tickets/0');
  results.push(pass('GET /tickets/0 -> 400 (was 404)', zeroId.status === 400, `status=${zeroId.status}`));
  const negId = await agent.get('/api/tickets/-5');
  results.push(pass('GET /tickets/-5 -> 400 (was 404)', negId.status === 400, `status=${negId.status}`));
  const missingId = await agent.get('/api/tickets/999999');
  results.push(pass('GET /tickets/999999 -> 404 (genuine miss)', missingId.status === 404, `status=${missingId.status}`));

  section('FIX 4 — Admin must NOT be able to close a ticket via PATCH');
  await agent.patch(`/api/tickets/${tId}`, { status: 'Resolved' });
  const adminClose = await admin.patch(`/api/tickets/${tId}`, { status: 'Closed' });
  results.push(
    pass('Admin PATCH status=Closed -> 403 forbidden', adminClose.status === 403 && adminClose.body?.error === 'forbidden', `status=${adminClose.status} body=${JSON.stringify(adminClose.body)}`),
  );
  const agentClose = await agent.patch(`/api/tickets/${tId}`, { status: 'Closed' });
  results.push(
    pass('Agent PATCH status=Closed -> 403 forbidden', agentClose.status === 403, `status=${agentClose.status}`),
  );
  const submitterClose = await user.post(`/api/tickets/${tId}/confirm-close`, {});
  results.push(
    pass('submitter confirm-close -> 200 (only the creator may close)', submitterClose.status === 200, `status=${submitterClose.status}`),
  );

  section('FIX 5 — multer errors must be 413/415, not 500');
  const tooBig = new FormData();
  tooBig.append('file', new Blob([Buffer.alloc(11 * 1024 * 1024)], { type: 'image/png' }), 'big.png');
  const bigUpload = await user.raw('POST', '/api/attachments', tooBig);
  results.push(
    pass('oversize upload -> 413 file_too_large (was 500)', bigUpload.status === 413 && bigUpload.body?.error === 'file_too_large', `status=${bigUpload.status} body=${JSON.stringify(bigUpload.body)}`),
  );
  const badType = new FormData();
  badType.append('file', new Blob([Buffer.from('#!/bin/sh')], { type: 'application/x-sh' }), 'evil.sh');
  const badUpload = await user.raw('POST', '/api/attachments', badType);
  results.push(
    pass('disallowed mimetype -> 415 unsupported_media_type (was 500)', badUpload.status === 415 && badUpload.body?.error === 'unsupported_media_type', `status=${badUpload.status} body=${JSON.stringify(badUpload.body)}`),
  );

  section('FIX 6 — malformed multipart must be 400, not 500');
  // A REAL truncated body: the multipart headers are present but the
  // part is cut off mid-stream and the closing boundary never
  // arrives. `FormData` cannot express this — it always produces a
  // well-formed body — so we hand-roll the bytes and declare the
  // boundary in the Content-Type header.
  const boundary = '----pukuFixBoundary';
  const truncatedBody = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="x.png"\r\n` +
      `Content-Type: image/png\r\n\r\n` +
      'PARTIAL',
    'utf8',
  );
  const malformed = await user.raw(
    'POST',
    '/api/attachments',
    truncatedBody,
    { 'content-type': `multipart/form-data; boundary=${boundary}` },
  );
  results.push(
    pass('truncated multipart -> 4xx, not 500', malformed.status >= 400 && malformed.status < 500, `status=${malformed.status} body=${JSON.stringify(malformed.body).slice(0, 160)}`),
  );

  section('FIX 7 — no stray 5xx anywhere in the role matrix');
  const probes: [string, string, string, any][] = [
    ['user', 'PATCH', `/api/tickets/${tId}`, { status: 'Closed' }],
    ['user', 'PATCH', '/api/tickets/abc', { status: 'Closed' }],
    ['user', 'POST', '/api/tickets', { title: '', description: '', category: 'Nope', priority: 'Nope' }],
    ['agent', 'PATCH', `/api/tickets/${tId}`, { ownerId: 999999 }],
    ['admin', 'PATCH', `/api/tickets/${tId}`, { ownerId: 5 }],
    ['admin', 'PUT', '/api/users/1/role', { role: 'User' }],
    ['admin', 'PUT', '/api/users/1/status', { isActive: false }],
  ];
  for (const [who, method, path, body] of probes) {
    const c = who === 'user' ? user : who === 'agent' ? agent : admin;
    const r = await c.raw(method, path, body);
    results.push(
      pass(`${who} ${method} ${path} -> no 5xx`, r.status < 500, `status=${r.status} body=${JSON.stringify(r.body).slice(0, 120)}`),
    );
  }

  console.log(`\n${'='.repeat(70)}`);
  const passed = results.filter(Boolean).length;
  console.log(`FIX VERIFICATION: ${passed}/${results.length} passed`);
  console.log(`${'='.repeat(70)}`);
  if (passed !== results.length) process.exitCode = 1;
}

run().catch((e) => {
  console.error('HARNESS ERROR:', e);
  process.exitCode = 2;
});

/**
 * Role audit — attachments (HD-016).
 * Covers upload limits, mimetype allowlist, and per-role download
 * visibility (a User may only download attachments on their own
 * tickets — enumeration protection).
 */

import { Client, ACCOUNTS, pass, section } from './api-harness';

const results: boolean[] = [];
const user = new Client('user');
const agent = new Client('agent');
const other = new Client('other');

const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

async function run() {
  section('ATTACHMENTS — Upload');
  await user.loginOk(ACCOUNTS.user.email);
  await agent.loginOk(ACCOUNTS.agent.email);

  // Create a ticket to hang the attachment off.
  const ticket = await user.post('/api/tickets', {
    title: 'Audit: attachment probe',
    description: 'Attachment probe ticket.',
    category: 'IT',
    priority: 'Medium',
  });
  const tId = ticket.body?.ticket?.id;
  results.push(pass('created ticket for attachment', ticket.status === 201 && !!tId, `id=${tId}`));

  const form = new FormData();
  form.append('file', new Blob([PNG_1x1], { type: 'image/png' }), 'probe.png');

  const upload = await user.raw('POST', '/api/attachments', form);
  results.push(
    pass('POST /attachments 201 for image/png', upload.status === 201, `status=${upload.status} ${JSON.stringify(upload.body).slice(0, 200)}`),
  );
  const attId = upload.body?.id ?? upload.body?.attachment?.id;
  results.push(pass('upload returns an id', !!attId, `id=${attId}`));
  results.push(pass('upload returns filename', !!upload.body?.filename, `filename=${upload.body?.filename}`));

  // Attach it to a ticket — the access rule keys off
  // `tickets.attachment_id`, so an orphan upload is not downloadable
  // by its uploader.
  const attachTicket = await user.post('/api/tickets', {
    title: 'Audit: attachment-linked ticket',
    description: 'Ticket carrying the attachment.',
    category: 'IT',
    priority: 'Medium',
    attachmentId: attId,
  });
  results.push(
    pass('ticket created with attachmentId', attachTicket.status === 201 && attachTicket.body?.ticket?.attachmentId === attId, `status=${attachTicket.status} attachmentId=${attachTicket.body?.ticket?.attachmentId}`),
  );

  section('ATTACHMENTS — Validation');
  const badType = new FormData();
  badType.append('file', new Blob([Buffer.from('#!/bin/sh\nrm -rf /\n')], { type: 'application/x-sh' }), 'evil.sh');
  const badUpload = await user.raw('POST', '/api/attachments', badType);
  results.push(pass('disallowed mimetype rejected', badUpload.status >= 400 && badUpload.status < 500, `status=${badUpload.status} ${JSON.stringify(badUpload.body).slice(0, 150)}`));

  const noFile = new FormData();
  const emptyUpload = await user.raw('POST', '/api/attachments', noFile);
  results.push(pass('upload with no file -> 4xx', emptyUpload.status >= 400 && emptyUpload.status < 500, `status=${emptyUpload.status}`));

  const tooBig = new FormData();
  tooBig.append('file', new Blob([Buffer.alloc(11 * 1024 * 1024)], { type: 'image/png' }), 'big.png');
  const bigUpload = await user.raw('POST', '/api/attachments', tooBig);
  results.push(pass('file over 10MB rejected', bigUpload.status >= 400 && bigUpload.status < 500, `status=${bigUpload.status} ${JSON.stringify(bigUpload.body).slice(0, 150)}`));

  section('ATTACHMENTS — Download visibility');
  if (attId) {
    const ownDownload = await user.raw('GET', `/api/attachments/${attId}`);
    results.push(pass('owner can download own attachment', ownDownload.status === 200, `status=${ownDownload.status}`));

    const agentDownload = await agent.raw('GET', `/api/attachments/${attId}`);
    results.push(pass('Agent can download any attachment', agentDownload.status === 200, `status=${agentDownload.status}`));

    // A different employee must NOT be able to read it.
    await other.loginOk('noah@company.com');
    const otherDownload = await other.raw('GET', `/api/attachments/${attId}`);
    results.push(
      pass('other employee CANNOT download attachment (403/404)', otherDownload.status === 403 || otherDownload.status === 404, `status=${otherDownload.status}`),
    );

    const missing = await agent.raw('GET', '/api/attachments/999999');
    results.push(pass('download nonexistent attachment -> 404', missing.status === 404, `status=${missing.status}`));

    const badId = await agent.raw('GET', '/api/attachments/abc');
    results.push(pass('download non-numeric attachment id -> 4xx', badId.status >= 400 && badId.status < 500, `status=${badId.status}`));
  }

  section('ATTACHMENTS — Unauthenticated');
  const anon = new Client('anon');
  const anonUpload = await anon.raw('POST', '/api/attachments', new FormData());
  results.push(pass('upload without auth -> 401', anonUpload.status === 401, `status=${anonUpload.status}`));

  if (attId) {
    const anonDownload = await anon.raw('GET', `/api/attachments/${attId}`);
    results.push(pass('download without auth -> 401', anonDownload.status === 401, `status=${anonDownload.status}`));
  }

  console.log(`\n${'='.repeat(70)}`);
  const passed = results.filter(Boolean).length;
  console.log(`ATTACHMENTS: ${passed}/${results.length} passed`);
  console.log(`${'='.repeat(70)}`);
  if (passed !== results.length) process.exitCode = 1;
}

run().catch((e) => {
  console.error('HARNESS ERROR:', e);
  process.exitCode = 2;
});

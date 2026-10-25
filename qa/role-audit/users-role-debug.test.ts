import { Client, ACCOUNTS, section } from './api-harness';

const admin = new Client('admin');

async function run() {
  section('DEBUG — GET /api/users raw wire shape');
  await admin.loginOk(ACCOUNTS.admin.email);
  const list = await admin.get('/api/users');
  console.log('status:', list.status);
  console.log(JSON.stringify(list.body, null, 2));

  section('DEBUG — PUT /api/users/:id/role then re-GET');
  const target = list.body?.users?.find((u: any) => u.id !== ACCOUNTS.admin.id);
  console.log('target:', JSON.stringify(target));
  const put = await admin.raw('PUT', `/api/users/${target.id}/role`, { role: 'Support Agent' });
  console.log('PUT status:', put.status);
  console.log('PUT body:', JSON.stringify(put.body, null, 2));

  const list2 = await admin.get('/api/users');
  const target2 = list2.body?.users?.find((u: any) => u.id === target.id);
  console.log('after re-GET target:', JSON.stringify(target2));

  section('DEBUG — direct DB check via a second GET of the same user');
  const one = await admin.get('/api/users');
  console.log('all roles:', JSON.stringify(one.body?.users?.map((u: any) => ({ id: u.id, name: u.displayName, role: u.role }))));

  // restore
  const restore = await admin.raw('PUT', `/api/users/${target.id}/role`, { role: target.role });
  console.log('restore status:', restore.status, JSON.stringify(restore.body?.role));
}

run().catch((e) => { console.error(e); process.exitCode = 1; });

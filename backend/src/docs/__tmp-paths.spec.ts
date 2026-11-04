import { getOpenApiSpec } from './openapi';
it('lists', () => {
  const s = getOpenApiSpec() as { paths: Record<string, unknown> };
  const expected = ['/health','/auth/login','/auth/logout','/auth/me','/auth/me/password','/auth/register','/tickets','/tickets/mine','/tickets/queue','/tickets/{id}','/tickets/{id}/activity','/tickets/{id}/comments','/tickets/{id}/confirm-close','/tickets/{id}/reopen','/users','/users/agents','/users/{id}/role','/users/{id}/status','/admin/dashboard','/attachments','/attachments/{id}'];
  const keys = Object.keys(s.paths);
  console.log('EXTRA:', keys.filter(k => !expected.includes(k)).join(', '));
});

/**
 * Role-audit API harness — talks to the running backend over HTTP
 * using cookie-based auth (the `auth` httpOnly cookie).
 *
 * Usage:
 *   npx tsx qa/role-audit/api-harness.ts <role>
 * where <role> is one of: user | agent | admin
 */

const BASE = process.env.API_BASE ?? 'http://localhost:3000';
const PASSWORD = 'password123';

export const ACCOUNTS = {
  user: { email: 'jess@company.com', role: 'User', id: 5 },
  agent: { email: 'sam@company.com', role: 'Support Agent', id: 2 },
  admin: { email: 'admin@company.com', role: 'Admin', id: 1 },
} as const;

export type RoleKey = keyof typeof ACCOUNTS;

export interface ApiResult {
  status: number;
  body: any;
  headers: Headers;
}

export class Client {
  private cookie = '';

  constructor(public readonly label: string) {}

  /** Drop the session cookie so we can assert on a truly unauthenticated request. */
  clearCookie() {
    this.cookie = '';
  }

  get hasCookie() {
    return this.cookie.length > 0;
  }

  async raw(
    method: string,
    path: string,
    body?: unknown,
    extraHeaders: Record<string, string> = {},
  ): Promise<ApiResult> {
    const headers: Record<string, string> = { ...extraHeaders };
    if (this.cookie) headers['cookie'] = this.cookie;

    let payload: BodyInit | undefined;
    if (body instanceof FormData) {
      // Let fetch set the multipart boundary itself — setting
      // content-type here would omit the boundary and the server
      // would see an empty body.
      payload = body;
    } else if (Buffer.isBuffer(body)) {
      // Raw bytes. Used to hand-roll a malformed / truncated
      // multipart body, which `FormData` cannot express (it always
      // produces a well-formed body). The caller MUST set its own
      // `content-type` via `extraHeaders` — we don't guess one,
      // because guessing would overwrite the boundary declaration.
      payload = body;
    } else if (body !== undefined) {
      headers['content-type'] = 'application/json';
      payload = JSON.stringify(body);
    }

    const res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: payload,
      redirect: 'manual',
    });

    const setCookie = res.headers.getSetCookie?.() ?? [];
    for (const c of setCookie) {
      const first = c.split(';')[0];
      if (first.startsWith('auth=')) this.cookie = first;
    }

    const text = await res.text();
    let parsed: any = text;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      /* keep raw text */
    }
    return { status: res.status, body: parsed, headers: res.headers };
  }

  get(path: string) {
    return this.raw('GET', path);
  }
  post(path: string, body?: unknown) {
    return this.raw('POST', path, body);
  }
  patch(path: string, body?: unknown) {
    return this.raw('PATCH', path, body);
  }
  put(path: string, body?: unknown) {
    return this.raw('PUT', path, body);
  }

  async login(email: string, pwd = PASSWORD): Promise<ApiResult> {
    const r = await this.raw('POST', '/api/auth/login', { email, password: pwd });
    // A failed login (wrong password, deactivated account, rate
    // limited) is a legitimate RESULT to assert on, not a harness
    // error — so we return it rather than throwing. Only throw when
    // the request itself failed at the transport layer.
    if (r.status === 0) {
      throw new Error(`login transport failure for ${email}: ${JSON.stringify(r.body)}`);
    }
    return r;
  }

  /** Login and throw if it did not succeed — for setup steps. */
  async loginOk(email: string, pwd = PASSWORD): Promise<ApiResult> {
    const r = await this.login(email, pwd);
    if (r.status !== 200) {
      throw new Error(`login failed for ${email}: ${r.status} ${JSON.stringify(r.body)}`);
    }
    return r;
  }

  async loginAs(role: RoleKey): Promise<ApiResult> {
    return this.login(ACCOUNTS[role].email);
  }
}

export function pass(name: string, ok: boolean, detail = ''): boolean {
  const tag = ok ? 'PASS' : 'FAIL';
  console.log(`${tag}  ${name}${detail ? `  -> ${detail}` : ''}`);
  return ok;
}

export function section(title: string) {
  console.log(`\n${'='.repeat(70)}\n${title}\n${'='.repeat(70)}`);
}

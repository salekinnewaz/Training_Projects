# HelpDesk Lite — Vercel Deployment Plan

## TL;DR — chosen approach (all free)

| Layer        | Host                | Cost  | Why                                                      |
| ------------ | ------------------- | ----- | -------------------------------------------------------- |
| Angular SPA  | **Vercel**          | $0    | Free static hosting, free TLS, global CDN, PR previews    |
| Express API  | **Vercel Functions**| $0    | Rewrite as serverless functions — fits Vercel cleanly      |
| Database     | **Vercel Postgres** | $0    | Vercel-native, 256 MB free, integrated auth               |
| File uploads | **Vercel Blob**     | $0    | 500 MB free (or skip; backend attachments stay local)     |

**Three things change from the current code:**

1. **Sequelize dialect:** MySQL → Postgres. Same Sequelize API, only the driver and `dialect` change. Most model code is untouched.
2. **Express app:** rewrite `backend/src/server.ts` into a Vercel Function (`api/index.ts`) that exports the Express app as a handler. ~10 lines of glue.
3. **File attachments:** switch to **Vercel Blob** (`@vercel/blob`) so uploads work on serverless. Or remove attachments from the demo to skip the dependency.

Everything else (frontend, components, services) is unchanged.

---

## 1. Project shape on disk (current)

```
Training_Projects/
├── frontend/             ← Angular 17 SPA (Vercel target)
│   ├── src/environments/environment.prod.ts  (apiBaseUrl: '/api' ✅)
│   ├── angular.json                          (output: dist/frontend/browser)
│   └── package.json
├── backend/              ← Express + TypeScript + Sequelize (Vercel target as functions)
│   ├── src/server.ts                         (rewritten to api/index.ts)
│   ├── src/models/                           (dialect change: MySQL → Postgres)
│   └── package.json
├── docker-compose.yml    ← local Postgres now (was MySQL)
├── .env / .env.example
└── package.json          ← npm workspaces: frontend + backend
```

`environment.prod.ts` already uses a relative `/api` path — no changes needed for Vercel routing.

---

## 2. Why Postgres over SQLite (the user's question)

**Short answer:** Postgres is the right pick for this app on Vercel.

| Criterion                  | SQLite                                              | Postgres (Vercel)                                    |
| -------------------------- | --------------------------------------------------- | ---------------------------------------------------- |
| Vercel-compatible          | No (no persistent disk for functions)                | ✅ Yes (managed, free 256 MB)                         |
| Zero config on Vercel      | No (need Turso / LibSQL / similar)                  | ✅ Yes (one-click provision)                          |
| Matches Sequelize models   | Partial (no JSON column, no enums natively)          | ✅ Yes (Sequelize's reference RDBMS)                  |
| Migrations portable       | Partial                                              | ✅ Yes (drop-in)                                      |
| Multi-user concurrent      | Limited (single writer at a time)                   | ✅ Yes (full MVCC)                                    |
| Free tier on Vercel        | N/A                                                 | ✅ 256 MB, 60h compute/mo                             |

SQLite is great for **local dev** and **single-server deploys**. The moment you go serverless, you need a server too. Postgres via Vercel gives you that for free, with a single env var binding.

**What changes in code:**

- Add `pg` and `pg-hstore` to `backend/package.json`; remove `mysql2`
- One line in `backend/src/config/database.ts`: `dialect: 'postgres'` (was `'mysql'`)
- Two lines in `.env.example`: `POSTGRES_URL=...` (Vercel injects this for you in prod)
- Models: nothing changes (Sequelize abstracts the dialect)

**Estimated code change:** ~5 lines across 3 files. Models untouched.

---

## 3. Deploy the frontend to Vercel

### 3.1 Create `vercel.json` at the repo root

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "npm run build --workspace frontend",
  "outputDirectory": "frontend/dist/frontend/browser",
  "installCommand": "npm install --include-workspace-root --workspaces=false",
  "framework": null,
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/index" },
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/(.*)\\.(js|css|woff2?|ttf|svg|png|jpg|jpeg|ico|webp)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    },
    {
      "source": "/index.html",
      "headers": [
        { "key": "Cache-Control", "value": "no-cache, no-store, must-revalidate" }
      ]
    }
  ]
}
```

**What each piece does:**

- `buildCommand` / `outputDirectory` — Vercel doesn't know about npm workspaces, so we tell it explicitly.
- `installCommand` — installs root + workspace deps in one shot.
- `rewrites` — `/api/*` routes to the serverless function (section 4); everything else falls through to `index.html` so deep links like `/tickets/42` work after refresh.
- `headers` — hashed assets get 1-year cache; `index.html` is always fresh.

### 3.2 Connect the repo

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import `salekinnewaz/Training_Projects`
3. Vercel will auto-detect `vercel.json` and use those settings
4. Click **Deploy** — first build ~2 min, then any push to `main` redeploys automatically

### 3.3 PR previews (free with Vercel)

Every pull request gets a unique preview URL — useful for sharing a working build with a reviewer before merge. No extra config needed.

---

## 4. Convert the Express backend to a Vercel Function

### 4.1 Create `api/index.ts` at the repo root

This is the entire serverless wrapper. The existing Express app from `backend/src/server.ts` becomes the handler.

```ts
// api/index.ts
import app from '../backend/src/server';

export default app;
```

That's it. Vercel sees a file at `api/index.ts`, compiles it via the backend's `tsconfig.json`, and exposes it at `/api/*` per the rewrite in `vercel.json`.

### 4.2 Adjust `backend/src/server.ts` for serverless

Three small changes:

1. **No `app.listen()`** — Vercel invokes the export directly, not as a port-listening server. Wrap the listen call in a guard:

   ```ts
   if (process.env.VERCEL !== '1' && process.env.NODE_ENV !== 'production') {
     app.listen(PORT, () => console.log(`API on :${PORT}`));
   }
   export default app;
   ```

2. **Trust the Vercel proxy** — add `app.set('trust proxy', 1)` so rate-limiting, IPs, and secure cookies work behind Vercel's edge.

3. **Cookie security** — flip `secure: process.env.NODE_ENV === 'production'` (was already true in `.env.example` via the prod env). Vercel sets `NODE_ENV=production` automatically.

### 4.3 Configure Vercel Postgres

In the Vercel dashboard:

1. **Storage → Create Database → Postgres** (free Neon-backed 256 MB instance)
2. Vercel auto-injects these env vars into the project:
   - `POSTGRES_URL`
   - `POSTGRES_PRISMA_URL`
   - `POSTGRES_URL_NON_POOLING`
   - etc.
3. Your `backend/src/config/database.ts` needs to read `POSTGRES_URL` and use it as the connection string:

   ```ts
   const sequelize = new Sequelize(
     process.env.POSTGRES_URL!,
     {
       dialect: 'postgres',
       logging: false,
       dialectOptions: {
         ssl: { require: true, rejectUnauthorized: false },
       },
     },
   );
   ```

### 4.4 One-time database setup (migrations + seed)

Run once after creating the Postgres DB. The cleanest path:

```bash
# Locally, with the Vercel env var pulled down
vercel env pull .env.local
npm run db:migrate --workspace backend
npm run db:seed --workspace backend
```

The migrations live in `backend/src/migrations/` and the seeders in `backend/src/seeders/` — they run against whatever DB the connection string points at.

### 4.5 Add the runtime env var

Vercel project → Settings → Environment Variables:

| Key                | Value (example)                  | Scope        |
| ------------------ | -------------------------------- | ------------ |
| `JWT_SECRET`       | (paste a 64-char random secret)  | Production   |
| `FRONTEND_ORIGIN`  | (your Vercel domain)             | Production   |
| `NODE_ENV`         | `production`                     | Production   |

(These three are the only ones your backend actually reads at runtime; the DB URL is injected by Vercel automatically.)

---

## 5. (Optional) File uploads — Vercel Blob

The current backend has an `Attachment` model + multer-based upload. On Vercel Functions you can't write to the local disk, so:

- **Option A (recommended):** swap to **Vercel Blob** (`@vercel/blob`, free 500 MB). ~30 lines of code change in the upload route. Blob URLs are stored in the Attachment model.
- **Option B:** skip attachments for the demo. Comment out the upload route, leave the model and UI in place, and ship without it.

The rest of the app (tickets, comments, activity log, kanban) works without attachments touched.

---

## 6. Local dev still works (with Postgres)

Switch the docker-compose DB to Postgres to keep local dev matching prod:

```yaml
# docker-compose.yml — replace mysql with postgres
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: helpdesk
      POSTGRES_PASSWORD: helpdesk_pwd
      POSTGRES_DB: helpdesk_lite
    ports:
      ["5432:5432"]
    volumes:
      - helpdesk_pg:/var/lib/postgresql/data
volumes:
  helpdesk_pg:
```

Update `.env.example`:

```diff
-DB_HOST=localhost
-DB_PORT=3306
-DB_NAME=helpdesk_lite
-DB_USER=helpdesk
-DB_PASSWORD=helpdesk_pwd
+# Or use POSTGRES_URL=postgres://helpdesk:helpdesk_pwd@localhost:5432/helpdesk_lite
+POSTGRES_URL=postgres://helpdesk:helpdesk_pwd@localhost:5432/helpdesk_lite
```

Local dev stays one command: `npm run dev` (concurrently runs backend on :3000 and frontend on :4200, both pointed at the local Postgres).

---

## 7. Going-forward workflow

```bash
# Local development (unchanged)
npm run dev
# → backend on :3000, frontend on :4200, Postgres on :5432

# Deploy
git push origin main
# → Vercel auto-builds frontend + api/, provisions env, deploys
# → Vercel Postgres holds the data
```

---

## 8. Cost summary

| Service            | Free tier                                    | Realistic cost |
| ------------------ | -------------------------------------------- | -------------- |
| Vercel (frontend)  | 100 GB bandwidth/mo                          | **$0**         |
| Vercel Functions   | 100 GB-hrs/mo, 10s cold-start                | **$0**         |
| Vercel Postgres    | 256 MB storage, 60h compute/mo               | **$0**         |
| Vercel Blob (opt.) | 500 MB storage, 1 GB egress/mo               | **$0**         |
| **Total**          |                                              | **$0**         |

> **Caveat:** Vercel Functions have a 10s execution time on the free plan (60s on Pro). Heavy synchronous work in any single request — large seed loads, big reports — would need Pro. For this app's CRUD + kanban + JWT auth flows, 10s is more than enough.

---

## 9. Pre-deploy checklist

- [ ] Switch `backend/src/config/database.ts` to Postgres dialect
- [ ] Add `pg` + `pg-hstore` to `backend/package.json`; remove `mysql2`
- [ ] Add `api/index.ts` at repo root that re-exports the Express app
- [ ] Guard `app.listen()` in `backend/src/server.ts` so it doesn't run in Vercel
- [ ] Add `app.set('trust proxy', 1)` for the Vercel edge
- [ ] Update `docker-compose.yml` to Postgres
- [ ] Update `.env.example` with `POSTGRES_URL`
- [ ] Create `vercel.json` at repo root
- [ ] Push to `main` and import the repo into Vercel
- [ ] In Vercel: create the Postgres DB, run migrations + seed locally against it
- [ ] Set `JWT_SECRET` and `FRONTEND_ORIGIN` env vars in the Vercel project
- [ ] Smoke test: open the Vercel URL, log in with the seeded admin, create a ticket, drag on kanban

---

## 10. Quick command recap

```bash
# Already done
git push origin main   # UI modernization pushed

# Next steps (each followed by git add/commit/push):
# 1. Switch backend dialect to Postgres
# 2. Create api/index.ts + vercel.json
# 3. Update docker-compose.yml + .env.example

# Then in the Vercel dashboard:
# - Import the repo
# - Storage → Create Postgres
# - Set JWT_SECRET + FRONTEND_ORIGIN env vars
# - Deploy
```

---

## 11. What I would NOT do

- ❌ Put MySQL on Vercel — Vercel doesn't offer managed MySQL. Switching to Postgres is the path of least resistance.
- ❌ Try to keep MySQL on Railway/Render separately — adds a second bill, a second dashboard, and a CORS surface for no benefit on a demo.
- ❌ Stick with SQLite — no serverless support without a third-party host (Turso). Postgres gives you the same "single env var" ergonomics.
- ❌ Pay for Vercel Pro just to get 60s function time — the CRUD endpoints here finish in well under 1s.

---

**Ready to execute when you say go.** I can do steps 1–3 in a single pass:

1. Swap the Sequelize dialect (MySQL → Postgres) in `backend/src/config/database.ts`
2. Add `pg`/`pg-hstore` to `backend/package.json`, remove `mysql2`
3. Create `api/index.ts` (Vercel function wrapper)
4. Guard `app.listen()` and add `app.set('trust proxy', 1)` in `backend/src/server.ts`
5. Update `docker-compose.yml` and `.env.example` to Postgres
6. Create `vercel.json` at the repo root
7. Verify with a build

Then you import the repo into Vercel, click "Create Postgres," and you're live. Total time to first deploy: ~15 min after the code changes land.

---

## 2. Recommended architecture (two-service split)

| Service         | Host                    | Why                                                                                            |
| --------------- | ----------------------- | ---------------------------------------------------------------------------------------------- |
| Angular SPA     | **Vercel**              | Free tier, global CDN, instant deploys, free TLS, custom domain, previews per PR                |
| Express API     | **Railway** (or Render) | Persistent process model, easy MySQL add-on, $5/mo free tier, free TLS, Docker support        |
| MySQL 8         | **Railway MySQL**       | One click from the Railway dashboard, automatic backups, $5/mo minimal plan                    |

> **Alternative single-platform option (simpler):** put **everything on Railway** — Angular static + Express + MySQL all in one project. Lower operational surface, but loses Vercel's edge CDN and PR previews for the UI.

---

## 3. Deploy the frontend to Vercel

### 3.1 Create `vercel.json` at the repo root

Vercel needs explicit configuration because the app lives in a subdirectory. Without this, Vercel will try to build the workspace root and fail.

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "npm run build --workspace frontend",
  "outputDirectory": "frontend/dist/frontend/browser",
  "installCommand": "npm install --workspace frontend --include-workspace-root=false",
  "framework": null,
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/(.*)\\.(js|css|woff2?|ttf|svg|png|jpg|jpeg|ico|webp)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    },
    {
      "source": "/index.html",
      "headers": [
        { "key": "Cache-Control", "value": "no-cache, no-store, must-revalidate" }
      ]
    }
  ]
}
```

**What each piece does:**

- `buildCommand` / `outputDirectory` — Vercel doesn't know about npm workspaces, so we tell it explicitly.
- `installCommand` — installs only the frontend workspace; root devDeps (concurrently) aren't needed.
- `rewrites` — **critical for Angular routing.** Every path falls through to `index.html` so deep links like `/tickets/42` or `/admin#users` work after refresh.
- `headers` — hashed assets get 1-year cache; `index.html` is always fresh (so deploys show up immediately).

### 3.2 Add an env var (for the rewrite target)

Once you know your backend URL, add an env var to the Vercel project:

| Key                | Value (example)                              | Purpose                                |
| ------------------ | -------------------------------------------- | -------------------------------------- |
| `API_PROXY_TARGET` | `https://helpdesk-api.up.railway.app`        | See section 4 (rewrites proxy `/api/*`) |

### 3.3 Connect the repo

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import `salekinnewaz/Training_Projects` (the GitHub remote you just pushed to)
3. **Root Directory:** leave blank (we point at subdirectory via `vercel.json`)
4. Vercel will auto-detect `vercel.json` and use those settings
5. Click **Deploy** — first build will take ~2 min, then any push to `main` redeploys automatically

### 3.4 PR previews (free with Vercel)

Every pull request gets a unique preview URL. Useful for sharing a working build with a reviewer before merge. No extra config needed.

---

## 4. Proxy `/api/*` from Vercel → backend host

You have two options. **Option A** is the simplest and avoids CORS entirely.

### Option A — Vercel rewrites (recommended)

Replace the single rewrite in `vercel.json` with two rewrites:

```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "https://helpdesk-api.up.railway.app/api/$1" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

Vercel will forward `/api/*` to your Railway backend transparently. The browser sees same-origin, so no CORS headers are needed in the backend.

> **Caveat:** Vercel rewrites are not a true proxy — they don't forward request bodies for some methods, and they don't stream responses. For a JSON API with small payloads (our case), they're fine. For file uploads (attachments), read section 4.1 below.

### Option B — CORS on the backend (more flexible)

Keep `vercel.json` as in section 3.1 (no proxy), and set the backend's `FRONTEND_ORIGIN` env var to your Vercel domain. The backend's existing CORS config (per `FRONTEND_ORIGIN` in `.env.example`) will allow cross-origin requests with credentials. **Pick this if** your attachment uploads exceed Vercel's 4.5 MB rewrite body limit.

### 4.1 File uploads (attachments) — important note

The current backend accepts attachments (see `backend/uploads/`). Vercel rewrites do **not** forward multipart/form-data bodies. If attachments matter for the demo:

- **Use Option B (CORS)**, OR
- **Upload directly to a presigned URL** (S3 / R2) — out of scope for this plan, but the right answer at scale

For an MVP demo with small images, Option B is the path of least resistance.

---

## 5. Deploy the backend to Railway

### 5.1 One-time setup

1. Sign in to [railway.app](https://railway.app) with GitHub
2. **New Project → Deploy from GitHub repo** → pick `Training_Projects`
3. **Service settings:**
   - **Root Directory:** `backend`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start` (or `node dist/server.js` if no `start` script)
   - **Healthcheck Path:** `/api/health` (add this endpoint if it doesn't exist — see 5.2)

### 5.2 Add a healthcheck endpoint (one-time code change)

The backend needs a `/api/health` for Railway to know it's alive. If you don't have one yet, add a route in `backend/src/server.ts`:

```ts
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});
```

### 5.3 Add the MySQL database

1. In the same Railway project → **+ New → Database → MySQL**
2. Railway provisions MySQL 8 and injects `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE` into your backend service automatically
3. In the backend service → **Variables**, map the Railway-injected vars to the names your backend expects:
   - `DB_HOST` ← `${{MySQL.MYSQL_HOST}}`
   - `DB_PORT` ← `${{MySQL.MYSQL_PORT}}`
   - `DB_USER` ← `${{MySQL.MYSQL_USER}}`
   - `DB_PASSWORD` ← `${{MySQL.MYSQL_PASSWORD}}`
   - `DB_NAME` ← `${{MySQL.MYSQL_DATABASE}}`
   - `JWT_SECRET` ← (generate a real 64-char secret — `openssl rand -hex 32`)
   - `JWT_EXPIRES_IN` ← `1h`
   - `NODE_ENV` ← `production`
   - `FRONTEND_ORIGIN` ← your Vercel domain (e.g. `https://helpdesk-lite.vercel.app`)
4. **One-time DB setup:** run migrations + seed against the Railway MySQL. Easiest:
   - Add a Railway **Deploy Command** override that runs `npm run db:migrate && npm run db:seed` before `npm start`
   - OR run them locally pointed at the Railway MySQL via the connection string in Variables

### 5.4 Expose the backend

- Railway gives you a public URL like `https://helpdesk-api.up.railway.app`
- Copy it into Vercel's `API_PROXY_TARGET` (if using Option A rewrites) OR set it in the backend's allowed CORS origins (if using Option B)

---

## 6. Pre-deploy checklist

Before the first deploy, make sure these are true:

- [ ] **Vercel:** `vercel.json` added at repo root, committed, pushed
- [ ] **Vercel:** GitHub repo connected, first deploy green
- [ ] **Railway:** `backend` service deployed, MySQL provisioned, env vars mapped
- [ ] **Railway:** DB migrations + seed run successfully
- [ ] **Vercel → Railway wiring:** either rewrites set up (Option A) OR CORS configured (Option B)
- [ ] **CORS:** backend `FRONTEND_ORIGIN` includes the Vercel domain
- [ ] **JWT_SECRET:** is a real 64-char random string, not the placeholder from `.env.example`
- [ ] **Smoke test:** open the Vercel URL, log in with the seeded admin user, create a ticket, drag it on the kanban

---

## 7. Going-forward workflow

```bash
# Local development (unchanged)
npm run dev
# → backend on :3000, frontend on :4200

# Deploy backend
git push origin main
# → Railway auto-deploys from main

# Deploy frontend
git push origin main
# → Vercel auto-deploys from main
```

Both services deploy independently from the same `main` branch. PRs get:
- Vercel preview URL (frontend)
- Railway preview environment if you enable it (backend)

---

## 8. Cost estimate (free / minimal tier)

| Service                | Free tier                                                | Realistic cost              |
| ---------------------- | -------------------------------------------------------- | --------------------------- |
| Vercel (frontend)      | 100 GB bandwidth, unlimited sites, free TLS              | **$0** for MVP              |
| Railway (backend)      | $5/mo credit, 500 hrs execution                          | **$5/mo** (backend + MySQL) |
| MySQL on Railway       | Included in the $5 plan                                  | **$0** (part of $5)         |
| **Total**              |                                                          | **~$5/mo**                  |

For a true-zero demo: Render has a free web service tier (with cold starts) and a free MySQL that expires after 30 days, so Railway's $5/mo is the more honest "real" estimate.

---

## 9. What I would NOT do on Vercel

- ❌ The **backend**. Vercel Functions are stateless, time-limited (10s hobby / 60s pro), and don't support persistent MySQL connections. Your Express app would have to be rewritten as a Vercel Function with `@vercel/mysql` or external DB pool. Not worth it.
- ❌ **MySQL**. Vercel only offers Postgres / KV / Blob. Switching to Postgres means rewriting Sequelize models and migrations. Use Railway / PlanetScale / Render for MySQL.

---

## 10. Quick command recap

```bash
# Already done
git add -A
git commit -m "feat(ui): modern design system pass"
git push origin main

# Next: create vercel.json (see section 3.1), commit, push
# Then: import the repo in Vercel + Railway dashboards
```

---

**Questions to resolve before I create the config files:**

1. **Are you OK with the two-service split** (Vercel + Railway)? Or do you want everything on Railway (simpler, less impressive) / Render (free tier with cold starts)?
2. **Option A (rewrites) or Option B (CORS) for the `/api` proxy?** Option A is simpler; Option B is required if attachment uploads matter.
3. **Do you have a custom domain** you want to point at the Vercel deployment, or use the free `*.vercel.app` subdomain?

Once you confirm, I can create the `vercel.json`, the Railway config (`railway.toml` or `nixpacks.toml`), and the healthcheck endpoint in one pass.

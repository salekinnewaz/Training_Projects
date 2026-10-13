-- ─────────────────────────────────────────────────────────────────
-- Postgres init script — D9
--
-- Mounted into the Postgres container's docker-entrypoint-initdb.d/
-- via docker-compose.yml. Runs once on first container start (i.e.
-- after `docker compose down -v` or a fresh `docker compose up -d
-- postgres`).
--
-- The base POSTGRES_DB env var only creates the dev database and
-- grants `POSTGRES_USER` access on it; the integration test suite (D9)
-- needs a sibling `helpdesk_lite_test` on the same container. This
-- file bootstraps the test database + grant so the Jest integration
-- suite can hit a known DB without any per-developer manual setup.
-- ─────────────────────────────────────────────────────────────────

CREATE DATABASE helpdesk_lite_test;
GRANT ALL PRIVILEGES ON DATABASE helpdesk_lite_test TO "helpdesk";
-- ─────────────────────────────────────────────────────────────────
-- MySQL init script — D9
--
-- Mounted into the MySQL container's docker-entrypoint-initdb.d/ via
-- docker-compose.yml. Runs once on first container start (i.e. after
-- `docker compose down -v` or a fresh `docker compose up -d mysql`).
--
-- The base `MYSQL_DATABASE: helpdesk_lite` env var only creates the
-- dev database and grants `helpdesk` access on it; the integration
-- test suite (D9) needs a sibling `helpdesk_lite_test` on the same
-- container. This file bootstraps the test database + grant so the
-- Jest integration suite can hit a known DB without any per-
-- developer manual setup.
-- ─────────────────────────────────────────────────────────────────

CREATE DATABASE IF NOT EXISTS helpdesk_lite_test
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

GRANT ALL PRIVILEGES ON `helpdesk_lite_test`.* TO 'helpdesk'@'%';
FLUSH PRIVILEGES;

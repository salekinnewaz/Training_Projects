/**
 * The base URL of the frontend under test.
 *
 * The dev frontend is not always on 4200 — when two devs (or two
 * IDEs) run the stack at the same time, the second instance moves to
 * another port so both can be live. Every QA script therefore reads
 * its target from `BASE_URL` and falls back to 4200.
 *
 *   BASE_URL=http://localhost:4300 node qa/scripts/verify-strip.js
 *
 * Scripts that live outside this directory can require it by
 * absolute path; the ones in `qa/scripts/` can use `./base-url`.
 */

'use strict';

const DEFAULT_BASE_URL = 'http://localhost:4200';

const BASE_URL = (process.env.BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');

module.exports = { BASE_URL, DEFAULT_BASE_URL };

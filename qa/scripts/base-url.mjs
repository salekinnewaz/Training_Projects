/**
 * The base URL of the frontend under test (ESM twin of base-url.js).
 *
 * The dev frontend is not always on 4200 — when two devs (or two
 * IDEs) run the stack at the same time, the second instance moves to
 * another port so both can be live. Every QA script therefore reads
 * its target from `BASE_URL` and falls back to 4200.
 *
 *   BASE_URL=http://localhost:4300 node qa/scripts/probe.mjs
 */

export const BASE_URL = (process.env.BASE_URL || 'http://localhost:4200').replace(/\/+$/, '');

/** Alias — most scripts name it `BASE`. */
export const BASE = BASE_URL;

export default BASE_URL;

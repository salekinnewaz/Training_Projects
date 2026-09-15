/**
 * Password helpers — HD-003.
 *
 * `verifyPassword` wraps `bcrypt.compare`.
 *
 * `DUMMY_HASH` is a pre-computed bcrypt hash of the string `'unused'`.
 * The login route runs `bcrypt.compare(password, DUMMY_HASH)` whenever
 * the email isn't found in the DB, so the response timing is similar
 * to the "user found, wrong password" path. This blocks the trivial
 * email-enumeration timing side-channel without adding a per-request
 * DB query.
 */

import bcrypt from 'bcrypt';

const DUMMY_PLAINTEXT = 'unused';

export const DUMMY_HASH = bcrypt.hashSync(DUMMY_PLAINTEXT, 10);

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

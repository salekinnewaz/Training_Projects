/**
 * Ticket number generator — HD-002.
 *
 * Reads `counters.value` for `name = 'ticket_number'` inside a
 * transaction with `FOR UPDATE`, increments, writes back, and
 * returns the formatted string `HD-<n>`.
 *
 * Must be called inside a transaction so concurrent inserts don't
 * collide on the same number. The caller passes the active
 * transaction handle (or none — a one-off tx is opened and
 * committed here; prefer passing your own so the increment lives
 * in the same transaction as the ticket insert).
 */

import type { Transaction } from 'sequelize';
import { Counter, sequelize } from '../models';

export const TICKET_NUMBER_COUNTER = 'ticket_number';

export async function nextTicketNumber(
  tx?: Transaction,
): Promise<string> {
  const ownsTransaction = !tx;
  const transaction =
    tx ?? (await sequelize.transaction());

  try {
    // FOR UPDATE locks the row so concurrent inserts serialize.
    const row = await Counter.findByPk(TICKET_NUMBER_COUNTER, {
      transaction,
      lock: transaction.LOCK?.UPDATE ?? undefined,
    });

    if (!row) {
      throw new Error(
        `Counter row '${TICKET_NUMBER_COUNTER}' is missing — seed it before creating tickets.`,
      );
    }

    const next = Number(row.value) + 1;
    await row.update({ value: next }, { transaction });

    if (ownsTransaction) {
      await transaction.commit();
    }

    return formatTicketNumber(next);
  } catch (err) {
    if (ownsTransaction) {
      await transaction.rollback();
    }
    throw err;
  }
}

export function formatTicketNumber(n: number): string {
  return `HD-${n}`;
}

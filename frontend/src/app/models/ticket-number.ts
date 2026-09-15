/**
 * Ticket number helper — HD-002.
 *
 * Renders a ticket sequence number as the user-facing string
 * `HD-<n>`. The backend produces the same format via
 * backend/src/utils/ticketNumber.ts.
 */

export function formatTicketNumber(n: number): string {
  return `HD-${n}`;
}

/**
 * Parse the trailing integer from a ticket number string.
 * Returns null if the input doesn't match the HD-<n> shape.
 */
export function parseTicketNumber(value: string): number | null {
  const match = /^HD-(\d+)$/.exec(value);
  return match ? parseInt(match[1], 10) : null;
}

'use strict';

/**
 * Adds `attachments.backend_kind`.
 *
 * Attachment bytes live either on the local filesystem (relative
 * path under `backend/uploads/`) or in a private Vercel Blob store
 * (a blob pathname). The two path formats are incompatible, so
 * each row records which backend wrote it - a row written by `fs`
 * must never be read by `blob`, or vice versa.
 *
 * `allowNull: false` with `defaultValue: 'fs'` backfills the
 * existing rows automatically: every row that exists today was
 * written by the filesystem backend.
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.addColumn('attachments', 'backend_kind', {
      type: 'VARCHAR(16)',
      allowNull: false,
      defaultValue: 'fs',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('attachments', 'backend_kind');
  },
};

/**
 * Migration: create attachments table — HD-002.
 *
 * Stores file metadata only. The actual upload pipeline and
 * storage layer arrive in HD-016. HD-002 seeds two rows pointing
 * at placeholder storage_paths so the schema can be exercised.
 */

'use strict';

const TABLE = 'attachments';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      TABLE,
      {
        id: {
          type: Sequelize.INTEGER.UNSIGNED,
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
        },
        filename: {
          type: Sequelize.STRING(255),
          allowNull: false,
        },
        size_bytes: {
          type: Sequelize.INTEGER.UNSIGNED,
          allowNull: false,
        },
        mimetype: {
          type: Sequelize.STRING(120),
          allowNull: false,
        },
        storage_path: {
          type: Sequelize.STRING(512),
          allowNull: false,
        },
        uploaded_by_id: {
          type: Sequelize.INTEGER.UNSIGNED,
          allowNull: false,
          references: {
            model: 'users',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
        },
      },
      {
        engine: 'InnoDB',
        charset: 'utf8mb4',
        collate: 'utf8mb4_unicode_ci',
      },
    );

    await queryInterface.addIndex(TABLE, ['uploaded_by_id'], {
      name: 'ix_attachments_uploaded_by',
    });
  },

  async down(queryInterface, _Sequelize) {
    await queryInterface.dropTable(TABLE);
  },
};

/**
 * Counter model — HD-002.
 *
 * Monotonic counter rows used to generate ticket numbers
 * transactionally (see utils/ticketNumber.ts). Internal only —
 * never exposed via any API in MVP.
 */

import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';

export interface CounterAttributes {
  name: string;
  value: number;
}

export class Counter
  extends Model<CounterAttributes, CounterAttributes>
  implements CounterAttributes
{
  declare name: string;
  declare value: number;
}

Counter.init(
  {
    name: {
      type: DataTypes.STRING(64),
      allowNull: false,
      primaryKey: true,
    },
    value: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    sequelize,
    tableName: 'counters',
    modelName: 'Counter',
    underscored: false,
    timestamps: false,
  },
);

export default Counter;

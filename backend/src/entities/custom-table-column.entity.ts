import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CustomTable } from './custom-table.entity';

type JsonObject = Record<string, unknown>;

export enum CustomTableColumnType {
  TEXT = 'text',
  NUMBER = 'number',
  DATE = 'date',
  BOOLEAN = 'boolean',
  SELECT = 'select',
  MULTI_SELECT = 'multi_select',
  /** Число с валютой и фиксированной точностью; config: { currency, precision }. */
  CURRENCY = 'currency',
  /** Вычисляемая колонка; config: { expression }. Значение не хранится. */
  FORMULA = 'formula',
  /** Ссылка на строку другой таблицы; config: { targetTableId, displayColumnKey }. */
  RELATION = 'relation',
  /** Заполняется моделью по промпту; config: { prompt }. Значение хранится. */
  AI = 'ai',
}

@Entity('custom_table_columns')
@Index('IDX_custom_table_columns_table_key_unique', ['tableId', 'key'], { unique: true })
@Index('IDX_custom_table_columns_table_position', ['tableId', 'position'])
export class CustomTableColumn {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => CustomTable, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'table_id' })
  table: CustomTable;

  @Column({ name: 'table_id', type: 'uuid' })
  tableId: string;

  @Column({ name: 'key', type: 'varchar' })
  key: string;

  @Column({ name: 'title', type: 'varchar' })
  title: string;

  @Column({
    name: 'type',
    type: 'enum',
    enum: CustomTableColumnType,
    enumName: 'custom_table_column_type_enum',
    default: CustomTableColumnType.TEXT,
  })
  type: CustomTableColumnType;

  @Column({ name: 'is_required', type: 'boolean', default: false })
  isRequired: boolean;

  @Column({ name: 'is_unique', type: 'boolean', default: false })
  isUnique: boolean;

  @Column({ name: 'position', type: 'int', default: 0 })
  position: number;

  @Column({ name: 'config', type: 'jsonb', nullable: true })
  config: JsonObject | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

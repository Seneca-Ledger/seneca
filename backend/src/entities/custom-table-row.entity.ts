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

@Entity('custom_table_rows')
@Index('IDX_custom_table_rows_table_row_number_unique', ['tableId', 'rowNumber'], { unique: true })
@Index('IDX_custom_table_rows_table_id', ['tableId'])
@Index('IDX_custom_table_rows_table_source_key', ['tableId', 'sourceKey'], {
  unique: true,
  where: '"source_key" IS NOT NULL',
})
export class CustomTableRow {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => CustomTable, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'table_id' })
  table: CustomTable;

  @Column({ name: 'table_id', type: 'uuid' })
  tableId: string;

  @Column({ name: 'row_number', type: 'int' })
  rowNumber: number;

  @Column({ name: 'data', type: 'jsonb', default: () => "'{}'::jsonb" })
  data: JsonObject;

  @Column({ name: 'styles', type: 'jsonb', nullable: true, default: () => "'{}'::jsonb" })
  styles?: JsonObject | null;

  /** Values of formula columns, written by the recalc pass; never edited by hand. */
  @Column({ name: 'computed', type: 'jsonb', default: () => "'{}'::jsonb" })
  computed: JsonObject;

  /** Id of the app record this row was filled from; null for hand-typed rows. */
  @Column({ name: 'source_key', type: 'varchar', nullable: true })
  sourceKey: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

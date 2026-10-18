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
import { User } from './user.entity';
import { Workspace } from './workspace.entity';

/**
 * One app record a table filled from Lumio data has changed. Keeps every
 * writable field as it was before the table's first edit, so "Restore to
 * default" can put them back — and as the table last left them, so the restore
 * leaves a field alone when someone has changed it in the app since.
 *
 * A snapshot of the whole record, not a row per field: fields are coupled (a new
 * amount sign changes the type), and per-field originals taken at different
 * moments would restore a state the record never had.
 */
@Entity('custom_table_source_edits')
@Index('UQ_custom_table_source_edits_record', ['tableId', 'sourceKey'], { unique: true })
@Index('IDX_custom_table_source_edits_workspace', ['workspaceId'])
export class CustomTableSourceEdit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  @ManyToOne(() => CustomTable, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'table_id' })
  table: CustomTable;

  @Column({ name: 'table_id', type: 'uuid' })
  tableId: string;

  /** The source the table was filled from: transactions, invoices, … */
  @Column({ name: 'source_kind', type: 'varchar', length: 32 })
  sourceKind: string;

  /** Id of the app record (the row's `sourceKey`). */
  @Column({ name: 'source_key', type: 'varchar', length: 255 })
  sourceKey: string;

  /** Writable fields' cell values before the table first changed the record. */
  @Column({ name: 'original_values', type: 'jsonb' })
  originalValues: Record<string, unknown>;

  /** The same fields as the table's last write left them. */
  @Column({ name: 'written_values', type: 'jsonb' })
  writtenValues: Record<string, unknown>;

  /** What the write created in the app, so a restore can remove exactly that (a payable payment). */
  @Column({ type: 'jsonb', nullable: true })
  meta: Record<string, unknown> | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

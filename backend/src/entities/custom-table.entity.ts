import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Category } from './category.entity';
import { CustomTableColumn } from './custom-table-column.entity';
import { CustomTableRow } from './custom-table-row.entity';
import type { DataEntryType } from './data-entry.entity';
import { User } from './user.entity';
import { Workspace } from './workspace.entity';

type JsonObject = Record<string, unknown>;

/** Where a table was filled from and how to refresh it; null for hand-made tables. */
export interface CustomTableSourceBinding {
  kind: string;
  filters: JsonObject;
  syncedAt: string | null;
}

export enum CustomTableSource {
  MANUAL = 'manual',
  // 'google_sheets_import' still exists in the Postgres enum type
  // custom_table_source_enum: removing an enum value needs a full type rebuild,
  // and RemoveGoogleSheets moved every such row to 'manual' instead.
}

@Entity('custom_tables')
export class CustomTable {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  @Column({ name: 'name', type: 'varchar' })
  name: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string | null;

  @Column({
    name: 'source',
    type: 'enum',
    enum: CustomTableSource,
    enumName: 'custom_table_source_enum',
    default: CustomTableSource.MANUAL,
  })
  source: CustomTableSource;

  @ManyToOne(() => Category, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'category_id' })
  category: Category | null;

  @Column({ name: 'category_id', type: 'uuid', nullable: true })
  categoryId: string | null;

  @OneToMany(
    () => CustomTableColumn,
    column => column.table,
  )
  columns: CustomTableColumn[];

  @OneToMany(
    () => CustomTableRow,
    row => row.table,
  )
  rows: CustomTableRow[];

  @Column({ name: 'view_settings', type: 'jsonb', default: () => "'{}'::jsonb" })
  viewSettings: JsonObject;

  @Column({ name: 'data_entry_scope', type: 'varchar', length: 16, nullable: true })
  dataEntryScope: 'type' | 'all' | null;

  @Column({ name: 'data_entry_type', type: 'varchar', length: 16, nullable: true })
  dataEntryType: DataEntryType | null;

  @Column({ name: 'data_entry_custom_tab_id', type: 'uuid', nullable: true })
  dataEntryCustomTabId: string | null;

  @Column({ name: 'data_entry_synced_at', type: 'timestamp', nullable: true })
  dataEntrySyncedAt: Date | null;

  @Column({ name: 'source_binding', type: 'jsonb', nullable: true })
  sourceBinding: CustomTableSourceBinding | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

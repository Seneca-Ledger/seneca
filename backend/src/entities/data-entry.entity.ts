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
import { DataEntryCustomField } from './data-entry-custom-field.entity';
import { User } from './user.entity';
import { Workspace } from './workspace.entity';

export enum DataEntryType {
  CASH = 'cash',
  RAW = 'raw',
  DEBIT = 'debit',
  CREDIT = 'credit',
}

@Entity('data_entries')
@Index('IDX_data_entries_workspace_type_date', ['workspaceId', 'type', 'date'])
@Index('IDX_data_entries_workspace_custom_tab_date', ['workspaceId', 'customTabId', 'date'])
export class DataEntry {
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

  @Column({
    type: 'enum',
    enum: DataEntryType,
  })
  type: DataEntryType;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount: number;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'varchar', length: 10 })
  currency: string;

  @Column({ name: 'custom_field_name', type: 'varchar', length: 120, nullable: true })
  customFieldName: string | null;

  @Column({ name: 'custom_field_icon', type: 'varchar', length: 120, nullable: true })
  customFieldIcon: string | null;

  @Column({ name: 'custom_field_value', type: 'text', nullable: true })
  customFieldValue: string | null;

  @ManyToOne(() => DataEntryCustomField, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'custom_tab_id' })
  customTab: DataEntryCustomField | null;

  @Column({ name: 'custom_tab_id', type: 'uuid', nullable: true })
  customTabId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

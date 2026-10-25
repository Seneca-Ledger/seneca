import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Workspace } from './workspace.entity';

export enum WorkspaceServiceSettingsKey {
  LOCAL_CATEGORIZATION = 'local_categorization',
  SMTP = 'smtp',
  TELEGRAM = 'telegram',
  APP = 'app',
  /** Precious metals: what a dealer pays below spot, per metal. */
  METALS = 'metals',
  /** Tax reserve: the share of income to set aside, and where tax payments are booked. */
  TAX_RESERVE = 'tax_reserve',
  /** How often the workspace files VAT returns, and whether it holds a standing extension. */
  VAT_FILING = 'vat_filing',
  /** Which tax-deadline reminders were already sent, so each goes out once. */
  TAX_REMINDERS = 'tax_reminders',
  /** DATEV export: chart, adviser and client numbers, bank account, category → account mapping. */
  DATEV = 'datev',
  /** Differences from the EU's official VAT rates: which were announced and which were dismissed. */
  OFFICIAL_RATES = 'official_rates',
}

@Entity('workspace_service_settings')
@Unique(['workspaceId', 'key'])
export class WorkspaceServiceSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Relation<Workspace>;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  @Column({ type: 'varchar', length: 64 })
  key: WorkspaceServiceSettingsKey;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  config: Record<string, unknown>;

  @Column({ name: 'encrypted_secrets', type: 'jsonb', default: () => "'{}'::jsonb" })
  encryptedSecrets: Record<string, string>;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'updated_by_user_id' })
  updatedByUser: Relation<User | null>;

  @Column({ name: 'updated_by_user_id', type: 'uuid', nullable: true })
  updatedByUserId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

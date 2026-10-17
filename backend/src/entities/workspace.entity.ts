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
import { TaxJurisdiction } from './tax-jurisdiction.entity';
import { User } from './user.entity';
import { WorkspaceMember } from './workspace-member.entity';

export enum VatStatus {
  REGISTERED = 'registered',
  /** Exempt under a small-business scheme: invoices carry no VAT. */
  SMALL_BUSINESS = 'small_business',
  NOT_REGISTERED = 'not_registered',
}

export enum WorkspaceKind {
  STANDARD = 'standard',
  VERSION = 'version',
}

@Entity('workspaces')
export class Workspace {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  icon: string | null;

  @Column({ type: 'varchar', length: 7, nullable: true })
  color: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'background_image' })
  backgroundImage: string | null;

  /**
   * Credit for a background found through the photo search. A CC-BY picture
   * may not be shown without naming its author and licence, so these travel
   * with the copied file and are cleared whenever the background changes.
   */
  @Column({ type: 'varchar', length: 400, nullable: true, name: 'background_attribution' })
  backgroundAttribution: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true, name: 'background_source_url' })
  backgroundSourceUrl: string | null;

  /**
   * The currency this workspace works in, and the one every amount in it falls
   * back to. Required: a workspace without a currency is how a hardcoded
   * default used to leak into transactions, budgets and invoices.
   */
  @Column({ type: 'varchar', length: 10 })
  currency: string;

  /**
   * Currency the double-entry ledger balances in. NULL means the ledger is off
   * for this workspace; it is chosen explicitly when the ledger is enabled.
   */
  @Column({ name: 'ledger_base_currency', type: 'varchar', length: 10, nullable: true })
  ledgerBaseCurrency: string | null;

  /**
   * Tax jurisdiction this workspace files in. NULL means tax is not configured,
   * which is the state every pre-existing workspace starts in.
   */
  @ManyToOne(() => TaxJurisdiction, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'tax_jurisdiction_id' })
  taxJurisdiction: TaxJurisdiction | null;

  @Column({ name: 'tax_jurisdiction_id', type: 'uuid', nullable: true })
  taxJurisdictionId: string | null;

  /**
   * Whether this workspace charges VAT. Only `registered` workspaces have tax
   * assessed on their transactions; a household or a small business exempt
   * from VAT (Kleinunternehmer and the like) has none to report or reclaim.
   */
  @Column({ name: 'vat_status', type: 'varchar', length: 20, default: VatStatus.REGISTERED })
  vatStatus: VatStatus;

  /** How far the registration-threshold alert has escalated: 0, 80 or 100. */
  @Column({ name: 'tax_threshold_alert_level', type: 'int', default: 0 })
  taxThresholdAlertLevel: number;

  /**
   * Which measuring window the level belongs to, e.g. '2026'. A new window
   * resets the alerts on its own, with no nightly job to clear flags.
   */
  @Column({ name: 'tax_threshold_alert_window', type: 'varchar', length: 16, nullable: true })
  taxThresholdAlertWindow: string | null;

  @Column({ type: 'boolean', default: false, name: 'is_favorite' })
  isFavorite: boolean;

  /**
   * `version`: a past version of a workspace opened to look at — read only,
   * reachable by its owner alone, and skipped by every background job.
   */
  @Column({ type: 'varchar', length: 16, default: WorkspaceKind.STANDARD })
  kind: WorkspaceKind;

  /** For a past version opened to look at: the version it was opened from. */
  @Column({ name: 'version_id', type: 'uuid', nullable: true })
  versionId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  settings: Record<string, unknown> | null;

  @Column({ name: 'owner_id', type: 'uuid', nullable: true })
  ownerId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'owner_id' })
  owner: User | null;

  @OneToMany(
    () => WorkspaceMember,
    member => member.workspace,
  )
  members: WorkspaceMember[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

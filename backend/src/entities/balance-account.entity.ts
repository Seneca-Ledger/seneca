import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Workspace } from './workspace.entity';

export enum BalanceAccountType {
  ASSET = 'asset',
  LIABILITY = 'liability',
  EQUITY = 'equity',
}

export enum BalanceAccountSubType {
  NON_CURRENT_ASSET = 'non_current_asset',
  CURRENT_ASSET = 'current_asset',
  CASH = 'cash',
  EQUITY = 'equity',
  BORROWED_CAPITAL = 'borrowed_capital',
}

/**
 * How a holding behaves month to month. Assigned by the user, never inferred:
 * the same car is a work tool for one workspace and dead weight for another,
 * and nothing in the stored data can tell the two apart.
 */
export enum CapitalRole {
  INCOME = 'income',
  NEUTRAL = 'neutral',
  DRAIN = 'drain',
}

/**
 * Risk of losing value — not asset class. Also user-assigned: property can be
 * a paid-off office (LOW) or a leveraged rental (HIGH), and `subType` does not
 * say which. Cash is always LOW, forced rather than stored: it is the
 * zero-risk anchor an 80/20 allocation is measured against.
 */
export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

/** What an asset account holds; set only on the investment sub-accounts people create. */
export enum BalanceAccountKind {
  INVESTMENT = 'investment',
  RETIREMENT = 'retirement',
  /** The crypto wallets' portfolio, written by the crypto module after each sync. */
  CRYPTO = 'crypto',
  /** Physical precious metals, one sub-account holding every lot. */
  METALS = 'metals',
}

export enum BalanceAutoSource {
  WALLETS = 'wallets',
  STATEMENTS = 'statements',
  WALLETS_AND_STATEMENTS = 'wallets_and_statements',
  TRANSACTIONS = 'transactions',
}

@Entity('balance_accounts')
@Unique('UQ_balance_accounts_workspace_code', ['workspaceId', 'code'])
export class BalanceAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  @ManyToOne(
    () => BalanceAccount,
    account => account.children,
    { nullable: true, onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'parent_id' })
  parent: BalanceAccount | null;

  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  parentId: string | null;

  @OneToMany(
    () => BalanceAccount,
    account => account.parent,
  )
  children: BalanceAccount[];

  @Column({ length: 80 })
  code: string;

  @Column({ length: 255 })
  name: string;

  @Column({ name: 'name_en', length: 255, nullable: true })
  nameEn: string | null;

  @Column({ name: 'name_kk', length: 255, nullable: true })
  nameKk: string | null;

  @Column({
    name: 'account_type',
    type: 'enum',
    enum: BalanceAccountType,
  })
  accountType: BalanceAccountType;

  @Column({
    name: 'sub_type',
    type: 'enum',
    enum: BalanceAccountSubType,
  })
  subType: BalanceAccountSubType;

  @Column({ name: 'is_editable', default: true })
  isEditable: boolean;

  @Column({ name: 'is_auto_computed', default: false })
  isAutoComputed: boolean;

  @Column({
    name: 'auto_source',
    type: 'enum',
    enum: BalanceAutoSource,
    nullable: true,
  })
  autoSource: BalanceAutoSource | null;

  /**
   * Null means the user has not classified this line yet. Unclassified is
   * deliberately not the same as "neutral" or "low": the allocation rule
   * counts only what was actually labelled, so an untouched workspace raises
   * no alarms about data nobody has looked at.
   */
  @Column({
    name: 'capital_role',
    type: 'enum',
    enum: CapitalRole,
    nullable: true,
  })
  capitalRole: CapitalRole | null;

  @Column({
    name: 'risk_level',
    type: 'enum',
    enum: RiskLevel,
    nullable: true,
  })
  riskLevel: RiskLevel | null;

  /** Null for every line of the sheet except investment and retirement accounts. */
  @Column({ name: 'account_kind', type: 'varchar', length: 16, nullable: true })
  accountKind: BalanceAccountKind | null;

  @Column({ default: 0 })
  position: number;

  @Column({ name: 'is_system', default: true })
  isSystem: boolean;

  @Column({ name: 'is_expandable', default: false })
  isExpandable: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

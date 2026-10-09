import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Workspace } from './workspace.entity';

/** One asset the wallet currently holds: read from the chain, or entered by hand. */
export interface CryptoWalletBalance {
  /** Ticker, uppercase. */
  asset: string;
  /** Native amount as a decimal string — 18-decimal tokens overflow `number`. */
  amount: string;
  /**
   * What one unit cost, in the workspace currency, for a holding entered by hand.
   * An on-chain balance has no such field: its cost basis comes from the transfers
   * that built it. Undefined means "unknown", which is not the same as zero.
   */
  costPerUnit?: number;
}

/**
 * `onchain` is an address we read; `manual` is a line the user keeps themselves,
 * in cold storage they would rather not name an address for; `exchange` is an
 * account whose rows came from a CSV the exchange exported.
 */
export enum CryptoWalletKind {
  ONCHAIN = 'onchain',
  MANUAL = 'manual',
  EXCHANGE = 'exchange',
}

/**
 * A public blockchain address the workspace watches. Read-only by design:
 * we never hold a private key, a seed phrase or a signing session — only an
 * address anyone could read off a block explorer.
 */
@Entity('crypto_wallets')
@Unique('UQ_crypto_wallets_workspace_chain_address', ['workspaceId', 'chainId', 'address'])
export class CryptoWallet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  /**
   * Always stored lowercase so the unique constraint catches case variants.
   * Null for a manual holding: there is no address to read. Wide enough for a
   * Bitcoin extended public key (111 characters), which stands for a whole wallet.
   */
  @Column({ type: 'varchar', length: 120, nullable: true })
  address: string | null;

  @Column({ name: 'kind', type: 'varchar', length: 8, default: CryptoWalletKind.ONCHAIN })
  kind: CryptoWalletKind;

  /** EVM chain id. 1 = Ethereum mainnet, the only chain synced today. */
  @Column({ name: 'chain_id', type: 'int', default: 1 })
  chainId: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  label: string | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'last_synced_at', type: 'timestamptz', nullable: true })
  lastSyncedAt: Date | null;

  /** Last sync failure, kept so the UI can explain a stale wallet. */
  @Column({ name: 'last_sync_error', type: 'text', nullable: true })
  lastSyncError: string | null;

  /**
   * Balances as of `lastSyncedAt`, read from the chain rather than summed from the
   * synced transfers: a transfer we failed to import must not silently move the
   * portfolio. Empty until the first successful sync.
   */
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  balances: CryptoWalletBalance[];

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'connected_by_user_id' })
  connectedByUser: User | null;

  @Column({ name: 'connected_by_user_id', type: 'uuid', nullable: true })
  connectedByUserId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

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
import { BalanceAccount } from './balance-account.entity';
import { Workspace } from './workspace.entity';

/** Crypto is deliberately absent: coins live in `crypto_wallets`, nowhere else. */
export enum InvestmentAssetClass {
  STOCK = 'stock',
  ETF = 'etf',
  FUND = 'fund',
  BOND = 'bond',
  CASH = 'cash',
  REAL_ESTATE = 'real_estate',
  /** Physical gold, silver, platinum or palladium: priced per fine troy ounce. */
  METAL = 'metal',
  OTHER = 'other',
}

/** The four metals with an ISO 4217 code and a public spot quote. */
export enum InvestmentMetal {
  GOLD = 'XAU',
  SILVER = 'XAG',
  PLATINUM = 'XPT',
  PALLADIUM = 'XPD',
}

export enum MetalWeightUnit {
  GRAM = 'g',
  TROY_OUNCE = 'ozt',
  KILOGRAM = 'kg',
}

export enum InvestmentPriceSource {
  MANUAL = 'manual',
  AUTO = 'auto',
}

/**
 * One position in an investment or retirement account: a quantity at a price.
 * The account's value on the balance sheet is the sum of its holdings, written
 * as a balance snapshot whenever a holding or a price changes, so net worth
 * and the balance sheet never disagree with this table.
 */
@Entity('investment_holdings')
@Index('IDX_investment_holdings_workspace_account', ['workspaceId', 'accountId'])
export class InvestmentHolding {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  @ManyToOne(() => BalanceAccount, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'account_id' })
  account: BalanceAccount;

  @Column({ name: 'account_id', type: 'uuid' })
  accountId: string;

  /** Ticker as the price source knows it (AAPL.US, VWCE.DE, BTC); null for a manual line. */
  @Column({ type: 'varchar', length: 32, nullable: true })
  symbol: string | null;

  @Column({ length: 255 })
  name: string;

  @Column({
    name: 'asset_class',
    type: 'enum',
    enum: InvestmentAssetClass,
    enumName: 'investment_asset_class_enum',
    default: InvestmentAssetClass.OTHER,
  })
  assetClass: InvestmentAssetClass;

  /** Shares for a security; for a metal lot, how many pieces it holds. */
  @Column({ type: 'decimal', precision: 24, scale: 8, default: 0 })
  quantity: number;

  @Column({ type: 'decimal', precision: 20, scale: 6, default: 0 })
  price: number;

  @Column({ name: 'price_currency', length: 10, default: 'USD' })
  priceCurrency: string;

  @Column({
    name: 'price_source',
    type: 'enum',
    enum: InvestmentPriceSource,
    enumName: 'investment_price_source_enum',
    default: InvestmentPriceSource.MANUAL,
  })
  priceSource: InvestmentPriceSource;

  /** The day the price is quoted for; a metal lot shows it as "price from ...". */
  @Column({ name: 'priced_at', type: 'timestamptz', nullable: true })
  pricedAt: Date | null;

  // ---------------------------------------------------------------------------
  // A metal lot. Null on every other asset class. `price` holds the spot price
  // of one fine troy ounce, so the lot is worth
  // `quantity × unitWeight (in troy ounces) × purity × price`. The fine weight
  // is never stored: it is derived wherever it is needed, so a corrected purity
  // cannot leave a stale second number behind.
  // ---------------------------------------------------------------------------

  @Column({
    type: 'enum',
    enum: InvestmentMetal,
    enumName: 'investment_metal_enum',
    nullable: true,
  })
  metal: InvestmentMetal | null;

  /** Gross weight of one piece, in `weightUnit`. */
  @Column({ name: 'unit_weight', type: 'decimal', precision: 16, scale: 6, nullable: true })
  unitWeight: number | null;

  @Column({
    name: 'weight_unit',
    type: 'enum',
    enum: MetalWeightUnit,
    enumName: 'metal_weight_unit_enum',
    nullable: true,
  })
  weightUnit: MetalWeightUnit | null;

  /** Fineness as a fraction: 0.9999 for a bar, 0.9167 for a Krugerrand. */
  @Column({ type: 'decimal', precision: 6, scale: 5, nullable: true })
  purity: number | null;

  @Column({ name: 'acquired_on', type: 'date', nullable: true })
  acquiredOn: string | null;

  /** What the lot cost in total, premium, tax and shipping included. */
  @Column({ name: 'cost_total', type: 'decimal', precision: 20, scale: 6, nullable: true })
  costTotal: number | null;

  @Column({ name: 'cost_currency', type: 'varchar', length: 10, nullable: true })
  costCurrency: string | null;

  /** Who it was bought from; kept because people sell back to the same dealer. */
  @Column({ type: 'varchar', length: 255, nullable: true })
  counterparty: string | null;

  /** File name under the metal-photos directory; the lot as it looks. */
  @Column({ name: 'photo_file', type: 'varchar', length: 255, nullable: true })
  photoFile: string | null;

  /** Free text: "safe", "bank vault 12", "the one at my mother's". */
  @Column({ name: 'storage_location', type: 'varchar', length: 255, nullable: true })
  storageLocation: string | null;

  /** What the lot is insured for, which is rarely what it is worth. */
  @Column({ name: 'insured_value', type: 'decimal', precision: 20, scale: 6, nullable: true })
  insuredValue: number | null;

  @Column({ name: 'insured_currency', type: 'varchar', length: 10, nullable: true })
  insuredCurrency: string | null;

  /** The receipt that proves the purchase; survives the receipt being deleted. */
  @Column({ name: 'receipt_id', type: 'uuid', nullable: true })
  receiptId: string | null;

  /**
   * Whose metal it is. A tax return belongs to a person, not to a workspace:
   * two members selling their own gold do not share one allowance. NULL where
   * nobody has said, and nothing guesses.
   */
  @Column({ name: 'owner_user_id', type: 'uuid', nullable: true })
  ownerUserId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

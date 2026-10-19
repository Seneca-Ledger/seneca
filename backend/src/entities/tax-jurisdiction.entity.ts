import { Column, Entity, Index, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { TaxJurisdictionRate } from './tax-jurisdiction-rate.entity';

export enum TaxScheme {
  /** Value-added tax: output tax minus input tax, the model this engine implements. */
  VAT = 'vat',
  /** Goods and services tax. Mechanically VAT for our purposes. */
  GST = 'gst',
  /** US-style sales tax: rate depends on the buyer's state/county, no input credit. */
  SALES_TAX = 'sales_tax',
  NONE = 'none',
}

export enum TaxFilingPeriod {
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  ANNUAL = 'annual',
}

export enum TaxThresholdPeriod {
  CALENDAR_YEAR = 'calendar_year',
  ROLLING_12M = 'rolling_12m',
}

/**
 * Global reference data, deliberately NOT workspace-scoped.
 *
 * This is the one documented exception to the tenant-isolation rule in
 * `.claude/rules/security.md`: rows are readable by every workspace and are
 * written only by migrations, never by request handlers.
 */
@Entity('tax_jurisdictions')
export class TaxJurisdiction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** ISO-3166-1 alpha-2. */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 2 })
  code: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  /** Local name of the tax, shown in the UI: 'НДС', 'USt', 'VAT'. */
  @Column({ name: 'tax_name', type: 'varchar', length: 40 })
  taxName: string;

  /** Currency the return is filed in. */
  @Column({ type: 'varchar', length: 3 })
  currency: string;

  @Column({ type: 'varchar', length: 20, default: TaxScheme.VAT })
  scheme: TaxScheme;

  /** Drives reverse-charge eligibility for cross-border B2B. */
  @Column({ name: 'is_eu', type: 'boolean', default: false })
  isEu: boolean;

  @Column({
    name: 'filing_period',
    type: 'varchar',
    length: 20,
    default: TaxFilingPeriod.QUARTERLY,
  })
  filingPeriod: TaxFilingPeriod;

  /**
   * Turnover above which registration becomes mandatory, in `currency`.
   * NULL means "no threshold, or indexed to a value we do not track" — the
   * KZ threshold for instance is denominated in MRP and re-set every year.
   */
  @Column({
    name: 'registration_threshold',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  registrationThreshold: number | null;

  @Column({ name: 'threshold_period', type: 'varchar', length: 20, nullable: true })
  thresholdPeriod: TaxThresholdPeriod | null;

  @OneToMany(
    () => TaxJurisdictionRate,
    rate => rate.jurisdiction,
  )
  rates: TaxJurisdictionRate[];
}

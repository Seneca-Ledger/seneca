import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { TaxJurisdiction } from './tax-jurisdiction.entity';

export enum TaxRateKind {
  STANDARD = 'standard',
  REDUCED = 'reduced',
  ZERO = 'zero',
  EXEMPT = 'exempt',
}

/**
 * Reference catalogue of statutory rates, versioned in time.
 *
 * The versioning is the point: KZ VAT moves from 12% to 16% on 2026-01-01, and
 * a return filed for 2025 must keep using 12%. Rows are never updated in place
 * when the law changes — the current row gets a `validTo` and a new row opens.
 */
@Entity('tax_jurisdiction_rates')
@Index(['jurisdictionId', 'code', 'validFrom'], { unique: true })
export class TaxJurisdictionRate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(
    () => TaxJurisdiction,
    jurisdiction => jurisdiction.rates,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'jurisdiction_id' })
  jurisdiction: TaxJurisdiction;

  @Column({ name: 'jurisdiction_id', type: 'uuid' })
  jurisdictionId: string;

  /**
   * Stable identity across versions, e.g. 'KZ_STANDARD'. The 12% row and the
   * 16% row share this code; only `validFrom` differs.
   */
  @Column({ type: 'varchar', length: 40 })
  code: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  rate: number;

  @Column({ type: 'varchar', length: 20, default: TaxRateKind.STANDARD })
  kind: TaxRateKind;

  /** The default rate for this jurisdiction at a given point in time. */
  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault: boolean;

  @Column({ name: 'valid_from', type: 'date' })
  validFrom: string;

  /** NULL means "still in force". */
  @Column({ name: 'valid_to', type: 'date', nullable: true })
  validTo: string | null;
}

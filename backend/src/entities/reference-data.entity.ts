import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Public reference data fetched from official or open sources and kept so a
 * request never waits on them: public holidays (OpenHolidays) and EU VAT
 * rates (the Commission's TEDB). Shared by every workspace — nothing in it
 * belongs to a tenant.
 */
@Entity('reference_data')
@Index(['source', 'key'], { unique: true })
export class ReferenceData {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Where it came from, e.g. `openholidays` or `tedb`. */
  @Column({ type: 'varchar', length: 40 })
  source: string;

  /** What it is within the source, e.g. `DE:2027` or `AT`. */
  @Column({ type: 'varchar', length: 80 })
  key: string;

  @Column({ type: 'jsonb' })
  payload: unknown;

  @Column({ name: 'fetched_at', type: 'timestamptz' })
  fetchedAt: Date;
}

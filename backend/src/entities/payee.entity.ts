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
import { Category } from './category.entity';
import { Workspace } from './workspace.entity';

/** How a payee's category is decided, the three choices YNAB offers. */
export enum PayeeMode {
  /** Follow the payee's own history ("two of the last three"). */
  AUTO = 'auto',
  /** Always this category, whatever the history says. */
  ALWAYS = 'always',
  /** Never categorise this payee; its rows wait in Review. */
  NEVER = 'never',
}

/**
 * Who a transaction was paid to or received from, as the user knows them:
 * "Railway Corporation", not "RAILWAY*USAGE 4711 SAN FRANCISCO". Every raw
 * descriptor that means this payee points here through a `PayeeAlias`, so
 * renaming or merging payees never touches the descriptors themselves.
 */
@Entity('payees')
export class Payee {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @Column({ name: 'workspace_id', type: 'uuid' })
  @Index()
  workspaceId: string;

  /** What the user sees; starts as the descriptor the payee was first seen as. */
  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'enum', enum: PayeeMode, enumName: 'payees_mode_enum', default: PayeeMode.AUTO })
  mode: PayeeMode;

  // SET NULL rather than CASCADE: deleting a category drops the pin, not the payee.
  @ManyToOne(() => Category, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'category_id' })
  category: Category | null;

  /** The pinned category, read only when `mode` is `always`. */
  @Column({ name: 'category_id', type: 'uuid', nullable: true })
  categoryId: string | null;

  /** ISO-3166-1 alpha-2 of the payee's seat, when the user has said. */
  @Column({ name: 'country_code', type: 'varchar', length: 2, nullable: true })
  countryCode: string | null;

  /**
   * The payee's VAT number. With a country in another EU state, it is what
   * makes a purchase from them reverse-charged.
   */
  @Column({ name: 'vat_id', type: 'varchar', length: 32, nullable: true })
  vatId: string | null;

  /**
   * What the EU's VIES service last said about `vatId`: `valid`, `invalid`,
   * or NULL when it was not asked or could not answer. An invalid number does
   * not make a purchase reverse-charged.
   */
  @Column({ name: 'vat_id_status', type: 'varchar', length: 16, nullable: true })
  vatIdStatus: 'valid' | 'invalid' | null;

  @Column({ name: 'vat_id_checked_at', type: 'timestamptz', nullable: true })
  vatIdCheckedAt: Date | null;

  /** The name the member state registered the number to, as VIES returned it. */
  @Column({ name: 'vat_id_name', type: 'varchar', length: 255, nullable: true })
  vatIdName: string | null;

  /**
   * Whether the payee supplies goods or services, when the user has said. A
   * cross-border reverse charge goes on different lines of the German VAT
   * return for each: an intra-Community acquisition or supply for goods, a
   * § 13b service or a non-taxable service for services.
   */
  @Column({ name: 'supply_type', type: 'varchar', length: 16, nullable: true })
  supplyType: 'goods' | 'services' | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

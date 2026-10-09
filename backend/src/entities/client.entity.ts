import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Workspace } from './workspace.entity';

/** Someone an invoice is billed to. */
@Entity('clients')
@Index('IDX_clients_workspace_name', ['workspaceId', 'name'])
export class Client {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({ name: 'billing_address', type: 'text', nullable: true })
  billingAddress: string | null;

  @Column({ name: 'tax_id', type: 'varchar', length: 64, nullable: true })
  taxId: string | null;

  /** Currency invoices to this client are denominated in by default. */
  @Column({ type: 'varchar', length: 3 })
  currency: string;

  /** Language the documents sent to this client are written in. */
  @Column({ type: 'varchar', length: 10, nullable: true })
  locale: string | null;

  /**
   * Whether this client is chased about unpaid invoices. On by default, but
   * the workspace switch is off, so nothing is sent until it is turned on —
   * and the clients who always pay on time can be left out of it.
   */
  @Column({ name: 'reminders_enabled', type: 'boolean', default: true })
  remindersEnabled: boolean;

  /**
   * Days from issue to due for this client — "net 30". NULL follows the
   * workspace's own term, which is what most clients do.
   */
  @Column({ name: 'payment_terms_days', type: 'int', nullable: true })
  paymentTermsDays: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}

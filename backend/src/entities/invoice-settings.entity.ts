import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { Workspace } from './workspace.entity';

/** Offsets in days from the due date: negative before it, positive after. */
export const DEFAULT_REMINDER_OFFSETS = [-3, 0, 7, 14] as const;

/** Net 14 unless the workspace or the client says otherwise. */
export const DEFAULT_PAYMENT_TERMS_DAYS = 14;

/**
 * How a workspace invoices: when it expects to be paid, what it charges for
 * being paid late, and whether it chases.
 *
 * Reminders are off by default, deliberately. Chasing is the most asked-for
 * thing in invoicing and the second most complained-about: the loudest threads
 * are not about missing reminders but about a vendor mailing someone's clients
 * without being asked. So the workspace opts in, and each client can be left
 * out.
 */
@Entity('invoice_settings')
export class InvoiceSettings {
  @PrimaryColumn({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @Column({ name: 'reminders_enabled', type: 'boolean', default: false })
  remindersEnabled: boolean;

  @Column({ name: 'reminder_offsets', type: 'jsonb', default: () => `'[-3, 0, 7, 14]'::jsonb` })
  reminderOffsets: number[];

  /** Days from the issue date to the due date, when a client has no own term. */
  @Column({ name: 'payment_terms_days', type: 'int', default: DEFAULT_PAYMENT_TERMS_DAYS })
  paymentTermsDays: number;

  /**
   * What late payment costs, in percent of the overdue total. Charged as an
   * ordinary line on a new invoice when the user asks for it — never added
   * silently to an issued document.
   */
  @Column({ name: 'late_fee_percent', type: 'decimal', precision: 5, scale: 2, default: 0 })
  lateFeePercent: number;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

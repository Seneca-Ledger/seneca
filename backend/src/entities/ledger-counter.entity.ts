import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Workspace } from './workspace.entity';

/**
 * Next journal entry number per workspace. Postgres sequences are global, so
 * the number is taken by incrementing this row inside the posting
 * transaction; the row lock serialises posting within one workspace only.
 */
@Entity('ledger_counters')
export class LedgerCounter {
  @PrimaryColumn({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  /** bigint comes back from the driver as a string. */
  @Column({ name: 'next_entry_no', type: 'bigint', default: 1 })
  nextEntryNo: string;
}

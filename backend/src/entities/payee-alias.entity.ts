import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Payee } from './payee.entity';

/**
 * "This descriptor means that payee": the memory YNAB keeps when you change the
 * payee of an imported transaction. Keyed by the normalised payee key, so the
 * next import of the same shop with a new terminal number lands on the same
 * payee.
 */
@Entity('payee_aliases')
export class PayeeAlias {
  @PrimaryColumn({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  @PrimaryColumn({ name: 'payee_key', type: 'text' })
  payeeKey: string;

  @ManyToOne(() => Payee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'payee_id' })
  payee: Payee;

  @Column({ name: 'payee_id', type: 'uuid' })
  payeeId: string;
}

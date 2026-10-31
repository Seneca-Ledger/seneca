import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { Payable } from './payable.entity';
import { Transaction } from './transaction.entity';
import { Workspace } from './workspace.entity';

/**
 * The picture of what a transaction or a bill was for: the Mac mini that was
 * sold, the sofa that was bought. Exactly one of the two is set; a bill and the
 * transaction that settled it show each other's picture when they have none of
 * their own, so it is stored once, on whichever the person picked it from.
 */
@Entity('item_images')
export class ItemImage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Relation<Workspace>;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  @ManyToOne(() => Transaction, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'transaction_id' })
  transaction: Relation<Transaction | null>;

  @Column({ name: 'transaction_id', type: 'uuid', nullable: true })
  transactionId: string | null;

  @ManyToOne(() => Payable, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'payable_id' })
  payable: Relation<Payable | null>;

  @Column({ name: 'payable_id', type: 'uuid', nullable: true })
  payableId: string | null;

  /** A fresh uuid name under uploads/item-images, never anything from upstream. */
  @Column({ name: 'file_name', type: 'varchar', length: 64 })
  fileName: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  label: string | null;

  @Column({ name: 'wikidata_id', type: 'varchar', length: 16, nullable: true })
  wikidataId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

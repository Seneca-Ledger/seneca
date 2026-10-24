import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { Receipt } from './receipt.entity';
import { Statement } from './statement.entity';
import { Transaction } from './transaction.entity';
import { Workspace } from './workspace.entity';

@Entity('tags')
export class Tag {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'varchar', nullable: true })
  color: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  /** A day the tag stands for (a trip, an event), YYYY-MM-DD. */
  @Column({ name: 'tag_date', type: 'date', nullable: true })
  tagDate: string | null;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToMany(
    () => Statement,
    statement => statement.tags,
  )
  statements: Statement[];

  @ManyToMany(
    () => Transaction,
    transaction => transaction.tags,
  )
  transactions: Transaction[];

  // By name, not class: importing receipt.entity here would close a cycle
  // (statement → tag → receipt → statement) and leave StatementStage undefined
  // while receipt.entity's column defaults are evaluated.
  @ManyToMany('Receipt', (receipt: Receipt) => receipt.tags)
  receipts: Receipt[];
}

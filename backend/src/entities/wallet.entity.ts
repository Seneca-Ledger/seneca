import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  type Relation,
  UpdateDateColumn,
} from 'typeorm';
import { Transaction } from './transaction.entity';
import { User } from './user.entity';
import { Workspace } from './workspace.entity';
import { WorkspaceMember } from './workspace-member.entity';

@Entity('wallets')
export class Wallet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(
    () => User,
    user => user.wallets,
  )
  @JoinColumn({ name: 'user_id' })
  user: Relation<User>;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Relation<Workspace>;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  @Column()
  name: string;

  @Column({ type: 'varchar', name: 'account_number', nullable: true })
  accountNumber: string | null;

  @Column({ type: 'varchar', name: 'bank_name', nullable: true })
  bankName: string | null;

  @Column()
  currency: string;

  @Column({ name: 'initial_balance', type: 'decimal', precision: 15, scale: 2, default: 0 })
  initialBalance: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  /**
   * Whose account this is in the household; NULL means shared. Transactions
   * imported into the wallet start with the same owner.
   */
  @ManyToOne(() => WorkspaceMember, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'owner_member_id' })
  ownerMember: Relation<WorkspaceMember | null>;

  @Column({ name: 'owner_member_id', type: 'uuid', nullable: true })
  ownerMemberId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @OneToMany(
    () => Transaction,
    transaction => transaction.wallet,
  )
  transactions: Relation<Transaction[]>;
}

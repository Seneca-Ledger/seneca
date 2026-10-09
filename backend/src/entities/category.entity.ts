import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Transaction } from './transaction.entity';
import { User } from './user.entity';
import { Workspace } from './workspace.entity';

export enum CategoryType {
  INCOME = 'income',
  EXPENSE = 'expense',
}

export enum CategorySource {
  SYSTEM = 'system',
  USER = 'user',
  PARSING = 'parsing',
}

/**
 * How a category's spending is judged on the Budgets page and in the Stoic
 * advice: what life requires, what the work requires, what makes a person
 * better or helps others, and what is merely pleasant.
 */
export enum StoicClass {
  NECESSITY = 'necessity',
  WORK = 'work',
  VIRTUE = 'virtue',
  LEISURE = 'leisure',
}

@Entity('categories')
// One fallback category per workspace and type (migration 1786810000000).
@Index('UQ_categories_uncategorized', ['workspaceId', 'type'], {
  unique: true,
  where: "name = 'Uncategorized' AND parent_id IS NULL",
})
// Where private rows are counted, one per workspace and type (migration 1787010000000).
@Index('UQ_categories_private', ['workspaceId', 'type'], {
  unique: true,
  where: "name = 'Private' AND parent_id IS NULL",
})
export class Category {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(
    () => User,
    user => user.categories,
    { nullable: true },
  )
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  @Column()
  name: string;

  @Column({
    type: 'enum',
    enum: CategoryType,
  })
  type: CategoryType;

  @ManyToOne(
    () => Category,
    category => category.children,
    { nullable: true },
  )
  @JoinColumn({ name: 'parent_id' })
  parent: Category | null;

  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  parentId: string | null;

  @Column({ name: 'is_system', default: false })
  isSystem: boolean;

  @Column({ type: 'varchar', default: CategorySource.USER })
  source: CategorySource;

  @Column({ name: 'is_enabled', default: true })
  isEnabled: boolean;

  @Column({ nullable: true })
  color: string;

  @Column({ nullable: true })
  icon: string | null;

  /**
   * Set only by the user. Null means "not decided yet": the Stoic ledger then
   * falls back to a suggestion computed from the name (see stoic-classifier).
   */
  @Column({ name: 'stoic_class', type: 'varchar', length: 16, nullable: true })
  stoicClass: StoicClass | null;

  /**
   * Whether this spending is help given to others — charity, donations,
   * gifts. Null means the user has not said; the Stoic advice then guesses
   * from the name (see suggestHelpsOthers).
   */
  @Column({ name: 'helps_others', type: 'boolean', nullable: true })
  helpsOthers: boolean | null;

  /**
   * The income or expense account this category books to. Set on root
   * categories when the chart is seeded; a child without one books to its
   * parent's account.
   */
  @Column({ name: 'ledger_account_id', type: 'uuid', nullable: true })
  ledgerAccountId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @OneToMany(
    () => Category,
    category => category.parent,
  )
  children: Category[];

  @OneToMany(
    () => Transaction,
    transaction => transaction.category,
  )
  transactions: Transaction[];
}

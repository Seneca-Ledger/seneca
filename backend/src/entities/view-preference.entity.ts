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
import { User } from './user.entity';
import { Workspace } from './workspace.entity';

/**
 * How one person left one page, so it comes back the way they left it.
 *
 * Deliberately not `storage_views`, which holds views a user named and saved on
 * purpose. This is the opposite: nothing is named, nothing is chosen, the page
 * simply remembers the filter you set a minute ago instead of resetting to
 * "everyone, every currency" on the next load.
 *
 * Per user and per workspace: two people sharing a household each keep their
 * own view of it, and the same person keeps a different one per workspace.
 */
@Entity('view_preferences')
@Index('UQ_view_preferences_scope', ['userId', 'workspaceId', 'scope'], { unique: true })
export class ViewPreference {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  /** Which page: `transactions`, `review`, `reports`, `dashboard`. */
  @Column({ type: 'varchar', length: 64 })
  scope: string;

  /**
   * Whatever that page wants back. The shape belongs to the page, not here —
   * the server never reads inside it, so a page can change its own mind without
   * a migration.
   */
  @Column({ type: 'jsonb' })
  state: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

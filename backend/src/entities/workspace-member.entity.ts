import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Workspace } from './workspace.entity';

export enum WorkspaceRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MEMBER = 'member',
  VIEWER = 'viewer',
  /**
   * The tax adviser or bookkeeper: reads everything a viewer reads and may take
   * exports away (tax pack, DATEV, returns), but changes nothing.
   */
  ACCOUNTANT = 'accountant',
}

export type WorkspaceMemberPermissions = {
  canEditStatements?: boolean;
  canEditCustomTables?: boolean;
  canEditCategories?: boolean;
  canEditDataEntry?: boolean;
  canShareFiles?: boolean;
};

@Entity('workspace_members')
@Unique(['workspaceId', 'userId'])
export class WorkspaceMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  @ManyToOne(
    () => Workspace,
    workspace => workspace.members,
    {
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({ name: 'workspace_id' })
  workspace: Relation<Workspace>;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(
    () => User,
    user => user.workspaceMemberships,
    {
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({ name: 'user_id' })
  user: Relation<User>;

  @Column({
    name: 'role',
    type: 'varchar',
    length: 16,
    default: WorkspaceRole.MEMBER,
  })
  role: WorkspaceRole;

  @Column({ name: 'permissions', type: 'jsonb', nullable: true })
  permissions: WorkspaceMemberPermissions | null;

  @Column({ name: 'last_accessed_at', type: 'timestamp', nullable: true })
  lastAccessedAt: Date | null;

  @Column({ name: 'access_count', type: 'int', default: 0 })
  accessCount: number;

  @Column({ name: 'invited_by_id', type: 'uuid', nullable: true })
  invitedById: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'invited_by_id' })
  invitedBy: Relation<User | null>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

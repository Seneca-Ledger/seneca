import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Workspace } from './workspace.entity';
import { type WorkspaceMemberPermissions, WorkspaceRole } from './workspace-member.entity';

export enum WorkspaceInvitationStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
}

@Entity('workspace_invitations')
@Unique(['token'])
export class WorkspaceInvitation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @Column({ type: 'varchar' })
  email: string;

  @Column({
    type: 'varchar',
    default: WorkspaceRole.MEMBER,
  })
  role: WorkspaceRole;

  @Column({ name: 'permissions', type: 'jsonb', nullable: true })
  permissions: WorkspaceMemberPermissions | null;

  @Column({ type: 'varchar', unique: true })
  token: string;

  @Column({
    type: 'varchar',
    default: WorkspaceInvitationStatus.PENDING,
  })
  status: WorkspaceInvitationStatus;

  @Column({ name: 'invited_by_id', type: 'uuid', nullable: true })
  invitedById: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'invited_by_id' })
  invitedBy: User | null;

  @Column({ name: 'expires_at', type: 'timestamp', nullable: true })
  expiresAt: Date | null;

  @Column({ name: 'accepted_at', type: 'timestamp', nullable: true })
  acceptedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

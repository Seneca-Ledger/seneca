import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../../entities/user.entity';
import { Workspace } from '../../../entities/workspace.entity';

@Entity('api_keys')
@Index('IDX_api_keys_key_hash', ['keyHash'], { unique: true })
@Index('IDX_api_keys_workspace_id', ['workspaceId'])
export class ApiKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ name: 'key_hash', type: 'varchar', length: 64 })
  keyHash: string;

  @Column({ type: 'varchar', length: 8 })
  prefix: string;

  @Column({ name: 'last_used_at', type: 'timestamptz', nullable: true, default: null })
  lastUsedAt: Date | null;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true, default: null })
  expiresAt: Date | null;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true, default: null })
  revokedAt: Date | null;

  /** Permission strings the key is limited to; null = the owner's full reach (keys made before scopes). */
  @Column({ type: 'jsonb', nullable: true, default: null })
  scopes: string[] | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

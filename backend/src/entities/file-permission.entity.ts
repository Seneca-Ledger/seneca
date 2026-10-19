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
import { Statement } from './statement.entity';
import { User } from './user.entity';

export enum FilePermissionType {
  OWNER = 'owner',
  EDITOR = 'editor',
  VIEWER = 'viewer',
  DOWNLOADER = 'downloader',
}

/**
 * FilePermission entity for managing access rights to statements
 * Allows granular control over who can view, edit, or download files
 */
@Entity('file_permissions')
@Unique(['statementId', 'userId'])
export class FilePermission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'statement_id', type: 'uuid' })
  statementId: string;

  @ManyToOne(() => Statement, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'statement_id' })
  statement: Statement;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  // Granted by user (who shared the file)
  @Column({ name: 'granted_by_id', type: 'uuid' })
  grantedById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'granted_by_id' })
  grantedBy: User;

  // Permission type
  @Column({
    name: 'permission_type',
    type: 'enum',
    enum: FilePermissionType,
    default: FilePermissionType.VIEWER,
  })
  permissionType: FilePermissionType;

  // Can share with others
  @Column({ name: 'can_reshare', default: false })
  canReshare: boolean;

  // Permission expiration (optional)
  @Column({ name: 'expires_at', type: 'timestamp', nullable: true })
  expiresAt: Date | null;

  // Is permission currently active
  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

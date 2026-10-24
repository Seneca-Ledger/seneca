import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
  UpdateDateColumn,
} from 'typeorm';
import { Statement } from './statement.entity';
import { User } from './user.entity';

export enum SharePermissionLevel {
  VIEW = 'view',
  DOWNLOAD = 'download',
  EDIT = 'edit',
}

export enum ShareLinkStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  REVOKED = 'revoked',
}

/**
 * SharedLink entity for file sharing
 * Allows users to share statements with others via unique links
 */
@Entity('shared_links')
export class SharedLink {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'statement_id', type: 'uuid' })
  statementId: string;

  @ManyToOne(() => Statement, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'statement_id' })
  statement: Relation<Statement>;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: Relation<User>;

  // Unique token for accessing the shared file
  @Column({ unique: true, length: 64 })
  token: string;

  // Permission level for the shared link
  @Column({
    type: 'varchar',
    length: 20,
    default: SharePermissionLevel.VIEW,
  })
  permission: SharePermissionLevel;

  // Link expiration date (optional)
  @Column({ name: 'expires_at', type: 'timestamp', nullable: true })
  expiresAt: Date | null;

  // Password protection (optional, hashed)
  @Column({ type: 'varchar', nullable: true })
  password: string | null;

  // Link status
  @Column({
    type: 'varchar',
    length: 20,
    default: ShareLinkStatus.ACTIVE,
  })
  status: ShareLinkStatus;

  // Track access count
  @Column({ name: 'access_count', default: 0 })
  accessCount: number;

  // Last access timestamp
  @Column({ name: 'last_accessed_at', type: 'timestamp', nullable: true })
  lastAccessedAt: Date | null;

  // Allow anyone with link to access
  @Column({ name: 'allow_anonymous', default: true })
  allowAnonymous: boolean;

  // Share description/note
  @Column({ type: 'text', nullable: true })
  description: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

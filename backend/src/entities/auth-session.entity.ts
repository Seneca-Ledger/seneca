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

@Entity('auth_sessions')
@Index('IDX_auth_sessions_user_id', ['userId'])
@Index('IDX_auth_sessions_user_revoked_at', ['userId', 'revokedAt'])
@Index('UQ_auth_sessions_refresh_token_hash', ['refreshTokenHash'], { unique: true })
export class AuthSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'refresh_token_hash', type: 'varchar', length: 128 })
  refreshTokenHash: string;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent: string | null;

  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress: string | null;

  @Column({ name: 'device', type: 'varchar', length: 64, default: 'Unknown device' })
  device: string;

  @Column({ name: 'browser', type: 'varchar', length: 64, default: 'Unknown browser' })
  browser: string;

  @Column({ name: 'os', type: 'varchar', length: 64, default: 'Unknown OS' })
  os: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'last_used_at', type: 'timestamp', default: () => 'now()' })
  lastUsedAt: Date;

  @Column({ name: 'revoked_at', type: 'timestamp', nullable: true })
  revokedAt: Date | null;
}

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';

/**
 * A single-use password reset grant.
 *
 * Only the HMAC of the token is stored: whoever can read this table must not be
 * able to reset anyone's password with what they find there. The plaintext half
 * exists exactly once, in the email.
 */
@Entity('password_reset_tokens')
@Index('IDX_password_reset_tokens_user_id', ['userId'])
@Index('UQ_password_reset_tokens_token_hash', ['tokenHash'], { unique: true })
export class PasswordResetToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'token_hash', type: 'varchar', length: 128 })
  tokenHash: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  /** Set the moment the token is spent, so a replay finds it already used. */
  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  usedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

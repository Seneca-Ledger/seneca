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
 * A pending email change, confirmed by a link sent to the *new* address.
 *
 * The address lives on the token rather than on the user row: until the owner
 * of the new mailbox proves they can read it, nothing about the account
 * changes, and an abandoned request leaves no trace on the user.
 */
@Entity('email_change_tokens')
@Index('IDX_email_change_tokens_user_id', ['userId'])
@Index('UQ_email_change_tokens_token_hash', ['tokenHash'], { unique: true })
export class EmailChangeToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'new_email', type: 'varchar', length: 320 })
  newEmail: string;

  @Column({ name: 'token_hash', type: 'varchar', length: 128 })
  tokenHash: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  usedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

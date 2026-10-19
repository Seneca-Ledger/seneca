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
 * That a user accepted a given revision of the tax-declaration disclaimer.
 *
 * One row per revision rather than two columns on `users`: the history of what
 * was accepted, and when, stays intact when the wording changes.
 */
@Entity('income_tax_disclaimer_acceptances')
@Index('UQ_income_tax_disclaimer_acceptances_version', ['userId', 'version'], { unique: true })
export class IncomeTaxDisclaimerAcceptance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 20 })
  version: string;

  @CreateDateColumn({ name: 'accepted_at', type: 'timestamptz' })
  acceptedAt: Date;
}

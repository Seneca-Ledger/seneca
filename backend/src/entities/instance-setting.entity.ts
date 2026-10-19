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

export enum InstanceSettingKey {
  /** The bot every workspace without its own token uses. */
  TELEGRAM = 'telegram',
}

/**
 * Settings of the whole server rather than of a workspace. Only instance
 * administrators change them, and no workspace backup carries them.
 */
@Entity('instance_settings')
@Unique('UQ_instance_settings_key', ['key'])
export class InstanceSetting {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 64 })
  key: InstanceSettingKey;

  @Column({ name: 'encrypted_secrets', type: 'jsonb', default: () => "'{}'::jsonb" })
  encryptedSecrets: Record<string, string>;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'updated_by_user_id' })
  updatedByUser: User | null;

  @Column({ name: 'updated_by_user_id', type: 'uuid', nullable: true })
  updatedByUserId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

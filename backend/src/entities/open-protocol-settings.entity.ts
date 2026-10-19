import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Integration } from './integration.entity';

@Entity('open_protocol_settings')
export class OpenProtocolSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(
    () => Integration,
    integration => integration.openProtocolSettings,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'integration_id' })
  integration: Integration;

  @Column({ name: 'integration_id', type: 'uuid' })
  integrationId: string;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  config: Record<string, unknown>;

  @Column({ name: 'encrypted_secrets', type: 'jsonb', default: () => "'{}'::jsonb" })
  encryptedSecrets: Record<string, string>;

  @Column({ name: 'last_sync_at', type: 'timestamp', nullable: true })
  lastSyncAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

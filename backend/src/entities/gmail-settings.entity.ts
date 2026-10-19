import { Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Integration } from './integration.entity';

@Entity('gmail_settings')
export class GmailSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'integration_id', type: 'uuid', unique: true })
  integrationId: string;

  @OneToOne(() => Integration)
  @JoinColumn({ name: 'integration_id' })
  integration: Integration;

  @Column({ name: 'label_id', nullable: true })
  labelId: string;

  /** Set on connect from the product name (APP_NAME), so the column has no default. */
  @Column({ name: 'label_name' })
  labelName: string;

  @Column({ name: 'filter_enabled', default: true })
  filterEnabled: boolean;

  @Column({ type: 'jsonb', nullable: true, name: 'filter_config' })
  filterConfig: {
    subjects?: string[];
    senders?: string[];
    hasAttachment?: boolean;
    keywords?: string[];
  };

  @Column({ name: 'watch_enabled', default: false })
  watchEnabled: boolean;

  @Column({ name: 'watch_expiration', type: 'timestamp', nullable: true })
  watchExpiration: Date | null;

  @Column({ name: 'last_sync_at', type: 'timestamp', nullable: true })
  lastSyncAt: Date | null;

  @Column({ type: 'varchar', name: 'history_id', nullable: true })
  historyId: string | null;
}

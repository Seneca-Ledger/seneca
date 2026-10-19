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

@Entity('drive_settings')
export class DriveSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(
    () => Integration,
    integration => integration.driveSettings,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'integration_id' })
  integration: Integration;

  @Column({ name: 'integration_id', type: 'uuid' })
  integrationId: string;

  @Column({ name: 'folder_id', type: 'varchar', nullable: true })
  folderId: string | null;

  @Column({ name: 'folder_name', type: 'varchar', nullable: true })
  folderName: string | null;

  @Column({ name: 'sync_enabled', type: 'boolean', default: true })
  syncEnabled: boolean;

  @Column({ name: 'sync_time', type: 'varchar', length: 5, default: '03:00' })
  syncTime: string;

  @Column({ name: 'time_zone', type: 'varchar', length: 64, nullable: true })
  timeZone: string | null;

  @Column({ name: 'last_sync_at', type: 'timestamp', nullable: true })
  lastSyncAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

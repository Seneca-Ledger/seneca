import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import type { BackupPasswordEnvelope } from '../modules/backups/backup-archive.service';
import { BackupRun } from './backup-run.entity';
import { Workspace } from './workspace.entity';

export enum BackupDestinationKind {
  NEXTCLOUD = 'nextcloud',
  LOCAL = 'local',
}

@Entity('backup_configurations')
@Unique('UQ_backup_configurations_workspace', ['workspaceId'])
export class BackupConfiguration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @Column({ name: 'destination_kind', type: 'varchar', length: 16 })
  destinationKind: BackupDestinationKind;

  @Column({ name: 'destination_path', type: 'varchar', length: 255, default: '' })
  destinationPath: string;

  @Column({ name: 'daily_time', type: 'varchar', length: 5, default: '03:00' })
  dailyTime: string;

  @Column({ name: 'time_zone', type: 'varchar', length: 64, default: 'UTC' })
  timeZone: string;

  @Column({ name: 'retention_count', type: 'int', default: 7 })
  retentionCount: number;

  @Column({ default: true })
  enabled: boolean;

  @Column({ name: 'encrypted_data_key', type: 'text' })
  encryptedDataKey: string;

  @Column({ name: 'password_envelope', type: 'jsonb' })
  passwordEnvelope: BackupPasswordEnvelope;

  @Column({ name: 'last_successful_at', type: 'timestamptz', nullable: true })
  lastSuccessfulAt: Date | null;

  @OneToMany(
    () => BackupRun,
    run => run.configuration,
  )
  runs: BackupRun[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

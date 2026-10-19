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
import { BackupConfiguration } from './backup-configuration.entity';
import { Workspace } from './workspace.entity';

export enum BackupRunStatus {
  RUNNING = 'running',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
}

export enum BackupRunTrigger {
  MANUAL = 'manual',
  SCHEDULED = 'scheduled',
}

@Entity('backup_runs')
@Index('IDX_backup_runs_workspace_created', ['workspaceId', 'createdAt'])
export class BackupRun {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @Column({ name: 'configuration_id', type: 'uuid' })
  configurationId: string;

  @ManyToOne(
    () => BackupConfiguration,
    configuration => configuration.runs,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'configuration_id' })
  configuration: BackupConfiguration;

  @Column({ type: 'varchar', length: 16 })
  trigger: BackupRunTrigger;

  @Column({ type: 'varchar', length: 16, default: BackupRunStatus.RUNNING })
  status: BackupRunStatus;

  @Column({ name: 'destination_file', type: 'varchar', length: 512, nullable: true })
  destinationFile: string | null;

  @Column({ name: 'payload_sha256', type: 'varchar', length: 64, nullable: true })
  payloadSha256: string | null;

  @Column({ name: 'size_bytes', type: 'bigint', nullable: true })
  sizeBytes: string | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ name: 'started_at', type: 'timestamptz' })
  startedAt: Date;

  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
  finishedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

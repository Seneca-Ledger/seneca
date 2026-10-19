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
import { CustomTable } from './custom-table.entity';
import { User } from './user.entity';
import { Workspace } from './workspace.entity';

type JsonObject = Record<string, unknown>;

export enum ExportScheduleFormat {
  CSV = 'csv',
  XLSX = 'xlsx',
}

/**
 * Куда кладётся готовый файл. Пока только хранилище: рассылка на почту
 * требует решения, кому именно можно слать данные воркспейса.
 */
export enum ExportScheduleDelivery {
  STORAGE = 'storage',
}

@Entity('custom_table_export_schedules')
@Index('IDX_custom_table_export_schedules_enabled', ['enabled'])
export class CustomTableExportSchedule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => CustomTable, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'table_id' })
  table: CustomTable;

  @Column({ name: 'table_id', type: 'uuid' })
  tableId: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdBy: User | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdById: string | null;

  @Column({ name: 'format', type: 'varchar', length: 10, default: ExportScheduleFormat.XLSX })
  format: ExportScheduleFormat;

  @Column({
    name: 'delivery',
    type: 'varchar',
    length: 20,
    default: ExportScheduleDelivery.STORAGE,
  })
  delivery: ExportScheduleDelivery;

  /** Что выгружать: { filters, sort, columnKeys } — тот же «текущий вид». */
  @Column({ name: 'view_config', type: 'jsonb', nullable: true })
  viewConfig: JsonObject | null;

  @Column({ name: 'interval_hours', type: 'int', default: 168 })
  intervalHours: number;

  @Column({ name: 'enabled', type: 'boolean', default: true })
  enabled: boolean;

  @Column({ name: 'last_run_at', type: 'timestamp', nullable: true })
  lastRunAt: Date | null;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError: string | null;

  /** Путь последнего готового файла — его и скачивает пользователь. */
  @Column({ name: 'last_file_path', type: 'text', nullable: true })
  lastFilePath: string | null;

  @Column({ name: 'last_file_name', type: 'text', nullable: true })
  lastFileName: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

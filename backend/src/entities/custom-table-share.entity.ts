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

export enum CustomTableShareStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  REVOKED = 'revoked',
}

/**
 * Ссылка только для чтения на таблицу. Повторяет модель shared_links для
 * выписок, чтобы в продукте был один способ делиться данными, а не два.
 */
@Entity('custom_table_shares')
@Index('IDX_custom_table_shares_table', ['tableId'])
export class CustomTableShare {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => CustomTable, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'table_id' })
  table: CustomTable;

  @Column({ name: 'table_id', type: 'uuid' })
  tableId: string;

  /**
   * Дублируем воркспейс: публичный доступ идёт мимо контекста воркспейса,
   * и проверка изоляции должна опираться на саму ссылку.
   */
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

  @Column({ unique: true, length: 64 })
  token: string;

  @Column({ name: 'expires_at', type: 'timestamp', nullable: true })
  expiresAt: Date | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: CustomTableShareStatus.ACTIVE,
  })
  status: CustomTableShareStatus;

  @Column({ name: 'access_count', default: 0 })
  accessCount: number;

  @Column({ name: 'last_accessed_at', type: 'timestamp', nullable: true })
  lastAccessedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

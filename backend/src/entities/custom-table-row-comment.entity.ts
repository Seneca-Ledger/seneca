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
import { CustomTableRow } from './custom-table-row.entity';
import { User } from './user.entity';
import { Workspace } from './workspace.entity';

@Entity('custom_table_row_comments')
@Index('IDX_custom_table_row_comments_row', ['rowId'])
export class CustomTableRowComment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => CustomTableRow, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'row_id' })
  row: CustomTableRow;

  @Column({ name: 'row_id', type: 'uuid' })
  rowId: string;

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

  /** Автор может быть удалён — комментарий при этом остаётся. */
  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ name: 'body', type: 'text' })
  body: string;

  /** Проставляется при отметке «решено»; null — обсуждение открыто. */
  @Column({ name: 'resolved_at', type: 'timestamp', nullable: true })
  resolvedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

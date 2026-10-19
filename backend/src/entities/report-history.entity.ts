import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Workspace } from './workspace.entity';

@Entity('report_history')
export class ReportHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'template_id' })
  templateId: string;

  @Column({ name: 'template_name' })
  templateName: string;

  @Column({ name: 'date_from' })
  dateFrom: string;

  @Column({ name: 'date_to' })
  dateTo: string;

  @Column()
  format: string;

  @Column({ name: 'file_path', nullable: true })
  filePath: string;

  @Column({ name: 'file_name', nullable: true })
  fileName: string;

  @Column({ name: 'file_size', type: 'int', default: 0 })
  fileSize: number;

  @CreateDateColumn({ name: 'generated_at' })
  generatedAt: Date;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;
}

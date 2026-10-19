import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Statement } from './statement.entity';
import { User } from './user.entity';

@Entity('file_versions')
export class FileVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'statement_id', type: 'uuid' })
  statementId: string;

  @ManyToOne(() => Statement, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'statement_id' })
  statement: Statement;

  @Column({ name: 'created_by' })
  createdBy: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'created_by' })
  user: User;

  @Column({ name: 'file_hash' })
  fileHash: string;

  @Column({ name: 'file_name' })
  fileName: string;

  @Column({ name: 'file_type' })
  fileType: string;

  @Column({ name: 'file_size', type: 'bigint' })
  fileSize: number;

  @Column({ name: 'file_data', type: 'bytea' })
  fileData: Buffer;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

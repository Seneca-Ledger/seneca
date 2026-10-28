import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
  UpdateDateColumn,
} from 'typeorm';
import type { LayoutTemplate } from '../modules/parsing/helpers/layout-template.helper';
import { User } from './user.entity';
import { Workspace } from './workspace.entity';

/**
 * A statement layout a user taught by marking areas of a file the parser
 * could not read (layout-template.helper): the next file in that layout is
 * read with it. Per workspace: one workspace's teaching never reads another's
 * files. Holds printed headings, labels and column positions only.
 */
@Entity('parsing_layout_templates')
@Index('UQ_parsing_layout_templates_signature', ['workspaceId', 'signature'], { unique: true })
export class ParsingLayoutTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Relation<Workspace>;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  /** templateSignature: one value per taught layout. */
  @Column({ type: 'varchar', length: 64 })
  signature: string;

  /** The bank the taught file was detected as, for the instance's parser health page. */
  @Column({ name: 'bank_name', type: 'varchar', length: 64 })
  bankName: string;

  @Column({ type: 'jsonb' })
  template: LayoutTemplate;

  /** Statements read with it, the one it was taught on included. */
  @Column({ name: 'used_count', type: 'int', default: 0 })
  usedCount: number;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'taught_by' })
  teacher: Relation<User> | null;

  @Column({ name: 'taught_by', type: 'uuid', nullable: true })
  taughtBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

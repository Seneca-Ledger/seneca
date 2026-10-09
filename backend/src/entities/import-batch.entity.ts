import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Workspace } from './workspace.entity';

type JsonObject = Record<string, unknown>;

/** One entity created by an import; `kind` names the table it lives in. */
export interface ImportCreatedRef {
  kind:
    | 'statement'
    | 'payable'
    | 'subscription'
    | 'budget'
    | 'invoice'
    | 'client'
    | 'category'
    | 'metal_lot';
  id: string;
}

/** An entity the import changed, with the values it had before. */
export interface ImportUpdatedRef {
  kind: 'payable' | 'subscription' | 'budget';
  id: string;
  before: JsonObject;
}

/**
 * What one "import into app data" run created or changed, so it can be undone
 * as a whole. Users need the undo more than they need the import.
 */
@Entity('import_batches')
@Index('IDX_import_batches_workspace_created', ['workspaceId', 'createdAt'])
export class ImportBatch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ name: 'target', type: 'varchar', length: 32 })
  target: string;

  @Column({ name: 'file_name', type: 'varchar', length: 255, nullable: true })
  fileName: string | null;

  @Column({ name: 'created_refs', type: 'jsonb', default: () => "'[]'::jsonb" })
  createdRefs: ImportCreatedRef[];

  @Column({ name: 'updated_refs', type: 'jsonb', default: () => "'[]'::jsonb" })
  updatedRefs: ImportUpdatedRef[];

  @Column({ name: 'summary', type: 'jsonb', default: () => "'{}'::jsonb" })
  summary: JsonObject;

  @Column({ name: 'undone_at', type: 'timestamptz', nullable: true })
  undoneAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

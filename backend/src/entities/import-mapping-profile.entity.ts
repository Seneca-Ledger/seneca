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
import { User } from './user.entity';
import { Workspace } from './workspace.entity';

/**
 * Column roles remembered for one header row, so a recurring export (the same
 * bank, the same budget sheet) maps itself the next time it is imported.
 *
 * Per workspace and import target: everyone importing into the workspace
 * benefits, and the same header row may mean a statement in one place and a
 * budget in another.
 */
@Entity('import_mapping_profiles')
@Index('UQ_import_mapping_profiles_header', ['workspaceId', 'target', 'headerSignature'], {
  unique: true,
})
export class ImportMappingProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Relation<Workspace>;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  /** The entity import target: `transactions`, `payables`, … */
  @Column({ type: 'varchar', length: 32 })
  target: string;

  /** sha256 of the normalized header titles joined by `|`. */
  @Column({ name: 'header_signature', type: 'varchar', length: 64 })
  headerSignature: string;

  /** Target field → column index. */
  @Column({ type: 'jsonb' })
  mapping: Record<string, number>;

  /** Who saved the mapping last. */
  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'saved_by' })
  saver: Relation<User> | null;

  @Column({ name: 'saved_by', type: 'uuid', nullable: true })
  savedBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

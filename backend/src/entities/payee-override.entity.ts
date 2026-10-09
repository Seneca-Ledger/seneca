import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Category } from './category.entity';
import { Workspace } from './workspace.entity';

/** What the user told us to do with one payee, the three choices YNAB offers. */
export enum PayeeOverrideMode {
  /** Follow the payee's own history (the default; no row is stored for it). */
  AUTO = 'auto',
  /** Always this category, whatever the history says. */
  ALWAYS = 'always',
  /** Never categorise this payee; its rows wait in Review. */
  NEVER = 'never',
}

/**
 * A standing instruction for one payee, keyed by the normalised payee key
 * (`descriptor-normalizer.ts`), not by the raw descriptor: the raw string
 * carries a different terminal number every time.
 */
@Entity('payee_overrides')
@Unique('UQ_payee_overrides_workspace_key', ['workspaceId', 'payeeKey'])
export class PayeeOverride {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @Column({ name: 'workspace_id', type: 'uuid' })
  @Index()
  workspaceId: string;

  @Column({ name: 'payee_key', type: 'text' })
  payeeKey: string;

  /** The descriptor this key was first seen as, so the UI has something to show. */
  @Column({ name: 'display_name', type: 'text', nullable: true })
  displayName: string | null;

  @Column({ type: 'enum', enum: PayeeOverrideMode, default: PayeeOverrideMode.AUTO })
  mode: PayeeOverrideMode;

  // SET NULL rather than CASCADE: deleting a category should drop the pin, not
  // the user's "never categorise this payee" decision.
  @ManyToOne(() => Category, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'category_id' })
  category: Category | null;

  @Column({ name: 'category_id', type: 'uuid', nullable: true })
  categoryId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

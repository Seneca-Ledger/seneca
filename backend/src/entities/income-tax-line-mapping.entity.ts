import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Category } from './category.entity';
import { User } from './user.entity';
import { Workspace } from './workspace.entity';

/**
 * A category the user has assigned to a line of a form.
 *
 * Only confirmed assignments exist as rows; proposals are computed on read and
 * never count towards a draft. Keyed by form, not by year, because line keys
 * are stable across editions and re-mapping every January would be busywork.
 */
@Entity('income_tax_line_mappings')
@Index('UQ_income_tax_line_mappings_category', ['workspaceId', 'formKey', 'categoryId'], {
  unique: true,
})
export class IncomeTaxLineMapping {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  @Column({ name: 'form_key', type: 'varchar', length: 64 })
  formKey: string;

  @ManyToOne(() => Category, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'category_id' })
  category: Category;

  @Column({ name: 'category_id', type: 'uuid' })
  categoryId: string;

  @Column({ name: 'line_key', type: 'varchar', length: 64 })
  lineKey: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'confirmed_by' })
  confirmer: User | null;

  @Column({ name: 'confirmed_by', type: 'uuid', nullable: true })
  confirmedBy: string | null;

  @Column({ name: 'confirmed_at', type: 'timestamptz' })
  confirmedAt: Date;
}

import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Workspace } from './workspace.entity';

/**
 * A workspace's own account with a Peppol access point (Recommand): Seneca
 * sends and receives through it with the workspace's key, never a shared one.
 */
@Entity('peppol_connections')
export class PeppolConnection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @Column({ name: 'workspace_id', type: 'uuid', unique: true })
  workspaceId: string;

  @Column({ type: 'varchar', length: 20, default: 'recommand' })
  provider: 'recommand';

  @Column({ name: 'api_key_id', type: 'varchar', length: 200 })
  apiKeyId: string;

  /** Encrypted with `encryptText`; never returned. */
  @Column({ name: 'api_secret', type: 'text', select: false })
  apiSecret: string;

  /** The access point's id for the business that sends and receives. */
  @Column({ name: 'company_id', type: 'varchar', length: 100 })
  companyId: string;

  @Column({ name: 'company_name', type: 'varchar', length: 255, nullable: true })
  companyName: string | null;

  /** The business's own Peppol id (`scheme:value`), its address on invoices it sends. */
  @Column({ name: 'sender_peppol_id', type: 'varchar', length: 100 })
  senderPeppolId: string;

  @Column({ name: 'last_polled_at', type: 'timestamptz', nullable: true })
  lastPolledAt: Date | null;

  /** Why the last inbox poll failed, until one succeeds. */
  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

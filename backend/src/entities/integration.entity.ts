import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  type Relation,
  UpdateDateColumn,
} from 'typeorm';
import { IntegrationToken } from '../entities/integration-token.entity';
import { OpenProtocolSettings } from '../entities/open-protocol-settings.entity';
import { User } from '../entities/user.entity';
import { Workspace } from '../entities/workspace.entity';

export enum IntegrationProvider {
  S3_COMPATIBLE = 's3_compatible',
  WEBDAV = 'webdav',
  IMAP = 'imap',
  /** Bank sync through the user's own SimpleFIN Bridge account. */
  SIMPLEFIN = 'simplefin',
  /** Bank sync through the user's own Enable Banking application. */
  ENABLEBANKING = 'enablebanking',
}

export enum IntegrationStatus {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  NEEDS_REAUTH = 'needs_reauth',
}

@Entity('integrations')
export class Integration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Relation<Workspace>;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  @Column({ type: 'varchar' })
  provider: IntegrationProvider;

  /**
   * Which instance of this provider, for the ones a workspace may hold several
   * of. NULL means the single connection of that provider, which is what cloud
   * storage and mail are, and keeps them unique per workspace.
   */
  @Column({ name: 'instance_key', type: 'varchar', length: 64, nullable: true })
  instanceKey: string | null;

  @Column({ type: 'varchar', default: IntegrationStatus.CONNECTED })
  status: IntegrationStatus;

  @Column({ type: 'jsonb', nullable: true })
  scopes: string[] | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'connected_by_user_id' })
  connectedByUser: Relation<User | null>;

  @Column({ name: 'connected_by_user_id', type: 'uuid', nullable: true })
  connectedByUserId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToOne(
    () => IntegrationToken,
    token => token.integration,
  )
  token: Relation<IntegrationToken | null>;

  @OneToOne(
    () => OpenProtocolSettings,
    settings => settings.integration,
  )
  openProtocolSettings: Relation<OpenProtocolSettings | null>;
}

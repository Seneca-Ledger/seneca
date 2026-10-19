import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Integration } from './integration.entity';

@Entity('integration_tokens')
export class IntegrationToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(
    () => Integration,
    integration => integration.token,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'integration_id' })
  integration: Integration;

  @Column({ name: 'integration_id', type: 'uuid' })
  integrationId: string;

  @Column({ name: 'access_token', type: 'text', nullable: true })
  accessToken: string | null;

  @Column({ name: 'refresh_token', type: 'text', nullable: true })
  refreshToken: string | null;

  @Column({ name: 'encrypted_access_token', type: 'text', nullable: true })
  encryptedAccessToken: string | null;

  @Column({ name: 'encrypted_refresh_token', type: 'text', nullable: true })
  encryptedRefreshToken: string | null;

  @Column({ name: 'expires_at', type: 'timestamp', nullable: true })
  expiresAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

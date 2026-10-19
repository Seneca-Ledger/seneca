import { createHash, randomBytes } from 'node:crypto';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { AuditAction, EntityType, Severity } from '../../entities/audit-event.entity';
import { AuditService } from '../audit/audit.service';
import { recordSecurityEvent } from '../auth/security-audit.util';
import { ApiKey } from './entities/api-key.entity';

export interface GeneratedApiKey {
  id: string;
  key: string;
  prefix: string;
  name: string;
  scopes: string[] | null;
  expiresAt: Date | null;
  createdAt: Date;
}

@Injectable()
export class ApiKeysService {
  private readonly logger = new Logger(ApiKeysService.name);

  constructor(
    @InjectRepository(ApiKey)
    private readonly apiKeyRepository: Repository<ApiKey>,
    private readonly auditService: AuditService,
  ) {}

  async generate(
    workspaceId: string,
    userId: string,
    name: string,
    options: { scopes?: string[]; expiresAt?: string | null } = {},
  ): Promise<GeneratedApiKey> {
    const rawKey = `lum_${randomBytes(32).toString('hex')}`;
    const keyHash = createHash('sha256').update(rawKey).digest('hex');
    const prefix = rawKey.slice(4, 12); // 8 chars after "lum_"
    const scopes =
      options.scopes && options.scopes.length > 0 ? [...new Set(options.scopes)] : null;
    const expiresAt = options.expiresAt ? new Date(options.expiresAt) : null;
    if (expiresAt && Number.isNaN(expiresAt.getTime())) {
      throw new BadRequestException('expiresAt is not a date');
    }

    const apiKey = this.apiKeyRepository.create({
      workspaceId,
      userId,
      name,
      keyHash,
      prefix,
      scopes,
      expiresAt,
    });

    const saved = await this.apiKeyRepository.save(apiKey);

    // Name and 8-char prefix only: the raw key and its hash stay out of the log.
    await recordSecurityEvent(this.auditService, this.logger, {
      workspaceId,
      actorId: userId,
      entityType: EntityType.API_KEY,
      entityId: saved.id,
      action: AuditAction.CREATE,
      severity: Severity.WARN,
      meta: { name: saved.name, prefix: saved.prefix, scopes: saved.scopes },
    });

    return {
      id: saved.id,
      key: rawKey,
      prefix: saved.prefix,
      name: saved.name,
      scopes: saved.scopes,
      expiresAt: saved.expiresAt,
      createdAt: saved.createdAt,
    };
  }

  async validate(rawKey: string): Promise<ApiKey | null> {
    if (!rawKey.startsWith('lum_')) return null;

    const keyHash = createHash('sha256').update(rawKey).digest('hex');

    const apiKey = await this.apiKeyRepository.findOne({
      where: { keyHash, revokedAt: IsNull() },
      relations: ['user', 'workspace'],
    });

    if (!apiKey) return null;

    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return null;

    // Update lastUsedAt without blocking the request
    void this.apiKeyRepository.update(apiKey.id, { lastUsedAt: new Date() });

    return apiKey;
  }

  async list(workspaceId: string): Promise<ApiKey[]> {
    return this.apiKeyRepository.find({
      where: { workspaceId, revokedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
  }

  async revoke(id: string, workspaceId: string, userId: string): Promise<void> {
    const apiKey = await this.apiKeyRepository.findOne({
      where: { id, workspaceId, revokedAt: IsNull() },
    });

    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }

    await this.apiKeyRepository.update(id, { revokedAt: new Date() });

    await recordSecurityEvent(this.auditService, this.logger, {
      workspaceId,
      actorId: userId,
      entityType: EntityType.API_KEY,
      entityId: apiKey.id,
      action: AuditAction.DELETE,
      severity: Severity.WARN,
      meta: { name: apiKey.name, prefix: apiKey.prefix },
    });
  }
}

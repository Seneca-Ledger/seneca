import { randomBytes } from 'node:crypto';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { withoutNullsOnRequired } from '../../../common/effect/without-nulls';
import { appError } from '../../../common/errors/app-error';
import { assertWorkspaceRefs } from '../../../common/utils/workspace-refs.util';
import type { CreateWebhookEndpointBody, UpdateWebhookEndpointBody } from '../../../contracts';
import { AuditAction, EntityType, Severity } from '../../../entities/audit-event.entity';
import { WebhookEndpoint } from '../../../entities/webhook-endpoint.entity';
import { AuditService } from '../../audit/audit.service';
import { recordSecurityEvent } from '../../auth/security-audit.util';

@Injectable()
export class WebhookEndpointsService {
  private readonly logger = new Logger(WebhookEndpointsService.name);

  constructor(
    @InjectRepository(WebhookEndpoint)
    private readonly repo: Repository<WebhookEndpoint>,
    private readonly auditService: AuditService,
  ) {}

  async create(
    workspaceId: string,
    dto: CreateWebhookEndpointBody,
    actorId: string,
  ): Promise<WebhookEndpoint> {
    await this.assertDefaultsInWorkspace(workspaceId, dto);
    const token = randomBytes(32).toString('hex');
    const entity = this.repo.create({ ...dto, workspaceId, isActive: dto.isActive ?? true });
    entity.token = token;
    const saved = await this.repo.save(entity);
    await this.recordEvent(workspaceId, actorId, saved.id, AuditAction.CREATE, Severity.WARN, {
      before: null,
      after: this.snapshot(saved),
    });
    return saved;
  }

  async findAll(workspaceId: string): Promise<WebhookEndpoint[]> {
    return this.repo.find({ where: { workspaceId } });
  }

  async findOne(id: string, workspaceId: string): Promise<WebhookEndpoint> {
    const endpoint = await this.repo.findOne({ where: { id, workspaceId } });
    if (!endpoint) throw new NotFoundException(appError('WEBHOOK_ENDPOINT_NOT_FOUND'));
    return endpoint;
  }

  async update(
    id: string,
    workspaceId: string,
    dto: UpdateWebhookEndpointBody,
    actorId: string,
  ): Promise<WebhookEndpoint> {
    const endpoint = await this.findOne(id, workspaceId);
    await this.assertDefaultsInWorkspace(workspaceId, dto);
    const before = this.snapshot(endpoint);
    Object.assign(endpoint, withoutNullsOnRequired(this.repo.metadata, dto));
    const saved = await this.repo.save(endpoint);
    await this.recordEvent(workspaceId, actorId, saved.id, AuditAction.UPDATE, Severity.INFO, {
      before,
      after: this.snapshot(saved),
    });
    return saved;
  }

  async delete(id: string, workspaceId: string, actorId: string): Promise<void> {
    const endpoint = await this.findOne(id, workspaceId);
    await this.repo.delete({ id, workspaceId });
    await this.recordEvent(workspaceId, actorId, id, AuditAction.DELETE, Severity.WARN, {
      before: this.snapshot(endpoint),
      after: null,
    });
  }

  /** Uploads through the endpoint land in this wallet and branch: this workspace's only. */
  private assertDefaultsInWorkspace(
    workspaceId: string,
    dto: Pick<UpdateWebhookEndpointBody, 'defaultWalletId' | 'defaultBranchId'>,
  ): Promise<void> {
    return assertWorkspaceRefs(this.repo.manager, workspaceId, {
      walletId: dto.defaultWalletId,
      branchId: dto.defaultBranchId,
    });
  }

  /** The inbound token is a credential: it never enters the audit log. */
  private snapshot(endpoint: WebhookEndpoint) {
    return {
      name: endpoint.name,
      isActive: endpoint.isActive,
      defaultWalletId: endpoint.defaultWalletId ?? null,
      defaultBranchId: endpoint.defaultBranchId ?? null,
    };
  }

  private async recordEvent(
    workspaceId: string,
    actorId: string,
    endpointId: string,
    action: AuditAction,
    severity: Severity,
    diff: { before: object | null; after: object | null },
  ): Promise<void> {
    await recordSecurityEvent(this.auditService, this.logger, {
      workspaceId,
      actorId,
      entityType: EntityType.WEBHOOK,
      entityId: endpointId,
      action,
      severity,
      diff,
      meta: { webhookKind: 'inbound-endpoint' },
    });
  }

  async findByToken(token: string): Promise<WebhookEndpoint | null> {
    return this.repo.findOne({ where: { token, isActive: true } });
  }
}

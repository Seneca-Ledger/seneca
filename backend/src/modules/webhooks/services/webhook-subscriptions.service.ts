import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { toEnum } from '../../../common/effect/to-enum';
import { assertPublicEgressUrl } from '../../../common/utils/egress-url.util';
import type {
  CreateWebhookSubscriptionBody,
  UpdateWebhookSubscriptionBody,
} from '../../../contracts';
import { AuditAction, EntityType, Severity } from '../../../entities/audit-event.entity';
import { WebhookEvent, WebhookSubscription } from '../../../entities/webhook-subscription.entity';
import { AuditService } from '../../audit/audit.service';
import { recordSecurityEvent } from '../../auth/security-audit.util';

@Injectable()
export class WebhookSubscriptionsService {
  private readonly logger = new Logger(WebhookSubscriptionsService.name);

  constructor(
    @InjectRepository(WebhookSubscription)
    private readonly repo: Repository<WebhookSubscription>,
    private readonly auditService: AuditService,
  ) {}

  async create(
    workspaceId: string,
    dto: CreateWebhookSubscriptionBody,
    actorId: string,
  ): Promise<WebhookSubscription> {
    await assertPublicEgressUrl(dto.url);
    const entity = this.repo.create({
      ...dto,
      events: dto.events.map(event => toEnum(WebhookEvent, event)),
      workspaceId,
    });
    const saved = await this.repo.save(entity);
    await this.recordEvent(workspaceId, actorId, saved.id, AuditAction.CREATE, Severity.WARN, {
      before: null,
      after: this.snapshot(saved),
    });
    return saved;
  }

  async findAll(workspaceId: string): Promise<WebhookSubscription[]> {
    return this.repo.find({ where: { workspaceId } });
  }

  async findOne(id: string, workspaceId: string): Promise<WebhookSubscription> {
    const sub = await this.repo.findOne({ where: { id, workspaceId } });
    if (!sub) {
      throw new NotFoundException('Webhook subscription not found');
    }
    return sub;
  }

  async update(
    id: string,
    workspaceId: string,
    dto: UpdateWebhookSubscriptionBody,
    actorId: string,
  ): Promise<WebhookSubscription> {
    const sub = await this.findOne(id, workspaceId);
    if (dto.url) {
      await assertPublicEgressUrl(dto.url);
    }
    const before = this.snapshot(sub);
    Object.assign(sub, dto);
    const saved = await this.repo.save(sub);
    // Where the data goes (URL, events) or how it is signed matters more than a rename.
    const redirected = Boolean(dto.url || dto.events || dto.secret);
    await this.recordEvent(
      workspaceId,
      actorId,
      saved.id,
      AuditAction.UPDATE,
      redirected ? Severity.WARN : Severity.INFO,
      { before, after: this.snapshot(saved) },
      { secretChanged: Boolean(dto.secret) },
    );
    return saved;
  }

  async delete(id: string, workspaceId: string, actorId: string): Promise<void> {
    const sub = await this.findOne(id, workspaceId);
    await this.repo.delete({ id, workspaceId });
    await this.recordEvent(workspaceId, actorId, id, AuditAction.DELETE, Severity.WARN, {
      before: this.snapshot(sub),
      after: null,
    });
  }

  /**
   * Host only, not the full URL (it may carry credentials in its path or
   * query), and never the signing secret.
   */
  private snapshot(sub: WebhookSubscription) {
    return {
      name: sub.name,
      urlHost: this.urlHost(sub.url),
      events: sub.events ?? [],
      isActive: sub.isActive,
    };
  }

  private urlHost(url: string): string | null {
    try {
      return new URL(url).host;
    } catch {
      return null;
    }
  }

  private async recordEvent(
    workspaceId: string,
    actorId: string,
    subscriptionId: string,
    action: AuditAction,
    severity: Severity,
    diff: { before: object | null; after: object | null },
    extraMeta: Record<string, unknown> = {},
  ): Promise<void> {
    const current = (diff.after ?? diff.before) as { urlHost: string | null; events: string[] };
    await recordSecurityEvent(this.auditService, this.logger, {
      workspaceId,
      actorId,
      entityType: EntityType.WEBHOOK,
      entityId: subscriptionId,
      action,
      severity,
      diff,
      meta: {
        webhookKind: 'outbound-subscription',
        urlHost: current.urlHost,
        events: current.events,
        ...extraMeta,
      },
    });
  }

  async findActiveByWorkspaceAndEvent(
    workspaceId: string,
    event: WebhookEvent,
  ): Promise<WebhookSubscription[]> {
    return this.repo
      .createQueryBuilder('sub')
      .where('sub.workspaceId = :workspaceId', { workspaceId })
      .andWhere('sub.isActive = true')
      .andWhere(':event = ANY(sub.events)', { event })
      .getMany();
  }
}

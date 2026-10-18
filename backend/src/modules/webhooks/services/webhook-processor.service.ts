import { createHmac, randomUUID } from 'node:crypto';
import * as http from 'node:http';
import * as https from 'node:https';
import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  assertPublicEgressUrl,
  createPublicEgressHttpAgents,
} from '../../../common/utils/egress-url.util';
import { WebhookDelivery, WebhookDeliveryStatus } from '../../../entities/webhook-delivery.entity';
import { WebhookSubscription } from '../../../entities/webhook-subscription.entity';
import { WorkspacePluginsService } from '../../workspaces/workspace-plugins.service';

// HOSTNAME is set by Docker and Kubernetes alike; the UUID covers a bare
// process run outside a container.
const LOCK_ID = `processor-${process.env.HOSTNAME ?? randomUUID()}`;
const HTTP_TIMEOUT_MS = Number.parseInt(process.env.WEBHOOK_HTTP_TIMEOUT_MS ?? '10000', 10);

@Injectable()
export class WebhookProcessorService {
  private readonly logger = new Logger(WebhookProcessorService.name);
  private running = false;

  constructor(
    @InjectRepository(WebhookDelivery)
    private readonly deliveryRepo: Repository<WebhookDelivery>,
    @InjectRepository(WebhookSubscription)
    private readonly subRepo: Repository<WebhookSubscription>,
    private readonly plugins: WorkspacePluginsService,
  ) {}

  @Interval(5000)
  async tick(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      const delivery = await this.claimNextDelivery();
      if (delivery) {
        await this.processDelivery(delivery);
      }
    } catch (err) {
      this.logger.warn(
        `Webhook processor tick failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      this.running = false;
    }
  }

  /**
   * POST через агентов с pinned DNS-lookup: проверка assertPublicEgressUrl и
   * само соединение резолвят имя одинаково, иначе низкий TTL позволял бы
   * DNS-rebinding на внутренние адреса между проверкой и запросом.
   * Глобальный fetch (undici) не принимает эти агенты, поэтому node:http(s).
   */
  private postWithPinnedDns(
    url: string,
    body: string,
    headers: Record<string, string>,
  ): Promise<{ status: number; body: string }> {
    const { httpAgent, httpsAgent } = createPublicEgressHttpAgents();
    const parsed = new URL(url);
    const isHttps = parsed.protocol === 'https:';
    const transport = isHttps ? https : http;
    const agent = isHttps ? httpsAgent : httpAgent;

    return new Promise((resolve, reject) => {
      const req = transport.request(
        parsed,
        { method: 'POST', headers, agent, timeout: HTTP_TIMEOUT_MS },
        res => {
          const chunks: Buffer[] = [];
          // Редиректам не следуем (как и раньше): цель редиректа не проходила бы egress-проверку.
          res.on('data', chunk => {
            if (Buffer.concat(chunks).length < 4096) {
              chunks.push(chunk as Buffer);
            }
          });
          res.on('end', () =>
            resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8') }),
          );
          res.on('error', reject);
        },
      );
      req.on('timeout', () =>
        req.destroy(new Error(`Webhook request timed out after ${HTTP_TIMEOUT_MS}ms`)),
      );
      req.on('error', reject);
      req.end(body);
    });
  }

  private async claimNextDelivery(): Promise<WebhookDelivery | null> {
    const result = await this.deliveryRepo.query(
      `
      UPDATE webhook_deliveries
      SET status = 'processing', locked_at = now(), locked_by = $1
      WHERE id = (
        SELECT id FROM webhook_deliveries
        WHERE (
          status IN ('pending', 'failed')
          AND attempt_count < max_attempts
          AND (next_attempt_at IS NULL OR next_attempt_at <= now())
        )
        OR (
          status = 'processing'
          AND locked_at < now() - interval '15 minutes'
        )
        ORDER BY created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING *
    `,
      [LOCK_ID],
    );
    return result[0]?.[0] ?? null;
  }

  private async processDelivery(delivery: WebhookDelivery): Promise<void> {
    const sub = await this.subRepo.findOne({ where: { id: delivery.subscriptionId } });
    if (!sub?.isActive) {
      await this.deliveryRepo.save({
        ...delivery,
        status: WebhookDeliveryStatus.EXHAUSTED,
        lastError: sub ? 'Subscription is inactive' : 'Subscription not found',
      });
      return;
    }
    // Queued before the plugin was switched off. Kept retryable from the UI.
    if (!(await this.plugins.isEnabled(sub.workspaceId, 'webhooks'))) {
      await this.deliveryRepo.save({
        ...delivery,
        status: WebhookDeliveryStatus.EXHAUSTED,
        lastError: 'Webhooks are turned off for this workspace',
        lockedAt: null,
        lockedBy: null,
      });
      return;
    }

    const payloadStr = JSON.stringify(delivery.payload);
    const signature = this.buildSignature(sub.secret, payloadStr);

    let responseCode: number | null = null;
    let responseBody: string | null = null;
    let error: string | null = null;
    let success = false;

    try {
      await assertPublicEgressUrl(sub.url);
      const res = await this.postWithPinnedDns(sub.url, payloadStr, {
        'Content-Type': 'application/json',
        'X-Lumio-Signature': signature,
        'X-Lumio-Event': delivery.event,
        'X-Lumio-Delivery': delivery.id,
      });
      responseCode = res.status;
      responseBody = res.body.slice(0, 4096);
      success = res.status >= 200 && res.status < 300;
    } catch (err: unknown) {
      error = err instanceof Error ? err.message : String(err);
    }

    const attemptCount = delivery.attemptCount + 1;
    const maxAttempts = delivery.maxAttempts;
    let status: WebhookDeliveryStatus;
    let nextAttemptAt: Date | null = null;

    if (success) {
      status = WebhookDeliveryStatus.SUCCESS;
    } else if (attemptCount >= maxAttempts) {
      status = WebhookDeliveryStatus.EXHAUSTED;
    } else {
      status = WebhookDeliveryStatus.FAILED;
      nextAttemptAt = new Date(Date.now() + this.backoffMs(attemptCount));
    }

    await this.deliveryRepo.save({
      ...delivery,
      status,
      attemptCount,
      nextAttemptAt,
      lastAttemptedAt: new Date(),
      lastResponseCode: responseCode,
      lastResponseBody: responseBody,
      lastError: error,
      lockedAt: null,
      lockedBy: null,
    });

    if (!success) {
      this.logger.warn(
        `Delivery ${delivery.id} attempt ${attemptCount} failed: ${error ?? `HTTP ${responseCode}`}`,
      );
    }
  }

  private buildSignature(secret: string, payload: string): string {
    return `sha256=${createHmac('sha256', secret).update(payload).digest('hex')}`;
  }

  private backoffMs(attemptCount: number): number {
    return 30_000 * 10 ** (attemptCount - 1);
  }
}

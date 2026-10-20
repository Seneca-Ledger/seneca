import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import {
  assertPublicEgressUrl,
  createPublicEgressHttpAgents,
} from '../../common/utils/egress-url.util';
import { secretsMatch } from '../../common/utils/secret-compare.util';
import type { PushSubscriptionBody } from '../../contracts';
import { PushSubscription } from '../../entities/push-subscription.entity';

export interface PushPayload {
  title: string;
  body: string;
  /** Where a tap takes the person; relative to the app origin. */
  url?: string;
  tag?: string;
}

type WebPushModule = typeof import('web-push');

/**
 * Web push to the browsers and installed apps a user subscribed. VAPID keys
 * come from the environment (`npx web-push generate-vapid-keys`); without
 * them the channel reports itself unavailable and nothing is sent.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private webPush: WebPushModule | null = null;

  constructor(
    @InjectRepository(PushSubscription)
    private readonly subscriptionRepository: Repository<PushSubscription>,
    private readonly configService: ConfigService,
  ) {}

  isEnabled(): boolean {
    return Boolean(this.publicKey() && this.privateKey());
  }

  publicKey(): string | null {
    return this.configService.get<string>('WEB_PUSH_VAPID_PUBLIC_KEY') || null;
  }

  async subscribe(userId: string, dto: PushSubscriptionBody): Promise<PushSubscription> {
    if (!this.isEnabled()) {
      throw new ConflictException('Web push is not configured on this server');
    }
    // The server POSTs to this URL on every notification: a push service, never
    // an address inside the network it runs in.
    const endpoint = await assertPublicEgressUrl(dto.endpoint);
    if (endpoint.protocol !== 'https:') {
      throw new BadRequestException('Push endpoint must be an https URL');
    }
    const existing = await this.subscriptionRepository.findOne({
      where: { endpoint: dto.endpoint },
    });
    // The same device re-subscribing just updates its row. A device that changed
    // hands moves to the new user only when it presents the subscription's own
    // keys: knowing someone's endpoint URL is not enough to take it over.
    const sameKeys =
      secretsMatch(dto.keys.p256dh, existing?.p256dh ?? '') &&
      secretsMatch(dto.keys.auth, existing?.auth ?? '');
    if (existing && existing.userId !== userId && !sameKeys) {
      throw new ConflictException('This push endpoint belongs to another account');
    }
    const row =
      existing ??
      this.subscriptionRepository.create({ endpoint: dto.endpoint, userId, p256dh: '', auth: '' });
    row.userId = userId;
    row.p256dh = dto.keys.p256dh;
    row.auth = dto.keys.auth;
    if (dto.userAgent != null) {
      row.userAgent = dto.userAgent.slice(0, 255);
    }
    row.lastUsedAt = new Date();
    return this.subscriptionRepository.save(row);
  }

  async unsubscribe(userId: string, endpoint: string): Promise<void> {
    await this.subscriptionRepository.delete({ userId, endpoint });
  }

  async listForUser(userId: string): Promise<PushSubscription[]> {
    return this.subscriptionRepository.find({ where: { userId }, order: { createdAt: 'ASC' } });
  }

  /**
   * Sends to every device of the user. True when at least one device took it,
   * or when the user has no devices (nothing to retry). Dead subscriptions are
   * dropped.
   */
  async sendToUser(userId: string, payload: PushPayload): Promise<boolean> {
    if (!this.isEnabled()) return false;
    const subscriptions = await this.listForUser(userId);
    if (subscriptions.length === 0) return true;
    const lib = await this.loadLibrary();
    if (!lib) return false;
    let delivered = 0;
    // Connects only to addresses that pass the egress check (DNS rebinding).
    const { httpsAgent } = createPublicEgressHttpAgents();
    for (const subscription of subscriptions) {
      try {
        // Rows saved before endpoints were checked on subscribe; an IP literal
        // never reaches the agent's lookup.
        await assertPublicEgressUrl(subscription.endpoint);
        await lib.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          JSON.stringify(payload),
          { TTL: 60 * 60 * 24, urgency: 'normal', agent: httpsAgent },
        );
        delivered += 1;
        await this.subscriptionRepository.update(subscription.id, { lastUsedAt: new Date() });
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await this.subscriptionRepository.delete(subscription.id);
          continue;
        }
        this.logger.warn(`Push to ${subscription.id} failed: ${String(error)}`);
      }
    }
    return delivered > 0;
  }

  private async loadLibrary(): Promise<WebPushModule | null> {
    if (this.webPush) return this.webPush;
    try {
      const lib = (await import('web-push')) as WebPushModule;
      lib.setVapidDetails(
        this.configService.get<string>('WEB_PUSH_SUBJECT') || 'mailto:admin@localhost',
        this.publicKey() as string,
        this.privateKey() as string,
      );
      this.webPush = lib;
      return lib;
    } catch (error) {
      this.logger.warn(`web-push is not installed: ${String(error)}`);
      return null;
    }
  }

  private privateKey(): string | null {
    return this.configService.get<string>('WEB_PUSH_VAPID_PRIVATE_KEY') || null;
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { appError } from '../../../common/errors/app-error';
import { WebhookDelivery, WebhookDeliveryStatus } from '../../../entities/webhook-delivery.entity';
import { WebhookEvent } from '../../../entities/webhook-subscription.entity';

@Injectable()
export class WebhookDeliveryService {
  constructor(
    @InjectRepository(WebhookDelivery)
    private readonly repo: Repository<WebhookDelivery>,
  ) {}

  async enqueue(
    subscriptionId: string,
    event: WebhookEvent,
    payload: Record<string, unknown>,
  ): Promise<WebhookDelivery> {
    const delivery = this.repo.create({
      subscriptionId,
      event,
      payload,
      status: WebhookDeliveryStatus.PENDING,
      nextAttemptAt: new Date(),
    });
    return this.repo.save(delivery);
  }

  async findForSubscription(subscriptionId: string): Promise<WebhookDelivery[]> {
    return this.repo.find({
      where: { subscriptionId },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  async findOneScoped(id: string, workspaceId: string): Promise<WebhookDelivery> {
    const delivery = await this.repo
      .createQueryBuilder('d')
      .innerJoin('d.subscription', 'sub')
      .where('d.id = :id', { id })
      .andWhere('sub.workspaceId = :workspaceId', { workspaceId })
      .getOne();
    if (!delivery) throw new NotFoundException(appError('WEBHOOK_DELIVERY_NOT_FOUND'));
    return delivery;
  }

  async resetForRetry(id: string): Promise<void> {
    await this.repo.update(id, {
      status: WebhookDeliveryStatus.PENDING,
      // An exhausted delivery has used every attempt; without this the claim
      // query (attempt_count < max_attempts) never picks it up again.
      attemptCount: 0,
      lastError: null,
      nextAttemptAt: new Date(),
      lockedAt: null,
      lockedBy: null,
    });
  }
}

import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { appError } from '../../../common/errors/app-error';
import { ActorType, AuditAction, EntityType } from '../../../entities/audit-event.entity';
import { CategorizationRule } from '../../../entities/categorization-rule.entity';
import { AuditService } from '../../audit/audit.service';

/** The order the workspace's rules are tried in: the first one that matches a row files it. */
@Injectable()
export class RuleOrderService {
  constructor(
    @InjectRepository(CategorizationRule)
    private readonly ruleRepository: Repository<CategorizationRule>,
    private readonly auditService: AuditService,
  ) {}

  /** A priority above every rule of the workspace: where a new rule goes. */
  async topPriority(workspaceId: string): Promise<number> {
    const top = await this.ruleRepository.findOne({
      select: { id: true, priority: true },
      where: { workspaceId },
      order: { priority: 'DESC' },
    });
    return top ? top.priority + 1 : 0;
  }

  /**
   * Puts the rules in the order given, first one on top. `ids` must name every
   * rule of the workspace and nothing else: a list made before another member
   * added or removed one would otherwise rank rules nobody saw.
   */
  async reorder(input: {
    workspaceId: string;
    userId: string;
    ids: readonly string[];
  }): Promise<CategorizationRule[]> {
    const { workspaceId, userId, ids } = input;
    const changes = await this.ruleRepository.manager.transaction(async manager => {
      const repository = manager.getRepository(CategorizationRule);
      const rules = await repository.find({
        where: { workspaceId },
        lock: { mode: 'pessimistic_write' },
      });
      const byId = new Map(rules.map(rule => [rule.id, rule]));
      if (
        new Set(ids).size !== ids.length ||
        ids.length !== rules.length ||
        !ids.every(id => byId.has(id))
      ) {
        throw new BadRequestException(appError('CATEGORIZATION_RULE_ORDER_STALE'));
      }
      const moved: { id: string; before: number; after: number }[] = [];
      for (const [index, id] of ids.entries()) {
        const rule = byId.get(id) as CategorizationRule;
        const priority = ids.length - index;
        if (rule.priority !== priority) {
          moved.push({ id, before: rule.priority, after: priority });
          await repository.update({ id, workspaceId }, { priority });
        }
      }
      return moved;
    });

    if (changes.length > 0) {
      await this.auditService.createBatchEvents(
        changes.map(change => ({
          workspaceId,
          actorType: ActorType.USER,
          actorId: userId,
          entityType: EntityType.RULE,
          entityId: change.id,
          action: AuditAction.UPDATE,
          diff: { before: { priority: change.before }, after: { priority: change.after } },
        })),
      );
    }

    return this.ruleRepository.find({
      where: { workspaceId },
      order: { priority: 'DESC', createdAt: 'DESC' },
    });
  }
}

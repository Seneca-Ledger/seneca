import { BadRequestException } from '@nestjs/common';
import type { EntityManager, Repository } from 'typeorm';
import { appError } from '../../../common/errors/app-error';
import { assertOwnerMemberInWorkspace } from '../../../common/utils/transaction-owner.util';
import {
  assertWorkspaceOwned,
  assertWorkspaceRefs,
} from '../../../common/utils/workspace-refs.util';
import { PaymentType } from '../../../contracts';
import { Tag } from '../../../entities/tag.entity';
import { Wallet } from '../../../entities/wallet.entity';
import type { WorkspaceMember } from '../../../entities/workspace-member.entity';
import type {
  ClassificationCondition,
  ClassificationResult,
} from '../interfaces/classification-rule.interface';

const DIRECTIONS = new Set(['income', 'expense']);
const PAYMENT_TYPES = new Set<string>(PaymentType.literals);

function invalid(condition: ClassificationCondition): BadRequestException {
  return new BadRequestException(
    appError('CATEGORIZATION_RULE_CONDITION_INVALID', {
      field: condition.field,
      value: String(condition.value),
    }),
  );
}

/**
 * A condition that could never hold is the caller's mistake, not a rule that
 * silently never fires: a regex that does not compile, a direction other than
 * income or expense, an amount that is not a number.
 */
export function assertConditionsValid(conditions: readonly ClassificationCondition[]): void {
  for (const condition of conditions) {
    if (condition.operator === 'regex') {
      try {
        new RegExp(String(condition.value), 'i');
      } catch {
        throw new BadRequestException(
          appError('CATEGORIZATION_RULE_PATTERN_INVALID', { pattern: String(condition.value) }),
        );
      }
    }
    if (condition.field === 'direction' && !DIRECTIONS.has(String(condition.value))) {
      throw invalid(condition);
    }
    if (
      condition.field === 'payment_type' &&
      (condition.operator !== 'equals' || !PAYMENT_TYPES.has(String(condition.value)))
    ) {
      throw invalid(condition);
    }
    if (condition.field === 'amount' && !Number.isFinite(Number(condition.value))) {
      throw invalid(condition);
    }
  }
}

/**
 * Every id a rule names, in its conditions and in what it sets, belongs to this
 * workspace: each row the rule matches would point at it.
 */
export async function assertRuleRefs(
  manager: EntityManager,
  members: Repository<WorkspaceMember>,
  workspaceId: string,
  rule: {
    conditions?: readonly ClassificationCondition[] | null;
    result?: ClassificationResult | null;
  },
): Promise<void> {
  const walletIds = (rule.conditions ?? [])
    .filter(condition => condition.field === 'wallet')
    .map(condition => String(condition.value));
  await Promise.all([
    assertWorkspaceOwned(manager, Wallet, walletIds, workspaceId),
    assertWorkspaceOwned(manager, Tag, rule.result?.tagIds ?? [], workspaceId),
    assertWorkspaceRefs(manager, workspaceId, rule.result ?? {}),
    assertOwnerMemberInWorkspace(members, workspaceId, rule.result?.ownerMemberId),
  ]);
}

import type { EntityManager, Repository } from 'typeorm';
import { type Category, CategoryType } from '../../../entities/category.entity';
import type { Transaction, TransactionType } from '../../../entities/transaction.entity';
import type { AutoCategoryMatch } from '../services/classification.service';
import { brandMatcher } from './brand-index';
import { suggestKey } from './category-suggester';
import type { KindContext } from './operation-kind';

const CONTEXT_TTL_MS = 5 * 60 * 1000;
const NO_CONTEXT: KindContext = { ownAccountTails: [], memberNames: [] };
const contexts = new Map<string, { at: number; value: Promise<KindContext> }>();

/**
 * The workspace's own account numbers and members' names, to keep money moved
 * between its own accounts out of "Transfers to people". Read once per
 * workspace and kept five minutes: an import classifies hundreds of rows.
 */
export function suggestionContext(
  manager: EntityManager,
  workspaceId: string,
): Promise<KindContext> {
  const cached = contexts.get(workspaceId);
  if (cached && Date.now() - cached.at < CONTEXT_TTL_MS) {
    return cached.value;
  }
  const value = (async (): Promise<KindContext> => {
    const [wallets, members] = await Promise.all([
      manager.query(
        `SELECT "account_number" FROM "wallets" WHERE "workspace_id" = $1 AND "account_number" IS NOT NULL`,
        [workspaceId],
      ) as Promise<Array<{ account_number: string }>>,
      manager.query(
        `SELECT u."name" FROM "workspace_members" m JOIN "users" u ON u."id" = m."user_id"
         WHERE m."workspace_id" = $1`,
        [workspaceId],
      ) as Promise<Array<{ name: string | null }>>,
    ]);
    return {
      ownAccountTails: wallets
        .map(wallet => wallet.account_number.replace(/\D/gu, ''))
        .filter(digits => digits.length >= 4)
        .map(digits => digits.slice(-4)),
      memberNames: members
        .map(member => (member.name ?? '').toLowerCase().split(/\s+/u).filter(Boolean))
        .filter(words => words.length >= 2),
    };
  })();
  contexts.set(workspaceId, { at: Date.now(), value });
  value.catch(() => contexts.delete(workspaceId));
  return value;
}

/**
 * A suggested category for a row its payee's history says nothing about,
 * filed under the workspace's default category for it. Nothing when that
 * category is disabled or of the other type: it is never created here.
 */
export async function suggestCategory(
  categories: Repository<Category>,
  transaction: Transaction,
  type: TransactionType,
  workspaceId: string,
): Promise<AutoCategoryMatch | undefined> {
  // The workspace's own accounts matter only for a transfer to a person, so
  // they are read only then.
  let suggestion = suggestKey(transaction, type, NO_CONTEXT, brandMatcher());
  if (suggestion?.key === 'transfers_people') {
    const ctx = await suggestionContext(categories.manager, workspaceId);
    suggestion = suggestKey(transaction, type, ctx, brandMatcher());
  }
  if (!suggestion) {
    return undefined;
  }
  const category = await categories.findOne({
    where: {
      workspaceId,
      systemKey: suggestion.key,
      type: type === 'income' ? CategoryType.INCOME : CategoryType.EXPENSE,
      isEnabled: true,
    },
  });
  return category
    ? { categoryId: category.id, source: suggestion.source, reason: suggestion.reason }
    : undefined;
}

import { offerAction } from '@/app/components/payees/offer-action-toast';
import type { Transaction } from '../editHelpers';
import { sameUnfiledPayeeRows } from '../helpers/payee-groups';
import { type CategoryCtx, saveCategoriesAction } from './statement-edit-sync';

/**
 * The rows the category drawer is open for. `spread`: a pick also files the
 * payee's other rows of this statement that still wait for a category.
 */
export type CategoryTarget = { ids: string[]; spread: boolean };

export type SpreadMessages = { alsoFiled: string; undo: string; keep: string };

export function spreadMessages(
  labels: Record<string, { value?: string } | undefined>,
): SpreadMessages {
  return {
    alsoFiled: labels.alsoFiledPayeeRows?.value ?? '',
    undo: labels.undo?.value ?? '',
    keep: labels.keep?.value ?? '',
  };
}

type ApplyArgs = {
  target: CategoryTarget;
  categoryId: string;
  transactions: Transaction[];
  ctx: CategoryCtx;
  messages: SpreadMessages;
};

function fill(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(params[key] ?? ''));
}

/**
 * Files the target rows. A row picked by itself takes its payee's waiting rows
 * along at once, and a toast offers to undo just those: within one statement
 * the same payee is nearly always the same category, and asking first would be
 * one more click per payee. Clearing a category never spreads.
 */
export async function applyCategoryToTarget({
  target,
  categoryId,
  transactions,
  ctx,
  messages,
}: ApplyArgs): Promise<void> {
  const picked = transactions.filter(row => target.ids.includes(row.id));
  const extra =
    target.spread && categoryId
      ? picked
          .flatMap(row => sameUnfiledPayeeRows(transactions, row))
          .filter((row, index, all) => all.findIndex(other => other.id === row.id) === index)
          .filter(row => !target.ids.includes(row.id))
      : [];
  const changes = Object.fromEntries(
    [...target.ids, ...extra.map(row => row.id)].map(id => [id, categoryId]),
  );
  const saved = await saveCategoriesAction(changes, ctx);
  if (!saved || extra.length === 0) {
    return;
  }
  const before = Object.fromEntries(extra.map(row => [row.id, row.categoryId ?? '']));
  const first = picked[0];
  offerAction({
    message: fill(messages.alsoFiled, {
      count: extra.length,
      payee: first?.payee?.name ?? first?.counterpartyName ?? '',
    }),
    applyLabel: messages.undo,
    dismissLabel: messages.keep,
    onApply: () => {
      void saveCategoriesAction(before, ctx);
    },
  });
}

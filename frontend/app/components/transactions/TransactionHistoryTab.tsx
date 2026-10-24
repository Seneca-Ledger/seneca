'use client';

import toast from 'react-hot-toast';
import { useIntlayer, useLocale } from '@/app/i18n';
import type { TransactionHistory, TransactionHistoryField } from '@/app/lib/contracts';
import { formatMoney } from '@/app/lib/format-money';
import { useCategoryName } from '@/app/lib/use-category-name';
import { useTransactionHistory, useUndoHistoryChange } from './hooks/useTransactionHistory';

type Entry = TransactionHistory['entries'][number];

const TEXT_FIELDS = new Set<TransactionHistoryField>(['name', 'purpose', 'comment']);

const fill = (template: string, params: Record<string, string | number>): string =>
  template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(params[key] ?? ''));

/**
 * What happened to one row, newest first: who, when, and each field that
 * changed as "was → now". A quiet line on the left ties the entries together
 * and ends where the row came from. A change whose fields still hold what it
 * wrote can be put back.
 */
export function TransactionHistoryTab({
  transactionId,
}: {
  transactionId: string;
}): React.JSX.Element {
  const t = useIntlayer('transactionHistory');
  const tDrawer = useIntlayer('transactionsDrawer');
  const { locale } = useLocale();
  const categoryName = useCategoryName();
  const { data, isLoading } = useTransactionHistory(transactionId, true);
  const undo = useUndoHistoryChange(transactionId);

  if (isLoading || !data) {
    return <p className="seneca-tx-history__loading">{tDrawer.loadingHistory}</p>;
  }

  const thisYear = new Date().getFullYear();
  const when = (iso: string) => {
    const at = new Date(iso);
    return new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      ...(at.getFullYear() === thisYear ? {} : { year: 'numeric' }),
      hour: '2-digit',
      minute: '2-digit',
    }).format(at);
  };
  const day = (value: string) =>
    new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${value}T00:00:00Z`));

  const labels: Record<TransactionHistoryField, string> = {
    category: t.fieldCategory.value,
    payee: t.fieldPayee.value,
    amount: t.fieldAmount.value,
    currency: t.fieldCurrency.value,
    type: t.fieldType.value,
    date: t.fieldDate.value,
    name: t.fieldName.value,
    purpose: t.fieldPurpose.value,
    account: t.fieldAccount.value,
    owner: t.fieldOwner.value,
    private: t.fieldPrivate.value,
    confirmed: t.fieldConfirmed.value,
    comment: t.fieldComment.value,
  };

  const show = (field: TransactionHistoryField, value: string | null): string => {
    switch (field) {
      case 'category':
        return value === null ? t.noCategory.value : categoryName(value);
      case 'owner':
        return value ?? t.shared.value;
      case 'private':
        return value === 'true' ? t.private.value : t.visible.value;
      case 'confirmed':
        return value === 'true' ? t.confirmed.value : t.unconfirmed.value;
      case 'type':
        return value === 'income' ? t.income.value : value === 'expense' ? t.expense.value : '–';
      case 'amount':
        return value === null
          ? '–'
          : data.currency
            ? formatMoney(Number(value), data.currency, locale)
            : value;
      case 'date':
        return value === null ? '–' : day(value);
      default:
        return value ?? '–';
    }
  };

  const who = (actor: Entry['actor']): string => {
    if (actor.kind === 'you') return t.you.value;
    if (actor.kind === 'rule') return fill(t.rule.value, { name: actor.name ?? '' });
    if (actor.kind === 'system') return t.system.value;
    return actor.name ?? t.system.value;
  };

  const note = (entry: Entry): string | null => {
    switch (entry.kind) {
      case 'created':
        return t.created.value;
      case 'attachment':
        return t.attachment.value;
      case 'split':
        return fill(t.split.value, { count: entry.parts ?? 2 });
      case 'unsplit':
        return t.unsplit.value;
      case 'rule':
        return t.ruleApplied.value;
      default:
        return null;
    }
  };

  const putBack = (entry: Entry) => {
    void undo
      .mutateAsync(entry.id)
      // The figures refresh with it; the drawer stays open on the row as it is now.
      .then(() => toast.success(t.undone.value))
      .catch(() => toast.error(t.undoFailed.value));
  };

  return (
    <ol className="seneca-tx-history">
      {data.entries.map(entry => {
        const text = note(entry);
        return (
          <li key={entry.id} className="seneca-tx-history__entry">
            <div className="seneca-tx-history__head">
              <span className="seneca-tx-history__who">{who(entry.actor)}</span>
              <time className="seneca-tx-history__when" dateTime={entry.at}>
                {when(entry.at)}
              </time>
              {entry.canUndo && (
                <button
                  type="button"
                  className="seneca-tx-history__undo"
                  disabled={undo.isPending}
                  onClick={() => putBack(entry)}
                >
                  {t.undo}
                </button>
              )}
            </div>
            {text && <p className="seneca-tx-history__note">{text}</p>}
            {entry.changes.length > 0 && (
              <dl className="seneca-tx-history__changes">
                {entry.changes.map(change => (
                  <div key={change.field} className="seneca-tx-history__change">
                    <dt>{labels[change.field]}</dt>
                    <dd>
                      {/* Text written where there was none reads as just the text. */}
                      {!(change.before === null && TEXT_FIELDS.has(change.field)) && (
                        <>
                          <span className="seneca-tx-history__was">
                            {show(change.field, change.before)}
                          </span>
                          <span aria-hidden className="seneca-tx-history__arrow">
                            →
                          </span>
                        </>
                      )}
                      <span>{show(change.field, change.after)}</span>
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </li>
        );
      })}
      <li className="seneca-tx-history__entry seneca-tx-history__entry--origin">
        <div className="seneca-tx-history__head">
          <span className="seneca-tx-history__who">
            {data.origin.statementName
              ? fill(t.originStatement.value, { name: data.origin.statementName })
              : t.originManual}
          </span>
          <time className="seneca-tx-history__when" dateTime={data.origin.at}>
            {when(data.origin.at)}
          </time>
        </div>
      </li>
    </ol>
  );
}

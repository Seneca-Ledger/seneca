'use client';

import toast from 'react-hot-toast';
import {
  ArrowLeftRight,
  Banknote,
  Calendar,
  CheckCircleOutline,
  CircleAlert,
  CircleDollarSign,
  Columns2,
  Eye,
  EyeOff,
  FileText,
  GitMerge,
  Landmark,
  type LucideIcon,
  MessageCircle,
  Pencil,
  PencilLine,
  Plus,
  Store,
  Tag,
  Upload,
  User,
  Workflow,
} from '@/app/components/icons';
import { useIntlayer, useLocale } from '@/app/i18n';
import type { TransactionHistory, TransactionHistoryField } from '@/app/lib/contracts';
import { formatMoney } from '@/app/lib/format-money';
import { useCategoryName } from '@/app/lib/use-category-name';
import { useTransactionHistory, useUndoHistoryChange } from './hooks/useTransactionHistory';

type Entry = TransactionHistory['entries'][number];

const TEXT_FIELDS = new Set<TransactionHistoryField>(['name', 'purpose', 'comment']);
/** Yes/no fields: the new state alone says what happened. */
const TOGGLE_FIELDS = new Set<TransactionHistoryField>(['confirmed', 'private']);

const FIELD_ICONS: Record<TransactionHistoryField, LucideIcon> = {
  category: Tag,
  payee: Store,
  amount: CircleDollarSign,
  currency: Banknote,
  type: ArrowLeftRight,
  date: Calendar,
  name: PencilLine,
  purpose: PencilLine,
  account: Landmark,
  owner: User,
  private: EyeOff,
  confirmed: CheckCircleOutline,
  comment: MessageCircle,
};
const KIND_ICONS: Record<Exclude<Entry['kind'], 'changed'>, LucideIcon> = {
  created: Plus,
  attachment: Upload,
  split: Columns2,
  unsplit: GitMerge,
  rule: Workflow,
};

const fill = (template: string, params: Record<string, string | number>): string =>
  template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(params[key] ?? ''));

/**
 * What happened to one row, newest first, as a timeline: an icon for what
 * changed, a title saying it, "was → now" below and who · when under that.
 * The line ends at a hollow icon for where the row came from. A change whose
 * fields still hold what it wrote can be put back.
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

  // One field changed: its name is the title, or for a yes/no field the new state.
  // Several: their names. Anything else says what happened.
  const title = (entry: Entry): string => {
    if (entry.kind === 'rule') return who(entry.actor);
    if (entry.kind !== 'changed') return note(entry) ?? '';
    const [only, ...rest] = entry.changes;
    if (!only) return '';
    if (rest.length === 0 && TOGGLE_FIELDS.has(only.field)) return show(only.field, only.after);
    return entry.changes.map(change => labels[change.field]).join(', ');
  };

  const icon = (entry: Entry): { Icon: LucideIcon; tone?: 'good' | 'attention' } => {
    if (entry.kind !== 'changed') return { Icon: KIND_ICONS[entry.kind] };
    const [only, ...rest] = entry.changes;
    if (!only || rest.length > 0) return { Icon: Pencil };
    if (only.field === 'confirmed') {
      return only.after === 'true'
        ? { Icon: CheckCircleOutline, tone: 'good' }
        : { Icon: CircleAlert, tone: 'attention' };
    }
    if (only.field === 'private' && only.after !== 'true') return { Icon: Eye };
    return { Icon: FIELD_ICONS[only.field] };
  };

  const value = (change: Entry['changes'][number]) => (
    <>
      {/* Text written where there was none reads as just the text. */}
      {!(change.before === null && TEXT_FIELDS.has(change.field)) && (
        <>
          <span className="seneca-tx-history__was">{show(change.field, change.before)}</span>
          <span aria-hidden className="seneca-tx-history__arrow">
            →
          </span>
        </>
      )}
      <span>{show(change.field, change.after)}</span>
    </>
  );

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
        const { Icon, tone } = icon(entry);
        // The title names the field of a lone change; otherwise each change carries its name.
        const [only, ...rest] = entry.changes;
        const titled = entry.kind === 'changed' && only && rest.length === 0;
        return (
          <li key={entry.id} className="seneca-tx-history__entry">
            <span
              aria-hidden
              className={`seneca-tx-history__icon${tone ? ` seneca-tx-history__icon--${tone}` : ''}`}
            >
              <Icon size={16} />
            </span>
            <div className="seneca-tx-history__body">
              <div className="seneca-tx-history__head">
                <span className="seneca-tx-history__title">{title(entry)}</span>
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
              {entry.kind === 'rule' && <p className="seneca-tx-history__note">{note(entry)}</p>}
              {titled && !TOGGLE_FIELDS.has(only.field) && (
                <p className="seneca-tx-history__value">{value(only)}</p>
              )}
              {!titled && entry.changes.length > 0 && (
                <dl className="seneca-tx-history__changes">
                  {entry.changes.map(change => (
                    <div key={change.field} className="seneca-tx-history__change">
                      <dt>{labels[change.field]}</dt>
                      <dd>{value(change)}</dd>
                    </div>
                  ))}
                </dl>
              )}
              <p className="seneca-tx-history__meta">
                {entry.kind !== 'rule' && (
                  <>
                    <span>{who(entry.actor)}</span>
                    <span aria-hidden> · </span>
                  </>
                )}
                <time dateTime={entry.at}>{when(entry.at)}</time>
              </p>
            </div>
          </li>
        );
      })}
      <li className="seneca-tx-history__entry seneca-tx-history__entry--origin">
        <span aria-hidden className="seneca-tx-history__icon">
          {data.origin.statementName ? <FileText size={16} /> : <PencilLine size={16} />}
        </span>
        <div className="seneca-tx-history__body">
          <div className="seneca-tx-history__head">
            <span className="seneca-tx-history__title">
              {data.origin.statementName
                ? fill(t.originStatement.value, { name: data.origin.statementName })
                : t.originManual}
            </span>
          </div>
          <p className="seneca-tx-history__meta">
            <time dateTime={data.origin.at}>{when(data.origin.at)}</time>
          </p>
        </div>
      </li>
    </ol>
  );
}

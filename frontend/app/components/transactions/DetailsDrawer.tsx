'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AuditEventDrawer } from '@/app/audit/components/AuditEventDrawer';
import { FileText } from '@/app/components/icons';
import { NotesPanel } from '@/app/components/notes/NotesPanel';
import { useIntlayer, useLocale } from '@/app/i18n';
import { FALLBACK_CURRENCY } from '@/app/lib/currency';
import { formatMoney } from '@/app/lib/format-money';

import { DrawerShell } from '../ui/drawer-shell';
import { PRIVATE_CLASS } from '../ui/private-amount';
import { TextTabs } from '../ui/text-tabs';
import { formatDate } from './helpers/transactionFormatters';
import { useTransactionHistory } from './hooks/useTransactionHistory';
import { useTransactionReviewActions } from './hooks/useTransactionReviewActions';
import { TransactionDetailsTab } from './TransactionDetailsTab';
import { TransactionHistoryTab } from './TransactionHistoryTab';
import type { Category, Transaction } from './types';

/** The document a row was read from: where to open it, and the account it is a statement of. */
export interface TransactionSource {
  href: string;
  name: string;
  account?: string | null;
}

interface DetailsDrawerProps {
  open: boolean;
  transaction: Transaction | null;
  categories: Category[];
  onClose: () => void;
  onUpdateCategory?: (txId: string, categoryId: string) => Promise<void>;
  onMarkIgnored?: (txId: string) => Promise<void>;
  onSplitDone?: () => void | Promise<void>;
  source?: TransactionSource;
  /** Refreshes the list and closes the drawer after the row is confirmed or deleted. */
  onChanged?: () => void;
}

type TabId = 'details' | 'notes' | 'history';

const EMPTY = '—';

/** Which transaction this is, before anything is done to it. */
function TransactionSummary({
  transaction,
  source,
}: {
  transaction: Transaction;
  source?: TransactionSource;
}): React.JSX.Element {
  const t = useIntlayer('transactionsDrawer');
  const { locale } = useLocale();
  const isIncome = transaction.credit > 0 && !(transaction.debit > 0);
  const amount = transaction.debit || transaction.credit;
  const account = transaction.wallet?.name ?? transaction.branch?.name ?? source?.account ?? null;
  const facts: Array<{ label: string; value: React.ReactNode }> = [
    { label: t.sheet.date.value, value: formatDate(transaction.transactionDate, locale) },
    ...(account ? [{ label: t.sheet.account.value, value: account }] : []),
    ...(source ? [{ label: t.sheet.document.value, value: source.name }] : []),
    ...(transaction.isVerified === undefined
      ? []
      : [
          {
            label: t.sheet.status.value,
            // A status is text with a small dot; ochre only where attention is due.
            value: (
              <span
                className={`seneca-tx-summary__status${transaction.isVerified ? '' : ' seneca-tx-summary__status--pending'}`}
              >
                {transaction.isVerified ? t.sheet.confirmed.value : t.sheet.unconfirmed.value}
              </span>
            ),
          },
        ]),
  ];

  return (
    <div className="seneca-tx-summary">
      <div className="seneca-tx-summary__merchant">
        {transaction.isPrivate ? EMPTY : transaction.counterpartyName || EMPTY}
      </div>
      {/* Ink, like every figure: spending is not an alarm. The sign says which way it went. */}
      <div className={`seneca-tx-summary__amount ${PRIVATE_CLASS}`}>
        {isIncome ? '+' : '−'}
        {formatMoney(amount, transaction.currency ?? FALLBACK_CURRENCY, locale)}
      </div>
      <dl className="seneca-tx-summary__facts">
        {facts.map(fact => (
          <div key={fact.label}>
            <dt>{fact.label}</dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** The drawer's main actions, pinned under the tabs: open the source, delete, confirm. */
function TransactionFooter({
  transaction,
  source,
  onChanged,
}: {
  transaction: Transaction;
  source?: TransactionSource;
  onChanged?: () => void;
}): React.JSX.Element {
  const t = useIntlayer('transactionsDrawer');
  const [askingDelete, setAskingDelete] = useState(false);
  const { confirm, remove, busy } = useTransactionReviewActions(
    {
      confirmed: t.sheet.confirmedToast.value,
      confirmFailed: t.sheet.confirmFailed.value,
      deleted: t.sheet.deletedToast.value,
      deleteFailed: t.sheet.deleteFailed.value,
    },
    onChanged,
  );

  // Deleting is final, so it asks once more, in place, rather than in a blocking dialog.
  if (askingDelete) {
    return (
      <div className="seneca-tx-footer">
        <span className="seneca-tx-footer__question">{t.sheet.deleteQuestion}</span>
        <button
          type="button"
          className="seneca-tx-footer__text-btn"
          onClick={() => setAskingDelete(false)}
          disabled={busy}
        >
          {t.transfer.cancel}
        </button>
        <button
          type="button"
          className="seneca-tx-footer__danger-btn"
          onClick={() => remove(transaction.id)}
          disabled={busy}
        >
          {t.sheet.delete}
        </button>
      </div>
    );
  }

  return (
    <div className="seneca-tx-footer">
      {source && (
        <Link href={source.href} className="seneca-tx-footer__text-btn">
          <FileText size={15} />
          {t.sheet.openDocument}
        </Link>
      )}
      <button
        type="button"
        className="seneca-tx-footer__text-btn seneca-tx-footer__text-btn--muted"
        onClick={() => setAskingDelete(true)}
        disabled={busy}
      >
        {t.sheet.delete}
      </button>
      {transaction.isVerified === false && (
        <button
          type="button"
          className="seneca-tx-footer__primary-btn"
          onClick={() => confirm(transaction.id)}
          disabled={busy}
        >
          {t.sheet.confirm}
        </button>
      )}
    </div>
  );
}

/**
 * Drawer component for displaying full transaction details and actions.
 * Composes the actions, notes and history of a transaction behind a tab switcher.
 */
export default function DetailsDrawer({
  open,
  transaction,
  categories,
  onClose,
  onUpdateCategory,
  onMarkIgnored,
  onSplitDone,
  source,
  onChanged,
}: DetailsDrawerProps) {
  const t = useIntlayer('transactionsDrawer');
  const notes = useIntlayer('notes');
  const [activeTab, setActiveTab] = useState<TabId>('details');

  const {
    historyEvents,
    historyLoading,
    historyDrawerOpen,
    selectedHistoryEvent,
    openEventDrawer,
    closeEventDrawer,
  } = useTransactionHistory(open, transaction?.id);

  if (!transaction) return null;

  const tabs: Array<{ value: TabId; label: React.ReactNode }> = [
    { value: 'details', label: t.tabDetails },
    { value: 'notes', label: notes.title },
    { value: 'history', label: t.tabHistory },
  ];

  return (
    <DrawerShell
      isOpen={open}
      onClose={onClose}
      title={<span className="seneca-tx-drawer__title">{t.title.value}</span>}
      position="right"
      width="md"
      lockScroll={false}
      footer={
        onChanged ? (
          <TransactionFooter transaction={transaction} source={source} onChanged={onChanged} />
        ) : undefined
      }
    >
      <div className="seneca-tx-drawer">
        <TransactionSummary transaction={transaction} source={source} />

        <div className="seneca-tx-drawer__tabs">
          <TextTabs<TabId>
            value={activeTab}
            onChange={setActiveTab}
            options={tabs}
            ariaLabel={t.title.value}
          />
        </div>

        {activeTab === 'details' && (
          <TransactionDetailsTab
            transaction={transaction}
            categories={categories}
            onUpdateCategory={onUpdateCategory}
            onMarkIgnored={onMarkIgnored}
            onSplitDone={onSplitDone}
          />
        )}
        {activeTab === 'notes' && (
          <NotesPanel
            // One panel per row, so an unsent note is saved on the row it was written for.
            key={transaction.id}
            entityType="transaction"
            entityId={transaction.id}
            showTitle={false}
          />
        )}
        {activeTab === 'history' && (
          <TransactionHistoryTab
            events={historyEvents}
            loading={historyLoading}
            onSelect={openEventDrawer}
          />
        )}
      </div>

      <AuditEventDrawer
        event={selectedHistoryEvent}
        open={historyDrawerOpen}
        onClose={closeEventDrawer}
      />
    </DrawerShell>
  );
}

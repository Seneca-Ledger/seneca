'use client';

import type React from 'react';
import { useIntlayer } from '@/app/i18n';
import type { useContributionLink } from './hooks/useContributionLink';
import { ActionRow } from './TransactionActionRow';
import type { Transaction } from './types';

type ContributionLink = ReturnType<typeof useContributionLink>;

interface InvestmentLinkProps {
  transaction: Transaction;
  contribution: ContributionLink;
}

/** Whether the row is linked to an investment account without a pair: a dividend. */
export function isInvestmentIncome(transaction: Transaction): boolean {
  return Boolean(transaction.investmentAccountId) && !transaction.transferPairId;
}

/**
 * The drawer's investment actions: an expense paid into an account, or income
 * taken back out of one or paid by it. A row already linked offers the undo.
 */
export function InvestmentLinkActions({
  transaction,
  contribution,
}: InvestmentLinkProps): React.JSX.Element | null {
  const t = useIntlayer('transactionsDrawer');
  if (transaction.reimbursementOfId) return null;
  const linked = transaction.transferPairKind === 'investment' || isInvestmentIncome(transaction);
  const busy = contribution.saving || contribution.loading || Boolean(transaction.splitGroupId);

  if (transaction.transactionType === 'expense') {
    if (linked) {
      return (
        <ActionRow
          label={t.investment.unlink.value}
          onClick={() => contribution.unlink(transaction.id)}
          disabled={contribution.saving}
        />
      );
    }
    return transaction.transferPairId ? null : (
      <ActionRow
        label={t.investment.link.value}
        hint={t.sheet.contributionHint}
        onClick={() => void contribution.loadAccounts('contribution')}
        disabled={busy}
      />
    );
  }

  if (transaction.transactionType !== 'income') return null;
  if (linked) {
    return (
      <ActionRow
        label={t.investment.unlinkIncome.value}
        onClick={() => contribution.unlink(transaction.id)}
        disabled={contribution.saving}
      />
    );
  }
  return transaction.transferPairId ? null : (
    <>
      <ActionRow
        label={t.investment.linkWithdrawal.value}
        onClick={() => void contribution.loadAccounts('withdrawal')}
        disabled={busy}
      />
      <ActionRow
        label={t.investment.linkIncome.value}
        onClick={() => void contribution.loadAccounts('income')}
        disabled={busy}
      />
    </>
  );
}

/** The accounts to link the row to, once the person has asked to link it. */
export function InvestmentAccountPicker({
  transaction,
  contribution,
}: InvestmentLinkProps): React.JSX.Element | null {
  const t = useIntlayer('transactionsDrawer');
  if (!contribution.accounts) return null;
  return (
    <div className="seneca-tx-detail__section" data-testid="contribution-accounts">
      <div className="seneca-tx-detail__label">
        {contribution.role === 'contribution'
          ? t.investment.pick.value
          : t.investment.pickSource.value}
      </div>
      {contribution.accounts.length === 0 ? (
        <div className="seneca-tx-detail__label">{t.investment.none.value}</div>
      ) : (
        <div className="seneca-tx-detail__actions">
          {contribution.accounts.map(account => (
            <button
              key={account.id}
              type="button"
              onClick={() => contribution.link(transaction.id, account.id)}
              disabled={contribution.saving}
              className="seneca-tx-detail__ignore-btn"
            >
              {account.name}
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={contribution.clearAccounts}
        className="seneca-tx-detail__ignore-btn"
      >
        {t.transfer.cancel.value}
      </button>
    </div>
  );
}

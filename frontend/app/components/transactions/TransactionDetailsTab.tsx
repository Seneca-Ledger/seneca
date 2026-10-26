'use client';

import NextLink from 'next/link';
import { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { CategoryPickerField } from '@/app/components/categories/CategoryPickerField';
import { TransactionPayeeSection } from '@/app/components/payees/TransactionPayeeSection';
import { useOfferPayeeQueue } from '@/app/components/payees/useOfferPayeeQueue';
import { RuleFromRowAction } from '@/app/components/rules/RuleFromRowAction';
import { fill } from '@/app/components/rules/rule-text';
import { PrivateAmount } from '@/app/components/ui/private-amount';
import { Select } from '@/app/components/ui/select';
import { useIntlayer, useLocale } from '@/app/i18n';
import { FALLBACK_CURRENCY } from '@/app/lib/currency';
import { isPrivateCategory, pickableCategories } from '@/app/lib/private-category';
import { getCategoryDisplayName } from '@/app/lib/statement-categories';
import { AccountPickSection } from './AccountPickSection';
import { formatAmount, formatDate } from './helpers/transactionFormatters';
import { useBulkUpdateOwner } from './hooks/useBulkUpdateOwner';
import { useContributionLink } from './hooks/useContributionLink';
import { useTransactionSplit } from './hooks/useTransactionSplit';
import { useTransferLink } from './hooks/useTransferLink';
import { useTransferToAccount } from './hooks/useTransferToAccount';
import { useWorkspaceMembers } from './hooks/useWorkspaceMembers';
import { OWNER_SHARED, ownerValueToMemberId } from './OwnerFilterDropdown';
import { SplitTransactionDialog } from './SplitTransactionDialog';
import { ActionRow } from './TransactionActionRow';
import type { Category, Transaction } from './types';

interface TransactionDetailsTabProps {
  transaction: Transaction;
  categories: Category[];
  onUpdateCategory?: (txId: string, categoryId: string) => Promise<void>;
  onMarkIgnored?: (txId: string) => Promise<void>;
  /** Refreshes the transaction list (and closes the drawer) after a split/unsplit. */
  onSplitDone?: () => void | Promise<void>;
}

export function TransactionDetailsTab({
  transaction,
  categories,
  onUpdateCategory,
  onMarkIgnored,
  onSplitDone,
}: TransactionDetailsTabProps) {
  const { locale } = useLocale();
  const t = useIntlayer('transactionsDrawer');
  const tOwner = useIntlayer('transactionOwner');
  const [ownerSaving, setOwnerSaving] = useState(false);
  const [privateSaving, setPrivateSaving] = useState(false);
  const members = useWorkspaceMembers();
  const updateOwner = useBulkUpdateOwner();
  const [updating, setUpdating] = useState(false);
  const [splitOpen, setSplitOpen] = useState(false);
  const offerPayeeQueue = useOfferPayeeQueue();
  const tRules = useIntlayer('categorizationRules');

  // The list refresh (and drawer close) is owned by the container — a split turns
  // one row into several, so the drawer must not keep showing the stale original.
  const handleSplitDone = useCallback(async () => {
    setSplitOpen(false);
    await onSplitDone?.();
  }, [onSplitDone]);
  const { split, unsplit, saving: splitSaving } = useTransactionSplit(handleSplitDone);

  const {
    candidates: transferCandidates,
    mode: linkMode,
    loadCandidates: loadTransferCandidates,
    clearCandidates: clearTransferCandidates,
    link: linkTransfer,
    unlink: unlinkTransfer,
    linkReimbursement,
    unlinkReimbursement,
    loading: transferLoading,
    saving: transferSaving,
  } = useTransferLink(handleSplitDone);
  const isReimbursementPair = transaction.transferPairKind === 'reimbursement';
  const isInvestmentPair = transaction.transferPairKind === 'investment';
  const contribution = useContributionLink(handleSplitDone);
  const toAccount = useTransferToAccount(transaction, handleSplitDone);

  // The pre-split total the backend validates against: the positive side of the
  // row, not `transaction.amount`, which the mappers sign for display.
  const splitTotal = transaction.debit > 0 ? Number(transaction.debit) : Number(transaction.credit);
  const splitCategories = pickableCategories(categories);
  const categoryOptions = categories.filter(
    cat => !isPrivateCategory(cat) && cat.isEnabled !== false,
  );
  // The picker shows the row's category, so picking applies straight away.
  const currentCategoryId = categoryOptions.some(cat => cat.id === transaction.category?.id)
    ? (transaction.category?.id ?? '')
    : '';

  const handleUpdateCategory = async (selectedCategoryId: string) => {
    if (!(selectedCategoryId && onUpdateCategory) || selectedCategoryId === currentCategoryId) {
      return;
    }

    await (async () => {
      setUpdating(true);
      await onUpdateCategory(transaction.id, selectedCategoryId);
      if (transaction.payee) {
        const picked = categories.find(category => category.id === selectedCategoryId);
        void offerPayeeQueue(
          transaction.payee,
          selectedCategoryId,
          picked ? getCategoryDisplayName(picked, locale) : '',
          [transaction.id],
        );
      }
    })()
      .catch(async error => {
        console.error('Failed to update category:', error);
      })
      .finally(async () => {
        setUpdating(false);
      });
  };

  const handleUpdateOwner = async (value: string) => {
    const successMessage = tOwner.ownerUpdated.value;
    const failureMessage = tOwner.ownerUpdateFailed.value;
    setOwnerSaving(true);
    await updateOwner
      .mutateAsync({ txIds: [transaction.id], ownerMemberId: ownerValueToMemberId(value) })
      .then(
        () => toast.success(successMessage),
        (error: unknown) => {
          console.error('Failed to update owner:', error);
          toast.error(failureMessage);
        },
      )
      .finally(() => setOwnerSaving(false));
  };

  const handleTogglePrivate = async (next: boolean) => {
    const successMessage = tOwner.ownerUpdated.value;
    const failureMessage = tOwner.ownerUpdateFailed.value;
    setPrivateSaving(true);
    await updateOwner
      .mutateAsync({ txIds: [transaction.id], isPrivate: next })
      .then(
        () => toast.success(successMessage),
        (error: unknown) => {
          console.error('Failed to update privacy:', error);
          toast.error(failureMessage);
        },
      )
      .finally(() => setPrivateSaving(false));
  };

  const handleMarkIgnored = async () => {
    if (!onMarkIgnored) return;

    await (async () => {
      await onMarkIgnored(transaction.id);
    })().catch(async error => {
      console.error('Failed to mark as ignored:', error);
    });
  };

  return (
    <div className="seneca-tx-detail">
      {/* Actions */}
      {transaction.transferPairId && (
        <div className="seneca-tx-detail__cat-badge" data-testid="transfer-badge">
          {isInvestmentPair
            ? t.investment.badge.value
            : isReimbursementPair
              ? t.reimbursement.badge.value
              : t.transfer.badge.value}
        </div>
      )}
      {transaction.reimbursementOf && (
        <div
          className="seneca-tx-detail__value"
          style={{ fontSize: 12, color: 'var(--muted-foreground)' }}
          data-testid="reimburses"
        >
          {t.reimbursement.reimburses.value}:{' '}
          {formatDate(transaction.reimbursementOf.transactionDate, locale)} ·{' '}
          {transaction.reimbursementOf.counterpartyName}
          {transaction.transferPairId ? '' : ` · ${t.reimbursement.partial.value}`}
        </div>
      )}

      <div className="seneca-tx-detail__actions">
        {/* Set Category */}
        {onUpdateCategory && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label htmlFor="category-select" className="seneca-tx-detail__field-label">
              {t.splitDialog.category.value}
            </label>
            <div className="seneca-tx-detail__set-cat">
              <CategoryPickerField
                id="category-select"
                // A category just created is not in `categories` yet; the field still names it.
                value={currentCategoryId || (transaction.category?.id ?? '')}
                categories={categoryOptions}
                onChange={categoryId => void handleUpdateCategory(categoryId)}
                disabled={updating}
                placeholder={t.selectCategory.value}
                sx={{ flex: 1 }}
              />
            </div>
            {transaction.categorySource === 'rule' && transaction.categoryReason && (
              <NextLink href="/rules" className="seneca-tx-detail__rule-link">
                {fill(tRules.drawer.fromRule.value, { name: transaction.categoryReason })}
              </NextLink>
            )}
          </div>
        )}

        {/* Who the money went to or came from, and how that payee is filed */}
        {!transaction.isPrivate && (
          <TransactionPayeeSection
            key={transaction.id}
            transactionId={transaction.id}
            payee={transaction.payee ?? null}
            counterpartyName={transaction.counterpartyName}
            categories={categoryOptions}
            transactionCategoryId={transaction.category?.id ?? null}
          />
        )}

        {/* Who in the household it belongs to */}
        {members.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label htmlFor="owner-select" className="seneca-tx-detail__field-label">
              {tOwner.assignOwner.value}
            </label>
            <Select
              id="owner-select"
              value={transaction.ownerMemberId ?? OWNER_SHARED}
              onChange={value => void handleUpdateOwner(value)}
              disabled={ownerSaving}
              options={[
                { value: OWNER_SHARED, label: tOwner.shared.value },
                ...members.map(member => ({
                  value: member.memberId,
                  label: member.isSelf ? tOwner.me.value : member.label,
                })),
              ]}
              sx={{ flex: 1 }}
            />
          </div>
        )}

        {/* Hidden from the rest of the household */}
        {members.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label className="seneca-tx-detail__check">
              <input
                type="checkbox"
                checked={transaction.isPrivate === true}
                disabled={privateSaving || !transaction.ownerMemberId}
                onChange={event => void handleTogglePrivate(event.target.checked)}
              />
              {tOwner.makePrivate.value}
            </label>
            {!transaction.ownerMemberId && (
              <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
                {tOwner.privateOwnerOnly.value}
              </span>
            )}
          </div>
        )}

        {/* What can be done to the row: a list, each with a line on what it means. */}
        <div className="seneca-tx-detail__action-list">
          {/* Split / Undo split */}
          {onSplitDone &&
            (transaction.splitGroupId ? (
              <ActionRow
                label={splitSaving ? t.undoingSplit.value : t.undoSplit.value}
                onClick={() => unsplit(transaction.id)}
                disabled={splitSaving}
              />
            ) : (
              <ActionRow
                label={t.split}
                hint={t.sheet.splitHint}
                onClick={() => setSplitOpen(true)}
                disabled={splitSaving || splitTotal <= 0}
              />
            ))}

          {/* Reimbursement of an expense (incoming rows only) */}
          {onSplitDone &&
            transaction.transactionType === 'income' &&
            (transaction.reimbursementOfId ? (
              <ActionRow
                label={t.reimbursement.unlink.value}
                onClick={() => unlinkReimbursement(transaction.id)}
                disabled={transferSaving}
              />
            ) : (
              !transaction.transferPairId && (
                <ActionRow
                  label={t.reimbursement.link.value}
                  hint={t.sheet.reimbursementHint}
                  onClick={() => void loadTransferCandidates(transaction.id, 'reimbursement')}
                  disabled={transferSaving || transferLoading || Boolean(transaction.splitGroupId)}
                />
              )
            ))}

          {/* Money moved into an investment account (outgoing rows only) */}
          {onSplitDone &&
            transaction.transactionType === 'expense' &&
            !transaction.reimbursementOfId &&
            (isInvestmentPair ? (
              <ActionRow
                label={t.investment.unlink.value}
                onClick={() => contribution.unlink(transaction.id)}
                disabled={contribution.saving}
              />
            ) : (
              !transaction.transferPairId && (
                <ActionRow
                  label={t.investment.link.value}
                  hint={t.sheet.contributionHint}
                  onClick={() => void contribution.loadAccounts()}
                  disabled={
                    contribution.saving || contribution.loading || Boolean(transaction.splitGroupId)
                  }
                />
              )
            ))}

          {/* Transfer between own accounts */}
          {onSplitDone &&
            !isReimbursementPair &&
            !isInvestmentPair &&
            !transaction.reimbursementOfId &&
            (transaction.transferPairId ? (
              <ActionRow
                label={transferSaving ? t.transfer.unlinking.value : t.transfer.unlink.value}
                onClick={() => unlinkTransfer(transaction.id)}
                disabled={transferSaving}
              />
            ) : (
              <>
                <ActionRow
                  label={t.transfer.link.value}
                  hint={t.sheet.transferHint}
                  onClick={() => void loadTransferCandidates(transaction.id)}
                  disabled={transferSaving || transferLoading || Boolean(transaction.splitGroupId)}
                />
                <ActionRow
                  label={t.transfer.toAccount.value}
                  hint={t.sheet.toAccountHint}
                  onClick={() => toAccount.setOpen(true)}
                  disabled={toAccount.saving || Boolean(transaction.splitGroupId)}
                />
              </>
            ))}

          {/* Mark as Ignored */}
          {onMarkIgnored && (
            <ActionRow label={t.markIgnored.value} onClick={() => void handleMarkIgnored()} />
          )}

          {/* A rule from this row: the payee as the bank wrote it, the row's category */}
          <RuleFromRowAction transaction={transaction} categoryId={currentCategoryId} />
        </div>
      </div>

      {toAccount.open && !toAccount.loading && (
        <AccountPickSection
          testId="transfer-accounts"
          title={t.transfer.pickAccount.value}
          empty={t.transfer.noAccounts.value.replace('{{currency}}', transaction.currency ?? '')}
          accounts={toAccount.options}
          saving={toAccount.saving}
          onPick={id => void toAccount.move(id)}
          onCancel={() => toAccount.setOpen(false)}
          cancelLabel={t.transfer.cancel.value}
        />
      )}

      {contribution.accounts && (
        <AccountPickSection
          testId="contribution-accounts"
          title={t.investment.pick.value}
          empty={t.investment.none.value}
          accounts={contribution.accounts}
          saving={contribution.saving}
          onPick={id => contribution.link(transaction.id, id)}
          onCancel={contribution.clearAccounts}
          cancelLabel={t.transfer.cancel.value}
        />
      )}

      {transferCandidates && (
        <div className="seneca-tx-detail__section" data-testid="transfer-candidates">
          <div className="seneca-tx-detail__label">
            {linkMode === 'reimbursement' ? t.reimbursement.pick.value : t.transfer.pick.value}
          </div>
          {transferCandidates.length === 0 ? (
            <div className="seneca-tx-detail__value">
              {linkMode === 'reimbursement'
                ? t.reimbursement.noCandidates.value
                : t.transfer.noCandidates.value}
            </div>
          ) : (
            transferCandidates.map(candidate => (
              <button
                key={candidate.id}
                type="button"
                onClick={() =>
                  linkMode === 'reimbursement'
                    ? linkReimbursement(transaction.id, candidate.id)
                    : linkTransfer(transaction.id, candidate.id)
                }
                disabled={transferSaving}
                className="seneca-tx-detail__ignore-btn"
                style={{ display: 'block', width: '100%', textAlign: 'left', marginTop: 6 }}
              >
                {formatDate(candidate.transactionDate, locale)} · {candidate.counterpartyName} ·{' '}
                <PrivateAmount>
                  {formatAmount(
                    Math.abs(candidate.amount),
                    candidate.currency ?? transaction.currency ?? 'KZT',
                    locale,
                  )}
                </PrivateAmount>
              </button>
            ))
          )}
          <button
            type="button"
            onClick={clearTransferCandidates}
            className="seneca-tx-detail__ignore-btn"
            style={{ marginTop: 6 }}
          >
            {t.transfer.cancel.value}
          </button>
        </div>
      )}

      {onSplitDone && !transaction.splitGroupId && (
        <SplitTransactionDialog
          open={splitOpen}
          transactionId={transaction.id}
          totalAmount={splitTotal}
          currency={transaction.currency ?? FALLBACK_CURRENCY}
          categories={splitCategories}
          saving={splitSaving}
          onClose={() => setSplitOpen(false)}
          onSubmit={parts => {
            void split(transaction.id, parts);
          }}
        />
      )}
    </div>
  );
}

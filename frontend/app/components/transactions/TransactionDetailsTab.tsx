/* eslint-disable max-lines */
'use client';

import { useTheme } from 'next-themes';
import { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Building2,
  Calendar,
  FileText,
  Tag,
  TrendingDown,
  TrendingUp,
} from '@/app/components/icons';
import { Select } from '@/app/components/ui/select';
import { useCurrencyDisplay } from '@/app/contexts/CurrencyDisplayContext';
import { useIntlayer, useLocale } from '@/app/i18n';
import { FALLBACK_CURRENCY } from '@/app/lib/currency';
import { isPrivateCategory, pickableCategories } from '@/app/lib/private-category';
import { getCategoryDisplayName } from '@/app/lib/statement-categories';
import { tokens } from '@/lib/theme-tokens';
import { ConvertedAmountRow } from './ConvertedAmountRow';
import { formatAmount, formatDate } from './helpers/transactionFormatters';
import { useBulkUpdateOwner } from './hooks/useBulkUpdateOwner';
import { useContributionLink } from './hooks/useContributionLink';
import { useTransactionSplit } from './hooks/useTransactionSplit';
import { useTransferLink } from './hooks/useTransferLink';
import { useWorkspaceMembers } from './hooks/useWorkspaceMembers';
import { OWNER_SHARED, ownerValueToMemberId } from './OwnerFilterDropdown';
import { SplitTransactionDialog } from './SplitTransactionDialog';
import type { Category, Transaction } from './types';

interface TransactionDetailsTabProps {
  transaction: Transaction;
  categories: Category[];
  // eslint-disable-next-line max-params
  onUpdateCategory?: (txId: string, categoryId: string) => Promise<void>;
  onMarkIgnored?: (txId: string) => Promise<void>;
  /** Refreshes the transaction list (and closes the drawer) after a split/unsplit. */
  onSplitDone?: () => void | Promise<void>;
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/explicit-module-boundary-types, max-lines-per-function, complexity
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
  const { showConverted, workspaceCurrency } = useCurrencyDisplay();
  const { resolvedTheme } = useTheme();
  const c = resolvedTheme === 'dark' ? tokens.dark.color : tokens.color;
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [ownerSaving, setOwnerSaving] = useState(false);
  const [privateSaving, setPrivateSaving] = useState(false);
  const members = useWorkspaceMembers();
  const updateOwner = useBulkUpdateOwner();
  const [updating, setUpdating] = useState(false);
  const [splitOpen, setSplitOpen] = useState(false);

  // The list refresh (and drawer close) is owned by the container — a split turns
  // one row into several, so the drawer must not keep showing the stale original.
  const handleSplitDone = useCallback(async () => {
    setSplitOpen(false);
    await onSplitDone?.();
  }, [onSplitDone]);
  const { split, unsplit, saving: splitSaving } = useTransactionSplit(handleSplitDone);
  const categorySourceLabels = {
    manual: t.categorySource.manual.value,
    rule: t.categorySource.rule.value,
    keyword: t.categorySource.keyword.value,
    learned: t.categorySource.learned.value,
    history: t.categorySource.history.value,
    ai: t.categorySource.ai.value,
    default: t.categorySource.default.value,
  };
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

  // The pre-split total the backend validates against: the positive side of the
  // row, not `transaction.amount`, which the mappers sign for display.
  const splitTotal = transaction.debit > 0 ? Number(transaction.debit) : Number(transaction.credit);
  const splitCategories = pickableCategories(categories);

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const handleUpdateCategory = async () => {
    if (!(selectedCategoryId && onUpdateCategory)) return;

    await (async () => {
      setUpdating(true);
      await onUpdateCategory(transaction.id, selectedCategoryId);
      setSelectedCategoryId('');
    })()
      .catch(async error => {
        console.error('Failed to update category:', error);
      })
      .finally(async () => {
        setUpdating(false);
      });
  };

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
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

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
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

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const handleMarkIgnored = async () => {
    if (!onMarkIgnored) return;

    await (async () => {
      await onMarkIgnored(transaction.id);
    })().catch(async error => {
      console.error('Failed to mark as ignored:', error);
    });
  };

  return (
    <div className="lumio-tx-detail">
      {/* Date and Document */}
      <div className="lumio-tx-detail__section">
        <div className="lumio-tx-detail__icon-row">
          <div className="lumio-tx-detail__icon">
            <Calendar size={20} color={c.ink700} />
          </div>
          <div className="lumio-tx-detail__field">
            <div className="lumio-tx-detail__label">{t.date.value}</div>
            <div className="lumio-tx-detail__value">
              {formatDate(transaction.transactionDate, locale)}
            </div>
          </div>
        </div>

        {transaction.documentNumber && (
          <div className="lumio-tx-detail__icon-row">
            <div className="lumio-tx-detail__icon">
              <FileText size={20} color={c.ink700} />
            </div>
            <div className="lumio-tx-detail__field">
              <div className="lumio-tx-detail__label">{t.documentNumber.value}</div>
              <div className="lumio-tx-detail__value">{transaction.documentNumber}</div>
            </div>
          </div>
        )}
      </div>

      {/* Counterparty */}
      <div className="lumio-tx-detail__card">
        <div className="lumio-tx-detail__icon-row">
          <div className="lumio-tx-detail__icon--white">
            <Building2 size={20} color={c.ink700} />
          </div>
          <div className="lumio-tx-detail__field">
            <div className="lumio-tx-detail__label">{t.counterparty.value}</div>
            <div className="lumio-tx-detail__value" style={{ fontWeight: 700 }}>
              {transaction.counterpartyName}
            </div>
            {transaction.counterpartyBin && (
              <div style={{ marginTop: 4, fontSize: 12, color: c.ink700 }}>
                {t.bin.value}: {transaction.counterpartyBin}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Payment Purpose */}
      <div>
        <div className="lumio-tx-detail__label">{t.purpose.value}</div>
        <div
          className="lumio-tx-detail__card"
          style={{ marginTop: 8, fontSize: 14, color: c.ink900 }}
        >
          {transaction.paymentPurpose || '—'}
        </div>
      </div>

      {/* Amounts */}
      <div className="lumio-tx-detail__amount-grid">
        <div className="lumio-tx-detail__amount-card lumio-tx-detail__amount-card--debit">
          <div className="lumio-tx-detail__amount-label lumio-tx-detail__amount-label--debit">
            <TrendingDown size={16} />
            {t.debit.value}
          </div>
          <div className="lumio-tx-detail__amount-value lumio-tx-detail__amount-value--debit">
            {transaction.debit > 0 ? (
              <>
                {showConverted && transaction.convertedAmount !== undefined
                  ? formatAmount(
                      transaction.convertedAmount,
                      transaction.convertedCurrency ?? FALLBACK_CURRENCY,
                      locale,
                    )
                  : formatAmount(
                      transaction.debit,
                      transaction.currency ?? FALLBACK_CURRENCY,
                      locale,
                    )}
                {showConverted && transaction.convertedAmount !== undefined && (
                  <div
                    style={{
                      marginTop: 2,
                      fontSize: 12,
                      fontWeight: 400,
                      color: 'var(--color-error-soft-border)',
                    }}
                  >
                    {formatAmount(
                      transaction.debit,
                      transaction.currency ?? FALLBACK_CURRENCY,
                      locale,
                    )}
                  </div>
                )}
              </>
            ) : (
              '—'
            )}
          </div>
        </div>

        <div className="lumio-tx-detail__amount-card lumio-tx-detail__amount-card--credit">
          <div className="lumio-tx-detail__amount-label lumio-tx-detail__amount-label--credit">
            <TrendingUp size={16} />
            {t.credit.value}
          </div>
          <div className="lumio-tx-detail__amount-value lumio-tx-detail__amount-value--credit">
            {transaction.credit > 0 ? (
              <>
                {showConverted && transaction.convertedAmount !== undefined
                  ? formatAmount(
                      transaction.convertedAmount,
                      transaction.convertedCurrency ?? FALLBACK_CURRENCY,
                      locale,
                    )
                  : formatAmount(
                      transaction.credit,
                      transaction.currency ?? FALLBACK_CURRENCY,
                      locale,
                    )}
                {showConverted && transaction.convertedAmount !== undefined && (
                  <div
                    style={{
                      marginTop: 2,
                      fontSize: 12,
                      fontWeight: 400,
                      color: 'var(--color-success-soft-border)',
                    }}
                  >
                    {formatAmount(
                      transaction.credit,
                      transaction.currency ?? FALLBACK_CURRENCY,
                      locale,
                    )}
                  </div>
                )}
              </>
            ) : (
              '—'
            )}
          </div>
        </div>
      </div>

      {/* Additional Details */}
      <div className="lumio-tx-detail__card">
        <div className="lumio-tx-detail__label" style={{ color: c.ink800, marginBottom: 8 }}>
          {t.additionalDetails.value}
        </div>

        {transaction.currency && (
          <div className="lumio-tx-detail__row">
            <span style={{ color: c.ink700 }}>{t.currency.value}:</span>
            <span style={{ fontWeight: 600, color: c.ink900 }}>{transaction.currency}</span>
          </div>
        )}

        {transaction.currency && transaction.currency.toUpperCase() !== workspaceCurrency && (
          <ConvertedAmountRow
            amount={transaction.amount}
            currency={transaction.currency}
            date={transaction.transactionDate}
            workspaceCurrency={workspaceCurrency}
            label={t.converted.value}
            noRateLabel={t.noRate.value}
            formatAmount={(value, code) => formatAmount(value, code, locale)}
            inkLabel={c.ink700}
            inkValue={c.ink900}
          />
        )}

        {transaction.exchangeRate && (
          <div className="lumio-tx-detail__row">
            <span style={{ color: c.ink700 }}>{t.exchangeRate.value}:</span>
            <span style={{ fontWeight: 600, color: c.ink900 }}>
              {transaction.exchangeRate.toFixed(4)}
            </span>
          </div>
        )}

        {transaction.article && (
          <div className="lumio-tx-detail__row">
            <span style={{ color: c.ink700 }}>{t.article.value}:</span>
            <span style={{ fontWeight: 600, color: c.ink900 }}>{transaction.article}</span>
          </div>
        )}

        {transaction.branch?.name && (
          <div className="lumio-tx-detail__row">
            <span style={{ color: c.ink700 }}>{t.branch.value}:</span>
            <span style={{ fontWeight: 600, color: c.ink900 }}>{transaction.branch.name}</span>
          </div>
        )}

        {transaction.wallet?.name && (
          <div className="lumio-tx-detail__row">
            <span style={{ color: c.ink700 }}>{t.wallet.value}:</span>
            <span style={{ fontWeight: 600, color: c.ink900 }}>{transaction.wallet.name}</span>
          </div>
        )}
      </div>

      {/* Parsing Metadata */}
      {(transaction.parsingConfidence || transaction.rawExtract) && (
        <div className="lumio-tx-detail__card lumio-tx-detail__card--blue">
          <div
            className="lumio-tx-detail__label"
            style={{ color: 'var(--color-info-soft-text)', marginBottom: 8 }}
          >
            {t.parsingMetadata.value}
          </div>

          {transaction.parsingConfidence && (
            <div className="lumio-tx-detail__row">
              <span style={{ color: '#2563eb' }}>{t.confidence.value}:</span>
              <span style={{ fontWeight: 600, color: '#1e3a8a' }}>
                {(transaction.parsingConfidence * 100).toFixed(1)}%
              </span>
            </div>
          )}

          {transaction.rawExtract && (
            <div style={{ marginTop: 8 }}>
              <span style={{ fontSize: 12, color: '#2563eb' }}>{t.rawExtract.value}:</span>
              <div
                style={{
                  marginTop: 4,
                  maxHeight: 80,
                  overflowY: 'auto',
                  borderRadius: tokens.radius.md,
                  backgroundColor: 'rgba(191, 219, 254, 0.8)',
                  padding: 8,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  color: '#1e3a8a',
                }}
              >
                {transaction.rawExtract}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Current Category */}
      <div className="lumio-tx-detail__card">
        <div
          className="lumio-tx-detail__label"
          style={{ display: 'flex', alignItems: 'center', gap: 8, color: c.ink800 }}
        >
          <Tag size={16} />
          {t.currentCategory.value}
        </div>
        <div style={{ marginTop: 8 }}>
          {transaction.category ? (
            <span
              className="lumio-tx-detail__cat-badge"
              style={{
                backgroundColor:
                  transaction.category.isEnabled === false
                    ? 'var(--color-error-soft-bg)'
                    : transaction.category.color
                      ? `${transaction.category.color}15`
                      : c.ink150,
                color:
                  transaction.category.isEnabled === false
                    ? '#b91c1c'
                    : transaction.category.color || c.ink800,
              }}
            >
              {transaction.category.isEnabled === false
                ? `${getCategoryDisplayName(transaction.category, locale)} — ${t.disabledCategoryHint.value}`
                : getCategoryDisplayName(transaction.category, locale)}
            </span>
          ) : (
            <span style={{ fontSize: 14, color: c.ink500 }}>{t.noCategory.value}</span>
          )}
        </div>
        {transaction.categorySource && (
          <div
            className="lumio-tx-detail__value"
            style={{ marginTop: 8, fontSize: 12, color: 'var(--muted-foreground)' }}
            data-testid="category-source"
          >
            {t.categorySource.label.value}: {categorySourceLabels[transaction.categorySource]}
            {transaction.categoryReason ? ` · ${transaction.categoryReason}` : ''}
          </div>
        )}
      </div>

      {/* Actions */}
      {transaction.transferPairId && (
        <div className="lumio-tx-detail__cat-badge" data-testid="transfer-badge">
          {isInvestmentPair
            ? t.investment.badge.value
            : isReimbursementPair
              ? t.reimbursement.badge.value
              : t.transfer.badge.value}
        </div>
      )}
      {transaction.reimbursementOf && (
        <div
          className="lumio-tx-detail__value"
          style={{ fontSize: 12, color: 'var(--muted-foreground)' }}
          data-testid="reimburses"
        >
          {t.reimbursement.reimburses.value}:{' '}
          {formatDate(transaction.reimbursementOf.transactionDate, locale)} ·{' '}
          {transaction.reimbursementOf.counterpartyName}
          {transaction.transferPairId ? '' : ` · ${t.reimbursement.partial.value}`}
        </div>
      )}

      <div className="lumio-tx-detail__actions">
        <div style={{ fontSize: 14, fontWeight: 600, color: c.ink900 }}>{t.actions.value}</div>

        {/* Set Category */}
        {onUpdateCategory && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label
              htmlFor="category-select"
              style={{ display: 'block', fontSize: 12, fontWeight: 600, color: c.ink800 }}
            >
              {t.setCategory.value}
            </label>
            <div className="lumio-tx-detail__set-cat">
              <Select
                id="category-select"
                value={selectedCategoryId}
                onChange={setSelectedCategoryId}
                options={[
                  { value: '', label: t.selectCategory.value },
                  ...categories
                    .filter(cat => !isPrivateCategory(cat) && cat.isEnabled !== false)
                    .map(cat => ({ value: cat.id, label: getCategoryDisplayName(cat, locale) })),
                ]}
                sx={{ flex: 1 }}
              />
              <button
                type="button"
                onClick={handleUpdateCategory}
                disabled={!selectedCategoryId || updating}
                className="lumio-tx-detail__apply-btn"
              >
                {updating ? t.updating.value : t.apply.value}
              </button>
            </div>
          </div>
        )}

        {/* Who in the household it belongs to */}
        {members.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label
              htmlFor="owner-select"
              style={{ display: 'block', fontSize: 12, fontWeight: 600, color: c.ink800 }}
            >
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
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 12,
                fontWeight: 600,
                color: c.ink800,
              }}
            >
              <input
                type="checkbox"
                checked={transaction.isPrivate === true}
                disabled={privateSaving || !transaction.ownerMemberId}
                onChange={event => void handleTogglePrivate(event.target.checked)}
              />
              {tOwner.makePrivate.value}
            </label>
            <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
              {transaction.ownerMemberId ? tOwner.privateHint.value : tOwner.privateOwnerOnly.value}
            </span>
          </div>
        )}

        {/* Split / Undo split */}
        {onSplitDone &&
          (transaction.splitGroupId ? (
            <button
              type="button"
              onClick={() => unsplit(transaction.id)}
              disabled={splitSaving}
              className="lumio-tx-detail__ignore-btn"
            >
              {splitSaving ? t.undoingSplit.value : t.undoSplit.value}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setSplitOpen(true)}
              disabled={splitSaving || splitTotal <= 0}
              className="lumio-tx-detail__ignore-btn"
            >
              {t.split}
            </button>
          ))}

        {/* Reimbursement of an expense (incoming rows only) */}
        {onSplitDone &&
          transaction.transactionType === 'income' &&
          (transaction.reimbursementOfId ? (
            <button
              type="button"
              onClick={() => unlinkReimbursement(transaction.id)}
              disabled={transferSaving}
              className="lumio-tx-detail__ignore-btn"
            >
              {t.reimbursement.unlink.value}
            </button>
          ) : (
            !transaction.transferPairId && (
              <button
                type="button"
                onClick={() => {
                  void loadTransferCandidates(transaction.id, 'reimbursement');
                }}
                disabled={transferSaving || transferLoading || Boolean(transaction.splitGroupId)}
                className="lumio-tx-detail__ignore-btn"
              >
                {t.reimbursement.link.value}
              </button>
            )
          ))}

        {/* Money moved into an investment account (outgoing rows only) */}
        {onSplitDone &&
          transaction.transactionType === 'expense' &&
          !transaction.reimbursementOfId &&
          (isInvestmentPair ? (
            <button
              type="button"
              onClick={() => contribution.unlink(transaction.id)}
              disabled={contribution.saving}
              className="lumio-tx-detail__ignore-btn"
            >
              {t.investment.unlink.value}
            </button>
          ) : (
            !transaction.transferPairId && (
              <button
                type="button"
                onClick={() => {
                  void contribution.loadAccounts();
                }}
                disabled={
                  contribution.saving || contribution.loading || Boolean(transaction.splitGroupId)
                }
                className="lumio-tx-detail__ignore-btn"
              >
                {t.investment.link.value}
              </button>
            )
          ))}

        {/* Transfer between own accounts */}
        {onSplitDone &&
          !isReimbursementPair &&
          !isInvestmentPair &&
          !transaction.reimbursementOfId &&
          (transaction.transferPairId ? (
            <button
              type="button"
              onClick={() => unlinkTransfer(transaction.id)}
              disabled={transferSaving}
              className="lumio-tx-detail__ignore-btn"
            >
              {transferSaving ? t.transfer.unlinking.value : t.transfer.unlink.value}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                void loadTransferCandidates(transaction.id);
              }}
              disabled={transferSaving || transferLoading || Boolean(transaction.splitGroupId)}
              className="lumio-tx-detail__ignore-btn"
            >
              {t.transfer.link.value}
            </button>
          ))}

        {/* Mark as Ignored */}
        {onMarkIgnored && (
          <button type="button" onClick={handleMarkIgnored} className="lumio-tx-detail__ignore-btn">
            {t.markIgnored.value}
          </button>
        )}
      </div>

      {contribution.accounts && (
        <div className="lumio-tx-detail__section" data-testid="contribution-accounts">
          <div className="lumio-tx-detail__label">{t.investment.pick.value}</div>
          {contribution.accounts.length === 0 ? (
            <div className="lumio-tx-detail__label">{t.investment.none.value}</div>
          ) : (
            <div className="lumio-tx-detail__actions">
              {contribution.accounts.map(account => (
                <button
                  key={account.id}
                  type="button"
                  onClick={() => contribution.link(transaction.id, account.id)}
                  disabled={contribution.saving}
                  className="lumio-tx-detail__ignore-btn"
                >
                  {account.name}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={contribution.clearAccounts}
            className="lumio-tx-detail__ignore-btn"
          >
            {t.transfer.cancel.value}
          </button>
        </div>
      )}

      {transferCandidates && (
        <div className="lumio-tx-detail__section" data-testid="transfer-candidates">
          <div className="lumio-tx-detail__label">
            {linkMode === 'reimbursement' ? t.reimbursement.pick.value : t.transfer.pick.value}
          </div>
          {transferCandidates.length === 0 ? (
            <div className="lumio-tx-detail__value">
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
                className="lumio-tx-detail__ignore-btn"
                style={{ display: 'block', width: '100%', textAlign: 'left', marginTop: 6 }}
              >
                {formatDate(candidate.transactionDate, locale)} · {candidate.counterpartyName} ·{' '}
                {formatAmount(
                  Math.abs(candidate.amount),
                  candidate.currency ?? transaction.currency ?? 'KZT',
                  locale,
                )}
              </button>
            ))
          )}
          <button
            type="button"
            onClick={clearTransferCandidates}
            className="lumio-tx-detail__ignore-btn"
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
          locale={locale}
          onClose={() => setSplitOpen(false)}
          onSubmit={parts => {
            void split(transaction.id, parts);
          }}
        />
      )}
    </div>
  );
}

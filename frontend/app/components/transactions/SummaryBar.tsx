'use client';

import { resolveBankLogo } from '@bank-logos';
import { useMemo } from 'react';
import { Download, FileText, FileUp, TrendingDown, TrendingUp } from '@/app/components/icons';
import {
  formatAmount,
  formatDate,
} from '@/app/components/transactions/helpers/transactionFormatters';
import { Button } from '@/app/components/ui/button';
import { Spinner } from '@/app/components/ui/spinner';
import { useIntlayer, useLocale } from '@/app/i18n';
import { FALLBACK_CURRENCY } from '@/app/lib/currency';
import type { StatementDetails, Transaction } from './types';

interface SummaryBarProps {
  statement: StatementDetails;
  transactions: Transaction[];
  onExport?: () => void;
  onFixIssues?: () => void;
  onDownload?: () => void;
  fixing?: boolean;
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const getBankDisplayName = (bankName: string) => {
  const resolved = resolveBankLogo(bankName);
  if (!resolved) return bankName;
  return resolved.key !== 'other' ? resolved.displayName : bankName;
};

/**
 * Summary bar component showing file metadata, parsing status, and financial totals
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/explicit-module-boundary-types, max-lines-per-function, complexity
export default function SummaryBar({
  statement,
  transactions,
  onExport,
  onFixIssues,
  onDownload,
  fixing = false,
}: SummaryBarProps) {
  const { locale } = useLocale();
  const t = useIntlayer('transactionsSummaryBar');

  const stats = useMemo(() => {
    const totalParsed = transactions.length;
    const totalWarnings = transactions.filter(tx => tx.hasWarnings).length;
    const totalErrors = transactions.filter(tx => tx.hasErrors).length;
    const uncategorized = transactions.filter(tx => !tx.category).length;

    // eslint-disable-next-line max-params
    const debitTotal = transactions.reduce((sum, tx) => {
      const debitValue = Number(tx.debit);
      return sum + (Number.isNaN(debitValue) ? 0 : debitValue);
    }, 0);

    // eslint-disable-next-line max-params
    const creditTotal = transactions.reduce((sum, tx) => {
      const creditValue = Number(tx.credit);
      return sum + (Number.isNaN(creditValue) ? 0 : creditValue);
    }, 0);

    const currency = transactions[0]?.currency || FALLBACK_CURRENCY;

    return {
      totalParsed,
      totalWarnings,
      totalErrors,
      uncategorized,
      debitTotal,
      creditTotal,
      currency,
    };
  }, [transactions]);

  return (
    <div className="lumio-tx-summary">
      <div className="lumio-tx-summary__grid">
        {/* Left section: File metadata and parsing status */}
        <div className="lumio-tx-summary__meta">
          <div className="lumio-tx-summary__file-row">
            <div className="lumio-tx-summary__file-info">
              <div className="lumio-tx-summary__file-name">
                <FileText size={16} />
                <span style={{ fontWeight: 600 }}>{getBankDisplayName(statement.bankName)}</span>
                {statement.metadata?.accountNumber && (
                  <>
                    <span>•</span>
                    <span>{statement.metadata.accountNumber}</span>
                  </>
                )}
              </div>
              <div className="lumio-tx-summary__upload-date">
                {t.uploadedAt.value}: {formatDate(statement.createdAt, locale)}
              </div>
            </div>
          </div>

          {/* Parsing status */}
          <div className="lumio-tx-summary__badges">
            <div className="lumio-tx-summary__badge lumio-tx-summary__badge--parsed">
              <span className="lumio-tx-summary__badge-dot" />
              {t.parsed.value}: {stats.totalParsed}
            </div>
            {stats.totalWarnings > 0 && (
              <div className="lumio-tx-summary__badge lumio-tx-summary__badge--warnings">
                <span className="lumio-tx-summary__badge-dot" />
                {t.warnings.value}: {stats.totalWarnings}
              </div>
            )}
            {stats.totalErrors > 0 && (
              <div className="lumio-tx-summary__badge lumio-tx-summary__badge--errors">
                <span className="lumio-tx-summary__badge-dot" />
                {t.errors.value}: {stats.totalErrors}
              </div>
            )}
            {stats.uncategorized > 0 && (
              <div className="lumio-tx-summary__badge lumio-tx-summary__badge--uncategorized">
                <span className="lumio-tx-summary__badge-dot" />
                {t.uncategorized.value}: {stats.uncategorized}
              </div>
            )}
          </div>
        </div>

        {/* Right section: Financial totals and actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="lumio-tx-summary__totals-grid">
            {/* Debit Total */}
            <div className="lumio-tx-summary__total-card lumio-tx-summary__total-card--debit">
              <div className="lumio-tx-summary__total-label lumio-tx-summary__total-label--debit">
                <TrendingDown size={16} />
                {t.debitTotal.value}
              </div>
              <div className="lumio-tx-summary__total-amount lumio-tx-summary__total-amount--debit">
                {formatAmount(stats.debitTotal, stats.currency, locale)}
              </div>
            </div>

            {/* Credit Total */}
            <div className="lumio-tx-summary__total-card lumio-tx-summary__total-card--credit">
              <div className="lumio-tx-summary__total-label lumio-tx-summary__total-label--credit">
                <TrendingUp size={16} />
                {t.creditTotal.value}
              </div>
              <div className="lumio-tx-summary__total-amount lumio-tx-summary__total-amount--credit">
                {formatAmount(stats.creditTotal, stats.currency, locale)}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="lumio-tx-summary__actions">
            {(stats.totalErrors > 0 || stats.uncategorized > 0) && (
              <Button
                variant={stats.totalErrors > 0 ? 'destructive' : 'secondary'}
                size="sm"
                onClick={onFixIssues}
                disabled={fixing}
                style={fixing ? { opacity: 0.7, cursor: 'not-allowed' } : undefined}
              >
                {fixing ? (
                  <>
                    <Spinner style={{ marginRight: 8, height: 16, width: 16 }} />
                    {t.fixIssues.value}
                  </>
                ) : stats.totalErrors > 0 ? (
                  `${t.showErrors.value} (${stats.totalErrors})`
                ) : (
                  t.fixIssues.value
                )}
              </Button>
            )}
            {onDownload && (
              <Button variant="outline" size="sm" onClick={onDownload}>
                <Download size={16} style={{ marginRight: 8 }} />
                {t.download?.value || 'Download'}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={onExport}>
              <FileUp size={16} style={{ marginRight: 8 }} />
              {t.export.value}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

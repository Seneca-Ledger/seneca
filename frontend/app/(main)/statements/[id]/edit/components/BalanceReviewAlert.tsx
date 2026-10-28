'use client';

import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { PrivateAmount } from '@/app/components/ui/private-amount';
import apiClient from '@/app/lib/api';
import { invalidateFinancialData } from '@/app/lib/invalidate-document-lists';
import type { StatementParsingDetails } from '../editHelpers';

export const NEEDS_REVIEW_STATUS = 'needs_review';

export type BalanceReviewAlertProps = {
  statementId: string;
  status: string;
  parsingDetails?: StatementParsingDetails | null;
  labels: {
    title: string;
    description: string;
    expected: string;
    actual: string;
    difference: string;
    confirm: string;
    confirmFailed: string;
    /** Title when the parser's own checks, not the balance, held the statement. */
    checksTitle: string;
    checks: Record<CheckSentence, string>;
  };
  formatNumber: (value?: number | null) => string;
  /** Called after a successful confirmation so the page can refresh the statement. */
  onConfirmed: () => void;
};

/** The page's content, of which the banner reads its `balanceReview…` strings. */
type PageContent = { [key: string]: { value?: string } | undefined };

export function balanceReviewLabels(content: PageContent): BalanceReviewAlertProps['labels'] {
  const text = (key: string): string => content[`balanceReview${key}`]?.value ?? '';
  return {
    title: text('Title'),
    description: text('Description'),
    expected: text('Expected'),
    actual: text('Actual'),
    difference: text('Difference'),
    confirm: text('Confirm'),
    confirmFailed: text('ConfirmFailed'),
    checksTitle: text('ChecksTitle'),
    checks: {
      chain: text('CheckChain'),
      credits: text('CheckCredits'),
      debits: text('CheckDebits'),
      opening: text('CheckOpening'),
      closing: text('CheckClosing'),
      dates: text('CheckDates'),
    },
  };
}

type BalanceCheck = NonNullable<NonNullable<StatementParsingDetails['validation']>['balanceCheck']>;
type ParseCheck = NonNullable<StatementParsingDetails['checks']>[number];
type CheckSentence = 'chain' | 'credits' | 'debits' | 'opening' | 'closing' | 'dates';

/** Which sentence tells a failed check; sides name money in and out, or a balance. */
function sentenceOf(check: ParseCheck): CheckSentence | null {
  const side = check.detail?.side;
  switch (check.code) {
    case 'balance_chain':
      return 'chain';
    case 'printed_totals':
    case 'section_totals':
      return side === 'credits' ? 'credits' : 'debits';
    case 'printed_balances':
      return side === 'start' ? 'opening' : 'closing';
    case 'dates_in_period':
      return 'dates';
    default:
      return null;
  }
}

/** Each failed check: what went wrong, where, and the two figures that disagree. */
function FailedChecks({
  checks,
  labels,
  formatNumber,
}: {
  checks: ParseCheck[];
  labels: BalanceReviewAlertProps['labels'];
  formatNumber: BalanceReviewAlertProps['formatNumber'];
}): React.ReactElement | null {
  const failed = checks.filter(check => !check.passed && sentenceOf(check));
  if (failed.length === 0) {
    return null;
  }
  return (
    <>
      {failed.map(check => {
        const sentence = sentenceOf(check) as CheckSentence;
        const { date, expected, actual } = check.detail ?? {};
        return (
          <Typography key={`${check.code}-${sentence}`} variant="body2" sx={{ mt: 0.5 }}>
            {labels.checks[sentence].replace('{date}', date ?? '')}
            {expected != null && actual != null ? (
              <Box component="span" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                {' '}
                {labels.expected}: <PrivateAmount>{formatNumber(expected)}</PrivateAmount> ·{' '}
                {labels.actual}: <PrivateAmount>{formatNumber(actual)}</PrivateAmount>
              </Box>
            ) : null}
          </Typography>
        );
      })}
    </>
  );
}

function BalanceFigures({
  check,
  labels,
  formatNumber,
}: {
  check?: BalanceCheck;
  labels: BalanceReviewAlertProps['labels'];
  formatNumber: BalanceReviewAlertProps['formatNumber'];
}): React.ReactElement | null {
  if (!check) {
    return null;
  }
  return (
    <Typography variant="body2" sx={{ mt: 0.5, fontVariantNumeric: 'tabular-nums' }}>
      {labels.expected}: <PrivateAmount>{formatNumber(check.expectedEnd)}</PrivateAmount> ·{' '}
      {labels.actual}: <PrivateAmount>{formatNumber(check.actualEnd)}</PrivateAmount> ·{' '}
      {labels.difference}: <PrivateAmount>{formatNumber(check.difference)}</PrivateAmount>
    </Typography>
  );
}

function ConfirmButton({
  confirming,
  label,
  onConfirm,
}: {
  confirming: boolean;
  label: string;
  onConfirm: () => void;
}): React.ReactElement {
  return (
    <Button
      color="inherit"
      size="small"
      variant="outlined"
      onClick={onConfirm}
      disabled={confirming}
      data-testid="confirm-balance-button"
      startIcon={confirming ? <CircularProgress size={14} color="inherit" /> : undefined}
    >
      {label}
    </Button>
  );
}

/** Posts the confirmation and exposes the in-flight and failure states. */
function useConfirmBalance({
  statementId,
  failureLabel,
  onConfirmed,
}: {
  statementId: string;
  failureLabel: string;
  onConfirmed: () => void;
}): { confirming: boolean; error: string | null; confirm: () => Promise<void> } {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async (): Promise<void> => {
    setConfirming(true);
    setError(null);

    await (async () => {
      await apiClient.post(`/statements/${statementId}/confirm-balance`);
      // A confirmed statement's rows start counting.
      invalidateFinancialData();
      onConfirmed();
    })()
      .catch(async () => {
        setError(failureLabel);
      })
      .finally(async () => {
        setConfirming(false);
      });
  };

  return { confirming, error, confirm };
}

function ErrorLine({ error }: { error: string | null }): React.ReactElement | null {
  if (!error) {
    return null;
  }
  return (
    <Typography variant="body2" color="error" sx={{ mt: 0.5 }}>
      {error}
    </Typography>
  );
}

/**
 * Shown when a statement parsed but its balance did not reconcile
 * (balanceStart + credits - debits != balanceEnd), or the parser's checks of
 * its own reading failed: the running balance, the printed totals, the
 * printed balances or the period disagree with the rows read.
 *
 * Such a statement is excluded from dashboards and reports until someone accepts
 * the discrepancy, because the usual cause is the parser silently dropping or
 * misreading rows. Confirming is audited on the backend.
 */
export function BalanceReviewAlert({
  statementId,
  status,
  parsingDetails,
  labels,
  formatNumber,
  onConfirmed,
}: BalanceReviewAlertProps): React.ReactElement | null {
  const { confirming, error, confirm } = useConfirmBalance({
    statementId,
    failureLabel: labels.confirmFailed,
    onConfirmed,
  });

  if (status !== NEEDS_REVIEW_STATUS) {
    return null;
  }
  const reasons = parsingDetails?.validation?.reasonCodes ?? [];
  const checks = parsingDetails?.checks ?? [];
  const heldByChecks = !reasons.includes('balance_mismatch') && checks.some(check => !check.passed);

  return (
    <Alert
      severity="warning"
      sx={{ mb: 2 }}
      action={<ConfirmButton confirming={confirming} label={labels.confirm} onConfirm={confirm} />}
    >
      <AlertTitle sx={{ fontWeight: 600 }}>
        {heldByChecks ? labels.checksTitle : labels.title}
      </AlertTitle>
      <Typography variant="body2">{labels.description}</Typography>
      <BalanceFigures
        check={heldByChecks ? undefined : (parsingDetails?.validation?.balanceCheck ?? undefined)}
        labels={labels}
        formatNumber={formatNumber}
      />
      <FailedChecks checks={checks} labels={labels} formatNumber={formatNumber} />
      <ErrorLine error={error} />
    </Alert>
  );
}

'use client';

import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
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
  };
  formatNumber: (value?: number | null) => string;
  /** Called after a successful confirmation so the page can refresh the statement. */
  onConfirmed: () => void;
};

type BalanceCheck = NonNullable<NonNullable<StatementParsingDetails['validation']>['balanceCheck']>;

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
 * (balanceStart + credits - debits != balanceEnd).
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

  return (
    <Alert
      severity="warning"
      sx={{ mb: 2 }}
      action={<ConfirmButton confirming={confirming} label={labels.confirm} onConfirm={confirm} />}
    >
      <AlertTitle sx={{ fontWeight: 600 }}>{labels.title}</AlertTitle>
      <Typography variant="body2">{labels.description}</Typography>
      <BalanceFigures
        check={parsingDetails?.validation?.balanceCheck ?? undefined}
        labels={labels}
        formatNumber={formatNumber}
      />
      <ErrorLine error={error} />
    </Alert>
  );
}

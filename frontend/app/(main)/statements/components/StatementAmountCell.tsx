'use client';

import clsx from 'clsx';
import { useTheme } from 'next-themes';
import type React from 'react';
import { canTeach } from '@/app/components/pdf-teach/teach-utils';
import { PRIVATE_CLASS } from '@/app/components/ui/private-amount';
import { Spinner } from '@/app/components/ui/spinner';
import { useIntlayer } from '@/app/i18n';
import { tokens } from '@/lib/theme-tokens';
import { splitAmountLabel } from './filters/amount-view';
import type { StatementListItem } from './StatementsListItem';

/** How a row's amount shows: in red, as a spinner while it is read, or not at all. */
export function amountState(statement: StatementListItem, amountLabel: string, isReceipt: boolean) {
  const hasError = !!statement.errorMessage || statement.status === 'error';
  const isPendingStatement = statement.status === 'uploaded' || statement.status === 'processing';
  const isZeroAmountLabel = /^0(?:[.,]0+)?\D*$/.test(amountLabel.replace(/\s+/g, ''));
  const isNegativeAmount = amountLabel.startsWith('-') && amountLabel !== '-';
  const isMissingAmount = amountLabel === '-';
  return {
    isPendingStatement,
    isZeroAmountLabel,
    isMissingAmount,
    danger: isNegativeAmount || hasError || isMissingAmount,
    showAmountLoader: !isReceipt && isPendingStatement && (isZeroAmountLabel || isMissingAmount),
  };
}

export function StatusBadge({
  status,
  isProcessing,
  errorMessage,
}: {
  status: string;
  isProcessing: boolean;
  errorMessage?: string | null;
}) {
  const listText = useIntlayer('statementsListUi');
  if (errorMessage || status === 'error') {
    return (
      <span className="seneca-stmt-badge seneca-stmt-badge--error">{listText.statusError}</span>
    );
  }
  if (isProcessing || status === 'processing' || status === 'uploaded') {
    return (
      <span className="seneca-stmt-badge seneca-stmt-badge--pending">{listText.statusPending}</span>
    );
  }
  // Parsed, but the balance did not reconcile: held out of analytics until a user
  // confirms it on the statement page.
  if (status === 'needs_review') {
    return (
      <span className="seneca-stmt-badge seneca-stmt-badge--review">
        {listText.statusNeedsReview}
      </span>
    );
  }
  if (status === 'completed' || status === 'parsed' || status === 'validated') {
    return (
      <span className="seneca-stmt-badge seneca-stmt-badge--completed">
        {listText.statusCompleted}
      </span>
    );
  }
  return null;
}

/** In place of the amount of a statement the parser could not read: teach it the layout. */
export function TeachButton({ onTeach }: { onTeach: () => void }) {
  const t = useIntlayer('pdfTeach');
  return (
    <button
      type="button"
      className="seneca-pdf-teach__teach-btn"
      title={t.teachHint.value}
      data-testid="statement-teach"
      onClick={event => {
        event.stopPropagation();
        onTeach();
      }}
    >
      {t.teachButton}
    </button>
  );
}

/**
 * The amount column: the statement's sum, a spinner while it is read, or,
 * when the parser could not read it (canTeach), nothing but a Teach button.
 */
export function StatementAmountCell({
  statement,
  amountLabel,
  isReceipt,
  isProcessing,
  onTeach,
}: {
  statement: StatementListItem;
  amountLabel: string;
  isReceipt: boolean;
  isProcessing: boolean;
  onTeach: () => void;
}): React.JSX.Element {
  const { resolvedTheme } = useTheme();
  const c = resolvedTheme === 'dark' ? tokens.dark.color : tokens.color;
  const { danger, showAmountLoader } = amountState(statement, amountLabel, isReceipt);
  const { figure: amountFigure, currency: amountCurrency } = splitAmountLabel(amountLabel);
  return (
    <div
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
    >
      {canTeach(statement) ? (
        <TeachButton onTeach={onTeach} />
      ) : (
        <span
          className={clsx('seneca-stmt-list-item__amount', PRIVATE_CLASS)}
          style={{
            color: danger ? c.danger : c.ink900,
            whiteSpace: amountFigure.includes('\n') ? 'pre-line' : undefined,
          }}
        >
          {showAmountLoader ? (
            <Spinner style={{ width: 16, height: 16, color: c.ink400 }} />
          ) : (
            <>
              {amountFigure}
              {amountCurrency ? (
                <span className="seneca-stmt-list-item__currency"> {amountCurrency}</span>
              ) : null}
            </>
          )}
        </span>
      )}
      <div
        style={{ marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}
      >
        <StatusBadge
          status={statement.status}
          isProcessing={isProcessing}
          errorMessage={statement.errorMessage}
        />
      </div>
    </div>
  );
}

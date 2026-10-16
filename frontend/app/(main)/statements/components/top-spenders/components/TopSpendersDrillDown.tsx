'use client';

import Modal from '@mui/material/Modal';
import { AnalyticsSourceBadge } from '@/app/(main)/statements/components/analytics/AnalyticsSourceBadge';
import { useAnalyticsMoney } from '@/app/(main)/statements/components/analytics/useAnalyticsMoney';
import type {
  TopSpenderAggregateRow,
  TopSpenderRecord,
  TopSpenderSourceChannel,
} from '@/app/(main)/statements/components/top-spenders/top-spenders.types';
import { X } from '@/app/components/icons';
import { closeOnBackdropClick } from '@/app/components/ui/backdrop-click';
import { formatStoredDate } from '@/app/lib/user-format-store';
import { tokens } from '@/lib/theme-tokens';

type SourceLabels = {
  sourceBank: string;
  sourceReceipt: string;
  sourceGmailInbox: string;
  sourceCrypto: string;
};

type Props = {
  selectedRow: TopSpenderAggregateRow;
  drillDownRecords: TopSpenderRecord[];
  onClose: () => void;
  currency: string;
  sourceLabels: SourceLabels;
  labels: {
    drillDown: string;
    close: string;
    noOperations: string;
    lastOperation: string;
    source: string;
    workspace: string;
    amount: string;
  };
};

type HeaderProps = {
  selectedRow: TopSpenderAggregateRow;
  sourceLabels: SourceLabels;
  labels: Pick<Props['labels'], 'drillDown' | 'close'>;
  onClose: () => void;
};

function DrillDownHeader({
  selectedRow,
  sourceLabels,
  labels,
  onClose,
}: HeaderProps): React.JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid var(--border-color)',
        padding: '12px 20px',
      }}
    >
      <div>
        <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>
          {selectedRow.company} - {labels.drillDown}
        </h4>
        <p style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
          <AnalyticsSourceBadge
            sourceChannel={selectedRow.sourceChannel as TopSpenderSourceChannel}
            labels={sourceLabels}
          />
        </p>
      </div>
      <button
        type="button"
        style={{
          borderRadius: tokens.radius.md,
          padding: 6,
          color: 'var(--muted-foreground)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
        }}
        onClick={onClose}
        aria-label={labels.close}
      >
        <X size={16} />
      </button>
    </div>
  );
}

export function TopSpendersDrillDown({
  selectedRow,
  drillDownRecords,
  onClose,
  currency,
  sourceLabels,
  labels,
}: Props): React.JSX.Element {
  // Modal traps focus inside the drill-down, closes on Escape and restores focus on unmount.
  return (
    <Modal open onClose={onClose} hideBackdrop>
      {/* biome-ignore lint/a11y: the dimmed backdrop is a mouse-only dismiss surface; keyboard users close with Escape (Modal). */}
      <div
        tabIndex={-1}
        onClick={closeOnBackdropClick(onClose)}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.3)',
          padding: 16,
          outline: 'none',
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${selectedRow.company} - ${labels.drillDown}`}
          style={{
            maxHeight: '85vh',
            width: '100%',
            maxWidth: 896,
            overflow: 'hidden',
            border: '1px solid var(--border-color)',
            background: 'var(--card-bg)',
            borderRadius: tokens.radius.xl,
          }}
        >
          <DrillDownHeader
            selectedRow={selectedRow}
            sourceLabels={sourceLabels}
            labels={labels}
            onClose={onClose}
          />
          <div style={{ maxHeight: '65vh', overflowY: 'auto', padding: '16px 20px' }}>
            {drillDownRecords.length === 0 ? (
              <div
                style={{
                  border: '1px dashed var(--border-color)',
                  padding: 32,
                  textAlign: 'center',
                  fontSize: 14,
                  color: 'var(--muted-foreground)',
                  borderRadius: tokens.radius.lg,
                }}
              >
                {labels.noOperations}
              </div>
            ) : (
              <DrillDownTable
                records={drillDownRecords}
                currency={currency}
                sourceLabels={sourceLabels}
                labels={labels}
              />
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

type TableProps = {
  records: TopSpenderRecord[];
  currency: string;
  sourceLabels: SourceLabels;
  labels: Pick<Props['labels'], 'lastOperation' | 'source' | 'workspace' | 'amount'>;
};

function DrillDownTable({
  records,
  currency,
  sourceLabels,
  labels,
}: TableProps): React.JSX.Element {
  const money = useAnalyticsMoney();
  return (
    <table style={{ minWidth: '100%', fontSize: 14, borderCollapse: 'collapse' }}>
      <thead>
        <tr
          style={{
            textAlign: 'left',
            fontSize: 12,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--muted-foreground)',
          }}
        >
          <th style={{ padding: '8px 16px 8px 0' }}>{labels.lastOperation}</th>
          <th style={{ padding: '8px 16px 8px 0' }}>{labels.source}</th>
          <th style={{ padding: '8px 16px 8px 0' }}>{labels.workspace}</th>
          <th style={{ padding: '8px 0', textAlign: 'right' }}>{labels.amount}</th>
        </tr>
      </thead>
      <tbody>
        {records.slice(0, 120).map(record => (
          <tr
            key={record.id}
            style={{ color: 'var(--foreground)', borderTop: '1px solid var(--muted)' }}
          >
            <td style={{ padding: '8px 16px 8px 0', color: 'var(--text-secondary)' }}>
              {record.dateValue && !Number.isNaN(new Date(record.dateValue).getTime())
                ? formatStoredDate(record.dateValue)
                : '-'}
            </td>
            <td style={{ padding: '8px 16px 8px 0' }}>
              <AnalyticsSourceBadge
                sourceChannel={record.sourceChannel as TopSpenderSourceChannel}
                labels={sourceLabels}
              />
            </td>
            <td style={{ padding: '8px 16px 8px 0', color: 'var(--text-secondary)' }}>
              {record.workspaceName || '-'}
            </td>
            <td
              style={{
                padding: '8px 0',
                textAlign: 'right',
                fontWeight: 500,
                color: 'var(--foreground)',
              }}
            >
              {money(record.amount, record.currencyValue || currency)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

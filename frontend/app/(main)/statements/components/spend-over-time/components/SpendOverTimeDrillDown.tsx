'use client';

import Modal from '@mui/material/Modal';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnalyticsSourceBadge } from '@/app/(main)/statements/components/analytics/AnalyticsSourceBadge';
import type {
  SpendOverTimePoint,
  SpendOverTimeRecord,
  SpendOverTimeSourceChannel,
} from '@/app/(main)/statements/components/spend-over-time.utils';
import { X } from '@/app/components/icons';
import { closeOnBackdropClick } from '@/app/components/ui/backdrop-click';
import { PRIVATE_CLASS } from '@/app/components/ui/private-amount';
import { useIntlayer } from '@/app/i18n';
import { formatMoney } from '@/app/lib/analytics-common';
import { formatStoredDate } from '@/app/lib/user-format-store';

type SourceLabels = {
  sourceBank: string;
  sourceReceipt: string;
  sourceGmailInbox: string;
  sourceCrypto: string;
};

type Props = {
  selectedPoint: SpendOverTimePoint;
  drillDownRecords: SpendOverTimeRecord[];
  groupBy: string;
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

const getRecordMerchant = (record: SpendOverTimeRecord): string =>
  record.merchant ?? record.sender ?? record.subject ?? '-';

const formatDateValue = (dateValue: string | null | undefined): string => {
  if (!dateValue) {
    return '-';
  }
  const d = new Date(dateValue);
  return Number.isNaN(d.getTime()) ? '-' : formatStoredDate(d);
};

type TableProps = {
  records: SpendOverTimeRecord[];
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
  const spendT = useIntlayer('statementsSpendOverTime');
  const router = useRouter();
  const visible = records.slice(0, 120);
  return (
    <>
      <table className="seneca-view-page__table seneca-spend-drill__table">
        <thead>
          <tr>
            <th>{labels.lastOperation}</th>
            <th>{labels.source}</th>
            <th>{labels.workspace}</th>
            <th>{spendT.merchant}</th>
            <th style={{ textAlign: 'right' }}>{labels.amount}</th>
          </tr>
        </thead>
        <tbody>
          {visible.map(record => (
            // The merchant is the link (keyboard, middle-click); the rest of the
            // row is a wider target for the mouse.
            <tr
              key={record.id}
              className={record.href ? 'seneca-spend-drill__row--link' : undefined}
              onClick={record.href ? () => router.push(record.href as string) : undefined}
            >
              <td style={{ color: 'var(--text-secondary)' }}>
                {formatDateValue(record.dateValue)}
              </td>
              <td>
                <AnalyticsSourceBadge
                  sourceChannel={record.sourceChannel as SpendOverTimeSourceChannel}
                  labels={sourceLabels}
                />
              </td>
              <td style={{ color: 'var(--text-secondary)' }}>{record.workspaceName ?? '-'}</td>
              <td style={{ color: 'var(--text-secondary)' }}>
                {record.href ? (
                  <Link
                    href={record.href}
                    className="seneca-spend-drill__link"
                    onClick={event => event.stopPropagation()}
                  >
                    {getRecordMerchant(record)}
                  </Link>
                ) : (
                  getRecordMerchant(record)
                )}
              </td>
              <td
                className={PRIVATE_CLASS}
                style={{ textAlign: 'right', fontWeight: 500, color: 'var(--foreground)' }}
              >
                {formatMoney(record.amount, record.currencyValue || currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* Phones: five columns do not fit, so each operation is a two-line row. */}
      <ul className="seneca-spend-drill__list">
        {visible.map(record => {
          const content = (
            <>
              <span className="seneca-spend-drill__merchant">{getRecordMerchant(record)}</span>
              <span className={`seneca-spend-drill__amount ${PRIVATE_CLASS}`}>
                {formatMoney(record.amount, record.currencyValue || currency)}
              </span>
              <span className="seneca-spend-drill__meta">
                <AnalyticsSourceBadge
                  sourceChannel={record.sourceChannel as SpendOverTimeSourceChannel}
                  labels={sourceLabels}
                />
                <span>{formatDateValue(record.dateValue)}</span>
              </span>
            </>
          );
          return (
            <li key={record.id}>
              {record.href ? (
                <Link href={record.href} className="seneca-spend-drill__item">
                  {content}
                </Link>
              ) : (
                <div className="seneca-spend-drill__item">{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

export function SpendOverTimeDrillDown({
  selectedPoint,
  drillDownRecords,
  groupBy,
  onClose,
  currency,
  sourceLabels,
  labels,
}: Props): React.JSX.Element {
  // Modal renders above the whole app (side-panel buttons included), traps focus inside the
  // drill-down, closes on Escape and restores focus on unmount.
  return (
    <Modal open onClose={onClose} hideBackdrop>
      {/* biome-ignore lint/a11y: the dimmed backdrop is a mouse-only dismiss surface; keyboard users close with Escape (Modal). */}
      <div
        className="seneca-view-page__drill-backdrop"
        tabIndex={-1}
        onClick={closeOnBackdropClick(onClose)}
      >
        <div
          className="seneca-view-page__drill-modal"
          role="dialog"
          aria-modal="true"
          aria-label={`${selectedPoint.label} - ${labels.drillDown}`}
        >
          <div className="seneca-view-page__drill-header">
            <div>
              <h4 className="seneca-view-page__drill-title">
                {selectedPoint.label} - {labels.drillDown}
              </h4>
              <p className="seneca-view-page__drill-subtitle">{groupBy}</p>
            </div>
            <button
              type="button"
              className="seneca-view-page__drill-close"
              onClick={onClose}
              aria-label={labels.close}
            >
              <X size={16} />
            </button>
          </div>
          <div className="seneca-view-page__drill-body">
            {drillDownRecords.length === 0 ? (
              <div className="seneca-view-page__drill-empty">{labels.noOperations}</div>
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

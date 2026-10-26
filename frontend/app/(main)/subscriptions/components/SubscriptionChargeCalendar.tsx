'use client';

import type { ReactNode } from 'react';
import { PrivateAmount } from '@/app/components/ui/private-amount';
import { useIntlayer } from '@/app/i18n';
import type { SubscriptionChargeCalendar } from '../hooks/useSubscriptionsPage';
import { isPeakAmount, monthPeaks } from './charge-calendar.utils';

interface SubscriptionChargeCalendarProps {
  calendar: SubscriptionChargeCalendar;
  /** Pre-built month labels, so the component stays free of locale logic. */
  monthLabels: string[];
  formatAmount: (amount: number) => string;
  renderVendor?: (row: SubscriptionChargeCalendar['rows'][number]) => ReactNode;
}

export function SubscriptionChargeCalendar({
  calendar,
  monthLabels,
  formatAmount,
  renderVendor,
}: SubscriptionChargeCalendarProps) {
  const t = useIntlayer('subscriptionsPage');
  const peaks = monthPeaks(calendar.rows, monthLabels.length);

  return (
    <div className="seneca-charge-calendar">
      <table className="seneca-charge-calendar__table">
        <caption className="seneca-charge-calendar__caption">
          {t.calendarCaption.value.replace('{count}', String(monthLabels.length))}
        </caption>
        <thead>
          <tr>
            <th scope="col" className="seneca-charge-calendar__vendor">
              {t.colVendor}
            </th>
            {monthLabels.map(label => (
              <th scope="col" key={label}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {calendar.rows.map(row => (
            <tr key={row.subscriptionId}>
              <th scope="row" className="seneca-charge-calendar__vendor">
                <span className="seneca-charge-calendar__vendor-inner">
                  {renderVendor?.(row)}
                  {row.vendorName}
                  {row.kind === 'payable' && (
                    <span className="seneca-charge-calendar__kind"> · {t.calendarKindPayable}</span>
                  )}
                  {row.kind === 'invoice' && (
                    <span className="seneca-charge-calendar__kind"> · {t.calendarKindInvoice}</span>
                  )}
                </span>
              </th>
              {monthLabels.map((label, index) => {
                const amount = row.amounts[index] ?? 0;
                const isPeak = isPeakAmount(amount, peaks[index]);
                return (
                  <td
                    key={label}
                    className={
                      amount > 0
                        ? isPeak
                          ? 'seneca-charge-calendar__peak'
                          : undefined
                        : 'seneca-charge-calendar__empty'
                    }
                  >
                    {amount > 0 ? (
                      <PrivateAmount>{formatAmount(amount)}</PrivateAmount>
                    ) : (
                      <>
                        {/* A bare aria-label on a span is ignored, so the
                            dash is hidden and the words are read instead. */}
                        <span aria-hidden="true">—</span>
                        <span className="seneca-charge-calendar__sr-only">{t.noCharge}</span>
                      </>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" className="seneca-charge-calendar__vendor">
              {t.total}
            </th>
            {monthLabels.map((label, index) => (
              <td key={label}>
                <PrivateAmount>{formatAmount(calendar.monthTotals[index] ?? 0)}</PrivateAmount>
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

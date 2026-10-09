'use client';

import React, { useEffect, useState } from 'react';
import { useIntlayer, useLocale } from '@/app/i18n';
import { formatMoney } from '@/app/lib/format-money';
import { type AgeingReport, invoicesApi } from '@/app/lib/invoices-api';

/**
 * Who owes what, and for how long.
 *
 * Sits above the list because it answers the question the list cannot: which
 * client to chase first. Currencies stay apart — a total mixing EUR and KZT
 * would be a number that means nothing.
 */
export function InvoiceAgeingPanel(): React.JSX.Element | null {
  const t = useIntlayer('invoicesPage');
  const { locale } = useLocale();
  const [report, setReport] = useState<AgeingReport | null>(null);

  useEffect(() => {
    let cancelled = false;
    invoicesApi
      .ageing()
      .then(data => {
        if (!cancelled) {
          setReport(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setReport({ rows: [], totals: [] });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!report) {
    return null;
  }

  const buckets = [
    { key: 'current', label: String(t.detail.ageingCurrent.value) },
    { key: 'days1to30', label: `1–30 ${String(t.detail.ageingDays.value)}` },
    { key: 'days31to60', label: `31–60 ${String(t.detail.ageingDays.value)}` },
    { key: 'days61to90', label: `61–90 ${String(t.detail.ageingDays.value)}` },
    { key: 'days90plus', label: `90+ ${String(t.detail.ageingDays.value)}` },
  ] as const;

  return (
    <div className="lumio-payable-list" style={{ marginBottom: 24 }}>
      <div style={{ padding: '12px 16px 0', fontSize: 15, fontWeight: 600 }}>
        {t.detail.ageingTitle}
      </div>

      {report.rows.length === 0 ? (
        <p style={{ padding: '8px 16px 16px', fontSize: 14, color: 'var(--text-secondary)' }}>
          {t.detail.ageingEmpty}
        </p>
      ) : (
        <div className="lumio-payable-list__table-wrap">
          <table className="lumio-payable-list__table">
            <thead className="lumio-payable-list__thead">
              <tr>
                <th className="lumio-payable-list__th">{t.columns.client.value}</th>
                {buckets.map(bucket => (
                  <th
                    key={bucket.key}
                    className="lumio-payable-list__th lumio-payable-list__th--right"
                  >
                    {bucket.label}
                  </th>
                ))}
                <th className="lumio-payable-list__th lumio-payable-list__th--right">
                  {t.columns.total.value}
                </th>
              </tr>
            </thead>
            <tbody className="lumio-payable-list__tbody">
              {report.rows.map(row => (
                <tr key={`${row.clientId}-${row.currency}`}>
                  <td className="lumio-payable-list__td">
                    {row.clientName}
                    <span style={{ color: 'var(--text-secondary)' }}> · {row.currency}</span>
                  </td>
                  {buckets.map(bucket => (
                    <td
                      key={bucket.key}
                      className="lumio-payable-list__td"
                      style={{ textAlign: 'right' }}
                    >
                      {row[bucket.key] === 0
                        ? '—'
                        : formatMoney(row[bucket.key], row.currency, locale)}
                    </td>
                  ))}
                  <td
                    className="lumio-payable-list__td"
                    style={{ textAlign: 'right', fontWeight: 600 }}
                  >
                    {formatMoney(row.total, row.currency, locale)}
                  </td>
                </tr>
              ))}
              {report.totals.map(total => (
                <tr key={`total-${total.currency}`} style={{ fontWeight: 600 }}>
                  <td className="lumio-payable-list__td">{total.currency}</td>
                  {buckets.map(bucket => (
                    <td
                      key={bucket.key}
                      className="lumio-payable-list__td"
                      style={{ textAlign: 'right' }}
                    >
                      {total[bucket.key] === 0
                        ? '—'
                        : formatMoney(total[bucket.key], total.currency, locale)}
                    </td>
                  ))}
                  <td className="lumio-payable-list__td" style={{ textAlign: 'right' }}>
                    {formatMoney(total.total, total.currency, locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

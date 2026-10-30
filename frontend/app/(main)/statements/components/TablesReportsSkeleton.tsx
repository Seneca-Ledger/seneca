'use client';

import Skeleton from '@mui/material/Skeleton';
import type React from 'react';
import { useIntlayer } from '@/app/i18n';
import { tokens } from '@/lib/theme-tokens';

const ROW_KEYS = ['a', 'b', 'c', 'd', 'e'];
const CELL: React.CSSProperties = { padding: '12px 16px' };
const RIGHT: React.CSSProperties = { ...CELL, textAlign: 'right' };
// Theme variables rather than the page's resolved palette: before the theme
// resolves, the page's own ink values are the light ones.
const panelStyle: React.CSSProperties = {
  border: '1px solid var(--border)',
  background: 'var(--card-bg)',
  padding: 16,
  borderRadius: tokens.radius.lg,
};

/**
 * The report while it loads: the same panels with their titles, a block of the
 * charts' height and the table's head over placeholder rows.
 */
export function TablesReportsSkeleton(): React.JSX.Element {
  const t = useIntlayer('statementsTablesReports');
  const label = (text: React.ReactNode) => (
    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{text}</div>
  );
  const title = (text: React.ReactNode) => (
    <div style={{ marginBottom: 12, fontSize: 14, fontWeight: 500, color: 'var(--foreground)' }}>
      {text}
    </div>
  );
  const figure = <Skeleton variant="text" width="30%" height={30} style={{ marginTop: 4 }} />;
  return (
    <div aria-busy="true">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
        <div style={panelStyle}>
          {label(t.total)}
          {figure}
          <Skeleton variant="text" width={48} height={18} style={{ marginTop: 4 }} />
        </div>
        <div style={panelStyle}>
          {label(t.manualTables)}
          {figure}
        </div>
        <div style={panelStyle}>
          {label(t.operations)}
          {figure}
        </div>
      </div>
      <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
        <div style={{ ...panelStyle, gridColumn: 'span 2' }}>
          {title(t.trend)}
          <Skeleton variant="rounded" height={220} />
        </div>
        <div style={panelStyle}>
          {title(t.sourceSplit)}
          <Skeleton variant="rounded" height={220} />
        </div>
      </div>
      <div style={{ marginTop: 24, ...panelStyle }}>
        {title(t.topCounterparties)}
        <Skeleton variant="rounded" height={320} />
      </div>
      <div
        style={{
          marginTop: 16,
          overflowX: 'auto',
          border: '1px solid var(--border)',
          background: 'var(--card-bg)',
          borderRadius: tokens.radius.lg,
        }}
      >
        <table style={{ width: '100%', fontSize: 14, borderCollapse: 'collapse' }}>
          <thead>
            <tr
              style={{
                borderBottom: '1px solid var(--border)',
                textAlign: 'left',
                fontSize: 12,
                color: 'var(--text-muted)',
              }}
            >
              <th style={CELL}>{t.counterparty}</th>
              <th style={CELL}>{t.source}</th>
              <th style={CELL}>{t.table}</th>
              <th style={RIGHT}>{t.operations}</th>
              <th style={RIGHT}>{t.average}</th>
              <th style={RIGHT}>{t.amount}</th>
              <th style={RIGHT}>{t.lastOperation}</th>
            </tr>
          </thead>
          <tbody>
            {ROW_KEYS.map(key => (
              <tr key={key} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={CELL}>
                  <Skeleton variant="text" width={120} />
                </td>
                <td style={CELL}>
                  <Skeleton variant="rounded" width={56} height={22} />
                </td>
                <td style={CELL}>
                  <Skeleton variant="text" width={90} />
                </td>
                {[32, 64, 72, 80].map(width => (
                  <td key={width} style={RIGHT}>
                    <Skeleton variant="text" width={width} sx={{ display: 'inline-block' }} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

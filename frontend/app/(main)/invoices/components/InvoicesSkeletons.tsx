import Skeleton from '@mui/material/Skeleton';
import type React from 'react';
import { ChevronLeft } from '@/app/components/icons';
import { useIntlayer } from '@/app/i18n';

const ROW_KEYS = ['row-0', 'row-1', 'row-2', 'row-3', 'row-4', 'row-5'];
const TD = 'seneca-payable-list__td';

/** The small row buttons ("Edit", "Send"…): 32px tall, the button radius. */
function RowButtons({ count }: { count: number }): React.JSX.Element {
  return (
    <div className="seneca-payable-list__actions">
      {Array.from({ length: count }, (_, index) => (
        <Skeleton
          // biome-ignore lint/suspicious/noArrayIndexKey: placeholders have no identity
          key={index}
          variant="rounded"
          width={64}
          height={32}
          sx={{ borderRadius: '12px' }}
        />
      ))}
    </div>
  );
}

const text = (width: number): React.JSX.Element => (
  <Skeleton variant="text" width={width} sx={{ display: 'inline-block' }} />
);

/** Invoice rows while the list loads: number, client, dates, status chip, total, actions. */
export function InvoiceRowsSkeleton(): React.JSX.Element {
  return (
    <tbody className="seneca-payable-list__tbody" aria-busy="true">
      {ROW_KEYS.map(row => (
        <tr key={row}>
          <td className={TD}>{text(72)}</td>
          <td className={TD}>{text(120)}</td>
          <td className={TD}>{text(88)}</td>
          <td className={TD}>{text(88)}</td>
          <td className={TD}>
            <Skeleton variant="rounded" width={44} height={22} sx={{ borderRadius: '999px' }} />
          </td>
          <td className={TD} style={{ textAlign: 'right' }}>
            {text(80)}
          </td>
          <td className={TD}>
            <RowButtons count={3} />
          </td>
        </tr>
      ))}
    </tbody>
  );
}

/** Client rows while the list loads: name, e-mail, currency, then Edit and Delete. */
export function ClientRowsSkeleton(): React.JSX.Element {
  return (
    <tbody className="seneca-payable-list__tbody" aria-busy="true">
      {ROW_KEYS.map(row => (
        <tr key={row}>
          <td className={TD}>{text(140)}</td>
          <td className={TD}>{text(160)}</td>
          <td className={TD}>{text(32)}</td>
          <td className={TD}>
            <RowButtons count={2} />
          </td>
        </tr>
      ))}
    </tbody>
  );
}

/** Ageing rows: the client, then five buckets and the total on the right. */
export function AgeingRowsSkeleton(): React.JSX.Element {
  return (
    <tbody className="seneca-payable-list__tbody" aria-busy="true">
      {ROW_KEYS.slice(0, 2).map(row => (
        <tr key={row}>
          <td className={TD}>{text(140)}</td>
          {ROW_KEYS.map(cell => (
            <td key={cell} className={TD} style={{ textAlign: 'right' }}>
              {text(64)}
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}

const field = (height: number): React.JSX.Element => (
  <Skeleton variant="rounded" height={height} sx={{ borderRadius: '12px' }} />
);

/** A labelled field of the read-only invoice form: the real label over a field-sized block. */
function Field({ label, height }: { label: React.ReactNode; height: number }): React.JSX.Element {
  return (
    <div className="seneca-payable-drawer__field-group">
      <span className="seneca-payable-drawer__field-label">{label}</span>
      {field(height)}
    </div>
  );
}

/**
 * The invoice while it loads: the real back button and labels; the number, status,
 * actions and values wait. Shaped like a sent invoice, the form most invoices show.
 */
export function InvoiceDetailSkeleton({ onBack }: { onBack: () => void }): React.JSX.Element {
  const t = useIntlayer('invoicesPage');
  const einvoice = useIntlayer('einvoiceFields');
  return (
    <div className="container-shared seneca-invoice-detail" aria-busy="true">
      <div className="seneca-invoice-detail__header">
        <button
          type="button"
          onClick={onBack}
          aria-label={t.actions.back.value}
          style={{ display: 'flex', border: 0, background: 'none', cursor: 'pointer' }}
        >
          <ChevronLeft size={20} />
        </button>
        <Skeleton variant="text" width={86} sx={{ fontSize: 22 }} />
        <Skeleton variant="rounded" width={42} height={22} sx={{ borderRadius: '999px' }} />
        <div className="seneca-invoice-detail__actions">
          {[135, 155, 131, 146].map(width => (
            <Skeleton
              key={width}
              variant="rounded"
              width={width}
              height={40}
              sx={{ borderRadius: '12px' }}
            />
          ))}
        </div>
      </div>
      <div style={{ display: 'grid', gap: 16, maxWidth: 900 }}>
        <Field label={t.detail.client} height={40} />
        <div className="seneca-payable-drawer__2col">
          {field(37)}
          {field(37)}
        </div>
        <div className="seneca-payable-drawer__2col">
          {field(37)}
          <Field label={einvoice.buyerReference} height={48} />
        </div>
        <div className="seneca-payable-drawer__2col">
          <Field label={t.detail.currency} height={48} />
          <Field label={t.detail.recurring} height={48} />
        </div>
        <div>
          <Skeleton variant="rounded" width={24} height={24} sx={{ borderRadius: '6px' }} />
          <span className="seneca-payable-drawer__field-label">{t.detail.pricesIncludeTax}</span>
        </div>
        <table className="seneca-invoice-lines__table">
          <colgroup>
            <col style={{ width: '24%' }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: '20%' }} />
            <col style={{ width: '14%' }} />
          </colgroup>
          <thead>
            <tr>
              <th className="seneca-invoice-lines__th">{t.detail.description}</th>
              <th className="seneca-invoice-lines__th">{t.detail.quantity}</th>
              <th className="seneca-invoice-lines__th">{t.detail.unitPrice}</th>
              <th className="seneca-invoice-lines__th">{t.detail.taxRate}</th>
              <th className="seneca-invoice-lines__th seneca-invoice-lines__th--right">
                {t.detail.amount}
              </th>
            </tr>
          </thead>
          <tbody>
            {ROW_KEYS.slice(0, 2).map(row => (
              <tr key={row} className="seneca-invoice-lines__row">
                <td className="seneca-invoice-lines__td">{field(48)}</td>
                <td className="seneca-invoice-lines__td">
                  {field(48)}
                  <div style={{ marginTop: 6 }}>{field(34)}</div>
                </td>
                <td className="seneca-invoice-lines__td">
                  {field(48)}
                  <div style={{ marginTop: 6 }}>{field(40)}</div>
                </td>
                <td className="seneca-invoice-lines__td">{field(40)}</td>
                <td className="seneca-invoice-lines__td" style={{ textAlign: 'right' }}>
                  {text(64)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

'use client';

import { useRouter } from 'next/navigation';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  MarkPaidDialog,
  type MarkPaidResult,
} from '@/app/(main)/statements/components/payables/MarkPaidDialog';
import CustomDatePicker from '@/app/components/CustomDatePicker';
import { ChevronLeft } from '@/app/components/icons';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { FORM_CONTROL_SX, Input } from '@/app/components/ui/input';
import { PRIVATE_CLASS, PrivateAmount } from '@/app/components/ui/private-amount';
import { Select } from '@/app/components/ui/select';
import { useWorkspace } from '@/app/contexts/WorkspaceContext';
import { useIntlayer, useLocale } from '@/app/i18n';
import { getApiErrorMessage } from '@/app/lib/api-error';
import {
  type CreateCreditNoteInput,
  type CreditNote,
  creditNotesApi,
} from '@/app/lib/credit-notes-api';
import { FALLBACK_CURRENCY } from '@/app/lib/currency';
import { formatMoney } from '@/app/lib/format-money';
import {
  type Invoice,
  type InvoiceDelivery,
  type InvoiceStatus,
  invoicesApi,
  type SendInvoiceEmailInput,
} from '@/app/lib/invoices-api';
import { type Payable, payablesApi } from '@/app/lib/payables-api';
import { CreditNoteDialog } from './CreditNoteDialog';
import { InvoiceEmailDrawer } from './InvoiceEmailDrawer';
import { InvoiceDetailSkeleton } from './InvoicesSkeletons';
import { InvoiceWizard } from './invoice-wizard/InvoiceWizard';
import { lineAmount, useInvoiceForm } from './invoice-wizard/useInvoiceForm';
import { formatInvoiceDate, getInvoiceStatusVariant } from './invoices-format';
import { PeppolPanel } from './PeppolPanel';
import { LineAdjustmentInput, UnitSelect, XRechnungMissingAlert } from './XRechnungFields';

interface InvoiceDetailViewProps {
  invoiceId: string;
}

export function InvoiceDetailView({ invoiceId }: InvoiceDetailViewProps): React.JSX.Element {
  const router = useRouter();
  const { currentWorkspace } = useWorkspace();
  const { locale } = useLocale();
  const t = useIntlayer('invoicesPage');
  const settingsLabels = useIntlayer('invoiceSettings');
  const isNew = invoiceId === 'new';

  const [loading, setLoading] = useState(!isNew);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const form = useInvoiceForm(isNew);
  const {
    clients,
    taxRates,
    clientId,
    issueDate,
    dueDate,
    currency,
    setCurrency,
    notes,
    buyerReference,
    deliveryDate,
    pricesIncludeTax,
    lineItems,
    recurrenceInterval,
    totals,
    fillFrom,
  } = form;
  const [xrechnungMissing, setXrechnungMissing] = useState<string[] | null>(null);
  const einvoice = useIntlayer('einvoiceFields');
  const [saving, setSaving] = useState(false);
  const [acting, setActing] = useState(false);
  const [payingPayable, setPayingPayable] = useState<Payable | null>(null);
  const [removingPaymentId, setRemovingPaymentId] = useState<string | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const [deliveries, setDeliveries] = useState<InvoiceDelivery[]>([]);
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [creditingInvoice, setCreditingInvoice] = useState<Invoice | null>(null);

  const isEditable = isNew || invoice?.status === 'draft';

  const loadInvoice = useCallback(async () => {
    if (isNew) {
      setCurrency(currentWorkspace?.currency?.toUpperCase() || FALLBACK_CURRENCY);
      return;
    }
    setLoading(true);
    await invoicesApi
      .getOne(invoiceId)
      .then(data => {
        setInvoice(data);
        fillFrom(data);
      })
      .catch(error => {
        toast.error(getApiErrorMessage(error, t.detail.notFound.value));
      })
      .finally(() => setLoading(false));
    // A failed delivery is not a reason to fail opening the invoice.
    await invoicesApi
      .deliveries(invoiceId)
      .then(setDeliveries)
      .catch(() => setDeliveries([]));
    await creditNotesApi
      .forInvoice(invoiceId)
      .then(setCreditNotes)
      .catch(() => setCreditNotes([]));
  }, [invoiceId, isNew, currentWorkspace, t.detail.notFound.value, fillFrom, setCurrency]);

  useEffect(() => {
    void loadInvoice();
  }, [loadInvoice]);

  // Read one key at a time: indexing an intlayer dictionary with a variable
  // types as `any` and silently loses a missing status.
  const statusLabels: Record<InvoiceStatus, string> = {
    draft: String(t.statusLabels.draft.value),
    sent: String(t.statusLabels.sent.value),
    partially_paid: String(t.statusLabels.partially_paid.value),
    paid: String(t.statusLabels.paid.value),
    overdue: String(t.statusLabels.overdue.value),
    void: String(t.statusLabels.void.value),
  };

  const handleSave = async (): Promise<void> => {
    if (!form.canSave) {
      return;
    }
    setSaving(true);
    await (isNew
      ? invoicesApi.create(form.buildPayload())
      : invoicesApi.update(invoiceId, form.buildPayload())
    )
      .then(saved => {
        toast.success(isNew ? t.toasts.createSuccess.value : t.toasts.updateSuccess.value);
        router.replace(`/invoices/${saved.id}`);
        setInvoice(saved);
      })
      .catch(error => {
        toast.error(getApiErrorMessage(error, t.toasts.genericFailed.value));
      })
      .finally(() => setSaving(false));
  };

  const handleEmail = async (payload: SendInvoiceEmailInput): Promise<void> => {
    if (!invoice) {
      return;
    }
    await invoicesApi
      .sendEmail(invoice.id, payload)
      .then(delivery => {
        setEmailOpen(false);
        setDeliveries(previous => [delivery, ...previous]);
        if (delivery.status === 'sent') {
          toast.success(t.detail.deliverySent.value);
        } else if (delivery.status === 'skipped') {
          toast.error(t.detail.deliverySkipped.value);
        } else {
          toast.error(delivery.error || t.detail.deliveryFailed.value);
        }
      })
      .catch(error => {
        toast.error(getApiErrorMessage(error, t.toasts.genericFailed.value));
      });
  };

  /** The document as the client will get it, before the number is spent. */
  /** The XRechnung of the invoice or of one of its credit notes, or what it still needs. */
  const handleXRechnung = async (note?: CreditNote): Promise<void> => {
    if (!invoice) {
      return;
    }
    const api = note ? creditNotesApi : invoicesApi;
    const id = note ? note.id : invoice.id;
    const fileName = note
      ? `${note.creditNoteNumber ?? 'credit-note'}.xml`
      : `${invoice.invoiceNumber ?? 'invoice'}.xml`;
    try {
      const { missing } = await api.checkXRechnung(id);
      if (missing.length > 0) {
        setXrechnungMissing(missing);
        return;
      }
      setXrechnungMissing(null);
      await api.downloadXRechnung(id, fileName);
    } catch (error) {
      toast.error(getApiErrorMessage(error, einvoice.downloadFailed.value));
    }
  };

  const handlePreview = async (): Promise<void> => {
    if (!invoice) {
      return;
    }
    await invoicesApi.openPreview(invoice.id).catch(error => {
      toast.error(getApiErrorMessage(error, t.toasts.genericFailed.value));
    });
  };

  const handleSend = async (): Promise<void> => {
    if (!(invoice && window.confirm(t.confirm.send.value))) {
      return;
    }
    setActing(true);
    await invoicesApi
      .send(invoice.id)
      .then(updated => {
        setInvoice(updated);
        toast.success(t.toasts.sendSuccess.value);
      })
      .catch(error => toast.error(getApiErrorMessage(error, t.toasts.genericFailed.value)))
      .finally(() => setActing(false));
  };

  const handleRemind = async (): Promise<void> => {
    if (!invoice) return;
    setActing(true);
    try {
      const result = await invoicesApi.remind(invoice.id);
      toast.success(t.toasts.reminderSent.value.replace('{{to}}', result.to));
    } catch {
      toast.error(t.toasts.reminderFailed.value);
    } finally {
      setActing(false);
    }
  };

  const handleVoid = async (): Promise<void> => {
    if (!(invoice && window.confirm(t.confirm.void.value))) {
      return;
    }
    setActing(true);
    await invoicesApi
      .void(invoice.id)
      .then(updated => {
        setInvoice(updated);
        toast.success(t.toasts.voidSuccess.value);
      })
      .catch(error => toast.error(getApiErrorMessage(error, t.toasts.genericFailed.value)))
      .finally(() => setActing(false));
  };

  const handleRecordPayment = async (): Promise<void> => {
    if (!invoice?.payableId) {
      return;
    }
    await payablesApi
      .getOne(invoice.payableId)
      .then(setPayingPayable)
      .catch(error => toast.error(getApiErrorMessage(error, t.toasts.genericFailed.value)));
  };

  const confirmMarkPaid = async (payable: Payable, result: MarkPaidResult): Promise<void> => {
    await (result.kind === 'full'
      ? payablesApi.markAsPaid(payable.id, result.payload)
      : result.kind === 'book'
        ? payablesApi.bookPayment(payable.id, result.paymentId, result.payload)
        : payablesApi.addPayment(payable.id, result.payload)
    )
      .then(async updated => {
        // Still short: the dialog stays open for the next instalment.
        setPayingPayable(updated.status === 'partially_paid' ? updated : null);
        await loadInvoice();
      })
      .catch(error => toast.error(getApiErrorMessage(error, t.toasts.genericFailed.value)));
  };

  const createCreditNote = async (payload: CreateCreditNoteInput): Promise<void> => {
    setActing(true);
    await creditNotesApi
      .create(payload)
      .then(async () => {
        setCreditingInvoice(null);
        await loadInvoice();
      })
      .catch(error => toast.error(getApiErrorMessage(error, t.toasts.genericFailed.value)))
      .finally(() => setActing(false));
  };

  const voidCreditNote = async (noteId: string): Promise<void> => {
    setActing(true);
    await creditNotesApi
      .void(noteId)
      .then(async () => {
        await loadInvoice();
      })
      .catch(error => toast.error(getApiErrorMessage(error, t.toasts.genericFailed.value)))
      .finally(() => setActing(false));
  };

  const removePayment = async (payable: Payable, paymentId: string): Promise<void> => {
    setRemovingPaymentId(paymentId);
    await payablesApi
      .removePayment(payable.id, paymentId)
      .then(async updated => {
        setPayingPayable(updated);
        await loadInvoice();
      })
      .catch(error => toast.error(getApiErrorMessage(error, t.toasts.genericFailed.value)))
      .finally(() => setRemovingPaymentId(null));
  };

  if (loading) {
    return <InvoiceDetailSkeleton />;
  }

  return (
    <div className="container-shared seneca-invoice-detail">
      <div className="seneca-invoice-detail__header">
        <button
          type="button"
          onClick={() => router.push('/invoices')}
          aria-label={t.actions.back.value}
          style={{ display: 'flex', border: 0, background: 'none', cursor: 'pointer' }}
        >
          <ChevronLeft size={20} />
        </button>
        <h1 style={{ fontSize: 22, fontWeight: 600 }}>
          {invoice?.invoiceNumber ?? t.detail.newTitle}
        </h1>
        {invoice && (
          <Badge variant={getInvoiceStatusVariant(invoice.status)}>
            {statusLabels[invoice.status] ?? invoice.status}
          </Badge>
        )}
        <div className="seneca-invoice-detail__actions">
          {invoice?.status !== 'draft' && invoice && (
            <Button
              variant="outline"
              onClick={() =>
                void invoicesApi.downloadPdf(invoice.id, `${invoice.invoiceNumber}.pdf`)
              }
            >
              {t.actions.downloadPdf.value}
            </Button>
          )}
          {invoice && invoice.status !== 'draft' && (
            <Button variant="outline" onClick={() => void handleXRechnung()}>
              {einvoice.downloadXRechnung.value}
            </Button>
          )}
          {invoice && invoice.status !== 'draft' && invoice.status !== 'void' && (
            <Button variant="outline" onClick={() => setEmailOpen(true)}>
              {t.detail.emailAction.value}
            </Button>
          )}
          {invoice?.payableId && invoice.status !== 'paid' && invoice.status !== 'void' && (
            <Button variant="outline" onClick={() => void handleRecordPayment()}>
              {t.actions.recordPayment.value}
            </Button>
          )}
          {/* Credit what the client no longer owes — the only correction left
              once an invoice is paid, where void is refused. */}
          {invoice && invoice.status !== 'draft' && invoice.status !== 'void' && (
            <Button variant="outline" onClick={() => setCreditingInvoice(invoice)}>
              {t.detail.creditNoteAction.value}
            </Button>
          )}
          {invoice?.status === 'draft' && (
            <Button variant="outline" onClick={() => void handlePreview()}>
              {t.detail.previewPdf.value}
            </Button>
          )}
          {invoice?.status === 'draft' && (
            <Button disabled={acting} onClick={() => void handleSend()}>
              {t.actions.send.value}
            </Button>
          )}
          {(invoice?.status === 'sent' || invoice?.status === 'overdue') && (
            <Button variant="outline" disabled={acting} onClick={() => void handleRemind()}>
              {t.actions.sendReminder.value}
            </Button>
          )}
          {(invoice?.status === 'draft' || invoice?.status === 'sent') && (
            <Button variant="outline" disabled={acting} onClick={() => void handleVoid()}>
              {t.actions.void.value}
            </Button>
          )}
        </div>
      </div>

      {isEditable ? (
        <InvoiceWizard
          form={form}
          startAtReview={!isNew}
          saving={saving}
          onSave={() => void handleSave()}
        />
      ) : (
        <div style={{ display: 'grid', gap: 16, maxWidth: 900 }}>
          {xrechnungMissing ? (
            <XRechnungMissingAlert
              missing={xrechnungMissing}
              onClose={() => setXrechnungMissing(null)}
            />
          ) : null}
          <div className="seneca-payable-drawer__field-group">
            <label className="seneca-payable-drawer__field-label" htmlFor="invoice-client">
              {t.detail.client.value}
            </label>
            <Select
              fullWidth
              id="invoice-client"
              value={clientId}
              disabled
              onChange={() => undefined}
              options={
                clients.length > 0
                  ? clients.map(client => ({ value: client.id, label: client.name }))
                  : // An empty list opened as a blank strip; say why instead.
                    [{ value: '', label: t.clients.empty.value, disabled: true }]
              }
            />
          </div>

          <div className="seneca-payable-drawer__2col">
            <CustomDatePicker
              label={t.columns.issueDate.value}
              value={issueDate}
              onChange={() => undefined}
            />
            <CustomDatePicker
              label={t.columns.dueDate.value}
              value={dueDate}
              onChange={() => undefined}
            />
          </div>

          <div className="seneca-payable-drawer__2col">
            <CustomDatePicker
              label={einvoice.deliveryDate.value}
              value={deliveryDate}
              onChange={() => undefined}
            />
            <div className="seneca-payable-drawer__field-group">
              <label
                className="seneca-payable-drawer__field-label"
                htmlFor="invoice-buyer-reference"
              >
                {einvoice.buyerReference}
              </label>
              <Input
                id="invoice-buyer-reference"
                value={buyerReference}
                disabled
                placeholder={einvoice.buyerReferencePlaceholder.value}
                readOnly
              />
            </div>
          </div>

          <div className="seneca-payable-drawer__2col">
            <div className="seneca-payable-drawer__field-group">
              <label className="seneca-payable-drawer__field-label" htmlFor="invoice-currency">
                {t.detail.currency.value}
              </label>
              <button
                id="invoice-currency"
                type="button"
                className="seneca-payable-drawer__currency-trigger"
                disabled
                aria-label={t.detail.currency.value}
              >
                {currency}
              </button>
            </div>
            <div className="seneca-payable-drawer__field-group">
              <label className="seneca-payable-drawer__field-label" htmlFor="invoice-recurrence">
                {t.detail.recurring.value}
              </label>
              <Select
                fullWidth
                id="invoice-recurrence"
                sx={FORM_CONTROL_SX}
                value={recurrenceInterval || 'none'}
                disabled
                onChange={() => undefined}
                options={[
                  { value: 'none', label: t.actions.cancel.value },
                  { value: 'weekly', label: t.detail.recurrenceInterval.weekly.value },
                  { value: 'monthly', label: t.detail.recurrenceInterval.monthly.value },
                  { value: 'quarterly', label: t.detail.recurrenceInterval.quarterly.value },
                  { value: 'yearly', label: t.detail.recurrenceInterval.yearly.value },
                ]}
              />
            </div>
          </div>

          <label
            className="seneca-payable-drawer__field-group"
            style={{ flexDirection: 'row', gap: 8 }}
          >
            <input type="checkbox" checked={pricesIncludeTax} disabled readOnly />
            <span className="seneca-payable-drawer__field-label">
              {t.detail.pricesIncludeTax.value}
            </span>
          </label>

          <div>
            <div style={{ overflowX: 'auto' }}>
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
                    <th className="seneca-invoice-lines__th">{t.detail.description.value}</th>
                    <th className="seneca-invoice-lines__th">{t.detail.quantity.value}</th>
                    <th className="seneca-invoice-lines__th">{t.detail.unitPrice.value}</th>
                    <th className="seneca-invoice-lines__th">{t.detail.taxRate.value}</th>
                    <th className="seneca-invoice-lines__th seneca-invoice-lines__th--right">
                      {t.detail.amount.value}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((line, index) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: rows have no stable id before saving
                    <tr key={index} className="seneca-invoice-lines__row">
                      <td
                        className="seneca-invoice-lines__td"
                        data-label={t.detail.description.value}
                      >
                        <Input value={line.description} disabled readOnly />
                      </td>
                      <td className="seneca-invoice-lines__td" data-label={t.detail.quantity.value}>
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          value={String(line.quantity)}
                          disabled
                          readOnly
                        />
                        <UnitSelect
                          value={line.unitCode || 'C62'}
                          disabled
                          onChange={() => undefined}
                        />
                      </td>
                      <td
                        className="seneca-invoice-lines__td"
                        data-label={t.detail.unitPrice.value}
                      >
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={String(line.unitPrice)}
                          disabled
                          readOnly
                        />
                        <LineAdjustmentInput
                          value={line.adjustmentPercent}
                          disabled
                          onChange={() => undefined}
                        />
                      </td>
                      <td className="seneca-invoice-lines__td" data-label={t.detail.taxRate.value}>
                        <Select
                          fullWidth
                          value={line.taxRateId || 'none'}
                          disabled
                          onChange={() => undefined}
                          options={[
                            { value: 'none', label: t.detail.noTax.value },
                            ...taxRates.map(rate => ({
                              value: rate.id,
                              label: `${rate.name} (${rate.rate}%)`,
                            })),
                          ]}
                          // Anchoring to the selected item (MUI's default) can place the
                          // menu off-screen inside this table's horizontally scrollable,
                          // narrow column; open it as a plain dropdown below the field.
                          MenuProps={{
                            anchorOrigin: { vertical: 'bottom', horizontal: 'left' },
                            transformOrigin: { vertical: 'top', horizontal: 'left' },
                          }}
                        />
                      </td>
                      <td
                        className="seneca-invoice-lines__td seneca-invoice-lines__td--right"
                        data-label={t.detail.amount.value}
                      >
                        <PrivateAmount>
                          {formatMoney(lineAmount(line), currency, locale)}
                        </PrivateAmount>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ display: 'grid', gap: 4, minWidth: 220 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <span>{t.detail.subtotal.value}</span>
                <span className={PRIVATE_CLASS}>
                  {formatMoney(totals.subtotal, currency, locale)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <span>{t.detail.tax.value}</span>
                <span className={PRIVATE_CLASS}>
                  {formatMoney(totals.taxTotal, currency, locale)}
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 16,
                  fontWeight: 700,
                }}
              >
                <span>{t.columns.total.value}</span>
                <span className={PRIVATE_CLASS}>{formatMoney(totals.total, currency, locale)}</span>
              </div>
              {/* Payments against the invoice: what the client still owes is the
                    number they care about, and it is not the total. */}
              {Number(invoice?.amountPaid ?? 0) > 0 && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                    <span>{t.detail.amountPaid.value}</span>
                    <span className={PRIVATE_CLASS}>
                      {formatMoney(Number(invoice?.amountPaid), currency, locale)}
                    </span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 14,
                      fontWeight: 600,
                    }}
                  >
                    <span>{t.detail.amountDue.value}</span>
                    <span className={PRIVATE_CLASS}>
                      {formatMoney(Number(invoice?.amountDue), currency, locale)}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          <div>
            <label className="seneca-payable-drawer__field-label" htmlFor="invoice-notes">
              {t.detail.notes.value}
            </label>
            <textarea
              id="invoice-notes"
              className="seneca-payable-drawer__textarea"
              value={notes}
              disabled
              readOnly
            />
          </div>

          {invoice && invoice.status !== 'draft' && (
            <div className="seneca-payable-drawer__field-group">
              <span className="seneca-payable-drawer__field-label">
                {t.detail.deliveryHistory.value}
              </span>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                {invoice.viewedAt
                  ? `${String(settingsLabels.viewed.value)} · ${formatInvoiceDate(invoice.viewedAt, locale)}`
                  : settingsLabels.notViewed.value}
              </p>
              {deliveries.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  {t.detail.deliveryNone.value}
                </p>
              ) : (
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 6 }}>
                  {deliveries.map(delivery => (
                    <li key={delivery.id} style={{ fontSize: 13 }}>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        {formatInvoiceDate(delivery.createdAt, locale)}
                      </span>{' '}
                      {delivery.recipient} —{' '}
                      <span
                        style={{
                          color:
                            delivery.status === 'sent' ? 'var(--foreground)' : 'var(--destructive)',
                        }}
                      >
                        {delivery.status === 'sent'
                          ? t.detail.deliverySent.value
                          : delivery.status === 'skipped'
                            ? t.detail.deliverySkipped.value
                            : delivery.error || t.detail.deliveryFailed.value}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {invoice && invoice.status !== 'draft' && invoice.status !== 'void' ? (
            <PeppolPanel kind="invoice" documentId={invoice.id} />
          ) : null}

          {creditNotes.length > 0 && (
            <div className="seneca-payable-drawer__field-group">
              <span className="seneca-payable-drawer__field-label">
                {t.detail.creditNotesTitle.value}
              </span>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 6 }}>
                {creditNotes.map(note => (
                  <li
                    key={note.id}
                    style={{
                      fontSize: 13,
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {formatInvoiceDate(note.issueDate, locale)}
                    </span>
                    <span style={{ fontWeight: 600 }}>{note.creditNoteNumber}</span>
                    <span className={PRIVATE_CLASS}>
                      {formatMoney(
                        Number(
                          note.applications?.find(
                            application => application.invoiceId === invoice?.id,
                          )?.amount ?? note.total,
                        ),
                        note.currency,
                        locale,
                      )}
                    </span>
                    {note.status === 'void' && <span>{t.statusLabels.void.value}</span>}
                    <Button
                      variant="outline"
                      onClick={() =>
                        void creditNotesApi.downloadPdf(
                          note.id,
                          `${note.creditNoteNumber ?? 'credit-note'}.pdf`,
                        )
                      }
                    >
                      {t.actions.downloadPdf.value}
                    </Button>
                    <Button variant="outline" onClick={() => void handleXRechnung(note)}>
                      {einvoice.downloadXRechnung.value}
                    </Button>
                    {note.status === 'issued' && (
                      <PeppolPanel kind="credit_note" documentId={note.id} compact />
                    )}
                    {note.status === 'issued' && (
                      <Button
                        variant="outline"
                        disabled={acting}
                        onClick={() => void voidCreditNote(note.id)}
                      >
                        {t.actions.void.value}
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <CreditNoteDialog
        invoice={creditingInvoice}
        creditable={
          Math.round((Number(invoice?.total ?? 0) - Number(invoice?.amountCredited ?? 0)) * 100) /
          100
        }
        submitting={acting}
        onClose={() => setCreditingInvoice(null)}
        onConfirm={payload => void createCreditNote(payload)}
      />

      <MarkPaidDialog
        payable={payingPayable}
        submitting={false}
        removingPaymentId={removingPaymentId}
        onClose={() => setPayingPayable(null)}
        onConfirm={(payable, result) => void confirmMarkPaid(payable, result)}
        onRemovePayment={(payable, paymentId) => void removePayment(payable, paymentId)}
      />

      <InvoiceEmailDrawer
        open={emailOpen}
        onClose={() => setEmailOpen(false)}
        onSubmit={handleEmail}
        defaultRecipient={invoice?.client?.email ?? ''}
        labels={{
          title: t.detail.emailTitle.value,
          recipient: t.detail.emailRecipient.value,
          subject: t.detail.emailSubject.value,
          message: t.detail.emailMessage.value,
          hint: t.detail.emailHint.value,
          send: t.actions.send.value,
          sending: t.actions.saving.value,
          cancel: t.actions.cancel.value,
        }}
      />
    </div>
  );
}

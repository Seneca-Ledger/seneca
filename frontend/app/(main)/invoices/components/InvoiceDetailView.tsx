/* eslint-disable max-lines */
'use client';

import { useRouter } from 'next/navigation';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  MarkPaidDialog,
  type MarkPaidResult,
} from '@/app/(main)/statements/components/payables/MarkPaidDialog';
import CustomDatePicker from '@/app/components/CustomDatePicker';
import { ChevronLeft, Trash2 } from '@/app/components/icons';
import { CurrencyDrawer } from '@/app/components/receipts/components/CurrencyDrawer';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { FORM_CONTROL_SX, Input } from '@/app/components/ui/input';
import { Select } from '@/app/components/ui/select';
import { useWorkspace } from '@/app/contexts/WorkspaceContext';
import { useCurrencyPickerState } from '@/app/hooks/useCurrencyPickerState';
import { useIntlayer, useLocale } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { getApiErrorMessage } from '@/app/lib/api-error';
import {
  type CreateCreditNoteInput,
  type CreditNote,
  creditNotesApi,
} from '@/app/lib/credit-notes-api';
import { FALLBACK_CURRENCY } from '@/app/lib/currency';
import { formatMoney } from '@/app/lib/format-money';
import {
  type Client,
  type CreateInvoiceInput,
  clientsApi,
  type Invoice,
  type InvoiceDelivery,
  type InvoiceLineItemInput,
  type InvoiceRecurrenceInterval,
  type InvoiceStatus,
  invoicesApi,
  type SendInvoiceEmailInput,
} from '@/app/lib/invoices-api';
import { type Payable, payablesApi } from '@/app/lib/payables-api';
import { CreditNoteDialog } from './CreditNoteDialog';
import { InvoiceEmailDrawer } from './InvoiceEmailDrawer';
import { formatInvoiceDate, getInvoiceStatusVariant } from './invoices-format';

interface TaxRateOption {
  id: string;
  name: string;
  rate: number;
}

const emptyLine = (): InvoiceLineItemInput => ({ description: '', quantity: 1, unitPrice: 0 });

const todayIso = (): string => new Date().toISOString().slice(0, 10);

const addDays = (iso: string, days: number): string => {
  const date = new Date(`${iso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

/**
 * The same split the backend does, so the drawer and the saved invoice agree:
 * a tax-inclusive price has its tax extracted, an exclusive one has it added.
 */
function computeTotals(
  lineItems: InvoiceLineItemInput[],
  taxRates: TaxRateOption[],
  pricesIncludeTax: boolean,
) {
  const rateById = new Map(taxRates.map(rate => [rate.id, rate.rate]));
  let subtotal = 0;
  let taxTotal = 0;
  for (const item of lineItems) {
    const amount = Number(item.quantity || 0) * Number(item.unitPrice || 0);
    const pct = item.taxRateId ? (rateById.get(item.taxRateId) ?? 0) : 0;
    const tax = pricesIncludeTax ? (amount * pct) / (100 + pct) : (amount * pct) / 100;
    subtotal += pricesIncludeTax ? amount - tax : amount;
    taxTotal += tax;
  }
  const round = (value: number) => Math.round(value * 100) / 100;
  return {
    subtotal: round(subtotal),
    taxTotal: round(taxTotal),
    total: round(subtotal + taxTotal),
  };
}

interface InvoiceDetailViewProps {
  invoiceId: string;
}

// eslint-disable-next-line max-lines-per-function, complexity
export function InvoiceDetailView({ invoiceId }: InvoiceDetailViewProps): React.JSX.Element {
  const router = useRouter();
  const { currentWorkspace } = useWorkspace();
  const { locale } = useLocale();
  const t = useIntlayer('invoicesPage');
  const settingsLabels = useIntlayer('invoiceSettings');
  const isNew = invoiceId === 'new';

  const [loading, setLoading] = useState(!isNew);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRateOption[]>([]);
  const [clientId, setClientId] = useState('');
  const [issueDate, setIssueDate] = useState(todayIso());
  const [dueDate, setDueDate] = useState(addDays(todayIso(), 14));
  const [currency, setCurrency] = useState(FALLBACK_CURRENCY);
  const {
    currencyDrawerOpen,
    setCurrencyDrawerOpen,
    currencySearch,
    setCurrencySearch,
    selectedCurrencyItem,
    selectedMatchesSearch,
    currencyQuery,
    recentCurrencyItems,
    allCurrencyItems,
    pushRecentCurrency,
  } = useCurrencyPickerState(currency);
  const [notes, setNotes] = useState('');
  const [pricesIncludeTax, setPricesIncludeTax] = useState(false);
  const [lineItems, setLineItems] = useState<InvoiceLineItemInput[]>([emptyLine()]);
  const [recurrenceInterval, setRecurrenceInterval] = useState<InvoiceRecurrenceInterval | ''>('');
  const [saving, setSaving] = useState(false);
  const [acting, setActing] = useState(false);
  const [payingPayable, setPayingPayable] = useState<Payable | null>(null);
  const [removingPaymentId, setRemovingPaymentId] = useState<string | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const [deliveries, setDeliveries] = useState<InvoiceDelivery[]>([]);
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [creditingInvoice, setCreditingInvoice] = useState<Invoice | null>(null);

  const isEditable = isNew || invoice?.status === 'draft';

  const loadOptions = useCallback(async () => {
    const [clientList, taxRateResponse] = await Promise.all([
      clientsApi.list(),
      apiClient.get('/tax-rates'),
    ]);
    setClients(clientList);
    const rawTaxRates = (taxRateResponse.data?.data ?? taxRateResponse.data ?? []) as Array<
      TaxRateOption & { rate: number | string }
    >;
    setTaxRates(rawTaxRates.map(rate => ({ ...rate, rate: Number(rate.rate ?? 0) })));
  }, []);

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
        setClientId(data.clientId);
        setIssueDate(data.issueDate.slice(0, 10));
        setDueDate(data.dueDate.slice(0, 10));
        setCurrency(data.currency);
        setNotes(data.notes || '');
        setRecurrenceInterval(data.recurrenceInterval || '');
        setPricesIncludeTax(Boolean(data.pricesIncludeTax));
        setLineItems(
          (data.lineItems || []).map(item => ({
            description: item.description,
            quantity: Number(item.quantity),
            unitPrice: Number(item.unitPrice),
            taxRateId: item.taxRateId || undefined,
            categoryId: item.categoryId || undefined,
          })),
        );
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
  }, [invoiceId, isNew, currentWorkspace, t.detail.notFound.value]);

  useEffect(() => {
    void loadOptions();
    void loadInvoice();
  }, [loadOptions, loadInvoice]);

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

  const totals = useMemo(
    () => computeTotals(lineItems, taxRates, pricesIncludeTax),
    [lineItems, taxRates, pricesIncludeTax],
  );

  const updateLine = (index: number, patch: Partial<InvoiceLineItemInput>): void => {
    setLineItems(current => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  };

  const removeLine = (index: number): void => {
    setLineItems(current => current.filter((_, i) => i !== index));
  };

  const handleSelectCurrency = (code: string): void => {
    setCurrency(code);
    pushRecentCurrency(code);
  };

  const canSave =
    clientId.length > 0 &&
    lineItems.length > 0 &&
    lineItems.every(line => line.description.trim().length > 0 && line.unitPrice >= 0);

  const buildPayload = (): CreateInvoiceInput => ({
    clientId,
    issueDate,
    dueDate,
    currency,
    notes: notes || undefined,
    pricesIncludeTax,
    lineItems: lineItems.map(line => ({
      description: line.description.trim(),
      quantity: Number(line.quantity),
      unitPrice: Number(line.unitPrice),
      taxRateId: line.taxRateId || undefined,
      categoryId: line.categoryId || undefined,
    })),
    recurrenceInterval: recurrenceInterval || undefined,
  });

  const handleSave = async (): Promise<void> => {
    if (!canSave) {
      return;
    }
    setSaving(true);
    await (isNew
      ? invoicesApi.create(buildPayload())
      : invoicesApi.update(invoiceId, buildPayload())
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

  /**
   * Picking a client on a new invoice also sets the due date from its payment
   * terms: "net 30" is a property of the relationship, not something to retype.
   */
  const handlePickClient = (next: string): void => {
    setClientId(next);
    const picked = clients.find(client => client.id === next);
    if (isNew && picked?.paymentTermsDays != null) {
      setDueDate(addDays(issueDate, picked.paymentTermsDays));
    }
  };

  /**
   * Appends a late-fee line, computed from what this client is actually
   * overdue on — not from the invoice being written. The user adds it; nothing
   * is charged behind their back.
   */
  const handleAddLateFee = async (): Promise<void> => {
    if (!clientId) {
      return;
    }
    await invoicesApi
      .lateFeeQuote(clientId)
      .then(quote => {
        const match = quote.amounts.find(entry => entry.currency === currency);
        if (!match || match.fee <= 0) {
          toast.error(t.detail.lateFeeNone.value);
          return;
        }
        setLineItems(previous => [
          ...previous,
          {
            description: String(t.detail.lateFeeLine.value).replace(
              '{percent}',
              String(quote.percent),
            ),
            quantity: 1,
            unitPrice: match.fee,
          },
        ]);
      })
      .catch(error => {
        toast.error(getApiErrorMessage(error, t.toasts.genericFailed.value));
      });
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
    return <div style={{ padding: 40 }}>—</div>;
  }

  return (
    <div className="container-shared lumio-invoice-detail">
      <div className="lumio-invoice-detail__header">
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
        <div className="lumio-invoice-detail__actions">
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

      <div style={{ display: 'grid', gap: 16, maxWidth: 900 }}>
        <div className="lumio-payable-drawer__field-group">
          <label className="lumio-payable-drawer__field-label" htmlFor="invoice-client">
            {t.detail.client.value}
          </label>
          <Select
            fullWidth
            id="invoice-client"
            value={clientId}
            disabled={!isEditable}
            onChange={handlePickClient}
            options={
              clients.length > 0
                ? clients.map(client => ({ value: client.id, label: client.name }))
                : // An empty list opened as a blank strip; say why instead.
                  [{ value: '', label: t.clients.empty.value, disabled: true }]
            }
          />
        </div>

        <div className="lumio-payable-drawer__2col">
          <CustomDatePicker
            label={t.columns.issueDate.value}
            value={issueDate}
            onChange={isEditable ? setIssueDate : () => undefined}
          />
          <CustomDatePicker
            label={t.columns.dueDate.value}
            value={dueDate}
            onChange={isEditable ? setDueDate : () => undefined}
          />
        </div>

        <div className="lumio-payable-drawer__2col">
          <div className="lumio-payable-drawer__field-group">
            <label className="lumio-payable-drawer__field-label" htmlFor="invoice-currency">
              {t.detail.currency.value}
            </label>
            <button
              id="invoice-currency"
              type="button"
              className="lumio-payable-drawer__currency-trigger"
              onClick={() => isEditable && setCurrencyDrawerOpen(true)}
              disabled={!isEditable}
              aria-label={t.detail.currency.value}
            >
              {currency}
            </button>
          </div>
          <div className="lumio-payable-drawer__field-group">
            <label className="lumio-payable-drawer__field-label" htmlFor="invoice-recurrence">
              {t.detail.recurring.value}
            </label>
            <Select
              fullWidth
              id="invoice-recurrence"
              sx={FORM_CONTROL_SX}
              value={recurrenceInterval || 'none'}
              disabled={!isEditable}
              onChange={next =>
                setRecurrenceInterval(next === 'none' ? '' : (next as InvoiceRecurrenceInterval))
              }
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
          className="lumio-payable-drawer__field-group"
          style={{ flexDirection: 'row', gap: 8 }}
        >
          <input
            type="checkbox"
            checked={pricesIncludeTax}
            disabled={!isEditable}
            onChange={event => setPricesIncludeTax(event.target.checked)}
          />
          <span className="lumio-payable-drawer__field-label">
            {t.detail.pricesIncludeTax.value}
          </span>
        </label>

        <div>
          <div style={{ overflowX: 'auto' }}>
            <table className="lumio-invoice-lines__table">
              <colgroup>
                <col style={{ width: '24%' }} />
                <col style={{ width: '18%' }} />
                <col style={{ width: '18%' }} />
                <col style={{ width: '20%' }} />
                <col style={{ width: '14%' }} />
                {isEditable && <col style={{ width: '6%' }} />}
              </colgroup>
              <thead>
                <tr>
                  <th className="lumio-invoice-lines__th">{t.detail.description.value}</th>
                  <th className="lumio-invoice-lines__th">{t.detail.quantity.value}</th>
                  <th className="lumio-invoice-lines__th">{t.detail.unitPrice.value}</th>
                  <th className="lumio-invoice-lines__th">{t.detail.taxRate.value}</th>
                  <th className="lumio-invoice-lines__th lumio-invoice-lines__th--right">
                    {t.detail.amount.value}
                  </th>
                  {isEditable && <th className="lumio-invoice-lines__th" />}
                </tr>
              </thead>
              <tbody>
                {lineItems.map((line, index) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: rows have no stable id before saving
                  <tr key={index} className="lumio-invoice-lines__row">
                    <td className="lumio-invoice-lines__td" data-label={t.detail.description.value}>
                      <Input
                        value={line.description}
                        disabled={!isEditable}
                        onChange={event => updateLine(index, { description: event.target.value })}
                      />
                    </td>
                    <td className="lumio-invoice-lines__td" data-label={t.detail.quantity.value}>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={String(line.quantity)}
                        disabled={!isEditable}
                        onChange={event =>
                          updateLine(index, { quantity: Number(event.target.value) })
                        }
                      />
                    </td>
                    <td className="lumio-invoice-lines__td" data-label={t.detail.unitPrice.value}>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={String(line.unitPrice)}
                        disabled={!isEditable}
                        onChange={event =>
                          updateLine(index, { unitPrice: Number(event.target.value) })
                        }
                      />
                    </td>
                    <td className="lumio-invoice-lines__td" data-label={t.detail.taxRate.value}>
                      <Select
                        fullWidth
                        value={line.taxRateId || 'none'}
                        disabled={!isEditable}
                        onChange={next =>
                          updateLine(index, { taxRateId: next === 'none' ? undefined : next })
                        }
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
                      className="lumio-invoice-lines__td lumio-invoice-lines__td--right"
                      data-label={t.detail.amount.value}
                    >
                      {formatMoney(
                        Number(line.quantity) * Number(line.unitPrice),
                        currency,
                        locale,
                      )}
                    </td>
                    {isEditable && (
                      <td className="lumio-invoice-lines__td lumio-invoice-lines__td--actions">
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={t.actions.delete.value}
                          onClick={() => removeLine(index)}
                          disabled={lineItems.length <= 1}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {isEditable && (
            <Button
              variant="outline"
              style={{ marginTop: 8 }}
              onClick={() => setLineItems(current => [...current, emptyLine()])}
            >
              {t.actions.addLine.value}
            </Button>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ display: 'grid', gap: 4, minWidth: 220 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
              <span>{t.detail.subtotal.value}</span>
              <span>{formatMoney(totals.subtotal, currency, locale)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
              <span>{t.detail.tax.value}</span>
              <span>{formatMoney(totals.taxTotal, currency, locale)}</span>
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
              <span>{formatMoney(totals.total, currency, locale)}</span>
            </div>
            {/* Payments against the invoice: what the client still owes is the
                number they care about, and it is not the total. */}
            {Number(invoice?.amountPaid ?? 0) > 0 && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                  <span>{t.detail.amountPaid.value}</span>
                  <span>{formatMoney(Number(invoice?.amountPaid), currency, locale)}</span>
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
                  <span>{formatMoney(Number(invoice?.amountDue), currency, locale)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        <div>
          <label className="lumio-payable-drawer__field-label" htmlFor="invoice-notes">
            {t.detail.notes.value}
          </label>
          <textarea
            id="invoice-notes"
            className="lumio-payable-drawer__textarea"
            value={notes}
            disabled={!isEditable}
            onChange={event => setNotes(event.target.value)}
          />
        </div>

        {invoice && invoice.status !== 'draft' && (
          <div className="lumio-payable-drawer__field-group">
            <span className="lumio-payable-drawer__field-label">
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

        {creditNotes.length > 0 && (
          <div className="lumio-payable-drawer__field-group">
            <span className="lumio-payable-drawer__field-label">
              {t.detail.creditNotesTitle.value}
            </span>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 6 }}>
              {creditNotes.map(note => (
                <li
                  key={note.id}
                  style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {formatInvoiceDate(note.issueDate, locale)}
                  </span>
                  <span style={{ fontWeight: 600 }}>{note.creditNoteNumber}</span>
                  <span>
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

        {isEditable && lineItems.length > 0 && clientId ? (
          <div>
            <Button variant="outline" onClick={() => void handleAddLateFee()}>
              {t.detail.lateFeeAdd.value}
            </Button>
          </div>
        ) : null}

        {isEditable && (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="outline" onClick={() => router.push('/invoices')}>
              {t.actions.cancel.value}
            </Button>
            <Button disabled={!canSave || saving} onClick={() => void handleSave()}>
              {saving ? t.actions.saving.value : t.actions.save.value}
            </Button>
          </div>
        )}
      </div>

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

      <CurrencyDrawer
        isOpen={currencyDrawerOpen}
        onClose={() => setCurrencyDrawerOpen(false)}
        currencySearch={currencySearch}
        setCurrencySearch={setCurrencySearch}
        selectedCurrencyItem={selectedCurrencyItem}
        selectedMatchesSearch={selectedMatchesSearch}
        currencyQuery={currencyQuery}
        recentCurrencyItems={recentCurrencyItems}
        allCurrencyItems={allCurrencyItems}
        handleSelectCurrency={handleSelectCurrency}
        zIndex={1400}
      />
    </div>
  );
}

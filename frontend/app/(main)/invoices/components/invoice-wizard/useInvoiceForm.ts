'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useIntlayer } from '@/app/i18n';
import { getApiErrorMessage } from '@/app/lib/api-error';
import { FALLBACK_CURRENCY } from '@/app/lib/currency';
import {
  type Client,
  type CreateInvoiceInput,
  clientsApi,
  type Invoice,
  type InvoiceLineItemInput,
  type InvoiceRecurrenceInterval,
  invoicesApi,
} from '@/app/lib/invoices-api';
import { apiQueryDecoded } from '@/app/lib/query-fn-schema';

export interface TaxRateOption {
  id: string;
  name: string;
  rate: number;
}

const emptyLine = (): InvoiceLineItemInput => ({
  description: '',
  quantity: 1,
  unitPrice: 0,
  unitCode: 'C62',
});

const todayIso = (): string => new Date().toISOString().slice(0, 10);

const addDays = (iso: string, days: number): string => {
  const date = new Date(`${iso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const round2 = (value: number) => Math.round(value * 100) / 100;

/** Quantity × unit price after the line's discount or surcharge, as the backend prices it. */
export function lineAmount(item: InvoiceLineItemInput): number {
  const base = round2(Number(item.quantity || 0) * Number(item.unitPrice || 0));
  const percent = Number(item.adjustmentPercent || 0);
  return round2(base + (percent ? round2((base * percent) / 100) : 0));
}

/**
 * The same split the backend does, so the form and the saved invoice agree:
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
    const amount = lineAmount(item);
    const pct = item.taxRateId ? (rateById.get(item.taxRateId) ?? 0) : 0;
    const tax = pricesIncludeTax ? (amount * pct) / (100 + pct) : (amount * pct) / 100;
    subtotal += pricesIncludeTax ? amount - tax : amount;
    taxTotal += tax;
  }
  return {
    subtotal: round2(subtotal),
    taxTotal: round2(taxTotal),
    total: round2(subtotal + taxTotal),
  };
}

/** A line is ready once it says what it is for and has a price that is not negative. */
export const isLineComplete = (line: InvoiceLineItemInput): boolean =>
  line.description.trim().length > 0 && line.unitPrice >= 0;

/**
 * The editable fields of an invoice, the clients and tax rates to pick from,
 * and the payload they save as. Shared by the wizard (new and draft invoices)
 * and the read-only view of an issued one.
 */
export function useInvoiceForm(isNew: boolean) {
  const t = useIntlayer('invoicesPage');
  const [clients, setClients] = useState<Client[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRateOption[]>([]);
  const [clientId, setClientId] = useState('');
  const [issueDate, setIssueDate] = useState(todayIso());
  const [dueDate, setDueDate] = useState(addDays(todayIso(), 14));
  const [currency, setCurrency] = useState(FALLBACK_CURRENCY);
  const [notes, setNotes] = useState('');
  const [buyerReference, setBuyerReference] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [pricesIncludeTax, setPricesIncludeTax] = useState(false);
  const [lineItems, setLineItems] = useState<InvoiceLineItemInput[]>([emptyLine()]);
  const [recurrenceInterval, setRecurrenceInterval] = useState<InvoiceRecurrenceInterval | ''>('');

  const loadOptions = useCallback(async () => {
    const [clientList, rawTaxRates] = await Promise.all([
      clientsApi.list(),
      apiQueryDecoded({ url: '/tax-rates', contract: 'TaxRateList' }),
    ]);
    setClients(clientList);
    setTaxRates(rawTaxRates.map(rate => ({ ...rate, rate: Number(rate.rate) })));
  }, []);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  const fillFrom = useCallback((data: Invoice): void => {
    setClientId(data.clientId);
    setIssueDate(data.issueDate.slice(0, 10));
    setDueDate(data.dueDate.slice(0, 10));
    setCurrency(data.currency);
    setNotes(data.notes || '');
    setBuyerReference(data.buyerReference || '');
    setDeliveryDate(data.deliveryDate ? data.deliveryDate.slice(0, 10) : '');
    setRecurrenceInterval(data.recurrenceInterval || '');
    setPricesIncludeTax(Boolean(data.pricesIncludeTax));
    setLineItems(
      (data.lineItems || []).map(item => ({
        description: item.description,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        taxRateId: item.taxRateId || undefined,
        categoryId: item.categoryId || undefined,
        unitCode: item.unitCode || 'C62',
        adjustmentPercent: Number(item.adjustmentPercent || 0) || undefined,
      })),
    );
  }, []);

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

  const addLine = (): void => {
    setLineItems(current => [...current, emptyLine()]);
  };

  /** One rate for every line: the usual case, picked once instead of per row. */
  const setTaxRateForAll = (taxRateId: string | undefined): void => {
    setLineItems(current => current.map(line => ({ ...line, taxRateId })));
  };

  const canSave = clientId.length > 0 && lineItems.length > 0 && lineItems.every(isLineComplete);

  const buildPayload = (): CreateInvoiceInput => ({
    clientId,
    issueDate,
    dueDate,
    currency,
    notes: notes || undefined,
    pricesIncludeTax,
    buyerReference: buyerReference.trim(),
    ...(deliveryDate ? { deliveryDate } : {}),
    lineItems: lineItems.map(line => ({
      description: line.description.trim(),
      quantity: Number(line.quantity),
      unitPrice: Number(line.unitPrice),
      taxRateId: line.taxRateId || undefined,
      categoryId: line.categoryId || undefined,
      unitCode: line.unitCode || 'C62',
      ...(line.adjustmentPercent ? { adjustmentPercent: line.adjustmentPercent } : {}),
    })),
    recurrenceInterval: recurrenceInterval || undefined,
  });

  /**
   * Picking a client on a new invoice also sets the due date from its payment
   * terms: "net 30" is a property of the relationship, not something to retype.
   */
  const applyClient = (picked: Client): void => {
    setClientId(picked.id);
    if (isNew && picked.paymentTermsDays != null) {
      setDueDate(addDays(issueDate, picked.paymentTermsDays));
    }
  };

  const pickClient = (next: string): void => {
    const picked = clients.find(client => client.id === next);
    if (picked) {
      applyClient(picked);
    } else {
      setClientId(next);
    }
  };

  /** A client created from inside the invoice joins the list and is the one billed. */
  const addClient = (client: Client): void => {
    setClients(current => [...current, client]);
    applyClient(client);
  };

  /**
   * Appends a late-fee line, computed from what this client is actually
   * overdue on — not from the invoice being written. The user adds it; nothing
   * is charged behind their back.
   */
  const addLateFee = async (): Promise<void> => {
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

  return {
    clients,
    taxRates,
    clientId,
    issueDate,
    setIssueDate,
    dueDate,
    setDueDate,
    currency,
    setCurrency,
    notes,
    setNotes,
    buyerReference,
    setBuyerReference,
    deliveryDate,
    setDeliveryDate,
    pricesIncludeTax,
    setPricesIncludeTax,
    lineItems,
    recurrenceInterval,
    setRecurrenceInterval,
    totals,
    canSave,
    fillFrom,
    updateLine,
    removeLine,
    addLine,
    setTaxRateForAll,
    pickClient,
    addClient,
    addLateFee,
    buildPayload,
  };
}

export type InvoiceForm = ReturnType<typeof useInvoiceForm>;

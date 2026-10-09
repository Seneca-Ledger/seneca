'use client';

import { useRouter } from 'next/navigation';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { ImportFromFileButton } from '@/app/components/import-wizard/ImportFromFileButton';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { EmptyStateIllustration } from '@/app/components/ui/EmptyStateIllustration';
import { AppPagination } from '@/app/components/ui/pagination';
import { Select } from '@/app/components/ui/select';
import { useWorkspace } from '@/app/contexts/WorkspaceContext';
import { useAuth } from '@/app/hooks/useAuth';
import { useIntlayer, useLocale } from '@/app/i18n';
import { getApiErrorMessage } from '@/app/lib/api-error';
import { formatMoney } from '@/app/lib/format-money';
import { type Invoice, type InvoiceStatus, invoicesApi } from '@/app/lib/invoices-api';
import { InvoiceAgeingPanel } from './InvoiceAgeingPanel';
import { formatInvoiceDate, getInvoiceStatusVariant } from './invoices-format';

const PAGE_SIZE = 20;

export function InvoicesListView(): React.JSX.Element {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { currentWorkspace, loading: workspaceLoading } = useWorkspace();
  const { locale } = useLocale();
  const t = useIntlayer('invoicesPage');

  const [items, setItems] = useState<Invoice[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<InvoiceStatus | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!(user && currentWorkspace)) {
      setLoading(false);
      return;
    }
    setLoading(true);
    await invoicesApi
      .list({ page, limit: PAGE_SIZE, status: status === 'all' ? undefined : status })
      .then(response => {
        setItems(response.data);
        setTotal(response.total);
        setTotalPages(Math.max(1, response.totalPages || 1));
      })
      .catch(error => {
        toast.error(getApiErrorMessage(error, t.toasts.loadFailed.value));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [user, currentWorkspace, page, status, t.toasts.loadFailed.value]);

  useEffect(() => {
    if (authLoading || workspaceLoading) {
      return;
    }
    void load();
  }, [authLoading, workspaceLoading, load]);

  const handleSend = async (invoice: Invoice): Promise<void> => {
    if (!window.confirm(t.confirm.send.value)) {
      return;
    }
    setActingId(invoice.id);
    await invoicesApi
      .send(invoice.id)
      .then(() => {
        toast.success(t.toasts.sendSuccess.value);
        return load();
      })
      .catch(error => {
        toast.error(getApiErrorMessage(error, t.toasts.genericFailed.value));
      })
      .finally(() => setActingId(null));
  };

  const handleVoid = async (invoice: Invoice): Promise<void> => {
    if (!window.confirm(t.confirm.void.value)) {
      return;
    }
    setActingId(invoice.id);
    await invoicesApi
      .void(invoice.id)
      .then(() => {
        toast.success(t.toasts.voidSuccess.value);
        return load();
      })
      .catch(error => {
        toast.error(getApiErrorMessage(error, t.toasts.genericFailed.value));
      })
      .finally(() => setActingId(null));
  };

  const handleDelete = async (invoice: Invoice): Promise<void> => {
    if (!window.confirm(t.confirm.delete.value)) {
      return;
    }
    setDeletingId(invoice.id);
    await invoicesApi
      .delete(invoice.id)
      .then(() => {
        toast.success(t.toasts.deleteSuccess.value);
        return load();
      })
      .catch(error => {
        toast.error(getApiErrorMessage(error, t.toasts.genericFailed.value));
      })
      .finally(() => setDeletingId(null));
  };

  const handleDownload = async (invoice: Invoice): Promise<void> => {
    await invoicesApi
      .downloadPdf(invoice.id, `${invoice.invoiceNumber ?? 'invoice'}.pdf`)
      .catch(error => {
        toast.error(getApiErrorMessage(error, t.toasts.genericFailed.value));
      });
  };

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

  if (authLoading || workspaceLoading || loading) {
    return (
      <div className="container-shared lumio-stmt-list" style={{ padding: '40px 16px' }}>
        —
      </div>
    );
  }

  return (
    <div className="container-shared lumio-stmt-list">
      <div
        style={{
          marginBottom: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 16,
            justifyContent: 'flex-end',
            alignItems: 'flex-start',
          }}
        >
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Button variant="outline" onClick={() => router.push('/invoices/clients')}>
              {t.clientsNav}
            </Button>
            <ImportFromFileButton
              target="invoices"
              onImported={() => void load()}
              renderTrigger={(open, label) => (
                <Button variant="outline" onClick={open}>
                  {label}
                </Button>
              )}
            />
            <Button onClick={() => router.push('/invoices/new')}>{t.newInvoice}</Button>
          </div>
        </div>

        <Select
          size="small"
          value={status}
          onChange={next => {
            setStatus(next as InvoiceStatus | 'all');
            setPage(1);
          }}
          options={[
            { value: 'all', label: t.columns.status.value },
            { value: 'draft', label: statusLabels.draft },
            { value: 'sent', label: statusLabels.sent },
            { value: 'partially_paid', label: statusLabels.partially_paid },
            { value: 'paid', label: statusLabels.paid },
            { value: 'overdue', label: statusLabels.overdue },
            { value: 'void', label: statusLabels.void },
          ]}
          sx={{ maxWidth: 220 }}
        />
      </div>

      <InvoiceAgeingPanel />

      {items.length === 0 ? (
        <div className="lumio-payable-list__empty">
          <EmptyStateIllustration name="receivables" size="md" />
          <h3 style={{ fontSize: 18, fontWeight: 600 }}>{t.empty.title}</h3>
          <p style={{ marginTop: 8, fontSize: 14, color: 'var(--text-secondary)' }}>
            {t.empty.description}
          </p>
        </div>
      ) : (
        <div className="lumio-payable-list">
          <div className="lumio-payable-list__table-wrap">
            <table className="lumio-payable-list__table">
              <thead className="lumio-payable-list__thead">
                <tr>
                  <th className="lumio-payable-list__th">{t.columns.number.value}</th>
                  <th className="lumio-payable-list__th">{t.columns.client.value}</th>
                  <th className="lumio-payable-list__th">{t.columns.issueDate.value}</th>
                  <th className="lumio-payable-list__th">{t.columns.dueDate.value}</th>
                  <th className="lumio-payable-list__th">{t.columns.status.value}</th>
                  <th className="lumio-payable-list__th lumio-payable-list__th--right">
                    {t.columns.total.value}
                  </th>
                  <th className="lumio-payable-list__th lumio-payable-list__th--right">
                    {t.columns.actions.value}
                  </th>
                </tr>
              </thead>
              <tbody className="lumio-payable-list__tbody">
                {items.map(invoice => (
                  <tr key={invoice.id}>
                    <td className="lumio-payable-list__td" style={{ fontWeight: 500 }}>
                      {invoice.invoiceNumber ?? t.statusLabels.draft.value}
                    </td>
                    <td className="lumio-payable-list__td">{invoice.client?.name ?? '—'}</td>
                    <td className="lumio-payable-list__td">
                      {formatInvoiceDate(invoice.issueDate, locale)}
                    </td>
                    <td className="lumio-payable-list__td">
                      {formatInvoiceDate(invoice.dueDate, locale)}
                    </td>
                    <td className="lumio-payable-list__td">
                      <Badge variant={getInvoiceStatusVariant(invoice.status)}>
                        {statusLabels[invoice.status] ?? invoice.status}
                      </Badge>
                    </td>
                    <td
                      className="lumio-payable-list__td"
                      style={{ textAlign: 'right', fontWeight: 600 }}
                    >
                      {formatMoney(Number(invoice.total), invoice.currency, locale)}
                      {/* A part-paid invoice is neither unpaid nor settled. */}
                      {Number(invoice.amountPaid ?? 0) > 0 &&
                        Number(invoice.amountDue ?? 0) > 0 && (
                          <div
                            style={{
                              fontWeight: 400,
                              fontSize: 13,
                              color: 'var(--text-secondary)',
                            }}
                          >
                            {t.detail.amountDue.value}{' '}
                            {formatMoney(Number(invoice.amountDue), invoice.currency, locale)}
                          </div>
                        )}
                    </td>
                    <td className="lumio-payable-list__td">
                      <div className="lumio-payable-list__actions">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => router.push(`/invoices/${invoice.id}`)}
                        >
                          {t.actions.edit.value}
                        </Button>
                        {invoice.status === 'draft' && (
                          <Button
                            size="sm"
                            variant="soft"
                            disabled={actingId === invoice.id}
                            onClick={() => void handleSend(invoice)}
                          >
                            {t.actions.send.value}
                          </Button>
                        )}
                        {(invoice.status === 'draft' || invoice.status === 'sent') && (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={actingId === invoice.id}
                            onClick={() => void handleVoid(invoice)}
                          >
                            {t.actions.void.value}
                          </Button>
                        )}
                        {invoice.status !== 'draft' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => void handleDownload(invoice)}
                          >
                            {t.actions.downloadPdf.value}
                          </Button>
                        )}
                        {invoice.status === 'draft' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={deletingId === invoice.id}
                            onClick={() => void handleDelete(invoice)}
                          >
                            {t.actions.delete.value}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="lumio-payable-list__pagination-row">
            <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{total}</div>
            <AppPagination page={page} total={totalPages} onChange={setPage} />
          </div>
        </div>
      )}
    </div>
  );
}

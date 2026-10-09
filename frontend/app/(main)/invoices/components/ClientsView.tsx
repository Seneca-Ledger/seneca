'use client';

import { useRouter } from 'next/navigation';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { ChevronLeft } from '@/app/components/icons';
import { Button } from '@/app/components/ui/button';
import { EmptyStateIllustration } from '@/app/components/ui/EmptyStateIllustration';
import { useWorkspace } from '@/app/contexts/WorkspaceContext';
import { useIntlayer } from '@/app/i18n';
import { getApiErrorMessage } from '@/app/lib/api-error';
import { FALLBACK_CURRENCY } from '@/app/lib/currency';
import {
  type Client,
  type CreateClientInput,
  clientsApi,
  type UpdateClientInput,
} from '@/app/lib/invoices-api';
import { ClientDrawer } from './ClientDrawer';

export function ClientsView(): React.JSX.Element {
  const router = useRouter();
  const t = useIntlayer('invoicesPage');
  const invoiceSettings = useIntlayer('invoiceSettings');
  const { currentWorkspace } = useWorkspace();
  const defaultCurrency = currentWorkspace?.currency?.toUpperCase() || FALLBACK_CURRENCY;

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    await clientsApi
      .list()
      .then(setClients)
      .catch(error => toast.error(getApiErrorMessage(error, t.toasts.loadFailed.value)))
      .finally(() => setLoading(false));
  }, [t.toasts.loadFailed.value]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async (payload: CreateClientInput | UpdateClientInput): Promise<void> => {
    setSaving(true);
    await (editingClient
      ? clientsApi.update(editingClient.id, payload as UpdateClientInput)
      : clientsApi.create(payload as CreateClientInput)
    )
      .then(async () => {
        toast.success(editingClient ? t.toasts.updateSuccess.value : t.toasts.createSuccess.value);
        setDrawerOpen(false);
        setEditingClient(null);
        await load();
      })
      .catch(error => toast.error(getApiErrorMessage(error, t.toasts.genericFailed.value)))
      .finally(() => setSaving(false));
  };

  const handleDelete = async (client: Client): Promise<void> => {
    if (!window.confirm(t.clients.deleteConfirm.value.replace('{name}', client.name))) {
      return;
    }
    setDeletingId(client.id);
    await clientsApi
      .delete(client.id)
      .then(async () => {
        toast.success(t.toasts.deleteSuccess.value);
        await load();
      })
      .catch(error => toast.error(getApiErrorMessage(error, t.toasts.genericFailed.value)))
      .finally(() => setDeletingId(null));
  };

  if (loading) {
    return <div style={{ padding: 40 }}>—</div>;
  }

  return (
    <div className="container-shared lumio-stmt-list">
      <div
        style={{
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <button
          type="button"
          onClick={() => router.push('/invoices')}
          aria-label={t.actions.back.value}
          style={{ display: 'flex', border: 0, background: 'none', cursor: 'pointer' }}
        >
          <ChevronLeft size={20} />
        </button>
        <div style={{ flex: 1 }} />
        <Button
          onClick={() => {
            setEditingClient(null);
            setDrawerOpen(true);
          }}
        >
          {t.clients.newClient}
        </Button>
      </div>

      {clients.length === 0 ? (
        <div className="lumio-payable-list__empty">
          <EmptyStateIllustration name="clients" size="md" />
          <h3 style={{ fontSize: 18, fontWeight: 600 }}>{t.clients.empty}</h3>
        </div>
      ) : (
        <div className="lumio-payable-list">
          <div className="lumio-payable-list__table-wrap">
            <table className="lumio-payable-list__table">
              <thead className="lumio-payable-list__thead">
                <tr>
                  <th className="lumio-payable-list__th">{t.clients.name.value}</th>
                  <th className="lumio-payable-list__th">{t.clients.email.value}</th>
                  <th className="lumio-payable-list__th">{t.detail.currency.value}</th>
                  <th className="lumio-payable-list__th lumio-payable-list__th--right">
                    {t.columns.actions.value}
                  </th>
                </tr>
              </thead>
              <tbody className="lumio-payable-list__tbody">
                {clients.map(client => (
                  <tr key={client.id}>
                    <td className="lumio-payable-list__td" style={{ fontWeight: 500 }}>
                      {client.name}
                    </td>
                    <td className="lumio-payable-list__td">{client.email || '—'}</td>
                    <td className="lumio-payable-list__td">{client.currency}</td>
                    <td className="lumio-payable-list__td">
                      <div className="lumio-payable-list__actions">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingClient(client);
                            setDrawerOpen(true);
                          }}
                        >
                          {t.actions.edit.value}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={deletingId === client.id}
                          onClick={() => void handleDelete(client)}
                        >
                          {t.actions.delete.value}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ClientDrawer
        open={drawerOpen}
        client={editingClient}
        defaultCurrency={defaultCurrency}
        saving={saving}
        onClose={() => {
          setDrawerOpen(false);
          setEditingClient(null);
        }}
        onSubmit={handleSave}
        labels={{
          createTitle: t.clients.newClient.value,
          editTitle: t.clients.editTitle.value,
          name: t.clients.name.value,
          email: t.clients.email.value,
          billingAddress: t.clients.billingAddress.value,
          taxId: t.clients.taxId.value,
          currency: t.detail.currency.value,
          locale: t.clients.locale.value,
          reminders: invoiceSettings.clientReminders.value,
          paymentTerms: invoiceSettings.clientPaymentTerms.value,
          save: t.actions.save.value,
          saving: t.actions.saving.value,
          cancel: t.actions.cancel.value,
        }}
      />
    </div>
  );
}

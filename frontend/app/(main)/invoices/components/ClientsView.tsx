'use client';

import { useRouter } from 'next/navigation';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { ChevronLeft, Plus } from '@/app/components/icons';
import { Button } from '@/app/components/ui/button';
import { EmptyState } from '@/app/components/ui/EmptyState';
import { PeopleLineIcon } from '@/app/components/ui/empty-state-icons';
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

  const openNewClient = (): void => {
    setEditingClient(null);
    setDrawerOpen(true);
  };

  if (loading) {
    return <div style={{ padding: 40 }}>—</div>;
  }

  return (
    <div className="container-shared seneca-stmt-list">
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
        {/* With no clients the empty state's button is the one action. */}
        {clients.length === 0 ? null : (
          <Button onClick={openNewClient}>
            <Plus size={18} aria-hidden />
            {t.clients.newClient}
          </Button>
        )}
      </div>

      {clients.length === 0 ? (
        <EmptyState
          fill
          icon={<PeopleLineIcon />}
          title={t.clients.empty}
          description={t.clients.emptyHint}
          action={<Button onClick={openNewClient}>{t.clients.newClient}</Button>}
        />
      ) : (
        <div className="seneca-payable-list">
          <div className="seneca-payable-list__table-wrap">
            <table className="seneca-payable-list__table">
              <thead className="seneca-payable-list__thead">
                <tr>
                  <th className="seneca-payable-list__th">{t.clients.name.value}</th>
                  <th className="seneca-payable-list__th">{t.clients.email.value}</th>
                  <th className="seneca-payable-list__th">{t.detail.currency.value}</th>
                  <th className="seneca-payable-list__th seneca-payable-list__th--right">
                    {t.columns.actions.value}
                  </th>
                </tr>
              </thead>
              <tbody className="seneca-payable-list__tbody">
                {clients.map(client => (
                  <tr key={client.id}>
                    <td className="seneca-payable-list__td" style={{ fontWeight: 500 }}>
                      {client.name}
                    </td>
                    <td className="seneca-payable-list__td">{client.email || '—'}</td>
                    <td className="seneca-payable-list__td">{client.currency}</td>
                    <td className="seneca-payable-list__td">
                      <div className="seneca-payable-list__actions">
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

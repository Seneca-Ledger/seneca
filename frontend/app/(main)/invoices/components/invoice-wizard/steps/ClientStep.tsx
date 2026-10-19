'use client';

import type React from 'react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { UserPlus } from '@/app/components/icons';
import { Button } from '@/app/components/ui/button';
import { Select } from '@/app/components/ui/select';
import { useWorkspace } from '@/app/contexts/WorkspaceContext';
import { useIntlayer } from '@/app/i18n';
import { getApiErrorMessage } from '@/app/lib/api-error';
import { FALLBACK_CURRENCY } from '@/app/lib/currency';
import { type CreateClientInput, clientsApi } from '@/app/lib/invoices-api';
import { ClientDrawer } from '../../ClientDrawer';
import type { InvoiceForm } from '../useInvoiceForm';
import { WizardField } from '../WizardChrome';

/** Who pays: an existing client, or a new one added without leaving the invoice. */
export function ClientStep({ form }: { form: InvoiceForm }): React.ReactElement {
  const t = useIntlayer('invoiceWizard');
  const page = useIntlayer('invoicesPage');
  const invoiceSettings = useIntlayer('invoiceSettings');
  const { currentWorkspace } = useWorkspace();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleCreate = async (payload: CreateClientInput): Promise<void> => {
    setSaving(true);
    await clientsApi
      .create(payload)
      .then(client => {
        form.addClient(client);
        setDrawerOpen(false);
      })
      .catch(error => toast.error(getApiErrorMessage(error, page.toasts.genericFailed.value)))
      .finally(() => setSaving(false));
  };

  return (
    <>
      {form.clients.length > 0 ? (
        <WizardField label={page.detail.client.value} htmlFor="invoice-client">
          <Select
            fullWidth
            id="invoice-client"
            inputProps={{ 'aria-label': page.detail.client.value }}
            value={form.clientId}
            onChange={form.pickClient}
            options={form.clients.map(client => ({ value: client.id, label: client.name }))}
          />
        </WizardField>
      ) : (
        <p className="seneca-invoice-wizard__note">{t.client.empty.value}</p>
      )}
      <div>
        <Button variant="outline" onClick={() => setDrawerOpen(true)}>
          <UserPlus size={16} style={{ marginRight: 6 }} />
          {t.client.add.value}
        </Button>
      </div>

      <ClientDrawer
        open={drawerOpen}
        defaultCurrency={currentWorkspace?.currency?.toUpperCase() || FALLBACK_CURRENCY}
        saving={saving}
        onClose={() => setDrawerOpen(false)}
        onSubmit={payload => handleCreate(payload as CreateClientInput)}
        labels={{
          createTitle: page.clients.newClient.value,
          editTitle: page.clients.editTitle.value,
          name: page.clients.name.value,
          email: page.clients.email.value,
          billingAddress: page.clients.billingAddress.value,
          taxId: page.clients.taxId.value,
          currency: page.detail.currency.value,
          locale: page.clients.locale.value,
          reminders: invoiceSettings.clientReminders.value,
          paymentTerms: invoiceSettings.clientPaymentTerms.value,
          save: page.actions.save.value,
          saving: page.actions.saving.value,
          cancel: page.actions.cancel.value,
        }}
      />
    </>
  );
}

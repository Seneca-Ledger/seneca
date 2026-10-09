'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { DrawerShell } from '@/app/components/ui/drawer-shell';
import { Input } from '@/app/components/ui/input';
import type { SendInvoiceEmailInput } from '@/app/lib/invoices-api';

interface InvoiceEmailDrawerProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: SendInvoiceEmailInput) => Promise<void>;
  /** The client's stored address, prefilled so it is visible before sending. */
  defaultRecipient: string;
  labels: {
    title: string;
    recipient: string;
    subject: string;
    message: string;
    hint: string;
    send: string;
    sending: string;
    cancel: string;
  };
}

/**
 * Confirms where the invoice is about to go.
 *
 * The address is shown rather than assumed: the loudest complaint about
 * invoicing tools is mail the vendor sent to a client without the sender
 * knowing. Subject and body are left empty on purpose — the server composes
 * them in the client's language, and overriding is the exception.
 */
export function InvoiceEmailDrawer({
  open,
  onClose,
  onSubmit,
  defaultRecipient,
  labels,
}: InvoiceEmailDrawerProps): React.JSX.Element {
  const [recipient, setRecipient] = useState(defaultRecipient);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open) {
      setRecipient(defaultRecipient);
      setSubject('');
      setMessage('');
    }
  }, [open, defaultRecipient]);

  const handleSend = async (): Promise<void> => {
    setSending(true);
    await onSubmit({
      to: recipient.trim() || undefined,
      subject: subject.trim() || undefined,
      message: message.trim() || undefined,
    }).finally(() => setSending(false));
  };

  return (
    <DrawerShell isOpen={open} onClose={onClose} title={labels.title}>
      <div className="lumio-payable-drawer__body">
        <div className="lumio-payable-drawer__field-group">
          <label className="lumio-payable-drawer__field-label" htmlFor="invoice-email-to">
            {labels.recipient}
          </label>
          <Input
            id="invoice-email-to"
            type="email"
            value={recipient}
            onChange={event => setRecipient(event.target.value)}
          />
        </div>

        <div className="lumio-payable-drawer__field-group">
          <label className="lumio-payable-drawer__field-label" htmlFor="invoice-email-subject">
            {labels.subject}
          </label>
          <Input
            id="invoice-email-subject"
            value={subject}
            onChange={event => setSubject(event.target.value)}
          />
        </div>

        <div className="lumio-payable-drawer__field-group">
          <label className="lumio-payable-drawer__field-label" htmlFor="invoice-email-message">
            {labels.message}
          </label>
          <textarea
            id="invoice-email-message"
            className="lumio-payable-drawer__textarea"
            rows={4}
            value={message}
            onChange={event => setMessage(event.target.value)}
          />
        </div>

        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{labels.hint}</p>

        <div className="lumio-payable-drawer__actions">
          <Button variant="outline" onClick={onClose} disabled={sending}>
            {labels.cancel}
          </Button>
          <Button onClick={() => void handleSend()} disabled={sending || !recipient.trim()}>
            {sending ? labels.sending : labels.send}
          </Button>
        </div>
      </div>
    </DrawerShell>
  );
}

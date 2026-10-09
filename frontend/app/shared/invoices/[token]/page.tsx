'use client';

import { Alert, Box, Chip, Container, Divider, Paper, Typography } from '@mui/material';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import api from '@/app/lib/api';
import { getApiErrorMessage } from '@/app/lib/api-error';

interface PublicInvoice {
  number: string;
  status: 'sent' | 'paid' | 'overdue';
  issueDate: string;
  dueDate: string;
  currency: string;
  subtotal: string;
  taxTotal: string;
  total: string;
  pricesIncludeTax: boolean;
  notes: string | null;
  locale: string | null;
  labels: Record<string, string>;
  issuer: {
    legalName: string | null;
    addressLines: string | null;
    registrationId: string | null;
    taxId: string | null;
    email: string | null;
    phone: string | null;
    website: string | null;
    bankName: string | null;
    bankAccount: string | null;
    bankCode: string | null;
    paymentInstructions: string | null;
    invoiceFooter: string | null;
    logoUrl: string | null;
  };
  billedTo: { name: string; addressLines: string | null; taxId: string | null };
  lines: Array<{ description: string; quantity: string; unitPrice: string; amount: string }>;
}

const money = (amount: string, currency: string): string =>
  `${Number(amount).toFixed(2)} ${currency}`;

/** Multi-line text as lines, with the empty ones dropped. */
function Lines({ text }: { text: string | null | undefined }) {
  if (!text?.trim()) {
    return null;
  }
  return (
    <>
      {text
        .split('\n')
        .filter(line => line.trim())
        .map(line => (
          <Typography key={line} sx={{ fontSize: 13, color: 'text.secondary' }}>
            {line.trim()}
          </Typography>
        ))}
    </>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value?.trim()) {
    return null;
  }
  return (
    <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
      {label}: {value.trim()}
    </Typography>
  );
}

/**
 * The invoice as its client sees it, behind the link in the email.
 *
 * Outside authentication: the token in the url is the only credential, and the
 * server sends a read-only view. The labels come from the server too, already
 * in the client's language — the page deliberately has no dictionary of its
 * own, so the page and the PDF cannot word the same thing differently.
 */
export default function SharedInvoicePage() {
  const params = useParams();
  const token = params.token as string;

  const [invoice, setInvoice] = useState<PublicInvoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api
      .get<PublicInvoice>(`/public/invoices/${token}`)
      .then(response => {
        if (!cancelled) {
          setInvoice(response.data);
        }
      })
      .catch(reason => {
        if (!cancelled) {
          setError(getApiErrorMessage(reason, 'Invoice not found'));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ py: 6 }}>
        <Typography sx={{ color: 'text.secondary' }}>…</Typography>
      </Container>
    );
  }

  if (error || !invoice) {
    return (
      <Container maxWidth="md" sx={{ py: 6 }}>
        <Alert severity="error">{error ?? 'Invoice not found'}</Alert>
      </Container>
    );
  }

  const t = invoice.labels;
  const statusLabel =
    invoice.status === 'paid'
      ? t.statusPaid
      : invoice.status === 'overdue'
        ? t.statusOverdue
        : t.statusSent;

  return (
    <Container maxWidth="md" sx={{ py: { xs: 3, sm: 6 } }}>
      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 4 }, borderRadius: 3 }}>
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 2,
            alignItems: 'flex-start',
            justifyContent: 'space-between',
          }}
        >
          <Box>
            <Typography component="h1" sx={{ fontSize: 26, fontWeight: 600 }}>
              {t.invoice}
            </Typography>
            <Typography sx={{ color: 'text.secondary' }}>{invoice.number}</Typography>
            <Chip
              size="small"
              label={statusLabel}
              color={
                invoice.status === 'paid'
                  ? 'success'
                  : invoice.status === 'overdue'
                    ? 'error'
                    : 'default'
              }
              sx={{ mt: 1 }}
            />
          </Box>
          {invoice.issuer.logoUrl ? (
            <Box
              component="img"
              src={invoice.issuer.logoUrl}
              alt={invoice.issuer.legalName ?? ''}
              sx={{ height: 56, maxWidth: 180, objectFit: 'contain' }}
            />
          ) : null}
        </Box>

        <Box
          sx={{
            mt: 3,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
            gap: 2,
          }}
        >
          <Box>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'text.secondary' }}>
              {t.issuer}
            </Typography>
            <Typography sx={{ fontSize: 14, fontWeight: 600 }}>
              {invoice.issuer.legalName}
            </Typography>
            <Lines text={invoice.issuer.addressLines} />
            <Field label={t.registrationId} value={invoice.issuer.registrationId} />
            <Field label={t.taxId} value={invoice.issuer.taxId} />
            <Lines text={invoice.issuer.email} />
            <Lines text={invoice.issuer.phone} />
            <Lines text={invoice.issuer.website} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'text.secondary' }}>
              {t.billTo}
            </Typography>
            <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{invoice.billedTo.name}</Typography>
            <Lines text={invoice.billedTo.addressLines} />
            <Field label={t.taxId} value={invoice.billedTo.taxId} />
          </Box>
          <Box>
            <Field label={t.issueDate} value={invoice.issueDate} />
            <Field label={t.dueDate} value={invoice.dueDate} />
          </Box>
        </Box>

        <Divider sx={{ my: 3 }} />

        <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse' }}>
          <Box component="thead">
            <Box component="tr">
              {[t.description, t.quantity, t.unitPrice, t.amount].map((header, index) => (
                <Box
                  key={header}
                  component="th"
                  sx={{
                    textAlign: index === 0 ? 'left' : 'right',
                    fontSize: 11,
                    color: 'text.secondary',
                    pb: 1,
                  }}
                >
                  {header}
                </Box>
              ))}
            </Box>
          </Box>
          <Box component="tbody">
            {invoice.lines.map(line => (
              <Box component="tr" key={`${line.description}-${line.amount}`}>
                <Box component="td" sx={{ fontSize: 14, py: 0.75 }}>
                  {line.description}
                </Box>
                <Box component="td" sx={{ fontSize: 14, py: 0.75, textAlign: 'right' }}>
                  {Number(line.quantity)}
                </Box>
                <Box component="td" sx={{ fontSize: 14, py: 0.75, textAlign: 'right' }}>
                  {money(line.unitPrice, invoice.currency)}
                </Box>
                <Box component="td" sx={{ fontSize: 14, py: 0.75, textAlign: 'right' }}>
                  {money(line.amount, invoice.currency)}
                </Box>
              </Box>
            ))}
          </Box>
        </Box>

        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
          <Box sx={{ minWidth: 240 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span>{t.subtotal}</span>
              <span>{money(invoice.subtotal, invoice.currency)}</span>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, mt: 0.5 }}>
              <span>{t.tax}</span>
              <span>{money(invoice.taxTotal, invoice.currency)}</span>
            </Box>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 16,
                fontWeight: 600,
                mt: 1,
              }}
            >
              <span>{t.total}</span>
              <span>{money(invoice.total, invoice.currency)}</span>
            </Box>
            {invoice.pricesIncludeTax ? (
              <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.5 }}>
                {t.taxIncluded}
              </Typography>
            ) : null}
          </Box>
        </Box>

        {invoice.issuer.bankAccount ||
        invoice.issuer.bankName ||
        invoice.issuer.paymentInstructions ? (
          <Box sx={{ mt: 4 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'text.secondary' }}>
              {t.paymentDetails}
            </Typography>
            <Field label={t.bank} value={invoice.issuer.bankName} />
            <Field label={t.bankAccount} value={invoice.issuer.bankAccount} />
            <Field label={t.bankCode} value={invoice.issuer.bankCode} />
            <Lines text={invoice.issuer.paymentInstructions} />
          </Box>
        ) : null}

        {invoice.notes?.trim() ? (
          <Box sx={{ mt: 3 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'text.secondary' }}>
              {t.notes}
            </Typography>
            <Lines text={invoice.notes} />
          </Box>
        ) : null}

        <Box sx={{ mt: 4, display: 'flex', gap: 2, alignItems: 'center' }}>
          <Typography
            component="a"
            href={`/api/v1/public/invoices/${token}/pdf`}
            sx={{ fontSize: 14, fontWeight: 600 }}
          >
            {t.download}
          </Typography>
        </Box>

        {invoice.issuer.invoiceFooter?.trim() ? (
          <Typography sx={{ mt: 4, fontSize: 12, color: 'text.secondary', textAlign: 'center' }}>
            {invoice.issuer.invoiceFooter.trim()}
          </Typography>
        ) : null}
      </Paper>
    </Container>
  );
}

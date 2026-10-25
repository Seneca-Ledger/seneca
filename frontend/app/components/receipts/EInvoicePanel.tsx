'use client';

import { Alert, Box, Chip, Stack, Typography } from '@mui/material';
import type React from 'react';
import { PrivateAmount } from '@/app/components/ui/private-amount';
import { useIntlayer } from '@/app/i18n';
import type { EInvoiceSummary } from '@/app/lib/api';

/** The VAT categories of UNCL 5305 an invoice names, by code. */
const CATEGORY_KEYS: Record<
  string,
  | 'vatStandard'
  | 'vatZero'
  | 'vatExempt'
  | 'vatReverseCharge'
  | 'vatIntraEu'
  | 'vatExport'
  | 'vatOutside'
> = {
  S: 'vatStandard',
  Z: 'vatZero',
  E: 'vatExempt',
  AE: 'vatReverseCharge',
  K: 'vatIntraEu',
  G: 'vatExport',
  O: 'vatOutside',
};

/** What the XML calls itself: XRechnung, or the ZUGFeRD / Factur-X family. */
export function einvoiceKind(einvoice: EInvoiceSummary): string {
  if (einvoice.profile && /xrechnung/i.test(einvoice.profile)) {
    return 'XRechnung';
  }
  return einvoice.syntax === 'cii' ? 'ZUGFeRD / Factur-X' : 'UBL';
}

function Field({
  label,
  value,
}: {
  label: string;
  value: string | null;
}): React.ReactElement | null {
  if (!value) {
    return null;
  }
  return (
    <Box>
      <Typography
        variant="caption"
        sx={{
          color: 'text.secondary',
        }}
      >
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 500, wordBreak: 'break-all' }}>
        {value}
      </Typography>
    </Box>
  );
}

/**
 * What a structured e-invoice's XML says: its figures are the invoice, so
 * they are shown as read, with what decides the VAT treatment.
 */
export function EInvoicePanel({
  einvoice,
  issues,
  currency,
}: {
  einvoice: EInvoiceSummary;
  issues: string[];
  currency: string;
}): React.ReactElement {
  const t = useIntlayer('einvoicePanel');
  const money = (value: number) => `${value.toFixed(2)} ${currency}`;
  return (
    <Box data-testid="einvoice-panel" sx={{ mt: 3 }}>
      <Stack
        direction="row"
        spacing={1}
        sx={{
          alignItems: 'center',
          mb: 1,
        }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          {t.title.value}
        </Typography>
        <Chip size="small" label={einvoiceKind(einvoice)} />
      </Stack>
      <Typography
        variant="body2"
        sx={{
          color: 'text.secondary',
          mb: 1.5,
          maxWidth: 640,
        }}
      >
        {t.readFromXml.value}
      </Typography>

      {einvoice.meetsEn16931 ? null : (
        <Alert severity="warning" sx={{ mb: 1.5 }}>
          {t.notEn16931.value}
        </Alert>
      )}
      {issues.includes('einvoice_totals_disagree') ? (
        <Alert severity="warning" sx={{ mb: 1.5 }}>
          {t.totalsDisagree.value}
        </Alert>
      ) : null}
      {einvoice.reverseCharge ? (
        <Alert severity="info" sx={{ mb: 1.5 }}>
          {t.reverseCharge.value}
        </Alert>
      ) : null}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
          gap: 2,
        }}
      >
        <Field label={t.number.value} value={einvoice.number} />
        <Field label={t.sellerVatId.value} value={einvoice.seller.vatId} />
        <Field label={t.sellerTaxNumber.value} value={einvoice.seller.taxNumber} />
        <Field label={t.iban.value} value={einvoice.iban} />
        <Field label={t.dueDate.value} value={einvoice.dueDate} />
        <Field label={t.deliveryDate.value} value={einvoice.deliveryDate} />
      </Box>

      {einvoice.vat.length > 0 ? (
        <Stack spacing={0.5} sx={{ mt: 2 }}>
          {einvoice.vat.map(item => (
            <Typography
              key={`${item.category}-${item.rate}`}
              variant="body2"
              sx={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {CATEGORY_KEYS[item.category] ? t[CATEGORY_KEYS[item.category]].value : item.category}
              {item.rate === null ? '' : ` ${item.rate} %`} · {t.base.value}{' '}
              <PrivateAmount>{money(item.base)}</PrivateAmount> · {t.vat.value}{' '}
              <PrivateAmount>{money(item.tax)}</PrivateAmount>
              {item.exemptionReason ? ` · ${item.exemptionReason}` : ''}
            </Typography>
          ))}
        </Stack>
      ) : null}
    </Box>
  );
}

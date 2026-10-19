'use client';

import { Alert, InputAdornment } from '@mui/material';
import type React from 'react';
import { Input } from '@/app/components/ui/input';
import { Select } from '@/app/components/ui/select';
import { useIntlayer } from '@/app/i18n';

/** Units of measure a line is most often billed in (UN/ECE Recommendation 20). */
const UNIT_CODES = ['C62', 'HUR', 'DAY', 'MON', 'LS', 'KGM'] as const;

/** The unit of an invoice line: what its quantity counts, as an e-invoice states it. */
export function UnitSelect({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled?: boolean;
  onChange: (unitCode: string) => void;
}): React.ReactElement {
  const t = useIntlayer('einvoiceFields');
  const labels: Record<(typeof UNIT_CODES)[number], string> = {
    C62: t.unitPiece.value,
    HUR: t.unitHour.value,
    DAY: t.unitDay.value,
    MON: t.unitMonth.value,
    LS: t.unitLumpSum.value,
    KGM: t.unitKilogram.value,
  };
  const known = (UNIT_CODES as readonly string[]).includes(value);
  return (
    <Select
      fullWidth
      size="small"
      value={value}
      disabled={disabled}
      aria-label={t.unit.value}
      onChange={next => onChange(String(next))}
      options={[
        ...UNIT_CODES.map(code => ({ value: code, label: labels[code] })),
        // A unit set elsewhere stays selectable under its code.
        ...(known ? [] : [{ value, label: value }]),
      ]}
      sx={{ mt: 0.5 }}
    />
  );
}

/**
 * A line's discount (negative) or surcharge (positive), in percent of quantity
 * × unit price. Empty is neither.
 */
export function LineAdjustmentInput({
  value,
  disabled,
  onChange,
}: {
  value: number | undefined;
  disabled?: boolean;
  onChange: (adjustmentPercent: number | undefined) => void;
}): React.ReactElement {
  const t = useIntlayer('einvoiceFields');
  return (
    <Input
      type="number"
      min="-100"
      max="1000"
      step="0.01"
      placeholder="±"
      endAdornment={<InputAdornment position="end">%</InputAdornment>}
      aria-label={t.lineAdjustment.value}
      title={t.lineAdjustment.value}
      value={value ? String(value) : ''}
      disabled={disabled}
      onChange={event =>
        onChange(event.target.value === '' ? undefined : Number(event.target.value) || undefined)
      }
      style={{ marginTop: 4 }}
    />
  );
}

/** What an XRechnung of this invoice still needs, and where each is filled in. */
export function XRechnungMissingAlert({
  missing,
  onClose,
  title,
}: {
  missing: string[];
  onClose: () => void;
  /** What the list is for; XRechnung's own heading when absent. */
  title?: string;
}): React.ReactElement {
  const t = useIntlayer('einvoiceFields');
  // Read key by key: indexing the dictionary with a variable loses its types.
  const labels: Record<string, string> = {
    number: t.missingNumber.value,
    buyer_reference: t.missingBuyerReference.value,
    seller_name: t.missingSellerName.value,
    seller_street: t.missingSellerAddress.value,
    seller_postal_code: t.missingSellerAddress.value,
    seller_city: t.missingSellerAddress.value,
    seller_country: t.missingSellerAddress.value,
    seller_vat_or_tax_number: t.missingSellerTaxId.value,
    seller_vat_id: t.missingSellerVatId.value,
    seller_contact: t.missingSellerContact.value,
    seller_phone: t.missingSellerPhone.value,
    seller_email: t.missingSellerEmail.value,
    seller_iban: t.missingSellerIban.value,
    buyer_name: t.missingBuyerName.value,
    buyer_street: t.missingBuyerAddress.value,
    buyer_postal_code: t.missingBuyerAddress.value,
    buyer_city: t.missingBuyerAddress.value,
    buyer_country: t.missingBuyerAddress.value,
    buyer_email: t.missingBuyerEmail.value,
    buyer_vat_id: t.missingBuyerVatId.value,
    delivery_date: t.missingDeliveryDate.value,
    line_tax_rate: t.missingLineTaxRate.value,
    lines: t.missingLines.value,
    seller_peppol_id: t.missingSellerPeppolId.value,
    buyer_peppol_id: t.missingBuyerPeppolId.value,
  };
  const items = [...new Set(missing.map(code => labels[code] ?? code))];
  return (
    <Alert severity="warning" onClose={onClose} data-testid="xrechnung-missing">
      {title ?? t.missingTitle.value}
      <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
        {items.map(item => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </Alert>
  );
}

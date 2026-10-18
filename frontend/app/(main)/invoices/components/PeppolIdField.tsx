'use client';

import { Typography } from '@mui/material';
import type React from 'react';
import { useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { useIntlayer } from '@/app/i18n';
import { getApiErrorMessage } from '@/app/lib/api-error';
import type { PeppolLookup } from '@/app/lib/contracts';
import { peppolApi } from '@/app/lib/peppol-api';

/**
 * The Peppol id a business is most likely registered under, from its VAT id
 * (same rule as the backend's `suggestPeppolId`): only a prefill; the check
 * on the network decides.
 */
export function suggestPeppolId(vatId: string): string | null {
  const vat = vatId.replace(/[\s.-]+/g, '').toUpperCase();
  const country = vat.slice(0, 2);
  if (country === 'BE' && /^BE[01]\d{9}$/.test(vat)) {
    return `0208:${vat.slice(2)}`;
  }
  const scheme: Record<string, string> = {
    DE: '9930',
    AT: '9914',
    NL: '9944',
    FR: '9957',
    ES: '9920',
    IT: '0211',
  };
  return scheme[country] && vat.length > 4 ? `${scheme[country]}:${vat}` : null;
}

/** A client's Peppol id, with a suggestion from its VAT id and a check on the network. */
export function PeppolIdField({
  value,
  vatId,
  onChange,
}: {
  value: string;
  vatId: string;
  onChange: (value: string) => void;
}): React.ReactElement {
  const t = useIntlayer('peppol');
  const [result, setResult] = useState<PeppolLookup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const suggestion = value.trim() ? null : suggestPeppolId(vatId);

  const check = async () => {
    setChecking(true);
    setResult(null);
    setError(null);
    await peppolApi
      .lookup(value.trim())
      .then(setResult)
      .catch((caught: unknown) => setError(getApiErrorMessage(caught, t.checkFailed.value)))
      .finally(() => setChecking(false));
  };
  const formats = (result?.formats ?? [])
    .map(format => (format === 'peppol_bis' ? 'Peppol BIS 3.0' : 'XRechnung (CII)'))
    .join(', ');

  return (
    <div className="lumio-payable-drawer__field-group">
      <label className="lumio-payable-drawer__field-label" htmlFor="client-peppol-id">
        {t.clientPeppolId.value}
      </label>
      <div style={{ display: 'flex', gap: 8 }}>
        <Input
          id="client-peppol-id"
          value={value}
          placeholder={suggestion ?? '0208:0123456789'}
          onChange={event => {
            setResult(null);
            setError(null);
            onChange(event.target.value);
          }}
        />
        <Button
          variant="outline"
          disabled={checking || !/^\s*\d{4}\s*:\s*\S/.test(value)}
          onClick={() => void check()}
        >
          {t.check.value}
        </Button>
      </div>
      {suggestion ? (
        <Button size="sm" variant="ghost" onClick={() => onChange(suggestion)}>
          {t.useSuggestion.value.replace('{{id}}', suggestion)}
        </Button>
      ) : null}
      <Typography sx={{ fontSize: 12, opacity: 0.7 }}>{t.clientPeppolIdHint.value}</Typography>
      {result ? (
        <Typography
          data-testid="peppol-lookup-result"
          sx={{ fontSize: 12, color: result.registered ? 'success.main' : 'warning.main' }}
        >
          {result.registered
            ? t.registered.value
                .replace('{{name}}', result.companyName ?? '—')
                .replace('{{formats}}', formats || t.noFormats.value)
            : t.notRegistered.value}
        </Typography>
      ) : null}
      {error ? <Typography sx={{ fontSize: 12, color: 'error.main' }}>{error}</Typography> : null}
    </div>
  );
}

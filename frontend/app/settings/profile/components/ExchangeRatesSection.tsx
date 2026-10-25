'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useLocale } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { apiQueryDecoded, type ContractInput } from '@/app/lib/query-fn-schema';

type Tx = (path: string[], fallback: string) => string;

interface Coverage {
  currency: string;
  currencies: Array<{
    currency: string;
    rate: number | null;
    rateDate: string | null;
    stale: boolean;
    rows: number;
  }>;
  missing: string[];
}

/** Which currencies the workspace's rows carry, whether a rate exists, and a way to set one by hand. */
export function ExchangeRatesSection({ tx }: { tx: Tx }) {
  const [coverage, setCoverage] = useState<Coverage | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const { locale } = useLocale();
  const formatRate = (rate: number) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: 6 }).format(rate);

  const load = async () => {
    await apiQueryDecoded({ url: '/exchange-rates/coverage', contract: 'ExchangeRateCoverage' })
      .then(setCoverage)
      .catch(() => setCoverage(null));
  };
  useEffect(() => {
    void load();
  }, []);

  const save = async (currency: string) => {
    const rate = Number((drafts[currency] ?? '').replace(',', '.'));
    if (!(coverage && Number.isFinite(rate)) || rate <= 0) return;
    setSaving(currency);
    try {
      await apiClient.post('/exchange-rates/manual', {
        from: currency,
        to: coverage.currency,
        rate,
      } satisfies ContractInput<'ManualRateBody'>);
      toast.success(tx(['exchangeRatesCard', 'saved'], 'Rate saved'));
      setDrafts(current => ({ ...current, [currency]: '' }));
      await load();
    } catch {
      toast.error(tx(['exchangeRatesCard', 'failed'], 'Could not save the rate'));
    } finally {
      setSaving(null);
    }
  };

  if (!Array.isArray(coverage?.currencies)) return null;
  if (coverage.currencies.length === 0) {
    return (
      <Typography
        variant="body2"
        sx={{
          color: 'text.secondary',
        }}
      >
        {tx(['exchangeRatesCard', 'empty'], 'Every row is in the workspace currency')}
      </Typography>
    );
  }

  return (
    <Stack spacing={1.5}>
      {coverage.currencies.map(item => (
        <Box
          key={item.currency}
          data-testid={`rate-row-${item.currency}`}
          sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}
        >
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              width: 56,
            }}
          >
            {item.currency}
          </Typography>
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
              width: 90,
            }}
          >
            {item.rows} {tx(['exchangeRatesCard', 'colRows'], 'rows')}
          </Typography>
          <Typography
            variant="body2"
            sx={{
              flex: 1,
              minWidth: 160,
              color: item.rate === null ? 'error.main' : 'text.primary',
            }}
          >
            {item.rate === null
              ? tx(['exchangeRatesCard', 'missing'], 'no rate')
              : `1 ${item.currency} = ${formatRate(item.rate)} ${coverage.currency}${
                  item.rateDate && item.stale
                    ? ` · ${tx(['exchangeRatesCard', 'stale'], 'rate from {{date}}').replace('{{date}}', item.rateDate)}`
                    : ''
                }`}
          </Typography>
          <TextField
            size="small"
            label={tx(['exchangeRatesCard', 'colRate'], 'Rate to {{currency}}').replace(
              '{{currency}}',
              coverage.currency,
            )}
            value={drafts[item.currency] ?? ''}
            onChange={event =>
              setDrafts(current => ({ ...current, [item.currency]: event.target.value }))
            }
            sx={{ width: 160 }}
            slotProps={{
              htmlInput: { inputMode: 'decimal' },
            }}
          />
          <Button
            size="small"
            variant="outlined"
            disabled={saving === item.currency || !drafts[item.currency]}
            onClick={() => void save(item.currency)}
          >
            {tx(['exchangeRatesCard', 'setRate'], 'Set')}
          </Button>
        </Box>
      ))}
    </Stack>
  );
}

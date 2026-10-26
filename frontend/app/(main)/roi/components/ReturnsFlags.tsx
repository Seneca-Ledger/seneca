'use client';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Link from 'next/link';
import { useIntlayer } from '@/app/i18n';
import type { ReturnsFlag, ReturnsFlagCode, ReturnsSource } from '../hooks/useReturns';
import { flagSubject } from '../returns-display';

/** Flags that keep something out of the figures, as opposed to ones that only qualify them. */
const BLOCKING: ReadonlySet<ReturnsFlagCode> = new Set([
  'opening_value_unknown',
  'no_contributions',
  'metal_cost_missing',
  'missing_fx',
]);

/** Flags fixed on the net worth page, where the holdings, lots and wallets are. */
const FIXED_ON_NET_WORTH: ReadonlySet<ReturnsFlagCode> = new Set([
  'stale_price',
  'manual_price',
  'metal_cost_missing',
  'no_contributions',
]);

interface ReturnsFlagsProps {
  flags: ReturnsFlag[];
  sources: ReturnsSource[];
  sourceName: (source: ReturnsSource) => string;
}

/** What the figures stand on, said plainly, with where to fix it. */
export function ReturnsFlags({ flags, sources, sourceName }: ReturnsFlagsProps) {
  const t = useIntlayer('roiPage');
  if (flags.length === 0) {
    return null;
  }

  const texts: Record<ReturnsFlagCode, string> = {
    stale_price: t.flagStalePrice.value,
    manual_price: t.flagManualPrice.value,
    missing_fx: t.flagMissingFx.value,
    metal_cost_missing: t.flagMetalCostMissing.value,
    opening_value_unknown: t.flagOpeningValueUnknown.value,
    no_contributions: t.flagNoContributions.value,
    crypto_not_in_return: t.flagCryptoNotInReturn.value,
    crypto_basis_incomplete: t.flagCryptoBasisIncomplete.value,
    crypto_unpriced: t.flagCryptoUnpriced.value,
    xirr_no_solution: t.flagXirrNoSolution.value,
  };

  // Blocking flags first: they change the figures, the rest only qualify them.
  const ordered = [...flags].sort(
    (left, right) => Number(BLOCKING.has(right.code)) - Number(BLOCKING.has(left.code)),
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }} data-testid="returns-flags">
      {ordered.map(flag => (
        <Alert
          key={`${flag.code}-${flag.sourceId ?? ''}-${flag.detail ?? ''}`}
          severity={BLOCKING.has(flag.code) ? 'warning' : 'info'}
          action={
            FIXED_ON_NET_WORTH.has(flag.code) ? (
              <Link href="/net-worth" style={{ whiteSpace: 'nowrap' }}>
                {t.openNetWorth}
              </Link>
            ) : undefined
          }
        >
          {texts[flag.code].replace('{{detail}}', flagSubject(flag, sources, sourceName))}
        </Alert>
      ))}
    </Box>
  );
}

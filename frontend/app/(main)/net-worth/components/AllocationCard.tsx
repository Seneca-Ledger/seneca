'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { PrivateAmount } from '@/app/components/ui/private-amount';
import { TextTabs } from '@/app/components/ui/text-tabs';
import { localizeBalanceAccountName } from '@/app/lib/balance-account-names';
import { usePrivacyMode } from '@/app/lib/privacy-mode';
import type { NetWorthBreakdownItem } from '../hooks/useNetWorth';
import { CardTitle, cardSx, plainLineName, WholeMoney } from './net-worth-ui';

/**
 * The app's muted earth tones (sage, sand, dusty blue, clay, terracotta, stone),
 * in an order that keeps neighbours in the bar apart.
 */
const SERIES_COLORS = ['#6f8f7b', '#d2b48c', '#7c93a8', '#a98b76', '#b8665a', '#a7ada3'];

export interface AllocationView {
  key: string;
  label: string;
  items: NetWorthBreakdownItem[];
}

interface AllocationCardProps {
  title: string;
  /** The same assets cut different ways (balance sheet, asset class): one card, a switch. */
  views: AllocationView[];
  currency: string;
  locale: string;
}

export function AllocationCard({ title, views, currency, locale }: AllocationCardProps) {
  const shown = views.filter(view => view.items.length > 0);
  const [picked, setPicked] = useState<string | null>(null);
  const privacy = usePrivacyMode();
  const view = shown.find(entry => entry.key === picked) ?? shown[0];
  if (!view) {
    return null;
  }

  return (
    <Box data-tour-shot="net-worth-allocation" sx={cardSx}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        <CardTitle>{title}</CardTitle>
        {shown.length > 1 && (
          <TextTabs
            value={view.key}
            onChange={setPicked}
            options={shown.map(entry => ({ value: entry.key, label: entry.label }))}
            ariaLabel={title}
          />
        )}
      </Box>

      <Box sx={{ display: 'flex', gap: '2px', height: 8, mt: 2, mb: 2 }}>
        {view.items.map((item, index) => (
          <Box
            key={item.code}
            // In privacy mode the tooltip names the line without its share.
            title={
              privacy
                ? plainLineName(localizeBalanceAccountName(item.name, locale))
                : `${plainLineName(localizeBalanceAccountName(item.name, locale))} ${item.percent}%`
            }
            sx={{
              flexGrow: Math.max(item.percent, 0.5),
              bgcolor: SERIES_COLORS[index % SERIES_COLORS.length],
              borderRadius: '4px',
            }}
          />
        ))}
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        {view.items.map((item, index) => (
          <Box key={item.code} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                flexShrink: 0,
                bgcolor: SERIES_COLORS[index % SERIES_COLORS.length],
              }}
            />
            <Typography variant="body2" sx={{ flexGrow: 1, minWidth: 0 }} noWrap>
              {plainLineName(localizeBalanceAccountName(item.name, locale))}
            </Typography>
            <Typography
              variant="body2"
              sx={{ color: 'text.secondary', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}
            >
              <PrivateAmount>{item.percent}%</PrivateAmount>
            </Typography>
            <Typography
              variant="body2"
              sx={{
                fontWeight: 500,
                flexShrink: 0,
                minWidth: 100,
                textAlign: 'right',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <WholeMoney value={item.amount} currency={currency} locale={locale} />
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

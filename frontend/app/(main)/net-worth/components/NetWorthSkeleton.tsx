'use client';

import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import type { SxProps, Theme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import type React from 'react';
import { ChevronDown } from '@/app/components/icons';
import { TextTabs } from '@/app/components/ui/text-tabs';
import { useIntlayer } from '@/app/i18n';
import { useNetWorthDisplay } from '../net-worth-display';
import { ChartDisplayOptions } from './ChartDisplayOptions';
import { CardTitle, cardSx } from './net-worth-ui';
import { LINE_GRID } from './RiskCard';

const LINE_KEYS = ['line-0', 'line-1', 'line-2', 'line-3', 'line-4', 'line-5'];

/** A bar the height of a line of `variant` text. */
function Bar({
  width,
  variant = 'body2',
  sx,
}: {
  width: number | string;
  variant?: 'body1' | 'body2' | 'caption' | 'h3';
  sx?: SxProps<Theme>;
}): React.JSX.Element {
  return (
    <Typography variant={variant} sx={sx}>
      <Skeleton variant="text" width={width} />
    </Typography>
  );
}

/** A figure under its caption, as the headline's sides and the change kinds show them. */
function Figure({ label }: { label: React.ReactNode }): React.JSX.Element {
  return (
    <Box>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {label}
      </Typography>
      <Bar variant="body1" width={80} />
    </Box>
  );
}

/**
 * The page while the figures load: every card with its title and labels, the
 * figures, chart and lines as bars of their size.
 */
export function NetWorthSkeleton(): React.JSX.Element {
  const t = useIntlayer('netWorthPage');
  const display = useNetWorthDisplay();
  return (
    <Box aria-busy sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box sx={cardSx}>
        <Bar variant="h3" width={180} sx={{ lineHeight: 1.1 }} />
        <Bar width={240} sx={{ mt: 1 }} />
        <Bar width={320} sx={{ mt: 0.5 }} />
        <Box sx={{ mt: 2 }}>
          <div className="seneca-chart__box">
            <Skeleton variant="rounded" height="100%" />
          </div>
          <div className="seneca-chart__footer">
            <Skeleton variant="text" width={90} />
            <Skeleton variant="text" width={90} />
          </div>
          <ChartDisplayOptions display={display} />
        </Box>
        <Box sx={{ display: 'flex', gap: 4, mt: 2, flexWrap: 'wrap' }}>
          <Figure label={t.assets.value} />
          <Figure label={t.liabilities.value} />
        </Box>
      </Box>

      <Box sx={cardSx}>
        <CardTitle>{t.changeTitle}</CardTitle>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5, mb: 2 }}>
          {t.changeHint}
        </Typography>
        <Bar width={180} sx={{ mb: 2 }} />
        <Box sx={{ mb: 2 }}>
          <Figure label={<Skeleton variant="text" width={50} />} />
        </Box>
        {LINE_KEYS.slice(0, 2).map(key => (
          <Box key={key} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
            <Bar width={120} />
            <Bar width={80} />
          </Box>
        ))}
      </Box>

      <Box sx={cardSx}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <CardTitle>{t.allocation}</CardTitle>
          <TextTabs
            value="sheet"
            onChange={() => {}}
            ariaLabel={t.allocation.value}
            options={[
              { value: 'sheet', label: t.balanceSheet.value },
              { value: 'class', label: t.assetClasses.value },
            ]}
          />
        </Box>
        <Skeleton variant="rounded" height={8} sx={{ mt: 2, mb: 2, borderRadius: '4px' }} />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Skeleton variant="circular" width={8} height={8} />
          <Bar width="20%" sx={{ flexGrow: 1 }} />
          <Bar width={100} />
        </Box>
      </Box>

      <Box sx={cardSx}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: 'minmax(280px, 1fr) minmax(0, 2fr)' },
            columnGap: 8,
            rowGap: 4,
          }}
        >
          <Box>
            <CardTitle>{t.riskTitle}</CardTitle>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5, mb: 3 }}>
              {t.riskyHint}
            </Typography>
            <Bar width={90} sx={{ mb: 1 }} />
            <Skeleton variant="rounded" height={6} sx={{ mb: 4.5, borderRadius: '3px' }} />
            <Bar width="100%" sx={{ mb: 1 }} />
            <Bar width="100%" />
          </Box>
          <Box>
            <Box aria-hidden sx={{ ...LINE_GRID, display: { xs: 'none', sm: 'grid' }, pb: 1 }}>
              <span />
              <span />
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {t.riskColumn}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {t.roleColumn}
              </Typography>
            </Box>
            {LINE_KEYS.map(key => (
              <Box
                key={key}
                sx={{ ...LINE_GRID, py: 1.5, borderTop: '1px solid', borderColor: 'divider' }}
              >
                <Bar width="50%" />
                <Bar width={60} sx={{ justifySelf: 'end' }} />
                <Bar width={80} sx={{ display: { xs: 'none', sm: 'block' } }} />
                <Bar width={80} sx={{ display: { xs: 'none', sm: 'block' } }} />
              </Box>
            ))}
          </Box>
        </Box>
      </Box>

      <Box sx={cardSx}>
        <CardTitle>{t.holdingsTitle}</CardTitle>
        <Box sx={{ mt: 1.5 }}>
          {[t.investmentsTitle, t.metalsTitle].map(title => (
            <Box
              key={title.value}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                py: 1.75,
                fontSize: 14,
                borderTop: '1px solid',
                borderColor: 'divider',
              }}
            >
              {title}
              <ChevronDown size={16} aria-hidden />
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

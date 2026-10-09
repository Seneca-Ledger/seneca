'use client';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { sharedMuiTabsSx } from '@/app/components/ui/mui-tabs';
import { useIntlayer } from '@/app/i18n';
import { CalculatorTab } from './components/CalculatorTab';
import { PerformanceTab } from './components/PerformanceTab';
import {
  parseReturnsRange,
  parseRoiTab,
  type ReturnsRange,
  type RoiTab,
  withRoiParams,
} from './helpers/roi-url-state';

export default function RoiPage() {
  const t = useIntlayer('roiPage');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Tab and window live in the URL so a reload or a shared link lands on the same view.
  const tab = parseRoiTab(searchParams.get('tab'));
  const range = parseReturnsRange(searchParams.get('range'));
  const update = (patch: { tab?: RoiTab; range?: ReturnsRange }): void => {
    const query = withRoiParams(searchParams.toString(), patch);
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return (
    <Box
      component="main"
      sx={{ px: { xs: 2, md: 4 }, pt: 'var(--lumio-page-top, 24px)', pb: 3, width: '100%' }}
    >
      <Tabs
        value={tab}
        onChange={(_event, value: RoiTab) => update({ tab: value })}
        variant="scrollable"
        scrollButtons={false}
        sx={sharedMuiTabsSx}
      >
        <Tab value="performance" label={t.tabPerformance} />
        <Tab value="calculator" label={t.tabCalculator} />
      </Tabs>

      {tab === 'performance' ? (
        <PerformanceTab range={range} onRangeChange={next => update({ range: next })} />
      ) : (
        <CalculatorTab />
      )}
    </Box>
  );
}

'use client';

import Box from '@mui/material/Box';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { PageTitle } from '@/app/components/ui/page-title';
import { TextTabs } from '@/app/components/ui/text-tabs';
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
      sx={{ px: { xs: 2, md: 4 }, pt: 'var(--seneca-page-top, 24px)', pb: 3, width: '100%' }}
    >
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 3,
          justifyContent: 'flex-end',
          alignItems: 'center',
          mb: 3,
        }}
      >
        <PageTitle path="/roi" />
        <TextTabs<RoiTab>
          value={tab}
          onChange={value => update({ tab: value })}
          options={[
            { value: 'performance', label: t.tabPerformance.value },
            { value: 'calculator', label: t.tabCalculator.value },
          ]}
          ariaLabel={t.title.value}
        />
      </Box>

      {tab === 'performance' ? (
        <PerformanceTab range={range} onRangeChange={next => update({ range: next })} />
      ) : (
        <CalculatorTab />
      )}
    </Box>
  );
}

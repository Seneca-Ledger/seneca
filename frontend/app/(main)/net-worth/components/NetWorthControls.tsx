'use client';

import Box from '@mui/material/Box';
import type React from 'react';
import { joinSummary, PageTitle } from '@/app/components/ui/page-title';
import { TextTabs } from '@/app/components/ui/text-tabs';
import { useIntlayer } from '@/app/i18n';
import {
  NET_WORTH_RANGES,
  type NetWorthAssetLine,
  type NetWorthCustomRange,
  type NetWorthRange,
  type NetWorthView,
} from '../hooks/useNetWorth';
import { AccountFilter } from './AccountFilter';
import { CustomRange } from './CustomRange';

interface NetWorthControlsProps {
  currency: string;
  range: NetWorthRange;
  custom: NetWorthCustomRange | null;
  view: NetWorthView;
  /** The window the answer covers, so the custom picker opens on it. */
  window: NetWorthCustomRange | null;
  lines: NetWorthAssetLine[] | null;
  excluded: string[];
  denominate: 'XAU' | null;
  setRange: (range: NetWorthRange) => void;
  setCustom: (custom: NetWorthCustomRange | null) => void;
  setView: (view: NetWorthView) => void;
  setExcluded: (ids: string[]) => void;
  setDenominate: (metal: 'XAU' | null) => void;
}

/** The page's header: the unit, the window and which shape of it, and which lines count. */
export function NetWorthControls(props: NetWorthControlsProps): React.JSX.Element {
  const t = useIntlayer('netWorthPage');
  const { currency, range, custom, view, denominate } = props;
  const rangeLabel = (option: NetWorthRange): string =>
    option === 'all' ? t.rangeAll.value : option.toUpperCase().replace('180D', '6M');
  const summary = custom ? `${custom.from} – ${custom.to}` : rangeLabel(range);

  return (
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
      <PageTitle
        path="/net-worth"
        summary={joinSummary([summary, denominate && t.ouncesOfGold.value])}
      />
      <TextTabs
        value={denominate ? 'XAU' : 'money'}
        onChange={next => props.setDenominate(next === 'money' ? null : 'XAU')}
        options={[
          { value: 'money', label: currency },
          { value: 'XAU', label: t.ouncesOfGold.value },
        ]}
        ariaLabel={t.ouncesOfGold.value}
      />
      {/* A window of the user's own choosing leaves no preset picked. */}
      <TextTabs<string>
        value={custom ? '' : range}
        onChange={next => props.setRange(next as NetWorthRange)}
        options={NET_WORTH_RANGES.map(option => ({ value: option, label: rangeLabel(option) }))}
        ariaLabel={t.title.value}
      />
      <TextTabs<NetWorthView>
        value={view}
        onChange={props.setView}
        options={[
          { value: 'performance', label: t.viewPerformance.value },
          { value: 'breakdown', label: t.viewBreakdown.value },
        ]}
        ariaLabel={t.viewPerformance.value}
      />
      <AccountFilter
        lines={props.lines}
        excluded={props.excluded}
        onChange={props.setExcluded}
        labels={{ accounts: t.accountsFilter.value, showAll: t.accountsShowAll.value }}
      />
      <CustomRange
        value={custom}
        fallback={props.window}
        onChange={props.setCustom}
        labels={{
          custom: t.rangeCustom.value,
          from: t.rangeFrom.value,
          to: t.rangeTo.value,
        }}
      />
    </Box>
  );
}

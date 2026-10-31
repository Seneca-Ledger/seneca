'use client';

import { Checkbox, ListItemText, Menu, MenuItem } from '@mui/material';
import type React from 'react';
import { useState } from 'react';
import { SlidersHorizontal } from '@/app/components/icons';
import { useIntlayer } from '@/app/i18n';
import { OVERVIEW_SECTION_IDS, type OverviewSectionId } from './overview-layout';

/** The checklist dismisses itself once its job is done; it is not a widget to pick. */
const PICKABLE = OVERVIEW_SECTION_IDS.filter(id => id !== 'getting-started');

type SectionNameKey =
  | 'kpiIncome'
  | 'kpiSpent'
  | 'kpiNet'
  | 'kpiSavings'
  | 'safeToSpend'
  | 'cashFlow'
  | 'crypto'
  | 'topCategories'
  | 'recentTransactions'
  | 'goals'
  | 'netWorth'
  | 'balances'
  | 'budgets'
  | 'subscriptionsMonth'
  | 'activity'
  | 'monthClose'
  | 'upcomingCharges'
  | 'moneyOwed'
  | 'taxes'
  | 'advice';

const NAME_KEYS: Record<Exclude<OverviewSectionId, 'getting-started'>, SectionNameKey> = {
  'kpi-income': 'kpiIncome',
  'kpi-spent': 'kpiSpent',
  'kpi-net': 'kpiNet',
  'kpi-savings': 'kpiSavings',
  'safe-to-spend': 'safeToSpend',
  'cash-flow': 'cashFlow',
  crypto: 'crypto',
  'top-categories': 'topCategories',
  'recent-transactions': 'recentTransactions',
  goals: 'goals',
  'net-worth': 'netWorth',
  balances: 'balances',
  budgets: 'budgets',
  'cash-runway': 'subscriptionsMonth',
  activity: 'activity',
  'month-close': 'monthClose',
  'upcoming-charges': 'upcomingCharges',
  'money-owed': 'moneyOwed',
  taxes: 'taxes',
  advice: 'advice',
};

interface OverviewWidgetPickerProps {
  /** Sections currently on the Overview. */
  shown: ReadonlySet<string>;
  onToggle: (id: OverviewSectionId, shown: boolean) => void;
}

/** Which sections the Overview shows: one checkbox each, kept open while ticking several. */
export function OverviewWidgetPicker({
  shown,
  onToggle,
}: OverviewWidgetPickerProps): React.JSX.Element {
  const t = useIntlayer('overviewWidgets');
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  return (
    <>
      <button
        type="button"
        className="seneca-overview__widgets"
        aria-haspopup="menu"
        aria-expanded={anchor ? true : undefined}
        onClick={event => setAnchor(event.currentTarget)}
      >
        <SlidersHorizontal size={14} />
        {t.pickerButton}
      </button>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        slotProps={{ paper: { sx: { maxHeight: 420 } } }}
      >
        {PICKABLE.map(id => {
          const checked = shown.has(id);
          const name = t.sections[NAME_KEYS[id]].value;
          return (
            <MenuItem
              key={id}
              role="menuitemcheckbox"
              aria-checked={checked}
              dense
              onClick={() => onToggle(id, !checked)}
            >
              <Checkbox
                checked={checked}
                size="small"
                tabIndex={-1}
                disableRipple
                sx={{ p: 0, mr: 1 }}
                slotProps={{ input: { 'aria-hidden': true } }}
              />
              <ListItemText>{name}</ListItemText>
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
}

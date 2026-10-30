'use client';

import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import type React from 'react';
import { DashboardCard } from '@/app/components/dashboard/ui';
import type { LucideIcon } from '@/app/components/icons';
import { TextTabs } from '@/app/components/ui/text-tabs';
import {
  ArrowLeftRight,
  PiggyBank,
  Scale,
  TrayArrowDown,
  WalletArrowUp,
} from '@/app/lib/category-line-icons';
import { CASH_FLOW_MIN_HEIGHT } from './cash-flow.chart';

type Text = (key: string, fallback: string) => string;

/** The treemap's default height. */
const TREEMAP_HEIGHT = 320;

/** A tile as CashFlowTile draws it: label and icon for real, the figures as bars. */
function TileSkeleton({
  label,
  icon: Icon,
  caption,
}: {
  label: string;
  icon: LucideIcon;
  caption: boolean;
}): React.JSX.Element {
  return (
    <Box
      sx={{
        position: 'relative',
        overflow: 'hidden',
        isolation: 'isolate',
        p: '22px',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        bgcolor: 'background.paper',
      }}
    >
      <Icon className="seneca-dashboard__stat-icon" aria-hidden="true" />
      <Typography sx={{ fontSize: 14, color: 'var(--text-muted)' }}>{label}</Typography>
      <Skeleton variant="text" width={120} sx={{ mt: 0.5, fontSize: 30, lineHeight: 1.2 }} />
      {caption ? <Skeleton variant="text" width="70%" sx={{ mt: 0.75, fontSize: 14 }} /> : null}
    </Box>
  );
}

/** The cash-flow tab while its map loads: the tiles and cards in place, the figures as bars. */
export function CashFlowSkeleton({
  text,
  filters,
}: {
  text: Text;
  filters: { compare: boolean; includeTransfers: boolean };
}): React.JSX.Element {
  const tiles: Array<[string, string, LucideIcon]> = [
    ['cfIncome', 'Income', TrayArrowDown],
    ['cfSpending', 'Spending', WalletArrowUp],
    ['cfNet', 'Net', Scale],
    ['cfSavingsRate', 'Savings rate', PiggyBank],
    ...(filters.includeTransfers
      ? [['cfTransfers', 'Transfers & investments', ArrowLeftRight] as [string, string, LucideIcon]]
      : []),
  ];
  return (
    <Box aria-busy sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 3 }}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'minmax(0, 1fr)',
            sm: 'repeat(auto-fill, minmax(240px, 320px))',
          },
          gap: 2,
        }}
      >
        {tiles.map(([key, fallback, icon]) => (
          <TileSkeleton
            key={key}
            label={text(key, fallback)}
            icon={icon}
            caption={filters.compare && key !== 'cfTransfers'}
          />
        ))}
      </Box>
      <DashboardCard title={text('cfSankeyTitle', 'Where the money went')}>
        <Skeleton variant="rounded" height={CASH_FLOW_MIN_HEIGHT} />
      </DashboardCard>
      <DashboardCard
        title={text('cfComparisonTitle', 'By category')}
        subtitle={text('cfTreemapHint', 'Click a category to see its subcategories')}
        action={
          <TextTabs
            value="map"
            onChange={() => {}}
            ariaLabel={text('cfComparisonTitle', 'By category')}
            options={[
              { value: 'map', label: text('cfViewMap', 'Map') },
              { value: 'table', label: text('cfViewTable', 'Table') },
            ]}
          />
        }
      >
        <Skeleton variant="rounded" height={TREEMAP_HEIGHT} />
      </DashboardCard>
    </Box>
  );
}

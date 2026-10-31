'use client';

import BarChartOutlined from '@mui/icons-material/BarChartOutlined';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from 'next-themes';
import type React from 'react';
import { useMemo } from 'react';
import {
  buildCashFlowSankey,
  cashFlowChartHeight,
} from '@/app/(main)/reports/components/cash-flow/cash-flow.chart';
import { SpendFlowSkeleton } from '@/app/(main)/statements/components/analytics/flow/SpendFlowSkeleton';
import { LazyECharts } from '@/app/components/ui/lazy-echarts';
import { useIsMobile } from '@/app/hooks/useIsMobile';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer } from '@/app/i18n';
import { usePrivacyMode } from '@/app/lib/privacy-mode';
import { apiQueryDecoded, type ContractInput } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';
import { useCategoryName } from '@/app/lib/use-category-name';
import { monthRange, withoutSubcategories } from './cash-flow-flow';
import { CardEmpty } from './ui';

interface CashFlowFlowProps {
  /** The dashboard's picked month (YYYY-MM). */
  month: string;
  formatAmount: (value: number) => string;
}

/**
 * The card's month as the Reports sankey, one level shallower: where the
 * income came from and which categories it went to. Same endpoint and the
 * same default switches as the card's own figures (no transfers, refunds as
 * income); filters, subcategories and comparisons stay in Reports.
 */
export function CashFlowFlow({ month, formatAmount }: CashFlowFlowProps): React.JSX.Element {
  const t = useIntlayer('cashFlowCard');
  const workspaceId = useWorkspaceId();
  const { resolvedTheme } = useTheme();
  const isMobile = useIsMobile();
  const privacy = usePrivacyMode();
  const categoryName = useCategoryName();
  const { from, to } = monthRange(month);
  const params = { dateFrom: from, dateTo: to } satisfies ContractInput<'CashFlowMapQuery'>;
  const query = useQuery({
    // The Reports key: a month opened there and here is fetched once.
    queryKey: queryKeys.cashFlowMap({ workspaceId, params: JSON.stringify(params) }),
    queryFn: ({ signal }) =>
      apiQueryDecoded({ url: '/reports/cash-flow-map', params, signal, contract: 'CashFlowMap' }),
    enabled: Boolean(workspaceId),
  });
  const sankey = useMemo(
    () => (query.data ? withoutSubcategories(query.data.sankey) : null),
    [query.data],
  );
  const option = useMemo(
    () =>
      sankey
        ? buildCashFlowSankey(
            { sankey },
            resolvedTheme,
            formatAmount,
            isMobile,
            categoryName,
            privacy,
          )
        : null,
    // formatAmount is rebuilt every render; the chart only needs to follow the data and theme.
    // biome-ignore lint/correctness/useExhaustiveDependencies: see above
    [sankey, resolvedTheme, isMobile, categoryName, privacy],
  );

  if (query.isPending) {
    return <SpendFlowSkeleton />;
  }
  if (!(sankey && option) || sankey.links.length === 0) {
    return (
      <CardEmpty icon={BarChartOutlined} fill>
        {t.empty}
      </CardEmpty>
    );
  }
  return (
    <>
      {query.data?.missingRates.length ? (
        <p className="seneca-dashboard__card-note" style={{ color: 'var(--attention)' }}>
          {t.missingRates.value.replace('{{currencies}}', query.data.missingRates.join(', '))}
        </p>
      ) : null}
      <LazyECharts
        option={option}
        style={{ height: cashFlowChartHeight({ sankey }), width: '100%' }}
        notMerge
      />
    </>
  );
}

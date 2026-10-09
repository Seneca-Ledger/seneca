'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnalyticsMonthEmpty } from '@/app/(main)/statements/components/analytics/flow/AnalyticsMonthEmpty';
import { SpendFlowSkeleton } from '@/app/(main)/statements/components/analytics/flow/SpendFlowSkeleton';
import {
  buildSpendFlowSankey,
  findSpendFlowNodeId,
  type SpendFlowChartLabels,
  spendFlowChartHeight,
  visibleSpendFlow,
} from '@/app/(main)/statements/components/analytics/flow/spend-flow.chart';
import {
  type SpendFlowGroupBy,
  useSpendFlow,
} from '@/app/(main)/statements/components/analytics/flow/useSpendFlow';
import { LazyECharts } from '@/app/components/ui/lazy-echarts';
import { formatMoney } from '@/app/lib/analytics-common';
import { tokens } from '@/lib/theme-tokens';

/** Below this width the third column has no room for its labels. */
const COMPACT_WIDTH = 640;

/**
 * Two blinks of the band a deep link points at, each one the hover state the
 * reader would have produced themselves (`emphasis.focus: 'adjacency'` dims the
 * rest), then back to normal. Offsets from the chart being ready, in ms: the
 * first pause lets the grow-in animation finish, so the blink is not lost in it.
 */
const FLASH_SEQUENCE: Array<[delay: number, action: 'highlight' | 'downplay']> = [
  [700, 'highlight'],
  [1300, 'downplay'],
  [1650, 'highlight'],
  [2250, 'downplay'],
];

type EChartsLike = { dispatchAction: (payload: { type: string; [key: string]: unknown }) => void };

type Props = {
  groupBy: SpendFlowGroupBy;
  type: 'expense' | 'income';
  month: Date;
  resolvedTheme: string | undefined;
  title: string;
  subtitle: string;
  chartLabels: SpendFlowChartLabels;
  emptyLabels: { emptyMonthSpend: string; emptyMonthIncome: string; emptyMonthHint: string };
  errorLabel: string;
  /**
   * A second-column label (a category, a merchant) to blink twice once the
   * chart is drawn — how a `?focus=` deep link points something out here, the
   * way it rings a row in the leaderboard.
   */
  flashNodeName?: string | null;
};

/**
 * Measured, not matchMedia: the card's own width is what decides whether
 * three columns fit, and a ResizeObserver cannot disagree with the server.
 */
function useContainerWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number | null] {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState<number | null>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    const observer = new ResizeObserver(entries => {
      setWidth(entries[0]?.contentRect.width ?? null);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

function Message({ text }: { text: string }): React.JSX.Element {
  return (
    <p
      style={{
        padding: '32px 0',
        textAlign: 'center',
        fontSize: 13,
        color: 'var(--muted-foreground)',
      }}
    >
      {text}
    </p>
  );
}

export function SpendFlowChart({
  groupBy,
  type,
  month,
  resolvedTheme,
  title,
  subtitle,
  chartLabels,
  emptyLabels,
  errorLabel,
  flashNodeName = null,
}: Props): React.JSX.Element {
  const query = useSpendFlow(groupBy, type, month);
  // Fetch the echarts chunk alongside the data: otherwise LazyECharts' own
  // plain skeleton replaces the sankey-shaped one for a moment after the data lands.
  useEffect(() => {
    void import('echarts-for-react');
  }, []);
  const [containerRef, width] = useContainerWidth<HTMLDivElement>();
  const compact = width !== null && width < COMPACT_WIDTH;
  const data = query.data;

  const option = useMemo(() => {
    if (!data) {
      return null;
    }
    const formatAmount = (value: number): string => formatMoney(value, data.currency);
    return buildSpendFlowSankey(data, resolvedTheme, chartLabels, formatAmount, {
      compact,
      isIncome: type === 'income',
    });
  }, [data, resolvedTheme, chartLabels, compact, type]);

  const flashNodeId = useMemo(
    () => (data ? findSpendFlowNodeId(visibleSpendFlow(data, compact), flashNodeName) : null),
    [data, compact, flashNodeName],
  );
  const flashTimersRef = useRef<number[]>([]);
  useEffect(
    () => () => {
      for (const timer of flashTimersRef.current) {
        window.clearTimeout(timer);
      }
    },
    [],
  );

  // On ready rather than in an effect: the instance exists only from here, and
  // the chart is remounted (keyed by flow and month) whenever its data changes.
  const handleChartReady = useCallback(
    (instance: EChartsLike) => {
      if (!flashNodeId) {
        return;
      }
      flashTimersRef.current = FLASH_SEQUENCE.map(([delay, action]) =>
        window.setTimeout(
          () => instance.dispatchAction({ type: action, seriesIndex: 0, name: flashNodeId }),
          delay,
        ),
      );
    },
    [flashNodeId],
  );

  const renderBody = (): React.JSX.Element => {
    if (query.isError) {
      return <Message text={errorLabel} />;
    }
    // The placeholder kept from the other flow (spend vs income) is not this
    // chart: skeleton until the real answer lands, so it mounts fresh.
    if (!(data && option) || data.type !== type) {
      return <SpendFlowSkeleton columns={groupBy === 'merchant' ? 2 : 3} />;
    }
    if (data.links.length === 0) {
      return (
        <AnalyticsMonthEmpty month={month} isIncome={type === 'income'} labels={emptyLabels} />
      );
    }
    // A definite height: ECharts measures its box once on mount. Keyed by flow and month:
    // the grow-in animation only plays on a fresh instance, never on setOption.
    return (
      <LazyECharts
        key={`${data.type}:${data.dateFrom}`}
        option={option}
        notMerge
        onChartReady={handleChartReady}
        style={{ height: spendFlowChartHeight(data, compact), width: '100%' }}
      />
    );
  };

  return (
    <section
      ref={containerRef}
      aria-label={title}
      style={{
        border: '1px solid var(--border-color)',
        background: 'var(--card-bg)',
        padding: 20,
        borderRadius: tokens.radius.lg,
        minWidth: 0,
      }}
    >
      <div style={{ marginBottom: 12 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>{title}</h3>
        <p style={{ marginTop: 2, fontSize: 12, color: 'var(--muted-foreground)' }}>{subtitle}</p>
      </div>
      {renderBody()}
    </section>
  );
}

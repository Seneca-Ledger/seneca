'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnalyticsMonthEmpty } from '@/app/(main)/statements/components/analytics/flow/AnalyticsMonthEmpty';
import { SpendFlowSkeleton } from '@/app/(main)/statements/components/analytics/flow/SpendFlowSkeleton';
import {
  buildSpendFlowSankey,
  findSpendFlowNodeId,
  type SpendFlowChartLabels,
  spendFlowChartHeight,
  spendFlowTarget,
  visibleSpendFlow,
} from '@/app/(main)/statements/components/analytics/flow/spend-flow.chart';
import {
  type SpendFlowGroupBy,
  useSpendFlow,
  useSpendFlowRange,
} from '@/app/(main)/statements/components/analytics/flow/useSpendFlow';
import { resolveDocumentsHref } from '@/app/(main)/statements/components/documents-for-rows';
import { LazyECharts } from '@/app/components/ui/lazy-echarts';
import { useLocale } from '@/app/i18n';
import { formatMoney } from '@/app/lib/format-money';
import { usePrivacyMode } from '@/app/lib/privacy-mode';
import { useCategoryName } from '@/app/lib/use-category-name';
import { tokens } from '@/lib/theme-tokens';

/** Below this width the third column has no room for its labels. */
const COMPACT_WIDTH = 640;

/**
 * Two blinks of the band a deep link points at, its node and the link into it,
 * then back to normal. Offsets from the chart being ready, in ms: the first
 * pause lets the grow-in animation finish, so the blink is not lost in it.
 */
const FLASH_SEQUENCE: Array<[delay: number, action: 'highlight' | 'downplay']> = [
  [700, 'highlight'],
  [1300, 'downplay'],
  [1650, 'highlight'],
  [2250, 'downplay'],
];
/** When the blinks are over and hovering dims the rest again. */
const FLASH_END_MS = 2300;

/** The node's own tooltip names the band for the whole blink. */
const FLASH_TOOLTIP: Array<[delay: number, action: 'showTip' | 'hideTip']> = [
  [700, 'showTip'],
  [3200, 'hideTip'],
];

type EChartsLike = {
  dispatchAction: (payload: { type: string; [key: string]: unknown }) => void;
  setOption: (option: Record<string, unknown>) => void;
};

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
  /** False where the section above already names the chart: no second title in the card. */
  heading?: boolean;
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
  heading = true,
  flashNodeName = null,
}: Props): React.JSX.Element {
  const query = useSpendFlow(groupBy, type, month);
  const { locale } = useLocale();
  const categoryName = useCategoryName();
  const privacy = usePrivacyMode();
  // Fetch the echarts chunk alongside the data: otherwise LazyECharts' own
  // plain skeleton replaces the sankey-shaped one for a moment after the data lands.
  useEffect(() => {
    void import('echarts-for-react');
  }, []);
  const router = useRouter();
  const range = useSpendFlowRange(month);
  // A node, or the band flowing into it, opens the documents behind it.
  const chartEvents = {
    click: (params: { dataType?: string; name?: string; data?: { target?: string } }) => {
      const id = params.dataType === 'edge' ? params.data?.target : params.name;
      const target = id ? spendFlowTarget(id, groupBy) : null;
      if (!target) return;
      void resolveDocumentsHref(target, range.dateFrom, range.dateTo).then(href =>
        router.push(href),
      );
    },
  };
  const [containerRef, width] = useContainerWidth<HTMLDivElement>();
  const compact = width !== null && width < COMPACT_WIDTH;
  const data = query.data;

  const option = useMemo(() => {
    if (!data) {
      return null;
    }
    // The app's money format: symbol first, cents only under 100.
    const formatAmount = (value: number): string =>
      formatMoney(value, data.currency, locale, {
        fractionDigits: Math.abs(value) >= 100 || Number.isInteger(value) ? 0 : 2,
      });
    return buildSpendFlowSankey(data, resolvedTheme, chartLabels, formatAmount, {
      compact,
      isIncome: type === 'income',
      categoryName,
      privacy,
    });
  }, [data, resolvedTheme, chartLabels, compact, type, locale, categoryName, privacy]);

  const flashNode = useMemo(() => {
    if (!data) {
      return null;
    }
    const visible = visibleSpendFlow(data, compact);
    const id = findSpendFlowNodeId(visible, flashNodeName);
    // The series draws the visible nodes and links in this order.
    return id
      ? {
          index: visible.nodes.findIndex(node => node.id === id),
          edgeIndex: visible.links.findIndex(link => link.source === 'total' && link.target === id),
        }
      : null;
  }, [data, compact, flashNodeName]);
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
      if (!flashNode) {
        return;
      }
      // The hover look (`focus: 'adjacency'`) dims every other band, so blinking
      // a thin one made the largest band flicker instead, and that read as the
      // pick. While blinking, only the target's node and link light up.
      instance.setOption({ series: [{ emphasis: { focus: 'none' } }] });
      const blink = (type: 'highlight' | 'downplay'): void => {
        instance.dispatchAction({
          type,
          seriesIndex: 0,
          dataType: 'node',
          dataIndex: flashNode.index,
        });
        if (flashNode.edgeIndex >= 0) {
          instance.dispatchAction({
            type,
            seriesIndex: 0,
            dataType: 'edge',
            dataIndex: flashNode.edgeIndex,
          });
        }
      };
      flashTimersRef.current = [
        ...FLASH_SEQUENCE.map(([delay, action]) => window.setTimeout(() => blink(action), delay)),
        window.setTimeout(
          () => instance.setOption({ series: [{ emphasis: { focus: 'adjacency' } }] }),
          FLASH_END_MS,
        ),
        ...FLASH_TOOLTIP.map(([delay, action]) =>
          window.setTimeout(
            () =>
              instance.dispatchAction({
                type: action,
                seriesIndex: 0,
                dataIndex: flashNode.index,
                dataType: 'node',
              }),
            delay,
          ),
        ),
      ];
    },
    [flashNode],
  );

  const renderBody = (): React.JSX.Element => {
    if (query.isError) {
      return <Message text={errorLabel} />;
    }
    // The placeholder kept from the other flow (spend vs income) is not this
    // chart: skeleton until the real answer lands, so it mounts fresh.
    if (!(data && option) || data.type !== type) {
      return <SpendFlowSkeleton columns={groupBy === 'merchant' || groupBy === 'tag' ? 2 : 3} />;
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
        onEvents={chartEvents}
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
      {heading ? (
        <div style={{ marginBottom: 12 }}>
          <h3 style={{ fontSize: 15, fontWeight: 500, color: 'var(--foreground)' }}>{title}</h3>
          <p style={{ marginTop: 2, fontSize: 14, color: 'var(--text-muted)' }}>{subtitle}</p>
        </div>
      ) : null}
      {renderBody()}
    </section>
  );
}

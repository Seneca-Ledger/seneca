'use client';

import { useTheme } from 'next-themes';
import { useMemo } from 'react';
import {
  type AnalyticsFilterOptionLabels,
  buildAnalyticsFilterLabels,
  buildAnalyticsFilterOptions,
} from '@/app/(main)/statements/helpers/analytics-filter-labels';
import { useWorkspace } from '@/app/contexts/WorkspaceContext';
import { useAuth } from '@/app/hooks/useAuth';
import { useIntlayer } from '@/app/i18n';
import { resolveCurrencyCode } from '@/app/lib/analytics-common';

type WorkspaceLike = { id: string; name?: string | null };
type SourceLabels = {
  sourceBank: string;
  sourceReceipt: string;
  sourceGmailInbox: string;
  sourceCrypto: string;
};
type DrillLabels = {
  drillDown: string;
  close: string;
  noOperations: string;
  lastOperation: string;
  source: string;
  workspace: string;
  amount: string;
};

type TxFn = (path: string[], fallback: string) => string;

type DataParams<TState> = {
  user: unknown;
  currentWorkspace: WorkspaceLike | null | undefined;
  workspaces: WorkspaceLike[];
  workspaceCurrency: string;
  resolvedTheme: string | undefined;
  labels: Record<string, string>;
  state: TState;
  /** The month this view is showing; its own header owns it. */
  month: Date;
};

export type TopAnalyticsViewModelConfig<TState, TData> = {
  useStateHook: () => TState;
  useDataHook: (params: DataParams<TState>) => TData;
  createTx: (t: unknown) => TxFn;
  buildLabels: (tx: TxFn) => Record<string, string>;
};

export type TopAnalyticsViewModelReturn<TState, TData> = TState &
  TData & {
    labels: Record<string, string>;
    filterOptions: ReturnType<typeof buildAnalyticsFilterOptions>;
    filterOptionLabels: AnalyticsFilterOptionLabels;
    workspaces: WorkspaceLike[];
    workspaceCurrency: string;
    resolvedTheme: string | undefined;
    sourceLabels: SourceLabels;
    drillLabels: DrillLabels;
  };

// eslint-disable-next-line max-params
export function useTopAnalyticsViewModel<TState, TData>(
  config: TopAnalyticsViewModelConfig<TState, TData>,
  month: Date,
): TopAnalyticsViewModelReturn<TState, TData> {
  const { user } = useAuth();
  const { currentWorkspace, workspaces } = useWorkspace();
  const { resolvedTheme } = useTheme();
  const workspaceCurrency = resolveCurrencyCode(currentWorkspace?.currency);
  const state = config.useStateHook();
  const t = useIntlayer('statementsPage');
  const tx = useMemo(() => config.createTx(t), [t]);
  const labels = useMemo(() => config.buildLabels(tx), [tx]);
  const filterOptionLabels = useMemo(() => buildAnalyticsFilterLabels(tx), [tx]);
  const filterOptions = useMemo(
    () => buildAnalyticsFilterOptions(filterOptionLabels),
    [filterOptionLabels],
  );
  const data = config.useDataHook({
    user,
    currentWorkspace,
    workspaces,
    workspaceCurrency,
    resolvedTheme,
    labels,
    state,
    month,
  });
  const sourceLabels = useMemo(
    () => ({
      sourceBank: labels.sourceBank,
      sourceReceipt: labels.sourceReceipt,
      sourceGmailInbox: labels.sourceGmailInbox,
      sourceCrypto: labels.sourceCrypto,
    }),
    [labels],
  );
  const drillLabels = useMemo(
    () => ({
      drillDown: labels.drillDown,
      close: labels.close,
      noOperations: labels.noOperations,
      lastOperation: labels.lastOperation,
      source: labels.source,
      workspace: labels.workspace,
      amount: labels.amount,
    }),
    [labels],
  );
  return {
    ...state,
    ...data,
    labels,
    filterOptions,
    filterOptionLabels,
    workspaces,
    workspaceCurrency,
    resolvedTheme,
    sourceLabels,
    drillLabels,
  };
}

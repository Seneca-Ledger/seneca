'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import { useWorkspace } from '@/app/contexts/WorkspaceContext';
import { useAuth } from '@/app/hooks/useAuth';
import { useDashboard } from '@/app/hooks/useDashboard';
import { useIsMobile } from '@/app/hooks/useIsMobile';
import { usePullToRefresh } from '@/app/hooks/usePullToRefresh';
import { useIntlayer, useLocale } from '@/app/i18n';
import { FALLBACK_CURRENCY } from '@/app/lib/currency';
import { resolveDashboardEffectivePeriod } from '@/app/lib/dashboard-effective-window';
import {
  fillTemplate,
  formatDateOnly,
  parseDateOnly,
  resolveLocale,
} from '../helpers/dashboard-helpers';
import {
  formatMonthParam,
  parseMonthParam,
  withDashboardParams,
} from '../helpers/dashboard-url-state';
import { useDashboardRedirect } from './useDashboardRedirect';

/** The month lives in the URL so a reload or shared link restores the view. */
function useDashboardUrlState() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams?.toString() ?? '';
  // `null` means "no explicit month picked yet" — the backend defaults to the
  // current month and auto-shifts to the latest month with data. Once the
  // user picks a month, auto-shift is disabled for good.
  const pickedMonth = useMemo(() => parseMonthParam(searchParams?.get('month')), [searchParams]);
  const navigate = useCallback(
    (patch: { month?: string | null }): void => {
      const next = withDashboardParams(query, patch);
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    },
    [router, pathname, query],
  );
  const changeMonth = useCallback(
    (year: number, month: number): void => {
      navigate({ month: formatMonthParam(new Date(year, month, 1)) });
    },
    [navigate],
  );
  return { pickedMonth, changeMonth };
}

export function useDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const { currentWorkspace, loading: workspaceLoading } = useWorkspace();
  const { locale } = useLocale();
  const t = useIntlayer('dashboardPage');
  const headerT = useIntlayer('dashboardHeader');
  const isMobile = useIsMobile();
  const { pickedMonth, changeMonth } = useDashboardUrlState();
  const targetDateParam = pickedMonth ? formatDateOnly(pickedMonth) : undefined;
  const { data, isPending, error, refetch, range } = useDashboard('month', targetDateParam);
  const effectiveSince = data?.effectiveSince;
  const displayMonth = useMemo(() => {
    if (pickedMonth) {
      return pickedMonth;
    }
    if (effectiveSince) {
      return parseDateOnly(effectiveSince);
    }
    return new Date();
  }, [pickedMonth, effectiveSince]);
  const isRedirecting = useDashboardRedirect({
    user,
    authLoading,
    currentWorkspace,
    workspaceLoading,
  });
  const {
    handlers: pullHandlers,
    pullDistance,
    isRefreshing: pullRefreshing,
    isReadyToRefresh,
  } = usePullToRefresh({
    enabled: isMobile,
    onRefresh: () => {
      void refetch();
    },
  });
  // One formatter per locale/currency: Intl.NumberFormat construction is
  // expensive and this runs once per row in several dashboard cards.
  const currency = data?.snapshot?.currency ?? FALLBACK_CURRENCY;
  const amountFormatter = useMemo(
    () =>
      new Intl.NumberFormat(resolveLocale(locale), {
        style: 'currency',
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }),
    [locale, currency],
  );
  const formatAmount = useCallback(
    (value: number): string => amountFormatter.format(value),
    [amountFormatter],
  );
  const effectivePeriod = useMemo(
    () => resolveDashboardEffectivePeriod(data?.effectiveSince, data?.effectiveEndDate),
    [data?.effectiveSince, data?.effectiveEndDate],
  );
  const periodBanner = effectivePeriod
    ? fillTemplate(headerT.periodBanner.value, { period: effectivePeriod })
    : null;
  const headerLabels = {
    monthStrip: {
      group: headerT.monthStripLabel.value,
      previousYear: headerT.previousYear.value,
      nextYear: headerT.nextYear.value,
    },
  };
  return {
    data,
    isPending,
    error,
    refetch,
    range,
    isMobile,
    pullHandlers,
    pullDistance,
    pullRefreshing,
    isReadyToRefresh,
    isRedirecting,
    formatAmount,
    periodBanner,
    displayMonth,
    changeMonth,
    locale,
    headerLabels,
    t,
  };
}

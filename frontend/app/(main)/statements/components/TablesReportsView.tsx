'use client';

import Modal from '@mui/material/Modal';
import Skeleton from '@mui/material/Skeleton';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from 'next-themes';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { closeOnBackdropClick } from '@/app/components/ui/backdrop-click';
import { LazyECharts } from '@/app/components/ui/lazy-echarts';
import { Select } from '@/app/components/ui/select';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { queryKeys } from '@/app/lib/query-keys';
import { tokens } from '@/lib/theme-tokens';
import {
  type AvailableTable,
  formatAmount,
  getComparisonArrow,
  getComparisonColor,
  getSourceLabel,
  loadTablesReportsFilters,
  resolveDays,
  saveTablesReportsFilters,
  type TablesReportDrillDownResponse,
  type TablesReportFlowType,
  type TablesReportResponse,
  type TablesReportSortKey,
} from './tables-reports.utils';

export default function TablesReportsView() {
  const { resolvedTheme } = useTheme();
  const reportsT = useIntlayer('statementsTablesReports');
  const manualLabel = reportsT.sourceManual.value;
  const workspaceId = useWorkspaceId();
  const [availableTables, setAvailableTables] = useState<AvailableTable[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeFlowType, setActiveFlowType] = useState<TablesReportFlowType>('all');
  const [sortKey, setSortKey] = useState<TablesReportSortKey>('amount');
  const [selectedDays, setSelectedDays] = useState(30);
  const [selectedTableIds, setSelectedTableIds] = useState<string[]>([]);
  const [selectedCounterparty, setSelectedCounterparty] = useState<string | null>(null);
  const [drillDown, setDrillDown] = useState<TablesReportDrillDownResponse | null>(null);
  const [tableDropdownOpen, setTableDropdownOpen] = useState(false);
  const tableDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const saved = loadTablesReportsFilters();
    setSearchInput(saved.search);
    setDebouncedSearch(saved.search);
    setActiveFlowType(saved.flowType);
    setSortKey(saved.sortBy);
    setSelectedDays(saved.days);
    setSelectedTableIds(saved.tableIds);
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 400);

    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    if (!tableDropdownOpen) return;

    const handleMouseDown = (event: MouseEvent) => {
      if (tableDropdownRef.current?.contains(event.target as Node)) return;
      setTableDropdownOpen(false);
    };

    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [tableDropdownOpen]);

  useEffect(() => {
    saveTablesReportsFilters({
      tableIds: selectedTableIds,
      days: selectedDays,
      flowType: activeFlowType,
      sortBy: sortKey,
      search: searchInput,
    });
  }, [searchInput, selectedTableIds, selectedDays, activeFlowType, sortKey]);

  useEffect(() => {
    let mounted = true;

    apiClient
      .get('/reports/custom-tables/available')
      .then(response => {
        if (!mounted) return;
        setAvailableTables(Array.isArray(response.data) ? response.data : []);
      })
      .catch(() => {
        if (!mounted) return;
        setAvailableTables([]);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const reportPayload = useMemo(() => {
    const payload: {
      days: number;
      flowType: TablesReportFlowType;
      sortBy: TablesReportSortKey;
      search?: string;
      limit: number;
      tableIds?: string[];
    } = {
      days: resolveDays(selectedDays),
      flowType: activeFlowType,
      sortBy: sortKey,
      search: debouncedSearch.trim() || undefined,
      limit: 60,
    };

    if (selectedTableIds.length > 0) {
      payload.tableIds = selectedTableIds;
    }

    return payload;
  }, [activeFlowType, debouncedSearch, selectedDays, selectedTableIds, sortKey]);

  const reportQuery = useQuery({
    queryKey: queryKeys.tablesReport({ workspaceId, params: reportPayload }),
    queryFn: async ({ signal }) => {
      const response = await apiClient.post<TablesReportResponse>(
        '/reports/custom-tables/report',
        reportPayload,
        { signal },
      );
      return response.data;
    },
    // Клик по фильтру меняет ключ; цифры и графики держатся на экране до
    // прихода нового отчёта, но только внутри того же воркспейса.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === workspaceId ? previous : undefined,
  });

  const report = reportQuery.isError ? null : (reportQuery.data ?? null);

  const handleDrillDown = useCallback(
    async (counterparty: string) => {
      setSelectedCounterparty(counterparty);

      await (async () => {
        const payload: {
          counterparty: string;
          days: number;
          flowType: TablesReportFlowType;
          limit: number;
          tableIds?: string[];
        } = {
          counterparty,
          days: resolveDays(selectedDays),
          flowType: activeFlowType,
          limit: 120,
        };

        if (selectedTableIds.length > 0) {
          payload.tableIds = selectedTableIds;
        }

        const response = await apiClient.post('/reports/custom-tables/report/drill-down', payload);
        setDrillDown(response.data);
      })().catch(async () => {
        setDrillDown({ counterparty, items: [] });
      });
    },
    [activeFlowType, selectedDays, selectedTableIds],
  );

  const closeDrillDown = useCallback(() => {
    setSelectedCounterparty(null);
    setDrillDown(null);
  }, []);

  const timeseries = report?.timeseries;
  const trendChartOption = useMemo(() => {
    if (!timeseries?.length) return null;
    return {
      xAxis: { type: 'category', data: timeseries.map(item => item.date) },
      yAxis: { type: 'value' },
      series: [
        {
          type: 'line',
          data: timeseries.map(item => item.amount),
          smooth: true,
        },
      ],
    };
  }, [timeseries]);

  const sourceSplitOption = useMemo(() => {
    if (!report) return null;
    return {
      series: [
        {
          type: 'pie',
          data: [{ value: report.sourceSplit.manual, name: manualLabel }],
        },
      ],
    };
  }, [report, manualLabel]);

  const aggregatedRows = report?.aggregatedRows;
  const topRowsBarOption = useMemo(() => {
    if (!aggregatedRows?.length) return null;

    const topRows = aggregatedRows.slice(0, 12).reverse();

    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { top: 10, right: 30, bottom: 20, left: 140 },
      xAxis: { type: 'value' },
      yAxis: {
        type: 'category',
        data: topRows.map(item => item.counterparty),
        axisLabel: { width: 120, overflow: 'truncate' },
      },
      series: [
        {
          type: 'bar',
          data: topRows.map(item => item.total),
          barMaxWidth: 28,
          itemStyle: {
            color: '#38BDF8',
            borderRadius: [0, 0, 0, 0],
          },
        },
      ],
    };
  }, [aggregatedRows]);

  const selectedTablesCount = selectedTableIds.length;
  const chartTheme = resolvedTheme === 'dark' ? 'dark' : 'light';
  const c = resolvedTheme === 'dark' ? tokens.dark.color : tokens.color;
  const panelStyle: React.CSSProperties = {
    border: `1px solid ${c.ink150}`,
    background: 'var(--card-bg)',
    padding: 16,
    borderRadius: tokens.radius.lg,
  };
  const subtlePanelStyle: React.CSSProperties = {
    border: `1px solid ${c.ink150}`,
    background: 'var(--card-bg)',
    padding: '8px 16px',
    fontSize: 14,
    color: c.ink800,
    borderRadius: tokens.radius.md,
    cursor: 'pointer',
  };

  return (
    <div
      className="container-shared"
      style={{
        display: 'flex',
        // The parent layout wrapper already caps height to 100vh - nav on
        // /statements/* routes; recomputing it here made this box taller
        // than the parent whenever a sibling (e.g. AlertBanner) also took
        // up space.
        height: '100%',
        minHeight: 0,
        flexDirection: 'column',
        overflow: 'hidden',
        padding: '24px 16px',
      }}
    >
      <div style={{ marginBottom: 20, flexShrink: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              border: `1px solid ${c.ink150}`,
              background: c.ink50,
              padding: 4,
              borderRadius: tokens.radius.md,
            }}
          >
            <button
              type="button"
              onClick={() => setActiveFlowType('all')}
              style={{
                borderRadius: tokens.radius.sm,
                background: activeFlowType === 'all' ? 'var(--card-bg)' : 'transparent',
                padding: '6px 12px',
                fontSize: 14,
                fontWeight: activeFlowType === 'all' ? 600 : 400,
                color: activeFlowType === 'all' ? '#0284c7' : c.ink500,
                border: 'none',
                cursor: 'pointer',
                boxShadow: activeFlowType === 'all' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
              }}
            >
              {reportsT.flowAll}
            </button>
            <button
              type="button"
              onClick={() => setActiveFlowType('expense')}
              style={{
                borderRadius: tokens.radius.sm,
                background: activeFlowType === 'expense' ? 'var(--card-bg)' : 'transparent',
                padding: '6px 12px',
                fontSize: 14,
                fontWeight: activeFlowType === 'expense' ? 600 : 400,
                color: activeFlowType === 'expense' ? '#0284c7' : c.ink500,
                border: 'none',
                cursor: 'pointer',
                boxShadow: activeFlowType === 'expense' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
              }}
            >
              {reportsT.flowExpenses}
            </button>
            <button
              type="button"
              onClick={() => setActiveFlowType('income')}
              style={{
                borderRadius: tokens.radius.sm,
                background: activeFlowType === 'income' ? 'var(--card-bg)' : 'transparent',
                padding: '6px 12px',
                fontSize: 14,
                fontWeight: activeFlowType === 'income' ? 600 : 400,
                color: activeFlowType === 'income' ? '#0284c7' : c.ink500,
                border: 'none',
                cursor: 'pointer',
                boxShadow: activeFlowType === 'income' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
              }}
            >
              {reportsT.flowIncome}
            </button>
          </div>
        </div>

        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            type="search"
            value={searchInput}
            onChange={event => setSearchInput(event.target.value)}
            placeholder={reportsT.searchPlaceholder.value}
            style={{
              width: '100%',
              border: `1px solid ${c.ink150}`,
              background: 'var(--card-bg)',
              padding: '8px 16px',
              fontSize: 14,
              color: c.ink900,
              borderRadius: tokens.radius.md,
            }}
          />
          <div style={{ position: 'relative' }} ref={tableDropdownRef}>
            <button
              type="button"
              onClick={() => setTableDropdownOpen(open => !open)}
              style={subtlePanelStyle}
            >
              {reportsT.tables}
              {selectedTablesCount > 0 ? ` (${selectedTablesCount})` : ''}
            </button>

            {tableDropdownOpen ? (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  zIndex: 20,
                  marginTop: 8,
                  width: 288,
                  border: `1px solid ${c.ink150}`,
                  background: 'var(--card-bg)',
                  padding: 8,
                  boxShadow: tokens.shadow.lg,
                  borderRadius: tokens.radius.lg,
                }}
              >
                <button
                  type="button"
                  onClick={() => setSelectedTableIds([])}
                  style={{
                    marginBottom: 4,
                    width: '100%',
                    padding: '8px 12px',
                    textAlign: 'left',
                    fontSize: 14,
                    color: 'var(--color-info-soft-text)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    borderRadius: tokens.radius.sm,
                  }}
                >
                  {reportsT.allTables}
                </button>
                {availableTables.map(table => {
                  const checked = selectedTableIds.includes(table.id);
                  return (
                    <label
                      key={table.id}
                      style={{
                        display: 'flex',
                        cursor: 'pointer',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 12px',
                        fontSize: 14,
                        color: c.ink800,
                        borderRadius: tokens.radius.sm,
                      }}
                    >
                      <input
                        type="checkbox"
                        aria-label={reportsT.selectTable.value.replace('{name}', table.name)}
                        checked={checked}
                        onChange={() =>
                          setSelectedTableIds(current =>
                            current.includes(table.id)
                              ? current.filter(id => id !== table.id)
                              : [...current, table.id],
                          )
                        }
                      />
                      <span
                        style={{
                          flex: 1,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {table.name}
                      </span>
                      <span style={{ fontSize: 12, color: c.ink400 }}>
                        {getSourceLabel(table.source, manualLabel)}
                      </span>
                    </label>
                  );
                })}
              </div>
            ) : null}
          </div>
          <Select
            value={selectedDays}
            onChange={value => setSelectedDays(Number(value))}
            options={[
              { value: 7, label: reportsT.last7Days.value },
              { value: 30, label: reportsT.last30Days.value },
              { value: 90, label: reportsT.last90Days.value },
              { value: 365, label: reportsT.last365Days.value },
              { value: -1, label: reportsT.yearToDate.value },
            ]}
            sx={{ backgroundColor: 'var(--card-bg)', color: c.ink800 }}
          />
        </div>

        <div
          style={{
            marginTop: 12,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            fontSize: 12,
            color: c.ink500,
          }}
        >
          {availableTables.map(table => (
            <button
              key={table.id}
              type="button"
              onClick={() =>
                setSelectedTableIds(current =>
                  current.includes(table.id)
                    ? current.filter(id => id !== table.id)
                    : [...current, table.id],
                )
              }
              style={{
                borderRadius: tokens.radius.full,
                background: selectedTableIds.includes(table.id)
                  ? 'var(--color-info-soft-bg)'
                  : c.ink50,
                padding: '4px 12px',
                color: selectedTableIds.includes(table.id)
                  ? 'var(--color-info-soft-text)'
                  : c.ink500,
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              {table.name} · {getSourceLabel(table.source, manualLabel)}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {reportQuery.isPending ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            {['total', 'manual', 'operations'].map(key => (
              <div key={key} style={panelStyle}>
                <Skeleton variant="text" width="40%" height={16} />
                <Skeleton variant="rounded" width="60%" height={24} style={{ marginTop: 4 }} />
              </div>
            ))}
          </div>
        ) : !report || report.totals.operations === 0 ? (
          <div style={{ padding: '40px 0', fontSize: 14, color: c.ink500 }}>{reportsT.noData}</div>
        ) : (
          // Смена фильтра перезагружает отчёт в фоне: цифры и графики не гаснут.
          <div
            style={{
              opacity: reportQuery.isFetching ? 0.6 : 1,
              transition: 'opacity 150ms ease',
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
              <div style={panelStyle}>
                <div style={{ fontSize: 12, color: c.ink500 }}>{reportsT.total}</div>
                <div style={{ marginTop: 4, fontSize: 20, fontWeight: 600, color: c.ink900 }}>
                  {formatAmount(report.totals.total)}
                </div>
                <div
                  style={{
                    marginTop: 4,
                    fontSize: 12,
                    color: getComparisonColor(report.comparison.totalTrend).includes('emerald')
                      ? c.success
                      : getComparisonColor(report.comparison.totalTrend).includes('red')
                        ? c.danger
                        : c.ink500,
                  }}
                >
                  {getComparisonArrow(report.comparison.totalTrend)}{' '}
                  {report.comparison.totalPercentage}%
                </div>
              </div>
              <div style={panelStyle}>
                <div style={{ fontSize: 12, color: c.ink500 }}>{reportsT.manualTables}</div>
                <div style={{ marginTop: 4, fontSize: 20, fontWeight: 600, color: c.ink900 }}>
                  {formatAmount(report.totals.manualTotal)}
                </div>
              </div>
              <div style={panelStyle}>
                <div style={{ fontSize: 12, color: c.ink500 }}>{reportsT.operations}</div>
                <div style={{ marginTop: 4, fontSize: 20, fontWeight: 600, color: c.ink900 }}>
                  {report.totals.operations}
                </div>
              </div>
            </div>

            <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
              <div style={{ ...panelStyle, gridColumn: 'span 2' }}>
                <div style={{ marginBottom: 12, fontSize: 14, fontWeight: 500, color: c.ink800 }}>
                  {reportsT.trend}
                </div>
                {trendChartOption ? (
                  <LazyECharts
                    option={trendChartOption}
                    style={{ height: 220 }}
                    theme={chartTheme}
                  />
                ) : null}
              </div>
              <div style={panelStyle}>
                <div style={{ marginBottom: 12, fontSize: 14, fontWeight: 500, color: c.ink800 }}>
                  {reportsT.sourceSplit}
                </div>
                {sourceSplitOption ? (
                  <LazyECharts
                    option={sourceSplitOption}
                    style={{ height: 220 }}
                    theme={chartTheme}
                  />
                ) : null}
              </div>
            </div>

            {topRowsBarOption ? (
              <div style={{ marginTop: 24, ...panelStyle }}>
                <div style={{ marginBottom: 12, fontSize: 14, fontWeight: 500, color: c.ink800 }}>
                  {reportsT.topCounterparties}
                </div>
                <LazyECharts option={topRowsBarOption} style={{ height: 320 }} theme={chartTheme} />
              </div>
            ) : null}

            <div style={{ marginTop: 24, display: 'flex', gap: 8 }}>
              {(['amount', 'average', 'operations'] as TablesReportSortKey[]).map(key => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSortKey(key)}
                  style={{
                    borderRadius: tokens.radius.full,
                    background: sortKey === key ? 'var(--color-info-soft-bg)' : c.ink50,
                    padding: '4px 12px',
                    fontSize: 12,
                    fontWeight: sortKey === key ? 500 : 400,
                    color: sortKey === key ? 'var(--color-info-soft-text)' : c.ink500,
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {key === 'amount'
                    ? reportsT.amount
                    : key === 'average'
                      ? reportsT.average
                      : reportsT.operations}
                </button>
              ))}
            </div>

            <div
              style={{
                marginTop: 16,
                // Seven columns do not fit a phone: `hidden` cut the last four
                // off with no way to reach them, so the wrapper scrolls instead.
                overflowX: 'auto',
                border: `1px solid ${c.ink150}`,
                background: 'var(--card-bg)',
                borderRadius: tokens.radius.lg,
              }}
            >
              <table style={{ width: '100%', fontSize: 14, borderCollapse: 'collapse' }}>
                <thead>
                  <tr
                    style={{
                      borderBottom: `1px solid ${c.ink150}`,
                      textAlign: 'left',
                      fontSize: 12,
                      color: c.ink500,
                    }}
                  >
                    <th style={{ padding: '12px 16px' }}>{reportsT.counterparty}</th>
                    <th style={{ padding: '12px 16px' }}>{reportsT.source}</th>
                    <th style={{ padding: '12px 16px' }}>{reportsT.table}</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>
                      {reportsT.operations}
                    </th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>{reportsT.average}</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>{reportsT.amount}</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>
                      {reportsT.lastOperation}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {report.aggregatedRows.map((row, index) => (
                    <tr
                      key={`${row.counterparty}-${row.source}-${index}`}
                      style={{
                        cursor: 'pointer',
                        borderBottom: `1px solid ${c.ink50}`,
                        color: c.ink800,
                      }}
                      tabIndex={0}
                      onClick={() => void handleDrillDown(row.counterparty)}
                      onKeyDown={event => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          void handleDrillDown(row.counterparty);
                        }
                      }}
                    >
                      <td style={{ padding: '12px 16px', fontWeight: 500, color: c.ink900 }}>
                        {row.counterparty}
                      </td>
                      <td style={{ padding: '12px 16px', color: c.ink500 }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            borderRadius: tokens.radius.sm,
                            background: c.ink50,
                            padding: '2px 8px',
                            fontSize: 12,
                            fontWeight: 500,
                            color: c.ink700,
                          }}
                        >
                          {getSourceLabel(row.source, manualLabel)}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', color: c.ink500 }}>{row.tableName}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>{row.count}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        {formatAmount(row.average, row.currency)}
                      </td>
                      <td
                        style={{
                          padding: '12px 16px',
                          textAlign: 'right',
                          fontWeight: 500,
                          color: c.ink900,
                        }}
                      >
                        {formatAmount(row.total, row.currency)}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: c.ink500 }}>
                        {row.lastDate || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Modal traps focus inside the drill-down, closes on Escape and restores focus. */}
            <Modal open={Boolean(selectedCounterparty)} onClose={closeDrillDown} hideBackdrop>
              {/* biome-ignore lint/a11y: the dimmed backdrop is a mouse-only dismiss surface; keyboard users close with Escape (Modal). */}
              <div
                tabIndex={-1}
                onClick={closeOnBackdropClick(closeDrillDown)}
                style={{
                  position: 'fixed',
                  inset: 0,
                  zIndex: 50,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(0,0,0,0.4)',
                  padding: '0 16px',
                  outline: 'none',
                }}
              >
                <div
                  style={{
                    maxHeight: '80vh',
                    width: '100%',
                    maxWidth: 768,
                    overflow: 'hidden',
                    background: 'var(--card-bg)',
                    boxShadow: tokens.shadow.lg,
                    borderRadius: tokens.radius.xl,
                  }}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="tables-reports-drilldown-title"
                  onClick={event => event.stopPropagation()}
                  onKeyDown={event => {
                    if (event.key !== 'Escape') {
                      event.stopPropagation();
                    }
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderBottom: `1px solid ${c.ink150}`,
                      padding: '16px 24px',
                    }}
                  >
                    <h2
                      id="tables-reports-drilldown-title"
                      style={{ fontSize: 18, fontWeight: 600, color: c.ink900 }}
                    >
                      {reportsT.drillDownTitle.value.replace(
                        '{counterparty}',
                        drillDown?.counterparty || selectedCounterparty || '',
                      )}
                    </h2>
                    <button
                      type="button"
                      onClick={closeDrillDown}
                      style={{
                        color: c.ink500,
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: 14,
                      }}
                    >
                      {reportsT.close}
                    </button>
                  </div>

                  <div style={{ maxHeight: 'calc(80vh - 72px)', overflowY: 'auto' }}>
                    {drillDown?.items?.length ? (
                      <table style={{ width: '100%', fontSize: 14, borderCollapse: 'collapse' }}>
                        <thead>
                          <tr
                            style={{
                              borderBottom: `1px solid ${c.ink150}`,
                              textAlign: 'left',
                              fontSize: 12,
                              color: c.ink500,
                            }}
                          >
                            <th style={{ padding: '12px 16px' }}>{reportsT.date}</th>
                            <th style={{ padding: '12px 16px' }}>{reportsT.source}</th>
                            <th style={{ padding: '12px 16px' }}>{reportsT.table}</th>
                            <th style={{ padding: '12px 16px' }}>{reportsT.category}</th>
                            <th style={{ padding: '12px 16px', textAlign: 'right' }}>
                              {reportsT.amount}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {drillDown.items.map(item => (
                            <tr
                              key={item.rowId}
                              style={{ borderBottom: `1px solid ${c.ink50}`, color: c.ink800 }}
                            >
                              <td style={{ padding: '12px 16px' }}>{item.date || '-'}</td>
                              <td style={{ padding: '12px 16px' }}>
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    borderRadius: tokens.radius.sm,
                                    background: c.ink50,
                                    padding: '2px 8px',
                                    fontSize: 12,
                                    fontWeight: 500,
                                    color: c.ink700,
                                  }}
                                >
                                  {getSourceLabel(item.source, manualLabel)}
                                </span>
                              </td>
                              <td style={{ padding: '12px 16px' }}>{item.tableName}</td>
                              <td style={{ padding: '12px 16px' }}>{item.category || '-'}</td>
                              <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                {formatAmount(item.amount, item.currency)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div style={{ padding: '32px 24px', fontSize: 14, color: c.ink500 }}>
                        {reportsT.noRecords}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Modal>
          </div>
        )}
      </div>
    </div>
  );
}

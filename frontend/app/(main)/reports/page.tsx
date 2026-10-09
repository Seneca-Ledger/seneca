'use client';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import { useSearchParams } from 'next/navigation';
import type React from 'react';
import { useEffect, useState } from 'react';
import { BarChart3, CalendarDays, DollarSign, List, PieChart, Scale } from '@/app/components/icons';
import { UnconfirmedNotice } from '@/app/components/review/UnconfirmedNotice';
import { sharedMuiTabsSx } from '@/app/components/ui/mui-tabs';
import { useAttentionFocus } from '@/app/hooks/useAttentionFocus';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import BalanceSheet from './components/BalanceSheet';
import { CashFlowTab } from './components/cash-flow/CashFlowTab';
import { CashFlowView } from './components/cash-flow/CashFlowView';
import { type ReportGenerateParams, ReportGenerator } from './components/ReportGenerator';
import { ReportHistory } from './components/ReportHistory';
import { ReportSchedules } from './components/ReportSchedules';
import { type ReportTemplate, ReportTemplateCard } from './components/ReportTemplateCard';
import { TaxReturnView } from './components/TaxReturnView';

type ReportsTab = 'templates' | 'history' | 'schedules' | 'tax' | 'cash-flow';

const LINKED_TABS: ReportsTab[] = ['tax', 'cash-flow'];

const readLinkedTab = (value: string | null): ReportsTab | null =>
  LINKED_TABS.find(tab => tab === value) ?? null;

// eslint-disable-next-line max-lines-per-function
export default function ReportsPage(): React.JSX.Element {
  const t = useIntlayer('reportsPage');
  const labels = t.labels as Record<string, { value?: string } | undefined>;
  // eslint-disable-next-line max-params
  const text = (key: string, fallback: string): string => labels[key]?.value ?? fallback;

  const templates: ReportTemplate[] = [
    {
      id: 'pnl',
      name: text('templatePnlName', 'Profit & Loss (P&L)'),
      description: text(
        'templatePnlDescription',
        'Income and expenses summary with net profit for a period',
      ),
      icon: DollarSign,
      category: 'financial',
      formats: ['pdf', 'excel', 'csv'],
    },
    {
      id: 'balance-sheet',
      name: text('templateBalanceName', 'Balance Sheet'),
      description: text('templateBalanceDescription', 'Assets, liabilities and equity snapshot'),
      icon: Scale,
      category: 'financial',
      formats: ['pdf', 'excel'],
    },
    {
      id: 'cash-flow',
      name: text('templateCashFlowName', 'Cash Flow Statement'),
      description: text('templateCashFlowDescription', 'Cash inflows and outflows over a period'),
      icon: BarChart3,
      category: 'financial',
      formats: ['pdf', 'excel', 'csv'],
    },
    {
      id: 'expense-by-category',
      name: text('templateExpenseByCategoryName', 'Expense by Category'),
      description: text(
        'templateExpenseByCategoryDescription',
        'Breakdown of expenses by category with totals',
      ),
      icon: PieChart,
      category: 'operational',
      formats: ['pdf', 'excel', 'csv'],
    },
    {
      id: 'transaction-register',
      name: text('templateTransactionRegisterName', 'Transaction Register'),
      description: text(
        'templateTransactionRegisterDescription',
        'Every transaction in the period with converted and original amounts',
      ),
      icon: List,
      category: 'operational',
      formats: ['pdf', 'excel', 'csv'],
    },
    {
      id: 'monthly-summary',
      name: text('templateMonthlySummaryName', 'Monthly Summary'),
      description: text(
        'templateMonthlySummaryDescription',
        'Income, expenses, savings rate and top categories on one page',
      ),
      icon: CalendarDays,
      category: 'financial',
      formats: ['pdf', 'excel', 'csv'],
    },
  ];

  const [tab, setTab] = useState<ReportsTab>('cash-flow');
  // Tax (threshold notifications) and cash flow (advice links) are linked to.
  // Followed on change, not just read once: the link can be opened while this
  // page is already up.
  const linkedTab = readLinkedTab(useSearchParams().get('tab'));
  useEffect(() => {
    if (linkedTab) {
      setTab(linkedTab);
    }
  }, [linkedTab]);
  // Read once for the whole page: a second reader would find the parameter
  // already cleared and never ring its row.
  const focusId = useAttentionFocus();
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);
  const [showBalanceSheet, setShowBalanceSheet] = useState(false);

  const handleSelectTemplate = (template: ReportTemplate): void => {
    if (template.id === 'balance-sheet') {
      setShowBalanceSheet(true);
      setSelectedTemplate(null);
      return;
    }
    setSelectedTemplate(prev => (prev?.id === template.id ? null : template));
  };

  const handleGenerate = async (params: ReportGenerateParams): Promise<void> => {
    const response = await apiClient.post('/reports/generate', params, {
      responseType: 'blob',
    });
    const blob = new Blob([response.data]);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${params.templateId}-report.${params.format === 'excel' ? 'xlsx' : params.format}`;
    a.click();
    window.URL.revokeObjectURL(url);
    setSelectedTemplate(null);
  };

  if (showBalanceSheet) {
    return (
      <Box>
        <Box sx={{ px: { xs: 2, sm: 4 }, pt: 4, pb: 3 }}>
          <button
            type="button"
            onClick={() => setShowBalanceSheet(false)}
            style={{
              marginBottom: 16,
              fontSize: 14,
              fontWeight: 500,
              color: 'var(--primary)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            ← {text('backToTemplates', 'Back to templates')}
          </button>
        </Box>
        <Box sx={{ px: { xs: 2, sm: 4 }, pb: 4 }}>
          <UnconfirmedNotice style={{ marginBottom: 16 }} />
          <BalanceSheet />
        </Box>
      </Box>
    );
  }

  return (
    <Box>
      <Box
        sx={{
          mt: 'var(--lumio-page-top, 16px)',
          borderBottom: '1px solid var(--border)',
          px: { xs: 2, sm: 4 },
        }}
      >
        <Tabs
          data-tour-id="reports-tabs"
          value={tab}
          // eslint-disable-next-line max-params
          onChange={(_e, v: ReportsTab) => {
            setTab(v);
            setSelectedTemplate(null);
          }}
          variant="scrollable"
          scrollButtons={false}
          sx={sharedMuiTabsSx}
        >
          <Tab value="cash-flow" label={text('tabCashFlow', 'Cash flow')} />
          <Tab value="templates" label={text('tabTemplates', 'Templates')} />
          <Tab
            value="schedules"
            label={text('tabSchedules', 'Schedules')}
            data-tour-id="reports-schedules-tab"
          />
          <Tab
            value="history"
            label={text('tabHistory', 'History')}
            data-tour-id="reports-history-tab"
          />
          <Tab value="tax" label={text('tabTax', 'Tax return')} />
        </Tabs>
      </Box>

      <Box sx={{ px: { xs: 2, sm: 4 }, py: 3 }}>
        <UnconfirmedNotice style={{ marginBottom: 16 }} />
        {tab === 'tax' && <TaxReturnView />}
        {tab === 'cash-flow' && (
          <>
            <CashFlowView />
            <CashFlowTab focusId={focusId} />
          </>
        )}
        {tab === 'templates' && (
          <>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: 2,
              }}
              data-tour-id="reports-templates-grid"
            >
              {templates.map(tmpl => (
                <ReportTemplateCard
                  key={tmpl.id}
                  template={tmpl}
                  onSelect={handleSelectTemplate}
                  isSelected={selectedTemplate?.id === tmpl.id}
                />
              ))}
            </Box>
            {selectedTemplate && (
              <ReportGenerator
                template={selectedTemplate}
                onClose={() => setSelectedTemplate(null)}
                onGenerate={handleGenerate}
              />
            )}
          </>
        )}
        {tab === 'schedules' && (
          <ReportSchedules templates={templates.map(tmpl => ({ id: tmpl.id, name: tmpl.name }))} />
        )}
        {tab === 'history' && <ReportHistory />}
      </Box>
    </Box>
  );
}

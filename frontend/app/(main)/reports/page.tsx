'use client';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import type React from 'react';
import { useEffect, useState } from 'react';
import {
  BarChart3,
  Briefcase,
  CalendarDays,
  DollarSign,
  List,
  PieChart,
  PiggyBank,
  Scale,
  Table2,
} from '@/app/components/icons';
import { sharedMuiTabsSx } from '@/app/components/ui/mui-tabs';
import { joinSummary, PageTitle } from '@/app/components/ui/page-title';
import { useAttentionFocus } from '@/app/hooks/useAttentionFocus';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { blobOf } from '@/app/lib/blob-of';
import { apiQueryDecoded, type ContractInput } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';
import BalanceSheet from './components/BalanceSheet';
import { CashFlowView } from './components/cash-flow/CashFlowView';
import { type ReportGenerateParams, ReportGenerator } from './components/ReportGenerator';
import { ReportHistory } from './components/ReportHistory';
import { ReportSchedules } from './components/ReportSchedules';
import { type ReportTemplate, ReportTemplateCard } from './components/ReportTemplateCard';
import { TaxReturnView } from './components/TaxReturnView';
import { TaxYearView } from './components/TaxYearView';

type ReportsTab = 'templates' | 'history' | 'schedules' | 'tax' | 'tax-year' | 'cash-flow';

const LINKED_TABS: ReportsTab[] = ['tax', 'tax-year', 'cash-flow'];

const readLinkedTab = (value: string | null): ReportsTab | null =>
  LINKED_TABS.find(tab => tab === value) ?? null;

export default function ReportsPage(): React.JSX.Element {
  const t = useIntlayer('reportsPage');
  const taxYearText = useIntlayer('taxYearView');
  const workspaceId = useWorkspaceId();
  // The VAT return only means something to a workspace that charges VAT.
  const taxSettings = useQuery({
    queryKey: queryKeys.taxSettings(workspaceId),
    queryFn: ({ signal }) =>
      apiQueryDecoded({ url: '/tax/settings', signal, contract: 'WorkspaceTaxSettings' }),
    enabled: Boolean(workspaceId),
  });
  const chargesVat = taxSettings.data?.vatStatus === 'registered';
  const labels = t.labels as Record<string, { value?: string } | undefined>;
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
      // A snapshot of accounts, not a transaction query, and it has its own view.
      scopeFilters: false,
      preview: false,
    },
    {
      id: 'cash-flow',
      name: text('templateCashFlowName', 'Cash Flow Statement'),
      description: text('templateCashFlowDescription', 'Cash inflows and outflows over a period'),
      icon: BarChart3,
      category: 'financial',
      formats: ['pdf', 'excel', 'csv'],
      groupBy: true,
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
    {
      id: 'category-by-month',
      name: text('templateCategoryByMonthName', 'Categories by Month'),
      description: text(
        'templateCategoryByMonthDescription',
        'Income and spending per category, a column per month, with totals and averages',
      ),
      hint: text(
        'categoryByMonthHint',
        'A PDF page fits up to 12 months; choose Excel or CSV for longer periods (up to 36).',
      ),
      icon: Table2,
      category: 'operational',
      formats: ['pdf', 'excel', 'csv'],
    },
    {
      id: 'budget-vs-actual',
      name: text('templateBudgetVsActualName', 'Budget vs Actual'),
      description: text(
        'templateBudgetVsActualDescription',
        'What each budget allowed against what was spent, plus spending no budget covers',
      ),
      icon: PiggyBank,
      category: 'operational',
      formats: ['pdf', 'excel', 'csv'],
    },
    {
      id: 'investment-holdings',
      name: text('templateInvestmentHoldingsName', 'Investment Holdings'),
      description: text(
        'templateInvestmentHoldingsDescription',
        'Securities, precious metals and crypto valued today, in one list',
      ),
      hint: text(
        'holdingsSnapshotHint',
        "A snapshot of today's holdings: the period does not apply.",
      ),
      icon: Briefcase,
      category: 'financial',
      formats: ['pdf', 'excel', 'csv'],
      period: 'none',
      scopeFilters: false,
    },
  ];

  const [tab, setTab] = useState<ReportsTab>('cash-flow');
  const [cashFlowPeriod, setCashFlowPeriod] = useState('');
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
    const response = await apiClient.post(
      '/reports/generate',
      params satisfies ContractInput<'GenerateReportBody'>,
      {
        responseType: 'blob',
      },
    );
    const blob = new Blob([blobOf(response)]);
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
          <BalanceSheet />
        </Box>
      </Box>
    );
  }

  const tabLabels: Record<ReportsTab, string> = {
    'cash-flow': text('tabCashFlow', 'Cash flow'),
    templates: text('tabTemplates', 'Templates'),
    schedules: text('tabSchedules', 'Schedules'),
    history: text('tabHistory', 'History'),
    'tax-year': taxYearText.tabLabel.value,
    tax: text('tabTax', 'Tax return'),
  };
  const titleSummary = joinSummary([tabLabels[tab], tab === 'cash-flow' && cashFlowPeriod]);

  return (
    <Box>
      <Box sx={{ mt: 'var(--seneca-page-top, 16px)', px: { xs: 2, sm: 4 }, mb: 1 }}>
        <PageTitle path="/reports" summary={titleSummary} />
      </Box>
      <Box
        sx={{
          borderBottom: '1px solid var(--border)',
          px: { xs: 2, sm: 4 },
        }}
      >
        <Tabs
          data-tour-id="reports-tabs"
          value={tab}
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
          <Tab value="tax-year" label={taxYearText.tabLabel.value} />
          {chargesVat || tab === 'tax' ? (
            <Tab value="tax" label={text('tabTax', 'Tax return')} />
          ) : null}
        </Tabs>
      </Box>

      <Box sx={{ px: { xs: 2, sm: 4 }, py: 3 }}>
        {tab === 'tax' && <TaxReturnView />}
        {tab === 'tax-year' && <TaxYearView />}
        {tab === 'cash-flow' && (
          // The leaderboards sit inside the view: they take its period.
          <CashFlowView focusId={focusId} onPeriodChange={setCashFlowPeriod} />
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
          <ReportSchedules
            templates={templates.map(tmpl => ({
              id: tmpl.id,
              name: tmpl.name,
              formats: tmpl.formats,
            }))}
          />
        )}
        {tab === 'history' && <ReportHistory />}
      </Box>
    </Box>
  );
}

'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import type React from 'react';
import { useState } from 'react';
import CustomDatePicker from '@/app/components/CustomDatePicker';
import { Download, X } from '@/app/components/icons';
import { useIntlayer, useLocale } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { type ContractInput, checkContract } from '@/app/lib/query-fn-schema';
import { tokens } from '@/lib/theme-tokens';
import { ReportPreview, type ReportPreviewData } from './ReportPreview';
import { type ReportScope, ReportScopeFilters } from './ReportScopeFilters';
import type { ReportTemplate } from './ReportTemplateCard';
import { PERIOD_PRESETS, type PeriodPreset, presetRangeValues } from './report-period-presets';

export interface ReportGenerateParams {
  templateId: string;
  dateFrom: string;
  dateTo: string;
  format: 'pdf' | 'excel' | 'csv';
  /** Cash Flow only. */
  groupBy?: CashFlowGroupBy;
  walletIds?: string[];
  categoryIds?: string[];
  /** Language of the produced document; the reader's, not the server's. */
  locale?: ContractInput<'GenerateReportBody'>['locale'];
}

type CashFlowGroupBy = 'day' | 'week' | 'month';

interface ReportGeneratorProps {
  template: ReportTemplate;
  onClose: () => void;
  onGenerate: (params: ReportGenerateParams) => Promise<void>;
}

const FORMAT_OPTIONS: Array<{ value: 'pdf' | 'excel' | 'csv'; label: string }> = [
  { value: 'excel', label: 'Excel (.xlsx)' },
  { value: 'pdf', label: 'PDF (.pdf)' },
  { value: 'csv', label: 'CSV (.csv)' },
];

const GROUP_BY_OPTIONS: Array<{ value: CashFlowGroupBy; labelKey: string; fallback: string }> = [
  { value: 'day', labelKey: 'groupByDay', fallback: 'Day' },
  { value: 'week', labelKey: 'groupByWeek', fallback: 'Week' },
  { value: 'month', labelKey: 'groupByMonth', fallback: 'Month' },
];
const pillStyle = (selected: boolean): React.CSSProperties => ({
  height: 32,
  padding: '0 12px',
  border: selected ? '1px solid var(--primary)' : '1px solid var(--border)',
  background: selected ? 'var(--primary-fill)' : 'var(--card)',
  color: selected ? '#fff' : 'var(--muted-foreground)',
  fontSize: 11,
  fontWeight: 600,
  cursor: 'pointer',
  borderRadius: tokens.radius.md,
});

const fieldLabelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--muted-foreground)',
};

// eslint-disable-next-line max-lines-per-function
export function ReportGenerator({
  template,
  onClose,
  onGenerate,
}: ReportGeneratorProps): React.JSX.Element {
  const t = useIntlayer('reportsPage');
  const { locale } = useLocale();
  const labels = t.labels as Record<string, { value?: string } | undefined>;
  // eslint-disable-next-line max-params
  const text = (key: string, fallback: string): string => labels[key]?.value ?? fallback;

  const [dateFrom, setDateFrom] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [format, setFormat] = useState<'pdf' | 'excel' | 'csv'>('excel');
  const [groupBy, setGroupBy] = useState<CashFlowGroupBy>('day');
  const [generating, setGenerating] = useState(false);
  const [scope, setScope] = useState<ReportScope>({ walletIds: [], categoryIds: [] });
  const [preview, setPreview] = useState<ReportPreviewData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const showGroupBy = template.groupBy === true;
  const showScopeFilters = template.scopeFilters !== false;
  const canPreview = template.preview !== false;
  const showPeriod = template.period !== 'none';

  const applyPreset = (preset: PeriodPreset): void => {
    const [from, to] = presetRangeValues(preset);
    setDateFrom(from);
    setDateTo(to);
  };

  const availableFormats = FORMAT_OPTIONS.filter(opt =>
    template.formats.includes(opt.value as 'pdf' | 'excel' | 'csv'),
  );

  /** Single source of truth, so the preview can never describe a different file. */
  const buildParams = (): ReportGenerateParams => ({
    templateId: template.id,
    dateFrom,
    dateTo,
    format,
    // The app's locales and the server's REPORT_LOCALES are the same list.
    locale: locale as ReportGenerateParams['locale'],
    ...(showGroupBy ? { groupBy } : {}),
    ...(scope.walletIds.length ? { walletIds: scope.walletIds } : {}),
    ...(scope.categoryIds.length ? { categoryIds: scope.categoryIds } : {}),
  });

  const handlePreview = async (): Promise<void> => {
    setPreviewLoading(true);
    setPreviewError(null);

    await (async () => {
      const response = await apiClient.post(
        '/reports/preview',
        buildParams() satisfies ContractInput<'GenerateReportBody'>,
      );
      setPreview(await checkContract('ReportPreview', response.data, '/reports/preview'));
    })()
      .catch(async () => {
        setPreview(null);
        setPreviewError(text('previewFailed', 'Could not build the preview'));
      })
      .finally(async () => {
        setPreviewLoading(false);
      });
  };

  const handleGenerate = async (): Promise<void> => {
    setGenerating(true);

    await (async () => {
      await onGenerate(buildParams());
    })().finally(async () => {
      setGenerating(false);
    });
  };

  return (
    <Paper
      elevation={0}
      data-tour-id="reports-generator"
      sx={{
        mt: 3,
        borderRadius: tokens.radius.lg,
        border: '1px solid var(--border)',
        bgcolor: 'var(--card)',
        p: 3,
      }}
    >
      <Box
        sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2.5 }}
      >
        <Box>
          <Typography
            variant="body1"
            sx={{
              fontWeight: 600,
              color: 'var(--foreground)',
            }}
          >
            {template.name}
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.25, color: 'var(--muted-foreground)' }}>
            {template.description}
          </Typography>
          {template.hint && (
            <Typography
              variant="caption"
              sx={{ display: 'block', mt: 0.5, color: 'var(--muted-foreground)' }}
            >
              {template.hint}
            </Typography>
          )}
        </Box>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 4,
            color: 'var(--muted-foreground)',
          }}
        >
          <X size={16} />
        </button>
      </Box>

      {showPeriod && (
        <Box
          sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}
          data-tour-id="reports-presets"
        >
          {PERIOD_PRESETS.map(preset => (
            <button
              key={preset.labelKey}
              type="button"
              onClick={() => applyPreset(preset)}
              style={pillStyle(false)}
            >
              {text(preset.labelKey, preset.fallback)}
            </button>
          ))}
        </Box>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
          gap: 2,
          mb: 2.5,
        }}
      >
        {showPeriod && (
          <>
            <CustomDatePicker
              label={text('dateFrom', 'Date from')}
              value={dateFrom}
              onChange={setDateFrom}
            />
            <CustomDatePicker
              label={text('dateTo', 'Date to')}
              value={dateTo}
              onChange={setDateTo}
            />
          </>
        )}

        {/* Format */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          <span style={fieldLabelStyle}>{text('format', 'Format')}</span>
          <Box sx={{ display: 'flex', gap: 1 }} data-tour-id="reports-format">
            {availableFormats.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFormat(opt.value)}
                style={{
                  flex: 1,
                  height: 36,
                  border:
                    format === opt.value ? '1px solid var(--primary)' : '1px solid var(--border)',
                  background: format === opt.value ? 'var(--primary-fill)' : 'var(--card)',
                  color: format === opt.value ? '#fff' : 'var(--muted-foreground)',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  borderRadius: tokens.radius.md,
                  textTransform: 'uppercase',
                }}
              >
                {opt.value.toUpperCase()}
              </button>
            ))}
          </Box>
        </Box>
      </Box>

      {showScopeFilters && <ReportScopeFilters value={scope} onChange={setScope} />}

      {showGroupBy && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mb: 2.5 }}>
          <span style={fieldLabelStyle}>{text('groupBy', 'Group by')}</span>
          <Box sx={{ display: 'flex', gap: 1 }} data-tour-id="reports-group-by">
            {GROUP_BY_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setGroupBy(opt.value)}
                style={pillStyle(groupBy === opt.value)}
              >
                {text(opt.labelKey, opt.fallback)}
              </button>
            ))}
          </Box>
        </Box>
      )}

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Button
          variant="contained"
          onClick={handleGenerate}
          disabled={generating}
          startIcon={
            generating ? (
              <CircularProgress size={16} sx={{ color: 'inherit' }} />
            ) : (
              <Download size={16} />
            )
          }
          data-tour-id="reports-generate-button"
        >
          {generating
            ? text('generating', 'Generating…')
            : text('generateAndDownload', 'Generate & Download')}
        </Button>
        {canPreview && (
          <Button
            variant="outlined"
            onClick={handlePreview}
            disabled={generating || previewLoading}
            data-tour-id="reports-preview-button"
          >
            {text('preview', 'Preview')}
          </Button>
        )}
        <Button variant="text" onClick={onClose} disabled={generating}>
          {text('cancel', 'Cancel')}
        </Button>
      </Box>

      {canPreview && (previewLoading || previewError || preview) && (
        <ReportPreview data={preview} loading={previewLoading} error={previewError} />
      )}
    </Paper>
  );
}

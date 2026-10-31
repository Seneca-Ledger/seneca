'use client';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import type React from 'react';
import { useEffect, useState } from 'react';
import { Download } from '@/app/components/icons';
import { EmptyStateIllustration } from '@/app/components/ui/EmptyStateIllustration';
import { useIntlayer, useLocale } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { blobOf } from '@/app/lib/blob-of';
import type { ReportHistoryList } from '@/app/lib/contracts';
import { apiQueryDecoded } from '@/app/lib/query-fn-schema';
import { resolveLocaleTag } from '@/app/lib/user-format';
import { formatStoredDateWithOptions } from '@/app/lib/user-format-store';
import { tokens } from '@/lib/theme-tokens';
import { HistoryHead, ReportHistorySkeleton } from './ReportHistorySkeleton';
import { TEMPLATE_NAME_KEYS } from './report-template-names';

/** A generated report file, as `GET /reports/history` lists it. */
export type ReportHistoryItem = ReportHistoryList[number];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const FORMAT_CHIP_COLORS: Record<string, { bg: string; color: string }> = {
  excel: { bg: 'var(--color-success-soft-bg)', color: 'var(--color-success-soft-text)' },
  pdf: { bg: 'var(--color-error-soft-bg)', color: 'var(--destructive)' },
  csv: { bg: 'var(--color-info-soft-bg)', color: '#0c4a6e' },
};

export function ReportHistory(): React.JSX.Element {
  const t = useIntlayer('reportsPage');
  const { locale } = useLocale();
  const labels = t.labels as Record<string, { value?: string } | undefined>;
  const text = (key: string, fallback: string): string => labels[key]?.value ?? fallback;
  /** The stored name is English; show the template in the reader's language. */
  const templateName = (item: ReportHistoryItem): string =>
    text(TEMPLATE_NAME_KEYS[item.templateId] ?? '', item.templateName);
  const [history, setHistory] = useState<ReportHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const getRelativeTime = (isoDate: string): string => {
    const date = new Date(isoDate);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) {
      return text('justNow', 'Just now');
    }
    if (diffMins < 60) {
      return `${diffMins}${text('minutesAgo', 'm ago')}`;
    }
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) {
      return `${diffHours}${text('hoursAgo', 'h ago')}`;
    }
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) {
      return text('yesterday', 'Yesterday');
    }
    if (diffDays < 7) {
      return `${diffDays} ${text('daysAgo', 'days ago')}`;
    }

    const resolvedLocale = resolveLocaleTag(locale);
    return formatStoredDateWithOptions(date, { month: 'short', day: 'numeric' }, resolvedLocale);
  };

  const handleDownload = async (item: ReportHistoryItem): Promise<void> => {
    const response = await apiClient.get(`/reports/history/${item.id}/download`, {
      responseType: 'blob',
    });
    const blob = new Blob([blobOf(response)]);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const extension = item.format === 'excel' ? 'xlsx' : item.format;
    link.download =
      item.fileName || `${item.templateId}-${item.dateFrom}-${item.dateTo}.${extension}`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  useEffect(() => {
    apiQueryDecoded({ url: '/reports/history', contract: 'ReportHistoryList' })
      .then(setHistory)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const headers = [
    text('historyReport', 'Report'),
    text('historyPeriod', 'Period'),
    text('historyFormat', 'Format'),
    text('historyGenerated', 'Generated'),
    text('historySize', 'Size'),
    text('historyDownload', 'Download'),
  ];

  if (loading) {
    return <ReportHistorySkeleton headers={headers} />;
  }

  if (!history.length) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          py: 8,
          gap: 1.5,
        }}
      >
        <EmptyStateIllustration name="reports" size="md" />
        <Typography
          variant="body2"
          sx={{
            fontWeight: 600,
            color: 'var(--muted-foreground)',
          }}
        >
          {text('historyEmpty', 'No reports generated yet')}
        </Typography>
        <Typography variant="caption" sx={{ color: 'var(--muted-foreground)', opacity: 0.8 }}>
          {text('historyEmptyHint', 'Select a template and generate your first report.')}
        </Typography>
      </Box>
    );
  }

  return (
    <>
      {/* Mobile card list — xs only */}
      <Box
        sx={{
          display: { xs: 'flex', sm: 'none' },
          flexDirection: 'column',
          border: '1px solid var(--border)',
          bgcolor: 'var(--card)',
          borderRadius: tokens.radius.lg,
          overflow: 'hidden',
        }}
      >
        {history.map((item, idx) => {
          const chipColors = FORMAT_CHIP_COLORS[item.format];
          return (
            <Box
              key={item.id}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                px: 2,
                py: 1.5,
                borderTop: idx > 0 ? '1px solid var(--border)' : 'none',
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 500,
                    color: 'var(--foreground)',
                    mb: 0.25,
                  }}
                >
                  {templateName(item)}
                </Typography>
                <Typography variant="caption" sx={{ color: 'var(--muted-foreground)' }}>
                  {item.dateFrom} – {item.dateTo}
                </Typography>
              </Box>
              <Chip
                label={item.format.toUpperCase()}
                size="small"
                sx={{
                  fontSize: 10,
                  fontWeight: 600,
                  bgcolor: chipColors?.bg || 'var(--muted)',
                  color: chipColors?.color || 'var(--muted-foreground)',
                  height: 20,
                  borderRadius: tokens.radius.full,
                  flexShrink: 0,
                }}
              />
              <Typography
                variant="caption"
                sx={{ color: 'var(--muted-foreground)', flexShrink: 0 }}
              >
                {formatFileSize(item.fileSize)}
              </Typography>
              <IconButton
                size="small"
                onClick={() => void handleDownload(item)}
                aria-label={`Re-download ${templateName(item)}`}
                sx={{ color: 'var(--primary)', flexShrink: 0 }}
              >
                <Download size={16} />
              </IconButton>
            </Box>
          );
        })}
      </Box>

      {/* Desktop table — sm+ */}
      <Box
        sx={{
          display: { xs: 'none', sm: 'block' },
          overflowX: 'auto',
          border: '1px solid var(--border)',
          bgcolor: 'var(--card)',
          borderRadius: tokens.radius.lg,
        }}
      >
        <Table size="small" sx={{ minWidth: 480 }}>
          <HistoryHead labels={headers} />
          <TableBody>
            {history.map(item => {
              const chipColors = FORMAT_CHIP_COLORS[item.format];
              return (
                <TableRow key={item.id} hover>
                  <TableCell>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 500,
                        color: 'var(--foreground)',
                      }}
                    >
                      {templateName(item)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" sx={{ color: 'var(--muted-foreground)' }}>
                      {item.dateFrom} – {item.dateTo}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={item.format.toUpperCase()}
                      size="small"
                      sx={{
                        fontSize: 10,
                        fontWeight: 600,
                        bgcolor: chipColors?.bg || 'var(--muted)',
                        color: chipColors?.color || 'var(--muted-foreground)',
                        height: 20,
                        borderRadius: tokens.radius.full,
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant="caption"
                      sx={{ color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}
                    >
                      {getRelativeTime(item.generatedAt)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" sx={{ color: 'var(--muted-foreground)' }}>
                      {formatFileSize(item.fileSize)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => void handleDownload(item)}
                      aria-label={`Re-download ${templateName(item)}`}
                      title={`Re-download ${templateName(item)}`}
                      sx={{ color: 'var(--primary)' }}
                    >
                      <Download size={16} />
                    </IconButton>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Box>
    </>
  );
}

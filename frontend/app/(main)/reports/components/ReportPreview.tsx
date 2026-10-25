'use client';

import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import type React from 'react';
import { Fragment } from 'react';
import { PrivateAmount } from '@/app/components/ui/private-amount';
import { useIntlayer } from '@/app/i18n';
import { tokens } from '@/lib/theme-tokens';

type PreviewCell = string | number;

export interface ReportPreviewData {
  title: string;
  subtitle: string;
  sections: Array<{
    title?: string;
    columns: string[];
    rows: PreviewCell[][];
    total?: PreviewCell[];
  }>;
  /** Caveats about the figures, e.g. amounts left out for want of a rate. */
  notes?: string[];
  footer?: PreviewCell[][];
  /** Some section had more rows than the preview shows. */
  truncated: boolean;
}

interface ReportPreviewProps {
  data: ReportPreviewData | null;
  loading: boolean;
  error: string | null;
}

const cellSx = {
  padding: '6px 10px',
  fontSize: 12,
  borderBottom: '1px solid var(--border)',
  color: 'var(--foreground)',
  whiteSpace: 'nowrap' as const,
};

const headCellSx = {
  ...cellSx,
  fontWeight: 600,
  color: 'var(--muted-foreground)',
  textTransform: 'uppercase' as const,
  fontSize: 10,
  letterSpacing: '0.06em',
};

/** A figure (a number, or an amount with its currency like "12.5 EUR") is hidden in privacy mode. */
const cellNode = (cell: PreviewCell): React.ReactNode =>
  typeof cell === 'number' || /^-?[\d.,]+ [A-Z]{3}$/.test(cell) ? (
    <PrivateAmount>{String(cell)}</PrivateAmount>
  ) : (
    String(cell)
  );

/** Only the first column holds labels; everything else is a figure, so right-align it. */
const alignFor = (index: number): 'left' | 'right' => (index === 0 ? 'left' : 'right');

export function ReportPreview({
  data,
  loading,
  error,
}: ReportPreviewProps): React.JSX.Element | null {
  const t = useIntlayer('reportsPage');
  const labels = t.labels as Record<string, { value?: string } | undefined>;
  const text = (key: string, fallback: string): string => labels[key]?.value ?? fallback;

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 2 }}>
        <CircularProgress size={14} />
        <Typography variant="caption" sx={{ color: 'var(--muted-foreground)' }}>
          {text('previewLoading', 'Building preview…')}
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Typography variant="caption" sx={{ color: 'var(--destructive, #b33333)' }}>
        {error}
      </Typography>
    );
  }

  if (!data) {
    return null;
  }

  const isEmpty = data.sections.every(section => section.rows.length === 0);

  return (
    <Box
      sx={{
        mt: 1,
        border: '1px solid var(--border)',
        borderRadius: tokens.radius.md,
        bgcolor: 'var(--muted, rgba(0,0,0,0.02))',
        p: 1.5,
        maxHeight: 320,
        overflow: 'auto',
      }}
      data-tour-id="reports-preview"
    >
      <Typography variant="caption" sx={{ color: 'var(--muted-foreground)' }}>
        {data.subtitle}
      </Typography>

      {(data.notes ?? []).map(note => (
        <Typography
          key={note}
          variant="caption"
          sx={{ display: 'block', color: 'var(--color-warning-soft-text)' }}
        >
          {note}
        </Typography>
      ))}

      {isEmpty ? (
        <Typography variant="body2" sx={{ mt: 1, color: 'var(--muted-foreground)' }}>
          {text('previewEmpty', 'No data for this period and filter')}
        </Typography>
      ) : (
        data.sections.map(section => (
          <Box key={section.title ?? section.columns.join('|')} sx={{ mt: 1.5 }}>
            {section.title && (
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 600,
                  color: 'var(--foreground)',
                }}
              >
                {section.title}
              </Typography>
            )}
            <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', mt: 0.5 }}>
              <thead>
                <tr>
                  {section.columns.map((column, index) => (
                    <Box
                      component="th"
                      key={column}
                      sx={{ ...headCellSx, textAlign: alignFor(index) }}
                    >
                      {column}
                    </Box>
                  ))}
                </tr>
              </thead>
              <tbody>
                {section.rows.map((row, rowIndex) => (
                  // Rows are positional slices of a generated document; there is no id.
                  // biome-ignore lint/suspicious/noArrayIndexKey: rows have no stable identity
                  <tr key={rowIndex}>
                    {row.map((cell, cellIndex) => (
                      <Box
                        component="td"
                        key={section.columns[cellIndex] ?? cellIndex}
                        sx={{ ...cellSx, textAlign: alignFor(cellIndex) }}
                      >
                        {cellNode(cell)}
                      </Box>
                    ))}
                  </tr>
                ))}
                {section.total && (
                  <tr>
                    {section.total.map((cell, cellIndex) => (
                      <Box
                        component="td"
                        key={section.columns[cellIndex] ?? cellIndex}
                        sx={{ ...cellSx, fontWeight: 700, textAlign: alignFor(cellIndex) }}
                      >
                        {cellNode(cell)}
                      </Box>
                    ))}
                  </tr>
                )}
              </tbody>
            </Box>
          </Box>
        ))
      )}

      {data.footer?.map(line => (
        <Typography
          key={String(line[0])}
          variant="body2"
          sx={{
            fontWeight: 700,
            mt: 1,
            color: 'var(--foreground)',
          }}
        >
          {line.map((cell, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: a fixed label-and-figures line
            <Fragment key={index}>
              {index > 0 ? '  ' : null}
              {cellNode(cell)}
            </Fragment>
          ))}
        </Typography>
      ))}

      {data.truncated && (
        <Typography
          variant="caption"
          sx={{ display: 'block', mt: 1, color: 'var(--muted-foreground)' }}
        >
          {text('previewTruncated', 'Preview shows the first rows; the file contains everything.')}
        </Typography>
      )}
    </Box>
  );
}

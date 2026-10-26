'use client';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import type React from 'react';
import type { LucideIcon } from '@/app/components/icons';
import { tokens } from '@/lib/theme-tokens';

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  category: 'financial' | 'operational' | 'tax';
  formats: Array<'pdf' | 'excel' | 'csv'>;
  /** 'none' for a snapshot of today, where a date range means nothing. Defaults to 'range'. */
  period?: 'range' | 'none';
  /** Wallet and category filters; off for documents that are not a transaction query. */
  scopeFilters?: boolean;
  /** The day / week / month bucket picker. */
  groupBy?: boolean;
  /** Whether the on-screen preview is offered. Defaults to true. */
  preview?: boolean;
  /** A line under the description, e.g. a limit on the period. */
  hint?: string;
}

interface ReportTemplateCardProps {
  template: ReportTemplate;
  onSelect: (template: ReportTemplate) => void;
  isSelected?: boolean;
}

export function ReportTemplateCard({
  template,
  onSelect,
  isSelected,
}: ReportTemplateCardProps): React.JSX.Element {
  return (
    <Paper
      data-tour-id={template.id === 'pnl' ? 'reports-template-pnl' : undefined}
      onClick={() => onSelect(template)}
      elevation={0}
      sx={{
        cursor: 'pointer',
        borderRadius: tokens.radius.lg,
        border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border)',
        bgcolor: 'var(--card)',
        p: 2.5,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        transition: 'border-color 0.2s',
        '&:hover': {
          borderColor: 'var(--primary)',
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 40,
            height: 40,
            borderRadius: tokens.radius.sm,
            bgcolor: 'var(--primary-light, rgba(var(--primary-rgb, 22,129,24),0.1))',
            color: 'var(--primary)',
            flexShrink: 0,
          }}
        >
          <template.icon size={20} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              color: 'var(--foreground)',
              lineHeight: 1.3,
            }}
          >
            {template.name}
          </Typography>
          <Typography
            variant="caption"
            sx={{ color: 'var(--muted-foreground)', lineHeight: 1.4, display: 'block', mt: 0.25 }}
          >
            {template.description}
          </Typography>
        </Box>
      </Box>
      <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
        {template.formats.map(f => (
          <Box
            key={f}
            component="span"
            sx={{
              bgcolor: 'var(--muted)',
              color: 'var(--muted-foreground)',
              px: 1,
              py: 0.25,
              fontSize: 10,
              fontWeight: 500,
              textTransform: 'uppercase',
              borderRadius: tokens.radius.xs,
            }}
          >
            {f}
          </Box>
        ))}
      </Box>
    </Paper>
  );
}

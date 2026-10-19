'use client';

import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { alpha, type SxProps, type Theme } from '@mui/material/styles';
import type React from 'react';
import { type ReactNode, useState } from 'react';
import { useIntlayer, useLocale } from '@/app/i18n';
import { formatMoney } from '@/app/lib/format-money';
import { tokens } from '@/lib/theme-tokens';
import { formatLineRef } from '../tax-declaration.helpers';
import type { DraftFigure, IncomeTaxDraft } from '../tax-declaration.types';
import { AccuracyBanner } from './AccuracyBanner';

/**
 * Lines between rows are only just there, so fifteen rows read as a list rather
 * than a stack of stripes; rows get a little more height instead, and the whole
 * row lights up faintly under the pointer. The header keeps a normal divider.
 */
const FIGURES_TABLE_SX = {
  '& .MuiTableBody-root .MuiTableCell-root': {
    py: 1.25,
    borderBottomColor: (theme: Theme) => alpha(theme.palette.text.primary, 0.04),
  },
  '& .MuiTableHead-root .MuiTableCell-root': { borderBottomColor: 'divider' },
  '& .MuiTableBody-root .MuiTableRow-root': { transition: 'background-color 120ms ease' },
  '& .MuiTableBody-root .MuiTableRow-root:hover': {
    bgcolor: (theme: Theme) => alpha(theme.palette.text.primary, 0.05),
  },
} satisfies SxProps<Theme>;

/** A zero amount stays for completeness but recedes, so the filled lines stand out. */
function amountSx(value: number) {
  return { whiteSpace: 'nowrap', opacity: value === 0 ? 0.3 : 1 } as const;
}

function warningKey(warning: IncomeTaxDraft['warnings'][number]): string {
  return `${warning.code}-${warning.lineKey ?? ''}-${String(warning.params?.recipient ?? '')}`;
}

export function DraftStep({ draft }: { draft: IncomeTaxDraft }): React.ReactElement {
  const t = useIntlayer('taxDeclarationPage');
  const { locale } = useLocale();
  const [openFigure, setOpenFigure] = useState<DraftFigure | null>(null);
  const warningLabels = t.warnings as unknown as Record<string, ReactNode>;
  const money = (value: number, currency = draft.currency): string =>
    formatMoney(value, currency, locale);
  const fxNotes: Record<string, ReactNode> = {
    nbp_previous_business_day: t.fxNbp,
    bdi_reference_rate: t.fxBdi,
  };

  const resultFigure = draft.figures.find(figure => figure.section === 'result');
  const contributions = openFigure ? (draft.contributions[openFigure.key] ?? []) : [];

  return (
    <Stack spacing={2.5}>
      <Box>
        <Typography sx={{ fontSize: 18, fontWeight: 600 }}>
          {draft.pack.name} · {draft.country.name} · {draft.taxYear}
        </Typography>
        {draft.pack.isGeneric ? (
          <Alert severity="info" sx={{ mt: 1 }}>
            {t.genericNotice}
          </Alert>
        ) : null}
      </Box>

      {/* One notice: the standing accuracy caveat plus this draft's own warnings. */}
      <AccuracyBanner
        notes={draft.warnings.map(warning => (
          <span key={warningKey(warning)}>
            {warningLabels[warning.code] ?? warning.code}
            {warning.params?.recipient ? ` (${String(warning.params.recipient)})` : ''}
          </span>
        ))}
      />

      <Box sx={{ overflowX: 'auto' }}>
        <Table size="small" sx={FIGURES_TABLE_SX}>
          <TableHead>
            <TableRow>
              <TableCell>{t.draftLine}</TableCell>
              <TableCell>{t.draftDescription}</TableCell>
              <TableCell align="right">{t.draftBooked}</TableCell>
              <TableCell align="right">{t.draftDeductible}</TableCell>
              <TableCell align="right">{t.transactionsLabel}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {draft.figures.map(figure => {
              const emphasis = figure.section === 'total' || figure.section === 'result';
              return (
                <TableRow
                  key={figure.key}
                  sx={{
                    // A neutral tint: action.hover is brand green in this theme.
                    bgcolor: theme =>
                      figure.section === 'result'
                        ? alpha(theme.palette.text.primary, 0.04)
                        : undefined,
                    '& td': { fontWeight: emphasis ? 600 : 400 },
                  }}
                >
                  {/* The line number is a reference, not the headline: muted and
                      as narrow as it can be, so the description reads first. */}
                  <TableCell
                    sx={{
                      width: '1%',
                      whiteSpace: 'nowrap',
                      pr: 1,
                      fontSize: 13,
                      color: 'text.secondary',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {formatLineRef(figure.lineNo, figure.fieldNo)}
                  </TableCell>
                  <TableCell>{figure.label}</TableCell>
                  <TableCell align="right" sx={amountSx(figure.amount)}>
                    {money(figure.amount)}
                  </TableCell>
                  <TableCell align="right" sx={amountSx(figure.deductible)}>
                    {money(figure.deductible)}
                  </TableCell>
                  <TableCell align="right">
                    {/* Counts open the line's transactions but stay neutral: the money
                        columns carry the emphasis. Empty lines fade their dash further. */}
                    {figure.transactionCount > 0 ? (
                      <Button
                        size="small"
                        onClick={() => setOpenFigure(figure)}
                        sx={{
                          minWidth: 0,
                          // No vertical padding, so rows with a count are as tall as rows without.
                          py: 0,
                          lineHeight: 1.5,
                          color: 'text.secondary',
                          fontWeight: 500,
                          '&:hover': { color: 'primary.main', bgcolor: 'transparent' },
                        }}
                      >
                        {figure.transactionCount}
                      </Button>
                    ) : (
                      <Box component="span" sx={{ opacity: 0.3 }}>
                        —
                      </Box>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Box>

      {resultFigure ? (
        // The figure the whole form comes down to, kept in view while scrolling the lines.
        <Box
          sx={{
            position: 'sticky',
            bottom: 0,
            zIndex: 1,
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 2,
            py: 1.5,
            px: 2,
            bgcolor: 'background.default',
            // The one line the page keeps: a thin green rule that fades out, setting
            // the result apart from the list above it.
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '1px',
              background: theme =>
                `linear-gradient(90deg, ${alpha(theme.palette.primary.main, 0.6)}, ${alpha(theme.palette.primary.main, 0)})`,
            },
          }}
        >
          <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>
            {resultFigure.label}
          </Typography>
          <Typography
            sx={{
              fontSize: 24,
              fontWeight: 600,
              letterSpacing: '-0.02em',
              fontVariantNumeric: 'tabular-nums',
              whiteSpace: 'nowrap',
            }}
          >
            {money(resultFigure.deductible)}
          </Typography>
        </Box>
      ) : null}

      <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
        {fxNotes[draft.fxRule ?? 'transaction_date'] ?? t.fxTransactionDate}
      </Typography>

      {draft.taxEstimate ? (
        <Box
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: tokens.radius.md,
            p: 2,
            maxWidth: 720,
          }}
        >
          <Typography sx={{ fontSize: 16, fontWeight: 600 }}>
            {t.estimateTitle}: {money(draft.taxEstimate.amount)}
          </Typography>
          <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 0.5 }}>
            {draft.taxEstimate.basis}
          </Typography>
          <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 0.5 }}>
            {t.estimateNotIncluded} {draft.taxEstimate.excludes.join('; ')}
          </Typography>
        </Box>
      ) : null}

      <Dialog
        open={openFigure !== null}
        onClose={() => setOpenFigure(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {t.lineTransactionsTitle}: {openFigure?.label}
        </DialogTitle>
        <DialogContent sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t.colDate}</TableCell>
                <TableCell>{t.colCounterparty}</TableCell>
                <TableCell align="right">{t.colAmount}</TableCell>
                <TableCell align="right">{draft.currency}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {contributions.map(row => (
                <TableRow key={row.transactionId}>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.date}</TableCell>
                  <TableCell>{row.counterparty}</TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    {money(row.amount, row.currency)}
                  </TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    {money(row.amountConverted)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenFigure(null)}>{t.close}</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

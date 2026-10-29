'use client';

import {
  Box,
  Chip,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useTheme } from 'next-themes';
import { useIntlayer } from '@/app/i18n';
import type { ParserHealthBank } from '@/app/lib/contracts';
import { formatStoredDate } from '@/app/lib/user-format-store';
import { tokens } from '@/lib/theme-tokens';
import { resolveBankLogo } from '../../../bank-logos';

/** The headings of one layout, a line per table header, in the type of code. */
function Headings({ lines }: { lines: readonly string[] }): React.ReactElement {
  return (
    <Stack spacing={0.25}>
      {lines.map(line => (
        <Typography
          key={line}
          variant="caption"
          sx={{ fontFamily: 'monospace', wordBreak: 'break-word' }}
        >
          {line}
        </Typography>
      ))}
    </Stack>
  );
}

/** The theme's colours this card paints with, light or dark. */
type Colors = Record<
  'warning' | 'warningSoft' | 'danger' | 'textSecondary' | 'surfaceMuted',
  string
>;
type Labels = ReturnType<typeof useIntlayer<'adminParsingPage'>>;

/** How many statements, and how many of them held for review, failed or declined. */
function Counts({
  bank,
  t,
  c,
}: {
  bank: ParserHealthBank;
  t: Labels;
  c: Colors;
}): React.ReactElement {
  const counts: [string, number, string | undefined][] = [
    [t.statements.value, bank.statements, undefined],
    [t.needsReview.value, bank.needsReview, bank.needsReview > 0 ? c.warning : undefined],
    [t.errors.value, bank.errors, bank.errors > 0 ? c.danger : undefined],
    [t.declined.value, bank.declined, bank.declined > 0 ? c.warning : undefined],
  ];
  return (
    <Stack direction="row" spacing={3} sx={{ mt: 1, flexWrap: 'wrap' }}>
      {counts.map(([label, value, color]) => (
        <Box key={label}>
          <Typography variant="caption" sx={{ color: c.textSecondary }}>
            {label}
          </Typography>
          <Typography
            variant="body1"
            sx={{ fontWeight: 600, color, fontVariantNumeric: 'tabular-nums' }}
          >
            {value}
          </Typography>
        </Box>
      ))}
    </Stack>
  );
}

function Reasons({
  bank,
  t,
  c,
}: {
  bank: ParserHealthBank;
  t: Labels;
  c: Colors;
}): React.ReactElement | null {
  if (bank.reasons.length === 0) {
    return null;
  }
  return (
    <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
      <Typography variant="caption" sx={{ color: c.textSecondary }}>
        {t.reasons}
      </Typography>
      {bank.reasons.map(reason => (
        <Chip
          key={reason.code}
          size="small"
          label={`${reason.code} · ${reason.count}`}
          sx={{ fontFamily: 'monospace', bgcolor: c.surfaceMuted }}
        />
      ))}
    </Stack>
  );
}

/** The layouts the bank's files came in; one seen for the first time is marked new. */
function Layouts({
  bank,
  t,
  c,
}: {
  bank: ParserHealthBank;
  t: Labels;
  c: Colors;
}): React.ReactElement | null {
  if (bank.layouts.length === 0) {
    return null;
  }
  return (
    <Box sx={{ mt: 2, overflowX: 'auto' }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>{t.headings}</TableCell>
            <TableCell>{t.parser}</TableCell>
            <TableCell align="right">{t.statements}</TableCell>
            <TableCell>{t.firstSeen}</TableCell>
            <TableCell>{t.lastSeen}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {bank.layouts.map(layout => (
            <TableRow key={layout.fingerprint}>
              <TableCell>
                {layout.isNew ? (
                  <Chip
                    size="small"
                    label={t.newLayout}
                    sx={{ mb: 0.5, color: c.warning, bgcolor: c.warningSoft, fontWeight: 600 }}
                  />
                ) : null}
                <Headings lines={layout.headings} />
                {layout.unknownWords.length > 0 ? (
                  <Typography
                    variant="caption"
                    sx={{ display: 'block', mt: 0.5, color: c.textSecondary }}
                  >
                    {t.unknownWords}: {layout.unknownWords.join(', ')}
                  </Typography>
                ) : null}
              </TableCell>
              <TableCell sx={{ fontFamily: 'monospace' }}>{layout.parser}</TableCell>
              <TableCell align="right">{layout.statements}</TableCell>
              <TableCell>{formatStoredDate(layout.firstSeen)}</TableCell>
              <TableCell>{formatStoredDate(layout.lastSeen)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}

/**
 * One bank's parse outcomes over the window, and the layouts its files came
 * in: a layout seen for the first time is how a bank's new format shows up.
 */
export function ParserHealthBankCard({ bank }: { bank: ParserHealthBank }): React.ReactElement {
  const t = useIntlayer('adminParsingPage');
  const { resolvedTheme } = useTheme();
  const c = resolvedTheme === 'dark' ? tokens.dark.color : tokens.color;
  const name = bank.bank === 'other' ? t.otherBank.value : resolveBankLogo(bank.bank).displayName;
  return (
    <Paper variant="outlined" sx={{ p: 2, borderColor: c.border, borderRadius: tokens.radius.md }}>
      <Typography variant="h6" component="h2">
        {name}
      </Typography>
      <Counts bank={bank} t={t} c={c} />
      <Reasons bank={bank} t={t} c={c} />
      <Layouts bank={bank} t={t} c={c} />
    </Paper>
  );
}

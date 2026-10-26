'use client';

import { Box, Chip, Link as MuiLink, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import type React from 'react';
import { type ReactNode, useState } from 'react';
import {
  BookOpen,
  CalendarClock,
  FileText,
  Landmark,
  type LucideIcon,
  Mail,
  ReceiptText,
  Scale,
} from '@/app/components/icons';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/app/components/ui/card';
import { useIntlayer, useLocale } from '@/app/i18n';
import { formatFilingDate, isDeadlinePassed } from '../filing-info.helpers';
import type { FilingInfo } from '../tax-declaration.types';

/** One icon per retention kind, so the list reads at a glance instead of as a wall of text. */
const RETENTION_ICONS: Record<string, LucideIcon> = {
  booking_documents: ReceiptText,
  books_and_records: BookOpen,
  other_business_documents: Mail,
  tax_records: Scale,
  commercial_books: Landmark,
  accounting_records: FileText,
};

/** An ochre dot and a word: the status that matters most on the card. */
function PassedMark({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        fontSize: 13,
        fontWeight: 500,
        color: 'text.primary',
        '&::before': {
          content: '""',
          width: 7,
          height: 7,
          borderRadius: '50%',
          bgcolor: 'var(--attention)',
        },
      }}
    >
      {children}
    </Box>
  );
}

function DateRow({
  icon: Icon,
  label,
  date,
  badge,
}: {
  icon: LucideIcon;
  label: React.ReactNode;
  date: string;
  badge?: React.ReactNode;
}): React.ReactElement {
  return (
    <Stack
      direction="row"
      spacing={1.5}
      sx={{
        alignItems: 'center',
        py: 1,
        borderBottom: '1px solid var(--border)',
        '&:last-of-type': { borderBottom: 'none' },
      }}
    >
      <Icon size={16} sx={{ color: 'text.secondary', flexShrink: 0 }} />
      <Typography sx={{ fontSize: 14, flexGrow: 1 }}>{label}</Typography>
      {badge}
      <Typography sx={{ fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap' }}>{date}</Typography>
    </Stack>
  );
}

/**
 * Form, deadlines and portal for the country and year, from verified entries
 * only. Where the authority prepares the return itself, that is said up front:
 * the draft is then something to check the authority's figures against.
 */
export function FilingInfoCard({
  info,
  chosenForm,
}: {
  info: FilingInfo;
  /** The form that applies to the taxpayer's chosen method; the others fold away. */
  chosenForm?: { code: string; label: ReactNode };
}): React.ReactElement {
  const t = useIntlayer('taxDeclarationPage');
  const { locale } = useLocale();
  const [otherFormsOpen, setOtherFormsOpen] = useState(false);
  const allForms = info.formName.split('/').map(form => form.trim());
  const otherForms = chosenForm ? allForms.filter(form => form !== chosenForm.code) : [];
  const kindLabels = t.deadlineKinds as unknown as Record<string, ReactNode>;
  const preparationLabels = t.authority as unknown as Record<string, ReactNode>;
  const retentionLabels = t.retentionKinds as unknown as Record<string, ReactNode>;
  // The earliest deadline still ahead; deadlines are not guaranteed to arrive sorted.
  const nextDeadline = [...info.deadlines]
    .filter(deadline => !isDeadlinePassed(deadline.date))
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  // Every deadline behind us: say so first, with what can still be done.
  const lastPassed =
    info.deadlines.length > 0 && !nextDeadline
      ? [...info.deadlines].sort((a, b) => b.date.localeCompare(a.date))[0]
      : null;

  return (
    <Card>
      <CardHeader style={{ padding: 16, paddingBottom: 8 }}>
        <CardTitle>{t.importantDatesCardTitle}</CardTitle>
        <CardDescription style={{ marginTop: 4 }}>
          {t.filingTitle}: {chosenForm ? chosenForm.label : info.formName}
        </CardDescription>
        {otherForms.length > 0 ? (
          <Box sx={{ mt: 0.5 }}>
            <Box
              component="button"
              type="button"
              aria-expanded={otherFormsOpen}
              onClick={() => setOtherFormsOpen(open => !open)}
              sx={{
                p: 0,
                border: 0,
                background: 'none',
                font: 'inherit',
                fontSize: 13,
                color: 'var(--primary)',
                cursor: 'pointer',
              }}
            >
              {t.otherForms}
            </Box>
            {otherFormsOpen ? (
              <Typography sx={{ fontSize: 13, color: 'var(--text-muted)' }}>
                {otherForms.join(' · ')}
              </Typography>
            ) : null}
          </Box>
        ) : null}
      </CardHeader>
      <CardContent style={{ paddingTop: 0 }}>
        <Stack spacing={2.5}>
          {lastPassed ? (
            <PassedMark>
              {t.deadlinePassedLate.value.replace(
                '{date}',
                formatFilingDate(lastPassed.date, locale),
              )}
            </PassedMark>
          ) : null}

          {info.filingOpens ? (
            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
              {t.filingOpens} {formatFilingDate(info.filingOpens, locale)}
            </Typography>
          ) : null}

          {info.deadlines.length === 0 ? (
            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
              {t.noVerifiedDeadline}
            </Typography>
          ) : null}

          <Stack spacing={0}>
            {info.deadlines.map(deadline => (
              <DateRow
                key={`${deadline.kind}-${deadline.date}`}
                icon={CalendarClock}
                label={kindLabels[deadline.kind] ?? deadline.kind}
                date={formatFilingDate(deadline.date, locale)}
                badge={
                  deadline === nextDeadline ? (
                    // The one to act on, outlined in calm green: there is still time.
                    <Chip
                      size="small"
                      variant="outlined"
                      label={t.deadlineNext.value}
                      sx={{
                        borderColor: theme => alpha(theme.palette.primary.main, 0.5),
                        color: 'primary.main',
                        bgcolor: 'transparent',
                        fontWeight: 500,
                      }}
                    />
                  ) : isDeadlinePassed(deadline.date) ? (
                    <PassedMark>{t.deadlinePassed}</PassedMark>
                  ) : undefined
                }
              />
            ))}
          </Stack>

          {info.portal ? (
            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
              {t.portalLabel}: {info.portal}
            </Typography>
          ) : null}

          {info.retention ? (
            <Box>
              <Typography sx={{ fontSize: 14, fontWeight: 600, mb: 0.5 }}>
                {t.retentionTitle}
              </Typography>
              <Stack spacing={0}>
                {info.retention.periods.map(period => (
                  <DateRow
                    key={period.kind}
                    icon={RETENTION_ICONS[period.kind] ?? FileText}
                    label={retentionLabels[period.kind] ?? period.kind}
                    date={formatFilingDate(period.until, locale)}
                  />
                ))}
              </Stack>
              <MuiLink
                href={info.retention.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ fontSize: 12, display: 'inline-block', mt: 1 }}
              >
                {t.retentionSourceLabel}
              </MuiLink>
            </Box>
          ) : null}

          {/* A footnote, not an alert: a quiet panel without a blue icon. */}
          {info.authorityPreparation ? (
            <Box
              sx={{
                bgcolor: 'var(--surface-soft)',
                borderRadius: 1.5,
                px: 1.75,
                py: 1.25,
                fontSize: 13,
                color: 'var(--text-muted)',
              }}
            >
              {preparationLabels[info.authorityPreparation]}
            </Box>
          ) : null}

          {/* When the dates were checked and where they come from, on one line. */}
          <Typography sx={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {info.basis && info.checkedAt ? (
              <>
                {(info.basis === 'statute' ? t.basisStatute : t.basisPublished).value.replace(
                  '{date}',
                  formatFilingDate(info.checkedAt, locale),
                )}{' '}
                ·{' '}
              </>
            ) : null}
            <MuiLink href={info.sourceUrl} target="_blank" rel="noopener noreferrer">
              {t.sourceLabel}
            </MuiLink>
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}

'use client';

import { Alert, Box, Chip, Link as MuiLink, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import type React from 'react';
import type { ReactNode } from 'react';
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

function DateRow({
  icon: Icon,
  label,
  date,
  badge,
  muted = false,
}: {
  icon: LucideIcon;
  label: React.ReactNode;
  date: string;
  badge?: React.ReactNode;
  /** A date already behind us: kept for reference, pushed into the background. */
  muted?: boolean;
}): React.ReactElement {
  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1.5}
      sx={{
        py: 1,
        opacity: muted ? 0.55 : 1,
        borderBottom: '1px solid var(--border)',
        '&:last-of-type': { borderBottom: 'none' },
      }}
    >
      <Icon size={16} sx={{ color: 'text.secondary', flexShrink: 0 }} />
      <Typography sx={{ fontSize: 14, flexGrow: 1 }}>{label}</Typography>
      {badge}
      <Typography sx={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap' }}>{date}</Typography>
    </Stack>
  );
}

/**
 * Form, deadlines and portal for the country and year, from verified entries
 * only. Where the authority prepares the return itself, that is said up front:
 * the draft is then something to check the authority's figures against.
 */
export function FilingInfoCard({ info }: { info: FilingInfo }): React.ReactElement {
  const t = useIntlayer('taxDeclarationPage');
  const { locale } = useLocale();
  const kindLabels = t.deadlineKinds as unknown as Record<string, ReactNode>;
  const preparationLabels = t.authority as unknown as Record<string, ReactNode>;
  const retentionLabels = t.retentionKinds as unknown as Record<string, ReactNode>;
  // The earliest deadline still ahead; deadlines are not guaranteed to arrive sorted.
  const nextDeadline = [...info.deadlines]
    .filter(deadline => !isDeadlinePassed(deadline.date))
    .sort((a, b) => a.date.localeCompare(b.date))[0];

  return (
    <Card>
      <CardHeader style={{ padding: 16, paddingBottom: 8 }}>
        <CardTitle>{t.importantDatesCardTitle}</CardTitle>
        <CardDescription style={{ marginTop: 4 }}>
          {t.filingTitle}: {info.formName}
        </CardDescription>
      </CardHeader>
      <CardContent style={{ paddingTop: 0 }}>
        <Stack spacing={2.5}>
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
                muted={isDeadlinePassed(deadline.date)}
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
                    <Chip
                      size="small"
                      label={t.deadlinePassed.value}
                      sx={{
                        // A literal neutral wash, not `action.hover`/`action.selected`: those are
                        // themed to a brand-green tint app-wide, which is exactly what a "passed"
                        // status pill should not look like.
                        bgcolor: theme => alpha(theme.palette.text.secondary, 0.12),
                        color: 'text.secondary',
                        fontWeight: 500,
                      }}
                    />
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

          {info.authorityPreparation ? (
            <Alert severity="info">{preparationLabels[info.authorityPreparation]}</Alert>
          ) : null}

          <Box>
            {info.basis && info.checkedAt ? (
              <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>
                {(info.basis === 'statute' ? t.basisStatute : t.basisPublished).value.replace(
                  '{date}',
                  formatFilingDate(info.checkedAt, locale),
                )}
              </Typography>
            ) : null}
            <MuiLink
              href={info.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ fontSize: 12, alignSelf: 'flex-start' }}
            >
              {t.sourceLabel}
            </MuiLink>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

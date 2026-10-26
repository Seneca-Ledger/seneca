'use client';

import { Box, Button, Stack, Typography } from '@mui/material';
import Link from 'next/link';
import type React from 'react';
import type { ReactNode } from 'react';
import { Check } from '@/app/components/icons';
import { useIntlayer, useLocale } from '@/app/i18n';
import { useCategoryName } from '@/app/lib/use-category-name';
import { issueTarget, type StepKey } from '../tax-declaration.helpers';
import type { CompletenessIssue, CompletenessReport, IssueCode } from '../tax-declaration.types';

/** The checks every year goes through, listed even when they pass: that is what makes a clean result believable. */
const CHECKED: IssueCode[] = [
  'uncategorized_transactions',
  'unmapped_categories',
  'missing_exchange_rates',
  'statement_coverage_gaps',
];

/** Under this share of days with anything recorded, the row gets a soft ochre mark. */
const ACTIVE_DAYS_NOTICE = 0.9;

function monthName(month: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'short' }).format(new Date(2000, month - 1, 1));
}

/** The specifics behind an issue: which accounts miss which months, which categories, which currencies. */
function IssueDetails({ issue }: { issue: CompletenessIssue }): React.ReactElement | null {
  const { locale } = useLocale();
  const categoryName = useCategoryName();
  const params = issue.params ?? {};

  if (issue.code === 'statement_coverage_gaps') {
    const accounts = (params.accounts ?? []) as Array<{ account: string; months: number[] }>;
    return (
      <Typography sx={{ fontSize: 13, color: 'var(--text-muted)' }}>
        {accounts
          .map(
            account =>
              `${account.account}: ${account.months.map(month => monthName(month, locale)).join(', ')}`,
          )
          .join(' · ')}
      </Typography>
    );
  }
  if (issue.code === 'unmapped_categories') {
    const categories = (params.categories ?? []) as Array<{
      name: string;
      transactionCount: number;
    }>;
    return (
      <Typography sx={{ fontSize: 13, color: 'var(--text-muted)' }}>
        {categories
          .map(category => `${categoryName(category.name)} (${category.transactionCount})`)
          .join(', ')}
      </Typography>
    );
  }
  if (issue.code === 'missing_exchange_rates') {
    return (
      <Typography sx={{ fontSize: 13, color: 'var(--text-muted)' }}>
        {((params.currencies ?? []) as string[]).join(', ')}
      </Typography>
    );
  }
  return null;
}

/** A sage tick for a check that passed; a dot for one that did not (terracotta when it distorts the totals). */
function Mark({ state }: { state: 'ok' | 'notice' | 'critical' }): React.ReactElement {
  if (state === 'ok') {
    return <Check size={16} style={{ color: 'var(--money-up)' }} aria-hidden />;
  }
  return (
    <Box
      aria-hidden
      sx={{
        width: 7,
        height: 7,
        m: '0 4.5px',
        borderRadius: '50%',
        bgcolor: state === 'critical' ? 'var(--money-down)' : 'var(--attention)',
      }}
    />
  );
}

function CheckRow({
  state,
  label,
  value,
  children,
  action,
}: {
  state: 'ok' | 'notice' | 'critical';
  label: ReactNode;
  value: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
}): React.ReactElement {
  return (
    <Box
      component="li"
      sx={{
        display: 'grid',
        gridTemplateColumns: '24px minmax(0, 1fr) auto',
        alignItems: 'start',
        columnGap: 1,
        py: 1.25,
        borderTop: '1px solid var(--border)',
      }}
    >
      <Box sx={{ height: 21, display: 'flex', alignItems: 'center' }}>
        <Mark state={state} />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 14 }}>{label}</Typography>
        {children}
        {action}
      </Box>
      <Typography sx={{ fontSize: 14, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </Typography>
    </Box>
  );
}

interface DataCheckStepProps {
  completeness: CompletenessReport;
  onGoToStep: (step: StepKey) => void;
}

/**
 * The year's data against what distorts a declaration. The score, then every
 * check that was run with its count, passed or not, so a clean result shows
 * what it rests on; anything else found comes after. Back and Next lead on
 * through the steps.
 */
export function DataCheckStep({
  completeness,
  onGoToStep,
}: DataCheckStepProps): React.ReactElement {
  const t = useIntlayer('taxDeclarationPage');
  const issueLabels = t.issues as unknown as Record<IssueCode, ReactNode>;
  const byCode = new Map(completeness.issues.map(issue => [issue.code, issue]));
  const others = completeness.issues.filter(
    issue => !CHECKED.includes(issue.code) && issue.code !== 'irregular_tracking',
  );
  const activeDays = completeness.activeDaysRatio;

  const fixButton = (issue: CompletenessIssue): ReactNode => {
    const target = issueTarget(issue.code);
    const sx = { p: 0, minWidth: 0, mt: 0.25, fontWeight: 500, textTransform: 'none' } as const;
    if (target?.kind === 'route') {
      return (
        <Button component={Link} href={target.href} size="small" variant="text" sx={sx}>
          {t.fixAction}
        </Button>
      );
    }
    if (target?.kind === 'step') {
      return (
        <Button size="small" variant="text" sx={sx} onClick={() => onGoToStep(target.step)}>
          {t.fixAction}
        </Button>
      );
    }
    return undefined;
  };

  const issueState = (issue: CompletenessIssue): 'notice' | 'critical' =>
    issue.severity === 'critical' ? 'critical' : 'notice';

  return (
    <Stack spacing={3}>
      {/* A good score is the norm, not news: ink, not green. */}
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
        <Typography
          sx={{ fontSize: 40, fontWeight: 500, lineHeight: 1, color: 'var(--foreground)' }}
        >
          {completeness.score}
        </Typography>
        <Typography sx={{ color: 'var(--text-muted)' }}>/ 100 · {t.completenessLabel}</Typography>
      </Box>

      {/* What distorts the draft is explained only when something does. */}
      {completeness.issues.length > 0 ? (
        <Typography sx={{ fontSize: 14, color: 'var(--text-muted)' }}>{t.dataIntro}</Typography>
      ) : null}

      <Box>
        <Typography component="h2" sx={{ fontSize: 15, fontWeight: 500, mb: 1 }}>
          {t.checksTitle}
        </Typography>
        <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {CHECKED.map(code => {
            const issue = byCode.get(code);
            return (
              <CheckRow
                key={code}
                state={issue ? issueState(issue) : 'ok'}
                label={issueLabels[code] ?? code}
                value={issue?.count ?? 0}
                action={issue ? fixButton(issue) : undefined}
              >
                {issue ? <IssueDetails issue={issue} /> : null}
              </CheckRow>
            );
          })}
          {activeDays !== null ? (
            <CheckRow
              state={activeDays < ACTIVE_DAYS_NOTICE ? 'notice' : 'ok'}
              label={t.checkActiveDays}
              value={`${Math.round(activeDays * 100)}%`}
            >
              {activeDays < ACTIVE_DAYS_NOTICE ? (
                <Typography sx={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  {t.checkActiveDaysHint}
                </Typography>
              ) : null}
            </CheckRow>
          ) : null}
          {others.map(issue => (
            <CheckRow
              key={issue.code}
              state={issueState(issue)}
              label={issueLabels[issue.code] ?? issue.code}
              value={issue.count}
              action={fixButton(issue)}
            >
              <IssueDetails issue={issue} />
            </CheckRow>
          ))}
        </Box>
      </Box>

      {completeness.issues.length === 0 ? (
        <Box
          role="status"
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 1.75,
            py: 1.25,
            borderRadius: 1.5,
            bgcolor: 'var(--primary-50)',
            color: 'var(--foreground)',
            fontSize: 14,
          }}
        >
          <Check size={16} style={{ color: 'var(--money-up)', flexShrink: 0 }} aria-hidden />
          {t.noIssues}
        </Box>
      ) : null}

      <Stack direction="row" spacing={1}>
        <Button
          variant="outlined"
          onClick={() => onGoToStep('profile')}
          sx={{ textTransform: 'none', fontWeight: 500 }}
        >
          {t.back}
        </Button>
        <Button
          variant="contained"
          onClick={() => onGoToStep('mapping')}
          sx={{ textTransform: 'none', fontWeight: 500 }}
        >
          {t.nextToStep.value.replace('{step}', t.stepMapping.value)}
        </Button>
      </Stack>
    </Stack>
  );
}

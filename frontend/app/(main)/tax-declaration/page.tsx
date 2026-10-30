'use client';

import {
  Alert,
  Box,
  LinearProgress,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type React from 'react';
import { Suspense } from 'react';
import { sharedMuiTabsSx } from '@/app/components/ui/mui-tabs';
import { joinSummary, PageTitle } from '@/app/components/ui/page-title';
import { SnapshotSkeleton } from '@/app/components/ui/snapshot-skeleton/SnapshotSkeleton';
import { useIntlayer } from '@/app/i18n';
import { AccuracyBanner } from './components/AccuracyBanner';
import { DataCheckStep } from './components/DataCheckStep';
import { DraftStep } from './components/DraftStep';
import { ExportStep } from './components/ExportStep';
import { MappingStep } from './components/MappingStep';
import { ProfileStep } from './components/ProfileStep';
import { TaxDisclaimerGate } from './components/TaxDisclaimerGate';
import { useTaxDeclaration } from './hooks/useTaxDeclaration';
import {
  parseStep,
  parseTaxYear,
  STEPS,
  type StepKey,
  taxYearOptions,
} from './tax-declaration.helpers';

function Loading({ id }: { id: string }): React.ReactElement {
  return <SnapshotSkeleton id={id} loading fallback="panel" />;
}

function TaxDeclarationContent(): React.ReactElement {
  const t = useIntlayer('taxDeclarationPage');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Step and year live in the URL so a reload or a shared link lands on the same view.
  const step = parseStep(searchParams.get('step'));
  const taxYear = parseTaxYear(searchParams.get('year'));
  const updateQuery = (patch: Record<string, string>): void => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      params.set(key, value);
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const state = useTaxDeclaration(taxYear);
  const { disclaimer, profile, mappings, draft } = state;
  const accepted = disclaimer.data?.accepted === true;

  const stepLabels: Record<StepKey, React.ReactNode> = {
    profile: t.stepProfile,
    data: t.stepData,
    mapping: t.stepMapping,
    draft: t.stepDraft,
    export: t.stepExport,
  };

  const stepText: Record<StepKey, string> = {
    profile: t.stepProfile.value,
    data: t.stepData.value,
    mapping: t.stepMapping.value,
    draft: t.stepDraft.value,
    export: t.stepExport.value,
  };

  const stepSkeletonId = `tax-declaration-${step}`;
  // What the step waits for, in renderStep's order. The skeleton is the wrapper's
  // own loading state, so the layout it remembers is the step, never a skeleton.
  const stepPending = (): boolean => {
    if (profile.isError) return false;
    if (!profile.data) return true;
    if (step === 'profile' || !profile.data.country) return false;
    if (step === 'mapping') return !(mappings.isError || mappings.data);
    return !(draft.isError || draft.data);
  };
  const renderStep = (): React.ReactNode => {
    if (profile.isError) return <Alert severity="error">{t.loadError}</Alert>;
    if (!profile.data) return null;

    if (step === 'profile' || !profile.data.country) {
      return (
        <ProfileStep
          key={taxYear}
          profile={profile.data}
          saving={state.saveProfile.isPending}
          onSave={(taxpayerType, details) => state.saveProfile.mutate({ taxpayerType, details })}
          onNext={() => updateQuery({ step: 'data' })}
        />
      );
    }

    if (step === 'mapping') {
      if (mappings.isError) return <Alert severity="error">{t.loadError}</Alert>;
      if (!mappings.data) return null;
      return (
        <MappingStep
          mappings={mappings.data}
          saving={state.saveMappings.isPending}
          onSave={entries => state.saveMappings.mutate(entries)}
        />
      );
    }

    if (draft.isError) return <Alert severity="error">{t.loadError}</Alert>;
    if (!draft.data) return null;

    if (step === 'data') {
      return (
        <DataCheckStep
          completeness={draft.data.completeness}
          onGoToStep={next => updateQuery({ step: next })}
        />
      );
    }
    if (step === 'draft') {
      return <DraftStep draft={draft.data} />;
    }
    return (
      <ExportStep
        draft={draft.data}
        downloading={state.download.isPending}
        busy={state.finalize.isPending || state.reopen.isPending}
        onDownload={format => state.download.mutate(format)}
        onFinalize={() => state.finalize.mutate()}
        onReopen={() => state.reopen.mutate()}
      />
    );
  };

  const renderBody = (): React.ReactNode => {
    if (disclaimer.isError) return <Alert severity="error">{t.loadError}</Alert>;
    if (!disclaimer.data) return null;
    if (!accepted) {
      return (
        <TaxDisclaimerGate
          accepting={state.acceptDisclaimer.isPending}
          failed={state.acceptDisclaimer.isError}
          onAccept={() => state.acceptDisclaimer.mutate()}
        />
      );
    }

    return (
      <Stack spacing={2.5}>
        {/* The step tabs lead the page, level with the sidebar logo; the year picker
            and the completeness read-out ride on the same row. */}
        <Box
          data-tour-shot="tax-declaration-steps"
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            flexWrap: 'wrap',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <Tabs
            value={step}
            onChange={(_event, value: StepKey) => updateQuery({ step: value })}
            variant="scrollable"
            scrollButtons={false}
            sx={sharedMuiTabsSx}
          >
            {/* Numbered: the tabs are the steps of one task, in order. */}
            {STEPS.map((key, index) => (
              <Tab
                key={key}
                value={key}
                label={
                  <span>
                    <Box component="span" sx={{ color: 'var(--text-muted)', mr: 0.75 }}>
                      {index + 1}
                    </Box>
                    {stepLabels[key]}
                  </span>
                }
              />
            ))}
          </Tabs>
          <Stack
            direction="row"
            spacing={2}
            sx={{
              alignItems: 'center',
              ml: 'auto',
              flexShrink: 0,
            }}
          >
            {/* The data check shows the score itself, large; the bar would repeat it. */}
            {draft.data && step !== 'data' ? (
              <Box sx={{ minWidth: 120 }}>
                <Typography sx={{ fontSize: 12, color: 'var(--text-muted)', mb: 0.75 }}>
                  {t.completenessPercent.value.replace(
                    '{score}',
                    String(draft.data.completeness.score),
                  )}
                </Typography>
                {/* Sage on a neutral track: an unfinished profile is not an error,
                    so the bar is never red. */}
                <LinearProgress
                  variant="determinate"
                  value={draft.data.completeness.score}
                  aria-label={t.completenessLabel.value}
                  sx={{
                    height: 4,
                    borderRadius: 999,
                    bgcolor: 'var(--icon-badge-bg)',
                    '& .MuiLinearProgress-bar': { bgcolor: 'var(--primary)', borderRadius: 999 },
                  }}
                />
              </Box>
            ) : null}
            {/* The label sits above the field, as on every form in the app. */}
            <Box>
              <Typography
                component="label"
                htmlFor="tax-year"
                sx={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', mb: 0.5 }}
              >
                {t.taxYearLabel}
              </Typography>
              <TextField
                select
                size="small"
                id="tax-year"
                value={taxYear}
                onChange={event => updateQuery({ year: event.target.value })}
                sx={{ minWidth: 140 }}
                slotProps={{ select: { inputProps: { 'aria-label': t.taxYearLabel.value } } }}
              >
                {taxYearOptions().map(year => (
                  <MenuItem key={year} value={year}>
                    {year}
                  </MenuItem>
                ))}
              </TextField>
            </Box>
          </Stack>
        </Box>

        {state.actionError ? (
          <Alert severity="error">
            {state.actionError === 'forbidden' ? t.forbidden : t.actionError}
          </Alert>
        ) : null}

        {/* The caveat sits under the tabs, in the step's own context; the draft
            step folds it into one notice with its warnings. */}
        <Stack spacing={2.5}>
          {step === 'draft' ? null : <AccuracyBanner />}
          <SnapshotSkeleton
            id={stepSkeletonId}
            loading={stepPending()}
            fallback="panel"
            capture={!(profile.isError || mappings.isError || draft.isError)}
          >
            {renderStep()}
          </SnapshotSkeleton>
        </Stack>
      </Stack>
    );
  };

  return (
    <PageFrame
      // The step and year mean nothing until the disclaimer is accepted.
      summary={
        accepted ? joinSummary([stepText[step], `${t.taxYearLabel.value}: ${taxYear}`]) : undefined
      }
    >
      <SnapshotSkeleton
        id="tax-declaration-body"
        loading={!(disclaimer.data || disclaimer.isError)}
        fallback="panel"
        capture={!disclaimer.isError}
      >
        {renderBody()}
      </SnapshotSkeleton>
    </PageFrame>
  );
}

/** The page column and its title, the same while the address is still being read. */
function PageFrame({
  summary,
  children,
}: {
  summary?: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <Box
      component="main"
      sx={{ px: { xs: 2, md: 4 }, pt: 'var(--seneca-page-top, 24px)', pb: 3, width: '100%' }}
    >
      {/* One centred column: wider, the two cards stopped short of the edge. */}
      <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
        <Box sx={{ mb: 2.5 }}>
          <PageTitle path="/tax-declaration" summary={summary} />
        </Box>
        {children}
      </Box>
    </Box>
  );
}

export default function TaxDeclarationPage(): React.ReactElement {
  // useSearchParams needs a Suspense boundary for the static render of the route.
  return (
    <Suspense
      fallback={
        <PageFrame>
          <Loading id="tax-declaration-body" />
        </PageFrame>
      }
    >
      <TaxDeclarationContent />
    </Suspense>
  );
}

'use client';

import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import type React from 'react';
import { Save } from '@/app/components/icons';
import { SnapshotSkeleton } from '@/app/components/ui/snapshot-skeleton/SnapshotSkeleton';
import { useIntlayer } from '@/app/i18n';
import { tokens } from '@/lib/theme-tokens';
import { SettingsSection } from './SettingsSection';

const FIELD_LABEL_STYLE: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--foreground)',
  marginBottom: 6,
};

/** An outlined field like the real one, with a bar where its value sits. */
function FieldSkeleton({
  label,
  height,
  value = true,
}: {
  label: React.ReactNode;
  height: number;
  value?: boolean;
}) {
  return (
    <Box>
      <span style={FIELD_LABEL_STYLE}>{label}</span>
      <Box
        sx={{
          height,
          px: 1.5,
          pt: 1.25,
          border: '1px solid var(--border)',
          borderRadius: tokens.radius.sm,
          boxSizing: 'border-box',
        }}
      >
        {value ? <Skeleton variant="text" width={160} height={18} /> : null}
      </Box>
    </Box>
  );
}

/**
 * The Overview tab before the workspace is known: the same sections with their
 * titles and field labels, placeholders where the workspace's values go.
 */
export function WorkspaceOverviewSkeleton(): React.JSX.Element {
  const t = useIntlayer('workspaceOverview');
  const business = useIntlayer('businessProfile');
  const invoice = useIntlayer('invoiceSettings');

  return (
    <Box aria-busy="true" sx={{ bgcolor: 'var(--background)' }}>
      <Box sx={{ maxWidth: 1120, px: { xs: 2.5, sm: 4 }, py: 3 }}>
        <SettingsSection title={t.background.title} description={t.background.description}>
          <Skeleton
            variant="rounded"
            sx={{
              width: '100%',
              maxWidth: 360,
              height: 'auto',
              aspectRatio: '2.8/1',
              borderRadius: tokens.radius.md,
            }}
          />
        </SettingsSection>

        <SettingsSection title={t.details.title} description={t.details.description}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <FieldSkeleton label={t.details.name} height={38} />
            <FieldSkeleton label={t.details.descriptionLabel} height={80} value={false} />
            <FieldSkeleton label={t.details.currency} height={38} />
            <Box>
              <Box
                component="span"
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 1,
                  px: 2,
                  py: 1,
                  fontSize: 14,
                  fontWeight: 500,
                  color: 'var(--primary-foreground)',
                  bgcolor: 'var(--primary-fill)',
                  borderRadius: tokens.radius.md,
                  opacity: 0.6,
                }}
              >
                <Save size={16} />
                {t.details.save}
              </Box>
            </Box>
          </Box>
        </SettingsSection>

        <SettingsSection title={business.title} description={business.description}>
          <SnapshotSkeleton id="workspace-business-profile" loading fallback="panel" />
        </SettingsSection>

        <SettingsSection title={invoice.title} description={invoice.description}>
          <SnapshotSkeleton id="workspace-invoice-settings" loading fallback="panel" />
        </SettingsSection>
      </Box>
    </Box>
  );
}

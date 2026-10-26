'use client';

import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { Clock } from '@/app/components/icons';
import { ResetPageHintsButton } from '@/app/components/page-hints/ResetPageHintsButton';
import { useWorkspace } from '@/app/contexts/WorkspaceContext';
import { useLocale } from '@/app/i18n';
import { isExperimentalModeEnabled, setExperimentalModeEnabled } from '@/app/lib/experimental-mode';
import { ChangelogSection } from '@/app/settings/profile/components/ChangelogSection';
import { ExperimentalSection } from '@/app/settings/profile/components/ExperimentalSection';
import { SettingsAccordion } from '@/app/settings/profile/components/SettingsAccordion';
import { SettingsElsewhereLinks } from '@/app/settings/profile/components/SettingsElsewhereLinks';
import { UpdateSection } from '@/app/settings/profile/components/UpdateSection';
import { useChangelog } from '@/app/settings/profile/hooks/useChangelog';
import { useSettingsText } from '@/app/settings/profile/hooks/useSettingsText';

import type { SettingsTabProps } from './types';

export function AdvancedTab({ user }: SettingsTabProps): React.JSX.Element {
  const { locale } = useLocale();
  const { currentWorkspace, loading: workspaceLoading } = useWorkspace();
  const { tx } = useSettingsText();
  const [experimentalMode, setExperimentalMode] = useState(false);

  // localStorage is only readable after mount, so the switch starts off and
  // catches up here instead of desyncing hydration.
  useEffect(() => {
    setExperimentalMode(isExperimentalModeEnabled());
  }, []);

  const handleExperimentalModeChange = useCallback((value: boolean): void => {
    setExperimentalMode(value);
    setExperimentalModeEnabled(value);
  }, []);

  const workspaceReady = !!(currentWorkspace && !workspaceLoading);
  const { changelogEntries, changelogLoading, changelogSelectedEntry, setChangelogSelectedEntry } =
    useChangelog(!!user, workspaceReady);

  return (
    <Stack spacing={2}>
      <ExperimentalSection
        tx={tx}
        enabled={experimentalMode}
        setEnabled={handleExperimentalModeChange}
      />

      <SettingsAccordion
        id="changelog"
        title={tx(['changelogCard', 'title'])}
        description={tx(['changelogCard', 'description'])}
        icon={Clock}
        defaultExpanded
      >
        <Stack spacing={2}>
          <UpdateSection isAdmin={user.role === 'admin'} />
          <ChangelogSection
            tx={tx}
            locale={locale}
            changelogEntries={changelogEntries}
            changelogLoading={changelogLoading}
            changelogSelectedEntry={changelogSelectedEntry}
            setChangelogSelectedEntry={setChangelogSelectedEntry}
          />
        </Stack>
      </SettingsAccordion>

      <Card variant="outlined">
        <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, px: 1.5, pt: 0.5, pb: 1 }}>
            {tx(['navigation', 'elsewhere'])}
          </Typography>
          <SettingsElsewhereLinks tx={tx} />
          <ResetPageHintsButton />
        </CardContent>
      </Card>
    </Stack>
  );
}

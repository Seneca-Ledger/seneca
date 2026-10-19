'use client';

import Stack from '@mui/material/Stack';
import type React from 'react';
import { History } from '@/app/components/icons';
import { useWorkspace } from '@/app/contexts/WorkspaceContext';
import { useIntlayer } from '@/app/i18n';
import { SettingsAccordion } from '@/app/settings/profile/components/SettingsAccordion';
import { VersionsSection } from '@/app/settings/profile/components/VersionsSection';
import { resolveOpenSection } from '@/app/settings/profile/helpers/settings-url-state';

import type { SettingsTabProps } from './types';

/** Dated versions of the workspace: open one read only, or keep it as a copy. */
export function VersionsTab({ section }: SettingsTabProps): React.JSX.Element {
  const t = useIntlayer('settingsVersionsSection');
  const { currentWorkspace, openVersion, refreshWorkspaces } = useWorkspace();
  const openSection = resolveOpenSection('versions', section);

  return (
    <Stack spacing={2}>
      <SettingsAccordion
        id="versions"
        title={t.title.value}
        description={t.description.value}
        icon={History}
        defaultExpanded={openSection === 'versions'}
      >
        <VersionsSection
          workspaceName={currentWorkspace?.name ?? ''}
          onOpen={openVersion}
          onCopied={() => {
            void refreshWorkspaces();
          }}
        />
      </SettingsAccordion>
    </Stack>
  );
}

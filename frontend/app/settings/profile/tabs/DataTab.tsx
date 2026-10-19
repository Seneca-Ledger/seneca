'use client';

import Stack from '@mui/material/Stack';
import type React from 'react';
import { Cloud, DollarSign, Home, MapPin, Shield, SlidersHorizontal } from '@/app/components/icons';
import { useWorkspace } from '@/app/contexts/WorkspaceContext';
import { useIntlayer } from '@/app/i18n';
import { ExchangeRatesSection } from '@/app/settings/profile/components/ExchangeRatesSection';
import { MyDataSection } from '@/app/settings/profile/components/MyDataSection';
import { ProcessingSection } from '@/app/settings/profile/components/ProcessingSection';
import { ReceiptLocationCaptureSection } from '@/app/settings/profile/components/ReceiptLocationCaptureSection';
import { SettingsAccordion } from '@/app/settings/profile/components/SettingsAccordion';
import { SyncSection } from '@/app/settings/profile/components/SyncSection';
import { WorkspaceProfileSection } from '@/app/settings/profile/components/WorkspaceProfileSection';
import { resolveOpenSection } from '@/app/settings/profile/helpers/settings-url-state';
import { useProcessing } from '@/app/settings/profile/hooks/useProcessing';
import { useSettingsText } from '@/app/settings/profile/hooks/useSettingsText';
import { useSync } from '@/app/settings/profile/hooks/useSync';

import type { SettingsTabProps } from './types';

export function DataTab({ section, user, logout }: SettingsTabProps): React.JSX.Element {
  const { currentWorkspace } = useWorkspace();
  const { tx } = useSettingsText();
  const receiptLocationText = useIntlayer('receiptLocationConsent');
  const openSection = resolveOpenSection('data', section);

  const processing = useProcessing(!!user, currentWorkspace?.id, {
    loadError: tx(['processingCard', 'loadError'], 'Failed to load processing settings'),
    saveError: tx(['processingCard', 'saveError'], 'Failed to save processing settings'),
    savedMessage: tx(['notificationsCard', 'messages', 'saved'], 'Saved'),
  });

  const {
    bankStats,
    totalCount,
    statsLoading,
    downloading,
    errorMessage: syncError,
    handleExportZip,
  } = useSync();

  // The account is gone; clear the client session rather than leaving a dead token around.
  const handleAccountDeleted = (): void => {
    void logout();
  };

  return (
    <Stack spacing={2}>
      <SettingsAccordion
        id="workspace-profile"
        title={tx(['workspaceProfileCard', 'title'], 'Workspace profile')}
        description={tx(['workspaceProfileCard', 'description'], '')}
        icon={Home}
        defaultExpanded={openSection === 'workspace-profile'}
      >
        <WorkspaceProfileSection tx={tx} />
      </SettingsAccordion>

      <SettingsAccordion
        id="processing"
        title={tx(['processingCard', 'title'], 'Processing')}
        description={tx(['processingCard', 'description'], '')}
        icon={SlidersHorizontal}
        defaultExpanded={openSection === 'processing'}
      >
        <ProcessingSection tx={tx} processing={processing} />
      </SettingsAccordion>

      <SettingsAccordion
        id="exchange-rates"
        title={tx(['exchangeRatesCard', 'title'], 'Exchange rates')}
        description={tx(['exchangeRatesCard', 'description'], '')}
        icon={DollarSign}
        defaultExpanded={openSection === 'exchange-rates'}
      >
        <ExchangeRatesSection tx={tx} />
      </SettingsAccordion>

      <SettingsAccordion
        id="receipt-location"
        title={receiptLocationText.settingsTitle.value}
        description={receiptLocationText.settingsDescription.value}
        icon={MapPin}
        defaultExpanded={openSection === 'receipt-location'}
      >
        <ReceiptLocationCaptureSection />
      </SettingsAccordion>

      <SettingsAccordion
        id="sync"
        title={tx(['syncCard', 'title'], 'Sync & backup')}
        description={tx(['syncCard', 'description'], 'Export and sync files to your filesystem')}
        icon={Cloud}
        defaultExpanded={openSection === 'sync'}
      >
        <SyncSection
          bankStats={bankStats}
          totalCount={totalCount}
          statsLoading={statsLoading}
          downloading={downloading}
          errorMessage={syncError}
          handleExportZip={handleExportZip}
        />
      </SettingsAccordion>

      <SettingsAccordion
        id="my-data"
        title={tx(['myDataCard', 'title'], 'My data')}
        description={tx(
          ['myDataCard', 'description'],
          'Download a copy of your data, or delete your account',
        )}
        icon={Shield}
        defaultExpanded={openSection === 'my-data'}
      >
        <MyDataSection tx={tx} onAccountDeleted={handleAccountDeleted} />
      </SettingsAccordion>
    </Stack>
  );
}

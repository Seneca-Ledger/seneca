'use client';

import Box from '@mui/material/Box';
import type { ReactNode } from 'react';
import { useIntlayer } from '@/app/i18n';
import { LOCALE_ENDONYMS } from '@/app/lib/locale';
import { formatTimeZoneLabel } from '@/app/lib/timezone';
import { useSettingsText } from '@/app/settings/profile/hooks/useSettingsText';
import { FlagIcon } from '../components/FlagIcon';
import { StepHeading } from '../components/StepHeading';
import type { OnboardingMode } from '../lib/onboarding-flow';
import { countryName } from '../lib/tax-countries';
import { useOnboardingText } from '../lib/useOnboardingText';
import type { OnboardingData } from '../useOnboardingWizard';

interface CompletionStepProps {
  data: OnboardingData;
  mode: OnboardingMode;
}

export function CompletionStep({ data, mode }: CompletionStepProps) {
  const text = useOnboardingText(data.locale);
  const { tx: settingsText } = useSettingsText();
  const declaration = useIntlayer('taxDeclarationPage');
  const notSet = text(['completion', 'notSet'], 'not set');

  const taxpayerLabel: Record<NonNullable<OnboardingData['taxpayerType']>, string> = {
    employee: String(declaration.typeEmployee.value),
    self_employed: String(declaration.typeSelfEmployed.value),
    company: String(declaration.typeCompany.value),
  };

  const rows: Array<{ key: string; label: string; value: ReactNode }> = [
    {
      key: 'language',
      label: text(['completion', 'summary', 'language'], 'Language'),
      value: LOCALE_ENDONYMS[data.locale],
    },
    ...(mode === 'standard'
      ? [
          {
            key: 'timeZone',
            label: text(['completion', 'summary', 'timeZone'], 'Timezone'),
            value: data.timeZone ? formatTimeZoneLabel(data.timeZone, data.locale) : notSet,
          },
        ]
      : []),
    {
      key: 'workspace',
      label: text(['completion', 'summary', 'workspace'], 'Workspace'),
      value: data.workspaceName.trim() || notSet,
    },
    {
      key: 'currency',
      label: text(['completion', 'summary', 'currency'], 'Currency'),
      value: data.workspaceCurrency || notSet,
    },
    {
      key: 'profile',
      label: text(['completion', 'summary', 'profile'], 'Workspace type'),
      value: data.profile
        ? settingsText(['workspaceProfileCard', data.profile], data.profile)
        : notSet,
    },
    {
      key: 'taxCountry',
      label: text(['completion', 'summary', 'taxCountry'], 'Tax residence'),
      value: data.taxCountry ? (
        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
          <FlagIcon code={data.taxCountry} size={18} />
          {countryName(data.taxCountry, data.locale)}
        </Box>
      ) : (
        notSet
      ),
    },
    ...(data.taxCountry
      ? [
          {
            key: 'taxpayer',
            label: text(['completion', 'summary', 'taxpayer'], 'Files as'),
            value: data.taxpayerType ? taxpayerLabel[data.taxpayerType] : notSet,
          },
        ]
      : []),
  ];

  return (
    <Box component="section" sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <StepHeading
        title={text(['completion', 'title'], 'Done! Setup complete')}
        subtitle={text(
          ['completion', 'subtitle'],
          'Press the button below to continue to your workspace.',
        )}
      />

      <Box component="dl" sx={{ m: 0, borderTop: '1px solid var(--border-color)' }}>
        {rows.map(row => (
          <Box
            key={row.key}
            sx={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 3fr)',
              gap: 2,
              py: 1.5,
              borderBottom: '1px solid var(--border-color)',
              fontSize: 14,
            }}
          >
            <Box component="dt" sx={{ color: 'var(--muted-foreground)' }}>
              {row.label}
            </Box>
            <Box component="dd" sx={{ m: 0, color: 'var(--foreground)', minWidth: 0 }}>
              {row.value}
            </Box>
          </Box>
        ))}
      </Box>

      <Box
        component="p"
        sx={{ m: 0, fontSize: 13, lineHeight: 1.6, color: 'var(--muted-foreground)' }}
      >
        {text(
          ['completion', 'laterHint'],
          'Mail import, file storage, AI and Telegram can be connected at any time under Integrations.',
        )}
      </Box>
    </Box>
  );
}

'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import { useEffect, useState } from 'react';
import { CurrencySelector } from '@/app/(main)/workspaces/components/CurrencySelector';
import { ArrowLeft, Briefcase, Home } from '@/app/components/icons';
import type { WorkspaceProfile } from '@/app/components/navigation/helpers/navigation-config';
import { ChoiceCards } from '@/app/components/ui/choice-cards';
import { useSettingsText } from '@/app/settings/profile/hooks/useSettingsText';
import { LocaleField } from '../components/LocaleField';
import { FieldLabel, OnboardingTextField } from '../components/OnboardingField';
import { StepHeading } from '../components/StepHeading';
import { useOnboardingText } from '../lib/useOnboardingText';
import type { SupportedLocale } from '../useOnboardingWizard';

interface WorkspaceStepProps {
  locale: SupportedLocale;
  workspaceName: string;
  workspaceCurrency: string;
  profile: WorkspaceProfile | null;
  onWorkspaceNameChange: (value: string) => void;
  onWorkspaceCurrencyChange: (value: string) => void;
  onProfileChange: (value: WorkspaceProfile) => void;
  /** The currency list takes over the panel; the page hides its navigation meanwhile. */
  onCurrencyPickerOpenChange?: (open: boolean) => void;
  /**
   * Given only when this flow skips the language step (another workspace is being
   * created): the language is then asked here instead.
   */
  onLocaleChange?: (locale: SupportedLocale) => void;
}

export function WorkspaceStep({
  locale,
  workspaceName,
  workspaceCurrency,
  profile,
  onWorkspaceNameChange,
  onWorkspaceCurrencyChange,
  onProfileChange,
  onCurrencyPickerOpenChange,
  onLocaleChange,
}: WorkspaceStepProps) {
  const text = useOnboardingText(locale);
  const { tx: settingsText } = useSettingsText();
  const [currencyPickerOpen, setCurrencyPickerOpen] = useState(false);

  useEffect(() => {
    onCurrencyPickerOpenChange?.(currencyPickerOpen);
  }, [currencyPickerOpen, onCurrencyPickerOpenChange]);

  useEffect(
    () => () => {
      onCurrencyPickerOpenChange?.(false);
    },
    [onCurrencyPickerOpenChange],
  );

  if (currencyPickerOpen) {
    return (
      <Box component="section" sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <StepHeading
          title={text(['workspace', 'currencyPickerTitle'], 'Select a currency')}
          subtitle={text(
            ['workspace', 'currencyPickerSubtitle'],
            'Find and select the currency that will be used by default.',
          )}
        />
        <CurrencySelector
          selectedCurrency={workspaceCurrency || null}
          onSelect={value => onWorkspaceCurrencyChange(value)}
          mode="inline"
          open={currencyPickerOpen}
          onOpenChange={setCurrencyPickerOpen}
          showLabel={false}
          showTrigger={false}
          minimal
          size="large"
        />
        <Button
          variant="text"
          onClick={() => setCurrencyPickerOpen(false)}
          startIcon={<ArrowLeft size={18} />}
          sx={{
            alignSelf: 'flex-start',
            ml: -1.5,
            textTransform: 'none',
            fontSize: 15,
            fontWeight: 500,
            color: 'var(--muted-foreground)',
            '&:hover': { color: 'var(--foreground)', bgcolor: 'transparent' },
          }}
        >
          {text(['navigation', 'back'], 'Back')}
        </Button>
      </Box>
    );
  }

  const profileLabel = text(['workspace', 'profileLabel'], 'What is this workspace for?');

  return (
    <Box component="section" sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <StepHeading
        title={text(['workspace', 'title'], 'Set up your first workspace')}
        subtitle={text(
          ['workspace', 'subtitle'],
          'Set workspace name and default currency for accurate data tracking.',
        )}
      />

      <OnboardingTextField
        id="workspace-name"
        label={text(['workspace', 'nameLabel'], 'Workspace name')}
        value={workspaceName}
        onChange={onWorkspaceNameChange}
        placeholder={text(['workspace', 'namePlaceholder'], 'For example: My Company workspace')}
      />

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <CurrencySelector
          selectedCurrency={workspaceCurrency || null}
          onSelect={value => onWorkspaceCurrencyChange(value)}
          mode="inline"
          open={currencyPickerOpen}
          onOpenChange={setCurrencyPickerOpen}
        />
        <Box component="p" sx={{ m: 0, fontSize: 13, color: 'var(--muted-foreground)' }}>
          {text(
            ['workspace', 'currencyHint'],
            'This currency will be used by default for new records.',
          )}
        </Box>
      </Box>

      {onLocaleChange ? (
        <LocaleField
          label={text(['language', 'localeLabel'], 'Language')}
          value={locale}
          onChange={onLocaleChange}
          hint={text(
            ['language', 'timeZoneHint'],
            'You can always change this later in profile settings.',
          )}
        />
      ) : null}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <FieldLabel id="workspace-profile-label">{profileLabel}</FieldLabel>
        <ChoiceCards<WorkspaceProfile>
          aria-labelledby="workspace-profile-label"
          value={profile}
          onChange={onProfileChange}
          options={[
            {
              value: 'home',
              icon: <Home size={20} />,
              title: settingsText(['workspaceProfileCard', 'home'], 'Home'),
              description: settingsText(
                ['workspaceProfileCard', 'homeHint'],
                'Personal or family money',
              ),
            },
            {
              value: 'business',
              icon: <Briefcase size={20} />,
              title: settingsText(['workspaceProfileCard', 'business'], 'Business'),
              description: settingsText(
                ['workspaceProfileCard', 'businessHint'],
                'Invoices, payables, ledger, tax',
              ),
            },
          ]}
        />
        {/* Says why Next is greyed out; it goes once the question is answered. */}
        {profile ? null : (
          <Box component="p" sx={{ m: 0, fontSize: 13, color: 'var(--muted-foreground)' }}>
            {text(['workspace', 'profileRequired'], 'Choose one to continue.')}
          </Box>
        )}
      </Box>
    </Box>
  );
}

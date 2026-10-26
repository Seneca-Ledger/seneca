'use client';

import Box from '@mui/material/Box';
import { Briefcase, Home } from '@/app/components/icons';
import type { WorkspaceProfile } from '@/app/components/navigation/helpers/navigation-config';
import { CurrencyDrawer } from '@/app/components/receipts/components/CurrencyDrawer';
import { ChoiceCards } from '@/app/components/ui/choice-cards';
import { useCurrencyPickerState } from '@/app/hooks/useCurrencyPickerState';
import { useIntlayer } from '@/app/i18n';
import { makeTx } from '@/app/lib/intlayer-resolve';
import { LocaleField } from '../components/LocaleField';
import { FieldLabel, OnboardingTextField } from '../components/OnboardingField';
import { PickerField } from '../components/PickerField';
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
  onLocaleChange,
}: WorkspaceStepProps) {
  const text = useOnboardingText(locale);
  const settingsText = makeTx(useIntlayer('settingsProfilePage'));
  const currencyText = useIntlayer('workspaceCurrencySelector');
  const picker = useCurrencyPickerState(workspaceCurrency);

  const profileLabel = text(['workspace', 'profileLabel']);

  return (
    <Box
      component="section"
      sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 4, md: 3 } }}
    >
      <StepHeading
        title={text(['workspace', 'title'])}
        subtitle={text(['workspace', 'subtitle'])}
      />

      <OnboardingTextField
        id="workspace-name"
        label={text(['workspace', 'nameLabel'])}
        value={workspaceName}
        onChange={onWorkspaceNameChange}
        placeholder={text(['workspace', 'namePlaceholder'])}
      />

      {/* With a language to ask too, the two pickers share a row so the step fits the screen. */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: onLocaleChange ? '1fr 1fr' : '1fr' },
          alignItems: 'start',
          columnGap: 2,
          rowGap: { xs: 4, md: 3 },
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <PickerField
            id="workspace-currency"
            label={String(currencyText.label.value)}
            value={picker.selectedCurrencyItem?.label ?? null}
            placeholder={String(currencyText.selectCurrency.value)}
            onOpen={() => picker.setCurrencyDrawerOpen(true)}
          />
          <Box component="p" sx={{ m: 0, fontSize: 13, color: 'var(--muted-foreground)' }}>
            {text(['workspace', 'currencyHint'])}
          </Box>
        </Box>

        {onLocaleChange ? (
          <LocaleField
            label={text(['language', 'localeLabel'])}
            value={locale}
            onChange={onLocaleChange}
            hint={text(['language', 'timeZoneHint'])}
          />
        ) : null}
      </Box>

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
              title: settingsText(['workspaceProfileCard', 'home']),
              description: settingsText(['workspaceProfileCard', 'homeHint']),
            },
            {
              value: 'business',
              icon: <Briefcase size={20} />,
              title: settingsText(['workspaceProfileCard', 'business']),
              description: settingsText(['workspaceProfileCard', 'businessHint']),
            },
          ]}
        />
        {/* Says why Next is greyed out; it goes once the question is answered. */}
        {profile ? null : (
          <Box component="p" sx={{ m: 0, fontSize: 13, color: 'var(--muted-foreground)' }}>
            {text(['workspace', 'profileRequired'])}
          </Box>
        )}
      </Box>

      <CurrencyDrawer
        isOpen={picker.currencyDrawerOpen}
        onClose={() => {
          picker.setCurrencyDrawerOpen(false);
          picker.setCurrencySearch('');
        }}
        currencySearch={picker.currencySearch}
        setCurrencySearch={picker.setCurrencySearch}
        selectedCurrencyItem={picker.selectedCurrencyItem}
        selectedMatchesSearch={picker.selectedMatchesSearch}
        currencyQuery={picker.currencyQuery}
        recentCurrencyItems={picker.recentCurrencyItems}
        allCurrencyItems={picker.allCurrencyItems}
        handleSelectCurrency={code => {
          onWorkspaceCurrencyChange(code);
          picker.pushRecentCurrency(code);
        }}
      />
    </Box>
  );
}

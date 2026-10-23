'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import { useMemo, useState } from 'react';
import { Briefcase, Building2, User } from '@/app/components/icons';
import type { WorkspaceProfile } from '@/app/components/navigation/helpers/navigation-config';
import { type ChoiceCardOption, ChoiceCards } from '@/app/components/ui/choice-cards';
import { useIntlayer } from '@/app/i18n';
import { APP_NAME } from '@/app/lib/brand';
import { CountryDrawer } from '../components/CountryDrawer';
import { FlagIcon } from '../components/FlagIcon';
import { FieldLabel } from '../components/OnboardingField';
import { PickerField } from '../components/PickerField';
import { StepHeading } from '../components/StepHeading';
import { countryOptions, suggestedCountry, useJurisdictions } from '../lib/tax-countries';
import { useOnboardingText } from '../lib/useOnboardingText';
import type { SupportedLocale, TaxpayerType } from '../useOnboardingWizard';

interface TaxStepProps {
  locale: SupportedLocale;
  profile: WorkspaceProfile | null;
  taxCountry: string | null;
  taxpayerType: TaxpayerType | null;
  onTaxCountryChange: (code: string | null) => void;
  onTaxpayerTypeChange: (type: TaxpayerType) => void;
  /** "Not listed / decide later": clears the country and moves on. */
  onDefer: () => void;
}

export function TaxStep({
  locale,
  profile,
  taxCountry,
  taxpayerType,
  onTaxCountryChange,
  onTaxpayerTypeChange,
  onDefer,
}: TaxStepProps) {
  const text = useOnboardingText(locale);
  // Taxpayer kinds are named as on the declaration page, which is where they matter.
  const declaration = useIntlayer('taxDeclarationPage');
  const jurisdictions = useJurisdictions();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const countryLabel = text(['tax', 'countryLabel'], 'Tax residence');

  const options = useMemo(() => {
    const list = jurisdictions.data ?? [];
    return countryOptions(
      list,
      locale,
      suggestedCountry(list.map(jurisdiction => jurisdiction.code)),
    );
  }, [jurisdictions.data, locale]);
  const selectedOption = options.find(option => option.code === taxCountry);

  const taxpayerOptions: Array<ChoiceCardOption<TaxpayerType>> = [
    { value: 'employee', icon: <User size={20} />, title: String(declaration.typeEmployee.value) },
    {
      value: 'self_employed',
      icon: <Briefcase size={20} />,
      title: String(declaration.typeSelfEmployed.value),
    },
    // A household does not file as a company.
    ...(profile === 'home'
      ? []
      : [
          {
            value: 'company' as const,
            icon: <Building2 size={20} />,
            title: String(declaration.typeCompany.value),
          },
        ]),
  ];

  return (
    <Box
      component="section"
      sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 4, md: 3 } }}
    >
      <StepHeading
        title={text(['tax', 'title'], 'Where do you pay tax?')}
        subtitle={text(
          ['tax', 'subtitle'],
          `${APP_NAME} uses it for VAT rates and the income tax declaration in this workspace.`,
        )}
      />

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {jurisdictions.isPending ? (
          <>
            <FieldLabel>{countryLabel}</FieldLabel>
            <Box sx={{ height: 48, display: 'flex', alignItems: 'center' }}>
              <CircularProgress size={20} />
            </Box>
          </>
        ) : jurisdictions.isError ? (
          <>
            <FieldLabel>{countryLabel}</FieldLabel>
            <Box
              component="p"
              role="alert"
              sx={{ m: 0, fontSize: 14, color: 'var(--destructive)' }}
            >
              {text(
                ['tax', 'loadFailed'],
                'Could not load the list of countries. You can choose one later in the workspace settings.',
              )}
            </Box>
          </>
        ) : (
          <PickerField
            id="onboarding-tax-country"
            label={countryLabel}
            value={
              selectedOption ? (
                <>
                  <FlagIcon code={selectedOption.code} />
                  {selectedOption.name}
                </>
              ) : null
            }
            placeholder={text(['tax', 'countryPlaceholder'], 'Choose a country')}
            onOpen={() => setDrawerOpen(true)}
          />
        )}
        {taxCountry ? null : (
          <Box component="p" sx={{ m: 0, fontSize: 13, color: 'var(--muted-foreground)' }}>
            {text(
              ['tax', 'notListedHint'],
              'Tax features stay off until a country is chosen in the workspace settings.',
            )}
          </Box>
        )}
      </Box>

      {taxCountry ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <FieldLabel id="onboarding-taxpayer-label">
            {String(declaration.taxpayerTypeLabel.value)}
          </FieldLabel>
          <ChoiceCards<TaxpayerType>
            aria-labelledby="onboarding-taxpayer-label"
            value={taxpayerType}
            onChange={onTaxpayerTypeChange}
            options={taxpayerOptions}
            columns={1}
          />
        </Box>
      ) : null}

      <Button
        variant="text"
        onClick={onDefer}
        sx={{
          alignSelf: 'flex-start',
          ml: -1,
          textTransform: 'none',
          fontSize: 14,
          color: 'var(--muted-foreground)',
          textDecoration: 'underline',
          textUnderlineOffset: 3,
          '&:hover': { color: 'var(--foreground)', bgcolor: 'transparent' },
        }}
      >
        {text(['tax', 'notListed'], "My country isn't listed, or I'll decide later")}
      </Button>

      <CountryDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={countryLabel}
        searchPlaceholder={text(['tax', 'countrySearch'], 'Search countries')}
        emptyLabel={text(['tax', 'countryNotFound'], 'No countries found')}
        options={options}
        selected={taxCountry}
        onSelect={onTaxCountryChange}
      />
    </Box>
  );
}

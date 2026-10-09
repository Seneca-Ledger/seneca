'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import { useMemo } from 'react';
import { Briefcase, Building2, User } from '@/app/components/icons';
import type { WorkspaceProfile } from '@/app/components/navigation/helpers/navigation-config';
import { type ChoiceCardOption, ChoiceCards } from '@/app/components/ui/choice-cards';
import { FORM_CONTROL_SX } from '@/app/components/ui/input';
import { Select } from '@/app/components/ui/select';
import { useIsMobile } from '@/app/hooks/useIsMobile';
import { useIntlayer } from '@/app/i18n';
import { FlagIcon } from '../components/FlagIcon';
import { FieldLabel } from '../components/OnboardingField';
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
  const isMobile = useIsMobile();

  const options = useMemo(() => {
    const list = jurisdictions.data ?? [];
    return countryOptions(
      list,
      locale,
      suggestedCountry(list.map(jurisdiction => jurisdiction.code)),
    );
  }, [jurisdictions.data, locale]);

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
    <Box component="section" sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <StepHeading
        title={text(['tax', 'title'], 'Where do you pay tax?')}
        subtitle={text(
          ['tax', 'subtitle'],
          'Lumio uses it for VAT rates and the income tax declaration in this workspace.',
        )}
      />

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <FieldLabel htmlFor="onboarding-tax-country" id="onboarding-tax-country-label">
          {text(['tax', 'countryLabel'], 'Tax residence')}
        </FieldLabel>
        {jurisdictions.isPending ? (
          <Box sx={{ height: 48, display: 'flex', alignItems: 'center' }}>
            <CircularProgress size={20} />
          </Box>
        ) : jurisdictions.isError ? (
          <Box component="p" role="alert" sx={{ m: 0, fontSize: 14, color: 'var(--destructive)' }}>
            {text(
              ['tax', 'loadFailed'],
              'Could not load the list of countries. You can choose one later in the workspace settings.',
            )}
          </Box>
        ) : (
          <Select
            fullWidth
            id="onboarding-tax-country"
            labelId="onboarding-tax-country-label"
            value={taxCountry ?? ''}
            onChange={value => onTaxCountryChange(value || null)}
            options={[
              { value: '', label: text(['tax', 'countryPlaceholder'], 'Choose a country') },
              ...options.map(option => ({
                value: option.code,
                // A phone's native picker shows text only; elsewhere the flag sits in the row.
                label: isMobile ? (
                  option.name
                ) : (
                  <Box
                    component="span"
                    sx={{ display: 'inline-flex', alignItems: 'center', gap: 1.25 }}
                  >
                    <FlagIcon code={option.code} />
                    {option.name}
                  </Box>
                ),
              })),
            ]}
            startAdornment={
              isMobile && taxCountry ? (
                <Box component="span" sx={{ display: 'inline-flex', mr: 1.25 }}>
                  <FlagIcon code={taxCountry} />
                </Box>
              ) : undefined
            }
            sx={{
              ...FORM_CONTROL_SX,
              // The placeholder row reads as a hint, not as a chosen value.
              ...(taxCountry ? {} : { color: 'var(--muted-foreground)' }),
            }}
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
    </Box>
  );
}

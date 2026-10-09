'use client';

import Box from '@mui/material/Box';
import { useIntlayer } from '@/app/i18n';
import { FlagIcon } from '../components/FlagIcon';
import { OnboardingTextField } from '../components/OnboardingField';
import { StepHeading } from '../components/StepHeading';
import { countryName } from '../lib/tax-countries';
import { useOnboardingText } from '../lib/useOnboardingText';
import type { OnboardingBusinessDetails, SupportedLocale } from '../useOnboardingWizard';

interface BusinessStepProps {
  locale: SupportedLocale;
  taxCountry: string | null;
  business: OnboardingBusinessDetails;
  onChange: (patch: Partial<OnboardingBusinessDetails>) => void;
}

/** The identity printed on invoices; the rest of the business profile waits for the settings page. */
export function BusinessStep({ locale, taxCountry, business, onChange }: BusinessStepProps) {
  const text = useOnboardingText(locale);
  // Field names as the business profile settings call them.
  const labels = useIntlayer('businessProfile');

  return (
    <Box component="section" sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <StepHeading
        title={text(['business', 'title'], 'Business details')}
        subtitle={text(
          ['business', 'subtitle'],
          'They appear on your invoices. Fill in what you have; the rest can wait.',
        )}
      />

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        <OnboardingTextField
          id="business-legal-name"
          label={String(labels.legalName.value)}
          value={business.legalName}
          onChange={legalName => onChange({ legalName })}
          autoComplete="organization"
        />
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
          }}
        >
          <OnboardingTextField
            id="business-tax-id"
            label={String(labels.taxId.value)}
            value={business.taxId}
            onChange={taxId => onChange({ taxId })}
          />
          <OnboardingTextField
            id="business-registration-id"
            label={String(labels.registrationId.value)}
            value={business.registrationId}
            onChange={registrationId => onChange({ registrationId })}
          />
        </Box>
        <OnboardingTextField
          id="business-address"
          label={String(labels.addressLines.value)}
          value={business.addressLines}
          onChange={addressLines => onChange({ addressLines })}
          autoComplete="street-address"
          multiline
        />
      </Box>

      {taxCountry ? (
        <Box
          component="p"
          sx={{
            m: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            fontSize: 13,
            color: 'var(--muted-foreground)',
          }}
        >
          <FlagIcon code={taxCountry} size={18} />
          {text(
            ['business', 'countryNote'],
            'Country: {country}, from your tax residence.',
          ).replace('{country}', countryName(taxCountry, locale))}
        </Box>
      ) : null}
    </Box>
  );
}

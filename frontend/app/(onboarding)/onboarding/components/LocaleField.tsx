'use client';

import Box from '@mui/material/Box';
import { FORM_CONTROL_SX } from '@/app/components/ui/input';
import { Select } from '@/app/components/ui/select';
import { type AppLocale, LOCALE_DISPLAY_ORDER, LOCALE_ENDONYMS } from '@/app/lib/locale';
import { FieldLabel } from './OnboardingField';

// Each language in itself, never translated; English, Germanic, Romance first.
const LANGUAGE_OPTIONS = LOCALE_DISPLAY_ORDER.map(code => ({
  value: code,
  label: LOCALE_ENDONYMS[code],
}));

interface LocaleFieldProps {
  label: string;
  value: AppLocale;
  onChange: (locale: AppLocale) => void;
  hint?: string;
}

/** The interface language. It belongs to the account, so every workspace shares it. */
export function LocaleField({ label, value, onChange, hint }: LocaleFieldProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <FieldLabel htmlFor="onboarding-locale" id="onboarding-locale-label">
        {label}
      </FieldLabel>
      <Select
        fullWidth
        id="onboarding-locale"
        labelId="onboarding-locale-label"
        value={value}
        onChange={next => onChange(next as AppLocale)}
        options={LANGUAGE_OPTIONS}
        sx={FORM_CONTROL_SX}
      />
      {hint ? (
        <Box component="p" sx={{ m: 0, fontSize: 13, color: 'var(--muted-foreground)' }}>
          {hint}
        </Box>
      ) : null}
    </Box>
  );
}

'use client';

import Box from '@mui/material/Box';
import { useState } from 'react';
import { LanguageDrawer } from '@/app/components/navigation/LanguageDrawer';
import { useIntlayer } from '@/app/i18n';
import { type AppLocale, LOCALE_DISPLAY_ORDER, LOCALE_ENDONYMS } from '@/app/lib/locale';
import { PickerField } from './PickerField';

// Each language in itself, never translated; English, Germanic, Romance first.
const LANGUAGE_OPTIONS = LOCALE_DISPLAY_ORDER.map(code => ({
  code,
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
  const { languageModal } = useIntlayer('navigation');
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const query = search.trim().toLowerCase();
  const filtered = query
    ? LANGUAGE_OPTIONS.filter(option => option.label.toLowerCase().includes(query))
    : LANGUAGE_OPTIONS;

  const close = () => {
    setOpen(false);
    setSearch('');
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <PickerField
        id="onboarding-locale"
        label={label}
        value={LOCALE_ENDONYMS[value]}
        placeholder={label}
        onOpen={() => setOpen(true)}
      />
      {hint ? (
        <Box component="p" sx={{ m: 0, fontSize: 13, color: 'var(--muted-foreground)' }}>
          {hint}
        </Box>
      ) : null}
      {/* The same sidebar as the app's own language switcher. */}
      <LanguageDrawer
        isOpen={open}
        onClose={close}
        languageModal={languageModal}
        languageSearch={search}
        setLanguageSearch={setSearch}
        filteredLanguages={filtered}
        normalizedLocale={value}
        handleLanguageSelect={code => {
          onChange(code as AppLocale);
          close();
        }}
      />
    </Box>
  );
}

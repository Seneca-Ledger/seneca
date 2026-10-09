'use client';

import IconButton from '@mui/material/IconButton';
import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Globe } from '@/app/components/icons';
import { LanguageDrawer } from '@/app/components/navigation/LanguageDrawer';
import { useIntlayer, useLocale } from '@/app/i18n';
import {
  type AppLocale as AppLanguage,
  DEFAULT_LOCALE,
  LOCALE_DISPLAY_ORDER,
  LOCALE_ENDONYMS,
} from '@/app/lib/locale';
import { tokens } from '@/lib/theme-tokens';
import { useLockBodyScroll } from '../hooks/useLockBodyScroll';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/explicit-module-boundary-types, max-lines-per-function
export function AuthLanguageSwitcher() {
  const { locale, setLocale, availableLocales } = useLocale();
  const { languageModal } = useIntlayer('navigation');
  const [languageModalOpen, setLanguageModalOpen] = useState(false);
  const [languageSearch, setLanguageSearch] = useState('');

  useLockBodyScroll(languageModalOpen);

  const languages = useMemo(() => {
    const available = availableLocales.map(String);
    return LOCALE_DISPLAY_ORDER.filter(code => available.includes(code)).map(code => ({
      code,
      label: LOCALE_ENDONYMS[code],
      ...(code === DEFAULT_LOCALE ? { note: languageModal.defaultLanguageNote.value } : {}),
    }));
  }, [availableLocales, languageModal.defaultLanguageNote]);

  const currentLanguageLabel = useMemo(() => {
    const currentCode = (locale || DEFAULT_LOCALE) as AppLanguage;
    return (
      languages.find(l => l.code === currentCode)?.label ??
      LOCALE_ENDONYMS[DEFAULT_LOCALE] ??
      DEFAULT_LOCALE
    );
  }, [locale, languages]);

  const filteredLanguages = useMemo(() => {
    const query = languageSearch.trim().toLowerCase();
    if (!query) {
      return languages;
    }

    return languages.filter(lang => lang.label.toLowerCase().includes(query));
  }, [languageSearch, languages]);

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const handleLanguageSelect = (code: AppLanguage) => {
    setLocale(code);
    setLanguageModalOpen(false);
    setLanguageSearch('');
    const selectedLabel =
      languages.find(l => l.code === code)?.label ??
      LOCALE_ENDONYMS[DEFAULT_LOCALE] ??
      DEFAULT_LOCALE;
    toast.success(`${languageModal.savedToastPrefix.value}: ${selectedLabel}`);
    setTimeout(() => {
      window.location.reload();
    }, 50);
  };

  return (
    <>
      <IconButton
        aria-label={currentLanguageLabel}
        onClick={() => {
          setLanguageSearch('');
          setLanguageModalOpen(true);
        }}
        sx={{
          width: 48,
          height: 48,
          borderRadius: `${tokens.radius.full} !important`,
          color: 'text.secondary',
          '&:hover': {
            borderRadius: `${tokens.radius.full} !important`,
            color: 'text.primary',
          },
        }}
      >
        <Globe size={20} suppressHydrationWarning />
      </IconButton>

      {/* The same drawer the app uses, so sign-in and the app look identical. */}
      <LanguageDrawer
        isOpen={languageModalOpen}
        onClose={() => {
          setLanguageModalOpen(false);
          setLanguageSearch('');
        }}
        languageModal={languageModal}
        languageSearch={languageSearch}
        setLanguageSearch={setLanguageSearch}
        filteredLanguages={filteredLanguages}
        normalizedLocale={(locale || DEFAULT_LOCALE) as AppLanguage}
        handleLanguageSelect={code => handleLanguageSelect(code as AppLanguage)}
      />
    </>
  );
}

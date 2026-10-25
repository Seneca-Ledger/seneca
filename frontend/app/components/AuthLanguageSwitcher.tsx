'use client';

import ButtonBase from '@mui/material/ButtonBase';
import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { ChevronDown } from '@/app/components/icons';
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
      {/* "EN ▾" in words: a bare globe did not say what it switches. */}
      <ButtonBase
        aria-label={currentLanguageLabel}
        aria-haspopup="dialog"
        onClick={() => {
          setLanguageSearch('');
          setLanguageModalOpen(true);
        }}
        sx={{
          gap: 0.25,
          px: 1,
          py: 0.5,
          borderRadius: tokens.radius.sm,
          fontSize: 14,
          fontWeight: 500,
          letterSpacing: '0.02em',
          color: 'var(--text-muted)',
          '&:hover, &.Mui-focusVisible': { color: 'var(--foreground)' },
        }}
      >
        {(locale || DEFAULT_LOCALE).toUpperCase()}
        <ChevronDown size={16} aria-hidden />
      </ButtonBase>

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

'use client';

import { useCallback, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { DEFAULT_LOCALE, LOCALE_DISPLAY_ORDER, LOCALE_ENDONYMS } from '@/app/lib/locale';
import type { AppLanguage } from '../helpers/navigation-config';

interface Language {
  code: AppLanguage;
  label: string;
  note?: string;
}

interface UseLanguageSelectionParams {
  locale: string;
  availableLocales: unknown[];
  setLocale: (code: AppLanguage) => void;
  languageModal: { defaultLanguageNote: { value: string }; savedToastPrefix: { value: string } };
  setMobileMenuOpen: (open: boolean) => void;
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/explicit-module-boundary-types, max-lines-per-function
export function useLanguageSelection({
  locale,
  availableLocales,
  setLocale,
  languageModal,
  setMobileMenuOpen,
}: UseLanguageSelectionParams) {
  const [languageModalOpen, setLanguageModalOpen] = useState(false);
  const [languageSearch, setLanguageSearch] = useState('');

  const languages = useMemo((): Language[] => {
    const available = availableLocales.map(String);
    return LOCALE_DISPLAY_ORDER.filter(code => available.includes(code)).map(code => ({
      code,
      label: LOCALE_ENDONYMS[code],
      ...(code === DEFAULT_LOCALE ? { note: languageModal.defaultLanguageNote.value } : {}),
    }));
  }, [availableLocales, languageModal.defaultLanguageNote]);

  const normalizedLocale = (locale as AppLanguage) || 'ru';

  const languageLabel = useMemo(() => {
    return (
      languages.find(l => l.code === normalizedLocale)?.label ??
      LOCALE_ENDONYMS[DEFAULT_LOCALE] ??
      DEFAULT_LOCALE
    );
  }, [languages, normalizedLocale]);

  const filteredLanguages = useMemo(() => {
    const query = languageSearch.trim().toLowerCase();
    if (!query) return languages;
    return languages.filter(lang => lang.label.toLowerCase().includes(query));
  }, [languageSearch, languages]);

  const handleLanguageSelect = useCallback(
    (code: AppLanguage) => {
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
    },
    [languageModal.savedToastPrefix.value, languages, setLocale],
  );

  const openLanguageMenu = useCallback(() => {
    setLanguageSearch('');
    setLanguageModalOpen(true);
    setMobileMenuOpen(false);
  }, [setMobileMenuOpen]);

  const closeLanguageMenu = useCallback(() => {
    setLanguageModalOpen(false);
    setLanguageSearch('');
  }, []);

  return {
    languageModalOpen,
    languageSearch,
    setLanguageSearch,
    languages,
    languageLabel,
    normalizedLocale,
    filteredLanguages,
    handleLanguageSelect,
    openLanguageMenu,
    closeLanguageMenu,
  };
}

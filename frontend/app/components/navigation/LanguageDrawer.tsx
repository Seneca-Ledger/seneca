'use client';

import React from 'react';
import { Check, ChevronLeft, Search } from '@/app/components/icons';
import { DrawerShell } from '@/app/components/ui/drawer-shell';
import { useIntlayer } from '@/app/i18n';

type LanguageDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  languageModal: { title: React.ReactNode };
  languageSearch: string;
  setLanguageSearch: (v: string) => void;
  filteredLanguages: { code: string; label: string }[];
  normalizedLocale: string;
  handleLanguageSelect: (code: string) => void;
};

export function LanguageDrawer({
  isOpen,
  onClose,
  languageModal,
  languageSearch,
  setLanguageSearch,
  filteredLanguages,
  normalizedLocale,
  handleLanguageSelect,
}: LanguageDrawerProps): React.JSX.Element {
  const { shell } = useIntlayer('navigation');
  return (
    <DrawerShell
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="seneca-navigation__lang-header">
          <button
            type="button"
            onClick={onClose}
            className="seneca-navigation__lang-back-btn"
            aria-label={shell.closeLanguageDrawer.value}
          >
            <ChevronLeft style={{ width: 20, height: 20 }} />
          </button>
          <span>{languageModal.title}</span>
        </div>
      }
      position="right"
      width="sm"
      showCloseButton={false}
    >
      <div className="seneca-navigation__lang-body">
        <div className="seneca-navigation__lang-scroll">
          <div className="seneca-navigation__lang-search-wrapper">
            <Search className="seneca-navigation__lang-search-icon" />
            <input
              type="text"
              value={languageSearch}
              onChange={e => {
                setLanguageSearch(e.target.value);
              }}
              placeholder={shell.search.value}
              className="seneca-navigation__lang-search-input"
            />
          </div>
          <div className="seneca-navigation__lang-list">
            {filteredLanguages.length > 0 ? (
              filteredLanguages.map(lang => {
                const selected = normalizedLocale === lang.code;
                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => {
                      handleLanguageSelect(lang.code);
                    }}
                    className={`seneca-navigation__lang-option${selected ? ' seneca-navigation__lang-option--selected' : ''}`}
                  >
                    <span className="seneca-navigation__lang-option-label">{lang.label}</span>
                    {selected && (
                      <Check style={{ width: 20, height: 20, color: 'var(--color-primary)' }} />
                    )}
                  </button>
                );
              })
            ) : (
              <p className="seneca-navigation__lang-empty">{shell.noLanguagesFound}</p>
            )}
          </div>
        </div>
      </div>
    </DrawerShell>
  );
}

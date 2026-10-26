'use client';

import Box from '@mui/material/Box';
import { useState } from 'react';
import { Check, Search } from '@/app/components/icons';
import { DrawerShell } from '@/app/components/ui/drawer-shell';
import type { CountryOption } from '../lib/tax-countries';
import { FlagIcon } from './FlagIcon';

interface CountryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  searchPlaceholder: string;
  emptyLabel: string;
  options: CountryOption[];
  selected: string | null;
  onSelect: (code: string) => void;
}

/** The tax countries as a searchable list in a right sidebar, flag first. */
export function CountryDrawer({
  isOpen,
  onClose,
  title,
  searchPlaceholder,
  emptyLabel,
  options,
  selected,
  onSelect,
}: CountryDrawerProps) {
  const [search, setSearch] = useState('');
  const query = search.trim().toLowerCase();
  const visible = query
    ? options.filter(
        option => option.name.toLowerCase().includes(query) || option.code.toLowerCase() === query,
      )
    : options;

  const close = () => {
    setSearch('');
    onClose();
  };

  return (
    <DrawerShell isOpen={isOpen} onClose={close} position="right" width="md" title={title}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pb: 2 }}>
        <Box sx={{ position: 'relative' }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--muted-foreground)',
              pointerEvents: 'none',
            }}
          />
          <Box
            component="input"
            type="text"
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            sx={{
              width: '100%',
              boxSizing: 'border-box',
              py: 1.5,
              pr: 2,
              pl: 5,
              fontSize: 14,
              fontFamily: 'inherit',
              color: 'var(--foreground)',
              bgcolor: 'var(--card-bg)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              outline: 'none',
              '&:focus-visible': { borderColor: 'var(--primary)' },
            }}
          />
        </Box>

        {visible.length === 0 ? (
          <Box
            component="p"
            sx={{
              m: 0,
              px: 1.5,
              py: 1.5,
              fontSize: 14,
              color: 'var(--text-muted)',
            }}
          >
            {emptyLabel}
          </Box>
        ) : (
          <Box
            component="ul"
            sx={{
              m: 0,
              p: 0,
              listStyle: 'none',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {visible.map(option => {
              const isSelected = option.code === selected;
              return (
                <li key={option.code}>
                  <Box
                    component="button"
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => {
                      onSelect(option.code);
                      close();
                    }}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      width: '100%',
                      px: 1.5,
                      py: 1.25,
                      fontSize: 15,
                      fontWeight: isSelected ? 500 : 400,
                      fontFamily: 'inherit',
                      textAlign: 'left',
                      cursor: 'pointer',
                      color: 'var(--foreground)',
                      bgcolor: isSelected ? 'var(--surface-soft)' : 'transparent',
                      border: 'none',
                      borderRadius: 'var(--radius-md)',
                      '&:hover': { bgcolor: 'var(--surface-soft)' },
                    }}
                  >
                    <FlagIcon code={option.code} size={24} />
                    <Box component="span" sx={{ flex: 1, minWidth: 0 }}>
                      {option.name}
                    </Box>
                    {isSelected ? (
                      <Check size={18} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                    ) : null}
                  </Box>
                </li>
              );
            })}
          </Box>
        )}
      </Box>
    </DrawerShell>
  );
}

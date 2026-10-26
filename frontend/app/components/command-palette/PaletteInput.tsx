'use client';

import Box from '@mui/material/Box';
import { useEffect, useRef } from 'react';
import { Search } from '@/app/components/icons';
import { Kbd } from '@/app/components/ui/kbd';
import { useIntlayer } from '@/app/i18n';
import { ShortcutHint } from './ShortcutHint';

/**
 * A plain input rather than a TextField: the global MUI theme pins every
 * outlined input to 40px and 14px, which is not the palette's scale.
 */
export function PaletteInput({
  value,
  onChange,
  onKeyDown,
  pending,
  activeRowId,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
  /** First press of a chord, held back from the field until it resolves. */
  pending: string;
  activeRowId: string | undefined;
  /** A picker asks its own question in place of the usual prompt. */
  placeholder?: string;
}): React.JSX.Element {
  const t = useIntlayer('commandPalette');
  const inputRef = useRef<HTMLInputElement>(null);

  // Not `autoFocus`: under StrictMode the dialog's focus trap re-runs, hands focus
  // back to whatever opened the palette and settles on the dialog itself. An
  // effect re-runs too, ahead of the trap, so the field is focused when it checks.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.5 }}>
      <Box sx={{ display: 'flex', color: 'text.secondary' }}>
        <Search size={18} />
      </Box>
      {pending && <Kbd>{pending}</Kbd>}
      <Box
        component="input"
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded
        aria-controls="command-palette-list"
        aria-activedescendant={activeRowId}
        aria-label={t.ariaLabel.value}
        value={value}
        placeholder={placeholder ?? t.placeholder.value}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        sx={{
          flex: 1,
          minWidth: 0,
          border: 'none',
          bgcolor: 'transparent',
          fontSize: 16,
          color: 'text.primary',
          outline: 'none',
          // The global accessibility ring (`html :focus-visible`) is redundant
          // here: the dialog opens straight onto this field, so there is nothing
          // for the ring to disambiguate. Doubled `&` to outrank that rule.
          'html &&:focus-visible': { outline: 'none' },
        }}
      />
      <ShortcutHint binding="$mod+KeyK" />
    </Box>
  );
}

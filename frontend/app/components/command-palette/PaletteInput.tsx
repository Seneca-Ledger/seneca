'use client';

import Box from '@mui/material/Box';
import { Search } from '@/app/components/icons';
import { Kbd } from '@/app/components/ui/kbd';
import { useIntlayer } from '@/app/i18n';
import { useIsMacPlatform } from './use-is-mac-platform';

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
}: {
  value: string;
  onChange: (value: string) => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
  /** First press of a chord, held back from the field until it resolves. */
  pending: string;
  activeRowId: string | undefined;
}): React.JSX.Element {
  const t = useIntlayer('commandPalette');
  const isMac = useIsMacPlatform();

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.5 }}>
      <Box sx={{ display: 'flex', color: 'text.secondary' }}>
        <Search size={18} />
      </Box>
      {pending && <Kbd>{pending}</Kbd>}
      <Box
        component="input"
        type="text"
        autoFocus
        role="combobox"
        aria-expanded
        aria-controls="command-palette-list"
        aria-activedescendant={activeRowId}
        aria-label={t.ariaLabel.value}
        value={value}
        placeholder={t.placeholder.value}
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
      <Kbd>{isMac ? '⌘K' : 'CTRL K'}</Kbd>
    </Box>
  );
}

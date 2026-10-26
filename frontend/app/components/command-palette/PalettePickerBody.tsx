'use client';

import Typography from '@mui/material/Typography';
import { useMemo, useState } from 'react';
import { useIntlayer } from '@/app/i18n';
import { closeCommandPalette } from './command-palette-store';
import { PaletteInput } from './PaletteInput';
import { PaletteList } from './PaletteList';
import type { PalettePicker } from './page-commands-store';
import { usePaletteKeyboard } from './use-palette-keyboard';
import type { PaletteRow, PaletteSection } from './use-palette-sections';

function toRows(picker: PalettePicker, needle: string): PaletteRow[] {
  return picker.items
    .filter(item => item.label.toLowerCase().includes(needle))
    .map(item => ({
      kind: 'command' as const,
      id: `pick.${item.id}`,
      command: {
        id: `pick.${item.id}`,
        group: 'page' as const,
        label: item.label,
        icon: item.icon,
        hint: item.hint,
        run: () => picker.onPick(item.id),
      },
    }));
}

/** The palette narrowed to one question: pick a category, a table, … */
export function PalettePickerBody({ picker }: { picker: PalettePicker }): React.JSX.Element {
  const t = useIntlayer('commandPalette');
  const [input, setInput] = useState('');
  const needle = input.trim().toLowerCase();
  const rows = useMemo(() => toRows(picker, needle), [picker, needle]);
  const sections: PaletteSection[] = [{ group: 'picker', rows }];

  const run = (row: PaletteRow): void => {
    closeCommandPalette();
    if (row.kind === 'command') {
      row.command.run();
    }
  };
  const { activeIndex, setActiveIndex, onKeyDown } = usePaletteKeyboard(
    rows,
    run,
    closeCommandPalette,
  );

  return (
    <>
      <PaletteInput
        value={input}
        onChange={setInput}
        onKeyDown={onKeyDown}
        pending=""
        placeholder={picker.placeholder}
        activeRowId={rows[activeIndex] ? `command-palette-row-${rows[activeIndex].id}` : undefined}
      />
      {rows.length === 0 ? (
        <Typography sx={{ py: 4, textAlign: 'center', fontSize: 14, color: 'text.secondary' }}>
          {t.noResults}
        </Typography>
      ) : (
        <PaletteList
          sections={sections}
          rows={rows}
          activeIndex={activeIndex}
          onHover={setActiveIndex}
          onSelect={run}
        />
      )}
    </>
  );
}

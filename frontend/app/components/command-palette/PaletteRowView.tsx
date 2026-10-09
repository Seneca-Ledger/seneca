'use client';

import Box from '@mui/material/Box';
import { alpha } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { useEffect, useRef } from 'react';
import { tokens } from '@/lib/theme-tokens';
import { ShortcutHint } from './ShortcutHint';
import { KIND_ICONS, type PaletteRow } from './use-palette-sections';

/**
 * A div, not a button: a focusable row would pull focus out of the input and
 * break the `aria-activedescendant` the listbox pattern relies on.
 */
export function PaletteRowView({
  row,
  active,
  onHover,
  onSelect,
}: {
  row: PaletteRow;
  active: boolean;
  onHover: () => void;
  onSelect: () => void;
}): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null);

  // The cursor is driven by the keyboard, so the list has to follow it.
  useEffect(() => {
    if (active) {
      // jsdom has no scrollIntoView, and neither do some embedded webviews.
      ref.current?.scrollIntoView?.({ block: 'nearest' });
    }
  }, [active]);

  const icon = row.kind === 'command' ? row.command.icon : KIND_ICONS[row.result.kind];
  const label = row.kind === 'command' ? row.command.label : row.result.title;
  const subtitle = row.kind === 'result' ? row.result.subtitle : null;
  const binding = row.kind === 'command' ? row.command.binding : undefined;

  return (
    <Box
      ref={ref}
      id={`command-palette-row-${row.id}`}
      role="option"
      aria-selected={active}
      onMouseMove={onHover}
      onClick={onSelect}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: 1.5,
        py: 1,
        mx: 1,
        borderRadius: tokens.radius.md,
        cursor: 'pointer',
        color: 'text.primary',
        // A neutral wash alone marks the cursor — no coloured edge.
        bgcolor: active ? theme => alpha(theme.palette.text.primary, 0.1) : 'transparent',
      }}
    >
      <Box sx={{ display: 'grid', placeItems: 'center', flexShrink: 0, color: 'text.secondary' }}>
        {icon}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          sx={{
            fontSize: 14,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </Typography>
        {subtitle && (
          <Typography
            sx={{
              fontSize: 12,
              color: 'text.secondary',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {subtitle}
          </Typography>
        )}
      </Box>
      {binding && <ShortcutHint binding={binding} />}
    </Box>
  );
}

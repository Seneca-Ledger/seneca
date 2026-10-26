'use client';

import Box from '@mui/material/Box';
import type * as React from 'react';
import { useRef } from 'react';

export interface ChoiceCardOption<T extends string> {
  value: T;
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
}

interface ChoiceCardsProps<T extends string> {
  options: ReadonlyArray<ChoiceCardOption<T>>;
  /** Null when nothing is chosen yet: no card is pre-selected for a question that must be answered. */
  value: T | null;
  onChange: (value: T) => void;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  /** Cards per row from `sm` up; one per row on phones. */
  columns?: number;
}

const NEXT_KEYS = new Set(['ArrowRight', 'ArrowDown']);
const PREVIOUS_KEYS = new Set(['ArrowLeft', 'ArrowUp']);

/**
 * A radio group drawn as cards: a hairline frame, a green one when chosen.
 *
 * Arrow keys move the choice, as in a native radio group, and only the chosen
 * card (or the first, before any choice) sits in the tab order.
 */
export function ChoiceCards<T extends string>({
  options,
  value,
  onChange,
  columns = 2,
  ...aria
}: ChoiceCardsProps<T>): React.ReactElement {
  const buttonsRef = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = options.findIndex(option => option.value === value);
  const tabStop = selectedIndex === -1 ? 0 : selectedIndex;

  const handleKeyDown = (event: React.KeyboardEvent, index: number): void => {
    const step = NEXT_KEYS.has(event.key) ? 1 : PREVIOUS_KEYS.has(event.key) ? -1 : 0;
    if (step === 0) {
      return;
    }
    event.preventDefault();
    const next = (index + step + options.length) % options.length;
    onChange(options[next].value);
    buttonsRef.current[next]?.focus();
  };

  return (
    <Box
      role="radiogroup"
      {...aria}
      sx={{
        display: 'grid',
        gap: 1.5,
        gridTemplateColumns: { xs: '1fr', sm: `repeat(${columns}, minmax(0, 1fr))` },
      }}
    >
      {options.map((option, index) => {
        const checked = option.value === value;
        return (
          <Box
            key={option.value}
            component="button"
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={index === tabStop ? 0 : -1}
            ref={(node: HTMLButtonElement | null) => {
              buttonsRef.current[index] = node;
            }}
            onClick={() => onChange(option.value)}
            onKeyDown={(event: React.KeyboardEvent) => handleKeyDown(event, index)}
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 1.5,
              p: 2,
              minWidth: 0,
              textAlign: 'start',
              font: 'inherit',
              color: 'var(--foreground)',
              bgcolor: 'transparent',
              border: '1px solid',
              borderColor: checked ? 'var(--primary)' : 'var(--border-color)',
              // An inset ring doubles the frame without shifting the layout by a pixel.
              boxShadow: checked ? 'inset 0 0 0 1px var(--primary)' : 'none',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              transition: 'border-color 150ms ease, box-shadow 150ms ease',
              '&:hover': { borderColor: checked ? 'var(--primary)' : 'var(--muted-foreground)' },
              '&:focus-visible': { outline: '2px solid var(--ring)', outlineOffset: 2 },
            }}
          >
            {option.icon ? (
              <Box
                component="span"
                aria-hidden
                sx={{
                  display: 'inline-flex',
                  mt: '2px',
                  color: checked ? 'var(--primary)' : 'var(--muted-foreground)',
                }}
              >
                {option.icon}
              </Box>
            ) : null}
            <Box component="span" sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <Box component="span" sx={{ fontSize: 15, fontWeight: 600 }}>
                {option.title}
              </Box>
              {option.description ? (
                <Box
                  component="span"
                  sx={{ fontSize: 13, lineHeight: 1.5, color: 'var(--muted-foreground)' }}
                >
                  {option.description}
                </Box>
              ) : null}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

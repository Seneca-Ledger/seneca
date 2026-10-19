'use client';

import Box from '@mui/material/Box';
import { alpha } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import type React from 'react';
import { ChevronLeft, ChevronRight, Search } from '@/app/components/icons';
import { useIntlayer } from '@/app/i18n';
import { tokens } from '@/lib/theme-tokens';

/** Section caption above a group of rows. */
export function PanelSectionLabel({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <Typography
      component="div"
      sx={{
        px: 1,
        pb: 0.75,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: 'text.secondary',
      }}
    >
      {children}
    </Typography>
  );
}

export function PanelSearchField({
  value,
  placeholder,
  onChange,
  tourId,
  autoFocus,
  ariaLabel,
}: {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  tourId?: string;
  autoFocus?: boolean;
  ariaLabel?: string;
}): React.JSX.Element {
  return (
    <Box sx={{ position: 'relative' }}>
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 12,
          display: 'flex',
          alignItems: 'center',
          pointerEvents: 'none',
          color: 'text.secondary',
        }}
      >
        <Search size={16} />
      </Box>
      <Box
        component="input"
        type="text"
        data-tour-id={tourId}
        autoFocus={autoFocus}
        aria-label={ariaLabel}
        value={value}
        placeholder={placeholder}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
        // Flat: only a bottom hairline, which turns brand green on focus.
        sx={{
          width: '100%',
          border: 'none',
          borderBottom: '1px solid',
          borderColor: 'divider',
          borderRadius: 0,
          bgcolor: 'transparent',
          padding: '8px 12px 8px 36px',
          fontSize: 14,
          color: 'text.primary',
          outline: 'none',
          transition: 'border-color 120ms ease',
          '&:focus': { borderColor: 'primary.main' },
          '&:focus-visible': { outline: 'none', borderBottomWidth: 2, pb: '7px' },
        }}
      />
    </Box>
  );
}

/** One selectable entry in a first-layer list. */
export function PanelRow({
  icon,
  name,
  description,
  status,
  onClick,
  trailing,
  dataAttributes,
}: {
  icon: React.ReactNode;
  name: React.ReactNode;
  description: React.ReactNode;
  status?: React.ReactNode;
  onClick: () => void;
  /** Rendered instead of the chevron, for rows with their own control. */
  trailing?: React.ReactNode;
  dataAttributes?: Record<string, string>;
}): React.JSX.Element {
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      {...dataAttributes}
      sx={{
        display: 'flex',
        width: '100%',
        alignItems: 'center',
        gap: 1.5,
        px: 1,
        py: 1.25,
        border: 'none',
        borderRadius: tokens.radius.md,
        bgcolor: 'transparent',
        textAlign: 'left',
        cursor: 'pointer',
        color: 'text.primary',
        // A faint neutral wash with a thin green edge; action.hover is brand green in this theme.
        '&:hover': {
          bgcolor: theme => alpha(theme.palette.text.primary, 0.05),
          boxShadow: theme => `inset 2px 0 0 ${theme.palette.primary.main}`,
        },
        '&:focus-visible': { outline: '2px solid var(--color-primary)', outlineOffset: -2 },
      }}
    >
      <Box
        sx={{
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
          // No tile behind the icon: it sits straight on the panel.
          width: 28,
          height: 36,
          color: 'text.secondary',
        }}
      >
        {icon}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'text.primary' }}>
          {name}
        </Typography>
        <Typography
          sx={{
            fontSize: 12,
            color: 'text.secondary',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {description}
        </Typography>
      </Box>
      {status}
      {trailing ?? <ChevronRight size={16} style={{ flexShrink: 0, opacity: 0.5 }} />}
    </Box>
  );
}

/** Connection state next to a row, kept to a dot and a word. */
export function PanelStatusDot({
  connected,
  label,
}: {
  connected: boolean;
  label: string;
}): React.JSX.Element {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        flexShrink: 0,
        fontSize: 12,
        fontWeight: 600,
        color: connected ? 'success.main' : 'text.secondary',
      }}
    >
      <Box
        component="span"
        sx={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          bgcolor: connected ? 'success.main' : 'action.disabled',
        }}
      />
      {label}
    </Box>
  );
}

/** Second-layer header: back to the list, then the entry name. */
export function PanelBackTitle({
  title,
  onBack,
}: {
  title: React.ReactNode;
  onBack: () => void;
}): React.JSX.Element {
  const t = useIntlayer('panelUi');
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Box
        component="button"
        type="button"
        onClick={onBack}
        aria-label={t.backToList.value}
        sx={{
          display: 'grid',
          placeItems: 'center',
          width: 32,
          height: 32,
          border: 'none',
          borderRadius: tokens.radius.md,
          bgcolor: 'transparent',
          color: 'text.secondary',
          cursor: 'pointer',
          '&:hover': { bgcolor: 'action.hover', color: 'text.primary' },
        }}
      >
        <ChevronLeft size={20} />
      </Box>
      <Typography component="span" sx={{ fontSize: 17, fontWeight: 700, color: 'text.primary' }}>
        {title}
      </Typography>
    </Box>
  );
}

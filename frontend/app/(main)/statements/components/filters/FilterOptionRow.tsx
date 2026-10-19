'use client';

import Box from '@mui/material/Box';
import type { JSX } from 'react';
import { BankLogoAvatar } from '@/app/components/BankLogoAvatar';
import { Check, Receipt } from '@/app/components/icons';
import { normalizeAvatarUrl } from '@/app/lib/avatar-url';
import { tokens } from '@/lib/theme-tokens';

type FilterOptionRowProps = {
  label: string;
  selected: boolean;
  onClick: () => void;
  variant?: 'radio' | 'checkbox';
  className?: string;
  // Avatar props (when provided, renders avatar + optional description)
  description?: string | null;
  avatarUrl?: string | null;
  iconUrl?: string | null;
  bankName?: string | null;
};

export function FilterOptionRow({
  label,
  selected,
  onClick,
  className,
  description,
  avatarUrl,
  iconUrl,
  bankName,
}: FilterOptionRowProps): JSX.Element {
  const hasAvatar = avatarUrl != null || iconUrl != null || bankName != null;

  const checkIndicator = (
    <Box
      component="span"
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 24,
        height: 24,
        borderRadius: tokens.radius.xs,
        bgcolor: theme =>
          selected
            ? // Dark green in both themes; dark mode's primary.main is a light green.
              (theme.palette.mode === 'dark' ? tokens.dark.color : tokens.color).primaryFill
            : theme.palette.mode === 'dark'
              ? 'rgba(232, 232, 240, 0.18)'
              : theme.palette.grey[100],
        color: selected ? 'primary.contrastText' : 'transparent',
        flexShrink: 0,
      }}
    >
      {selected && <Check size={16} />}
    </Box>
  );

  if (hasAvatar) {
    const fallbackLetter = label.trim().charAt(0).toUpperCase() || 'U';
    const resolvedAvatarUrl = normalizeAvatarUrl(avatarUrl);
    const normalizedBankName = bankName?.trim().toLowerCase() || null;

    return (
      <button
        type="button"
        onClick={onClick}
        className={className}
        style={{
          display: 'flex',
          width: '100%',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '12px 8px',
          textAlign: 'left',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          borderRadius: tokens.radius.md,
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.background = 'var(--muted)';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.background = 'none';
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {iconUrl ? (
            <img
              src={iconUrl}
              alt={label}
              style={{
                width: 32,
                height: 32,
                borderRadius: tokens.radius.full,
                objectFit: 'contain',
              }}
            />
          ) : normalizedBankName === 'receipt' ? (
            <Box
              component="span"
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
                borderRadius: tokens.radius.full,
                bgcolor: 'grey.100',
                color: 'text.secondary',
              }}
              aria-label={label}
              title={label}
            >
              <Receipt data-testid="receipt-filter-icon" size={24} />
            </Box>
          ) : bankName ? (
            <BankLogoAvatar bankName={bankName} size={32} />
          ) : resolvedAvatarUrl ? (
            <img
              src={resolvedAvatarUrl}
              alt={label}
              style={{
                width: 32,
                height: 32,
                borderRadius: tokens.radius.full,
                objectFit: 'cover',
              }}
            />
          ) : (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
                borderRadius: tokens.radius.full,
                bgcolor: 'grey.100',
                fontSize: 12,
                fontWeight: 600,
                color: 'text.secondary',
              }}
            >
              {fallbackLetter}
            </Box>
          )}
          <Box>
            <Box sx={{ fontSize: 16, fontWeight: 600, color: 'text.primary' }}>{label}</Box>
            {description ? (
              <Box sx={{ fontSize: 14, color: 'text.secondary' }}>{description}</Box>
            ) : null}
          </Box>
        </Box>
        {checkIndicator}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={className}
      style={{
        display: 'flex',
        width: '100%',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '12px 8px',
        textAlign: 'left',
        fontSize: 16,
        fontWeight: 600,
        color: 'var(--foreground)',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLButtonElement).style.background = 'var(--muted)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.background = 'none';
      }}
    >
      <span>{label}</span>
      {checkIndicator}
    </button>
  );
}

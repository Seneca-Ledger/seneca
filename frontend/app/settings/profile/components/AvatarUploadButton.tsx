'use client';

import Box from '@mui/material/Box';
import { alpha } from '@mui/material/styles';
import type React from 'react';
import type { ChangeEvent, RefObject } from 'react';
import { Pencil } from '@/app/components/icons';
import { tokens } from '@/lib/theme-tokens';

type Props = {
  avatarUrl: string | null | undefined;
  displayName: string;
  initials: string;
  showImage: boolean;
  disabled: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  onSelect: (event: ChangeEvent<HTMLInputElement>) => void;
  onImageError: () => void;
};

/** Avatar circle that opens a file picker; the badge hints that it is editable. */
export function AvatarUploadButton({
  avatarUrl,
  displayName,
  initials,
  showImage,
  disabled,
  inputRef,
  onSelect,
  onImageError,
}: Props): React.JSX.Element {
  return (
    <Box sx={{ position: 'relative', flexShrink: 0 }}>
      <Box
        component="button"
        type="button"
        aria-label={displayName}
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        sx={{
          display: 'flex',
          height: { xs: 64, sm: 80 },
          width: { xs: 64, sm: 80 },
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          borderRadius: tokens.radius.full,
          bgcolor: theme => alpha(theme.palette.primary.main, 0.16),
          color: 'primary.main',
          fontSize: 16,
          fontWeight: 600,
          cursor: 'pointer',
          border: 'none',
          p: 0,
        }}
      >
        {avatarUrl && showImage ? (
          <img
            src={avatarUrl}
            alt={displayName}
            style={{ height: '100%', width: '100%', objectFit: 'cover' }}
            onError={onImageError}
          />
        ) : (
          initials
        )}
      </Box>
      <Box
        sx={{
          position: 'absolute',
          bottom: -4,
          right: -4,
          display: 'flex',
          height: 28,
          width: 28,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: tokens.radius.full,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          color: 'text.secondary',
          boxShadow: 1,
          pointerEvents: 'none',
        }}
      >
        <Pencil size={14} />
      </Box>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={onSelect}
        style={{ display: 'none' }}
      />
    </Box>
  );
}

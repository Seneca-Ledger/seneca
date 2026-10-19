'use client';

import Box from '@mui/material/Box';
import type React from 'react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Lightbulb } from '@/app/components/icons';
import { useAuth } from '@/app/hooks/useAuth';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { checkContract } from '@/app/lib/query-fn-schema';
import { tokens } from '@/lib/theme-tokens';

/**
 * Settings → Advanced, under the links to elsewhere: brings every page's hints
 * back. Styled as one more row of that list.
 */
export function ResetPageHintsButton(): React.JSX.Element {
  const { reset } = useIntlayer('pageHints');
  const { setUser } = useAuth();
  const [busy, setBusy] = useState(false);

  const handleClick = async (): Promise<void> => {
    setBusy(true);
    try {
      const response = await apiClient.delete('/users/me/page-hints');
      const { pageHintsSeen } = await checkContract(
        'PageHintsSeen',
        response.data,
        '/users/me/page-hints',
      );
      // Merged into the user the app holds, never replacing it.
      setUser(current => (current ? { ...current, pageHintsSeen } : current));
      toast.success(reset.done.value);
    } catch {
      toast.error(reset.error.value);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box
      component="button"
      type="button"
      disabled={busy}
      onClick={() => void handleClick()}
      sx={{
        border: 'none',
        bgcolor: 'transparent',
        cursor: 'pointer',
        textAlign: 'left',
        font: 'inherit',
        display: 'flex',
        width: '100%',
        alignItems: 'center',
        gap: 1.5,
        borderRadius: tokens.radius.md,
        px: 1.5,
        py: 1.25,
        fontSize: 14,
        fontWeight: 500,
        color: 'text.secondary',
        '&:hover': { bgcolor: 'action.hover', color: 'text.primary' },
        '&:disabled': { cursor: 'default', opacity: 0.6 },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          height: 32,
          width: 32,
          alignItems: 'center',
          justifyContent: 'center',
          color: 'text.secondary',
        }}
      >
        <Lightbulb size={18} />
      </Box>
      <span>{reset.action}</span>
    </Box>
  );
}

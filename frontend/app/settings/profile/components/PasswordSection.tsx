'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type { FormEvent } from 'react';
import { Alert } from '@/app/components/ui/alert';
import { EmptyStateIllustration } from '@/app/components/ui/EmptyStateIllustration';
import { Spinner } from '@/app/components/ui/spinner';

type Passwords = { current: string; next: string; confirm: string };

type Props = {
  t: {
    passwordCard: {
      currentPasswordLabel: { value: string };
      newPasswordLabel: { value: string };
      newPasswordHelp: { value: string };
      confirmPasswordLabel: { value: string };
      submit: { value: string };
    };
  };
  tx: (path: string[], fallback: string) => string;
  passwordMessage: string | null;
  passwordError: string | null;
  passwordLoading: boolean;
  passwords: Passwords;
  setPasswords: (p: Passwords) => void;
  handlePasswordSubmit: (e: FormEvent) => void;
};

export function PasswordSection({
  t,
  tx,
  passwordMessage,
  passwordError,
  passwordLoading,
  passwords,
  setPasswords,
  handlePasswordSubmit,
}: Props) {
  return (
    <Box
      component="form"
      sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}
      onSubmit={handlePasswordSubmit}
    >
      <EmptyStateIllustration name="password" size="sm" />
      {passwordMessage && <Alert variant="success">{passwordMessage}</Alert>}
      {passwordError && <Alert variant="error">{passwordError}</Alert>}
      <Alert variant="warning">
        {tx(
          ['passwordCard', 'securityHint'],
          'Use a unique password and keep your account email secure. Confirm before applying password changes.',
        )}
      </Alert>

      <Stack spacing={0.5}>
        <Typography component="label" htmlFor="password-current" variant="body2" fontWeight={600}>
          {t.passwordCard.currentPasswordLabel.value}
        </Typography>
        <TextField
          id="password-current"
          type="password"
          size="small"
          value={passwords.current}
          onChange={e => setPasswords({ ...passwords, current: e.target.value })}
          required
          fullWidth
        />
      </Stack>

      <Divider />

      <Stack spacing={0.5}>
        <Typography component="label" htmlFor="password-next" variant="body2" fontWeight={600}>
          {t.passwordCard.newPasswordLabel.value}
        </Typography>
        <TextField
          id="password-next"
          type="password"
          size="small"
          value={passwords.next}
          onChange={e => setPasswords({ ...passwords, next: e.target.value })}
          required
          fullWidth
        />
        <Typography variant="caption" color="text.secondary">
          {t.passwordCard.newPasswordHelp.value}
        </Typography>
      </Stack>

      <Stack spacing={0.5}>
        <Typography component="label" htmlFor="password-confirm" variant="body2" fontWeight={600}>
          {t.passwordCard.confirmPasswordLabel.value}
        </Typography>
        <TextField
          id="password-confirm"
          type="password"
          size="small"
          value={passwords.confirm}
          onChange={e => setPasswords({ ...passwords, confirm: e.target.value })}
          required
          fullWidth
        />
      </Stack>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          type="submit"
          variant="contained"
          color="secondary"
          disabled={passwordLoading}
          startIcon={passwordLoading ? <Spinner size={16} /> : undefined}
        >
          {t.passwordCard.submit.value}
        </Button>
      </Box>
    </Box>
  );
}

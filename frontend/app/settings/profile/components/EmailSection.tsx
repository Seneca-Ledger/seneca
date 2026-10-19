'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type { FormEvent } from 'react';
import { Alert } from '@/app/components/ui/alert';
import { Spinner } from '@/app/components/ui/spinner';

type Props = {
  t: {
    emailCard: {
      newEmailLabel: { value: string };
      currentPasswordLabel: { value: string };
      currentPasswordHelp: { value: string };
      submit: { value: string };
    };
  };
  email: string;
  setEmail: (v: string) => void;
  emailPassword: string;
  setEmailPassword: (v: string) => void;
  emailMessage: string | null;
  emailError: string | null;
  emailLoading: boolean;
  handleEmailSubmit: (e: FormEvent) => void;
};

export function EmailSection({
  t,
  email,
  setEmail,
  emailPassword,
  setEmailPassword,
  emailMessage,
  emailError,
  emailLoading,
  handleEmailSubmit,
}: Props) {
  return (
    <Box
      component="form"
      sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}
      onSubmit={handleEmailSubmit}
    >
      {emailMessage && <Alert variant="success">{emailMessage}</Alert>}
      {emailError && <Alert variant="error">{emailError}</Alert>}

      <Stack spacing={0.5}>
        <Typography component="label" htmlFor="email-next" variant="body2" fontWeight={600}>
          {t.emailCard.newEmailLabel.value}
        </Typography>
        <TextField
          id="email-next"
          type="email"
          size="small"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          fullWidth
        />
      </Stack>

      <Stack spacing={0.5}>
        <Typography component="label" htmlFor="email-password" variant="body2" fontWeight={600}>
          {t.emailCard.currentPasswordLabel.value}
        </Typography>
        <TextField
          id="email-password"
          type="password"
          size="small"
          value={emailPassword}
          onChange={e => setEmailPassword(e.target.value)}
          required
          fullWidth
        />
        <Typography variant="caption" color="text.secondary">
          {t.emailCard.currentPasswordHelp.value}
        </Typography>
      </Stack>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          type="submit"
          variant="contained"
          color="primary"
          disabled={emailLoading}
          startIcon={emailLoading ? <Spinner size={16} /> : undefined}
        >
          {t.emailCard.submit.value}
        </Button>
      </Box>
    </Box>
  );
}

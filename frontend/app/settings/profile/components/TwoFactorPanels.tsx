'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { type FormEvent, useState } from 'react';
import { Alert } from '@/app/components/ui/alert';
import { Spinner } from '@/app/components/ui/spinner';
import type { UserFormatPreferences } from '@/app/lib/user-format';
import { RecoveryCodesDownloadButton } from '@/app/settings/profile/components/RecoveryCodesDownloadButton';
import type { UseTwoFactorReturn } from '@/app/settings/profile/hooks/useTwoFactor';

export type Tx = (path: string[], fallback: string) => string;

type PasswordPromptProps = {
  tx: Tx;
  submitLabel: string;
  busy: boolean;
  destructive?: boolean;
  onSubmit: (password: string) => void;
  onCancel?: () => void;
};

/** Password re-entry gate: a hijacked session must not be able to touch 2FA. */
export function PasswordPrompt({
  tx,
  submitLabel,
  busy,
  destructive,
  onSubmit,
  onCancel,
}: PasswordPromptProps) {
  const [password, setPassword] = useState('');

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit(password);
    setPassword('');
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ display: 'grid', gap: 1 }}>
      <TextField
        type="password"
        size="small"
        autoComplete="current-password"
        label={tx(['passwordCard', 'currentPasswordLabel'], 'Current password')}
        value={password}
        onChange={event => setPassword(event.target.value)}
        required
        fullWidth
      />
      <Stack direction="row" spacing={1} justifyContent="flex-end">
        {onCancel ? (
          <Button onClick={onCancel} disabled={busy}>
            {tx(['securityCard', 'cancelButton'], 'Cancel')}
          </Button>
        ) : null}
        <Button
          type="submit"
          variant="contained"
          color={destructive ? 'error' : 'secondary'}
          disabled={busy || !password}
          startIcon={busy ? <Spinner size={16} /> : undefined}
        >
          {submitLabel}
        </Button>
      </Stack>
    </Box>
  );
}

export function RecoveryCodesPanel({
  tx,
  codes,
  email,
  formatPreferences,
  onDone,
}: {
  tx: Tx;
  codes: string[];
  email: string;
  formatPreferences: UserFormatPreferences;
  onDone: () => void;
}) {
  return (
    <Card variant="outlined">
      <CardContent sx={{ display: 'grid', gap: 1.5 }}>
        <Typography variant="subtitle1" fontWeight={600}>
          {tx(['securityCard', 'recoveryTitle'], 'Recovery codes')}
        </Typography>
        <Alert variant="warning">
          {tx(
            ['securityCard', 'recoveryHint'],
            'Save these codes now — they are shown only once. Each code works a single time instead of an app code.',
          )}
        </Alert>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
            gap: 0.5,
            fontFamily: 'monospace',
          }}
        >
          {codes.map(code => (
            <Typography key={code} variant="body2" fontFamily="monospace">
              {code}
            </Typography>
          ))}
        </Box>
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" justifyContent="flex-end">
          <Button
            onClick={() => navigator.clipboard?.writeText(codes.join('\n'))}
            variant="outlined"
          >
            {tx(['securityCard', 'copyButton'], 'Copy')}
          </Button>
          <RecoveryCodesDownloadButton
            tx={tx}
            codes={codes}
            email={email}
            formatPreferences={formatPreferences}
          />
          <Button onClick={onDone} variant="contained" color="secondary">
            {tx(['securityCard', 'doneButton'], 'Done')}
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}

type SetupPanelProps = {
  tx: Tx;
  setup: NonNullable<UseTwoFactorReturn['setup']>;
  busy: boolean;
  onConfirm: (code: string) => void;
  onCancel: () => void;
};

export function SetupPanel({ tx, setup, busy, onConfirm, onCancel }: SetupPanelProps) {
  const [code, setCode] = useState('');

  return (
    <Card variant="outlined">
      <CardContent
        component="form"
        sx={{ display: 'grid', gap: 1.5 }}
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          onConfirm(code);
        }}
      >
        <Typography variant="body2" color="text.secondary">
          {tx(
            ['securityCard', 'scanHint'],
            'Scan the QR code with Google Authenticator, 1Password, Authy or any TOTP app.',
          )}
        </Typography>
        <Box
          component="img"
          src={setup.qrDataUrl}
          alt=""
          sx={{ width: 180, height: 180, alignSelf: 'center', borderRadius: 1 }}
        />
        <Stack spacing={0.25}>
          <Typography variant="caption" color="text.secondary">
            {tx(['securityCard', 'manualKeyLabel'], 'Or enter this key manually')}
          </Typography>
          <Typography variant="body2" fontFamily="monospace" sx={{ wordBreak: 'break-all' }}>
            {setup.secret}
          </Typography>
        </Stack>
        <TextField
          size="small"
          label={tx(['securityCard', 'codeLabel'], 'Code from the app')}
          value={code}
          onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
          inputProps={{ inputMode: 'numeric', autoComplete: 'one-time-code' }}
          required
          fullWidth
        />
        <Stack direction="row" spacing={1} justifyContent="flex-end">
          <Button onClick={onCancel} disabled={busy}>
            {tx(['securityCard', 'cancelButton'], 'Cancel')}
          </Button>
          <Button
            type="submit"
            variant="contained"
            color="secondary"
            disabled={busy || code.length !== 6}
            startIcon={busy ? <Spinner size={16} /> : undefined}
          >
            {tx(['securityCard', 'confirmButton'], 'Confirm and enable')}
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}

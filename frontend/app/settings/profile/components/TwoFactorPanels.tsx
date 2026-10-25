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

export type Tx = (path: string[]) => string;

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
        label={tx(['passwordCard', 'currentPasswordLabel'])}
        value={password}
        onChange={event => setPassword(event.target.value)}
        required
        fullWidth
      />
      <Stack
        direction="row"
        spacing={1}
        sx={{
          justifyContent: 'flex-end',
        }}
      >
        {onCancel ? (
          <Button onClick={onCancel} disabled={busy}>
            {tx(['securityCard', 'cancelButton'])}
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
        <Typography
          variant="subtitle1"
          sx={{
            fontWeight: 600,
          }}
        >
          {tx(['securityCard', 'recoveryTitle'])}
        </Typography>
        <Alert variant="warning">{tx(['securityCard', 'recoveryHint'])}</Alert>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
            gap: 0.5,
            fontFamily: 'monospace',
          }}
        >
          {codes.map(code => (
            <Typography
              key={code}
              variant="body2"
              sx={{
                fontFamily: 'monospace',
              }}
            >
              {code}
            </Typography>
          ))}
        </Box>
        <Stack
          direction="row"
          spacing={1}
          useFlexGap
          sx={{
            flexWrap: 'wrap',
            justifyContent: 'flex-end',
          }}
        >
          <Button
            onClick={() => navigator.clipboard?.writeText(codes.join('\n'))}
            variant="outlined"
          >
            {tx(['securityCard', 'copyButton'])}
          </Button>
          <RecoveryCodesDownloadButton
            tx={tx}
            codes={codes}
            email={email}
            formatPreferences={formatPreferences}
          />
          <Button onClick={onDone} variant="contained" color="secondary">
            {tx(['securityCard', 'doneButton'])}
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
        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
          }}
        >
          {tx(['securityCard', 'scanHint'])}
        </Typography>
        <Box
          component="img"
          src={setup.qrDataUrl}
          alt=""
          sx={{ width: 180, height: 180, alignSelf: 'center', borderRadius: 1 }}
        />
        <Stack spacing={0.25}>
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
            }}
          >
            {tx(['securityCard', 'manualKeyLabel'])}
          </Typography>
          <Typography
            variant="body2"
            sx={{
              fontFamily: 'monospace',
              wordBreak: 'break-all',
            }}
          >
            {setup.secret}
          </Typography>
        </Stack>
        <TextField
          size="small"
          label={tx(['securityCard', 'codeLabel'])}
          value={code}
          onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
          required
          fullWidth
          slotProps={{
            htmlInput: { inputMode: 'numeric', autoComplete: 'one-time-code' },
          }}
        />
        <Stack
          direction="row"
          spacing={1}
          sx={{
            justifyContent: 'flex-end',
          }}
        >
          <Button onClick={onCancel} disabled={busy}>
            {tx(['securityCard', 'cancelButton'])}
          </Button>
          <Button
            type="submit"
            variant="contained"
            color="secondary"
            disabled={busy || code.length !== 6}
            startIcon={busy ? <Spinner size={16} /> : undefined}
          >
            {tx(['securityCard', 'confirmButton'])}
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}

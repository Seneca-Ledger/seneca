'use client';

import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { Alert } from '@/app/components/ui/alert';
import { EmptyStateIllustration } from '@/app/components/ui/EmptyStateIllustration';
import { Spinner } from '@/app/components/ui/spinner';
import type { UserFormatPreferences } from '@/app/lib/user-format';
import {
  PasswordPrompt,
  RecoveryCodesPanel,
  SetupPanel,
  type Tx,
} from '@/app/settings/profile/components/TwoFactorPanels';
import type { UseTwoFactorReturn } from '@/app/settings/profile/hooks/useTwoFactor';

type EnabledPanelProps = {
  tx: Tx;
  remaining: number;
  busy: boolean;
  onDisable: (password: string) => void;
  onRegenerate: (password: string) => void;
};

function EnabledPanel({ tx, remaining, busy, onDisable, onRegenerate }: EnabledPanelProps) {
  const [pending, setPending] = useState<'disable' | 'regenerate' | null>(null);

  return (
    <Card variant="outlined">
      <CardContent sx={{ display: 'grid', gap: 1.5 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip
            size="small"
            color="success"
            label={tx(['securityCard', 'statusEnabled'], 'Enabled')}
          />
          <Typography variant="body2" color="text.secondary">
            {tx(['securityCard', 'recoveryRemaining'], 'Recovery codes left')}: {remaining}
          </Typography>
        </Stack>

        {pending ? (
          <PasswordPrompt
            tx={tx}
            busy={busy}
            destructive={pending === 'disable'}
            submitLabel={
              pending === 'disable'
                ? tx(['securityCard', 'disableButton'], 'Disable 2FA')
                : tx(['securityCard', 'regenerateButton'], 'Generate new codes')
            }
            onCancel={() => setPending(null)}
            onSubmit={password => {
              setPending(null);
              (pending === 'disable' ? onDisable : onRegenerate)(password);
            }}
          />
        ) : (
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button variant="outlined" onClick={() => setPending('regenerate')}>
              {tx(['securityCard', 'regenerateButton'], 'Generate new codes')}
            </Button>
            <Button color="error" onClick={() => setPending('disable')}>
              {tx(['securityCard', 'disableButton'], 'Disable 2FA')}
            </Button>
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}

function DisabledPanel({
  tx,
  busy,
  onStart,
}: {
  tx: Tx;
  busy: boolean;
  onStart: (password: string) => void;
}) {
  return (
    <Card variant="outlined">
      {/* The section header already carries the description — no need to repeat it here. */}
      <CardContent sx={{ display: 'grid', gap: 1.5 }}>
        <EmptyStateIllustration name="security" size="sm" />
        <PasswordPrompt
          tx={tx}
          busy={busy}
          submitLabel={tx(['securityCard', 'enableButton'], 'Enable 2FA')}
          onSubmit={onStart}
        />
      </CardContent>
    </Card>
  );
}

type Props = {
  tx: Tx;
  twoFactor: UseTwoFactorReturn;
  email: string;
  formatPreferences: UserFormatPreferences;
};

export function TwoFactorSection({ tx, twoFactor, email, formatPreferences }: Props) {
  const { status, setup, recoveryCodes, loading, busy, error, message } = twoFactor;

  return (
    <Stack spacing={2}>
      {message ? <Alert variant="success">{message}</Alert> : null}
      {error ? <Alert variant="error">{error}</Alert> : null}

      {recoveryCodes ? (
        <RecoveryCodesPanel
          tx={tx}
          codes={recoveryCodes}
          email={email}
          formatPreferences={formatPreferences}
          onDone={twoFactor.dismissRecoveryCodes}
        />
      ) : null}

      {loading && !status ? <Spinner size={20} /> : null}

      {setup ? (
        <SetupPanel
          tx={tx}
          setup={setup}
          busy={busy}
          onConfirm={twoFactor.confirmSetup}
          onCancel={twoFactor.cancelSetup}
        />
      ) : null}

      {!setup && status?.enabled ? (
        <EnabledPanel
          tx={tx}
          remaining={status.recoveryCodesRemaining}
          busy={busy}
          onDisable={twoFactor.disable}
          onRegenerate={twoFactor.regenerateRecoveryCodes}
        />
      ) : null}

      {!setup && status && !status.enabled ? (
        <DisabledPanel tx={tx} busy={busy} onStart={twoFactor.startSetup} />
      ) : null}
    </Stack>
  );
}

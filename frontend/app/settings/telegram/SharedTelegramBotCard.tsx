'use client';

import { Alert, Box, Button, Chip, Paper, Stack, TextField, Typography } from '@mui/material';
import type React from 'react';
import { useEffect, useState } from 'react';
import { CheckCircle, Bot as TelegramIcon } from '@/app/components/icons';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { getApiErrorMessage } from '@/app/lib/api-error';
import type { InstanceTelegramBotStatus } from '@/app/lib/contracts';
import { apiQueryDecoded, type ContractInput, checkContract } from '@/app/lib/query-fn-schema';

const SHARED_BOT_URL = '/settings/instance/telegram';

/**
 * The server's shared bot, for instance admins: every workspace without a bot
 * of its own uses it, so people there only press Connect.
 */
export function SharedTelegramBotCard({
  onChange,
}: {
  /** Called after a save or removal, so the panel re-reads which bot serves the workspace. */
  onChange: () => void;
}): React.JSX.Element {
  const t = useIntlayer('settingsTelegramPage');
  const [source, setSource] = useState<InstanceTelegramBotStatus['source'] | null>(null);
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void apiQueryDecoded({ url: SHARED_BOT_URL, contract: 'InstanceTelegramBotStatus' })
      .then(status => setSource(status.source))
      .catch(async err => {
        console.error('Failed to load the shared telegram bot', err);
      });
  }, []);

  const change = async (request: () => Promise<{ data: unknown }>, done: string): Promise<void> => {
    setBusy(true);
    setMessage(null);
    setError(null);
    await (async () => {
      const response = await request();
      const status = await checkContract(
        'InstanceTelegramBotStatus',
        response.data,
        SHARED_BOT_URL,
      );
      setSource(status.source);
      setToken('');
      setMessage(done);
      onChange();
    })()
      .catch(async err => {
        setError(getApiErrorMessage(err, t.sharedBot.saveFailed.value));
      })
      .finally(async () => {
        setBusy(false);
      });
  };

  const sourceLabel =
    source === 'instance'
      ? t.sharedBot.sourceInstance.value
      : source === 'env'
        ? t.sharedBot.sourceEnv.value
        : t.sharedBot.sourceDisabled.value;

  return (
    <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {t.sharedBot.title.value}
          </Typography>
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
            }}
          >
            {t.sharedBot.description.value}
          </Typography>
        </Box>

        {message && <Alert severity="success">{message}</Alert>}
        {error && <Alert severity="error">{error}</Alert>}

        {source !== null && (
          <Chip
            icon={<TelegramIcon size={16} />}
            color={source === 'disabled' ? 'default' : 'success'}
            label={sourceLabel}
            variant="outlined"
            sx={{ alignSelf: 'flex-start' }}
          />
        )}

        <TextField
          fullWidth
          type="password"
          label={t.bot.tokenLabel.value}
          placeholder="123456:ABC"
          value={token}
          onChange={e => setToken(e.target.value)}
        />

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <Button
            variant="contained"
            startIcon={<CheckCircle size={18} />}
            disabled={busy || !token.trim()}
            onClick={() =>
              change(
                () =>
                  apiClient.put(SHARED_BOT_URL, {
                    botToken: token.trim(),
                  } satisfies ContractInput<'SaveInstanceTelegramBotBody'>),
                t.sharedBot.saved.value,
              )
            }
          >
            {busy ? t.bot.checking.value : t.sharedBot.save.value}
          </Button>
          {source === 'instance' && (
            <Button
              variant="outlined"
              disabled={busy}
              onClick={() =>
                change(() => apiClient.delete(SHARED_BOT_URL), t.sharedBot.removed.value)
              }
            >
              {t.sharedBot.remove.value}
            </Button>
          )}
        </Stack>
      </Stack>
    </Paper>
  );
}

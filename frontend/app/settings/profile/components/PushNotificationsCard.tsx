'use client';

import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  type PushStatus,
  readPushStatus,
  subscribeThisDevice,
  unsubscribeThisDevice,
} from '@/app/lib/offline/push-subscription';

type Tx = (path: string[]) => string;

/** Subscribes or unsubscribes this browser / installed app for web push. */
export function PushNotificationsCard({ tx }: { tx: Tx }) {
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void readPushStatus().then(setStatus);
  }, []);

  const toggle = async () => {
    if (!status) return;
    setBusy(true);
    try {
      if (status.subscribed) {
        await unsubscribeThisDevice();
      } else {
        const ok = await subscribeThisDevice();
        if (!ok) toast.error(tx(['pushCard', 'failed']));
      }
      setStatus(await readPushStatus());
    } catch {
      toast.error(tx(['pushCard', 'failed']));
    } finally {
      setBusy(false);
    }
  };

  if (!status) return null;
  const blocker = !status.supported
    ? tx(['pushCard', 'unsupported'])
    : !status.enabled
      ? tx(['pushCard', 'serverOff'])
      : status.permission === 'denied'
        ? tx(['pushCard', 'denied'])
        : null;

  return (
    <Stack
      spacing={1.5}
      sx={{
        alignItems: 'flex-start',
      }}
    >
      <Typography
        variant="body2"
        sx={{
          color: 'text.secondary',
        }}
      >
        {blocker ?? (status.subscribed ? tx(['pushCard', 'subscribed']) : '')}
      </Typography>
      {!blocker && (
        <Button
          variant={status.subscribed ? 'outlined' : 'contained'}
          disabled={busy}
          onClick={() => void toggle()}
        >
          {status.subscribed ? tx(['pushCard', 'disable']) : tx(['pushCard', 'enable'])}
        </Button>
      )}
    </Stack>
  );
}

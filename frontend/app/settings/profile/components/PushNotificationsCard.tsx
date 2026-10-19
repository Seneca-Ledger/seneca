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

type Tx = (path: string[], fallback: string) => string;

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
        if (!ok) toast.error(tx(['pushCard', 'failed'], 'Could not enable push'));
      }
      setStatus(await readPushStatus());
    } catch {
      toast.error(tx(['pushCard', 'failed'], 'Could not enable push'));
    } finally {
      setBusy(false);
    }
  };

  if (!status) return null;
  const blocker = !status.supported
    ? tx(['pushCard', 'unsupported'], 'This browser cannot receive push')
    : !status.enabled
      ? tx(['pushCard', 'serverOff'], 'Push keys are not set on the server')
      : status.permission === 'denied'
        ? tx(['pushCard', 'denied'], 'Notifications are blocked in the browser settings')
        : null;

  return (
    <Stack spacing={1.5} alignItems="flex-start">
      <Typography variant="body2" color="text.secondary">
        {blocker ??
          (status.subscribed ? tx(['pushCard', 'subscribed'], 'This device receives push') : '')}
      </Typography>
      {!blocker && (
        <Button
          variant={status.subscribed ? 'outlined' : 'contained'}
          disabled={busy}
          onClick={() => void toggle()}
        >
          {status.subscribed
            ? tx(['pushCard', 'disable'], 'Turn off on this device')
            : tx(['pushCard', 'enable'], 'Enable on this device')}
        </Button>
      )}
    </Stack>
  );
}

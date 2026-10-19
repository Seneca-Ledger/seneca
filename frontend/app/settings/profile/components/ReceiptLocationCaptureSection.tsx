'use client';

import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import { useEffect, useState } from 'react';
import { Alert } from '@/app/components/ui/alert';
import { useIntlayer } from '@/app/i18n';
import { isDeviceLocationSupported, requestLocationAccess } from '@/app/lib/device-location';
import {
  setReceiptLocationCapture,
  useReceiptLocationCapture,
} from '@/app/lib/receipt-location-capture';
import { setReceiptPlacePrompt, useReceiptPlaceFollowups } from '@/app/lib/receipt-place-followup';

/**
 * The same per-device choice the consent screen makes before the first camera
 * shot, so a "Not now" can be undone later.
 */
export function ReceiptLocationCaptureSection(): React.JSX.Element {
  const t = useIntlayer('receiptLocationConsent');
  const choice = useReceiptLocationCapture();
  const { promptOn } = useReceiptPlaceFollowups();
  const [supported, setSupported] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const captureOn = supported && choice === 'on';

  // Read after mount: the check touches window, which the server render lacks.
  useEffect(() => {
    setSupported(isDeviceLocationSupported());
  }, []);

  const handleChange = async (on: boolean): Promise<void> => {
    setBlocked(false);
    if (!on) {
      setReceiptLocationCapture(false);
      return;
    }

    // Turning it on is a click, so the browser prompt can be shown right here.
    setRequesting(true);
    const access = await requestLocationAccess();
    setRequesting(false);
    if (access === 'denied') {
      setReceiptLocationCapture(false);
      setBlocked(true);
      return;
    }
    setReceiptLocationCapture(true);
  };

  return (
    <Stack spacing={2}>
      <Card variant="outlined">
        <CardContent>
          <FormControlLabel
            control={
              <Switch
                checked={captureOn}
                disabled={!supported || requesting}
                onChange={(_event, value) => void handleChange(value)}
              />
            }
            label={
              <Stack spacing={0.25}>
                <Typography variant="body2" fontWeight={500}>
                  {t.toggleLabel.value}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t.toggleHelp.value}
                </Typography>
              </Stack>
            }
          />
          {/* The question needs the fix that capture asks for, so it follows that switch. */}
          <FormControlLabel
            sx={{ mt: 2 }}
            control={
              <Switch
                checked={captureOn && promptOn}
                disabled={!captureOn}
                onChange={(_event, value) => setReceiptPlacePrompt(value)}
              />
            }
            label={
              <Stack spacing={0.25}>
                <Typography variant="body2" fontWeight={500}>
                  {t.placePromptLabel.value}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t.placePromptHelp.value}
                </Typography>
              </Stack>
            }
          />
        </CardContent>
      </Card>

      {supported ? null : <Alert variant="default">{t.unsupported.value}</Alert>}
      {blocked ? <Alert variant="default">{t.browserBlocked.value}</Alert> : null}
    </Stack>
  );
}

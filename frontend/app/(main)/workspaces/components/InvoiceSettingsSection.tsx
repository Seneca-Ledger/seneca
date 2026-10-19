'use client';

import {
  Alert,
  Button,
  CircularProgress,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
} from '@mui/material';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useIntlayer } from '@/app/i18n';
import { type InvoiceSettings, invoicesApi } from '@/app/lib/invoices-api';
import { SettingsSection } from './SettingsSection';

/** "−3, 0, 7, 14" → [-3, 0, 7, 14]; the minus sign may be typographic. */
function parseOffsets(input: string): number[] {
  const values = input
    .replace(/[−–—]/g, '-')
    .split(/[,;\s]+/)
    .map(part => Number(part.trim()))
    .filter(value => Number.isInteger(value));
  return [...new Set(values)].sort((left, right) => left - right);
}

/**
 * Invoice numbering and the reminder schedule.
 *
 * The reminder switch is the one setting on this screen that sends mail to
 * someone else, so it says plainly that it is off until turned on.
 */
export function InvoiceSettingsSection(): React.ReactElement {
  const t = useIntlayer('invoiceSettings');
  const shared = useIntlayer('businessProfile');

  const [loading, setLoading] = useState(true);
  const [prefix, setPrefix] = useState('');
  const [remindersEnabled, setRemindersEnabled] = useState(false);
  const [offsetsText, setOffsetsText] = useState('');
  const [termsDays, setTermsDays] = useState('14');
  const [lateFee, setLateFee] = useState('0');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [failed, setFailed] = useState<'load' | 'save' | null>(null);

  const apply = useCallback((settings: InvoiceSettings) => {
    setPrefix(settings.prefix);
    setRemindersEnabled(settings.remindersEnabled);
    setOffsetsText(settings.reminderOffsets.join(', '));
    setTermsDays(String(settings.paymentTermsDays));
    setLateFee(String(settings.lateFeePercent));
  }, []);

  useEffect(() => {
    let cancelled = false;
    invoicesApi
      .getSettings()
      .then(settings => {
        if (cancelled) {
          return;
        }
        apply(settings);
      })
      .catch(() => {
        if (!cancelled) {
          setFailed('load');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [apply]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setFailed(null);
    setSaved(false);
    try {
      apply(
        await invoicesApi.updateSettings({
          prefix: prefix.trim(),
          remindersEnabled,
          reminderOffsets: parseOffsets(offsetsText),
          paymentTermsDays: Number(termsDays) || 0,
          lateFeePercent: Number(lateFee.replace(',', '.')) || 0,
        }),
      );
      setSaved(true);
    } catch {
      setFailed('save');
    } finally {
      setSaving(false);
    }
  }, [prefix, remindersEnabled, offsetsText, termsDays, lateFee, apply]);

  return (
    <SettingsSection title={t.title} description={t.description}>
      {loading ? (
        <CircularProgress size={20} />
      ) : (
        <Stack spacing={2}>
          {failed === 'load' ? <Alert severity="error">{shared.loadError}</Alert> : null}
          {failed === 'save' ? <Alert severity="error">{shared.saveError}</Alert> : null}

          <TextField
            label={String(t.prefix.value)}
            value={prefix}
            onChange={event => setPrefix(event.target.value)}
            size="small"
            sx={{ maxWidth: 220 }}
          />

          <TextField
            label={String(t.paymentTerms.value)}
            value={termsDays}
            onChange={event => setTermsDays(event.target.value.replace(/\D/g, ''))}
            size="small"
            sx={{ maxWidth: 220 }}
          />

          <TextField
            label={String(t.lateFee.value)}
            value={lateFee}
            onChange={event => setLateFee(event.target.value)}
            size="small"
            sx={{ maxWidth: 220 }}
          />

          <FormControlLabel
            control={
              <Switch
                checked={remindersEnabled}
                onChange={event => setRemindersEnabled(event.target.checked)}
              />
            }
            label={String(t.reminders.value)}
          />

          <TextField
            label={String(t.offsets.value)}
            value={offsetsText}
            onChange={event => setOffsetsText(event.target.value)}
            helperText={String(t.offsetsHint.value)}
            disabled={!remindersEnabled}
            size="small"
            sx={{ maxWidth: 320 }}
          />

          <Stack direction="row" spacing={2} alignItems="center">
            <Button variant="contained" disabled={saving} onClick={() => void handleSave()}>
              {saving ? shared.saving : shared.save}
            </Button>
            {saved ? <Alert severity="success">{shared.saved}</Alert> : null}
          </Stack>
        </Stack>
      )}
    </SettingsSection>
  );
}

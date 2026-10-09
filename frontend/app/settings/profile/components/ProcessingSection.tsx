'use client';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import MenuItem from '@mui/material/MenuItem';
import Slider from '@mui/material/Slider';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useEffect, useState } from 'react';
import { Alert } from '@/app/components/ui/alert';
import type {
  DuplicateResolution,
  UseProcessingReturn,
} from '@/app/settings/profile/hooks/useProcessing';
import { duplicateResolutions } from '@/app/settings/profile/hooks/useProcessing';

type Tx = (path: string[], fallback: string) => string;

const RESOLUTION_FALLBACKS: Record<DuplicateResolution, string> = {
  skip: 'Skip the row',
  mark_duplicate: 'Import and mark as duplicate',
  force_import: 'Import as a separate transaction',
};

function ThresholdField({
  tx,
  value,
  saving,
  onCommit,
}: {
  tx: Tx;
  value: number;
  saving: boolean;
  onCommit: (value: number) => void;
}) {
  // Local while dragging: every intermediate value would otherwise be a request.
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  return (
    <Stack spacing={0.5}>
      <Typography variant="body2" fontWeight={600}>
        {tx(['processingCard', 'thresholdLabel'], 'Categorisation confidence')}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {tx(
          ['processingCard', 'thresholdHelp'],
          'Lower categorises more transactions automatically but guesses more often.',
        )}
      </Typography>
      <Box sx={{ px: 1, pt: 1, maxWidth: 360 }}>
        <Slider
          value={draft}
          min={0}
          max={1}
          step={0.05}
          marks
          disabled={saving}
          valueLabelDisplay="auto"
          onChange={(_event, next) => setDraft(next as number)}
          onChangeCommitted={(_event, next) => onCommit(next as number)}
          aria-label={tx(['processingCard', 'thresholdLabel'], 'Categorisation confidence')}
        />
      </Box>
    </Stack>
  );
}

type SwitchKey = 'aiCategorization' | 'aiMerchantNormalization' | 'merchantLearning';

const SWITCHES: Array<{
  key: SwitchKey;
  label: string;
  help: string;
  labelFallback: string;
  helpFallback: string;
}> = [
  {
    key: 'aiCategorization',
    label: 'aiCategorizationLabel',
    help: 'aiCategorizationHelp',
    labelFallback: 'AI categorisation',
    helpFallback:
      'Ask the model during import when rules and your corrections found nothing. Off means no AI influence at all.',
  },
  {
    key: 'aiMerchantNormalization',
    label: 'aiMerchantLabel',
    help: 'aiMerchantHelp',
    labelFallback: 'AI merchant names',
    helpFallback:
      'Keep a normalised name next to the raw statement text. The raw text is always kept.',
  },
  {
    key: 'merchantLearning',
    label: 'learningLabel',
    help: 'learningHelp',
    labelFallback: 'Learn from my corrections',
    helpFallback:
      'Reuse a category you picked for the same payee on later imports. One correction does not replace an established category; the second one does.',
  },
];

function ProcessingSwitch({
  tx,
  entry,
  checked,
  saving,
  onChange,
}: {
  tx: Tx;
  entry: (typeof SWITCHES)[number];
  checked: boolean;
  saving: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <Stack direction="row" spacing={1} alignItems="flex-start">
      <Switch
        checked={checked}
        disabled={saving}
        onChange={event => onChange(event.target.checked)}
        inputProps={{ 'aria-label': tx(['processingCard', entry.label], entry.labelFallback) }}
      />
      <Stack spacing={0.25} sx={{ pt: 0.75 }}>
        <Typography variant="body2" fontWeight={600}>
          {tx(['processingCard', entry.label], entry.labelFallback)}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {tx(['processingCard', entry.help], entry.helpFallback)}
        </Typography>
      </Stack>
    </Stack>
  );
}

type Props = { tx: Tx; processing: UseProcessingReturn };

export function ProcessingSection({ tx, processing }: Props) {
  const { settings, loading, saving, error, message } = processing;

  if (loading) {
    return (
      <Typography variant="body2">{tx(['notificationsCard', 'loading'], 'Loading...')}</Typography>
    );
  }

  return (
    <Stack spacing={2}>
      {error ? <Alert variant="error">{error}</Alert> : null}
      {message ? <Alert variant="success">{message}</Alert> : null}

      <Card variant="outlined">
        <Box sx={{ px: 2, pt: 2, pb: 0 }}>
          <Typography variant="subtitle1" fontWeight={600}>
            {tx(['processingCard', 'title'], 'Processing defaults')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {tx(
              ['processingCard', 'description'],
              'Applies to this workspace when statements and receipts are imported.',
            )}
          </Typography>
        </Box>
        <CardContent>
          <Stack spacing={3}>
            <Stack spacing={0.5}>
              <Typography variant="body2" fontWeight={600}>
                {tx(['processingCard', 'orderLabel'], 'Categorisation order')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {tx(
                  ['processingCard', 'orderHelp'],
                  'Your pick → rules → keywords → your corrections → payee history → AI → “Uncategorised”. A category you picked by hand is never overwritten.',
                )}
              </Typography>
            </Stack>

            {SWITCHES.map(entry => (
              <ProcessingSwitch
                key={entry.key}
                tx={tx}
                entry={entry}
                checked={settings[entry.key]}
                saving={saving}
                onChange={value => void processing.update({ [entry.key]: value })}
              />
            ))}

            <ThresholdField
              tx={tx}
              value={settings.categorizationThreshold}
              saving={saving}
              onCommit={value => void processing.update({ categorizationThreshold: value })}
            />

            <Stack spacing={0.5}>
              <Typography variant="body2" fontWeight={600}>
                {tx(['processingCard', 'duplicatesLabel'], 'When a row looks like a duplicate')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {tx(
                  ['processingCard', 'duplicatesHelp'],
                  'Used when the import is confirmed without choosing per row.',
                )}
              </Typography>
              <TextField
                select
                size="small"
                value={settings.duplicateResolution}
                disabled={saving}
                onChange={event =>
                  void processing.update({
                    duplicateResolution: event.target.value as DuplicateResolution,
                  })
                }
                sx={{ maxWidth: 360, mt: 1 }}
              >
                {duplicateResolutions.map(option => (
                  <MenuItem key={option} value={option}>
                    {tx(['processingCard', 'duplicates', option], RESOLUTION_FALLBACKS[option])}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}

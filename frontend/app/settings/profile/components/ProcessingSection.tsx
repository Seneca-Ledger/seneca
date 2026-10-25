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

type Tx = (path: string[]) => string;

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
      <Typography
        variant="body2"
        sx={{
          fontWeight: 600,
        }}
      >
        {tx(['processingCard', 'thresholdLabel'])}
      </Typography>
      <Typography
        variant="caption"
        sx={{
          color: 'text.secondary',
        }}
      >
        {tx(['processingCard', 'thresholdHelp'])}
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
          aria-label={tx(['processingCard', 'thresholdLabel'])}
        />
      </Box>
    </Stack>
  );
}

type SwitchKey = 'merchantLearning';

const SWITCHES: Array<{
  key: SwitchKey;
  label: string;
  help: string;
}> = [
  {
    key: 'merchantLearning',
    label: 'learningLabel',
    help: 'learningHelp',
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
    <Stack
      direction="row"
      spacing={1}
      sx={{
        alignItems: 'flex-start',
      }}
    >
      <Switch
        checked={checked}
        disabled={saving}
        onChange={event => onChange(event.target.checked)}
        slotProps={{
          input: { 'aria-label': tx(['processingCard', entry.label]) },
        }}
      />
      <Stack spacing={0.25} sx={{ pt: 0.75 }}>
        <Typography
          variant="body2"
          sx={{
            fontWeight: 600,
          }}
        >
          {tx(['processingCard', entry.label])}
        </Typography>
        <Typography
          variant="caption"
          sx={{
            color: 'text.secondary',
          }}
        >
          {tx(['processingCard', entry.help])}
        </Typography>
      </Stack>
    </Stack>
  );
}

type Props = { tx: Tx; processing: UseProcessingReturn };

export function ProcessingSection({ tx, processing }: Props) {
  const { settings, loading, saving, error, message } = processing;

  if (loading) {
    return <Typography variant="body2">{tx(['notificationsCard', 'loading'])}</Typography>;
  }

  return (
    <Stack spacing={2}>
      {error ? <Alert variant="error">{error}</Alert> : null}
      {message ? <Alert variant="success">{message}</Alert> : null}

      <Card variant="outlined">
        <Box sx={{ px: 2, pt: 2, pb: 0 }}>
          <Typography
            variant="subtitle1"
            sx={{
              fontWeight: 600,
            }}
          >
            {tx(['processingCard', 'title'])}
          </Typography>
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
            }}
          >
            {tx(['processingCard', 'description'])}
          </Typography>
        </Box>
        <CardContent>
          <Stack spacing={3}>
            <Stack spacing={0.5}>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 600,
                }}
              >
                {tx(['processingCard', 'orderLabel'])}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                }}
              >
                {tx(['processingCard', 'orderHelp'])}
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
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 600,
                }}
              >
                {tx(['processingCard', 'duplicatesLabel'])}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                }}
              >
                {tx(['processingCard', 'duplicatesHelp'])}
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
                    {tx(['processingCard', 'duplicates', option])}
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

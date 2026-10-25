'use client';

import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import { Alert } from '@/app/components/ui/alert';

type Props = {
  tx: (path: string[], fallback: string) => string;
  enabled: boolean;
  setEnabled: (value: boolean) => void;
};

export function ExperimentalSection({ tx, enabled, setEnabled }: Props) {
  return (
    <Stack spacing={2.5}>
      <Alert variant="default">
        {tx(
          ['experimentalCard', 'warning'],
          'Experimental features are unfinished and may change or break. Turn this off to hide them.',
        )}
      </Alert>

      <Card variant="outlined">
        <CardContent>
          <FormControlLabel
            control={<Switch checked={enabled} onChange={(_event, value) => setEnabled(value)} />}
            label={
              <Stack spacing={0.25}>
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 500,
                  }}
                >
                  {tx(['experimentalCard', 'toggleLabel'], 'Experimental mode')}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    color: 'text.secondary',
                  }}
                >
                  {tx(
                    ['experimentalCard', 'toggleHelp'],
                    'Unlocks features that are still in development on this device.',
                  )}
                </Typography>
              </Stack>
            }
          />
        </CardContent>
      </Card>
    </Stack>
  );
}

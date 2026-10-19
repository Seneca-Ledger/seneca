'use client';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { Alert } from '@/app/components/ui/alert';
import { Spinner } from '@/app/components/ui/spinner';
import type { ThemePreference } from '@/app/lib/theme-preference';
import type { UiDensity } from '@/app/theme';
import { ModeToggle } from '@/components/mode-toggle';

type Tx = (path: string[], fallback: string) => string;

type ThemeProps = {
  t: {
    appearanceCard: {
      themeLabel: { value: string };
      themeHelp: { value: string };
      light: { value: string };
      dark: { value: string };
      active: { value: string };
      followsSystem: { value: string };
    };
  };
  tx: Tx;
  appearanceMessage: string | null;
  appearanceError: string | null;
  appearanceLoading: boolean;
  themePreference: ThemePreference;
  handleThemePreferenceChange: (nextTheme: ThemePreference) => void | Promise<void>;
};

/** Theme picker; sits at the top of the General tab, so it also carries the appearance feedback. */
export function ThemeSection({
  t,
  tx,
  appearanceMessage,
  appearanceError,
  appearanceLoading,
  themePreference,
  handleThemePreferenceChange,
}: ThemeProps) {
  return (
    <Stack spacing={2}>
      {appearanceMessage ? <Alert variant="success">{appearanceMessage}</Alert> : null}
      {appearanceError ? <Alert variant="error">{appearanceError}</Alert> : null}

      <Card variant="outlined">
        <Box sx={{ px: 2, pt: 2, pb: 0 }}>
          <Typography variant="subtitle1" fontWeight={600}>
            {t.appearanceCard.themeLabel.value}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t.appearanceCard.themeHelp.value}
          </Typography>
        </Box>
        <CardContent>
          <Stack spacing={2}>
            <ModeToggle
              value={themePreference}
              onThemeChange={handleThemePreferenceChange}
              showPreview={false}
              labels={{
                light: t.appearanceCard.light.value,
                dark: t.appearanceCard.dark.value,
                auto: tx(['appearanceCard', 'auto'], 'Auto'),
                active: t.appearanceCard.active.value,
                followsSystem: t.appearanceCard.followsSystem.value,
              }}
            />
            <Typography variant="caption" color="text.secondary">
              {t.appearanceCard.followsSystem.value}
            </Typography>
            {appearanceLoading ? (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  fontSize: 14,
                  color: 'text.secondary',
                }}
              >
                <Spinner size={16} />
                <span>{t.appearanceCard.active.value}</span>
              </Box>
            ) : null}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}

type Props = {
  tx: Tx;
  density: UiDensity;
  setDensity: (value: UiDensity) => void;
  reduceMotion: boolean;
  setReduceMotion: (value: boolean) => void;
  showDailyQuote: boolean;
  setShowDailyQuote: (value: boolean) => void;
};

export function AppearanceSection({
  tx,
  density,
  setDensity,
  reduceMotion,
  setReduceMotion,
  showDailyQuote,
  setShowDailyQuote,
}: Props) {
  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="subtitle1" fontWeight={600}>
          {tx(['appearanceCard', 'densityLabel'], 'Interface density')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {tx(
            ['appearanceCard', 'densityHelp'],
            'Compact fits more rows on screen in tables and lists.',
          )}
        </Typography>
      </Box>
      <TextField
        select
        size="small"
        value={density}
        onChange={event => setDensity(event.target.value as UiDensity)}
        sx={{ maxWidth: 320 }}
      >
        <MenuItem value="comfortable">
          {tx(['appearanceCard', 'densityComfortable'], 'Comfortable')}
        </MenuItem>
        <MenuItem value="compact">{tx(['appearanceCard', 'densityCompact'], 'Compact')}</MenuItem>
      </TextField>

      <FormControlLabel
        control={
          <Switch checked={reduceMotion} onChange={(_event, value) => setReduceMotion(value)} />
        }
        label={
          <Stack spacing={0.25}>
            <Typography variant="body2" fontWeight={500}>
              {tx(['appearanceCard', 'reduceMotionLabel'], 'Reduce motion')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {tx(
                ['appearanceCard', 'reduceMotionHelp'],
                'Turns off non-essential transitions and animations.',
              )}
            </Typography>
          </Stack>
        }
      />

      <FormControlLabel
        control={
          <Switch checked={showDailyQuote} onChange={(_event, value) => setShowDailyQuote(value)} />
        }
        label={
          <Stack spacing={0.25}>
            <Typography variant="body2" fontWeight={500}>
              {tx(['appearanceCard', 'dailyQuoteLabel'], 'Daily quote')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {tx(
                ['appearanceCard', 'dailyQuoteHelp'],
                'A short quote above the pages, picked for your current advice. The advice itself stays on the Advice page.',
              )}
            </Typography>
          </Stack>
        }
      />
    </Stack>
  );
}

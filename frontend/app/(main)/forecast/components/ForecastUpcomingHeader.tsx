'use client';

import Box from '@mui/material/Box';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Typography from '@mui/material/Typography';
import { useIntlayer } from '@/app/i18n';
import type { ForecastScenario } from '../hooks/useForecast';

const FACTORS = [0.5, 0.8, 0.9, 1, 1.1, 1.25, 1.5];

export const fill = (template: string, values: Record<string, string>): string =>
  Object.entries(values).reduce(
    (text, [key, value]) => text.replaceAll(`{{${key}}}`, value),
    template,
  );

/** The upcoming list's title, the scenario strip over it and the hint under them. */
export function ForecastUpcomingHeader({
  scenario,
  setFactor,
}: {
  scenario: ForecastScenario;
  setFactor: (key: 'incomeFactor' | 'expenseFactor', value: number) => void;
}) {
  const t = useIntlayer('forecastPage');
  return (
    <>
      {/* The scenario is a narrow strip over the list it acts on, not a half-empty column. */}
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
        }}
      >
        <Typography
          variant="subtitle1"
          sx={{
            fontWeight: 600,
          }}
        >
          {t.upcoming}
        </Typography>
        <Box
          sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}
          aria-label={t.scenarios.value}
          role="group"
        >
          {(['incomeFactor', 'expenseFactor'] as const).map(key => (
            <Select
              key={key}
              size="small"
              value={scenario[key]}
              onChange={event => setFactor(key, Number(event.target.value))}
              inputProps={{ 'aria-label': t[key].value }}
              sx={{ fontSize: 14 }}
            >
              {FACTORS.map(factor => (
                <MenuItem key={factor} value={factor}>
                  {fill(t.factorOption.value, {
                    name: t[key].value,
                    percent: String(Math.round(factor * 100)),
                  })}
                </MenuItem>
              ))}
            </Select>
          ))}
        </Box>
      </Box>
      <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 1, mb: 2 }}>
        {t.excludeHint}
      </Typography>
    </>
  );
}

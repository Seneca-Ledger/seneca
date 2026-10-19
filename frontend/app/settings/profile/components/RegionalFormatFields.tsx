'use client';

import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { type DateFormatPreference, formatDate } from '@/app/lib/user-format';

type Tx = (path: string[], fallback: string) => string;

type Props = {
  tx: Tx;
  locale?: string | null;
  dateFormat: DateFormatPreference;
  setDateFormat: (value: DateFormatPreference) => void;
  firstDayOfWeek: number | null;
  setFirstDayOfWeek: (value: number | null) => void;
};

const DATE_FORMAT_FALLBACKS: Record<DateFormatPreference, string> = {
  auto: 'Follow the language',
  dmy: 'Day.Month.Year',
  mdy: 'Month/Day/Year',
  ymd: 'Year-Month-Day',
};

const WEEKDAY_FALLBACKS = ['Sunday', 'Monday'];

/** A fixed date makes the difference between the orders obvious in the dropdown. */
const SAMPLE_DATE = new Date(2026, 10, 5);

export function RegionalFormatFields({
  tx,
  locale,
  dateFormat,
  setDateFormat,
  firstDayOfWeek,
  setFirstDayOfWeek,
}: Props) {
  return (
    <Stack spacing={2}>
      <Stack spacing={0.5}>
        <Typography
          component="label"
          htmlFor="profile-date-format"
          variant="body2"
          fontWeight={600}
        >
          {tx(['profileCard', 'dateFormatLabel'], 'Date format')}
        </Typography>
        <TextField
          id="profile-date-format"
          select
          size="small"
          value={dateFormat}
          onChange={event => setDateFormat(event.target.value as DateFormatPreference)}
          fullWidth
        >
          {(Object.keys(DATE_FORMAT_FALLBACKS) as DateFormatPreference[]).map(option => (
            <MenuItem key={option} value={option}>
              {tx(['profileCard', 'dateFormats', option], DATE_FORMAT_FALLBACKS[option])}
              {' — '}
              {formatDate(SAMPLE_DATE, { locale, dateFormat: option })}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      <Stack spacing={0.5}>
        <Typography component="label" htmlFor="profile-week-start" variant="body2" fontWeight={600}>
          {tx(['profileCard', 'firstDayOfWeekLabel'], 'First day of the week')}
        </Typography>
        <TextField
          id="profile-week-start"
          select
          size="small"
          value={firstDayOfWeek === null ? '' : String(firstDayOfWeek)}
          onChange={event =>
            setFirstDayOfWeek(event.target.value === '' ? null : Number(event.target.value))
          }
          // Without this MUI treats '' as "nothing selected" and the auto option
          // renders as an empty box.
          SelectProps={{ displayEmpty: true }}
          fullWidth
        >
          <MenuItem value="">
            {tx(['profileCard', 'dateFormats', 'auto'], DATE_FORMAT_FALLBACKS.auto)}
          </MenuItem>
          {WEEKDAY_FALLBACKS.map((fallback, day) => (
            <MenuItem key={fallback} value={String(day)}>
              {tx(['profileCard', 'weekdays', fallback.toLowerCase()], fallback)}
            </MenuItem>
          ))}
        </TextField>
      </Stack>
    </Stack>
  );
}

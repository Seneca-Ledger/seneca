'use client';

import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { type DateFormatPreference, formatDate } from '@/app/lib/user-format';

type Tx = (path: string[]) => string;

type Props = {
  tx: Tx;
  locale?: string | null;
  dateFormat: DateFormatPreference;
  setDateFormat: (value: DateFormatPreference) => void;
  firstDayOfWeek: number | null;
  setFirstDayOfWeek: (value: number | null) => void;
};

const DATE_FORMATS: DateFormatPreference[] = ['auto', 'dmy', 'mdy', 'ymd'];

/** Index is the day number the API stores: 0 = Sunday, 1 = Monday. */
const WEEKDAYS = ['sunday', 'monday'];

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
          sx={{
            fontWeight: 600,
          }}
        >
          {tx(['profileCard', 'dateFormatLabel'])}
        </Typography>
        <TextField
          id="profile-date-format"
          select
          size="small"
          value={dateFormat}
          onChange={event => setDateFormat(event.target.value as DateFormatPreference)}
          fullWidth
        >
          {DATE_FORMATS.map(option => (
            <MenuItem key={option} value={option}>
              {tx(['profileCard', 'dateFormats', option])}
              {' — '}
              {formatDate(SAMPLE_DATE, { locale, dateFormat: option })}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      <Stack spacing={0.5}>
        <Typography
          component="label"
          htmlFor="profile-week-start"
          variant="body2"
          sx={{
            fontWeight: 600,
          }}
        >
          {tx(['profileCard', 'firstDayOfWeekLabel'])}
        </Typography>
        <TextField
          id="profile-week-start"
          select
          size="small"
          value={firstDayOfWeek === null ? '' : String(firstDayOfWeek)}
          onChange={event =>
            setFirstDayOfWeek(event.target.value === '' ? null : Number(event.target.value))
          }
          fullWidth
          slotProps={{
            select: { displayEmpty: true },
          }}
        >
          <MenuItem value="">{tx(['profileCard', 'dateFormats', 'auto'])}</MenuItem>
          {WEEKDAYS.map((weekday, day) => (
            <MenuItem key={weekday} value={String(day)}>
              {tx(['profileCard', 'weekdays', weekday])}
            </MenuItem>
          ))}
        </TextField>
      </Stack>
    </Stack>
  );
}

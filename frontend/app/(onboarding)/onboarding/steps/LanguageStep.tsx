'use client';

import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import { useMemo } from 'react';
import { FORM_CONTROL_SX } from '@/app/components/ui/input';
import { Select } from '@/app/components/ui/select';
import { formatTimeZoneLabel } from '@/app/lib/timezone';
import {
  type DateFormatPreference,
  dateFormatPreferences,
  formatDate,
} from '@/app/lib/user-format';
import { useSettingsText } from '@/app/settings/profile/hooks/useSettingsText';
import { LocaleField } from '../components/LocaleField';
import { FieldLabel } from '../components/OnboardingField';
import { StepHeading } from '../components/StepHeading';
import { useOnboardingText } from '../lib/useOnboardingText';
import type { SupportedLocale } from '../useOnboardingWizard';

const COMMON_TIMEZONES = [
  'UTC',
  'Europe/Moscow',
  'Asia/Almaty',
  'Asia/Astana',
  'Asia/Tashkent',
  'Europe/Berlin',
  'America/New_York',
];

const resolveTimeZoneOptions = (): string[] => {
  const supportedValuesOf = (
    globalThis.Intl as unknown as {
      supportedValuesOf?: (key: string) => string[];
    }
  ).supportedValuesOf;

  if (typeof supportedValuesOf === 'function') {
    try {
      const zones = supportedValuesOf('timeZone');
      if (Array.isArray(zones) && zones.length > 0) {
        return zones;
      }
    } catch {
      // Fallback below
    }
  }

  return COMMON_TIMEZONES;
};

// Same wording and sample date as the profile settings, so the two screens agree.
const DATE_FORMAT_FALLBACKS: Record<DateFormatPreference, string> = {
  auto: 'Follow the language',
  dmy: 'Day.Month.Year',
  mdy: 'Month/Day/Year',
  ymd: 'Year-Month-Day',
};
const SAMPLE_DATE = new Date(2026, 10, 5);
const WEEKDAY_FALLBACKS = ['Sunday', 'Monday'];

type TimeZoneOption = { value: string; label: string };

interface LanguageStepProps {
  locale: SupportedLocale;
  timeZone: string | null;
  dateFormat: DateFormatPreference;
  firstDayOfWeek: number | null;
  /** The user's name for the greeting; omitted when unknown. */
  name?: string | null;
  onLocaleChange: (locale: SupportedLocale) => void;
  onTimeZoneChange: (timeZone: string | null) => void;
  onDateFormatChange: (dateFormat: DateFormatPreference) => void;
  onFirstDayOfWeekChange: (firstDayOfWeek: number | null) => void;
}

export function LanguageStep({
  locale,
  timeZone,
  dateFormat,
  firstDayOfWeek,
  name,
  onLocaleChange,
  onTimeZoneChange,
  onDateFormatChange,
  onFirstDayOfWeekChange,
}: LanguageStepProps) {
  const text = useOnboardingText(locale);
  const { tx: settingsText } = useSettingsText();

  const timeZoneOptions = useMemo<TimeZoneOption[]>(
    () =>
      resolveTimeZoneOptions().map(zone => ({
        value: zone,
        label: formatTimeZoneLabel(zone, locale),
      })),
    [locale],
  );

  const selectedTimeZone = useMemo<TimeZoneOption | null>(() => {
    if (!timeZone) {
      return null;
    }
    return (
      timeZoneOptions.find(option => option.value === timeZone) ?? {
        value: timeZone,
        label: formatTimeZoneLabel(timeZone, locale),
      }
    );
  }, [timeZone, timeZoneOptions, locale]);

  const dateFormatOptions = dateFormatPreferences.map(option => ({
    value: option,
    label: `${settingsText(['profileCard', 'dateFormats', option], DATE_FORMAT_FALLBACKS[option])} — ${formatDate(SAMPLE_DATE, { locale, dateFormat: option })}`,
  }));

  const weekStartOptions = [
    {
      value: '',
      label: settingsText(['profileCard', 'dateFormats', 'auto'], DATE_FORMAT_FALLBACKS.auto),
    },
    ...WEEKDAY_FALLBACKS.map((fallback, day) => ({
      value: String(day),
      label: settingsText(['profileCard', 'weekdays', fallback.toLowerCase()], fallback),
    })),
  ];

  const greeting = name?.trim()
    ? text(['language', 'greeting'], 'Welcome, {name}').replace('{name}', name.trim())
    : undefined;

  return (
    <Box component="section" sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <StepHeading
        eyebrow={greeting}
        title={text(['language', 'title'], 'Language and timezone')}
        subtitle={text(
          ['language', 'subtitle'],
          'Choose your preferred interface language and timezone for accurate report timestamps.',
        )}
      />

      <LocaleField
        label={text(['language', 'localeLabel'], 'Language')}
        value={locale}
        onChange={onLocaleChange}
      />

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <FieldLabel htmlFor="onboarding-timezone-select">
          {text(['language', 'timeZoneLabel'], 'Timezone')}
        </FieldLabel>
        <Autocomplete<TimeZoneOption, false>
          options={timeZoneOptions}
          value={selectedTimeZone}
          onChange={(_event, option) => onTimeZoneChange(option?.value ?? null)}
          getOptionLabel={option => option.label}
          isOptionEqualToValue={(a, b) => a.value === b.value}
          noOptionsText={text(['language', 'timeZoneNoOptions'], 'No matching timezones found')}
          renderInput={params => (
            <TextField
              {...params}
              inputProps={{ ...params.inputProps, id: 'onboarding-timezone-select' }}
              placeholder={text(['language', 'timeZonePlaceholder'], 'Select timezone')}
              sx={{ '& .MuiInputBase-root': { minHeight: 48, fontSize: 16 } }}
            />
          )}
        />
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
          <FieldLabel htmlFor="onboarding-date-format" id="onboarding-date-format-label">
            {settingsText(['profileCard', 'dateFormatLabel'], 'Date format')}
          </FieldLabel>
          <Select
            fullWidth
            id="onboarding-date-format"
            labelId="onboarding-date-format-label"
            value={dateFormat}
            onChange={value => onDateFormatChange(value as DateFormatPreference)}
            options={dateFormatOptions}
            sx={FORM_CONTROL_SX}
          />
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
          <FieldLabel htmlFor="onboarding-week-start" id="onboarding-week-start-label">
            {settingsText(['profileCard', 'firstDayOfWeekLabel'], 'First day of the week')}
          </FieldLabel>
          <Select
            fullWidth
            id="onboarding-week-start"
            labelId="onboarding-week-start-label"
            value={firstDayOfWeek === null ? '' : String(firstDayOfWeek)}
            onChange={value => onFirstDayOfWeekChange(value === '' ? null : Number(value))}
            options={weekStartOptions}
            sx={FORM_CONTROL_SX}
          />
        </Box>
      </Box>

      <Box component="p" sx={{ m: 0, fontSize: 13, color: 'var(--muted-foreground)' }}>
        {text(
          ['language', 'timeZoneHint'],
          'You can always change this later in profile settings.',
        )}
      </Box>
    </Box>
  );
}

'use client';

import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import { useMemo } from 'react';
import { FORM_CONTROL_SX } from '@/app/components/ui/input';
import { Select } from '@/app/components/ui/select';
import { useIntlayer } from '@/app/i18n';
import { makeTx } from '@/app/lib/intlayer-resolve';
import { formatTimeZoneLabel } from '@/app/lib/timezone';
import {
  type DateFormatPreference,
  dateFormatPreferences,
  formatDate,
} from '@/app/lib/user-format';
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
const SAMPLE_DATE = new Date(2026, 10, 5);
const WEEKDAY_KEYS = ['sunday', 'monday'];

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
  const settingsText = makeTx(useIntlayer('settingsProfilePage'));

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
    label: `${settingsText(['profileCard', 'dateFormats', option])} — ${formatDate(SAMPLE_DATE, { locale, dateFormat: option })}`,
  }));

  const weekStartOptions = [
    {
      value: '',
      label: settingsText(['profileCard', 'dateFormats', 'auto']),
    },
    ...WEEKDAY_KEYS.map((key, day) => ({
      value: String(day),
      label: settingsText(['profileCard', 'weekdays', key]),
    })),
  ];

  const greeting = name?.trim()
    ? text(['language', 'greeting']).replace('{name}', name.trim())
    : undefined;

  return (
    <Box
      component="section"
      sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 4, md: 3 } }}
    >
      <StepHeading
        eyebrow={greeting}
        title={text(['language', 'title'])}
        subtitle={text(['language', 'subtitle'])}
      />

      <LocaleField
        label={text(['language', 'localeLabel'])}
        value={locale}
        onChange={onLocaleChange}
      />

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <FieldLabel htmlFor="onboarding-timezone-select">
          {text(['language', 'timeZoneLabel'])}
        </FieldLabel>
        <Autocomplete<TimeZoneOption, false>
          options={timeZoneOptions}
          value={selectedTimeZone}
          onChange={(_event, option) => onTimeZoneChange(option?.value ?? null)}
          getOptionLabel={option => option.label}
          isOptionEqualToValue={(a, b) => a.value === b.value}
          noOptionsText={text(['language', 'timeZoneNoOptions'])}
          renderInput={params => (
            <TextField
              {...params}
              placeholder={text(['language', 'timeZonePlaceholder'])}
              sx={{ '& .MuiInputBase-root': { minHeight: 48, fontSize: 16 } }}
              slotProps={{
                ...params.slotProps,
                htmlInput: { ...params.slotProps.htmlInput, id: 'onboarding-timezone-select' },
              }}
            />
          )}
        />
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
          <FieldLabel htmlFor="onboarding-date-format" id="onboarding-date-format-label">
            {settingsText(['profileCard', 'dateFormatLabel'])}
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
            {settingsText(['profileCard', 'firstDayOfWeekLabel'])}
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
        {text(['language', 'timeZoneHint'])}
      </Box>
    </Box>
  );
}

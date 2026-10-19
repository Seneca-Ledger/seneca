/**
 * Single source of truth for locale-aware formatting.
 *
 * Before this module the app resolved BCP 47 tags in five different places and
 * a third of the date call sites passed no locale at all, so they silently used
 * the browser's language instead of the one chosen in the app.
 */

export const dateFormatPreferences = ['auto', 'dmy', 'mdy', 'ymd'] as const;
export type DateFormatPreference = (typeof dateFormatPreferences)[number];

export type UserFormatPreferences = {
  locale?: string | null;
  dateFormat?: DateFormatPreference | null;
  firstDayOfWeek?: number | null;
};

/** App locale keys that need a region to format correctly. */
const LOCALE_TAGS: Record<string, string> = {
  ru: 'ru-RU',
  en: 'en-US',
  kk: 'kk-KZ',
  uk: 'uk-UA',
  zh: 'zh-CN',
  pt: 'pt-BR',
};

/**
 * Turns an app locale key into a BCP 47 tag. Unknown keys are passed through —
 * 'de' and 'fr' are already valid tags, and defaulting them to English is how
 * every non-listed language used to end up with US formatting.
 */
export const resolveLocaleTag = (locale?: string | null): string => {
  const normalized = String(locale ?? '').trim();
  if (!normalized) return 'en-US';
  return LOCALE_TAGS[normalized] ?? normalized;
};

const EXPLICIT_ORDER: Record<
  Exclude<DateFormatPreference, 'auto'>,
  { parts: Array<'day' | 'month' | 'year'>; separator: string }
> = {
  dmy: { parts: ['day', 'month', 'year'], separator: '.' },
  mdy: { parts: ['month', 'day', 'year'], separator: '/' },
  ymd: { parts: ['year', 'month', 'day'], separator: '-' },
};

const toDate = (value: Date | string | number | null | undefined): Date | null => {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const pad = (value: number) => String(value).padStart(2, '0');

/**
 * Formats a date. 'auto' keeps the language's own order; the explicit options
 * force a numeric order, which is the whole point of choosing one.
 */
export const formatDate = (
  value: Date | string | number | null | undefined,
  preferences: UserFormatPreferences = {},
): string => {
  const date = toDate(value);
  if (!date) return '';

  const preference = preferences.dateFormat ?? 'auto';

  if (preference === 'auto') {
    return new Intl.DateTimeFormat(resolveLocaleTag(preferences.locale), {
      dateStyle: 'medium',
    }).format(date);
  }

  const { parts, separator } = EXPLICIT_ORDER[preference];
  const values: Record<'day' | 'month' | 'year', string> = {
    day: pad(date.getDate()),
    month: pad(date.getMonth() + 1),
    year: String(date.getFullYear()),
  };

  return parts.map(part => values[part]).join(separator);
};

/**
 * Formats a date while respecting a call site's own Intl options.
 *
 * On 'auto' the site keeps exactly the look it had before — that is what makes
 * adopting this helper a no-op for anyone who never touches the setting. Once an
 * explicit order is chosen it wins, because that is the point of choosing it,
 * and the time part is preserved when the site asked for one.
 */
export const formatDateWithOptions = (
  value: Date | string | number | null | undefined,
  preferences: UserFormatPreferences,
  options: Intl.DateTimeFormatOptions,
): string => {
  const date = toDate(value);
  if (!date) return '';

  const localeTag = resolveLocaleTag(preferences.locale);
  const preference = preferences.dateFormat ?? 'auto';

  // A chosen order only makes sense for a complete calendar date. Partial labels
  // ("5 Aug", "August 2026") keep their own shape — forcing an order there would
  // invent a year the call site deliberately left out.
  const isCompleteDate = Boolean(options.day && options.year);

  if (preference === 'auto' || !isCompleteDate) {
    return new Intl.DateTimeFormat(localeTag, options).format(date);
  }

  const datePart = formatDate(date, preferences);
  const wantsTime = Boolean(options.hour || options.minute || options.timeStyle);
  if (!wantsTime) {
    return datePart;
  }

  const timePart = new Intl.DateTimeFormat(localeTag, {
    hour: options.hour ?? '2-digit',
    minute: options.minute ?? '2-digit',
    second: options.second,
    hour12: options.hour12,
  }).format(date);

  return `${datePart}, ${timePart}`;
};

export const formatDateTime = (
  value: Date | string | number | null | undefined,
  preferences: UserFormatPreferences = {},
): string => {
  const date = toDate(value);
  if (!date) return '';

  const time = new Intl.DateTimeFormat(resolveLocaleTag(preferences.locale), {
    timeStyle: 'short',
  }).format(date);

  return `${formatDate(date, preferences)}, ${time}`;
};

const PICKER_TOKEN: Record<'day' | 'month' | 'year', string> = {
  day: 'dd',
  month: 'MM',
  year: 'yyyy',
};

const PICKER_FORMAT: Record<Exclude<DateFormatPreference, 'auto'>, string> = {
  dmy: 'dd.MM.yyyy',
  mdy: 'MM/dd/yyyy',
  ymd: 'yyyy-MM-dd',
};

/**
 * date-fns format string for date-input pickers (MUI X DatePicker `format` prop).
 * Without this, the picker falls back to MUI's built-in en-US default (MM/dd/yyyy)
 * regardless of the user's locale or dateFormat preference. 'auto' derives the
 * day/month/year order and separator from Intl, since date-fns has no locale-order
 * lookup of its own.
 */
export const resolvePickerFormat = (preferences: UserFormatPreferences = {}): string => {
  const preference = preferences.dateFormat ?? 'auto';
  if (preference !== 'auto') {
    return PICKER_FORMAT[preference];
  }

  const parts = new Intl.DateTimeFormat(resolveLocaleTag(preferences.locale)).formatToParts(
    new Date(2000, 0, 2),
  );
  const separator = parts.find(part => part.type === 'literal')?.value ?? '.';
  return parts
    .filter(
      (part): part is Intl.DateTimeFormatPart & { type: 'day' | 'month' | 'year' } =>
        part.type === 'day' || part.type === 'month' || part.type === 'year',
    )
    .map(part => PICKER_TOKEN[part.type])
    .join(separator);
};

/** Sunday-first for en/US-style locales, Monday-first otherwise. */
const localeDefaultFirstDay = (locale?: string | null): number =>
  resolveLocaleTag(locale).startsWith('en') ? 0 : 1;

export const resolveFirstDayOfWeek = (preferences: UserFormatPreferences = {}): number => {
  const configured = preferences.firstDayOfWeek;
  return configured === null || configured === undefined
    ? localeDefaultFirstDay(preferences.locale)
    : configured;
};

/** Start of the week containing `date`, honouring the user's first weekday. */
export const getWeekStart = (date: Date, preferences: UserFormatPreferences = {}): Date => {
  const firstDay = resolveFirstDayOfWeek(preferences);
  const diff = (date.getDay() - firstDay + 7) % 7;
  const result = new Date(date);
  result.setDate(date.getDate() - diff);
  return new Date(result.getFullYear(), result.getMonth(), result.getDate());
};

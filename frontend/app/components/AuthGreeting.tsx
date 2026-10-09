'use client';

import { Typography } from '@mui/material';
import { useLocale } from '@/app/i18n';
import { type AppLocale, DEFAULT_LOCALE, isSupportedLocale } from '@/app/lib/locale';

const AUTH_GREETINGS = {
  ru: 'Добро пожаловать',
  en: 'Welcome',
  kk: 'Қош келдіңіз',
  zh: '欢迎',
  de: 'Willkommen',
  fr: 'Bienvenue',
  es: 'Bienvenido',
  uk: 'Ласкаво просимо',
  pl: 'Witaj',
  sk: 'Vitajte',
  pt: 'Bem-vindo',
  tr: 'Hoş geldiniz',
  it: 'Benvenuto',
  ja: 'ようこそ',
  ko: '환영합니다',
  hi: 'स्वागत है',
  nl: 'Welkom',
  sv: 'Välkommen',
  vi: 'Chào mừng',
  id: 'Selamat datang',
  da: 'Velkommen',
  nb: 'Velkommen',
  nn: 'Velkomen',
  fi: 'Tervetuloa',
  is: 'Velkomin',
  fo: 'Vælkomin',
  cs: 'Vítejte',
  bg: 'Добре дошли',
  hr: 'Dobro došli',
  sr: 'Добро дошли',
  sl: 'Dobrodošli',
  mk: 'Добредојдовте',
  be: 'Вітаем',
  bs: 'Dobro došli',
  hsb: 'Witajće',
} satisfies Record<AppLocale, string>;

/**
 * The form's heading, in the interface language and nothing else. It used to
 * cycle through every locale every four seconds; a form is where people
 * concentrate, so it now holds still.
 */
export function AuthGreeting(): React.JSX.Element {
  const { locale } = useLocale();
  const current: AppLocale = isSupportedLocale(locale) ? locale : DEFAULT_LOCALE;
  return (
    <Typography
      component="h1"
      variant="h4"
      fontWeight="800"
      color="text.primary"
      align="center"
      lang={current}
      sx={{ mb: 2, lineHeight: 1.2, px: 1, overflowWrap: 'break-word' }}
    >
      {AUTH_GREETINGS[current]}
    </Typography>
  );
}

import type { AppLocale } from './locale';

/**
 * Text of app/global-error.tsx, which renders when the root layout itself
 * failed: no intlayer provider and no locale pack can be counted on there, so
 * the three strings travel with the error chunk instead of a dictionary.
 */
export const GLOBAL_ERROR_TEXT: Record<
  AppLocale,
  { headline: string; fallback: string; retry: string }
> = {
  ru: {
    headline: 'Что-то пошло не так',
    fallback: 'Произошла непредвиденная ошибка.',
    retry: 'Повторить',
  },
  en: {
    headline: 'Something went wrong',
    fallback: 'An unexpected error occurred.',
    retry: 'Try again',
  },
  kk: {
    headline: 'Бірдеңе дұрыс болмады',
    fallback: 'Күтпеген қате орын алды.',
    retry: 'Қайталау',
  },
  de: {
    headline: 'Etwas ist schiefgelaufen',
    fallback: 'Ein unerwarteter Fehler ist aufgetreten.',
    retry: 'Erneut versuchen',
  },
  fr: {
    headline: "Une erreur s'est produite",
    fallback: "Une erreur inattendue s'est produite.",
    retry: 'Réessayer',
  },
  es: {
    headline: 'Algo salió mal',
    fallback: 'Se produjo un error inesperado.',
    retry: 'Reintentar',
  },
  pt: {
    headline: 'Algo deu errado',
    fallback: 'Ocorreu um erro inesperado.',
    retry: 'Tentar novamente',
  },
  tr: {
    headline: 'Bir şeyler ters gitti',
    fallback: 'Beklenmeyen bir hata oluştu.',
    retry: 'Tekrar dene',
  },
  uk: {
    headline: 'Щось пішло не так',
    fallback: 'Сталася неочікувана помилка.',
    retry: 'Повторити',
  },
  zh: {
    headline: '出了点问题',
    fallback: '发生了意外错误。',
    retry: '重试',
  },
  pl: {
    headline: 'Coś poszło nie tak',
    fallback: 'Wystąpił nieoczekiwany błąd.',
    retry: 'Spróbuj ponownie',
  },
  it: {
    headline: 'Qualcosa è andato storto',
    fallback: 'Si è verificato un errore imprevisto.',
    retry: 'Riprova',
  },
  sk: {
    headline: 'Niečo sa pokazilo',
    fallback: 'Vyskytla sa neočakávaná chyba.',
    retry: 'Skúsiť znova',
  },
  ja: {
    headline: '問題が発生しました',
    fallback: '予期しないエラーが発生しました。',
    retry: '再試行',
  },
  ko: {
    headline: '문제가 발생했습니다',
    fallback: '예기치 않은 오류가 발생했습니다.',
    retry: '다시 시도',
  },
  hi: {
    headline: 'कुछ गलत हो गया',
    fallback: 'एक अनपेक्षित त्रुटि हुई।',
    retry: 'फिर से कोशिश करें',
  },
  nl: {
    headline: 'Er is iets misgegaan',
    fallback: 'Er is een onverwachte fout opgetreden.',
    retry: 'Opnieuw proberen',
  },
  sv: {
    headline: 'Något gick fel',
    fallback: 'Ett oväntat fel inträffade.',
    retry: 'Försök igen',
  },
  vi: {
    headline: 'Đã xảy ra lỗi',
    fallback: 'Đã xảy ra lỗi không mong muốn.',
    retry: 'Thử lại',
  },
  id: {
    headline: 'Terjadi kesalahan',
    fallback: 'Terjadi kesalahan yang tidak terduga.',
    retry: 'Coba lagi',
  },
  da: {
    headline: 'Noget gik galt',
    fallback: 'Der opstod en uventet fejl.',
    retry: 'Prøv igen',
  },
  nb: {
    headline: 'Noe gikk galt',
    fallback: 'Det oppstod en uventet feil.',
    retry: 'Prøv igjen',
  },
  nn: {
    headline: 'Noko gjekk gale',
    fallback: 'Det oppstod ein uventa feil.',
    retry: 'Prøv igjen',
  },
  fi: {
    headline: 'Jotain meni vikaan',
    fallback: 'Tapahtui odottamaton virhe.',
    retry: 'Yritä uudelleen',
  },
  is: {
    headline: 'Eitthvað fór úrskeiðis',
    fallback: 'Óvænt villa kom upp.',
    retry: 'Reyna aftur',
  },
  fo: {
    headline: 'Nakað gekk galið',
    fallback: 'Ein óvæntur feilur hendi.',
    retry: 'Royn aftur',
  },
  cs: {
    headline: 'Něco se pokazilo',
    fallback: 'Došlo k neočekávané chybě.',
    retry: 'Zkusit znovu',
  },
  bg: {
    headline: 'Нещо се обърка',
    fallback: 'Възникна неочаквана грешка.',
    retry: 'Опитай отново',
  },
  hr: {
    headline: 'Nešto je pošlo po zlu',
    fallback: 'Došlo je do neočekivane pogreške.',
    retry: 'Pokušaj ponovno',
  },
  sr: {
    headline: 'Нешто је пошло по злу',
    fallback: 'Дошло је до неочекиване грешке.',
    retry: 'Пробај поново',
  },
  sl: {
    headline: 'Nekaj je šlo narobe',
    fallback: 'Prišlo je do nepričakovane napake.',
    retry: 'Poskusi znova',
  },
  mk: {
    headline: 'Нешто тргна наопаку',
    fallback: 'Се појави неочекувана грешка.',
    retry: 'Обиди се повторно',
  },
  be: {
    headline: 'Нешта пайшло не так',
    fallback: 'Адбылася нечаканая памылка.',
    retry: 'Паспрабаваць зноў',
  },
  bs: {
    headline: 'Nešto je pošlo po zlu',
    fallback: 'Došlo je do neočekivane greške.',
    retry: 'Pokušaj ponovo',
  },
  hsb: {
    headline: 'Něšto je so nimokuliło',
    fallback: 'Njewočakowany zmylk je so stał.',
    retry: 'Hišće raz spytać',
  },
};

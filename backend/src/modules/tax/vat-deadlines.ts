import { TaxFilingPeriod } from '../../entities/tax-jurisdiction.entity';
import { toDateOnly } from './jurisdictions.service';

/**
 * When a periodic VAT return is due, per country.
 *
 * Every rule here was checked against the tax authority's own page or the
 * statute (research pass of 2026-10-10); the sources are kept with the rule.
 * A country or a frequency that was not verified is absent, and then nothing
 * is said about its deadline — a wrong reminder is worse than none.
 */

/** When the rules below were last read against their sources. */
export const VAT_DEADLINES_CHECKED_AT = '2026-10-10';

export interface DueRule {
  /** 1 = the month after the period ends. */
  monthsAfterPeriodEnd: number;
  /**
   * Day of that month: a number, its last day, or its last working day
   * (Monday to Friday, and not a known public holiday). NULL when the rule
   * counts days instead.
   */
  day: number | 'last' | 'lastBusinessDay' | null;
  /** Days after the end of that month (UK: one month and seven days). */
  plusDays: number | null;
  /** A period ending in this month is due on another day (Spain's fourth quarter). */
  exceptions?: Array<{
    periodEndMonth: number;
    monthsAfterPeriodEnd: number;
    day: number | 'last' | 'lastBusinessDay';
  }>;
}

export interface VatDeadlineRule {
  returnName: string;
  frequencies: Partial<Record<TaxFilingPeriod, DueRule>>;
  /**
   * A deadline on a Saturday, a Sunday or a known nationwide public holiday
   * moves to the next working day. Without the holiday calendar only weekends
   * are skipped, which can leave the date a day early but never late.
   */
  shiftsToNextBusinessDay: boolean;
  /** A standing extension the taxpayer can hold, e.g. Germany's Dauerfristverlängerung. */
  extension: { months: number; name: string } | null;
  sourceUrl: string;
}

/*
 * Left out on purpose (2026-10-10): France (the CA3 day depends on the
 * taxpayer), Ireland (two-, four- and six-monthly periods), Luxembourg
 * ("before the 15th" was not settled as inclusive) and Slovenia (the 20th for
 * intra-EU traders, the last working day for others). Where the weekend rule
 * was not confirmed (Belgium, the Netherlands, Cyprus) the date is not moved:
 * a reminder a day early is harmless, a day late is not. Sweden's monthly
 * rule is the one for turnover up to SEK 40 million.
 */
export const VAT_DEADLINE_RULES: Readonly<Record<string, VatDeadlineRule>> = {
  AE: {
    returnName: 'VAT Return (VAT 201)',
    frequencies: {
      [TaxFilingPeriod.MONTHLY]: { monthsAfterPeriodEnd: 0, day: null, plusDays: 28 },
      [TaxFilingPeriod.QUARTERLY]: { monthsAfterPeriodEnd: 0, day: null, plusDays: 28 },
    },
    shiftsToNextBusinessDay: true,
    extension: null,
    sourceUrl:
      'https://tax.gov.ae/en/taxes/Vat/vat.topics/filing.vat.returns.and.making.payments.aspx',
  },
  AT: {
    returnName: 'Umsatzsteuervoranmeldung (U30)',
    frequencies: {
      [TaxFilingPeriod.MONTHLY]: { monthsAfterPeriodEnd: 2, day: 15, plusDays: null },
      [TaxFilingPeriod.QUARTERLY]: { monthsAfterPeriodEnd: 2, day: 15, plusDays: null },
      [TaxFilingPeriod.ANNUAL]: { monthsAfterPeriodEnd: 6, day: 30, plusDays: null },
    },
    shiftsToNextBusinessDay: true,
    extension: null,
    sourceUrl:
      'https://www.usp.gv.at/themen/steuern-finanzen/umsatzsteuer-ueberblick/weitere-informationen-zur-umsatzsteuer/entstehen-der-steuerschuld-und-pflichten/umsatzsteuervoranmeldung.html',
  },
  BE: {
    returnName: 'Déclaration périodique TVA / btw-aangifte',
    frequencies: {
      [TaxFilingPeriod.MONTHLY]: { monthsAfterPeriodEnd: 1, day: 20, plusDays: null },
      [TaxFilingPeriod.QUARTERLY]: { monthsAfterPeriodEnd: 1, day: 25, plusDays: null },
    },
    shiftsToNextBusinessDay: false,
    extension: null,
    sourceUrl:
      'https://etaamb.openjustice.be/fr/arrete-royal-du-29-septembre-2024_n2024009309.html',
  },
  BG: {
    returnName: 'Справка-декларация по ЗДДС',
    frequencies: {
      [TaxFilingPeriod.MONTHLY]: { monthsAfterPeriodEnd: 1, day: 14, plusDays: null },
    },
    shiftsToNextBusinessDay: true,
    extension: null,
    sourceUrl: 'https://new.nra.bg/wps/wcm/connect/agency/site/uslugi/spravka.deklaraciq',
  },
  CY: {
    returnName: 'VAT return (T.D. 1004)',
    frequencies: {
      [TaxFilingPeriod.QUARTERLY]: { monthsAfterPeriodEnd: 2, day: 10, plusDays: null },
    },
    shiftsToNextBusinessDay: false,
    extension: null,
    sourceUrl:
      'https://www.businessincyprus.gov.cy/doing-business-in-cyprus/start-your-business/registering-for-income-tax-and-value-added-tax/',
  },
  CZ: {
    returnName: 'Přiznání k DPH',
    frequencies: {
      [TaxFilingPeriod.MONTHLY]: { monthsAfterPeriodEnd: 1, day: 25, plusDays: null },
      [TaxFilingPeriod.QUARTERLY]: { monthsAfterPeriodEnd: 1, day: 25, plusDays: null },
    },
    shiftsToNextBusinessDay: true,
    extension: null,
    sourceUrl: 'https://www.zakonyprolidi.cz/cs/2004-235',
  },
  DE: {
    returnName: 'Umsatzsteuer-Voranmeldung',
    frequencies: {
      [TaxFilingPeriod.MONTHLY]: { monthsAfterPeriodEnd: 1, day: 10, plusDays: null },
      [TaxFilingPeriod.QUARTERLY]: { monthsAfterPeriodEnd: 1, day: 10, plusDays: null },
      [TaxFilingPeriod.ANNUAL]: { monthsAfterPeriodEnd: 7, day: 31, plusDays: null },
    },
    shiftsToNextBusinessDay: true,
    extension: { months: 1, name: 'Dauerfristverlängerung' },
    sourceUrl: 'https://www.gesetze-im-internet.de/ustg_1980/__18.html',
  },
  DK: {
    returnName: 'Momsangivelse',
    frequencies: {
      [TaxFilingPeriod.MONTHLY]: {
        monthsAfterPeriodEnd: 1,
        day: 25,
        plusDays: null,
        exceptions: [{ periodEndMonth: 6, monthsAfterPeriodEnd: 2, day: 17 }],
      },
      [TaxFilingPeriod.QUARTERLY]: { monthsAfterPeriodEnd: 3, day: 1, plusDays: null },
    },
    shiftsToNextBusinessDay: true,
    extension: null,
    sourceUrl: 'https://info.skat.dk/data.aspx?oid=2062862',
  },
  EE: {
    returnName: 'Käibedeklaratsioon (KMD)',
    frequencies: {
      [TaxFilingPeriod.MONTHLY]: { monthsAfterPeriodEnd: 1, day: 20, plusDays: null },
    },
    shiftsToNextBusinessDay: true,
    extension: null,
    sourceUrl:
      'https://www.emta.ee/en/business-client/taxes-and-payment/value-added-tax/filing-vat-returns-and-reports',
  },
  ES: {
    returnName: 'Modelo 303',
    frequencies: {
      [TaxFilingPeriod.MONTHLY]: {
        monthsAfterPeriodEnd: 1,
        day: 30,
        plusDays: null,
        exceptions: [{ periodEndMonth: 1, monthsAfterPeriodEnd: 1, day: 'last' }],
      },
      [TaxFilingPeriod.QUARTERLY]: {
        monthsAfterPeriodEnd: 1,
        day: 20,
        plusDays: null,
        exceptions: [{ periodEndMonth: 12, monthsAfterPeriodEnd: 1, day: 30 }],
      },
    },
    shiftsToNextBusinessDay: true,
    extension: null,
    sourceUrl:
      'https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/manual-iva-2025/capitulo-08-gestion-iva/autoliquidaciones-iva/plazos-presentacion.html',
  },
  FI: {
    returnName: 'Arvonlisäveroilmoitus',
    frequencies: {
      [TaxFilingPeriod.MONTHLY]: { monthsAfterPeriodEnd: 2, day: 12, plusDays: null },
      [TaxFilingPeriod.QUARTERLY]: { monthsAfterPeriodEnd: 2, day: 12, plusDays: null },
      [TaxFilingPeriod.ANNUAL]: { monthsAfterPeriodEnd: 2, day: 'last', plusDays: null },
    },
    shiftsToNextBusinessDay: true,
    extension: null,
    sourceUrl:
      'https://www.vero.fi/en/businesses-and-corporations/taxes-and-charges/vat/when-to-file-and-pay/',
  },
  GB: {
    returnName: 'VAT Return',
    frequencies: {
      [TaxFilingPeriod.MONTHLY]: { monthsAfterPeriodEnd: 1, day: null, plusDays: 7 },
      [TaxFilingPeriod.QUARTERLY]: { monthsAfterPeriodEnd: 1, day: null, plusDays: 7 },
      [TaxFilingPeriod.ANNUAL]: { monthsAfterPeriodEnd: 2, day: 'last', plusDays: null },
    },
    shiftsToNextBusinessDay: false,
    extension: null,
    sourceUrl: 'https://www.gov.uk/vat-returns/deadlines',
  },
  GR: {
    returnName: 'Periodic VAT return (F2)',
    frequencies: {
      [TaxFilingPeriod.MONTHLY]: {
        monthsAfterPeriodEnd: 1,
        day: 'lastBusinessDay',
        plusDays: null,
      },
      [TaxFilingPeriod.QUARTERLY]: {
        monthsAfterPeriodEnd: 1,
        day: 'lastBusinessDay',
        plusDays: null,
      },
    },
    shiftsToNextBusinessDay: false,
    extension: null,
    sourceUrl:
      'https://mitos.gov.gr/index.php/%CE%94%CE%94:%CE%94%CE%AE%CE%BB%CF%89%CF%83%CE%B7_%CE%A6%CE%A0%CE%91',
  },
  HR: {
    returnName: 'Prijava PDV-a',
    frequencies: {
      [TaxFilingPeriod.MONTHLY]: { monthsAfterPeriodEnd: 1, day: 'last', plusDays: null },
      [TaxFilingPeriod.QUARTERLY]: { monthsAfterPeriodEnd: 1, day: 'last', plusDays: null },
    },
    shiftsToNextBusinessDay: true,
    extension: null,
    sourceUrl: 'https://narodne-novine.nn.hr/clanci/sluzbeni/2025_12_151_2262.html',
  },
  HU: {
    returnName: 'Áfabevallás',
    frequencies: {
      [TaxFilingPeriod.MONTHLY]: { monthsAfterPeriodEnd: 1, day: 20, plusDays: null },
      [TaxFilingPeriod.QUARTERLY]: { monthsAfterPeriodEnd: 1, day: 20, plusDays: null },
      [TaxFilingPeriod.ANNUAL]: { monthsAfterPeriodEnd: 2, day: 25, plusDays: null },
    },
    shiftsToNextBusinessDay: true,
    extension: null,
    sourceUrl:
      'https://nav.gov.hu/pfile/file?path=%2Fnyomtatvanyok%2Fletoltesek%2Fnyomtatvanykitolto_programok%2Fnyomtatvanykitolto_programok_nav%2F2565%2F2565---kitoltesi-utmutato',
  },
  IT: {
    returnName: 'Liquidazione periodica IVA (F24)',
    frequencies: {
      [TaxFilingPeriod.MONTHLY]: {
        monthsAfterPeriodEnd: 1,
        day: 16,
        plusDays: null,
        exceptions: [{ periodEndMonth: 7, monthsAfterPeriodEnd: 1, day: 20 }],
      },
      [TaxFilingPeriod.QUARTERLY]: {
        monthsAfterPeriodEnd: 2,
        day: 16,
        plusDays: null,
        exceptions: [
          { periodEndMonth: 6, monthsAfterPeriodEnd: 2, day: 20 },
          { periodEndMonth: 12, monthsAfterPeriodEnd: 3, day: 16 },
        ],
      },
    },
    shiftsToNextBusinessDay: true,
    extension: null,
    sourceUrl:
      'https://www.agenziaentrate.gov.it/portale/schede/pagamenti/f24ivap10/come-e-quando-si-versa',
  },
  KZ: {
    returnName: 'Декларация по НДС (300.00)',
    frequencies: {
      [TaxFilingPeriod.QUARTERLY]: { monthsAfterPeriodEnd: 2, day: 15, plusDays: null },
    },
    shiftsToNextBusinessDay: true,
    extension: null,
    sourceUrl: 'https://adilet.zan.kz/rus/docs/K2500000214',
  },
  LT: {
    returnName: 'PVM deklaracija (FR0600)',
    frequencies: {
      [TaxFilingPeriod.MONTHLY]: { monthsAfterPeriodEnd: 1, day: 25, plusDays: null },
      [TaxFilingPeriod.QUARTERLY]: { monthsAfterPeriodEnd: 1, day: 25, plusDays: null },
    },
    shiftsToNextBusinessDay: true,
    extension: null,
    sourceUrl: 'https://e-seimas.lrs.lt/rs/actualedition/TAIS.163423/rGwdIQGCEj/format/ISO_PDF/',
  },
  LV: {
    returnName: 'PVN deklarācija',
    frequencies: {
      [TaxFilingPeriod.MONTHLY]: { monthsAfterPeriodEnd: 0, day: null, plusDays: 20 },
      [TaxFilingPeriod.QUARTERLY]: { monthsAfterPeriodEnd: 0, day: null, plusDays: 20 },
    },
    shiftsToNextBusinessDay: true,
    extension: null,
    sourceUrl: 'https://likumi.lv/ta/id/253451-pievienotas-vertibas-nodokla-likums',
  },
  MT: {
    returnName: 'VAT return',
    frequencies: {
      [TaxFilingPeriod.QUARTERLY]: { monthsAfterPeriodEnd: 2, day: 15, plusDays: null },
      [TaxFilingPeriod.ANNUAL]: { monthsAfterPeriodEnd: 2, day: 15, plusDays: null },
    },
    shiftsToNextBusinessDay: true,
    extension: null,
    sourceUrl: 'https://legislation.mt/getpdf/69e87cc8becf2f2334f5323f',
  },
  NL: {
    returnName: 'Btw-aangifte',
    frequencies: {
      [TaxFilingPeriod.MONTHLY]: { monthsAfterPeriodEnd: 1, day: 'last', plusDays: null },
      [TaxFilingPeriod.QUARTERLY]: { monthsAfterPeriodEnd: 1, day: 'last', plusDays: null },
      [TaxFilingPeriod.ANNUAL]: { monthsAfterPeriodEnd: 3, day: 31, plusDays: null },
    },
    shiftsToNextBusinessDay: false,
    extension: null,
    sourceUrl:
      'https://www.belastingdienst.nl/wps/wcm/connect/nl/btw/content/uiterste-aangifte-en-betaaldatums',
  },
  PL: {
    returnName: 'JPK_V7',
    frequencies: {
      [TaxFilingPeriod.MONTHLY]: { monthsAfterPeriodEnd: 1, day: 25, plusDays: null },
      [TaxFilingPeriod.QUARTERLY]: { monthsAfterPeriodEnd: 1, day: 25, plusDays: null },
    },
    shiftsToNextBusinessDay: true,
    extension: null,
    sourceUrl:
      'https://www.podatki.gov.pl/podatki-firmowe/jednolity-plik-kontrolny/jpk_vat-z-deklaracja/jpk_vat-z-deklaracja',
  },
  PT: {
    returnName: 'Declaração periódica do IVA',
    frequencies: {
      [TaxFilingPeriod.MONTHLY]: {
        monthsAfterPeriodEnd: 2,
        day: 20,
        plusDays: null,
        exceptions: [{ periodEndMonth: 6, monthsAfterPeriodEnd: 3, day: 20 }],
      },
      [TaxFilingPeriod.QUARTERLY]: {
        monthsAfterPeriodEnd: 2,
        day: 20,
        plusDays: null,
        exceptions: [{ periodEndMonth: 6, monthsAfterPeriodEnd: 3, day: 20 }],
      },
    },
    shiftsToNextBusinessDay: true,
    extension: null,
    sourceUrl:
      'https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios/civa_rep/Pages/iva41.aspx',
  },
  RO: {
    returnName: 'Decont de TVA (D300)',
    frequencies: {
      [TaxFilingPeriod.MONTHLY]: {
        monthsAfterPeriodEnd: 1,
        day: 25,
        plusDays: null,
        exceptions: [{ periodEndMonth: 11, monthsAfterPeriodEnd: 1, day: 21 }],
      },
      [TaxFilingPeriod.QUARTERLY]: { monthsAfterPeriodEnd: 1, day: 25, plusDays: null },
    },
    shiftsToNextBusinessDay: true,
    extension: null,
    sourceUrl: 'https://static.anaf.ro/static/3/Cluj/20260220114126_cj_d300_20feb2026.pdf',
  },
  SE: {
    returnName: 'Momsdeklaration (turnover up to SEK 40 million)',
    frequencies: {
      [TaxFilingPeriod.MONTHLY]: {
        monthsAfterPeriodEnd: 2,
        day: 12,
        plusDays: null,
        exceptions: [
          { periodEndMonth: 6, monthsAfterPeriodEnd: 2, day: 17 },
          { periodEndMonth: 11, monthsAfterPeriodEnd: 2, day: 17 },
        ],
      },
      [TaxFilingPeriod.QUARTERLY]: {
        monthsAfterPeriodEnd: 2,
        day: 12,
        plusDays: null,
        exceptions: [{ periodEndMonth: 6, monthsAfterPeriodEnd: 2, day: 17 }],
      },
    },
    shiftsToNextBusinessDay: true,
    extension: null,
    sourceUrl:
      'https://www.skatteverket.se/foretagochorganisationer/moms/deklareramoms/narskajagdeklareramoms.4.6d02084411db6e252fe80008988.html',
  },
  SK: {
    returnName: 'Daňové priznanie k DPH',
    frequencies: {
      [TaxFilingPeriod.MONTHLY]: { monthsAfterPeriodEnd: 1, day: 25, plusDays: null },
      [TaxFilingPeriod.QUARTERLY]: { monthsAfterPeriodEnd: 1, day: 25, plusDays: null },
    },
    shiftsToNextBusinessDay: true,
    extension: null,
    sourceUrl: 'https://www.slov-lex.sk/static/pdf/2004/222/ZZ_2004_222_20260101.pdf',
  },
};

const NO_HOLIDAYS: ReadonlySet<string> = new Set();

export interface Period {
  start: string;
  end: string;
}

const MONTHS_IN: Record<TaxFilingPeriod, number> = {
  [TaxFilingPeriod.MONTHLY]: 1,
  [TaxFilingPeriod.QUARTERLY]: 3,
  [TaxFilingPeriod.ANNUAL]: 12,
};

function lastDayOfMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function utc(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

/** The filing period a day falls in. */
export function periodContaining(day: string, frequency: TaxFilingPeriod): Period {
  const date = utc(day);
  const months = MONTHS_IN[frequency];
  const firstMonth = Math.floor(date.getUTCMonth() / months) * months;
  const year = date.getUTCFullYear();
  return {
    start: toDateOnly(new Date(Date.UTC(year, firstMonth, 1))),
    end: toDateOnly(new Date(Date.UTC(year, firstMonth + months, 0))),
  };
}

/** The period just before this one. */
export function previousPeriod(period: Period, frequency: TaxFilingPeriod): Period {
  const before = utc(period.start);
  before.setUTCDate(0);
  return periodContaining(toDateOnly(before), frequency);
}

/**
 * The due date of the return for the period ending on `periodEnd`, or NULL
 * when the country or this frequency has no verified rule.
 */
export function vatReturnDueDate(
  countryCode: string,
  frequency: TaxFilingPeriod,
  periodEnd: string,
  withExtension = false,
  holidays: ReadonlySet<string> = NO_HOLIDAYS,
): string | null {
  const rule = VAT_DEADLINE_RULES[countryCode.toUpperCase()];
  return rule ? dueDateUnder(rule, frequency, periodEnd, withExtension, holidays) : null;
}

/** Monday to Friday and not one of the given holidays (YYYY-MM-DD). */
export function isBusinessDay(date: Date, holidays: ReadonlySet<string> = NO_HOLIDAYS): boolean {
  const weekday = date.getUTCDay();
  return weekday !== 0 && weekday !== 6 && !holidays.has(toDateOnly(date));
}

/** The day itself when it is a working day, otherwise the next one. */
export function onOrAfterBusinessDay(
  day: string,
  holidays: ReadonlySet<string> = NO_HOLIDAYS,
): string {
  const date = utc(day);
  while (!isBusinessDay(date, holidays)) {
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return toDateOnly(date);
}

/** The due date under one rule; NULL when the rule has nothing for this frequency. */
export function dueDateUnder(
  rule: VatDeadlineRule,
  frequency: TaxFilingPeriod,
  periodEnd: string,
  withExtension = false,
  holidays: ReadonlySet<string> = NO_HOLIDAYS,
): string | null {
  const due = rule.frequencies[frequency];
  if (!due) {
    return null;
  }

  const end = utc(periodEnd);
  const exception = due.exceptions?.find(item => item.periodEndMonth === end.getUTCMonth() + 1);
  const extraMonths = withExtension && rule.extension ? rule.extension.months : 0;
  const monthsAfter = (exception?.monthsAfterPeriodEnd ?? due.monthsAfterPeriodEnd) + extraMonths;
  const targetMonth = end.getUTCMonth() + monthsAfter;
  const year = end.getUTCFullYear();

  let date: Date;
  const day = exception?.day ?? due.day;
  if (day === 'last' || day === 'lastBusinessDay') {
    date = new Date(Date.UTC(year, targetMonth, lastDayOfMonth(year, targetMonth)));
    while (day === 'lastBusinessDay' && !isBusinessDay(date, holidays)) {
      date.setUTCDate(date.getUTCDate() - 1);
    }
  } else if (day !== null) {
    const clamped = Math.min(day, lastDayOfMonth(year, targetMonth));
    date = new Date(Date.UTC(year, targetMonth, clamped));
  } else {
    date = new Date(Date.UTC(year, targetMonth, lastDayOfMonth(year, targetMonth)));
    date.setUTCDate(date.getUTCDate() + (due.plusDays ?? 0));
  }

  return rule.shiftsToNextBusinessDay
    ? onOrAfterBusinessDay(toDateOnly(date), holidays)
    : toDateOnly(date);
}

import { onOrAfterBusinessDay } from '../tax/vat-deadlines';
import type { TaxpayerType } from './rule-packs/types';

/**
 * Where, by when and on which form a year's income tax is filed, per country.
 *
 * The 2025 entries were checked against the tax authority's own page (or the
 * statute) for that tax year (research passes of 2026-09-13 and 2026-09-14).
 * Later years are worked out from each country's statutory rule (see
 * STATUTORY_RULES) unless an entry with the year's published dates exists.
 * Fields that were not verified are NULL rather than filled from memory;
 * countries that were not verified are simply absent.
 */

export type DeadlineKind =
  | 'standard'
  | 'paper'
  | 'online'
  | 'adviser'
  | 'online_pay_and_file'
  | 'no_assessment_received'
  | 'direct_debit'
  | 'online_zone_1'
  | 'online_zone_2'
  | 'online_zone_3'
  | 'higher_rate_income'
  | 'with_extension'
  | 'correction';

/**
 * What the tax authority prepares on its own.
 * - becomes_final: an assessment that stands if the taxpayer does nothing;
 * - prepared_needs_confirmation: a prefilled return the taxpayer must complete and accept;
 * - prepared: a draft is offered; what happens without action was not verified.
 */
export type AuthorityPreparation = 'becomes_final' | 'prepared_needs_confirmation' | 'prepared';

export type RetentionKind =
  | 'booking_documents'
  | 'books_and_records'
  | 'other_business_documents'
  | 'tax_records'
  | 'commercial_books'
  | 'accounting_records';

/**
 * How long the year's records must be kept. `until` applies the rule to records
 * of the tax year itself; `years` is NULL where the source gives a date instead.
 */
export interface RetentionInfo {
  periods: Array<{ kind: RetentionKind; years: number | null; until: string }>;
  sourceUrl: string;
}

export interface FilingInfo {
  countryCode: string;
  taxYear: number;
  formName: string;
  /** First day returns are accepted, when the authority sets one. */
  filingOpens: string | null;
  deadlines: Array<{ kind: DeadlineKind; date: string }>;
  authorityPreparation: AuthorityPreparation | null;
  portal: string | null;
  sourceUrl: string;
  retention: RetentionInfo | null;
  /**
   * published: the dates the authority announced for this tax year.
   * statute: dates worked out from the rule in the law, as that rule read on
   * `checkedAt`; a later change in the law would not show here.
   */
  basis: 'published' | 'statute';
  /** When the source was last read. */
  checkedAt: string;
}

type Override = Partial<
  Pick<
    FilingInfo,
    'formName' | 'filingOpens' | 'deadlines' | 'authorityPreparation' | 'sourceUrl' | 'retention'
  >
>;

type ForType = (type: TaxpayerType, details: Record<string, unknown>) => Override;

/** Defaults for the country, plus what differs by taxpayer type or regime. */
type Entry = Omit<FilingInfo, 'retention' | 'basis' | 'checkedAt'> & {
  retention?: RetentionInfo;
  forType?: ForType;
};

const PL_BUSINESS_FORMS: Record<string, string> = {
  liniowy: 'PIT-36L',
  ryczalt: 'PIT-28',
  skala: 'PIT-36',
};

// Twój e-PIT accepts PIT-37 on its own; business returns wait for the taxpayer.
const PL_FOR_TYPE: ForType = (type, details) =>
  type === 'employee'
    ? { formName: 'PIT-37', authorityPreparation: 'becomes_final' }
    : {
        formName: PL_BUSINESS_FORMS[String(details.regime)] ?? 'PIT-36 / PIT-36L / PIT-28',
        authorityPreparation: 'prepared_needs_confirmation',
      };

/** The duty to keep records falls on businesses. */
const RETENTION_FOR_BUSINESS_ONLY: ForType = type =>
  type === 'employee' ? { retention: null } : {};

const SE_FOR_TYPE: ForType = type =>
  type === 'employee' ? { formName: 'Inkomstdeklaration 1' } : {};

const GR_FOR_TYPE: ForType = type =>
  type === 'employee' ? { formName: 'Ε1', authorityPreparation: 'prepared' } : {};

const EE_FOR_TYPE: ForType = type =>
  type === 'employee' ? { formName: 'Form A', authorityPreparation: 'prepared' } : {};

/** The 2025 entries were read on the authorities' pages in these research passes. */
const PUBLISHED_CHECKED_AT = '2026-09-14';

const ENTRIES: Entry[] = [
  {
    countryCode: 'PL',
    taxYear: 2025,
    formName: 'PIT-36 / PIT-36L / PIT-28',
    filingOpens: '2026-02-15',
    deadlines: [{ kind: 'standard', date: '2026-04-30' }],
    authorityPreparation: null,
    forType: PL_FOR_TYPE,
    portal: 'Twój e-PIT',
    sourceUrl:
      'https://www.gov.pl/web/finanse/rozliczenie-pit-za-2025-rok-od-15-lutego-do-30-kwietnia',
  },
  {
    countryCode: 'DE',
    taxYear: 2025,
    formName: 'Einkommensteuererklärung',
    filingOpens: null,
    // § 149 Abs. 2/3 AO; 28.02.2027 is a Sunday, so the adviser deadline moves to 1 March (§ 108 Abs. 3 AO).
    deadlines: [
      { kind: 'standard', date: '2026-07-31' },
      { kind: 'adviser', date: '2027-03-01' },
    ],
    authorityPreparation: null,
    portal: 'ELSTER',
    sourceUrl: 'https://www.gesetze-im-internet.de/ao_1977/__149.html',
    // § 147 Abs. 3–4 AO (as of 2025): counted from the end of the year a document was
    // created or the last entry made, so a record closed in 2026 runs a year longer.
    retention: {
      periods: [
        { kind: 'booking_documents', years: 8, until: '2033-12-31' },
        { kind: 'books_and_records', years: 10, until: '2035-12-31' },
        { kind: 'other_business_documents', years: 6, until: '2031-12-31' },
      ],
      sourceUrl: 'https://www.gesetze-im-internet.de/ao_1977/__147.html',
    },
    forType: RETENTION_FOR_BUSINESS_ONLY,
  },
  {
    countryCode: 'ES',
    taxYear: 2025,
    // Common-regime calendar; the Basque Country and Navarra run their own.
    formName: 'Modelo 100 (Renta 2025)',
    filingOpens: '2026-04-08',
    deadlines: [
      { kind: 'direct_debit', date: '2026-06-25' },
      { kind: 'standard', date: '2026-06-30' },
    ],
    authorityPreparation: null,
    portal: 'Renta WEB',
    sourceUrl:
      'https://sede.agenciatributaria.gob.es/Sede/irpf/campana-renta/calendario-campana-renta/junio.html',
  },
  {
    countryCode: 'FR',
    taxYear: 2025,
    formName: 'Déclaration 2042 (2042-C-PRO)',
    filingOpens: null,
    deadlines: [
      { kind: 'paper', date: '2026-05-19' },
      { kind: 'online_zone_1', date: '2026-05-21' },
      { kind: 'online_zone_2', date: '2026-05-28' },
      { kind: 'online_zone_3', date: '2026-06-04' },
    ],
    authorityPreparation: null,
    portal: 'impots.gouv.fr',
    sourceUrl: 'https://www.impots.gouv.fr/particulier/calendrier-fiscal/2026-05',
    // LPF art. L102 B (6 years from the last operation) and, for traders,
    // Code de commerce art. L123-22 (10 years from the close of the financial year).
    retention: {
      periods: [
        { kind: 'tax_records', years: 6, until: '2031-12-31' },
        { kind: 'commercial_books', years: 10, until: '2035-12-31' },
      ],
      sourceUrl: 'https://entreprendre.service-public.gouv.fr/vosdroits/F10029',
    },
    forType: RETENTION_FOR_BUSINESS_ONLY,
  },
  {
    countryCode: 'IT',
    taxYear: 2025,
    formName: 'Redditi Persone Fisiche 2026',
    filingOpens: '2026-04-15',
    // 31.10.2026 is a Saturday, so the online deadline moves to Monday 2 November.
    deadlines: [
      { kind: 'paper', date: '2026-06-30' },
      { kind: 'online', date: '2026-11-02' },
    ],
    // Accepting the precompilata unchanged only spares documentary checks on third-party data.
    authorityPreparation: 'prepared_needs_confirmation',
    forType: type =>
      type === 'employee'
        ? {
            formName: '730/2026 precompilato',
            filingOpens: '2026-05-14',
            deadlines: [{ kind: 'online', date: '2026-09-30' }],
          }
        : {},
    // Art. 43 DPR 600/1973, as stated in the Redditi PF 2026 instructions; applies to every return.
    retention: {
      periods: [{ kind: 'tax_records', years: null, until: '2031-12-31' }],
      sourceUrl:
        'https://www.agenziaentrate.gov.it/portale/documents/d/guest/pf1_istruzioni_2026_agg-28-05-2026',
    },
    portal: 'Agenzia delle Entrate — dichiarazione precompilata',
    sourceUrl: 'https://infoprecompilata.agenziaentrate.gov.it/portale/scadenze',
  },
  {
    countryCode: 'AT',
    taxYear: 2025,
    formName: 'Formular E1 (E1a for business income)',
    filingOpens: null,
    deadlines: [
      { kind: 'paper', date: '2026-04-30' },
      { kind: 'online', date: '2026-06-30' },
    ],
    authorityPreparation: null,
    portal: 'FinanzOnline',
    sourceUrl:
      'https://www.bmf.gv.at/themen/steuern/fuer-unternehmen/einkommensteuer/einkommensteuererklaerungspflicht.html',
  },
  {
    countryCode: 'IE',
    taxYear: 2025,
    formName: 'Form 11',
    filingOpens: null,
    deadlines: [
      { kind: 'standard', date: '2026-10-31' },
      { kind: 'online_pay_and_file', date: '2026-11-18' },
    ],
    authorityPreparation: null,
    portal: 'ROS (Revenue Online Service)',
    sourceUrl: 'https://www.revenue.ie/en/tax-professionals/ebrief/2026/no-0342026.aspx',
  },
  {
    countryCode: 'CZ',
    taxYear: 2025,
    formName: 'Daňové přiznání k dani z příjmů fyzických osob',
    filingOpens: null,
    deadlines: [
      { kind: 'paper', date: '2026-04-01' },
      { kind: 'online', date: '2026-05-04' },
      { kind: 'adviser', date: '2026-07-01' },
    ],
    authorityPreparation: null,
    portal: 'MOJE daně',
    sourceUrl:
      'https://financnisprava.gov.cz/cs/financni-sprava/media-a-verejnost/tiskove-zpravy-gfr/tiskove-zpravy-2026/vyplnujete-danove-priznani-za-rok-2025',
  },
  {
    countryCode: 'HU',
    taxYear: 2025,
    formName: '2553 (SZJA)',
    filingOpens: null,
    deadlines: [{ kind: 'standard', date: '2026-05-20' }],
    authorityPreparation: 'prepared',
    portal: 'eSZJA',
    sourceUrl: 'https://nav.gov.hu/sajtoszoba/hirek/Indul_a_2026-os_szja-szezon',
  },
  {
    countryCode: 'SK',
    taxYear: 2025,
    formName: 'Daňové priznanie k dani z príjmov fyzickej osoby',
    filingOpens: null,
    deadlines: [{ kind: 'standard', date: '2026-03-31' }],
    authorityPreparation: null,
    portal: null,
    sourceUrl:
      'https://podpora.financnasprava.sk/398970-Lehota-na-podanie-da%C5%88ov%C3%A9ho-priznania-k-dani-z-pr%C3%ADjmov-za-rok-2025',
  },
  {
    countryCode: 'RO',
    taxYear: 2025,
    formName: 'Declarația unică (formular 212)',
    filingOpens: null,
    deadlines: [{ kind: 'standard', date: '2026-05-25' }],
    authorityPreparation: null,
    portal: 'SPV (anaf.ro)',
    sourceUrl: 'https://static.anaf.ro/static/3/Cluj/20260522102135_25_%20mai_%202026%20.pdf',
  },
  {
    countryCode: 'PT',
    taxYear: 2025,
    formName: 'IRS — Modelo 3',
    filingOpens: '2026-04-01',
    deadlines: [{ kind: 'standard', date: '2026-06-30' }],
    // IRS Automático, for eligible taxpayers only; the eligibility conditions were not verified.
    authorityPreparation: 'becomes_final',
    portal: 'Portal das Finanças',
    sourceUrl:
      'https://info.portaldasfinancas.gov.pt/pt/apoio_ao_contribuinte/Cidadaos/Rendimentos/Declaracao/IRS_automatico/Paginas/default.aspx',
  },
  {
    countryCode: 'SI',
    taxYear: 2025,
    formName: 'Napoved za odmero dohodnine',
    filingOpens: null,
    deadlines: [{ kind: 'no_assessment_received', date: '2026-07-31' }],
    authorityPreparation: 'becomes_final',
    portal: 'eDavki',
    sourceUrl:
      'https://www.fu.gov.si/fileadmin/Internet/Davki_in_druge_dajatve/Podrocja/Dohodnina/Letna_odmera_dohodnine/Opis/Odmera_dohodnine_za_leto_2025.doc',
  },
  {
    countryCode: 'LU',
    taxYear: 2025,
    formName: 'Modèle 100 (annexes 111c, 112 for business income)',
    filingOpens: '2026-04-07',
    // Same date on paper and online.
    deadlines: [{ kind: 'standard', date: '2026-12-31' }],
    authorityPreparation: null,
    portal: 'MyGuichet.lu',
    sourceUrl:
      'https://guichet.public.lu/fr/citoyens/fiscalite/declaration-impot-decompte/activite-professionnelle/declaration-revenus/declaration-impot.html',
  },
  {
    countryCode: 'DK',
    taxYear: 2025,
    formName: 'Oplysningsskema',
    filingOpens: null,
    // Owners of a personal business get no årsopgørelse until the oplysningsskema is filed.
    deadlines: [{ kind: 'standard', date: '2026-07-01' }],
    authorityPreparation: null,
    // Whether an unchanged årsopgørelse becomes final was not verified.
    forType: type =>
      type === 'employee'
        ? {
            formName: 'Årsopgørelse',
            filingOpens: '2026-03-23',
            deadlines: [{ kind: 'correction', date: '2026-05-20' }],
            authorityPreparation: 'prepared',
            retention: null,
          }
        : {},
    // Bogføringsloven § 12: 5 years from the end of the financial year.
    retention: {
      periods: [{ kind: 'accounting_records', years: 5, until: '2030-12-31' }],
      sourceUrl: 'https://www.retsinformation.dk/eli/lta/2022/700',
    },
    portal: 'TastSelv Borger (skat.dk)',
    sourceUrl: 'https://skat.dk/borger/aarsopgoerelse/aarsopgoerelsen-hvornaar-sker-hvad',
  },
  {
    countryCode: 'SE',
    taxYear: 2025,
    formName: 'Inkomstdeklaration 1 (NE annex for sole traders)',
    filingOpens: '2026-03-17',
    deadlines: [
      { kind: 'standard', date: '2026-05-04' },
      { kind: 'with_extension', date: '2026-06-01' },
      // byråanstånd, requested by the accounting firm.
      { kind: 'adviser', date: '2026-06-15' },
    ],
    authorityPreparation: null,
    forType: SE_FOR_TYPE,
    portal: 'Skatteverket e-tjänst (Mina sidor)',
    sourceUrl:
      'https://www.skatteverket.se/foretag/inkomstdeklaration/deklareraenskildnaringsverksamhet.4.133ff59513d6f9ee2ebf00.html',
  },
  {
    countryCode: 'FI',
    taxYear: 2025,
    // Filed every year, even without activity; assumes a calendar-year accounting period.
    formName: 'Elinkeinotoiminnan veroilmoitus (5)',
    filingOpens: null,
    deadlines: [{ kind: 'standard', date: '2026-04-01' }],
    authorityPreparation: null,
    // The pre-completed return: each taxpayer's own correction date is printed on it.
    forType: type =>
      type === 'employee'
        ? {
            formName: 'Esitäytetty veroilmoitus',
            deadlines: ['2026-04-01', '2026-04-14', '2026-04-21', '2026-04-28'].map(date => ({
              kind: 'correction' as const,
              date,
            })),
            authorityPreparation: 'becomes_final',
            sourceUrl:
              'https://www.vero.fi/henkiloasiakkaat/verokortti-ja-veroilmoitus/veroilmoitus_ja_verotuspaato/',
          }
        : {},
    portal: 'OmaVero',
    sourceUrl:
      'https://www.vero.fi/yritykset-ja-yhteisot/verot-ja-maksut/liikkeen-tai-ammatinharjoittaja/',
  },
  {
    countryCode: 'GR',
    taxYear: 2025,
    formName: 'Ε1 (Ε3 for business income)',
    filingOpens: null,
    deadlines: [{ kind: 'standard', date: '2026-07-24' }],
    // Ε3 comes prefilled from myDATA and can be changed; deemed filing was not verified.
    authorityPreparation: 'prepared_needs_confirmation',
    forType: GR_FOR_TYPE,
    portal: null,
    sourceUrl: 'https://www.aade.gr/dilosi-forologias-eisodimatos-fp-e1-e2-e3',
  },
  {
    countryCode: 'MT',
    taxYear: 2025,
    formName: 'Personal Income Tax Return (Year of Assessment 2026)',
    filingOpens: '2026-05-15',
    // Standing MTCA rule (30 June, online 31 July); no year-specific notice confirmed the dates.
    deadlines: [
      { kind: 'standard', date: '2026-06-30' },
      { kind: 'online', date: '2026-07-31' },
    ],
    authorityPreparation: null,
    portal: 'myTax (mtca.gov.mt)',
    sourceUrl: 'https://mtca.gov.mt/personal-tax/individual/tax-return-cycle',
  },
  {
    countryCode: 'NL',
    taxYear: 2025,
    formName: 'Aangifte inkomstenbelasting 2025',
    filingOpens: null,
    deadlines: [{ kind: 'standard', date: '2026-05-01' }],
    // Prefilled, but never final on its own; entrepreneurs may only file online.
    authorityPreparation: 'prepared_needs_confirmation',
    portal: 'Mijn Belastingdienst',
    sourceUrl:
      'https://www.belastingdienst.nl/wps/wcm/connect/nl/belastingaangifte/content/kan-ik-nog-uitstel-aanvragen-belastingaangifte',
  },
  {
    countryCode: 'EE',
    taxYear: 2025,
    formName: 'Form A + Form E (business income)',
    filingOpens: '2026-02-16',
    deadlines: [{ kind: 'standard', date: '2026-04-30' }],
    // Form A is prefilled; Form E never is, and sole proprietors must file even without income.
    authorityPreparation: 'prepared_needs_confirmation',
    forType: EE_FOR_TYPE,
    portal: 'e-MTA',
    sourceUrl:
      'https://www.emta.ee/en/private-client/taxes-and-payment/declaration-income/income-tax-returns-2025',
  },
  {
    countryCode: 'LV',
    taxYear: 2025,
    formName: 'Gada ienākumu deklarācija',
    filingOpens: '2026-03-01',
    // Self-employed may only file through EDS.
    deadlines: [
      { kind: 'standard', date: '2026-06-01' },
      { kind: 'higher_rate_income', date: '2026-07-01' },
    ],
    authorityPreparation: null,
    portal: 'EDS (VID)',
    sourceUrl: 'https://www.vid.gov.lv/lv/deklaraciju-iesniegsanas-un-nodoklu-nomaksas-termini',
  },
  {
    countryCode: 'LT',
    taxYear: 2025,
    formName: 'GPM311 (GPM311C for individual activity)',
    filingOpens: null,
    deadlines: [{ kind: 'standard', date: '2026-05-04' }],
    authorityPreparation: 'prepared_needs_confirmation',
    portal: 'Mano VMI',
    sourceUrl:
      'https://www.vmi.lt/evmi/paaiskinimai-apie-2025-metu-pajamu-ir-turto-deklaravimo-tvarka',
  },
  {
    countryCode: 'HR',
    taxYear: 2025,
    formName: 'Obrazac DOH',
    filingOpens: null,
    // Online only.
    deadlines: [{ kind: 'online', date: '2026-03-02' }],
    authorityPreparation: null,
    portal: 'ePorezna',
    sourceUrl: 'https://porezna-uprava.gov.hr/hr/godisnji-obracun-poreza-na-dohodak/3957',
  },
  {
    countryCode: 'CY',
    taxYear: 2025,
    formName: 'Individual Income Tax Return',
    filingOpens: '2026-06-18',
    deadlines: [{ kind: 'standard', date: '2026-10-31' }],
    authorityPreparation: null,
    portal: 'TAXISnet',
    sourceUrl:
      'https://www.gov.cy/oikonomia/anakoinosi-tou-tmimatos-forologias-anaforika-me-tin-enarxi-tis-ypovolis-tis-dilosis-eisodimatos-atomou-gia-to-forologiko-etos-2025/',
  },
];

/** A date fixed by law, counted from the end of the tax year. */
interface DateRule {
  month: number;
  day: number | 'last';
  /** 1 = the year after the tax year (the default), 2 = the one after that. */
  yearsAfter?: number;
}

/**
 * The rule a country's law sets for every tax year, rather than one year's
 * published dates. Each was read in the statute or on the authority's page in
 * the research pass of 2026-10-10 (docs/plans/tax-deadlines-2026-10-10), which
 * also checked that it gives the dates already announced. A year without a
 * published entry gets its dates from here, labelled as worked out from the
 * statute, so nothing has to be added each year for these countries.
 *
 * Left out, because their calendar is set anew each year by order or decree:
 * ES, FR, BE; LU (two official pages disagree) and GB (its tax year is not a
 * calendar year). Deadline kinds that are announced each year (Ireland's ROS
 * pay-and-file date, Sweden's extensions, Malta's online extension) are left
 * out too: the statutory date is the one given.
 */
interface StatutoryRule {
  countryCode: string;
  /** The first tax year this rule is used for; earlier years use the published entries. */
  fromTaxYear: number;
  formName: string | ((taxYear: number) => string);
  /** `shifts`: the opening day moves off a weekend or holiday too. */
  filingOpens: (DateRule & { shifts?: boolean }) | null;
  deadlines: Array<DateRule & { kind: DeadlineKind }>;
  /**
   * Whether the law moves a deadline that falls on a weekend or a public
   * holiday to the next working day. Set only where that was confirmed for
   * the income-tax return; elsewhere the date is shown as the law states it,
   * which may be a day or two early but never late.
   */
  shiftsToNextBusinessDay: boolean;
  authorityPreparation: AuthorityPreparation | null;
  portal: string | null;
  sourceUrl: string;
  /** Periods counted in years from the end of the tax year. */
  retention?: { periods: Array<{ kind: RetentionKind; years: number }>; sourceUrl: string };
  forType?: ForType;
}

const STATUTE_CHECKED_AT = '2026-10-10';

const STATUTORY_RULES: StatutoryRule[] = [
  {
    countryCode: 'DE',
    fromTaxYear: 2026,
    formName: 'Einkommensteuererklärung (ESt 1 A)',
    filingOpens: null,
    // § 149 Abs. 2/3 AO; § 108 Abs. 3 AO moves a weekend or holiday deadline.
    deadlines: [
      { kind: 'standard', month: 7, day: 31 },
      { kind: 'adviser', month: 2, day: 'last', yearsAfter: 2 },
    ],
    shiftsToNextBusinessDay: true,
    authorityPreparation: null,
    portal: 'ELSTER',
    sourceUrl: 'https://www.gesetze-im-internet.de/ao_1977/__149.html',
    retention: {
      periods: [
        { kind: 'booking_documents', years: 8 },
        { kind: 'books_and_records', years: 10 },
        { kind: 'other_business_documents', years: 6 },
      ],
      sourceUrl: 'https://www.gesetze-im-internet.de/ao_1977/__147.html',
    },
    forType: RETENTION_FOR_BUSINESS_ONLY,
  },
  {
    countryCode: 'AT',
    fromTaxYear: 2026,
    formName: 'Einkommensteuererklärung (E1)',
    filingOpens: null,
    // § 134 Abs. 1 BAO; the adviser date is the quota-system deadline (§ 134a BAO).
    deadlines: [
      { kind: 'paper', month: 4, day: 30 },
      { kind: 'online', month: 6, day: 30 },
      { kind: 'adviser', month: 3, day: 31, yearsAfter: 2 },
    ],
    shiftsToNextBusinessDay: false,
    authorityPreparation: null,
    portal: 'FinanzOnline',
    sourceUrl:
      'https://www.bmf.gv.at/themen/steuern/fuer-unternehmen/einkommensteuer/einkommensteuererklaerungspflicht.html',
  },
  {
    countryCode: 'PL',
    fromTaxYear: 2026,
    formName: 'PIT-36 / PIT-36L / PIT-28',
    filingOpens: { month: 2, day: 15 },
    deadlines: [{ kind: 'standard', month: 4, day: 30 }],
    shiftsToNextBusinessDay: false,
    authorityPreparation: null,
    portal: 'Twój e-PIT',
    sourceUrl: 'https://www.biznes.gov.pl/pl/portal/ou893',
    forType: PL_FOR_TYPE,
  },
  {
    countryCode: 'CZ',
    fromTaxYear: 2026,
    formName: 'Přiznání k dani z příjmů fyzických osob (DPFO)',
    filingOpens: null,
    // § 136 odst. 1/2 daňového řádu: 3, 4 (electronic) and 6 (adviser) months; § 33 odst. 4 moves the day.
    deadlines: [
      { kind: 'standard', month: 4, day: 1 },
      { kind: 'online', month: 5, day: 1 },
      { kind: 'adviser', month: 7, day: 1 },
    ],
    shiftsToNextBusinessDay: true,
    authorityPreparation: null,
    portal: 'MOJE daně',
    sourceUrl:
      'https://financnisprava.gov.cz/cs/dane/dane/dan-z-prijmu/fyzicke-osoby/obecne-informace',
  },
  {
    countryCode: 'SK',
    fromTaxYear: 2026,
    formName: 'Daňové priznanie k dani z príjmov FO, typ B',
    filingOpens: null,
    // § 49 ZDP: 3 months, extendable by notice to 3 more, or 6 with foreign income.
    deadlines: [
      { kind: 'standard', month: 3, day: 31 },
      { kind: 'with_extension', month: 6, day: 30 },
      { kind: 'with_extension', month: 9, day: 30 },
    ],
    shiftsToNextBusinessDay: false,
    authorityPreparation: null,
    portal: null,
    sourceUrl:
      'https://podpora.financnasprava.sk/516395-Povinnos%C5%A5-poda%C5%A5-da%C5%88ov%C3%A9-priznanie-k-dani-z-pr%C3%ADjmov-FO-za-rok-2026',
  },
  {
    countryCode: 'HU',
    fromTaxYear: 2026,
    formName: taxYear => `Személyijövedelemadó-bevallás (${String(taxYear).slice(2)}SZJA)`,
    filingOpens: null,
    deadlines: [{ kind: 'standard', month: 5, day: 20 }],
    shiftsToNextBusinessDay: false,
    // NAV drafts it; a sole trader's draft does not become the return on its own.
    authorityPreparation: 'prepared',
    portal: 'eSZJA',
    sourceUrl:
      'https://nav.gov.hu/sajtoszoba/hirek/Az_egyeni_vallalkozoknak_afas_maganszemelyeknek_ostermeloknek_mindenkepp_foglalkozniuk_kell_a_bevallassal',
  },
  {
    countryCode: 'SI',
    fromTaxYear: 2026,
    formName: 'Obračun akontacije dohodnine in dohodnine od dohodka iz dejavnosti (DDD-DDD)',
    filingOpens: null,
    deadlines: [{ kind: 'standard', month: 3, day: 31 }],
    shiftsToNextBusinessDay: false,
    authorityPreparation: null,
    portal: 'eDavki',
    sourceUrl:
      'https://www.fu.gov.si/en/business_events_businesses/income_tax_prepayment_calculation_and_the_calculation_of_personal_income_tax_prepayment_on_income_from_self_employment',
    // Without business income FURS sends an informativni izračun and nothing is filed.
    forType: type =>
      type === 'employee'
        ? {
            formName: 'Informativni izračun dohodnine',
            deadlines: [],
            authorityPreparation: 'becomes_final',
          }
        : {},
  },
  {
    countryCode: 'HR',
    fromTaxYear: 2026,
    formName: 'Godišnja prijava poreza na dohodak (Obrazac DOH)',
    filingOpens: null,
    // "do kraja veljače"; Porezna uprava moved the 2025 deadline off the weekend.
    deadlines: [{ kind: 'standard', month: 2, day: 'last' }],
    shiftsToNextBusinessDay: true,
    authorityPreparation: null,
    portal: 'ePorezna',
    sourceUrl: 'https://porezna-uprava.gov.hr/hr/godisnjaporeznaprijava/4570',
  },
  {
    countryCode: 'PT',
    fromTaxYear: 2026,
    formName: 'Declaração Modelo 3 de IRS',
    // CIRS art. 60(1).
    filingOpens: { month: 4, day: 1 },
    deadlines: [{ kind: 'standard', month: 6, day: 30 }],
    shiftsToNextBusinessDay: false,
    authorityPreparation: 'becomes_final',
    portal: 'Portal das Finanças',
    sourceUrl:
      'https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios/cirs_rep/Pages/irs60.aspx',
  },
  {
    countryCode: 'IT',
    fromTaxYear: 2026,
    formName: taxYear => `Modello Redditi Persone Fisiche ${taxYear + 1} (Redditi PF)`,
    filingOpens: null,
    // DPR 322/1998 art. 2; Agenzia delle Entrate moves it past weekends and 1 November.
    deadlines: [{ kind: 'online', month: 10, day: 31 }],
    shiftsToNextBusinessDay: true,
    authorityPreparation: 'prepared_needs_confirmation',
    portal: 'Agenzia delle Entrate — dichiarazione precompilata',
    sourceUrl:
      'https://www.agenziaentrate.gov.it/portale/come-e-quando-presentare-la-dichiarazione-dei-redditi',
    // The 730's dates were only checked for 2025.
    forType: type =>
      type === 'employee' ? { formName: '730 precompilato', filingOpens: null, deadlines: [] } : {},
  },
  {
    countryCode: 'NL',
    fromTaxYear: 2026,
    formName: taxYear => `Aangifte inkomstenbelasting ${taxYear}`,
    filingOpens: null,
    deadlines: [
      { kind: 'standard', month: 5, day: 1 },
      { kind: 'with_extension', month: 9, day: 1 },
    ],
    shiftsToNextBusinessDay: false,
    authorityPreparation: 'prepared_needs_confirmation',
    portal: 'Mijn Belastingdienst',
    sourceUrl:
      'https://www.belastingdienst.nl/wps/wcm/connect/nl/belastingaangifte/content/wanneer-moet-ik-aangifte-doen',
  },
  {
    countryCode: 'IE',
    fromTaxYear: 2026,
    formName: 'Form 11 (self-assessment income tax return)',
    filingOpens: null,
    // Revenue does not move it off a weekend.
    deadlines: [{ kind: 'standard', month: 10, day: 31 }],
    shiftsToNextBusinessDay: false,
    authorityPreparation: null,
    portal: 'ROS (Revenue Online Service)',
    sourceUrl:
      'https://www.revenue.ie/en/self-assessment-and-self-employment/guide-to-self-assessment/pay-file-system.aspx',
  },
  {
    countryCode: 'MT',
    fromTaxYear: 2026,
    formName: taxYear =>
      `Individual income tax return (year of assessment ${taxYear + 1}, basis year ${taxYear})`,
    filingOpens: null,
    // S.L. 372.16 rule 2(c)(ii).
    deadlines: [{ kind: 'standard', month: 6, day: 30 }],
    shiftsToNextBusinessDay: false,
    authorityPreparation: null,
    portal: 'myTax (mtca.gov.mt)',
    sourceUrl: 'https://legislation.mt/getpdf/6022595cbc8272018c0f2ad2',
  },
  {
    countryCode: 'CY',
    fromTaxYear: 2026,
    formName: 'Individual Income Tax Return (T.D.1)',
    filingOpens: null,
    // The statutory date; the Council of Ministers has extended it by decree every recent year.
    deadlines: [{ kind: 'standard', month: 7, day: 31 }],
    shiftsToNextBusinessDay: false,
    authorityPreparation: null,
    portal: 'Tax For All',
    sourceUrl: 'https://www.gov.cy/mof-tax/en/documents/forologiki-dilosi-eisodimatos-atomoy/',
  },
  {
    countryCode: 'GR',
    fromTaxYear: 2026,
    formName: 'E1 personal income tax return (with E2/E3)',
    // Law 4172/2013 art. 67(1); art. 67(8) moves only the opening day.
    filingOpens: { month: 3, day: 15, shifts: true },
    deadlines: [{ kind: 'standard', month: 7, day: 15 }],
    shiftsToNextBusinessDay: false,
    authorityPreparation: 'prepared_needs_confirmation',
    portal: null,
    sourceUrl: 'https://minfin.gov.gr/paratasi-eos-15-maiou-gia-tis-diloseis-me-ekptosi-forou-4/',
    forType: GR_FOR_TYPE,
  },
  {
    countryCode: 'SE',
    fromTaxYear: 2026,
    formName: 'Inkomstdeklaration 1 (with NE appendix for enskild näringsverksamhet)',
    filingOpens: null,
    // Skatteförfarandelagen ch. 32; lag (1930:173) § 2 moves it off weekends and holidays.
    deadlines: [{ kind: 'standard', month: 5, day: 2 }],
    shiftsToNextBusinessDay: true,
    authorityPreparation: null,
    portal: 'Skatteverket e-tjänst (Mina sidor)',
    sourceUrl: 'https://lagen.nu/2011:1244',
    forType: SE_FOR_TYPE,
  },
  {
    countryCode: 'DK',
    fromTaxYear: 2026,
    formName: 'Oplysningsskema',
    filingOpens: null,
    deadlines: [{ kind: 'standard', month: 7, day: 1 }],
    shiftsToNextBusinessDay: false,
    authorityPreparation: null,
    portal: 'TastSelv Borger (skat.dk)',
    sourceUrl: 'https://info.skat.dk/data.aspx?oid=2284485',
    retention: {
      periods: [{ kind: 'accounting_records', years: 5 }],
      sourceUrl: 'https://www.retsinformation.dk/eli/lta/2022/700',
    },
    // The employee's correction date was only checked for 2025.
    forType: type =>
      type === 'employee'
        ? {
            formName: 'Årsopgørelse',
            filingOpens: null,
            deadlines: [],
            authorityPreparation: 'prepared',
            retention: null,
          }
        : {},
  },
  {
    countryCode: 'FI',
    fromTaxYear: 2026,
    formName: 'Elinkeinotoiminnan veroilmoitus (5)',
    filingOpens: null,
    // Verohallinnon päätös VH/7393/00.01.00/2024 § 6.
    deadlines: [{ kind: 'standard', month: 4, day: 1 }],
    shiftsToNextBusinessDay: false,
    authorityPreparation: null,
    portal: 'OmaVero',
    sourceUrl:
      'https://www.vero.fi/syventavat-vero-ohjeet/paatokset/60350/verohallinnon-paatos-veroilmoituksen-ja-kiinteistotietojen-ilmoituksen-antamisesta5/',
    // Each taxpayer's own correction date is printed on the pre-completed return.
    forType: type =>
      type === 'employee'
        ? {
            formName: 'Esitäytetty veroilmoitus',
            deadlines: [],
            authorityPreparation: 'becomes_final',
            sourceUrl:
              'https://www.vero.fi/henkiloasiakkaat/verokortti-ja-veroilmoitus/veroilmoitus_ja_verotuspaato/',
          }
        : {},
  },
  {
    countryCode: 'EE',
    fromTaxYear: 2026,
    formName: 'Tuludeklaratsioon vorm A + vorm E (FIE ettevõtlustulu)',
    // e-MTA opens on 15 February, or the next working day.
    filingOpens: { month: 2, day: 15, shifts: true },
    deadlines: [{ kind: 'standard', month: 4, day: 30 }],
    shiftsToNextBusinessDay: false,
    authorityPreparation: 'prepared_needs_confirmation',
    portal: 'e-MTA',
    sourceUrl: 'https://www.emta.ee/node/125/handbook/7/pdf',
    forType: EE_FOR_TYPE,
  },
  {
    countryCode: 'LV',
    fromTaxYear: 2026,
    formName: 'Gada ienākumu deklarācija',
    // Art. 19(5): 1 March to 1 June; 1 April to 1 July with higher-rate income.
    filingOpens: { month: 3, day: 1 },
    deadlines: [
      { kind: 'standard', month: 6, day: 1 },
      { kind: 'higher_rate_income', month: 7, day: 1 },
    ],
    shiftsToNextBusinessDay: false,
    authorityPreparation: null,
    portal: 'EDS (VID)',
    sourceUrl: 'https://likumi.lv/ta/id/56880-par-iedzivotaju-ienakuma-nodokli',
  },
  {
    countryCode: 'LT',
    fromTaxYear: 2026,
    formName: 'Metinė pajamų mokesčio deklaracija GPM311',
    filingOpens: null,
    // GPMĮ art. 27(1); MAĮ art. 162(6) moves it off weekends and holidays.
    deadlines: [{ kind: 'standard', month: 5, day: 1 }],
    shiftsToNextBusinessDay: true,
    authorityPreparation: 'prepared_needs_confirmation',
    portal: 'Mano VMI',
    sourceUrl: 'https://e-seimas.lrs.lt/rs/actualedition/TAIS.171369/QTlvfEvkKY/format/ISO_PDF/',
  },
  {
    countryCode: 'RO',
    fromTaxYear: 2026,
    formName: 'Declarația unică (formular 212)',
    filingOpens: null,
    // Codul fiscal art. 122.
    deadlines: [{ kind: 'standard', month: 5, day: 25 }],
    shiftsToNextBusinessDay: false,
    authorityPreparation: null,
    portal: 'SPV (anaf.ro)',
    sourceUrl: 'https://static.anaf.ro/static/10/Cluj/cj_DU_activ_indep_22apr2026.pdf',
  },
  {
    countryCode: 'BG',
    fromTaxYear: 2026,
    formName: 'Годишна данъчна декларация по чл. 50 ЗДДФЛ',
    // Self-employed who are not traders; sole traders (ЕТ) file 1 March to 30 June.
    filingOpens: { month: 1, day: 10 },
    deadlines: [{ kind: 'standard', month: 4, day: 30 }],
    shiftsToNextBusinessDay: false,
    authorityPreparation: null,
    portal: null,
    sourceUrl:
      'https://nra.bg/wps/portal/nra/taxes/godishen-danak-varhu-dohdite/danak-vurhu-dohodite-na-fizicheskite-lica',
  },
  {
    countryCode: 'KZ',
    fromTaxYear: 2026,
    formName:
      'Декларация по ИПН по предпринимательской деятельности (форма 220.00) — ИП на общеустановленном режиме',
    filingOpens: null,
    // Налоговый кодекс 2026, ст. 420(2).
    deadlines: [{ kind: 'standard', month: 3, day: 31 }],
    shiftsToNextBusinessDay: false,
    authorityPreparation: null,
    portal: null,
    sourceUrl: 'https://adilet.zan.kz/rus/docs/K2500000214',
  },
];

const NO_HOLIDAYS: ReadonlySet<string> = new Set();

function dateUnder(
  rule: DateRule,
  taxYear: number,
  shifts: boolean,
  holidays: ReadonlySet<string>,
): string {
  const year = taxYear + (rule.yearsAfter ?? 1);
  const lastDay = new Date(Date.UTC(year, rule.month, 0)).getUTCDate();
  const day = rule.day === 'last' ? lastDay : Math.min(rule.day, lastDay);
  const date = `${year}-${String(rule.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return shifts ? onOrAfterBusinessDay(date, holidays) : date;
}

function statutoryInfo(
  rule: StatutoryRule,
  taxYear: number,
  holidays: ReadonlySet<string>,
): Omit<Entry, 'forType'> & Pick<FilingInfo, 'basis' | 'checkedAt'> {
  return {
    countryCode: rule.countryCode,
    taxYear,
    formName: typeof rule.formName === 'function' ? rule.formName(taxYear) : rule.formName,
    filingOpens: rule.filingOpens
      ? dateUnder(rule.filingOpens, taxYear, rule.filingOpens.shifts === true, holidays)
      : null,
    deadlines: rule.deadlines.map(({ kind, ...date }) => ({
      kind,
      date: dateUnder(date, taxYear, rule.shiftsToNextBusinessDay, holidays),
    })),
    authorityPreparation: rule.authorityPreparation,
    portal: rule.portal,
    sourceUrl: rule.sourceUrl,
    ...(rule.retention
      ? {
          retention: {
            sourceUrl: rule.retention.sourceUrl,
            periods: rule.retention.periods.map(period => ({
              ...period,
              until: `${taxYear + period.years}-12-31`,
            })),
          },
        }
      : {}),
    basis: 'statute',
    checkedAt: STATUTE_CHECKED_AT,
  };
}

/**
 * Where, by when and on which form the year's return is filed; NULL when
 * neither the year's published dates nor the country's rule are known.
 * `holidays` are the country's public holidays (YYYY-MM-DD) for moving a
 * deadline off them; without them only weekends are skipped.
 */
export function filingInfoFor(
  countryCode: string,
  taxYear: number,
  taxpayerType: TaxpayerType,
  details: Record<string, unknown>,
  holidays: ReadonlySet<string> = NO_HOLIDAYS,
): FilingInfo | null {
  const country = countryCode.toUpperCase();
  const entry = ENTRIES.find(
    candidate => candidate.countryCode === country && candidate.taxYear === taxYear,
  );
  if (entry) {
    const { forType, ...info } = entry;
    return {
      retention: null,
      ...info,
      basis: 'published',
      checkedAt: PUBLISHED_CHECKED_AT,
      ...forType?.(taxpayerType, details),
    };
  }

  const rule = STATUTORY_RULES.find(
    candidate => candidate.countryCode === country && taxYear >= candidate.fromTaxYear,
  );
  if (!rule) {
    return null;
  }
  return {
    retention: null,
    ...statutoryInfo(rule, taxYear, holidays),
    ...rule.forType?.(taxpayerType, details),
  };
}

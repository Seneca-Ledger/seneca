import { StoicClass } from '../../../entities/category.entity';

/**
 * Word stems per class, matched at the start of a word so "bar" does not fire
 * on "barber". The order of CLASS_ORDER matters where a name could fit two
 * classes: "Meals and entertainment" is leisure before it is food, and a
 * pharmacy is health before it is a necessity.
 *
 * English stems cover the seeded system categories (categories.service.ts);
 * the others cover the names users and the parser most often create.
 */
const STEMS: Record<StoicClass, string[]> = {
  [StoicClass.VIRTUE]: [
    // en
    'health',
    'medic',
    'pharma',
    'doctor',
    'dental',
    'education',
    'course',
    'book',
    'training',
    'charit',
    'donat',
    'gift',
    'sport',
    'gym',
    'fitness',
    'saving',
    'invest',
    'learning',
    // ru / uk
    'здоров',
    'медиц',
    'аптек',
    'врач',
    'стоматолог',
    'образов',
    'обучен',
    'курс',
    'книг',
    'благотвор',
    'пожертв',
    'подар',
    'спорт',
    'фитнес',
    'сбереж',
    'накоплен',
    'инвест',
    // de / es
    'gesundheit',
    'apotheke',
    'bildung',
    'spende',
    'salud',
    'farmacia',
    'educaci',
    'donaci',
  ],
  [StoicClass.LEISURE]: [
    'entertain',
    'restaurant',
    'cafe',
    'coffee',
    'bar',
    'cinema',
    'movie',
    'game',
    'hobby',
    'travel',
    'vacation',
    'holiday',
    'streaming',
    'alcohol',
    'shopping',
    'leisure',
    'meals',
    'развлеч',
    'ресторан',
    'кафе',
    'кофе',
    'бар',
    'кино',
    'игр',
    'хобби',
    'путешеств',
    'отпуск',
    'отдых',
    'алкогол',
    'шопинг',
    'досуг',
    'freizeit',
    'reise',
    'urlaub',
    'ocio',
    'viaje',
    'restaurante',
  ],
  [StoicClass.WORK]: [
    'advertis',
    'marketing',
    'payroll',
    'salar',
    'benefits',
    'equipment',
    'office',
    'software',
    'professional',
    'material',
    'contractor',
    'hosting',
    'business',
    'service',
    'реклам',
    'маркетинг',
    'зарплат',
    'оборудов',
    'офис',
    'софт',
    'программ',
    'материал',
    'подрядч',
    'хостинг',
    'бизнес',
    'werbung',
    'büro',
    'publicidad',
    'oficina',
  ],
  [StoicClass.NECESSITY]: [
    'rent',
    'mortgage',
    'utilit',
    'grocer',
    'food',
    'transport',
    'fuel',
    'vehicle',
    'insurance',
    'tax',
    'loan',
    'interest',
    'fee',
    'repair',
    'maintenance',
    'phone',
    'internet',
    'housing',
    'аренд',
    'ипотек',
    'коммунал',
    'продукт',
    'еда',
    'питан',
    'транспорт',
    'топлив',
    'бензин',
    'страх',
    'налог',
    'кредит',
    'процент',
    'комисс',
    'ремонт',
    'связь',
    'интернет',
    'жиль',
    'miete',
    'lebensmittel',
    'versicherung',
    'steuer',
    'alquiler',
    'comida',
    'seguro',
    'impuesto',
  ],
};

/** Names that mean money given to others rather than spent on oneself. */
const HELPS_OTHERS_STEMS = [
  'charit',
  'donat',
  'gift',
  'tithe',
  'zakat',
  'volunteer',
  'helping',
  'благотвор',
  'пожертв',
  'подар',
  'помощь',
  'донат',
  'милостын',
  'spende',
  'geschenk',
  'donaci',
  'regalo',
  'caridad',
  'cadeau',
];

const CLASS_ORDER: StoicClass[] = [
  StoicClass.VIRTUE,
  StoicClass.LEISURE,
  StoicClass.WORK,
  StoicClass.NECESSITY,
];

const escapeRegExp = (stem: string) => stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const PATTERNS: Array<[StoicClass, RegExp]> = CLASS_ORDER.map(stoicClass => [
  stoicClass,
  new RegExp(`(^|[^\\p{L}])(${STEMS[stoicClass].map(escapeRegExp).join('|')})`, 'iu'),
]);

const HELPS_OTHERS_PATTERN = new RegExp(
  `(^|[^\\p{L}])(${HELPS_OTHERS_STEMS.map(escapeRegExp).join('|')})`,
  'iu',
);

/** Whether a category's name says its money goes to others. */
export function suggestHelpsOthers(name: string | null | undefined): boolean {
  return Boolean(name) && HELPS_OTHERS_PATTERN.test(name as string);
}

/**
 * A first guess at how a category's spending should be judged, from its name
 * alone. Null means the name gives nothing away — the user is asked instead of
 * the app pretending to know.
 */
export function suggestStoicClass(name: string | null | undefined): StoicClass | null {
  if (!name) {
    return null;
  }
  for (const [stoicClass, pattern] of PATTERNS) {
    if (pattern.test(name)) {
      return stoicClass;
    }
  }
  return null;
}

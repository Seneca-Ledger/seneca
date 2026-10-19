/**
 * What a spreadsheet header usually says for each field of each target.
 * Tokens are compared after lowercasing and stripping punctuation, so
 * «Сумма, ₸» matches `сумма` and "Due date" matches `duedate`.
 */
export type ImportTargetKind =
  | 'transactions'
  | 'payables'
  | 'subscriptions'
  | 'invoices'
  | 'budgets'
  | 'metals';

export const IMPORT_TARGET_KINDS: ImportTargetKind[] = [
  'transactions',
  'payables',
  'subscriptions',
  'invoices',
  'budgets',
  'metals',
];

export type TargetFieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'boolean'
  | 'enum'
  | 'category'
  | 'client';

export interface TargetField {
  key: string;
  type: TargetFieldType;
  required: boolean;
  /** Enum values the field accepts (before alias resolution). */
  options?: string[];
  aliases: string[];
}

const DATE = ['date', 'дата', 'день', 'when', 'datum', 'fecha'];
const AMOUNT = [
  'amount',
  'sum',
  'total',
  'сумма',
  'итого',
  'стоимость',
  'цена',
  'price',
  'cost',
  'value',
  'betrag',
  'importe',
  'summe',
];
const CURRENCY = ['currency', 'валюта', 'curr', 'вал', 'währung', 'moneda'];
const CATEGORY = [
  'category',
  'категория',
  'kategorie',
  'categoría',
  'статья',
  'тип расхода',
  'group',
  'группа',
];
const COMMENT = [
  'comment',
  'note',
  'notes',
  'memo',
  'описание',
  'комментарий',
  'примечание',
  'description',
  'details',
];
const VENDOR = [
  'vendor',
  'supplier',
  'merchant',
  'payee',
  'counterparty',
  'контрагент',
  'поставщик',
  'продавец',
  'магазин',
  'получатель',
  'service',
  'сервис',
  'name',
  'название',
];

export const TARGET_FIELDS: Record<ImportTargetKind, TargetField[]> = {
  transactions: [
    { key: 'date', type: 'date', required: true, aliases: DATE },
    {
      key: 'amount',
      type: 'number',
      required: true,
      aliases: [...AMOUNT, 'debit', 'дебет', 'списание', 'расход'],
    },
    { key: 'merchant', type: 'text', required: true, aliases: VENDOR },
    {
      key: 'purpose',
      type: 'text',
      required: false,
      aliases: [...COMMENT, 'purpose', 'назначение', 'transaction', 'операция'],
    },
    { key: 'currency', type: 'text', required: false, aliases: CURRENCY },
    { key: 'category', type: 'category', required: false, aliases: CATEGORY },
    {
      key: 'type',
      type: 'enum',
      required: false,
      options: ['income', 'expense'],
      aliases: ['type', 'тип', 'direction', 'направление', 'income/expense'],
    },
  ],
  payables: [
    { key: 'vendor', type: 'text', required: true, aliases: VENDOR },
    { key: 'amount', type: 'number', required: true, aliases: AMOUNT },
    { key: 'currency', type: 'text', required: false, aliases: CURRENCY },
    {
      key: 'dueDate',
      type: 'date',
      required: false,
      aliases: [
        'due',
        'due date',
        'срок',
        'срок оплаты',
        'оплатить до',
        'deadline',
        'fällig',
        'vencimiento',
        ...DATE,
      ],
    },
    {
      key: 'status',
      type: 'enum',
      required: false,
      options: ['to_pay', 'scheduled', 'paid', 'overdue', 'archived'],
      aliases: ['status', 'статус', 'state', 'состояние'],
    },
    {
      key: 'direction',
      type: 'enum',
      required: false,
      options: ['payable', 'receivable'],
      aliases: ['direction', 'направление', 'type', 'тип'],
    },
    { key: 'comment', type: 'text', required: false, aliases: COMMENT },
    {
      key: 'isRecurring',
      type: 'boolean',
      required: false,
      aliases: ['recurring', 'регулярный', 'повторяется', 'repeat'],
    },
  ],
  subscriptions: [
    {
      key: 'vendorName',
      type: 'text',
      required: true,
      aliases: [...VENDOR, 'subscription', 'подписка', 'plan', 'план'],
    },
    {
      key: 'amount',
      type: 'number',
      required: true,
      aliases: [...AMOUNT, 'monthly', 'в месяц', 'fee', 'платёж'],
    },
    {
      key: 'frequency',
      type: 'enum',
      required: false,
      options: ['weekly', 'monthly', 'quarterly', 'annual'],
      aliases: [
        'frequency',
        'period',
        'billing',
        'периодичность',
        'период',
        'частота',
        'cycle',
        'интервал',
      ],
    },
    { key: 'currency', type: 'text', required: false, aliases: CURRENCY },
    {
      key: 'nextChargeDate',
      type: 'date',
      required: false,
      aliases: [
        'next',
        'next charge',
        'renewal',
        'следующий',
        'следующее списание',
        'продление',
        'дата списания',
        ...DATE,
      ],
    },
    { key: 'category', type: 'category', required: false, aliases: CATEGORY },
  ],
  invoices: [
    {
      key: 'client',
      type: 'client',
      required: true,
      aliases: [
        'client',
        'customer',
        'клиент',
        'заказчик',
        'покупатель',
        'company',
        'компания',
        'bill to',
      ],
    },
    {
      key: 'invoiceNumber',
      type: 'text',
      required: false,
      aliases: ['invoice', 'invoice number', 'number', 'номер', 'счёт', 'счет', '№', 'no'],
    },
    {
      key: 'issueDate',
      type: 'date',
      required: true,
      aliases: [
        'issue',
        'issue date',
        'issued',
        'дата счёта',
        'дата выставления',
        'выставлен',
        ...DATE,
      ],
    },
    {
      key: 'dueDate',
      type: 'date',
      required: false,
      aliases: ['due', 'due date', 'срок', 'срок оплаты', 'оплатить до', 'deadline'],
    },
    { key: 'amount', type: 'number', required: true, aliases: AMOUNT },
    { key: 'currency', type: 'text', required: false, aliases: CURRENCY },
    { key: 'notes', type: 'text', required: false, aliases: COMMENT },
  ],
  budgets: [
    { key: 'category', type: 'category', required: true, aliases: CATEGORY },
    {
      key: 'limit',
      type: 'number',
      required: true,
      aliases: ['limit', 'лимит', 'budget', 'бюджет', 'plan', 'план', ...AMOUNT],
    },
    {
      key: 'periodType',
      type: 'enum',
      required: false,
      options: ['weekly', 'monthly', 'quarterly', 'annual'],
      aliases: ['period', 'периодичность', 'период', 'frequency', 'cycle'],
    },
    {
      key: 'name',
      type: 'text',
      required: false,
      aliases: ['name', 'название', 'title', 'наименование'],
    },
    { key: 'currency', type: 'text', required: false, aliases: CURRENCY },
  ],
  // A stacker's spreadsheet: one row per lot, weight and fineness apart.
  metals: [
    {
      key: 'metal',
      type: 'enum',
      required: true,
      options: ['XAU', 'XAG', 'XPT', 'XPD'],
      aliases: ['metal', 'металл', 'метал', 'type', 'тип', 'kind', 'metall', 'maden'],
    },
    {
      key: 'unitWeight',
      type: 'number',
      required: true,
      aliases: [
        'weight',
        'вес',
        'масса',
        'oz',
        'ozt',
        'unitweight',
        'weightperpiece',
        'gewicht',
        'peso',
        'grams',
        'граммы',
      ],
    },
    {
      key: 'quantity',
      type: 'number',
      required: false,
      aliases: ['quantity', 'qty', 'количество', 'кол', 'pieces', 'pcs', 'count', 'штук', 'шт'],
    },
    {
      key: 'weightUnit',
      type: 'enum',
      required: false,
      options: ['g', 'ozt', 'kg'],
      aliases: ['unit', 'единица', 'weightunit', 'measure', 'einheit'],
    },
    {
      key: 'purity',
      type: 'number',
      required: false,
      aliases: ['purity', 'проба', 'fineness', 'fine', 'чистота', 'feinheit', 'pureza', 'karat'],
    },
    {
      key: 'cost',
      type: 'number',
      required: false,
      aliases: ['paid', 'уплачено', 'оплачено', 'costbasis', ...AMOUNT],
    },
    { key: 'currency', type: 'text', required: false, aliases: CURRENCY },
    { key: 'acquiredOn', type: 'date', required: false, aliases: [...DATE, 'bought', 'куплено'] },
    {
      key: 'counterparty',
      type: 'text',
      required: false,
      aliases: ['dealer', 'дилер', 'продавец', 'seller', 'shop', 'магазин', 'vendor', 'händler'],
    },
    {
      key: 'name',
      type: 'text',
      required: false,
      aliases: ['name', 'название', 'description', 'описание', 'item', 'coin', 'монета', 'bar'],
    },
  ],
};

/** Words that make a header profile point at one target rather than another. */
export const TARGET_HINTS: Record<ImportTargetKind, string[]> = {
  transactions: [
    'transaction',
    'транзакц',
    'операц',
    'statement',
    'выписка',
    'merchant',
    'контрагент',
    'debit',
    'credit',
    'дебет',
    'кредит',
  ],
  payables: [
    'due',
    'срок',
    'оплатить',
    'payable',
    'bill',
    'счёт к оплате',
    'поставщик',
    'vendor',
    'paid',
    'оплачен',
  ],
  subscriptions: [
    'subscription',
    'подписк',
    'frequency',
    'периодичн',
    'monthly',
    'ежемесяч',
    'renewal',
    'продлен',
    'next charge',
    'billing',
  ],
  invoices: [
    'invoice',
    'инвойс',
    'счёт',
    'счет',
    'client',
    'клиент',
    'issue',
    'выставлен',
    'заказчик',
  ],
  budgets: ['budget', 'бюджет', 'limit', 'лимит', 'planned', 'план', 'actual', 'факт'],
  metals: [
    'gold',
    'золото',
    'silver',
    'серебро',
    'platinum',
    'платина',
    'palladium',
    'палладий',
    'ozt',
    'troy',
    'bullion',
    'слиток',
    'монета',
    'purity',
    'проба',
    'fineness',
    'spot',
    'stack',
  ],
};

export const ENUM_ALIASES: Record<string, Record<string, string[]>> = {
  metal: {
    XAU: ['xau', 'gold', 'золото', 'au', 'gelbgold', 'oro', 'altın', 'złoto'],
    XAG: ['xag', 'silver', 'серебро', 'ag', 'silber', 'plata', 'gümüş', 'srebro'],
    XPT: ['xpt', 'platinum', 'платина', 'pt', 'platin', 'platino'],
    XPD: ['xpd', 'palladium', 'палладий', 'pd', 'pallad', 'paladio'],
  },
  weightUnit: {
    g: ['g', 'gr', 'gram', 'grams', 'г', 'гр', 'грамм', 'граммы', 'gramm'],
    ozt: ['ozt', 'oz', 'ounce', 'ounces', 'troy', 'troyounce', 'унция', 'унции', 'унц'],
    kg: ['kg', 'kilo', 'kilogram', 'кг', 'килограмм'],
  },
  frequency: {
    weekly: ['weekly', 'week', 'еженедельно', 'неделя', 'нед', 'wöchentlich', 'semanal'],
    monthly: ['monthly', 'month', 'ежемесячно', 'месяц', 'мес', 'monatlich', 'mensual', 'mo'],
    quarterly: ['quarterly', 'quarter', 'ежеквартально', 'квартал', 'кв'],
    annual: ['annual', 'annually', 'yearly', 'year', 'ежегодно', 'год', 'jährlich', 'anual'],
  },
  status: {
    to_pay: [
      'to pay',
      'to_pay',
      'unpaid',
      'к оплате',
      'не оплачен',
      'не оплачено',
      'pending',
      'open',
      'ожидает',
    ],
    scheduled: ['scheduled', 'запланирован', 'запланировано', 'planned'],
    paid: ['paid', 'оплачен', 'оплачено', 'done', 'closed', 'закрыт'],
    overdue: ['overdue', 'просрочен', 'просрочено', 'late'],
    archived: ['archived', 'в архиве', 'архив', 'cancelled', 'отменён'],
  },
  direction: {
    payable: ['payable', 'к оплате', 'расход', 'expense', 'out', 'we pay', 'платим'],
    receivable: ['receivable', 'к получению', 'доход', 'income', 'in', 'нам должны', 'получаем'],
  },
  type: {
    income: ['income', 'credit', 'доход', 'поступление', 'приход', 'кредит', 'in', '+'],
    expense: ['expense', 'debit', 'расход', 'списание', 'дебет', 'out', '-'],
  },
};

export const normalizeHeader = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

const compact = (value: string): string => value.replace(/\s+/g, '');

/** 1 for an exact alias, 0.7 when the header contains the alias, 0 otherwise. */
export const headerMatchScore = (header: string, aliases: string[]): number => {
  const normalized = normalizeHeader(header);
  if (!normalized) {
    return 0;
  }
  const flat = compact(normalized);
  let best = 0;
  for (const alias of aliases) {
    const aliasNorm = compact(normalizeHeader(alias));
    if (!aliasNorm) {
      continue;
    }
    if (flat === aliasNorm) {
      return 1;
    }
    if (aliasNorm.length >= 3 && flat.includes(aliasNorm)) {
      best = Math.max(best, 0.7);
    }
  }
  return best;
};

export const resolveEnumAlias = (field: string, raw: string): string | null => {
  const table = ENUM_ALIASES[field];
  if (!table) {
    return null;
  }
  const value = normalizeHeader(raw);
  if (!value) {
    return null;
  }
  for (const [option, aliases] of Object.entries(table)) {
    if (option === value || aliases.some(alias => normalizeHeader(alias) === value)) {
      return option;
    }
  }
  for (const [option, aliases] of Object.entries(table)) {
    if (aliases.some(alias => alias.length >= 3 && value.includes(normalizeHeader(alias)))) {
      return option;
    }
  }
  return null;
};

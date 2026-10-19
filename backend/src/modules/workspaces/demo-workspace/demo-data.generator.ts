import { addDays, dayOf, daysInMonth, monthFrom, quarterOf } from './demo-dates';
import { DemoRandom } from './demo-random';

/**
 * The demo workspace's contents: a freelance design studio banking in euros,
 * twelve months up to the anchor date. Pure and deterministic — the same
 * anchor gives the same data, which is what lets the guide's screenshots be
 * taken from it — and keyed by names, not ids: the persistence service maps
 * category names and account keys onto the rows of the new workspace.
 *
 * Merchant and client names are proper nouns, so they read the same in every
 * language. Categories are the system ones every workspace is seeded with
 * (stored in English, shown translated), plus `IT services`, which the client
 * translates as well.
 */

/** Months of history, the anchor's month included. */
export const DEMO_MONTHS = 12;

/** Every PRNG draw comes from this seed; changing it changes every amount. */
const SEED = 0x1d3a_2026;

export const DEMO_CURRENCY = 'EUR';

/** The one category the demo adds to the system set; the client translates it too. */
export const DEMO_IT_CATEGORY = 'IT services';

export type DemoCategoryName =
  | 'Services'
  | 'Interest income'
  | 'Rent'
  | 'Utilities'
  | 'Insurance'
  | 'Professional services'
  | 'Fees and charges'
  | 'Taxes'
  | 'Meals and entertainment'
  | 'Travel'
  | 'Office supplies'
  | 'Advertising'
  | 'Equipment'
  | typeof DEMO_IT_CATEGORY;

export type DemoAccountKey = 'current' | 'card';

export interface DemoAccount {
  key: DemoAccountKey;
  name: string;
  accountNumber: string;
  openingCents: number;
}

export interface DemoTransaction {
  /** Unique within the dataset; subscriptions name their charges by it. */
  ref: string;
  account: DemoAccountKey;
  date: string;
  counterparty: string;
  purpose: string;
  type: 'income' | 'expense';
  /** Always positive; `type` says which way the money went. */
  cents: number;
  /** Null: left for the user to categorise. */
  category: DemoCategoryName | null;
  /** False: still waiting in Review, as an import leaves every row. */
  confirmed: boolean;
  /** Both legs of a move between the two accounts share it. */
  transferKey: string | null;
}

export interface DemoStatement {
  account: DemoAccountKey;
  month: string;
  fileName: string;
  dateFrom: string;
  dateTo: string;
  /** When it was "uploaded": the day after the period, never after the anchor. */
  uploadedOn: string;
  openingCents: number;
  closingCents: number;
  transactions: DemoTransaction[];
  /** The bank's CSV export the rows were read from, so the document opens. */
  csv: string;
}

export interface DemoBudget {
  category: DemoCategoryName;
  limitCents: number;
}

export interface DemoSubscription {
  vendor: string;
  cents: number;
  frequency: 'monthly' | 'annual';
  category: DemoCategoryName;
  lastChargeDate: string;
  nextChargeDate: string;
  /** Refs of the transactions that were its charges. */
  chargeRefs: string[];
}

export interface DemoGoal {
  name: string;
  targetCents: number;
  coverPreset: string;
  targetDate: string;
  contributions: Array<{ date: string; cents: number }>;
}

export interface DemoSnapshot {
  date: string;
  cents: number;
}

export interface DemoCustomTable {
  name: string;
  columns: Array<{ key: string; title: string; type: 'text' | 'currency' | 'date' | 'select' }>;
  /** Choices of the `select` column. */
  statusOptions: string[];
  rows: Array<Record<string, string | number>>;
}

export interface DemoDataset {
  anchor: string;
  accounts: DemoAccount[];
  statements: DemoStatement[];
  budgets: DemoBudget[];
  subscriptions: DemoSubscription[];
  goals: DemoGoal[];
  /** Book value of the studio's equipment (balance account ASSET_FIXED), month by month. */
  equipmentValue: DemoSnapshot[];
  customTable: DemoCustomTable;
}

const ACCOUNTS: DemoAccount[] = [
  {
    key: 'current',
    name: 'Nordbank Business',
    accountNumber: 'DE21500105170648489012',
    openingCents: 1_240_000,
  },
  { key: 'card', name: 'Nordbank Card', accountNumber: '5354004417724821', openingCents: 0 },
];

const CLIENTS = ['Brightline Studio', 'Harbor & Co.', 'Morrow Health AG', 'Pinecone Labs'];
const CAFES = ['Five Elephant', 'The Barn Coffee', 'Café Einstein', 'Bonanza Coffee'];
const RESTAURANTS = [
  'Markthalle Neun',
  'Lokal Restaurant',
  'Cocolo Ramen',
  'Mustafa’s Gemüse Kebap',
];
const SHOPS = ['REWE', 'Edeka'];

/** Monthly software, charged to the card. Day of the month and price. */
const SOFTWARE: Array<{ vendor: string; day: number; euros: number }> = [
  { vendor: 'Google Workspace', day: 1, euros: 13.8 },
  { vendor: 'Figma', day: 4, euros: 45 },
  { vendor: 'Notion', day: 9, euros: 10 },
  { vendor: 'Adobe Creative Cloud', day: 14, euros: 66.45 },
  { vendor: 'Slack', day: 19, euros: 8.75 },
  { vendor: 'GitHub', day: 22, euros: 4 },
];
/** The one yearly plan: charged once, in this month of the history. */
const ANNUAL_SOFTWARE = { vendor: 'Dropbox', day: 11, euros: 119.88, monthIndex: 2 };

const BUDGETS: DemoBudget[] = [
  // Over its limit in the anchor month: the team dinner alone passes it.
  { category: 'Meals and entertainment', limitCents: 25_000 },
  { category: DEMO_IT_CATEGORY, limitCents: 18_000 },
  { category: 'Travel', limitCents: 35_000 },
  { category: 'Office supplies', limitCents: 12_000 },
  { category: 'Utilities', limitCents: 16_000 },
];

/** How many of the anchor month's latest rows wait in Review, besides one uncategorised payment. */
const UNCONFIRMED_IN_ANCHOR_MONTH = 4;

const euros = (value: number) => Math.round(value * 100);

const monthLabel = (month: string) => month.replace('-', '/');

/** Adds a row unless it falls after the anchor; confirmed and outside any transfer unless told. */
type AddRow = (
  row: Omit<DemoTransaction, 'ref' | 'confirmed' | 'transferKey'> &
    Partial<Pick<DemoTransaction, 'confirmed' | 'transferKey'>>,
) => void;

export function generateDemoData(anchor: string): DemoDataset {
  const random = new DemoRandom(SEED);
  const months = Array.from({ length: DEMO_MONTHS }, (_, index) =>
    monthFrom(anchor, index - (DEMO_MONTHS - 1)),
  );
  const rows: DemoTransaction[] = [];
  const add: AddRow = row => {
    // Nothing after the anchor: the demo is a record of what already happened.
    if (row.date > anchor) return;
    rows.push({
      confirmed: true,
      transferKey: null,
      ...row,
      ref: `${row.account}:${row.date}:${row.counterparty}:${rows.length}`,
    });
  };

  months.forEach((month, index) => {
    currentAccountMonth(add, random, month);
    cardMonth(add, random, month, index);
  });
  // The dinner that puts the meals budget over its limit in the anchor month.
  add({
    account: 'card',
    date: addDays(anchor, Number(anchor.slice(8, 10)) > 1 ? -1 : 0),
    counterparty: 'Lokal Restaurant',
    purpose: 'Team dinner',
    type: 'expense',
    cents: euros(286.4),
    category: 'Meals and entertainment',
  });
  // A workshop trip to a client the month before: the anchor month then keeps a
  // larger share of its income, and Advice has a plain "savings rate is up" to show.
  const lastMonth = months[DEMO_MONTHS - 2];
  add({
    account: 'card',
    date: dayOf(lastMonth, 20),
    counterparty: 'Deutsche Bahn',
    purpose: 'Workshop trip Hamburg, return',
    type: 'expense',
    cents: euros(189.9),
    category: 'Travel',
  });
  add({
    account: 'card',
    date: dayOf(lastMonth, 22),
    counterparty: 'Hotel Hafenblick Hamburg',
    purpose: 'Workshop trip, 3 nights',
    type: 'expense',
    cents: euros(618),
    category: 'Travel',
  });

  // Settled below from these amounts, so the cents must be final first.
  sortRows(rows);
  makeFingerprintsDistinct(rows);

  // The card is paid off from the current account early the next month: a
  // move between the user's own accounts, counted in neither income nor spending.
  months.slice(1).forEach((month, index) => {
    const previous = months[index];
    const owed = rows
      .filter(
        row => row.account === 'card' && row.type === 'expense' && row.date.startsWith(previous),
      )
      .reduce((sum, row) => sum + row.cents, 0);
    const transferKey = `card-settlement:${previous}`;
    const date = dayOf(month, 6);
    add({
      account: 'current',
      date,
      counterparty: 'Nordbank Card',
      purpose: `Card statement ${monthLabel(previous)}`,
      type: 'expense',
      cents: owed,
      category: null,
      transferKey,
    });
    add({
      account: 'card',
      date,
      counterparty: 'Nordbank Business',
      purpose: `Payment received, statement ${monthLabel(previous)}`,
      type: 'income',
      cents: owed,
      category: null,
      transferKey,
    });
  });

  // The anchor month's newest spending waits in Review, so the "not
  // confirmed" badge and the queue have something to show.
  leaveLatestUnconfirmed(rows, months[DEMO_MONTHS - 1]);
  // And a small payment nobody has categorised yet, on the anchor day itself.
  add({
    account: 'card',
    date: anchor,
    counterparty: 'Kiosk am Kanal',
    purpose: 'Card payment',
    type: 'expense',
    cents: euros(6.5),
    category: null,
    confirmed: false,
  });
  sortRows(rows);

  const statements = ACCOUNTS.flatMap(account => {
    let balance = account.openingCents;
    return months.map(month => {
      const transactions = rows.filter(
        row => row.account === account.key && row.date.startsWith(month),
      );
      const openingCents = balance;
      for (const row of transactions) {
        balance += row.type === 'income' ? row.cents : -row.cents;
      }
      const dateFrom = dayOf(month, 1);
      const monthEnd = dayOf(month, daysInMonth(month));
      const dateTo = monthEnd < anchor ? monthEnd : anchor;
      const nextDay = addDays(dateTo, 1);
      return {
        account: account.key,
        month,
        fileName: `${account.name.toLowerCase().replace(/\s+/g, '-')}-${month}.csv`,
        dateFrom,
        dateTo,
        uploadedOn: nextDay < anchor ? nextDay : anchor,
        openingCents,
        closingCents: balance,
        transactions,
        csv: statementCsv(account, transactions, openingCents),
      };
    });
  });

  return {
    anchor,
    accounts: ACCOUNTS,
    statements,
    budgets: BUDGETS,
    subscriptions: subscriptionsOf(rows, anchor),
    goals: goalsOf(months, anchor),
    equipmentValue: months.map((month, index) => ({
      date: dayOf(month, 1),
      // Gear loses a little value every month; the display bought in the eighth month joins the next.
      cents: euros(4200) - index * euros(55) + (index > 7 ? euros(1299) - (index - 8) * 2700 : 0),
    })),
    customTable: customTableOf(months),
  };
}

/** The current account's month: rent, insurance, client income, bills, the quarter's tax. */
function currentAccountMonth(add: AddRow, random: DemoRandom, month: string): void {
  const label = monthLabel(month);
  add({
    account: 'current',
    date: dayOf(month, 1),
    counterparty: 'Lindenhof Immobilien GmbH',
    purpose: `Studio rent ${label}`,
    type: 'expense',
    cents: euros(1450),
    category: 'Rent',
  });
  add({
    account: 'current',
    date: dayOf(month, 2),
    counterparty: 'Allianz Versicherung',
    purpose: 'Professional liability insurance',
    type: 'expense',
    cents: euros(32.4),
    category: 'Insurance',
  });
  add({
    account: 'current',
    date: dayOf(month, 3),
    counterparty: 'Kestrel Analytics GmbH',
    purpose: `Invoice KS-${month.replace('-', '')} design retainer`,
    type: 'income',
    cents: euros(4800),
    category: 'Services',
  });
  add({
    account: 'current',
    date: dayOf(month, 5),
    counterparty: 'Vattenfall Europe',
    purpose: 'Electricity advance payment',
    type: 'expense',
    cents: random.cents(78, 96),
    category: 'Utilities',
  });
  add({
    account: 'current',
    date: dayOf(month, 7),
    counterparty: 'Telekom Deutschland',
    purpose: 'Business internet and phone',
    type: 'expense',
    cents: euros(49.95),
    category: 'Utilities',
  });
  if (quarterOf(month) !== quarterOf(monthFrom(month, -1))) {
    add({
      account: 'current',
      date: dayOf(month, 10),
      counterparty: 'Finanzamt Berlin',
      purpose: `Income tax prepayment Q${quarterOf(month)}/${month.slice(0, 4)}`,
      type: 'expense',
      cents: euros(1900),
      category: 'Taxes',
    });
  }
  // A project invoice most months, from one of the occasional clients.
  if (random.next() < 0.75) {
    add({
      account: 'current',
      date: dayOf(month, random.int(12, 20)),
      counterparty: random.pick(CLIENTS),
      purpose: `Invoice LS-${month.replace('-', '')}-02 project work`,
      type: 'income',
      cents: random.int(12, 36) * 10_000,
      category: 'Services',
    });
  }
  add({
    account: 'current',
    date: dayOf(month, 15),
    counterparty: 'Klein & Partner Steuerberatung',
    purpose: 'Monthly bookkeeping',
    type: 'expense',
    cents: euros(180),
    category: 'Professional services',
  });
  add({
    account: 'current',
    date: dayOf(month, 28),
    counterparty: 'Nordbank',
    purpose: 'Account fee',
    type: 'expense',
    cents: euros(9.9),
    category: 'Fees and charges',
  });
  add({
    account: 'current',
    date: dayOf(month, daysInMonth(month)),
    counterparty: 'Nordbank',
    purpose: 'Interest credit',
    type: 'income',
    cents: random.cents(3, 9),
    category: 'Interest income',
  });
}

/** The card's month: software, meals, travel, the odd purchase. */
function cardMonth(add: AddRow, random: DemoRandom, month: string, index: number): void {
  for (const software of SOFTWARE) {
    add({
      account: 'card',
      date: dayOf(month, software.day),
      counterparty: software.vendor,
      purpose: `${software.vendor} subscription`,
      type: 'expense',
      cents: euros(software.euros),
      category: DEMO_IT_CATEGORY,
    });
  }
  if (index === ANNUAL_SOFTWARE.monthIndex) {
    add({
      account: 'card',
      date: dayOf(month, ANNUAL_SOFTWARE.day),
      counterparty: ANNUAL_SOFTWARE.vendor,
      purpose: `${ANNUAL_SOFTWARE.vendor} annual plan`,
      type: 'expense',
      cents: euros(ANNUAL_SOFTWARE.euros),
      category: DEMO_IT_CATEGORY,
    });
  }
  const meals = random.int(5, 8);
  for (let meal = 0; meal < meals; meal += 1) {
    const kind = random.int(0, 2);
    const [names, min, max] =
      kind === 0
        ? ([CAFES, 3.5, 14] as const)
        : kind === 1
          ? ([RESTAURANTS, 18, 64] as const)
          : ([SHOPS, 8, 42] as const);
    add({
      account: 'card',
      date: dayOf(month, random.int(1, 28)),
      counterparty: random.pick(names),
      purpose: 'Card payment',
      type: 'expense',
      cents: random.cents(min, max),
      category: 'Meals and entertainment',
    });
  }
  const rides = random.int(1, 3);
  for (let ride = 0; ride < rides; ride += 1) {
    const train = random.next() < 0.5;
    add({
      account: 'card',
      date: dayOf(month, random.int(1, 28)),
      counterparty: train ? 'Deutsche Bahn' : random.pick(['Bolt', 'Uber']),
      purpose: train ? 'Train ticket' : 'Ride',
      type: 'expense',
      cents: train ? random.cents(29.9, 139.9) : random.cents(8, 28),
      category: 'Travel',
    });
  }
  // Two client trips in the year.
  if (index === 3 || index === 8) {
    const day = random.int(6, 20);
    add({
      account: 'card',
      date: dayOf(month, day),
      counterparty: 'Lufthansa',
      purpose: 'Flight booking',
      type: 'expense',
      cents: random.cents(286, 512),
      category: 'Travel',
    });
    add({
      account: 'card',
      date: dayOf(month, day + 1),
      counterparty: 'Airbnb',
      purpose: 'Accommodation',
      type: 'expense',
      cents: random.cents(340, 620),
      category: 'Travel',
    });
  }
  const supplies = random.int(0, 2);
  for (let supply = 0; supply < supplies; supply += 1) {
    const amazon = random.next() < 0.6;
    add({
      account: 'card',
      date: dayOf(month, random.int(1, 28)),
      counterparty: amazon ? 'Amazon EU' : 'McPaper',
      purpose: 'Office supplies',
      type: 'expense',
      cents: amazon ? random.cents(12, 89) : random.cents(6, 24),
      category: 'Office supplies',
    });
  }
  if (index === 4 || index === 5 || index === 9) {
    add({
      account: 'card',
      date: dayOf(month, 16),
      counterparty: 'LinkedIn Ads',
      purpose: 'Sponsored post campaign',
      type: 'expense',
      cents: euros(120),
      category: 'Advertising',
    });
  }
  if (index === 7) {
    add({
      account: 'card',
      date: dayOf(month, 21),
      counterparty: 'Apple Store',
      purpose: 'Studio Display',
      type: 'expense',
      cents: euros(1299),
      category: 'Equipment',
    });
  }
}

function sortRows(rows: DemoTransaction[]): void {
  rows.sort(
    (left, right) =>
      left.date.localeCompare(right.date) ||
      left.account.localeCompare(right.account) ||
      left.counterparty.localeCompare(right.counterparty) ||
      left.cents - right.cents,
  );
}

/**
 * An import refuses two rows with one fingerprint (account, date, amount,
 * direction, merchant). Two coffees at one café on one day at the same price
 * would collide, so the later one costs a cent more.
 */
function makeFingerprintsDistinct(rows: DemoTransaction[]): void {
  const seen = new Set<string>();
  for (const row of rows) {
    let key = fingerprintKey(row);
    while (seen.has(key)) {
      row.cents += 1;
      key = fingerprintKey(row);
    }
    seen.add(key);
  }
}

export function fingerprintKey(row: DemoTransaction): string {
  return [row.account, row.date, row.cents, row.type, row.counterparty.toLowerCase()].join('|');
}

/**
 * Leaves the anchor month's latest spending unconfirmed. Moves between the
 * accounts and the team dinner (which the over-limit budget relies on) stay
 * confirmed. Rows are sorted by date, so the last candidates are the newest.
 */
function leaveLatestUnconfirmed(rows: DemoTransaction[], anchorMonth: string): void {
  const candidates = rows.filter(
    row =>
      row.date.startsWith(anchorMonth) &&
      row.type === 'expense' &&
      row.transferKey === null &&
      row.purpose !== 'Team dinner',
  );
  for (const row of candidates.slice(-UNCONFIRMED_IN_ANCHOR_MONTH)) {
    row.confirmed = false;
  }
}

function subscriptionsOf(rows: DemoTransaction[], anchor: string): DemoSubscription[] {
  const monthly = SOFTWARE.map(software => {
    const charges = rows.filter(row => row.counterparty === software.vendor);
    const last = charges[charges.length - 1];
    const nextMonth = monthFrom(last.date, 1);
    return {
      vendor: software.vendor,
      cents: euros(software.euros),
      frequency: 'monthly' as const,
      category: DEMO_IT_CATEGORY as DemoCategoryName,
      lastChargeDate: last.date,
      nextChargeDate:
        last.date.slice(0, 7) === anchor.slice(0, 7)
          ? dayOf(nextMonth, software.day)
          : dayOf(anchor.slice(0, 7), software.day),
      chargeRefs: charges.map(row => row.ref),
    };
  });
  const annualCharge = rows.find(row => row.counterparty === ANNUAL_SOFTWARE.vendor);
  const annual: DemoSubscription[] = annualCharge
    ? [
        {
          vendor: ANNUAL_SOFTWARE.vendor,
          cents: euros(ANNUAL_SOFTWARE.euros),
          frequency: 'annual',
          category: DEMO_IT_CATEGORY,
          lastChargeDate: annualCharge.date,
          nextChargeDate: `${Number(annualCharge.date.slice(0, 4)) + 1}${annualCharge.date.slice(4)}`,
          chargeRefs: [annualCharge.ref],
        },
      ]
    : [];
  return [...monthly, ...annual];
}

function goalsOf(months: string[], anchor: string): DemoGoal[] {
  const anchorMonth = months[months.length - 1];
  return [
    {
      name: `Japan ${Number(anchor.slice(0, 4)) + 1}`,
      targetCents: euros(6000),
      coverPreset: 'travel',
      targetDate: dayOf(monthFrom(anchorMonth, 8), 1),
      // Set aside on the first of every month since the second month.
      contributions: months.slice(1).map(month => ({ date: dayOf(month, 1), cents: euros(300) })),
    },
    {
      name: 'MacBook Pro',
      targetCents: euros(3200),
      coverPreset: 'tech',
      targetDate: dayOf(monthFrom(anchorMonth, 3), 1),
      contributions: months.slice(-6).map(month => ({ date: dayOf(month, 1), cents: euros(400) })),
    },
  ];
}

function customTableOf(months: string[]): DemoCustomTable {
  const latest = months.slice(-4);
  return {
    name: 'Client projects',
    columns: [
      { key: 'client', title: 'Client', type: 'text' },
      { key: 'project', title: 'Project', type: 'text' },
      { key: 'fee', title: 'Fee', type: 'currency' },
      { key: 'due', title: 'Due', type: 'date' },
      { key: 'status', title: 'Status', type: 'select' },
    ],
    statusOptions: ['Proposal', 'In progress', 'Invoiced', 'Paid'],
    rows: [
      {
        client: 'Kestrel Analytics GmbH',
        project: 'Design retainer',
        fee: 4800,
        due: dayOf(latest[3], 3),
        status: 'Paid',
      },
      {
        client: 'Brightline Studio',
        project: 'Brand refresh',
        fee: 3200,
        due: dayOf(latest[2], 18),
        status: 'Paid',
      },
      {
        client: 'Morrow Health AG',
        project: 'Patient app onboarding',
        fee: 2600,
        due: dayOf(latest[3], 20),
        status: 'Invoiced',
      },
      {
        client: 'Pinecone Labs',
        project: 'Website redesign',
        fee: 5400,
        due: dayOf(monthFrom(latest[3], 1), 15),
        status: 'In progress',
      },
      {
        client: 'Harbor & Co.',
        project: 'Annual report layout',
        fee: 1800,
        due: dayOf(monthFrom(latest[3], 2), 1),
        status: 'Proposal',
      },
    ],
  };
}

/** The account's export for one month: semicolon-separated, signed amounts, running balance. */
function statementCsv(
  account: DemoAccount,
  transactions: DemoTransaction[],
  openingCents: number,
): string {
  const amount = (cents: number) => (cents / 100).toFixed(2);
  let balance = openingCents;
  const lines = transactions.map(row => {
    const signed = row.type === 'income' ? row.cents : -row.cents;
    balance += signed;
    return [
      row.date,
      csvField(row.counterparty),
      csvField(row.purpose),
      amount(signed),
      DEMO_CURRENCY,
      amount(balance),
    ].join(';');
  });
  return [
    `Account;${account.accountNumber}`,
    'Date;Counterparty;Purpose;Amount;Currency;Balance',
    ...lines,
    '',
  ].join('\n');
}

function csvField(value: string): string {
  return /[;"\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

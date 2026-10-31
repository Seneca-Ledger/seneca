import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { itemKindMatcher } from '@/modules/item-images/item-kind.matcher';

/**
 * The bundled dictionary (Wikidata, CLDR, extras) against notes people write,
 * in the languages they write them in, and against everyday statement lines it
 * must keep quiet on.
 */
const matcher = itemKindMatcher();
const kindOf = (note: string): string | null => matcher.match(note);

describe('ItemKindMatcher', () => {
  it.each([
    ['Sold Mac Mini M4', 'desktop'],
    ['Sold MacBook Air', 'laptop'],
    ['Galaxy Tab S9', 'tablet'],
    ['iPhone 13 to a neighbour', 'phone'],
    ['Продал наушники', 'headphones'],
    ['Продажа дивана', 'couch'],
    ['Продал машину', 'car'],
    ['Verkauft: Fahrrad', 'bike'],
    ['Kühlschrank verkauft', 'fridge'],
    ['Vendu canapé', 'couch'],
    ['Vendido coche', 'car'],
    ['Sprzedałem rower', 'bike'],
    ['Satıldı bisiklet', 'bike'],
    ['Myyty polkupyörä', 'bike'],
    ['מכרתי ספה', 'couch'],
    ['自転車を売却', 'bike'],
    ['出售冰箱', 'fridge'],
    ['कार बेची', 'car'],
    ['Phone bill', 'phone'],
    ['Купил кровати', 'bed'],
    ['Продал книги', 'book'],
    // Only Wikidata knows these: makes, models, kinds of a thing.
    ['Sold Toyota Corolla', 'car'],
    ['Продал Samsung Galaxy S21', 'phone'],
    ['Sold Canon EOS 5D', 'camera'],
    ['Sold Yamaha MT-07', 'motorbike'],
    ['Sold rocking chair', 'chair'],
    ['Sold electric guitar', 'guitar'],
    ['Labrador Retriever puppy', 'pet'],
    ['Verkauft Geschirrspüler', 'washer'],
    ['Продал электрогитару', 'guitar'],
  ])('%s → %s', (note, kind) => {
    expect(kindOf(note)).toBe(kind);
  });

  it.each([
    'Card refund',
    'Example Studio invoice',
    'American Express',
    'Payment for office rent',
    'Example Store - Groceries',
    'Hotel booking',
    'Коммунальные платежи',
    'Car wash',
    'Electricity bill',
  ])('names nothing in %s', note => {
    expect(kindOf(note)).toBeNull();
  });
});

/**
 * Precision gate: the invented statement lines the category suggestions are
 * gated on (shops, salaries, transfers, fees, traps included). A line naming a
 * thing gets an icon; nearly all of these name none, and a tile drawn on a bank
 * fee reads as a mistake. Abstaining is always allowed.
 */
describe('item kinds on statement lines', () => {
  const MAX_SHARE = 0.03;
  const fixtures = join(__dirname, '../../categorization/fixtures');
  const lines = ['kind.jsonl', 'brand.jsonl'].flatMap(file =>
    readFileSync(join(fixtures, file), 'utf8')
      .split('\n')
      .filter(Boolean)
      .map(line => JSON.parse(line) as { counterpartyName: string; paymentPurpose: string }),
  );

  it(`draws an icon on at most ${MAX_SHARE * 100}% of ${lines.length} lines`, () => {
    const hits = lines
      .map(line => `${line.counterpartyName} ${line.paymentPurpose}`)
      .flatMap(note => {
        const found = matcher.explain(note);
        return found ? [`${note} → ${found.kind} ("${found.word}")`] : [];
      });

    expect(lines.length).toBeGreaterThan(200);
    expect(hits.length / lines.length, hits.join('\n')).toBeLessThanOrEqual(MAX_SHARE);
  });
});

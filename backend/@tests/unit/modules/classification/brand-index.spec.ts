import {
  type BrandIndexData,
  BrandMatcher,
  brandMatcher,
} from '@/modules/classification/suggestions/brand-index';

/** Invented brands, shaped like NSI rows: [key, include, exclude, wikidata, facet rank]. */
const DATA: BrandIndexData = {
  version: 'test',
  items: [
    ['groceries', 'de,at', '', 'Q1', 0], // 0: Example Markt, a German supermarket
    ['fuel', '001', '', 'Q2', 1], // 1: Example Petrol, worldwide…
    ['groceries', '001', '', 'Q2', 15], // 2: …with a shop at the station
    ['shopping', 'gb', '', 'Q3', 3], // 3: Example Home, a British store
    ['dining', 'gb', '', 'Q4', 10], // 4: another Example Home, a British cafe
    ['phone_internet', 'in', '', 'Q5', 13], // 5: Example Mobile, whose brand tag is "Example Markt"
  ],
  phrases: {
    'example markt': [0, -6],
    'example petrol': [1, 2],
    'example home': [3, 4],
  },
};

const matcher = new BrandMatcher(DATA);
const match = (counterpartyName: string, currency: string) =>
  matcher.match({ counterpartyName, paymentPurpose: counterpartyName, currency });

describe('BrandMatcher', () => {
  it('matches a brand at the start of the name, ignoring store numbers', () => {
    expect(match('EXAMPLE MARKT 1234 CITY', 'EUR')).toEqual({ key: 'groceries', qid: 'Q1' });
  });

  it('matches only where the brand trades', () => {
    expect(match('EXAMPLE MARKT 1234', 'USD')).toBeNull();
  });

  it('reads past bank wording before the name and after an acquirer star', () => {
    expect(match('POS PURCHASE EXAMPLE PETROL 42', 'USD')?.key).toBe('fuel');
    expect(match('PAYPAL *EXAMPLE PETROL', 'USD')?.key).toBe('fuel');
  });

  it('ignores a brand deep inside the descriptor', () => {
    expect(match('PAYMENT TO MEMBER ONE EXAMPLE PETROL', 'USD')).toBeNull();
  });

  it('files one brand listed under several facets by the one people pay at', () => {
    expect(match('EXAMPLE PETROL 42', 'USD')?.key).toBe('fuel');
  });

  it('answers nothing when different brands of that name mean different things', () => {
    expect(match('EXAMPLE HOME 42', 'GBP')).toBeNull();
  });

  it('prefers the brand whose own name it is over one that only carries it as a tag', () => {
    const both = new BrandMatcher({
      ...DATA,
      items: DATA.items.map(([key, , exclude, qid, rank]) => [key, '001', exclude, qid, rank]),
    });
    expect(
      both.match({ counterpartyName: 'EXAMPLE MARKT', paymentPurpose: '', currency: 'INR' }),
    ).toEqual({ key: 'groceries', qid: 'Q1' });
  });

  it('loads the bundled NSI index and finds a worldwide brand in it', () => {
    expect(
      brandMatcher().match({ counterpartyName: 'NETFLIX.COM 1234', paymentPurpose: '', currency: 'EUR' })
        ?.key,
    ).toBe('subscriptions');
  });
});

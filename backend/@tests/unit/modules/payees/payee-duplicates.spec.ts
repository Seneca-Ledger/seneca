import { comparableName, groupLikelyDuplicates } from '@/modules/payees/payee-duplicates';

const payee = (id: string, name: string) => ({ id, name });

describe('payee duplicates', () => {
  it('reads company forms, web endings, accents and punctuation as noise', () => {
    expect(comparableName('ACME Store GmbH')).toBe('acme store');
    expect(comparableName('acme-store.com')).toBe('acme store');
    expect(comparableName('Café Ünter, LLC')).toBe('cafe unter');
  });

  it('groups one business written differently, and a name continuing another', () => {
    const groups = groupLikelyDuplicates([
      payee('p1', 'ACME Store'),
      payee('p2', 'ACME Store GmbH'),
      payee('p3', 'acme-store.com'),
      payee('p4', 'Example Bakery'),
      payee('p5', 'Example Bakery Mitte'),
      payee('p6', 'Other Shop'),
    ]);

    expect(groups.map(group => group.map(item => item.id).sort())).toEqual([
      ['p1', 'p2', 'p3'],
      ['p4', 'p5'],
    ]);
  });

  it('does not treat a short common word as the start of a business name', () => {
    expect(groupLikelyDuplicates([payee('p1', 'Bar'), payee('p2', 'Bar Example')])).toEqual([]);
  });

  it('does not join a word that only starts the same', () => {
    expect(
      groupLikelyDuplicates([payee('p1', 'Example'), payee('p2', 'Examples Market')]),
    ).toEqual([]);
  });
});

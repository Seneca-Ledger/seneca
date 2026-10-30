import { describe, expect, it } from 'vitest';
import { itemSearchTerm } from './item-kind';

describe('itemSearchTerm', () => {
  it.each([
    ['Sold Example Mini X2', 'Example Mini X2'],
    ['sold: Example Mini', 'Example Mini'],
    ['Sold my old bike', 'bike'],
    ['Продал свой старый велосипед', 'велосипед'],
    ['Продажа — «Диван угловой»', 'Диван угловой'],
    ['Example Mini продан', 'Example Mini'],
    ['Verkauft: Fahrrad', 'Fahrrad'],
    ['Zahlung für Kühlschrank', 'Kühlschrank'],
    ['Vente de canapé', 'canapé'],
    ['Compra de bicicleta usada', 'bicicleta usada'],
    ['Sprzedałem rower', 'rower'],
    ['Satıldı bisiklet', 'bisiklet'],
    ['Myyty polkupyörä', 'polkupyörä'],
    ['מכרתי ספה', 'ספה'],
    ['売却 自転車', '自転車'],
  ])('%s → %s', (note, term) => {
    expect(itemSearchTerm(note)).toBe(term);
  });

  it('leaves a word that only starts like a deal', () => {
    expect(itemSearchTerm('Soldering iron')).toBe('Soldering iron');
    expect(itemSearchTerm('Salesforce subscription')).toBe('Salesforce subscription');
  });

  it('never cuts a note down to nothing', () => {
    expect(itemSearchTerm('Sold')).toBe('Sold');
  });
});

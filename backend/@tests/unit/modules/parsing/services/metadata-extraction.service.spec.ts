import { MetadataExtractionService } from '@/modules/parsing/services/metadata-extraction.service';

describe('MetadataExtractionService', () => {
  const service = new MetadataExtractionService();

  describe('mapCurrencyCode', () => {
    it('maps the KZT ISO code to the tenge symbol, not the ruble symbol', () => {
      const result = (service as any).mapCurrencyCode('KZT');

      expect(result).toEqual({ code: 'KZT', symbol: '₸' });
    });

    it('maps the RUB ISO code to the ruble symbol', () => {
      const result = (service as any).mapCurrencyCode('RUB');

      expect(result).toEqual({ code: 'RUB', symbol: '₽' });
    });
  });
});

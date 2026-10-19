import { PlaceSuggestionsBody, UpdateReceiptLocationBody } from '@/contracts';
import { rejectedFields } from '../../../helpers/schema-body';

// The top-level field a body was rejected for, as class-validator reported it.
const errorsOf = async (
  schema: typeof PlaceSuggestionsBody | typeof UpdateReceiptLocationBody,
  body: object,
) => rejectedFields(schema, body);

describe('PlaceSuggestionsBody', () => {
  const valid = {
    statementId: '6f1c2b8e-1d5a-4f0e-9a4b-2c7d8e9f0a1b',
    latitude: 43.73,
    longitude: 7.417,
    accuracy: 30,
  };

  it('accepts a fix for a statement', async () => {
    await expect(errorsOf(PlaceSuggestionsBody, valid)).resolves.toEqual([]);
    await expect(
      errorsOf(PlaceSuggestionsBody, { ...valid, accuracy: undefined }),
    ).resolves.toEqual([]);
  });

  it('rejects a missing or malformed point and a non-uuid statement', async () => {
    await expect(errorsOf(PlaceSuggestionsBody, { ...valid, latitude: 91 })).resolves.toEqual([
      'latitude',
    ]);
    await expect(
      errorsOf(PlaceSuggestionsBody, { ...valid, longitude: undefined }),
    ).resolves.toEqual(['longitude']);
    await expect(
      errorsOf(PlaceSuggestionsBody, { ...valid, statementId: '../receipts' }),
    ).resolves.toEqual(['statementId']);
  });
});

describe('UpdateReceiptLocationBody with a place', () => {
  const place = { name: 'Carrefour', category: 'shop', osmType: 'node', osmId: '274497719' };

  it('accepts a point with or without a picked place', async () => {
    await expect(
      errorsOf(UpdateReceiptLocationBody, { latitude: 1, longitude: 2 }),
    ).resolves.toEqual([]);
    await expect(
      errorsOf(UpdateReceiptLocationBody, { latitude: 1, longitude: 2, place }),
    ).resolves.toEqual([]);
  });

  it('validates the nested place', async () => {
    for (const bad of [
      { ...place, name: '' },
      { ...place, name: 'x'.repeat(201) },
      { ...place, osmType: 'area' },
      { ...place, osmId: '12; drop' },
    ]) {
      await expect(
        errorsOf(UpdateReceiptLocationBody, { latitude: 1, longitude: 2, place: bad }),
      ).resolves.toEqual(['place']);
    }
  });
});

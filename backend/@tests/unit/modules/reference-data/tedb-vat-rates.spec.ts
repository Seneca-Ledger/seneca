import type { Mock } from 'vitest';
import {
  parseTedbResponse,
  TedbVatRatesService,
  tedbCountry,
} from '@/modules/reference-data/tedb-vat-rates.service';
import { createRepoMock } from '../../../helpers/create-repo-mock';

/** One TEDB result, shaped like the service's own answers (default namespace, no prefixes). */
function result(
  memberState: string,
  situationOn: string,
  type: 'STANDARD' | 'REDUCED',
  rateType: string,
  value: number,
  extra: { category?: string; comment?: string } = {},
): string {
  return [
    '<vatRateResults>',
    `<memberState>${memberState}</memberState><type>${type}</type>`,
    `<rate><type>${rateType}</type><value>${value.toFixed(1)}</value></rate>`,
    `<situationOn>${situationOn}+01:00</situationOn>`,
    extra.category
      ? `<category><identifier>${extra.category}</identifier><description>x</description></category>`
      : '',
    extra.comment ? `<comment>${extra.comment}</comment>` : '',
    '</vatRateResults>',
  ].join('');
}

function envelope(...results: string[]): string {
  return [
    '<env:Envelope xmlns:env="http://schemas.xmlsoap.org/soap/envelope/"><env:Header/><env:Body>',
    '<ns0:retrieveVatRatesRespMsg xmlns="urn:x:types" xmlns:ns0="urn:x"><additionalInformation/>',
    ...results,
    '</ns0:retrieveVatRatesRespMsg></env:Body></env:Envelope>',
  ].join('');
}

describe('parseTedbResponse', () => {
  it('groups the results into versions by date, in order', () => {
    const versions = parseTedbResponse(
      envelope(
        result('AT', '2026-07-01', 'STANDARD', 'DEFAULT', 20),
        result('AT', '2026-07-01', 'REDUCED', 'SUPER_REDUCED_RATE', 4.9, { category: 'FOODSTUFFS' }),
        result('AT', '2026-01-01', 'STANDARD', 'DEFAULT', 20),
        result('AT', '2026-01-01', 'REDUCED', 'REDUCED_RATE', 10, { category: 'FOODSTUFFS' }),
      ),
    );
    expect(versions).toEqual([
      {
        from: '2026-01-01',
        standard: 20,
        reduced: [{ rate: 10, kind: 'reduced', categories: ['FOODSTUFFS'] }],
      },
      {
        from: '2026-07-01',
        standard: 20,
        reduced: [{ rate: 4.9, kind: 'super_reduced', categories: ['FOODSTUFFS'] }],
      },
    ]);
  });

  it('leaves out the rates of special territories', () => {
    const [version] = parseTedbResponse(
      envelope(
        result('ES', '2026-07-01', 'STANDARD', 'DEFAULT', 7, { comment: 'VAT - Canary Islands - ' }),
        result('ES', '2026-07-01', 'STANDARD', 'DEFAULT', 21),
        result('PT', '2026-07-01', 'REDUCED', 'REDUCED_RATE', 16, { category: 'REGION' }),
      ),
    );
    expect(version.standard).toBe(21);
    expect(version.reduced).toEqual([]);
  });

  it('keeps a standard rate commented as the import rate', () => {
    const [version] = parseTedbResponse(
      envelope(
        result('DE', '2026-07-01', 'STANDARD', 'DEFAULT', 19, { comment: 'VAT - Import - ' }),
        result('DE', '2026-07-01', 'STANDARD', 'DEFAULT', 19),
      ),
    );
    expect(version.standard).toBe(19);
  });

  it('gives no standard rate when TEDB lists two general ones', () => {
    const [version] = parseTedbResponse(
      envelope(
        result('XX', '2026-07-01', 'STANDARD', 'DEFAULT', 19),
        result('XX', '2026-07-01', 'STANDARD', 'DEFAULT', 20),
      ),
    );
    expect(version.standard).toBeNull();
  });

  it('collects every category a reduced rate applies to, and skips exemptions', () => {
    const [version] = parseTedbResponse(
      envelope(
        result('DE', '2026-07-01', 'REDUCED', 'REDUCED_RATE', 7, { category: 'FOODSTUFFS' }),
        result('DE', '2026-07-01', 'REDUCED', 'REDUCED_RATE', 7, { category: 'BOOKS' }),
        result('DE', '2026-07-01', 'REDUCED', 'EXEMPTED', 0, { category: 'MEDICAL' }),
      ),
    );
    expect(version.reduced).toEqual([
      { rate: 7, kind: 'reduced', categories: ['FOODSTUFFS', 'BOOKS'] },
    ]);
  });

  it('names Greece EL', () => {
    expect(tedbCountry('gr')).toBe('EL');
    expect(tedbCountry('DE')).toBe('DE');
  });
});

describe('TedbVatRatesService', () => {
  const okXml = envelope(result('AT', '2026-07-01', 'STANDARD', 'DEFAULT', 20));

  function setup(fetchImpl: Mock, stored: unknown = null) {
    const repo = createRepoMock();
    repo.findOne.mockResolvedValue(stored);
    (repo as unknown as { upsert: Mock }).upsert = vi.fn();
    return { repo, service: new TedbVatRatesService(repo as never, fetchImpl as never) };
  }

  it('asks for the range from two years back to a year ahead and stores the answer', async () => {
    const fetchImpl = vi.fn(async () => new Response(okXml, { status: 200 }));
    const { repo, service } = setup(fetchImpl);
    const found = await service.snapshot('AT', { today: new Date('2026-10-11T00:00:00Z') });

    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const body = String(init.body);
    expect(body).toContain('<t:isoCode>AT</t:isoCode>');
    expect(body).toContain('<t:from>2024-10-11</t:from><t:to>2027-10-11</t:to>');
    expect(found?.snapshot.versions[0].standard).toBe(20);
    expect((repo as unknown as { upsert: Mock }).upsert).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'tedb', key: 'AT' }),
      ['source', 'key'],
    );
  });

  it('reuses a fresh snapshot without asking', async () => {
    const fetchImpl = vi.fn();
    const stored = { payload: { versions: [] }, fetchedAt: new Date() };
    const { service } = setup(fetchImpl, stored);
    await service.snapshot('AT');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('falls back to what is stored when TEDB fails or answers without a standard rate', async () => {
    const stored = { payload: { versions: [{ from: '2026-01-01' }] }, fetchedAt: new Date(0) };
    const failing = setup(vi.fn(async () => Promise.reject(new Error('down'))), stored);
    expect((await failing.service.snapshot('AT'))?.snapshot).toEqual(stored.payload);

    const empty = setup(vi.fn(async () => new Response(envelope(), { status: 200 })), null);
    expect(await empty.service.snapshot('AT')).toBeNull();
  });

  it('refuses a country code that is not two letters', async () => {
    const fetchImpl = vi.fn();
    const { service } = setup(fetchImpl);
    expect(await service.snapshot('A<B')).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

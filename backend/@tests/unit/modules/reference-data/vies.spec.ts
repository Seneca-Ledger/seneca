import { normalizeVatNumber, ViesService } from '@/modules/reference-data/vies.service';

const answer = (body: unknown) => async () =>
  new Response(JSON.stringify(body), { status: 200 });

describe('normalizeVatNumber', () => {
  it('drops spaces, dots and a typed country prefix', () => {
    expect(normalizeVatNumber('DE', 'de 811.115.368')).toBe('811115368');
    expect(normalizeVatNumber('IE', 'IE6388047V')).toBe('6388047V');
    // VIES calls Greece EL, and people type either.
    expect(normalizeVatNumber('GR', 'EL094014201')).toBe('094014201');
    expect(normalizeVatNumber('GR', 'GR094014201')).toBe('094014201');
  });
});

describe('ViesService', () => {
  it('reads a valid number with its registered name', async () => {
    const fetchImpl = jest.fn(
      answer({ isValid: true, userError: 'VALID', name: 'GOOGLE IRELAND LIMITED' }),
    );
    const result = await new ViesService(fetchImpl as never).check('IE', 'IE 6388047V');
    expect(result).toMatchObject({ status: 'valid', name: 'GOOGLE IRELAND LIMITED' });
    expect(String(fetchImpl.mock.calls[0][0])).toMatch(/\/ms\/IE\/vat\/6388047V$/);
  });

  it('reads an invalid number', async () => {
    const service = new ViesService(jest.fn(answer({ isValid: false, userError: 'INVALID' })) as never);
    expect((await service.check('NL', '000000000B01')).status).toBe('invalid');
  });

  it('knows nothing when the member state register is down', async () => {
    const service = new ViesService(
      jest.fn(answer({ isValid: false, userError: 'MS_UNAVAILABLE', name: '---' })) as never,
    );
    expect(await service.check('DE', '811115368')).toMatchObject({
      status: 'unavailable',
      name: null,
    });
  });

  it('knows nothing when VIES cannot be reached', async () => {
    const service = new ViesService(jest.fn().mockRejectedValue(new Error('timeout')) as never);
    expect((await service.check('DE', '811115368')).status).toBe('unavailable');
  });

  it('asks Greece as EL, and never asks about a country outside the EU', async () => {
    const fetchImpl = jest.fn(answer({ isValid: true, userError: 'VALID', name: '---' }));
    const service = new ViesService(fetchImpl as never);
    expect((await service.check('GR', '094014201')).name).toBeNull();
    expect(String(fetchImpl.mock.calls[0][0])).toContain('/ms/EL/vat/');

    fetchImpl.mockClear();
    expect(service.covers('GB')).toBe(false);
    expect((await service.check('GB', '123456789')).status).toBe('unavailable');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

import { EffectSchemaQueryPipe } from '../../../../src/common/effect/schema-query';
import { CryptoSummaryQuery } from '../../../../src/contracts';
import { CryptoController } from '../../../../src/modules/crypto/crypto.controller';

describe('CryptoController.getSummary', () => {
  const build = () => {
    const cryptoService = { getSummary: vi.fn(async () => ({})) };
    return { controller: new CryptoController(cryptoService as never), cryptoService };
  };
  const query = new EffectSchemaQueryPipe(CryptoSummaryQuery, 'query');

  it('passes a YYYY-MM month through to the service', async () => {
    const { controller, cryptoService } = build();

    await controller.getSummary('ws-1', query.transform({ month: '2026-08' }));

    expect(cryptoService.getSummary).toHaveBeenCalledWith('ws-1', 30, '2026-08');
  });

  it('caps the rolling window at a year', async () => {
    const { controller, cryptoService } = build();

    await controller.getSummary('ws-1', query.transform({ days: '1000' }));

    expect(cryptoService.getSummary).toHaveBeenCalledWith('ws-1', 365, undefined);
  });

  it.each(['2026-13', '2026-8', 'august', '2026-08-01'])('refuses month=%s', month => {
    expect(() => query.transform({ month })).toThrow();
  });

  it.each(['0', '-5', 'abc', '7.5'])('refuses days=%s', days => {
    expect(() => query.transform({ days })).toThrow();
  });
});

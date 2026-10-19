import { CryptoController } from '../../../../src/modules/crypto/crypto.controller';

describe('CryptoController.getSummary', () => {
  const build = () => {
    const cryptoService = { getSummary: jest.fn(async () => ({})) };
    return { controller: new CryptoController(cryptoService as never), cryptoService };
  };

  it('passes a YYYY-MM month through to the service', async () => {
    const { controller, cryptoService } = build();

    await controller.getSummary('ws-1', undefined, '2026-08');

    expect(cryptoService.getSummary).toHaveBeenCalledWith('ws-1', 30, '2026-08');
  });

  it.each(['2026-13', '2026-8', 'august', '2026-08-01'])(
    'falls back to the rolling window for %s',
    async month => {
      const { controller, cryptoService } = build();

      await controller.getSummary('ws-1', undefined, month);

      expect(cryptoService.getSummary).toHaveBeenCalledWith('ws-1', 30, undefined);
    },
  );
});

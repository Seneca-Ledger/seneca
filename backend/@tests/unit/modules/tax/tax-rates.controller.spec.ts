import { TaxRatesController } from '@/modules/tax/tax-rates.controller';

describe('TaxRatesController', () => {
  let controller: TaxRatesController;
  const taxRatesService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  } as any;
  const user = { id: 'user-1' } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new TaxRatesController(taxRatesService);
  });

  it('findAll delegates to service', async () => {
    const mockRates = [{ id: '1', name: 'VAT' }];
    taxRatesService.findAll.mockResolvedValue(mockRates);

    const result = await controller.findAll('ws-1');
    expect(result).toEqual(mockRates);
    expect(taxRatesService.findAll).toHaveBeenCalledWith('ws-1');
  });

  it('findOne delegates to service', async () => {
    const mockRate = { id: 'rate-1', name: 'VAT' };
    taxRatesService.findOne.mockResolvedValue(mockRate);

    const result = await controller.findOne('rate-1', 'ws-1');
    expect(result).toEqual(mockRate);
    expect(taxRatesService.findOne).toHaveBeenCalledWith('rate-1', 'ws-1');
  });

  it('create delegates to service', async () => {
    const dto = { name: 'VAT', rate: 20 };
    const created = { id: 'new-1', ...dto };
    taxRatesService.create.mockResolvedValue(created);

    const result = await controller.create(dto as any, 'ws-1', user);
    expect(result).toEqual(created);
    expect(taxRatesService.create).toHaveBeenCalledWith('ws-1', dto, 'user-1');
  });

  it('update delegates to service', async () => {
    const dto = { rate: 25 };
    const updated = { id: 'rate-1', rate: 25 };
    taxRatesService.update.mockResolvedValue(updated);

    const result = await controller.update('rate-1', dto as any, 'ws-1', user);
    expect(result).toEqual(updated);
    expect(taxRatesService.update).toHaveBeenCalledWith('rate-1', 'ws-1', dto, 'user-1');
  });

  it('remove delegates to service and returns success message', async () => {
    taxRatesService.remove.mockResolvedValue(undefined);

    const result = await controller.remove('rate-1', 'ws-1', user);
    expect(result).toEqual({ message: 'Tax rate deleted successfully' });
    expect(taxRatesService.remove).toHaveBeenCalledWith('rate-1', 'ws-1', 'user-1');
  });
});
